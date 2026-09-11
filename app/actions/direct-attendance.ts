"use server";

import { createClient } from "@supabase/supabase-js";

// RLS kısıtlamalarını by-pass eden Master Admin İstemcisi
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DirectAttendancePayload {
  record_id?: string | null; // Edit mode için
  employee_id: string;
  target_date: string; 
  check_in: string; 
  check_out: string; 
  break_minutes: number;
  manager_id: string;
  note: string;
  is_developer_override?: boolean; // Ghost Mode: Log tutmayı atlar
}

export async function upsertDirectAttendance(data: DirectAttendancePayload) {
  try {
    const checkInDate = new Date(`${data.target_date}T${data.check_in}:00+03:00`);
    let checkOutDate = new Date(`${data.target_date}T${data.check_out}:00+03:00`);

    // Çıkış saati girişten önceyse gece vardiyası/ertesi gün kabul et
    if (checkOutDate < checkInDate) {
      checkOutDate.setDate(checkOutDate.getDate() + 1);
    }

    const checkInISO = checkInDate.toISOString();
    const checkOutISO = checkOutDate.toISOString();

    const breakHours = Number((data.break_minutes / 60).toFixed(2));
    const totalDiffMs = checkOutDate.getTime() - checkInDate.getTime();
    const totalDiffHours = totalDiffMs / (1000 * 60 * 60);
    const workingHours = Number((totalDiffHours - breakHours).toFixed(2));

    const { data: emp, error: empError } = await supabaseAdmin
      .from("employees")
      .select("branch_id")
      .eq("id", data.employee_id)
      .single();

    if (empError || !emp) throw new Error("Personelin şube bilgisine ulaşılamadı.");

    // Eğer editleniyorsa ID'den, yeni kayıtsa tarihten eşleşme ara
    let existingRecordId = data.record_id;

    if (!existingRecordId) {
      const { data: existingRecord, error: fetchError } = await supabaseAdmin
        .from("attendance")
        .select("id")
        .eq("employee_id", data.employee_id)
        .gte("check_in_time", `${data.target_date}T00:00:00Z`)
        .lte("check_in_time", `${data.target_date}T23:59:59Z`)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error("Mevcut log sorgulanırken hata oluştu.");
      }
      if (existingRecord) existingRecordId = existingRecord.id;
    }

    const payload = {
      employee_id: data.employee_id,
      branch_id: emp.branch_id,
      check_in_time: checkInISO,
      check_out_time: checkOutISO,
      rounded_check_in: checkInISO, 
      rounded_check_out: checkOutISO,
      break_hours: breakHours,
      working_hours: workingHours > 0 ? workingHours : 0, 
      status: "ON_TIME", 
      manager_id: data.manager_id
    };

    let resultId = null;

    if (existingRecordId) {
      // Güncelle (Edit Mode)
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("attendance")
        .update(payload)
        .eq("id", existingRecordId)
        .select("id")
        .single();
      
      if (updateError) throw updateError;
      resultId = updated.id;
    } else {
      // Yeni Kayıt (Insert)
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("attendance")
        .insert([{ ...payload, created_at: new Date().toISOString() }])
        .select("id")
        .single();
      
      if (insertError) throw insertError;
      resultId = inserted.id;
    }

    // 🛡️ GHOST MODE KONTROLÜ: DEVELOPER OVERRIDE AKTİF DEĞİLSE LOG YAZ!
    if (!data.is_developer_override) {
      await supabaseAdmin.from("transaction_logs").insert([{
        employee_id: data.manager_id,
        action_type: "ATTENDANCE_RECORD",
        description: existingRecordId 
          ? `Mesai kaydı GÜNCELLENDİ. Personel: ${data.employee_id}, Tarih: ${data.target_date}, Saat: ${data.check_in}-${data.check_out}. Not: ${data.note}`
          : `Mesai kaydı EKLENDİ. Personel: ${data.employee_id}, Tarih: ${data.target_date}, Saat: ${data.check_in}-${data.check_out}. Not: ${data.note}`,
        related_entity_id: resultId
      }]);
    }

    return { success: true, message: "MESAİ KAYDI SİSTEME BAŞARIYLA İŞLENDİ." };
  } catch (error: any) {
    console.error("[DIRECT_ATTENDANCE_ERROR]", error);
    return { success: false, message: error.message || "Mesai işlenirken kritik bir hata oluştu." };
  }
}

