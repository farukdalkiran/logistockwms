"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDashboardDataServer } from "@/app/actions/dashboard";
import {
  Building2, Users, AlertCircle, Package, 
  Layers, Database, BoxSelect, 
  Truck, Clock, ArrowRight, ScanLine, Activity, CheckCircle2, Timer, Box,
  AlertOctagon, BellRing, BarChart2, UserCheck, CalendarDays, LogIn, LogOut, Info, Megaphone, ShoppingCart
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
  recentPutawayLogs: { id: string; action_type: string; description: string; employee_name: string; created_at?: string }[];
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

  const formatTimeRange = (start: string, end: string) => {
    if (!start) return "-";
    const t1 = new Date(start).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const t2 = end ? new Date(end).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "...";
    return `${t1} - ${t2}`;
  };

  const formatDateRange = (start: string, end: string) => {
    if (!start) return "-";
    const d1 = new Date(start).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    const d2 = end ? new Date(end).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "Devam Ediyor";
    return d1 === d2 ? d1 : `${d1} - ${d2}`;
  };

  const cargoDist = data?.cargoDistribution?.map(c => ({
    ...c,
    color: (c.carrier.toUpperCase().includes("HEPSIJET") || c.carrier.toUpperCase().includes("HEPSİJET")) ? "#9333ea" : c.color
  })) || [];

  const renderConicGradient = () => {
    if (cargoDist.length === 0) return "conic-gradient(#f1f5f9 0% 100%)";
    const total = cargoDist.reduce((acc, curr) => acc + curr.count, 0);
    if (total === 0) return "conic-gradient(#f1f5f9 0% 100%)";
    let currentPercent = 0;
    const stops = cargoDist.map(item => {
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

  const pendingTotal = data?.kpis?.pendingTotal ?? 0;
  const hasPending = pendingTotal > 0;

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

  const profileSafe = userProfile as Record<string, any> | null;
  const isGlobal = profileSafe?.role === "Developer" || profileSafe?.role === "Admin" || !profileSafe?.branch_id;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] text-slate-800 selection:bg-[#dc3545] selection:text-white overflow-x-hidden">
      
      {/* Özel CSS Animasyonu: Kayar Şerit İçin */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 25s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}} />

      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden pb-16">
        
        {/* =========================================
            1. ENDÜSTRİYEL HERO HEADER & DB LOAD
            ========================================= */}
        <div className="w-full bg-[#0a0f1c] border border-slate-800 border-l-[12px] border-l-[#dc3545] rounded-none shadow-[8px_8px_0px_#94a3b8] relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6 group">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none z-0"></div>
          
          <div className="relative z-10 p-6 lg:p-8 flex flex-col gap-2 w-full lg:w-auto text-center lg:text-left">
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

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-right bg-slate-900/80 border-l border-slate-700 p-6 h-full shadow-inner">
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
            LIVE TICKER: EŞ ZAMANLI SİPARİŞ BİLDİRİM ŞERİDİ
            ========================================= */}
        <div className="w-full bg-[#0F172A] border-y-2 border-[#dc3545] shadow-[4px_4px_0px_#94a3b8] flex items-center overflow-hidden h-10 relative">
           <div className="absolute left-0 z-20 h-full bg-[#0F172A] px-4 flex items-center border-r-2 border-[#dc3545] shadow-[5px_0_10px_rgba(0,0,0,0.5)]">
             <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
               <Activity size={14} className="text-[#dc3545] animate-pulse" /> CANLI AKIŞ
             </span>
           </div>
           
        </div>

        {/* =========================================
            YÖNETİCİNİN DİKKATİNE PANELI
            ========================================= */}
        {hasPending && (
          <div className="w-full bg-[#fff4eb] border-2 border-orange-300 border-l-[12px] border-l-orange-500 rounded-none shadow-[6px_6px_0px_#f97316] relative overflow-hidden p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 mt-2">
            <AlertOctagon className="absolute -right-8 -top-8 w-40 h-40 text-orange-500/10 rotate-12" />
            <div className="relative z-10 flex flex-col gap-1 w-full">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-orange-600 animate-bounce" />
                <h2 className="text-lg font-black text-orange-700 uppercase tracking-tighter">Yöneticinin Dikkatine</h2>
              </div>
              <p className="text-orange-700 font-bold text-xs uppercase tracking-widest mt-1 font-mono">
                Sistemde onayınızı bekleyen <span className="text-sm bg-orange-200 px-1.5 py-0.5 border border-orange-300 font-black">{pendingTotal}</span> adet <strong className="text-orange-900">İzin veya Mesai Düzeltme</strong> talebi bulunmaktadır.
              </p>
            </div>
            <button onClick={() => router.push('/management/hr/approvals')} className="relative z-10 bg-orange-500 hover:bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 transition-colors border-2 border-orange-700 whitespace-nowrap shadow-[4px_4px_0px_#c2410c] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_#c2410c] flex items-center gap-2">
              <UserCheck size={14} /> TALEPLERİ İNCELE
            </button>
          </div>
        )}

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
            { title: "Bekleyen Onay", value: pendingTotal, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" }
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
            3. ANA OPERASYON MATRİSİ (12 SÜTUN)
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          
          {/* --- SOL PANEL: TRANSFER VE TOPLAMA MERKEZİ (8 SÜTUN) --- */}
          <div className="lg:col-span-8 bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#94a3b8] rounded-none flex flex-col w-full h-[600px]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b-4 border-[#dc3545] bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><Package className="w-5 h-5 text-[#dc3545]" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Transfer & Toplama Merkezi</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Aktif Sayan Personel ve Lojistik Durumu</p>
                </div>
              </div>
            </div>

            {/* İstatistikler */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b-2 border-slate-200 shrink-0 bg-slate-50">
              <div className="flex flex-col items-center p-3 border-r border-slate-200 last:border-0 hover:bg-white transition-colors">
                <span className="text-2xl font-black text-slate-900 font-mono">{tStats.yolda}</span>
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1"><Truck size={10} className="inline mr-1"/> GÖNDERİLDİ</span>
              </div>
              <div className="flex flex-col items-center p-3 border-r border-slate-200 last:border-0 hover:bg-white transition-colors">
                <span className="text-2xl font-black text-slate-900 font-mono">{tStats.toplaniyor}</span>
                <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest mt-1"><Package size={10} className="inline mr-1"/> SAYIMDA</span>
              </div>
              <div className="flex flex-col items-center p-3 border-r border-slate-200 last:border-0 hover:bg-white transition-colors">
                <span className="text-2xl font-black text-slate-900 font-mono">{tStats.bekliyor}</span>
                <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest mt-1"><Timer size={10} className="inline mr-1"/> BEKLİYOR</span>
              </div>
              <div className="flex flex-col items-center p-3 hover:bg-white transition-colors">
                <span className="text-2xl font-black text-slate-900 font-mono">{tStats.tamamlandi}</span>
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1"><CheckCircle2 size={10} className="inline mr-1"/> TAMAMLANDI</span>
              </div>
            </div>

            {/* Sparkline Grafiği */}
            <div className="bg-slate-100/50 border-b-2 border-slate-200 p-3 shrink-0 flex flex-col gap-2 relative">
              <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
              <div className="flex items-center justify-between relative z-10">
                <h4 className="text-[9px] font-black uppercase text-slate-600 tracking-widest flex items-center gap-1.5"><BarChart2 size={12} className="text-[#dc3545]" /> Son 30 Transfer Yoğunluğu</h4>
              </div>
              <div className="flex items-end gap-[2px] h-10 w-full relative z-10 border-b-2 border-slate-300 pb-1">
                {data?.recentTransfers?.slice(0, 30).map((tx, idx) => {
                  let barColor = "bg-slate-300";
                  let h = "h-4";
                  const s = tx.status.toUpperCase().replace('İ', 'I');
                  if (s === 'TAMAMLANDI') { barColor = "bg-emerald-500"; h = "h-full"; }
                  else if (s === 'YOLDA') { barColor = "bg-blue-500"; h = "h-8"; }
                  else if (s === 'TOPLANIYOR') { barColor = "bg-purple-500"; h = "h-6"; }
                  else if (s === 'BEKLIYOR') { barColor = "bg-orange-500"; h = "h-4"; }
                  else if (s === 'REJECTED' || s === 'IPTAL') { barColor = "bg-[#dc3545]"; h = "h-2"; }
                  return (
                    <div 
                      key={idx} 
                      title={`${tx.transfer_code} - ${getStatusText(tx.status)}`}
                      className={`flex-1 ${barColor} ${h} hover:opacity-75 transition-all cursor-pointer rounded-t-sm border border-black/10`}
                    ></div>
                  )
                })}
                {(!data?.recentTransfers || data.recentTransfers.length === 0) && (
                  <div className="w-full text-center text-slate-400 text-[10px] font-black uppercase mt-2">Veri Yok</div>
                )}
              </div>
            </div>

            {/* Detaylı Transfer Tablosu */}
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar bg-white">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-50 border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
                    <th className="py-2.5 px-4 border-r-2 border-white w-28">TR Kodu</th>
                    <th className="py-2.5 px-4 border-r-2 border-white w-1/4">Kaynak</th>
                    <th className="py-2.5 px-4 border-r-2 border-white w-1/4">Hedef</th>
                    <th className="py-2.5 px-4 border-r-2 border-white">Personel</th>
                    <th className="py-2.5 px-4 text-right">Durum & Tarih</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-100">
                  {data?.recentTransfers?.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3 px-4 font-black text-slate-900 border-l-4 border-l-transparent group-hover:border-l-[#dc3545]">
                        <span className="bg-slate-900 text-white px-1.5 py-0.5 font-mono text-[10px] border border-slate-700">{tx.transfer_code}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-black truncate max-w-[120px]" title={tx.from_branch_name}>{tx.from_branch_name}</td>
                      <td className="py-3 px-4 text-[#dc3545] font-black truncate max-w-[120px]" title={tx.to_branch_name}>
                        <ArrowRight size={12} className="inline text-slate-400 mr-1" />{tx.to_branch_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 uppercase text-[10px] font-bold">
                        <Users size={12} className="inline mr-1 text-slate-400" />{tx.picker_name}
                      </td>
                      <td className="py-3 px-4 text-right flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 border-2 rounded-none text-[8px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm ${getStatusStyle(tx.status)}`}>{getStatusText(tx.status)}</span>
                        {tx.created_at && (
                           <span className="text-[9px] font-mono text-slate-400 block">{new Date(tx.created_at).toLocaleDateString('tr-TR')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentTransfers || data.recentTransfers.length === 0) && (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Bekleyen veya aktif transfer bulunmuyor</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* --- SAĞ PANEL: KARGO & TESLİMAT MERKEZİ (4 SÜTUN) --- */}
          <div className="lg:col-span-4 bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#94a3b8] rounded-none flex flex-col w-full h-[600px]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b-4 border-slate-700 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><Truck className="w-5 h-5 text-white" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Kargo & Teslimat</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Dağılım ve Personel Logu</p>
                </div>
              </div>
            </div>

            {/* Üst Kısım: Pasta Grafiği ve Toplamlar */}
            <div className="p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0 flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none"></div>
              
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="flex-1 flex flex-col gap-1.5">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Dağılım Özeti</h4>
                  {cargoDist.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] font-black uppercase text-slate-800 tracking-widest bg-white px-2 py-1 border border-slate-200 shadow-sm">
                      <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-none border border-black/10" style={{ backgroundColor: c.color }}></span>{c.carrier}</span>
                      <span className="font-mono bg-slate-100 px-1.5 text-slate-600">{c.count}</span>
                    </div>
                  ))}
                  {(cargoDist.length === 0) && (
                     <span className="text-[10px] text-slate-400 font-black uppercase mt-2">Veri Yok</span>
                  )}
                </div>

                <div className="flex shrink-0 items-center justify-center p-2">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.1)] relative border-[4px] border-white ring-2 ring-slate-200" style={{ background: renderConicGradient() }}>
                  </div>
                </div>
              </div>
            </div>

            {/* Alt Kısım: Teslimat Yapanlar Logu */}
            <div className="p-2 border-b-2 border-slate-100 bg-white shrink-0">
               <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 pl-2"><Clock size={12}/> Son Teslimat Seansları</h4>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar bg-white">
              <table className="w-full text-left border-collapse min-w-[350px]">
                <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                  <tr className="text-[9px] uppercase tracking-widest text-slate-400 font-black">
                    <th className="py-2 px-3 border-r-2 border-white">Firma & Saat</th>
                    <th className="py-2 px-3">Teslim Eden</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-50">
                  {data?.recentCargoSessions?.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-2 px-3 border-l-4 border-l-transparent group-hover:border-l-slate-700">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-slate-900 text-[10px] uppercase tracking-wider truncate max-w-[140px]">{session.carrier_name}</span>
                          <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap bg-slate-100 px-1 py-0.5 w-max border border-slate-200">
                            {formatTimeRange(session.started_at, session.completed_at)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-slate-800 text-[10px] uppercase truncate max-w-[140px] font-black">{session.employee_name}</span>
                          <span className={`px-1.5 py-0.5 border rounded-none text-[7px] font-black uppercase tracking-widest whitespace-nowrap ${getStatusStyle(session.status)}`}>{getStatusText(session.status)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentCargoSessions || data.recentCargoSessions.length === 0) && (
                    <tr><td colSpan={2} className="py-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* =========================================
            4. ALT MATRİS: DEPO LOGLARI & İZİNLER (RESTORE EDİLEN KISIM)
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          
          {/* DEPO OPERASYON LOGLARI DETAYLI (col-8) */}
          <div className="lg:col-span-8 bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#94a3b8] rounded-none flex flex-col w-full h-[450px]">
             <div className="flex justify-between items-center p-4 border-b-4 border-blue-600 bg-slate-900 text-white shrink-0">
               <div className="flex items-center gap-3">
                 <div className="bg-white/10 p-2 border border-white/20"><BoxSelect className="w-5 h-5 text-blue-400" /></div>
                 <div>
                   <h3 className="text-sm font-black uppercase tracking-widest">Depo Operasyon Logları (Detaylı)</h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Gerçek Zamanlı Raf ve Stok Aksiyonları</p>
                 </div>
               </div>
             </div>
             
             <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar bg-slate-50">
               <table className="w-full text-left border-collapse min-w-[600px]">
                 <thead className="bg-white border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
                   <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
                     <th className="py-3 px-4 border-r-2 border-slate-100 w-16 text-center">TÜR</th>
                     <th className="py-3 px-4 border-r-2 border-slate-100 w-1/4">Tarih & Personel</th>
                     <th className="py-3 px-4 border-r-2 border-slate-100">İşlem Detayı & Barkod Bilgisi</th>
                     <th className="py-3 px-4 text-right w-32">Statü</th>
                   </tr>
                 </thead>
                 <tbody className="text-xs font-medium text-slate-700 divide-y-2 divide-slate-200">
                   {data?.recentPutawayLogs?.map((log) => {
                     const action = log.action_type.toUpperCase();
                     const isPutaway = action.includes("INBOUND") || action.includes("PUTAWAY") || action.includes("ADD");
                     const isPicking = action.includes("OUTBOUND") || action.includes("PICKING") || action.includes("REMOVE");
                     
                     // Detaydaki ID veya Barkodları tespit edip bold yapmak için basit bir regex (Opsiyonel)
                     const formattedDesc = log.description?.replace(/\[(.*?)\]/g, '<strong>[$1]</strong>');

                     return (
                       <tr key={log.id} className="hover:bg-white transition-colors group">
                         <td className="py-3 px-4 text-center align-top border-l-4 border-l-transparent group-hover:border-l-blue-500 bg-white">
                            <div className={`w-8 h-8 rounded-none border-2 flex items-center justify-center mx-auto ${isPutaway ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : isPicking ? 'bg-red-50 border-red-300 text-[#dc3545]' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                              {isPutaway ? <LogIn size={14} strokeWidth={3} /> : isPicking ? <LogOut size={14} strokeWidth={3} /> : <Info size={14} strokeWidth={3} />}
                            </div>
                         </td>
                         <td className="py-3 px-4 align-top">
                           <span className="block font-black text-slate-900 uppercase text-[11px] truncate max-w-[180px]">{log.employee_name}</span>
                           {log.created_at && <span className="block text-[10px] font-mono font-bold text-slate-500 mt-1">{new Date(log.created_at).toLocaleString('tr-TR')}</span>}
                         </td>
                         <td className="py-3 px-4 align-top">
                            {/* Regex ile formatlanmış ise dangerouslySetInnerHTML ile, değilse normal bas */}
                           {formattedDesc ? (
                             <span className="text-[11px] leading-relaxed text-slate-700 font-mono" dangerouslySetInnerHTML={{ __html: formattedDesc }}></span>
                           ) : (
                             <span className="text-[11px] leading-relaxed text-slate-700 font-mono">{log.description || "-"}</span>
                           )}
                         </td>
                         <td className="py-3 px-4 text-right align-top">
                           <span className={`px-2 py-1 border-2 rounded-none text-[9px] font-black uppercase tracking-widest whitespace-nowrap inline-block shadow-sm ${isPutaway ? 'bg-emerald-50 text-emerald-700 border-emerald-500' : isPicking ? 'bg-red-50 text-[#dc3545] border-red-500' : 'bg-slate-50 text-slate-700 border-slate-400'}`}>
                             {isPutaway ? 'RAFLAMA (+)' : isPicking ? 'ÇIKIŞ (-)' : 'SİSTEM LOG'}
                           </span>
                         </td>
                       </tr>
                     )
                   })}
                   {(!data?.recentPutawayLogs || data.recentPutawayLogs.length === 0) && (
                     <tr><td colSpan={4} className="py-16 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest bg-white">Depo işlemi kaydı bulunamadı</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>

          {/* İZİN HAREKETLERİ (col-4) */}
          <div className="lg:col-span-4 bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#94a3b8] rounded-none flex flex-col w-full h-[450px]">
            <div className="flex justify-between items-center p-4 border-b-4 border-orange-500 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><CalendarDays className="w-5 h-5 text-orange-400" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Personel İzinleri</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Son Onaylanan / Bekleyenler</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2 bg-slate-50">
              {data?.recentLeaveLogs?.slice(0, 10).map((log) => (
                <div key={log.id} className="flex flex-col border border-slate-200 bg-white p-3 rounded-none shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md border-l-4 border-l-transparent hover:border-l-orange-400">
                  <div className="flex justify-between items-start mb-2">
                     <span className="text-[11px] font-black text-slate-900 uppercase truncate pr-2">{log.employee_name}</span>
                     <span className={`px-1.5 py-0.5 rounded-none text-[8px] font-black uppercase tracking-widest border shrink-0 ${getStatusStyle(log.status)}`}>
                       {getStatusText(log.status)}
                     </span>
                  </div>
                  <div className="flex justify-between items-end mt-1 border-t border-slate-100 pt-2">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={12} />
                      <span className="text-[9px] font-mono font-bold">{formatDateRange(log.start_date, log.end_date)}</span>
                    </div>
                    <span className="inline-block bg-slate-100 border border-slate-300 px-1.5 py-0.5 text-[9px] text-slate-700 font-black uppercase shadow-sm">
                      {log.leave_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {(!data?.recentLeaveLogs || data.recentLeaveLogs.length === 0) && (
                <div className="py-16 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">İzin Kaydı Bulunmuyor</div>
              )}
            </div>
          </div>

        </div>

      </main>
      <Footer />
    </div>
  );
}