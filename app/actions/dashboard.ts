"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getDashboardDataServer(userId: string) {
  try {
    const { data: profile } = await supabaseAdmin.from("profiles").select("role, branch_id").eq("id", userId).single();
    if (!profile) return { success: false, error: "Profil bulunamadı." };

    const isGlobal = profile.role === "Developer" || profile.role === "Admin" || !profile.branch_id;
    const branchId = profile.branch_id;

    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let empQuery = supabaseAdmin.from("employees").select("id", { count: "exact" }).eq("is_active", true);
    let stockQuery = supabaseAdmin.from("stocks").select("quantity");
    let leavesQuery = supabaseAdmin.from("leave_requests").select("status");
    let attQuery = supabaseAdmin.from("attendance_requests").select("status");
    let logCountQuery = supabaseAdmin.from("transaction_logs").select("id", { count: "exact" });
    
    let recentTransfersQuery = supabaseAdmin.from("transfers").select("id, transfer_code, created_at, status").order("created_at", { ascending: false }).limit(7);
    
    // FIX: Katı filtre kaldırıldı. Tüm hareketleri (Raflama dahil) çeker.
    let recentPutawayQuery = supabaseAdmin.from("transaction_logs").select("id, created_at, action_type, description, employees(full_name)").order("created_at", { ascending: false }).limit(7);
    
    // FIX: start_date ve end_date eklendi.
    let recentLeavesQuery = supabaseAdmin.from("leave_requests").select("id, created_at, leave_type, status, start_date, end_date, employees(full_name)").order("created_at", { ascending: false }).limit(7);
    let weeklyLogQuery = supabaseAdmin.from("transaction_logs").select("created_at, action_type").gte("created_at", lastWeek);

    if (!isGlobal && branchId) {
      empQuery = empQuery.eq("branch_id", branchId);
      stockQuery = stockQuery.eq("branch_id", branchId);
      leavesQuery = leavesQuery.eq("branch_id", branchId);
      attQuery = attQuery.eq("branch_id", branchId);
      logCountQuery = logCountQuery.eq("branch_id", branchId);
      recentTransfersQuery = recentTransfersQuery.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
      recentPutawayQuery = recentPutawayQuery.eq("branch_id", branchId);
      recentLeavesQuery = recentLeavesQuery.eq("branch_id", branchId);
      weeklyLogQuery = weeklyLogQuery.eq("branch_id", branchId);
    }

    const [
      { count: branchCount }, { count: empCount }, { data: stockData }, { data: leavesData },
      { data: attData }, { count: totalLogs }, { data: transfersData }, { data: putawayLogs },
      { data: leavesLogs }, { data: weeklyLogs }
    ] = await Promise.all([
      supabaseAdmin.from("branches").select("id", { count: "exact" }), empQuery, stockQuery, leavesQuery,
      attQuery, logCountQuery, recentTransfersQuery, recentPutawayQuery, recentLeavesQuery, weeklyLogQuery
    ]);

    const totalStock = (stockData || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    const pendingTotal = (leavesData?.filter(l => l.status === 'PENDING').length || 0) + (attData?.filter(a => a.status === 'PENDING').length || 0);
    
    const dbTotalRows = (totalLogs || 0) + (stockData?.length || 0) + (empCount || 0);
    const usage = Math.min(Math.max(Math.round((dbTotalRows / 50000) * 100), 1), 100);

    const daysStr = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    const weeklyObj: Record<string, number> = { Pzt: 0, Sal: 0, Çar: 0, Per: 0, Cum: 0, Cmt: 0, Paz: 0 };
    
    let inCount = 0; let outCount = 0; let otherCount = 0;

    (weeklyLogs || []).forEach((log: any) => {
      weeklyObj[daysStr[new Date(log.created_at).getDay()]]++;
      const action = log.action_type.toUpperCase();
      if (action.includes("PUTAWAY") || action.includes("INBOUND") || action.includes("ADD")) inCount++;
      else if (action.includes("PICKING") || action.includes("OUTBOUND") || action.includes("REMOVE")) outCount++;
      else otherCount++;
    });
    
    const formattedWeekly = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(today.getDate() - i);
      const dayName = daysStr[d.getDay()];
      formattedWeekly.push({ day: dayName, value: weeklyObj[dayName] || 0 });
    }

    const totalOps = inCount + outCount + otherCount || 1;

    return {
      success: true,
      data: {
        kpis: { branches: branchCount || 0, employees: empCount || 0, stockVolume: totalStock, pendingTotal },
        weeklyActivity: formattedWeekly,
        distribution: { 
          putaway: Math.round((inCount / totalOps) * 100), 
          picking: Math.round((outCount / totalOps) * 100), 
          other: Math.round((otherCount / totalOps) * 100) 
        },
        recentTransfers: transfersData || [],
        recentPutawayLogs: putawayLogs || [],
        recentLeaveLogs: leavesLogs || [],
        systemLoad: usage
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}