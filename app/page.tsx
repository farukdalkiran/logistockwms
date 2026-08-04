"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDashboardDataServer } from "@/app/actions/dashboard";
import { CARRIERS } from "@/lib/cargoConfig";
import {
  Building2, Users, AlertCircle, Package, 
  Layers, BarChart3, Database, 
  CalendarDays, BoxSelect, Truck, Clock
} from "lucide-react";

interface DashboardData {
  kpis: { branches: number; employees: number; stockVolume: number; pendingTotal: number; };
  weeklyActivity: { day: string; value: number }[];
  cargoDistribution: { carrier: string; count: number; color: string }[];
  recentTransfers: any[];
  recentPutawayLogs: any[];
  recentLeaveLogs: any[];
  recentCargoSessions: any[]; 
  dbSizeMB: number;
  systemLoad: number;
}

// FİRMA MARKA RENKLERİ
const BRAND_COLORS: Record<string, string> = {
  "Kolay Gelsin": "#22c55e",       // Yeşil
  "Hepsijet": "#ef4444",           // Kırmızı (Güncellendi)
  "Trendyol Express": "#ea580c",   // Koyu Turuncu
  "UPS Kargo": "#111827",          // Siyah
  "Aras Kargo": "#dc3545",         // Kırmızı (Crimson)
  "MNG Kargo": "#3b82f6",          // Mavi
  "Sendeo": "#eab308",             // Sarı
  "Bilinmeyen": "#94a3b8"          // Gri
};

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
    if (result.success && result.data) setData(result.data);
    setLoading(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case "TAMAMLANDI": 
      case "COMPLETED": 
      case "APPROVED": return "bg-emerald-50 text-emerald-700 border-emerald-300";
      case "YOLDA": 
      case "ACTIVE": return "bg-blue-50 text-blue-700 border-blue-300";
      case "BEKLIYOR": 
      case "PENDING": return "bg-orange-50 text-orange-700 border-orange-300";
      case "REJECTED": return "bg-red-50 text-[#dc3545] border-red-300";
      default: return "bg-slate-50 text-slate-600 border-slate-300";
    }
  };

  const getStatusText = (status: string) => {
    if(status === 'APPROVED') return 'ONAYLANDI';
    if(status === 'PENDING') return 'BEKLİYOR';
    if(status === 'REJECTED') return 'REDDEDİLDİ';
    if(status === 'COMPLETED') return 'TAMAMLANDI';
    if(status === 'ACTIVE') return 'DEVAM EDİYOR';
    return status;
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
    if (!data?.cargoDistribution || data.cargoDistribution.length === 0) {
      return "conic-gradient(#f1f5f9 0% 100%)";
    }
    const total = data.cargoDistribution.reduce((acc, curr) => acc + curr.count, 0);
    if (total === 0) return "conic-gradient(#f1f5f9 0% 100%)";

    let currentPercent = 0;
    const stops = data.cargoDistribution.map(item => {
      const start = currentPercent;
      const end = currentPercent + (item.count / total) * 100;
      currentPercent = end;
      const color = BRAND_COLORS[item.carrier] || item.color;
      return `${color} ${start}% ${end}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  };

  if (isAuthLoading || (loading && !data)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] overflow-x-hidden">
        <Navbar />
        <main className="flex-1 w-full max-w-[1400px] mx-auto flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-[#dc3545] rounded-none animate-spin shadow-sm"></div>
          <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse font-mono">SİSTEM VERİLERİ ÇEKİLİYOR...</p>
        </main>
        <Footer />
      </div>
    );
  }

  const isGlobal = userProfile?.role === "Developer" || userProfile?.role === "Admin" || userProfile?.isGlobalAdmin;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] text-slate-800 selection:bg-[#dc3545] selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-8 overflow-hidden pb-16">
        
        {/* 1. DARK-INDUSTRIAL WMS HERO HEADER */}
        <div className="w-full bg-[#0b101e] border-2 border-slate-800 border-l-8 border-l-[#dc3545] rounded-none shadow-[8px_8px_0px_#cbd5e1] relative overflow-hidden flex flex-col lg:flex-row items-center justify-between p-6 lg:p-8 gap-6">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-red-600/10 via-[#dc3545]/10 to-transparent rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col gap-1 w-full lg:w-auto text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-none h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-none font-mono">
                {isGlobal ? "GLOBAL YÖNETİM ERİŞİMİ" : "ŞUBE BAĞLANTISI AKTİF"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase leading-none drop-shadow-md flex items-center justify-center lg:justify-start gap-3">
              <span>LOGISTOCK <span className="text-[#dc3545]">WMS</span></span>
            </h1>
            <p className="text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest font-mono">Sistem Operasyon Özeti ve Canlı Veri Akışı</p>
          </div>
        </div>

        {/* 2. KPI KARTLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {[
            { title: "Bağlı Lokasyonlar", value: data?.kpis.branches, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
            { title: "Aktif Personel", value: data?.kpis.employees, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
            { title: "Toplam Stok (Adet)", value: data?.kpis.stockVolume.toLocaleString('tr-TR'), icon: Layers, color: "text-[#dc3545]", bg: "bg-red-50" },
            { title: "Bekleyen Onaylar", value: data?.kpis.pendingTotal, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" }
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white p-5 border-2 border-slate-300 shadow-[4px_4px_0px_#cbd5e1] flex items-center justify-between gap-4 rounded-none transition-transform hover:-translate-y-1">
              <div className="flex flex-col min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">{kpi.title}</p>
                <p className="text-3xl font-black text-slate-900 leading-none truncate font-mono">{kpi.value}</p>
              </div>
              <div className={`w-12 h-12 ${kpi.bg} flex items-center justify-center shrink-0 rounded-none border-2 ${kpi.bg.replace('bg-', 'border-').replace('50', '200')}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* 3. İSTATİSTİK GRAFİKLERİ (3'LÜ MATRİS) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
          
          {/* GRAFİK 1: Haftalık Terminal Trafiği */}
          <div className="bg-white p-6 border-2 border-slate-300 shadow-[6px_6px_0px_#cbd5e1] rounded-none flex flex-col relative w-full h-[360px]">
            <div className="flex justify-between items-center mb-8 border-b-2 border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-slate-900 border-2 border-slate-800"><BarChart3 className="w-4 h-4 text-white" /></div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Terminal Trafiği</h3>
              </div>
            </div>

            <div className="flex-1 flex items-end justify-between gap-2 border-b-2 border-slate-300 relative pt-4">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="w-full border-t-2 border-slate-400 border-dashed h-0"></div>
                <div className="w-full border-t-2 border-slate-400 border-dashed h-0"></div>
                <div className="w-full border-t-2 border-slate-400 border-dashed h-0"></div>
              </div>

              {data?.weeklyActivity.map((day, idx) => {
                const maxVal = Math.max(...(data?.weeklyActivity.map((d) => d.value) || []), 10);
                const heightPercent = Math.max((day.value / maxVal) * 100, 5);
                return (
                  <div key={idx} className="flex flex-col items-center gap-2 w-full group relative z-10 h-full justify-end">
                    <div className="w-full max-w-[36px] bg-slate-100 relative flex items-end h-full border-x-2 border-t-2 border-slate-300 hover:bg-slate-200 transition-colors">
                      <div className={`w-full transition-all duration-700 border-t-2 border-slate-900 ${idx % 2 === 0 ? "bg-slate-800" : "bg-slate-600"}`} style={{ height: `${heightPercent}%` }}></div>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#dc3545] text-white text-[10px] font-black px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none shadow-none border-2 border-red-800 font-mono">{day.value}</div>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">{day.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRAFİK 2: Günlük Kargo Dağılımı (Marka Renkleri Donut) */}
          <div className="bg-white p-6 border-2 border-slate-300 shadow-[6px_6px_0px_#cbd5e1] rounded-none flex flex-col items-center justify-between w-full h-[360px]">
            <div className="w-full flex justify-between items-center mb-2 border-b-2 border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-slate-900 border-2 border-slate-800"><Truck className="w-4 h-4 text-white" /></div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Kargo Çıkışı Dağılımı</h3>
              </div>
            </div>
            
            <div className="flex-1 flex w-full items-center justify-center relative mt-2">
              <div 
                className="w-44 h-44 rounded-full flex items-center justify-center shadow-[inset_0px_0px_10px_rgba(0,0,0,0.1)] relative transition-all duration-1000 border-[8px] border-white" 
                style={{ background: renderConicGradient() }}
              >
                <div className="w-28 h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-lg z-10 border-4 border-slate-50">
                  <span className="text-2xl font-black text-slate-900 font-mono leading-none">
                    {data?.cargoDistribution?.reduce((a, b) => a + b.count, 0) || 0}
                  </span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Paket</span>
                </div>
              </div>
            </div>

            <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6">
              {data?.cargoDistribution?.map((c, idx) => (
                <div key={idx} className="flex items-center gap-1.5 border border-slate-200 px-2 py-1 bg-slate-50">
                  <span className="w-3 h-3 rounded-none border border-slate-400" style={{ backgroundColor: BRAND_COLORS[c.carrier] || c.color }}></span>
                  <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">{c.carrier} <span className="font-mono text-slate-500 ml-1">({c.count})</span></span>
                </div>
              ))}
              {(!data?.cargoDistribution || data.cargoDistribution.length === 0) && (
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Veri Bekleniyor</span>
              )}
            </div>
          </div>

          {/* GRAFİK 3: GERÇEK Veritabanı Yükü ve Sağlık */}
          <div className="bg-white p-6 border-2 border-slate-300 shadow-[6px_6px_0px_#cbd5e1] rounded-none flex flex-col items-center justify-between w-full h-[360px]">
            <div className="w-full flex justify-between items-center mb-4 border-b-2 border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-slate-900 border-2 border-slate-800"><Database className="w-4 h-4 text-white" /></div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Veritabanı Doluluk Oranı</h3>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center w-full">
              <div 
                className="w-40 h-40 rounded-full flex items-center justify-center shadow-[inset_0px_0px_10px_rgba(0,0,0,0.1)] relative transition-all duration-1000 border-[8px] border-slate-100" 
                style={{ background: `conic-gradient(#dc3545 0% ${data?.systemLoad || 0}%, #f8fafc ${data?.systemLoad || 0}% 100%)` }}
              >
                <div className="w-28 h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-slate-50 z-10">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter font-mono">%{data?.systemLoad || 0}</span>
                </div>
              </div>
            </div>

            <div className="w-full text-center mt-4 border-t-2 border-slate-100 pt-4">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 border border-emerald-200">
                Sistem Alanı Yeterli
              </span>
            </div>
          </div>

        </div>

        {/* 4. LOG MATRİSİ (RENKLENDİRİLMİŞ ENDÜSTRİYEL TABLOLAR) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 w-full items-start mt-4">
          
          {/* LOG 1: Kargo Teslimat Tutanakları (KIRMIZI VURGU) */}
          <div className="bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#cbd5e1] rounded-none flex flex-col w-full h-[450px]">
            <div className="flex justify-between items-center p-4 lg:p-5 border-b-4 border-[#dc3545] bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><Truck className="w-5 h-5 text-white" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Kargo Teslimatları</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Operatör ve Zaman Çizelgesi</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-600 font-black">
                    <th className="py-3 px-5 border-r-2 border-white">Kargo Firması</th>
                    <th className="py-3 px-5 border-r-2 border-white">Saat Aralığı</th>
                    <th className="py-3 px-5 border-r-2 border-white">Teslim Eden</th>
                    <th className="py-3 px-5 border-r-2 border-white text-center">Paket</th>
                    <th className="py-3 px-5 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-100">
                  {data?.recentCargoSessions?.map((session) => {
                    const carrier = CARRIERS.find(c => c.name === session.carrier_name);
                    return (
                      <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-5 border-l-4 border-l-transparent hover:border-l-[#dc3545]">
                          <div className="flex items-center gap-3">
                            {carrier?.logo ? (
                              <div className="h-8 w-16 bg-white border border-slate-200 flex items-center justify-center p-1">
                                <img src={carrier.logo} alt={session.carrier_name} className="max-h-full max-w-full object-contain" />
                              </div>
                            ) : (
                              <span className="font-black text-slate-900 uppercase">{session.carrier_name}</span>
                            )}
                            {!carrier?.logo && <span className="font-black text-slate-900 uppercase">{session.carrier_name}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <span className="text-[11px] font-mono font-black text-slate-600 flex items-center gap-1.5 bg-slate-100 px-2 py-1 w-fit border border-slate-200">
                            <Clock size={12} className="text-[#dc3545]"/> {formatTimeRange(session.started_at, session.completed_at)}
                          </span>
                        </td>
                        <td className="py-3 px-5 font-black text-slate-800 truncate max-w-[120px]" title={session.employees?.full_name}>
                          {session.employees?.full_name || "Bilinmiyor"}
                        </td>
                        <td className="py-3 px-5 text-center font-mono font-black text-slate-900 text-sm">
                          {session.total_items || 0}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <span className={`px-2.5 py-1 border-2 rounded-none text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${getStatusStyle(session.status)}`}>
                            {getStatusText(session.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {(!data?.recentCargoSessions || data.recentCargoSessions.length === 0) && (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* LOG 2: Depo Operasyon Logları (MAVİ VURGU) */}
          <div className="bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#cbd5e1] rounded-none flex flex-col w-full h-[450px]">
            <div className="flex justify-between items-center p-4 lg:p-5 border-b-4 border-blue-600 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><BoxSelect className="w-5 h-5 text-blue-400" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Depo Operasyonları</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Raflama ve Toplama</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-600 font-black">
                    <th className="py-3 px-5 border-r-2 border-white">Personel</th>
                    <th className="py-3 px-5 border-r-2 border-white w-1/2">İşlem Detayı</th>
                    <th className="py-3 px-5 text-right">Aksiyon Tipi</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-100">
                  {data?.recentPutawayLogs?.map((log) => {
                    const action = log.action_type.toUpperCase();
                    const isPutaway = action.includes("INBOUND") || action.includes("PUTAWAY") || action.includes("ADD");
                    const isPicking = action.includes("OUTBOUND") || action.includes("PICKING") || action.includes("REMOVE");
                    
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-5 font-black text-slate-900 truncate max-w-[120px] border-l-4 border-l-transparent hover:border-l-blue-500" title={log.employees?.full_name}>
                          {log.employees?.full_name?.split(' ')[0] || "Sistem"}
                        </td>
                        <td className="py-4 px-5 text-slate-600 font-medium truncate max-w-[200px]" title={log.description}>
                          {log.description?.replace(/\[.*?\]\s*/g, "") || "-"}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className={`px-2.5 py-1.5 border-2 rounded-none text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${isPutaway ? 'bg-emerald-50 text-emerald-700 border-emerald-400' : isPicking ? 'bg-red-50 text-[#dc3545] border-red-400' : 'bg-slate-50 text-slate-700 border-slate-300'}`}>
                            {isPutaway ? 'RAFLAMA (+)' : isPicking ? 'ÇIKIŞ (-)' : 'DİĞER'}
                          </span>
                        </td>
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

          {/* LOG 3: Transfer İşlemleri (MOR VURGU) */}
          <div className="bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#cbd5e1] rounded-none flex flex-col w-full h-[450px]">
            <div className="flex justify-between items-center p-4 lg:p-5 border-b-4 border-purple-500 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><Package className="w-5 h-5 text-purple-400" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Transfer İşlemleri</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Şubeler Arası Sevk</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-600 font-black">
                    <th className="py-3 px-5 border-r-2 border-white">Evrak Kodu</th>
                    <th className="py-3 px-5 border-r-2 border-white">Oluşturulma</th>
                    <th className="py-3 px-5 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-100">
                  {data?.recentTransfers?.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-5 font-black text-slate-900 border-l-4 border-l-transparent hover:border-l-purple-500">{tx.transfer_code}</td>
                      <td className="py-4 px-5 text-slate-600 font-mono font-black">{new Date(tx.created_at).toLocaleDateString("tr-TR")}</td>
                      <td className="py-4 px-5 text-right">
                        <span className={`px-2.5 py-1.5 border-2 rounded-none text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${getStatusStyle(tx.status)}`}>
                          {getStatusText(tx.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentTransfers || data.recentTransfers.length === 0) && (
                    <tr><td colSpan={3} className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* LOG 4: İzin Hareketleri (TURUNCU VURGU) */}
          <div className="bg-white border-2 border-slate-300 shadow-[8px_8px_0px_#cbd5e1] rounded-none flex flex-col w-full h-[450px]">
            <div className="flex justify-between items-center p-4 lg:p-5 border-b-4 border-orange-500 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 border border-white/20"><CalendarDays className="w-5 h-5 text-orange-400" /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">İzin Hareketleri</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Personel Devamsızlık</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-600 font-black">
                    <th className="py-3 px-5 border-r-2 border-white">Personel</th>
                    <th className="py-3 px-5 border-r-2 border-white">Tarih Aralığı</th>
                    <th className="py-3 px-5 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-slate-700 divide-y-2 divide-slate-100">
                  {data?.recentLeaveLogs?.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-5 border-l-4 border-l-transparent hover:border-l-orange-500">
                        <span className="font-black text-slate-900 block truncate max-w-[150px]" title={log.employees?.full_name}>
                          {log.employees?.full_name?.split(' ')[0] || "-"}
                        </span>
                        <span className="inline-block bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] text-slate-500 font-black uppercase mt-1">{log.leave_type}</span>
                      </td>
                      <td className="py-3 px-5 text-slate-600 font-mono font-black text-[11px] whitespace-nowrap">
                        {formatDateRange(log.start_date, log.end_date)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <span className={`px-2.5 py-1.5 border-2 rounded-none text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${getStatusStyle(log.status)}`}>
                          {getStatusText(log.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentLeaveLogs || data.recentLeaveLogs.length === 0) && (
                    <tr><td colSpan={3} className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                  )}
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