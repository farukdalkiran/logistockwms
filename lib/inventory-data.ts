import type {
  InventoryFilters,
  InventoryLog,
  InventoryProduct,
  InventoryResult,
  InventoryShelf,
  InventorySummary,
  ShelfStatus,
} from "./inventory-types";
export type StockRow = {
  id: string;
  product_id: string | null;
  branch_id: string | null;
  quantity: number;
  shelf_id: number | null;
  shelf_location: string | null;
};
export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  image_url: string | null;
  is_consumable: boolean | null;
};
export type ShelfRow = {
  id: number;
  branch_id: string;
  name: string;
  status: string;
};
export const fold = (text: string) => text.toLocaleLowerCase("tr-TR");
export const shelfStatus = (value: string): ShelfStatus =>
  value === "hasarli" ? "hasarli" : value === "normal" ? "normal" : "unknown";

// All inputs must already be authorized. The branch filter is repeated defensively.
export function aggregateInventory(
  branchId: string,
  stocks: StockRow[],
  catalog: ProductRow[],
  shelves: ShelfRow[],
): { products: InventoryProduct[]; summary: InventorySummary } {
  const productsById = new Map(catalog.map((product) => [product.id, product]));
  const ownShelves = shelves.filter((shelf) => shelf.branch_id === branchId);
  const shelvesById = new Map(ownShelves.map((shelf) => [shelf.id, shelf]));
  const byProduct = new Map<
    string,
    { product: InventoryProduct; locations: Map<string, InventoryShelf> }
  >();
  const activeShelves = new Set<string>();
  const seenStocks = new Set<string>();
  let total = 0;
  let damagedQuantity = 0;
  for (const stock of stocks) {
    if (stock.branch_id !== branchId || seenStocks.has(stock.id)) continue;
    seenStocks.add(stock.id);
    const quantity = Number(stock.quantity);
    if (!Number.isFinite(quantity))
      throw new Error("Geçersiz stok miktarı tespit edildi.");
    const source = stock.product_id
      ? productsById.get(stock.product_id)
      : undefined;
    const productId = source?.id || stock.product_id || `unlinked:${stock.id}`;
    let bucket = byProduct.get(productId);
    if (!bucket) {
      bucket = {
        product: {
          product_id: productId,
          name: source?.name || "Ürün bağlantısı eksik",
          sku: source?.sku || null,
          barcode: source?.barcode || null,
          image_url: source?.image_url || null,
          category: source?.category || null,
          is_consumable: source?.is_consumable === true,
          total_quantity: 0,
          shelf_count: 0,
          has_damaged_shelf: false,
          shelves: [],
          is_unlinked: !source,
        },
        locations: new Map(),
      };
      byProduct.set(productId, bucket);
    }
    const shelf =
      stock.shelf_id !== null ? shelvesById.get(stock.shelf_id) : undefined;
    const name = shelf?.name || stock.shelf_location?.trim() || "Raf atanmamış";
    const status = shelf ? shelfStatus(shelf.status) : "unknown";
    const key =
      stock.shelf_id !== null
        ? `id:${stock.shelf_id}`
        : stock.shelf_location?.trim()
          ? `name:${stock.shelf_location.trim()}`
          : "unassigned";
    const location = bucket.locations.get(key) || {
      shelf_id: stock.shelf_id,
      name,
      status,
      quantity: 0,
    };
    location.quantity += quantity;
    bucket.locations.set(key, location);
    bucket.product.total_quantity += quantity;
    total += quantity;
    if (quantity > 0 && key !== "unassigned") activeShelves.add(key);
    if (status === "hasarli") damagedQuantity += quantity;
  }
  const products = [...byProduct.values()]
    .map(({ product, locations }) => {
      product.shelves = [...locations.values()]
        .filter((shelf) => shelf.quantity !== 0)
        .sort(
          (a, b) =>
            b.quantity - a.quantity || a.name.localeCompare(b.name, "tr"),
        );
      product.shelf_count = product.shelves.filter(
        (shelf) =>
          shelf.quantity > 0 &&
          (shelf.shelf_id !== null || shelf.name !== "Raf atanmamış"),
      ).length;
      product.has_damaged_shelf = product.shelves.some(
        (shelf) => shelf.status === "hasarli" && shelf.quantity > 0,
      );
      return product;
    })
    .sort(
      (a, b) =>
        b.total_quantity - a.total_quantity ||
        a.name.localeCompare(b.name, "tr") ||
        a.product_id.localeCompare(b.product_id),
    );
  return {
    products,
    summary: {
      total_quantity: total,
      product_count: products.length,
      stocked_product_count: products.filter(
        (product) => product.total_quantity > 0,
      ).length,
      active_shelf_count: activeShelves.size,
      damaged_quantity: damagedQuantity,
      zero_product_count: products.filter(
        (product) => product.total_quantity === 0,
      ).length,
    },
  };
}

