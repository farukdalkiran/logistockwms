'use server'

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const QR_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'logistock_secret_key';
const TIME_STEP_SEC = 15;

// Yardımcı Fonksiyon: Saati bir sonraki 15 dakikalık dilime (tavana) yuvarlar
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

// Yardımcı Fonksiyon: Güvenli YYYY-MM-DD formatlayıcı (Sunucu dilinden bağımsız)
function getTrtYMD(dateObj: Date): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function processAttendanceScan(
  scannedCode: string, 
  actionType: 'IN' | 'OUT',
  branchId: string | null 
) {
  if (!scannedCode || !scannedCode.startsWith('wms_')) {
    return { success: false, message: 'GEÇERSİZ BARKOD FORMATI' };
  }

  // 1. QR BARKOD PARÇALAMA VE GÜVENLİK KONTROLÜ
  const parts = scannedCode.split('_');
  if (parts.length !== 6) {
    return { success: false, message: 'HATALI BARKOD YAPISI' };
  }

  const empId = parts[1];
  const dateStr = parts[2];
  const timeStr = parts[3];
  const secBlock = parseInt(parts[4]);
  const scannedHash = parts[5];

  // Tampering (Kurcalama) Kontrolü
  const payload = `${empId}:${dateStr}:${timeStr}:${secBlock}`;
  const expectedHash = crypto.createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 6)
    .toUpperCase();
  
  if (scannedHash !== expectedHash) {
    return { success: false, message: 'GÜVENLİK İHLALİ: BARKOD DEĞİŞTİRİLMİŞ!' };
  }

  // Süre (Anti-Replay / Ekran Görüntüsü) Kontrolü
  const barcodeTime = new Date(`${dateStr}T${timeStr}:00`);
  barcodeTime.setSeconds(secBlock * TIME_STEP_SEC);
  const now = new Date();
  const diffMs = now.getTime() - barcodeTime.getTime();
  
  if (diffMs > 30000 || diffMs < -5000) {
    return { success: false, message: 'SÜRESİ GEÇMİŞ QR! LÜTFEN EKRANI YENİLEYİNİZ.' };
  }

  // 2. PUANTAJ VERİTABANI İŞLEMLERİ
  const supabase = await createClient();

  try {
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, branch_id, is_active')
      .eq('id', empId) 
      .eq('is_active', true)
      .single();

    if (empError || !employee) {
      return { success: false, message: 'GEÇERSİZ VEYA PASİF PERSONEL KİMLİĞİ' };
    }

    if (branchId && employee.branch_id !== branchId) {
      return { 
        success: false, 
        message: 'GÜVENLİK İHLALİ: PERSONEL BU ŞUBEYE KAYITLI DEĞİL!' 
      };
    }

    const activeBranchId = branchId || employee.branch_id;
    
    // ⚠️ Vercel Bağımsız TRT Gece Yarısı ve "TAVAN LİMİT" Hesaplaması
    const trDateNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
    
    // Bugünün Başlangıcı (Alt Sınır)
    const startOfDayTrt = new Date(`${getTrtYMD(trDateNow)}T00:00:00+03:00`).toISOString();
    
    // Yarının Başlangıcı (Üst Sınır)
    trDateNow.setDate(trDateNow.getDate() + 1);
    const startOfTomorrowTrt = new Date(`${getTrtYMD(trDateNow)}T00:00:00+03:00`).toISOString();

    const actualTime = now.toISOString();
    const roundedTime = roundToNext15Minutes(now);
    const roundedTimeIso = roundedTime.toISOString();

    // ==========================================
    // MESAİ GİRİŞ (IN) OPERASYONU
    // ==========================================
    if (actionType === 'IN') {
      
      // HAYALET OTURUM KONTROLÜ
      const { data: activeSession } = await supabase
        .from('attendance')
        .select('id, check_in_time')
        .eq('employee_id', employee.id)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSession) {
        if (activeSession.check_in_time < startOfDayTrt) {
          await supabase
            .from('attendance')
            .update({ 
              check_out_time: startOfDayTrt,
              status: 'AUTO_CLOSED_MISSING_OUT' 
            })
            .eq('id', activeSession.id);
        } else {
          return { 
            success: false, 
            message: `HATA: ${employee.full_name.toUpperCase()} ŞU AN ZATEN İÇERİDE GÖRÜNÜYOR` 
          };
        }
      }

      const { data: existingTodayIn } = await supabase
        .from('attendance')
        .select('id')
        .eq('employee_id', employee.id)
        .gte('check_in_time', startOfDayTrt)
        .lt('check_in_time', startOfTomorrowTrt)
        .limit(1)
        .maybeSingle();

      if (existingTodayIn) {
        return { 
          success: false, 
          message: `HATA: ${employee.full_name.toUpperCase()} BUGÜN ZATEN BİR KAYIT OLUŞTURMUŞ` 
        };
      }

      // RAPOR / İZİN KONTROLÜ
      const { data: existingTodayReport } = await supabase
        .from('leave_requests') 
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'APPROVED')
        .lte('start_date', startOfDayTrt)
        .gte('end_date', startOfDayTrt)
        .limit(1)
        .maybeSingle();

      if (existingTodayReport) {
        return { 
          success: false, 
          message: `HATA: ${employee.full_name.toUpperCase()} BUGÜN İÇİN RAPORLU/İZİNLİ GÖRÜNÜYOR` 
        };
      }

      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          employee_id: employee.id,
          branch_id: activeBranchId,
          check_in_time: actualTime,
          rounded_check_in: roundedTimeIso,
          status: 'ON_TIME'
        });

      if (insertError) throw insertError;

      return { 
        success: true, 
        message: `GİRİŞ ONAYLANDI: ${employee.full_name.toUpperCase()}` 
      };
    }

    // ==========================================
    // MESAİ ÇIKIŞ (OUT) OPERASYONU
    // ==========================================
    if (actionType === 'OUT') {
      
      const { data: activeRecord } = await supabase
        .from('attendance')
        .select('id, rounded_check_in')
        .eq('employee_id', employee.id)
        .is('check_out_time', null)
        .lt('check_in_time', startOfTomorrowTrt)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeRecord) {
        return { 
          success: false, 
          message: `HATA: ${employee.full_name.toUpperCase()} İÇİN AÇIK MESAİ KAYDI BULUNAMADI` 
        };
      }

      const checkInDate = new Date(activeRecord.rounded_check_in);
      const diffInMilliseconds = roundedTime.getTime() - checkInDate.getTime();
      const totalHoursRounded = diffInMilliseconds / (1000 * 60 * 60);

      const breakHours = totalHoursRounded > 5 ? 1 : 0;
      const netWorkingHours = Math.max(0, totalHoursRounded - breakHours);

      const { error: updateError } = await supabase
        .from('attendance')
        .update({
          check_out_time: actualTime,
          rounded_check_out: roundedTimeIso,
          break_hours: breakHours,
          working_hours: parseFloat(netWorkingHours.toFixed(2))
        })
        .eq('id', activeRecord.id);

      if (updateError) throw updateError;

      return { 
        success: true, 
        message: `ÇIKIŞ ONAYLANDI: ${employee.full_name.toUpperCase()} (${netWorkingHours.toFixed(1)} Saat)` 
      };
    }

    return { success: false, message: 'GEÇERSİZ İŞLEM TİPİ' };

  } catch (error: any) {
    return { 
      success: false, 
      message: `SİSTEMSEL HATA: ${error?.message || 'Bilinmeyen Veritabanı Hatası'}` 
    };
  }
}