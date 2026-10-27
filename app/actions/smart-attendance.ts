"use server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { datesForLeave, isISODate } from "@/lib/attendance/leave-records";
import { istanbulDate, timeAtIstanbul } from "@/lib/attendance/day-coverage";
import type { HolidayPeriod } from "@/lib/attendance/day-coverage";

const db=createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,
 {auth:{autoRefreshToken:false,persistSession:false}});
async function requireHRActor() {
 const session=await createSessionClient();
 const {data:claims,error}=await session.auth.getClaims();
 if(error||!claims?.claims?.sub)throw new Error("Giriş yapmanız gerekiyor.");
 const {data:profile}=await db.from("profiles").select("role").eq("id",claims.claims.sub).single();
 if(!profile || !["Developer","Admin"].includes(profile.role))
   throw new Error("Toplu puantaj işlemi için yönetim yetkisi gerekli.");
}
function datesBetween(start:string,end:string,excluded:string[]) {
 if(!isISODate(start)||!isISODate(end)||start>end)throw new Error("Tarih aralığı hatalı.");
 const count=Math.round((Date.parse(end+"T12:00:00Z")-Date.parse(start+"T12:00:00Z"))/86400000)+1;
 if(count>92)throw new Error("Tek seferde en fazla 92 gün taranabilir.");
 const dates:string[]=[];
 for(let i=0;i<count;i++){
  const d=new Date(Date.parse(start+"T12:00:00Z")+i*86400000);
  const date=d.toISOString().slice(0,10);
  if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&!excluded.includes(date)) dates.push(date);
 }
 return dates;
}
function nextDate(day:string){return new Date(Date.parse(day+"T12:00:00Z")+86400000).toISOString().slice(0,10);}
function isHolidayComplete(periods:Set<string>) {
 return periods.has("FULL")||(periods.has("MORNING")&&periods.has("AFTERNOON"));
}
export async function analyzeAttendanceGaps(
 employeeIds:string[],startDateStr:string,endDateStr:string,excludedDates:string[]=[],
){
 try{
  await requireHRActor();
  const ids=[...new Set(employeeIds.filter(Boolean))];
  if(!ids.length||ids.length>500)throw new Error("1–500 çalışan seçiniz.");
  const weekdays=datesBetween(startDateStr,endDateStr,excludedDates);
  const startISO=timeAtIstanbul(startDateStr,"00:00");
  const endISO=timeAtIstanbul(nextDate(endDateStr),"00:00");
  const [att,leaves,holidays]=await Promise.all([
   db.from("attendance").select("employee_id,check_in_time,status")
    .in("employee_id",ids).gte("check_in_time",startISO).lt("check_in_time",endISO),
   db.from("leave_requests").select("employee_id,selected_dates,start_date,is_half_day,half_day_period")
    .in("employee_id",ids).eq("status","APPROVED")
    .lte("start_date",endDateStr).gte("end_date",startDateStr),
   db.from("wms_public_holidays").select("holiday_date,period")
    .gte("holiday_date",startDateStr).lte("holiday_date",endDateStr)
  ]);
  if(att.error||leaves.error||holidays.error)throw att.error??leaves.error??holidays.error;
  const actual=new Set<string>();
  for(const record of att.data??[]){
   if(record.check_in_time&&!String(record.status||"").startsWith("LEAVE_"))
    actual.add(record.employee_id+"_"+istanbulDate(record.check_in_time));
  }
  const portions=new Map<string,Set<string>>();
  const add=(key:string,period:string)=>{
   if(!portions.has(key))portions.set(key,new Set());
   portions.get(key)!.add(period);
  };
  for(const holiday of holidays.data??[]){
   for(const id of ids)add(id+"_"+holiday.holiday_date,holiday.period);
  }
  for(const req of leaves.data??[]){
   const portion=req.is_half_day?(req.half_day_period==="AFTERNOON"?"AFTERNOON":"MORNING"):"FULL";
   for(const date of datesForLeave(req.selected_dates,req.start_date)){
    if(date>=startDateStr&&date<=endDateStr)add(req.employee_id+"_"+date,portion);
   }
  }
  const results:{date:string;employeeIds:string[];partialEmployeeIds:string[]}[]=[];
  for(const date of weekdays){
   const missing:string[]=[],partial:string[]=[];
   for(const id of ids){
    const key=id+"_"+date;
    if(actual.has(key)||isHolidayComplete(portions.get(key)??new Set()))continue;
    if((portions.get(key)?.size??0)>0)partial.push(id);
    else missing.push(id);
   }
   if(missing.length||partial.length)results.push({date,employeeIds:missing,partialEmployeeIds:partial});
  }
  return {success:true,data:results,message:"Eksik günler hesaplandı; yarım günler ayrı işaretlendi."};
 }catch(e){return {success:false,message:e instanceof Error?e.message:"Tarama hatası."};}
}
type BulkGapPayload={date:string;isHoliday:boolean;checkIn:string;checkOut:string;breakMinutes:number;employeeIds:string[]};
export async function processBulkMissingAttendance(payloads:BulkGapPayload[],managerId:string) {
 try{
  await requireHRActor();
  if(!Array.isArray(payloads)||payloads.length>92)throw new Error("Tarih sayısı sınırlandı.");
  if(!payloads.length)return {success:true,message:"İşlenecek kayıt yok."};
  const selected=[...new Set(payloads.flatMap(x=>x.employeeIds))];
  if(!selected.length)return {success:true,message:"Gerçek eksik gün bulunmuyor."};
  const dates=payloads.map(x=>x.date).sort(),start=dates[0],end=dates[dates.length-1];
  datesBetween(start,end,[]);
  const [employees,existing,leaves,holidays]=await Promise.all([
   db.from("employees").select("id,branch_id").in("id",selected).eq("is_active",true),
   db.from("attendance").select("employee_id,check_in_time,status")
    .in("employee_id",selected).gte("check_in_time",timeAtIstanbul(start,"00:00"))
    .lt("check_in_time",timeAtIstanbul(nextDate(end),"00:00")),
   db.from("leave_requests").select("employee_id,selected_dates,start_date")
    .in("employee_id",selected).eq("status","APPROVED")
    .lte("start_date",end).gte("end_date",start),
   db.from("wms_public_holidays").select("holiday_date,period").gte("holiday_date",start).lte("holiday_date",end)
  ]);
  if(employees.error||existing.error||leaves.error||holidays.error)
   throw employees.error??existing.error??leaves.error??holidays.error;
  const branches=new Map((employees.data??[]).map(x=>[x.id,x.branch_id]));
  const occupied=new Set<string>();
  for(const x of existing.data??[])if(x.check_in_time)occupied.add(x.employee_id+"_"+istanbulDate(x.check_in_time));
  for(const x of leaves.data??[])for(const d of datesForLeave(x.selected_dates,x.start_date))occupied.add(x.employee_id+"_"+d);
  const holidayDays=new Set((holidays.data??[]).map(x=>x.holiday_date));
  const rows:Record<string,unknown>[]=[];
  let skipped=0;
  for(const group of payloads){
   if(!isISODate(group.date)||group.isHoliday)throw new Error("Resmî tatil kaydı ayrı Tatil Yönetimi sekmesinden yapılır.");
   if(!/^\d\d:\d\d$/.test(group.checkIn)||!/^\d\d:\d\d$/.test(group.checkOut))
    throw new Error("Mesai saatleri geçersiz.");
   const timeIn=new Date(timeAtIstanbul(group.date,group.checkIn));
   const timeOut=new Date(timeAtIstanbul(group.date,group.checkOut));
   if(timeOut<=timeIn)timeOut.setTime(timeOut.getTime()+86400000);
   const duration=(timeOut.getTime()-timeIn.getTime())/3600000;
   const breakHours=Number(group.breakMinutes)/60;
   if(duration>20||duration<=0||breakHours<0||breakHours>duration)throw new Error("Mesai süresi geçersiz.");
   for(const id of group.employeeIds){
    const key=id+"_"+group.date,branch=branches.get(id);
    // Never synthesize full-day work on a half holiday or a half leave.
    if(!branch||occupied.has(key)||holidayDays.has(group.date)){skipped++;continue;}
    occupied.add(key);
    rows.push({
     employee_id:id,branch_id:branch,check_in_time:timeIn.toISOString(),
     check_out_time:timeOut.toISOString(),rounded_check_in:timeIn.toISOString(),
     rounded_check_out:timeOut.toISOString(),break_hours:Number(breakHours.toFixed(2)),
     working_hours:Number((duration-breakHours).toFixed(2)),status:"PRESENT",
     manager_id:managerId,
    });
   }
  }
  if(rows.length){
   const {error}=await db.from("attendance").insert(rows);
   if(error)throw error;
   // Single audit event instead of one REST insert per employee.
   await db.from("transaction_logs").insert({
    employee_id:managerId,action_type:"BULK_ATTENDANCE_NORMAL",
    description:`${rows.length} eksik mesai tamamlandı, ${skipped} izin/tatil/mevcut kayıt korundu.`
   });
  }
  return {success:true,message:`${rows.length} eksik mesai eklendi. ${skipped} mevcut izin, tatil veya mesai kaydı korunarak atlandı.`};
 }catch(e){return {success:false,message:e instanceof Error?e.message:"Toplu mesai hatası."};}
}
