"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * LogiStock WMS inventory actions.
 * Existing exported function names and argument shapes are retained.
 * Quantity is the sum of stocks.quantity, NOT boxes.quantity.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BATCH_SIZE = 500;
const MAX_SEARCH_RESULTS = 20000;

type InventoryScope = { isGlobal: boolean; branchId: string | null };
type ProductRow = {
  id: string; name: string; sku: string | null; barcode: string;
  category: string | null; is_consumable: boolean | null;
};
type StockRow = {
  id: string; product_id: string | null; branch_id: string | null;
  shelf_id: number | null; shelf_location: string | null; quantity: number;
};
type ShelfRow = { id: number; name: string; status: string; branch_id: string };

type AggregatedInventoryRow = {
  product_id: string; name: string; sku: string | null; barcode: string;
  category: string | null; is_consumable: boolean; total_quantity: number;
  shelf_count: number; has_damaged_shelf: boolean;
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Bilinmeyen sunucu hatası";
}

async function getScope(): Promise<InventoryScope> {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) throw new Error("Oturum doğrulanamadı. Tekrar giriş yapın.");
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles").select("role,branch_id").eq("id", user.id).single();
  if (profileError || !profile) throw new Error("Kullanıcı profili bulunamadı.");
  const isGlobal = profile.role === "Developer" || profile.role === "Admin";
  const branchId: string | null = profile.branch_id ?? null;
  if (!isGlobal && !branchId) throw new Error("Kullanıcının şube yetkisi bulunmuyor.");
  return { isGlobal, branchId };
}

function enforceBranch(scope: InventoryScope, branchId: string) {
  if (!branchId) throw new Error("Şube seçilmedi.");
  if (!scope.isGlobal && scope.branchId !== branchId) {
    throw new Error("Bu şube için işlem yetkiniz bulunmuyor.");
  }
}

function validateQuantity(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Miktar sıfırdan büyük bir tam sayı olmalıdır.");
  }
}

async function validateMutation(payload: {
  productId: string; branchId: string; shelfId: number;
  quantity: number; empId: string;
}) {
  const scope = await getScope();
  enforceBranch(scope, payload.branchId);
  validateQuantity(payload.quantity);
  if (!payload.productId || !Number.isSafeInteger(payload.shelfId) || !payload.empId) {
    throw new Error("Ürün, raf veya personel bilgisi eksik.");
  }
  const [{ data: shelf, error: shelfError }, { data: product, error: productError }, { data: employee, error: employeeError }] = await Promise.all([
    supabaseAdmin.from("shelves").select("id,name,branch_id").eq("id", payload.shelfId).eq("branch_id", payload.branchId).single(),
    supabaseAdmin.from("products").select("id,name,barcode").eq("id", payload.productId).single(),
    supabaseAdmin.from("employees").select("id,branch_id").eq("id", payload.empId).single(),
  ]);
  if (shelfError || !shelf) throw new Error("Raf bulunamadı veya başka şubeye ait.");
  if (productError || !product) throw new Error("Ürün bulunamadı.");
  if (employeeError || !employee) throw new Error("Personel bulunamadı.");
  if (!scope.isGlobal && employee.branch_id !== payload.branchId) {
    throw new Error("Personel bu şubeye ait değil.");
  }
  return { shelf, product };
}

/**
 * Existing putaway signature is preserved. The shelf name and product details
 * are read from the database, not trusted from client payload.
 * NOTE: database writes are not atomic; see implementation notes below.
 */
