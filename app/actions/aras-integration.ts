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

export async function getTodayProcessedCount() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("delivery_number")
      .eq("is_processed_aras", true)
      .gte("processed_at", `${today}T00:00:00.000Z`);

    if (error) return { success: false, count: 0 };
    
    const uniqueDeliveries = new Set(data.map(d => d.delivery_number));
    return { success: true, count: uniqueDeliveries.size };
  } catch (e) {
    return { success: false, count: 0 };
  }
}

// 2 KOLONLU EXCEL ÇIKTISI İÇİN: İşlenmiş (is_processed_aras = true) ve Tekil Kayıtlar
export async function getProcessedExportData() {
  try {
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("delivery_number, aras_tracking_number")
      .eq("is_processed_aras", true)
      .order("processed_at", { ascending: false });

    if (error) return { success: false, error: "Veri çekilemedi." };
    
    // Aynı Delivery Number defalarca excelle yazılmasın diye haritalama (Map) ile temizliyoruz
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