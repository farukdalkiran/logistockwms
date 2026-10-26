"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import type { ListResult, OrderRow, Result } from "@/lib/order-approvals/types";

const STATES = ["PENDING", "PREPARING", "READY_TO_SHIP"] as const;

type FeedOrder = {
  id: string;
  order_code: string;
  branch_id: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  prepared_by_name: string | null;
  approval_branch_id: string | null;
};

/**
 * Read-only home feed for users assigned to Online Depo.
 * Unlike the approval center, this does not confer permission to approve an order.
 */
export async function getHomeWarehouseOrders(): Promise<Result<ListResult>> {
  try {
    const sessionClient = await createSessionClient();
    const { data: auth, error: authError } = await sessionClient.auth.getUser();
    if (authError || !auth.user) throw new Error("Oturum bulunamadı.");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secret) throw new Error("Sunucu bağlantı ayarları eksik.");
    const admin = createAdminClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles").select("branch_id")
      .eq("id", auth.user.id).single();
    if (profileError || !profile?.branch_id)
      throw new Error("Kullanıcıya bağlı depo bulunamadı.");
    const { data: branch, error: branchError } = await admin
      .from("branches").select("id,name,type")
      .eq("id", profile.branch_id).single();
    if (branchError || branch?.type !== "Depo" || branch.name !== "Online Depo")
      throw new Error("Bu alan yalnızca Online Depo kullanıcılarına açıktır.");

    const scope = (query: any) =>
      query.or("approval_branch_id.is.null,approval_branch_id.eq." + branch.id);

    const [orderResult, ...counts] = await Promise.all([
      scope(admin.from("orders").select(
        "id,order_code,branch_id,status,created_at,approved_at,prepared_by_name,approval_branch_id",
      )).in("status", [...STATES])
        .order("created_at", { ascending: false }).limit(50),
      ...STATES.map(status =>
        scope(admin.from("orders").select("id", { count: "exact", head: true }))
          .eq("status", status),
      ),
    ]);
    if (orderResult.error) throw new Error(orderResult.error.message);
    for (const count of counts) {
      if (count.error) throw new Error(count.error.message);
    }
    const orders = (orderResult.data ?? []) as FeedOrder[];
    const orderIds = orders.map(o => o.id);
    const branchIds = [...new Set(orders.map(o => o.branch_id).filter(Boolean))] as string[];

    const [itemResult, branchResult] = await Promise.all([
      orderIds.length
        ? admin.from("order_items")
          .select("order_id,product_id,requested_qty,approved_qty")
          .in("order_id", orderIds).range(0, 4999)
        : Promise.resolve({ data: [], error: null }),
      branchIds.length
        ? admin.from("branches").select("id,name").in("id", branchIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (itemResult.error) throw new Error(itemResult.error.message);
    if (branchResult.error) throw new Error(branchResult.error.message);

    const items = itemResult.data ?? [];
    const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))] as string[];
    const productsResult = productIds.length
      ? await admin.from("products").select("id,is_consumable").in("id", productIds)
      : { data: [], error: null };
    if (productsResult.error) throw new Error(productsResult.error.message);

    const productMap = new Map((productsResult.data ?? []).map(p => [p.id, p.is_consumable]));
    const branchMap = new Map((branchResult.data ?? []).map(b => [b.id, b.name]));
    const grouped = new Map<string, typeof items>();
    items.forEach(item => {
      const list = grouped.get(item.order_id) ?? [];
      list.push(item);
      grouped.set(item.order_id, list);
    });

    const rows: OrderRow[] = orders.map(o => {
      const details = grouped.get(o.id) ?? [];
      return {
        id: o.id,
        order_code: o.order_code,
        branch_id: o.branch_id,
        branch_name: (o.branch_id ? branchMap.get(o.branch_id) : null) || "Bilinmeyen şube",
        requester_name: "",
        status: o.status,
        created_at: o.created_at,
        approved_at: o.approved_at,
        prepared_by_name: o.prepared_by_name,
        item_count: details.length,
        requested_total: details.reduce((sum, i) => sum + Number(i.requested_qty || 0), 0),
        approved_total: details.reduce((sum, i) => sum + Number(i.approved_qty || 0), 0),
        has_product: details.some(i => i.product_id && productMap.get(i.product_id) === false),
        has_consumable: details.some(i => i.product_id && productMap.get(i.product_id) === true),
      };
    });
    return {
      ok: true,
      data: {
        rows, count: rows.length, page: 1,
        metrics: {
          pending: counts[0].count ?? 0,
          preparing: counts[1].count ?? 0,
          ready_to_ship: counts[2].count ?? 0,
          rejected: 0, pending_quantity: 0,
        },
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sipariş sorgusu başarısız.",
    };
  }
}
