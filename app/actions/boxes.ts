"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const EDITOR_ROLES = new Set(["Developer", "Admin", "ADMNWH", "WAREHOUSE"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BoxInput = {
  box_barcode: string;
  product_id: string;
  quantity: number;
};

async function requireCatalogEditor() {
  const client = await createSessionClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error("Oturum doğrulanamadı. Yeniden giriş yapın.");

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role, employee_id, branch_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile || !EDITOR_ROLES.has(profile.role)) {
    throw new Error("Bu işlem için depo yönetimi yetkisi gerekiyor.");
  }
  return { userId: user.id, employeeId: profile.employee_id || null, branchId: profile.branch_id || null };
}

function validateBox(input: BoxInput): BoxInput {
  const barcode = String(input?.box_barcode ?? "").trim().toUpperCase();
  const quantity = Number(input?.quantity);
  if (!barcode || barcode.length > 120 || !/^[^\s]+$/.test(barcode)) {
    throw new Error("Dış koli barkodu boşluk içermeyen en fazla 120 karakter olmalıdır.");
  }
  if (!UUID_PATTERN.test(String(input?.product_id || ""))) {
    throw new Error("Geçerli bir ürün kimliği seçilmelidir.");
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
    throw new Error("Koli adedi 1 ile 1.000.000 arasında tam sayı olmalıdır.");
  }
  return { box_barcode: barcode, product_id: input.product_id, quantity };
}

function publicError(error: unknown) {
  const err = error as { code?: string; message?: string };
  if (err?.code === "23505") return "Bu barkod zaten kayıtlı. Mevcut koli kartını kullanın.";
  if (err?.code === "23503") return "Ürün kartı bulunamadı. Önce ürün tanımlayın.";
  if (err?.code === "23514") return "Barkod veya adet geçersiz.";
  return err?.message || "İşlem sırasında bir hata oluştu.";
}

async function writeLog(actor: Awaited<ReturnType<typeof requireCatalogEditor>>, action: string, description: string) {
  const { error } = await supabaseAdmin.from("transaction_logs").insert({
    employee_id: actor.employeeId,
    branch_id: actor.branchId,
    action_type: action,
    description: `Oturum: ${actor.userId}. ${description}`,
  });
  if (error) console.error("Koli işlem günlüğü yazılamadı:", error.code);
}

export async function createBoxAction(input: BoxInput, _legacyEmployeeId?: string) {
  try {
    const actor = await requireCatalogEditor();
    const safe = validateBox(input);
    const { data, error } = await supabaseAdmin
      .from("boxes").insert(safe).select("id").single();
    if (error) throw error;
    await writeLog(actor, "BOX_CREATED", `Koli tanımlandı: ${safe.box_barcode}, ürün: ${safe.product_id}, adet: ${safe.quantity}, kayıt: ${data.id}`);
    return { success: true, count: 1 };
  } catch (err: unknown) {
    return { success: false, error: publicError(err) };
  }
}

export async function bulkCreateBoxesAction(boxes: BoxInput[], _legacyEmployeeId?: string) {
  try {
    const actor = await requireCatalogEditor();
    if (!Array.isArray(boxes) || !boxes.length || boxes.length > 250) {
      throw new Error("Her toplu işlem 1-250 koli içermelidir.");
    }
    const sanitized = boxes.map(validateBox);
    const seen = new Set<string>();
    for (const item of sanitized) {
      if (seen.has(item.box_barcode)) throw new Error(`Excel'de tekrar eden koli barkodu: ${item.box_barcode}`);
      seen.add(item.box_barcode);
    }
    // INSERT: mevcut koli kartını asla güncelleme ve çakışmayı gizleme.
    // Veri tabanındaki UNIQUE kısıtları eş zamanlı istekleri de engeller.
    const { data, error } = await supabaseAdmin
      .from("boxes").insert(sanitized).select("id");
    if (error) throw error;
    const count = data?.length || 0;
    await writeLog(actor, "BOX_BULK_UPLOAD", `Excel'den ${count} yeni koli kaydedildi.`);
    return { success: true, count };
  } catch (err: unknown) {
    return { success: false, error: publicError(err), count: 0 };
  }
}

export async function updateBoxAction(id: string, box_barcode: string, quantity: number, _legacyEmployeeId?: string) {
  try {
    const actor = await requireCatalogEditor();
    if (!UUID_PATTERN.test(id)) throw new Error("Geçersiz koli kaydı.");
    const safe = validateBox({ product_id: "00000000-0000-4000-8000-000000000000", box_barcode, quantity });
    const { data, error } = await supabaseAdmin.from("boxes")
      .update({ box_barcode: safe.box_barcode, quantity: safe.quantity })
      .eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error("Güncellenecek koli kaydı bulunamadı.");
    await writeLog(actor, "BOX_UPDATED", `Koli ${id} güncellendi: ${safe.box_barcode}, adet ${safe.quantity}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: publicError(err) };
  }
}

export async function deleteBoxesAction(ids: string[], _legacyEmployeeId?: string) {
  try {
    const actor = await requireCatalogEditor();
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 200 || ids.some((id) => !UUID_PATTERN.test(id))) {
      throw new Error("Geçersiz koli kayıtları. En fazla 200 kayıt seçilebilir.");
    }
    const uniqueIds = [...new Set(ids)];
    const { data, error } = await supabaseAdmin.from("boxes")
      .delete().in("id", uniqueIds).select("id");
    if (error) throw error;
    const deleted = data?.length || 0;
    if (deleted !== uniqueIds.length) throw new Error(`${deleted} koli silindi; bazı kayıtlar artık mevcut değil.`);
    await writeLog(actor, "BOX_DELETED", `${deleted} koli silindi. Kayıtlar: ${uniqueIds.join(", ")}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: publicError(err) };
  }
}
