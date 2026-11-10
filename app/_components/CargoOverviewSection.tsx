"use client";

import { Activity, ArrowUpRight, Clock3, PackageCheck, Truck, UsersRound } from "lucide-react";
import type { CargoDistributionItem, CargoSessionData } from "./CargoDistributionSection";

type Props = {
  cargoDistribution: CargoDistributionItem[];
  recentCargoSessions: CargoSessionData[];
};

function timeOf(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CargoOverviewSection({ cargoDistribution, recentCargoSessions }: Props) {
  const total = cargoDistribution.reduce((sum, entry) => sum + entry.count, 0);
  const sessions = recentCargoSessions.length;
  const active = recentCargoSessions.filter((item) => item.status === "ACTIVE").length;
  const lastSession = recentCargoSessions[0];
  const metrics = [
    { label: "İşlenen kargo adedi", value: total, icon: PackageCheck, detail: "Bugünkü toplam adet", accent: "text-rose-600", bg: "bg-rose-50" },
    { label: "Kargo oturumu", value: sessions, icon: Activity, detail: "Bugün açılan seans", accent: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Kargo firması", value: cargoDistribution.length, icon: Truck, detail: "Bugün işlem yapılan", accent: "text-sky-600", bg: "bg-sky-50" },
    { label: "Aktif oturum", value: active, icon: UsersRound, detail: "Devam eden seans", accent: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <section aria-labelledby="cargo-overview-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dc3545] text-white shadow-sm shadow-red-200"><Truck size={22} /></span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#b42332]">Günlük operasyon</p>
            <h2 id="cargo-overview-title" className="text-lg font-black tracking-tight text-slate-900 md:text-xl">Kargo Adetleri ve Firma Dağılımı</h2>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
          <Clock3 size={14} /> Son kargo kaydı: {timeOf(lastSession?.started_at)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4 md:gap-4 md:p-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200 bg-[#fbfcfe] p-4 transition-colors hover:border-slate-300">
            <div className="flex items-center justify-between gap-2">
              <div className={"flex h-10 w-10 items-center justify-center rounded-xl " + metric.bg + " " + metric.accent}>
                <metric.icon size={20} />
              </div>
              <ArrowUpRight size={17} className="text-slate-300" />
            </div>
            <strong className="mt-4 block font-mono text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{metric.value.toLocaleString("tr-TR")}</strong>
            <p className="mt-1 text-xs font-extrabold text-slate-800">{metric.label}</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 border-t border-slate-100 lg:grid-cols-12">
        <div className="bg-[#101a2c] px-5 py-5 text-white md:px-6 lg:col-span-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Operasyon özeti</div>
          <div className="mt-3 text-4xl font-black tracking-tight">{total.toLocaleString("tr-TR")} <span className="text-base font-bold text-slate-400">adet</span></div>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-300">
            Bugün oluşturulan kargo oturumlarında kaydedilen toplam ürün / gönderi adedi.
          </p>
          <div className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Saat dilimi: Türkiye
          </div>
        </div>
        <div className="p-5 md:px-6 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Firmalara göre adet</h3>
            <span className="text-[11px] font-bold text-slate-400">{cargoDistribution.length} firma</span>
          </div>
          {cargoDistribution.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {cargoDistribution.map((item) => {
                const ratio = total > 0 ? (item.count / total) * 100 : 0;
                return (
                  <div key={item.carrier} className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-slate-700">{item.carrier}</span>
                      <span className="shrink-0 font-mono text-sm font-black text-slate-900">{item.count.toLocaleString("tr-TR")}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: ratio + "%", backgroundColor: item.color }} />
                    </div>
                    <span className="mt-1 block text-right text-[10px] font-bold text-slate-400">%{ratio.toFixed(1).replace(".", ",")}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-xs font-medium text-slate-500">
              Bugün henüz kargo kaydı bulunmuyor.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
