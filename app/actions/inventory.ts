"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ----------------- RAFLAMA (PUTAWAY) MOTORU -----------------
export async function processPutawayServer(payload: {
  productId: string; branchId: string; shelfId: number; shelfName: string;
  quantity: number; empId: string; productDetails: any;
}) {
  try {
    const { data: existingStocks, error: fetchErr } = await supabaseAdmin
      .from("stocks").select("id, quantity")
      .eq("product_id", payload.productId).eq("branch_id", payload.branchId).eq("shelf_id", payload.shelfId)
      .order("last_activity_at", { ascending: true });

    if (fetchErr) throw new Error(`Stoklar okunamadı: ${fetchErr.message}`);

    if (existingStocks && existingStocks.length > 0) {
      const primaryStock = existingStocks[0];
      const duplicates = existingStocks.slice(1);
      const totalExisting = existingStocks.reduce((sum, s) => sum + s.quantity, 0);

      await supabaseAdmin.from("stocks").update({ 
          quantity: totalExisting + payload.quantity,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", primaryStock.id);

      if (duplicates.length > 0) {
        await supabaseAdmin.from("stocks").delete().in("id", duplicates.map(d => d.id));
      }
    } else {
      await supabaseAdmin.from("stocks").insert([{
          product_id: payload.productId, branch_id: payload.branchId,
          shelf_id: payload.shelfId, shelf_location: payload.shelfName, quantity: payload.quantity
      }]);
    }

    await supabaseAdmin.from("transaction_logs").insert([{
      employee_id: payload.empId, branch_id: payload.branchId, action_type: "INVENTORY_PUTAWAY",
      description: `RAFLAMA: ${payload.quantity} ADET [${payload.productDetails.barcode} - ${payload.productDetails.name}] -> RAF: ${payload.shelfName} (ID: ${payload.shelfId})`,
      new_value: `+${payload.quantity}`
    }]);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Sunucu hatası" };
  }
}


// ----------------- RAFTAN KALDIRMA (PICKING) MOTORU -----------------
export async function processPickingServer(payload: {
  productId: string; branchId: string; shelfId: number; shelfName: string;
  quantity: number; empId: string; productDetails: any; reasonDetails?: string | null;
}) {
  try {
    // 1. İlgili raftaki tüm kopya stokları çek
    const { data: stocks, error: fetchErr } = await supabaseAdmin
      .from("stocks").select("id, quantity")
      .eq("product_id", payload.productId).eq("branch_id", payload.branchId).eq("shelf_id", payload.shelfId)
      .order("last_activity_at", { ascending: true });

    if (fetchErr) throw new Error("Stok verisi alınamadı.");
    if (!stocks || stocks.length === 0) throw new Error("Stok Yok! Bu rafta bu ürün bulunmuyor.");

    // Toplam stoğu hesapla ve kontrol et
    const totalStock = stocks.reduce((sum, s) => sum + s.quantity, 0);
    if (totalStock < payload.quantity) throw new Error(`Yetersiz Stok! Rafta toplam ${totalStock} adet var.`);

    // 2. Miktarı satırlardan teker teker düş ve 0'a inenleri tamamen sil (Zombi Temizliği)
    let remainingToDeduct = payload.quantity;

    for (const stockRow of stocks) {
      if (remainingToDeduct <= 0) break;
      
      if (stockRow.quantity <= remainingToDeduct) {
        // Satırdaki tüm miktar tüketiliyor, veritabanından kalıcı olarak sil
        await supabaseAdmin.from("stocks").delete().eq("id", stockRow.id);
        remainingToDeduct -= stockRow.quantity;
      } else {
        // Satırda miktar kalıyor, sadece güncelleyerek bırak
        await supabaseAdmin.from("stocks").update({ 
          quantity: stockRow.quantity - remainingToDeduct,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", stockRow.id);
        remainingToDeduct = 0;
      }
    }

    // 3. İşlemi Logla
    let desc = `KALDIRMA: ${payload.quantity} ADET [${payload.productDetails.barcode} - ${payload.productDetails.name}] <- RAF: ${payload.shelfName} (ID: ${payload.shelfId})`;
    if (payload.reasonDetails) desc += ` | SEBEP: ${payload.reasonDetails}`;

    await supabaseAdmin.from("transaction_logs").insert([{
      employee_id: payload.empId,
      branch_id: payload.branchId,
      action_type: "INVENTORY_PICKING",
      description: desc,
      new_value: `-${payload.quantity}`
    }]);

    return { success: true };
  } catch (error: any) {
    console.error("Picking Server Error:", error);
    return { success: false, error: error.message || "Bilinmeyen sunucu hatası" };
  }
}

// ----------------- WMS SIFIR HATA STOK SORGULAMA (RLS BYPASS & İLK YÜKLEME) -----------------
export async function getAggregatedInventoryServer(searchTerm: string, branchId: string | null, isGlobal: boolean) {
  try {
    const keyword = searchTerm.trim().toLowerCase();
    
    let matchedProductIds: string[] = [];
    let matchedProductsData: any[] = [];

    // ADIM 1: Arama yapılıyorsa eşleşen ürünleri bul
    if (keyword) {
      const { data: pData } = await supabaseAdmin
        .from('products')
        .select('id, name, sku, barcode, category, is_consumable')
        .or(`barcode.ilike.%${keyword}%,sku.ilike.%${keyword}%,name.ilike.%${keyword}%`)
        .limit(100);
      
      if (pData && pData.length > 0) {
        matchedProductsData = pData;
        matchedProductIds = pData.map(p => p.id);
      } else {
        return []; // Arama var ama ürün yoksa boş dön
      }
    }

    // ADIM 2: Stokları Çek (Arama varsa o ürünler, yoksa TÜM STOKLAR)
    let stockQuery = supabaseAdmin
      .from('stocks')
      .select('product_id, quantity, shelf_id, shelf_location, shelves(status)');

    if (!isGlobal && branchId) {
      stockQuery = stockQuery.eq('branch_id', branchId);
    }

    if (keyword && matchedProductIds.length > 0) {
      stockQuery = stockQuery.in('product_id', matchedProductIds);
    }

    const { data: rawStocks, error: sError } = await stockQuery;
    if (sError) throw sError;

    // ADIM 3: Arama Yokken (Tüm Liste) Stoktaki Ürünlerin Bilgilerini Çek
    if (!keyword && rawStocks && rawStocks.length > 0) {
      const stockProductIds = [...new Set(rawStocks.map(s => s.product_id))];
      if (stockProductIds.length > 0) {
        const { data: allPData } = await supabaseAdmin
          .from('products')
          .select('id, name, sku, barcode, category, is_consumable')
          .in('id', stockProductIds);
        if (allPData) matchedProductsData = allPData;
      }
    }

    // ADIM 4: AGGREGATION (BİRLEŞTİRME VE HASAR TESPİTİ)
    const aggregatedMap = new Map();
    
    // Önce ürünleri yerleştir
    matchedProductsData.forEach(p => {
       aggregatedMap.set(p.id, {
          product_id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          is_consumable: p.is_consumable,
          total_quantity: 0,
          shelf_count: 0,
          has_damaged_shelf: false
       });
    });

    // Stokları üzerine ekle
    rawStocks?.forEach((stk: any) => {
       if (!aggregatedMap.has(stk.product_id)) return; // Ürün silinmiş ama stoku kalmışsa yoksay (Zombi)
       
       const existing = aggregatedMap.get(stk.product_id);
       existing.total_quantity += Number(stk.quantity) || 0;
       
       if (stk.shelf_location || stk.shelf_id) existing.shelf_count += 1;
       
       // Raf tablosu status "hasarli" ise bayrak kaldır
       if (stk.shelves && stk.shelves.status === 'hasarli') {
         existing.has_damaged_shelf = true;
       }
    });

    // Miktarı yüksek olanlar en üstte çıkacak şekilde sırala
    return Array.from(aggregatedMap.values()).sort((a, b) => b.total_quantity - a.total_quantity);

  } catch (error: any) {
    console.error("Envanter Arama Hatası (Server):", error.message);
    throw new Error("Stok bilgileri alınamadı.");
  }
}

// ----------------- WMS MODAL DATA FETCH (RLS BYPASS) -----------------
export async function getStockHistoryModalDataServer(
  productId: string, 
  branchId: string | null, 
  isGlobal: boolean, 
  searchKeyword: string
) {
  try {
    // 1. Ürünün Bulunduğu Aktif Rafları Çek
    let shelfQuery = supabaseAdmin
      .from('stocks')
      .select('shelf_location, quantity')
      .eq('product_id', productId)
      .gt('quantity', 0); // Sadece içinde stok olan rafları getir

    if (!isGlobal && branchId) {
      shelfQuery = shelfQuery.eq('branch_id', branchId);
    }
    
    const { data: shelfData, error: shelfErr } = await shelfQuery;
    if (shelfErr) console.error("Raf verisi çekme hatası:", shelfErr.message);

    // 2. İşlem Geçmişini (Logları) Çek
    let logQuery = supabaseAdmin
      .from('transaction_logs')
      .select(`
        id, created_at, action_type, description, new_value,
        employees (full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isGlobal && branchId) {
      logQuery = logQuery.eq('branch_id', branchId);
    }

    if (searchKeyword.length > 0) {
      logQuery = logQuery.ilike('description', `%${searchKeyword}%`);
    }

    const { data: logData, error: logErr } = await logQuery;
    if (logErr) console.error("Log verisi çekme hatası:", logErr.message);

    return {
      shelves: shelfData || [],
      logs: logData || []
    };

  } catch (error: any) {
    console.error("Modal Data Fetch Error:", error.message);
    return { shelves: [], logs: [] };
  }
}