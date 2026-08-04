"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getEmployeeBranchServer(empId: string) {
  try {
    const { data, error } = await supabaseAdmin.from("employees").select("branch_id").eq("id", empId).single();
    if (error) throw error;
    return { success: true, branchId: data.branch_id };
  } catch (err: any) {
    return { success: false, error: "Şube bilgisi alınamadı." };
  }
}

// KRİTİK FİX: created_at sütunu yerine started_at kullanıldı
export async function getActiveCargoSessions(branchId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("cargo_sessions")
      .select("id, carrier_name, started_at")
      .eq("branch_id", branchId)
      .eq("status", "ACTIVE")
      .order("started_at", { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("Session Fetch Error:", err);
    return { success: false, error: "Açık oturumlar yüklenemedi." };
  }
}

// KRİTİK FİX: Zaman damgası bağımlılığı kaldırılarak hata riski 0'a indirildi
export async function getSessionLogsServer(sessionId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("cargo_logs")
      .select("tracking_number")
      .eq("session_id", sessionId);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: "Geçmiş okutmalar getirilemedi." };
  }
}

export async function createCargoSessionServer(empId: string, branchId: string, carrierName: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("cargo_sessions")
      .insert([{ employee_id: empId, branch_id: branchId, carrier_name: carrierName, status: "ACTIVE" }])
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, error: "Oturum oluşturulamadı." };
  }
}

export async function logCargoBarcodeServer(sessionId: string, trackingNumber: string) {
  try {
    const { error } = await supabaseAdmin
      .from("cargo_logs")
      .insert([{ session_id: sessionId, tracking_number: trackingNumber }]);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: "Kayıt hatası." };
  }
}

export async function completeCargoSessionServer(sessionId: string, totalItems: number) {
  try {
    const { error } = await supabaseAdmin
      .from("cargo_sessions")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString(), total_items: totalItems })
      .eq("id", sessionId);

    if (error) throw error;
    revalidatePath("/terminal");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: "Oturum mühürlenemedi." };
  }
}