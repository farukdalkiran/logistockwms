"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import { supabase } from "@/lib/supabase";
import {monthlyCreditedHours,istanbulDate,type PublicHoliday} from "@/lib/attendance/day-coverage";

import {
  UserRound,
  ShieldCheck,
  RefreshCw,
  Clock3,
  Coffee,
  CalendarDays,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Code2,
  LogIn,
  LogOut,
  UsersRound,
  Activity,
  ArrowUpRight,
  Timer,
  CircleAlert,
  Wifi,
  SearchX,
} from "lucide-react";

/* =============================================
   TYPES
============================================= */

interface AttendanceTableProps {
  branchId: string | null;
  isDeveloper?: boolean;
}

interface Employee {
  full_name: string | null;
  position_title: string | null;
  device_token?: string | null;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  break_hours: number | string | null;
  working_hours: number | string | null;
  status: string | null;
  employees: Employee | null;
}

interface MonthlyRecord {
  employee_id: string;
  working_hours: number | string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string | null;
}

type RoleType = "DEVELOPER" | "MANAGER" | "PERSONNEL";

const TIMEZONE = "Europe/Istanbul";
const PRIMARY = "#dc3545";
const PAGE_SIZE = 1000;

/* =============================================
   DATE & FORMAT HELPERS
============================================= */

function getIstanbulParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function istanbulMidnightToUTC(year: number, month: number, day: number) {
  // Türkiye UTC+3 saat diliminde.
  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0)).toISOString();
}

function getDateRanges() {
  const now = getIstanbulParts(new Date());

  const todayStart = istanbulMidnightToUTC(now.year, now.month, now.day);

  const tomorrowStart = istanbulMidnightToUTC(now.year, now.month, now.day + 1);

  const monthStart = istanbulMidnightToUTC(now.year, now.month, 1);

  const nextMonthStart = istanbulMidnightToUTC(now.year, now.month + 1, 1);

  return {
    todayStart,
    tomorrowStart,
    monthStart,
    nextMonthStart,
  };
}

function formatTime(value: string | null) {
  if (!value) return "--:--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--:--";

  return date.toLocaleTimeString("tr-TR", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatHours(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "--";

  const number = Number(value);

  if (!Number.isFinite(number)) return "--";

  const totalMinutes = Math.round(number * 60);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}dk`;
  if (minutes === 0) return `${hours}s`;

  return `${hours}s ${minutes}dk`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function isLeaveStatus(status: string | null) {
  return status?.startsWith("LEAVE_") ?? false;
}

function getLateMinutes(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const { hour, minute } = getIstanbulParts(date);

  return hour * 60 + minute;
}

function getRoleType(title?: string | null): RoleType {
  if (!title) return "PERSONNEL";

  const lower = title.toLocaleLowerCase("tr-TR");

  if (lower.includes("developer") || lower.includes("geliştirici")) {
    return "DEVELOPER";
  }

  if (
    ["yönetici", "müdür", "şef", "admin", "lider", "uzman"].some((role) =>
      lower.includes(role),
    )
  ) {
    return "MANAGER";
  }

  return "PERSONNEL";
}

function getLeaveName(status: string | null) {
  if (!status) return "İZİN";

  const value = status
    .replace(/^LEAVE_/, "")
    .replace(/_/g, " ")
    .toLocaleUpperCase("tr-TR");

  if (value === "SAGLIK RAPORU") return "SAĞLIK RAPORU";
  if (value === "RESMI TATIL") return "RESMÎ TATİL";

  return value;
}

/* =============================================
   REUSABLE COMPONENTS
============================================= */

function EntryIndicator({ time }: { time: string | null }) {
  const minutes = getLateMinutes(time);

  if (minutes === null) {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />;
  }

  let color = "bg-emerald-500";
  let label = "Zamanında giriş";

  if (minutes > 495) {
    color = "bg-[#dc3545]";
    label = "Geç giriş - 08:15 sonrası";
  } else if (minutes >= 491) {
    color = "bg-amber-500";
    label = "Tolerans sınırı - 08:11 / 08:15";
  }

  return (
    <span
      title={label}
      aria-label={label}
      className={`h-2 w-2 shrink-0 rounded-full ring-4 ring-slate-100 ${color}`}
    />
  );
}

function LateBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex min-w-[36px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-400 tabular-nums">
        0
      </span>
    );
  }

  let style = "border-emerald-200 bg-emerald-50 text-emerald-700";
  let dot = "bg-emerald-500";

  if (count === 4) {
    style = "border-amber-200 bg-amber-50 text-amber-700";
    dot = "bg-amber-500";
  }

  if (count >= 5) {
    style = "border-red-200 bg-red-50 text-red-700";
    dot = "bg-red-500";
  }

  return (
    <span
      title={`${count} geç giriş kaydı`}
      className={`inline-flex min-w-[42px] items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-extrabold tabular-nums ${style}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {count}
    </span>
  );
}