export function filterInventory(
  products: InventoryProduct[],
  filters: InventoryFilters,
): InventoryResult[] {
  const keyword = fold(filters.product.trim());
  const shelfKeyword = fold(filters.shelf.trim());
  return products
    .flatMap((product) => {
      if (
        keyword &&
        !fold(
          `${product.name} ${product.sku || ""} ${product.barcode || ""}`,
        ).includes(keyword)
      )
        return [];
      if (
        (filters.kind === "COMMERCIAL" && product.is_consumable) ||
        (filters.kind === "CONSUMABLE" && !product.is_consumable)
      )
        return [];
      if (
        filters.category !== "ALL" &&
        (product.category || "Kategorisiz") !== filters.category
      )
        return [];
      const matchingShelves = product.shelves.filter(
        (shelf) =>
          (!shelfKeyword || fold(shelf.name).includes(shelfKeyword)) &&
          (filters.status !== "DAMAGED" || shelf.status === "hasarli") &&
          (filters.status !== "ACTIVE_SHELF" || shelf.status === "normal") &&
          shelf.quantity > 0,
      );
      if (filters.status === "NO_STOCK" && product.total_quantity !== 0)
        return [];
      if (
        (shelfKeyword ||
          filters.status === "DAMAGED" ||
          filters.status === "ACTIVE_SHELF") &&
        !matchingShelves.length
      )
        return [];
      return [
        {
          ...product,
          matched_quantity: matchingShelves.reduce(
            (sum, shelf) => sum + shelf.quantity,
            0,
          ),
          matched_shelf_count: matchingShelves.length,
        },
      ];
    })
    .sort((a, b) => {
      const tie =
        a.name.localeCompare(b.name, "tr") ||
        a.product_id.localeCompare(b.product_id);
      if (filters.sort === "NAME") return tie;
      if (filters.sort === "SKU")
        return (
          (a.sku || "").localeCompare(b.sku || "", "tr", { numeric: true }) ||
          tie
        );
      return filters.sort === "STOCK_ASC"
        ? a.total_quantity - b.total_quantity || tie
        : b.total_quantity - a.total_quantity || tie;
    });
}

// Legacy logs have no product_id FK. Inventory actions use [barcode - product name].
// Exact barcode extraction continues to work after a product name change.
export function logMatchesProduct(
  description: string,
  barcode: string,
): boolean {
  return (
    description.match(/\[\s*([^\]\r\n]+?)\s+-\s+/)?.[1]?.trim() === barcode
  );
}
export function normalizeLog(value: Record<string, unknown>): InventoryLog {
  const employee = Array.isArray(value.employees)
    ? value.employees[0]
    : value.employees;
  const fullName =
    employee && typeof employee === "object" && "full_name" in employee
      ? employee.full_name
      : null;
  return {
    id: String(value.id),
    created_at: String(value.created_at || ""),
    action_type: String(value.action_type || ""),
    description: String(value.description || ""),
    new_value: String(value.new_value ?? ""),
    employee_name: String(fullName || "Sistem / otomasyon"),
  };
}
