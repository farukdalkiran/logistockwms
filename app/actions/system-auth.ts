// app/actions/system-auth.ts
"use server";

import { createClient } from "@supabase/supabase-js";

// RLS kalkanını delen Admin İstemcisi
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. Guard İçin Yetki Çözücü
export async function getRolePermissionsServer(roleCode: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("roles")
      .select("permissions")
      .eq("role_code", roleCode)
      .single();

    if (error || !data) return { success: false, permissions: [] };

    let perms = data.permissions;
    if (typeof perms === "string") {
      perms = perms.replace(/^{|}$/g, "").split(",").map((s: string) => s.trim().replace(/(^"|"$)/g, "")).filter(Boolean);
    }
    return { success: true, permissions: Array.isArray(perms) ? perms : [] };
  } catch (error) {
    return { success: false, permissions: [] };
  }
}

// 2. Terminal İçin Şube ve Raf Çözücü (Zero-Latency)
export async function initTerminalSessionServer(empId: string) {
  try {
    const { data: empData, error: empError } = await supabaseAdmin
      .from("employees")
      .select("branch_id, full_name, is_active")
      .eq("id", empId)
      .single();

    if (empError || !empData || !empData.is_active) {
      return { success: false, error: "Personel bulunamadı veya pasif." };
    }

    const { data: shelvesData, error: shelvesError } = await supabaseAdmin
      .from("shelves")
      .select("id, name, status")
      .eq("branch_id", empData.branch_id);

    return { 
      success: true, 
      branchId: empData.branch_id,
      empName: empData.full_name,
      shelves: shelvesData || [] 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}