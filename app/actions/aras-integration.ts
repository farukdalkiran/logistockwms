"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getShipmentByDeliveryNumber(deliveryNumber: string) {
  try {
    // WMS Kuralı: ERP çıktılarında aynı delivery_number'a ait birden fazla 
    // satır (farklı ürün kalemleri) olabileceği için .single() metodu reddedilir.
    // Bunun yerine .limit(1) ile ilk eşleşen kaydı güvenle alıyoruz.
    const { data, error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .select("id, customer_name, mobile_number, street, street_2, city, region, postal_code, delivery_number, aras_tracking_number, is_processed_aras")
      .ilike("delivery_number", `%${deliveryNumber}%`)
      .limit(1);

    if (error) {
      console.error("Arama Hatası:", error.message);
      return { success: false, error: "Veritabanı sorgu hatası." };
    }

    // data.length kontrolü ile sıfır kayıt durumunu yakalıyoruz
    if (!data || data.length === 0) {
      return { success: false, error: "Sipariş bulunamadı. Excel verisini kontrol edin." };
    }

    return { success: true, data: data[0] }; // İlk eşleşen kaydı (Object olarak) döndür
  } catch (err: any) {
    return { success: false, error: "Sunucu bağlantı hatası." };
  }
}

// app/actions/aras-integration.ts içindeki saveArasTracking fonksiyonu:

export async function saveArasTracking(deliveryNumber: string, trackingNumber: string, employeeId: string) {
  try {
    // WMS KURALI: Aynı siparişe (delivery_number) ait birden fazla kalem olabilir.
    // ID yerine delivery_number kullanarak tüm eşleşen kalemleri (satırları) aynı anda güncelliyoruz.
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