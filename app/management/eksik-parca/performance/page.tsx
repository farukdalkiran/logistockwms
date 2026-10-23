"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, CalendarDays, CheckCircle2, Clock3,
  Download, Gauge, Layers3, Loader2, Package, RefreshCw, RotateCcw,
  ShieldCheck, TrendingUp, Truck, Zap,
} from "lucide-react";
import { getCargoPerformance, type CargoAnalytics, type CargoDaily } from "@/app/actions/cargo-performance";

const PANEL = "relative overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_4px_22px_rgba(15,23,42,.04)]";
const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const todayTR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const pastDays = (days: number) => { const [y, m, d] = todayTR().split("-").map(Number); return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10); };
const fmtDay = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
const fmtFullDay = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function StatCard({ title, value, note, icon, tone }: { title: string; value: string; note: string; icon: React.ReactNode; tone: "blue" | "green" | "amber" | "rose" | "purple" | "slate" }) {
  const tones = {
    blue: "from-sky-500 to-cyan-400", green: "from-emerald-500 to-teal-400", amber: "from-amber-500 to-orange-400",
    rose: "from-rose-600 to-pink-500", purple: "from-violet-600 to-fuchsia-500", slate: "from-slate-700 to-slate-500",
  };
  return <div className={`${PANEL} group p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg sm:p-5`}>
    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tones[tone]}`} />
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs font-semibold text-slate-500 sm:text-sm">{title}</span>
      <span className={`rounded-lg bg-gradient-to-br ${tones[tone]} p-2 text-white shadow-sm`}>{icon}</span>
    </div>
    <div className="mt-3 break-all text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl tabular-nums">{value}</div>
    <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
  </div>;
}

function PanelTitle({ icon, title, subtitle, right }: { icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 sm:px-5">
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="rounded-md border border-indigo-100 bg-indigo-50 p-2 text-indigo-600">{icon}</span>
      <div><h3 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h3>{subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p>}</div>
    </div>{right}
  </div>;
}

function StackedGraph({ daily }: { daily: CargoDaily[] }) {
  const max = Math.max(1, ...daily.map((x) => x.count));
  return <div className="w-full overflow-x-auto pb-2">
    <div className="flex h-64 min-w-[580px] items-end gap-1.5 border-b border-slate-200 px-1 pt-7 sm:h-72 sm:gap-2">
      {daily.map((day) => <div key={day.date} title={`${fmtFullDay(day.date)} · ${day.count} işlem · ${day.success} başarılı / ${day.missing} eksik / ${day.returned} iade`} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
        <div className="absolute bottom-full z-20 mb-2 hidden min-w-44 rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-[11px] leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
          <strong>{fmtFullDay(day.date)}</strong><div>Toplam: {day.count}</div><div>Başarılı: {day.success} · Eksik: {day.missing} · İade: {day.returned}</div>
        </div>
        <div className="relative flex w-full max-w-11 flex-col justify-end overflow-hidden rounded-t-md bg-slate-100 transition-all duration-500 group-hover:brightness-110" style={{ height: `${Math.max(day.count ? 4 : 0, day.count / max * 85)}%` }}>
          {day.count > 0 && <>
            <div className="bg-gradient-to-t from-emerald-600 to-teal-400" style={{ height: `${(day.success / day.count) * 100}%` }} />
            <div className="bg-gradient-to-t from-amber-500 to-yellow-400" style={{ height: `${(day.missing / day.count) * 100}%` }} />
            <div className="bg-gradient-to-t from-rose-600 to-pink-400" style={{ height: `${(day.returned / day.count) * 100}%` }} />
          </>}
        </div>
        <span className="truncate text-center text-[10px] font-medium text-slate-500">{fmtDay(day.date)}</span>
      </div>)}
    </div>
  </div>;
}

const ROW_PILL = "inline-flex min-w-10 justify-center rounded-md border px-2 py-1 text-xs font-bold tabular-nums";

export default function TrackingPerformancePanel({ employeeId }: { employeeId?: string }) {
  const [startDate, setStartDate] = useState(() => pastDays(6));
  const [endDate, setEndDate] = useState(todayTR);
  const [data, setData] = useState<CargoAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [visible, setVisible] = useState(14);
  const validDates = startDate.length === 10 && endDate.length === 10 && startDate <= endDate;

  useEffect(() => {
    if (!validDates) { setError("Geçerli bir tarih aralığı seçin."); setData(null); return; }
    let cancelled = false;
    setLoading(true); setError("");
    void getCargoPerformance(startDate, endDate).then((res) => {
      if (cancelled) return;
      if (!res.success) { setError(res.error); setData(null); }
      else { setData(res); setVisible(14); }
    }).catch((err: unknown) => {
      if (!cancelled) { setError(err instanceof Error ? err.message : "Veri alınamadı."); setData(null); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate, reload, validDates]);

  const overview = data?.overview;
  const global = data?.global;
  const hourPeak = useMemo(() => data?.hourly.reduce((best, h) => h.count > best.count ? h : best, { hour: 0, count: 0 }) ?? null, [data]);
  const weekdays = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const filteredDaily = useMemo(() => [...(data?.daily ?? [])].reverse(), [data]);

  const setPreset = (days: number) => { setStartDate(pastDays(days - 1)); setEndDate(todayTR()); };
  const exportFile = useCallback(() => {
    if (!data?.daily.length) return;
    setExporting(true);
    try {
      const headings = ["Tarih", "Toplam İşlem", "Başarılı", "Eksik Adres", "İade", "Benzersiz Gönderi", "İlk İşlem", "Son İşlem"];
      const rows = data.daily.map((d) => [d.date, d.count, d.success, d.missing, d.returned, d.unique, d.first_time, d.last_time]);
      const content = "\uFEFF" + [headings, ...rows].map((row) => row.map(csv).join(";")).join("\r\n");
      const link = document.createElement("a"); const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
      link.href = url; link.download = `CARGO_PERFORMANS_${startDate}_${endDate}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally { setExporting(false); }
  }, [data, startDate, endDate]);

  return <main className="w-full space-y-5 pb-10 text-slate-900 sm:space-y-6">
    <style>{`@keyframes cargo-border-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.cargo-border-animated{animation:none!important}}.cargo-border-animated{animation:cargo-border-spin 9s linear infinite}`}</style>

    <header className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5 text-white shadow-xl sm:p-7">
      <div className="cargo-border-animated pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[28px] border-cyan-400/10 bg-blue-500/10 blur-xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-28 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-start gap-3"><span className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 p-3 text-cyan-300"><Activity className="h-6 w-6" /></span>
          <div><div className="mb-1 text-[11px] font-bold uppercase tracking-[.18em] text-cyan-300">WMS / Operasyon Analitiği</div>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-3xl">Kargo Performans Merkezi</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">cargo_records üzerinden doğrulanmış işlem hacmi, durum dağılımları, zaman analizi ve hata gerekçeleri.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> CANLI VERİ</span>
          {employeeId && <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">Personel: {employeeId}</span>}
          <button onClick={() => setReload((x) => x + 1)} className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"><RefreshCw className="h-4 w-4"/> Yenile</button>
        </div>
      </div>
    </header>

    <section className={`${PANEL} p-4 sm:p-5`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="h-4 w-4 text-indigo-600"/> Analiz Dönemi</p><p className="mt-1 text-xs text-slate-500">Tarih seçimi grafik, özet, tablo ve CSV çıktısını birlikte günceller.</p>
          <div className="mt-3 flex flex-wrap gap-2">{[7, 14, 30, 90].map((days) => <button key={days} onClick={() => setPreset(days)} className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100">Son {days} gün</button>)}</div>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[170px_170px_auto]">
          <label className="text-xs font-semibold text-slate-600">Başlangıç<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-semibold text-slate-600">Bitiş<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500" /></label>
          <button disabled={!data || loading || exporting} onClick={exportFile} className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-md bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:brightness-110 disabled:opacity-50"><Download className="h-4 w-4"/> CSV İndir</button>
        </div>
      </div>
    </section>

    {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="h-5 w-5 shrink-0" /> {error}</div>}
    {loading && <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800"><Loader2 className="h-4 w-4 animate-spin"/> cargo_records verileri analiz ediliyor...</div>}

    {data && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard title="Toplam işlem" value={fmt(overview?.records || 0)} note="Seçilen dönemdeki kayıtlar" icon={<Layers3 className="h-4 w-4"/>} tone="blue" />
        <StatCard title="Benzersiz gönderi" value={fmt(overview?.uniqueShipments || 0)} note="Delivery + SD bazında" icon={<Package className="h-4 w-4"/>} tone="purple" />
        <StatCard title="Başarılı" value={fmt(overview?.success || 0)} note="Son durum: başarılı" icon={<CheckCircle2 className="h-4 w-4"/>} tone="green" />
        <StatCard title="Eksik bilgi" value={fmt(overview?.missing || 0)} note="missing_address = true" icon={<AlertTriangle className="h-4 w-4"/>} tone="amber" />
        <StatCard title="İade" value={fmt(overview?.returned || 0)} note="is_returned = true" icon={<RotateCcw className="h-4 w-4"/>} tone="rose" />
        <StatCard title="Başarı oranı" value={`%${fmt(overview?.successRate || 0)}`} note="Benzersiz gönderiler içinde" icon={<Gauge className="h-4 w-4"/>} tone="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${PANEL} p-5 lg:col-span-2`}>
          <p className="text-sm font-bold text-slate-800">Genel veri havuzu</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><p className="text-xs text-slate-500">Tüm işlem kayıtları</p><p className="mt-1 text-xl font-bold tabular-nums">{fmt(global?.records || 0)}</p></div>
            <div><p className="text-xs text-slate-500">Toplam benzersiz</p><p className="mt-1 text-xl font-bold tabular-nums">{fmt(global?.uniqueShipments || 0)}</p></div>
            <div><p className="text-xs text-slate-500">Bugün oluşturulan</p><p className="mt-1 text-xl font-bold text-blue-700 tabular-nums">{fmt(global?.today || 0)}</p></div>
            <div><p className="text-xs text-slate-500">Tekrarlı işlem farkı</p><p className="mt-1 text-xl font-bold text-amber-700 tabular-nums">{fmt(global?.duplicates || 0)}</p></div>
          </div>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {global && global.uniqueShipments > 0 && <>
              <div className="bg-gradient-to-r from-emerald-600 to-teal-400" style={{ width: `${global.success / global.uniqueShipments * 100}%` }} />
              <div className="bg-gradient-to-r from-amber-500 to-yellow-400" style={{ width: `${global.missing / global.uniqueShipments * 100}%` }} />
              <div className="bg-gradient-to-r from-rose-600 to-pink-400" style={{ width: `${global.returned / global.uniqueShipments * 100}%` }} />
            </>}
          </div>
          <p className="mt-2 text-xs text-slate-500">Genel dağılım: {fmt(global?.success || 0)} başarılı · {fmt(global?.missing || 0)} eksik · {fmt(global?.returned || 0)} iade</p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-indigo-300 bg-gradient-to-br from-indigo-700 via-blue-700 to-cyan-700 p-5 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full border-[25px] border-white/10" />
          <p className="flex items-center gap-2 text-sm font-bold text-indigo-100"><Zap className="h-4 w-4"/> Operasyon özeti</p>
          <div className="relative mt-5 grid grid-cols-2 gap-4">
            <div><div className="text-2xl font-black">{fmt(overview?.activeDays || 0)}</div><div className="text-xs text-indigo-100">Aktif gün</div></div>
            <div><div className="text-2xl font-black">{fmt(overview?.averageDaily || 0)}</div><div className="text-xs text-indigo-100">Günlük ortalama</div></div>
            <div><div className="text-2xl font-black">{fmt(overview?.peakCount || 0)}</div><div className="text-xs text-indigo-100">En yoğun gün adedi</div></div>
            <div><div className="text-base font-black">{overview?.peakDay ? fmtDay(overview.peakDay) : "—"}</div><div className="text-xs text-indigo-100">En yoğun gün</div></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <section className={PANEL}>
          <PanelTitle icon={<TrendingUp className="h-4 w-4"/>} title="Günlük işlem trendi" subtitle="Günlük olay/kayıt sayısı; renkler gönderi durumunu gösterir" right={<div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-teal-500"/>Başarılı</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-400"/>Eksik</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-500"/>İade</span></div>} />
          <div className="p-4 sm:p-5"><StackedGraph daily={data.daily}/><p className="mt-2 text-xs text-slate-500">Uzun tarih aralıklarında grafiği yatay kaydırabilirsin. Üzerine gelerek günlük ayrıntıyı görüntüle.</p></div>
        </section>
        <section className={PANEL}>
          <PanelTitle icon={<Clock3 className="h-4 w-4"/>} title="Saatlik yoğunluk" subtitle="Türkiye saatine göre 00:00–23:59" right={<span className="text-xs font-bold text-indigo-600">Zirve {hourPeak ? `${String(hourPeak.hour).padStart(2, "0")}:00` : "—"}</span>} />
          <div className="grid grid-cols-6 gap-2 p-4 sm:grid-cols-8 xl:grid-cols-6">
            {data.hourly.map((h) => { const max = Math.max(1, ...data.hourly.map((x) => x.count)); const alpha = h.count / max;
              return <div key={h.hour} title={`${String(h.hour).padStart(2, "0")}:00 · ${h.count} işlem`} className="rounded-md border border-indigo-100 p-1.5 text-center transition hover:-translate-y-0.5 hover:border-indigo-400" style={{ backgroundColor: `rgba(79,70,229,${.04 + alpha * .68})` }}><div className="text-[10px] font-bold text-slate-700">{String(h.hour).padStart(2, "0")}</div><div className="mt-1 text-xs font-extrabold text-slate-900">{h.count}</div></div>;
            })}
          </div>
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Renk yoğunluğu, ilgili saatte oluşan işlem hacmini temsil eder.</div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={PANEL}>
          <PanelTitle icon={<AlertTriangle className="h-4 w-4"/>} title="Eksik bilgi ve iade nedenleri" subtitle="Seçilen dönemdeki gönderilerin son durum açıklamaları" />
          <div className="space-y-3 p-4 sm:p-5">
            {data.reasons.length === 0 ? <p className="text-sm text-slate-500">Bu dönemde gerekçeli eksik bilgi veya iade bulunmuyor.</p> : data.reasons.slice(0, 9).map((r) => {
              const max = Math.max(1, data.reasons[0].count);
              return <div key={r.reason} className="space-y-1.5"><div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-700">{r.reason}</span><span className="font-bold tabular-nums">{fmt(r.count)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500 transition-all duration-700" style={{ width: `${r.count / max * 100}%` }} /></div></div>;
            })}
          </div>
        </section>
        <section className={PANEL}>
          <PanelTitle icon={<CalendarDays className="h-4 w-4"/>} title="Haftanın günlerine göre tempo" subtitle="Seçilen tarih aralığının gün bazlı dağılımı" />
          <div className="space-y-4 p-4 sm:p-5">{data.weekday.map((d) => {
            const max = Math.max(1, ...data.weekday.map((a) => a.count));
            return <div key={d.day} className="grid grid-cols-[84px_1fr_42px] items-center gap-3"><span className="text-xs font-semibold text-slate-600">{weekdays[d.day]}</span><div className="h-3 overflow-hidden rounded-md bg-slate-100"><div className="h-full rounded-md bg-gradient-to-r from-indigo-600 to-cyan-400 transition-all duration-700" style={{ width: `${d.count / max * 100}%` }} /></div><span className="text-right text-xs font-bold tabular-nums">{fmt(d.count)}</span></div>;
          })}</div>
        </section>
      </div>

      <section className={PANEL}>
        <PanelTitle icon={<Truck className="h-4 w-4"/>} title="Günlük operasyon dökümü" subtitle="CSV çıktısı bu tablodaki tarih aralığı ve sütunlardan oluşturulur" right={<span className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{data.daily.length} gün</span>}/>
        <div className="w-full overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Tarih</th><th className="px-3 py-3 text-center">İşlem</th><th className="px-3 py-3 text-center">Benzersiz</th><th className="px-3 py-3 text-center">Başarılı</th><th className="px-3 py-3 text-center">Eksik</th><th className="px-3 py-3 text-center">İade</th><th className="px-3 py-3 text-center">İlk / Son</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredDaily.slice(0, visible).map((d) => <tr key={d.date} className="transition-colors hover:bg-indigo-50/40"><td className="whitespace-nowrap px-4 py-3 font-semibold">{fmtFullDay(d.date)}</td><td className="px-3 py-3 text-center font-bold tabular-nums">{fmt(d.count)}</td><td className="px-3 py-3 text-center tabular-nums">{fmt(d.unique)}</td><td className="px-3 py-3 text-center"><span className={`${ROW_PILL} border-emerald-200 bg-emerald-50 text-emerald-700`}>{fmt(d.success)}</span></td><td className="px-3 py-3 text-center"><span className={`${ROW_PILL} border-amber-200 bg-amber-50 text-amber-700`}>{fmt(d.missing)}</span></td><td className="px-3 py-3 text-center"><span className={`${ROW_PILL} border-rose-200 bg-rose-50 text-rose-700`}>{fmt(d.returned)}</span></td><td className="whitespace-nowrap px-3 py-3 text-center text-xs text-slate-600">{d.first_time} / {d.last_time}</td></tr>)}</tbody></table></div>
        {visible < filteredDaily.length && <div className="border-t border-slate-200 p-3 text-center"><button onClick={() => setVisible((n) => n + 21)} className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100">Daha fazla gün göster</button></div>}
      </section>
      <footer className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-4 py-3 text-xs leading-5 text-slate-600"><ShieldCheck className="mr-1 inline h-4 w-4 text-indigo-600"/> Kaynak: <code>public.cargo_records</code>. Grafikler tüm işlem kayıtlarını; durum KPI’ları ise aynı Delivery Number + SD Document için en yeni kaydı esas alır. Başarılı durum, iki hata bayrağı da <code>true</code> olmayan kayıttır. Bu ekran personel bazlı hız veya iş süresi ölçmez; tabloda çalışan kimliği bulunmuyor.</footer>
    </>}
  </main>;
}
