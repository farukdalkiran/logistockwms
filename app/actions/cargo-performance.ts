"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export type CargoStatus = "success" | "missing" | "returned";
export type CargoDaily = {
  date: string; count: number; success: number; missing: number; returned: number;
  unique: number; first_time: string; last_time: string;
};
export type CargoReason = { reason: string; count: number };
export type CargoAnalytics = {
  success: true;
  period: { start: string; end: string };
  global: { records: number; uniqueShipments: number; success: number; missing: number; returned: number; duplicates: number; today: number };
  overview: { records: number; uniqueShipments: number; success: number; missing: number; returned: number; duplicates: number; activeDays: number; averageDaily: number; peakDay: string | null; peakCount: number; successRate: number };
  daily: CargoDaily[];
  hourly: { hour: number; count: number; success: number; missing: number; returned: number }[];
  weekday: { day: number; count: number }[];
  reasons: CargoReason[];
};
export type CargoAnalyticsResponse = CargoAnalytics | { success: false; error: string };

type Row = {
  id: string; created_at: string; delivery_number: string; sd_document: string;
  missing_address: boolean | null; is_returned: boolean | null;
  aras_tracking_number: string | null; note: string | null;
};

const DAY_MS = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "Europe/Istanbul";

function dayISO(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const p = (x: string) => parts.find((t) => t.type === x)?.value || "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}
function timeTR(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
function hourTR(d: Date): number { return Number(timeTR(d).split(":")[0]) % 24; }
function status(r: Row): CargoStatus {
  // In case of conflicting legacy flags, show returned before missing.
  if (r.is_returned === true) return "returned";
  if (r.missing_address === true) return "missing";
  return "success";
}
function normalizeReason(note: string | null): string {
  const n = (note || "").trim().toLocaleUpperCase("tr-TR").split(/\s+[—-]\s+/)[0].trim();
  if (!n) return "SEBEP BELİRTİLMEMİŞ";
  if (/TELEFON|İLETİŞİM|NUMARA YANLIŞ/.test(n)) return "TELEFON / İLETİŞİM";
  if (/MAHALLE|MAH\./.test(n)) return "MAHALLE BİLGİSİ";
  if (/APARTMAN|KAPI|DAİRE/.test(n)) return "APARTMAN / KAPI";
  if (/POSTA KODU/.test(n)) return "POSTA KODU";
  if (/İLÇE|ILÇE|İL \/ İLÇE/.test(n)) return "İL / İLÇE";
  if (/SOKAK/.test(n)) return "SOKAK BİLGİSİ";
  if (/ADRES/.test(n)) return "ADRES BİLGİSİ";
  if (/İADE|TESLİMAT|KABUL ETMEDİ|İPTAL/.test(n)) return "İADE / TESLİMAT";
  return "DİĞER";
}

async function getAuthorizedAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey) throw new Error("Supabase sunucu ayarları eksik.");
  const cookieJar = await cookies();
  const auth = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => cookieJar.getAll(),
      setAll: (values) => {
        try { values.forEach(({ name, value, options }) => cookieJar.set(name, value, options)); } catch { /* read-only context */ }
      },
    },
  });
  const { data: userData, error: authError } = await auth.auth.getUser();
  if (authError || !userData.user) throw new Error("Oturum doğrulanamadı.");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (error || !profile) throw new Error("Kullanıcı rolü alınamadı.");
  const role = String(profile.role || "").toUpperCase();
  if (!["DEVELOPER", "ADMIN", "ADMNWH", "WAREHOUSE", "STOREMNG"].includes(role)) {
    throw new Error("Performans verilerini görüntüleme yetkiniz bulunmuyor.");
  }
  return admin;
}

async function fetchAll(admin: Awaited<ReturnType<typeof getAuthorizedAdmin>>, start?: string, end?: string): Promise<Row[]> {
  const result: Row[] = [];
  const chunk = 1000;
  for (let offset = 0; ; offset += chunk) {
    let q = admin.from("cargo_records")
      .select("id,created_at,delivery_number,sd_document,missing_address,is_returned,aras_tracking_number,note")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + chunk - 1);
    if (start) q = q.gte("created_at", start);
    if (end) q = q.lt("created_at", end);
    const { data, error } = await q;
    if (error) throw new Error(`cargo_records okunamadı: ${error.message}`);
    const rows = (data || []) as Row[];
    result.push(...rows);
    if (rows.length < chunk) break;
    if (result.length > 250000) throw new Error("Analiz için kayıt sınırı aşıldı; daha kısa tarih aralığı seçin.");
  }
  return result;
}

