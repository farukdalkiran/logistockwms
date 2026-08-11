"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDashboardDataServer } from "@/app/actions/dashboard";
import {
  Building2, Users, AlertCircle, Package, 
  Layers, Database, CalendarDays, BoxSelect, 
  Truck, Clock, ArrowRight, ScanLine, Activity, CheckCircle2, Timer, Box
} from "lucide-react";

interface TransferData {
  id: string;
  transfer_code: string;
  status: string;
  created_at: string;
  from_branch_name: string;
  to_branch_name: string;
  picker_name: string;
}

interface DashboardData {
  kpis: { branches: number; employees: number; stockVolume: number; pendingTotal: number; boxesTotal: number; productsTotal: number; };
  cargoDistribution: { carrier: string; count: number; color: string }[];
  recentTransfers: TransferData[];
  recentPutawayLogs: { id: string; action_type: string; description: string; employee_name: string; }[];
  recentLeaveLogs: { id: string; leave_type: string; start_date: string; end_date: string; status: string; employee_name: string; }[];
  recentCargoSessions: { id: string; carrier_name: string; status: string; total_items: number; started_at: string; completed_at: string; employee_name: string; }[]; 
  dbSizeMB: number;
  systemLoad: number;
}

export default function ManagementDashboard() {
  const { userProfile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!isAuthLoading) {
      if (!userProfile) { router.replace("/login"); return; }
      fetchData();
    }
  }, [userProfile, isAuthLoading]);

  const fetchData = async () => {
    setLoading(true);
    const result = await getDashboardDataServer(userProfile!.id);
    if (result.success && result.data) setData(result.data as DashboardData);
    setLoading(false);
  };

  const getStatusStyle = (status: string) => {
    const s = status?.toUpperCase().replace('İ', 'I') || "";
    if (s === "TAMAMLANDI" || s === "COMPLETED" || s === "APPROVED") return "bg-emerald-50 text-emerald-700 border-emerald-400";
    if (s === "YOLDA" || s === "ACTIVE") return "bg-blue-50 text-blue-700 border-blue-400";
    if (s === "BEKLIYOR" || s === "PENDING") return "bg-orange-50 text-orange-700 border-orange-400";
    if (s === "TOPLANIYOR") return "bg-purple-50 text-purple-700 border-purple-400";
    if (s === "REJECTED" || s === "IPTAL") return "bg-red-50 text-[#dc3545] border-red-400";
    return "bg-slate-50 text-slate-600 border-slate-300";
  };

  const getStatusText = (status: string) => {
    const s = status?.toUpperCase().replace('İ', 'I') || "";
    if (s === 'APPROVED') return 'ONAYLANDI';
    if (s === 'PENDING') return 'BEKLİYOR';
    if (s === 'REJECTED') return 'REDDEDİLDİ';
    if (s === 'COMPLETED') return 'TAMAMLANDI';
    if (s === 'ACTIVE') return 'DEVAM EDİYOR';
    return status || "DURUM YOK";
  };

  const formatDateRange = (start: string, end: string) => {
    if (!start) return "-";
    const d1 = new Date(start).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    const d2 = end ? new Date(end).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "Devam Ediyor";
    return d1 === d2 ? d1 : `${d1} - ${d2}`;
  };

  const formatTimeRange = (start: string, end: string) => {
    if (!start) return "-";
    const t1 = new Date(start).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const t2 = end ? new Date(end).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "...";
    return `${t1} - ${t2}`;
  };

  const renderConicGradient = () => {
    if (!data?.cargoDistribution || data.cargoDistribution.length === 0) return "conic-gradient(#f1f5f9 0% 100%)";
    const total = data.cargoDistribution.reduce((acc, curr) => acc + curr.count, 0);
    if (total === 0) return "conic-gradient(#f1f5f9 0% 100%)";
    let currentPercent = 0;
    const stops = data.cargoDistribution.map(item => {
      const start = currentPercent;
      const end = currentPercent + (item.count / total) * 100;
      currentPercent = end;
      return `${item.color} ${start}% ${end}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  };

  const getTransferStats = () => {
    if (!data?.recentTransfers) return { yolda: 0, toplaniyor: 0, bekliyor: 0, tamamlandi: 0 };
    return {
      yolda: data.recentTransfers.filter(t => t.status.toUpperCase().replace('İ', 'I') === 'YOLDA').length,
      toplaniyor: data.recentTransfers.filter(t => t.status.toUpperCase().replace('İ', 'I') === 'TOPLANIYOR').length,
      bekliyor: data.recentTransfers.filter(t => t.status.toUpperCase().replace('İ', 'I') === 'BEKLIYOR').length,
      tamamlandi: data.recentTransfers.filter(t => t.status.toUpperCase().replace('İ', 'I') === 'TAMAMLANDI').length,
    };
  };
  const tStats = getTransferStats();

  if (isAuthLoading || (loading && !data)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] overflow-x-hidden">
        <Navbar />
        <main className="flex-1 w-full max-w-[1400px] mx-auto flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <ScanLine className="w-12 h-12 text-[#dc3545] absolute animate-ping opacity-20" />
            <Activity className="w-12 h-12 text-[#dc3545] animate-pulse" />
          </div>
          <p className="mt-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] animate-pulse font-mono">WMS Veri Ağı Taranıyor...</p>
        </main>
        <Footer />
      </div>
    );
  }

  const isGlobal = userProfile?.role === "Developer" || userProfile?.role === "Admin" || !userProfile?.branch_id;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] text-slate-800 selection:bg-[#dc3545] selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-8 overflow-hidden pb-16">
        
        {/* =========================================
            1. ENDÜSTRİYEL HERO HEADER & DB LOAD
            ========================================= */}
        <div className="w-full bg-[#0a0f1c] border border-slate-800 border-l-[12px] border-l-[#dc3545] rounded-none shadow-[8px_8px_0px_#94a3b8] relative overflow-hidden p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-6 group">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col gap-2 w-full lg:w-auto text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-none h-3 w-3 bg-emerald-500"></span>
              </div>
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-none font-mono">
                {isGlobal ? "MASTER YETKİ AKTİF" : "LOKAL ŞUBE BAĞLANTISI"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase leading-none drop-shadow-lg flex items-center justify-center lg:justify-start gap-3">
              <span>LOGISTOCK <span className="text-[#dc3545]">WMS</span></span>
            </h1>
            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-[0.2em] font-mono border-l-2 border-slate-600 pl-3 ml-1 lg:ml-0">
              Operasyonel Komuta ve Veri Merkezi
            </p>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-right bg-slate-900/80 border border-slate-700 p-4 shadow-inner">
            <div className="flex flex-col gap-1 text-left border-b md:border-b-0 md:border-r border-slate-700 pb-4 md:pb-0 md:pr-6">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono flex items-center gap-1.5"><Database size={12} className="text-[#dc3545]"/> DB Doluluk (Yük)</span>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-24 bg-slate-800 h-2 border border-slate-700"><div className="bg-[#dc3545] h-full transition-all" style={{ width: `${data?.systemLoad || 0}%` }}></div></div>
                <span className="text-sm font-black text-white font-mono">%{data?.systemLoad || 0}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-center md:text-right px-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Sistem Saati</span>
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* =========================================
            2. KPI KARTLARI (6 SÜTUN)
            ========================================= */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
          {[
            { title: "Kayıtlı Ürün", value: data?.kpis.productsTotal.toLocaleString('tr-TR'), icon: BoxSelect, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
            { title: "Toplam Stok", value: data?.kpis.stockVolume.toLocaleString('tr-TR'), icon: Layers, color: "text-[#dc3545]", bg: "bg-red-50 border-red-200" },
            { title: "Kayıtlı Koli", value: data?.kpis.boxesTotal.toLocaleString('tr-TR'), icon: Box, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
            { title: "Bağlı Şubeler", value: data?.kpis.branches, icon: Building2, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { title: "Aktif Personel", value: data?.kpis.employees, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
            { title: "Bekleyen İzin", value: data?.kpis.pendingTotal, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" }
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white p-4 border-2 border-slate-300 shadow-[4px_4px_0px_#94a3b8] flex flex-col justify-between gap-3 rounded-none transition-transform hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div className={`w-8 h-8 flex items-center justify-center rounded-none border-2 ${kpi.bg}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-2xl font-black text-slate-900 leading-none truncate font-mono">{kpi.value}</p>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 truncate">{kpi.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* =========================================
            3. GERÇEK VERİ ANALİZ GRAFİKLERİ
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
          
          <div className="bg-white p-6 border-2 border-slate-300 shadow-[6px_6px_0px_#94a3b8] rounded-none flex flex-col relative w-full h-[280px]">
            <div className="flex justify-between items-center mb-6 border-b-2 border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-slate-900 border-2 border-slate-800"><Activity className="w-4 h-4 text-[#dc3545]" /></div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Son Transferlerin Durum Özeti</h3>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col items-center p-3 bg-slate-50 border border-slate-200">
                  <span className="text-3xl font-black text-slate-900 font-mono">{tStats.yolda}</span>
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1"><Truck size={10} className="inline mr-1"/> GÖNDERİLDİ</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-slate-50 border border-slate-200">
                  <span className="text-3xl font-black text-slate-900 font-mono">{tStats.toplaniyor}</span>
                  <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest mt-1"><Package size={10} className="inline mr-1"/> SAYIMDA</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-slate-50 border border-slate-200">
                  <span className="text-3xl font-black text-slate-900 font-mono">{tStats.bekliyor}</span>
                  <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-1"><Timer size={10} className="inline mr-1"/> Bekliyor</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-slate-50 border border-slate-200">
                  <span className="text-3xl font-black text-slate-900 font-mono">{tStats.tamamlandi}</span>
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1"><CheckCircle2 size={10} className="inline mr-1"/> Tamamlandı</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 border-2 border-slate-300 shadow-[6px_6px_0px_#94a3b8] rounded-none flex flex-row items-center justify-between w-full h-[280px]">
            <div className="flex flex-col w-1/2 h-full">
              <div className="flex items-center gap-2.5 mb-4 border-b-2 border-slate-100 pb-4">
                <div className="p-1.5 bg-slate-900 border-2 border-slate-800"><Truck className="w-4 h-4 text-white" /></div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Kargo Çıkışı</h3>
              </div>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
                {data?.cargoDistribution?.map((c, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] font-black uppercase text-slate-700 tracking-widest">
                    <span className="flex items-center gap-2"><span className="w-2 h-2" style={{ backgroundColor: c.color }}></span>{c.carrier}</span>
                    <span className="font-mono">{c.count}</span>
                  </div>
                ))}
                {(!data?.cargoDistribution || data.cargoDistribution.length === 0) && (
                   <span className="text-xs text-slate-400 font-black uppercase mt-4">Veri Yok</span>
                )}
              </div>
            </div>
            <div className="flex-1 flex w-1/2 items-center justify-center relative">
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center shadow-[inset_0px_0px_10px_rgba(0,0,0,0.1)] relative border-[6px] border-white ring-4 ring-slate-100" style={{ background: renderConicGradient() }}>
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-lg z-10 border-4 border-slate-50">
                  <span className="text-2xl font-black text-slate-900 font-mono leading-none">{data?.cargoDistribution?.reduce((a, b) => a + b.count, 0) || 0}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Paket</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* =========================================
            4. 12-COLUMN LOG MATRİSİ (ÜST: Transfer & Kargo)
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start mt-2">
          
          {/* TRANSFER İŞLEMLERİ (col-7) */}
          <div className="lg:col-span-7 bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#94a3b8] rounded-none flex flex-col w-full h-[480px]">
            <div className="flex justify-between items-center p-4 border-b-4 border-[#dc3545] bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><Package className="w-5 h-5 text-[#dc3545]" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Transfer İşlemleri Merkezi</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Aktif Sayan Personel Takibi</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-600 font-black">
                    <th className="py-3 px-4 border-r-2 border-white w-28">Kodu</th>
                    <th className="py-3 px-4 border-r-2 border-white w-1/4">Nereden</th>
                    <th className="py-3 px-4 border-r-2 border-white w-1/4">Nereye</th>
                    <th className="py-3 px-4 border-r-2 border-white">Sayan/Görevli</th>
                    <th className="py-3 px-4 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-100">
                  {data?.recentTransfers?.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900 border-l-4 border-l-transparent hover:border-l-[#dc3545]">
                        <span className="bg-slate-900 text-white px-1.5 py-0.5 font-mono text-[10px]">{tx.transfer_code}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-black truncate max-w-[120px]" title={tx.from_branch_name}>{tx.from_branch_name}</td>
                      <td className="py-3 px-4 text-[#dc3545] font-black truncate max-w-[120px]" title={tx.to_branch_name}>
                        <ArrowRight size={12} className="inline text-slate-400 mr-1" />{tx.to_branch_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 uppercase text-[10px]">
                        <Users size={10} className="inline mr-1 text-slate-400" />{tx.picker_name}
                      </td>
                      <td className="py-3 px-4 text-right"><span className={`px-2 py-1 border-2 rounded-none text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${getStatusStyle(tx.status)}`}>{getStatusText(tx.status)}</span></td>
                    </tr>
                  ))}
                  {(!data?.recentTransfers || data.recentTransfers.length === 0) && (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* KARGO TESLİMATLARI (col-5) - Saat ve İsimler Geri Getirildi */}
          <div className="lg:col-span-5 bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#94a3b8] rounded-none flex flex-col w-full h-[480px]">
            <div className="flex justify-between items-center p-4 border-b-4 border-slate-700 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><Truck className="w-5 h-5 text-white" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Kargo Teslimatları</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Personel ve Saat Bilgisi</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-600 font-black">
                    <th className="py-3 px-4 border-r-2 border-white">Kargo Firması</th>
                    <th className="py-3 px-4 border-r-2 border-white">Saat</th>
                    <th className="py-3 px-4 border-r-2 border-white">Teslim Eden</th>
                    <th className="py-3 px-4 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-100">
                  {data?.recentCargoSessions?.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900 border-l-4 border-l-transparent hover:border-l-slate-700 truncate max-w-[120px]">{session.carrier_name}</td>
                      <td className="py-3 px-4 text-[10px] font-mono text-slate-600 whitespace-nowrap"><Clock size={10} className="inline mr-1 text-slate-700"/> {formatTimeRange(session.started_at, session.completed_at)}</td>
                      <td className="py-3 px-4 text-slate-800 truncate max-w-[120px]">{session.employee_name}</td>
                      <td className="py-3 px-4 text-center"><span className={`px-2 py-1 border-2 rounded-none text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${getStatusStyle(session.status)}`}>{getStatusText(session.status)}</span></td>
                    </tr>
                  ))}
                  {(!data?.recentCargoSessions || data.recentCargoSessions.length === 0) && (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* =========================================
            5. 12-COLUMN LOG MATRİSİ (ALT: Depo & İzinler)
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start mt-2">
          
          {/* DEPO OPERASYONLARI (col-7) */}
          <div className="lg:col-span-7 bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#94a3b8] rounded-none flex flex-col w-full h-[400px]">
            <div className="flex justify-between items-center p-4 border-b-4 border-blue-600 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><BoxSelect className="w-5 h-5 text-blue-400" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Depo Operasyon Logları</h3>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-600 font-black">
                    <th className="py-3 px-4 border-r-2 border-white w-1/4">Personel</th>
                    <th className="py-3 px-4 border-r-2 border-white w-1/2">İşlem Detayı</th>
                    <th className="py-3 px-4 text-right w-1/4">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-100">
                  {data?.recentPutawayLogs?.map((log) => {
                    const action = log.action_type.toUpperCase();
                    const isPutaway = action.includes("INBOUND") || action.includes("PUTAWAY") || action.includes("ADD");
                    const isPicking = action.includes("OUTBOUND") || action.includes("PICKING") || action.includes("REMOVE");
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-black text-slate-900 border-l-4 border-l-transparent hover:border-l-blue-500">{log.employee_name}</td>
                        <td className="py-3 px-4 text-slate-600 font-medium">{log.description?.replace(/\[.*?\]\s*/g, "") || "-"}</td>
                        <td className="py-3 px-4 text-right"><span className={`px-2 py-1 border-2 rounded-none text-[8px] font-black uppercase tracking-widest whitespace-nowrap inline-block ${isPutaway ? 'bg-emerald-50 text-emerald-700 border-emerald-400' : isPicking ? 'bg-red-50 text-[#dc3545] border-red-400' : 'bg-slate-50 text-slate-700 border-slate-300'}`}>{isPutaway ? 'RAFLAMA (+)' : isPicking ? 'ÇIKIŞ (-)' : 'DİĞER'}</span></td>
                      </tr>
                    )
                  })}
                  {(!data?.recentPutawayLogs || data.recentPutawayLogs.length === 0) && (
                    <tr><td colSpan={3} className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* İZİN HAREKETLERİ MİNİMAL (col-5) */}
          <div className="lg:col-span-5 bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#94a3b8] rounded-none flex flex-col w-full h-[400px]">
            <div className="flex justify-between items-center p-4 border-b-4 border-orange-500 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><CalendarDays className="w-5 h-5 text-orange-400" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Personel İzinleri</h3>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
              {data?.recentLeaveLogs?.slice(0, 7).map((log) => (
                <div key={log.id} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 hover:bg-slate-50 p-1 rounded-sm">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 truncate max-w-[160px]">{log.employee_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">{formatDateRange(log.start_date, log.end_date)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-block bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600 font-black uppercase">{log.leave_type}</span>
                    <span className={`w-2 h-2 rounded-full ${getStatusStyle(log.status).split(' ')[0]}`} title={getStatusText(log.status)}></span>
                  </div>
                </div>
              ))}
              {(!data?.recentLeaveLogs || data.recentLeaveLogs.length === 0) && (
                <div className="py-12 text-center text-slate-400 text-[10px] font-black uppercase">Kayıt Bulunamadı</div>
              )}
            </div>
          </div>

        </div>

      </main>
      <Footer />
    </div>
  );
}