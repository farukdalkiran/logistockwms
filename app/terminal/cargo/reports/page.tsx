"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  TerminalSquare,
  MapPin,
  ShieldCheck,
  ArrowLeft,
  Calendar,
  Package,
  Clock,
  User,
  Eye,
  Search,
  X,
  AlertCircle,
  Truck,
  FileText,
  FileSpreadsheet,
  BarChart3,
  Trash2,
} from "lucide-react";

// Kargo konfigürasyonları
import { CARRIERS } from "@/lib/cargoConfig";

// --- TİP TANIMLAMALARI (Vercel Build Hatalarını Önler) ---
interface EmployeeData {
  full_name: string;
}

interface CargoSession {
  id: string;
  carrier_name: string;
  status: string;
  total_items: number;
  started_at: string;
  completed_at: string | null;
  employees: EmployeeData | null;
}

interface CargoLog {
  id: string;
  tracking_number: string;
  scanned_at: string;
}
// --------------------------------------------------------

export default function CargoReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Terminal Props
  const empId = searchParams.get("empId") || "Bilinmiyor";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube";

  // State Yönetimi
  const [empBranchId, setEmpBranchId] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [sessions, setSessions] = useState<CargoSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CargoSession | null>(null);
  const [sessionLogs, setSessionLogs] = useState<CargoLog[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchBranch = async () => {
      const { data } = await supabase
        .from("employees")
        .select("branch_id")
        .eq("id", empId)
        .single();
      if (data?.branch_id) setEmpBranchId(data.branch_id);
    };
    if (empId !== "Bilinmiyor") fetchBranch();
  }, [empId]);

  // Oturumları Getir
  useEffect(() => {
    if (!empBranchId) return;

    const fetchSessions = async () => {
      setIsLoading(true);
      setErrorMsg("");
      try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from("cargo_sessions")
          .select(`
            id,
            carrier_name,
            status,
            total_items,
            started_at,
            completed_at,
            employees (full_name)
          `)
          .eq("branch_id", empBranchId)
          .gte("started_at", startOfDay.toISOString())
          .lte("started_at", endOfDay.toISOString())
          .order("started_at", { ascending: false });

        if (error) throw error;
        setSessions((data as unknown as CargoSession[]) || []);
      } catch (err: unknown) {
        console.error("Rapor çekilemedi:", err);
        setErrorMsg("Kayıtlar yüklenirken bir hata oluştu.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [empBranchId, selectedDate]);

  // Lazy Load Modal Açıcı
  const openSessionDetails = async (session: CargoSession) => {
    setSelectedSession(session);
    setIsModalOpen(true);
    setIsLogsLoading(true);
    setLogSearchQuery("");

    try {
      const { data, error } = await supabase
        .from("cargo_logs")
        .select("id, tracking_number, scanned_at")
        .eq("session_id", session.id)
        .order("scanned_at", { ascending: false });

      if (error) throw error;
      setSessionLogs((data as CargoLog[]) || []);
    } catch (err) {
      console.error("Loglar çekilemedi:", err);
      setSessionLogs([]);
    } finally {
      setIsLogsLoading(false);
    }
  };

  // EXCEL ÇIKTI MOTORU
  const handleExportExcel = async (session: CargoSession) => {
    setIsLoading(true);
    try {
      const { data: logs, error } = await supabase
        .from("cargo_logs")
        .select("tracking_number, scanned_at")
        .eq("session_id", session.id)
        .order("scanned_at", { ascending: true });

      if (error) throw error;

      if (!logs || logs.length === 0) {
        alert("Bu oturumda dışa aktarılacak barkod bulunamadı.");
        return;
      }

      const sessionDate = new Date(session.started_at).toLocaleDateString("tr-TR");
      const employeeFullName = session.employees?.full_name || "Bilinmeyen Personel";

      let csvContent = "data:text/csv;charset=utf-8,\uFEFF";

      csvContent += "LOGISTOCK WMS - OTURUM KARGO DETAY RAPORU\n\n";
      csvContent += `Tarih:;${sessionDate}\n`;
      csvContent += `Personel:;${employeeFullName}\n`;
      csvContent += `Firma:;${session.carrier_name}\n`;
      csvContent += `Durum:;${session.status === "COMPLETED" ? "Tamamlandi" : "Aktif"}\n`;
      csvContent += `Toplam Kargo:;${session.total_items} Adet\n\n`;
      csvContent += "Sira;Takip Numarasi;Okutma Saati\n";

      logs.forEach((log, index) => {
        const timeStr = new Date(log.scanned_at).toLocaleTimeString("tr-TR");
        csvContent += `${index + 1};${log.tracking_number};${timeStr}\n`;
      });

      const safeCarrierName = session.carrier_name.replace(/\s+/g, "_");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `WMS_Rapor_${safeCarrierName}_${sessionDate}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      console.error("Excel Hatası:", err);
      setErrorMsg("Excel çıktısı alınırken bir sorun oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  // OTURUM (SESSİON) VE İÇİNDEKİ LOGLARI SİLME MOTORU (Cascade Deletion)
  const handleDeleteSession = async (session: CargoSession) => {
    const isConfirmed = window.confirm(
      `DİKKAT: ${session.carrier_name} firmasına ait bu oturumu ve içindeki ${session.total_items} adet kargo barkodunu KALICI olarak silmek istediğinize emin misiniz?`
    );

    if (!isConfirmed) return;

    setIsLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase
        .from("cargo_sessions")
        .delete()
        .eq("id", session.id);

      if (error) throw error;

      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err) {
      console.error("Silme işlemi başarısız:", err);
      setErrorMsg("Kayıt silinirken bağlantı hatası oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  // İSTATİSTİK (KPI) HESAPLAMALARI
  const totalCargoToday = sessions.reduce(
    (sum, s) => sum + (s.total_items || 0),
    0
  );

  const carrierStats: Record<string, number> = sessions.reduce(
    (acc, s) => {
      const carrier = s.carrier_name;
      acc[carrier] = (acc[carrier] || 0) + (s.total_items || 0);
      return acc;
    },
    {} as Record<string, number>
  );

  const filteredLogs = sessionLogs.filter((log) =>
    log.tracking_number.toLowerCase().includes(logSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] select-none flex flex-col pb-6">
      {/* 1. DARK HEADING */}
      <div className="bg-[#0f172b] shadow-md flex flex-col shrink-0">
        <div className="bg-[#dc3545] py-2 px-4 flex justify-between items-center border-b border-[#a12330]">
          <button
            onClick={() => router.back()}
            className="text-white flex items-center gap-1 active:scale-95 transition-transform"
          >
            <ArrowLeft size={16} strokeWidth={3} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Geri Çık
            </span>
          </button>
          <div className="flex items-center gap-2">
            <TerminalSquare size={14} className="text-white" />
            <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">
              Sayım Raporları
            </span>
          </div>
          <div className="w-12"></div>
        </div>

        <div className="p-4 grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-3 flex flex-col justify-between shadow-inner">
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <ShieldCheck size={10} className="text-emerald-500" /> Aktif
              Operatör
            </span>
            <span className="text-white font-black text-[13px] uppercase tracking-wide truncate mt-1">
              {empName}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-3 flex flex-col justify-between text-right shadow-inner">
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1 flex justify-end items-center gap-1">
              <MapPin size={10} className="text-[#dc3545]" /> Konum
            </span>
            <span className="text-white font-bold text-[11px] uppercase tracking-wide truncate mt-1">
              {branchName}
            </span>
            <span className="text-white font-mono text-lg font-black tracking-tight mt-1">
              {clock}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col max-w-lg mx-auto w-full gap-4">
        {errorMsg && (
          <div className="bg-red-100 border border-[#dc3545] text-[#dc3545] p-3 rounded-sm flex items-center gap-2 shadow-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span className="text-[12px] font-black uppercase tracking-wide">
              {errorMsg}
            </span>
          </div>
        )}

        {/* BÖLÜM 1: TARİH FİLTRESİ VE FİRMA ORANLAMA İSTATİSTİKLERİ */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-800 font-black text-[13px] outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-[#0f172b] px-3 py-1 rounded-sm shadow-inner">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                TOPLAM:
              </span>
              <span className="text-emerald-400 font-black text-[14px] leading-none">
                {totalCargoToday}
              </span>
            </div>
          </div>

          {totalCargoToday > 0 && (
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <BarChart3 size={12} className="text-slate-400" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Firma Dağılım Oranları
                </span>
              </div>

              <div className="w-full flex h-2 rounded-sm overflow-hidden mb-3 bg-slate-100">
                {Object.entries(carrierStats).map(([cName, count]) => {
                  const countNum = count as number; // TypeScript TYPE-SAFE dönüşümü
                  if (countNum === 0) return null;
                  const cConf =
                    CARRIERS.find((c) => c.name === cName) || CARRIERS[0];
                  const percentage = (countNum / totalCargoToday) * 100;
                  return (
                    <div
                      key={`bar-${cName}`}
                      style={{ width: `${percentage}%` }}
                      className={cConf.activeBg}
                      title={`${cName}: %${percentage.toFixed(1)}`}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(carrierStats)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([cName, count]) => {
                    const countNum = count as number; // TypeScript TYPE-SAFE dönüşümü
                    if (countNum === 0) return null;
                    const cConf =
                      CARRIERS.find((c) => c.name === cName) || CARRIERS[0];
                    return (
                      <div
                        key={`box-${cName}`}
                        className={`border border-slate-200 border-l-4 ${cConf.borderColor} bg-slate-50 rounded-sm p-2 flex items-center justify-between`}
                      >
                        <span className="text-[10px] font-black text-slate-600 uppercase truncate pr-2">
                          {cName}
                        </span>
                        <span
                          className={`text-[13px] font-black ${cConf.textColor}`}
                        >
                          {countNum}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* BÖLÜM 2: OTURUM LİSTESİ (GÜNCELLENMİŞ ŞIK KARTLAR) */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-sm flex-1 flex flex-col overflow-hidden">
          <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center shrink-0">
            <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <FileText size={14} className="text-slate-500" /> Operasyon
              Seansları
            </span>
            <span className="bg-slate-300 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-sm shadow-inner">
              {sessions.length} Kayıt
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 bg-slate-100 space-y-3 custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest animate-pulse">
                  Yükleniyor...
                </span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 opacity-60">
                <Package
                  size={40}
                  strokeWidth={1}
                  className="mb-2 text-slate-500"
                />
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  Seçili tarihte kayıt yok
                </span>
              </div>
            ) : (
              sessions.map((s) => {
                const carrierConfig =
                  CARRIERS.find((c) => c.name === s.carrier_name) ||
                  CARRIERS[0];
                const startTime = new Date(s.started_at).toLocaleTimeString(
                  "tr-TR",
                  { hour: "2-digit", minute: "2-digit" }
                );
                const endTime = s.completed_at
                  ? new Date(s.completed_at).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Devam";
                const employeeName =
                  s.employees?.full_name || "Bilinmeyen Personel";

                return (
                  <div
                    key={s.id}
                    className="bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col relative overflow-hidden group"
                  >
                    {/* Üst Marka Çizgisi */}
                    <div
                      className={`h-1.5 w-full ${carrierConfig.activeBg}`}
                    ></div>

                    <div className="p-3 bg-white">
                      {/* Üst Kısım: Dark Logo Container, İsim, Silme ve Badge */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          {/* YENİ: Dark Box içindeki Bembeyaz Logo */}
                          <div className="h-10 w-16 bg-[#380000] flex items-center justify-center p-1.5 rounded-sm  shrink-0">
                            <img
                              src={carrierConfig.logo}
                              alt={s.carrier_name}
                              className="max-h-full max-w-full object-contain "
                            />
                          </div>
                          <div className="flex flex-col">
                            <span
                              className={`text-[13px] font-black uppercase tracking-wide ${carrierConfig.textColor} leading-none`}
                            >
                              {s.carrier_name}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mt-1">
                              <User size={10} className="text-[#dc3545]" />{" "}
                              {employeeName}
                            </span>
                          </div>
                        </div>

                        {/* Silme Butonu ve Durum Rozeti */}
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            onClick={() => handleDeleteSession(s)}
                            className="bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-sm transition-all shadow-sm border border-slate-100"
                            title="Tüm Kaydı Sil"
                          >
                            <Trash2 size={13} strokeWidth={2.5} />
                          </button>
                          <span
                            className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest shadow-inner
                            ${s.status === "COMPLETED" ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700 animate-pulse"}`}
                          >
                            {s.status === "COMPLETED" ? "BİTTİ" : "AÇIK"}
                          </span>
                        </div>
                      </div>

                      {/* Bilgi Bandı (Adet & Saat) */}
                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-sm border border-slate-100 mb-3">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-slate-400" />
                          <span className="text-[15px] font-black text-slate-800">
                            {s.total_items}{" "}
                            <span className="text-[10px] font-bold text-slate-500">
                              ADET
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-white px-2 py-1 border border-slate-200 rounded-sm shadow-sm">
                          <Clock size={12} className="text-slate-400" />
                          {startTime} - {endTime}
                        </div>
                      </div>

                      {/* Aksiyon Butonları */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleExportExcel(s)}
                          className="flex-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-[11px] font-black uppercase tracking-widest py-2.5 rounded-sm flex items-center justify-center gap-2 transition-colors active:scale-95"
                        >
                          <FileSpreadsheet size={16} /> Excel
                        </button>
                        <button
                          onClick={() => openSessionDetails(s)}
                          className="flex-1 bg-[#0f172b] hover:bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest py-2.5 rounded-sm flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-md"
                        >
                          <Eye size={16} /> Detay Gör
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. DETAY MODALI (FULL SCREEN DRAWER MANTIĞI) */}
      {isModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex flex-col justify-end sm:justify-center sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-50 w-full sm:max-w-lg mx-auto sm:rounded-sm h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-8">
            {/* Modal Header */}
            <div className="bg-[#0f172b] p-4 flex justify-between items-center border-b-4 border-[#dc3545] shrink-0 sm:rounded-t-sm">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-sm">
                  <Truck size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white text-[14px] font-black uppercase tracking-wide">
                    {selectedSession.carrier_name}
                  </h3>
                  <div className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-0.5">
                    {selectedSession.total_items} Adet Kargo •{" "}
                    {selectedSession.employees?.full_name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-white/10 text-white p-2 rounded-sm hover:bg-[#dc3545] transition-colors active:scale-95"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="bg-white p-3 border-b border-slate-200 shrink-0 shadow-sm z-10">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Takip no ara..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm font-bold rounded-sm block pl-9 p-2.5 outline-none focus:border-[#dc3545] transition-colors uppercase"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Modal Listesi */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-100 custom-scrollbar">
              {isLogsLoading ? (
                <div className="flex justify-center items-center h-full">
                  <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest animate-pulse">
                    Kayıtlar Çekiliyor...
                  </span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                  <Search
                    size={32}
                    strokeWidth={1.5}
                    className="mb-2 text-slate-500"
                  />
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    Eşleşen kayıt bulunamadı
                  </span>
                </div>
              ) : (
                filteredLogs.map((log, index) => {
                  const logTime = new Date(log.scanned_at).toLocaleTimeString(
                    "tr-TR",
                    { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                  );
                  return (
                    <div
                      key={log.id}
                      className="bg-white border border-slate-200 p-3 flex justify-between items-center rounded-sm shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 w-5">
                          {filteredLogs.length - index}.
                        </span>
                        <span className="font-black text-slate-800 text-[13px] tracking-widest">
                          {log.tracking_number}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-sm">
                        <Clock size={10} /> {logTime}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}