export type EmployeeCelebrationSource = {
  id: string;
  full_name: string;
  birthday: string | null;
  birthday_month_day: string | null;
  employment_date: string | null;
};

export type EmployeeCelebration = {
  employeeId: string;
  fullName: string;
  kind: "birthday" | "anniversary";
  date: string;
  daysUntil: number;
  years?: number;
};

const DAY_MS = 86_400_000;

export function getIstanbulToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const d = new Date(utc);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? { year, month, day, utc }
    : null;
}

function nextOccurrence(month: number, day: number, from: number, year: number) {
  // 29 Şubat yalnızca gerçek artık yıllarda listelenir; hayalî tarih üretilmez.
  for (let y = year; y <= year + 5; y++) {
    const date = validDate(`${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    if (date && date.utc >= from) {
      return { date: `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, year: y, daysUntil: Math.round((date.utc - from) / DAY_MS) };
    }
  }
  return null;
}

export function getUpcomingEmployeeEvents(
  employees: EmployeeCelebrationSource[],
  today: string,
  daysAhead = 90,
): EmployeeCelebration[] {
  const current = validDate(today);
  if (!current || !Number.isInteger(daysAhead) || daysAhead < 0) return [];
  const events: EmployeeCelebration[] = [];
  for (const employee of employees) {
    const birthday = employee.birthday && validDate(employee.birthday);
    let birthMonth: number | null = birthday ? birthday.month : null;
    let birthDay: number | null = birthday ? birthday.day : null;
    if (!birthday && employee.birthday_month_day) {
      const parts = /^(\d{2})-(\d{2})$/.exec(employee.birthday_month_day);
      if (parts) {
        birthMonth = Number(parts[1]);
        birthDay = Number(parts[2]);
      }
    }
    if (birthMonth !== null && birthDay !== null) {
      const next = nextOccurrence(birthMonth, birthDay, current.utc, current.year);
      if (next && next.daysUntil <= daysAhead) {
        events.push({ employeeId: employee.id, fullName: employee.full_name, kind: "birthday", date: next.date, daysUntil: next.daysUntil });
      }
    }
    const hired = employee.employment_date && validDate(employee.employment_date);
    if (hired && hired.utc <= current.utc) {
      let next = nextOccurrence(hired.month, hired.day, current.utc, current.year);
      if (next && next.year - hired.year === 0) {
        next = nextOccurrence(hired.month, hired.day, current.utc, current.year + 1);
      }
      if (next && next.daysUntil <= daysAhead) {
        events.push({ employeeId: employee.id, fullName: employee.full_name, kind: "anniversary", date: next.date, daysUntil: next.daysUntil, years: next.year - hired.year });
      }
    }
  }
  return events.sort((a, b) => a.daysUntil - b.daysUntil || a.fullName.localeCompare(b.fullName, "tr"));
}
