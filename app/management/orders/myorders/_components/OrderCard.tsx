"use client";

import { useState } from "react";
import {
  ArrowRight,
  Box,
  CheckCheck,
  Clock3,
  FileText,
  Package,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  XCircle,
} from "lucide-react";
import {
  dateLabel,
  hasDecision,
  isPending,
  kindOf,
  quantity,
  statusOf,
  type Order,
  type OrderItem,
} from "@/lib/my-orders/types";
import OrderJourney from "./OrderJourney";
import s from "../myorders.module.css";

export function ProductImage({ item }: { item: OrderItem }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={s.productImage}>
      {item.product?.image_url && !broken ? (
        <img
          src={item.product.image_url}
          onError={() => setBroken(true)}
          alt={item.product.name}
          loading="lazy"
        />
      ) : (
        <Box size={25} />
      )}
    </div>
  );
}
export function OrderStatus({
  order,
  large = false,
}: {
  order: Order;
  large?: boolean;
}) {
  const info = statusOf(order.status),
    Icon = info.closed
      ? XCircle
      : info.delivered
        ? CheckCheck
        : info.stage === 1
          ? Clock3
          : info.stage >= 3
            ? Truck
            : Package;
  return (
    <span
      className={`${s.status} ${s[info.tone]} ${large ? s.statusLarge : ""}`}
    >
      <Icon size={large ? 19 : 14} />
      {info.label}
    </span>
  );
}
export function OrderKind({ order }: { order: Order }) {
  return (
    <span
      className={`${s.kind} ${order.has_consumable && !order.has_product ? s.kindSupply : order.has_consumable && order.has_product ? s.kindMixed : s.kindProduct}`}
    >
      <ShoppingBag size={12} />
      {kindOf(order)}
    </span>
  );
}
export function ItemDecision({
  order,
  item,
}: {
  order: Order;
  item: OrderItem;
}) {
  if (statusOf(order.status).closed && !hasDecision(order))
    return <span className={`${s.itemBadge} ${s.red}`}>İptal edildi</span>;
  if (!hasDecision(order) || item.approved_qty === null)
    return <span className={`${s.itemBadge} ${s.amber}`}>Onay bekliyor</span>;
  if (item.approved_qty === 0)
    return <span className={`${s.itemBadge} ${s.red}`}>Karşılanmadı</span>;
  if (item.approved_qty < item.requested_qty)
    return <span className={`${s.itemBadge} ${s.amber}`}>Revize edildi</span>;
  return <span className={`${s.itemBadge} ${s.green}`}>Tam karşılandı</span>;
}
export default function OrderCard({
  order,
  onOpen,
}: {
  order: Order;
  onOpen: () => void;
}) {
  const info = statusOf(order.status);
  const decided = hasDecision(order);
  const canReceive = order.status?.trim().toUpperCase() === "READY_TO_SHIP";
  const completed = info.delivered;
  const summary = order.items.slice(0, 3);
  const extra = Math.max(0, order.item_count - summary.length);

  return (
    <article
      className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_3px_14px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_6px_24px_rgba(15,23,42,0.1)]"
      aria-label={order.order_code + " " + kindOf(order)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-600 bg-[#253249] px-4 py-3 text-white sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-300">Sipariş No</span>
            <strong className="font-mono text-[12px] font-black text-white">{order.order_code}</strong>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-300">Talep Tarihi</span>
            <strong className="text-[11px] font-semibold text-slate-100">{dateLabel(order.created_at)}</strong>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-300">Sipariş Türü</span>
            <strong className="text-[11px] font-semibold text-slate-100">{kindOf(order)}</strong>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={
            "inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-extrabold " +
            (completed
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-100"
              : info.closed
                ? "border-red-400/50 bg-red-500/15 text-red-100"
                : canReceive
                  ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                  : "border-amber-400/50 bg-amber-500/15 text-amber-100")
          }>
            {completed ? <CheckCheck size={13}/> : canReceive ? <Truck size={13}/> : info.closed ? <XCircle size={13}/> : <Clock3 size={13}/>}
            {info.label}
          </span>
        </div>
      </header>

      <div className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_205px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-black text-slate-900">
              {completed ? "Sipariş tamamlandı" : canReceive ? "Gönderim aşamasında" : info.closed ? "Sipariş işlemi kapatıldı" : "Güncel sipariş durumu"}
            </span>
            {order.revised_count > 0 && decided && (
              <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <SlidersHorizontal size={12}/>{order.revised_count} revize kalem
              </span>
            )}
          </div>
          <p className="mb-4 text-[11px] leading-relaxed text-slate-500">{info.description}</p>

          <div className="divide-y divide-slate-100 overflow-hidden rounded border border-slate-200">
            {summary.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-white px-3 py-2.5">
                <ProductImage item={item} />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">
                    {item.product?.is_consumable ? "Sarf malzemesi" : "Ürün"} · {item.product?.sku || "SKU yok"}
                  </span>
                  <h3 className="line-clamp-2 text-[12px] font-bold leading-snug text-slate-800">
                    {item.product?.name || "Ürün bilgisi bulunamadı"}
                  </h3>
                  {decided && item.revision_reason && (
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-amber-700">{item.revision_reason}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <strong className="block text-[12px] font-black text-slate-800">{quantity(item.requested_qty)} adet</strong>
                  <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
                    {decided && item.approved_qty !== null
                      ? quantity(item.approved_qty) + " onay"
                      : "Onay bekliyor"}
                  </span>
                </div>
              </div>
            ))}
            {summary.length === 0 && (
              <div className="flex items-center gap-2 p-4 text-[11px] text-slate-500">
                <Package size={16} /> Sipariş kalemi bulunamadı.
              </div>
            )}
          </div>
          {extra > 0 && (
            <button type="button" onClick={onOpen}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#dc3545] hover:underline">
              +{quantity(extra)} kalem daha görüntüle <ArrowRight size={13} />
            </button>
          )}
          {info.closed && order.decision_note && (
            <div className="mt-3 flex gap-2 rounded border border-red-200 bg-red-50 p-3 text-[11px] text-red-800">
              <FileText size={15} className="shrink-0" />
              <span>{order.decision_note}</span>
            </div>
          )}
        </div>

        <aside className="flex flex-col justify-between gap-4 rounded-md border border-slate-200 bg-[#f8fafc] p-4">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Sipariş özeti
            </span>
            <strong className="mt-2 block text-[22px] font-black tracking-tight text-slate-900">
              {quantity(order.item_count)} <small className="text-[12px] font-semibold text-slate-500">kalem</small>
            </strong>
            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Talep</span><b className="text-slate-900">{quantity(order.requested_total)} adet</b>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Onaylanan</span>
                <b className="text-slate-900">
                  {decided && order.approved_total !== null ? quantity(order.approved_total) + " adet" : "—"}
                </b>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {canReceive && (
              <button type="button" onClick={onOpen}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-[11px] font-black text-white transition hover:bg-emerald-700">
                <CheckCheck size={16} /> Siparişi teslim aldım
              </button>
            )}
            {completed && (
              <div className="flex items-center justify-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] font-black text-emerald-800">
                <CheckCheck size={15} /> Teslimat tamamlandı
              </div>
            )}
            <button type="button" onClick={onOpen}
              aria-label={order.order_code + " numaralı siparişin detayını aç"}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 transition hover:border-[#dc3545] hover:text-[#dc3545]">
              Sipariş detayları <ArrowRight size={15} />
            </button>
          </div>
        </aside>
      </div>
    </article>
  );
}
