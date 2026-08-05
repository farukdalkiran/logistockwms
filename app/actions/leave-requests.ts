"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// ============================================================================
// 1. GÜVENLİK VE VERİTABANI İSTEMCİSİ (SERVICE ROLE BYPASS)
// Sessiz RLS yutmalarını ve Next.js Server Action oturum çakışmalarını önler
// ============================================================================
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// ============================================================================
// 2. YENİ İZİN TALEBİ OLUŞTURMA MOTORU
// ============================================================================
export async function submitLeaveRequest(data: {
  employee_id: string;
  branch_id: string;
  leave_type: string;
  custom_leave_type: string;
  selected_dates: string[];
  is_half_day: boolean;
  reason: string;
}) {
  const supabase = await createClient();

  try {
    if (!data.selected_dates || data.selected_dates.length === 0) {
      return { success: false, message: "LÜTFEN TAKVİMDEN EN AZ 1 GÜN SEÇİNİZ" };
    }

    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, full_name, position_title, leave_balance")
      .eq("id", data.employee_id)
      .single();

    if (empError || !employee) return { success: false, message: "PERSONEL BULUNAMADI" };

    const sortedDates = [...data.selected_dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    const requestedDays = data.is_half_day ? (sortedDates.length * 0.5) : sortedDates.length;

// YENİ KOD (Olması Gereken -14 Lojiği):
if (data.leave_type === 'YILLIK_IZIN') {
   if (employee.leave_balance - requestedDays < -14) {
      return { success: false, message: "Yıllık izin bakiyesi -14 gün sınırının altına düşemez." };
   }
}

    const adminTitles = ["YÖNETİCİ", "MÜDÜR", "ŞEF", "ADMIN", "DEVELOPER", "YONETICI", "MUDUR", "SEF", "TAKIM LİDERİ", "TAKIM LIDERI"];
    const empTitle = (employee.position_title || "").toUpperCase();
    
    const isHealthReport = data.leave_type === 'SAGLIK_RAPORU';
    const isAuthorized = adminTitles.some(title => empTitle.includes(title)) || employee.id === "3976";

    let requestStatus = "PENDING";
    let managerNote = null;
    let feedbackMessage = "İZİN TALEBİNİZ YÖNETİCİ ONAYINA GÖNDERİLDİ";

    if (isAuthorized || isHealthReport) {
      requestStatus = "APPROVED";
      managerNote = isHealthReport 
        ? "SİSTEM: Sağlık Raporu olduğu için otomatik onaylandı." 
        : `SİSTEM: ${employee.full_name} yetkisi dahilinde doğrudan onayladı.`;
      
      feedbackMessage = isHealthReport 
        ? "SAĞLIK RAPORU: SİSTEM TARAFINDAN OTOMATİK ONAYLANDI" 
        : "YETKİLİ: İZİN OTOMATİK ONAYLANDI VEYA SİSTEME İŞLENDİ";

      if (data.leave_type === 'YILLIK_IZIN') {
         await supabaseAdmin.from("employees").update({
           leave_balance: employee.leave_balance - requestedDays
         }).eq("id", employee.id);
      }

      let workingHours = data.is_half_day ? 4 : 8;
      if (data.leave_type === 'UCRETSIZ' || data.leave_type === 'ÜCRETSİZ') {
        workingHours = 0;
      }
      
      for (const dateStr of sortedDates) {
        const dIn = new Date(dateStr);
        dIn.setHours(8, 0, 0, 0);
        const checkInIso = dIn.toISOString();

        const dOut = new Date(dateStr);
        dOut.setHours(data.is_half_day ? 12 : 16, 0, 0, 0);
        const checkOutIso = dOut.toISOString();

        await supabaseAdmin.from("attendance").insert({
          employee_id: data.employee_id,
          branch_id: data.branch_id,
          check_in_time: checkInIso,
          check_out_time: checkOutIso,
          rounded_check_in: checkInIso,    
          rounded_check_out: checkOutIso,  
          break_hours: 0, 
          working_hours: workingHours,
          status: `LEAVE_${data.leave_type}`
        });
      }

      await supabaseAdmin.from("transaction_logs").insert({
        employee_id: data.employee_id,
        action_type: "LEAVE_AUTO_APPROVE",
        description: `OTO-ONAY: Toplam ${requestedDays} gün ${data.leave_type} izni kullanıldı. Neden: ${data.reason}`
      });
    }

    const { error: reqError } = await supabaseAdmin.from("leave_requests").insert({
      employee_id: data.employee_id,
      branch_id: data.branch_id,
      leave_type: data.leave_type,
      custom_leave_type: data.custom_leave_type || null,
      start_date: startDate, 
      end_date: endDate,     
      selected_dates: data.selected_dates,
      is_half_day: data.is_half_day,
      requested_days: requestedDays,
      reason: data.reason,
      status: requestStatus,
      manager_note: managerNote
    });

    if (reqError) throw reqError;

    revalidatePath("/management/hr", "layout");

    return { success: true, message: feedbackMessage };

  } catch (error: any) {
    return { success: false, message: `SİSTEM HATASI: ${error.message}` };
  }
}

// ============================================================================
// 3. İPTAL VE TEMİZLİK MOTORU (ÇALIŞAN YAPIYA UYARLANMIŞ KESİN ÇÖZÜM)
// ============================================================================
export async function cancelLeaveRequestServer(
  leaveId: string, 
  employeeId: string, 
  leaveType: string, 
  requestedDays: number, 
  selectedDatesRaw: any, 
  status: string
) {
  try {
    const logMsg = status === 'APPROVED' ? "SİSTEM: Personel onaylanmış iznini iptal etti." : "SİSTEM: Personel bekleyen talebini geri çekti.";
    
    // 1. İzin talebini CANCELLED olarak güncelle
    const { error: updateError } = await supabaseAdmin.from('leave_requests').update({ status: 'CANCELLED', manager_note: logMsg }).eq('id', leaveId);
    if (updateError) throw new Error("Talep güncellenemedi: " + updateError.message);

    if (status === 'APPROVED') {
      
      // 2. Bakiye İadesi
      const nonRefundable = ['UCRETSİZ', 'ÜCRETSİZ', 'UCRETSIZ', 'SAGLIK_RAPORU', 'EVLILIK', 'VEFAT', 'DOGUM', 'MAZERET'];
      if (!nonRefundable.includes(leaveType)) {
        const { data: emp, error: empError } = await supabaseAdmin.from('employees').select('leave_balance').eq('id', employeeId).single();
        if (empError) throw new Error("Bakiye okunamadı: " + empError.message);

        if (emp) {
           const { error: balanceError } = await supabaseAdmin.from('employees').update({ leave_balance: emp.leave_balance + Number(requestedDays) }).eq('id', employeeId);
           if (balanceError) throw new Error("Bakiye iade edilemedi: " + balanceError.message);
        }
      }

      // 3. Puantaj (Attendance) Hayalet Loglarını Silme (Döngüsel Tekil Silme)
      const rawString = typeof selectedDatesRaw === 'string' ? selectedDatesRaw : JSON.stringify(selectedDatesRaw);
      const matchedDates = rawString.match(/20\d{2}-\d{2}-\d{2}/g) || [];
      const uniqueDates = [...new Set(matchedDates)];

      if (uniqueDates.length > 0) {
        
        const { data: records, error: recordsError } = await supabaseAdmin
          .from('attendance')
          .select('id, check_in_time, status')
          .eq('employee_id', employeeId);
          
        if (recordsError) throw new Error("Puantaj logları okunamadı: " + recordsError.message);

        if (records && records.length > 0) {
          
          const idsToDelete = records.filter(r => {
            if (!r.status || !r.status.startsWith('LEAVE_')) return false;
            if (!r.check_in_time) return false;
            
            // "2026-06-22 05:00:00+00" tarihinden "2026-06-22" kısmını yakala
            const checkInStr = String(r.check_in_time).substring(0, 10);
            return uniqueDates.includes(checkInStr);
          }).map(r => r.id);

          // Çalışan kodundaki yapıya sadık kalarak, ID'leri tek tek eq() ile siliyoruz.
          if (idsToDelete.length > 0) {
            for (const delId of idsToDelete) {
               const { error: deleteError } = await supabaseAdmin
                 .from('attendance')
                 .delete()
                 .eq('id', delId);

               if (deleteError) throw new Error(`Puantaj ID: ${delId} silinemedi: ` + deleteError.message);
            }
          }
        }
      }
    }
    
    revalidatePath("/management/hr", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}