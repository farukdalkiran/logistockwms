import "server-only";
import { getHRActor, assertHRBranch } from "@/lib/hr/access";

export type HREmployee = {
  id: string;
  full_name: string;
  position_title: string | null;
  branch_id: string;
  branch_name: string;
  is_active: boolean;
  birthday: string | null;
  employment_date: string | null;
  leave_balance: number | null;
  toplam_izin_hakki: number | null;
  kalan_izin: number | null;
  created_at: string | null;
  account: { id: string; email: string | null; role: string; created_at: string | null } | null;
};
export type HRRecord = {
  id: string;
  employee_id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string | null;
  break_hours: number | null;
  working_hours: number | null;
  leave_request_id: string | null;
  public_holiday_id: string | null;
};
export type HRLeave = {
  id: string; employee_id: string; leave_type: string; custom_leave_type: string | null;
  start_date: string; end_date: string; is_half_day: boolean;
  requested_days: number; status: string; reason: string | null;
};
export type HRCorrection = {
  id: string; employee_id: string; request_date: string;
  request_type: string | null; reason: string; status: string; created_at: string;
};
export type HROperation = {
  id: string; employee_id: string; action_type: string; description: string | null; created_at: string;
};
export type HRCargoSession = {
  id: string; employee_id: string; carrier_name: string; status: string | null;
  total_items: number | null; started_at: string | null;
};
export type HRIntelligence = {
  month: string;
  selectedBranch: string | null;
  ownBranchId: string | null;
  isGlobal: boolean;
  canManage: boolean;
  branches: { id: string; name: string }[];
  employees: HREmployee[];
  attendance: HRRecord[];
  leaves: HRLeave[];
  corrections: HRCorrection[];
  operations: HROperation[];
  cargoSessions: HRCargoSession[];
  truncated: string[];
};

function parseMonth(value?: string) {
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit",
  }).format(new Date());
  const candidate = value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : current;
  const [year, month] = candidate.split("-").map(Number);
  if (year < 2024 || year > 2100) throw new Error("Geçersiz rapor dönemi.");
  const begin = new Date(Date.UTC(year, month - 1, 1, -3)).toISOString();
  const end = new Date(Date.UTC(year, month, 1, -3)).toISOString();
  return { candidate, begin, end, firstDay: candidate + "-01", lastDay: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}

// API varsayılan 1000 satır sınırına takılmamak için sayfalama; üst sınır aşıldığında kullanıcı bilgilendirilir.
async function pages<T>(
  label: string,
  factory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  truncated: string[],
): Promise<T[]> {
  const results: T[] = [];
  for (let page = 0; page < 5; page++) {
    const { data, error } = await factory(page * 1000, page * 1000 + 999);
    if (error) throw new Error(label + " verisi alınamadı: " + error.message);
    results.push(...(data || []));
    if (!data || data.length < 1000) return results;
  }
  truncated.push(label);
  return results;
}

