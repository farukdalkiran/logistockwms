"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getDashboardDataServer(userId: string) {
  try {
    // 1. Şube ve Personel Haritasını (Dictionary) Oluştur (Join Hatalarını Önler)
    const [{ data: branches }, { data: employees }] = await Promise.all([
      supabaseAdmin.from("branches").select("id, name"),
      supabaseAdmin.from("employees").select("id, full_name")
    ]);
    
    const branchMap: Record<string, string> = {};
    branches?.forEach(b => { branchMap[b.id] = b.name; });

    const employeeMap: Record<string, string> = {};
    employees?.forEach(e => { employeeMap[e.id] = e.full_name; });

    // 2. Kapsamlı KPI Verileri (Koli ve Ürün Sayıları Eklendi)
    const [
      { count: branchCount },
      { count: employeeCount },
      { data: stockData },
      { count: pendingCount },
      { count: boxesCount },
      { count: productsCount }
    ] = await Promise.all([
      supabaseAdmin.from("branches").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("employees").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("stocks").select("quantity"),
      supabaseAdmin.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
      supabaseAdmin.from("boxes").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("products").select("*", { count: "exact", head: true })
    ]);

    const totalStock = stockData?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

    // 3. Kargo Dağılımları
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: cargoSessions } = await supabaseAdmin
      .from("cargo_sessions")
      .select(`id, carrier_name, status, total_items, started_at, completed_at, employee_id`)
      .gte("started_at", today.toISOString())
      .order("started_at", { ascending: false })
      .limit(50);

    const formattedCargoSessions = (cargoSessions || []).map(session => ({
      ...session,
      employee_name: employeeMap[session.employee_id] || "Bilinmiyor"
    }));

    const carrierColors: Record<string, string> = {
      "Aras Kargo": "#dc3545", "Yurtiçi Kargo": "#10b981", "MNG Kargo": "#3b82f6", 
      "Sendeo": "#eab308", "Trendyol Express": "#ea580c", "Hepsijet": "#ef4444", 
      "UPS Kargo": "#111827", "Kolay Gelsin": "#22c55e"
    };

    const distributionMap: Record<string, { count: number; color: string }> = {};
    formattedCargoSessions.forEach(session => {
      const carrier = session.carrier_name || "Bilinmeyen";
      const items = session.total_items || 0;
      if (items > 0 || session.status === "ACTIVE") {
        if (!distributionMap[carrier]) {
          distributionMap[carrier] = { count: 0, color: carrierColors[carrier] || "#94a3b8" };
        }
        distributionMap[carrier].count += items;
      }
    });

    const cargoDistribution = Object.keys(distributionMap)
      .map(k => ({ carrier: k, count: distributionMap[k].count, color: distributionMap[k].color }))
      .sort((a, b) => b.count - a.count);

    // 4. Transfer, Log ve İzin Verileri
    const [
      { data: rawTransfers },
      { data: rawPutawayLogs },
      { data: rawLeaveLogs }
    ] = await Promise.all([
      supabaseAdmin
        .from("transfers")
        .select(`id, transfer_code, from_branch_id, to_branch_id, status, created_at, picker_employee_id`)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("transaction_logs")
        .select(`id, action_type, description, employee_id`)
        .order("created_at", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("leave_requests")
        .select(`id, leave_type, start_date, end_date, status, employee_id`)
        .order("created_at", { ascending: false })
        .limit(10)
    ]);

    // Dictionary Map ile güvenli isim yerleştirme (İsim hatası çözüldü)
    const formattedTransfers = (rawTransfers || []).map(t => ({
      id: t.id,
      transfer_code: t.transfer_code,
      status: t.status,
      created_at: t.created_at,
      from_branch_name: branchMap[t.from_branch_id] || "Merkez Depo",
      to_branch_name: branchMap[t.to_branch_id] || "Bilinmeyen Şube",
      picker_name: employeeMap[t.picker_employee_id] || "Atanmadı"
    }));

    const formattedPutawayLogs = (rawPutawayLogs || []).map(l => ({
      id: l.id,
      action_type: l.action_type,
      description: l.description,
      employee_name: employeeMap[l.employee_id] || "Sistem"
    }));

    const formattedLeaveLogs = (rawLeaveLogs || []).map(l => ({
      id: l.id,
      leave_type: l.leave_type,
      start_date: l.start_date,
      end_date: l.end_date,
      status: l.status,
      employee_name: employeeMap[l.employee_id] || "Bilinmiyor"
    }));

    // 5. DB Kotası
    const { data: dbSizeData } = await supabaseAdmin.rpc("get_db_size");
    let dbSizeMB = 0;
    let systemLoad = 0;
    if (dbSizeData) {
      dbSizeMB = parseFloat((dbSizeData / (1024 * 1024)).toFixed(2));
      systemLoad = Math.min(Math.round((dbSizeMB / 500) * 100), 100);
    }

    return {
      success: true,
      data: {
        kpis: { 
          branches: branchCount || 0, 
          employees: employeeCount || 0, 
          stockVolume: totalStock, 
          pendingTotal: pendingCount || 0,
          boxesTotal: boxesCount || 0,
          productsTotal: productsCount || 0
        },
        cargoDistribution,
        recentCargoSessions: formattedCargoSessions,
        recentTransfers: formattedTransfers,
        recentPutawayLogs: formattedPutawayLogs,
        recentLeaveLogs: formattedLeaveLogs,
        dbSizeMB,
        systemLoad
      }
    };
  } catch (err) {
    console.error("Dashboard Veri Hatası:", err);
    return { success: false, error: "Veritabanı bağlantı hatası." };
  }
}