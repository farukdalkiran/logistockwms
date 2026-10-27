import { holidayCreditForEmployee, netCreditedAttendanceHours, istanbulDate, timeAtIstanbul, isLeaveRow, type PublicHoliday } from "@/lib/attendance/day-coverage";
'use server'

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// GÜVENLİK KONTROLÜ: Service Role Key var mı?
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("🚨 KRİTİK HATA: .env.local içinde SUPABASE_SERVICE_ROLE_KEY bulunamadı!");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PORTAL_COOKIE = 'wms_portal_session';
const QR_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'logistock_secret_key';
const TIME_STEP_SEC = 15; // 15 saniyelik bloklar

// ==========================================
// 1. PERSONEL GİRİŞ MOTORU
// ==========================================
export async function portalLogin(empId: string, passwordInput: string) {
  try {
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .select('id, full_name, is_active, password')
      .eq('id', empId)
      .maybeSingle();

    if (error) return { success: false, message: 'Veritabanı bağlantı hatası.' };
    if (!employee) return { success: false, message: 'Bu ID sistemde kayıtlı değil!' };

    const dbPassword = (employee.password || '').trim();
    const inputPassword = (passwordInput || '').trim();

    if (dbPassword !== inputPassword) return { success: false, message: 'Şifreniz hatalı!' };
    if (!employee.is_active) return { success: false, message: 'Hesabınız pasife alınmış.' };

    if (inputPassword.toLowerCase().startsWith('lgs')) {
      return { success: true, requirePasswordChange: true };
    }

    const cookieStore = await cookies();
    cookieStore.set(PORTAL_COOKIE, employee.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });

    return { success: true, requirePasswordChange: false };
  } catch (err: any) {
    return { success: false, message: 'Beklenmeyen bir sunucu hatası oluştu.' };
  }
}

// ==========================================
// 2. KATI KURALLI ŞİFRE YENİLEME MOTORU
// ==========================================
export async function portalChangePassword(empId: string, newPassword: string) {
  const pwd = newPassword.trim();
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasSymbol = /[^a-zA-Z0-9\s]/.test(pwd);
  const isLengthValid = pwd.length >= 8 && pwd.length <= 14;

  if (!isLengthValid || !hasLetter || !hasSymbol) {
    return { success: false, message: 'Şifreniz 8-14 karakter olmalı, harf ve sembol içermelidir.' };
  }

  const { error } = await supabaseAdmin.from('employees').update({ password: pwd }).eq('id', empId);
  if (error) return { success: false, message: 'Şifre güncellenemedi.' };

  const cookieStore = await cookies();
  cookieStore.set(PORTAL_COOKIE, empId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return { success: true };
}

// ==========================================
// 3. OTURUM VE ÇIKIŞ İŞLEMLERİ
// ==========================================
export async function getPortalSession() {
  const cookieStore = await cookies();
  const empId = cookieStore.get(PORTAL_COOKIE)?.value;
  if (!empId) return null;

  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select(`
      id, 
      full_name, 
      branch_id,
      branches (name)
    `)
    .eq('id', empId)
    .single();

  if (!employee) return null;

  let branchName = 'MERKEZ KADRO';
  if (employee.branches) {
    if (Array.isArray(employee.branches) && employee.branches.length > 0) {
      branchName = employee.branches[0].name;
    } else if (!Array.isArray(employee.branches) && (employee.branches as any).name) {
      branchName = (employee.branches as any).name;
    }
  }

  return {
    ...employee,
    resolvedBranchName: branchName
  };
}

export async function portalLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_COOKIE);
  return { success: true };
}

// ==========================================
// 4. DİNAMİK 15 SN QR KOD ÜRETİCİ (Veri Çıktılı)
// ==========================================
export async function getFreshQR() {
  const emp = await getPortalSession();
  if (!emp) return { success: false };

  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localDateStr = `${year}-${month}-${day}`; 
  
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const localTimeStr = `${hour}:${minute}`; 
  
  const secBlock = Math.floor(now.getSeconds() / TIME_STEP_SEC);

  const payload = `${emp.id}:${localDateStr}:${localTimeStr}:${secBlock}`;
  
  const hash = crypto.createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 6)
    .toUpperCase();
  
  // Örn: wms_39760_2026-10-16_10:57_2_A1B2C3
  return { 
    success: true, 
    qrData: `wms_${emp.id}_${localDateStr}_${localTimeStr}_${secBlock}_${hash}` 
  };
}