export async function getHRIntelligenceData(monthValue?: string, branchValue?: string): Promise<HRIntelligence> {
  const actor = await getHRActor();
  const { candidate, begin, end } = parseMonth(monthValue);
  const selectedBranch = actor.isGlobal
    ? (branchValue && branchValue !== "ALL" ? assertHRBranch(actor, branchValue) : null)
    : actor.branchId;
  const truncated: string[] = [];

  const branchesQuery = actor.db.from("branches").select("id, name").order("name");
  if (!actor.isGlobal) branchesQuery.eq("id", actor.branchId!);
  const employeesQuery = actor.db.from("employees")
    .select("id, full_name, position_title, branch_id, is_active, birthday, employment_date, leave_balance, toplam_izin_hakki, kalan_izin, created_at, branches(name)")
    .order("full_name");
  if (selectedBranch) employeesQuery.eq("branch_id", selectedBranch);
  const [branchesResult, employeeRows] = await Promise.all([
    branchesQuery,
    pages<any>("Personel", (from, to) => employeesQuery.range(from, to), truncated),
  ]);
  if (branchesResult.error) throw new Error("Şubeler alınamadı: " + branchesResult.error.message);
  const branches = (branchesResult.data || []) as { id: string; name: string }[];
  const employeeIds = employeeRows.map((e: any) => String(e.id));
  if (!employeeIds.length) {
    return { month: candidate, selectedBranch, ownBranchId: actor.branchId, isGlobal: actor.isGlobal, canManage: actor.canManage,
      branches, employees: [], attendance: [], leaves: [], corrections: [], operations: [], cargoSessions: [], truncated };
  }

  const scoped = (table: string, columns: string, dateColumn?: string, start?: string, finish?: string) => {
    let q = actor.db.from(table).select(columns).in("employee_id", employeeIds);
    if (selectedBranch) q = q.eq("branch_id", selectedBranch);
    if (dateColumn && start) q = q.gte(dateColumn, start);
    if (dateColumn && finish) q = q.lt(dateColumn, finish);
    return q;
  };

  // Tüm ilişkiler çalışan ID'si ve (varsa) şube üzerinden filtrelenir.
  const attendanceQuery = scoped("attendance", "id, employee_id, check_in_time, check_out_time, status, break_hours, working_hours, leave_request_id, public_holiday_id", "check_in_time", begin, end).order("check_in_time", { ascending: false });
  const leaveQuery = scoped("leave_requests", "id, employee_id, leave_type, custom_leave_type, start_date, end_date, is_half_day, requested_days, status, reason").order("start_date", { ascending: false });
  const correctionQuery = scoped("attendance_requests", "id, employee_id, request_date, request_type, reason, status, created_at").order("request_date", { ascending: false });
  const opsQuery = scoped("transaction_logs", "id, employee_id, action_type, description, created_at", "created_at", begin, end).order("created_at", { ascending: false });
  const cargoQuery = scoped("cargo_sessions", "id, employee_id, carrier_name, status, total_items, started_at", "started_at", begin, end).order("started_at", { ascending: false });
  // profiles tablosunda yalnızca eşleştirilmiş hesaplar seçilir; parola ve token bilgisi alınmaz.
  let profilesQuery = actor.db.from("profiles").select("id, employee_id, branch_id, email, role, created_at").in("employee_id", employeeIds);
  if (selectedBranch) profilesQuery = profilesQuery.eq("branch_id", selectedBranch);

  const [attendance, leaves, corrections, operations, cargoSessions, accountResult] = await Promise.all([
    pages<HRRecord>("Mesai", (a,b) => attendanceQuery.range(a,b), truncated),
    pages<HRLeave>("İzin", (a,b) => leaveQuery.range(a,b), truncated),
    pages<HRCorrection>("Düzeltme", (a,b) => correctionQuery.range(a,b), truncated),
    pages<HROperation>("Operasyon", (a,b) => opsQuery.range(a,b), truncated),
    pages<HRCargoSession>("Kargo", (a,b) => cargoQuery.range(a,b), truncated),
    profilesQuery,
  ]);
  if (accountResult.error) throw new Error("Hesap bağlantıları okunamadı: " + accountResult.error.message);

  const accountMap = new Map<string, HREmployee["account"]>();
  for (const a of accountResult.data || []) {
    if (a.employee_id) accountMap.set(a.employee_id, {
      id: a.id, email: a.email, role: a.role, created_at: a.created_at,
    });
  }

  const branchMap = new Map(branches.map(b => [b.id, b.name]));
  const employees: HREmployee[] = employeeRows.map((e: any) => ({
    id: e.id, full_name: e.full_name, position_title: e.position_title,
    branch_id: e.branch_id, branch_name: branchMap.get(e.branch_id) || "Bilinmeyen şube",
    is_active: Boolean(e.is_active), birthday: e.birthday,
    employment_date: e.employment_date, leave_balance: e.leave_balance,
    toplam_izin_hakki: e.toplam_izin_hakki, kalan_izin: e.kalan_izin,
    created_at: e.created_at, account: accountMap.get(e.id) || null,
  }));
  return { month: candidate, selectedBranch, ownBranchId: actor.branchId,
    isGlobal: actor.isGlobal, canManage: actor.canManage, branches, employees,
    attendance, leaves, corrections, operations, cargoSessions, truncated };
}