export async function processPutawayServer(payload: {
  productId: string; branchId: string; shelfId: number; shelfName: string;
  quantity: number; empId: string; productDetails: any;
}) {
  try {
    const { shelf, product } = await validateMutation(payload);
    const { data: existing, error } = await supabaseAdmin
      .from("stocks").select("id,quantity")
      .eq("product_id", payload.productId)
      .eq("branch_id", payload.branchId)
      .eq("shelf_id", payload.shelfId)
      .order("id", { ascending: true });
    if (error) throw error;

    const now = new Date().toISOString();
    if (existing?.length) {
      const total = existing.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const { error: updateError } = await supabaseAdmin.from("stocks")
        .update({ quantity: total + payload.quantity, shelf_location: shelf.name,
          last_activity_at: now, updated_at: now })
        .eq("id", existing[0].id);
      if (updateError) throw updateError;
      const duplicates = existing.slice(1).map((row) => row.id);
      if (duplicates.length) {
        const { error: deleteError } = await supabaseAdmin.from("stocks")
          .delete().in("id", duplicates);
        if (deleteError) throw deleteError;
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from("stocks").insert({
        product_id: payload.productId, branch_id: payload.branchId,
        shelf_id: payload.shelfId, shelf_location: shelf.name, quantity: payload.quantity,
        last_activity_at: now, updated_at: now,
      });
      if (insertError) throw insertError;
    }
    const { error: logError } = await supabaseAdmin.from("transaction_logs").insert({
      employee_id: payload.empId, branch_id: payload.branchId,
      action_type: "INVENTORY_PUTAWAY",
      description: `RAFLAMA: ${payload.quantity} ADET [${product.barcode} - ${product.name}] -> RAF: ${shelf.name} (ID: ${shelf.id})`,
      new_value: `+${payload.quantity}`,
    });
    if (logError) throw new Error(`Stok işlendi fakat log kaydedilemedi: ${logError.message}`);
    return { success: true };
  } catch (error) {
    console.error("Putaway Server Error:", error);
    return { success: false, error: message(error) };
  }
}

/** Existing picking signature is preserved. */
export async function processPickingServer(payload: {
  productId: string; branchId: string; shelfId: number; shelfName: string;
  quantity: number; empId: string; productDetails: any; reasonDetails?: string | null;
}) {
  try {
    const { shelf, product } = await validateMutation(payload);
    const { data: stocks, error } = await supabaseAdmin.from("stocks")
      .select("id,quantity")
      .eq("product_id", payload.productId)
      .eq("branch_id", payload.branchId)
      .eq("shelf_id", payload.shelfId)
      .order("id", { ascending: true });
    if (error) throw error;
    if (!stocks?.length) throw new Error("Bu rafta ürün bulunmuyor.");
    const total = stocks.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    if (total < payload.quantity) throw new Error(`Yetersiz stok: rafta ${total} adet var.`);

    let remaining = payload.quantity;
    for (const row of stocks) {
      if (remaining <= 0) break;
      const rowQty = Number(row.quantity || 0);
      if (rowQty <= remaining) {
        const { error: deleteError } = await supabaseAdmin.from("stocks")
          .delete().eq("id", row.id);
        if (deleteError) throw deleteError;
        remaining -= rowQty;
      } else {
        const now = new Date().toISOString();
        const { error: updateError } = await supabaseAdmin.from("stocks")
          .update({ quantity: rowQty - remaining,
            last_activity_at: now, updated_at: now })
          .eq("id", row.id);
        if (updateError) throw updateError;
        remaining = 0;
      }
    }

    let description = `KALDIRMA: ${payload.quantity} ADET [${product.barcode} - ${product.name}] <- RAF: ${shelf.name} (ID: ${shelf.id})`;
    if (payload.reasonDetails?.trim()) {
      description += ` | SEBEP: ${payload.reasonDetails.trim()}`;
    }
    const { error: logError } = await supabaseAdmin.from("transaction_logs").insert({
      employee_id: payload.empId, branch_id: payload.branchId,
      action_type: "INVENTORY_PICKING", description,
      new_value: `-${payload.quantity}`,
    });
    if (logError) throw new Error(`Stok düşüldü fakat log kaydedilemedi: ${logError.message}`);
    return { success: true };
  } catch (error) {
    console.error("Picking Server Error:", error);
    return { success: false, error: message(error) };
  }
}

async function fetchAllProducts(): Promise<ProductRow[]> {
  const output: ProductRow[] = [];
  for (let offset = 0; offset < MAX_SEARCH_RESULTS; offset += BATCH_SIZE) {
    const { data, error } = await supabaseAdmin.from("products")
      .select("id,name,sku,barcode,category,is_consumable")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) throw new Error(`Ürün sorgusu: ${error.message}`);
    const batch = (data || []) as ProductRow[];
    output.push(...batch);
    if (batch.length < BATCH_SIZE) return output;
  }
  throw new Error("Ürün sorgusu güvenlik sınırına ulaştı. Sunucu tarafında sayfalama genişletilmeli.");
}

