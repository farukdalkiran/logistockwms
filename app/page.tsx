"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  Building2, Users, AlertCircle, Clock, TerminalSquare, 
  Package, ChevronRight, Layers, BarChart3, Activity, 
  Zap, Server, Database, FileText, History
} from "lucide-react";

// --- TİP TANIMLAMALARI ---
interface TransferLog {
  id: string;
  transfer_code: string;
  created_at: string;
  status: string;
  items_count: number;
}

interface ActionLog {
  id: string;
  created_at: string;
  action_type: string;
  description: string;
  employee_name: string;
}

interface PendingAction {
  id: string;
  type: string;
  title: string;
  person: string;
  date: string;
}

interface DashboardData {
  kpis: { branches: number; employees: number; stockVolume: number; pendingTotal: number; };
  weeklyActivity: { day: string; value: number }[];
  recentTransfers: TransferLog[];
  recentLogs: ActionLog[];
  pendingActions: PendingAction[];
  systemLoad: number;
}

export default function ManagementDashboard() {
  const { userProfile, isLoading: isAuthLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    kpis: { branches: 0, employees: 0, stockVolume: 0, pendingTotal: 0 },
    weeklyActivity: [],
    recentTransfers: [],
    recentLogs: [],
    pendingActions: [],
    systemLoad: 0,
  });

  useEffect(() => {
    if (!isAuthLoading && userProfile) {
      fetchDashboardData();
    }
  }, [userProfile, isAuthLoading]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const isGlobal = userProfile?.isGlobalAdmin || userProfile?.role === "Developer" || userProfile?.role === "Admin";
      const branchId = (userProfile as any)?.branch_id || userProfile?.branchId || userProfile?.branchName || null;

      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. DİNAMİK SORGULAR (Şubeye göre kısıtlanmış)
      let empQuery = supabase.from("employees").select("id, full_name, is_active, branch_id");
      let boxQuery = supabase.from("boxes").select("quantity");
      
      let leavesQuery = supabase.from("leave_requests").select("id, start_date, type, employees(full_name, branch_id)").eq("status", "PENDING");
      let attQuery = supabase.from("attendance_requests").select("id, created_at, employees(full_name, branch_id)").eq("status", "PENDING");
      
      // KESİN KURAL: Son 8 Transfer & Son 8 Log
      let transQuery = supabase.from("transfers").select("id, transfer_code, created_at, status, transfer_items(id)").order("created_at", { ascending: false }).limit(8);
      let logHistoryQuery = supabase.from("transaction_logs").select("id, created_at, action_type, description, employees(full_name)").order("created_at", { ascending: false }).limit(8);
      let logCountQuery = supabase.from("transaction_logs").select("created_at").gte("created_at", lastWeek);

      // Şube Filtrelerini Ekle
      if (!isGlobal && branchId) {
        empQuery = empQuery.eq("branch_id", branchId);
        transQuery = transQuery.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
        logHistoryQuery = logHistoryQuery.eq("branch_id", branchId);
        logCountQuery = logCountQuery.eq("branch_id", branchId);
      }

      // SORGULARI PARALEL TETİKLE
      const [
        branchesRes,
        employeesRes,
        boxesRes,
        leavesRes,
        attRes,
        transfersData,
        logHistoryData,
        logCountData
      ] = await Promise.all([
        supabase.from("branches").select("id", { count: "exact" }),
        empQuery,
        boxQuery,
        leavesQuery,
        attQuery,
        transQuery,
        logHistoryQuery,
        logCountQuery,
      ]);

      const activeEmployees = (employeesRes.data || []).filter((e) => e.is_active);
      const totalStock = (boxesRes.data || []).reduce((sum, box) => sum + (box.quantity || 0), 0);

      // BEKLEYEN ONAYLAR (GÜVENLİ FİLTRELEME LOJİĞİ)
      const validLeaves = isGlobal 
        ? leavesRes.data || [] 
        : (leavesRes.data || []).filter((l: any) => l.employees?.branch_id === branchId);
        
      const validAtts = isGlobal 
        ? attRes.data || [] 
        : (attRes.data || []).filter((a: any) => a.employees?.branch_id === branchId);

      const pendingCount = validLeaves.length + validAtts.length;

      // HAFTALIK İŞLEM HACMİ (Grafik)
      const daysStr = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
      const weeklyObj: Record<string, number> = { Pzt: 0, Sal: 0, Çar: 0, Per: 0, Cum: 0, Cmt: 0, Paz: 0 };
      (logCountData.data || []).forEach((log: any) => {
        weeklyObj[daysStr[new Date(log.created_at).getDay()]]++;
      });
      const formattedWeekly = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dayName = daysStr[d.getDay()];
        formattedWeekly.push({ day: dayName, value: weeklyObj[dayName] || 0 });
      }

      // SON 8 TRANSFER FORMATLAMA
      const formattedTransfers = (transfersData.data || []).map((t: any) => ({
        id: t.id,
        transfer_code: t.transfer_code,
        created_at: t.created_at,
        status: t.status,
        items_count: t.transfer_items ? t.transfer_items.length : 0,
      }));

      // SON 8 LOG FORMATLAMA
      const formattedLogs = (logHistoryData.data || []).map((log: any) => {
        let empName = "SİSTEM / BİLİNMEYEN";
        if (log.employees) {
          if (Array.isArray(log.employees) && log.employees.length > 0) empName = log.employees[0].full_name;
          else if (!Array.isArray(log.employees) && log.employees.full_name) empName = log.employees.full_name;
        }
        return {
          id: log.id,
          created_at: log.created_at,
          action_type: log.action_type,
          description: (log.description || "").replace(/\[.*?\]\s*/g, "").trim(),
          employee_name: empName,
        };
      });

      // BEKLEYEN İK AKSİYONLARI BİRLEŞTİRME VE SIRALAMA
      const actions: PendingAction[] = [];
      validLeaves.forEach((l: any) => actions.push({ id: `leave_${l.id}`, type: "İzin Talebi", title: l.type || "İzin", person: l.employees?.full_name || "Personel", date: l.start_date }));
      validAtts.forEach((a: any) => actions.push({ id: `att_${a.id}`, type: "Mesai Düzeltme", title: "Puantaj Onayı", person: a.employees?.full_name || "Personel", date: a.created_at }));
      actions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // DB YÜZDESİ (Sembolik Kapasite)
      const dbTotalRows = (logCountData.data?.length || 0) + totalStock + activeEmployees.length;
      const usage = Math.min(Math.max(Math.round((dbTotalRows / 10000) * 100), 8), 100);

      setData({
        kpis: { branches: branchesRes.count || 0, employees: activeEmployees.length, stockVolume: totalStock, pendingTotal: pendingCount },
        weeklyActivity: formattedWeekly,
        recentTransfers: formattedTransfers,
        recentLogs: formattedLogs,
        pendingActions: actions.slice(0, 8),
        systemLoad: usage,
      });

    } catch (error) {
      console.error("Dashboard Veri Hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Tamamlandi": return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "Yolda": return "bg-purple-50 text-purple-600 border-purple-200";
      case "Bekliyor": return "bg-red-50 text-[#dc3545] border-red-200";
      case "Toplaniyor": return "bg-slate-100 text-slate-700 border-slate-300";
      default: return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  if (loading || isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100 font-['Quicksand'] overflow-x-hidden">
        <Navbar />
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col items-center justify-center">
          <div className="relative mb-4">
            <TerminalSquare size={48} className="text-[#dc3545] opacity-20" />
            <Zap size={24} className="text-[#dc3545] absolute inset-0 m-auto animate-pulse" />
          </div>
          <p className="text-slate-500 font-bold tracking-widest text-[11px] uppercase animate-pulse">Sistem Verileri Senkronize Ediliyor...</p>
        </main>
        <Footer />
      </div>
    );
  }

  // DİKKAT: Navbar ve Footer EKLENDİ, Main tagine max-w-[1400px] mx-auto DÖNDÜ!
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-['Quicksand'] text-slate-800 selection:bg-purple-500 selection:text-white overflow-x-hidden">
      
      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden">
        
        {/* ========================================================= */}
        {/* 1. SİSTEM DURUM BANNER'I (Hero Header) */}
        {/* ========================================================= */}
        <div className="w-full bg-[#0f172b] border-l-4 border-[#dc3545] rounded-sm shadow-md relative overflow-hidden flex flex-col lg:flex-row items-center justify-between p-6 lg:p-8 gap-6 group">
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none transition-all duration-1000 group-hover:bg-[#dc3545]/10"></div>

          <div className="relative z-10 flex flex-col gap-1 w-full lg:w-auto text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                {(userProfile?.isGlobalAdmin || userProfile?.role === "Developer") ? "GLOBAL ERİŞİM" : "ŞUBE BAĞLANTISI AKTİF"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase leading-none">
              SİSTEM <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#dc3545] to-purple-500">OPERASYON</span> ÖZETİ
            </h1>
            <p className="text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">LogiStock WMS Canlı Veri Akışı</p>
          </div>

          <div className="relative z-10 flex flex-wrap justify-center lg:justify-end gap-3 w-full lg:w-auto">
            <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-sm flex flex-col min-w-[140px] shrink-0">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">İşlem Hacmi</span>
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-2xl font-black text-white font-mono">{data.weeklyActivity.reduce((a, b) => a + b.value, 0)}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Son 7 Gün</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-sm flex flex-col min-w-[140px] shrink-0">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sistem Yükü</span>
                <Server className="w-4 h-4 text-[#dc3545]" />
              </div>
              <span className="text-2xl font-black text-white font-mono">%{data.systemLoad.toFixed(1)}</span>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-sm"></span> Stabil
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. KPI KARTLARI */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-purple-300 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Lokasyon Ağı</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{data.kpis.branches}</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded-sm group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-[#dc3545]/50 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Kayıtlı Personel</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{data.kpis.employees}</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded-sm group-hover:bg-red-50 group-hover:border-red-100 transition-colors">
              <Users className="w-6 h-6 text-[#dc3545]" />
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-purple-300 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Depo Kapasitesi</p>
              <p className="text-3xl font-black text-slate-900 leading-none truncate">{data.kpis.stockVolume.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded-sm group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
              <Layers className="w-6 h-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-[#dc3545]/50 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Bekleyen Onay</p>
              <p className="text-3xl font-black text-[#dc3545] leading-none drop-shadow-sm">{data.kpis.pendingTotal}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 border border-red-100 flex items-center justify-center shrink-0 rounded-sm">
              <AlertCircle className="w-6 h-6 text-[#dc3545]" />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. ÜÇLÜ GRID (GRAFİK / BEKLEYENLER / DONUT) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
          
          {/* GRAFİK KARTI (Haftalık Aktivite) */}
          <div className="bg-white p-6 md:p-8 border border-slate-200 shadow-sm rounded-sm flex flex-col relative w-full h-full min-h-[300px]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#dc3545]/10 rounded-sm"><BarChart3 className="w-5 h-5 text-[#dc3545]" /></div>
                <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">Terminal Trafiği</h3>
              </div>
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-sm uppercase tracking-widest">Son 7 Gün</span>
            </div>

            <div className="flex-1 flex items-end justify-between gap-2 border-b border-slate-200 relative pt-10">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
              </div>

              {data.weeklyActivity.map((day, idx) => {
                const maxVal = Math.max(...data.weeklyActivity.map((d) => d.value), 1);
                const heightPercent = (day.value / maxVal) * 100;
                return (
                  <div key={idx} className="flex flex-col items-center gap-3 w-full group relative z-10 h-full justify-end">
                    <div className="w-full max-w-[32px] bg-slate-50 rounded-t-sm relative flex items-end h-full border-x border-t border-slate-100">
                      <div className={`w-full rounded-t-sm transition-all duration-700 ${idx % 2 === 0 ? "bg-gradient-to-t from-purple-700 to-purple-500" : "bg-gradient-to-t from-red-700 to-[#dc3545]"}`} style={{ height: `${heightPercent}%`, minHeight: "4px" }}></div>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-md">{day.value}</div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AKSİYON KARTLARI (İzin / Mesai Bekleyenler) */}
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-sm shadow-sm flex flex-col w-full h-full min-h-[300px]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#dc3545]/10 rounded-sm"><FileText className="w-5 h-5 text-[#dc3545]" /></div>
                <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">Bekleyen Onaylar</h3>
              </div>
              <span className="text-[10px] font-black text-[#dc3545] bg-red-50 px-2 py-1 rounded-sm border border-red-100">{data.kpis.pendingTotal} İşlem</span>
            </div>

            <div className="flex flex-col gap-3 w-full flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {data.pendingActions.map((action, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-3.5 rounded-sm flex justify-between items-center gap-3 w-full hover:border-purple-300 transition-colors shadow-sm">
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[8px] font-black uppercase tracking-widest mb-1.5 w-fit px-2 py-0.5 rounded-sm ${action.type === "İzin Talebi" ? "bg-purple-50 text-purple-600" : "bg-red-50 text-[#dc3545]"}`}>{action.type}</span>
                    <span className="text-[12px] font-black text-slate-900 truncate tracking-wide">{action.person}</span>
                    <span className="text-[10px] font-bold text-slate-500 truncate mt-0.5">{action.title}</span>
                  </div>
                  <div className="flex flex-col items-end text-right shrink-0">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarih</span>
                    <span className="text-[10px] font-mono font-black text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-sm">
                      {new Date(action.date).toLocaleDateString("tr-TR", { month: "2-digit", day: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
              {data.pendingActions.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-10 my-auto">
                  <div className="w-12 h-12 border border-slate-200 bg-slate-50 rounded-sm flex items-center justify-center"><Clock size={20} className="text-slate-300" /></div>
                  <span className="text-[10px] font-black uppercase tracking-widest mt-2 text-slate-500">Aksiyon Gerekmiyor</span>
                </div>
              )}
            </div>
            {data.pendingActions.length > 0 && (
              <Link href="/management/hr/approvals" className="mt-4 w-full bg-[#0f172b] hover:bg-[#dc3545] text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-sm flex items-center justify-center gap-2 transition-colors shadow-sm">
                Tümünü Yönet <ChevronRight size={14} />
              </Link>
            )}
          </div>

          {/* DONUT GRAFİĞİ (Veritabanı Hacmi) */}
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-sm shadow-sm flex flex-col items-center justify-between w-full h-full min-h-[300px]">
            <div className="w-full flex justify-between items-start mb-4">
              <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">Sistem Doluluğu</h3>
              <Database className="w-5 h-5 text-purple-600" />
            </div>

            <div className="w-40 h-40 rounded-full flex items-center justify-center relative shadow-sm border-4 border-slate-50 shrink-0 my-auto" style={{ background: `conic-gradient(#9333ea 0% ${Math.max(0, data.systemLoad - 5)}%, #dc3545 ${Math.max(0, data.systemLoad - 5)}% ${data.systemLoad}%, #f1f5f9 ${data.systemLoad}% 100%)` }}>
              <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-inner border border-slate-100">
                <span className="text-3xl font-black text-slate-900 tracking-tighter font-mono">%{data.systemLoad}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kapasite</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5 mt-4 bg-slate-50 p-3 rounded-sm border border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-purple-600"></span> Aktif Depolama</span>
                <span className="font-black text-slate-900">%{Math.max(0, data.systemLoad - 5)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-[#dc3545]"></span> Log Dosyaları</span>
                <span className="font-black text-slate-900">%5</span>
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* 4. İKİLİ TABLO GRID (SON 8 TRANSFER & SON 8 LOG) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
          
          {/* SON 8 TRANSFER */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden flex flex-col min-w-0">
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-purple-600/10 rounded-sm"><Package className="w-4 h-4 text-purple-600" /></div>
                <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Son Transferler</h3>
              </div>
              <Link href="/management/cargo" className="text-[9px] font-black text-purple-600 uppercase tracking-widest hover:text-white hover:bg-purple-600 border border-purple-600 px-3 py-1.5 rounded-sm transition-colors">Tümü</Link>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead className="bg-white border-b border-slate-200">
                  <tr className="text-[9px] uppercase tracking-widest text-slate-400">
                    <th className="py-3 px-4 font-black">Evrak Kodu</th>
                    <th className="py-3 px-4 font-black">Tarih</th>
                    <th className="py-3 px-4 font-black text-center">Hacim</th>
                    <th className="py-3 px-4 font-black text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-bold text-slate-700 divide-y divide-slate-100">
                  {data.recentTransfers.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900 tracking-wider">{tx.transfer_code}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{new Date(tx.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                      <td className="py-3 px-4 text-center text-slate-600 font-black">{tx.items_count} Kutu</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-0.5 border rounded-sm text-[8px] font-black uppercase tracking-widest ${getStatusStyle(tx.status)}`}>{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                  {data.recentTransfers.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Kayıt Yok</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* SON 8 HAREKET LOGU */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden flex flex-col min-w-0">
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#dc3545]/10 rounded-sm"><History className="w-4 h-4 text-[#dc3545]" /></div>
                <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Son Operasyon Logları</h3>
              </div>
              <Link href="/management/inventory/view" className="text-[9px] font-black text-[#dc3545] uppercase tracking-widest hover:text-white hover:bg-[#dc3545] border border-[#dc3545] px-3 py-1.5 rounded-sm transition-colors">Kataloğa Git</Link>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead className="bg-white border-b border-slate-200">
                  <tr className="text-[9px] uppercase tracking-widest text-slate-400">
                    <th className="py-3 px-4 font-black w-24">Saat</th>
                    <th className="py-3 px-4 font-black">Operatör</th>
                    <th className="py-3 px-4 font-black">İşlem Özeti</th>
                    <th className="py-3 px-4 font-black text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] font-bold text-slate-700 divide-y divide-slate-100">
                  {data.recentLogs.map((log) => {
                    const isAdd = log.action_type.includes("INBOUND") || log.action_type.includes("PUTAWAY");
                    const isRem = log.action_type.includes("OUTBOUND") || log.action_type.includes("PICKING");
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900 truncate max-w-[100px]" title={log.employee_name}>
                          {log.employee_name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 truncate max-w-[150px]" title={log.description}>
                          {log.description || "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 border rounded-sm text-[8px] font-black uppercase tracking-widest ${isAdd ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isRem ? 'bg-red-50 text-[#dc3545] border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {log.action_type.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {data.recentLogs.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Log Kaydı Yok</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}