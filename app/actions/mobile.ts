"use server";

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

const SECRET = process.env.WMS_ATTENDANCE_SECRET || 'logistock_master_key_2026';

// YENİ: Aktif Şubeleri Çek
export async function getActiveBranches() {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) return [];
  return data;
}

// GÜNCELLENDİ: Sadece Seçilen Şubedeki Aktif Personelleri Çek
export async function getActiveEmployeesList(branchId: string) {
  if (!branchId) return [];
  
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, position_title, terminal_code")
    .eq("is_active", true)
    .eq("branch_id", branchId) // Şube kısıtlaması
    .order("full_name", { ascending: true });

  if (error) return [];
  return data || [];
}

export async function registerMobileDevice(empId: string, logistockId: string, deviceToken: string) {
  if (empId !== logistockId) {
    return { success: false, message: "Güvenlik İhlali: Seçilen isim ile girilen ID eşleşmiyor." };
  }

  const { data: employee, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, device_token, is_active, terminal_code")
    .eq("id", empId)
    .single();

  if (error || !employee) return { success: false, message: "Personel bulunamadı." };
  if (!employee.is_active) return { success: false, message: "Hesap pasif durumda." };

  if (employee.device_token) {
    if (employee.device_token !== deviceToken) {
      return { success: false, message: "GÜVENLİK İHLALİ: Bu hesap başka bir cihaza zimmetlenmiş!" };
    }
    return { success: true, terminalCode: employee.terminal_code, fullName: employee.full_name };
  } else {
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ device_token: deviceToken })
      .eq("id", empId);

    if (updateError) return { success: false, message: "Cihaz mühürleme işlemi başarısız oldu." };
    return { success: true, terminalCode: employee.terminal_code, fullName: employee.full_name };
  }
}

// GÜNCELLENDİ: QR Kod Üretilirken Veritabanından "KILL-SWITCH" (Cihaz iptal edildi mi) Kontrolü
export async function getDynamicQrPayload(terminalCode: string, currentDeviceToken: string) {
  // Cihaz hala mühürlü mü kontrol et
  const { data: emp, error } = await supabaseAdmin
    .from("employees")
    .select("device_token")
    .eq("terminal_code", terminalCode)
    .single();

  // Yönetici cihazı silmiş (NULL) veya başka bir cihaza atamışsa!
  if (error || !emp || emp.device_token !== currentDeviceToken) {
    return { success: false, reason: "REVOKED" };
  }

  const timestamp = Date.now();
  const dataToSign = `${terminalCode}:${timestamp}`;
  const signature = createHmac('sha256', SECRET).update(dataToSign).digest('hex').substring(0, 10);
  
  return { success: true, payload: `WMS-${terminalCode}-${timestamp}-${signature}` };
}

export async function getMonthlyAttendanceStats(empId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)).toISOString();
  
  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("working_hours, check_in_time, status")
    .eq("employee_id", empId)
    .gte("check_in_time", monthStart);

  if (error) return { totalHours: 0, lateCount: 0 };

  let totalHours = 0;
  let lateCount = 0;

  if (data) {
    data.forEach(row => {
      if (row.working_hours) {
        totalHours += Number(row.working_hours);
      }
      
      if (row.check_in_time && (!row.status || !row.status.startsWith('LEAVE_'))) {
        const d = new Date(row.check_in_time);
        const localHours = d.getUTCHours() + 3;
        const realHours = localHours >= 24 ? localHours - 24 : localHours; 
        const mins = realHours * 60 + d.getUTCMinutes();
        if (mins > 495) lateCount++; 
      }
    });
  }

  return { totalHours: Math.floor(totalHours), lateCount };
}

export async function getEmployeeAttendanceHistory(empId: string) {
  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("id, check_in_time, check_out_time, status, working_hours")
    .eq("employee_id", empId)
    .order("check_in_time", { ascending: false })
    .limit(10);

  if (error) return [];
  return data || [];
}

export async function getMissingAttendanceDays(empId: string) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayDate = now.getDate(); 
  
  const monthStart = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0)).toISOString();

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("check_in_time")
    .eq("employee_id", empId)
    .gte("check_in_time", monthStart);

  if (error) return [];

  const recordedDates = new Set(data?.map(d => {
    const date = new Date(d.check_in_time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }) || []);

  const missingDates: string[] = [];

  for (let i = 1; i < todayDate; i++) {
    const checkDate = new Date(currentYear, currentMonth, i);
    const dayOfWeek = checkDate.getDay(); 
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
       const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
       if (!recordedDates.has(dateStr)) {
         missingDates.push(dateStr);
       }
    }
  }

  return missingDates;
}