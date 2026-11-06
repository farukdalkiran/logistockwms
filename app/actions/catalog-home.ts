"use server";

import { createClient } from "@/lib/supabase/server";

// Bu modül yalnızca SELECT sorguları içerir; ürün ve koli düzenlemesi yapmaz.
export async function searchHomeCatalogAction(
  kind: "products" | "boxes",
  rawTerm: string,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Oturum doğrulanamadı.", items: [] };
    }
    if (kind !== "products" && kind !== "boxes") {
      return { success: false, error: "Geçersiz arama türü.", items: [] };
    }

    // PostgREST .or() filtreleri için özel sözdizimi karakterlerini ayıkla.
    const term = (typeof rawTerm === "string" ? rawTerm : "")
      .trim()
      .replace(/[^\p{L}\p{N}\s/_-]/gu, "")
      .slice(0, 80)
      .trim();

    if (term.length < 2) {
      return { success: true, items: [] };
    }

    const pattern = "%" + term.replace(/_/g, "") + "%";
    const numericId = /^\d{1,9}$/.test(term) ? String(Number(term)) : null;

    if (kind === "products") {
      const conditions = [
        "name.ilike." + pattern,
        "barcode.ilike." + pattern,
        "sku.ilike." + pattern,
      ];
      if (numericId) conditions.push("lgs_id.eq." + numericId);

      const { data, error } = await supabase
        .from("products")
        .select("id,name,barcode,sku,category,image_url,lgs_id,created_at,is_consumable")
        .or(conditions.join(","))
        .order("created_at", { ascending: false })
        .order("lgs_id", { ascending: false })
        .limit(25);
      if (error) throw error;
      return { success: true, items: data || [] };
    }

    // Koli barkodu / LGS ID ya da bağlı ürünün adı, SKU'su ve barkodu ile arama.
    const { data: matchedProducts, error: productError } = await supabase
      .from("products")
      .select("id")
      .or(
        [
          "name.ilike." + pattern,
          "sku.ilike." + pattern,
          "barcode.ilike." + pattern,
        ].join(","),
      )
      .limit(25);
    if (productError) throw productError;

    const conditions = ["box_barcode.ilike." + pattern];
    if (numericId) conditions.push("lgs_id.eq." + numericId);
    const productIds = (matchedProducts || []).map((product) => product.id);
    if (productIds.length > 0) {
      conditions.push("product_id.in.(" + productIds.join(",") + ")");
    }

    const { data, error } = await supabase
      .from("boxes")
      .select(
        "id,box_barcode,quantity,lgs_id,created_at,products(name,barcode,sku,image_url,lgs_id)",
      )
      .or(conditions.join(","))
      .order("created_at", { ascending: false })
      .order("lgs_id", { ascending: false })
      .limit(25);
    if (error) throw error;
    return {
      success: true,
      items: (data || []).map((box) => ({
        ...box,
        products: Array.isArray(box.products)
          ? (box.products[0] || null)
          : (box.products || null),
      })),
    };
  } catch (error) {
    console.error("Anasayfa katalog arama hatası:", error);
    return { success: false, error: "Arama sonuçları alınamadı.", items: [] };
  }
}
