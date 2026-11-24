"use client";

import {
  Activity, ArrowDownLeft, ArrowUpRight, Building2, Clock3, Layers3,
  Package, Truck, UserRound, FileSpreadsheet,
} from "lucide-react";

export interface PutawayLogData {
  id: string;
  action_type: string;
  description: string;
  employee_name: string;
  branch_name?: string;
  created_at?: string;
}

export type OperationKind = "shelf" | "transfer" | "box" | "inbound" | "outbound" | "report" | "other";

export function classifyOperationType(actionType: string): OperationKind {
  const action = (actionType || "").toUpperCase();
  if (action === "TRANSFER_EXCEL_EXPORT") return "report";
  if (/BOX|KOLI/.test(action)) return "box";
  if (/PUTAWAY|SHELF|RAFL/.test(action)) return "shelf";
  if (/TRANSFER|SEVKIYAT|SCAN_COMPLETED/.test(action)) return "transfer";
  if (/OUTBOUND|PICKING|REMOVE|CIKIS|STOCK_OUT/.test(action)) return "outbound";
  if (/INBOUND|STOCK_IN|ADD|GIRIS/.test(action)) return "inbound";
  return "other";
}

export const operationMeta = {
  report: { label: "Excel çıktısı", icon: FileSpreadsheet, color: "text-emerald-700", bg: "bg-emerald-100", accent: "bg-emerald-500" },
  shelf: { label: "Raflama", icon: Layers3, color: "text-amber-700", bg: "bg-amber-50", accent: "bg-amber-400" },
  transfer: { label: "Transfer", icon: Truck, color: "text-sky-700", bg: "bg-sky-50", accent: "bg-sky-400" },
  box: { label: "Koli", icon: Package, color: "text-indigo-700", bg: "bg-indigo-50", accent: "bg-indigo-400" },
  inbound: { label: "Giriş", icon: ArrowDownLeft, color: "text-emerald-700", bg: "bg-emerald-50", accent: "bg-emerald-400" },
  outbound: { label: "Çıkış", icon: ArrowUpRight, color: "text-rose-700", bg: "bg-rose-50", accent: "bg-rose-400" },
  other: { label: "İşlem", icon: Activity, color: "text-slate-600", bg: "bg-slate-100", accent: "bg-slate-400" },
} as const;

function readableDescription(log: PutawayLogData) {
  const description = log.description || "İşlem açıklaması bulunmuyor.";
  const shelf = description.match(/RAFLAMA:\s*(\d+)\s+ADET\s*\[([^\]]+)\]\s*->\s*RAF:\s*([^\(]+)/i);
  if (shelf) {
    const product = shelf[2].replace(/^\d+\s*-\s*/, "").trim();
    return `${shelf[1]} adet · ${product} → ${shelf[3].trim()}`;
  }
  const picking = description.match(/KALDIRMA:\s*(\d+)\s+ADET\s*\[([^\]]+)\]\s*<-\s*RAF:\s*([^\|\(]+)/i);
  if (picking) {
    const product = picking[2].replace(/^\d+\s*-\s*/, "").trim();
    return `${picking[1]} adet · ${product} ← ${picking[3].trim()}`;
  }
  return description;
}

function formattedMoment(value?: string) {
  if (!value) return { time: "—", day: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { time: "—", day: "" };
  return {
    time: date.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }),
    day: date.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "short" }),
  };
}

export function WarehouseLogsSection({ recentPutawayLogs }: { recentPutawayLogs: PutawayLogData[] }) {
  const logs = recentPutawayLogs || [];

  return (
    <section aria-labelledby="warehouse-feed-title" className="lg:col-span-8 min-w-0 overflow-hidden rounded-md border border-slate-200 border-l-[4px] border-l-[#dc3545] bg-white shadow-lg shadow-slate-200/70">
      <header className="relative overflow-hidden border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        {/* Hafif kırmızı renk hareketi yalnızca log panelinin sağ üstündedir. */}
        <span className="dashboard-feed-glow pointer-events-none absolute -right-4 -top-7 h-24 w-56" aria-hidden="true" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <h2 id="warehouse-feed-title" className="text-sm font-black text-slate-900">Depo Operasyon Akışı</h2>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">Son işlemler · saat, personel ve açıklama</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[10px] font-bold text-slate-600">
              Son {logs.length} kayıt
            </span>
          </div>
        </div>
      </header>

      <div
        className="custom-scrollbar h-[285px] overflow-y-auto overscroll-contain sm:h-[310px]"
      >
        {logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <Activity size={25} className="text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Henüz operasyon kaydı yok.</p>
          </div>
        ) : logs.map((log, index) => {
          const kind = classifyOperationType(log.action_type);
          const meta = operationMeta[kind];
          const Icon = meta.icon;
          const moment = formattedMoment(log.created_at);
          return (
            <article
              key={log.id}
              className={`group relative flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 px-3 py-2.5 last:border-0 sm:min-h-[49px] sm:flex-nowrap sm:px-5 ${kind === "report" ? "bg-emerald-50/80 hover:bg-emerald-100/70" : (index % 2 === 0 ? "bg-white hover:!bg-rose-50/40" : "bg-slate-50/80 hover:!bg-rose-50/40")}`}
            >
              <span className={`absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r ${meta.accent}`} aria-hidden="true" />
              <time dateTime={log.created_at} title={moment.day} className="flex w-[47px] shrink-0 items-center gap-1 font-mono text-[11px] font-bold tabular-nums text-slate-600 sm:w-[66px]">
                <Clock3 size={11} className="shrink-0 text-slate-400" />{moment.time}
              </time>
              <span className={`inline-flex w-[95px] shrink-0 items-center gap-1.5 text-[10px] font-extrabold ${meta.color}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.bg}`}><Icon size={13} /></span>
                {meta.label}
              </span>
              <p className={`order-3 w-full min-w-0 truncate text-[11px] font-semibold ${kind === "report" ? "text-emerald-800" : "text-slate-700"} sm:order-none sm:w-auto sm:flex-1 sm:text-xs`} title={log.description || ""}>
                {readableDescription(log)}
              </p>
              <span className="ml-auto flex min-w-0 max-w-[145px] shrink-0 items-center gap-1.5 text-[10px] font-bold text-slate-700 sm:ml-0 sm:w-[145px]">
                <UserRound size={12} className="shrink-0 text-slate-400" />
                <span className="truncate" title={log.employee_name}>{log.employee_name || "Sistem"}</span>
              </span>
              {log.branch_name && (
                <span title={log.branch_name} className="hidden min-w-0 shrink-0 items-center gap-1 text-[10px] text-slate-500 lg:flex lg:w-[115px]">
                  <Building2 size={11} className="shrink-0" /><span className="truncate">{log.branch_name}</span>
                </span>
              )}
            </article>
          );
        })}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-medium text-slate-500 sm:px-5">
        <span>En yeni işlemler yukarıda · Liste manuel kaydırılabilir</span>
        <span className="hidden sm:inline">Türkiye saati (UTC+3)</span>
      </footer>
    </section>
  );
}
