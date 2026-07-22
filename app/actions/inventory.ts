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