export type ShelfStatus = "normal" | "hasarli" | "unknown";
export type InventoryShelf = {
  shelf_id: number | null;
  name: string;
  status: ShelfStatus;
  quantity: number;
};
export type InventoryProduct = {
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  image_url: string | null;
  is_consumable: boolean;
  total_quantity: number;
  shelf_count: number;
  has_damaged_shelf: boolean;
  shelves: InventoryShelf[];
  is_unlinked: boolean;
};
export type InventorySummary = {
  total_quantity: number;
  product_count: number;
  stocked_product_count: number;
  active_shelf_count: number;
  damaged_quantity: number;
  zero_product_count: number;
};
export type InventorySnapshot = {
  branch: { id: string; name: string };
  products: InventoryProduct[];
  shelves: { id: number; name: string; status: ShelfStatus }[];
  summary: InventorySummary;
  loaded_at: string;
};
export type InventoryLog = {
  id: string;
  created_at: string;
  action_type: string;
  description: string;
  new_value: string;
  employee_name: string;
};
export type InventoryDetail = {
  branch: { id: string; name: string };
  product: InventoryProduct;
  logs: InventoryLog[];
  loaded_at: string;
};
export type InventoryFilters = {
  product: string;
  shelf: string;
  kind: "ALL" | "COMMERCIAL" | "CONSUMABLE";
  status: "ALL" | "DAMAGED" | "ACTIVE_SHELF" | "NO_STOCK";
  category: string;
  sort: "STOCK_DESC" | "STOCK_ASC" | "NAME" | "SKU";
};
export type InventoryResult = InventoryProduct & {
  matched_quantity: number;
  matched_shelf_count: number;
};
