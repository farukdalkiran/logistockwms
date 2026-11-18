"use client";

import { Activity, Bot, Clock3, Layers3, UsersRound } from "lucide-react";
import {
  classifyOperationType, operationMeta, type OperationKind, type PutawayLogData,
} from "./WarehouseLogsSection";

const kinds: OperationKind[] = ["shelf", "transfer", "outbound", "box", "inbound", "other"];

function timeLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit",
  });
}

export function OperationsPulseSection({ recentPutawayLogs }: { recentPutawayLogs: PutawayLogData[] }) {
  const logs = recentPutawayLogs || [];
  const counts = kinds.map((kind) => ({
    kind, ...operationMeta[kind], count: logs.filter((log) => classifyOperationType(log.action_type) === kind).length,
  })).filter((entry) => entry.count > 0);
  const operators = new Map<string, { name: string; count: number; lastSeen?: string }>();

  for (const log of logs) {
    const name = log.employee_name || "Sistem";
    const current = operators.get(name);
    if (current) {
      current.count += 1;
    } else {
      operators.set(name, { name, count: 1, lastSeen: log.created_at });
    }
  }

  const activeOperators = Array.from(operators.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const latestSystemEvent = logs.find((log) => (log.employee_name || "Sistem") === "Sistem");

  return (
    <section aria-labelledby="operations-pulse-title" className="lg:col-span-5 flex h-[600px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Activity size={19} />
          </span>
          <div className="min-w-0">
            <h2 id="operations-pulse-title" className="text-sm font-black tracking-tight text-slate-900">Operasyon Aktivite Özeti</h2>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">İşlem türleri ve ekip hareketleri</p>
          </div>
        </div>
        <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] font-bold text-slate-600">{logs.length} log</span>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-slate-100 px-4 pb-4 pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
              <Layers3 size={14} className="text-[#dc3545]" /> Hareket Dağılımı
            </h3>
            <span className="text-[10px] font-semibold text-slate-400">Son {logs.length} kayıt</span>
          </div>
          {counts.length ? (
            <div className="space-y-3">
              {counts.map(({ kind, label, icon: Icon, count, color, bg }) => {
                const percent = logs.length ? Math.round(count / logs.length * 100) : 0;
                return (
                  <div key={kind}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-2 font-bold text-slate-700">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${bg} ${color}`}><Icon size={13} /></span>
                        {label}
                      </span>
                      <span className="font-mono font-extrabold text-slate-700">{count} <span className="font-medium text-slate-400">/ %{percent}</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#dc3545]/75" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">Henüz hareket verisi bulunmuyor.</p>
          )}
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
              <UsersRound size={14} className="text-[#dc3545]" /> Son İşlem Yapanlar
            </h3>
            <span className="text-[10px] font-medium text-slate-400">Kayıt bazlı</span>
          </div>
          {activeOperators.length ? (
            <div className="space-y-1.5">
              {activeOperators.map((operator) => (
                <div key={operator.name} className="flex items-center gap-2.5 rounded-md border border-slate-100 bg-slate-50/70 px-2.5 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
                    {operator.name === "Sistem" ? <Bot size={17} /> : operator.name.trim().charAt(0).toLocaleUpperCase("tr-TR")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-extrabold text-slate-800" title={operator.name}>{operator.name}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Clock3 size={10} /> Son işlem {timeLabel(operator.lastSeen)}</span>
                  </div>
                  <strong className="shrink-0 rounded-md bg-white px-2 py-1 font-mono text-[10px] font-black text-slate-700 ring-1 ring-slate-200">{operator.count} kayıt</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-400">İşlem yapan personel bulunamadı.</p>
          )}
        </div>

        {latestSystemEvent && (
          <div className="mx-4 mb-4 rounded-md border border-slate-200 border-l-[3px] border-l-slate-500 bg-slate-50 px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black text-slate-700">
              <span className="inline-flex items-center gap-1.5"><Bot size={13} /> Son Sistem İşlemi</span>
              <time dateTime={latestSystemEvent.created_at} className="font-mono text-slate-500">{timeLabel(latestSystemEvent.created_at)}</time>
            </div>
            <p className="truncate text-[11px] leading-5 text-slate-600" title={latestSystemEvent.description}>{latestSystemEvent.description}</p>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-medium text-slate-500">
        <span>Bu özet yalnızca yukarıdaki son {logs.length} log kaydından hesaplanır.</span>
      </footer>
    </section>
  );
}
