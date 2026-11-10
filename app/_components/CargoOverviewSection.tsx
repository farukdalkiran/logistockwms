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
    <section aria-labelledby="cargo-overview-title" className="lg:col-span-4 flex h-[600px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
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
          <div key={metric.label} className="min-w-0 rounded-md border border-slate-200 bg-white p-3">
            <div className={"flex h-8 w-8 items-center justify-center rounded-lg " + metric.bg + " " + metric.accent}>
              <metric.icon size={17} />
            </div>
            <strong className="mt-2 block truncate font-mono text-2xl font-black text-slate-900">{metric.value.toLocaleString("tr-TR")}</strong>
            <span className="mt-1 block text-[11px] font-bold text-slate-500">{metric.label}</span>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 shrink-0 flex-col border-t border-slate-100">
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Firma Dağılımı</h3>
          <span className="text-[10px] font-bold text-slate-400">{total.toLocaleString("tr-TR")} adet</span>
        </div>
        <div className="custom-scrollbar max-h-[145px] shrink-0 space-y-3 overflow-y-auto px-4 pb-3">
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

      <div className="flex min-h-0 flex-1 flex-col border-t border-slate-200">
        <div className="flex shrink-0 items-center justify-between bg-slate-50 px-4 py-2.5">
          <h3 className="flex items-center gap-1.5 text-xs font-black text-slate-800"><UsersRound size={15} className="text-[#dc3545]" /> Kargoyu Teslim Edenler</h3>
          <span className="text-[10px] font-bold text-slate-500">{recentCargoSessions.length} oturum</span>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
          {recentCargoSessions.length ? recentCargoSessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-slate-800" title={session.employee_name || "Personel belirtilmedi"}>
                  {session.employee_name || "Personel belirtilmedi"}
                </p>
                <span className="block truncate text-[10px] font-medium text-slate-500">{session.carrier_name || "Kargo firması belirtilmedi"} · {(session.total_items || 0).toLocaleString("tr-TR")} adet</span>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] font-bold text-slate-700">
                <Clock3 size={12} className="text-slate-400" />
                {formatTime(session.started_at)} – {session.completed_at ? formatTime(session.completed_at) : "Devam ediyor"}
              </span>
            </div>
          )) : (
            <p className="p-5 text-center text-xs font-medium text-slate-400">Bugün için teslim kaydı bulunamadı.</p>
          )}
        </div>
      </div>
    </section>
  );
}