// ==========================================
// YENİ: MESAİ GEÇMİŞİNİ SORGULA (HATA KORUMALI)
// ==========================================
export async function getAttendanceHistory(month: number, year: number, employeeId: string | null = null) {
  try {
    // 1. Ayın başlangıç ve bitiş tarihlerini UTC standartında hesapla
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 1).toISOString();

    // DİKKAT: 'target_date' fiziksel bir kolon olmadığı için select sorgusundan çıkarıldı!
    // Sadece DB'de varlığı kesin olan kolonları çekiyoruz. (Eğer break_hours yoksa onu da kaldırmalısın)
    let query = supabaseAdmin
      .from("attendance")
      .select("id, employee_id, check_in_time, check_out_time, status, break_hours") 
      .gte("check_in_time", startDate)
      .lt("check_in_time", endDate)
      .order("check_in_time", { ascending: false });

    // Eğer spesifik bir personel seçildiyse sorguyu daralt
    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    const { data, error } = await query;
    
    // Supabase'den gelen orijinal hatayı konsola bas ve fırlat
    if (error) {
      console.error("[SUPABASE_SELECT_ERROR]:", error);
      throw new Error(error.message || "Veritabanı sorgusu reddedildi.");
    }

    // 2. Frontend tarafında kullanabilmek için veriyi formatla
    const formattedData = data.map((record) => {
      // target_date'i doğrudan check_in_time timestamp'i üzerinden türetiyoruz (YYYY-MM-DD)
      const derivedTargetDate = record.check_in_time ? record.check_in_time.substring(0, 10) : "-";
      
      return {
        id: record.id,
        employee_id: record.employee_id,
        target_date: derivedTargetDate,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time,
        // break_hours kolonu varsa dakikaya çevir, yoksa 60 dk varsayılan kabul et
        break_minutes: record.break_hours ? Math.round(record.break_hours * 60) : 60,
        status: record.status || "BİLİNMİYOR"
      };
    });

    return { success: true, data: formattedData };
  } catch (error: any) {
    console.error("[GET_ATTENDANCE_HISTORY_CRASH]", error);
    // Hatanın tam nedenini UI'a gönderiyoruz ki ekranda görebilesin
    return { 
      success: false, 
      message: `Sorgu Hatası: ${error.message || "Beklenmeyen bir veritabanı hatası oluştu."}` 
    };
  }
}

// ==========================================
// YENİ: MESAİ KAYDINI SİL (GHOST MODE DESTEKLİ)
// ==========================================
export async function deleteAttendance(recordId: string, managerId: string, isDeveloperOverride: boolean = false) {
  try {
    // Önce kaydı sil
    const { error: deleteError } = await supabaseAdmin
      .from("attendance")
      .delete()
      .eq("id", recordId);

    if (deleteError) throw deleteError;

    // 🛡️ GHOST MODE KONTROLÜ
    if (!isDeveloperOverride) {
      await supabaseAdmin.from("transaction_logs").insert([{
        employee_id: managerId,
        action_type: "DELETE_ATTENDANCE",
        description: `Mesai kaydı (ID: ${recordId}) SİLİNDİ.`,
        related_entity_id: recordId
      }]);
    }

    return { success: true, message: "Kayıt başarıyla silindi." };
  } catch (error: any) {
    console.error("[DELETE_ATTENDANCE_ERROR]", error);
    return { success: false, message: "Kayıt silinirken bir hata oluştu." };
  }
}