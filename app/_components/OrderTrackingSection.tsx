"use client";

import Link from "next/link";
import {
  ArrowUpRight, BellRing, Boxes, CheckCircle2, Clock3, Package,
  RefreshCw, ShoppingBag, Truck, Volume2,
} from "lucide-react";
import { useOrderNotifications } from "@/components/providers/OrderNotificationProvider";
import { kindLabel, statusLabel, dateLabel } from "@/lib/order-approvals/types";

const statusColors: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  PREPARING: "border-blue-200 bg-blue-50 text-blue-700",
  READY_TO_SHIP: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

export function OrderTrackingSection() {
  const {
    orders, metrics, loading, refreshing, error, canRead,
    soundEnabled, audioUnlocked, refresh, testSound, unlockSound,
  } = useOrderNotifications();

  const sorted = [...orders].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <section className="lg:col-span-7 flex h-[480px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-700 bg-gradient-to-r from-slate-950 via-slate-900 to-[#301c28] px-4 py-3.5 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-red-400"><ShoppingBag size={20} /></div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black uppercase tracking-wider">Mağaza Sipariş Takibi</h3>
              <p className="mt-0.5 text-[10px] font-bold tracking-wider text-slate-400">CANLI OPERASYON · ÜRÜN & SARF TALEPLERİ</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" title="Siparişleri yenile" onClick={refresh} disabled={loading || refreshing}
              className="rounded-md border border-slate-600 p-2 text-slate-200 hover:bg-slate-700 disabled:opacity-50">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <Link href="/management/orders/approvals" className="inline-flex items-center gap-1 rounded-md border border-red-500 bg-[#dc3545] px-3 py-2 text-[10px] font-black uppercase tracking-wide hover:bg-red-700">
              <span className="hidden sm:inline">Tüm Siparişler</span><ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-200"><BellRing size={12} /> Bekleyen</span>
            <strong className="mt-1 block font-mono text-xl font-black text-white">{canRead ? metrics.pending : "—"}</strong>
          </div>
          <div className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-200"><Boxes size={12} /> Hazırlanan</span>
            <strong className="mt-1 block font-mono text-xl font-black text-white">{canRead ? metrics.preparing : "—"}</strong>
          </div>
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-200"><Truck size={12} /> Gönderim</span>
            <strong className="mt-1 block font-mono text-xl font-black text-white">{canRead ? metrics.ready_to_ship : "—"}</strong>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-3 custom-scrollbar">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">Sipariş verisi alınamadı: {error}</div>}
        {loading && !canRead && <p className="py-14 text-center text-xs font-semibold text-slate-400">Siparişler yükleniyor…</p>}
        {!loading && canRead && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-slate-400">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="text-xs font-black text-slate-700">Sipariş kuyruğu boş</p>
            <span className="text-[11px]">Yeni mağaza siparişleri burada gösterilecek.</span>
          </div>
        )}
        <div className="space-y-2">
          {canRead && sorted.slice(0, 20).map((order) => (
            <Link href="/management/orders/approvals" key={order.id}
              className={"group block rounded-md border bg-white p-3 shadow-sm transition hover:border-[#dc3545] hover:shadow-md " + (order.status === "PENDING" ? "border-amber-300" : "border-slate-200")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className={"rounded border p-2 " + (order.has_consumable ? "border-orange-200 bg-orange-50 text-orange-700" : "border-indigo-200 bg-indigo-50 text-indigo-700")}>
                    {order.has_consumable ? <Package size={15} /> : <ShoppingBag size={15} />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-black tracking-wide text-slate-900">{order.order_code}</div>
                    <div className="mt-0.5 truncate text-[11px] font-bold text-slate-700">{order.branch_name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      <span>{kindLabel(order)} talebi</span><span>·</span>
                      <span>{order.item_count} kalem</span><span>·</span>
                      <span className="font-black text-slate-700">{order.requested_total} adet</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={"rounded-sm border px-2 py-1 text-[9px] font-black uppercase tracking-wide " + (statusColors[order.status] ?? "border-slate-200 bg-slate-100 text-slate-600")}>
                    {statusLabel(order.status)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-400"><Clock3 size={11} />{dateLabel(order.created_at, true)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />15 sn kontrol · Son 50 kayıt</span>
        <button type="button" onClick={soundEnabled && audioUnlocked ? testSound : unlockSound}
          className="inline-flex items-center gap-1 text-slate-700 hover:text-[#dc3545]">
          <Volume2 size={13} />{soundEnabled && audioUnlocked ? "Sesi test et" : "Bildirim sesini etkinleştir"}
        </button>
      </div>
    </section>
  );
}
