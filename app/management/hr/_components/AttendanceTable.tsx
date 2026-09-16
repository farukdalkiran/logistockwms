"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  User,
  ShieldCheck,
  RefreshCw,
  Clock,
  Coffee,
  CalendarDays,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Code2,
} from "lucide-react";

interface AttendanceTableProps {
  branchId: string | null;
  isDeveloper?: boolean;
}

export default function AttendanceTable({
  branchId,
  isDeveloper,
}: AttendanceTableProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, number>>({});
  const [monthlyLates, setMonthlyLates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- 1. VERİ ÇEKME & MATEMATİK FONKSİYONU ---
  const fetchRecords = useCallback(
    async (showRefreshAnim = false) => {
      if (!isDeveloper && (!branchId || branchId === "GLOBAL")) return;

      if (showRefreshAnim) setIsRefreshing(true);

      const now = new Date();
      
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      let dailyQuery = supabase
        .from("attendance")
        .select(`
          id,
          employee_id,
          check_in_time,
          check_out_time,
          break_hours,
          working_hours,
          status,
          employees!attendance_employee_id_fkey ( full_name, position_title, device_token ) 
        `)
        .gte("check_in_time", todayStart)
        .lte("check_in_time", todayEnd)
        .order("check_in_time", { ascending: false });

      if (branchId && branchId !== "GLOBAL") {
        dailyQuery = dailyQuery.eq("branch_id", branchId);
      }

      const { data: dailyData, error: dailyError } = await dailyQuery;

      if (dailyError) {
        console.error("[WMS_DB_ERROR] Günlük mesai çekilemedi:", dailyError.message);
      } else {
        setRecords(dailyData || []);
      }

      let monthlyQuery = supabase
        .from("attendance")
        .select("employee_id, working_hours, check_in_time, status")
        .gte("check_in_time", monthStart)
        .lte("check_in_time", monthEnd);

      if (branchId && branchId !== "GLOBAL") {
        monthlyQuery = monthlyQuery.eq("branch_id", branchId);
      }

      const { data: monthlyData, error: monthlyError } = await monthlyQuery;

      if (!monthlyError && monthlyData) {
        const totals: Record<string, number> = {};
        const lates: Record<string, number> = {};

        monthlyData.forEach((row) => {
          if (row.working_hours) {
            if (!totals[row.employee_id]) totals[row.employee_id] = 0;
            totals[row.employee_id] += Number(row.working_hours);
          }

          if (!lates[row.employee_id]) lates[row.employee_id] = 0;
          if (row.check_in_time && (!row.status || !row.status.startsWith('LEAVE_'))) {
            // TARAYICI SAATİNİ EZEN UTC+3 TÜRKİYE SAATİ KORUMASI
            const d = new Date(row.check_in_time);
            const localHours = d.getUTCHours() + 3;
            const realHours = localHours >= 24 ? localHours - 24 : localHours; 
            const mins = realHours * 60 + d.getUTCMinutes();
            
            if (mins > 495) { // 08:15 Sonrası
              lates[row.employee_id]++;
            }
          }
        });
        
        setMonthlyTotals(totals);
        setMonthlyLates(lates);
      }

      setLoading(false);
      if (showRefreshAnim) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    },
    [branchId, isDeveloper],
  );

  useEffect(() => {
    fetchRecords();

    const handleCustomTrigger = () => fetchRecords(true);
    window.addEventListener("refresh-wms-attendance", handleCustomTrigger);

    const realtimeFilter = branchId && branchId !== "GLOBAL" ? `branch_id=eq.${branchId}` : undefined;

    const channel = supabase
      .channel("attendance_realtime")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "attendance",
          filter: realtimeFilter
        },
        () => fetchRecords(),
      )
      .subscribe();

    return () => {
      window.removeEventListener("refresh-wms-attendance", handleCustomTrigger);
      supabase.removeChannel(channel);
    };
  }, [fetchRecords, branchId]);

  const sortedRecords = useMemo(() => {
    if (!records || records.length === 0) return [];
    const regular = records.filter(r => !(r.status && r.status.startsWith('LEAVE_')));
    const leaves = records.filter(r => r.status && r.status.startsWith('LEAVE_'));
    return [...regular, ...leaves];
  }, [records]);

  // --- YARDIMCI FONKSİYONLAR ---
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "--:--";
    return new Date(timeStr).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatHours = (val: number | string | null) => {
    if (val === null || val === undefined) return "--";
    const num = Number(val);
    if (num === 0) return "0s";

    const hours = Math.floor(num);
    const minutes = Math.round((num - hours) * 60);

    let finalHours = hours;
    let finalMinutes = minutes;
    if (finalMinutes === 60) {
      finalHours += 1;
      finalMinutes = 0;
    }

    if (finalMinutes === 0) return `${finalHours}s`;
    if (finalHours === 0) return `${finalMinutes}dk`;
    return `${finalHours}s ${finalMinutes}dk`;
  };

  const getRoleType = (title?: string) => {
    if (!title) return "PERSONNEL";
    const lower = title.toLocaleLowerCase("tr-TR");
    
    if (lower.includes("developer") || lower.includes("geliştirici")) {
      return "DEVELOPER";
    }
    if (["yönetici", "müdür", "şef", "admin", "lider","uzman"].some((k) => lower.includes(k))) {
      return "MANAGER";
    }
    return "PERSONNEL";
  };

  const getEntryStatusDot = (timeStr: string | null) => {
    if (!timeStr) return null;
    const d = new Date(timeStr);
    const localHours = d.getUTCHours() + 3;
    const realHours = localHours >= 24 ? localHours - 24 : localHours; 
    const totalMins = realHours * 60 + d.getUTCMinutes();

    if (totalMins > 495) {
      return <span className="w-2.5 h-2.5 rounded-full bg-[#dc3545] shrink-0 shadow-[0_0_6px_#dc3545] animate-pulse" title="Geç Giriş İhlali (> 08:15)"></span>;
    }
    else if (totalMins >= 491 && totalMins <= 495) {
      return <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] shrink-0 shadow-[0_0_6px_#f97316] animate-pulse" title="Tolerans Sınırında (08:11 - 08:15)"></span>;
    }
    return <span className="w-2.5 h-2.5 rounded-full bg-[#0b9c2d] shrink-0 shadow-[0_0_6px_#0b9c2d]" title="Zamanında Giriş"></span>;
  };

  // GELİŞMİŞ İHLAL ROZETİ (ŞİDDET SEVİYELERİNE GÖRE ANIMASYON)
  const getLateBadge = (lateCount: number) => {
    if (lateCount === 0) {
      return (
        <div className="flex justify-center">
          <span className="text-slate-300 font-black text-[12px] opacity-70">-</span>
        </div>
      );
    }

    let gradientClass = "";
    let boxClass = "";
    let wrapperClass = "relative inline-flex p-[2px] rounded-sm overflow-hidden group shadow-sm";

    if (lateCount <= 3) {
      // GÜVENLİ BÖLGE (Yeşil tonları, yavaş animasyon)
      gradientClass = "bg-[conic-gradient(from_90deg_at_50%_50%,#ecfdf5_0%,#10b981_50%,#ecfdf5_100%)] animate-[spin_4s_linear_infinite]";
      boxClass = "bg-emerald-50 text-emerald-700";
    } else if (lateCount === 4) {
      // UYARI BÖLGESİ (Sarı tonları, normal hız)
      gradientClass = "bg-[conic-gradient(from_90deg_at_50%_50%,#fffbeb_0%,#f59e0b_50%,#fffbeb_100%)] animate-[spin_2s_linear_infinite]";
      boxClass = "bg-amber-100 text-amber-800";
    } else {
      // KRİTİK BÖLGE (Kırmızı tonları, HIZLI DÖNÜŞ VE SALLANMA)
      wrapperClass += " animate-pulse shadow-[0_0_8px_rgba(220,53,69,0.5)]";
      gradientClass = "bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#dc3545_50%,#000000_100%)] animate-[spin_1s_linear_infinite]";
      boxClass = "bg-red-600 text-white shadow-inner";
    }

    return (
      <div className="flex justify-center">
        <div className={wrapperClass}>
          <span className={`absolute inset-[-1000%] ${gradientClass}`} />
          <span className={`relative inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-black tabular-nums rounded-[3px] ${boxClass}`}>
            {lateCount}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 w-full shadow-sm rounded-md overflow-hidden flex flex-col h-[700px]">
      
      {/* ENDÜSTRİYEL DARK HEADING & LEJANT */}
      <div className="bg-[#0F172B] px-5 py-5 flex justify-between items-center border-b-4 border-[#dc3545] shrink-0 z-20 shadow-sm">
        <div className="flex flex-col justify-center">
          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">
            CANLI İZLEME MODÜLÜ
          </span>
          <span className="text-sm font-black text-white flex items-center gap-2.5 uppercase tracking-wide">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#dc3545] animate-pulse shadow-[0_0_8px_#dc3545]"></span>
            GÜNLÜK MESAİ HAREKETLERİ
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-3 bg-[#1E293B] border border-slate-700 px-3 py-1.5 rounded-sm shadow-inner text-[9px] font-bold uppercase tracking-wider text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0b9c2d]"></span> &lt;08:10
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f97316]"></span> 08:11-08:15
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#dc3545]"></span> &gt;08:15
          </span>
        </div>

        <div className="flex gap-2 text-center items-center">
          <div className="bg-[#1E293B] px-3 py-1.5 border border-slate-700 rounded-sm shadow-inner min-w-[60px] flex flex-col justify-center">
            <span className="block text-[9px] text-white font-bold uppercase tracking-wider">SAAT</span>
            <span className="text-sm font-black text-white font-mono tabular-nums">
              {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div className="bg-[#1E293B] px-3 py-1.5 border border-slate-700 rounded-sm shadow-inner min-w-[60px] flex flex-col justify-center">
            <span className="block text-[9px] text-white font-bold uppercase tracking-wider">KAYIT</span>
            {loading ? (
              <span className="text-sm font-black text-white font-mono h-5 flex items-center justify-center">
                <span className="w-3 h-3 border-[3px] border-t-transparent border-white rounded-full animate-spin"></span>
              </span>
            ) : (
              <span className="text-sm font-black text-white font-mono tabular-nums">{records.length}</span>
            )}
          </div>

          <div className="bg-[#1E293B] px-2 py-1.5 border border-slate-700 rounded-sm shadow-inner flex flex-col justify-center ml-1">
            <button
              onClick={() => fetchRecords(true)}
              disabled={loading || isRefreshing}
              className="bg-[#0F172B] hover:bg-[#dc3545] border border-slate-600 hover:border-[#dc3545] transition-all duration-300 h-[34px] px-3 rounded-sm shadow-sm flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-50 group"
              title="Tabloyu Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-180 ${isRefreshing ? "animate-spin text-white" : ""}`} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-5 py-3">Personel Bilgisi</th>
              <th className="px-2 py-3 text-center w-[100px]">Giriş Saati</th>
              <th className="px-2 py-3 text-center w-[100px]">Çıkış Saati</th>
              <th className="px-2 py-3 text-center text-amber-600 w-[90px]">
                <div className="flex items-center justify-center gap-1"><Coffee className="w-3 h-3" /> Mola</div>
              </th>
              <th className="px-2 py-3 text-center text-slate-500 w-[90px]">
                <div className="flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Günlük</div>
              </th>
              <th className="px-2 py-3 text-center text-slate-500 w-[90px]">
                <div className="flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3 text-[#dc3545]" /> İhlal</div>
              </th>
              <th className="px-2 py-3 text-center text-[#0F172B] bg-slate-100 border-l border-slate-200 w-[100px]">
                <div className="flex items-center justify-center gap-1"><CalendarDays className="w-3 h-3 text-[#0F172B]" /> Aylık</div>
              </th>
              <th className="px-5 py-3 text-right w-[120px]">Durum</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100">
            {loading && sortedRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-20 text-center bg-white">
                  <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                    <div className="w-8 h-8 border-4 border-slate-100 border-t-[#dc3545] rounded-full animate-spin"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Kayıtlar Hesaplanıyor...</span>
                  </div>
                </td>
              </tr>
            ) : sortedRecords && sortedRecords.length > 0 ? (
              sortedRecords.map((record: any, index: number) => {
                
                const roleType = getRoleType(record.employees?.position_title);
                const employeeId = record.employee_id;
                const monthlyTotal = monthlyTotals[employeeId] || 0;
                const monthlyLate = monthlyLates[employeeId] || 0;

                const isLeave = record.status && record.status.startsWith('LEAVE_');
                const leaveText = isLeave ? record.status.replace('LEAVE_', '').replace(/_/g, ' ') : '';
                
                const isEven = index % 2 === 0;
                const hasDeviceToken = record.employees?.device_token ? true : false;

                return (
                  <tr key={record.id} className={`transition-all duration-200 hover:bg-slate-100 ${isEven ? 'bg-white' : 'bg-[#f8fafc]'} ${isLeave ? 'bg-blue-50/20' : ''}`}>
                    
                    <td className="px-5 py-2 font-bold text-slate-800 flex items-center gap-3 min-w-[200px]">
                      {roleType === "DEVELOPER" ? (
                        <div className="relative inline-flex p-[2px] rounded-md overflow-hidden group shrink-0">
                          <span className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#33cc00_0%,#9333ea_50%,#eb9100_100%)]" />
                          <div className="relative flex items-center justify-center w-7 h-7 rounded-sm bg-[#a600cf] text-white">
                            <Code2 className="w-4 h-4" strokeWidth={2.5} />
                          </div>
                        </div>
                      ) : roleType === "MANAGER" ? (
                        <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-[#8f0000] text-white shrink-0">
                          <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-[#cc0014] text-white shrink-0">
                          <User className="w-4 h-4" strokeWidth={2.5} />
                        </div>
                      )}

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] uppercase tracking-wide truncate max-w-[130px] sm:max-w-[170px] text-slate-900">{record.employees?.full_name || "BİLİNMEYEN"}</span>
                        <span className={`text-[9px] uppercase tracking-wider ${roleType === 'DEVELOPER' ? 'text-purple-600 font-bold' : 'text-slate-400'}`}>
                          {record.employees?.position_title || "PERSONEL"}
                        </span>
                      </div>
                    </td>

                    {/* CİHAZ (PHONE) SÜTUNU & ANİMASYONU */}
                    {isLeave ? (
                      <td colSpan={6} className="px-2 py-2 text-center">
                        <span className={`inline-flex items-center justify-center gap-2 w-full max-w-[300px] px-3 py-1.5 rounded-sm border text-[9px] font-black uppercase tracking-widest shadow-sm ${
                          leaveText === 'SAGLIK RAPORU' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {leaveText === 'SAGLIK RAPORU' ? 'SAĞLIK RAPORU' : `${leaveText}`}
                        </span>
                      </td>
                    ) : (
                      <>
                        <td className="px-2 py-2 text-center font-black text-slate-700 tabular-nums text-[12px]">
                          <div className="flex items-center justify-center gap-2">
                            {getEntryStatusDot(record.check_in_time)}
                            <span className="min-w-[36px] text-left">{formatTime(record.check_in_time)}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-slate-500 tabular-nums text-[12px]">{formatTime(record.check_out_time)}</td>
                        <td className="px-2 py-2 text-center font-bold text-amber-600 tabular-nums">{record.break_hours ? `${Number(record.break_hours)}s` : "0s"}</td>
                        <td className="px-2 py-2 text-center font-bold text-slate-700 tabular-nums text-[12px]">
                          <span className="bg-slate-50 border border-slate-200 px-2 py-1 rounded-sm">{record.working_hours ? formatHours(record.working_hours) : "--"}</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {getLateBadge(monthlyLate)}
                        </td>
                      </>
                    )}

                    <td className="px-2 py-2 text-center font-black text-[#0F172B] bg-slate-50 border-l border-slate-200 tabular-nums text-[12px]">
                      {monthlyTotal > 0 ? formatHours(monthlyTotal) : "0s"}
                    </td>

                    <td className="px-5 py-2 text-right">
                      {isLeave ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-blue-700 bg-blue-50 rounded-sm border border-blue-200 text-[9px] font-black uppercase tracking-widest">
                          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} /> Onaylandı
                        </span>
                      ) : !record.check_out_time ? (
                        /* YENİ: İÇERİDE - Açık Yeşil Yapı */
                        <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-emerald-600 bg-emerald-50 rounded-sm border border-emerald-200 text-[9px] font-black uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} /> İÇERİDE
                        </span>
                      ) : (
                        /* YENİ: TAMAMLANDI - Koyu Yeşil Yapı */
                        <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-white bg-emerald-700 rounded-sm border border-emerald-800 text-[9px] font-black uppercase tracking-widest shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} /> TAMAMLANDI
                        </span>
                      )} 
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-3 py-16 text-center bg-white">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Clock size={28} className="opacity-20 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      BUGÜN İÇİN HENÜZ MESAİ HAREKETİ BULUNMUYOR
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}