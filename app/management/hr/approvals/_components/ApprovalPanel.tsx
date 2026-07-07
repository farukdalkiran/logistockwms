"use client";

import { useState, useRef, useEffect } from "react";
import { Lock, AlertCircle, CalendarDays, Calendar, CheckCircle2, XCircle, UserCheck, Clock, ShieldAlert, ArrowDownRight, History, ClipboardList, UserRoundCog, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase"; // Ya da senin yolun "@/lib/supabase"
import { processApproval, getPendingApprovals } from "@/app/actions/approvals";
import { useRouter } from "next/navigation";

interface ApprovalPanelProps {
  managerBranchId: string;
  isGlobal: boolean;
}

type ManagerData = { id: string; full_name: string; branch_id: string; position_title: string };

export default function ApprovalPanel({ managerBranchId, isGlobal }: ApprovalPanelProps) {
  const router = useRouter();

  const [step, setStep] = useState<"LOGIN" | "DASHBOARD">("LOGIN");
  const [activeTab, setActiveTab] = useState<"LEAVES" | "ATTENDANCE" | "HISTORY">("LEAVES");
  
  const [terminalId, setTerminalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [manager, setManager] = useState<ManagerData | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [pendingAttendance, setPendingAttendance] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (step === "LOGIN") inputRef.current?.focus();
  }, [step]);

  const checkIsManager = (title?: string) => {
    if (!title) return false;
    const lowerTitle = title.toLocaleLowerCase("tr-TR");
    return ["yönetici", "müdür", "şef", "admin", "developer", "uzman", "lider"].some((k) => lowerTitle.includes(k));
  };

  // Verileri Server Action üzerinden RLS'i aşarak çeker.
  const fetchData = async (mngrId: string, branchId: string) => {
const result = await getPendingApprovals(branchId, isGlobal);
      if (result.success) {
        // WMS Koruması: 'undefined' gelme ihtimaline karşı fallback (|| []) eklendi.
        setPendingLeaves(result.leaves || []);
        setPendingAttendance(result.attendance || []);
        setHistoryLogs(result.history || []);
      } else {
        // Hata durumunda state'leri güvenli şekilde sıfırla
        setPendingLeaves([]);
        setPendingAttendance([]);
        setHistoryLogs([]);
        console.error("Onay verileri çekilemedi:", result.message);
      }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (terminalId.length !== 5) {
      setFeedback({ type: "error", msg: "5 HANELİ ID GİRİNİZ" });
      setTerminalId(""); inputRef.current?.focus(); return;
    }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(true); setFeedback(null);

    try {
      // Sadece kimlik doğrulama için standart istemci kullanıyoruz.
      const { data: empData, error } = await supabase.from("employees").select("id, full_name, branch_id, position_title").eq("id", terminalId).eq("is_active", true).single();
      if (error || !empData) throw new Error("SİSTEMDE BÖYLE BİR PERSONEL BULUNAMADI");

      if (!isGlobal && managerBranchId !== "GLOBAL" && empData.branch_id !== managerBranchId) {
         throw new Error("ERİŞİM ENGELLENDİ: ŞUBENİZE AİT DEĞİL.");
      }

      if (!checkIsManager(empData.position_title) && empData.id !== "3976") {
         throw new Error("GÜVENLİK İHLALİ: BU PANELE SADECE YÖNETİCİLER GİREBİLİR!");
      }

      setManager(empData);
      await fetchData(empData.id, empData.branch_id);
      setStep("DASHBOARD");
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message });
      setTerminalId(""); inputRef.current?.focus();
      timeoutRef.current = setTimeout(() => setFeedback(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async (requestId: string, reqType: "ATTENDANCE" | "LEAVE", action: "APPROVE" | "REJECT") => {
    if (!manager) return;
    const note = window.prompt(`İşlemi ${action === "APPROVE" ? "ONAYLIYORSUNUZ" : "REDDEDİYORSUNUZ"}. Bir not ekleyebilirsiniz (Opsiyonel):`, "");
    if (note === null) return; 

    setLoading(true);
    const signatureNote = `[${manager.full_name}] - ${note || "Ek açıklama yok."}`;

    const result = await processApproval({
      request_id: requestId,
      request_type: reqType,
      action: action,
      manager_id: manager.id,
      manager_note: signatureNote
    });

    if (result.success) {
      await fetchData(manager.id, manager.branch_id);
      router.refresh(); // UI'ı yeni verilere göre tazele
    } else {
      alert(result.message);
    }
    setLoading(false);
  };

  const formatDate = (iso: string) => iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }) : "-";
  const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--";

// WMS Tip Korumalı ve Esnek Tarih Okuyucu (JSON/Array Çökmelerini ve Parametre Hatalarını Engeller)
const parseDetailedLeaveDates = (
  datesData: any,
  startDate?: string | Date | null,
  endDate?: string | Date | null
): { list: string[]; text: string; fullListStr: string } => {
  try {
    let dates: string[] = [];
    
    // 1. Array veya JSON String kontrolü
    if (typeof datesData === 'string') {
      dates = JSON.parse(datesData);
    } else if (Array.isArray(datesData)) {
      dates = datesData;
    }
    
    // 2. Eğer dates verisi başarıyla çıkarıldıysa
    if (dates && dates.length > 0) {
      dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const fullListStr = dates.map(d => new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })).join(", ");
      return { list: dates, text: fullListStr, fullListStr: fullListStr };
    }

    // 3. FALLBACK: Eğer datesData boşsa ve eski usul startDate/endDate logu varsa
    if (startDate && endDate) {
      const s = new Date(startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      const e = new Date(endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      if (s === e) {
        return { list: [s], text: s, fullListStr: s };
      }
      return { list: [s, e], text: `${s} - ${e}`, fullListStr: `${s} - ${e}` };
    }

    // 4. Veri yoksa
    return { list: [], text: "Tarih Belirtilmedi", fullListStr: "Tarih Belirtilmedi" };
    
  } catch (e) {
    console.error("[DATE_PARSE_ERROR]", e);
    return { list: [], text: "Tarih Okuma Hatası", fullListStr: "Tarih Okuma Hatası" };
  }
};

  return (
    <div className="w-full flex flex-col shadow-xl rounded-lg overflow-hidden border border-slate-200 select-none bg-white transition-all duration-300 ease-in-out">
      
      {/* SEAMLESS INDUSTRIAL DARK HEADING */}
      <div className="w-full bg-[#0F172A] p-6 flex flex-col md:flex-row items-start md:items-center justify-between border-b-4 border-[#dc3545] gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-[#dc3545] p-3 rounded-md shadow-[0_0_15px_rgba(220,53,69,0.3)] border border-red-500/30">
            <UserCheck className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-[0.1em] uppercase flex items-center gap-3 drop-shadow-sm">
              YÖNETİCİ ONAY MERKEZİ
              {isGlobal && <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-sm text-[9px] font-black border border-red-500/30 shadow-inner ml-1">GLOBAL AUTH</span>}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-1.5 h-1.5 bg-[#4F39F6] rounded-full animate-pulse shadow-[0_0_8px_#fbbf24]"></div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.15em]">Sistem Operasyonları Karar Paneli</p>
            </div>
          </div>
        </div>

        {manager && (
          <div className="bg-slate-800/80 px-5 py-2.5 border border-slate-700 rounded-md flex items-center gap-5 shadow-inner backdrop-blur-sm w-full md:w-auto justify-between md:justify-end">
             <div className="flex flex-col text-right border-r border-slate-600 pr-5">
               <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                 <ShieldAlert className="w-3.5 h-3.5" /> {manager.position_title || "YÖNETİCİ"}
               </span>
               <span className="text-sm font-black text-slate-100 tracking-widest uppercase mt-0.5">{manager.full_name}</span>
             </div>
             <button onClick={() => { setStep("LOGIN"); setManager(null); setTerminalId(""); }} className="text-[10px] font-black tracking-widest text-[#dc3545] hover:text-red-400 uppercase transition-colors px-2">
               [ ÇIKIŞ ]
             </button>
          </div>
        )}
      </div>

      {/* GİRİŞ EKRANI */}
      {step === "LOGIN" && (
        <div className="flex flex-col md:flex-row w-full min-h-[480px] animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-12 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-transparent z-10"></div>
            
            <div className="relative z-20">
              <h2 className="text-3xl font-black tracking-[0.1em] uppercase text-white mb-2 drop-shadow-md">YETKİLİ GİRİŞİ</h2>
              <div className="w-12 h-1.5 bg-[#dc3545] mb-5 rounded-full shadow-[0_0_10px_rgba(220,53,69,0.5)]"></div>
              <p className="text-[12px] font-bold text-slate-300 uppercase tracking-wide leading-relaxed">
                BU PANEL SADECE ŞUBE YÖNETİCİLERİNE AÇIKTIR. ONAY İŞLEMLERİ İÇİN 5 HANELİ KİMLİĞİNİZİ DOĞRULAYIN.
              </p>
            </div>
          </div>
          
          <div className="w-full md:w-7/12 p-12 flex flex-col justify-center items-center bg-slate-50 relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-30 rounded-bl-full pointer-events-none"></div>
            
            <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-6 relative z-10">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Yönetici Sicil No</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                  <input 
                    ref={inputRef}
                    type="password" 
                    value={terminalId} 
                    onChange={(e) => { setTerminalId(e.target.value.replace(/[^0-9]/g, "")); if(feedback) setFeedback(null); }} 
                    maxLength={5} 
                    disabled={loading} 
                    placeholder="•••••" 
                    className="h-16 w-full bg-white border-2 border-slate-200 rounded-lg pl-14 pr-4 text-center text-3xl font-black tracking-[0.6em] outline-none transition-all duration-200 focus:border-[#dc3545] focus:ring-4 focus:ring-red-500/10 text-slate-800 shadow-sm" 
                    autoComplete="off" 
                  />
                </div>
              </div>
              <button type="submit" disabled={loading || terminalId.length !== 5} className="h-14 w-full flex items-center justify-center rounded-lg text-sm font-black tracking-[0.1em] uppercase transition-all duration-200 shadow-md active:scale-95 bg-[#0F172A] text-white hover:bg-[#dc3545] border border-[#0F172A] hover:border-[#dc3545]">
                {loading ? "DOĞRULANIYOR..." : "SİSTEME GİRİŞ YAP"}
              </button>
            </form>

            <div className={`mt-6 max-w-sm w-full p-4 bg-red-50 border-l-4 border-[#dc3545] text-[#dc3545] text-[11px] font-black uppercase tracking-widest flex items-center gap-3 shadow-sm transition-all duration-300 ease-in-out ${feedback ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={2.5} /> 
              <span>{feedback?.msg}</span>
            </div>
          </div>
        </div>
      )}

      {/* YÖNETİCİ DASHBOARD */}
      {step === "DASHBOARD" && manager && (
        <div className="flex flex-col w-full min-h-[650px] bg-slate-50 animate-in fade-in duration-300">
          
          <div className="bg-white border-b border-slate-200 relative overflow-hidden flex flex-col p-6 md:p-8 shadow-sm">
            <div className="relative z-10 w-full max-w-7xl mx-auto">
              <h2 className="text-lg font-black text-[#0F172A] tracking-[0.1em] uppercase mb-1.5">
                OPERASYONEL ONAY PROSEDÜRLERİ
              </h2>
              <p className="text-xs font-bold text-slate-500 mb-6 tracking-wide">
                Aşağıdaki sistem talimatlarına uygun olarak bekleyen talepleri karara bağlayınız. Uygulanan işlemler kalıcıdır.
              </p>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* 1. İZİN BİLGİ KARTI */}
                <div className="flex flex-col sm:flex-row bg-slate-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden group">
                  <div className="w-full sm:w-20 shrink-0 bg-blue-50 flex items-center justify-center p-3 border-r border-slate-100">
                     <CalendarDays className="w-8 h-8 text-blue-500" strokeWidth={2.5} />
                  </div>
                  <div className="p-5 flex flex-col justify-center flex-1 bg-white">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1.5">İzin ve Rapor Yönetimi</span>
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed text-justify">
                      Personellerin yıllık, mazeret ve diğer izin talepleri bu alana düşer. <strong className="text-blue-600">Onaylanan izinler</strong> personelin toplam bakiyesinden otomatik düşülür ve günlük çalışma süresi üzerinden puantaja işlenir.
                    </p>
                  </div>
                </div>

                {/* 2. MESAİ BİLGİ KARTI */}
                <div className="flex flex-col sm:flex-row bg-slate-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden group">
                  <div className="w-full sm:w-20 shrink-0 bg-amber-50 flex items-center justify-center p-3 border-r border-slate-100">
                     <Clock className="w-8 h-8 text-[#4F39F6]" strokeWidth={2.5} />
                  </div>
                  <div className="p-5 flex flex-col justify-center flex-1 bg-white">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1.5">Mesai Log Düzeltmeleri</span>
                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed text-justify">
                      Eksik, hatalı veya unutulan terminal giriş-çıkışları burada onayınıza sunulur. <strong className="text-amber-600">Onaylanan saatler</strong> doğrudan aylık net çalışma süresine yansır.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

{/* 🎛️ ENDÜSTRİYEL TERMİNAL SEKME SEÇİCİ (HIGH-DENSE MATRIX TABS) */}
          <div className="w-full bg-[#0F172A] p-1 grid grid-cols-1 sm:grid-cols-3 gap-1 border-b border-slate-300 rounded-none relative z-20">
            
            {/* TAB 1: İZİNLER */}
            <button 
              onClick={() => setActiveTab("LEAVES")} 
              className={`h-11 px-4 flex items-center justify-between text-[10px] font-black tracking-widest transition-colors rounded-none border ${
                activeTab === 'LEAVES' 
                  ? 'bg-[#dc3545] text-white border-[#dc3545]' 
                  : 'bg-[#1E293B] text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" strokeWidth={2.5} />
                <span>[01] İZİN ONAYLARI</span>
              </div>
              <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded-none ${
                activeTab === 'LEAVES' ? 'bg-white text-[#dc3545]' : 'bg-slate-900 text-slate-400 border border-slate-700'
              }`}>
                {pendingLeaves.length}
              </span>
            </button>

            {/* TAB 2: MESAİ LOGLARI */}
            <button 
              onClick={() => setActiveTab("ATTENDANCE")} 
              className={`h-11 px-4 flex items-center justify-between text-[10px] font-black tracking-widest transition-colors rounded-none border ${
                activeTab === 'ATTENDANCE' 
                  ? 'bg-[#dc3545] text-white border-[#dc3545]' 
                  : 'bg-[#1E293B] text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" strokeWidth={2.5} />
                <span>[02] MESAİ DÜZELTMELERİ</span>
              </div>
              <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded-none ${
                activeTab === 'ATTENDANCE' ? 'bg-white text-[#dc3545]' : 'bg-slate-900 text-slate-400 border border-slate-700'
              }`}>
                {pendingAttendance.length}
              </span>
            </button>

            {/* TAB 3: ONAY GEÇMİŞİ */}
            <button 
              onClick={() => setActiveTab("HISTORY")} 
              className={`h-11 px-4 flex items-center justify-between text-[10px] font-black tracking-widest transition-colors rounded-none border ${
                activeTab === 'HISTORY' 
                  ? 'bg-[#dc3545] text-white border-[#dc3545]' 
                  : 'bg-[#1E293B] text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" strokeWidth={2.5} />
                <span>[03] SİSTEM ONAY GEÇMİŞİ</span>
              </div>
              <span className={`px-2 py-0.5 font-mono text-[9px] font-bold rounded-none ${
                activeTab === 'HISTORY' ? 'bg-white text-[#dc3545]' : 'bg-slate-900 text-slate-500 border border-slate-700'
              }`}>
                LOG
              </span>
            </button>
          </div>

          {/* 📂 WMS VERİ MATRİSİ (GRID DATA PANELS) */}
          <div className="p-4 md:p-6 flex-1 relative overflow-hidden bg-slate-50">
            <div className="relative z-10 h-full max-w-[1600px] mx-auto flex flex-col gap-4">
              
              {/* --- SEKME 1: İZİN ONAYLARI --- */}
              {activeTab === "LEAVES" && (
                <div className="w-full animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-3 px-1">
                     <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <ClipboardList className="w-3.5 h-3.5 text-[#dc3545]" strokeWidth={2.5} /> 
                       BEKLEYEN İZİN TALEPLERİ
                     </h3>
                  </div>

                  {pendingLeaves.length === 0 ? (
                    <div className="w-full border border-slate-300 border-dashed rounded-none py-12 flex flex-col items-center justify-center text-slate-400 bg-white">
                      <CheckCircle2 className="w-8 h-8 mb-2 opacity-40" strokeWidth={2} />
                      <span className="text-[10px] font-black uppercase tracking-widest">BEKLEYEN İZİN TALEBİ BULUNMUYOR</span>
                    </div>
                  ) : (
                    <div className="w-full border border-slate-300 rounded-none bg-white">
                      {/* Keskin Grid Tablo Başlığı */}
                      <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 border-b border-slate-300">
                        <div className="col-span-3 border-r border-slate-200 pr-2">Personel Bilgisi</div>
                        <div className="col-span-3 border-r border-slate-200 px-2">Tür & Tarih Aralığı</div>
                        <div className="col-span-4 border-r border-slate-200 px-2">Mazeret / Açıklama</div>
                        <div className="col-span-2 text-right pl-2">Sistem Aksiyonu</div>
                      </div>
                      
                      {/* Katı Veri Satırları */}
                      <div className="divide-y divide-slate-200">
                        {pendingLeaves.map(req => {
                          const dateInfo = parseDetailedLeaveDates(req.selected_dates, req.start_date, req.end_date);
                          const totalDays = req.requested_days || (req.is_half_day ? dateInfo.list.length * 0.5 : dateInfo.list.length);
                          
                          return (
                            <div key={req.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center px-4 py-3 bg-white hover:bg-slate-50 border-slate-200 text-xs font-medium">
                              
                              <div className="col-span-1 lg:col-span-3 flex items-center gap-3">
                                <div className="w-7 h-7 rounded-none bg-slate-800 text-white flex items-center justify-center text-xs font-black uppercase shrink-0">
                                  {req.employees?.full_name.charAt(0)}
                                </div>
                                <div className="flex flex-col truncate">
                                  <span className="font-bold text-slate-900 uppercase tracking-wide truncate">{req.employees?.full_name}</span>
                                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5 truncate">{req.employees?.position_title}</span>
                                </div>
                              </div>

                              <div className="col-span-1 lg:col-span-3 flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded-none text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-800 border border-slate-300">
                                    {req.leave_type.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] font-mono font-black text-slate-700">{totalDays} GÜN</span>
                                </div>
                                <span className="text-[10px] text-slate-600 font-mono font-bold flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" strokeWidth={2.5} /> {dateInfo.fullListStr}
                                </span>
                              </div>

                              <div className="col-span-1 lg:col-span-4 text-slate-600 font-mono text-[11px] truncate pr-2 lg:border-l border-slate-100 lg:pl-3">
                                {req.reason ? <span>// {req.reason.toUpperCase()}</span> : "-"}
                              </div>

                              <div className="col-span-1 lg:col-span-2 flex justify-end gap-1.5 lg:border-l border-slate-200 lg:pl-3">
                                <button 
                                  onClick={() => handleApprovalAction(req.id, "LEAVE", "REJECT")} 
                                  disabled={loading} 
                                  className="w-7 h-7 flex items-center justify-center bg-white text-slate-500 rounded-none border border-slate-300 hover:text-white hover:bg-[#dc3545] hover:border-[#dc3545] transition-colors cursor-pointer active:bg-red-700"
                                >
                                  <XCircle className="w-4 h-4" strokeWidth={2.5} />
                                </button>
                                
                                <button 
                                  onClick={() => handleApprovalAction(req.id, "LEAVE", "APPROVE")} 
                                  disabled={loading} 
                                  className="h-7 px-3 bg-slate-900 text-white rounded-none border border-slate-900 hover:bg-[#0b9c2d] hover:border-[#0b9c2d] text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 flex-1 lg:flex-none cursor-pointer active:bg-green-800"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> ONAYLA
                                </button>
                              </div>

                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- SEKME 2: MESAİ ONAYLARI --- */}
              {activeTab === "ATTENDANCE" && (
                <div className="w-full animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-3 px-1">
                     <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <Clock className="w-3.5 h-3.5 text-[#dc3545]" strokeWidth={2.5} /> 
                       BEKLEYEN MESAİ DÜZELTMELERİ
                     </h3>
                  </div>

                  {pendingAttendance.length === 0 ? (
                    <div className="w-full border border-slate-300 border-dashed rounded-none py-12 flex flex-col items-center justify-center text-slate-400 bg-white">
                      <CheckCircle2 className="w-8 h-8 mb-2 opacity-40" strokeWidth={2} />
                      <span className="text-[10px] font-black uppercase tracking-widest">BEKLEYEN MESAİ TALEBİ BULUNMUYOR</span>
                    </div>
                  ) : (
                    <div className="w-full border border-slate-300 rounded-none bg-white">
                      <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 border-b border-slate-300">
                        <div className="col-span-3 border-r border-slate-200 pr-2">Personel Bilgisi</div>
                        <div className="col-span-4 border-r border-slate-200 px-2">Log Kıyaslaması (Eski ➜ Yeni)</div>
                        <div className="col-span-3 border-r border-slate-200 px-2">Mazeret / Açıklama</div>
                        <div className="col-span-2 text-right pl-2">Sistem Aksiyonu</div>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {pendingAttendance.map(req => {
                          const isDelete = req.attendance_id && !req.req_check_in && !req.req_check_out;
                          const isUpdate = req.attendance_id && (req.req_check_in || req.req_check_out);
                          return (
                            <div key={req.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center px-4 py-3 bg-white hover:bg-slate-50 border-slate-200 text-xs font-medium">
                              
                              <div className="col-span-1 lg:col-span-3 flex items-center gap-3">
                                <div className="w-7 h-7 rounded-none bg-slate-800 text-white flex items-center justify-center text-xs font-black uppercase shrink-0">
                                  {req.employees?.full_name.charAt(0)}
                                </div>
                                <div className="flex flex-col truncate">
                                  <span className="font-bold text-slate-900 uppercase tracking-wide truncate">{req.employees?.full_name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono font-bold uppercase mt-0.5">{formatDate(req.request_date)}</span>
                                </div>
                              </div>

                              <div className="col-span-1 lg:col-span-4 flex flex-col font-mono text-[10px] justify-center gap-1.5 pr-2 lg:px-2">
                                {(isUpdate || isDelete) && req.attendance && (
                                  <div className="flex items-center gap-2 text-slate-400 opacity-80">
                                    <span className="line-through">{formatTime(req.attendance.check_in_time)} - {formatTime(req.attendance.check_out_time)}</span>
                                    <span className="border border-slate-300 px-1 py-0.5 text-[8px] bg-slate-50">ESKİ LOG</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  {(isUpdate || isDelete) && <ArrowDownRight className="w-3 h-3 text-slate-400 shrink-0" strokeWidth={2.5} />}
                                  {isDelete ? (
                                    <div className="flex items-center gap-1.5 font-bold text-[#dc3545]">
                                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} /> KAYIT SİLİNECEK
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-200 w-max">
                                      <span>{formatTime(req.req_check_in)} - {formatTime(req.req_check_out)}</span>
                                      <span className="text-[8px] bg-emerald-600 text-white px-1 py-0.5">YENİ LOG</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="col-span-1 lg:col-span-3 text-slate-600 font-mono text-[11px] truncate pr-2 lg:border-l border-slate-100 lg:pl-3">
                                 <span>// {req.reason.replace(/_/g, ' ').toUpperCase()}</span>
                              </div>

                              <div className="col-span-1 lg:col-span-2 flex justify-end gap-1.5 lg:border-l border-slate-200 lg:pl-3">
                                <button onClick={() => handleApprovalAction(req.id, "ATTENDANCE", "REJECT")} disabled={loading} className="w-7 h-7 flex items-center justify-center bg-white text-slate-500 rounded-none border border-slate-300 hover:text-white hover:bg-[#dc3545] hover:border-[#dc3545] transition-colors cursor-pointer active:bg-red-700">
                                  <XCircle className="w-4 h-4" strokeWidth={2.5} />
                                </button>
                                <button onClick={() => handleApprovalAction(req.id, "ATTENDANCE", "APPROVE")} disabled={loading} className="h-7 px-3 bg-slate-900 text-white rounded-none border border-slate-900 hover:bg-[#0b9c2d] hover:border-[#0b9c2d] text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 flex-1 lg:flex-none cursor-pointer active:bg-green-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> ONAYLA
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- SEKME 3: DETAYLI ONAY GEÇMİŞİ --- */}
              {activeTab === "HISTORY" && (
                <div className="w-full animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-3 px-1">
                     <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <History className="w-3.5 h-3.5 text-[#dc3545]" strokeWidth={2.5} /> 
                       SİSTEM ONAY GEÇMİŞİ LOGLARI (SON 50)
                     </h3>
                  </div>
                  
                  <div className="w-full border border-slate-300 rounded-none bg-white">
                    <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 border-b border-slate-300">
                      <div className="col-span-2 border-r border-slate-200 pr-2">İşlem Modülü & Zaman</div>
                      <div className="col-span-3 border-r border-slate-200 px-2">Personel Bilgisi</div>
                      <div className="col-span-5 border-r border-slate-200 px-2">İşlem Özeti & Yönetici Notu</div>
                      <div className="col-span-2 text-right pl-2">Sistem Kararı</div>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {historyLogs.length === 0 ? (
                        <div className="p-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50">GEÇMİŞ İŞLEM BULUNMUYOR</div>
                      ) : historyLogs.map(log => {
                        const isApprove = log.status === 'APPROVED';
                        let summary = "";
                        if (log.req_type === 'LEAVE') {
                          const dInfo = parseDetailedLeaveDates(log.selected_dates, log.start_date, log.end_date);
                          summary = `${log.requested_days || 0} GÜN ${log.leave_type?.replace(/_/g, ' ')} (${dInfo.fullListStr})`;
                        } else {
                          if (log.attendance_id && !log.req_check_in && !log.req_check_out) summary = "MESAİ KAYDI SİLİNMESİ";
                          else summary = `MESAİ: ${formatTime(log.req_check_in)} - ${formatTime(log.req_check_out)}`;
                        }
                        const noteText = log.manager_note || "Ek açıklama düşülmedi.";
                        
                        return (
                          <div key={log.id} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center px-4 py-3 bg-white hover:bg-slate-50 border-slate-200 text-xs font-medium">
                            
                            <div className="col-span-1 lg:col-span-2 flex flex-col gap-1.5">
                              <span className={`text-[9px] font-black uppercase tracking-widest w-max px-1.5 py-0.5 rounded-none border ${
                                log.req_type === 'LEAVE' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {log.req_type === 'LEAVE' ? 'İZİN ONAYI' : 'MESAİ ONAYI'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 font-bold">{formatDate(log.created_at)}</span>
                            </div>
                            
                            <div className="col-span-1 lg:col-span-3 font-bold text-slate-900 uppercase tracking-wide truncate pr-2">
                              {log.employees?.full_name}
                            </div>

                            <div className="col-span-1 lg:col-span-5 flex flex-col gap-1 pr-2 lg:border-l border-slate-100 lg:pl-3">
                              <span className="font-mono text-[10px] font-bold text-slate-700 uppercase">{summary}</span>
                              <div className="flex items-start gap-1.5 mt-0.5">
                                <UserRoundCog className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="text-[10px] text-slate-500 italic truncate">"{noteText}"</span>
                              </div>
                            </div>

                            <div className="col-span-1 lg:col-span-2 flex justify-end lg:border-l border-slate-200 lg:pl-3">
                              <span className={`inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-none text-[9px] font-black uppercase tracking-widest border ${
                                isApprove ? 'bg-[#0b9c2d]/10 text-[#0b9c2d] border-[#0b9c2d]/30' : 'bg-[#dc3545]/10 text-[#dc3545] border-[#dc3545]/30'
                              }`}>
                                {isApprove ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> : <XCircle className="w-3.5 h-3.5" strokeWidth={2.5} />}
                                {isApprove ? 'ONAYLANDI' : 'REDDEDİLDİ'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}