"use client";

import { BoxSelect, Building2, Info, LogIn, LogOut, User } from "lucide-react";

export interface PutawayLogData {
  id: string;
  action_type: string;
  description: string;
  employee_name: string;
  branch_name?: string;
  created_at?: string;
}

export function WarehouseLogsSection({ recentPutawayLogs }: { recentPutawayLogs: PutawayLogData[] }) {
  return (
    <section className="lg:col-span-5 flex h-[480px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
        <div className="rounded-md border border-slate-200 bg-white p-2 text-[#dc3545]"><BoxSelect size={19} /></div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black uppercase tracking-wider text-slate-800">Depo Operasyon Logları</h3>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Raf · Stok · Giriş/Çıkış Hareketleri</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {recentPutawayLogs.length === 0 ? (
          <div className="p-10 text-center text-xs font-semibold text-slate-400">Henüz depo işlemi bulunmuyor.</div>
        ) : recentPutawayLogs.map((log) => {
          const status = (log.action_type || "").toUpperCase();
          const isIn = /INBOUND|PUTAWAY|ADD|GIRIS/.test(status);
          const isOut = /OUTBOUND|PICKING|REMOVE|CIKIS/.test(status);
          const tag = isIn ? "GİRİŞ (+)" : isOut ? "ÇIKIŞ (-)" : "SİSTEM";
          const style = isIn ? "border-emerald-200 bg-emerald-50 text-emerald-700" : isOut ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700";
          return (
            <article key={log.id} className="flex gap-3 border-b border-slate-100 px-3 py-3 transition hover:bg-slate-50">
              <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded border " + style}>
                {isIn ? <LogIn size={15} /> : isOut ? <LogOut size={15} /> : <Info size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1 font-bold text-slate-900">
                    <User size={12} className="shrink-0 text-slate-400" /><span className="truncate text-[11px]">{log.employee_name || "Sistem"}</span>
                  </div>
                  <span className={"rounded-sm border px-1.5 py-0.5 text-[9px] font-black " + style}>{tag}</span>
                </div>
                <p title={log.description || ""} className="mt-1.5 line-clamp-2 break-words text-[11px] leading-relaxed text-slate-600">{log.description || "İşlem detayı bulunmuyor"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-400">
                  {log.branch_name && <span className="inline-flex items-center gap-1"><Building2 size={11} />{log.branch_name}</span>}
                  {log.created_at && <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
