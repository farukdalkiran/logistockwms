"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  BarChart3,
  Activity,
  Search,
  ShieldCheck,
  Download,
  Table2,
  Clock,
  CheckCircle2,
  User,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type ProfileData = {
  id: string;
  full_name: string;
  branch_id: string;
  role: string;
  branch_name?: string;
};

export default function HRReportsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isGlobal, setIsGlobal] = useState(false);

  // Tab & Arama State'leri
  const [activeTab, setActiveTab] = useState<"MONTHLY" | "DAILY">("MONTHLY");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth(),
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Kişi Bazlı 30 Günlük Döküm Filtresi
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>("ALL");

  // Veri State'leri
  const [monthlyEmployees, setMonthlyEmployees] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [rawRecordsForExcel, setRawRecordsForExcel] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // KPI (Puantaj Kartları) State'i
  const [kpi, setKpi] = useState({
    totalHours: 0,
    totalLeaves: 0,
    employeeCount: 0,
  });

  const months = [
    "OCAK",
    "ŞUBAT",
    "MART",
    "NİSAN",
    "MAYIS",
    "HAZİRAN",
    "TEMMUZ",
    "AĞUSTOS",
    "EYLÜL",
    "EKİM",
    "KASIM",
    "ARALIK",
  ];

  // 1. OTOMATİK OTURUM VE ŞUBE TESPİTİ
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Oturum bulunamadı!");

        const { data: prof, error } = await supabase
          .from("profiles")
          .select("id, full_name, branch_id, role, branches(name)")
          .eq("id", user.id)
          .single();

        if (error || !prof) throw new Error("Profil bilgisi alınamadı.");

        const _isGlobal =
          prof.role === "Developer" || prof.role === "Admin" || !prof.branch_id;
        setIsGlobal(_isGlobal);

        // TS Hatasını Çözen Kısım: Supabase veri tipini dizi veya obje olarak güvenli okuma
        const branchData = prof.branches as unknown as
          | { name: string }
          | { name: string }[];
        const branchName = Array.isArray(branchData)
          ? branchData[0]?.name
          : branchData?.name || "Merkez / Tüm Şubeler";

        setProfile({
          id: prof.id,
          full_name: prof.full_name || "Yetkili",
          branch_id: prof.branch_id,
          role: prof.role,
          branch_name: branchName,
        });
      } catch (err: any) {
        toast.error("Yetki doğrulaması başarısız: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, []);

  // 2. VERİ LİSTELEME MOTORU
  const fetchReportData = async () => {
    if (!profile) return;

    setIsFetching(true);
    setMonthlyEmployees([]);
    setDailyData([]);
    setRawRecordsForExcel([]);
    setSelectedEmpFilter("ALL"); // Sorgu atılınca filtreyi sıfırla
    setKpi({ totalHours: 0, totalLeaves: 0, employeeCount: 0 });

    try {
      let query = supabase.from("attendance").select(`
        *, 
        employees!attendance_employee_id_fkey ( id, full_name, position_title )
      `);

      if (!isGlobal && profile.branch_id) {
        query = query.eq("branch_id", profile.branch_id);
      }

      // MOD 1: AYLIK KİŞİ BAZLI LİSTELEME
      if (activeTab === "MONTHLY") {
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(
          selectedYear,
          selectedMonth + 1,
          0,
          23,
          59,
          59,
        );

        query = query
          .gte("check_in_time", startDate.toISOString())
          .lte("check_in_time", endDate.toISOString())
          .order("check_in_time", { ascending: true });

        const { data: records, error } = await query;
        if (error) throw error;

        if (!records || records.length === 0) {
          toast.info("Bu döneme ait puantaj kaydı bulunamadı.");
          setIsFetching(false);
          return;
        }

        setRawRecordsForExcel(records);

        const empMap: { [key: string]: any } = {};
        let tHours = 0;
        let tLeaves = 0;

        records.forEach((rec) => {
          const empId = rec.employees.id;
          if (!empMap[empId]) {
            empMap[empId] = {
              id: empId,
              name: rec.employees.full_name,
              title: rec.employees.position_title,
              totalHours: 0,
              leaveDays: 0,
              reportDays: 0,
              days: [],
            };
          }

          if (rec.status.startsWith("LEAVE_")) {
            if (rec.status.includes("RAPOR")) empMap[empId].reportDays++;
            else empMap[empId].leaveDays++;
            tLeaves++;
          }

          const workH = rec.working_hours || 0;
          empMap[empId].totalHours += workH;
          tHours += workH;

          empMap[empId].days.push(rec);
        });

        const empList = Object.values(empMap);
        setMonthlyEmployees(empList);
        setKpi({
          totalHours: parseFloat(tHours.toFixed(2)),
          totalLeaves: tLeaves,
          employeeCount: empList.length,
        });

        toast.success(
          `Başarılı: ${empList.length} personel kümülatif olarak listelendi.`,
        );
      }
      // MOD 2: GÜNLÜK TÜM ŞUBE LİSTELEME
      else {
        const dStart = new Date(selectedDate);
        dStart.setHours(0, 0, 0, 0);
        const dEnd = new Date(selectedDate);
        dEnd.setHours(23, 59, 59, 999);

        query = query
          .gte("check_in_time", dStart.toISOString())
          .lte("check_in_time", dEnd.toISOString())
          .order("check_in_time", { ascending: false });

        const { data: records, error } = await query;
        if (error) throw error;

        if (!records || records.length === 0) {
          toast.info("Seçili güne ait hareket yok.");
        } else {
          setDailyData(records);
          toast.success(
            `Günlük hareketler listelendi (${records.length} Kayıt).`,
          );
        }
      }
    } catch (err: any) {
      toast.error("Sorgu Hatası: " + err.message);
    } finally {
      setIsFetching(false);
    }
  };

  // 3. EXCEL ÇIKTI MOTORU (Her Kişi Ayrı Sheet, IST-DEPO Şartı ve Tablo Kenarlıkları)
  const generateExcelReport = () => {
    if (!profile || rawRecordsForExcel.length === 0) {
      toast.error("İndirilecek veri yok! Lütfen önce listeleme yapın.");
      return;
    }

    try {
      const rawBranchName = profile.branch_name || "Merkez Depo";
      const displayBranchName =
        rawBranchName.toUpperCase() === "IST-DEPO"
          ? "Online Depo"
          : rawBranchName;

      const empMap: { [key: string]: { full_name: string; records: any[] } } =
        {};
      rawRecordsForExcel.forEach((record: any) => {
        const empId = record.employees.id;
        if (!empMap[empId])
          empMap[empId] = {
            full_name: record.employees.full_name,
            records: [],
          };
        empMap[empId].records.push(record);
      });

      const wb = XLSX.utils.book_new();

      // --- WMS ENDÜSTRİYEL EXCEL STİLLERİ ---
      const borderStyle = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      };

      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0F172A" } }, // WMS Lacivert Arka Plan
        border: borderStyle,
        alignment: { horizontal: "center", vertical: "center" },
      };

      const cellStyle = {
        border: borderStyle,
        alignment: { horizontal: "center", vertical: "center" },
      };

      const titleStyle = {
        font: { bold: true, sz: 14, color: { rgb: "DC3545" } },
      };
      const boldStyle = { font: { bold: true } };
      // ------------------------------------

      Object.keys(empMap).forEach((empId) => {
        const empData = empMap[empId];
        let totalWorkHours = 0;
        let totalLeaves = 0;
        let totalReports = 0;

        const sheetData: any[] = [];

        sheetData.push(["PEERAJ BRANDS MESAİ & PUANTAJ FORMU"]);
        sheetData.push([
          "Personel:",
          empData.full_name,
          "Dönem:",
          `${months[selectedMonth]} ${selectedYear}`,
        ]);
        sheetData.push([
          "Şube:",
          displayBranchName,
          "Oluşturulma:",
          new Date().toLocaleDateString("tr-TR"),
        ]);
        sheetData.push([]);

        // Tablo Başlıkları (Satır 5)
        sheetData.push([
          "Tarih",
          "Giriş Saati",
          "Çıkış Saati",
          "Net Çalışma (Saat)",
          "Mola (Saat)",
          "Durum / Açıklama",
        ]);

        empData.records.forEach((rec) => {
          const dIn = new Date(rec.check_in_time);
          const dOut = rec.check_out_time ? new Date(rec.check_out_time) : null;

          const dateStr = dIn.toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          const timeIn = dIn.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const timeOut = dOut
            ? dOut.toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";

          let statusStr = "Normal Mesai";
          if (rec.status.startsWith("LEAVE_")) {
            statusStr = rec.status.replace("LEAVE_", "").replace(/_/g, " ");
            if (statusStr.includes("RAPOR")) totalReports++;
            else totalLeaves++;
          } else if (rec.status.includes("MANUAL")) {
            statusStr = "Düzeltilmiş Mesai";
          }

          const workH = rec.working_hours || 0;
          totalWorkHours += workH;

          sheetData.push([
            dateStr,
            statusStr.includes("İZİN") || statusStr.includes("RAPOR")
              ? "-"
              : timeIn,
            statusStr.includes("İZİN") || statusStr.includes("RAPOR")
              ? "-"
              : timeOut,
            workH,
            rec.break_hours || 0,
            statusStr,
          ]);
        });

        sheetData.push([]);
        sheetData.push(["AYLIK TOPLAM İSTATİSTİKLER"]);
        sheetData.push([
          "Toplam Net Çalışma (Saat):",
          totalWorkHours.toFixed(2),
        ]);
        sheetData.push(["Kullanılan İzin (Gün):", totalLeaves]);
        sheetData.push(["Kullanılan Rapor (Gün):", totalReports]);

        const safeSheetName = empData.full_name
          .substring(0, 31)
          .replace(/[\\/?*\[\]]/g, "");
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 20 },
          { wch: 15 },
          { wch: 30 },
        ];

        // --- EXCEL HÜCRE STİLLERİNİ UYGULAMA BÖLÜMÜ ---
        for (const key in ws) {
          if (key.startsWith("!")) continue; // Meta dataları geç

          const cell = ws[key];
          const col = key.replace(/[0-9]/g, "");
          const row = parseInt(key.replace(/\D/g, ""));

          // Ana Başlık
          if (row === 1 && col === "A") cell.s = titleStyle;

          // Alt Başlıklar (Kalın)
          if (row === 2 || row === 3) {
            if (col === "A" || col === "C") cell.s = boldStyle;
          }

          // Tablo Başlıkları
          if (row === 5) cell.s = headerStyle;

          // Tablo İçerik Hücreleri (Kenarlıklı)
          if (row > 5 && row <= 5 + empData.records.length) {
            cell.s = cellStyle;
          }

          // Alt İstatistik Alanı (Kalın)
          if (row >= 5 + empData.records.length + 2) {
            if (col === "A") cell.s = boldStyle;
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

      const fileName = `Peeraj_${displayBranchName.replace(/ /g, "_")}_${months[selectedMonth]}_${selectedYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Excel formu başarıyla indirildi.");
    } catch (err: any) {
      toast.error("Excel Hatası: " + err.message);
    }
  };

  const formatTime = (iso: string) =>
    iso
      ? new Date(iso).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";
  const formatDateStr = (iso: string) =>
    iso
      ? new Date(iso).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "-";

  if (loading) {
    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center bg-white">
        <Activity className="w-8 h-8 text-[#dc3545] animate-pulse mb-3" />
        <span className="text-sm font-bold tracking-widest uppercase">
          Veriler Yükleniyor...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 font-['Quicksand']">
      <ToastContainer
        position="bottom-right"
        theme="dark"
        hideProgressBar
        autoClose={3000}
        closeButton={false}
        toastClassName="rounded-none border border-slate-700 text-sm font-bold tracking-wider"
      />

      {/* HEADER */}
      <header className="bg-[#0F172A] border-b-[3px] border-[#dc3545]">
        <div className="w-full px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#dc3545] flex items-center justify-center rounded-[4px]">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest">
                  HR Rapor Merkezi
                </h1>

                {isGlobal && (
                  <span className="text-[9px] font-black uppercase tracking-wider text-red-200 bg-red-500/15 border border-red-500/30 px-2 py-1 rounded-[3px]">
                    Global Auth
                  </span>
                )}
              </div>

              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Puantaj, Mesai ve Personel Raporları
              </p>
            </div>
          </div>

          {profile && (
            <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700 px-3 sm:px-4 py-2 rounded-[4px]">
              <div className="w-8 h-8 bg-slate-700 flex items-center justify-center rounded-[3px]">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>

              <div>
                <span className="block text-[9px] text-amber-400 font-black uppercase tracking-widest">
                  {profile.role || "Yönetici"}
                </span>
                <span className="block text-xs text-white font-black uppercase tracking-wide mt-0.5">
                  {profile.branch_name?.toUpperCase() === "IST-DEPO"
                    ? "ONLINE DEPO"
                    : profile.branch_name}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="w-full max-w-[1600px] mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {/* KOMPAKT BİLGİ BANNER */}
        <section className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
            <div className="p-4 sm:p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-[3px] bg-[#dc3545]" />
                <span className="text-[10px] font-black text-[#dc3545] uppercase tracking-[0.18em]">
                  Raporlama ve Veri Merkezi
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide text-slate-900">
                Personel Puantaj ve Mesai Analizi
              </h2>

              <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-500 leading-6 max-w-3xl">
                Personellerin çalışma sürelerini, izin ve rapor kayıtlarını,
                günlük giriş-çıkış hareketlerini tek merkezden inceleyin. Aylık
                raporlarınızı Excel formatında dışa aktarın.
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-[3px]">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Aylık Puantaj
                </span>

                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1.5 rounded-[3px]">
                  <Clock className="w-3.5 h-3.5" />
                  Günlük Hareketler
                </span>

                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-[3px]">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel Raporlama
                </span>
              </div>
            </div>

            {/* SAĞ BİLGİ GÖRSELİ */}
            <div className="hidden lg:flex relative bg-[#0F172A] overflow-hidden items-center justify-center border-l border-slate-200">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:18px_18px]" />
              <div className="absolute w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />

              <div className="relative flex flex-col items-center gap-3">
                <div className="relative">
                  <FileSpreadsheet
                    className="w-20 h-20 text-slate-300"
                    strokeWidth={1.2}
                  />
                  <div className="absolute -bottom-1 -right-3 bg-[#dc3545] p-2 rounded-[4px]">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                </div>

                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  HR Analytics System
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* BİRLEŞİK FİLTRE MERKEZİ */}
        <section className="bg-white border border-slate-200 rounded-[4px] shadow-sm overflow-hidden">
          {/* TAB SEÇİMİ */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div
              className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-[4px] w-full sm:w-fit"
              role="tablist"
              aria-label="Rapor türü"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "MONTHLY"}
                onClick={() => {
                  setActiveTab("MONTHLY");
                  setMonthlyEmployees([]);
                  setRawRecordsForExcel([]);
                  setKpi({
                    totalHours: 0,
                    totalLeaves: 0,
                    employeeCount: 0,
                  });
                  setSelectedEmpFilter("ALL");
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-3 sm:px-5 text-[10px] sm:text-xs font-black uppercase tracking-wide rounded-[3px] border transition-all ${
                  activeTab === "MONTHLY"
                    ? "bg-[#dc3545] text-white border-[#dc3545] shadow-sm"
                    : "bg-transparent border-transparent text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <CalendarDays className="w-4 h-4 shrink-0" />
                Aylık Puantaj
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "DAILY"}
                onClick={() => {
                  setActiveTab("DAILY");
                  setDailyData([]);
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-3 sm:px-5 text-[10px] sm:text-xs font-black uppercase tracking-wide rounded-[3px] border transition-all ${
                  activeTab === "DAILY"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-transparent border-transparent text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                Günlük Hareketler
              </button>
            </div>

            <span className="hidden lg:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Filter className="w-4 h-4" />
              Raporlama Filtreleri
            </span>
          </div>

          {/* TÜM FİLTRELER AYNI ALANDA */}
          <div className="p-3 sm:p-4">
            <div className="flex flex-col xl:flex-row xl:items-end gap-3">
              {/* TARİH FİLTRESİ */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {activeTab === "MONTHLY" ? "Rapor Dönemi" : "Hareket Tarihi"}
                </label>

                {activeTab === "MONTHLY" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_110px] sm:flex gap-2">
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />

                      <select
                        aria-label="Rapor ayı"
                        value={selectedMonth}
                        onChange={(e) =>
                          setSelectedMonth(Number(e.target.value))
                        }
                        className="w-full sm:w-40 h-11 pl-9 pr-3 bg-red-50/50 border border-red-200 rounded-[4px] text-xs font-black text-slate-800 outline-none focus:border-[#dc3545] focus:ring-2 focus:ring-red-100 cursor-pointer"
                      >
                        {months.map((m, i) => (
                          <option key={i} value={i}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <select
                      aria-label="Rapor yılı"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="h-11 w-full sm:w-28 px-3 bg-white border border-slate-300 rounded-[4px] text-xs font-black text-slate-800 outline-none focus:border-[#dc3545] focus:ring-2 focus:ring-red-100 cursor-pointer"
                    >
                      {[selectedYear - 1, selectedYear, selectedYear + 1].map(
                        (y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />

                    <input
                      type="date"
                      aria-label="Hareket tarihi"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full sm:w-52 h-11 pl-9 pr-3 bg-blue-50/50 border border-blue-200 rounded-[4px] text-xs font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* PERSONEL FİLTRESİ */}
              {activeTab === "MONTHLY" && monthlyEmployees.length > 0 && (
                <div className="flex flex-col gap-1.5 flex-1 xl:max-w-sm">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Personel Filtresi
                  </label>

                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500 pointer-events-none" />

                    <select
                      value={selectedEmpFilter}
                      onChange={(e) => setSelectedEmpFilter(e.target.value)}
                      className="w-full h-11 pl-9 pr-3 bg-violet-50/50 border border-violet-200 rounded-[4px] text-xs font-black text-slate-800 uppercase outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 cursor-pointer"
                    >
                      <option value="ALL">TÜM PERSONELLER</option>

                      {monthlyEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* BUTONLAR */}
              <div className="flex flex-col sm:flex-row gap-2 xl:ml-auto">
                <button
                  type="button"
                  onClick={fetchReportData}
                  disabled={isFetching}
                  className={`h-11 px-5 flex items-center justify-center gap-2 rounded-[4px] text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
                    activeTab === "MONTHLY"
                      ? "bg-[#dc3545] hover:bg-red-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isFetching ? (
                    <Activity className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}

                  {isFetching ? "SORGULANIYOR..." : "RAPORU SORGULA"}
                </button>

                {activeTab === "MONTHLY" && monthlyEmployees.length > 0 && (
                  <button
                    type="button"
                    onClick={generateExcelReport}
                    className="h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[4px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    EXCEL İNDİR
                  </button>
                )}
              </div>
            </div>

            {/* AKTİF FİLTRE BİLGİSİ */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                SEÇİLİ RAPOR:
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide rounded-[3px] border ${
                  activeTab === "MONTHLY"
                    ? "bg-red-50 text-red-700 border-red-100"
                    : "bg-blue-50 text-blue-700 border-blue-100"
                }`}
              >
                {activeTab === "MONTHLY"
                  ? `${months[selectedMonth]} ${selectedYear}`
                  : selectedDate.split("-").reverse().join(".")}
              </span>

              <span className="text-[9px] font-bold text-slate-400">
                {activeTab === "MONTHLY"
                  ? "Personel bazlı aylık çalışma ve izin dökümü"
                  : "Seçili günün tüm giriş-çıkış hareketleri"}
              </span>
            </div>
          </div>
        </section>

        {/* KPI KARTLARI */}
        {activeTab === "MONTHLY" && monthlyEmployees.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* TOPLAM MESAİ */}
            <div className="bg-white border border-slate-200 border-l-[4px] border-l-blue-500 rounded-[4px] p-4 flex items-center justify-between gap-3 shadow-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Toplam Net Mesai
                </p>
                <p className="mt-2 text-2xl font-black text-blue-600 font-mono">
                  {kpi.totalHours.toLocaleString("tr-TR")}
                  <span className="text-xs font-black text-slate-400 ml-2">
                    SAAT
                  </span>
                </p>
              </div>

              <div className="w-11 h-11 bg-blue-50 flex items-center justify-center rounded-[4px]">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>

            {/* İZİN */}
            <div className="bg-white border border-slate-200 border-l-[4px] border-l-amber-500 rounded-[4px] p-4 flex items-center justify-between gap-3 shadow-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  İzin / Rapor Kayıtları
                </p>
                <p className="mt-2 text-2xl font-black text-amber-600 font-mono">
                  {kpi.totalLeaves.toLocaleString("tr-TR")}
                  <span className="text-xs font-black text-slate-400 ml-2">
                    GÜN
                  </span>
                </p>
              </div>

              <div className="w-11 h-11 bg-amber-50 flex items-center justify-center rounded-[4px]">
                <CalendarDays className="w-5 h-5 text-amber-600" />
              </div>
            </div>

            {/* PERSONEL */}
            <div className="bg-white border border-slate-200 border-l-[4px] border-l-emerald-500 rounded-[4px] p-4 flex items-center justify-between gap-3 shadow-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Kayıtlı Personel
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-600 font-mono">
                  {kpi.employeeCount.toLocaleString("tr-TR")}
                  <span className="text-xs font-black text-slate-400 ml-2">
                    KİŞİ
                  </span>
                </p>
              </div>

              <div className="w-11 h-11 bg-emerald-50 flex items-center justify-center rounded-[4px]">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </section>
        )}

        {/* RAPOR TABLO ALANI */}
        <section className="bg-white border border-slate-200 rounded-[4px] shadow-sm overflow-hidden flex-1">
          {/* TABLO ÜST BAŞLIK */}
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 flex items-center justify-center rounded-[4px] ${
                  activeTab === "MONTHLY" ? "bg-red-50" : "bg-blue-50"
                }`}
              >
                <Table2
                  className={`w-5 h-5 ${
                    activeTab === "MONTHLY" ? "text-[#dc3545]" : "text-blue-600"
                  }`}
                />
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  {activeTab === "MONTHLY"
                    ? selectedEmpFilter === "ALL"
                      ? "Aylık Personel Özeti"
                      : "Personel Mesai Detayı"
                    : "Günlük Hareket Listesi"}
                </h3>

                <p className="text-[10px] font-semibold text-slate-400 mt-1">
                  {activeTab === "MONTHLY"
                    ? `${months[selectedMonth]} ${selectedYear} dönemi`
                    : `${selectedDate.split("-").reverse().join(".")} tarihli kayıtlar`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === "MONTHLY" && selectedEmpFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setSelectedEmpFilter("ALL")}
                  className="text-[10px] font-black uppercase tracking-wide text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 border border-violet-200 rounded-[4px] transition-colors"
                >
                  Tüm Personeller
                </button>
              )}

              <span
                className={`px-3 py-2 border rounded-[3px] text-[10px] font-black uppercase tracking-wide ${
                  activeTab === "MONTHLY"
                    ? "bg-red-50 text-red-600 border-red-100"
                    : "bg-blue-50 text-blue-600 border-blue-100"
                }`}
              >
                {activeTab === "MONTHLY"
                  ? `${monthlyEmployees.length} PERSONEL`
                  : `${dailyData.length} KAYIT`}
              </span>
            </div>
          </div>

          {/* AYLIK RAPOR */}
          {activeTab === "MONTHLY" && (
            <>
              {monthlyEmployees.length === 0 ? (
                <div className="min-h-[260px] p-8 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  <div className="w-14 h-14 bg-red-50 border border-red-100 flex items-center justify-center rounded-[4px] mb-4">
                    <CalendarDays className="w-7 h-7 text-[#dc3545]" />
                  </div>

                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Aylık Puantaj Raporu
                  </h4>

                  <p className="mt-2 text-xs font-semibold text-slate-400 max-w-sm leading-6">
                    Seçtiğiniz aya ait personel çalışma sürelerini ve izin
                    kayıtlarını görüntülemek için raporu sorgulayın. Kayıt
                    bulunmayan dönemlerde liste boş kalır.
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  {/* TÜM PERSONELLER */}
                  {selectedEmpFilter === "ALL" && (
                    <table className="w-full min-w-[760px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Personel Bilgisi
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">
                            Net Çalışma
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                            İzin / Rapor
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                            Kayıt Durumu
                          </th>

                          <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">
                            Detay
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {monthlyEmployees.map((emp) => (
                          <tr
                            key={emp.id}
                            className="hover:bg-blue-50/40 transition-colors"
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center rounded-[3px]">
                                  <User className="w-4 h-4 text-slate-500" />
                                </div>

                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                    {emp.name}
                                  </span>

                                  <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                    {emp.title || "Personel"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <span className="text-sm font-black text-blue-700 font-mono">
                                {emp.totalHours.toFixed(2)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 ml-1">
                                SAAT
                              </span>
                            </td>

                            <td className="px-5 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {emp.leaveDays > 0 && (
                                  <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 text-[10px] font-black rounded-[3px] whitespace-nowrap">
                                    İZİN: {emp.leaveDays}
                                  </span>
                                )}

                                {emp.reportDays > 0 && (
                                  <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 text-[10px] font-black rounded-[3px] whitespace-nowrap">
                                    RAPOR: {emp.reportDays}
                                  </span>
                                )}

                                {emp.leaveDays === 0 &&
                                  emp.reportDays === 0 && (
                                    <span className="text-slate-300 font-black">
                                      -
                                    </span>
                                  )}
                              </div>
                            </td>

                            <td className="px-5 py-3 text-center">
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-wide rounded-[3px]">
                                <CheckCircle2 className="w-3 h-3" />
                                KAYIT VAR
                              </span>
                            </td>

                            <td className="px-5 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedEmpFilter(emp.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide rounded-[4px] transition-colors whitespace-nowrap"
                              >
                                <Search className="w-3.5 h-3.5" />
                                İncele
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* TEK PERSONEL DETAYI */}
                  {selectedEmpFilter !== "ALL" && (
                    <>
                      {monthlyEmployees
                        .filter((emp) => emp.id === selectedEmpFilter)
                        .map((emp) => (
                          <div
                            key={emp.id}
                            className="bg-violet-50 border-b border-violet-100 px-5 py-3 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-violet-600 text-white flex items-center justify-center rounded-[4px]">
                                <User className="w-4 h-4" />
                              </div>

                              <div>
                                <span className="block text-xs font-black text-slate-900 uppercase">
                                  {emp.name}
                                </span>

                                <span className="text-[10px] font-bold text-violet-600 uppercase">
                                  {emp.title || "Personel"}
                                </span>
                              </div>
                            </div>

                            <span className="text-[10px] font-black text-violet-700 bg-white border border-violet-200 px-3 py-2 rounded-[3px]">
                              TOPLAM: {emp.totalHours.toFixed(2)} SAAT
                            </span>
                          </div>
                        ))}

                      <table className="w-full min-w-[730px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-slate-200">
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider">
                              Tarih
                            </th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider">
                              Giriş
                            </th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider">
                              Çıkış
                            </th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-right">
                              Net Mesai
                            </th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider">
                              Sistem Durumu
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {monthlyEmployees
                            .find((e) => e.id === selectedEmpFilter)
                            ?.days.map((day: any) => {
                              const isLeave = day.status.startsWith("LEAVE_");

                              const isManual =
                                !isLeave && day.status.includes("MANUAL");

                              return (
                                <tr
                                  key={day.id}
                                  className="hover:bg-slate-50 transition-colors"
                                >
                                  <td className="px-5 py-3 text-xs font-black text-slate-800 whitespace-nowrap">
                                    {formatDateStr(day.check_in_time)}
                                  </td>

                                  <td className="px-5 py-3 text-xs font-bold text-emerald-700 font-mono">
                                    {isLeave
                                      ? "-"
                                      : formatTime(day.check_in_time)}
                                  </td>

                                  <td className="px-5 py-3 text-xs font-bold text-red-600 font-mono">
                                    {isLeave
                                      ? "-"
                                      : formatTime(day.check_out_time)}
                                  </td>

                                  <td className="px-5 py-3 text-right whitespace-nowrap">
                                    <span className="text-sm font-black text-slate-800 font-mono">
                                      {day.working_hours || 0}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 ml-1">
                                      SAAT
                                    </span>
                                  </td>

                                  <td className="px-5 py-3">
                                    <span
                                      className={`inline-flex px-2.5 py-1 text-[10px] font-black uppercase tracking-wide border rounded-[3px] ${
                                        isLeave
                                          ? "bg-blue-50 text-blue-700 border-blue-100"
                                          : isManual
                                            ? "bg-amber-50 text-amber-700 border-amber-100"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                      }`}
                                    >
                                      {isLeave
                                        ? day.status
                                            .replace("LEAVE_", "")
                                            .replace(/_/g, " ")
                                        : isManual
                                          ? "DÜZELTME"
                                          : "NORMAL MESAİ"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* GÜNLÜK RAPOR */}
          {activeTab === "DAILY" && (
            <>
              {dailyData.length === 0 ? (
                <div className="min-h-[260px] p-8 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  <div className="w-14 h-14 bg-blue-50 border border-blue-100 flex items-center justify-center rounded-[4px] mb-4">
                    <Clock className="w-7 h-7 text-blue-600" />
                  </div>

                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Günlük Hareket Raporu
                  </h4>

                  <p className="mt-2 text-xs font-semibold text-slate-400 max-w-sm leading-6">
                    Yukarıdaki tarih alanından gün seçerek personellerin giriş,
                    çıkış, net çalışma ve mola bilgilerini listeleyebilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Personel Bilgisi
                        </th>

                        <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Giriş / Çıkış
                        </th>

                        <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Net Çalışma
                        </th>

                        <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Mola
                        </th>

                        <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Sistem Durumu
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {dailyData.map((rec, i) => {
                        const isLeave = rec.status.startsWith("LEAVE_");

                        const isManual =
                          !isLeave && rec.status.includes("MANUAL");

                        const statusStr = isLeave
                          ? rec.status.replace("LEAVE_", "").replace(/_/g, " ")
                          : isManual
                            ? "DÜZELTİLMİŞ"
                            : "NORMAL MESAİ";

                        return (
                          <tr
                            key={rec.id ?? i}
                            className="hover:bg-blue-50/40 transition-colors"
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 shrink-0 bg-blue-50 border border-blue-100 flex items-center justify-center rounded-[3px]">
                                  <User className="w-4 h-4 text-blue-600" />
                                </div>

                                <div className="flex flex-col">
                                  <span className="text-xs font-black uppercase text-slate-900 whitespace-nowrap">
                                    {rec.employees?.full_name ||
                                      "Bilinmeyen Personel"}
                                  </span>

                                  <span className="text-[10px] font-bold text-slate-400 mt-1">
                                    {rec.employees?.position_title ||
                                      "Personel"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-3">
                              {isLeave ? (
                                <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-[10px] font-black text-blue-700 rounded-[3px]">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  İZİN / RAPOR
                                </span>
                              ) : (
                                <div className="flex items-center gap-2 font-mono font-black text-xs whitespace-nowrap">
                                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1.5 rounded-[3px]">
                                    {formatTime(rec.check_in_time)}
                                  </span>

                                  <span className="text-slate-300">→</span>

                                  <span className="text-red-600 bg-red-50 border border-red-100 px-2 py-1.5 rounded-[3px]">
                                    {formatTime(rec.check_out_time)}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className="text-sm font-black text-slate-900 font-mono">
                                {rec.working_hours ?? 0}
                              </span>

                              <span className="text-[10px] font-bold text-slate-400 ml-1">
                                SAAT
                              </span>
                            </td>

                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className="text-xs font-black text-violet-700">
                                {rec.break_hours ?? 0}
                              </span>

                              <span className="text-[10px] font-bold text-slate-400 ml-1">
                                SAAT
                              </span>
                            </td>

                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex px-2.5 py-1.5 border rounded-[3px] text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${
                                  isLeave
                                    ? "bg-blue-50 text-blue-700 border-blue-100"
                                    : isManual
                                      ? "bg-amber-50 text-amber-700 border-amber-100"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                }`}
                              >
                                {statusStr}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 px-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Peeraj Brands / HR Raporlama Merkezi
            </span>
          </div>

          <span className="text-[10px] font-semibold text-slate-400">
            Puantaj ve Personel Hareket Kayıtları
          </span>
        </div>
      </div>
    </div>
  );
}
