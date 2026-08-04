"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Service Role ile RLS kalkanlarını delen, tam yetkili Supabase Admin istemcisi
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * KALKAN DELİCİ MOTOR (PAGINATED FETCH LOOP)
 */
async function fetchAllRows(queryBuilder: any) {
  let allData: any[] = [];
  let from = 0;
  const step = 999;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryBuilder.range(from, from + step);
    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += step + 1;
      if (data.length <= step) hasMore = false; 
    } else {
      hasMore = false;
    }
  }
  return allData;
}

export async function getArasFiles() {
  try {
    const { data, error } = await supabaseAdmin
      .from("aras_files")
      .select("id, filename, created_at")
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: `Dosya Çekme Hatası: ${error.message}` };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: "Sunucu bağlantı hatası." };
  }
}

export async function deleteArasFile(fileId?: string) {
  try {
    if (fileId && fileId.trim() !== "") {
      const { error: err1 } = await supabaseAdmin.from("erp_raw_shipments").delete().eq("file_id", fileId);
      if (err1) return { success: false, error: `Kayıt Silme Hatası: ${err1.message}` };
      
      const { error: err2 } = await supabaseAdmin.from("aras_files").delete().eq("id", fileId);
      if (err2) return { success: false, error: `Dosya Silme Hatası: ${err2.message}` };
    } else {
      await supabaseAdmin.from("erp_raw_shipments").delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseAdmin.from("aras_files").delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    revalidatePath("/management/cargo");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: "Silme işlemi sırasında hata oluştu." };
  }
}

/**
 * BARKOD ARAMA MOTORU 
 * HATA DÜZELTİLDİ: "file_id" tablodan kaldırıldığı için Select sorgusundan da çıkarıldı.
 */
export async function getShipmentsByDeliveryNumber(deliveryNumber: string, fileId?: string) {
  try {
    let query = supabaseAdmin
      .from("erp_raw_shipments")
      .select("id, customer_name, mobile_number, street, street_2, city, region, postal_code, delivery_number, aras_tracking_number, is_processed_aras, sd_document")
      .ilike("delivery_number", `%${deliveryNumber.trim()}%`);

    // DİKKAT: Veritabanında file_id sütunu yoksa ve kullanıcı panelden dosya seçerse bu sorgu patlar.
    // Şimdilik sadece sütun eklendiyse çalışması için yoruma alabilirsin, ancak Profil bazlı filtreleme için DB'de file_id ŞART.
    if (fileId && fileId.trim() !== "") {
      query = query.eq("file_id", fileId);
    }

    const { data, error } = await query;
    
    // Hataları UI'a direkt gönderiyoruz ki maskelenmesin
    if (error) return { success: false, error: `DB SORGUSU ÇÖKTÜ: ${error.message}` };
    
    if (!data || data.length === 0) return { success: false, error: "SİPARİŞ BULUNAMADI! Barkodu kontrol edin." };

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: "Sunucu bağlantı hatası." };
  }
}

/**
 * BARKOD KAYDETME MOTORU 
 */
export async function saveArasTracking(deliveryNumber: string, trackingNumber: string, employeeId: string, fileId?: string) {
  try {
    let query = supabaseAdmin
      .from("erp_raw_shipments")
      .update({
        aras_tracking_number: trackingNumber.trim(),
        is_processed_aras: true,
        processed_at: new Date().toISOString(),
        uploaded_by: employeeId
      })
      .eq("delivery_number", deliveryNumber.trim());

    if (fileId && fileId.trim() !== "") {
      query = query.eq("file_id", fileId);
    }

    const { error } = await query;
    if (error) return { success: false, error: `KAYIT HATASI: ${error.message}` };

    revalidatePath("/management/cargo");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: "Sunucu bağlantı hatası." };
  }
}

export async function getKargoStats(fileId?: string) {
  try {
    let query = supabaseAdmin
      .from("erp_raw_shipments")
      .select("delivery_number, is_processed_aras, processed_at");

    if (fileId && fileId.trim() !== "") {
      query = query.eq("file_id", fileId);
    }

    const data = await fetchAllRows(query);

    const filesRes = await supabaseAdmin.from("aras_files").select("id", { count: 'exact' });
    const totalFiles = filesRes.count || 0;

    const uniqueAll = new Set();
    const uniqueProcessed = new Set();
    const uniqueToday = new Set();
    const todayStr = new Date().toISOString().split('T')[0];

    data.forEach(row => {
      uniqueAll.add(row.delivery_number);
      if (row.is_processed_aras) {
        uniqueProcessed.add(row.delivery_number);
        if (row.processed_at && row.processed_at.startsWith(todayStr)) {
          uniqueToday.add(row.delivery_number);
        }
      }
    });

    return {
      success: true,
      totalFiles: totalFiles,
      total: uniqueAll.size,
      processed: uniqueProcessed.size,
      today: uniqueToday.size
    };
  } catch (e: any) {
    console.error("Stats Error:", e);
    return { success: false, totalFiles: 0, total: 0, processed: 0, today: 0 };
  }
}

export async function getProcessedExportData(fileId?: string) {
  try {
    let query = supabaseAdmin
      .from("erp_raw_shipments")
      .select("delivery_number, aras_tracking_number")
      .eq("is_processed_aras", true)
      .order("processed_at", { ascending: false });

    if (fileId && fileId.trim() !== "") {
      query = query.eq("file_id", fileId);
    }

    const data = await fetchAllRows(query);
    
    const uniqueMap = new Map();
    data.forEach(item => {
       if (!uniqueMap.has(item.delivery_number)) {
           uniqueMap.set(item.delivery_number, item);
       }
    });

    return { success: true, data: Array.from(uniqueMap.values()) };
  } catch (err: any) {
    return { success: false, error: "Veri çekilemedi." };
  }
}

export async function getExactOriginalExportData(fileId?: string) {
  try {
    let query = supabaseAdmin
      .from("erp_raw_shipments")
      .select(`
        shipment_number, customer_name, email, mobile_number, street, street_2, 
        city, region, postal_code, country, customer_material, sd_document, 
        delivery_number, material, description_text, quantity, uom, 
        export_price, export_price_currency, local_currency_rate, 
        country_of_origin, commodity_code, net_weight_gm, invoice_number, 
        aras_tracking_number
      `)
      .order("created_at", { ascending: false });

    if (fileId && fileId.trim() !== "") {
      query = query.eq("file_id", fileId);
    }

    const data = await fetchAllRows(query);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: "Sunucu hatası." };
  }
}