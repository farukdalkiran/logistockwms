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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
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
  const date = holiday.holiday_date;
  const start = Date.parse(timeAtIstanbul(date, holiday.start_time.slice(0,5)));
  const end = Date.parse(timeAtIstanbul(date, holiday.end_time.slice(0,5)));
  if (!(end > start)) return 0;
  const spans: [number,number][] = [];
  for (const entry of entries) {
    if (!entry.check_in_time || !entry.check_out_time) continue;
    const a = Math.max(start, Date.parse(entry.check_in_time));
    const b = Math.min(end, Date.parse(entry.check_out_time));
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) spans.push([a,b]);
  }
  spans.sort((a,b)=>a[0]-b[0]);
  let occupied = 0, cursor = start;
  for (const [a,b] of spans) {
    if (b <= cursor) continue;
    occupied += b - Math.max(a,cursor);
    cursor = Math.max(cursor,b);
  }
  const fraction = Math.max(0, (end - start - occupied) / (end - start));
  return Math.round(Math.max(0, Number(holiday.credited_hours)) * fraction * 100) / 100;
}

export function holidayCreditForEmployee(holidays: PublicHoliday[], entries: TimedAttendance[]): number {
  const total = holidays.reduce((sum,day)=>
    sum + uncoveredHolidayHours(day, entries), 0);
  return Math.round(total*100)/100;
}
