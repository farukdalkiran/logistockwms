/**
 * Pure Multinet accrual calculator.
 * The source month supplies deductions; the following month's weekdays form the base.
 * Istanbul calendar dates and half-day slots prevent duplicate deductions.
 */
export type MultinetDeduction = {
  date: string;
  kind: "REPORT" | "LEAVE" | "MISSING";
  reason: string;
  days: number;
};

export type MultinetRecord = {
  employeeId: string;
  fullName: string;
  baseDays: number;
  workedDays: number;
  extraDays: number;
  deductedDays: number;
  leaveDays: number;
  reportDays: number;
  missingDays: number;
  holidayProtectedDays: number;
  netDays: number;
  totalAmount: number;
  part1: number;
  part2: number;
  deductions: MultinetDeduction[];
  details: string[];
  holidayNotes: string[];
};

export type MultinetEmployee = {
  id: string;
  full_name: string;
  employment_date: string | null;
};
export type MultinetAttendance = {
  employee_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string | null;
  working_hours?: number | string | null;
  break_hours?: number | string | null;
};
export type MultinetLeave = {
  employee_id: string;
  leave_type: string;
  custom_leave_type?: string | null;
  status: string;
  start_date: string;
  end_date: string;
  selected_dates?: unknown;
  is_half_day?: boolean | null;
  half_day_period?: string | null;
};
export type MultinetHoliday = {
  holiday_date: string;
  title: string;
  period: string;
};
export type MultinetInput = {
  employees: MultinetEmployee[];
  attendance: MultinetAttendance[];
  leaves: MultinetLeave[];
  holidays: MultinetHoliday[];
  year: number;
  month: number;
  dailyFee: number;
  todayIstanbul: string;
};

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
});
const localTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function isoDate(instant: string): string {
  const parts = localDateFormatter.formatToParts(new Date(instant));
  const part = (key: string) => parts.find(p => p.type === key)?.value || "00";
  return part("year") + "-" + part("month") + "-" + part("day");
}
function isoDay(year: number, month: number, day: number): string {
  return String(year).padStart(4,"0") + "-" + String(month).padStart(2,"0") + "-" + String(day).padStart(2,"0");
}
function weekday(date: string): boolean {
  const d = new Date(date + "T12:00:00Z").getUTCDay();
  return d !== 0 && d !== 6;
}
function datesInMonth(year: number, month: number): string[] {
  return Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, i) => isoDay(year, month, i + 1));
}
function roundDays(n: number): number { return Math.round(n * 2) / 2; }
function roundMoney(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }
function readableLeave(type: string, custom?: string | null): string {
  if (type === "DIGER" && custom?.trim()) return custom.trim();
  const names: Record<string,string> = {
    YILLIK_IZIN: "Yıllık izin", SAGLIK_RAPORU: "Sağlık raporu",
    UCRETSIZ: "Ücretsiz izin", "UCRETSİZ": "Ücretsiz izin",
    UCRETSIZ_IZIN: "Ücretsiz izin", EVLILIK: "Evlilik izni",
    MAZERET: "Mazeret izni", DOGUM: "Doğum izni", DIGER: "Diğer izin",
  };
  return names[type] || type.replace(/_/g," ").toLocaleLowerCase("tr-TR");
}
type Slot = "MORNING" | "AFTERNOON";
type LeavePart = { kind:"LEAVE"|"REPORT"; reason:string };
type Day = {
  physical: MultinetAttendance[];
  leave: Partial<Record<Slot,LeavePart>>;
  holiday: Set<Slot>;
  holidayTitle: string;
  incomplete: boolean;
};
const slots: Slot[] = ["MORNING","AFTERNOON"];
function day(): Day { return {physical:[],leave:{},holiday:new Set(),holidayTitle:"",incomplete:false}; }
function inSlots(record: MultinetAttendance): Set<Slot> {
  const found = new Set<Slot>();
  if (!record.check_in_time || !record.check_out_time) return found;
  const a = Date.parse(record.check_in_time);
  const b = Date.parse(record.check_out_time);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return found;
  const date = isoDate(record.check_in_time);
  for (const slot of slots) {
    const begin = Date.parse(date + (slot === "MORNING" ? "T08:00:00+03:00" : "T13:00:00+03:00"));
    const end = Date.parse(date + (slot === "MORNING" ? "T12:00:00+03:00" : "T17:00:00+03:00"));
    if (Math.min(end,b)-Math.max(begin,a) >= 30*60*1000) found.add(slot);
  }
  return found;
}
function leaveDates(leave: MultinetLeave): string[] {
  if (Array.isArray(leave.selected_dates) && leave.selected_dates.length) {
    return [...new Set(leave.selected_dates.filter((x):x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x)))];
  }
  const start = Date.parse(leave.start_date + "T12:00:00Z");
  const end = Date.parse(leave.end_date + "T12:00:00Z");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const dates: string[] = [];
  for (let t=start; t<=end && dates.length<366; t+=86400000) dates.push(new Date(t).toISOString().slice(0,10));
  return dates;
}
export function calculateMultinet(input: MultinetInput): MultinetRecord[] {
  const {employees,attendance,leaves,holidays,year,month,dailyFee,todayIstanbul} = input;
  if (!Number.isInteger(year) || year<2020 || year>2100 || !Number.isInteger(month) || month<1 || month>12)
    throw new Error("Geçersiz hesaplama dönemi.");
  if (!Number.isFinite(dailyFee) || dailyFee<0 || dailyFee>100000)
    throw new Error("Günlük Multinet bedeli geçersiz.");
  const nextYear = month===12 ? year+1 : year;
  const nextMonth = month===12 ? 1 : month+1;
  const baseDays = datesInMonth(nextYear,nextMonth).filter(weekday).length;
  const sourceDates = datesInMonth(year,month).filter(date=>weekday(date) && date<todayIstanbul);
  const employeeIds = new Set(employees.map(e=>e.id));
  const dayMaps = new Map<string,Map<string,Day>>();
  const getDay = (employeeId:string,date:string):Day => {
    let map = dayMaps.get(employeeId);
    if (!map) {map = new Map();dayMaps.set(employeeId,map);}
    let value = map.get(date);
    if (!value) {value = day();map.set(date,value);}
    return value;
  };
  for (const row of attendance) {
    if (!employeeIds.has(row.employee_id) || !row.check_in_time) continue;
    const date = isoDate(row.check_in_time);
    if (date.slice(0,7) !== isoDay(year,month,1).slice(0,7) || date>=todayIstanbul) continue;
    const d = getDay(row.employee_id,date);
    const status = row.status || "";
    if (status==="LEAVE_RESMI_TATIL") {
      // Older holiday rows might exist without a matching holiday master row.
      const hours = Number(row.working_hours)||0;
      const slot = Number(localTimeFormatter.format(new Date(row.check_in_time)).slice(0,2))>=12?"AFTERNOON":"MORNING";
      const periods: Slot[] = hours>=7.5 ? slots : [slot];
      periods.forEach(s=>d.holiday.add(s));
      d.holidayTitle ||= "Resmî tatil";
    } else if (status.startsWith("LEAVE_")) {
      const type = status.slice(6);
      const part: LeavePart = {kind:type.includes("RAPOR")?"REPORT":"LEAVE",reason:readableLeave(type)};
      const inTime = localTimeFormatter.format(new Date(row.check_in_time));
      const inferredSlots: Slot[] = (Number(row.working_hours)||0)>=7.5
        ? slots : [inTime>="12:00"?"AFTERNOON":"MORNING"];
      for (const slot of inferredSlots) d.leave[slot] ||= part;
    } else if (row.check_out_time && Date.parse(row.check_out_time)>Date.parse(row.check_in_time)) {
      d.physical.push(row);
    } else {
      d.incomplete = true;
    }
  }
  for (const leave of leaves) {
    if (!employeeIds.has(leave.employee_id) || leave.status!=="APPROVED") continue;
    const part: LeavePart = {
      kind:leave.leave_type.includes("RAPOR")?"REPORT":"LEAVE",
      reason:readableLeave(leave.leave_type,leave.custom_leave_type)
    };
    const applies: Slot[] = leave.is_half_day
      ? [leave.half_day_period==="AFTERNOON"?"AFTERNOON":"MORNING"] : slots;
    for (const date of leaveDates(leave)) {
      if (date.slice(0,7)!==isoDay(year,month,1).slice(0,7) || date>=todayIstanbul) continue;
      const d = getDay(leave.employee_id,date);
      // Approved requests are authoritative over legacy LEAVE_ attendance labels.
      for (const slot of applies) d.leave[slot] = part;
    }
  }
  for (const holiday of holidays) {
    if (holiday.holiday_date.slice(0,7)!==isoDay(year,month,1).slice(0,7)) continue;
    for (const employee of employees) {
      const d = getDay(employee.id,holiday.holiday_date);
      const applied: Slot[] = holiday.period==="FULL" ? slots
        : holiday.period==="MORNING" ? ["MORNING"] : holiday.period==="AFTERNOON" ? ["AFTERNOON"] : [];
      applied.forEach(s=>d.holiday.add(s));
      d.holidayTitle = holiday.title || "Resmî tatil";
    }
  }
  return employees.map(employee=>{
    const days = dayMaps.get(employee.id) || new Map<string,Day>();
    const deductions:MultinetDeduction[] = [];
    const details:string[] = [];
    const holidayNotes:string[]=[];
    let workedDays=0,extraDays=0,holidayProtectedDays=0;
    for (const date of sourceDates) {
      if (employee.employment_date && date<employee.employment_date.slice(0,10)) continue;
      const d = days.get(date) || day();
      const physicalSlots = new Set<Slot>();
      let totalHours = 0;
      for (const row of d.physical) {
        inSlots(row).forEach(s=>physicalSlots.add(s));
        const gross=(Date.parse(row.check_out_time!)-Date.parse(row.check_in_time!))/3600000;
        const actual=row.working_hours==null ? Math.max(0,gross-(Number(row.break_hours)||0)) : Math.max(0,Number(row.working_hours)||0);
        totalHours+=actual;
      }
      const hasRealWork = d.physical.length>0;
      const special = d.holiday.size>0 || slots.some(s=>d.leave[s]);
      // Normal shift: presence counts as one day, not an arbitrary short-hour penalty.
      if (hasRealWork && !special) slots.forEach(s=>physicalSlots.add(s));
      const dailyReasons=new Map<string,MultinetDeduction>();
      for (const slot of slots) {
        if (d.holiday.has(slot)) { holidayProtectedDays+=0.5; continue; }
        if (physicalSlots.has(slot)) { workedDays+=0.5; continue; }
        const leave=d.leave[slot];
        const kind=leave?.kind||"MISSING";
        const reason=leave?.reason||(d.incomplete?"Eksik giriş/çıkış kaydı":"Devamsızlık / puantaj kaydı yok");
        const key=kind+"|"+reason;
        if(!dailyReasons.has(key)) dailyReasons.set(key,{date,kind,reason,days:0});
        dailyReasons.get(key)!.days+=0.5;
      }
      deductions.push(...dailyReasons.values());
      if (d.holiday.size) holidayNotes.push(date+" · "+d.holidayTitle+" · "+roundDays(d.holiday.size*0.5)+" gün kesintisiz");
      if (totalHours>=10) {
        extraDays+=1;
        details.push(date+" · 10 saat üzeri çalışma: +1 gün");
      }
    }
    // Weekend work is an extra entitlement; a weekday holiday alone is not extra work.
    for (const [date,d] of days) {
      if (date>=todayIstanbul || weekday(date) || (employee.employment_date && date<employee.employment_date.slice(0,10))) continue;
      if (d.physical.length) {extraDays+=1;details.push(date+" · Hafta sonu mesaisi: +1 gün");}
      const total=d.physical.reduce((sum,r)=>sum+Math.max(0,Number(r.working_hours)||0),0);
      if(total>=10){extraDays+=1;details.push(date+" · 10 saat üzeri çalışma: +1 gün");}
    }
    deductions.sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind));
    const leaveDays=roundDays(deductions.filter(d=>d.kind==="LEAVE").reduce((s,d)=>s+d.days,0));
    const reportDays=roundDays(deductions.filter(d=>d.kind==="REPORT").reduce((s,d)=>s+d.days,0));
    const missingDays=roundDays(deductions.filter(d=>d.kind==="MISSING").reduce((s,d)=>s+d.days,0));
    const deductedDays=roundDays(leaveDays+reportDays+missingDays);
    const netDays=Math.max(0,roundDays(baseDays+extraDays-deductedDays));
    const totalAmount=roundMoney(netDays*dailyFee);
    const part1=roundMoney(totalAmount/2);
    return {
      employeeId:employee.id,fullName:employee.full_name,baseDays,
      workedDays:roundDays(workedDays),extraDays,deductedDays,leaveDays,reportDays,missingDays,
      holidayProtectedDays:roundDays(holidayProtectedDays),netDays,totalAmount,
      part1,part2:roundMoney(totalAmount-part1),deductions,details,holidayNotes
    };
  }).sort((a,b)=>a.fullName.localeCompare(b.fullName,"tr"));
}
