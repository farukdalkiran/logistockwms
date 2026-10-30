import "server-only";

import { getHRActor, assertHRBranch } from "@/lib/hr/access";

export type LeaveEmployee = {
  id: string;
  full_name: string;
  position_title: string | null;
  branch_id: string;
  branch_name: string;
  is_active: boolean;
  employment_date: string | null;
  leave_balance: number | null;
  legacy_remaining: number | null;
  legacy_entitlement: number | null;
  account: { id: string; email: string | null; role: string } | null;
};

export type LeaveRequestRow = {
  id: string; employee_id: string; leave_type: string; custom_leave_type: string | null;
  start_date: string; end_date: string; status: string; requested_days: number;
  is_half_day: boolean; half_day_period: string | null;
  reason: string | null; manager_note: string | null;
};

export type LeaveAudit = {
  id: string; employee_id: string; description: string | null;
  old_value: string | null; new_value: string | null; created_at: string;
};

export type LeaveDashboardData = {
  year: number; isGlobal: boolean; branchId: string | null;
  ownBranchId: string | null;
  branches: { id: string; name: string }[];
  employees: LeaveEmployee[];
  leaves: LeaveRequestRow[];
  audits: LeaveAudit[];
};

export async function getLeaveActor() {
  const actor = await getHRActor();
  if (!actor.isGlobal && actor.role !== "HR") {
    const { data: roleRow, error } = await actor.db.from("roles")
      .select("permissions").eq("role_code", actor.role).maybeSingle();
    if (error) throw new Error("İK izin yetkileri doğrulanamadı.");
    const raw: unknown = roleRow?.permissions;
    const permissions = Array.isArray(raw)
      ? raw.map(String)
      : typeof raw === "string"
        ? raw.replace(/[{}"]/g, "").split(",").map(s => s.trim())
        : [];
    if (!permissions.includes("hr_leave_management")) {
      throw new Error("İzin yönetimi modülüne erişim yetkiniz bulunmuyor.");
    }
  }
  return actor;
}

export async function getLeaveDashboard(yearInput?: number, branchInput?: string): Promise<LeaveDashboardData> {
  const actor = await getLeaveActor();
  const year = typeof yearInput === "number" && Number.isInteger(yearInput) && yearInput >= 2024 && yearInput <= 2100
    ? yearInput : Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Istanbul", year: "numeric",
    }).format(new Date()));
  const branchId = actor.isGlobal
    ? (branchInput && branchInput !== "ALL" ? assertHRBranch(actor, branchInput) : null)
    : actor.branchId;
  const branchQ = actor.db.from("branches").select("id,name").order("name");
  const employeeQ = actor.db.from("employees")
    .select("id,full_name,position_title,branch_id,is_active,employment_date,leave_balance,toplam_izin_hakki,kalan_izin")
    .order("full_name").limit(500);
  if (!actor.isGlobal) branchQ.eq("id",actor.branchId!);
  if (branchId) employeeQ.eq("branch_id",branchId);

  const [br, emps] = await Promise.all([branchQ, employeeQ]);
  if (br.error || emps.error) throw new Error(br.error?.message || emps.error?.message || "İK verileri alınamadı.");
  const branches: { id: string; name: string }[] = br.data || [];
  const employeesRaw = emps.data || [];
  const employeeIds = employeesRaw.map(e => e.id);
  if (employeeIds.length === 0) {
    return { year, isGlobal:actor.isGlobal, branchId, ownBranchId:actor.branchId,
      branches, employees:[], leaves:[], audits:[] };
  }
  if (employeeIds.length === 500) throw new Error("Personel limiti aşıldı, lütfen şube seçerek raporu daraltın.");

  let leaveQ = actor.db.from("leave_requests")
    .select("id,employee_id,leave_type,custom_leave_type,start_date,end_date,status,requested_days,is_half_day,half_day_period,reason,manager_note")
    .in("employee_id",employeeIds)
    .gte("start_date",year + "-01-01").lte("start_date",year + "-12-31")
    .order("start_date",{ascending:false}).limit(999);
  let auditQ = actor.db.from("transaction_logs")
    .select("id,employee_id,description,old_value,new_value,created_at")
    .in("employee_id",employeeIds)
    .eq("action_type","HR_LEAVE_BALANCE_EDIT")
    .order("created_at",{ascending:false}).limit(250);
  let accountQ = actor.db.from("profiles")
    .select("id,employee_id,email,role,branch_id").in("employee_id",employeeIds).limit(500);
  if (branchId) {
    leaveQ = leaveQ.eq("branch_id",branchId);
    auditQ = auditQ.eq("branch_id",branchId);
    accountQ = accountQ.eq("branch_id",branchId);
  }
  const [leaveResult, auditResult, profileResult] = await Promise.all([leaveQ,auditQ,accountQ]);
  if (leaveResult.error || auditResult.error || profileResult.error) {
    throw new Error(leaveResult.error?.message || auditResult.error?.message || profileResult.error?.message);
  }
  if ((leaveResult.data || []).length >= 999) {
    throw new Error("İzin hareketi limiti aşıldı, lütfen şube filtresi uygulayın.");
  }
  const accountMap = new Map((profileResult.data || [])
    .filter(p => p.employee_id)
    .map(p => [p.employee_id!, {id:p.id,email:p.email,role:p.role}]));
  const branchMap = new Map(branches.map(b=>[b.id,b.name]));
  const employees: LeaveEmployee[] = employeesRaw.map(e=>({
    id:e.id,full_name:e.full_name,position_title:e.position_title,
    branch_id:e.branch_id,branch_name:branchMap.get(e.branch_id)||"Tanımsız şube",
    is_active:Boolean(e.is_active),employment_date:e.employment_date,
    leave_balance:e.leave_balance===null?null:Number(e.leave_balance),
    legacy_remaining:e.kalan_izin===null?null:Number(e.kalan_izin),
    legacy_entitlement:e.toplam_izin_hakki===null?null:Number(e.toplam_izin_hakki),
    account: accountMap.get(e.id)||null,
  }));
  const leaves: LeaveRequestRow[] = (leaveResult.data||[]).map(r=>({
    ...r, requested_days:Number(r.requested_days || 0),
  }));
  return {year,isGlobal:actor.isGlobal,branchId,ownBranchId:actor.branchId,branches,
    employees,leaves,audits:(auditResult.data||[]) as LeaveAudit[]};
}
