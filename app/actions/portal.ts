'use server';

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// Portal cookies are signed. A raw employee ID is NEVER authentication.
function getSessionSecret(): string {
  const secret = process.env.WMS_PORTAL_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) throw new Error('Portal session signing secret is not configured.');
  return secret;
}
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const PORTAL_COOKIE = 'wms_portal_session';
const QR_SECRET = process.env.WMS_QR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TIME_STEP_SEC = 15;
const SESSION_AGE = 12 * 60 * 60;
type PortalState = 'active' | 'password_change';

function signSession(employeeId: string, state: PortalState): string {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_AGE;
  const payload = `${employeeId}.${state}.${expiry}`;
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifySession(value: string | undefined): { id: string; state: PortalState } | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [id, state, expiry, signature] = parts;
  if (!/^\d{3,10}$/.test(id) || (state !== 'active' && state !== 'password_change')) return null;
  const exp = Number(expiry);
  if (!Number.isSafeInteger(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(`${id}.${state}.${expiry}`).digest();
  let provided: Buffer;
  try { provided = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  return { id, state };
}

function setSessionCookie(employeeId: string, state: PortalState, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(PORTAL_COOKIE, signSession(employeeId, state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_AGE
  });
}

// Legacy plaintext credentials are accepted once and upgraded after a successful login.
function verifyPassword(stored: string, supplied: string): boolean {
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3 || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
    const derived = crypto.scryptSync(supplied, Buffer.from(parts[1], 'hex'), 64);
    return crypto.timingSafeEqual(derived, Buffer.from(parts[2], 'hex'));
  }
  const a = Buffer.from(stored, 'utf8');
  const b = Buffer.from(supplied, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function hashPassword(value: string): string {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(value, salt, 64).toString('hex')}`;
}

export async function portalLogin(empId: string, passwordInput: string) {
  try {
    if (!/^\d{3,10}$/.test(empId) || !passwordInput || passwordInput.length > 256) {
      return { success: false, message: 'Personel ID veya şifre geçersiz.' };
    }
    const { data: employee, error } = await supabaseAdmin
      .from('employees').select('id, is_active, password').eq('id', empId).maybeSingle();
    if (error || !employee || !employee.is_active || !verifyPassword((employee.password || '').trim(), passwordInput.trim())) {
      return { success: false, message: 'Personel ID veya şifre hatalı.' };
    }
    const requiresChange = passwordInput.trim().toLowerCase().startsWith('lgs');
    if (!employee.password.startsWith('scrypt$')) {
      const { error: upgradeError } = await supabaseAdmin.from('employees')
        .update({ password: hashPassword(passwordInput.trim()) }).eq('id', employee.id);
      if (upgradeError) throw upgradeError;
    }
    const cookieStore = await cookies();
    setSessionCookie(employee.id, requiresChange ? 'password_change' : 'active', cookieStore);
    return { success: true, requirePasswordChange: requiresChange };
  } catch {
    return { success: false, message: 'Giriş işlemi tamamlanamadı.' };
  }
}

export async function portalChangePassword(empId: string, newPassword: string) {
  const cookieStore = await cookies();
  const current = verifySession(cookieStore.get(PORTAL_COOKIE)?.value);
  if (!current || current.id !== empId) {
    return { success: false, message: 'Şifre değiştirmek için kendi hesabınızla giriş yapmalısınız.' };
  }
  const pwd = newPassword.trim();
  if (pwd.length < 8 || pwd.length > 64 || !/[a-zA-Z]/.test(pwd) || !/[^a-zA-Z0-9\s]/.test(pwd)) {
    return { success: false, message: 'Şifreniz 8-64 karakter olmalı, harf ve sembol içermelidir.' };
  }
  const { data: employee, error: lookupError } = await supabaseAdmin.from('employees')
    .select('id, is_active').eq('id', current.id).maybeSingle();
  if (lookupError || !employee?.is_active) return { success: false, message: 'Personel hesabı etkin değil.' };
  const { error } = await supabaseAdmin.from('employees')
    .update({ password: hashPassword(pwd) }).eq('id', current.id);
  if (error) return { success: false, message: 'Şifre güncellenemedi.' };
  setSessionCookie(current.id, 'active', cookieStore);
  return { success: true };
}

export async function getPortalSession() {
  const cookieStore = await cookies();
  const token = verifySession(cookieStore.get(PORTAL_COOKIE)?.value);
  if (!token || token.state !== 'active') return null;
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, branch_id, branches(name)')
    .eq('id', token.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!employee) return null;

  let branchName = 'MERKEZ KADRO';
  if (employee.branches) {
    if (Array.isArray(employee.branches) && employee.branches.length > 0) branchName = employee.branches[0].name;
    else if (!Array.isArray(employee.branches) && (employee.branches as any).name) branchName = (employee.branches as any).name;
  }
  return { ...employee, resolvedBranchName: branchName };
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

  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
  const today = new Date().toISOString();

  const { data: attendances } = await supabaseAdmin
    .from('attendance')
    .select('check_in_time, check_out_time, working_hours, status')
    .eq('employee_id', emp.id)
    .gte('check_in_time', firstDay)
    .lte('check_in_time', today)
    .order('check_in_time', { ascending: false });

  let totalHours = 0;
  let overTime = 0;
  const presentDaysCount = attendances?.length || 0;
  const logs: any[] = [];

  if (attendances) {
    attendances.forEach(att => {
      const hrs = att.working_hours || 0;
      totalHours += hrs;
      if (hrs > 8) overTime += (hrs - 8);

      const inDate = new Date(att.check_in_time);
      const outDate = att.check_out_time ? new Date(att.check_out_time) : null;

      logs.push({
        date: inDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
        checkIn: inDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        checkOut: outDate ? outDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-',
        hours: hrs > 0 ? hrs.toFixed(1) : '-',
        status: att.status
      });
    });
  }

  let pastWorkingDays = 0;
  for (let d = new Date(firstDay); d <= new Date(); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) pastWorkingDays++; 
  }

  const missingDays = Math.max(0, pastWorkingDays - presentDaysCount);

  return {
    totalHours: totalHours.toFixed(1),
    overTime: overTime.toFixed(1),
    missingDays,
    logs
  };
}