"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_FILTERS,
  STATUS_GROUPS,
  type Filters,
  type ListResult,
  type Order,
  type Result,
} from "@/lib/my-orders/types";

async function connection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret)
    throw new Error("Supabase sunucu bağlantı ayarları eksik.");
  const jar = await cookies();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, options),
        ),
    },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new Error("Oturumunuz sona erdi. Yeniden giriş yapınız.");
  return {
    actor: data.user.id,
    admin: createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Sipariş bilgileri alınamadı. Lütfen yeniden deneyiniz.";
}
function dateValid(value: string) {
  if (typeof value !== "string") return false;
  if (!value) return true;
  const d = new Date(value + "T00:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === value
  );
}
function validate(input: Filters) {
  if (!input || typeof input.search !== "string" || input.search.length > 120)
    throw new Error("Arama en fazla 120 karakter olabilir.");
  if (!Object.prototype.hasOwnProperty.call(STATUS_GROUPS, input.status))
    throw new Error(
      "Sipariş durumu filtresi geçersiz. Tüm durumlar seçeneğiyle yeniden deneyiniz.",
    );
  if (!["ALL", "PRODUCT", "CONSUMABLE", "MIXED"].includes(input.kind))
    throw new Error("Sipariş türü filtresi geçersiz.");
  if (
    !["newest", "oldest"].includes(input.sort) ||
    ![10, 20, 50].includes(input.pageSize) ||
    !Number.isSafeInteger(input.page) ||
    input.page < 1 ||
    input.page > 1000000
  )
    throw new Error("Sıralama veya sayfalama bilgisi geçersiz.");
  if (
    !dateValid(input.from) ||
    !dateValid(input.to) ||
    (input.from && input.to && input.from > input.to)
  )
    throw new Error("Başlangıç ve bitiş tarihlerini kontrol ediniz.");
}
export async function getMyOrders(input: Filters): Promise<Result<ListResult>> {
  try {
    validate(input);
    const { admin, actor } = await connection();
    const { data, error } = await admin.rpc("wms_my_orders", {
      p_actor: actor,
      p_filter: input,
      p_order: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, data: data as ListResult };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
export async function getMyOrderDetail(
  orderId: string,
): Promise<Result<{ order: Order; branchName: string }>> {
  try {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderId,
      )
    )
      throw new Error("Geçersiz sipariş numarası.");
    const { admin, actor } = await connection();
    const { data, error } = await admin.rpc("wms_my_orders", {
      p_actor: actor,
      p_filter: DEFAULT_FILTERS,
      p_order: orderId,
    });
    if (error) throw new Error(error.message);
    const result = data as ListResult;
    if (!result.rows[0]) throw new Error("Sipariş bulunamadı.");
    return {
      ok: true,
      data: { order: result.rows[0], branchName: result.branch.name },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Mağaza teslim onayı; aktör kimliği, şube ve mevcut durum sunucuda doğrulanır. */
export async function confirmMyOrderReceived(orderId: string): Promise<Result<{ deliveredAt: string }>> {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId))
      throw new Error("Geçersiz sipariş numarası.");
    const { actor, admin } = await connection();
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("branch_id").eq("id", actor).single();
    if (profileError || !profile?.branch_id)
      throw new Error("Teslim onayı için bağlı bir mağaza bulunamadı.");
    const { data: branch, error: branchError } = await admin
      .from("branches").select("type").eq("id", profile.branch_id).single();
    if (branchError || branch?.type !== "Mağaza")
      throw new Error("Siparişi yalnızca talep eden mağaza teslim alabilir.");
    const { data, error } = await admin.from("orders")
      .update({ status: "DELIVERED", delivered_at: new Date().toISOString(), received_by: actor })
      .eq("id", orderId)
      .eq("branch_id", profile.branch_id)
      .eq("status", "READY_TO_SHIP")
      .select("delivered_at").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.delivered_at)
      throw new Error("Sipariş mağazanıza ait değil veya teslim onayı beklemiyor. Listeyi yenileyin.");
    return { ok: true, data: { deliveredAt: data.delivered_at as string } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
