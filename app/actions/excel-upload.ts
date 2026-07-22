"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadArasExcelToServer(parsedData: any[], employeeId: string) {
  try {
    if (!parsedData || parsedData.length === 0) {
      return { success: false, error: "Yüklenen Excel dosyası boş." };
    }

    // Sorunsuz çalışan orijinal map yapısı (Arama bug'ını önlemek için sadece string'lerde trim bırakıldı)
    const formattedData = parsedData.map((row) => ({
      shipment_number: row["Shipment number"]?.toString().trim() || null,
      customer_name: row["Customer name"]?.toString().trim() || null,
      email: row["Email"]?.toString().trim() || null,
      mobile_number: row["1st Mobile number"]?.toString().trim() || null,
      street: row["Street"]?.toString().trim() || null,
      street_2: row["Street 2"]?.toString().trim() || null,
      city: row["City"]?.toString().trim() || null,
      region: row["Region"]?.toString().trim() || null,
      postal_code: row["Postal Code"]?.toString().trim() || null,
      country: row["Country Code"]?.toString().trim() || null,
      customer_material: row["Customer material"]?.toString().trim() || null,
      sd_document: row["SD Document"]?.toString().trim() || null,
      delivery_number: row["Delivery number"]?.toString().trim() || null,
      material: row["Material"]?.toString().trim() || null,
      description_text: row["Text"]?.toString().trim() || null,
      
      // Standart ve stabil Number dönüşümü
      quantity: row["Quantity"] ? Number(row["Quantity"]) : null,
      uom: row["UoM"]?.toString().trim() || null,
      export_price: row["Export price"] ? Number(row["Export price"]) : null,
      export_price_currency: row["Export price currency"]?.toString().trim() || null,
      local_currency_rate: row["in local currency rate 53,29"] ? Number(row["in local currency rate 53,29"]) : null,
      country_of_origin: row["Country of origin"]?.toString().trim() || null,
      commodity_code: row["Commodity Code from Plant"]?.toString().trim() || null,
      net_weight_gm: row["Net Weight(gm)"] ? Number(row["Net Weight(gm)"]) : null,
      invoice_number: row["Invoice"]?.toString().trim() || null,
      
      is_processed_aras: false,
      uploaded_by: employeeId,
    }));

    const { error } = await supabaseAdmin
      .from("erp_raw_shipments")
      .insert(formattedData);

    if (error) {
      console.error("Bulk Insert Error:", error);
      return { success: false, error: `Veritabanına kayıt reddedildi: ${error.message}` };
    }

    revalidatePath("/management/cargo");
    return { success: true, count: formattedData.length };
    
  } catch (err: any) {
    return { success: false, error: "Sunucu tarafında veri işleme hatası." };
  }
}