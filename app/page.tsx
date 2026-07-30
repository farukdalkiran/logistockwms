"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDashboardDataServer } from "@/app/actions/dashboard";
import {
  Building2, Users, AlertCircle, TerminalSquare, Package, 
  Layers, BarChart3, Activity, Zap, Server, Database, 
  CalendarDays, BoxSelect, PieChart
} from "lucide-react";

interface DashboardData {
  kpis: { branches: number; employees: number; stockVolume: number; pendingTotal: number; };
  weeklyActivity: { day: string; value: number }[];
  distribution: { putaway: number; picking: number; other: number; };
  recentTransfers: any[];
  recentPutawayLogs: any[];
  recentLeaveLogs: any[];
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
    if (result.success && result.data) setData(result.data);
    setLoading(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case "TAMAMLANDI": 
      case "APPROVED": return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "YOLDA": return "bg-purple-50 text-purple-600 border-purple-200";
      case "BEKLIYOR": 
      case "PENDING": return "bg-red-50 text-[#dc3545] border-red-200";
      case "REJECTED": return "bg-slate-100 text-slate-500 border-slate-300";
      default: return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getStatusText = (status: string) => {
    if(status === 'APPROVED') return 'ONAYLANDI';
    if(status === 'PENDING') return 'BEKLİYOR';
    if(status === 'REJECTED') return 'REDDEDİLDİ';
    return status;
  };

  const formatDateRange = (start: string, end: string) => {
    if (!start || !end) return "-";
    const d1 = new Date(start).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    const d2 = new Date(end).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    return d1 === d2 ? d1 : `${d1} - ${d2}`;
  };

  // MİNİMAL YÜKLEME (Ekranı kilitlemez, içerikte spinner döner)
  if (isAuthLoading || (loading && !data)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] overflow-x-hidden">
        <Navbar />
        <main className="flex-1 w-full max-w-[1400px] mx-auto flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#dc3545] rounded-full animate-spin shadow-sm"></div>
          <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Sistem Verileri Çekiliyor...</p>
        </main>
        <Footer />
      </div>
    );
  }

  const isGlobal = userProfile?.role === "Developer" || userProfile?.role === "Admin" || userProfile?.isGlobalAdmin;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] text-slate-800 selection:bg-purple-500 selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden">
        
        {/* ========================================================= */}
        {/* 1. DARK-INDUSTRIAL WMS HERO HEADER (Sadece bu kısım koyu) */}
        {/* ========================================================= */}
        <div className="w-full bg-[#0b101e] border-l-4 border-[#dc3545] rounded-sm shadow-md relative overflow-hidden flex flex-col lg:flex-row items-center justify-between p-6 lg:p-8 gap-6">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-purple-600/10 via-[#dc3545]/10 to-transparent rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col gap-1 w-full lg:w-auto text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
                {isGlobal ? "GLOBAL YÖNETİM ERİŞİMİ" : "ŞUBE BAĞLANTISI AKTİF"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase leading-none drop-shadow-md flex items-center justify-center lg:justify-start gap-3">
              <span>LOGISTOCK <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#dc3545]">WMS</span></span>
            </h1>
            <p className="text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Sistem Operasyon Özeti ve Canlı Veri Akışı</p>
          </div>

          <div className="relative z-10 flex flex-wrap justify-center lg:justify-end gap-3 w-full lg:w-auto">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-4 rounded-sm flex flex-col min-w-[140px] shrink-0">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black uppercase text-purple-400 tracking-widest">İşlem Hacmi</span>
                <Activity className="w-4 h-4 text-[#dc3545]" />
              </div>
              <span className="text-2xl font-black text-white font-mono leading-none">{data?.weeklyActivity.reduce((a, b) => a + b.value, 0)}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Son 7 Gün (Terminal)</span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. KPI KARTLARI (Aydınlık Tema) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {[
            { title: "Bağlı Lokasyonlar", value: data?.kpis.branches, icon: Building2, color: "text-purple-600", bg: "bg-purple-50", border: "border-slate-200" },
            { title: "Aktif Personel", value: data?.kpis.employees, icon: Users, color: "text-blue-600", bg: "bg-blue-50", border: "border-slate-200" },
            { title: "Toplam Stok (Adet)", value: data?.kpis.stockVolume.toLocaleString('tr-TR'), icon: Layers, color: "text-[#dc3545]", bg: "bg-red-50", border: "border-slate-200" },
            { title: "Bekleyen Onaylar (İK)", value: data?.kpis.pendingTotal, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50", border: data?.kpis.pendingTotal ? "border-orange-300 shadow-orange-100" : "border-slate-200" }
          ].map((kpi, idx) => (
            <div key={idx} className={`bg-white p-5 border shadow-sm flex items-center justify-between gap-4 rounded-sm ${kpi.border} transition-colors group hover:shadow-md`}>
              <div className="flex flex-col min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{kpi.title}</p>
                <p className={`text-3xl font-black leading-none truncate ${kpi.title.includes('Bekleyen') && data?.kpis.pendingTotal ? 'text-orange-600' : 'text-slate-900'}`}>{kpi.value}</p>
              </div>
              <div className={`w-12 h-12 ${kpi.bg} border border-slate-100 flex items-center justify-center shrink-0 rounded-sm transition-colors`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* ========================================================= */}
        {/* 3. İSTATİSTİK GRAFİKLERİ (3'LÜ MATRİS) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
          
          {/* GRAFİK 1: Haftalık Terminal Trafiği (Dikey Bar Chart) */}
          <div className="bg-white p-6 md:p-8 border border-slate-200 shadow-sm rounded-sm flex flex-col relative w-full h-[320px]">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-purple-50 rounded-sm border border-purple-100"><BarChart3 className="w-4 h-4 text-purple-600" /></div>
                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Terminal Trafiği</h3>
              </div>
            </div>

            <div className="flex-1 flex items-end justify-between gap-3 border-b border-slate-200 relative pt-6">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
              </div>

              {data?.weeklyActivity.map((day, idx) => {
                const maxVal = Math.max(...(data?.weeklyActivity.map((d) => d.value) || []), 10);
                const heightPercent = Math.max((day.value / maxVal) * 100, 5);
                return (
                  <div key={idx} className="flex flex-col items-center gap-2 w-full group relative z-10 h-full justify-end">
                    <div className="w-full max-w-[32px] bg-slate-50 rounded-t-sm relative flex items-end h-full border-x border-t border-slate-100 transition-all hover:bg-slate-100">
                      <div className={`w-full rounded-t-sm transition-all duration-700 ${idx % 2 === 0 ? "bg-purple-500" : "bg-[#dc3545]"}`} style={{ height: `${heightPercent}%` }}></div>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none shadow-md">{day.value}</div>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{day.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRAFİK 2: Operasyon Dağılımı (Pasta / Donut) */}
          <div className="bg-white p-6 md:p-8 border border-slate-200 shadow-sm rounded-sm flex flex-col items-center justify-between w-full h-[320px]">
            <div className="w-full flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5">
                <PieChart className="w-4 h-4 text-[#dc3545]" />
                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">İşlem Dağılımı</h3>
              </div>
            </div>
            
            <div className="flex-1 flex w-full items-center justify-center relative">
              <div 
                className="w-36 h-36 rounded-full flex items-center justify-center shadow-sm relative transition-all duration-1000 border-4 border-slate-50" 
                style={{ 
                  background: `conic-gradient(
                    #10b981 0% ${data?.distribution.putaway || 0}%, 
                    #dc3545 ${data?.distribution.putaway || 0}% ${(data?.distribution.putaway || 0) + (data?.distribution.picking || 0)}%, 
                    #9333ea ${(data?.distribution.putaway || 0) + (data?.distribution.picking || 0)}% 100%
                  )` 
                }}
              >
                <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <Activity size={20} className="text-slate-300" />
                </div>
              </div>
            </div>

            <div className="w-full flex justify-center gap-4 mt-2">
              <div className="flex flex-col items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mb-1"></span><span className="text-[9px] font-black uppercase text-slate-500">Giriş (%{data?.distribution.putaway})</span></div>
              <div className="flex flex-col items-center"><span className="w-3 h-3 rounded-full bg-[#dc3545] mb-1"></span><span className="text-[9px] font-black uppercase text-slate-500">Çıkış (%{data?.distribution.picking})</span></div>
              <div className="flex flex-col items-center"><span className="w-3 h-3 rounded-full bg-purple-600 mb-1"></span><span className="text-[9px] font-black uppercase text-slate-500">Diğer (%{data?.distribution.other})</span></div>
            </div>
          </div>

          {/* GRAFİK 3: Sistem Yükü ve Sağlık */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-sm flex flex-col w-full h-[320px] overflow-hidden">
             <div className="p-6 md:p-8 flex flex-col items-center justify-between h-full">
                <div className="w-full flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Sistem Yükü</h3>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center w-full">
                  <div 
                    className="w-36 h-36 rounded-full flex items-center justify-center shadow-sm relative transition-all duration-1000 border-4 border-slate-50" 
                    style={{ background: `conic-gradient(#dc3545 0% ${data?.systemLoad || 0}%, #f1f5f9 ${data?.systemLoad || 0}% 100%)` }}
                  >
                    <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                      <span className="text-2xl font-black text-slate-900 tracking-tighter font-mono">%{data?.systemLoad || 0}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kapasite</span>
                    </div>
                  </div>
                </div>

                <div className="w-full text-center mt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-sm border border-slate-100">
                    Veritabanı Sağlığı Optimal
                  </span>
                </div>
             </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* 4. LOG MATRİSİ (3 KOLONLU, RENKLENDİRİLMİŞ AYDINLIK TABLOLAR) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start pb-10">
          
          {/* KOLON 1: TRANSFER LOGLARI */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-sm flex flex-col min-w-0 w-full h-[400px]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-600" />
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Transfer İşlemleri</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white border-b border-slate-100 sticky top-0">
                  <tr className="text-[9px] uppercase tracking-widest text-slate-400">
                    <th className="py-3 px-4 font-black">Evrak Kodu</th>
                    <th className="py-3 px-4 font-black">Tarih</th>
                    <th className="py-3 px-4 font-black text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-bold text-slate-600 divide-y divide-slate-50">
                  {data?.recentTransfers.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{tx.transfer_code}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{new Date(tx.created_at).toLocaleDateString("tr-TR")}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest ${getStatusStyle(tx.status)}`}>{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentTransfers || data.recentTransfers.length === 0) && <tr><td colSpan={3} className="py-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Kayıt Yok</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* KOLON 2: DEPO VE RAFLAMA LOGLARI (RENKLİ VURGULAR) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-sm flex flex-col min-w-0 w-full h-[400px]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <BoxSelect className="w-4 h-4 text-[#dc3545]" />
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Depo Operasyonları</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white border-b border-slate-100 sticky top-0">
                  <tr className="text-[9px] uppercase tracking-widest text-slate-400">
                    <th className="py-3 px-4 font-black">Personel</th>
                    <th className="py-3 px-4 font-black">İşlem Detayı</th>
                    <th className="py-3 px-4 font-black text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-bold text-slate-600 divide-y divide-slate-50">
                  {data?.recentPutawayLogs.map((log) => {
                    const action = log.action_type.toUpperCase();
                    const isPutaway = action.includes("INBOUND") || action.includes("PUTAWAY") || action.includes("ADD");
                    const isPicking = action.includes("OUTBOUND") || action.includes("PICKING") || action.includes("REMOVE");
                    
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-black text-slate-800 truncate max-w-[80px]" title={log.employees?.full_name}>{log.employees?.full_name?.split(' ')[0] || "Sistem"}</td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-[120px]" title={log.description}>{log.description?.replace(/\[.*?\]\s*/g, "") || "-"}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest ${isPutaway ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : isPicking ? 'bg-red-50 text-[#dc3545] border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {isPutaway ? 'RAFLAMA (+)' : isPicking ? 'RAFTAN KALDIRMA (-)' : 'DİĞER'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {(!data?.recentPutawayLogs || data.recentPutawayLogs.length === 0) && <tr><td colSpan={3} className="py-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Kayıt Yok</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* KOLON 3: İZİN HAREKETLERİ (TARİH ARALIĞI EKLENDİ) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-sm flex flex-col min-w-0 w-full h-[400px]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">İzin Talepleri</h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white border-b border-slate-100 sticky top-0">
                  <tr className="text-[9px] uppercase tracking-widest text-slate-400">
                    <th className="py-3 px-4 font-black">Personel</th>
                    <th className="py-3 px-4 font-black">Tarih Aralığı</th>
                    <th className="py-3 px-4 font-black text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-bold text-slate-600 divide-y divide-slate-50">
                  {data?.recentLeaveLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-800 truncate max-w-[90px]" title={log.employees?.full_name}>
                        {log.employees?.full_name?.split(' ')[0] || "-"}
                        <span className="block text-[9px] text-slate-400 font-bold truncate mt-0.5">{log.leave_type}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono font-black text-[10px] whitespace-nowrap">
                        {formatDateRange(log.start_date, log.end_date)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest ${getStatusStyle(log.status)}`}>
                          {getStatusText(log.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentLeaveLogs || data.recentLeaveLogs.length === 0) && <tr><td colSpan={3} className="py-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Kayıt Yok</td></tr>}
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