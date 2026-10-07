"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * 1. DİNAMİK ÜRÜN HAVUZU GETİRME (CHUNKING MİMARİSİ)
 * itemClass parametresi alır: 'B2B', 'CONSUMABLE', 'APPAREL' vs.
 */
export async function getCatalogByClass(itemClass: string = 'B2B') {
  const supabase = await createClient();

  let allProducts: any[] = [];
  let fetchMore = true;
  let start = 0;
  const step = 1000;

  try {
    while (fetchMore) {
      const { data, error } = await supabase
        .from("products")
        .select("id, created_at, sku, barcode, name, category, image_url, max_order_limit")
        .eq("item_class", itemClass) // Dinamik Ürün Sınıfı Filtresi
        .order("name", { ascending: true })
        .range(start, start + step - 1);

      if (error) {
        console.error(`[WMS_FETCH_DB_ERROR] Aralık: ${start}-${start + step} | Detay:`, error.message, error.hint);
        throw error;
      }

      if (data && data.length > 0) {
        allProducts = [...allProducts, ...data];
        if (data.length < step) {
          fetchMore = false;
        } else {
          start += step;
        }
      } else {
        fetchMore = false;
      }
    }

    return allProducts;
  } catch (err: any) {
    // WMS KURALI: Hatayı kör "{}" bırakma, mesajı ayrıştır
    const errorMessage = err?.message || err?.details || JSON.stringify(err);
    console.error(`[WMS_FETCH_CRASH] ${itemClass} motoru çöktü. Sebep:`, errorMessage);
    return [];
  }
}

// ... (createOrder fonksiyonun aşağıda aynı şekilde duracak)
/**
 * 2. SİPARİŞ OLUŞTURMA MOTORU (ZERO-TRUST SECURITY & GLOBAL BYPASS)
 * Mağazalardan gelen talepleri güvenli bir şekilde 'orders' ve 'order_items' tablolarına yazar.
 * Şube ve Kullanıcı ID'si Client'tan ALINMAZ, doğrudan Server Session'dan çözümlenir.
 */
export async function createOrder(cartItems: any[]) {
  const supabase = await createClient();

  try {
    // AŞAMA 1: Otorizasyon ve Oturum Kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");

    // AŞAMA 2: Profil ve Rol (Developer Bypass) Kontrolü
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("branch_id, role")
      .eq("id", user.id)
      .single();

    if (profileError) throw new Error("Kullanıcı profili okunamadı.");

    // Global Yetki Kontrolü (Developer veya Admin RLS'e takılmaz)
    const isGlobal = profile.role === 'Developer' || profile.role === 'Admin' || !profile.branch_id;

    if (!isGlobal && !profile.branch_id) {
      throw new Error("Güvenlik İhlali: Profilinize tanımlı bir şube (branch_id) bulunamadı.");
    }

    // WMS KURALI: Global yetkili (Faruk) sipariş oluşturuyorsa, DB şema kısıtlamasına (branch_id NOT NULL)
    // takılmaması için kendisini test edeceği geçici bir şubeye bağlaması gerekir.
    if (isGlobal && !profile.branch_id) {
      throw new Error("DEV_UYARI: Global yetkilisiniz ancak siparişin atanacağı bir şubeniz yok. Test için lütfen profilinize geçici bir branch_id tanımlayın.");
    }

    // AŞAMA 3: Ana Sipariş Kaydını Oluştur (Order Header)
    // NOT: order_code Sütununu GÖNDERMİYORUZ. DB'deki Sequence otomatik olarak ORD-1001, 1002 atayacak.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        branch_id: profile.branch_id,
        requested_by: user.id,
        status: 'PENDING' // Merkez depo onayını bekler
      })
      .select('id, order_code')
      .single();

    if (orderError || !order) {
      console.error("[WMS_ORDER_INSERT_ERROR]:", orderError);
      throw new Error(`Sipariş başlığı oluşturulamadı: ${orderError?.message}`);
    }

    // AŞAMA 4: Sepetteki Ürünleri (Order Items) Hazırlama
    const orderItemsData = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      requested_qty: item.quantity,
      approved_qty: 0 
    }));

    // AŞAMA 5: Sipariş Kalemlerini Toplu Yazma (Bulk Insert)
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData);

    // ROLLBACK MEKANİZMASI: Eğer kalemler yazılamazsa, ana siparişi silerek veritabanını temiz tut.
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      throw new Error(`Sipariş kalemleri oluşturulamadı, işlem geri alındı: ${itemsError.message}`);
    }

    return {
      success: true,
      message: `Sipariş Merkez Depo'ya iletildi. (Sipariş No: ${order.order_code})`,
      orderId: order.id
    };
  } catch (error: any) {
    console.error("[WMS_ORDER_CREATE_ERROR]:", error.message);
    return { success: false, error: error.message };
  }
}