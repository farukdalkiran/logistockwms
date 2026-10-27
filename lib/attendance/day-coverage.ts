/** Istanbul-time absence/work segments; an official holiday is never a fake scan. */
export type HalfDayPeriod = "MORNING" | "AFTERNOON";
export type HolidayPeriod = HalfDayPeriod | "FULL";
export type PublicHoliday = {
  id: string;
  holiday_date: string;
  title: string;
  period: HolidayPeriod;
  start_time: string;
  end_time: string;
  credited_hours: number;
};
export type TimedAttendance = {
  check_in_time: string | null;
  check_out_time: string | null;
  status?: string | null;
  working_hours?: number | string | null;
};
export const HOLIDAY_WINDOWS = {
  FULL: { start: "08:00", end: "17:00", hours: 8 },
  MORNING: { start: "08:00", end: "12:00", hours: 4 },
  AFTERNOON: { start: "13:00", end: "17:00", hours: 4 },
} as const;

export const timeAtIstanbul = (date: string, time: string) =>
  new Date(`${date}T${time}:00+03:00`).toISOString();

export function istanbulDate(iso: string): string {
  const items = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (name: string) => items.find(x=>x.type===name)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export const isLeaveRow = (status?: string | null) => status?.startsWith("LEAVE_") ?? false;

/** Subtract union of overlapping punches/approved leaves from holiday coverage.
 *  For FULL holidays the window is 9 clock hours but credits just 8.
 *  Existing work and leave rows remain visible and are NEVER overwritten.
 */
export function uncoveredHolidayHours(
  holiday: Pick<PublicHoliday,"holiday_date"|"start_time"|"end_time"|"credited_hours">,
  entries: TimedAttendance[],
): number {
  // The 08:00–17:00 full-day holiday has a non-working 12:00–13:00
  // lunch gap. Each half counts exactly 4h, not a 9-hour fraction.
  const windows = Number(holiday.credited_hours) >= 8
    ? [["08:00","12:00"],["13:00","17:00"]]
    : [[holiday.start_time.slice(0,5),holiday.end_time.slice(0,5)]];
  let credit=0;
  for(const [from,to] of windows) {
    const start=Date.parse(timeAtIstanbul(holiday.holiday_date,from));
    const end=Date.parse(timeAtIstanbul(holiday.holiday_date,to));
    if(!(end>start))continue;
    const spans:[number,number][]=[];
    for(const entry of entries){
      if(!entry.check_in_time||!entry.check_out_time)continue;
      const a=Math.max(start,Date.parse(entry.check_in_time));
      const b=Math.min(end,Date.parse(entry.check_out_time));
      if(Number.isFinite(a)&&Number.isFinite(b)&&b>a)spans.push([a,b]);
    }
    spans.sort((a,b)=>a[0]-b[0]);
    let occupied=0,cursor=start;
    for(const [a,b] of spans) {
      if(b<=cursor)continue;
      occupied+=b-Math.max(a,cursor);
      cursor=Math.max(cursor,b);
    }
    credit+=4*Math.max(0,(end-start-occupied)/(end-start));
  }
  return Math.round(credit*100)/100;
}

export function holidayCreditForEmployee(holidays: PublicHoliday[], entries: TimedAttendance[]): number {
  const total = holidays.reduce((sum,day)=>
    sum + uncoveredHolidayHours(day, entries), 0);
  return Math.round(total*100)/100;
}

/**
 * Payroll-style credited hours: physical punches win over overlapping leave.
 * All source rows stay visible in the attendance ledger.
 */
export function netCreditedAttendanceHours(entries: TimedAttendance[]): number {
  const actual = entries.filter(r=>!isLeaveRow(r.status));
  const leave = entries.filter(r=>isLeaveRow(r.status));
  let total = actual.reduce((sum,r)=>sum+Math.max(0,Number(r.working_hours)||0),0);
  const alreadyCounted:TimedAttendance[]=[];
  for (const row of leave) {
    const hours=Math.max(0,Number(row.working_hours)||0);
    if(hours<=0 || !row.check_in_time || !row.check_out_time)continue;
    const day=istanbulDate(row.check_in_time);
    const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
    const window={
      holiday_date:day,
      start_time:fmt.format(new Date(row.check_in_time)),
      end_time:fmt.format(new Date(row.check_out_time)),
      credited_hours:hours,
    };
    // A paid leave overlaps physical clock time only once.
    // For an 8h day, time is split around the unpaid 12–13 lunch period.
    total+=Math.min(hours,uncoveredHolidayHours(window,[...actual,...alreadyCounted]));
    alreadyCounted.push(row);
  }
  return Math.round(total*100)/100;
}


/** Amount of a normal 8-hour day covered by any distinct time interval:
 *  08–12 and 13–17, excluding lunch 12–13. Includes unpaid leave as
 *  excused time, while preserving worked hours as a separate quantity.
 */
export function coveredDayHours(
  date: string,
  entries: TimedAttendance[],
  holidays: PublicHoliday[] = [],
): number {
  const spans: [number,number][] = [];
  for(const row of entries){
    if(!row.check_in_time || !row.check_out_time)continue;
    const start=Date.parse(row.check_in_time),end=Date.parse(row.check_out_time);
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)spans.push([start,end]);
  }
  for(const h of holidays){
    if(h.holiday_date!==date)continue;
    const periodWindows = h.period==="FULL" ? ["MORNING","AFTERNOON"] as const : [h.period];
    for(const period of periodWindows){
      const w=HOLIDAY_WINDOWS[period];
      spans.push([Date.parse(timeAtIstanbul(date,w.start)),Date.parse(timeAtIstanbul(date,w.end))]);
    }
  }
  let covered=0;
  for(const key of ["MORNING","AFTERNOON"] as const){
    const w=HOLIDAY_WINDOWS[key],start=Date.parse(timeAtIstanbul(date,w.start));
    const end=Date.parse(timeAtIstanbul(date,w.end));
    const clipped=spans.map(([a,b])=>[Math.max(start,a),Math.min(end,b)] as [number,number])
      .filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
    let cursor=start;
    for(const [a,b] of clipped){
      if(b<=cursor)continue;
      covered+=b-Math.max(a,cursor);
      cursor=Math.max(cursor,b);
    }
  }
  return Math.round(covered/3600000*100)/100;
}

