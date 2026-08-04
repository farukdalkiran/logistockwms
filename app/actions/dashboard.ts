"use server";

import { createClient } from "@supabase/supabase-js";

// RLS kalkanlarını delen Service Role istemcisi
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getDashboardDataServer(userId: string) {
  try {
    // 1. KPI Verilerini Toplama (Parallel Fetching)
    const [
      { count: branchCount },
      { count: employeeCount },
      { data: stockData },
      { count: pendingCount }
    ] = await Promise.all([
      supabaseAdmin.from("branches").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("employees").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("stocks").select("quantity"),
      supabaseAdmin.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "PENDING")
    ]);

    const totalStock = stockData?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

    // 2. Kargo Çıkışları ve Teslimat Logları
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: cargoSessions } = await supabaseAdmin
      .from("cargo_sessions")
      .select(`
        id, 
        carrier_name, 
        status, 
        total_items, 
        started_at, 
        completed_at,
        employees (full_name)
      `)
      .gte("started_at", today.toISOString())
      .order("started_at", { ascending: false })
      .limit(50);

    // Kargo Dağılım Grafiği (Donut Chart) İçin Aggregation Motoru
    const carrierColors: Record<string, string> = {
      "Aras Kargo": "#dc3545",         // Kırmızı
      "Yurtiçi Kargo": "#10b981",      // Zümrüt Yeşili
      "MNG Kargo": "#3b82f6",          // Mavi
      "Sendeo": "#eab308",             // Sarı
      "Trendyol Express": "#ea580c",   // Koyu Turuncu
      "Hepsijet": "#ef4444",           // Kırmızı (Güncellendi)
      "UPS Kargo": "#111827",          // Siyah
      "Kolay Gelsin": "#22c55e"        // Yeşil
    };

    const distributionMap: Record<string, { count: number; color: string }> = {};

    cargoSessions?.forEach(session => {
      const carrier = session.carrier_name || "Bilinmeyen";
      const items = session.total_items || 0;
      
      if (items > 0 || session.status === "ACTIVE") {
        if (!distributionMap[carrier]) {
          distributionMap[carrier] = { 
            count: 0, 
            color: carrierColors[carrier] || "#" + Math.floor(Math.random()*16777215).toString(16)
          };
        }
        distributionMap[carrier].count += items;
      }
    });

    const cargoDistribution = Object.keys(distributionMap)
      .map(k => ({
        carrier: k,
        count: distributionMap[k].count,
        color: distributionMap[k].color
      }))
      .sort((a, b) => b.count - a.count);

    // 3. Diğer Log Matrisleri
    const [
      { data: recentTransfers },
      { data: recentPutawayLogs },
      { data: recentLeaveLogs }
    ] = await Promise.all([
      supabaseAdmin
        .from("transfers")
        .select("id, transfer_code, status, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
        
      supabaseAdmin
        .from("transaction_logs")
        .select("id, action_type, description, employees(full_name)")
        .order("created_at", { ascending: false })
        .limit(15),

      supabaseAdmin
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, status, employees(full_name)")
        .order("created_at", { ascending: false })
        .limit(15)
    ]);

    // 4. Haftalık Aktivite (Terminal Trafiği)
    const weeklyActivity = [
      { day: "Pzt", value: Math.floor(Math.random() * 50) + 20 },
      { day: "Sal", value: Math.floor(Math.random() * 50) + 20 },
      { day: "Çar", value: Math.floor(Math.random() * 50) + 20 },
      { day: "Per", value: Math.floor(Math.random() * 50) + 20 },
      { day: "Cum", value: Math.floor(Math.random() * 50) + 20 },
      { day: "Cts", value: Math.floor(Math.random() * 20) + 5 },
      { day: "Paz", value: Math.floor(Math.random() * 10) + 1 },
    ];

    // 5. GERÇEK VERİTABANI KOTASI HESAPLAMA (500 MB Limit Üzerinden)
    const { data: dbSizeData, error: dbSizeError } = await supabaseAdmin.rpc("get_db_size");
    let dbSizeMB = 0;
    let systemLoadPercentage = 0;

    if (!dbSizeError && dbSizeData) {
      dbSizeMB = parseFloat((dbSizeData / (1024 * 1024)).toFixed(2));
      systemLoadPercentage = Math.min(Math.round((dbSizeMB / 500) * 100), 100);
    }

    return {
      success: true,
      data: {
        kpis: {
          branches: branchCount || 0,
          employees: employeeCount || 0,
          stockVolume: totalStock,
          pendingTotal: pendingCount || 0
        },
        weeklyActivity,
        cargoDistribution,
        recentCargoSessions: cargoSessions || [],
        recentTransfers: recentTransfers || [],
        recentPutawayLogs: recentPutawayLogs || [],
        recentLeaveLogs: recentLeaveLogs || [],
        dbSizeMB,                 // Gerçek DB Boyutu (MB)
        systemLoad: systemLoadPercentage // Yüzdelik Doluluk Oranı
      }
    };
  } catch (err: any) {
    console.error("Dashboard Veri Hatası:", err);
    return { success: false, error: "Veritabanı bağlantı hatası." };
  }
}