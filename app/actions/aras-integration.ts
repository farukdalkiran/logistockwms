"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getShipmentsByDeliveryNumber(deliveryNumber: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("id, customer_name, mobile_number, street, street_2, city, region, postal_code, delivery_number, aras_tracking_number, is_processed_aras, sd_document")
      .ilike("delivery_number", `%${deliveryNumber}%`);

    if (error) return { success: false, error: "Veritabanı sorgu hatası." };
    if (!data || data.length === 0) return { success: false, error: "Sipariş bulunamadı. Excel verisini kontrol edin." };

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: "Sunucu bağlantı hatası." };
  }
}

export async function saveArasTracking(deliveryNumber: string, trackingNumber: string, employeeId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .update({
        aras_tracking_number: trackingNumber,
        is_processed_aras: true,
        processed_at: new Date().toISOString(),
        uploaded_by: employeeId
      })
      .eq("delivery_number", deliveryNumber);

    if (error) return { success: false, error: "Kayıt güncellenemedi." };

    revalidatePath("/management/cargo");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: "Sunucu bağlantı hatası." };
  }
}

// 3'LÜ KPI İSTATİSTİK MOTORU (Toplam, İşlenen, Bugün)
export async function getKargoStats() {
  try {
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("delivery_number, is_processed_aras, processed_at");

    if (error) throw error;

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
      total: uniqueAll.size,
      processed: uniqueProcessed.size,
      today: uniqueToday.size
    };
  } catch (e) {
    return { success: false, total: 0, processed: 0, today: 0 };
  }
}

// TÜM KAYITLARI SİLEN KRİTİK WIPE MOTORU
export async function wipeAllShipments() {
  try {
    const { error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); 

    if (error) return { success: false, error: "Silme işlemi başarısız oldu." };
    
    revalidatePath("/management/cargo");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: "Sunucu bağlantı hatası." };
  }
}

// 2 KOLONLU EXCEL ÇIKTISI
export async function getProcessedExportData() {
  try {
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("delivery_number, aras_tracking_number")
      .eq("is_processed_aras", true)
      .order("processed_at", { ascending: false });

    if (error) return { success: false, error: "Veri çekilemedi." };
    
    const uniqueMap = new Map();
    data.forEach(item => {
       if (!uniqueMap.has(item.delivery_number)) {
           uniqueMap.set(item.delivery_number, item);
       }
    });

    return { success: true, data: Array.from(uniqueMap.values()) };
  } catch (err: any) {
    return { success: false, error: "Sunucu hatası." };
  }
}

// ORİJİNAL ŞABLON ÇIKTISI
export async function getExactOriginalExportData() {
  try {
    const { data, error } = await supabaseAdmin
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

    if (error) return { success: false, error: "Veri çekilemedi." };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: "Sunucu hatası." };
  }
}