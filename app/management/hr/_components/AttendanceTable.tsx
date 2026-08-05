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
  AlertCircle
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
      // 🛡️ GÜVENLİK: Şube bilgisi yoksa ve admin değilse boşuna veritabanını yorma
      if (!isDeveloper && (!branchId || branchId === "GLOBAL")) return;

      if (showRefreshAnim) setIsRefreshing(true);

      const now = new Date();
      
      // 🎯 KRİTİK DÜZELTME: SADECE BUGÜNÜN BAŞLANGICI VE BİTİŞİ (GELECEK İZİNLERİ ENGELLER)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      
      // BU AYIN BAŞLANGICI VE BİTİŞİ (Aylık toplamlar için)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      // GÜNLÜK HAREKETLERİ ÇEK (SADECE BUGÜN)
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
          employees!attendance_employee_id_fkey ( full_name, position_title )
        `)
        .gte("check_in_time", todayStart)
        .lte("check_in_time", todayEnd) // SADECE BUGÜN KİLİDİ
        .order("check_in_time", { ascending: false });

      // SIKIYÖNETİM: ŞUBE KİLİDİ
      if (branchId && branchId !== "GLOBAL") {
        dailyQuery = dailyQuery.eq("branch_id", branchId);
      }

      const { data: dailyData, error: dailyError } = await dailyQuery;

      if (dailyError) {
        console.error("[WMS_DB_ERROR] Günlük mesai çekilemedi:", dailyError.message);
      } else {
        setRecords(dailyData || []);
      }

      // BU AYIN TOPLAM ÇALIŞMA SAATLERİNİ VE İHLALLERİ ÇEK
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
          // Toplam Saat Havuzu
          if (row.working_hours) {
            if (!totals[row.employee_id]) totals[row.employee_id] = 0;
            totals[row.employee_id] += Number(row.working_hours);
          }

          // Geç Kalma (İhlal) Havuzu
          if (!lates[row.employee_id]) lates[row.employee_id] = 0;
          if (row.check_in_time && (!row.status || !row.status.startsWith('LEAVE_'))) {
            const d = new Date(row.check_in_time);
            const mins = d.getHours() * 60 + d.getMinutes();
            if (mins > 495) { // 08:15 sonrası ihlal sayacı kuralı
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

  // --- 2. SOKET & TETİKLEYİCİ DİNLEME ---
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

  // --- AKILLI SIRALAMA MOTORU (İZİNLERİ EN ALTA İT) ---
  const sortedRecords = useMemo(() => {
    if (!records || records.length === 0) return [];
    
    // Normal mesai hareketleri
    const regular = records.filter(r => !(r.status && r.status.startsWith('LEAVE_')));
    // İzin hareketleri
    const leaves = records.filter(r => r.status && r.status.startsWith('LEAVE_'));
    
    // İzinleri her koşulda dizinin en sonuna ekle
    return [...regular, ...leaves];
  }, [records]);

  // --- YARDIMCI FONKSİYONLAR ---
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "--:--";
    const date = new Date(timeStr);
    return date.toLocaleTimeString("tr-TR", {
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

  const checkIsManager = (title?: string) => {
    if (!title) return false;
    const lowerTitle = title.toLocaleLowerCase("tr-TR");
    return [
      "yönetici", "müdür", "şef", "admin", "developer", "uzman", "lider",
    ].some((keyword) => lowerTitle.includes(keyword));
  };

  const getEntryStatusDot = (timeStr: string | null) => {
    if (!timeStr) return null;

    const date = new Date(timeStr);
    const totalMins = date.getHours() * 60 + date.getMinutes();

    if (totalMins > 495) {
      return (
        <span className="w-2.5 h-2.5 rounded-full bg-[#dc3545] shrink-0 shadow-[0_0_6px_#dc3545] animate-pulse" title="Geç Giriş İhlali (> 08:15)"></span>
      );
    }
    else if (totalMins >= 491 && totalMins <= 495) {
      return (
        <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] shrink-0 shadow-[0_0_6px_#f97316] animate-pulse" title="Tolerans Sınırında (08:11 - 08:15)"></span>
      );
    }
    return (
      <span className="w-2.5 h-2.5 rounded-full bg-[#0b9c2d] shrink-0 shadow-[0_0_6px_#0b9c2d]" title="Zamanında Giriş"></span>
    );
  };

  const getLateBadge = (lateCount: number) => {
    if (lateCount === 0) {
      return (
        <div className="flex justify-center">
          <span className="text-slate-300 font-black text-[12px] opacity-70">-</span>
        </div>
      );
    }

    // Default: < 3 (Soft Yeşil)
    let badgeStyles = "bg-emerald-50 text-emerald-700 border-emerald-200";

    if (lateCount === 3) {
      // Orta Uyarı: == 3 (Soft Kehribar/Turuncu)
      badgeStyles = "bg-amber-50 text-amber-700 border-amber-300";
    } else if (lateCount > 3) {
      // Kritik: > 3 (Marka Kırmızısı)
      badgeStyles = "bg-[#fef2f2] text-[#dc3545] border-red-200";
    }

    return (
      <div className="flex justify-center">
        <span 
          className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-[5px] border text-[11px] font-black tabular-nums shadow-[0_1px_2px_rgba(0,0,0,0.04)] tracking-tighter ${badgeStyles}`}
        >
          {lateCount}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 w-full shadow-sm rounded-md overflow-hidden">
      {/* ENDÜSTRİYEL DARK HEADING & LEJANT */}
      <div className="bg-[#0F172B] px-5 py-5 flex justify-between items-center border-b-4 border-[#dc3545]">
        <div className="flex flex-col justify-center">
          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
            CANLI İZLEME MODÜLÜ
          </span>
          <span className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wide">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#dc3545] animate-pulse shadow-sm"></span>
            GÜNLÜK MESAİ HAREKETLERİ
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-3 bg-[#1E293B] border border-slate-700 px-3 py-1 rounded-sm shadow-inner text-[9px] font-bold uppercase tracking-wider text-slate-300">
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
                <span className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
              </span>
            ) : (
              <span className="text-sm font-black text-white font-mono tabular-nums">{records.length}</span>
            )}
          </div>

          <div className="bg-[#1E293B] px-3 py-1 border border-slate-700 rounded-sm shadow-inner min-w-[60px] flex flex-col justify-center">
            <button
              onClick={() => fetchRecords(true)}
              disabled={loading || isRefreshing}
              className="bg-[#1E293B] hover:bg-[#dc3545] border border-slate-700 hover:border-[#dc3545] transition-all duration-200 h-[38px] px-3 rounded-sm shadow-inner flex items-center justify-center text-white hover:text-white disabled:opacity-50 disabled:bg-[#1E293B] disabled:border-slate-700 disabled:text-slate-500 group"
              title="Tabloyu Yenile"
            >
              <RefreshCw className={`w-4 h-4 transition-transform duration-500 group-hover:rotate-180 ${isRefreshing ? "animate-spin text-white" : ""}`} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* TABLO ALANI */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-5 py-4">Personel Bilgisi</th>
              <th className="px-3 py-4 text-center w-[120px]">Giriş Saati</th>
              <th className="px-3 py-4 text-center w-[120px]">Çıkış Saati</th>
              <th className="px-3 py-4 text-center text-amber-600 w-[100px]">
                <div className="flex items-center justify-center gap-1"><Coffee className="w-3 h-3" /> Mola</div>
              </th>
              <th className="px-3 py-4 text-center text-slate-500 w-[100px]">
                <div className="flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Günlük Net</div>
              </th>
              {/* SÜTUN: İhlal (Ay) */}
              <th className="px-3 py-4 text-center text-slate-500 w-[110px]">
                <div className="flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> İhlal</div>
              </th>
              <th className="px-3 py-4 text-center text-[#0F172B] bg-slate-100 border-l border-slate-200 w-[120px]">
                <div className="flex items-center justify-center gap-1"><CalendarDays className="w-3 h-3" />  Toplam</div>
              </th>
              <th className="px-5 py-4 text-right w-[140px]">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && sortedRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center bg-slate-50">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-t-transparent border-[#dc3545] rounded-full animate-spin"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kayıtlar Hesaplanıyor...</span>
                  </div>
                </td>
              </tr>
            ) : sortedRecords && sortedRecords.length > 0 ? (
              sortedRecords.map((record: any) => {
                const isManager = checkIsManager(record.employees?.position_title);
                const employeeId = record.employee_id;
                const monthlyTotal = monthlyTotals[employeeId] || 0;
                const monthlyLate = monthlyLates[employeeId] || 0;

                const isLeave = record.status && record.status.startsWith('LEAVE_');
                const leaveText = isLeave ? record.status.replace('LEAVE_', '').replace(/_/g, ' ') : '';

                return (
                  <tr key={record.id} className={`transition-colors duration-150 group ${isLeave ? 'bg-blue-50/20 hover:bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                    {/* Personel Sütunu */}
                    <td className="px-5 py-2 font-bold text-slate-800 flex items-center gap-3 min-w-[200px]">
                      {isManager ? (
                        <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-red-800 text-amber-50 border border-amber-50 shrink-0">
                          <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-primary text-white border border-amber-50 shrink-0">
                          <User className="w-4 h-4" strokeWidth={2.5} />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wide truncate max-w-[130px] sm:max-w-[180px]">{record.employees?.full_name || "BİLİNMEYEN"}</span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider">{record.employees?.position_title || "PERSONEL"}</span>
                      </div>
                    </td>

                    {/* DİNAMİK ORTA SÜTUNLAR (Mesai vs İzin) */}
                    {isLeave ? (
                      <td colSpan={5} className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center gap-2 w-full max-w-[300px] px-4 py-1.5 rounded-sm border text-[10px] font-black uppercase tracking-widest shadow-sm ${
                          leaveText === 'SAGLIK RAPORU' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {leaveText === 'SAGLIK RAPORU' ? 'SAĞLIK RAPORU' : `${leaveText}`}
                        </span>
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-center font-black text-slate-700 tabular-nums">
                          <div className="flex items-center justify-center gap-2.5">
                            {getEntryStatusDot(record.check_in_time)}
                            <span className="min-w-[36px] text-left">{formatTime(record.check_in_time)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-slate-500 tabular-nums">{formatTime(record.check_out_time)}</td>
                        <td className="px-3 py-2 text-center font-bold text-amber-600 tabular-nums">{record.break_hours ? `${Number(record.break_hours)} Saat` : "0 Saat"}</td>
                        <td className="px-3 py-2 text-center font-bold text-slate-700 tabular-nums text-[13px]">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-sm">{record.working_hours ? formatHours(record.working_hours) : "--"}</span>
                        </td>
                        {/* ANİMASYONSUZ, MİNİMAL İHLAL ROZETİ */}
                        <td className="px-3 py-2 text-center">
                          {getLateBadge(monthlyLate)}
                        </td>
                      </>
                    )}

                    {/* Bu Ay Toplam */}
                    <td className="px-3 py-2 text-center font-black text-[#0F172B] bg-slate-100 border-l border-slate-200 tabular-nums text-[13px]">
                      {monthlyTotal > 0 ? formatHours(monthlyTotal) : "0s"}
                    </td>

                    {/* Durum Rozeti */}
                    <td className="px-5 py-2 text-right">
                      {isLeave ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-blue-700 bg-blue-50 rounded-md border border-blue-200 text-[10px] font-black uppercase tracking-widest shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} /> Onaylandı
                        </span>
                      ) : !record.check_out_time ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-amber-700 rounded-md border border-gray-200 text-[10px] font-black uppercase tracking-widest shadow-sm">
                          <Clock className="w-3.5 h-3.5 text-amber-600" strokeWidth={3} /> İÇERİDE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-emerald-700 rounded-md border border-gray-200 text-[10px] font-black uppercase tracking-widest shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} /> TAMAMLANDI
                        </span>
                      )} 
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    BUGÜN İÇİN HENÜZ MESAİ HAREKETİ BULUNMUYOR
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}