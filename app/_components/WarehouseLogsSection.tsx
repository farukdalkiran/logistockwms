"use client";

import { useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BoxSelect, Building2, ChevronDown,
  ChevronUp, Clock3, FileSpreadsheet, History, Layers3, MapPin, PackagePlus,
  PackageSearch, UserRound,
} from "lucide-react";

export interface PutawayLogData {
  id: string;
  action_type: string;
  description: string;
  employee_name: string;
  branch_name?: string;
  created_at?: string;
}

type LogKind = "box" | "shelf" | "inbound" | "outbound" | "transfer" | "other";

function classifyLog(actionType: string): LogKind {
  const action = (actionType || "").toUpperCase();
  if (action.includes("BOX") || action.includes("KOLI")) return "box";
  if (action.includes("PUTAWAY") || action.includes("SHELF") || action.includes("RAFL")) return "shelf";
  if (action.includes("TRANSFER") || action.includes("SEVKIYAT")) return "transfer";
  if (/OUTBOUND|PICKING|REMOVE|CIKIS|STOCK_OUT/.test(action)) return "outbound";
  if (/INBOUND|STOCK_IN|ADD|GIRIS/.test(action)) return "inbound";
  return "other";
}

const kindMeta = {
  box: { label: "KOLİ", title: "Koli işlemi", icon: PackagePlus, iconClass: "bg-indigo-50 text-indigo-600 border-indigo-100", tagClass: "bg-indigo-50 text-indigo-700 border-indigo-200", accent: "bg-indigo-400" },
  shelf: { label: "RAFLAMA", title: "Raf yerleştirme", icon: Layers3, iconClass: "bg-amber-50 text-amber-600 border-amber-100", tagClass: "bg-amber-50 text-amber-700 border-amber-200", accent: "bg-amber-400" },
  inbound: { label: "GİRİŞ", title: "Stok girişi", icon: ArrowDownLeft, iconClass: "bg-emerald-50 text-emerald-600 border-emerald-100", tagClass: "bg-emerald-50 text-emerald-700 border-emerald-200", accent: "bg-emerald-400" },
  outbound: { label: "ÇIKIŞ", title: "Stok çıkışı", icon: ArrowUpRight, iconClass: "bg-rose-50 text-rose-600 border-rose-100", tagClass: "bg-rose-50 text-rose-700 border-rose-200", accent: "bg-rose-400" },
  transfer: { label: "TRANSFER", title: "Transfer hareketi", icon: ArrowUpRight, iconClass: "bg-sky-50 text-sky-600 border-sky-100", tagClass: "bg-sky-50 text-sky-700 border-sky-200", accent: "bg-sky-400" },
  other: { label: "İŞLEM", title: "Depo hareketi", icon: Activity, iconClass: "bg-slate-100 text-slate-600 border-slate-200", tagClass: "bg-slate-50 text-slate-600 border-slate-200", accent: "bg-slate-400" },
} as const;

function logDetails(log: PutawayLogData, kind: LogKind) {
  const description = log.description || "İşlem detayı bulunmuyor.";
  if (kind === "box") {
    const count = description.match(/(?:Excel'den|Excel’den)\s+(\d+)\s+yeni koli/i);
    const session = description.match(/Oturum:\s*([a-f\d-]{30,})/i);
    return {
      title: /BULK|EXCEL|TOPLU/i.test(log.action_type) ? "Toplu koli kaydı" : "Koli kaydı",
      detail: count ? `Excel dosyasından ${Number(count[1]).toLocaleString("tr-TR")} yeni koli sisteme eklendi.` : description,
      extra: count ? `${Number(count[1]).toLocaleString("tr-TR")} koli` : null,
      raw: session ? description : null,
    };
  }
  if (kind === "shelf") {
    const match = description.match(/RAFLAMA:\s*(\d+)\s+ADET\s*\[([^\]]+)\]\s*->\s*RAF:\s*([^\(]+)/i);
    if (match) {
      const product = match[2].replace(/^\d+\s*-\s*/, "").trim();
      return {
        title: "Ürün rafa yerleştirildi",
        detail: product || match[2].trim(),
        extra: `${match[1]} adet · ${match[3].trim()}`,
        raw: description,
      };
    }
  }
  if (kind === "transfer") {
    const code = description.match(/\bLGS\s*\d+\b/i)?.[0];
    const completed = /COMPLETE|TAMAMLAN|ÇIKIŞ TAMAM/i.test(log.action_type + " " + description);
    const created = /CREATED|OLUŞTURUL/i.test(log.action_type + " " + description);
    return {
      title: completed ? "Transfer çıkışı tamamlandı" : created ? "Transfer listesi oluşturuldu" : "Transfer hareketi",
      detail: description,
      extra: code ? code.replace(/\s/g, "") : null,
      raw: null,
    };
  }
  return { title: kindMeta[kind].title, detail: description, extra: null, raw: null };
}

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "short" }),
    time: date.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }),
  };
}

