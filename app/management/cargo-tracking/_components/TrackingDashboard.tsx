"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getKargoStats } from "@/app/actions/aras-integration"; 
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar 
} from 'recharts';
import { Package, Truck, AlertTriangle, Undo2, Activity, Layers, CheckCircle2 } from 'lucide-react';

interface DashboardProps {
  onNavigate?: (tab: "PROCESS" | "SEARCH" | "UPLOAD") => void;
}

interface DashboardStats {
  totalRecords: number;
  totalItems: number;
  success: number;
  returned: number;
  error: number;
  todayProcessed: number;
}

// Chart verisi için Type
interface ChartDataPoint {
  date: string;
  basarili: number;
  iade: number;
  hatali: number;
}

export default function TrackingDashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalRecords: 0,
    totalItems: 0,
    success: 0,
    returned: 0,
    error: 0,
    todayProcessed: 0
  });
  
  const [weeklyData, setWeeklyData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // LÜKS VE CANLI RENK PALETİ
  const COLORS = {
    success: '#03DF95',  // Emerald / Turkuaz
    returned: '#d946ef', // Fuchsia / Pembe-Mor
    error: '#f97316',    // Orange / Turuncu
    today: '#3b82f6',    // Blue
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const serverStats = await getKargoStats();
        const todayCount = serverStats.success ? serverStats.today : 0;

        const { data: cargoData, error: cargoError } = await supabase
          .from("cargo_records")
          .select("created_at, aras_tracking_number, is_returned, item_count")
          .limit(10000)
          .order("created_at", { ascending: false });

        if (cargoError) throw cargoError;

        let s = { totalRecords: 0, totalItems: 0, success: 0, returned: 0, error: 0, todayProcessed: todayCount };
        const dateMap = new Map<string, ChartDataPoint>();

        if (cargoData) {
          cargoData.forEach(row => {
            s.totalRecords++;
            s.totalItems += (row.item_count || 1);

            const tracking = row.aras_tracking_number || "";
            const isError = /[a-zA-Z]/.test(tracking);
            const isReturned = row.is_returned;

            // Type-Safe Statü Ataması
            let status: 'basarili' | 'iade' | 'hatali' = 'basarili';
            if (isReturned) {
              s.returned++;
              status = 'iade';
            } else if (isError) {
              s.error++;
              status = 'hatali';
            } else {
              s.success++;
            }

            const recordDate = new Date(row.created_at);
            const dateStr = recordDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
            
            if (!dateMap.has(dateStr)) {
              dateMap.set(dateStr, { date: dateStr, basarili: 0, iade: 0, hatali: 0 });
            }
            
            const dayData = dateMap.get(dateStr)!;
            dayData[status]++;
          });
        }

        const chartData = Array.from(dateMap.values())
          .reverse()
          .slice(-7);

        if (isMounted) {
          setWeeklyData(chartData);
          setStats(s);
        }
      } catch (err: any) {
        console.error("Dashboard Veri Hatası:", err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => { isMounted = false; };
  }, []);

  const pieData = [
    { name: 'Başarılı Kargo', value: stats.success, color: COLORS.success },
    { name: 'İade Kaydı', value: stats.returned, color: COLORS.returned },
    { name: 'Eksik Adres', value: stats.error, color: COLORS.error },
  ];

  if (loading) {
    return (
      <div className="w-full h-[500px] flex flex-col items-center justify-center gap-6 bg-white rounded-md border-[3px] border-slate-200 shadow-sm relative overflow-hidden">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-[#03DF95] rounded-full animate-spin"></div>
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Sistem Verileri Okunuyor...</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in zoom-in-[0.98] duration-300 font-['Quicksand'] bg-slate-50 p-2 sm:p-4 min-h-screen">
      
      {/* ÖZEL CSS: DÖNEN BORDER (LOOP) ANİMASYONU */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes border-spin {
          100% { transform: rotate(360deg); }
        }
        .loop-border {
          position: relative;
          background: #fff;
          border-radius: 0.375rem;
          z-index: 1;
          overflow: hidden;
        }
        .loop-border::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(transparent, transparent, transparent, var(--loop-color, #03DF95));
          animation: border-spin 3s linear infinite;
          z-index: -2;
        }
        .loop-border::after {
          content: '';
          position: absolute;
          inset: 3px;
          background: #fff;
          border-radius: 0.25rem;
          z-index: -1;
        }
      `}} />

      <div className="flex flex-col mb-2">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Performans Analizi</h2>
        <p className="text-xs font-bold text-slate-500 uppercase">WMS Kargo İstatistik Merkezi</p>
      </div>

      {/* 1. SATIR: DİJİTAL KPI KARTLARI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* BUGÜN İŞLENEN */}
        <div className="loop-border shadow-sm flex flex-col justify-center p-5 sm:p-6" style={{ '--loop-color': COLORS.today } as React.CSSProperties}>
          <div className="absolute top-4 right-4 p-2 bg-blue-50 border border-blue-100 rounded-md text-blue-500">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 mt-1">Bugün İşlenen</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-blue-500 font-mono leading-none">{stats.todayProcessed.toLocaleString('tr-TR')}</span>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">PAKET</span>
          </div>
        </div>

        {/* BAŞARILI KARGO */}
        <div className="loop-border shadow-sm flex flex-col justify-center p-5 sm:p-6" style={{ '--loop-color': COLORS.success } as React.CSSProperties}>
          <div className="absolute top-4 right-4 p-2 bg-emerald-50 border border-emerald-100 rounded-md text-[#03DF95]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 mt-1">Başarılı Kargo</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-[#03DF95] font-mono leading-none">{stats.success.toLocaleString('tr-TR')}</span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">KAYIT</span>
          </div>
        </div>

        {/* İADELER */}
        <div className="loop-border shadow-sm flex flex-col justify-center p-5 sm:p-6" style={{ '--loop-color': COLORS.returned } as React.CSSProperties}>
          <div className="absolute top-4 right-4 p-2 bg-fuchsia-50 border border-fuchsia-100 rounded-md text-[#d946ef]">
            <Undo2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 mt-1">İade Kayıtları</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-[#d946ef] font-mono leading-none">{stats.returned.toLocaleString('tr-TR')}</span>
            <span className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wider">PAKET</span>
          </div>
        </div>

        {/* HATALI/EKSİK ADRES */}
        <div className="loop-border shadow-sm flex flex-col justify-center p-5 sm:p-6" style={{ '--loop-color': COLORS.error } as React.CSSProperties}>
          <div className="absolute top-4 right-4 p-2 bg-orange-50 border border-orange-100 rounded-md text-orange-500">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 mt-1">Eksik / Hatalı Adres</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-orange-500 font-mono leading-none">{stats.error.toLocaleString('tr-TR')}</span>
            <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">KAYIT</span>
          </div>
        </div>

      </div>

      {/* 2. SATIR: VERİ GÖRSELLEŞTİRME GRAFİKLERİ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* ANA GRAFİK: ZAMAN ÇİZELGESİ (AREA CHART) */}
        <div className="xl:col-span-2 bg-white border-[3px] border-slate-200 rounded-md shadow-sm flex flex-col p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-col">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Haftalık Trend Analizi</h3>
              <span className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">Son 7 Günlük Kargo İşlem Dağılımı</span>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#03DF95] shadow-sm"></span> BAŞARILI</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#d946ef] shadow-sm"></span> İADE</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#f97316] shadow-sm"></span> HATALI</div>
            </div>
          </div>
          
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBasarili" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorIade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.returned} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.returned} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 900 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 900 }} />
                
                {/* DÜZELTİLEN TOOLTIP */}
                <Tooltip 
                  formatter={(value: any, name: any) => {
                    const label = name === 'basarili' ? 'Başarılı' : name === 'iade' ? 'İade' : 'Hatalı';
                    return [`${value} Kayıt`, label];
                  }}
                  contentStyle={{ borderRadius: '6px', border: '3px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'black', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}
                />
                
                <Area type="monotone" dataKey="basarili" stroke={COLORS.success} strokeWidth={3} fillOpacity={1} fill="url(#colorBasarili)" activeDot={{ r: 5, fill: '#fff', stroke: COLORS.success, strokeWidth: 3 }} />
                <Area type="monotone" dataKey="iade" stroke={COLORS.returned} strokeWidth={3} fillOpacity={1} fill="url(#colorIade)" />
                <Area type="monotone" dataKey="hatali" stroke={COLORS.error} strokeWidth={3} fill="none" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SAĞ PANEL: DURUM DAĞILIMI (DONUT CHART) */}
        <div className="bg-white border-[3px] border-slate-200 rounded-md shadow-sm flex flex-col p-5 sm:p-6 relative overflow-hidden">
          
          <div className="flex flex-col mb-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Oransal Dağılım</h3>
            <span className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">Tüm Veritabanı Özeti</span>
          </div>

          <div className="w-full h-56 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  animationDuration={1500}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                
                {/* DÜZELTİLEN TOOLTIP */}
                <Tooltip 
                  formatter={(value: any) => [`${value} Kayıt`, '']}
                  contentStyle={{ borderRadius: '6px', border: '3px solid #e2e8f0', background: '#fff', color: '#0f172a' }}
                  itemStyle={{ color: '#0f172a', fontWeight: '900', textTransform: 'uppercase' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-800 font-mono">
                {stats.totalRecords > 0 ? Math.round((stats.success / stats.totalRecords) * 100) : 0}%
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-[#03DF95] mt-1">BAŞARILI ORAN</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mt-4 z-10">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest bg-slate-50 px-3 py-2.5 rounded-sm border-2 border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ backgroundColor: item.color }}></span>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="text-slate-900 font-mono text-sm">{item.value.toLocaleString('tr-TR')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. SATIR: İKİNCİL GRAFİK VE DETAYLAR (BAR CHART) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* BAR CHART */}
        <div className="bg-white border-[3px] border-slate-200 rounded-md shadow-sm p-5 sm:p-6">
          <div className="flex flex-col mb-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Sorunlu Kayıt Analizi</h3>
            <span className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">İade ve Hatalı Barkod Karşılaştırması</span>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 900 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 900 }} />
                
                {/* DÜZELTİLEN TOOLTIP */}
                <Tooltip 
                  formatter={(value: any, name: any) => {
                    const label = name === 'iade' ? 'İade' : 'Hatalı Adres';
                    return [`${value} Kayıt`, label];
                  }}
                  contentStyle={{ borderRadius: '6px', border: '3px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 'black', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}
                  cursor={{fill: '#f8fafc'}}
                />
                <Bar dataKey="iade" fill={COLORS.returned} radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="hatali" fill={COLORS.error} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GENEL DURUM ÖZETİ KARTI */}
        <div className="bg-white border-[3px] border-slate-200 rounded-md shadow-sm p-5 sm:p-6 flex flex-col justify-between">
           <div className="flex flex-col mb-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Veritabanı Genel Özeti</h3>
            <span className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">Sistemin Orijinal Kayıt Hacmi</span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-slate-50 border-l-[4px] border-slate-800 p-4 rounded-sm border-y-[3px] border-r-[3px] border-y-slate-200 border-r-slate-200">
               <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Toplam İşlenen Kayıt (Satır)</span>
               <span className="text-2xl font-black text-slate-800 font-mono">{stats.totalRecords.toLocaleString('tr-TR')}</span>
            </div>
            
            <div className="bg-emerald-50 border-l-[4px] border-[#03DF95] p-4 rounded-sm border-y-[3px] border-r-[3px] border-y-emerald-100 border-r-emerald-100">
               <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Toplam Ürün Miktarı (Kalem)</span>
               <span className="text-2xl font-black text-[#03DF95] font-mono">{stats.totalItems.toLocaleString('tr-TR')}</span>
            </div>

            <div className="bg-slate-900 border-[3px] border-slate-800 p-4 rounded-md mt-4 flex items-center justify-between group cursor-default">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-[#03DF95]" />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white uppercase tracking-widest">WMS Veri Motoru</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cargo_Records DB Aktif</span>
                </div>
              </div>
              <div className="w-3 h-3 bg-[#03DF95] rounded-full animate-pulse shadow-[0_0_8px_#03DF95]"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}