// Saf eşleştirme kuralları: tarayıcıda ve testlerde aynı sonuç.
export type IncomingCatalogProduct = {
  line: number;
  barcode: string;
  sku: string | null;
  name: string;
  category: string | null;
  image_url: string | null;
  is_consumable: boolean | null;
  max_order_limit: number | null;
};

export type StoredCatalogProduct = {
  id: string;
  barcode: string;
  sku: string | null;
  name: string;
  is_consumable: boolean | null;
};

export type CatalogReviewRow = {
  incoming: IncomingCatalogProduct;
  status: "new" | "existing" | "conflict";
  existing?: StoredCatalogProduct;
  reason?: string;
  matchedOn?: string[];
};

export function catalogCode(value: string | null | undefined): string {
  return (value || "").trim().toUpperCase();
}

export function catalogName(value: string | null | undefined): string {
  return (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export function parseCatalogSheet(rows: Record<string, unknown>[]): IncomingCatalogProduct[] {
  return rows.map((row, index) => {
    const unit = String(row["Sarf Malzeme mi?"] ?? "").trim().toLocaleUpperCase("tr-TR");
    const rawLimit = String(row["Max Sipariş Limiti"] ?? "").trim();
    return {
      line: index + 2,
      barcode: catalogCode(String(row["Barkod"] ?? "")),
      sku: catalogCode(String(row["SKU"] ?? "")) || null,
      name: String(row["Ürün Adı"] ?? "").trim().replace(/\s+/g, " "),
      category: String(row["Kategori"] ?? "").trim() || null,
      image_url: String(row["Görsel URL"] ?? "").trim() || null,
      is_consumable: unit === "" ? null : unit === "EVET" ? true : unit === "HAYIR" ? false : null,
      max_order_limit: rawLimit === "" ? null : /^\d+$/.test(rawLimit) ? Number(rawLimit) : Number.NaN,
    };
  });
}

export function buildCatalogReview(
  incoming: IncomingCatalogProduct[],
  stored: StoredCatalogProduct[],
): CatalogReviewRow[] {
  const byBarcode = new Map<string, StoredCatalogProduct[]>();
  const bySku = new Map<string, StoredCatalogProduct[]>();
  const byName = new Map<string, StoredCatalogProduct[]>();

  const append = (map: Map<string, StoredCatalogProduct[]>, key: string, product: StoredCatalogProduct) => {
    if (!key) return;
    map.set(key, [...(map.get(key) || []), product]);
  };
  for (const item of stored) {
    append(byBarcode, catalogCode(item.barcode), item);
    append(bySku, catalogCode(item.sku), item);
    append(byName, catalogName(item.name), item);
  }

  const fileBarcode = new Map<string, number>();
  const fileSku = new Map<string, number>();
  const fileName = new Map<string, number>();
  const count = (map: Map<string, number>, key: string) => {
    if (key) map.set(key, (map.get(key) || 0) + 1);
  };
  for (const item of incoming) {
    count(fileBarcode, catalogCode(item.barcode));
    count(fileSku, catalogCode(item.sku));
    count(fileName, catalogName(item.name) + ":" + String(item.is_consumable ?? false));
  }

  const review = incoming.map((item): CatalogReviewRow => {
    const errors: string[] = [];
    if (!item.barcode || item.barcode.length > 120 || /\s/.test(item.barcode)) {
      errors.push("Barkod boş, çok uzun veya boşluk içeriyor");
    }
    if (!item.name || item.name.length > 255) errors.push("Ürün adı eksik veya çok uzun");
    if (item.sku && item.sku.length > 120) errors.push("SKU çok uzun");
    if (item.max_order_limit !== null && (!Number.isSafeInteger(item.max_order_limit) || item.max_order_limit < 0)) {
      errors.push("Sipariş limiti geçersiz");
    }
    if ((fileBarcode.get(catalogCode(item.barcode)) || 0) > 1) errors.push("Dosyada barkod tekrarlanıyor");
    if (item.sku && (fileSku.get(catalogCode(item.sku)) || 0) > 1) errors.push("Dosyada SKU tekrarlanıyor");
    if ((fileName.get(catalogName(item.name) + ":" + String(item.is_consumable ?? false)) || 0) > 1) {
      errors.push("Dosyada ürün adı tekrarlanıyor");
    }

    const matches = new Map<string, { product: StoredCatalogProduct; fields: string[] }>();
    const add = (products: StoredCatalogProduct[], field: string) => {
      for (const product of products) {
        const current = matches.get(product.id) || { product, fields: [] };
        if (!current.fields.includes(field)) current.fields.push(field);
        matches.set(product.id, current);
      }
    };

    add(byBarcode.get(catalogCode(item.barcode)) || [], "Barkod");
    if (item.sku) add(bySku.get(catalogCode(item.sku)) || [], "SKU");
    add((byName.get(catalogName(item.name)) || []).filter((product) =>
      item.is_consumable === null || Boolean(product.is_consumable) === item.is_consumable
    ), "Ad");

    if (matches.size > 1) errors.push("Barkod, SKU veya ad farklı mevcut ürünlere ait");
    if (errors.length) return { incoming: item, status: "conflict", reason: errors.join("; ") };
    const found = [...matches.values()][0];
    if (found) {
      const reason = catalogCode(item.barcode) !== catalogCode(found.product.barcode)
        ? "Excel barkodu farklı; mevcut ürün barkodu korunacak"
        : undefined;
      return { incoming: item, status: "existing", existing: found.product, matchedOn: found.fields, reason };
    }
    return { incoming: item, status: "new" };
  });

  // Aynı kayıt, Excel'de farklı barkod/ad satırlarıyla iki kere eşleşirse otomatik güncelleme yapma.
  const targetCounts = new Map<string, number>();
  for (const row of review) if (row.existing) {
    targetCounts.set(row.existing.id, (targetCounts.get(row.existing.id) || 0) + 1);
  }
  return review.map((row) =>
    row.existing && (targetCounts.get(row.existing.id) || 0) > 1
      ? { ...row, status: "conflict" as const, existing: undefined, reason: "Birden çok Excel satırı aynı ürün kartına eşleşiyor" }
      : row
  );
}

export function catalogWritePayload(row: IncomingCatalogProduct, updating: boolean) {
  const payload: {
    name: string;
    barcode?: string;
    sku?: string | null;
    category?: string | null;
    image_url?: string | null;
    is_consumable?: boolean;
    max_order_limit?: number;
  } = { name: row.name };

  // Mevcut ürünün birincil barkodu ve boş bırakılan alanları değiştirilmez.
  if (!updating) payload.barcode = row.barcode;
  if (row.sku) payload.sku = row.sku;
  if (row.category) payload.category = row.category;
  if (row.image_url) payload.image_url = row.image_url;
  if (row.is_consumable !== null) payload.is_consumable = row.is_consumable;
  if (row.max_order_limit !== null) payload.max_order_limit = row.max_order_limit;

  if (!updating) {
    payload.sku ??= null;
    payload.category ??= null;
    payload.image_url ??= null;
    payload.is_consumable ??= false;
    payload.max_order_limit ??= 0;
  }
  return payload;
}