function RoleAvatar({ role }: { role: RoleType }) {
  if (role === "DEVELOPER") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700">
        <Code2 size={17} strokeWidth={2.2} />
      </div>
    );
  }

  if (role === "MANAGER") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-[#b91c1c]">
        <ShieldCheck size={17} strokeWidth={2.2} />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600">
      <UserRound size={17} strokeWidth={2.1} />
    </div>
  );
}

function StatusBadge({ record }: { record: AttendanceRecord }) {
  if (isLeaveStatus(record.status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
        <Calendar size={13} />
        {record.check_in_time && record.check_out_time && (Date.parse(record.check_out_time)-Date.parse(record.check_in_time)) <= 4.1*3600000 ? "Yarım Gün İzin" : "İzinli"}
      </span>
    );
  }

  if (!record.check_out_time) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        İçeride
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-700">
      <CheckCircle2 size={13} strokeWidth={2.5} />
      Tamamlandı
    </span>
  );
}

function HeaderStat({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-[94px] items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          accent
            ? "bg-[#dc3545]/15 text-[#ff697b]"
            : "bg-white/10 text-slate-300"
        }`}
      >
        <Icon size={15} strokeWidth={2} />
      </div>

      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </div>

        <div className="mt-0.5 text-[13px] font-extrabold leading-none text-white tabular-nums">
          {value}
        </div>
      </div>
    </div>
  );
}

/* =============================================
   MAIN COMPONENT
============================================= */

export default function AttendanceTable({
  branchId,
  isDeveloper = false,
}: AttendanceTableProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, number>>(
    {},
  );

  const [monthlyLates, setMonthlyLates] = useState<Record<string, number>>({});

  const [holidays,setHolidays]=useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const requestIdRef = useRef(0);
  // Holidays change rarely; cache per month to avoid extra Supabase calls for
  // every attendance Realtime event. Refresh page to see newly saved holidays.
  const holidayCacheRef=useRef<{month:string;fetchedAt:number;data:PublicHoliday[]} | null>(null);

  const canFetch = isDeveloper || (!!branchId && branchId !== "GLOBAL");

  /* ===========================================
     CLOCK
  =========================================== */

  useEffect(() => {
    setNow(new Date());

    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  /* ===========================================
     DATA FETCH
  =========================================== */

  const fetchRecords = useCallback(
    async (showRefreshAnim = false) => {
      const requestId = ++requestIdRef.current;

      if (!canFetch) {
        setRecords([]);
        setHolidays([]);
        setMonthlyTotals({});
        setMonthlyLates({});
        setError(null);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (showRefreshAnim) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const { todayStart, tomorrowStart, monthStart, nextMonthStart } =
        getDateRanges();

      try {
        let dailyQuery = supabase
          .from("attendance")
          .select(
            `
            id,
            employee_id,
            check_in_time,
            check_out_time,
            break_hours,
            working_hours,
            status,
            employees!attendance_employee_id_fkey (
              full_name,
              position_title,
              device_token
            )
          `,
          )
          .gte("check_in_time", todayStart)
          .lt("check_in_time", tomorrowStart)
          .order("check_in_time", { ascending: false });

        if (branchId && branchId !== "GLOBAL") {
          dailyQuery = dailyQuery.eq("branch_id", branchId);
        }

        const { data: dailyData, error: dailyError } = await dailyQuery;

        if (dailyError) throw dailyError;

        const monthlyData: MonthlyRecord[] = [];

        // Supabase varsayılan satır limitinden
        // etkilenmemek için aylık kayıtları
        // parçalar halinde topluyoruz.
        for (let from = 0; ; from += PAGE_SIZE) {
          let monthlyQuery = supabase
            .from("attendance")
            .select("employee_id, working_hours, check_in_time, check_out_time, status")
            .gte("check_in_time", monthStart)
            .lt("check_in_time", nextMonthStart)
            // Pre-entered future public holidays must not inflate today's
            // accumulated monthly hours before the holiday has started.
            .lte("check_in_time", new Date().toISOString())
            .order("check_in_time", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (branchId && branchId !== "GLOBAL") {
            monthlyQuery = monthlyQuery.eq("branch_id", branchId);
          }

          const { data: monthlyPage, error: monthlyError } = await monthlyQuery;

          if (monthlyError) throw monthlyError;

          const page = (monthlyPage ?? []) as MonthlyRecord[];

          monthlyData.push(...page);

          if (page.length < PAGE_SIZE) break;

          if (requestId !== requestIdRef.current) return;
        }

        const monthKey=istanbulDate(monthStart).slice(0,7);
        let currentHolidays:PublicHoliday[]=[];
        const cached=holidayCacheRef.current;
        if(cached && cached.month===monthKey && Date.now()-cached.fetchedAt<30*60*1000){
          currentHolidays=cached.data;
        } else {
          const {data:holidayData,error:holidayError}=await supabase.from("wms_public_holidays")
            .select("id,holiday_date,title,period,start_time,end_time,credited_hours")
            .gte("holiday_date",istanbulDate(monthStart))
            .lt("holiday_date",istanbulDate(nextMonthStart))
            .lte("holiday_date",istanbulDate(new Date().toISOString()));
          if(holidayError)throw holidayError;
          currentHolidays=(holidayData??[]) as PublicHoliday[];
          holidayCacheRef.current={month:monthKey,fetchedAt:Date.now(),data:currentHolidays};
        }
        const totals: Record<string, number> = {};
        const lates: Record<string, number> = {};

        for (const row of monthlyData) {
          const id = row.employee_id;

          if (!id) continue;

          if (!(id in totals)) totals[id] = 0;
          if (!(id in lates)) lates[id] = 0;

          const hours = Number(row.working_hours ?? 0);

          if (Number.isFinite(hours)) {
            totals[id] += hours;
          }

          if (row.check_in_time && !isLeaveStatus(row.status)) {
            const minutes = getLateMinutes(row.check_in_time);

            if (minutes !== null && minutes > 495) {
              lates[id] += 1;
            }
          }
        }

        const byEmployee=new Map<string,MonthlyRecord[]>();
        for(const entry of monthlyData){
          if(!byEmployee.has(entry.employee_id))byEmployee.set(entry.employee_id,[]);
          byEmployee.get(entry.employee_id)!.push(entry);
        }
        for(const [employeeId,entries] of byEmployee) {
          totals[employeeId]=monthlyCreditedHours(currentHolidays,entries);
          totals[employeeId]=Math.round(totals[employeeId]*100)/100;
        }
        if (requestId !== requestIdRef.current) return;

        setHolidays(currentHolidays);
        setRecords((dailyData ?? []) as unknown as AttendanceRecord[]);
        setMonthlyTotals(totals);
        setMonthlyLates(lates);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;

        console.error("[WMS_ATTENDANCE_ERROR]", err);

        setError(
          "Mesai kayıtları alınırken bir sorun oluştu. Lütfen tekrar deneyin.",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [branchId, canFetch],
  );

  /* ===========================================
     REALTIME
  =========================================== */

  useEffect(() => {
    void fetchRecords();

    const handleRefresh = () => {
      void fetchRecords(true);
    };

    window.addEventListener("refresh-wms-attendance", handleRefresh);

    if (!canFetch) {
      return () => {
        window.removeEventListener("refresh-wms-attendance", handleRefresh);
        requestIdRef.current++;
      };
    }

    const realtimeFilter =
      branchId && branchId !== "GLOBAL"
        ? `branch_id=eq.${branchId}`
        : undefined;

    let realtimeRefreshTimer: number | null = null;
    const scheduleRealtimeRefresh = () => {
      if (realtimeRefreshTimer !== null || document.visibilityState !== "visible") return;
      // Batch multi-employee holiday / leave writes into a single read.
      realtimeRefreshTimer = window.setTimeout(() => {
        realtimeRefreshTimer = null;
        void fetchRecords(true);
      }, 2500);
    };
    const channel = supabase
      .channel(`attendance_realtime_${branchId ?? "GLOBAL"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          ...(realtimeFilter ? { filter: realtimeFilter } : {}),
        },
        () => {
          scheduleRealtimeRefresh();
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener("refresh-wms-attendance", handleRefresh);
      if (realtimeRefreshTimer !== null) window.clearTimeout(realtimeRefreshTimer);
      requestIdRef.current++;
      void supabase.removeChannel(channel);
    };
  }, [fetchRecords, branchId, canFetch]);

  /* ===========================================
     SORTING & STATS
  =========================================== */

  const sortedRecords = useMemo(() => {
    const regular = records.filter((record) => !isLeaveStatus(record.status));

    const leaves = records.filter((record) => isLeaveStatus(record.status));

    return [...regular, ...leaves];
  }, [records]);

  const stats = useMemo(() => {
    const regular = records.filter((record) => !isLeaveStatus(record.status));

    return {
      total: records.length,
      inside: regular.filter((record) => !record.check_out_time).length,
      completed: regular.filter((record) => !!record.check_out_time).length,
      leaves: records.filter((record) => isLeaveStatus(record.status)).length,
    };
  }, [records]);

  const todayHoliday=holidays.find(h=>h.holiday_date===istanbulDate(new Date().toISOString()));
  const currentTime = now ? formatTime(now.toISOString()) : "--:--";

  const currentDate = now ? formatDate(now) : "Tarih yükleniyor";

  /* ===========================================
     RENDER
  =========================================== */

  return (
    <section className="flex h-[900px] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
      {todayHoliday && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-900">
          <span>Resmî tatil: <strong>{todayHoliday.title}</strong> · {todayHoliday.start_time.slice(0,5)}–{todayHoliday.end_time.slice(0,5)}</span>
          <span className="rounded border border-amber-300 bg-white px-2 py-1 font-bold">{todayHoliday.credited_hours} saat · gerçek girişler korunur</span>
        </div>
      )}

      {/* =====================================
          DARK HEADER
      ===================================== */}

      <div className="relative shrink-0 overflow-hidden bg-[#0F172B]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[#dc3545]" />

        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#dc3545]/[0.055] blur-3xl" />

        <div className="relative px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* HEADER TITLE */}

            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.07]">
                <Activity
                  size={21}
                  strokeWidth={2.1}
                  className="text-[#ff6075]"
                />
              </div>

              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-slate-400">
                    PERSONEL TAKİP SİSTEMİ
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    CANLI
                  </span>
                </div>

                <h2 className="truncate text-[15px] font-black uppercase tracking-[0.025em] text-white sm:text-[16px]">
                  Günlük Mesai Hareketleri
                </h2>

                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <CalendarDays size={11} />
                  <span>{currentDate}</span>
                </div>
              </div>
            </div>

            {/* HEADER RIGHT */}

            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden xl:flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
                <Wifi size={13} className="text-emerald-400" />

                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                    SİSTEM
                  </div>

                  <div className="text-[10px] font-extrabold text-slate-200">
                    ANLIK TAKİP
                  </div>
                </div>
              </div>

              <div className="flex min-w-[84px] items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
                <Clock3 size={15} className="text-slate-400" />

                <div>
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                    SAAT
                  </div>

                  <div className="text-[14px] font-black leading-tight text-white tabular-nums">
                    {currentTime}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void fetchRecords(true)}
                disabled={loading || isRefreshing || !canFetch}
                title="Mesai kayıtlarını yenile"
                aria-label="Mesai kayıtlarını yenile"
                className="group flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-white/15 bg-white/[0.07] text-slate-300 transition-all duration-200 hover:border-[#dc3545] hover:bg-[#dc3545] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                  strokeWidth={2.3}
                  className={`transition-transform duration-300 ${
                    loading || isRefreshing
                      ? "animate-spin"
                      : "group-hover:rotate-90"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* HEADER STATS */}

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 sm:grid-cols-4">
            <HeaderStat
              label="Toplam Kayıt"
              value={stats.total}
              icon={UsersRound}
            />

            <HeaderStat
              label="İçeride"
              value={stats.inside}
              icon={LogIn}
              accent
            />

            <HeaderStat
              label="Tamamlandı"
              value={stats.completed}
              icon={CheckCircle2}
            />

            <HeaderStat
              label="İzinli"
              value={stats.leaves}
              icon={CalendarDays}
            />
          </div>
        </div>
      </div>

      {/* =====================================
          INFO & LEGEND
      ===================================== */}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500">
            <Activity size={12} />
          </div>

          <span className="text-[10px] font-extrabold uppercase tracking-[0.075em] text-slate-700">
            Personel Hareket Listesi
          </span>

          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600 tabular-nums">
            {records.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-bold text-slate-500">
              08:10 ve öncesi
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-[9px] font-bold text-slate-500">
              08:11 - 08:15
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#dc3545]" />
            <span className="text-[9px] font-bold text-slate-500">
              08:15 sonrası
            </span>
          </div>
        </div>
      </div>

      {/* =====================================
          ERROR
      ===================================== */}

      {error && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-3 py-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-red-700">
            <CircleAlert size={15} />
            {error}
          </div>

          <button
            type="button"
            onClick={() => void fetchRecords(true)}
            className="shrink-0 text-[10px] font-extrabold uppercase text-red-700 underline underline-offset-2"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* =====================================
          TABLE
      ===================================== */}

      <div className="relative min-h-0 flex-1 overflow-auto bg-white">
        <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left">
          {/* TABLE HEADER */}

          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-100">
              <th className="w-[240px] border-b border-r border-slate-200 bg-slate-100 px-3 py-1.5 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  Personel Bilgisi
                </span>
              </th>

              <th className="w-[115px] border-b border-r border-slate-200 bg-slate-100 px-3 py-3.5 text-center">
                <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  <LogIn size={13} />
                  Giriş
                </span>
              </th>

              <th className="w-[115px] border-b border-r border-slate-200 bg-slate-100 px-3 py-3.5 text-center">
                <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  <LogOut size={13} />
                  Çıkış
                </span>
              </th>

              <th className="w-[95px] border-b border-r border-slate-200 bg-slate-100 px-3 py-3.5 text-center">
                <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                  <Coffee size={13} />
                  Mola
                </span>
              </th>

              <th className="w-[115px] border-b border-r border-slate-200 bg-slate-100 px-3 py-3.5 text-center">
                <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  <Timer size={13} />
                  Günlük
                </span>
              </th>

              <th className="w-[95px] border-b border-r border-slate-200 bg-slate-100 px-3 py-3.5 text-center">
                <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  <AlertTriangle size={13} className="text-[#dc3545]" />
                  İhlal
                </span>
              </th>

              <th className="w-[125px] border-b border-r border-[#cdd5e1] bg-[#e7ecf3] px-3 py-3.5 text-center">
                <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#0F172B]">
                  <CalendarDays size={13} />
                  Aylık
                </span>
              </th>

              <th className="w-[145px] border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-right">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  Durum
                </span>
              </th>
            </tr>
          </thead>

          {/* TABLE BODY */}

          <tbody>
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-24 text-center">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                      <RefreshCw
                        size={23}
                        className="animate-spin text-[#dc3545]"
                      />
                    </div>

                    <div>
                      <div className="text-[12px] font-extrabold uppercase tracking-wide text-slate-700">
                        Mesai kayıtları yükleniyor
                      </div>

                      <div className="mt-1.5 text-[11px] text-slate-400">
                        Personel verileri hazırlanıyor...
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ) : !error && sortedRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-24 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-300">
                      <SearchX size={28} strokeWidth={1.6} />
                    </div>

                    <div>
                      <div className="text-[12px] font-extrabold uppercase tracking-wide text-slate-700">
                        Henüz Mesai Kaydı Bulunmuyor
                      </div>

                      <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                        Bugün için personel hareketi kaydedilmedi.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedRecords.map((record, index) => {
                const roleType = getRoleType(record.employees?.position_title);

                const employeeId = record.employee_id;

                const monthlyTotal = monthlyTotals[employeeId] ?? 0;

                const monthlyLate = monthlyLates[employeeId] ?? 0;

                const isLeave = isLeaveStatus(record.status);

                const leaveText = getLeaveName(record.status);

                const isMedicalLeave = leaveText === "SAĞLIK RAPORU";

                return (
                  <tr
                    key={record.id}
                    className={`group transition-colors duration-150 hover:bg-[#f1f5f9] ${
                      index % 2 === 0 ? "bg-white" : "bg-[#fafbfd]"
                    }`}
                  >
                    {/* PERSONNEL */}

                    <td className="border-b border-r border-slate-100 px-3 py-1">
                      <div className="flex items-center gap-3">
                        <RoleAvatar role={roleType} />

                        <div className="min-w-0">
                          <div
                            title={
                              record.employees?.full_name ??
                              "Bilinmeyen Personel"
                            }
                            className="max-w-[190px] truncate text-[11px] font-extrabold uppercase tracking-[0.015em] text-[#0F172B]"
                          >
                            {record.employees?.full_name ||
                              "BİLİNMEYEN PERSONEL"}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5">
                            {roleType === "DEVELOPER" && (
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                            )}

                            <span
                              className={`max-w-[180px] truncate text-[9px] font-bold uppercase tracking-wide ${
                                roleType === "DEVELOPER"
                                  ? "text-violet-600"
                                  : roleType === "MANAGER"
                                    ? "text-red-600"
                                    : "text-slate-400"
                              }`}
                            >
                              {record.employees?.position_title || "PERSONEL"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* LEAVE OR WORKING RECORD */}

                    {isLeave ? (
                      <td
                        colSpan={5}
                        className="border-b border-r border-slate-100 px-4 py-3 text-center"
                      >
                        <div
                          className={`mx-auto flex max-w-[340px] items-center justify-center gap-2 rounded-md border px-3 py-2 ${
                            leaveText === "RESMÎ TATİL"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : isMedicalLeave
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                          }`}
                        >
                          <CalendarDays size={15} strokeWidth={2.1} />

                          <span className="text-[10px] font-extrabold uppercase tracking-wider">
                            {leaveText} · {formatTime(record.check_in_time)}–{formatTime(record.check_out_time)}
                            <span className="ml-2 rounded-[5px] border border-current/20 bg-white/70 px-1.5 py-0.5 font-mono">{formatHours(record.working_hours)}</span>
                          </span>
                        </div>
                      </td>
                    ) : (
                      <>
                        {/* CHECK IN */}

                        <td className="border-b border-r border-slate-100 px-3 py-3 text-center">
                          <div className="inline-flex items-center justify-center gap-2">
                            <EntryIndicator time={record.check_in_time} />

                            <span className="text-[12px] font-extrabold text-slate-800 tabular-nums">
                              {formatTime(record.check_in_time)}
                            </span>
                          </div>
                        </td>

                        {/* CHECK OUT */}

                        <td className="border-b border-r border-slate-100 px-3 py-3 text-center">
                          {record.check_out_time ? (
                            <span className="text-[12px] font-bold text-slate-700 tabular-nums">
                              {formatTime(record.check_out_time)}
                            </span>
                          ) : (
                            <span className="text-[12px] font-bold text-slate-300">
                              --:--
                            </span>
                          )}
                        </td>

                        {/* BREAK */}

                        <td className="border-b border-r border-slate-100 px-3 py-3 text-center">
                          <span className="text-[11px] font-bold text-amber-700 tabular-nums">
                            {formatHours(record.break_hours ?? 0)}
                          </span>
                        </td>

                        {/* DAILY HOURS */}

                        <td className="border-b border-r border-slate-100 px-3 py-3 text-center">
                          <span className="inline-flex min-w-[64px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-700 tabular-nums">
                            {record.working_hours !== null &&
                            record.working_hours !== undefined
                              ? formatHours(record.working_hours)
                              : "--"}
                          </span>
                        </td>

                        {/* LATE VIOLATIONS */}

                        <td className="border-b border-r border-slate-100 px-3 py-3 text-center">
                          <LateBadge count={monthlyLate} />
                        </td>
                      </>
                    )}

                    {/* MONTHLY HOURS */}

                    <td className="border-b border-r border-[#e2e8f0] bg-[#f1f5f9]/70 px-3 py-3 text-center group-hover:bg-[#e7edf5]">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <span className="text-[12px] font-black text-[#0F172B] tabular-nums">
                          {formatHours(monthlyTotal)}
                        </span>
                      </div>
                    </td>

                    {/* STATUS */}

                    <td className="border-b border-slate-100 px-3 py-1 text-right">
                      <StatusBadge record={record} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================
          FOOTER
      ===================================== */}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500">
            <UsersRound size={12} />
          </span>

          <span className="text-[10px] font-semibold text-slate-500">
            Toplam{" "}
            <strong className="font-extrabold text-[#0F172B]">
              {records.length}
            </strong>{" "}
            kayıt görüntüleniyor
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Otomatik Veri Takibi
          </span>

          <span className="hidden text-[9px] font-semibold text-slate-400 sm:inline">
            • Türkiye Saati (UTC+3)
          </span>
        </div>
      </div>
    </section>
  );
}
