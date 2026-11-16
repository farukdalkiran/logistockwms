// HamurLabs Excel-only transfer planning rules. No WMS stock or transfer writes.
export type Warehouse = "center" | "online";
export type Eligibility = "missing" | "lower" | "none";
export type Mode = "units" | "boxes" | "balance" | "all";

export type StockRow = {
  barcode: string;
  ean?: string;
  sku?: string;
  name?: string;
  brand?: string;
  warehouse: Warehouse;
  sellable: number;
  racked?: number;
  active?: boolean;
};

export type StockItem = {
  key: string;
  barcode: string;
  ean: string;
  sku: string;
  name: string;
  brand: string;
  center: number;
  online: number;
  centerRacked: number;
  onlineRacked: number;
  active: boolean;
  sourceRows: number;
};

export type PlannerSettings = {
  mode: Mode;
  fixedUnits: number;
  fixedBoxes: number;
  perProductCap: number;
  reserve: number;
};

export function normalizedCode(value: unknown): string {
  const raw = String(value ?? "").trim().replace(/\s+/g, "");
  if (/^\d+(\.\d+)?e\+\d+$/i.test(raw)) {
    const number = Number(raw);
    if (Number.isSafeInteger(number)) return String(number);
  }
  return raw.replace(/\.0$/, "").toUpperCase();
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export function warehouseFromName(value: unknown): Warehouse | null {
  const name = normalizeHeader(value);
  if (/merkez depo|maltepe|maltepepark/.test(name)) return "center";
  if (/yeni depo|online depo|anatolium/.test(name)) return "online";
  return null;
}

export function wholeNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return null;
  const compact = raw.replace(/\.(?=\d{3}(?:[.,]|$))/g, "").replace(",", ".");
  const num = Number(compact);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : null;
}

export function buildStockIndex(rows: StockRow[]): StockItem[] {
  const map = new Map<string, StockItem>();
  for (const row of rows) {
    const barcode = normalizedCode(row.barcode || row.ean);
    const ean = normalizedCode(row.ean);
    const sku = normalizedCode(row.sku);
    const key = barcode || (sku ? "SKU:" + sku : "");
    if (!key || !Number.isSafeInteger(row.sellable) || row.sellable < 0) continue;
    let item = map.get(key);
    if (!item) {
      item = {
        key, barcode, ean, sku, name: row.name?.trim() || "", brand: row.brand?.trim() || "",
        center: 0, online: 0, centerRacked: 0, onlineRacked: 0,
        active: row.active !== false, sourceRows: 0,
      };
      map.set(key, item);
    }
    if (!item.name && row.name) item.name = row.name.trim();
    if (!item.sku && sku) item.sku = sku;
    if (!item.ean && ean) item.ean = ean;
    if (!item.brand && row.brand) item.brand = row.brand.trim();
    item.active = item.active || row.active !== false;
    item.sourceRows += 1;
    if (row.warehouse === "center") {
      item.center += row.sellable;
      item.centerRacked += Math.max(0, row.racked || 0);
    } else {
      item.online += row.sellable;
      item.onlineRacked += Math.max(0, row.racked || 0);
    }
  }
  return [...map.values()].sort((a, b) => a.sku.localeCompare(b.sku, "tr") || a.barcode.localeCompare(b.barcode));
}

export function eligibilityOf(item: StockItem): Eligibility {
  if (item.center <= 0) return "none";
  if (item.online === 0) return "missing";
  if (item.center > item.online) return "lower";
  return "none";
}

export function eligibleForTransfer(item: StockItem): boolean {
  return item.active && eligibilityOf(item) !== "none";
}

export function suggestedTransfer(
  item: StockItem,
  packSize: number | null,
  settings: PlannerSettings
): number {
  if (!eligibleForTransfer(item)) return 0;
  const reserve = Math.max(0, Math.floor(settings.reserve || 0));
  const available = Math.max(0, item.center - reserve);
  const cap = Math.max(0, Math.floor(settings.perProductCap || 0));
  const permitted = cap > 0 ? Math.min(available, cap) : available;
  const pack = packSize && Number.isSafeInteger(packSize) && packSize > 0 ? packSize : null;
  let requested = 0;
  switch (settings.mode) {
    case "all": requested = available; break;
    case "balance": requested = Math.floor(Math.max(0, item.center - item.online) / 2); break;
    case "boxes": requested = pack ? pack * Math.max(0, Math.floor(settings.fixedBoxes)) : 0; break;
    default: requested = Math.max(0, Math.floor(settings.fixedUnits));
  }
  const candidate = Math.min(permitted, requested);
  if (!pack || pack === 1) return candidate;
  // Exception: online depot has none, source has fewer available than one full box.
  if (item.online === 0 && available > 0 && available < pack) return permitted;
  return Math.floor(candidate / pack) * pack;
}

export function isValidTransferQuantity(
  item: StockItem,
  quantity: number,
  packSize: number | null,
  reserve: number,
  perProductCap: number,
  allowSingles: boolean
): boolean {
  if (!eligibleForTransfer(item) || !Number.isSafeInteger(quantity) || quantity <= 0) return false;
  const available = Math.max(0, item.center - Math.max(0, Math.floor(reserve)));
  if (quantity > available) return false;
  if (perProductCap > 0 && quantity > perProductCap) return false;
  if (packSize && packSize > 1 && !allowSingles &&
      !(item.online === 0 && available < packSize) && quantity % packSize !== 0) return false;
  return true;
}

export function countBoxes(quantity: number, packSize: number | null) {
  if (!packSize || packSize < 1) return { boxes: 0, singles: quantity };
  return { boxes: Math.floor(quantity / packSize), singles: quantity % packSize };
}

export type CatalogProduct = {
  id: string;
  barcode: string;
  sku: string | null;
  name: string | null;
  alt_barcodes: string[] | null;
  is_active: boolean | null;
};
export type CatalogBox = { product_id: string; quantity: number };

export type PackMatch = {
  productId: string | null;
  productName: string | null;
  sku: string | null;
  pack: number | null;
  ambiguous: boolean;
};

export function buildPackLookup(products: CatalogProduct[], boxes: CatalogBox[]) {
  const matches = new Map<string, CatalogProduct>();
  const quantities = new Map<string, Set<number>>();
  for (const box of boxes) {
    if (!Number.isSafeInteger(box.quantity) || box.quantity <= 0) continue;
    if (!quantities.has(box.product_id)) quantities.set(box.product_id, new Set());
    quantities.get(box.product_id)!.add(box.quantity);
  }
  for (const product of products) {
    const keys = [product.barcode, product.sku, ...(product.alt_barcodes || [])];
    for (const raw of keys) {
      const key = normalizedCode(raw);
      if (key && !matches.has(key)) matches.set(key, product);
    }
  }
  return (row: StockItem): PackMatch => {
    const product = [row.barcode, row.ean, row.sku].map(normalizedCode).map(k => matches.get(k)).find(Boolean);
    if (!product) return { productId: null, productName: null, sku: null, pack: null, ambiguous: false };
    const sizes = [...(quantities.get(product.id) || new Set<number>())];
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      pack: sizes.length === 1 ? sizes[0] : null,
      ambiguous: sizes.length > 1,
    };
  };
}

export function specialListMatches(item: StockItem, keys: ReadonlySet<string>): boolean {
  return [item.barcode, item.ean, item.sku].some(value => value && keys.has(normalizedCode(value)));
}