/** Physical paid hours are always retained. Supplementary paid leave and
 *  holiday credit only fill the still-uncovered part of an 8-hour workday.
 *  This also prevents 08–13 work + 13–17 holiday from paying 9h by mistake.
 */
export function dailyCreditedHours(
  date:string,
  entries:TimedAttendance[],
  holidays:PublicHoliday[] = [],
):number{
  const realHours=entries.filter(r=>!isLeaveRow(r.status))
    .reduce((sum,r)=>sum+Math.max(0,Number(r.working_hours)||0),0);
  const paidLeave=Math.max(0,netCreditedAttendanceHours(entries)-realHours);
  const publicHoliday=holidayCreditForEmployee(holidays.filter(h=>h.holiday_date===date),entries);
  return Math.round((realHours+Math.min(Math.max(0,8-realHours),paidLeave+publicHoliday))*100)/100;
}

export function monthlyCreditedHours(holidays:PublicHoliday[],entries:TimedAttendance[]):number{
  const byDay=new Map<string,TimedAttendance[]>();
  for(const r of entries){
    if(!r.check_in_time)continue;
    const date=istanbulDate(r.check_in_time);
    if(!byDay.has(date))byDay.set(date,[]);
    byDay.get(date)!.push(r);
  }
  for(const holiday of holidays) if(!byDay.has(holiday.holiday_date))byDay.set(holiday.holiday_date,[]);
  let hours=0;
  for(const [date,rows] of byDay)hours+=dailyCreditedHours(date,rows,holidays);
  return Math.round(hours*100)/100;
}
