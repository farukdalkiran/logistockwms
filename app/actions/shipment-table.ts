"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getShipmentsForTable(searchQuery: string = "", filterStatus: "all" | "pending" | "processed" = "all") {
  try {
    let query = supabaseAdmin
      .from("erp_raw_shipments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100); // WMS performansı için son 100 kaydı alıyoruz

    if (searchQuery) {
      // Hem Delivery No hem de Müşteri Adında arama yap
      query = query.or(`delivery_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%`);
    }

    if (filterStatus === "pending") {
      query = query.eq("is_processed_aras", false);
    } else if (filterStatus === "processed") {
      query = query.eq("is_processed_aras", true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error("Table Fetch Error:", err.message);
    return { success: false, error: "Veriler çekilemedi." };
  }
}