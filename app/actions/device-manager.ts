"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. Şubedeki Cihazlı/Cihazsız Çalışanları Çek (Hata Düzeltildi)
export async function getBranchDevices(branchId: string) {
  try {
    // DİKKAT: Veritabanında olmayan 'last_device_sync' sütunu sorgudan çıkarıldı, çökme engellendi.
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, position_title, device_token")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (error) throw error;
    
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("[GET_DEVICES_ERROR]", error);
    return { success: false, message: "Çalışan listesi çekilemedi." };
  }
}

// 2. Developer/Admin İçin Tüm Şubeleri Çek
export async function getAllBranches() {
  try {
    const { data, error } = await supabaseAdmin
      .from("branches")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("[GET_BRANCHES_ERROR]", error);
    return { success: false, message: "Şubeler çekilemedi." };
  }
}

// 3. Cihaz Kilidini Kır (Revoke Token)
export async function revokeDeviceToken(employeeId: string, managerId: string) {
  try {
    // Sadece device_token'i null yap
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ device_token: null })
      .eq("id", employeeId);

    if (updateError) throw updateError;

    // İşlemi Logla
    await supabaseAdmin.from("transaction_logs").insert([{
      employee_id: managerId,
      action_type: "DEVICE_REVOKE",
      description: `Personel ID (${employeeId}) cihaz erişim kilidi yönetici tarafından sıfırlandı.`,
      related_entity_id: employeeId
    }]);

    return { success: true, message: "Cihaz bağlantısı başarıyla kesildi." };
  } catch (error: any) {
    console.error("[REVOKE_DEVICE_ERROR]", error);
    return { success: false, message: "Cihaz sıfırlanırken bir hata oluştu." };
  }
}