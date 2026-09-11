'use server'

import { createClient } from '@/lib/supabase/server';
import { createHmac } from 'crypto';

// Çevresel değişkenden gizli anahtarımızı alıyoruz
const SECRET = process.env.WMS_ATTENDANCE_SECRET || 'logistock_master_key_2026';

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

export async function processAttendanceScan(
  scannedCode: string, // Eski terminalId yerine artık uzun QR string'i geliyor
  actionType: 'IN' | 'OUT',
  branchId: string | null // UI'dan prop olarak gelen şube ID'si
) {
  // ==========================================
  // 1. QR KOD KRİPTOGRAFİK DOĞRULAMA (KILL-SWITCH)
  // ==========================================
  
  // A. Format Kontrolü
  if (!scannedCode || !scannedCode.startsWith('WMS-')) {
    return { success: false, message: 'GEÇERSİZ BARKOD FORMATI' };
  }

  const parts = scannedCode.split('-');
  if (parts.length !== 4) {
    return { success: false, message: 'HATALI VEYA EKSİK BARKOD' };
  }

  const [prefix, empId, timestampStr, signature] = parts;
  const qrTimestamp = parseInt(timestampStr, 10);

  // B. Zaman (Time-Drift) Kontrolü
  // QR kodun üretildiği an ile sunucuya ulaştığı an arasındaki farkı ölçüyoruz.
  // Mobil tarafta 10 sn'de bir yenileniyor. Ağ gecikmelerine karşı 15 saniye maksimum tolerans veriyoruz.
  const nowMs = Date.now();
  const diffInSeconds = (nowMs - qrTimestamp) / 1000;

  if (diffInSeconds > 15 || diffInSeconds < -5) {
    return { success: false, message: 'SÜRESİ DOLMUŞ VEYA GEÇERSİZ BARKOD (YENİDEN OKUTUN)' };
  }

  // C. İmza (Sahtecilik) Kontrolü
  // Biri ekran videosu veya sahte bir kod üretirse diye aynı anahtarla imzayı yeniden oluşturup kıyaslıyoruz.
  const dataToSign = `${empId}:${qrTimestamp}`;
  const expectedSignature = createHmac('sha256', SECRET).update(dataToSign).digest('hex').substring(0, 10);

  if (signature !== expectedSignature) {
    return { success: false, message: 'GÜVENLİK İHLALİ: SAHTE BARKOD TESPİT EDİLDİ' };
  }

  // ==========================================
  // 2. WMS MESAİ VE PUANTAJ LOJİĞİ (Güvenlikten geçildi)
  // ==========================================
  
  const supabase = await createClient();

  try {
    // 1. Personel Doğrulaması (Sadece Aktif Personeller)
    // Terminal kodu olarak empId kullanıyoruz (Çünkü QR kodunun içine onu gömdük)
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, branch_id, is_active')
      .eq('terminal_code', empId) // Dikkat: QR kodunda ID değil, güvenli 10 haneli terminal_code dönüyor
      .eq('is_active', true)
      .single();

    if (empError || !employee) {
      return { success: false, message: 'GEÇERSİZ VEYA PASİF PERSONEL KİMLİĞİ' };
    }

    // 🛡️ GÜVENLİK DUVARI: CROSS-BRANCH LOCK
    // İSTEK: Eğer terminalin bağlı olduğu bir şube varsa ve bu şube personelin kayıtlı olduğu şube değilse işlemi REDDET! İsim GÖSTERME.
    if (branchId && employee.branch_id !== branchId) {
      return { 
        success: false, 
        message: `GÜVENLİK İHLALİ: PERSONEL BU ŞUBEYE KAYITLI DEĞİL!` 
      };
    }

    // Terminalin veya personelin şubesi (Güvenliği geçtiği için ikisi de aynı veya branchId null'dur)
    const activeBranchId = branchId || employee.branch_id;

    const now = new Date();
    const actualTime = now.toISOString();
    const roundedTime = roundToNext15Minutes(now);
    const roundedTimeIso = roundedTime.toISOString();

    // Bugünün başlangıcı (Local Midnight -> ISO)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // ==========================================
    // MESAİ GİRİŞ (IN) OPERASYONU
    // ==========================================
    if (actionType === 'IN') {
      
      // İSTEK 1: Sadece açık kayıt değil, BUGÜN atılmış HERHANGİ BİR kayıt var mı? (Günde maksimum 1 kayıt kuralı)
      const { data: existingTodayIn } = await supabase
        .from('attendance')
        .select('id')
        .eq('employee_id', employee.id)
        .gte('check_in_time', startOfDay)
        .limit(1)
        .maybeSingle();

      if (existingTodayIn) {
        return { 
          success: false, 
          message: `HATA: ${employee.full_name.toUpperCase()} BUGÜN ZATEN BİR KAYIT OLUŞTURMUŞ` 
        };
      }

      // İSTEK 2: Rapor / İzin Kontrolü (Leave Requests tablosundan kontrol ediyoruz)
      // WMS Şemasına uygun olarak leave_requests tablosundan kontrol edilir
      const { data: existingTodayReport } = await supabase
        .from('leave_requests') 
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'APPROVED')
        .lte('start_date', startOfDay)
        .gte('end_date', startOfDay)
        .limit(1)
        .maybeSingle();

      if (existingTodayReport) {
        return { 
          success: false, 
          message: `HATA: ${employee.full_name.toUpperCase()} BUGÜN İÇİN RAPORLU/İZİNLİ GÖRÜNÜYOR` 
        };
      }

      // 15 Dakika Kuralı (onTime Lojiği)
      let attendanceStatus = 'ON_TIME';
      
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          employee_id: employee.id,
          branch_id: activeBranchId,
          check_in_time: actualTime,
          rounded_check_in: roundedTimeIso,
          status: attendanceStatus
        });

      if (insertError) throw insertError;

      return { 
        success: true, 
        message: `GİRİŞ BAŞARILI: ${employee.full_name.toUpperCase()}` 
      };
    }

    // ==========================================
    // MESAİ ÇIKIŞ (OUT) OPERASYONU
    // ==========================================
    if (actionType === 'OUT') {
      // ÇIKIŞ LOJİĞİ DÜZELTMESİ: Sadece BUGÜN atılmış ve çıkışı yapılmamış kaydı bul.
      // Geçmiş günlerdeki açık kayıtlar burada filtrelenir ve sistem dışı bırakılır.
      const { data: activeRecord } = await supabase
        .from('attendance')
        .select('id, rounded_check_in')
        .eq('employee_id', employee.id)
        .gte('check_in_time', startOfDay)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeRecord) {
        return { 
          success: false, 
          message: `HATA: ${employee.full_name.toUpperCase()} İÇİN BUGÜN AÇIK MESAİ KAYDI BULUNAMADI` 
        };
      }

      // --- WMS PDKS MATEMATİK MOTORU ---
      const checkInDate = new Date(activeRecord.rounded_check_in);
      const diffInMilliseconds = roundedTime.getTime() - checkInDate.getTime();
      const totalHoursRounded = diffInMilliseconds / (1000 * 60 * 60);

      // İş Kuralı: Mesai 5 saatin üstündeyse 1 saat mola düş, değilse 0
      const breakHours = totalHoursRounded > 5 ? 1 : 0;
      
      // Net Çalışma Saati = Yuvarlanmış Çıkış - Yuvarlanmış Giriş - Mola Saati
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
        message: `ÇIKIŞ BAŞARILI: ${employee.full_name.toUpperCase()} (${netWorkingHours.toFixed(1)} Saat Net Çalışma)` 
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