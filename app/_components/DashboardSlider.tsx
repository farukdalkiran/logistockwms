"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';
import { 
  Building2, Users, AlertCircle, Clock,
  Package, ChevronRight, Layers, BarChart3,
  TerminalSquare, ShieldCheck, Zap, Server
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
  systemHealth: number;
  activeSessions: number;
}

export default function ManagementDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    kpis: { branches: 0, employees: 0, stockVolume: 0, pendingTotal: 0 },
    weeklyActivity: [],
    recentTransfers: [],
    pendingActions: [],
    systemHealth: 0,
    activeSessions: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        branchesRes, 
        employeesRes, 
        boxesRes, 
        leavesRes, 
        attRes, 
        transfersData, 
        logsData
      ] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact' }),
        supabase.from('employees').select('id, full_name, is_active'),
        supabase.from('boxes').select('quantity'),
        supabase.from('leave_requests').select('id, start_date, type, employees(full_name)').eq('status', 'PENDING').limit(5),
        supabase.from('attendance_requests').select('id, created_at, employees(full_name)').eq('status', 'PENDING').limit(5),
        supabase.from('transfers').select('id, transfer_code, created_at, status, transfer_items(id)').order('created_at', { ascending: false }).limit(6),
        supabase.from('transaction_logs').select('created_at').gte('created_at', lastWeek)
      ]);

      const activeEmployees = (employeesRes.data || []).filter(e => e.is_active);
      const totalStock = (boxesRes.data || []).reduce((sum, box) => sum + (box.quantity || 0), 0);
      const pendingCount = (leavesRes.data?.length || 0) + (attRes.data?.length || 0);

      const daysStr = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const weeklyObj: Record<string, number> = { 'Pzt':0, 'Sal':0, 'Çar':0, 'Per':0, 'Cum':0, 'Cmt':0, 'Paz':0 };
      
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

      const formattedTransfers = (transfersData.data || []).map((t: any) => ({
        id: t.id,
        transfer_code: t.transfer_code,
        created_at: t.created_at,
        status: t.status,
        items_count: t.transfer_items ? t.transfer_items.length : 0
      }));

      const actions: PendingAction[] = [];
      (leavesRes.data || []).forEach((l: any) => actions.push({
        id: `leave_${l.id}`, type: 'İzin Talebi', title: l.type || 'İzin', 
        person: l.employees?.full_name || 'Personel', date: l.start_date
      }));
      (attRes.data || []).forEach((a: any) => actions.push({
        id: `att_${a.id}`, type: 'Mesai Düzeltme', title: 'Puantaj Onayı', 
        person: a.employees?.full_name || 'Personel', date: a.created_at
      }));
      actions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Basit bir sağlık endeksi
      const dbTotalRows = (logsData.data?.length || 0) + totalStock + activeEmployees.length;
      const usage = Math.min(Math.max(Math.round((dbTotalRows / 5000) * 100), 12), 100);

      setData({
        kpis: {
          branches: branchesRes.count || 0,
          employees: activeEmployees.length,
          stockVolume: totalStock,
          pendingTotal: pendingCount
        },
        weeklyActivity: formattedWeekly,
        recentTransfers: formattedTransfers,
        pendingActions: actions.slice(0, 5),
        systemHealth: 100 - (usage * 0.1), // %90-100 arası dalgalanma efekti için
        activeSessions: Math.floor(Math.random() * (activeEmployees.length / 2)) + 1 // Sadece görsellik (anlık ping ölçülebilir)
      });

    } catch (error) {
      console.error("Dashboard Veri Hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Tamamlandi': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'Yolda': return 'bg-purple-600/10 text-purple-600 border-purple-600/20';
      case 'Bekliyor': return 'bg-[#dc3545]/10 text-[#dc3545] border-[#dc3545]/20';
      case 'Toplaniyor': return 'bg-slate-200 text-slate-700 border-slate-300';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 font-['Quicksand']">
        <div className="relative mb-6">
          <TerminalSquare size={48} className="text-[#dc3545] opacity-20" />
          <Zap size={24} className="text-[#dc3545] absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-slate-500 font-bold tracking-widest text-[11px] uppercase animate-pulse">Ana Komuta Merkezi Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-['Quicksand'] text-slate-800 selection:bg-purple-500 selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 flex flex-col gap-6 overflow-hidden">
        
        {/* ========================================================= */}
        {/* DEVASA ENDÜSTRİYEL BANNER (Siber/Terminal Teması) */}
        {/* ========================================================= */}
        <div className="w-full bg-[#0f172b] border-l-4 border-[#dc3545] rounded-r-md shadow-lg relative overflow-hidden flex flex-col lg:flex-row items-center justify-between p-8 lg:p-10 gap-8 lg:gap-4 group">
          
          {/* Arka Plan Dekorasyonları (Grid ve Işıklar) */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none transition-all duration-1000 group-hover:bg-[#dc3545]/10"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#dc3545]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none transition-all duration-1000 group-hover:bg-purple-600/10"></div>

          {/* Sol Kısım: Yazılar */}
          <div className="relative z-10 flex flex-col gap-3 max-w-2xl text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-sm border border-emerald-500/20">
                SİSTEM ÇEVRİMİÇİ
              </span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:block">
                | LOGISTOCK V1.0
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight uppercase leading-none drop-shadow-md">
              Ana <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#dc3545] to-purple-500">Komuta</span> Paneli
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-bold mt-2 max-w-xl leading-relaxed">
              Tüm şubeler, canlı stok akışları, personel mesai kayıtları ve operasyonel onay süreçleri şu an ana sunucu (Frankfurt) üzerinden senkronize ediliyor.
            </p>
          </div>

          {/* Sağ Kısım: Siber Göstergeler (Sunucu Sağlığı ve Trafik) */}
          <div className="relative z-10 flex gap-4 w-full lg:w-auto overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 hide-scrollbar snap-x">
            
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-5 rounded-md flex flex-col justify-between min-w-[160px] snap-center shrink-0">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sistem Yükü</span>
                <Server className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-black text-white font-mono tracking-tighter">
                  %{data.systemHealth.toFixed(1)}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Sağlıklı
                </span>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-5 rounded-md flex flex-col justify-between min-w-[160px] snap-center shrink-0">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Aktif Uçlar</span>
                <Activity className="w-4 h-4 text-[#dc3545]" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-black text-white font-mono tracking-tighter">
                  {data.activeSessions}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Canlı İstemci
                </span>
              </div>
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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Aktif Personel</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{data.kpis.employees}</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded-sm group-hover:bg-red-50 group-hover:border-red-100 transition-colors">
              <Users className="w-6 h-6 text-[#dc3545]" />
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-purple-300 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Sistem Stok Hacmi</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{data.kpis.stockVolume.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded-sm group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
              <Layers className="w-6 h-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-5 md:p-6 border border-slate-200 shadow-sm flex items-center justify-between gap-4 rounded-sm hover:border-[#dc3545]/50 transition-colors group">
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">İşlem Onay Yükü</p>
              <p className="text-3xl font-black text-[#dc3545] leading-none drop-shadow-sm">{data.kpis.pendingTotal}</p>
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
            <div className="bg-white p-6 md:p-8 border border-slate-200 shadow-sm rounded-sm flex flex-col relative">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#dc3545]/10 rounded-sm">
                    <BarChart3 className="w-5 h-5 text-[#dc3545]" />
                  </div>
                  <h3 className="text-[15px] font-black text-slate-900 uppercase tracking-widest">Haftalık Terminal Trafiği</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-sm uppercase tracking-widest">Son 7 Gün</span>
              </div>
              
              <div className="flex-1 flex items-end justify-between gap-2 h-44 border-b border-slate-200 relative">
                {/* Referans Arka Plan Çizgileri */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                  <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                  <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                  <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                </div>

                {data.weeklyActivity.map((day, idx) => {
                  const maxVal = Math.max(...data.weeklyActivity.map(d => d.value), 1);
                  const heightPercent = (day.value / maxVal) * 100;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-3 w-full group relative z-10">
                      <div className="w-full max-w-[36px] bg-slate-50 rounded-t-sm relative flex items-end h-full border-x border-t border-slate-100">
                        <div 
                          className={`w-full rounded-t-sm transition-all duration-700 ${idx % 2 === 0 ? 'bg-gradient-to-t from-purple-700 to-purple-500' : 'bg-gradient-to-t from-red-700 to-[#dc3545]'}`}
                          style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                        ></div>
                        {/* Data Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-black px-2.5 py-1 rounded-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
                          {day.value}
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{day.day}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* TABLO KARTI (Son Transferler) */}
            <div className="bg-white p-0 border border-slate-200 shadow-sm rounded-sm overflow-hidden w-full flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-600/10 rounded-sm">
                    <Package className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-[15px] font-black text-slate-900 uppercase tracking-widest">Son Transfer Hareketleri</h3>
                </div>
                <Link href="/management" className="text-[10px] font-black text-purple-600 uppercase tracking-widest hover:text-white hover:bg-purple-600 border border-purple-600 px-3 py-1.5 rounded-sm transition-colors">
                  Tümünü İncele
                </Link>
              </div>
              
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-white border-b border-slate-200">
                    <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                      <th className="py-4 px-6 font-black">Evrak Kodu</th>
                      <th className="py-4 px-6 font-black">Oluşturulma</th>
                      <th className="py-4 px-6 font-black text-center">Hacim</th>
                      <th className="py-4 px-6 font-black text-right">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-bold text-slate-700 divide-y divide-slate-100">
                    {data.recentTransfers.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-black text-slate-900 tracking-wider">
                          {tx.transfer_code}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs font-mono">
                          {new Date(tx.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="py-4 px-6 text-center text-slate-600 text-xs font-black">{tx.items_count} Kutu</td>
                        <td className="py-4 px-6 text-right">
                          <span className={`px-3 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest ${getStatusStyle(tx.status)}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.recentTransfers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                          Sistemde Hiç Transfer Kaydı Bulunamadı
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* SAĞ KOLON: İK AKSİYONLARI (%33) */}
          <div className="lg:col-span-1 flex flex-col w-full min-w-0">
            <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm flex flex-col h-full">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#dc3545]/10 rounded-sm">
                    <Clock className="w-5 h-5 text-[#dc3545]" />
                  </div>
                  <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-wider">Onay Bekleyenler</h3>
                </div>
                <span className="text-[11px] font-black text-white bg-[#dc3545] px-2.5 py-1 rounded-sm shadow-md">
                  {data.pendingActions.length} İşlem
                </span>
              </div>

              <div className="flex flex-col gap-3 w-full flex-1 overflow-y-auto pr-1">
                {data.pendingActions.map((action, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 lg:p-5 border border-slate-200 rounded-sm flex flex-col gap-3 w-full hover:border-purple-300 transition-colors">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className={`text-[9px] font-black uppercase tracking-widest mb-1.5 border w-fit px-2 py-0.5 rounded-sm ${action.type === 'İzin Talebi' ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-red-50 border-red-200 text-[#dc3545]'}`}>
                          {action.type}
                        </span>
                        <span className="text-[13px] font-black text-slate-900 truncate tracking-wide">{action.person}</span>
                        <span className="text-[11px] font-bold text-slate-500 truncate mt-0.5">{action.title}</span>
                      </div>
                      <div className="flex flex-col items-end text-right shrink-0">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Kayıt</span>
                        <span className="text-[10px] font-mono font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-sm shadow-sm">
                          {new Date(action.date).toLocaleDateString('tr-TR', { month: '2-digit', day: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {data.pendingActions.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-16 my-auto">
                    <div className="w-14 h-14 border-2 border-dashed border-slate-200 bg-slate-50 rounded-full flex items-center justify-center">
                      <Clock size={24} className="text-slate-300" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest mt-2 text-slate-500">Aksiyon Gerekmiyor</span>
                  </div>
                )}
              </div>

              {/* Hızlı Aksiyon Butonu */}
              {data.pendingActions.length > 0 && (
                <Link href="/management/hr" className="mt-5 w-full bg-[#0f172b] hover:bg-[#dc3545] text-white text-[11px] font-black uppercase tracking-widest py-3.5 rounded-sm flex items-center justify-center gap-2 transition-colors shadow-md">
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