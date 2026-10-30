"use server";

import { createClient } from "@/lib/supabase/server";
import { istanbulDate } from "@/lib/attendance/day-coverage";
import {
  calculateMultinet,
  type MultinetRecord,
  type MultinetAttendance,
  type MultinetLeave,
  type MultinetHoliday,
  type MultinetEmployee,
} from "@/lib/multinet/calculate";

export type { MultinetRecord, MultinetDeduction } from "@/lib/multinet/calculate";

/**
 * The client may request a branch, but authorization is rechecked for every
 * server action invocation. A non-global user can NEVER switch branches.
 */
export async function getMultinetCalculations(
  branchId: string | null,
  year: number,
  month: number,
  dailyFee: number
): Promise<MultinetRecord[]> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("branch_id,role").eq("id",user.id).single();
  if (profileError || !profile) throw new Error("Kullanıcı profili doğrulanamadı.");

  const isGlobal = profile.role === "Developer" || profile.role === "Admin";
  const scopedBranch = isGlobal ? branchId : profile.branch_id;
  if (!scopedBranch || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(scopedBranch))
    throw new Error("Hesaplama için geçerli bir depo seçilmelidir.");
  if (!isGlobal && branchId !== scopedBranch)
    throw new Error("Başka bir deponun Multinet kayıtlarına erişemezsiniz.");

  const { data: warehouse, error: branchError } = await supabase
    .from("branches").select("id,type").eq("id",scopedBranch).single();
  if (branchError || warehouse?.type?.toLocaleLowerCase("tr-TR") !== "depo")
    throw new Error("Multinet hesaplaması yalnızca bağlı depo için yapılabilir.");

  if (!Number.isInteger(year) || year < 2020 || year > 2100 ||
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isFinite(dailyFee) || dailyFee < 0 || dailyFee > 100000)
    throw new Error("Tarih veya günlük Multinet bedeli geçersiz.");

  const startDate = String(year).padStart(4,"0")+"-"+String(month).padStart(2,"0")+"-01";
  const nextYear = month === 12 ? year+1 : year;
  const nextMonth = month === 12 ? 1 : month+1;
  const endDate = String(nextYear).padStart(4,"0")+"-"+String(nextMonth).padStart(2,"0")+"-01";
  const lastDate = new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);

  const { data: employees, error: employeeError } = await supabase.from("employees")
    .select("id,full_name,employment_date")
    .eq("is_active",true).eq("branch_id",scopedBranch).order("full_name");
  if (employeeError) throw new Error("Depo personeli okunamadı: "+employeeError.message);
  if (!employees?.length) return [];

  const employeeIds = employees.map(e=>e.id);
  // Select only the chosen depot's records; 500-row paging also avoids
  // Supabase's usual default 1000-row response limit.
  const attendance: MultinetAttendance[] = [];
  for(let from=0;from<100000;from+=500) {
    const {data,error} = await supabase.from("attendance")
      .select("employee_id,check_in_time,check_out_time,status,working_hours,break_hours")
      .eq("branch_id",scopedBranch).in("employee_id",employeeIds)
      .gte("check_in_time",startDate+"T00:00:00+03:00")
      .lt("check_in_time",endDate+"T00:00:00+03:00")
      .order("check_in_time",{ascending:true}).order("id",{ascending:true})
      .range(from,from+499);
    if(error)throw new Error("Puantaj kayıtları okunamadı: "+error.message);
    attendance.push(...(data||[]));
    if((data||[]).length<500)break;
    if(from===99500)throw new Error("Puantaj kaydı sayısı güvenli sınırı aşıyor.");
  }

  const {data:leaves,error:leaveError}=await supabase.from("leave_requests")
    .select("employee_id,leave_type,custom_leave_type,status,start_date,end_date,selected_dates,is_half_day,half_day_period")
    .eq("branch_id",scopedBranch).in("employee_id",employeeIds)
    .eq("status","APPROVED").lte("start_date",lastDate).gte("end_date",startDate);
  if(leaveError)throw new Error("Onaylı izinler okunamadı: "+leaveError.message);

  const {data:holidays,error:holidayError}=await supabase.from("wms_public_holidays")
    .select("holiday_date,title,period")
    .gte("holiday_date",startDate).lte("holiday_date",lastDate);
  if(holidayError)throw new Error("Resmî tatiller okunamadı: "+holidayError.message);

  return calculateMultinet({
    employees:employees as MultinetEmployee[],
    attendance,
    leaves:(leaves||[]) as MultinetLeave[],
    holidays:(holidays||[]) as MultinetHoliday[],
    year,month,dailyFee,todayIstanbul:istanbulDate(new Date().toISOString()),
  });
}
