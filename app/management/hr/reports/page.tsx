"use client";

import { useState, useEffect } from "react";
import { CalendarDays, ShieldAlert, Activity, Search, DownloadCloud,FileText ,ShieldCheck ,Download, Table2, Clock, CheckCircle2, User, FileSpreadsheet, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type ProfileData = { id: string; full_name: string; branch_id: string; role: string; branch_name?: string };

export default function HRReportsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isGlobal, setIsGlobal] = useState(false);

  // Tab & Arama State'leri
  const [activeTab, setActiveTab] = useState<"MONTHLY" | "DAILY">("MONTHLY");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); 
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Kişi Bazlı 30 Günlük Döküm Filtresi
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>("ALL");

  // Veri State'leri
  const [monthlyEmployees, setMonthlyEmployees] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [rawRecordsForExcel, setRawRecordsForExcel] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // KPI (Puantaj Kartları) State'i
  const [kpi, setKpi] = useState({ totalHours: 0, totalLeaves: 0, employeeCount: 0 });

  const months = [
    "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", 
    "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"
  ];

// 1. OTOMATİK OTURUM VE ŞUBE TESPİTİ
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Oturum bulunamadı!");

        const { data: prof, error } = await supabase
          .from("profiles")
          .select("id, full_name, branch_id, role, branches(name)")
          .eq("id", user.id)
          .single();

        if (error || !prof) throw new Error("Profil bilgisi alınamadı.");

        const _isGlobal = prof.role === "Developer" || prof.role === "Admin" || !prof.branch_id;
        setIsGlobal(_isGlobal);

        // TS Hatasını Çözen Kısım: Supabase veri tipini dizi veya obje olarak güvenli okuma
        const branchData = prof.branches as unknown as { name: string } | { name: string }[];
        const branchName = Array.isArray(branchData)
          ? branchData[0]?.name
          : branchData?.name || "Merkez / Tüm Şubeler";

        setProfile({
          id: prof.id,
          full_name: prof.full_name || "Yetkili",
          branch_id: prof.branch_id,
          role: prof.role,
          branch_name: branchName
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
    setMonthlyEmployees([]); setDailyData([]); setRawRecordsForExcel([]);
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
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
        
        query = query.gte("check_in_time", startDate.toISOString())
                     .lte("check_in_time", endDate.toISOString())
                     .order("check_in_time", { ascending: true });

        const { data: records, error } = await query;
        if (error) throw error;

        if (!records || records.length === 0) {
          toast.info("Bu döneme ait puantaj kaydı bulunamadı.");
          setIsFetching(false); return;
        }

        setRawRecordsForExcel(records);

        const empMap: { [key: string]: any } = {};
        let tHours = 0; let tLeaves = 0;

        records.forEach((rec) => {
          const empId = rec.employees.id;
          if (!empMap[empId]) {
            empMap[empId] = { 
              id: empId, name: rec.employees.full_name, title: rec.employees.position_title,
              totalHours: 0, leaveDays: 0, reportDays: 0, days: [] 
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
        setKpi({ totalHours: parseFloat(tHours.toFixed(2)), totalLeaves: tLeaves, employeeCount: empList.length });
        
        toast.success(`Başarılı: ${empList.length} personel kümülatif olarak listelendi.`);
      } 
      // MOD 2: GÜNLÜK TÜM ŞUBE LİSTELEME
      else {
        const dStart = new Date(selectedDate); dStart.setHours(0,0,0,0);
        const dEnd = new Date(selectedDate); dEnd.setHours(23,59,59,999);

        query = query.gte("check_in_time", dStart.toISOString())
                     .lte("check_in_time", dEnd.toISOString())
                     .order("check_in_time", { ascending: false });

        const { data: records, error } = await query;
        if (error) throw error;

        if (!records || records.length === 0) {
          toast.info("Seçili güne ait hareket yok.");
        } else {
          setDailyData(records);
          toast.success(`Günlük hareketler listelendi (${records.length} Kayıt).`);
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
      const displayBranchName = rawBranchName.toUpperCase() === "IST-DEPO" ? "Online Depo" : rawBranchName;

      const empMap: { [key: string]: { full_name: string; records: any[] } } = {};
      rawRecordsForExcel.forEach((record: any) => {
        const empId = record.employees.id;
        if (!empMap[empId]) empMap[empId] = { full_name: record.employees.full_name, records: [] };
        empMap[empId].records.push(record);
      });

      const wb = XLSX.utils.book_new();

      // --- WMS ENDÜSTRİYEL EXCEL STİLLERİ ---
      const borderStyle = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      };

      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0F172A" } }, // WMS Lacivert Arka Plan
        border: borderStyle,
        alignment: { horizontal: "center", vertical: "center" }
      };

      const cellStyle = {
        border: borderStyle,
        alignment: { horizontal: "center", vertical: "center" }
      };

      const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "DC3545" } } };
      const boldStyle = { font: { bold: true } };
      // ------------------------------------

      Object.keys(empMap).forEach((empId) => {
        const empData = empMap[empId];
        let totalWorkHours = 0;
        let totalLeaves = 0;
        let totalReports = 0;

        const sheetData: any[] = [];
        
        sheetData.push(["PEERAJ BRANDS MESAİ & PUANTAJ FORMU"]);
        sheetData.push(["Personel:", empData.full_name, "Dönem:", `${months[selectedMonth]} ${selectedYear}`]);
        sheetData.push(["Şube:", displayBranchName, "Oluşturulma:", new Date().toLocaleDateString("tr-TR")]);
        sheetData.push([]); 
        
        // Tablo Başlıkları (Satır 5)
        sheetData.push(["Tarih", "Giriş Saati", "Çıkış Saati", "Net Çalışma (Saat)", "Mola (Saat)", "Durum / Açıklama"]);

        empData.records.forEach((rec) => {
          const dIn = new Date(rec.check_in_time);
          const dOut = rec.check_out_time ? new Date(rec.check_out_time) : null;
          
          const dateStr = dIn.toLocaleDateString("tr-TR", { day: '2-digit', month: '2-digit', year: 'numeric' });
          const timeIn = dIn.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
          const timeOut = dOut ? dOut.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }) : "-";

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
            statusStr.includes("İZİN") || statusStr.includes("RAPOR") ? "-" : timeIn,
            statusStr.includes("İZİN") || statusStr.includes("RAPOR") ? "-" : timeOut,
            workH,
            rec.break_hours || 0,
            statusStr
          ]);
        });

        sheetData.push([]); 
        sheetData.push(["AYLIK TOPLAM İSTATİSTİKLER"]);
        sheetData.push(["Toplam Net Çalışma (Saat):", totalWorkHours.toFixed(2)]);
        sheetData.push(["Kullanılan İzin (Gün):", totalLeaves]);
        sheetData.push(["Kullanılan Rapor (Gün):", totalReports]);

        const safeSheetName = empData.full_name.substring(0, 31).replace(/[\\/?*\[\]]/g, '');
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }];

        // --- EXCEL HÜCRE STİLLERİNİ UYGULAMA BÖLÜMÜ ---
        for (const key in ws) {
          if (key.startsWith('!')) continue; // Meta dataları geç
          
          const cell = ws[key];
          const col = key.replace(/[0-9]/g, '');
          const row = parseInt(key.replace(/\D/g, ''));

          // Ana Başlık
          if (row === 1 && col === 'A') cell.s = titleStyle;
          
          // Alt Başlıklar (Kalın)
          if (row === 2 || row === 3) {
            if (col === 'A' || col === 'C') cell.s = boldStyle;
          }

          // Tablo Başlıkları
          if (row === 5) cell.s = headerStyle;

          // Tablo İçerik Hücreleri (Kenarlıklı)
          if (row > 5 && row <= 5 + empData.records.length) {
            cell.s = cellStyle;
          }

          // Alt İstatistik Alanı (Kalın)
          if (row >= 5 + empData.records.length + 2) {
            if (col === 'A') cell.s = boldStyle;
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

  const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const formatDateStr = (iso: string) => iso ? new Date(iso).toLocaleDateString("tr-TR", { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-";

  if (loading) {
    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center bg-white">
        <Activity className="w-8 h-8 text-[#dc3545] animate-pulse mb-3" />
        <span className="text-sm font-bold tracking-widest uppercase">Veriler Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-screen bg-slate-50 text-slate-800">
      <ToastContainer position="bottom-right" theme="dark" hideProgressBar autoClose={3000} closeButton={false} toastClassName="rounded-none border border-slate-700 text-sm font-bold tracking-wider" />

{/* 🚀 HEADER (DARK & ENDÜSTRİYEL) */}
      <div className="w-full bg-[#0F172A] px-6 py-5 flex items-center justify-between border-b-[4px] border-[#dc3545]">
        <div className="flex items-center gap-4">
          <div className="bg-[#dc3545] p-2.5 shadow-[0_0_15px_rgba(220,53,69,0.3)] border border-red-500/30">
            <FileSpreadsheet className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-[0.1em] uppercase flex items-center gap-3 drop-shadow-sm">
              HR RAPOR MERKEZİ
              {isGlobal && <span className="bg-red-500/20 text-red-300 px-2 py-0.5 text-[9px] font-black border border-red-500/30 shadow-inner ml-1">GLOBAL AUTH</span>}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 bg-[#4F39F6] rounded-full animate-pulse shadow-[0_0_8px_#fbbf24]"></div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.15em]">Puantaj ve İstatistik Çıktıları</p>
            </div>
          </div>
        </div>

        {profile && (
          <div className="bg-slate-800/80 px-5 py-2.5 border border-slate-700 flex items-center gap-4 shadow-inner backdrop-blur-sm">
             <div className="flex flex-col text-right pr-2">
               <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                 <ShieldAlert className="w-3.5 h-3.5" strokeWidth={2.5} /> {profile.role || "YÖNETİCİ"}
               </span>
               <span className="text-sm font-black text-slate-100 mt-0.5 uppercase tracking-widest">
                 {profile.branch_name?.toUpperCase() === "IST-DEPO" ? "ONLINE DEPO" : profile.branch_name}
               </span>
             </div>
          </div>
        )}
      </div>

      {/* 🎛️ TAB MENU (MATRİS TASARIM) */}
      <div className="w-full bg-[#f8fafc] p-1 flex flex-col sm:flex-row gap-1 border-b border-slate-300 relative z-20">
        <button 
          onClick={() => { setActiveTab("MONTHLY"); setMonthlyEmployees([]); setRawRecordsForExcel([]); setKpi({ totalHours: 0, totalLeaves: 0, employeeCount: 0 }); setSelectedEmpFilter("ALL"); }} 
          className={`h-11 px-6 flex items-center justify-center gap-2.5 text-[11px] font-black tracking-widest uppercase transition-all duration-200 border rounded-none flex-1 sm:flex-none ${
            activeTab === 'MONTHLY' 
            ? 'bg-white text-[#dc3545] border-slate-300 border-b-transparent shadow-[0_-2px_0_0_#dc3545]' 
            : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200 hover:text-slate-700'
          }`}
        >
          <CalendarDays className="w-4 h-4" strokeWidth={2.5} />AYLIK KİŞİ BAZLI DETAY
        </button>
        
        <button 
          onClick={() => { setActiveTab("DAILY"); setDailyData([]); }} 
          className={`h-11 px-6 flex items-center justify-center gap-2.5 text-[11px] font-black tracking-widest uppercase transition-all duration-200 border rounded-none flex-1 sm:flex-none ${
            activeTab === 'DAILY' 
            ? 'bg-white text-[#dc3545] border-slate-300 border-b-transparent shadow-[0_-2px_0_0_#dc3545]' 
            : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-200 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" strokeWidth={2.5} />GÜNLÜK TÜM ŞUBE HAREKETİ
        </button>
      </div>

      {/* 📸 BİLGİ KARTI & ESTETİK BANNER (CLEAN & PROFESSIONAL WMS STYLE) */}
      <div className="bg-white border-b border-slate-300 flex flex-col lg:flex-row overflow-hidden relative shadow-sm">
        {/* Endüstriyel Arka Plan Deseni */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>

        {/* Sol: Veri & Bilgi Alanı */}
        <div className="p-6 md:p-8 flex-1 relative z-10 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-200 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] w-max mb-4 shadow-sm">
            <DownloadCloud className="w-3.5 h-3.5 text-[#dc3545]" strokeWidth={2.5} />
            DIŞA AKTARIM VE ANALİZ MOTORU
          </div>
          
          <h2 className="text-xl md:text-2xl font-black text-[#0F172A] uppercase tracking-wider mb-2.5 drop-shadow-sm">
            Operasyonel Veri Çıktısı <span className="text-[#dc3545]">.XLSX</span>
          </h2>
          
          <p className="text-[11px] font-bold text-slate-500 leading-relaxed max-w-2xl text-justify mb-6">
            Bu modül üzerinden şube personellerinin net çalışma saatlerini, devamsızlık/izin kesintilerini ve giriş-çıkış loglarını filtreleyebilirsiniz. Tabloda oluşturduğunuz güncel matriks verilerini <strong className="text-emerald-700 font-black">EXCEL formatında indirerek</strong> resmi bordrolama süreçlerinde ve muhasebe entegrasyonlarında kullanabilirsiniz.
          </p>

          {/* Özellik Badge'leri */}
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2 border-l-2 border-[#dc3545] pl-2.5 bg-slate-50 py-1 pr-3 border border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-400" strokeWidth={2.5} />
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Resmi Bordro Uyumlu</span>
            </div>
            <div className="flex items-center gap-2 border-l-2 border-[#dc3545] pl-2.5 bg-slate-50 py-1 pr-3 border border-slate-100">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" strokeWidth={2.5} />
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Gelişmiş Veri Bütünlüğü</span>
            </div>
          </div>
        </div>

        {/* Sağ: Estetik Operasyon Fotoğrafı */}
        <div className="w-full lg:w-[500px] xl:w-[600px] relative hidden md:block border-l border-slate-200 overflow-hidden bg-slate-900 group shrink-0">
          {/* Görsel ile temiz arka planın yumuşak birleşimi */}
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10"></div>
          
          <img 
            src="https://img.magnific.com/free-vector/colleagues-discussing-accounting-statistics-report-using-software_74855-4389.jpg?t=st=1782214653~exp=1782218253~hmac=1749de6019acf9ea5dcedf9d50c68e36b889e4098280aa515684fd0482c7e1b2&w=1480" 
            alt="Data Analytics WMS" 
            className="w-full h-full object-cover opacity-80 "
          />
          
          {/* Fotoğraf Üzeri Teknik Etiket */}
          <div className="absolute bottom-5 right-5 bg-black/70 backdrop-blur-md border border-white/10 px-3 py-1.5 flex items-center gap-2.5 z-20 shadow-xl">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
            <span className="text-[9px] font-black tracking-widest uppercase text-slate-100">LogiStock System Engine</span>
          </div>
        </div>
      </div>

      {/* ⚙️ FILTER PANEL & KPI SUMMARY */}
      <div className="bg-white border-b border-slate-300 p-5 px-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 shadow-sm">
        
        {/* Sorgulama Parametreleri */}
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <Search className="w-5 h-5 text-slate-400 shrink-0 hidden sm:block" />
          
          {activeTab === "MONTHLY" ? (
            <>
              <select className="h-12 bg-slate-50 border border-slate-300 text-sm font-black text-slate-800 px-4 outline-none focus:border-[#dc3545] uppercase" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select className="h-12 bg-slate-50 border border-slate-300 text-sm font-black text-slate-800 px-4 outline-none focus:border-[#dc3545] w-28" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          ) : (
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-12 bg-slate-50 border border-slate-300 text-sm font-black text-slate-800 px-4 outline-none focus:border-[#dc3545]"
            />
          )}

          <button 
            onClick={fetchReportData}
            disabled={isFetching}
            className="h-12 px-6 bg-slate-800 hover:bg-slate-900 text-white text-sm font-black uppercase tracking-widest transition-colors flex items-center gap-2 active:scale-95 ml-2 rounded-none"
          >
            {isFetching ? <Activity className="w-5 h-5 animate-spin" /> : <Table2 className="w-5 h-5" />}
            SORGULA
          </button>
        </div>

        {/* PUANTAJ KARTLARI (KPI) ve EXCEL İNDİR */}
        {activeTab === "MONTHLY" && monthlyEmployees.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full xl:w-auto border-t xl:border-t-0 pt-4 xl:pt-0 border-slate-200">
            <div className="flex gap-6">
              {/* Kart 1: Toplam Mesai */}
              <div className="bg-slate-50 border border-slate-200 px-4 py-2 flex flex-col justify-center min-w-[140px]">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Toplam Mesai</span>
                <span className="text-xl font-black text-slate-800">{kpi.totalHours} <span className="text-sm font-bold text-slate-500">Saat</span></span>
              </div>
              
              {/* Kart 2: İzinler */}
              <div className="bg-red-50 border border-red-100 px-4 py-2 flex flex-col justify-center min-w-[140px]">
                <span className="text-[10px] text-red-500 uppercase tracking-widest font-bold">Kullanılan İzin</span>
                <span className="text-xl font-black text-[#dc3545]">{kpi.totalLeaves} <span className="text-sm font-bold text-red-400">Gün</span></span>
              </div>
              
              {/* Kart 3: Kadro */}
              <div className="bg-blue-50 border border-blue-100 px-4 py-2 flex flex-col justify-center min-w-[140px]">
                <span className="text-[10px] text-blue-500 uppercase tracking-widest font-bold">Aktif Personel</span>
                <span className="text-xl font-black text-blue-700">{kpi.employeeCount} <span className="text-sm font-bold text-blue-400">Kişi</span></span>
              </div>
            </div>
            
            <button 
              onClick={generateExcelReport}
              className="h-12 px-8 bg-[#0b9c2d] hover:bg-green-700 text-white text-sm font-black uppercase tracking-widest transition-colors flex items-center gap-2 active:scale-95 rounded-none w-full sm:w-auto justify-center"
            >
              <Download className="w-5 h-5" /> EXCEL İNDİR
            </button>
          </div>
        )}
      </div>

      {/* 🔍 KİŞİ SEÇİM FİLTRESİ (Sadece Aylık Tab'da ve Veri Varsa) */}
      {activeTab === "MONTHLY" && monthlyEmployees.length > 0 && (
        <div className="bg-slate-100 border-b border-slate-300 px-6 py-3 flex items-center gap-3">
          <Filter className="w-5 h-5 text-slate-500" />
          <span className="text-sm font-black text-slate-700 uppercase tracking-widest">PERSONEL FİLTRESİ:</span>
          <select 
            className="h-10 bg-white border border-slate-300 text-sm font-bold text-slate-900 px-3 outline-none focus:border-[#dc3545] min-w-[300px] rounded-none uppercase"
            value={selectedEmpFilter}
            onChange={(e) => setSelectedEmpFilter(e.target.value)}
          >
            <option value="ALL">TÜM ŞUBE ÖZETİ</option>
            {monthlyEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 📂 TABLO ALANI */}
      <div className="flex-1 bg-white p-6 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto w-full">
          
          {/* --- MOD 1: AYLIK DETAYLI LİSTE --- */}
          {activeTab === "MONTHLY" && (
            <div className="w-full">
              {monthlyEmployees.length === 0 ? (
                <div className="p-16 text-center text-sm font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 border-dashed">
                  LÜTFEN BİR DÖNEM SEÇİP SORGULAMA YAPINIZ
                </div>
              ) : (
                <div className="w-full flex flex-col border border-slate-300 rounded-none bg-white">
                  
                  {/* DURUM 1.A: TÜM PERSONELLER KÜMÜLATİF ÖZET */}
                  {selectedEmpFilter === "ALL" && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-xs font-black text-slate-500 uppercase tracking-widest">
                          <th className="px-5 py-3 border-r border-slate-200">Personel</th>
                          <th className="px-5 py-3 border-r border-slate-200 text-right">Net Çalışma Süresi</th>
                          <th className="px-5 py-3 border-r border-slate-200 text-center">Kullanılan İzin/Rapor</th>
                          <th className="px-5 py-3 text-center">Sistem Statüsü</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {monthlyEmployees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 border-r border-slate-200">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 uppercase tracking-wide">{emp.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{emp.title}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 border-r border-slate-200 text-right font-bold text-slate-800">
                              {emp.totalHours.toFixed(2)} SAAT
                            </td>
                            <td className="px-5 py-3 border-r border-slate-200 text-center font-bold">
                              {emp.leaveDays > 0 && <span className="text-blue-600 mr-3">İ: {emp.leaveDays} Gün</span>}
                              {emp.reportDays > 0 && <span className="text-amber-600">R: {emp.reportDays} Gün</span>}
                              {emp.leaveDays === 0 && emp.reportDays === 0 && <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 uppercase tracking-widest">
                                AKTİF
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* DURUM 1.B: TEK PERSONELİN 30 GÜNLÜK DETAY DÖKÜMÜ */}
                  {selectedEmpFilter !== "ALL" && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-800 border-b border-slate-900 text-xs font-black text-slate-300 uppercase tracking-widest">
                          <th className="px-5 py-3 border-r border-slate-700">Tarih</th>
                          <th className="px-5 py-3 border-r border-slate-700">Giriş Saati</th>
                          <th className="px-5 py-3 border-r border-slate-700">Çıkış Saati</th>
                          <th className="px-5 py-3 border-r border-slate-700 text-right">Net Çalışma Süresi</th>
                          <th className="px-5 py-3">Sistem Durumu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {monthlyEmployees.find(e => e.id === selectedEmpFilter)?.days.map((day: any) => {
                          const isLeave = day.status.startsWith("LEAVE_");
                          return (
                            <tr key={day.id} className="hover:bg-slate-50 text-slate-700 transition-colors">
                              <td className="px-5 py-3 border-r border-slate-200 font-bold text-slate-900">{formatDateStr(day.check_in_time)}</td>
                              <td className="px-5 py-3 border-r border-slate-200 font-bold">{isLeave ? "-" : formatTime(day.check_in_time)}</td>
                              <td className="px-5 py-3 border-r border-slate-200 font-bold">{isLeave ? "-" : formatTime(day.check_out_time)}</td>
                              <td className="px-5 py-3 border-r border-slate-200 text-right font-black">{day.working_hours || 0} SAAT</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest border ${isLeave ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                                  {isLeave ? day.status.replace("LEAVE_", "").replace(/_/g, " ") : (day.status.includes("MANUAL") ? "DÜZELTME" : "MESAİ")}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                </div>
              )}
            </div>
          )}

          {/* --- MOD 2: GÜNLÜK TÜM ŞUBE HAREKET LİSTESİ --- */}
          {activeTab === "DAILY" && (
            <div className="w-full border border-slate-300 bg-white rounded-none">
              <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-slate-100 border-b border-slate-300 text-xs font-black text-slate-500 uppercase tracking-widest">
                <div className="col-span-2 border-r border-slate-300 pr-2">Giriş - Çıkış</div>
                <div className="col-span-4 border-r border-slate-300 px-2">Personel Bilgisi</div>
                <div className="col-span-3 border-r border-slate-300 px-2">Hesaplanan Süre</div>
                <div className="col-span-3 pl-2">Sistem Durumu</div>
              </div>

              <div className="divide-y divide-slate-200">
                {dailyData.length === 0 ? (
                  <div className="p-16 text-center text-sm font-bold text-slate-400 uppercase tracking-widest border-dashed">
                    TARİH SEÇİP SORGULAMA YAPINIZ
                  </div>
                ) : (
                  dailyData.map((rec, i) => {
                    const isLeave = rec.status.startsWith("LEAVE_");
                    const statusStr = isLeave ? rec.status.replace("LEAVE_", "").replace(/_/g, " ") : (rec.status.includes("MANUAL") ? "DÜZELTİLMİŞ" : "NORMAL MESAİ");

                    return (
                      <div key={i} className="grid grid-cols-12 gap-2 px-5 py-3 hover:bg-slate-50 items-center text-sm">
                        <div className="col-span-2 font-bold text-slate-800 pr-2">
                          {isLeave ? (
                            <span className="text-slate-400">08:00 - 16:00 (İzin)</span>
                          ) : (
                            <span className="bg-emerald-50 px-2.5 py-1 border border-emerald-200 text-emerald-800">
                              {formatTime(rec.check_in_time)} - {formatTime(rec.check_out_time)}
                            </span>
                          )}
                        </div>
                        <div className="col-span-4 flex items-center gap-3 px-2">
                          <User className="w-5 h-5 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-900 uppercase tracking-wide truncate">{rec.employees?.full_name}</span>
                        </div>
                        <div className="col-span-3 font-bold text-slate-700 px-2">
                          {rec.working_hours} SAAT <span className="text-slate-400 font-medium ml-1 text-[11px]">(Mola: {rec.break_hours}S)</span>
                        </div>
                        <div className="col-span-3 pl-2">
                          <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase tracking-widest border ${isLeave ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                            {statusStr}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}