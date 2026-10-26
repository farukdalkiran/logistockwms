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
  const info = statusOf(order.status),
    decided = hasDecision(order),
    Icon = info.closed
      ? XCircle
      : info.delivered
        ? CheckCheck
        : info.stage >= 3
          ? Truck
          : Clock3;
  return (
    <article
      className={`${s.orderCard} ${s[`card_${info.tone}`]}`}
      aria-label={`${order.order_code} ${kindOf(order)}`}
    >
      <header className={s.cardHeader}>
        <div className={s.orderMetadata}>
          <div>
            <span>Sipariş tarihi</span>
            <strong>{dateLabel(order.created_at)}</strong>
          </div>
          <div>
            <span>Sipariş numarası</span>
            <strong className={s.orderCode}>{order.order_code}</strong>
          </div>
          <div>
            <span>Sipariş özeti</span>
            <strong>
              {quantity(order.item_count)} kalem ·{" "}
              {quantity(order.requested_total)} adet
            </strong>
          </div>
        </div>
        <OrderKind order={order} />
      </header>
      <div className={s.cardBody}>
        <div className={s.cardState}>
          <span className={`${s.stateIcon} ${s[info.tone]}`}>
            <Icon size={21} />
          </span>
          <div>
            <OrderStatus order={order} large />
            <p>{info.description}</p>
          </div>
          {decided && order.revised_count > 0 && !info.closed && (
            <span className={s.revisionTag}>
              <SlidersHorizontal size={13} />
              {order.revised_count} kalemde revizyon
            </span>
          )}
        </div>
        <OrderJourney order={order} compact />
        <div className={s.previewItems}>
          {order.items.map((item) => (
            <div className={s.previewItem} key={item.id}>
              <ProductImage item={item} />
              <div className={s.previewIdentity}>
                <span className={s.sku}>
                  {item.product?.sku || "SKU bilgisi yok"}
                  <small>
                    {item.product?.is_consumable ? "Sarf malzemesi" : "Ürün"}
                  </small>
                </span>
                <h3>{item.product?.name || "Ürün bilgisi bulunamadı"}</h3>
                {decided && item.revision_reason && (
                  <p className={s.itemReason}>
                    <FileText size={12} />
                    {item.revision_reason}
                  </p>
                )}
              </div>
              <div className={s.previewQuantity}>
                <strong>{quantity(item.requested_qty)} adet talep</strong>
                <span>
                  {decided && item.approved_qty !== null
                    ? `${quantity(item.approved_qty)} adet onaylandı`
                    : isPending(order)
                      ? "Onay bekliyor"
                      : "Onay bilgisi yok"}
                </span>
              </div>
            </div>
          ))}
        </div>
        {order.item_count > order.items.length && (
          <button className={s.moreItems} onClick={onOpen}>
            +{quantity(order.item_count - order.items.length)} kalemi daha
            görüntüle
            <ArrowRight size={13} />
          </button>
        )}
        {info.closed && order.decision_note && (
          <div className={s.decisionNote}>
            <FileText size={14} />
            <span>{order.decision_note}</span>
          </div>
        )}
      </div>
      <footer className={s.cardFooter}>
        <div>
          <span>
            Talep: <b>{quantity(order.requested_total)} adet</b>
          </span>
          <span>
            Onay:{" "}
            <b>
              {decided && order.approved_total !== null
                ? `${quantity(order.approved_total)} adet`
                : info.closed
                  ? "—"
                  : "Bekleniyor"}
            </b>
          </span>
          {order.prepared_by_name && (
            <span className={s.operator}>
              İşlemi yapan: <b>{order.prepared_by_name}</b>
            </span>
          )}
        </div>
        <button
          className={s.detailButton}
          onClick={onOpen}
          aria-label={`${order.order_code} sipariş detayını aç`}
        >
          Sipariş detayı
          <ArrowRight size={15} />
        </button>
      </footer>
    </article>
  );
}
