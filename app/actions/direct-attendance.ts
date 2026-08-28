"use server";

import { createClient } from "@supabase/supabase-js";

// RLS kısıtlamalarını by-pass eden Master Admin İstemcisi
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DirectAttendancePayload {
  employee_id: string;
  target_date: string; 
  check_in: string; 
  check_out: string; 
  break_minutes: number;
  manager_id: string;
  note: string;
}

export async function upsertDirectAttendance(data: DirectAttendancePayload) {
  try {
    const checkInDate = new Date(`${data.target_date}T${data.check_in}:00+03:00`);
    let checkOutDate = new Date(`${data.target_date}T${data.check_out}:00+03:00`);

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

    const { data: existingRecord, error: fetchError } = await supabaseAdmin
      .from("attendance")
      .select("id")
      .eq("employee_id", data.employee_id)
      .gte("check_in_time", `${data.target_date}T00:00:00Z`)
      .lte("check_in_time", `${data.target_date}T23:59:59Z`)
      .maybeSingle();

    if (fetchError) throw new Error("Mevcut log sorgulanırken hata oluştu.");

    // DÜZELTME YERİNE DOĞRUDAN STANDART MESAİ (ON_TIME) İŞLİYORUZ
    const payload = {
      employee_id: data.employee_id,
      branch_id: emp.branch_id,
      check_in_time: checkInISO,
      check_out_time: checkOutISO,
      rounded_check_in: checkInISO, 
      rounded_check_out: checkOutISO,
      break_hours: breakHours,
      working_hours: workingHours > 0 ? workingHours : 0, 
      status: "ON_TIME", // Normal mesai statüsü
      manager_id: data.manager_id
    };

    let resultId = null;

    if (existingRecord) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("attendance")
        .update(payload)
        .eq("id", existingRecord.id)
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

    // Logu da düzeltme olarak değil, doğrudan mesai eklendi olarak basıyoruz.
    await supabaseAdmin.from("transaction_logs").insert([{
      employee_id: data.manager_id,
      action_type: "ATTENDANCE_RECORD",
      description: `Mesai kaydı eklendi. Personel: ${data.employee_id}, Tarih: ${data.target_date}, Saat: ${data.check_in}-${data.check_out}. Not: ${data.note}`,
      related_entity_id: resultId
    }]);

    return { success: true, message: "MESAİ KAYDI SİSTEME BAŞARIYLA İŞLENDİ." };
  } catch (error: any) {
    console.error("[DIRECT_ATTENDANCE_ERROR]", error);
    return { success: false, message: error.message || "Mesai işlenirken kritik bir hata oluştu." };
  }
}