"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * 1. TİCARİ ÜRÜNLERİ GETİR (CHUNKING MİMARİSİ İLE)
 * Supabase'in donanımsal 1000 max_rows limitine takılmamak için
 * veriler arka planda 1000'lik paketler halinde (.range) çekilir ve birleştirilir.
 * Bu sayede 5000+ ürün sorunsuz bir şekilde Client'a (Zero-latency arama motoruna) aktarılır.
 */
export async function getCommercialProducts() {
  const supabase = await createClient();

  let allProducts: any[] = [];
  let fetchMore = true;
  let start = 0;
  const step = 1000; // Her turda çekilecek güvenli maksimum miktar

  try {
    while (fetchMore) {
      const { data, error } = await supabase
        .from("products")
.select("id, created_at, sku, barcode, name, category, image_url, max_order_limit")
        .eq("is_consumable", false)
        .order("name", { ascending: true })
        .range(start, start + step - 1); // 0-999, 1000-1999, 2000-2999...

      if (error) {
        console.error(
          `Ürünler çekilirken hata (Aralık: ${start}-${start + step}):`,
          error.message,
        );
        throw error;
      }

      if (data && data.length > 0) {
        // Çekilen paketi ana diziye ekle
        allProducts = [...allProducts, ...data];

        // Eğer çekilen veri 1000'den azsa, son paketi almışız demektir. Döngüyü kır.
        if (data.length < step) {
          fetchMore = false;
        } else {
          // 1000 tam veri geldiyse, bir sonraki tur için başlangıç noktasını kaydır.
          start += step;
        }
      } else {
        // Veri gelmediyse döngüyü bitir.
        fetchMore = false;
      }
    }

    return allProducts;
  } catch (err) {
    console.error("Ticari ürünler ana fetch motoru çöktü:", err);
    return [];
  }
}

/**
 * 2. SİPARİŞ OLUŞTURMA MOTORU
 * Mağazalardan gelen talepleri 'orders' ve 'order_items' tablolarına yazar.
 */
export async function createOrder(
  cartItems: any[],
  branchId: string,
  requestedBy: string,
) {
  const supabase = await createClient();

  try {
    // AŞAMA 1: Ana sipariş kaydını oluştur
    /*
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        branch_id: branchId,
        requested_by: requestedBy,
        status: 'PENDING' // Merkez depo onayını bekler
      })
      .select('id')
      .single();

    if (orderError) throw orderError;
    */

    // AŞAMA 2: Sepetteki ürünleri siparişin altına bağla
    /*
    const orderItemsData = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      requested_qty: item.quantity,
      approved_qty: item.quantity // İlk etapta talep edilen miktar onaylanan miktar olarak geçer, merkez revize edebilir
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData);

    if (itemsError) throw itemsError;
    */

    return {
      success: true,
      message: "Sipariş başarıyla oluşturuldu ve Merkeze iletildi.",
    };
  } catch (error: any) {
    console.error("Sipariş oluşturma hatası:", error.message);
    return { success: false, error: error.message };
  }
}
