export type Kind = "ALL" | "PRODUCT" | "CONSUMABLE" | "MIXED";
export type Status =
  | "ALL"
  | "PENDING"
  | "PREPARING"
  | "READY_TO_SHIP"
  | "DELIVERED"
  | "REJECTED";
export interface Filters {
  search: string;
  status: Status;
  kind: Kind;
  branch: string;
  from: string;
  to: string;
  sort: "oldest" | "newest" | "quantity";
  page: number;
  pageSize: number;
}
export interface Context {
  actorName: string;
  warehouseId: string;
  warehouseName: string;
  branches: { id: string; name: string }[];
}
export interface OrderRow {
  id: string;
  order_code: string;
  branch_id: string | null;
  branch_name: string;
  requester_name: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  prepared_by_name: string | null;
  item_count: number;
  requested_total: number;
  approved_total: number;
  has_product: boolean;
  has_consumable: boolean;
}
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
  warehouse_stock: number;
}
export interface AuditEvent {
  id: number;
  action: string;
  actor_name: string;
  employee_name: string;
  created_at: string;
  note: string | null;
  items: { id: string; approved_qty: number; revision_reason: string | null }[];
}
export interface OrderDetail extends OrderRow {
  items: OrderItem[];
  events: AuditEvent[];
  decision_note: string | null;
}
export interface ListResult {
  rows: OrderRow[];
  count: number;
  page: number;
  metrics: {
    pending: number;
    preparing: number;
    ready_to_ship: number;
    rejected: number;
    pending_quantity: number;
  };
  updatedAt: string;
}
export interface Decision {
  orderId: string;
  employeeId: string;
  action: "APPROVE" | "REJECT";
  note: string;
  items: { id: string; qty: number; reason: string }[];
}
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "PENDING",
  kind: "ALL",
  branch: "",
  from: "",
  to: "",
  sort: "oldest",
  page: 1,
  pageSize: 10,
};
export const statusLabel = (s: string) =>
  ({
    PENDING: "Onay bekliyor",
    PREPARING: "Hazırlanıyor",
    READY_TO_SHIP: "Hazırlandı & gönderiliyor",
    REJECTED: "Reddedildi",
    SHIPPED: "Sevk edildi",
    DELIVERED: "Teslim edildi",
    COMPLETED: "Tamamlandı",
    CANCELLED: "İptal edildi",
  })[s] || s;
export const kindLabel = (
  o: Pick<OrderRow, "has_product" | "has_consumable">,
) =>
  o.has_product && o.has_consumable
    ? "Karma"
    : o.has_consumable
      ? "Sarf"
      : o.has_product
        ? "Ürün"
        : "Boş";
export const numberLabel = (n: number) => n.toLocaleString("tr-TR");
export function dateLabel(v: string | null, short = false) {
  if (!v || Number.isNaN(new Date(v).getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: short ? "short" : "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(v));
}
