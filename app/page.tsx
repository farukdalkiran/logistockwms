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
  AlertOctagon, BellRing, BarChart2, UserCheck, CalendarDays, LogIn, LogOut, Info
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
    if (s === "TAMAMLANDI" || s === "COMPLETED" || s === "APPROVED") return "bg-emerald-50 text-emerald-700 border-emerald-300";
    if (s === "YOLDA" || s === "ACTIVE") return "bg-blue-50 text-blue-700 border-blue-300";
    if (s === "BEKLIYOR" || s === "PENDING") return "bg-orange-50 text-orange-700 border-orange-300";
    if (s === "TOPLANIYOR") return "bg-purple-50 text-purple-700 border-purple-300";
    if (s === "REJECTED" || s === "IPTAL") return "bg-red-50 text-[#dc3545] border-red-300";
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

  const totalCargoCount = cargoDist.reduce((acc, curr) => acc + curr.count, 0);

  const renderConicGradient = () => {
    if (cargoDist.length === 0 || totalCargoCount === 0) return "conic-gradient(#f1f5f9 0% 100%)";
    let currentPercent = 0;
    const stops = cargoDist.map(item => {
      const start = currentPercent;
      const end = currentPercent + (item.count / totalCargoCount) * 100;
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

  // =========================================
  // SADELEŞTİRİLMİŞ YÜKLEME (LOADING) EKRANI
  // =========================================
  if (isAuthLoading || (loading && !data)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] overflow-x-hidden">
        <Navbar />
        {/* Mobilde ekranı tam kaplaması için min-h-[80vh] kullanıldı */}
        <main className="flex-1 w-full flex flex-col items-center justify-center min-h-[80vh] p-4">
          <div className="flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="relative flex items-center justify-center mb-6">
              {/* Arkadaki ping animasyonu */}
              <div className="absolute inset-0 border-4 border-[#dc3545]/20 rounded-xl animate-ping"></div>
            </div>
            
            
            {/* 3 Noktalı Bouncing Animasyonu */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-[#dc3545] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-mono">
              Sistem Yükleniyor...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const profileSafe = userProfile as Record<string, any> | null;
  const isGlobal = profileSafe?.role === "Developer" || profileSafe?.role === "Admin" || !profileSafe?.branch_id;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] text-slate-800 selection:bg-[#dc3545] selection:text-white overflow-x-hidden">
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Keskin Hatlı Satır Yüklenme Animasyonu */
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-staggered {
          opacity: 0;
          animation: fadeSlideUp 0.3s ease-out forwards;
        }
      `}} />

      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden pb-16">
        
        {/* =========================================
            1. ENDÜSTRİYEL HERO HEADER & DB LOAD
            ========================================= */}
{/* =========================================
            1. ENDÜSTRİYEL HERO HEADER & DB LOAD
            ========================================= */}
        <div className="w-full bg-[#0F172B] border border-slate-800 border-l-[8px] border-l-[#dc3545] rounded-md shadow-md relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0"></div>
          
          <div className="relative z-10 p-6 lg:p-8 flex flex-col gap-1 w-full flex-1 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-3">
              {/* Sistem Statü Etiketi */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-sm shadow-inner">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-sm bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-sm h-2 w-2 bg-emerald-500"></span>
                </div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-mono">
                  {isGlobal ? "MASTER YETKİ AKTİF" : "LOKAL BAĞLANTI"}
                </span>
              </div>
              
              {/* Şube / Lokasyon Bilgisi Etiketi */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-sm shadow-inner">
                <Building2 size={12} className={isGlobal ? "text-blue-400" : "text-amber-400"} />
                <span className={`text-[10px] font-black uppercase tracking-widest font-mono ${isGlobal ? "text-blue-400" : "text-amber-400"}`}>
                  {isGlobal ? "MERKEZ KOMUTA" : (profileSafe?.branch_name || "ŞUBE ATANMADI")}
                </span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase leading-none">
              HOŞ GELDİNİZ, <span className="text-[#dc3545]">{profileSafe?.full_name?.split(' ')[0] || 'YÖNETİCİ'}</span>
            </h1>
            
            <h2 className="text-sm sm:text-base font-black text-slate-500 tracking-[0.2em] uppercase flex items-center justify-center lg:justify-start gap-2 mt-2">
              LOGISTOCK <span className="text-[#dc3545]">WMS</span> SİSTEMİ
            </h2>

            <p className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em] font-mono mt-4 max-w-3xl leading-relaxed border-l-2 border-slate-700 pl-3">
              Mağaza ve depo arası iletişim ile transferlerin yönetildiği, kesintisiz ürün akışının sağlandığı, personel mesai ve izin haklarının takip edildiği tam otomatik depo yönetim altyapısı.
            </p>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-right bg-slate-900/80 border-t lg:border-t-0 border-l-0 lg:border-l border-slate-700/80 p-6 h-full w-full lg:w-auto shrink-0 justify-center lg:justify-end">
            <div className="flex flex-col gap-1 text-center lg:text-left border-b md:border-b-0 md:border-r border-slate-700 pb-4 md:pb-0 md:pr-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono flex items-center justify-center lg:justify-start gap-1.5"><Database size={14} className="text-[#dc3545]"/> DB Doluluk (Yük)</span>
              <div className="flex items-center justify-center lg:justify-start gap-3 mt-1.5">
                <div className="w-24 bg-slate-800 h-2.5 rounded-sm overflow-hidden border border-slate-700"><div className="bg-[#dc3545] h-full transition-all duration-700 ease-out" style={{ width: `${data?.systemLoad || 0}%` }}></div></div>
                <span className="text-sm font-black text-white font-mono">%{data?.systemLoad || 0}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-center lg:text-right px-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Sistem Saati</span>
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* =========================================
            YÖNETİCİNİN DİKKATİNE PANELI
            ========================================= */}
        {hasPending && (
          <div className="w-full bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-md shadow-sm relative overflow-hidden p-4 flex flex-col md:flex-row items-center justify-between gap-4 mt-1">
            <div className="relative z-10 flex flex-col gap-1 w-full">
              <div className="flex items-center gap-2 text-amber-800">
                <BellRing className="w-5 h-5 animate-bounce" />
                <h2 className="text-sm font-black uppercase tracking-widest">Yöneticinin Dikkatine</h2>
              </div>
              <p className="text-amber-700 font-bold text-xs uppercase tracking-widest mt-1 font-mono">
                Sistemde onayınızı bekleyen <span className="text-sm bg-amber-200 px-1.5 py-0.5 rounded-sm font-black border border-amber-300">{pendingTotal}</span> adet <strong className="text-amber-900">İzin veya Mesai Düzeltme</strong> talebi bulunmaktadır.
              </p>
            </div>
            <button onClick={() => router.push('/management/hr/approvals')} className="relative z-10 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-md transition-colors shadow-sm flex items-center gap-2 shrink-0">
              <UserCheck size={16} /> TALEPLERİ İNCELE
            </button>
          </div>
        )}

        {/* =========================================
            2. KPI KARTLARI (Keskin Hatlı)
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
            <div key={idx} className="bg-white p-4 border border-slate-200 shadow-sm rounded-md flex flex-col justify-between gap-3 transition-colors hover:border-slate-400 group">
              <div className="flex items-start justify-between">
                <div className={`w-9 h-9 flex items-center justify-center rounded-md border ${kpi.bg}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-2xl font-black text-slate-800 leading-none truncate font-mono">{kpi.value}</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 truncate group-hover:text-slate-700 transition-colors">{kpi.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* =========================================
            3. ANA OPERASYON MATRİSİ (12 SÜTUN)
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          
          {/* --- SOL PANEL: TRANSFER VE TOPLAMA MERKEZİ (8 SÜTUN) --- */}
          <div className="lg:col-span-8 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[600px] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm"><Package className="w-5 h-5 text-slate-700" /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Transfer & Toplama Merkezi</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">Aktif Lojistik Durumu</p>
                </div>
              </div>
            </div>

            {/* İstatistikler */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-200 shrink-0 bg-white">
              <div className="flex flex-col items-center p-4 border-r border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                <span className="text-2xl font-black text-slate-800 font-mono">{tStats.yolda}</span>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1"><Truck size={12} className="inline mr-1"/> GÖNDERİLDİ</span>
              </div>
              <div className="flex flex-col items-center p-4 border-r border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                <span className="text-2xl font-black text-slate-800 font-mono">{tStats.toplaniyor}</span>
                <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-1 flex items-center gap-1">
                  <Package size={12} /> SAYIMDA {tStats.toplaniyor > 0 && <span className="w-1.5 h-1.5 bg-purple-500 rounded-sm animate-pulse"></span>}
                </span>
              </div>
              <div className="flex flex-col items-center p-4 border-r border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                <span className="text-2xl font-black text-slate-800 font-mono">{tStats.bekliyor}</span>
                <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest mt-1"><Timer size={12} className="inline mr-1"/> BEKLİYOR</span>
              </div>
              <div className="flex flex-col items-center p-4 hover:bg-slate-50 transition-colors">
                <span className="text-2xl font-black text-slate-800 font-mono">{tStats.tamamlandi}</span>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1"><CheckCircle2 size={12} className="inline mr-1"/> TAMAMLANDI</span>
              </div>
            </div>

            {/* Sparkline Grafiği */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 flex flex-col gap-2 relative">
              <div className="flex items-center justify-between relative z-10">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><BarChart2 size={14} className="text-slate-500" /> Son 30 Transfer Yoğunluğu</h4>
              </div>
              <div className="flex items-end gap-[2px] h-10 w-full relative z-10 border-b-2 border-slate-300 pb-1 px-1">
                {data?.recentTransfers?.slice(0, 30).map((tx, idx) => {
                  let barColor = "bg-slate-300";
                  let h = "h-3";
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
                      className={`flex-1 ${barColor} ${h} hover:opacity-80 rounded-t-sm transition-all duration-200 cursor-pointer animate-staggered`}
                      style={{ animationDelay: `${idx * 15}ms` }}
                    ></div>
                  )
                })}
                {(!data?.recentTransfers || data.recentTransfers.length === 0) && (
                  <div className="w-full text-center text-slate-500 text-xs font-bold uppercase mt-2">Veri Yok</div>
                )}
              </div>
            </div>

            {/* Detaylı Transfer Tablosu */}
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar bg-white">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-10">
                  <tr className="text-[11px] uppercase tracking-widest text-slate-600 font-black">
                    <th className="py-3 px-5 w-32 border-r border-slate-200">TR Kodu</th>
                    <th className="py-3 px-5 w-1/4 border-r border-slate-200">Kaynak</th>
                    <th className="py-3 px-5 w-1/4 border-r border-slate-200">Hedef</th>
                    <th className="py-3 px-5 border-r border-slate-200">Personel</th>
                    <th className="py-3 px-5 text-right">Durum & Tarih</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-100">
                  {data?.recentTransfers?.map((tx, idx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors animate-staggered" style={{ animationDelay: `${idx * 30}ms` }}>
                      <td className="py-3 px-5 font-black text-slate-900 border-r border-slate-100">
                        <span className="bg-white text-slate-800 px-2 py-1 rounded-sm font-mono text-[11px] border border-slate-300 shadow-sm">{tx.transfer_code}</span>
                      </td>
                      <td className="py-3 px-5 text-slate-700 font-bold truncate max-w-[120px] border-r border-slate-100" title={tx.from_branch_name}>{tx.from_branch_name}</td>
                      <td className="py-3 px-5 text-slate-900 font-black truncate max-w-[120px] border-r border-slate-100" title={tx.to_branch_name}>
                        <ArrowRight size={14} className="inline text-slate-400 mr-1.5" />{tx.to_branch_name}
                      </td>
                      <td className="py-3 px-5 text-slate-600 uppercase text-[10px] font-bold border-r border-slate-100">
                        <Users size={14} className="inline mr-1.5 text-slate-400" />{tx.picker_name}
                      </td>
                      <td className="py-3 px-5 text-right flex flex-col items-end gap-1">
                        <span className={`px-2.5 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5 ${getStatusStyle(tx.status)}`}>
                           {['YOLDA', 'TOPLANIYOR'].includes(tx.status.toUpperCase().replace('İ', 'I')) && (
                             <span className="w-1.5 h-1.5 rounded-sm bg-current animate-pulse opacity-80"></span>
                           )}
                           {getStatusText(tx.status)}
                        </span>
                        {tx.created_at && (
                           <span className="text-[10px] font-mono text-slate-500 block">{new Date(tx.created_at).toLocaleDateString('tr-TR')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentTransfers || data.recentTransfers.length === 0) && (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Bekleyen veya aktif transfer bulunmuyor</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* --- SAĞ PANEL: KARGO & TESLİMAT MERKEZİ (4 SÜTUN) --- */}
          <div className="lg:col-span-4 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[600px] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm"><Truck className="w-5 h-5 text-slate-700" /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Kargo Dağılımı</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">Teslimat Firmaları Özeti</p>
                </div>
              </div>
            </div>

            {/* Üst Kısım: Donut Grafiği ve Toplamlar */}
            <div className="p-5 border-b border-slate-200 bg-white shrink-0 flex flex-col gap-4 relative">
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="flex-1 flex flex-col gap-1.5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Dağılım Özeti</h4>
                  {cargoDist.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] font-black uppercase text-slate-700 tracking-widest bg-slate-50 px-3 py-2 border border-slate-200 rounded-sm">
                      <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm border border-black/10" style={{ backgroundColor: c.color }}></span>{c.carrier}</span>
                      <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-sm text-slate-800">{c.count}</span>
                    </div>
                  ))}
                  {(cargoDist.length === 0) && (
                     <span className="text-xs text-slate-400 font-bold uppercase mt-2">Veri Yok</span>
                  )}
                </div>

                {/* Donut Grafiği - Ortası Delik ve Total Sayı Ekli */}
                <div className="flex shrink-0 items-center justify-center p-2">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full shadow-inner relative flex items-center justify-center border-4 border-slate-50" style={{ background: renderConicGradient() }}>
                     {/* Donut Deliği */}
                     <div className="absolute w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-sm border border-slate-100">
                        <span className="text-2xl font-black text-slate-800 font-mono tracking-tighter leading-none">{totalCargoCount}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Kargo</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alt Kısım: Teslimat Yapanlar Logu */}
            <div className="p-3 border-b-2 border-slate-200 bg-slate-100 shrink-0">
               <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5 pl-2"><Clock size={14}/> Son Teslimat Seansları</h4>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar bg-white">
              <table className="w-full text-left border-collapse min-w-[350px]">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-black border-b-2 border-slate-100">
                    <th className="py-2.5 px-4 border-r border-slate-100">Firma & Saat</th>
                    <th className="py-2.5 px-4">Teslim Eden</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-100">
                  {data?.recentCargoSessions?.map((session, idx) => (
                    <tr key={session.id} className="hover:bg-slate-50 transition-colors animate-staggered" style={{ animationDelay: `${idx * 30}ms` }}>
                      <td className="py-3 px-4 border-r border-slate-100">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-slate-900 text-[11px] uppercase tracking-wider truncate max-w-[140px]">{session.carrier_name}</span>
                          <span className="text-[10px] font-mono text-slate-600 whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded-sm w-max border border-slate-200">
                            {formatTimeRange(session.started_at, session.completed_at)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="text-slate-800 text-[11px] uppercase truncate max-w-[140px] font-black">{session.employee_name}</span>
                          <span className={`px-2 py-0.5 border rounded-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm ${getStatusStyle(session.status)}`}>{getStatusText(session.status)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentCargoSessions || data.recentCargoSessions.length === 0) && (
                    <tr><td colSpan={2} className="py-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* =========================================
            4. ALT MATRİS: DEPO LOGLARI & İZİNLER
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          
          {/* DEPO OPERASYON LOGLARI DETAYLI (col-8) */}
          <div className="lg:col-span-8 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[450px] overflow-hidden">
             <div className="flex justify-between items-center p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
               <div className="flex items-center gap-3">
                 <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm"><BoxSelect className="w-5 h-5 text-slate-700" /></div>
                 <div>
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Depo Operasyon Logları (Detaylı)</h3>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">Gerçek Zamanlı Raf ve Stok Aksiyonları</p>
                 </div>
               </div>
             </div>
             
             <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar bg-white">
               <table className="w-full text-left border-collapse min-w-[600px]">
                 <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-10">
                   <tr className="text-[11px] uppercase tracking-widest text-slate-600 font-black">
                     <th className="py-3 px-5 w-16 text-center border-r border-slate-200">Tür</th>
                     <th className="py-3 px-5 w-1/4 border-r border-slate-200">Tarih & Personel</th>
                     <th className="py-3 px-5 border-r border-slate-200">İşlem Detayı & Barkod Bilgisi</th>
                     <th className="py-3 px-5 text-right w-32">Statü</th>
                   </tr>
                 </thead>
                 <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-100">
                   {data?.recentPutawayLogs?.map((log, idx) => {
                     const action = log.action_type.toUpperCase();
                     const isPutaway = action.includes("INBOUND") || action.includes("PUTAWAY") || action.includes("ADD");
                     const isPicking = action.includes("OUTBOUND") || action.includes("PICKING") || action.includes("REMOVE");
                     const formattedDesc = log.description?.replace(/\[(.*?)\]/g, '<strong class="text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-sm border border-slate-300 font-mono">[$1]</strong>');

                     return (
                       <tr key={log.id} className="hover:bg-slate-50 transition-colors animate-staggered" style={{ animationDelay: `${idx * 30}ms` }}>
                         <td className="py-3 px-5 text-center align-top border-r border-slate-100">
                            <div className={`w-8 h-8 rounded-sm border flex items-center justify-center mx-auto shadow-sm ${isPutaway ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : isPicking ? 'bg-red-50 border-red-300 text-[#dc3545]' : 'bg-slate-50 border-slate-300 text-slate-600'}`}>
                              {isPutaway ? <LogIn size={14} strokeWidth={2.5} /> : isPicking ? <LogOut size={14} strokeWidth={2.5} /> : <Info size={14} strokeWidth={2.5} />}
                            </div>
                         </td>
                         <td className="py-3 px-5 align-top border-r border-slate-100">
                           <span className="block font-black text-slate-900 uppercase text-xs truncate max-w-[180px]">{log.employee_name}</span>
                           {log.created_at && <span className="block text-[10px] font-mono font-bold text-slate-500 mt-1">{new Date(log.created_at).toLocaleString('tr-TR')}</span>}
                         </td>
                         <td className="py-3 px-5 align-top border-r border-slate-100">
                           {formattedDesc ? (
                             <span className="text-[11px] leading-relaxed text-slate-700 block mt-0.5" dangerouslySetInnerHTML={{ __html: formattedDesc }}></span>
                           ) : (
                             <span className="text-[11px] leading-relaxed text-slate-700 block mt-0.5">{log.description || "-"}</span>
                           )}
                         </td>
                         <td className="py-3 px-5 text-right align-top">
                           <span className={`px-2.5 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap inline-block shadow-sm ${isPutaway ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : isPicking ? 'bg-red-50 text-[#dc3545] border-red-300' : 'bg-slate-50 text-slate-700 border-slate-300'}`}>
                             {isPutaway ? 'RAFLAMA (+)' : isPicking ? 'ÇIKIŞ (-)' : 'SİSTEM LOG'}
                           </span>
                         </td>
                       </tr>
                     )
                   })}
                   {(!data?.recentPutawayLogs || data.recentPutawayLogs.length === 0) && (
                     <tr><td colSpan={4} className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-widest bg-white">Depo işlemi kaydı bulunamadı</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>

          {/* İZİN HAREKETLERİ (col-4) */}
          <div className="lg:col-span-4 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[450px] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm"><CalendarDays className="w-5 h-5 text-slate-700" /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Personel İzinleri</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">Son Onaylanan & Bekleyenler</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2 bg-slate-100/50">
              {data?.recentLeaveLogs?.slice(0, 10).map((log, idx) => (
                <div key={log.id} className="flex flex-col border border-slate-200 bg-white p-3 rounded-md shadow-sm transition-colors hover:border-slate-400 animate-staggered" style={{ animationDelay: `${idx * 30}ms` }}>
                  <div className="flex justify-between items-start mb-2">
                     <span className="text-xs font-black text-slate-900 uppercase truncate pr-2">{log.employee_name}</span>
                     <span className={`px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-widest border shrink-0 shadow-sm ${getStatusStyle(log.status)}`}>
                       {getStatusText(log.status)}
                     </span>
                  </div>
                  <div className="flex justify-between items-end mt-1 border-t border-slate-100 pt-2">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={12} className="text-slate-500" />
                      <span className="text-[10px] font-mono font-bold tracking-wider text-slate-700">{formatDateRange(log.start_date, log.end_date)}</span>
                    </div>
                    <span className="inline-block bg-slate-50 border border-slate-300 px-2 py-0.5 rounded-sm text-[9px] text-slate-700 font-black uppercase shadow-sm">
                      {log.leave_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {(!data?.recentLeaveLogs || data.recentLeaveLogs.length === 0) && (
                <div className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">İzin Kaydı Bulunmuyor</div>
              )}
            </div>
          </div>

        </div>

      </main>
      <Footer />
    </div>
  );
}