async function fetchAllStocks(scope: InventoryScope, productId?: string): Promise<StockRow[]> {
  const output: StockRow[] = [];
  for (let offset = 0; offset < MAX_SEARCH_RESULTS; offset += BATCH_SIZE) {
    let query = supabaseAdmin.from("stocks")
      .select("id,product_id,branch_id,shelf_id,shelf_location,quantity")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (!scope.isGlobal) query = query.eq("branch_id", scope.branchId!);
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) throw new Error(`Stok sorgusu: ${error.message}`);
    const batch = (data || []) as StockRow[];
    output.push(...batch);
    if (batch.length < BATCH_SIZE) return output;
  }
  throw new Error("Stok sorgusu güvenlik sınırına ulaştı. Sunucu tarafında sayfalama genişletilmeli.");
}

async function fetchAllShelves(scope: InventoryScope): Promise<ShelfRow[]> {
  const output: ShelfRow[] = [];
  for (let offset = 0; offset < MAX_SEARCH_RESULTS; offset += BATCH_SIZE) {
    let query = supabaseAdmin.from("shelves")
      .select("id,name,status,branch_id")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (!scope.isGlobal) query = query.eq("branch_id", scope.branchId!);
    const { data, error } = await query;
    if (error) throw new Error(`Raf sorgusu: ${error.message}`);
    const batch = (data || []) as ShelfRow[];
    output.push(...batch);
    if (batch.length < BATCH_SIZE) return output;
  }
  throw new Error("Raf sorgusu sınırına ulaştı.");
}

/**
 * Returns complete product catalogue, including zero-stock products.
 * Search matches name, barcode and SKU in Turkish-insensitive form.
 * Important: for large catalogues prefer a database-side search RPC.
 */
export async function getAggregatedInventoryServer(
  searchTerm: string, _branchId: string | null, _isGlobal: boolean
): Promise<AggregatedInventoryRow[]> {
  try {
    const scope = await getScope();
    const [products, stocks, shelves] = await Promise.all([
      fetchAllProducts(), fetchAllStocks(scope), fetchAllShelves(scope),
    ]);
    const shelvesById = new Map(shelves.map((row) => [row.id, row]));
    const summary = new Map<string, {
      quantity: number; shelfIds: Set<string>; damaged: boolean;
    }>();
    for (const stock of stocks) {
      if (!stock.product_id) continue;
      const current = summary.get(stock.product_id) ?? {
        quantity: 0, shelfIds: new Set<string>(), damaged: false,
      };
      const qty = Number(stock.quantity) || 0;
      current.quantity += qty;
      if (qty > 0) {
        const shelf = stock.shelf_id == null ? undefined : shelvesById.get(stock.shelf_id);
        const distinctShelf = stock.shelf_id == null
          ? `location:${stock.branch_id}:${stock.shelf_location || "UNASSIGNED"}`
          : `id:${stock.shelf_id}`;
        current.shelfIds.add(distinctShelf);
        if (shelf?.status === "hasarli") current.damaged = true;
      }
      summary.set(stock.product_id, current);
    }

    const keyword = searchTerm.trim().toLocaleLowerCase("tr-TR");
    const result: AggregatedInventoryRow[] = [];
    for (const product of products) {
      if (keyword) {
        const match = [product.name, product.sku, product.barcode]
          .some((field) => String(field || "").toLocaleLowerCase("tr-TR").includes(keyword));
        if (!match) continue;
      }
      const item = summary.get(product.id);
      result.push({
        product_id: product.id,
        name: product.name || "İsimsiz Ürün",
        sku: product.sku,
        barcode: product.barcode,
        category: product.category,
        is_consumable: Boolean(product.is_consumable),
        total_quantity: item?.quantity ?? 0,
        shelf_count: item?.shelfIds.size ?? 0,
        has_damaged_shelf: item?.damaged ?? false,
      });
    }
    return result.sort((a, b) =>
      b.total_quantity - a.total_quantity || a.name.localeCompare(b.name, "tr")
    );
  } catch (error) {
    console.error("Inventory query error:", error);
    throw new Error(`Stok bilgileri alınamadı: ${message(error)}`);
  }
}

