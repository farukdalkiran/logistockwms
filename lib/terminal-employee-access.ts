import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Terminal işlemi başlatmadan hemen önce personeli sunucuda doğrula.
 * URL, localStorage ve tarayıcı tarafından gönderilen kimlik bilgilerine güvenme.
 */
export async function assertActiveTerminalEmployee(
  admin: SupabaseClient,
  employeeId: string,
  expectedBranchId?: string | null,
) {
  if (!/^\d{5}$/.test(employeeId)) {
    throw new Error("Geçersiz personel kimliği.");
  }

  const { data, error } = await admin
    .from("employees")
    .select("id, full_name, branch_id, is_active")
    .eq("id", employeeId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Personel kaydı bulunamadı.");
  }
  if (data.is_active !== true) {
    throw new Error("Personel hesabı pasif. Bu kimlikle işlem yapılamaz.");
  }
  if (expectedBranchId && data.branch_id !== expectedBranchId) {
    throw new Error("Personelin işlem yaptığı şube eşleşmiyor.");
  }
  return data;
}
