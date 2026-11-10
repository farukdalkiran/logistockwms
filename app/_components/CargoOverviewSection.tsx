"use client";

import { Activity, Box, Clock3, Truck, UsersRound } from "lucide-react";
import type { CargoDistributionItem, CargoSessionData } from "./CargoDistributionSection";

interface Props {
  cargoDistribution: CargoDistributionItem[];
  recentCargoSessions: CargoSessionData[];
}

function formatTime(value?: string | null) {
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
  const total = cargoDistribution.reduce((sum, item) => sum + item.count, 0);
  const active = recentCargoSessions.filter((item) => item.status === "ACTIVE").length;
  const metrics = [
    { label: "Kargo Adedi", value: total, icon: Box, accent: "text-[#dc3545]", bg: "bg-red-50" },
    { label: "Oturum", value: recentCargoSessions.length, icon: Activity, accent: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Firma", value: cargoDistribution.length, icon: Truck, accent: "text-blue-600", bg: "bg-blue-50" },
    { label: "Aktif", value: active, icon: UsersRound, accent: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <section aria-labelledby="cargo-overview-title" className="lg:col-span-4 flex h-[600px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#dc3545] text-white"><Truck size={20} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#b42332]">Günlük Operasyon</p>
            <h2 id="cargo-overview-title" className="truncate text-sm font-black text-slate-900">Kargo İstatistikleri</h2>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">Bugün</span>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-2.5 p-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
            <div className={"flex h-8 w-8 items-center justify-center rounded-lg " + metric.bg + " " + metric.accent}>
              <metric.icon size={17} />
            </div>
            <strong className="mt-2 block truncate font-mono text-2xl font-black text-slate-900">{metric.value.toLocaleString("tr-TR")}</strong>
            <span className="mt-1 block text-[11px] font-bold text-slate-500">{metric.label}</span>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100">
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Firma Dağılımı</h3>
          <span className="text-[10px] font-bold text-slate-400">{total.toLocaleString("tr-TR")} adet</span>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {cargoDistribution.length ? cargoDistribution.map((item) => {
            const percentage = total > 0 ? item.count / total * 100 : 0;
            return (
              <div key={item.carrier}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.carrier}</span>
                  </span>
                  <strong className="shrink-0 font-mono text-xs font-black text-slate-900">{item.count.toLocaleString("tr-TR")}</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: percentage + "%", backgroundColor: item.color }} />
                </div>
              </div>
            );
          }) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 p-5 text-center text-xs font-medium text-slate-400">
              Bugün için kargo kaydı bulunmuyor.
            </div>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5"><Clock3 size={14} /> Son kargo işlemi</span>
        <span className="font-mono font-bold text-slate-700">{formatTime(recentCargoSessions[0]?.started_at)}</span>
      </footer>
    </section>
  );
}
