"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import type { CatalogBox, CatalogProduct } from "@/lib/hamurlabs-transfer";

const ALLOWED_ROLES = new Set(["Developer", "Admin", "ADMNWH", "WAREHOUSE"]);
const PAGE_SIZE = 500;

export async function readHamurlabsCartonCatalog(): Promise<{
  products: CatalogProduct[];
  boxes: CatalogBox[];
}> {
  const session = await createSessionClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (!user || authError) throw new Error("Oturum süresi dolmuş. Tekrar giriş yapın.");

  const { data: profile, error: profileError } = await session.from("profiles")
    .select("role").eq("id", user.id).single();
  if (profileError || !profile || !ALLOWED_ROLES.has(profile.role)) {
    throw new Error("HamurLabs planlama modülü için depo yönetimi yetkisi gerekiyor.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Supabase sunucu bağlantısı yapılandırılmamış.");
  const admin = createAdminClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Read-only product and box catalog. Never read or change live depot stocks.
  // Pagination prevents Supabase's default 1,000-row response limit from dropping products.
  const products: CatalogProduct[] = [];
  const boxes: CatalogBox[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.from("products")
      .select("id,barcode,sku,name,alt_barcodes,is_active")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Ürün kartları yüklenemedi.");
    if (!data?.length) break;
    products.push(...data as CatalogProduct[]);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  offset = 0;
  for (;;) {
    const { data, error } = await admin.from("boxes")
      .select("product_id,quantity,id")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Koli içi adetleri yüklenemedi.");
    if (!data?.length) break;
    boxes.push(...data.map(row => ({ product_id: row.product_id, quantity: row.quantity })));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return { products, boxes };
}
