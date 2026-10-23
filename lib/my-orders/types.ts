export const STATUS_GROUPS = {
  ALL: [],
  PENDING: ["PENDING"],
  PROCESSING: [
    "APPROVED",
    "REVISED",
    "PARTIALLY_APPROVED",
    "PARTIAL_APPROVED",
    "PROCESSING",
    "PREPARING",
    "PICKING",
    "PACKING",
    "READY",
    "PACKED",
  ],
  READY_TO_SHIP: ["READY_TO_SHIP"],
  SHIPPED: ["SHIPPED", "DISPATCHED", "IN_TRANSIT"],
  DONE: ["DELIVERED", "COMPLETED"],
  CANCELLED: ["CANCELLED", "CANCELED", "REJECTED"],
} as const;
export type StatusFilter = keyof typeof STATUS_GROUPS;
export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: "Tüm durumlar",
  PENDING: "Onay bekleyen",
  PROCESSING: "Hazırlanan",
  READY_TO_SHIP: "Hazırlandı & gönderiliyor",
  SHIPPED: "Sevkiyatta",
  DONE: "Teslim edilen",
  CANCELLED: "İptal / Ret",
};
export type KindFilter = "ALL" | "PRODUCT" | "CONSUMABLE" | "MIXED";
export interface Filters {
  search: string;
  status: StatusFilter;
  kind: KindFilter;
  from: string;
  to: string;
  sort: "newest" | "oldest";
  page: number;
  pageSize: number;
}
export const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "ALL",
  kind: "ALL",
  from: "",
  to: "",
  sort: "newest",
  page: 1,
  pageSize: 10,
};
export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  category: string | null;
  is_consumable: boolean;
}
export interface OrderItem {
  id: string;
  product_id: string | null;
  requested_qty: number;
  approved_qty: number | null;
  revision_reason: string | null;
  product: Product | null;
}
export interface Order {
  id: string;
  order_code: string;
  status: string | null;
  created_at: string;
  approved_at: string | null;
  prepared_by_name: string | null;
  requester_name: string;
  warehouse_name: string | null;
  decision_note: string | null;
  preparing_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking_number: string | null;
  carrier_name: string | null;
  item_count: number;
  requested_total: number;
  approved_total: number | null;
  revised_count: number;
  has_product: boolean;
  has_consumable: boolean;
  items: OrderItem[];
}
export interface ListResult {
  branch: { id: string; name: string };
  rows: Order[];
  count: number;
  page: number;
  metrics: {
    total: number;
    pending: number;
    ready_to_ship: number;
    completed: number;
  };
  updatedAt: string;
}
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type Tone = "amber" | "blue" | "purple" | "green" | "red" | "neutral";
export interface StatusInfo {
  label: string;
  description: string;
  tone: Tone;
  stage: number;
  closed?: boolean;
  delivered?: boolean;
}
const preparing: StatusInfo = {
  label: "Hazırlanıyor",
  description: "Merkez depo sipariş kalemlerini hazırlıyor.",
  tone: "blue",
  stage: 2,
};
const approved: StatusInfo = {
  label: "Onaylandı",
  description: "Merkez onayı tamamlandı; hazırlık süreci devam ediyor.",
  tone: "blue",
  stage: 2,
};
const shipped: StatusInfo = {
  label: "Sevkiyatta",
  description: "Siparişin sevk süreci devam ediyor.",
  tone: "purple",
  stage: 3,
};
const delivered: StatusInfo = {
  label: "Teslim edildi",
  description: "Sipariş teslim edildi.",
  tone: "green",
  stage: 4,
  delivered: true,
};
export const STATUS_MAP: Record<string, StatusInfo> = {
  PENDING: {
    label: "Merkez onayı bekleniyor",
    description: "Talebiniz alındı. Merkez deponun onayı bekleniyor.",
    tone: "amber",
    stage: 1,
  },
  APPROVED: approved,
  REVISED: { ...approved, label: "Revize edilerek onaylandı" },
  PARTIALLY_APPROVED: { ...approved, label: "Kısmen onaylandı" },
  PARTIAL_APPROVED: { ...approved, label: "Kısmen onaylandı" },
  PROCESSING: preparing,
  PREPARING: preparing,
  PICKING: { ...preparing, label: "Ürünler toplanıyor" },
  PACKING: { ...preparing, label: "Paketleniyor" },
  READY: { ...preparing, label: "Sevkiyata hazır" },
  PACKED: { ...preparing, label: "Sevkiyata hazır" },
  READY_TO_SHIP: {
    label: "Hazırlandı & gönderiliyor",
    description: "Merkez depo onayı tamamlandı. Sipariş gönderim sürecinde.",
    tone: "purple",
    stage: 3,
  },
  SHIPPED: shipped,
  DISPATCHED: shipped,
  IN_TRANSIT: { ...shipped, label: "Transferde" },
  DELIVERED: delivered,
  COMPLETED: { ...delivered, label: "Tamamlandı" },
  REJECTED: {
    label: "Talep reddedildi",
    description:
      "Merkez depo talebi gerekçesiyle reddetti. Kalem açıklamalarını inceleyebilirsiniz.",
    tone: "red",
    stage: 0,
    closed: true,
  },
  CANCELLED: {
    label: "Sipariş iptal edildi",
    description: "Sipariş iptal edildi.",
    tone: "red",
    stage: 0,
    closed: true,
  },
  CANCELED: {
    label: "Sipariş iptal edildi",
    description: "Sipariş iptal edildi.",
    tone: "red",
    stage: 0,
    closed: true,
  },
};
export const statusOf = (value: string | null): StatusInfo =>
  STATUS_MAP[(value || "").trim().toUpperCase()] || {
    label: value?.replace(/_/g, " ") || "Durum belirtilmemiş",
    description: "Bu sipariş için henüz tanımlı bir durum açıklaması yok.",
    tone: "neutral",
    stage: -1,
  };
export const kindOf = (order: Pick<Order, "has_product" | "has_consumable">) =>
  order.has_product && order.has_consumable
    ? "Ürün + Sarf siparişi"
    : order.has_consumable
      ? "Sarf siparişi"
      : order.has_product
        ? "Ürün siparişi"
        : "Boş sipariş";
export const quantity = (value: number) => value.toLocaleString("tr-TR");
export function dateLabel(value: string | null | undefined, short = false) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: short ? "short" : "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
export function isPending(order: Order) {
  return (order.status || "").trim().toUpperCase() === "PENDING";
}
export function hasDecision(order: Order) {
  const code = (order.status || "").trim().toUpperCase();
  return (
    !isPending(order) &&
    Boolean(
      order.approved_at ||
        (STATUS_MAP[code] && !statusOf(code).closed) ||
        code === "REJECTED",
    )
  );
}
