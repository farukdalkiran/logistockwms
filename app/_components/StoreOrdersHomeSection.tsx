"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, RefreshCw, ShoppingBag, Truck } from "lucide-react";
import { getMyOrders } from "@/app/actions/my-orders";
import { DEFAULT_FILTERS, dateLabel, kindOf, quantity, statusOf, type ListResult } from "@/lib/my-orders/types";

const FILTER = { ...DEFAULT_FILTERS, pageSize: 10, sort: "newest" as const };
const HREF = "/management/orders/myorders";

export function StoreOrdersHomeSection() {
  const [result, setResult] = useState<ListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const response = await getMyOrders(FILTER);
      if (!alive.current) return;
      if (!response.ok) throw new Error(response.error);
      setResult(response.data);
      setError(null);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Siparişler okunamadı.");
    } finally {
      busy.current = false;
      if (alive.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => { alive.current = false; window.clearInterval(interval); };
  }, [load]);

  const metrics = result?.metrics;
  return (
    <section aria-label="Mağazanın siparişleri"
      className="lg:col-span-7 flex h-[480px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[#dc3545]">
              <ShoppingBag size={18}/>
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-black leading-tight text-slate-900">Mağazamın Siparişleri</h3>
              <p className="mt-1 text-[10px] font-semibold tracking-wide text-slate-500">
                {result?.branch.name || "BAĞLI MAĞAZA"} · ÜRÜN & SARF TALEPLERİ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} disabled={refreshing}
              title="Yenile" aria-label="Siparişleri yenile"
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""}/>
            </button>
            <Link href={HREF} className="inline-flex h-8 items-center gap-1 rounded bg-[#dc3545] px-3 text-[10px] font-extrabold text-white hover:bg-[#b9283b]">
              Siparişlerim <ArrowUpRight size={14}/>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
          <Clock3 size={13} className="text-amber-600"/> Bekleyen
          <b className="font-mono text-slate-900">{metrics ? quantity(metrics.pending) : "—"}</b>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
          <Truck size={13} className="text-sky-600"/> Gönderiliyor
          <b className="font-mono text-slate-900">{metrics ? quantity(metrics.ready_to_ship) : "—"}</b>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
          <CheckCircle2 size={13} className="text-emerald-600"/> Tamamlanan
          <b className="font-mono text-slate-900">{metrics ? quantity(metrics.completed) : "—"}</b>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        {error && <p role="alert" className="m-3 rounded border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
        {loading && !result && !error && <p role="status" className="py-12 text-center text-xs text-slate-500">Siparişler yükleniyor…</p>}
        {!loading && result && result.rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 size={27} className="text-emerald-600"/>
            <strong className="text-xs font-black text-slate-800">Henüz sipariş bulunmuyor</strong>
            <p className="text-[11px] text-slate-500">Yalnızca bu mağazanın siparişleri burada listelenir.</p>
          </div>
        )}
        {result && result.rows.length > 0 && (
          <table aria-label="Mağaza sipariş listesi" className="w-full min-w-[575px] table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width:"23%" }}/><col style={{ width:"25%" }}/><col style={{ width:"12%" }}/>
              <col style={{ width:"24%" }}/><col style={{ width:"16%" }}/>
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-500">
              <tr>
                <th className="px-3 py-2.5">SİPARİŞ NO</th><th className="px-2 py-2.5">TÜR / KALEM</th>
                <th className="px-2 py-2.5 text-center">ADET</th><th className="px-2 py-2.5">DURUM</th>
                <th className="px-2 py-2.5">TARİH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map(o => {
                const status = statusOf(o.status);
                const tone = status.delivered
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : o.status === "READY_TO_SHIP"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : o.status === "PENDING"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-slate-50 text-slate-600";
                return (
                  <tr key={o.id} className="h-[49px] hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={HREF} className="inline-flex max-w-full items-center gap-1 font-mono text-[11px] font-black text-slate-800 hover:text-[#dc3545]">
                        <span className="truncate">{o.order_code}</span><ArrowUpRight size={12} className="shrink-0"/>
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      <span className="block truncate text-[10px] font-bold text-slate-700">{kindOf(o)}</span>
                      <span className="text-[9px] text-slate-400">{quantity(o.item_count)} kalem</span>
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-[11px] font-bold text-slate-800">{quantity(o.requested_total)}</td>
                    <td className="px-2 py-2">
                      <span className={"inline-flex rounded border px-1.5 py-1 text-[9px] font-extrabold " + tone}>{status.label}</span>
                    </td>
                    <td className="px-2 py-2 text-[10px] font-semibold text-slate-500">{dateLabel(o.created_at,true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
        <span className="text-[10px] font-semibold text-slate-500">
          {result ? quantity(result.count) + " mağaza siparişi" : "Şube siparişleri"} · 30 sn güncelleme
        </span>
        <Link href={HREF} className="text-[10px] font-extrabold text-[#dc3545] hover:underline">Tüm siparişlerim</Link>
      </footer>
    </section>
  );
}
