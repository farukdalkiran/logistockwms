import test from "node:test";
import assert from "node:assert/strict";
import { calculateMultinet } from "../lib/multinet/calculate.ts";

const employee={id:"10001",full_name:"Örnek Personel",employment_date:"2025-01-01"};
const instant=(date,time)=>date+"T"+time+":00+03:00";
const punch=(date,start="08:00",end="17:00",status="ON_TIME")=>({
 employee_id:employee.id,check_in_time:instant(date,start),check_out_time:instant(date,end),
 status,working_hours:8,break_hours:1
});
const leave=(dates,type="YILLIK_IZIN",half=false,period=null)=>({
 employee_id:employee.id,leave_type:type,status:"APPROVED",
 start_date:dates[0],end_date:dates[dates.length-1],selected_dates:dates,
 is_half_day:half,half_day_period:period
});
const weekdays=(year,month)=>{
 const dates=[];
 for(let d=1;d<=new Date(Date.UTC(year,month,0)).getUTCDate();d++){
  const date=String(year)+"-"+String(month).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  const dow=new Date(date+"T12:00:00Z").getUTCDay();
  if(dow!==0&&dow!==6)dates.push(date);
 }
 return dates;
};
const calc=(overrides={})=>calculateMultinet({
 employees:[employee],year:2026,month:10,todayIstanbul:"2026-11-01",dailyFee:600,
 attendance:weekdays(2026,10).map(d=>punch(d)),
 leaves:[],holidays:[],...overrides
})[0];

test("next month weekday base, no penalties with ordinary completed work",()=>{
 const r=calc();
 assert.equal(r.baseDays,21);
 assert.equal(r.deductedDays,0);
 assert.equal(r.netDays,21);
 assert.equal(r.totalAmount,12600);
 assert.equal(r.part1+r.part2,r.totalAmount);
});

test("October 28 afternoon and October 29 full official holidays never deduct",()=>{
 const attendance=weekdays(2026,10).filter(d=>d!=="2026-10-29")
  .map(d=>d==="2026-10-28"?punch(d,"08:00","13:00"):punch(d));
 const r=calc({attendance,holidays:[
  {holiday_date:"2026-10-28",title:"Cumhuriyet Bayramı arifesi",period:"AFTERNOON"},
  {holiday_date:"2026-10-29",title:"Cumhuriyet Bayramı",period:"FULL"},
 ]});
 assert.equal(r.deductedDays,0);
 assert.equal(r.holidayProtectedDays,1.5);
 assert.equal(r.netDays,21);
 assert.equal(r.holidayNotes.length,2);
});

test("report and annual leave deduct once even if attendance has mirrored leave rows",()=>{
 const attendance=weekdays(2026,10).filter(d=>!["2026-10-06","2026-10-07"].includes(d)).map(d=>punch(d));
 attendance.push(punch("2026-10-06","08:00","17:00","LEAVE_SAGLIK_RAPORU"));
 attendance.push(punch("2026-10-07","08:00","17:00","LEAVE_YILLIK_IZIN"));
 const r=calc({attendance,leaves:[
  leave(["2026-10-06"],"SAGLIK_RAPORU"),
  leave(["2026-10-07"],"YILLIK_IZIN"),
  leave(["2026-10-07"],"YILLIK_IZIN"),
 ]});
 assert.equal(r.reportDays,1);
 assert.equal(r.leaveDays,1);
 assert.equal(r.missingDays,0);
 assert.equal(r.deductedDays,2);
 assert.equal(r.deductions.length,2);
});

test("half-day leave is half a deduction, completed afternoon is not absent",()=>{
 const attendance=weekdays(2026,10).map(d=>d==="2026-10-07"?punch(d,"13:00","17:00"):punch(d));
 const r=calc({attendance,leaves:[leave(["2026-10-07"],"YILLIK_IZIN",true,"MORNING")]});
 assert.equal(r.leaveDays,0.5);
 assert.equal(r.missingDays,0);
 assert.equal(r.netDays,20.5);
});

test("half official holiday protects only its portion; missing remainder is half a day",()=>{
 const attendance=weekdays(2026,10).filter(d=>d!=="2026-10-28").map(d=>punch(d));
 const r=calc({attendance,holidays:[{holiday_date:"2026-10-28",title:"Resmî tatil",period:"AFTERNOON"}]});
 assert.equal(r.holidayProtectedDays,0.5);
 assert.equal(r.missingDays,0.5);
 assert.equal(r.deductions.length,1);
 assert.equal(r.deductions[0].days,0.5);
});

test("new hires are never penalized before employment date",()=>{
 const r=calc({
  employees:[{...employee,employment_date:"2026-10-28"}],
  attendance:[],
  holidays:[
   {holiday_date:"2026-10-28",title:"Resmî tatil",period:"AFTERNOON"},
   {holiday_date:"2026-10-29",title:"Resmî tatil",period:"FULL"}
  ]
 });
 assert.equal(r.missingDays,1.5);
 assert.equal(r.holidayProtectedDays,1.5);
});

test("unfinished month ignores today and future dates; weekend physical work gets one extra day",()=>{
 const attendance=weekdays(2026,10).filter(d=>d!=="2026-10-30").map(d=>punch(d));
 attendance.push(punch("2026-10-31","08:00","17:00"));
 const current=calc({attendance,todayIstanbul:"2026-10-30"});
 assert.equal(current.missingDays,0);
 assert.equal(current.extraDays,0); // tomorrow's weekend is excluded
 const finished=calc({attendance,todayIstanbul:"2026-11-01"});
 assert.equal(finished.missingDays,1);
 assert.equal(finished.extraDays,1);
});

test("December's payment target correctly rolls over to January",()=>{
 const r=calculateMultinet({employees:[employee],attendance:[],leaves:[],holidays:[],
  year:2026,month:12,dailyFee:600,todayIstanbul:"2026-12-01"})[0];
 assert.equal(r.baseDays,weekdays(2027,1).length);
 assert.equal(r.deductedDays,0);
});

test("multiple physical attendance rows on the same day never count two worked days",()=>{
 const a=weekdays(2026,10).map(d=>punch(d));
 a.push(punch("2026-10-01"));
 const r=calc({attendance:a});
 assert.equal(r.workedDays,22);
 assert.equal(r.deductedDays,0);
});

test("official holidays override overlapping approved leave",()=>{
 const attendance=weekdays(2026,10).filter(d=>d!=="2026-10-29").map(d=>punch(d));
 const r=calc({attendance,leaves:[leave(["2026-10-29"],"SAGLIK_RAPORU")],
  holidays:[{holiday_date:"2026-10-29",title:"Cumhuriyet Bayramı",period:"FULL"}]});
 assert.equal(r.reportDays,0);
 assert.equal(r.holidayProtectedDays,1);
 assert.equal(r.missingDays,0);
});
