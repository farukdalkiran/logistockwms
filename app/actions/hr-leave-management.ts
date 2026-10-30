"use server";

import { revalidatePath } from "next/cache";
import { assertHRBranch } from "@/lib/hr/access";
import { getLeaveActor } from "@/lib/hr/leave-management";

export type LeaveBalanceChange = {
  id: string;
  expected_balance: number | null;
  leave_balance: number;
  employment_date?: string | null;
  full_name?: string;
};

export async function applyLeaveBalanceChanges(input: {
  updates: LeaveBalanceChange[];
  reason: string;
  branchId?: string | null;
}): Promise<{ updated: number; unchanged: number }> {
  const actor = await getLeaveActor();
  const note = String(input.reason || "").trim();
  if (note.length < 5 || note.length > 300) {
    throw new Error("Güncelleme nedeni 5-300 karakter arasında olmalı.");
  }
  if (!Array.isArray(input.updates) || input.updates.length < 1 || input.updates.length > 250) {
    throw new Error("Bir işlemde 1-250 personel güncellenebilir.");
  }
  const scope = actor.isGlobal
    ? (input.branchId && input.branchId !== "ALL" ? assertHRBranch(actor, input.branchId) : null)
    : actor.branchId;

  const ids = new Set<string>();
  for (const item of input.updates) {
    if (!/^[0-9]{5}$/.test(String(item.id))) throw new Error("Geçersiz personel ID.");
    if (ids.has(item.id)) throw new Error("Aynı personel birden fazla kez listelenmiş: " + item.id);
    ids.add(item.id);
    if (!Number.isFinite(item.leave_balance) || item.leave_balance < -14 ||
      item.leave_balance > 999 || Math.round(item.leave_balance * 100) !== item.leave_balance * 100) {
      throw new Error(item.id + " için geçersiz izin bakiyesi.");
    }
    if (item.expected_balance !== null && !Number.isFinite(item.expected_balance)) {
      throw new Error(item.id + " için önceki bakiye geçersiz.");
    }
    if (item.employment_date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(item.employment_date)
        || !Number.isFinite(Date.parse(item.employment_date + "T12:00:00Z")))) {
      throw new Error(item.id + " için işe giriş tarihi geçersiz.");
    }
  }

  const { data: employees, error: readError } = await actor.db
    .from("employees").select("id,branch_id,full_name,is_active").in("id",[...ids]);
  if (readError || !employees) throw new Error(readError?.message || "Personeller doğrulanamadı.");
  if (employees.length !== ids.size) throw new Error("Dosyada veritabanında bulunmayan personel ID'si var.");

  const found = new Map(employees.map(e => [e.id,e]));
  for (const item of input.updates) {
    const person = found.get(item.id)!;
    if (!person.is_active) throw new Error(person.id + " pasif personel, güncellenemez.");
    if (scope && person.branch_id !== scope) throw new Error("Başka şube personeline işlem yapılamaz.");
    if (item.full_name && item.full_name.trim().toLocaleLowerCase("tr-TR") !==
        person.full_name.trim().toLocaleLowerCase("tr-TR")) {
      throw new Error(person.id + " için Excel'deki isim veritabanıyla uyuşmuyor.");
    }
  }

  const updates = input.updates.map(item => ({
    id:item.id, expected_balance:item.expected_balance, leave_balance:item.leave_balance,
    ...(item.employment_date ? { employment_date:item.employment_date } : {}),
  }));
  const { data, error } = await actor.db.rpc("wms_hr_adjust_leave_balances",{
    p_updates:updates,p_actor:actor.userId,p_scope_branch:scope,p_reason:note,
  });
  if (error) throw new Error("İzin bakiyeleri kaydedilemedi: " + error.message);
  revalidatePath("/management/hr/leave-management");
  revalidatePath("/management/hr/insights");
  revalidatePath("/management/hr/personnel");
  return {updated:Number(data?.updated || 0),unchanged:Number(data?.unchanged || 0)};
}
