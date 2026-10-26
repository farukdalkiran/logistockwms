"use client";

import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BellRing, Boxes, CheckCircle2,
  Clock3, Layers3, Package, RefreshCw, ShoppingBag,
  Volume2, VolumeX,
} from "lucide-react";
import { useOrderNotifications } from "@/components/providers/OrderNotificationProvider";
import { dateLabel, kindLabel, statusLabel } from "@/lib/order-approvals/types";

export function OrderTrackingSection() {
  const {
    orders, metrics, loading, refreshing, error, canRead,
    soundEnabled, audioUnlocked, refresh, toggleSound, testSound, unlockSound,
  } = useOrderNotifications();

  // Sevk edilen, tamamlanan ve reddedilen siparişler bu canlı panelde görünmez.
  const activeOrders = orders
    .filter((order) => order.status === "PENDING" || order.status === "PREPARING")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const activeTotal = metrics.pending + metrics.preparing;

  return (
    <section
      aria-label="Mağaza sipariş takibi"
      className="lg:col-span-7 flex h-[480px] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 border-t-[3px] border-t-[#dc3545] bg-white shadow-sm"
    >
      {/* Açık renkli ve canlı başlık */}
      <header className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-gradient-to-r from-white via-rose-50/70 to-amber-50/50 px-4 py-4">
        <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-rose-100/60 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-[#dc3545] shadow-sm">
              <ShoppingBag size={21} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-black tracking-tight text-slate-900 sm:text-[15px]">
                Mağaza Sipariş Takibi
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold text-slate-500">
                  Ürün ve sarf talepleri · Canlı operasyon
                </p>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  CANLI
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              title="Siparişleri yenile"
              aria-label="Siparişleri yenile"
              onClick={refresh}
              disabled={loading || refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-[#dc3545] disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <Link
              href="/management/orders/approvals"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#dc3545] px-3 text-[10px] font-black text-white shadow-sm transition hover:bg-[#bc2838]"
            >
              <span className="hidden sm:inline">Sipariş Merkezi</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="relative overflow-hidden rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-800">
              <BellRing size={13} /> Bekleyen
            </div>
            <div className="mt-1 font-mono text-[22px] font-black leading-none text-amber-900">
              {canRead ? metrics.pending : "—"}
            </div>
            <div className="absolute -bottom-3 -right-1 text-amber-200/50"><BellRing size={48} /></div>
          </div>
          <div className="relative overflow-hidden rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-blue-700">
              <Boxes size={13} /> Hazırlanan
            </div>
            <div className="mt-1 font-mono text-[22px] font-black leading-none text-blue-900">
              {canRead ? metrics.preparing : "—"}
            </div>
            <div className="absolute -bottom-3 -right-1 text-blue-200/50"><Boxes size={48} /></div>
          </div>
          <div className="relative overflow-hidden rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-rose-700">
              <Layers3 size={13} /> Aktif talep
            </div>
            <div className="mt-1 font-mono text-[22px] font-black leading-none text-rose-900">
              {canRead ? activeTotal : "—"}
            </div>
            <div className="absolute -bottom-3 -right-1 text-rose-200/50"><Layers3 size={48} /></div>
          </div>
        </div>
      </header>

      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-2.5">
        <span className="flex items-center gap-2 text-[11px] font-black text-slate-800">
          <span className="h-2 w-1 rounded bg-[#dc3545]" />
          İşlem Bekleyen Talepler
        </span>
        <span className="text-[10px] font-semibold text-slate-400">
          {canRead ? activeOrders.length + " kayıt gösteriliyor" : "Güncelleniyor"}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-3 custom-scrollbar">
        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            Sipariş verisi alınamadı: {error}
          </div>
        )}
        {loading && !canRead && !error && (
          <div role="status" className="py-12 text-center text-xs font-semibold text-slate-400">
            Aktif talepler yükleniyor…
          </div>
        )}
        {!loading && canRead && activeOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={26} />
            </span>
            <strong className="text-xs font-black text-slate-800">Bekleyen işlem bulunmuyor</strong>
            <p className="max-w-[230px] text-[11px] leading-relaxed text-slate-500">
              Yeni mağaza talepleri ve hazırlanan siparişler burada listelenecek.
            </p>
          </div>
        )}

        {canRead && activeOrders.slice(0, 20).map((order) => {
          const pending = order.status === "PENDING";
          const productLabel = kindLabel(order);
          return (
            <Link
              href="/management/orders/approvals"
              key={order.id}
              className={
                "group block rounded-md border border-l-[3px] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.025)] transition hover:-translate-y-px hover:border-rose-300 hover:shadow-md " +
                (pending ? "border-amber-200 border-l-amber-400" : "border-blue-200 border-l-blue-500")
              }
            >
              <div className="flex items-start gap-3">
                <span className={
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border " +
                  (order.has_consumable ? "border-orange-100 bg-orange-50 text-orange-600" : "border-violet-100 bg-violet-50 text-violet-600")
                }>
                  {order.has_consumable ? <Package size={17} /> : <ShoppingBag size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <strong className="truncate font-mono text-[12px] font-black text-slate-900">
                      {order.order_code}
                    </strong>
                    <span className={
                      "rounded border px-1.5 py-0.5 text-[9px] font-extrabold " +
                      (pending ? "border-amber-200 bg-amber-50 text-amber-700" : "border-blue-200 bg-blue-50 text-blue-700")
                    }>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] font-bold text-slate-700">{order.branch_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-500">
                    <span>{productLabel} talebi</span>
                    <span>·</span><span>{order.item_count} kalem</span>
                    <span>·</span><strong className="text-slate-700">{order.requested_total} adet</strong>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock3 size={12} /> {dateLabel(order.created_at, true)}
                  </span>
                  <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#dc3545]" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
        <span className="text-[10px] font-semibold text-slate-500">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          15 sn'de yenilenir
        </span>
        <div className="hidden items-center gap-2 lg:flex">
          {soundEnabled && audioUnlocked ? (
            <button
              type="button" onClick={testSound}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-[#dc3545]"
            >
              <Volume2 size={14} /> Sesi test et
            </button>
          ) : soundEnabled ? (
            <button
              type="button" onClick={unlockSound}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#dc3545]"
            >
              <Volume2 size={14} /> Bildirim sesini aç
            </button>
          ) : null}
          <button
            type="button" onClick={toggleSound}
            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:border-rose-200 hover:text-[#dc3545]"
          >
            {soundEnabled ? <VolumeX size={13} /> : <Volume2 size={13} />}
            {soundEnabled ? "Sesi kapat" : "Sesi aç"}
          </button>
        </div>
      </footer>
    </section>
  );
}
