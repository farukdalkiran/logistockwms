'use server'

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// ============================================================================
// 1. GÜVENLİK VE VERİTABANI İSTEMCİSİ (SERVICE ROLE BYPASS)
// Sessiz RLS yutmalarını ve Update/Delete engellerini aşmak için Admin Client
// ============================================================================
const supabaseAdmin = createClient(
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
// 2. YARDIMCI PDKS MATEMATİK FONKSİYONLARI
// ============================================================================
function roundToNext15Minutes(date: Date): Date {
  const newDate = new Date(date);
  const minutes = newDate.getMinutes();
  const remainder = minutes % 15;
  
  if (remainder > 0) {
    newDate.setMinutes(minutes + (15 - remainder));
  }
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  
  return newDate;
}

const checkIsManager = (title?: string) => {
  if (!title) return false;
  const lowerTitle = title.toLocaleLowerCase("tr-TR");
  return [
    "yönetici", "müdür", "şef", "admin", "developer", "uzman", "lider"
  ].some((keyword) => lowerTitle.includes(keyword));
};

// ============================================================================
// 3. ANA SUNUCU AKSİYONU: TALEPLERİ VE DOĞRUDAN DÜZELTMELERİ İŞLEME
// ============================================================================
type LogRequestParams = {
  employee_id: string;
  manager_branch_id: string | null;
  attendance_id: string | null;
  request_date: string;
  req_check_in: string | null;
  req_check_out: string | null;
  reason: string;
  action_mode: "NEW" | "EDIT" | "DELETE";
};

export async function submitLogRequest(params: LogRequestParams) {
  try {
    // 1. Personel Doğrulaması ve Şube Kilit Kontrolü (Cross-Branch Lock)
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, full_name, branch_id, position_title, is_active')
      .eq('id', params.employee_id)
      .eq('is_active', true)
      .single();

    if (empError || !employee) {
      return { success: false, message: 'PERSONEL BULUNAMADI VEYA PASİF DURUMDA!' };
    }

    // Global Yetki Değilse ve Şubeler Eşleşmiyorsa Reddet
    if (params.manager_branch_id && employee.branch_id !== params.manager_branch_id) {
      return { 
        success: false, 
        message: `GÜVENLİK İHLALİ: ${employee.full_name.toUpperCase()} FARKLI BİR ŞUBEYE KAYITLI!` 
      };
    }

    const isManager = checkIsManager(employee.position_title);

    // 2. Zaman ve Puantaj Hesaplamaları (DELETE Değilse)
    let inIso: string | null = null;
    let outIso: string | null = null;
    let roundedInIso: string | null = null;
    let roundedOutIso: string | null = null;
    let breakHours = 0;
    let netWorkingHours = 0;

    if (params.action_mode !== "DELETE" && params.req_check_in) {
      const inDate = new Date(params.req_check_in);
      roundedInIso = roundToNext15Minutes(inDate).toISOString();
      inIso = inDate.toISOString();

      if (params.req_check_out) {
        const outDate = new Date(params.req_check_out);
        
        // Gece Vardiyası Koruması (Çıkış saati girişten küçükse 1 gün ekle)
        if (outDate < inDate) {
          outDate.setDate(outDate.getDate() + 1);
        }
        
        roundedOutIso = roundToNext15Minutes(outDate).toISOString();
        outIso = outDate.toISOString();

        // Mola ve Net Süre Hesaplama
        const diffMs = new Date(roundedOutIso).getTime() - new Date(roundedInIso).getTime();
        const totalHours = diffMs / (1000 * 60 * 60);
        breakHours = totalHours > 5 ? 1 : 0;
        netWorkingHours = Math.max(0, totalHours - breakHours);
      }
    }

    // ====================================================================
    // SENARYO A: KULLANICI BİR YÖNETİCİ (OTOMATİK ONAY VE DOĞRUDAN DB MÜDAHALESİ)
    // ====================================================================
    if (isManager) {
      if (params.action_mode === "DELETE") {
        if (!params.attendance_id) return { success: false, message: 'SİLİNECEK KAYIT ID EKSİK!' };
        
        const { error: delError } = await supabaseAdmin
          .from('attendance')
          .delete()
          .eq('id', params.attendance_id);
          
        if (delError) throw delError;

        await supabaseAdmin.from('transaction_logs').insert({
          employee_id: employee.id,
          action_type: 'DELETE_ATTENDANCE_LOG',
          description: `Kayıt Silindi. Tarih: ${params.request_date}. Neden: ${params.reason}`
        });

        revalidatePath('/management/hr');
        return { success: true, message: `KAYIT BAŞARIYLA SİLİNDİ: ${employee.full_name.toUpperCase()}` };
      }

      if (params.action_mode === "NEW") {
        const { error: insError } = await supabaseAdmin
          .from('attendance')
          .insert({
            employee_id: employee.id,
            branch_id: employee.branch_id,
            check_in_time: inIso,
            check_out_time: outIso,
            rounded_check_in: roundedInIso,
            rounded_check_out: roundedOutIso,
            break_hours: breakHours,
            working_hours: outIso ? parseFloat(netWorkingHours.toFixed(2)) : null,
            status: 'MANUAL_EDIT_AUTO_APPROVED'
          });

        if (insError) throw insError;

        await supabaseAdmin.from('transaction_logs').insert({
          employee_id: employee.id,
          action_type: 'MANUAL_ATTENDANCE_LOG',
          description: `Yeni Kayıt Eklendi (Oto-Onay). Neden: ${params.reason}`
        });

        revalidatePath('/management/hr');
        return { success: true, message: `YENİ KAYIT EKLENDİ: ${employee.full_name.toUpperCase()}` };
      }

      if (params.action_mode === "EDIT") {
        if (!params.attendance_id) return { success: false, message: 'GÜNCELLENECEK KAYIT ID EKSİK!' };

        const { error: updError } = await supabaseAdmin
          .from('attendance')
          .update({
            check_in_time: inIso,
            check_out_time: outIso,
            rounded_check_in: roundedInIso,
            rounded_check_out: roundedOutIso,
            break_hours: breakHours,
            working_hours: outIso ? parseFloat(netWorkingHours.toFixed(2)) : null,
            status: 'MANUAL_EDIT_AUTO_APPROVED'
          })
          .eq('id', params.attendance_id);

        if (updError) throw updError;

        await supabaseAdmin.from('transaction_logs').insert({
          employee_id: employee.id,
          action_type: 'MANUAL_ATTENDANCE_LOG',
          description: `Kayıt Güncellendi (Oto-Onay). Neden: ${params.reason}`
        });

        revalidatePath('/management/hr');
        return { success: true, message: `KAYIT GÜNCELLENDİ: ${employee.full_name.toUpperCase()}` };
      }
    } 

// ====================================================================
    // SENARYO B: KULLANICI BİR PERSONEL (ONAYA DÜŞÜR - ATTENDANCE_REQUESTS)
    // ====================================================================
    else {
      const { error: reqError } = await supabaseAdmin
        .from('attendance_requests')
        .insert({
          employee_id: employee.id,
          branch_id: employee.branch_id,
          attendance_id: params.attendance_id, 
          request_type: params.action_mode === "DELETE" ? "DELETE_LOG" : "MANUAL_LOG",
          request_date: params.request_date,
          req_check_in: params.action_mode === "DELETE" ? null : inIso,
          req_check_out: params.action_mode === "DELETE" ? null : outIso,
          reason: params.reason,
          status: 'PENDING'
        });

      if (reqError) throw reqError;

      // 🎯 ÇÖZÜM 1: Yeni talep geldikten sonra onay panelinin cache'ini temizle
      revalidatePath('/management/hr', 'layout');

      let msgText = "DÜZELTME";
      if (params.action_mode === "NEW") msgText = "YENİ KAYIT";
      if (params.action_mode === "DELETE") msgText = "SİLME";

      return { 
        success: true, 
        message: `${msgText} TALEBİNİZ ALINDI VE YÖNETİCİ ONAYINA İLETİLDİ.` 
      };
    }

    return { success: false, message: 'BİLİNMEYEN İŞLEM TİPİ' };

  } catch (error: any) {
    console.error("[WMS_LOG_REQUEST_ERROR]", error);
    return { 
      success: false, 
      message: `SİSTEM HATASI: ${error?.message || 'Veritabanı Kaydı Başarısız'}` 
    };
  }
}