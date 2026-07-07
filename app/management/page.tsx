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
  Network,
  Database,
  AlertCircle,
  FileText,
  Clock,
  TerminalSquare
} from "lucide-react";

// --- TİP TANIMLAMALARI (Deploy Hatalarını Önler) ---
interface RoleDistribution {
  name: string;
  count: number;
  percentage: number;
}

interface WeeklyActivity {
  day: string;
  val: number;
}

interface DashboardMetrics {
  totalBranches: number;
  totalEmployees: number;
  totalProducts: number;
  totalStockVolume: number;
  pendingLeaves: number;
  pendingAttendance: number;
  roleDistribution: RoleDistribution[];
  weeklyActivity: WeeklyActivity[];
  maxActivityValue: number;
  dbUsagePercent: number;
  totalDbRows: number;
}

export default function ManagementDashboard() {
  const [statsLoading, setStatsLoading] = useState(true);
  
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalBranches: 0,
    totalEmployees: 0,
    totalProducts: 0,
    totalStockVolume: 0,
    pendingLeaves: 0,
    pendingAttendance: 0,
    roleDistribution: [],
    weeklyActivity: [],
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

      // Koli İçi Toplam Hacim
      const totalStock = boxes.reduce((sum, box) => sum + (box.quantity || 0), 0);

      // Görev Dağılımı Hesaplama
      const roleCounts: Record<string, number> = {};
      employees.forEach(emp => {
        const role = emp.position_title || 'TANIMSIZ';
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      });
      
      const roleDistArray: RoleDistribution[] = Object.entries(roleCounts)
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / employees.length) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
        
      const top3Count = roleDistArray.reduce((sum, r) => sum + r.count, 0);
      if (employees.length > top3Count) {
         roleDistArray.push({
           name: 'DİĞER PERSONELLER',
           count: employees.length - top3Count,
           percentage: Math.round(((employees.length - top3Count) / employees.length) * 100)
         });
      }

      // Haftalık PDKS Lojiği
      const daysStr = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const weeklyObj: Record<string, number> = { 'Pzt':0, 'Sal':0, 'Çar':0, 'Per':0, 'Cum':0, 'Cmt':0, 'Paz':0 };
      
      attendances.forEach((att) => {
        if (att.created_at) {
          const d = new Date(att.created_at);
          weeklyObj[daysStr[d.getDay()]]++;
        }
      });
      
      const formattedWeekly: WeeklyActivity[] = Object.entries(weeklyObj).map(([day, val]) => ({ day, val }));
      const maxAct = Math.max(...formattedWeekly.map(d => d.val), 1);

      // Veritabanı Yükü Tahmini
      const totalRowsCalc = (branchesRes.count || 0) + employees.length + (productsRes.count || 0) + boxes.length + attendances.length;
      const simulatedMaxRows = 100000; // Limitsel gösterge
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

  // Koyu Temalı Pasta Grafik Renkleri
  const pieColors = ['#dc3545', '#3b82f6', '#f59e0b', '#10b981', '#64748b'];
  let currentPercent = 0;
  const gradientParts = metrics.roleDistribution.map((role, i) => {
      const start = currentPercent;
      currentPercent += role.percentage;
      return `${pieColors[i % pieColors.length]} ${start}% ${currentPercent}%`;
  });
  const dynamicConicGradient = `conic-gradient(${gradientParts.length > 0 ? gradientParts.join(', ') : '#1e293b 0% 100%'})`;

  if (statsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-light font-mono">
        <div className="relative">
          <TerminalSquare size={48} className="text-[#dc3545] opacity-20" />
          <Activity size={24} className="text-[#dc3545] absolute inset-0 m-auto animate-spin" />
        </div>
        <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase mt-6 animate-pulse">Sistem Verileri Senkronize Ediliyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 bg-light min-h-screen text-slate-200">
      
      {/* 🚀 ENDÜSTRİYEL HERO HEADER */}
      <div className="w-full bg-[#0F172A] px-6 py-6 flex items-center justify-between border-b-[4px] border-[#dc3545] shadow-xl relative overflow-hidden">
        {/* WMS Radar/Grid Arka Plan */}
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#dc3545]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="flex items-center gap-4 relative z-10">
          <div>
            <Link href="/management" className="flex-shrink-0 flex items-center cursor-pointer gap-2">
              <Logo variant="primary" className="text-3xl" />
              <span className="text-white font-black text-[15px] tracking-[0.2em] uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </Link>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">Merkezi Sistem Komuta Paneli</p>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex bg-light px-5 py-3 border border-slate-300 items-center gap-4 shadow-inner relative z-10 rounded-none">
           <div className="flex flex-col text-right pr-2">
             <span className="text-[9px] font-black text-[#10b981] uppercase tracking-[0.2em] flex items-center gap-1.5 justify-end mb-1">
               <Network className="w-3.5 h-3.5" strokeWidth={2.5} /> SİSTEM SAATİ
             </span>
             <span className="text-sm font-black text-slate-100 uppercase tracking-widest font-mono">
               {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
             </span>
           </div>
        </div>
      </div>

      <div className="px-4 md:px-6 flex flex-col gap-6 mt-2 relative z-10">
        
        {/* 📊 ANA KPI KARTLARI (Karanlık WMS Tarzı) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          
          <div className="bg-white p-5 border border-slate-300 rounded-none flex flex-col gap-3 shadow-lg group hover:border-slate-600 transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-700 group-hover:bg-slate-400 transition-colors"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kayıtlı Terminaller</span>
              <Building2 className="w-5 h-5 text-slate-600 group-hover:text-slate-800 transition-colors" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-black text-black font-mono tracking-tight">{metrics.totalBranches}</div>
          </div>

          <div className="bg-white p-5 border border-slate-300 rounded-none flex flex-col gap-3 shadow-lg group hover:border-blue-900 transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-900 group-hover:bg-blue-500 transition-colors shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aktif Personel</span>
              <Users className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-black text-black font-mono tracking-tight">{metrics.totalEmployees}</div>
          </div>

          <div className="bg-white p-5 border border-slate-300 rounded-none flex flex-col gap-3 shadow-lg group hover:border-amber-900 transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-900 group-hover:bg-amber-500 transition-colors shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Katalog Genişliği</span>
              <PackageSearch className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition-colors" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-black text-black font-mono tracking-tight">{metrics.totalProducts}</div>
          </div>

          <div className="bg-white p-5 border border-slate-300 rounded-none flex flex-col gap-3 shadow-lg group hover:border-[#dc3545] transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-900 group-hover:bg-[#dc3545] transition-colors shadow-[0_0_15px_rgba(220,53,69,0.6)]"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest">Sistem Stok Hacmi</span>
              <Box className="w-5 h-5 text-[#dc3545]/50 group-hover:text-[#dc3545] transition-colors" strokeWidth={2.5} />
            </div>
            <div className="text-3xl font-black text-[#dc3545] font-mono tracking-tight drop-shadow-md">{metrics.totalStockVolume}</div>
          </div>
        </div>

        {/* 📈 GRAFİKLER VE BİLGİ PANELLERİ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* DİNAMİK BAR GRAFİĞİ: HAFTALIK MESAİ GİRİŞLERİ */}
          <div className="lg:col-span-2 bg-white border border-slate-300 rounded-none p-6 shadow-lg flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#dc3545]" />
                <h3 className="text-[11px] font-black text-black uppercase tracking-[0.2em]">Haftalık Operasyonel Trafik</h3>
              </div>
              <span className="text-[9px] font-bold text-slate-400 border border-slate-700 px-2 py-1 uppercase bg-light">Son 7 Gün</span>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-3 h-56 mt-auto border-b border-slate-700 pb-2 relative z-10">
              {/* Arka Plan Kılavuz Çizgileri */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="w-full border-t border-slate-500 border-dashed h-0"></div>
                <div className="w-full border-t border-slate-500 border-dashed h-0"></div>
                <div className="w-full border-t border-slate-500 border-dashed h-0"></div>
              </div>

              {metrics.weeklyActivity.map((data, idx) => (
                <div key={idx} className="flex flex-col items-center gap-3 w-full group">
                  <div className="w-full max-w-[45px] bg-light relative flex items-end justify-center h-full border border-slate-300 border-b-0">
                    <div 
                      className="w-full bg-slate-700 group-hover:bg-[#dc3545] group-hover:shadow-[0_0_15px_rgba(220,53,69,0.5)] transition-all duration-500 relative"
                      style={{ height: `${(data.val / metrics.maxActivityValue) * 100}%`, minHeight: data.val > 0 ? '4px' : '0' }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono font-black text-black opacity-0 group-hover:opacity-100 transition-opacity">
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
          <div className="bg-white border border-slate-300 rounded-none p-6 shadow-lg flex flex-col items-center relative">
            <div className="absolute top-5 left-5 flex items-center gap-2 w-full">
              <Users className="w-4 h-4 text-[#dc3545]" />
              <h3 className="text-[11px] font-black text-black uppercase tracking-[0.2em]">İnsan Kaynağı Matrisi</h3>
            </div>

            <div className="mt-14 flex flex-col items-center w-full">
              {metrics.roleDistribution.length > 0 ? (
                <>
                  <div 
                    className="w-36 h-36 rounded-full shadow-lg relative flex items-center justify-center transition-all duration-1000 border-4 border-[#0A0F1C]"
                    style={{ background: dynamicConicGradient }}
                  >
                    {/* Ortadaki delik, arka planla aynı renk */}
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-inner border border-slate-300">
                      <span className="text-2xl font-black font-mono text-black">{metrics.totalEmployees}</span>
                    </div>
                  </div>

                  <div className="mt-10 w-full flex flex-col gap-3">
                    {metrics.roleDistribution.map((role, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest border-b border-slate-300 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-none shadow-sm" style={{ backgroundColor: pieColors[idx % pieColors.length] }}></span> 
                          <span className="text-slate-800 truncate max-w-[120px]" title={role.name}>{role.name}</span>
                        </div>
                        <span className="text-black font-mono text-xs">%{role.percentage}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-600 font-bold uppercase tracking-widest mt-12 text-center">Veri Bekleniyor</div>
              )}
            </div>
          </div>
        </div>

        {/* 🗄️ ALT BİLGİ PANELLERİ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* VERİTABANI KULLANIM YÜZDESİ */}
          <div className="bg-white border border-slate-300 rounded-none p-6 relative overflow-hidden flex flex-col justify-center shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#10b981]" />
                <h4 className="text-black font-black text-[11px] uppercase tracking-[0.2em]">Sistem Veri Hacmi</h4>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400">VOL: {metrics.totalDbRows} SATIR</span>
            </div>
            
            <p className="text-slate-500 text-[10px] font-bold mb-5 tracking-wide">
              Anlık veritabanı okuma/yazma endeksi ve tahmini kapasite doluluk oranı.
            </p>
            
            <div className="w-full bg-light border border-slate-300 h-3 mb-2 relative">
              <div 
                className={`h-full transition-all duration-1000 shadow-[0_0_10px_currentColor] ${metrics.dbUsagePercent > 80 ? 'bg-[#dc3545] text-[#dc3545]' : 'bg-[#10b981] text-[#10b981]'}`} 
                style={{ width: `${metrics.dbUsagePercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className={metrics.dbUsagePercent > 80 ? 'text-[#dc3545]' : 'text-[#10b981]'}>%{metrics.dbUsagePercent} DOLU</span>
              <span className="text-slate-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse"></span>
                KAPASİTE STABİL
              </span>
            </div>
          </div>

          {/* BEKLEYEN İŞLEM ONAYLARI (PDKS) */}
          <div className="bg-[#16120b] border border-amber-900/50 rounded-none p-6 flex flex-col justify-center relative shadow-lg overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>
            
            <div className="flex items-center gap-2 mb-5 relative z-10">
              <AlertCircle className="w-4 h-4 text-[#10b981]" />
              <h4 className="text-[#10b981] font-black text-[11px] uppercase tracking-[0.2em]">Bekleyen Aksiyonlar</h4>
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-light border border-slate-300 p-4 flex flex-col gap-2 hover:border-amber-700/50 transition-colors">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                  İzin Talepleri <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="text-3xl font-mono font-black text-[#10b981] drop-shadow-md">{metrics.pendingLeaves}</div>
              </div>

              <div className="bg-light border border-slate-300 p-4 flex flex-col gap-2 hover:border-amber-700/50 transition-colors">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                  Mesai Düzeltme <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="text-3xl font-mono font-black text-[#10b981] drop-shadow-md">{metrics.pendingAttendance}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}