// ==========================================
// 5. TERMİNAL OKUYUCU İÇİN QR DOĞRULAYICI (Anti-Tampering & Anti-Replay)
// ==========================================
export async function verifyPortalQR(scannedQR: string) {
  if (!scannedQR || !scannedQR.startsWith('wms_')) {
    return { success: false, message: 'GEÇERSİZ BARKOD FORMATI' };
  }

  const parts = scannedQR.split('_');
  if (parts.length !== 6) {
    return { success: false, message: 'HATALI BARKOD YAPISI' };
  }

  const empId = parts[1];
  const dateStr = parts[2];
  const timeStr = parts[3];
  const secBlock = parseInt(parts[4]);
  const scannedHash = parts[5];

  // 1. Kurcalama (Tampering) Kontrolü
  const payload = `${empId}:${dateStr}:${timeStr}:${secBlock}`;
  const expectedHash = crypto.createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 6)
    .toUpperCase();
  
  if (scannedHash !== expectedHash) {
    return { success: false, message: 'GÜVENLİK İHLALİ: BARKOD DEĞİŞTİRİLMİŞ!' };
  }

  // 2. Süre (Anti-Replay / Ekran Görüntüsü) Kontrolü
  const barcodeTime = new Date(`${dateStr}T${timeStr}:00`);
  barcodeTime.setSeconds(secBlock * TIME_STEP_SEC);
  
  const now = new Date();
  const diffMs = now.getTime() - barcodeTime.getTime();
  
  if (diffMs > 30000 || diffMs < -5000) {
    return { success: false, message: 'SÜRESİ GEÇMİŞ QR! LÜTFEN EKRANI YENİLEYİNİZ.' };
  }

  return { 
    success: true, 
    empId, 
    recordedDate: dateStr, 
    recordedTime: timeStr 
  };
}

// ==========================================
// 6. AYLIK İSTATİSTİK VE GÜNLÜK LOG TABLOSU
// ==========================================
export async function getPortalStats() {
  const emp = await getPortalSession();
  if (!emp) return null;
  const now = new Date();
  const todayTR = istanbulDate(now.toISOString());
  const firstDayTR = todayTR.slice(0,7) + "-01";
  const [{data:attendances,error:attError},{data:holidayData,error:holidayError}]=await Promise.all([
    supabaseAdmin.from("attendance")
      .select("check_in_time,check_out_time,working_hours,status")
      .eq("employee_id",emp.id).gte("check_in_time",timeAtIstanbul(firstDayTR,"00:00"))
      .lte("check_in_time",now.toISOString()).order("check_in_time",{ascending:false}),
    supabaseAdmin.from("wms_public_holidays")
      .select("id,holiday_date,title,period,start_time,end_time,credited_hours")
      .gte("holiday_date",firstDayTR).lte("holiday_date",todayTR),
  ]);
  if(attError||holidayError) {
    console.error("[WMS_PORTAL_STATS]",attError??holidayError);
    return null;
  }
  const rows=(attendances??[]) as {
    check_in_time:string|null;check_out_time:string|null;
    working_hours:number|string|null;status:string|null
  }[];
  const holidays=(holidayData??[]) as PublicHoliday[];
  let totalHours=0,overTime=0;
  const logs:{
    date:string;checkIn:string;checkOut:string;
    hours:string;status:string|null
  }[]=[];
  const workedHoursByDay=new Map<string,number>();
  const coveredAbsenceHours=new Map<string,number>();
  const dateFmt=new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"short"});
  const timeFmt=new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit"});
  for(const record of rows){
    if(!record.check_in_time)continue;
    const date=istanbulDate(record.check_in_time);
    const hours=Number(record.working_hours)||0;
    totalHours+=hours;
    if(!isLeaveRow(record.status)){
      workedHoursByDay.set(date,(workedHoursByDay.get(date)??0)+hours);
      if(hours>8)overTime+=hours-8;
    } else {
      // Unpaid full-day leave still counts as an excused absence, despite 0 paid hours.
      const a=Date.parse(record.check_in_time);
      const b=record.check_out_time?Date.parse(record.check_out_time):a;
      const approvedDuration=Math.min(8,Math.max(0,(b-a)/3600000));
      coveredAbsenceHours.set(date,(coveredAbsenceHours.get(date)??0)+approvedDuration);
    }
    logs.push({
      date:dateFmt.format(new Date(record.check_in_time)),
      checkIn:timeFmt.format(new Date(record.check_in_time)),
      checkOut:record.check_out_time?timeFmt.format(new Date(record.check_out_time)):"-",
      hours:hours>0?hours.toFixed(1):"-",
      status:record.status,
    });
  }
  const creditedHolidays=holidayCreditForEmployee(holidays,rows);
  totalHours=netCreditedAttendanceHours(rows)+creditedHolidays;
  for(const holiday of holidays){
    const hours=holidayCreditForEmployee([holiday],rows);
    if(hours<=0)continue;
    coveredAbsenceHours.set(holiday.holiday_date,(coveredAbsenceHours.get(holiday.holiday_date)??0)+hours);
    logs.push({
      date:dateFmt.format(new Date(timeAtIstanbul(holiday.holiday_date,"12:00"))),
      checkIn:holiday.start_time.slice(0,5),
      checkOut:holiday.end_time.slice(0,5),
      hours:hours.toFixed(1),
      status:"PUBLIC_HOLIDAY",
    });
  }
  let missingDays=0;
  const lastDate=Date.parse(todayTR+"T12:00:00Z");
  for(let d=Date.parse(firstDayTR+"T12:00:00Z");d<=lastDate;d+=86400000){
    const day=new Date(d);
    if(day.getUTCDay()===0||day.getUTCDay()===6)continue;
    const date=day.toISOString().slice(0,10);
    const coveredHours=(workedHoursByDay.get(date)??0)+(coveredAbsenceHours.get(date)??0);
    missingDays+=Math.max(0,1-Math.min(1,coveredHours/8));
  }
  return {
    totalHours:totalHours.toFixed(1),
    overTime:overTime.toFixed(1),
    missingDays:Math.round(missingDays*2)/2,
    logs,
  };
}