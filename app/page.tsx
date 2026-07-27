"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import {
  Building2,
  Users,
  AlertCircle,
  Clock,
  TerminalSquare,
  Package,
  ChevronRight,
  Layers,
  BarChart3,
  Activity,
  Zap,
  Server,
  Database,
  FileText,
} from "lucide-react";

// --- TİP TANIMLAMALARI ---
interface TransferLog {
  id: string;
  transfer_code: string;
  created_at: string;
  status: string;
  items_count: number;
}

interface PendingAction {
  id: string;
  type: string;
  title: string;
  person: string;
  date: string;
}

interface DashboardData {
  kpis: {
    branches: number;
    employees: number;
    stockVolume: number;
    pendingTotal: number;
  };
  weeklyActivity: { day: string; value: number }[];
  recentTransfers: TransferLog[];
  pendingActions: PendingAction[];
  systemLoad: number;
  dbRows: number;
}

export default function ManagementDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    kpis: { branches: 0, employees: 0, stockVolume: 0, pendingTotal: 0 },
    weeklyActivity: [],
    recentTransfers: [],
    pendingActions: [],
    systemLoad: 0,
    dbRows: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const lastWeek = new Date(
        today.getTime() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // GERÇEK WMS VERİLERİNİ ÇEK
      const [
        branchesRes,
        employeesRes,
        boxesRes,
        leavesRes,
        attRes,
        transfersData,
        logsData,
      ] = await Promise.all([
        supabase.from("branches").select("id", { count: "exact" }),
        supabase.from("employees").select("id, full_name, is_active"),
        supabase.from("boxes").select("quantity"),
        supabase
          .from("leave_requests")
          .select("id, start_date, type, employees(full_name)")
          .eq("status", "PENDING")
          .limit(5),
        supabase
          .from("attendance_requests")
          .select("id, created_at, employees(full_name)")
          .eq("status", "PENDING")
          .limit(5),
        supabase
          .from("transfers")
          .select("id, transfer_code, created_at, status, transfer_items(id)")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("transaction_logs")
          .select("created_at")
          .gte("created_at", lastWeek),
      ]);

      const activeEmployees = (employeesRes.data || []).filter(
        (e) => e.is_active,
      );
      const totalStock = (boxesRes.data || []).reduce(
        (sum, box) => sum + (box.quantity || 0),
        0,
      );
      const pendingCount =
        (leavesRes.data?.length || 0) + (attRes.data?.length || 0);

      // HAFTALIK İŞLEM HACMİ (Transaction Logs üzerinden)
      const daysStr = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
      const weeklyObj: Record<string, number> = {
        Pzt: 0,
        Sal: 0,
        Çar: 0,
        Per: 0,
        Cum: 0,
        Cmt: 0,
        Paz: 0,
      };

      (logsData.data || []).forEach((log: any) => {
        const d = new Date(log.created_at);
        weeklyObj[daysStr[d.getDay()]]++;
      });

      const formattedWeekly = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dayName = daysStr[d.getDay()];
        formattedWeekly.push({ day: dayName, value: weeklyObj[dayName] || 0 });
      }

      // SON TRANSFERLER
      const formattedTransfers = (transfersData.data || []).map((t: any) => ({
        id: t.id,
        transfer_code: t.transfer_code,
        created_at: t.created_at,
        status: t.status,
        items_count: t.transfer_items ? t.transfer_items.length : 0,
      }));

      // BEKLEYEN İK AKSİYONLARI
      const actions: PendingAction[] = [];
      (leavesRes.data || []).forEach((l: any) =>
        actions.push({
          id: `leave_${l.id}`,
          type: "İzin Talebi",
          title: l.type || "İzin",
          person: l.employees?.full_name || "Personel",
          date: l.start_date,
        }),
      );
      (attRes.data || []).forEach((a: any) =>
        actions.push({
          id: `att_${a.id}`,
          type: "Mesai Düzeltme",
          title: "Puantaj Onayı",
          person: a.employees?.full_name || "Personel",
          date: a.created_at,
        }),
      );
      actions.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      // DB Kapasite Yüzdesi Hesaplama (Gerçek log/stok verisine dayalı)
      const dbTotalRows =
        (logsData.data?.length || 0) + totalStock + activeEmployees.length;
      const usage = Math.min(
        Math.max(Math.round((dbTotalRows / 5000) * 100), 12),
        100,
      );

      setData({
        kpis: {
          branches: branchesRes.count || 0,
          employees: activeEmployees.length,
          stockVolume: totalStock,
          pendingTotal: pendingCount,
        },
        weeklyActivity: formattedWeekly,
        recentTransfers: formattedTransfers,
        pendingActions: actions.slice(0, 5),
        systemLoad: usage,
        dbRows: dbTotalRows,
      });
    } catch (error) {
      console.error("Dashboard Veri Hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Tamamlandi":
        return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "Yolda":
        return "bg-purple-50 text-purple-600 border-purple-200";
      case "Bekliyor":
        return "bg-red-50 text-[#dc3545] border-red-200";
      case "Toplaniyor":
        return "bg-slate-100 text-slate-700 border-slate-300";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 font-['Quicksand']">
        <div className="relative mb-4">
          <TerminalSquare size={48} className="text-[#dc3545] opacity-20" />
          <Zap
            size={24}
            className="text-[#dc3545] absolute inset-0 m-auto animate-pulse"
          />
        </div>
        <p className="text-slate-500 font-bold tracking-widest text-[11px] uppercase animate-pulse">
          Sistem Verileri Okunuyor...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-['Quicksand'] text-slate-800 selection:bg-purple-500 selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden">
        {/* ========================================================= */}
        {/* 1. SİSTEM DURUM BANNER'I (Siber & Endüstriyel) */}
        {/* ========================================================= */}
        <div className="w-full bg-[#0f172b] border-l-4 border-[#dc3545] rounded-sm shadow-md relative overflow-hidden flex flex-col lg:flex-row items-center justify-between p-6 lg:p-8 gap-6 group">
          {/* Arka Plan Dekorasyonu */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none transition-all duration-1000 group-hover:bg-[#dc3545]/10"></div>

          {/* Sol Kısım: Başlık */}
          <div className="relative z-10 flex flex-col gap-1 w-full lg:w-auto text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                VERİTABANI AKTİF
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase leading-none">
              SİSTEM{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#dc3545] to-purple-500">
                OPERASYON
              </span>{" "}
              ÖZETİ
            </h1>
            <p className="text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">
              LogiStock WMS Canlı Veri Akışı
            </p>
          </div>

          {/* Sağ Kısım: Anlık Sensör Okumaları */}
          <div className="relative z-10 flex flex-wrap justify-center lg:justify-end gap-3 w-full lg:w-auto">
            <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-sm flex flex-col min-w-[140px] shrink-0">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  İşlem Hacmi
                </span>
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-2xl font-black text-white font-mono">
                {data.weeklyActivity.reduce((a, b) => a + b.value, 0)}
              </span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                Son 7 Günlük Log
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-sm flex flex-col min-w-[140px] shrink-0">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  Sistem Yükü
                </span>
                <Server className="w-4 h-4 text-[#dc3545]" />
              </div>
              <span className="text-2xl font-black text-white font-mono">
                %{data.systemLoad.toFixed(1)}
              </span>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-sm"></span>{" "}
                Stabil
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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">
                Lokasyon Ağı
              </p>
              <p className="text-3xl font-black text-slate-900 leading-none">
                {data.kpis.branches}
              </p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded-sm group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-[#dc3545]/50 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">
                Aktif Kadro
              </p>
              <p className="text-3xl font-black text-slate-900 leading-none">
                {data.kpis.employees}
              </p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded-sm group-hover:bg-red-50 group-hover:border-red-100 transition-colors">
              <Users className="w-6 h-6 text-[#dc3545]" />
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-purple-300 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">
                Stok Hacmi
              </p>
              <p className="text-3xl font-black text-slate-900 leading-none truncate">
                {data.kpis.stockVolume.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded-sm group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
              <Layers className="w-6 h-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-[#dc3545]/50 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">
                Bekleyen Onay
              </p>
              <p className="text-3xl font-black text-[#dc3545] leading-none drop-shadow-sm">
                {data.kpis.pendingTotal}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-50 border border-red-100 flex items-center justify-center shrink-0 rounded-sm">
              <AlertCircle className="w-6 h-6 text-[#dc3545]" />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. İKİLİ GRID (GRAFİKLER & TABLOLAR) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full mt-2">
          {/* SOL KOLON: GRAFİK VE LİSTELER (%66) */}
          <div className="lg:col-span-2 flex flex-col gap-6 w-full min-w-0">
            {/* GRAFİK KARTI (Haftalık Aktivite) */}
            <div className="bg-white p-6 md:p-8 border border-slate-200 shadow-sm rounded-sm flex flex-col relative min-w-0">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#dc3545]/10 rounded-sm">
                    <BarChart3 className="w-5 h-5 text-[#dc3545]" />
                  </div>
                  <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">
                    Haftalık Terminal Trafiği
                  </h3>
                </div>
                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-sm uppercase tracking-widest">
                  Son 7 Gün
                </span>
              </div>

              <div className="flex-1 flex items-end justify-between gap-2 h-44 border-b border-slate-200 relative">
                {/* Referans Arka Plan Çizgileri */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                  <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                  <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                  <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                </div>

                {data.weeklyActivity.map((day, idx) => {
                  const maxVal = Math.max(
                    ...data.weeklyActivity.map((d) => d.value),
                    1,
                  );
                  const heightPercent = (day.value / maxVal) * 100;
                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center gap-3 w-full group relative z-10"
                    >
                      <div className="w-full max-w-[36px] bg-slate-50 rounded-t-sm relative flex items-end h-full border-x border-t border-slate-100">
                        <div
                          className={`w-full rounded-t-sm transition-all duration-700 ${idx % 2 === 0 ? "bg-gradient-to-t from-purple-700 to-purple-500" : "bg-gradient-to-t from-red-700 to-[#dc3545]"}`}
                          style={{
                            height: `${heightPercent}%`,
                            minHeight: "4px",
                          }}
                        ></div>
                        {/* Data Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-md">
                          {day.value}
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {day.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TABLO KARTI (Son Transferler) */}
            <div className="bg-white p-0 border border-slate-200 shadow-sm rounded-sm overflow-hidden w-full flex flex-col min-w-0">
              <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-600/10 rounded-sm">
                    <Package className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">
                    Son Transfer Hareketleri
                  </h3>
                </div>
                <Link
                  href="/management"
                  className="text-[9px] font-black text-purple-600 uppercase tracking-widest hover:text-white hover:bg-purple-600 border border-purple-600 px-3 py-1.5 rounded-sm transition-colors hidden sm:block"
                >
                  Tümünü İncele
                </Link>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-white border-b border-slate-200">
                    <tr className="text-[9px] uppercase tracking-widest text-slate-400">
                      <th className="py-4 px-6 font-black">Evrak Kodu</th>
                      <th className="py-4 px-6 font-black">Oluşturulma</th>
                      <th className="py-4 px-6 font-black text-center">
                        Hacim
                      </th>
                      <th className="py-4 px-6 font-black text-right">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-100">
                    {data.recentTransfers.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-4 px-6 font-black text-slate-900 tracking-wider">
                          {tx.transfer_code}
                        </td>
                        <td className="py-4 px-6 text-slate-500 font-mono">
                          {new Date(tx.created_at).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-4 px-6 text-center text-slate-600 font-black">
                          {tx.items_count} Kalem Ürün
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span
                            className={`px-2.5 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest ${getStatusStyle(tx.status)}`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.recentTransfers.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-slate-400 text-xs font-black uppercase tracking-widest"
                        >
                          Sistemde Hiç Transfer Kaydı Bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SAĞ KOLON: KAPASİTE VE İK AKSİYONLARI (%33) */}
          <div className="lg:col-span-1 flex flex-col gap-6 w-full min-w-0">
            {/* 1. DONUT GRAFİĞİ (Veritabanı Hacmi) */}
            <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm flex flex-col items-center relative w-full min-w-0">
              <div className="w-full flex justify-between items-start mb-6">
                <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">
                  Sistem Doluluğu
                </h3>
                <Database className="w-4 h-4 text-purple-600" />
              </div>

              <div
                className="w-40 h-40 rounded-full flex items-center justify-center relative mb-6 shadow-sm border-4 border-slate-50 shrink-0"
                style={{
                  background: `conic-gradient(#9333ea 0% ${Math.max(0, data.systemLoad - 5)}%, #dc3545 ${Math.max(0, data.systemLoad - 5)}% ${data.systemLoad}%, #f1f5f9 ${data.systemLoad}% 100%)`,
                }}
              >
                <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-inner border border-slate-100">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter font-mono">
                    %{data.systemLoad}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Kapasite
                  </span>
                </div>
              </div>

              <div className="w-full flex flex-col gap-2.5 mt-auto bg-slate-50 p-3 rounded-sm border border-slate-100">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm bg-purple-600"></span>{" "}
                    Aktif Depolama
                  </span>
                  <span className="font-black text-slate-900">
                    %{Math.max(0, data.systemLoad - 5)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm bg-[#dc3545]"></span>{" "}
                    Log Dosyaları
                  </span>
                  <span className="font-black text-slate-900">%5</span>
                </div>
              </div>
            </div>

            {/* 2. AKSİYON KARTLARI (İzin / Mesai Bekleyenler) */}
            <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm flex flex-col flex-1 min-w-0">
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-[#dc3545]/10 rounded-sm">
                    <FileText className="w-4 h-4 text-[#dc3545]" />
                  </div>
                  <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">
                    Bekleyen Onaylar
                  </h3>
                </div>
                <span className="text-[10px] font-black text-[#dc3545] bg-red-50 px-2 py-1 rounded-sm border border-red-100">
                  {data.pendingActions.length} İşlem
                </span>
              </div>

              <div className="flex flex-col gap-3 w-full flex-1 overflow-y-auto pr-1">
                {data.pendingActions.map((action, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 p-3.5 rounded-sm flex flex-col gap-2 w-full hover:border-purple-300 transition-colors shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest mb-1.5 w-fit px-2 py-0.5 rounded-sm ${action.type === "İzin Talebi" ? "bg-purple-50 text-purple-600" : "bg-red-50 text-[#dc3545]"}`}
                        >
                          {action.type}
                        </span>
                        <span className="text-[12px] font-black text-slate-900 truncate tracking-wide">
                          {action.person}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
                          {action.title}
                        </span>
                      </div>
                      <div className="flex flex-col items-end text-right shrink-0">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Tarih
                        </span>
                        <span className="text-[10px] font-mono font-black text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-sm">
                          {new Date(action.date).toLocaleDateString("tr-TR", {
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {data.pendingActions.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-16 my-auto">
                    <div className="w-12 h-12 border border-slate-200 bg-slate-50 rounded-sm flex items-center justify-center">
                      <Clock size={20} className="text-slate-300" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest mt-2 text-slate-500">
                      Aksiyon Gerekmiyor
                    </span>
                  </div>
                )}
              </div>

              {/* Hızlı Aksiyon Butonu */}
              {data.pendingActions.length > 0 && (
                <Link
                  href="/management/hr"
                  className="mt-5 w-full bg-[#0f172b] hover:bg-[#dc3545] text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  Tümünü Yönet <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
