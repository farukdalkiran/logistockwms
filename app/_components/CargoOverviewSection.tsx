"use client";

import { Activity, Clock3, PackageCheck, Truck, UsersRound } from "lucide-react";
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
    timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit",
  });
}

export function CargoOverviewSection({ cargoDistribution, recentCargoSessions }: Props) {
  const total = cargoDistribution.reduce((sum, item) => sum + item.count, 0);
  const active = recentCargoSessions.filter((item) => item.status === "ACTIVE").length;

  return (
    <section
      aria-labelledby="cargo-overview-title"
      className="lg:col-span-4 flex h-[600px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-200/70"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#dc3545] text-white">
            <Truck size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#b42332]">Günlük Operasyon</p>
            <h2 id="cargo-overview-title" className="truncate text-sm font-black text-slate-900">Kargo İstatistikleri</h2>
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500">Bugün</span>
      </header>

      {/* Tek odaklı özet: dört büyük sayaç yerine gerçek kargo adedi. */}
      <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-rose-50/80 via-white to-white px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              <PackageCheck size={14} className="text-[#dc3545]" /> Toplam Kargo Adedi
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <strong className="font-mono text-[32px] font-black leading-none tracking-tight text-slate-900 tabular-nums">
                {total.toLocaleString("tr-TR")}
              </strong>
              <span className="text-xs font-bold text-slate-500">adet</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 text-[10px] font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600">
              <Activity size={12} className="text-slate-400" />
              {recentCargoSessions.length} oturum
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {active} aktif
            </span>
          </div>
        </div>
      </div>

      {/* Dar alan kullanan firma özeti: teslim edenler listesine yer bırakır. */}
      <div className="shrink-0 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 px-4 pb-1.5 pt-2.5">
          <h3 className="text-[11px] font-black text-slate-700">Firma Dağılımı</h3>
          <span className="text-[10px] font-medium text-slate-400">{cargoDistribution.length} firma</span>
        </div>
        <div className="custom-scrollbar max-h-[112px] space-y-2 overflow-y-auto px-4 pb-3">
          {cargoDistribution.length ? cargoDistribution.map((item) => {
            const percentage = total > 0 ? item.count / total * 100 : 0;
            return (
              <div key={item.carrier}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 font-bold text-slate-600">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
                    <span className="truncate" title={item.carrier}>{item.carrier}</span>
                  </span>
                  <span className="shrink-0 font-mono font-black tabular-nums text-slate-800">{item.count.toLocaleString("tr-TR")}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
                </div>
              </div>
            );
          }) : (
            <p className="py-2 text-[11px] text-slate-400">Bugün için firma kaydı bulunmuyor.</p>
          )}
        </div>
      </div>

      {/* Kalan yüksekliğin tamamı kargoyu teslim eden personele ayrılır. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-black text-slate-800">
            <UsersRound size={15} className="text-[#dc3545]" /> Kargoyu Teslim Edenler
          </h3>
          <span className="shrink-0 text-[10px] font-semibold text-slate-500">{recentCargoSessions.length} oturum</span>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
          {recentCargoSessions.length ? recentCargoSessions.map((session) => (
            <article key={session.id} className="px-4 py-3 transition-colors hover:bg-slate-50">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs font-black text-slate-800" title={session.employee_name || "Personel belirtilmedi"}>
                  {session.employee_name || "Personel belirtilmedi"}
                </p>
                <time
                  dateTime={session.started_at}
                  title="Oturum başlangıcı ve bitişi (Türkiye saati)"
                  className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-slate-100 px-1.5 py-1 font-mono text-[10px] font-bold tabular-nums text-slate-600"
                >
                  <Clock3 size={11} className="text-slate-400" />
                  {formatTime(session.started_at)} – {session.completed_at ? formatTime(session.completed_at) : "Devam"}
                </time>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                <span className="min-w-0 max-w-full truncate font-medium text-slate-500" title={session.carrier_name || "Kargo firması belirtilmedi"}>
                  {session.carrier_name || "Firma belirtilmedi"}
                </span>
                <span className="font-mono font-black text-[#b42332]">{(session.total_items || 0).toLocaleString("tr-TR")} adet</span>
                {session.status === "ACTIVE" && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">Aktif</span>
                )}
              </div>
            </article>
          )) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
              Bugün kargoyu teslim eden personel kaydı bulunmuyor.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
