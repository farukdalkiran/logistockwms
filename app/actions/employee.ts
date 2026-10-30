"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertHRBranch, getHRActor } from "@/lib/hr/access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPLOYEE_ID = /^[0-9]{5}$/;

function requiredText(value: string, label: string, max = 120) {
  const clean = String(value || "").trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > max) throw new Error(`${label} 2-${max} karakter olmalı.`);
  return clean;
}

function invalidate() {
  revalidatePath("/management/hr/personnel");
  revalidatePath("/management/hr/insights");
  revalidatePath("/management/hr/reports");
  revalidatePath("/management/password-settings");
}

// Legacy parametreleri koruyoruz ancak yetkiyi ASLA istemcinin gönderdiği isGlobal/branchId'den almıyoruz.
export async function getBranches(_branchId: string | null, _isGlobal: boolean) {
  const actor = await getHRActor(true);
  let query = actor.db.from("branches").select("id, name, type").order("name");
  if (!actor.isGlobal) query = query.eq("id", actor.branchId!);
  const { data, error } = await query;
  if (error) throw new Error("Şube listesi alınamadı: " + error.message);
  return data || [];
}

export async function getEmployees(_branchId: string | null, _isGlobal: boolean) {
  const actor = await getHRActor(true);
  // Kimlik doğrulama ve parola kolonları istemciye asla gönderilmez.
  let query = actor.db.from("employees")
    .select("id, full_name, position_title, branch_id, is_active, created_at, employment_date, birthday, leave_balance, toplam_izin_hakki, kalan_izin, branches(name)")
    .order("created_at", { ascending: false });
  if (!actor.isGlobal) query = query.eq("branch_id", actor.branchId!);
  const { data, error } = await query;
  if (error) throw new Error("Personel listesi alınamadı: " + error.message);
  return data || [];
}

export async function createEmployee(formData: {
  id?: string;
  full_name: string;
  position_title: string;
  branch_id: string;
}) {
  const actor = await getHRActor(true);
  const branch = assertHRBranch(actor, formData.branch_id);
  if (!UUID.test(branch)) throw new Error("Şube kimliği geçersiz.");
  const name = requiredText(formData.full_name, "Ad soyad");
  const position = requiredText(formData.position_title, "Ünvan", 80);
  const requested = formData.id?.trim();
  if (requested && !actor.isDeveloper) throw new Error("Özel terminal ID yalnızca Developer tarafından atanabilir.");
  if (requested && !EMPLOYEE_ID.test(requested)) throw new Error("Terminal ID 5 haneli olmalı.");

  for (let attempt = 0; attempt < (requested ? 1 : 25); attempt++) {
    const id = requested || String(randomInt(10000, 100000));
    const { data, error } = await actor.db.from("employees")
      .insert({ id, full_name: name, position_title: position, branch_id: branch, is_active: true })
      .select("id, full_name, position_title, branch_id, is_active, branches(name)")
      .single();
    if (!error && data) {
      invalidate();
      return data;
    }
    if (error?.code === "23505") {
      if (requested) throw new Error("Bu terminal ID zaten kullanılıyor.");
      continue;
    }
    throw new Error("Personel oluşturulamadı: " + (error?.message || "Bilinmeyen hata"));
  }
  throw new Error("Benzersiz terminal ID üretilemedi, tekrar deneyin.");
}

export type HREmployeeUpdate = {
  id: string;
  full_name: string;
  position_title: string;
  branch_id: string;
  employment_date: string | null;
  birthday: string | null;
  is_active: boolean;
};

function validDate(value: string | null, label: string) {
  if (value === null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + "T12:00:00Z"))) {
    throw new Error(label + " tarihi geçersiz.");
  }
  return value;
}

export async function updateEmployeeHR(input: HREmployeeUpdate) {
  const actor = await getHRActor(true);
  if (!EMPLOYEE_ID.test(input.id)) throw new Error("Geçersiz personel ID.");
  const { data: previous, error: readError } = await actor.db.from("employees")
    .select("id, branch_id, is_active").eq("id", input.id).maybeSingle();
  if (readError || !previous) throw new Error("Personel kaydı bulunamadı.");
  assertHRBranch(actor, previous.branch_id);
  const target = assertHRBranch(actor, input.branch_id);
  if (!actor.isGlobal && target !== previous.branch_id) throw new Error("Şube değişikliğini yalnızca merkez yöneticileri yapabilir.");
  if (!UUID.test(target)) throw new Error("Geçersiz şube.");
  const { data: linked, error: linkError } = await actor.db.from("profiles")
    .select("id, branch_id").eq("employee_id", input.id).limit(1);
  if (linkError) throw new Error("Bağlı hesap kontrol edilemedi.");
  if (linked?.length && (!input.is_active || target !== previous.branch_id)) {
    throw new Error("Bağlı web hesabı bulunan personelin şubesi/aktifliği önce Hesap Yönetimi'nden güncellenmeli.");
  }

  const { data, error } = await actor.db.from("employees")
    .update({
      full_name: requiredText(input.full_name, "Ad soyad"),
      position_title: requiredText(input.position_title, "Ünvan", 80),
      branch_id: target,
      employment_date: validDate(input.employment_date, "İşe giriş"),
      birthday: validDate(input.birthday, "Doğum"),
      is_active: Boolean(input.is_active),
    })
    .eq("id", input.id)
    .eq("branch_id", previous.branch_id)
    .select("id, full_name, position_title, branch_id, employment_date, birthday, is_active")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Personel güncellenemedi, kaydı tekrar açın.");
  invalidate();
  return data;
}

// Geçmiş puantaj/izin bağlantıları korunur; fiziksel silme yerine pasife alma.
export async function deleteEmployee(id: string) {
  const actor = await getHRActor(true);
  if (!EMPLOYEE_ID.test(id)) throw new Error("Geçersiz personel ID.");
  const { data: employee } = await actor.db.from("employees")
    .select("id, branch_id").eq("id", id).maybeSingle();
  if (!employee) throw new Error("Personel bulunamadı.");
  assertHRBranch(actor, employee.branch_id);
  const { data: linked, error: linkError } = await actor.db.from("profiles")
    .select("id").eq("employee_id", id).limit(1);
  if (linkError) throw new Error("Bağlı hesap kontrolü yapılamadı.");
  if (linked?.length) throw new Error("Bu personele bağlı web hesabı var. Önce Hesap Yönetimi'nden ilişkiyi düzenleyin.");
  const { error } = await actor.db.from("employees")
    .update({ is_active: false }).eq("id", id).eq("branch_id", employee.branch_id);
  if (error) throw new Error("Personel pasife alınamadı: " + error.message);
  invalidate();
}
