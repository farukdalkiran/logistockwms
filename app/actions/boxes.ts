"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS for master execution
);

export type BoxInput = {
  box_barcode: string;
  product_id: string;
  quantity: number;
};

/**
 * Tekil Koli Barkodu Tanımlama (Safe & Bulletproof)
 */
export async function createBoxAction(input: BoxInput, employeeId: string) {
  try {
    const cleanBarcode = input.box_barcode.trim();

    // .single() tuzağı yerine array length kontrolü ile PGRST116 hatası engellendi
    const { data: existingBoxes, error: checkError } = await supabaseAdmin
      .from("boxes")
      .select("box_barcode")
      .eq("box_barcode", cleanBarcode);

    if (checkError) throw checkError;

    if (existingBoxes && existingBoxes.length > 0) {
      return { success: false, error: "Bu koli barkodu sistemde zaten tanımlı!" };
    }

    // Kayıt işlemi
    const { error } = await supabaseAdmin.from("boxes").insert([
      {
        box_barcode: cleanBarcode,
        product_id: input.product_id,
        quantity: input.quantity,
      },
    ]);

    if (error) throw error;

    // Kalıcı Sistem Logu
    await supabaseAdmin.from("transaction_logs").insert([
      {
        employee_id: employeeId,
        action_type: "BOX_CREATED",
        description: `Koli tanımlandı: Barkod: ${cleanBarcode}, Ürün ID: ${input.product_id}, Adet: ${input.quantity}`,
      },
    ]);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Koli oluşturulurken bir hata meydana geldi." };
  }
}

/**
 * Excel Üzerinden Toplu Koli Tanımlama (Mükerrer Atlamalı - Safe Upsert)
 */
export async function bulkCreateBoxesAction(boxes: BoxInput[], employeeId: string) {
  try {
    if (!boxes || boxes.length === 0) {
      return { success: false, error: "Yüklenecek veri bulunamadı." };
    }

    const sanitizedBoxes = boxes.map((b) => ({
      box_barcode: b.box_barcode.trim(),
      product_id: b.product_id,
      quantity: Number(b.quantity),
    }));

    // CRITICAL WMS FIX: insert yerine upsert + ignoreDuplicates kullanılarak 
    // sistemde zaten olan kolilerin hataya düşmeden es geçilmesi sağlandı.
    const { error } = await supabaseAdmin
      .from("boxes")
      .upsert(sanitizedBoxes, { onConflict: "box_barcode", ignoreDuplicates: true });

    if (error) throw error;

    // Toplu İşlem Logu
    await supabaseAdmin.from("transaction_logs").insert([
      {
        employee_id: employeeId,
        action_type: "BOX_BULK_UPLOAD",
        description: `Excel ile toplu koli enjeksiyonu yapıldı. Paket boyutu: ${sanitizedBoxes.length}`,
      },
    ]);

    return { success: true, count: sanitizedBoxes.length };
  } catch (err: any) {
    return { 
      success: false, 
      error: err.message || "Koli paket yazma kuyruğunda altyapı hatası."
    };
  }
}
/**
 * Koli Barkodu veya Adedi Güncelleme (Safe Update)
 */
export async function updateBoxAction(id: string, box_barcode: string, quantity: number, employeeId: string) {
  try {
    const cleanBarcode = box_barcode.trim();

    // Çift kayıt kontrolü (Kendi barkodu hariç, başka bir koli bu barkodu kullanıyor mu?)
    const { data: existingBox } = await supabaseAdmin
      .from("boxes")
      .select("id")
      .eq("box_barcode", cleanBarcode)
      .neq("id", id)
      .single();

    if (existingBox) {
      return { success: false, error: "Bu koli barkodu başka bir koli tarafından kullanılıyor!" };
    }

    const { error } = await supabaseAdmin
      .from("boxes")
      .update({
        box_barcode: cleanBarcode,
        quantity: quantity,
      })
      .eq("id", id);

    if (error) throw error;

    await supabaseAdmin.from("transaction_logs").insert([
      {
        employee_id: employeeId,
        action_type: "BOX_UPDATED",
        description: `Koli güncellendi. Yeni Adet: ${quantity}, Barkod: ${cleanBarcode}`,
      },
    ]);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Güncelleme başarısız." };
  }
}
/**
 * Koli Barkodu Silme (UUID id bazlı güvenli silme)
 */
export async function deleteBoxesAction(ids: string[], employeeId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("boxes")
      .delete()
      .in("id", ids);

    if (error) throw error;

    await supabaseAdmin.from("transaction_logs").insert([
      {
        employee_id: employeeId,
        action_type: "BOX_DELETED",
        description: `Koli ID'leri silindi: ${ids.join(", ")}`,
      },
    ]);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Silme işlemi başarısız." };
  }
}