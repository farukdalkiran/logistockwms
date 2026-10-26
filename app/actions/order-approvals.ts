"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type {
  Context,
  Decision,
  Filters,
  ListResult,
  OrderDetail,
  Result,
} from "@/lib/order-approvals/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorized() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secret)
    throw new Error("Supabase sunucu bağlantı ayarları eksik.");
  const jar = await cookies();
  const userClient = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, options),
        );
      },
    },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user)
    throw new Error("Oturumunuz sona ermiş. Yeniden giriş yapınız.");
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,branch_id")
    .eq("id", data.user.id)
    .single();
  if (
    profileError ||
    !profile?.branch_id ||
    !["ADMIN", "DEVELOPER", "ADMNWH"].includes(profile.role.toUpperCase())
  )
    throw new Error(
      "Sipariş onay yönetimi için depo yöneticisi yetkisi gerekiyor.",
    );
  // Every RPC also checks the persisted role and warehouse type.
  return { admin, actor: data.user.id };
}

function message(e: unknown) {
  return e instanceof Error
    ? e.message
    : "İşlem tamamlanamadı. Lütfen yeniden deneyiniz.";
}
function validDate(value: string) {
  if (!value) return true;
  const d = new Date(value + "T00:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === value
  );
}

export async function getApprovalContext(): Promise<Result<Context>> {
  try {
    const { admin, actor } = await authorized();
    const { data, error } = await admin.rpc("wms_approval_context", {
      p_actor: actor,
    });
    if (error) throw new Error(error.message);
    return { ok: true, data: data as Context };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function getApprovalOrders(
  input: Filters,
): Promise<Result<ListResult>> {
  try {
    if (
      !input ||
      typeof input.search !== "string" ||
      input.search.length > 120 ||
      !["ALL", "PENDING", "PREPARING", "READY_TO_SHIP", "DELIVERED", "REJECTED"].includes(
        input.status,
      ) ||
      !["ALL", "PRODUCT", "CONSUMABLE", "MIXED"].includes(input.kind) ||
      !["oldest", "newest", "quantity"].includes(input.sort) ||
      ![10, 20, 50].includes(input.pageSize) ||
      !Number.isSafeInteger(input.page) ||
      input.page < 1 ||
      input.page > 1000000 ||
      (input.branch && !UUID.test(input.branch)) ||
      !validDate(input.from) ||
      !validDate(input.to) ||
      (input.from && input.to && input.from > input.to)
    )
      throw new Error("Filtreleri ve tarih aralığını kontrol ediniz.");
    const { admin, actor } = await authorized();
    const { data, error } = await admin.rpc("wms_list_approvals", {
      p_actor: actor,
      p_filter: input,
    });
    if (error) throw new Error(error.message);
    return { ok: true, data: data as ListResult };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function getApprovalDetail(
  orderId: string,
): Promise<Result<OrderDetail>> {
  try {
    if (!UUID.test(orderId)) throw new Error("Geçersiz sipariş.");
    const { admin, actor } = await authorized();
    const { data, error } = await admin.rpc("wms_approval_detail", {
      p_actor: actor,
      p_order: orderId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, data: data as OrderDetail };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function decideApproval(
  input: Decision,
): Promise<Result<{ id: string; status: string }>> {
  try {
    if (
      !input ||
      !UUID.test(input.orderId) ||
      !["APPROVE", "REJECT"].includes(input.action) ||
      typeof input.employeeId !== "string" ||
      !/^\d{1,5}$/.test(input.employeeId.trim()) ||
      typeof input.note !== "string" ||
      input.note.length > 2000 ||
      !Array.isArray(input.items) ||
      input.items.length > 5000
    )
      throw new Error("Sipariş ve personel bilgilerini kontrol ediniz.");
    if (
      input.items.some(
        (i) =>
          !UUID.test(i.id) ||
          !Number.isSafeInteger(i.qty) ||
          i.qty < 0 ||
          i.qty > 2147483647 ||
          typeof i.reason !== "string" ||
          i.reason.length > 500,
      )
    )
      throw new Error("Ürün miktarlarını ve gerekçeleri kontrol ediniz.");
    const { admin, actor } = await authorized();
    const { data, error } = await admin.rpc("wms_decide_approval", {
      p_actor: actor,
      p_order: input.orderId,
      p_employee: input.employeeId.trim(),
      p_action: input.action,
      p_items: input.items,
      p_note: input.note.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, data: data as { id: string; status: string } };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}


/**
 * Compatibility action for the existing /management/orders/store-orders form.
 * Uses the SAME authenticated approval RPC as the main approvals screen.
 * The client does not decide the trusted order quantities or warehouse identity.
 */
export async function processOrderApproval(
  formData: FormData,
): Promise<
  | { success: true; message: string; error?: never }
  | { success: false; error: string; message?: never }
> {
  try {
    const id = String(formData.get("order_id") ?? "");
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const note = String(formData.get("review_note") ?? "").trim();
    const intent = String(formData.get("intent") ?? "review");
    const warehouseId = String(formData.get("warehouse_id") ?? "");

    if (!UUID.test(id)) throw new Error("Sipariş kimliği geçersiz.");
    if (!/^\d{1,5}$/.test(employeeId))
      throw new Error("İşlemi yapan personelin 1-5 haneli sicil numarasını girin.");
    if (note.length > 2000) throw new Error("İşlem notu çok uzun.");
    if (intent !== "review" && intent !== "approve_all")
      throw new Error("Geçersiz onay işlemi.");

    // The warehouse used by wms_decide_approval is taken from the
    // authenticated actor, NOT from the untrusted HTML form.
    const context = await getApprovalContext();
    if (!context.ok) throw new Error(context.error);
    if (warehouseId && warehouseId !== context.data.warehouseId)
      throw new Error(
        "Seçilen depo, yetkili olduğunuz depo ile eşleşmiyor. Onay merkezinden doğru depoyu kullanın.",
      );

    const detail = await getApprovalDetail(id);
    if (!detail.ok) throw new Error(detail.error);
    if (detail.data.status !== "PENDING")
      throw new Error("Bu sipariş artık onay beklemiyor. Listeyi yenileyin.");
    if (!detail.data.items.length)
      throw new Error("Onaylanacak ürün kalemi bulunamadı.");

    const items = detail.data.items.map((item) => {
      const requested = item.requested_qty;
      if (!Number.isSafeInteger(requested) || requested < 0)
        throw new Error("Sipariş kalem miktarı geçersiz.");

      const choice =
        intent === "approve_all"
          ? "APPROVE"
          : String(formData.get("decision_" + item.id) ?? "APPROVE");
      if (!["APPROVE", "REVISE", "REMOVE"].includes(choice))
        throw new Error("Ürün kararı geçersiz.");

      let qty = requested;
      if (choice === "REMOVE") qty = 0;
      if (choice === "REVISE") {
        const raw = String(formData.get("qty_" + item.id) ?? "");
        if (!/^\d+$/.test(raw))
          throw new Error("Revize miktarı sıfır veya pozitif tam sayı olmalı.");
        qty = Number(raw);
      }
      if (!Number.isSafeInteger(qty) || qty < 0 || qty > requested)
        throw new Error("Onay miktarı talep edilen adedi aşamaz.");

      const selectedReason = String(
        formData.get("reason_" + item.id) ?? "",
      ).trim();
      const extra = String(formData.get("note_" + item.id) ?? "").trim();
      const reason =
        qty === requested
          ? ""
          : selectedReason === "Diğer"
            ? extra
              ? "Diğer: " + extra
              : ""
            : [selectedReason, extra].filter(Boolean).join(" — ");
      if (qty < requested && !reason)
        throw new Error("Azaltılan veya kaldırılan ürün için gerekçe belirtin.");
      if (reason.length > 500)
        throw new Error("Ürün revizyon gerekçesi 500 karakteri aşamaz.");

      return { id: item.id, qty, reason };
    });

    const decision = await decideApproval({
      orderId: id,
      employeeId,
      action: "APPROVE",
      items,
      note,
    });
    if (!decision.ok) throw new Error(decision.error);

    revalidatePath("/management/orders/store-orders");
    revalidatePath("/management/orders/approvals");
    revalidatePath("/management/orders/myorders");
    return { success: true, message: "Sipariş kararı başarıyla kaydedildi." };
  } catch (error) {
    return { success: false, error: message(error) };
  }
}