export function WarehouseLogsSection({ recentPutawayLogs, fullWidth = false }: { recentPutawayLogs: PutawayLogData[]; fullWidth?: boolean }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const logs = recentPutawayLogs || [];
  const boxCount = logs.filter((log) => classifyLog(log.action_type) === "box").length;
  const shelfCount = logs.filter((log) => classifyLog(log.action_type) === "shelf").length;

  return (
    <section className={(fullWidth ? "lg:col-span-12 " : "lg:col-span-5 ") + "flex h-[480px] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-900 text-white shadow-sm">
              <BoxSelect size={19} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black tracking-tight text-slate-900">Depo Operasyon Logları</h3>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">Raf · Stok · Giriş/Çıkış Hareketleri</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600">
            <History size={12} /> Son {logs.length} kayıt
          </span>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
            <PackagePlus size={12} className="text-indigo-600" /> {boxCount} koli işlemi
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
            <Layers3 size={12} className="text-amber-600" /> {shelfCount} raf hareketi
          </span>
        </div>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-400"><PackageSearch size={24} /></div>
            <p className="text-sm font-bold text-slate-700">Henüz depo hareketi yok</p>
            <p className="max-w-xs text-[11px] leading-relaxed text-slate-400">Koli, raf ve stok işlemleri gerçekleştirildikçe burada listelenir.</p>
          </div>
        ) : logs.map((log) => {
          const kind = classifyLog(log.action_type);
          const meta = kindMeta[kind];
          const Icon = meta.icon;
          const details = logDetails(log, kind);
          const date = formatDate(log.created_at);
          const expanded = expandedIds.includes(log.id);
          return (
            <article key={log.id} className="group relative border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-slate-50/80 last:border-0">
              <span className={`absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full ${meta.accent}`} aria-hidden="true" />
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.iconClass}`}>
                  <Icon size={17} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold leading-5 text-slate-800">{details.title}</h4>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
                        <span className="inline-flex min-w-0 items-center gap-1"><UserRound size={11} className="shrink-0" /><span className="truncate font-semibold text-slate-500">{log.employee_name || "Sistem"}</span></span>
                        {date && <time dateTime={log.created_at} className="inline-flex shrink-0 items-center gap-1"><Clock3 size={11} />{date.day} · {date.time}</time>}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${meta.tagClass}`}>{meta.label}</span>
                  </div>
                  <p className="mt-2 break-words text-[11px] leading-[1.55] text-slate-600">{details.detail}</p>
                  {(details.extra || log.branch_name) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {details.extra && <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-700"><MapPin size={11} className="text-slate-400" />{details.extra}</span>}
                      {log.branch_name && <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500"><Building2 size={11} />{log.branch_name}</span>}
                    </div>
                  )}
                  {details.raw && details.raw !== details.detail && (
                    <div className="mt-2">
                      <button type="button" aria-expanded={expanded} onClick={() => setExpandedIds((prev) => expanded ? prev.filter((id) => id !== log.id) : [...prev, log.id])} className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800">
                        <FileSpreadsheet size={11} /> {expanded ? "Ham kaydı gizle" : "İşlem detayını gör"} {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {expanded && <p className="mt-2 break-all rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-500">{details.raw}</p>}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-medium text-slate-400">
        <span className="inline-flex items-center gap-1.5"><Activity size={12} /> En güncel işlemler üstte gösterilir</span>
      </div>
    </section>
  );
}
