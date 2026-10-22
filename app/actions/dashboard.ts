// app/actions/dashboard.ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 1. VERİTABANI SORGULARINI YAPAN ÇEKİRDEK FONKSİYON
async function fetchDashboardDataCore(userId: string) {
  // 0. Giriş Yapan Kullanıcının Profil ve Şube Yetkisini Çözümle
  const { data: userProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, branch_id")
    .eq("id", userId)
    .single();

  const isGlobal =
    !userProfile ||
    userProfile.role === "Developer" ||
    userProfile.role === "Admin" ||
    !userProfile.branch_id;

  const targetBranchId = isGlobal ? null : userProfile.branch_id;

  // 1. Şube ve Personel Haritasını Oluştur (Sadece İlgili Şube veya Global)
  let empQuery = supabaseAdmin
    .from("employees")
    .select("id, full_name, branch_id, is_active");

  if (targetBranchId) {
    empQuery = empQuery.eq("branch_id", targetBranchId);
  }

  const [{ data: branches }, { data: employees }] = await Promise.all([
    supabaseAdmin.from("branches").select("id, name"),
    empQuery,
  ]);

  const branchMap: Record<string, string> = {};
  branches?.forEach((b) => {
    branchMap[b.id] = b.name;
  });

  const employeeMap: Record<string, string> = {};
  const branchEmployeeIds: string[] = [];

  employees?.forEach((e) => {
    employeeMap[e.id] = e.full_name;
    if (!targetBranchId || e.branch_id === targetBranchId) {
      branchEmployeeIds.push(e.id);
    }
  });

  // 2. Kapsamlı KPI Verileri (Şube İzolasyonlu)
  let branchCountQuery = supabaseAdmin
    .from("branches")
    .select("id", { count: "exact", head: true });
  if (targetBranchId)
    branchCountQuery = branchCountQuery.eq("id", targetBranchId);

  let empCountQuery = supabaseAdmin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (targetBranchId)
    empCountQuery = empCountQuery.eq("branch_id", targetBranchId);

  // Sadece quantity sütununu ve 0'dan büyükleri çekerek payload'u küçültüyoruz
  let stockQuery = supabaseAdmin
    .from("stocks")
    .select("quantity")
    .gt("quantity", 0);
  if (targetBranchId) stockQuery = stockQuery.eq("branch_id", targetBranchId);

  let pendingLeaveQuery = supabaseAdmin
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING");
  if (targetBranchId) {
    pendingLeaveQuery =
      branchEmployeeIds.length > 0
        ? pendingLeaveQuery.in("employee_id", branchEmployeeIds)
        : pendingLeaveQuery.eq("employee_id", "00000");
  }

  const [
    { count: branchCount },
    { count: employeeCount },
    { data: stockData },
    { count: pendingCount },
    { count: boxesCount },
    { count: productsCount },
  ] = await Promise.all([
    branchCountQuery,
    empCountQuery,
    stockQuery,
    pendingLeaveQuery,
    supabaseAdmin.from("boxes").select("box_barcode", { count: "exact", head: true }),
    supabaseAdmin.from("products").select("id", { count: "exact", head: true }),
  ]);

  const totalStock =
    stockData?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;

  // 3. Kargo Dağılımları (Giriş Yapılan Şube Personellerine Göre İzole)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cargoQuery = supabaseAdmin
    .from("cargo_sessions")
    .select(
      "id, carrier_name, status, total_items, started_at, completed_at, employee_id",
    )
    .gte("started_at", today.toISOString())
    .order("started_at", { ascending: false })
    .limit(50);

  if (targetBranchId) {
    cargoQuery =
      branchEmployeeIds.length > 0
        ? cargoQuery.in("employee_id", branchEmployeeIds)
        : cargoQuery.eq("employee_id", "00000");
  }

  // 4. Transfer, Log ve İzin Verileri (Şube İzolasyonlu)
  let transfersQuery = supabaseAdmin
    .from("transfers")
    .select(
      "id, transfer_code, from_branch_id, to_branch_id, status, created_at, picker_employee_id",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (targetBranchId) {
    transfersQuery = transfersQuery.or(
      `from_branch_id.eq.${targetBranchId},to_branch_id.eq.${targetBranchId}`,
    );
  }

  let putawayLogsQuery = supabaseAdmin
    .from("transaction_logs")
    .select("id, action_type, description, employee_id, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  if (targetBranchId) {
    putawayLogsQuery =
      branchEmployeeIds.length > 0
        ? putawayLogsQuery.in("employee_id", branchEmployeeIds)
        : putawayLogsQuery.eq("employee_id", "00000");
  }

  let leaveLogsQuery = supabaseAdmin
    .from("leave_requests")
    .select("id, leave_type, start_date, end_date, status, employee_id")
    .order("created_at", { ascending: false })
    .limit(10);

  if (targetBranchId) {
    leaveLogsQuery =
      branchEmployeeIds.length > 0
        ? leaveLogsQuery.in("employee_id", branchEmployeeIds)
        : leaveLogsQuery.eq("employee_id", "00000");
  }

  // Tüm listeleri ve DB boyutunu tek paralel blokta çekiyoruz
  const [
    { data: cargoSessions },
    { data: rawTransfers },
    { data: rawPutawayLogs },
    { data: rawLeaveLogs },
    { data: dbSizeData },
  ] = await Promise.all([
    cargoQuery,
    transfersQuery,
    putawayLogsQuery,
    leaveLogsQuery,
    supabaseAdmin.rpc("get_db_size"),
  ]);

  // Çapraz şube transferlerinde başka şube personelinin adı geçiyorsa sadece eksikleri tamamla
  if (targetBranchId && rawTransfers) {
    const missingEmpIds = rawTransfers
      .map((t) => t.picker_employee_id)
      .filter((id) => id && !employeeMap[id]);

    if (missingEmpIds.length > 0) {
      const { data: extraEmps } = await supabaseAdmin
        .from("employees")
        .select("id, full_name")
        .in("id", Array.from(new Set(missingEmpIds)));
      extraEmps?.forEach((e) => {
        employeeMap[e.id] = e.full_name;
      });
    }
  }

  const formattedCargoSessions = (cargoSessions || []).map((session) => ({
    ...session,
    employee_name: employeeMap[session.employee_id] || "Bilinmiyor",
  }));

  const carrierColors: Record<string, string> = {
    "Aras Kargo": "#dc3545",
    "Yurtiçi Kargo": "#10b981",
    "MNG Kargo": "#3b82f6",
    Sendeo: "#eab308",
    "Trendyol Express": "#ea580c",
    Hepsijet: "#ef4444",
    "UPS Kargo": "#111827",
    "Kolay Gelsin": "#22c55e",
  };

  const distributionMap: Record<string, { count: number; color: string }> = {};
  formattedCargoSessions.forEach((session) => {
    const carrier = session.carrier_name || "Bilinmeyen";
    const items = session.total_items || 0;
    if (items > 0 || session.status === "ACTIVE") {
      if (!distributionMap[carrier]) {
        distributionMap[carrier] = {
          count: 0,
          color: carrierColors[carrier] || "#94a3b8",
        };
      }
      distributionMap[carrier].count += items;
    }
  });

  const cargoDistribution = Object.keys(distributionMap)
    .map((k) => ({
      carrier: k,
      count: distributionMap[k].count,
      color: distributionMap[k].color,
    }))
    .sort((a, b) => b.count - a.count);

  const formattedTransfers = (rawTransfers || []).map((t) => ({
    id: t.id,
    transfer_code: t.transfer_code,
    status: t.status,
    created_at: t.created_at,
    from_branch_name: branchMap[t.from_branch_id] || "Merkez Depo",
    to_branch_name: branchMap[t.to_branch_id] || "Bilinmeyen Şube",
    picker_name: employeeMap[t.picker_employee_id] || "Atanmadı",
  }));

  const formattedPutawayLogs = (rawPutawayLogs || []).map((l) => ({
    id: l.id,
    action_type: l.action_type,
    description: l.description,
    created_at: l.created_at,
    employee_name: employeeMap[l.employee_id] || "Sistem",
  }));

  const formattedLeaveLogs = (rawLeaveLogs || []).map((l) => ({
    id: l.id,
    leave_type: l.leave_type,
    start_date: l.start_date,
    end_date: l.end_date,
    status: l.status,
    employee_name: employeeMap[l.employee_id] || "Bilinmiyor",
  }));

  let dbSizeMB = 0;
  let systemLoad = 0;
  if (dbSizeData) {
    dbSizeMB = parseFloat((dbSizeData / (1024 * 1024)).toFixed(2));
    systemLoad = Math.min(Math.round((dbSizeMB / 500) * 100), 100);
  }

  return {
    kpis: {
      branches: branchCount || 0,
      employees: employeeCount || 0,
      stockVolume: totalStock,
      pendingTotal: pendingCount || 0,
      boxesTotal: boxesCount || 0,
      productsTotal: productsCount || 0,
    },
    cargoDistribution,
    recentCargoSessions: formattedCargoSessions,
    recentTransfers: formattedTransfers,
    recentPutawayLogs: formattedPutawayLogs,
    recentLeaveLogs: formattedLeaveLogs,
    dbSizeMB,
    systemLoad,
  };
}

// 2. SUNUCU BELLEKLEME KATMANI (60 Saniye Boyunca DB'yi Yormaz)
const getCachedDashboardData = unstable_cache(
  async (userId: string) => fetchDashboardDataCore(userId),
  ["logistock-dashboard-cache"],
  { revalidate: 60 }
);

export async function getDashboardDataServer(
  userId: string,
  forceRefresh = false
) {
  try {
    if (!userId) {
      return { success: false, error: "Kullanıcı oturumu bulunamadı." };
    }

    const data = forceRefresh
      ? await fetchDashboardDataCore(userId)
      : await getCachedDashboardData(userId);

    return { success: true, data };
  } catch (err) {
    console.error("Dashboard Veri Hatası:", err);
    return { success: false, error: "Veritabanı bağlantı hatası." };
  }
}

// ============================================================================
// TRANSFER DETAY MOTORU (NOKTA ATIŞI SORGU - TÜM TABLOLARI ÇEKMEZ)
// ============================================================================
export async function getTransferDetailsServer(transferId: string) {
  try {
    if (!transferId) {
      return { success: false, error: "Transfer ID belirtilmedi." };
    }

    // 1. Ana Transfer Kaydını Çek
    const { data: transfer, error: txError } = await supabaseAdmin
      .from("transfers")
      .select("*")
      .eq("id", transferId)
      .single();

    if (txError || !transfer) {
      return { success: false, error: "Transfer kaydı bulunamadı." };
    }

    // 2. Sadece Bu Transfere Ait Kalemleri, Logları, İlgili 2 Şubeyi ve Kargo Firmasını Çek
    const branchIdsToFetch = [
      transfer.from_branch_id,
      transfer.to_branch_id,
    ].filter(Boolean);

    const [
      { data: branches },
      { data: carrierData },
      { data: rawItems },
      { data: txLogs },
    ] = await Promise.all([
      branchIdsToFetch.length > 0
        ? supabaseAdmin
            .from("branches")
            .select("id, name, type")
            .in("id", branchIdsToFetch)
        : Promise.resolve({ data: [] }),
      transfer.carrier_id
        ? supabaseAdmin
            .from("carriers")
            .select("id, name, type, contact_info")
            .eq("id", transfer.carrier_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("transfer_items")
        .select("*")
        .eq("transfer_id", transferId),
      supabaseAdmin
        .from("transaction_logs")
        .select("id, action_type, description, employee_id, created_at")
        .ilike("description", `%${transfer.transfer_code}%`)
        .order("created_at", { ascending: true })
        .limit(50),
    ]);

    // 3. Sadece Bu Transferde Adı Geçen Personelleri ve Ürünleri Hedefli Çek
    const empIdsSet = new Set<string>();
    if (transfer.created_by_employee_id) empIdsSet.add(transfer.created_by_employee_id);
    if (transfer.created_by) empIdsSet.add(transfer.created_by);
    if (transfer.requester_id) empIdsSet.add(transfer.requester_id);
    if (transfer.picker_employee_id) empIdsSet.add(transfer.picker_employee_id);
    if (transfer.receiver_employee_id) empIdsSet.add(transfer.receiver_employee_id);
    if (transfer.completed_by_employee_id) empIdsSet.add(transfer.completed_by_employee_id);
    txLogs?.forEach((l) => {
      if (l.employee_id) empIdsSet.add(l.employee_id);
    });

    const empIdsToFetch = Array.from(empIdsSet);
    const productIds = (rawItems || [])
      .map((i: any) => i.product_id)
      .filter(Boolean);

    const [{ data: employees }, { data: productsData }] = await Promise.all([
      empIdsToFetch.length > 0
        ? supabaseAdmin
            .from("employees")
            .select("id, full_name, position_title")
            .in("id", empIdsToFetch)
        : Promise.resolve({ data: [] }),
      productIds.length > 0
        ? supabaseAdmin
            .from("products")
            .select("id, barcode, sku, name, category, is_consumable, image_url")
            .in("id", productIds)
        : Promise.resolve({ data: [] }),
    ]);

    const branchMap: Record<string, { name: string; type: string }> = {};
    branches?.forEach((b) => {
      branchMap[b.id] = { name: b.name, type: b.type || "Şube" };
    });

    const employeeMap: Record<string, { full_name: string; title: string }> = {};
    employees?.forEach((e) => {
      employeeMap[e.id] = {
        full_name: e.full_name,
        title: e.position_title || "Operasyon Personeli",
      };
    });

    const productMap: Record<string, any> = {};
    productsData?.forEach((p) => {
      productMap[p.id] = p;
    });

    // 4. Statü Kontrolü ve Sorumlu Personellerin Çözümlenmesi
    const normStatus = (transfer.status || "").toUpperCase().replace("İ", "I");
    const isCompleted =
      normStatus === "TAMAMLANDI" || normStatus === "COMPLETED";

    const createLog = (txLogs || []).find((l) => {
      const act = (l.action_type || "").toUpperCase();
      return (
        act.includes("CREATE") ||
        act.includes("OLUSTUR") ||
        act.includes("ORDER") ||
        act.includes("TALEP")
      );
    });

    const creatorId =
      transfer.created_by_employee_id ||
      transfer.created_by ||
      transfer.requester_id ||
      createLog?.employee_id ||
      null;

    const pickLog = (txLogs || []).find((l) => {
      const act = (l.action_type || "").toUpperCase();
      return (
        act.includes("PICK") || act.includes("TOPLA") || act.includes("HAZIR")
      );
    });

    const pickerId =
      transfer.picker_employee_id || pickLog?.employee_id || null;
    const isPicked = Boolean(pickerId);

    const completionLog = isCompleted
      ? [...(txLogs || [])].reverse().find((l) => {
          const act = (l.action_type || "").toUpperCase();
          return (
            act.includes("COMPLETE") ||
            act.includes("RECEIVE") ||
            act.includes("CHECK_IN") ||
            act.includes("TAMAM") ||
            act.includes("TESLIM")
          );
        })
      : null;

    const receiverId = isCompleted
      ? transfer.receiver_employee_id ||
        transfer.completed_by_employee_id ||
        completionLog?.employee_id ||
        null
      : null;

    // 5. Kalemleri Ürün Adına Göre Formatla
    const formattedItems = (rawItems || [])
      .map((item: any) => {
        const prod = productMap[item.product_id] || {};
        const reqQty = Number(item.requested_qty ?? 0);
        const appQty = Number(item.approved_qty ?? reqQty);
        const sentQty = Number(item.sent_qty ?? appQty);
        const recQty = Number(item.received_qty ?? 0);

        return {
          id: item.id,
          product_id: item.product_id,
          barcode: prod.barcode || "-",
          sku: prod.sku || "-",
          name: prod.name || "Bilinmeyen Ürün",
          category: prod.category || "Genel",
          is_consumable: Boolean(prod.is_consumable),
          image_url: prod.image_url || null,
          requested_qty: reqQty,
          approved_qty: appQty,
          sent_qty: sentQty,
          received_qty: recQty,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    // 6. Operasyon Log Geçmişini Formatla
    const formattedTimeline = (txLogs || []).map((log) => ({
      id: log.id,
      action_type: log.action_type,
      description: log.description,
      created_at: log.created_at,
      employee_name:
        employeeMap[log.employee_id]?.full_name || "Sistem / Otomatik",
    }));

    return {
      success: true,
      data: {
        id: transfer.id,
        transfer_code: transfer.transfer_code,
        status: transfer.status || "BEKLIYOR",
        created_at: transfer.created_at,
        updated_at: transfer.updated_at || completionLog?.created_at || null,
        tracking_barcode: transfer.tracking_barcode || "-",
        from_branch: branchMap[transfer.from_branch_id]?.name || "Merkez Depo",
        to_branch: branchMap[transfer.to_branch_id]?.name || "Şube",
        carrier_name: carrierData?.name || "Şirket Aracı / Kurye",
        carrier_type: carrierData?.type || "Lojistik",
        actors: {
          creator: {
            isAssigned: true,
            name: creatorId
              ? employeeMap[creatorId]?.full_name || "Yetkili Yönetici"
              : `${branchMap[transfer.from_branch_id]?.name || "Merkez"} Talebi`,
            title: creatorId
              ? employeeMap[creatorId]?.title
              : "Transfer Başlatıcı",
            time: transfer.created_at,
          },
          picker: {
            isAssigned: isPicked,
            name: isPicked
              ? employeeMap[pickerId!]?.full_name || "Depo Operatörü"
              : "Atama Bekleniyor",
            title: isPicked
              ? employeeMap[pickerId!]?.title
              : "Henüz toplama işlemi başlamadı",
          },
          completer: {
            isCompleted: isCompleted,
            name: isCompleted
              ? receiverId
                ? employeeMap[receiverId]?.full_name || "Mağaza Yetkilisi"
                : "Teslim Alındı (Onaylı)"
              : "Sayım Yapılmadı",
            title: isCompleted
              ? receiverId
                ? employeeMap[receiverId]?.title
                : "Teslimat Onaylandı"
              : "Transfer henüz teslim alınmadı",
            time: isCompleted
              ? completionLog?.created_at || transfer.updated_at || null
              : null,
          },
        },
        items: formattedItems,
        timeline: formattedTimeline,
      },
    };
  } catch (err) {
    console.error("Transfer Detay Hatası:", err);
    return {
      success: false,
      error: "Transfer detayları çekilirken hata oluştu.",
    };
  }
}