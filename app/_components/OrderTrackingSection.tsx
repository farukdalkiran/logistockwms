"use client";

import Link from "next/link";
import { ArrowUpRight, BellRing, Boxes, CheckCircle2, Clock3, RefreshCw, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { useOrderNotifications } from "@/components/providers/OrderNotificationProvider";
import { kindLabel, statusLabel } from "@/lib/order-approvals/types";

const approvalUrl = "/management/orders/approvals";

function shortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

export function OrderTrackingSection() {
  const {
    orders, metrics, loading, refreshing, error, canRead,
    soundEnabled, audioUnlocked, refresh, toggleSound, testSound, unlockSound,
  } = useOrderNotifications();

  // Gönderilmiş, reddedilmiş ve tamamlanmış siparişleri bu canlı listede gösterme.
  const activeOrders = orders
    .filter((order) => order.status === "PENDING" || order.status === "PREPARING")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <section
      aria-label="Mağaza sipariş takibi"
      className="lg:col-span-7 flex h-[480px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
    >
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[#dc3545]">
              <ShoppingBag size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-black leading-tight text-slate-900">Mağaza Sipariş Takibi</h3>
              <p className="mt-1 text-[10px] font-semibold tracking-[0.03em] text-slate-500">
                CANLI OPERASYON · ÜRÜN & SARF TALEPLERİ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-extrabold text-emerald-700 sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Canlı
            </span>
            <button
              type="button" aria-label="Siparişleri yenile" title="Siparişleri yenile"
              onClick={refresh} disabled={loading || refreshing}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <Link href={approvalUrl}
              className="inline-flex h-8 items-center gap-1 rounded bg-[#dc3545] px-3 text-[10px] font-extrabold text-white transition hover:bg-[#ba2b3b]">
              <span className="hidden sm:inline">Sipariş Merkezi</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
            <BellRing size={13} className="text-amber-600" />
            Bekleyen <strong className="font-mono text-slate-900">{canRead ? metrics.pending : "—"}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
            <Boxes size={13} className="text-blue-600" />
            Hazırlanan <strong className="font-mono text-slate-900">{canRead ? metrics.preparing : "—"}</strong>
          </span>
        </div>
        <span className="text-[10px] font-semibold text-slate-500">
          {canRead ? activeOrders.length + " kayıt listeleniyor" : "Yükleniyor"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-white custom-scrollbar">
        {error && (
          <div role="alert" className="m-3 rounded border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            Sipariş verisi alınamadı: {error}
          </div>
        )}
        {loading && !canRead && !error && (
          <div role="status" className="flex flex-col items-center gap-2 py-12 text-xs font-semibold text-slate-500">
            <RefreshCw size={18} className="animate-spin text-slate-400" /> Talepler yükleniyor…
          </div>
        )}
        {!loading && canRead && activeOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <CheckCircle2 size={27} className="text-emerald-600" />
            <strong className="text-xs font-extrabold text-slate-800">İşlem bekleyen sipariş yok</strong>
            <p className="text-[11px] text-slate-500">Yeni ürün ve sarf talepleri burada listelenecek.</p>
          </div>
        )}

        {canRead && activeOrders.length > 0 && (
          <table className="w-full min-w-[680px] table-fixed border-collapse text-left" aria-label="İşlem bekleyen mağaza siparişleri">
            <colgroup>
              <col style={{ width: "21%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
              <tr className="text-[10px] font-extrabold uppercase tracking-[0.035em] text-slate-500">
                <th scope="col" className="px-3 py-2.5">Sipariş</th>
                <th scope="col" className="px-2 py-2.5">Talep Eden Mağaza</th>
                <th scope="col" className="px-2 py-2.5">Tür</th>
                <th scope="col" className="px-2 py-2.5 text-center">Adet</th>
                <th scope="col" className="px-2 py-2.5">Durum</th>
                <th scope="col" className="px-2 py-2.5">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeOrders.slice(0, 35).map((order) => {
                const waiting = order.status === "PENDING";
                return (
                  <tr key={order.id} className="h-[48px] bg-white transition-colors hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link
                        href={approvalUrl}
                        title={order.order_code + " siparişini incele"}
                        className="inline-flex max-w-full items-center gap-1 font-mono text-[11px] font-black text-slate-800 hover:text-[#dc3545] hover:underline"
                      >
                        <span className="truncate">{order.order_code}</span>
                        <ArrowUpRight size={12} className="shrink-0" />
                      </Link>
                      <span className="block text-[9px] font-medium text-slate-400">{order.item_count} kalem</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="block truncate text-[11px] font-bold text-slate-800" title={order.branch_name}>
                        {order.branch_name || "Mağaza belirtilmemiş"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                        <span className={
                          "h-1.5 w-1.5 shrink-0 rounded-full " +
                          (order.has_consumable ? "bg-orange-500" : "bg-indigo-500")
                        } />
                        {kindLabel(order)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-[11px] font-bold text-slate-800">
                      {order.requested_total.toLocaleString("tr-TR")}
                    </td>
                    <td className="px-2 py-2">
                      <span className={
                        "inline-flex whitespace-nowrap rounded border px-1.5 py-1 text-[9px] font-extrabold " +
                        (waiting
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-blue-200 bg-blue-50 text-blue-800")
                      }>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[10px] font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <Clock3 size={11} className="text-slate-400" />
                        {shortDate(order.created_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          15 saniyede otomatik güncellenir
        </span>
        <div className="flex items-center gap-2">
          {soundEnabled && audioUnlocked && (
            <button onClick={testSound} type="button"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-900">
              <Volume2 size={12} /> Test
            </button>
          )}
          {soundEnabled && !audioUnlocked && (
            <button onClick={unlockSound} type="button"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-[#dc3545]">
              <Volume2 size={12} /> Sesi etkinleştir
            </button>
          )}
          <button onClick={toggleSound} type="button"
            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50">
            {soundEnabled ? <VolumeX size={12} /> : <Volume2 size={12} />}
            {soundEnabled ? "Sesi kapat" : "Sesi aç"}
          </button>
        </div>
      </footer>
    </section>
  );
}
