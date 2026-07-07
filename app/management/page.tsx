"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { 
  Activity, 
  Building2, 
  Users, 
  PackageSearch,
  Box,
  BarChart3,
  Server,
  Network,
  Database,
  AlertCircle,
  FileText,
  Clock
} from "lucide-react";

export default function ManagementDashboard() {
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Gerçek Veritabanı Metrikleri State'i
  const [metrics, setMetrics] = useState({
    totalBranches: 0,
    totalEmployees: 0,
    totalProducts: 0,
    totalStockVolume: 0,
    pendingLeaves: 0,
    pendingAttendance: 0,
    roleDistribution: [] as any[],
    weeklyActivity: [] as any[],
    maxActivityValue: 1,
    dbUsagePercent: 0,
    totalDbRows: 0
  });

  useEffect(() => {
    fetchLiveMetrics();
  }, []);

  const fetchLiveMetrics = async () => {
    setStatsLoading(true);
    try {
      // 1. DİNAMİK VERİ ÇEKİMİ (Gerçek Tablolardan)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        branchesRes, 
        employeesRes, 
        productsRes,
        boxesRes,
        attendanceRes,
        pendingLeavesRes,
        pendingAttReqRes
      ] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact', head: true }),
        supabase.from('employees').select('position_title').eq('is_active', true),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('boxes').select('quantity'),
        supabase.from('attendance').select('created_at').gte('created_at', sevenDaysAgo.toISOString()),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('attendance_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING')
      ]);

      const employees = employeesRes.data || [];
      const boxes = boxesRes.data || [];
      const attendances = attendanceRes.data || [];

      // 2. KUTU İÇİ TOPLAM ÜRÜN MİKTARI (Stock Volume)
      const totalStock = boxes.reduce((sum, box) => sum + (box.quantity || 0), 0);

      // 3. GÖREV DAĞILIMI (Pasta Grafiği İçin)
      const roleCounts: Record<string, number> = {};
      employees.forEach(emp => {
        const role = emp.position_title || 'Tanımsız';
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      });
      
      const roleDistArray = Object.entries(roleCounts)
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / employees.length) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
        
      const top3Count = roleDistArray.reduce((sum, r) => sum + r.count, 0);
      if (employees.length > top3Count) {
         roleDistArray.push({
           name: 'Diğer Personeller',
           count: employees.length - top3Count,
           percentage: Math.round(((employees.length - top3Count) / employees.length) * 100)
         });
      }

      // 4. HAFTALIK MESAİ & SİSTEM AKTİVİTESİ (Bar Grafiği İçin)
      const daysStr = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const weeklyObj = { 'Pzt':0, 'Sal':0, 'Çar':0, 'Per':0, 'Cum':0, 'Cmt':0, 'Paz':0 };
      
      attendances.forEach((att: any) => {
        const d = new Date(att.created_at);
        weeklyObj[daysStr[d.getDay()]]++;
      });
      
      const formattedWeekly = Object.entries(weeklyObj).map(([day, val]) => ({ day, val }));
      const maxAct = Math.max(...formattedWeekly.map(d => d.val), 1);

      // 5. VERİTABANI KULLANIM KAPASİTESİ (Tahmini Satır Hacmi)
      // Supabase'in anlık sağlığını göstermek için çekilen kayıt sayıları toplanır. Limit örneğin 50.000 satır varsayılır.
      const totalRowsCalc = (branchesRes.count || 0) + employees.length + (productsRes.count || 0) + boxes.length + attendances.length;
      const simulatedMaxRows = 50000;
      let dbUsage = (totalRowsCalc / simulatedMaxRows) * 100;
      if (dbUsage > 100) dbUsage = 100;

      setMetrics({
        totalBranches: branchesRes.count || 0,
        totalEmployees: employees.length,
        totalProducts: productsRes?.count || 0,
        totalStockVolume: totalStock,
        pendingLeaves: pendingLeavesRes?.count || 0,
        pendingAttendance: pendingAttReqRes?.count || 0,
        roleDistribution: roleDistArray,
        weeklyActivity: formattedWeekly,
        maxActivityValue: maxAct,
        dbUsagePercent: Number(dbUsage.toFixed(2)),
        totalDbRows: totalRowsCalc
      });

    } catch (error) {
      console.error("WMS Veri Okuma Hatası:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Pasta Grafiği İçin Conic Gradient Hesaplayıcı
  const pieColors = ['#dc3545', '#0F172A', '#94a3b8', '#cbd5e1'];
  let currentPercent = 0;
  const gradientParts = metrics.roleDistribution.map((role, i) => {
      const start = currentPercent;
      currentPercent += role.percentage;
      return `${pieColors[i % pieColors.length]} ${start}% ${currentPercent}%`;
  });
  const dynamicConicGradient = `conic-gradient(${gradientParts.length > 0 ? gradientParts.join(', ') : '#f1f5f9 0% 100%'})`;

  if (statsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-['Quicksand'] bg-slate-50">
        <Activity size={32} className="text-[#dc3545] animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-xs tracking-widest uppercase animate-pulse">WMS Veritabanı Senkronize Ediliyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 font-['Quicksand'] bg-slate-50 min-h-screen">
      
      {/* 🚀 HEADER (İLK TASARIMDAKİ DARK ENDÜSTRİYEL YAPI) */}
      <div className="w-full bg-[#0F172A] px-6 py-6 flex items-center justify-between border-b-[4px] border-[#dc3545] shadow-xl relative overflow-hidden">
        {/* Teknik Arkaplan Efekti */}
        <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.05)_10px,rgba(255,255,255,0.05)_20px)] pointer-events-none"></div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#dc3545]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-[#dc3545] p-3 shadow-[0_0_15px_rgba(220,53,69,0.3)] border border-red-500/30 rounded-none">
            <Box className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <Link
              href="/management"
              className="flex-shrink-0 flex items-center  cursor-pointer gap-2"
            >
              <Logo variant="primary" className="text-3xl " />
              <span className="text-[#ffffff] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </Link>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-1.5 h-1.5 bg-[#33ff00] rounded-full animate-pulse shadow-[0_0_8px_#fbbf24]"></div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.15em]">Sistem İzleme ve Operasyon Merkezi</p>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex bg-slate-800/80 px-5 py-3 border border-slate-700 items-center gap-4 shadow-inner backdrop-blur-sm relative z-10 rounded-none">
           <div className="flex flex-col text-right pr-2">
             <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] flex items-center gap-1.5 justify-end mb-1">
               <Network className="w-3.5 h-3.5" strokeWidth={2.5} /> SİSTEM SAATİ
             </span>
             <span className="text-sm font-black text-slate-100 uppercase tracking-widest font-mono">
               {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
             </span>
           </div>
        </div>
      </div>

      <div className="px-4 md:px-6 flex flex-col gap-6 mt-2">
        
        {/* 📊 ANA KPI KARTLARI (KESKİN VE TEMİZ) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          
          <div className="bg-white p-5 border border-slate-200 rounded-none flex flex-col gap-3 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kayıtlı Şubeler</span>
              <Building2 className="w-5 h-5 text-slate-300" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-black text-[#0F172A] font-mono tracking-tight">{metrics.totalBranches}</div>
            <div className="w-full h-1 bg-slate-100 mt-1"><div className="h-full bg-[#0F172A] w-[100%]"></div></div>
          </div>

          <div className="bg-white p-5 border border-slate-200 rounded-none flex flex-col gap-3 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aktif Personel</span>
              <Users className="w-5 h-5 text-slate-300" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-black text-[#0F172A] font-mono tracking-tight">{metrics.totalEmployees}</div>
            <div className="w-full h-1 bg-slate-100 mt-1"><div className="h-full bg-blue-500 w-[100%]"></div></div>
          </div>

          <div className="bg-white p-5 border border-slate-200 rounded-none flex flex-col gap-3 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SKU Çeşitliliği (Products)</span>
              <PackageSearch className="w-5 h-5 text-slate-300" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-black text-[#0F172A] font-mono tracking-tight">{metrics.totalProducts}</div>
            <div className="w-full h-1 bg-slate-100 mt-1"><div className="h-full bg-amber-500 w-[100%]"></div></div>
          </div>

          <div className="bg-white p-5 border border-slate-200 rounded-none flex flex-col gap-3 shadow-sm hover:border-[#dc3545] transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest">Stok Hacmi (Koli Adeti)</span>
              <Box className="w-5 h-5 text-[#dc3545]/50 group-hover:text-[#dc3545] transition-colors" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-black text-[#dc3545] font-mono tracking-tight">{metrics.totalStockVolume}</div>
            <div className="w-full h-1 bg-red-100 mt-1"><div className="h-full bg-[#dc3545] w-[100%]"></div></div>
          </div>
        </div>

        {/* 📈 GRAFİKLER VE BİLGİ PANELLERİ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* DİNAMİK BAR GRAFİĞİ: HAFTALIK MESAİ GİRİŞLERİ */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-none p-6 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#dc3545]" />
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Haftalık PDKS Log Hacmi</h3>
              </div>
              <span className="text-[9px] font-bold text-slate-500 border border-slate-200 px-2 py-1 uppercase bg-slate-50">Son 7 Gün</span>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-3 h-48 mt-auto border-b-2 border-slate-200 pb-2 relative z-10">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
                <div className="w-full border-t border-slate-400 border-dashed h-0"></div>
              </div>

              {metrics.weeklyActivity.map((data, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 w-full group">
                  <div className="w-full max-w-[45px] bg-slate-50 relative flex items-end justify-center h-full border border-slate-200 border-b-0">
                    <div 
                      className="w-full bg-[#0F172A] group-hover:bg-[#dc3545] transition-all duration-500 relative"
                      style={{ height: `${(data.val / metrics.maxActivityValue) * 100}%`, minHeight: data.val > 0 ? '4px' : '0' }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono font-black text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        {data.val}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{data.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* DİNAMİK PASTA GRAFİĞİ: GÖREV DAĞILIMI */}
          <div className="bg-white border border-slate-200 rounded-none p-6 shadow-sm flex flex-col items-center relative">
            <div className="absolute top-5 left-5 flex items-center gap-2 w-full">
              <Users className="w-4 h-4 text-[#dc3545]" />
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Görev Dağılımı</h3>
            </div>

            <div className="mt-12 flex flex-col items-center w-full">
              {metrics.roleDistribution.length > 0 ? (
                <>
                  <div 
                    className="w-32 h-32 rounded-full shadow-inner relative flex items-center justify-center transition-all duration-1000 border border-slate-100"
                    style={{ background: dynamicConicGradient }}
                  >
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-xl font-black font-mono text-slate-800">{metrics.totalEmployees}</span>
                    </div>
                  </div>

                  <div className="mt-8 w-full flex flex-col gap-3">
                    {metrics.roleDistribution.map((role, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-none" style={{ backgroundColor: pieColors[idx % pieColors.length] }}></span> 
                          <span className="text-slate-600 truncate max-w-[120px]" title={role.name}>{role.name}</span>
                        </div>
                        <span className="text-slate-800 font-mono text-xs">%{role.percentage}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-12 text-center">Veri Bekleniyor</div>
              )}
            </div>
          </div>
        </div>

        {/* 🗄️ ALT BİLGİ PANELLERİ (Veritabanı Sağlığı & Bekleyen Onaylar) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* VERİTABANI KULLANIM YÜZDESİ */}
          <div className="bg-white border border-slate-200 rounded-none p-6 relative overflow-hidden flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <h4 className="text-slate-800 font-black text-[11px] uppercase tracking-widest">Supabase Veri Yükü</h4>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">Vol: {metrics.totalDbRows} Satır</span>
            </div>
            
            <p className="text-slate-500 text-[10px] font-bold mb-4">Sistem tablolalarındaki anlık okuma-yazma hacmi ve kapasite doluluk oranı.</p>
            
            <div className="w-full bg-slate-100 h-2.5 mb-2 relative">
              <div 
                className={`h-full transition-all duration-1000 ${metrics.dbUsagePercent > 80 ? 'bg-[#dc3545]' : 'bg-emerald-500'}`} 
                style={{ width: `${metrics.dbUsagePercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase">
              <span className={metrics.dbUsagePercent > 80 ? 'text-[#dc3545]' : 'text-emerald-600'}>%{metrics.dbUsagePercent} DOLU</span>
              <span className="text-slate-400">Kapasite Stabil</span>
            </div>
          </div>

          {/* BEKLEYEN İŞLEM ONAYLARI (PDKS) */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-none p-6 flex flex-col justify-center relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h4 className="text-white font-black text-[11px] uppercase tracking-widest">Bekleyen Sistem Onayları</h4>
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-slate-800 border border-slate-700 p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  İzin Talepleri <FileText className="w-3 h-3" />
                </div>
                <div className="text-2xl font-mono font-black text-amber-400">{metrics.pendingLeaves}</div>
              </div>

              <div className="bg-slate-800 border border-slate-700 p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Mesai Düzeltme <Clock className="w-3 h-3" />
                </div>
                <div className="text-2xl font-mono font-black text-amber-400">{metrics.pendingAttendance}</div>
              </div>
            </div>
          </div>

        </div>
        
      </div>
    </div>
  );
}