function keyOf(r: Row) {
  // Empty SD document must not collapse different deliveries.
  return `${r.delivery_number || r.id}\u0000${r.sd_document || ""}`;
}
function latest(rows: Row[]): Row[] {
  const found = new Map<string, Row>();
  // Rows are sorted ascending by created_at+id: latest row wins.
  for (const row of rows) found.set(keyOf(row), row);
  return Array.from(found.values());
}
function counts(rows: Row[]) {
  const cur = latest(rows);
  return {
    records: rows.length,
    uniqueShipments: cur.length,
    success: cur.filter((r) => status(r) === "success").length,
    missing: cur.filter((r) => status(r) === "missing").length,
    returned: cur.filter((r) => status(r) === "returned").length,
    duplicates: rows.length - cur.length,
  };
}

export async function getCargoPerformance(startDate: string, endDate: string): Promise<CargoAnalyticsResponse> {
  try {
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) throw new Error("Tarih formatı YYYY-MM-DD olmalı.");
    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    const endMs = Date.parse(`${endDate}T00:00:00Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) throw new Error("Geçersiz tarih aralığı.");
    if ((endMs - startMs) / DAY_MS > 366) throw new Error("En fazla 367 günlük aralık seçebilirsiniz.");
    const admin = await getAuthorizedAdmin();
    // Tarih filtresini sorguya uygula: önce bütün geçmişi indirip tarama.
    const begin = `${startDate}T00:00:00+03:00`;
    const afterEnd = new Date(endMs + DAY_MS).toISOString().slice(0, 10) + "T00:00:00+03:00";
    const filtered = await fetchAll(admin, new Date(begin).toISOString(), new Date(afterEnd).toISOString());
    const globalBase = counts(filtered);
    const today = dayISO(new Date());
    const global = { ...globalBase, today: latest(filtered.filter((r) => dayISO(new Date(r.created_at)) === today)).length };
    const base = counts(filtered);
    const current = latest(filtered);
    const dates = new Map<string, { rows: Row[]; earliest: number; latest: number }>();
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, success: 0, missing: 0, returned: 0 }));
    const weekday = Array.from({ length: 7 }, (_, day) => ({ day, count: 0 }));
    for (const r of filtered) {
      const d = new Date(r.created_at);
      const date = dayISO(d);
      const millis = d.getTime();
      const bucket = dates.get(date) || { rows: [], earliest: millis, latest: millis };
      bucket.rows.push(r);
      bucket.earliest = Math.min(bucket.earliest, millis);
      bucket.latest = Math.max(bucket.latest, millis);
      dates.set(date, bucket);
      const hour = hourTR(d);
      hourly[hour].count += 1;
      hourly[hour][status(r)] += 1;
      weekday[new Date(`${date}T12:00:00Z`).getUTCDay()].count += 1;
    }
    const daily: CargoDaily[] = [];
    for (let t = startMs; t <= endMs; t += DAY_MS) {
      const date = new Date(t).toISOString().slice(0, 10);
      const bucket = dates.get(date);
      if (!bucket) {
        daily.push({ date, count: 0, success: 0, missing: 0, returned: 0, unique: 0, first_time: "—", last_time: "—" });
        continue;
      }
      const ds = counts(bucket.rows);
      daily.push({ date, count: bucket.rows.length,
        success: bucket.rows.filter((r) => status(r) === "success").length,
        missing: bucket.rows.filter((r) => status(r) === "missing").length,
        returned: bucket.rows.filter((r) => status(r) === "returned").length,
        unique: ds.uniqueShipments,
        first_time: timeTR(new Date(bucket.earliest)), last_time: timeTR(new Date(bucket.latest)) });
    }
    const reasons = new Map<string, number>();
    for (const r of current) {
      if (status(r) === "success") continue;
      const reason = normalizeReason(r.note || (r.aras_tracking_number && !/^[A-Z0-9]+$/i.test(r.aras_tracking_number) ? r.aras_tracking_number : null));
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }
    const activeDays = daily.filter((d) => d.count > 0).length;
    const peak = daily.reduce<CargoDaily | null>((best, item) => !best || item.count > best.count ? item : best, null);
    return {
      success: true, period: { start: startDate, end: endDate }, global,
      overview: { ...base, activeDays, averageDaily: Math.round((base.records / Math.max(daily.length, 1)) * 10) / 10,
        peakDay: peak && peak.count > 0 ? peak.date : null, peakCount: peak?.count || 0,
        successRate: base.uniqueShipments ? Math.round((base.success / base.uniqueShipments) * 1000) / 10 : 0 },
      daily, hourly, weekday,
      reasons: Array.from(reasons, ([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Analiz yüklenemedi." };
  }
}
