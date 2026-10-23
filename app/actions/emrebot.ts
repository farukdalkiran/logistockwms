"use server";

import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type Session = { actor: string; role: string; branch: string | null; global: boolean };
const elevated = ["Developer", "Admin", "ADMNWH"];
async function session(): Promise<Session> {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Oturum açmanız gerekiyor.");
  const { data: p, error } = await client.from("profiles").select("role,branch_id").eq("id", user.id).single();
  if (error || !p) throw new Error("Profil bulunamadı.");
  return { actor:user.id, role:p.role, branch:p.branch_id, global: ["Developer","Admin"].includes(p.role) };
}
function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Sunucu anahtarı eksik");
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth:{persistSession:false,autoRefreshToken:false} });
}
const asDay = (d: Date) => { const p = new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d); const part=(type:string)=>p.find(x=>x.type===type)?.value||"";return `${part("year")}-${part("month")}-${part("day")}`; };
const dateOnly = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
function monthBounds() {
  const day=asDay(new Date()), ym=day.slice(0,7);
  return {first:ym+"-01",last:day,ym};
}
export async function getEmreBotFeed() {
  const s=await session(), admin=db();
  const {data:news,error}=await admin.from("bot_announcements")
    .select("id,slug,title,body,category,priority,starts_at,ends_at,action_label,action_href,show_missing_attendance")
    .eq("is_active",true).lte("starts_at",new Date().toISOString()).gt("ends_at",new Date().toISOString())
    .order("priority",{ascending:false}).limit(20);
  if(error)throw error;
  const {data:reads}=await admin.from("bot_announcement_reads").select("announcement_id").eq("user_id",s.actor);
  const read=new Set((reads||[]).map(x=>x.announcement_id));
  const isManager=elevated.includes(s.role);
  let orders: any[]=[];
  if(isManager){
    const {data:headers,error:oe}=await admin.from("orders")
      .select("id,order_code,branch_id,requested_by,status,created_at,branches!orders_branch_id_fkey(name)")
      .eq("status","PENDING").order("created_at",{ascending:false}).limit(35);
    if(oe)throw oe;
    // Warehouse approvers review store orders across branches; store roles do not receive the feed.
    const visible=(headers||[]).filter(h=>isManager);
    if(visible.length){
      const ids=visible.map(x=>x.id), requesters=[...new Set(visible.map(x=>x.requested_by).filter(Boolean))];
      const [{data:items},{data:people}]=await Promise.all([
        admin.from("order_items").select("order_id,requested_qty").in("order_id",ids),
        requesters.length ? admin.from("profiles").select("id,full_name").in("id",requesters) : Promise.resolve({data:[]})
      ]);
      const counts=new Map<string,{quantity:number;lines:number}>();
      for(const item of items||[]){const old=counts.get(item.order_id)||{quantity:0,lines:0};old.quantity+=Number(item.requested_qty)||0;old.lines++;counts.set(item.order_id,old);}
      const names=new Map((people||[]).map(p=>[p.id,p.full_name]));
      orders=visible.filter(x=>counts.has(x.id)).map(x=>({id:x.id,code:x.order_code,branch:Array.isArray(x.branches)?x.branches[0]?.name:(x.branches as any)?.name||"Mağaza",requester:names.get(x.requested_by)||"Mağaza yetkilisi",createdAt:x.created_at,quantity:counts.get(x.id)?.quantity||0,lines:counts.get(x.id)?.lines||0}));
    }
  }
  return {role:s.role,canOrders:isManager,canAttendance:["Developer","Admin","ADMNWH","HR"].includes(s.role),announcements:(news||[]).map(n=>({...n,read:read.has(n.id)})),orders};
}
export async function acknowledgeEmreAnnouncement(id:string) {
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Geçersiz duyuru");
  const s=await session();
  const {error}=await db().from("bot_announcement_reads").upsert({announcement_id:id,user_id:s.actor,read_at:new Date().toISOString()},{onConflict:"announcement_id,user_id"});
  if(error)throw error;
  return {ok:true};
}
export async function getEmreAttendanceGaps() {
  const s=await session();
  if(!["Developer","Admin","ADMNWH","HR"].includes(s.role))throw new Error("Personel bilgilerine erişim yetkiniz yok.");
  const admin=db(),{first,last,ym}=monthBounds();
  // Month-end audit stops at yesterday: today's unfinished attendance is not missing.
  const yesterday=new Date(Date.now()-86400000), end=asDay(yesterday);
  if(end<first)return {month:ym,through:end,rows:[],note:"Bu ay henüz tamamlanmış gün yok."};
  const [{data:employees,error:ee},{data:attendance,error:ae},{data:leaves,error:le},{data:requests,error:re},{data:shiftRows},{data:exceptions}]=await Promise.all([
    admin.from("employees").select("id,full_name,branch_id,employment_date,is_active").eq("is_active",true),
    admin.from("attendance").select("employee_id,check_in_time,status").gte("check_in_time",first+"T00:00:00+03:00").lt("check_in_time",last+"T23:59:59+03:00").range(0,9999),
    admin.from("leave_requests").select("employee_id,start_date,end_date,selected_dates,is_half_day,status").eq("status","APPROVED").lte("start_date",end).gte("end_date",first),
    admin.from("attendance_requests").select("employee_id,request_date,status").in("status",["APPROVED","PENDING"]).gte("request_date",first).lte("request_date",end),
    admin.from("employee_shifts").select("employee_id,shift_date,is_off_day").gte("shift_date",first).lte("shift_date",end),
    admin.from("bot_calendar_exceptions").select("day,branch_id,is_workday").gte("day",first).lte("day",end)
  ]);
  if(ee||ae||le||re)throw new Error("Mesai denetim kayıtları alınamadı.");
  const attended=new Set((attendance||[]).filter(a=>a.check_in_time).map(a=>a.employee_id+"|"+asDay(new Date(a.check_in_time))));
  const approved=new Set<string>(),pending=new Set<string>();
  for(const l of leaves||[]){
    const selected=Array.isArray(l.selected_dates)&&l.selected_dates.length?l.selected_dates.filter((v:unknown)=>typeof v==="string"&&dateOnly(v as string)):[];
    const dates=selected.length?selected:Array.from({length:Math.min(35,Math.max(0,Math.round((Date.parse(l.end_date)-Date.parse(l.start_date))/86400000)+1))},(_,i)=>new Date(Date.parse(l.start_date)+i*86400000).toISOString().slice(0,10));
    for(const day of dates)if(!l.is_half_day)approved.add(l.employee_id+"|"+day);
  }
  for(const r of requests||[]){if(r.status==="APPROVED")approved.add(r.employee_id+"|"+r.request_date);else pending.add(r.employee_id+"|"+r.request_date);}
  const shifts=new Map((shiftRows||[]).map(v=>[v.employee_id+"|"+v.shift_date,v.is_off_day]));
  const calendar=new Map((exceptions||[]).map(v=>[(v.branch_id||"GLOBAL")+"|"+v.day,v.is_workday]));
  const rows=[];
  for(const e of employees||[]){
    if(!s.global && e.branch_id!==s.branch)continue;
    const missed:string[]=[],pendingReview:string[]=[];
    for(let t=Date.parse(first+"T12:00:00Z");t<=Date.parse(end+"T12:00:00Z");t+=86400000){
      const day=new Date(t).toISOString().slice(0,10);
      if(e.employment_date&&day<e.employment_date)continue;
      const shift=shifts.get(e.id+"|"+day), special=calendar.get((e.branch_id||"GLOBAL")+"|"+day)??calendar.get("GLOBAL|"+day);
      const weekday=new Date(t).getUTCDay(), isExpected=special!==undefined?special:shift!==undefined?!shift:weekday!==0&&weekday!==6;
      if(!isExpected)continue;
      const key=e.id+"|"+day;
      if(attended.has(key)||approved.has(key))continue;
      if(pending.has(key))pendingReview.push(day);else missed.push(day);
    }
    if(missed.length||pendingReview.length)rows.push({id:e.id,name:e.full_name,days:missed,pending:pendingReview});
  }
  rows.sort((a,b)=>b.days.length-a.days.length||a.name.localeCompare(b.name,"tr"));
  return {month:ym,through:end,rows,note:"Hafta içi varsayımı kullanıldı. Vardiyası girilmeyen hafta sonları ve resmi tatil/yarım gün istisnaları İK tarafından ayrıca doğrulanmalıdır."};
}
