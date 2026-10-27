import { HOLIDAY_WINDOWS, timeAtIstanbul, type HalfDayPeriod } from "./day-coverage";

export const isISODate = (date:string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(date+"T12:00:00Z"));

export function datesForLeave(input: unknown, fallback?: string): string[] {
  const raw: unknown = Array.isArray(input) ? input
    : typeof input==="string" ? JSON.parse(input) : fallback ? [fallback] : [];
  if(!Array.isArray(raw) || !raw.length || raw.length>100) throw new Error("İzin tarihleri geçersiz.");
  const dates=[...new Set(raw.map(x=>String(x).slice(0,10)))].sort();
  if(dates.some(d=>!isISODate(d))) throw new Error("İzin tarihlerinde hata var.");
  return dates;
}

export function leaveAttendanceRows(input:{
 id:string;employee_id:string;branch_id:string;leave_type:string;
 is_half_day:boolean;half_day_period?:string|null;selected_dates:unknown;start_date?:string
}) {
 const dates=datesForLeave(input.selected_dates,input.start_date);
 const period:HalfDayPeriod=input.half_day_period==="AFTERNOON"?"AFTERNOON":"MORNING";
 const window=HOLIDAY_WINDOWS[input.is_half_day?period:"FULL"];
 const unpaid=input.leave_type==="UCRETSIZ"||input.leave_type==="ÜCRETSİZ";
 return dates.map(date=>{
   const checkIn=timeAtIstanbul(date,window.start);
   const checkOut=timeAtIstanbul(date,window.end);
   return {
     employee_id:input.employee_id,branch_id:input.branch_id,
     leave_request_id:input.id,check_in_time:checkIn,check_out_time:checkOut,
     rounded_check_in:checkIn,rounded_check_out:checkOut,
     working_hours:unpaid?0:window.hours,
     break_hours:input.is_half_day?0:1,
     status:`LEAVE_${input.leave_type}`,
   };
 });
}
