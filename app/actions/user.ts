"use server";

import { createClient } from "@supabase/supabase-js";

// Admin yetkisiyle Supabase Client oluşturuyoruz (RLS Kalkanını Deler)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, 
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

// 1. TÜM VERİLERİ ÇEK (RLS BYPASS)
export async function fetchAdminAccounts() {
  try {
    // Tüm şubeleri al (Düzenleme modalında şube değiştirmek için gerekecek)
    const { data: branches } = await supabaseAdmin.from("branches").select("id, name").order("name");

    const [profilesRes, employeesRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(`id, full_name, email, role, temp_password, last_password_change, branch_id, branches(name)`)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("employees")
        .select(`id, full_name, position_title, is_active, branch_id, branches(name)`)
        .order("id", { ascending: true })
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (employeesRes.error) throw employeesRes.error;

    return { 
      success: true, 
      webAccounts: profilesRes.data || [], 
      terminalAccounts: employeesRes.data || [],
      branches: branches || []
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 2. ŞİFRE SIFIRLAMA (AUTH + PROFILES GÜNCELLEMESİ)
export async function adminResetPassword(userId: string) {
  try {
    const newTempPassword = `Lgs${Math.floor(1000 + Math.random() * 9000)}!`;

    // Auth tablosunda şifreyi gerçekten değiştir (Giriş yapabilmesi için)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newTempPassword
    });
    if (authError) throw new Error("Auth Şifre Hatası: " + authError.message);

    // Profiles tablosunda temp_password'ü göster ve zorunlu değişimi aktif et
    const { error: profileError } = await supabaseAdmin.from("profiles").update({
      temp_password: newTempPassword,
      last_password_change: null // Sistemi tekrar şifre değişimine zorla
    }).eq("id", userId);
    if (profileError) throw new Error("Profil Şifre Hatası: " + profileError.message);

    return { success: true, newPassword: newTempPassword };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 3. HESAP GÜNCELLEME (ŞUBE DÂHİL)
export async function updateSystemUser(data: { id: string; fullName: string; email: string; role: string; branchId: string | null }) {
  try {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: data.email,
      user_metadata: { full_name: data.fullName }
    });
    if (authError) throw new Error("Auth Güncelleme Hatası: " + authError.message);

    const { error: profileError } = await supabaseAdmin.from("profiles").update({
      full_name: data.fullName,
      email: data.email,
      role: data.role,
      branch_id: data.branchId
    }).eq("id", data.id);

    if (profileError) throw new Error("Profil Güncelleme Hatası: " + profileError.message);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 4. SİSTEMDEN TAMAMEN SİLME (ÖNCE PROFILES -> SONRA AUTH)
export async function deleteSystemUser(userId: string) {
  try {
    // 1. Önce Profiles tablosundan manuel siliyoruz (Veritabanında Cascade kuralı yoksa diye garantiye alıyoruz)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);
      
    if (profileError) throw new Error("Profil Kaydı Silinirken Hata: " + profileError.message);

    // 2. Ardından Supabase Auth sisteminden kalıcı olarak siliyoruz
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authError) throw new Error("Kimlik Doğrulama (Auth) Silme Hatası: " + authError.message);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createSystemUser(data: { fullName: string; email: string; branchId: string; roleCode: string; tempPassword: string; }) {
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.tempPassword, email_confirm: true, user_metadata: { full_name: data.fullName },
    });
    if (authError) throw new Error("Auth Hatası: " + authError.message);
    
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: authData.user.id, full_name: data.fullName, email: data.email, temp_password: data.tempPassword, role: data.roleCode, branch_id: data.branchId || null, last_password_change: null
    }, { onConflict: 'id' });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error("Profil Kayıt Hatası: " + profileError.message);
    }
    return { success: true };
  } catch (error: any) { return { success: false, error: error.message }; }
}