/**
 * Reads shelf balances and movement logs for the specific product.
 * Log matching uses the product barcode token in the formatted description;
 * name keyword is intentionally not used because it generates false matches.
 */
export async function getStockHistoryModalDataServer(
  productId: string, _branchId: string | null,
  _isGlobal: boolean, _searchKeyword: string
) {
  try {
    const scope = await getScope();
    if (!productId) throw new Error("Ürün kimliği eksik.");
    const [{ data: product, error: productError }, stocks] = await Promise.all([
      supabaseAdmin.from("products").select("barcode").eq("id", productId).single(),
      fetchAllStocks(scope, productId),
    ]);
    if (productError || !product) throw new Error("Ürün bulunamadı.");
    const shelves = await fetchAllShelves(scope);
    const byId = new Map(shelves.map((shelf) => [shelf.id, shelf.name]));
    const locationTotals = new Map<string, number>();
    for (const stock of stocks) {
      if (stock.quantity <= 0) continue;
      const shelfName = (stock.shelf_id === null ? null : byId.get(stock.shelf_id))
        || stock.shelf_location || "Raf Tanımsız";
      const key = scope.isGlobal ? `${stock.branch_id || "-"} / ${shelfName}` : shelfName;
      locationTotals.set(key, (locationTotals.get(key) || 0) + Number(stock.quantity));
    }
    const shelfData = Array.from(locationTotals, ([shelf_location, quantity]) => ({
      shelf_location, quantity,
    })).sort((a, b) => b.quantity - a.quantity);

    // Logs store no product_id, so use barcode as the product-specific
    // identifier between '[' and ' - ', with server-side branch restriction.
    const rawLogs: any[] = [];
    if (product.barcode) {
      const escapedBarcode = String(product.barcode).replace(/[%_\\]/g, "\\$&");
      for (let offset = 0; offset < MAX_SEARCH_RESULTS; offset += BATCH_SIZE) {
        let query = supabaseAdmin.from("transaction_logs")
          .select("id,created_at,action_type,description,new_value,employees(full_name)")
          .in("action_type", ["INVENTORY_PUTAWAY", "INVENTORY_PICKING"])
          .ilike("description", `%[${escapedBarcode} - %`)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);
        if (!scope.isGlobal) query = query.eq("branch_id", scope.branchId!);
        const { data, error } = await query;
        if (error) throw new Error(`Hareket sorgusu: ${error.message}`);
        const batch = data || [];
        rawLogs.push(...batch);
        if (batch.length < BATCH_SIZE) break;
        if (offset + BATCH_SIZE >= MAX_SEARCH_RESULTS) {
          throw new Error("Hareket sorgusu kayıt sınırına ulaştı.");
        }
      }
    }
    // Confirm exact barcode identity even for unusual barcode characters.
    const barcode = String(product.barcode || "");
    const logData = rawLogs.filter((log) => {
      const desc = String(log.description || "");
      const match = desc.match(/\[([^\]]+)\]/);
      return Boolean(match && match[1].startsWith(`${barcode} - `));
    });

    return { shelves: shelfData, logs: logData };
  } catch (error) {
    console.error("Inventory modal error:", error);
    throw new Error(`Stok detayları alınamadı: ${message(error)}`);
  }
}
