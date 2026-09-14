"use server";

import { createClient } from "@supabase/supabase-js";

// RLS kısıtlamalarını by-pass eden Master Admin İstemcisi
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DirectAttendancePayload {
  record_id?: string | null; 
  employee_id: string;
  target_date: string; 
  check_in: string; 
  check_out?: string | null; // Opsiyonel yapıldı
  break_minutes: number;
  manager_id: string;
  note: string;
  is_developer_override?: boolean; 
}

export async function upsertDirectAttendance(data: DirectAttendancePayload) {
  try {
    // 1. GİRİŞ SAATİNİ HESAPLA (Zorunlu)
    const checkInDate = new Date(`${data.target_date}T${data.check_in}:00+03:00`);
    const checkInISO = checkInDate.toISOString();

    // 2. ÇIKIŞ SAATİNİ HESAPLA (Geçersiz Zaman Hatasını Önleyen Lojik)
    let checkOutISO: string | null = null;
    let workingHours = 0;
    const breakHours = Number((data.break_minutes / 60).toFixed(2));

    if (data.check_out && data.check_out.trim() !== "") {
      const checkOutDate = new Date(`${data.target_date}T${data.check_out}:00+03:00`);
      
      // Çıkış saati girişten önceyse gece vardiyası/ertesi gün kabul et
      if (checkOutDate < checkInDate) {
        checkOutDate.setDate(checkOutDate.getDate() + 1);
      }
      
      checkOutISO = checkOutDate.toISOString();

      // Sadece çıkış varsa çalışma saatini hesapla
      const totalDiffMs = checkOutDate.getTime() - checkInDate.getTime();
      const totalDiffHours = totalDiffMs / (1000 * 60 * 60);
      workingHours = Number((totalDiffHours - breakHours).toFixed(2));
    }

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

    // Dinamik Payload (Çıkış boşsa null basar, hata vermez)
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
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("attendance")
        .update(payload)
        .eq("id", existingRecordId)
        .select("id")
        .single();
      
      if (updateError) throw updateError;
      resultId = updated.id;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("attendance")
        .insert([{ ...payload, created_at: new Date().toISOString() }])
        .select("id")
        .single();
      
      if (insertError) throw insertError;
      resultId = inserted.id;
    }

    if (!data.is_developer_override) {
      await supabaseAdmin.from("transaction_logs").insert([{
        employee_id: data.manager_id,
        action_type: "ATTENDANCE_RECORD",
        description: existingRecordId 
          ? `Mesai kaydı GÜNCELLENDİ. Personel: ${data.employee_id}, Tarih: ${data.target_date}, Saat: ${data.check_in}-${data.check_out || 'Çıkış Yok'}. Not: ${data.note}`
          : `Mesai kaydı EKLENDİ. Personel: ${data.employee_id}, Tarih: ${data.target_date}, Saat: ${data.check_in}-${data.check_out || 'Çıkış Yok'}. Not: ${data.note}`,
        related_entity_id: resultId
      }]);
    }

    return { success: true, message: "MESAİ KAYDI SİSTEME BAŞARIYLA İŞLENDİ." };
  } catch (error: any) {
    console.error("[DIRECT_ATTENDANCE_ERROR]", error);
    return { success: false, message: error.message || "Mesai işlenirken kritik bir hata oluştu." };
  }
}

export async function getAttendanceHistory(month: number, year: number, employeeId: string | null = null) {
  try {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 1).toISOString();

    let query = supabaseAdmin
      .from("attendance")
      .select("id, employee_id, check_in_time, check_out_time, status, break_hours") 
      .gte("check_in_time", startDate)
      .lt("check_in_time", endDate)
      .order("check_in_time", { ascending: false });

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("[SUPABASE_SELECT_ERROR]:", error);
      throw new Error(error.message || "Veritabanı sorgusu reddedildi.");
    }

    const formattedData = data.map((record) => {
      const derivedTargetDate = record.check_in_time ? record.check_in_time.substring(0, 10) : "-";
      
      return {
        id: record.id,
        employee_id: record.employee_id,
        target_date: derivedTargetDate,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time,
        break_minutes: record.break_hours ? Math.round(record.break_hours * 60) : 60,
        status: record.status || "BİLİNMİYOR"
      };
    });

    return { success: true, data: formattedData };
  } catch (error: any) {
    console.error("[GET_ATTENDANCE_HISTORY_CRASH]", error);
    return { 
      success: false, 
      message: `Sorgu Hatası: ${error.message || "Beklenmeyen bir veritabanı hatası oluştu."}` 
    };
  }
}

export async function deleteAttendance(recordId: string, managerId: string, isDeveloperOverride: boolean = false) {
  try {
    const { error: deleteError } = await supabaseAdmin
      .from("attendance")
      .delete()
      .eq("id", recordId);

    if (deleteError) throw deleteError;

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