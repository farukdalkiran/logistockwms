"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getShipmentsByDeliveryNumber(deliveryNumber: string) {
  try {
    // WMS KURALI: Aynı siparişe (delivery_number) ait birden fazla kalem olabilir.
    // Tüm eşleşen kayıtları çekiyoruz.
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("id, customer_name, mobile_number, street, street_2, city, region, postal_code, delivery_number, aras_tracking_number, is_processed_aras, sd_document")
      .ilike("delivery_number", `%${deliveryNumber}%`);

    if (error) {
      console.error("Arama Hatası:", error.message);
      return { success: false, error: "Veritabanı sorgu hatası." };
    }

    if (!data || data.length === 0) {
      return { success: false, error: "Sipariş bulunamadı. Excel verisini kontrol edin." };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: "Sunucu bağlantı hatası." };
  }
}

export async function saveArasTracking(deliveryNumber: string, trackingNumber: string, employeeId: string) {
  try {
    // WMS KURALI: ID yerine delivery_number kullanarak tüm eşleşen kalemleri (satırları) aynı anda güncelliyoruz.
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

export async function getProcessedExportData() {
  try {
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("delivery_number, aras_tracking_number")
      .eq("is_processed_aras", true)
      .order("processed_at", { ascending: false });

    if (error) return { success: false, error: "Veri çekilemedi." };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: "Sunucu hatası." };
  }
}

// YENİ: Tüm Veritabanı Kolonlarını İndiren Fonksiyon
export async function getFullProcessedExportData() {
  try {
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("*")
      .eq("is_processed_aras", true)
      .order("processed_at", { ascending: false });

    if (error) return { success: false, error: "Tam veri çekilemedi." };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: "Sunucu hatası." };
  }
}