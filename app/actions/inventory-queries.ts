"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  aggregateInventory,
  logMatchesProduct,
  normalizeLog,
  shelfStatus,
  type ProductRow,
  type ShelfRow,
  type StockRow,
} from "@/lib/inventory-data";
import type { InventoryDetail, InventorySnapshot } from "@/lib/inventory-types";

const PAGE_SIZE = 500;
const productColumns = "id,name,sku,barcode,category,is_consumable,image_url";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function context() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serverKey)
    throw new Error("Supabase sunucu ayarları eksik.");
  const cookieStore = await cookies();
  const auth = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => {
        entries.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();
  if (error || !user)
    throw new Error("Oturum doğrulanamadı. Lütfen yeniden giriş yapın.");
  // The caller never supplies a branch or a role. Resolve both ownership and branch on the server.
  const admin = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error("Kullanıcı profili okunamadı.");
  if (!profile?.branch_id || !uuid.test(profile.branch_id))
    throw new Error(
      "Hesabınıza bir şube atanmadığı için stok görüntülenemiyor.",
    );
  const branchId: string = profile.branch_id;
  const { data: branch, error: branchError } = await admin
    .from("branches")
    .select("id,name")
    .eq("id", branchId)
    .single();
  if (branchError || !branch)
    throw new Error("Bağlı olduğunuz şube bulunamadı.");
  return {
    admin,
    branch: { id: String(branch.id), name: String(branch.name) },
  };
}

async function readStocks(
  client: SupabaseClient,
  branchId: string,
  productId?: string,
) {
  const rows: StockRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    let query = client
      .from("stocks")
      .select("id,product_id,branch_id,quantity,shelf_id,shelf_location")
      .eq("branch_id", branchId)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (productId) query = query.eq("product_id", productId);
    if (cursor !== null) query = query.gt("id", cursor);
    const { data, error } = await query.returns<StockRow[]>();
    if (error) throw new Error("Şube stokları okunamadı.");
    if (!data?.length) break;
    rows.push(...data);
    const next = data[data.length - 1].id;
    if (cursor !== null && next <= cursor)
      throw new Error("Stok sayfalaması tamamlanamadı.");
    cursor = next;
    // Continue even if a project-specific API row cap is smaller than PAGE_SIZE.
  }
  return rows;
}
async function readShelves(client: SupabaseClient, branchId: string) {
  const rows: ShelfRow[] = [];
  let cursor: number | null = null;
  for (;;) {
    let query = client
      .from("shelves")
      .select("id,branch_id,name,status")
      .eq("branch_id", branchId)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor !== null) query = query.gt("id", cursor);
    const { data, error } = await query.returns<ShelfRow[]>();
    if (error) throw new Error("Şube rafları okunamadı.");
    if (!data?.length) break;
    rows.push(...data);
    const next = data[data.length - 1].id;
    if (cursor !== null && next <= cursor)
      throw new Error("Raf sayfalaması tamamlanamadı.");
    cursor = next;
  }
  return rows;
}
async function readProducts(client: SupabaseClient, ids: string[]) {
  const rows: ProductRow[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    let cursor: string | null = null;
    for (;;) {
      let query = client
        .from("products")
        .select(productColumns)
        .in("id", chunk)
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (cursor !== null) query = query.gt("id", cursor);
      const { data, error } = await query.returns<ProductRow[]>();
      if (error) throw new Error("Ürün bilgileri okunamadı.");
      if (!data?.length) break;
      rows.push(...data);
      const next = data[data.length - 1].id;
      if (cursor !== null && next <= cursor)
        throw new Error("Ürün sayfalaması tamamlanamadı.");
      cursor = next;
    }
  }
  return rows;
}
async function readProductLogs(
  client: SupabaseClient,
  branchId: string,
  barcode: string | null,
) {
  if (!barcode) return [];
  const rows: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  const literal = barcode.replace(/[\\%_]/g, "\\$&");
  for (;;) {
    let query = client
      .from("transaction_logs")
      .select(
        "id,created_at,action_type,description,new_value,employees!transaction_logs_employee_id_fkey(full_name)",
      )
      .eq("branch_id", branchId)
      .in("action_type", ["INVENTORY_PUTAWAY", "INVENTORY_PICKING"])
      .like("description", `%[${literal} - %`)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor !== null) query = query.gt("id", cursor);
    const { data, error } = await query.returns<Record<string, unknown>[]>();
    if (error) throw new Error("Ürün hareket geçmişi okunamadı.");
    if (!data?.length) break;
    rows.push(...data);
    const next = String(data[data.length - 1].id);
    if (cursor !== null && next <= cursor)
      throw new Error("Hareket sayfalaması tamamlanamadı.");
    cursor = next;
  }
  return rows
    .filter((row) => logMatchesProduct(String(row.description || ""), barcode))
    .map(normalizeLog)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
}

export async function getInventorySnapshotServer(): Promise<InventorySnapshot> {
  const { admin, branch } = await context();
  const [stocks, shelves] = await Promise.all([
    readStocks(admin, branch.id),
    readShelves(admin, branch.id),
  ]);
  const ids = [
    ...new Set(
      stocks.flatMap((stock) => (stock.product_id ? [stock.product_id] : [])),
    ),
  ];
  const products = await readProducts(admin, ids);
  const data = aggregateInventory(branch.id, stocks, products, shelves);
  return {
    branch,
    ...data,
    shelves: shelves.map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      status: shelfStatus(shelf.status),
    })),
    loaded_at: new Date().toISOString(),
  };
}

export async function getInventoryProductDetailServer(
  productId: string,
): Promise<InventoryDetail> {
  if (typeof productId !== "string" || !uuid.test(productId))
    throw new Error("Geçersiz ürün bilgisi.");
  const { admin, branch } = await context();
  const [stocks, shelves, catalog] = await Promise.all([
    readStocks(admin, branch.id, productId),
    readShelves(admin, branch.id),
    readProducts(admin, [productId]),
  ]);
  const source = catalog[0];
  if (!source) throw new Error("Ürün bulunamadı.");
  const logs = await readProductLogs(admin, branch.id, source.barcode);
  if (!stocks.length && !logs.length)
    throw new Error(
      "Bu ürün için bağlı olduğunuz şubede stok veya hareket bulunamadı.",
    );
  const aggregated = aggregateInventory(branch.id, stocks, catalog, shelves)
    .products[0];
  const product = aggregated || {
    product_id: source.id,
    name: source.name,
    sku: source.sku,
    barcode: source.barcode,
    category: source.category,
    image_url: source.image_url,
    is_consumable: source.is_consumable === true,
    total_quantity: 0,
    shelf_count: 0,
    has_damaged_shelf: false,
    shelves: [],
    is_unlinked: false,
  };
  return { branch, product, logs, loaded_at: new Date().toISOString() };
}
