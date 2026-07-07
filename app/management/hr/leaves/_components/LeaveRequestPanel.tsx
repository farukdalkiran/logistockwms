"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Clock, AlertCircle, CalendarDays, ArrowRight, Check, Info, Calendar, FileText, Lock, ListChecks, ChevronLeft, ChevronRight, CheckCircle2, XCircle, History, ShieldAlert, Ban, MessageSquare, TerminalSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { submitLeaveRequest, cancelLeaveRequestServer } from "@/app/actions/leave-requests";
import { useRouter } from "next/navigation";
import { useWms } from "@/components/providers/WmsSessionProvider";


type EmployeeData = { id: string; full_name: string; branch_id: string; leave_balance: number; position_title: string };
type FeedbackData = { type: "success" | "error"; msg: string };

export default function LeaveRequestPanel() {
  const router = useRouter();
  const { managerBranchId, isGlobal } = useWms();
  
  const [step, setStep] = useState<"LOGIN" | "DASHBOARD" | "REQUEST_FORM">("LOGIN");
  const [terminalId, setTerminalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const [leaveType, setLeaveType] = useState("");
  const [customType, setCustomType] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState("");

  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  
  const [cancelModal, setCancelModal] = useState<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isManager = employee ? ["yönetici", "müdür", "şef", "admin", "developer", "uzman", "lider"].some(k => employee.position_title?.toLowerCase().includes(k)) : false;
  const willAutoApprove = leaveType === 'SAGLIK_RAPORU' || isManager;

  useEffect(() => {
    if (step === "LOGIN") {
      inputRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (employee && step === "DASHBOARD") {
      fetchData(employee.id, currentMonthDate);
    }
  }, [currentMonthDate, employee, step]);

  const fetchData = async (empId: string, targetMonth?: Date) => {
    const { data: leaves } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", empId)
      .order("created_at", { ascending: false })
      .limit(6);
    
    setLeaveRequests(leaves || []);

    if (targetMonth) {
      const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).toISOString();
      const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: logsData } = await supabase
        .from("attendance")
        .select("id, check_in_time, check_out_time, status, working_hours")
        .eq("employee_id", empId)
        .gte("check_in_time", startOfMonth)
        .lte("check_in_time", endOfMonth)
        .order("check_in_time", { ascending: false });

      setRecentLogs(logsData || []);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("WMS Yetki Kontrolü ->", { isGlobal, managerBranchId, girilenTerminalId: terminalId });

    if (terminalId.length !== 5) {
      setFeedback({ type: "error", msg: "GEÇERSİZ ID (5 HANELİ OLMALI)" });
      setTerminalId("");
      inputRef.current?.focus();
      return;
    }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(true);
    setFeedback(null);

    try {
      if (!isGlobal && !managerBranchId) {
         throw new Error("KİMLİK DOĞRULAMA HATASI: Şube kimliğiniz okunamadı. Sayfayı yenileyin.");
      }

      let query = supabase
        .from("employees")
        .select("id, full_name, branch_id, leave_balance, position_title")
        .eq("id", terminalId)
        .eq("is_active", true);

      if (!isGlobal) {
        query = query.eq("branch_id", managerBranchId);
      }

      const { data: empData, error } = await query.single();

      if (error || !empData) {
        throw new Error(
          isGlobal 
            ? "SİSTEMDE BÖYLE BİR PERSONEL BULUNAMADI." 
            : "ERİŞİM ENGELLENDİ: PERSONEL ŞUBENİZE KAYITLI DEĞİL!"
        );
      }

      if (!isGlobal && empData.branch_id !== managerBranchId) {
         throw new Error("GÜVENLİK İHLALİ: ÇAPRAZ ŞUBE ERİŞİMİ YASAKTIR!");
      }

      setEmployee(empData);
      setCurrentMonthDate(new Date());
      await fetchData(empData.id, new Date());
      setStep("DASHBOARD");
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message });
      setTerminalId("");
      inputRef.current?.focus();
      timeoutRef.current = setTimeout(() => setFeedback(null), 3500);
    } finally {
      setLoading(false);
    }
  };

const confirmCancel = async () => {
    if (!cancelModal || !employee) return;
    setLoading(true);
    try {
      // 1. RLS kalkanını delen Server Action'ı çağır (Tüm veritabanı yükünü sunucuya devrediyoruz)
      const result = await cancelLeaveRequestServer(
        cancelModal.id,
        employee.id,
        cancelModal.leave_type,
        cancelModal.requested_days,
        cancelModal.selected_dates,
        cancelModal.status
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      // 2. İşlem başarılıysa İstemci (Client) tarafındaki bakiyeyi güncelle
      if (cancelModal.status === 'APPROVED') {
        const nonRefundable = ['UCRETSİZ', 'ÜCRETSİZ', 'UCRETSIZ', 'SAGLIK_RAPORU', 'EVLILIK', 'VEFAT', 'DOGUM', 'MAZERET'];
        if (!nonRefundable.includes(cancelModal.leave_type)) {
          setEmployee({ ...employee, leave_balance: employee.leave_balance + cancelModal.requested_days });
        }
      }

      // 3. Tabloları tazele
      await fetchData(employee.id, currentMonthDate);
      
    } catch (err: any) {
      alert("İPTAL İŞLEMİ BAŞARISIZ: " + err.message);
    } finally {
      setCancelModal(null);
      setLoading(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; 
  };

  const handlePrevMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));

  const toggleDateSelection = (dateString: string) => {
    setSelectedDates(prev => 
      prev.includes(dateString) 
        ? prev.filter(d => d !== dateString) 
        : [...prev, dateString]              
    );
  };

  const generateCalendarDays = () => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const blanks = Array.from({ length: firstDay }, (_, i) => <div key={`blank-${i}`} className="p-2 border border-transparent"></div>);
    
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isSelected = selectedDates.includes(dateString);
      
      return (
        <button
          key={dateString}
          type="button"
          onClick={() => toggleDateSelection(dateString)}
          className={`h-11 w-full flex items-center justify-center rounded-none font-mono font-black text-xs transition-all border ${
            isSelected 
              ? "bg-[#dc3545] text-white border-[#dc3545] shadow-sm z-10 relative" 
              : "bg-white text-slate-700 border-slate-200 hover:border-[#0F172A] hover:bg-slate-50"
          }`}
        >
          {dayNum}
        </button>
      );
    });

    return [...blanks, ...days];
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    if (selectedDates.length === 0) {
      alert("Lütfen takvimden en az bir gün seçiniz.");
      return;
    }

    setLoading(true);

    const result = await submitLeaveRequest({
      employee_id: employee.id,
      branch_id: employee.branch_id,
      leave_type: leaveType,
      custom_leave_type: customType,
      selected_dates: selectedDates,
      is_half_day: isHalfDay,
      reason: reason,
    });

    if (result.success) {
      const { data } = await supabase.from("employees").select("leave_balance").eq("id", employee.id).single();
      if (data) setEmployee({ ...employee, leave_balance: data.leave_balance });
      
      await fetchData(employee.id, currentMonthDate);
      setStep("DASHBOARD");
      
      setLeaveType(""); setSelectedDates([]); setReason(""); setIsHalfDay(false); setCustomType("");
      router.refresh();
    } else {
      alert(`HATA: ${result.message}`);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    if(!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatTime = (isoStr: string) => {
    if (!isoStr) return "--:--";
    return new Date(isoStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase tracking-widest rounded-none"><CheckCircle2 className="w-3.5 h-3.5" /> ONAYLANDI</span>;
      case 'REJECTED': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-red-700 bg-red-50 border border-red-200 text-[10px] font-black uppercase tracking-widest rounded-none"><XCircle className="w-3.5 h-3.5" /> REDDEDİLDİ</span>;
      case 'CANCELLED': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-600 bg-slate-100 border border-slate-300 text-[10px] font-black uppercase tracking-widest rounded-none"><Ban className="w-3.5 h-3.5" /> İPTAL EDİLDİ</span>;
      case 'PENDING': default: return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-amber-700 bg-amber-50 border border-amber-200 text-[10px] font-black uppercase tracking-widest rounded-none"><Clock className="w-3.5 h-3.5" /> BEKLİYOR</span>;
    }
  };

  return (
    <div className="w-full flex flex-col bg-slate-100 border-2 border-slate-300 select-none relative rounded-none shadow-xl">
      
      {/* İPTAL / GERİ ÇEKME MODALI - Endüstriyel Keskin Tasarım */}
      {cancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4">
          <div className="bg-white rounded-none shadow-2xl w-full max-w-md border-t-4 border-[#dc3545] animate-in zoom-in-95 duration-200 overflow-hidden">
             <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center gap-3">
               <AlertCircle className="w-6 h-6 text-[#dc3545]" />
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">SİSTEM ONAYI BEKLENİYOR</h3>
             </div>
             <div className="p-6">
               <p className="text-sm font-bold text-slate-600 mb-6 leading-relaxed">
                  {cancelModal.status === 'APPROVED' 
                     ? "ONAYLANMIŞ izninizi iptal etmek üzeresiniz. Bu işlem sistem tarafından loglanacak ve uygunsa bakiye iadeniz sağlanacaktır. Onaylıyor musunuz?"
                     : "BEKLEYEN izin talebinizi iptal edip geri çekmek üzeresiniz. Onaylıyor musunuz?"}
               </p>
               <div className="flex gap-3">
                  <button onClick={() => setCancelModal(null)} disabled={loading} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-none font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-50 border border-slate-300">İPTAL / VAZGEÇ</button>
                  <button onClick={confirmCancel} disabled={loading} className="flex-1 bg-[#dc3545] hover:bg-red-700 text-white py-3 rounded-none font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-50 border border-[#dc3545]">
                    {loading ? "İŞLENİYOR..." : "EVET, İZNİ İPTAL ET"}
                  </button>
               </div>
             </div>
          </div>
        </div>
      )}

{/* GLOBAL HEADER & BİLGİ ALANI - WMS Command Center Style (EN ÜSTTE SABİT) */}
      <div className="w-full flex flex-col z-20 relative shadow-xl border-b-4 border-[#dc3545]">
        
        {/* 1. ÜST KISIM: ORİJİNAL HEADER (HER ZAMAN GÖRÜNÜR) */}
        <div className="w-full bg-[#0F172A] p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#dc3545] p-2.5 rounded-none border border-red-400/30">
              <TerminalSquare className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-[0.15em] uppercase flex items-center gap-2">
                PERSONEL İZİN KONTROL MERKEZİ
                {isGlobal && <span className="bg-[#dc3545] text-white px-2 py-0.5 rounded-none text-[9px] font-black tracking-widest ml-2">GLOBAL AUTH</span>}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 bg-[#dc3545] animate-pulse shadow-[0_0_5px_#dc3545]"></div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Puantaj & Devamsızlık Modülü</p>
              </div>
            </div>
          </div>

          {employee && (
            <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-none flex items-center gap-4 shadow-inner">
               <div className="flex flex-col text-right border-r border-slate-700 pr-4">
                 <span className="text-[9px] font-black text-[#dc3545] uppercase tracking-widest">{employee.position_title || "OPERATÖR"}</span>
                 <span className="text-xs font-black text-slate-100 tracking-widest uppercase">{employee.full_name}</span>
               </div>
               <button onClick={() => { setStep("LOGIN"); setEmployee(null); setTerminalId(""); }} className="text-[10px] font-black tracking-widest text-slate-400 hover:text-white uppercase transition-colors">
                 [ ÇIKIŞ ]
               </button>
            </div>
          )}
        </div>

        {/* 2. ALT KISIM: KUTULU BİLGİ MODÜLÜ VE 1:1 KARE GÖRSEL ALANI (SADECE GİRİŞ YAPILINCA AÇILIR) */}
        {employee && step === "DASHBOARD" && (
          <div className="w-full bg-slate-900 border-t border-slate-800 flex flex-col lg:flex-row items-stretch animate-in slide-in-from-top-4 fade-in duration-500">
            
            {/* Sistem Bilgi ve Kullanım Paneli (Sol Taraf) */}
            <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
              
              <div className="w-full bg-[#0b1121] border border-slate-700 shadow-inner flex flex-col">
                
                <div className="bg-slate-800/50 border-b border-slate-700 p-4 flex items-center gap-3">
                  <div className="bg-[#dc3545] p-1">
                    <TerminalSquare className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">SİSTEM BİLGİSİ VE KULLANIM KILAVUZU</h2>
                </div>
                
                <div className="p-5 md:p-6 grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6 relative overflow-hidden">
                   <Info className="absolute -right-4 -bottom-4 w-48 h-48 text-slate-800 opacity-20 pointer-events-none" />
                   
                   <div className="flex items-start gap-3 relative z-10">
                     <div className="bg-slate-800 p-1.5 border border-slate-600 shrink-0">
                       <ListChecks className="w-4 h-4 text-emerald-400" />
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest mb-1">NASIL KULLANILIR?</span>
                       <span className="text-[10px] font-bold text-slate-400 leading-relaxed">
                         Sisteme 5 haneli ID'niz ile giriş yaptıktan sonra, "Yeni İzin Talebi" butonuna basarak takvimden günleri seçin. Süreyi ve tipi belirleyip talebi yönetici onayına gönderin.
                       </span>
                     </div>
                   </div>

                   <div className="flex items-start gap-3 relative z-10">
                     <div className="bg-slate-800 p-1.5 border border-slate-600 shrink-0">
                       <Clock className="w-4 h-4 text-emerald-400" />
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest mb-1">OTOMATİK PUANTAJ</span>
                       <span className="text-[10px] font-bold text-slate-400 leading-relaxed">
                         Onaylanan izinleriniz, manuel bir işleme gerek kalmadan puantajınıza o gün için otomatik olarak 8 saat (mola: 0) şeklinde işlenir.
                       </span>
                     </div>
                   </div>

                   <div className="flex items-start gap-3 relative z-10">
                     <div className="bg-slate-800 p-1.5 border border-slate-600 shrink-0">
                       <ShieldAlert className="w-4 h-4 text-amber-400" />
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest mb-1">OTO-ONAY VE GÜVENLİK</span>
                       <span className="text-[10px] font-bold text-slate-400 leading-relaxed">
                         Yönetici hesapları ve Sağlık Raporları sistemden doğrudan onay alır. Tüm iptal ve gönderim hareketleri kimlik ID'niz üzerinden loglanır.
                       </span>
                     </div>
                   </div>

                   <div className="flex items-start gap-3 relative z-10">
                     <div className="bg-slate-800 p-1.5 border border-slate-600 shrink-0">
                       <History className="w-4 h-4 text-blue-400" />
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest mb-1">İPTAL VE BAKİYE İADESİ</span>
                       <span className="text-[10px] font-bold text-slate-400 leading-relaxed">
                         Geçmiş loglarınızdan onaylanmış veya bekleyen izinlerinizi iptal edebilirsiniz. İptal anında, kullanılan gün bakiyesi iade edilir ve hatalı loglar silinir.
                       </span>
                     </div>
                   </div>
                </div>

              </div>
            </div>

            {/* Görsel Alanı (Sağ Taraf) */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800">
              <div className="w-48 h-48 md:w-56 md:h-56 xl:w-72 xl:h-72 shrink-0 border-4 border-[#0F172A] shadow-2xl relative overflow-hidden group bg-slate-50">
                <div className="absolute inset-0 bg-[#dc3545] opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-10 pointer-events-none"></div>
                <img 
                  src="https://img.magnific.com/free-vector/integration-migrants-abstract-concept-vector-illustration-society-accepted-migrants-integration-courses-study-school-learn-foreign-languages-reading-book-refugee-group-abstract-metaphor_335657-1396.jpg?t=st=1782117154~exp=1782120754~hmac=b79817afbb65053f5614539b70235c8d74f8daac5bf47bf75c40d990dbaf9b23&w=1480" 
                  alt="System Integration" 
                  className="w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </div>

          </div>
        )}
      </div>

      {/* LOGIN SCREEN */}
      {step === "LOGIN" && (
        <div className="flex flex-col md:flex-row w-full min-h-[500px] bg-white animate-in fade-in duration-300">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-12 flex flex-col justify-center relative overflow-hidden border-r-2 border-slate-800">
            <img 
              src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop" 
              alt="WMS Warehouse Facility" 
              className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-screen grayscale" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-[#0F172A]/50"></div>
            <div className="relative z-10 border-l-4 border-[#dc3545] pl-6">
              <h2 className="text-2xl font-black tracking-[0.15em] uppercase text-white mb-2">OPERASYONEL KİMLİK</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                İZİN YÖNETİM MODÜLÜNE ERİŞMEK VE MEVCUT BAKİYELERİ KONTROL ETMEK İÇİN KİŞİSEL 5 HANELİ TERMİNAL ID NUMARANIZI GİRİNİZ.
              </p>
            </div>
          </div>

          <div className="w-full md:w-7/12 p-12 flex flex-col justify-center items-center bg-slate-50 relative">
            <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-6 relative z-10">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.15em]">PERSONEL SİCİL NO (ID)</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    ref={inputRef}
                    type="password" 
                    value={terminalId} 
                    onChange={(e) => {
                      setTerminalId(e.target.value.replace(/[^0-9]/g, ""));
                      if(feedback) setFeedback(null);
                    }} 
                    maxLength={5} 
                    disabled={loading} 
                    placeholder="•••••" 
                    className="h-16 w-full bg-white border-2 border-slate-300 rounded-none pl-14 pr-4 text-center text-3xl font-black tracking-[0.5em] outline-none transition-all duration-200 focus:border-[#0F172A] text-[#0F172A] shadow-inner" 
                    autoComplete="off" />
                </div>
              </div>
              <button type="submit" disabled={loading || terminalId.length !== 5} className={`h-14 w-full flex items-center justify-center rounded-none text-xs font-black tracking-[0.15em] uppercase transition-all duration-200 active:scale-95 ${loading || terminalId.length !== 5 ? "bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-slate-300" : "bg-[#0F172A] text-white hover:bg-[#dc3545] border-2 border-[#0F172A] hover:border-[#dc3545]"}`}>
                {loading ? "SİSTEM SORGULANIYOR..." : "KİMLİĞİ DOĞRULA"}
              </button>
            </form>

            <div className={`mt-6 max-w-sm w-full p-4 bg-white border-2 border-[#dc3545] text-[#dc3545] text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all duration-300 ease-in-out ${feedback ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={2} /> 
              <span>{feedback?.msg}</span>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD - Komuta Merkezi Görünümü */}
      {step === "DASHBOARD" && employee && (
        <div className="flex flex-col w-full min-h-[700px] bg-slate-50 animate-in fade-in duration-300">
          
          {/* ACTION BAR (Yeni tasarım mantığı: Tabloların yanındaki dev boşluk yerine üst bar) */}
          <div className="w-full bg-white border-b-2 border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                   <CalendarDays className="w-6 h-6 text-[#0F172A]" />
                </div>
                <div>
                   <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-widest">PERSONEL İZİN BİLGİ EKRANI</h2>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Mevcut Bakiyeler ve Geçmiş Loglar</p>
                </div>
             </div>
             <button 
                onClick={() => setStep("REQUEST_FORM")} 
                className="h-12 px-6 bg-[#dc3545] hover:bg-red-700 text-white flex items-center gap-3 rounded-none font-black text-[11px] tracking-widest uppercase transition-colors shadow-sm active:scale-95 border border-[#dc3545]"
             >
                <Plus className="w-4 h-4" strokeWidth={3} /> YENİ İZİN TALEBİ OLUŞTUR
             </button>
          </div>

          <div className="p-6 flex flex-col gap-6">
            
            {/* KPI KARTLARI - Dark Endüstriyel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-[#0F172A] border-l-4 border-emerald-500 p-6 flex flex-col justify-between relative overflow-hidden h-[160px] shadow-sm group">
  
  {/* WMS Endüstriyel Izgara (Grid) Arka Planı */}
  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>
  
  {/* Sağ Alt Dekoratif İkon */}
  <CalendarDays className="absolute -right-8 -bottom-8 w-40 h-40 text-emerald-500 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700 ease-out" strokeWidth={1} />

  <div className="relative z-10 flex justify-between items-start">
    <div className="flex flex-col">
      {/* Başlık ve Aktif Led */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="relative flex items-center justify-center">
          <div className="w-2 h-2 bg-emerald-500 rounded-none absolute animate-ping opacity-75"></div>
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-none relative z-10 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
        </div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] drop-shadow-sm">KULLANILABİLİR İZİN BAKİYESİ</span>
      </div>
      
      {/* Ana Rakam Alanı - Terminal Tipi */}
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-6xl font-black text-white font-mono tracking-tighter drop-shadow-md">
          {employee.leave_balance}
        </span>
        <span className="text-xs font-black text-emerald-500 uppercase tracking-[0.25em]">GÜN</span>
      </div>
    </div>

    {/* Sağ Üst WMS Statü Modülü */}
    <div className="flex flex-col items-end gap-1.5">
      <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 flex items-center gap-2 backdrop-blur-sm">
         <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
         <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.15em]">SİSTEM AKTİF</span>
      </div>
      <span className="text-[8px] text-slate-500 font-mono font-bold tracking-widest uppercase bg-[#0F172A] px-1">
        ID: {employee.id}
      </span>
    </div>
  </div>

  {/* Alt Dekoratif Veri Blokları (Matematiksel max değer gerektirmez, endüstriyel görsel katar) */}
  <div className="relative z-10 mt-auto flex items-center gap-4">
    <div className="flex-1 flex gap-1 h-1.5">
      <div className="bg-emerald-500 h-full w-full max-w-[15%]"></div>
      <div className="bg-emerald-500 h-full w-full max-w-[25%]"></div>
      <div className="bg-emerald-500/60 h-full w-full max-w-[20%]"></div>
      <div className="bg-emerald-500/30 h-full w-full max-w-[10%]"></div>
      <div className="bg-slate-700/50 h-full w-full flex-1 border-t border-b border-slate-700"></div>
    </div>
    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">
      GÜNCEL NET VERİ
    </span>
  </div>
</div>
              
              <div className="bg-white border-2 border-slate-200 p-6 flex flex-col justify-between h-[160px] shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">ONAY BEKLEYEN TALEPLER</span>
                    <span className="text-4xl font-black text-[#0F172A]">
                      {leaveRequests.filter(r => r.status === 'PENDING').length}
                    </span>
                  </div>
                  <div className="bg-slate-100 p-3 border border-slate-200">
                    <FileText className="w-6 h-6 text-slate-600" />
                  </div>
                </div>
                <div className="mt-auto bg-slate-50 p-2 border border-slate-200 flex items-center gap-2">
                   <Info className="w-4 h-4 text-slate-500" />
                   <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                     Onaylanan izinler puantaja otomatik 8 saat olarak işlenir.
                   </span>
                </div>
              </div>
            </div>

            {/* TABLOLAR - Alt alta ve Geniş */}
            <div className="flex flex-col xl:flex-row gap-6">
               
               {/* GEÇMİŞ İZİNLER */}
               <div className="flex-1 bg-white border-2 border-slate-200 shadow-sm flex flex-col min-h-[350px]">
                 <div className="bg-[#0F172A] p-4 border-b-4 border-slate-800 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <History className="w-4 h-4 text-[#dc3545]" />
                     <h3 className="text-[11px] font-black text-white uppercase tracking-widest">SON İZİN TALEPLERİ GEÇMİŞİ</h3>
                   </div>
                   <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase bg-slate-800 px-2 py-0.5 border border-slate-700">SON 6 KAYIT</span>
                 </div>
                 <div className="overflow-x-auto p-2">
                   <table className="w-full text-left border-collapse whitespace-nowrap">
                     <thead>
                       <tr className="border-b-2 border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                         <th className="p-4">Oluşturulma</th>
                         <th className="p-4">Tarih Aralığı</th>
                         <th className="p-4">İzin Tipi</th>
                         <th className="p-4 text-center">Süre</th>
                         <th className="p-4 text-right">Durum</th>
                         <th className="p-4 text-center">İşlem</th>
                       </tr>
                     </thead>
<tbody>
                        {leaveRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200">
                              SİSTEMDE İZİN KAYDI BULUNMUYOR
                            </td>
                          </tr>
                        ) : (
                          leaveRequests.map((req) => (
                            <tr key={req.id} className="border-b border-slate-200 hover:bg-slate-100 transition-colors">
                              
                              {/* OLUŞTURULMA */}
                              <td className="p-4 text-center align-middle font-mono text-xs font-bold text-slate-500">
                                {formatDate(req.created_at)}
                              </td>
                              
                              {/* TARİH ARALIĞI */}
                              <td className="p-4 text-center align-middle font-mono text-xs font-black text-slate-800">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="bg-white border border-slate-300 px-2 py-0.5 shadow-sm">{formatDate(req.start_date)}</span>
                                  <ArrowRight className="w-3 h-3 text-[#dc3545]" strokeWidth={3} />
                                  <span className="bg-white border border-slate-300 px-2 py-0.5 shadow-sm">{formatDate(req.end_date)}</span>
                                </div>
                              </td>
                              
                              {/* İZİN TİPİ */}
                              <td className="p-4 text-center align-middle font-black text-[10px] text-slate-700 uppercase tracking-widest">
                                <span className="bg-slate-200 border border-slate-300 px-2.5 py-1 shadow-inner">
                                  {req.leave_type === 'DIGER' ? req.custom_leave_type : req.leave_type.replace('_', ' ')}
                                </span>
                              </td>
                              
                              {/* SÜRE */}
                              <td className="p-4 text-center align-middle font-mono text-sm font-black text-[#dc3545]">
                                {req.requested_days} <span className="text-[9px] text-slate-500 ml-0.5">GÜN</span>
                              </td>
                              
                              {/* DURUM VE LOG */}
                              <td className="p-4 text-center align-middle">
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                  {getStatusBadge(req.status)}
                                  {req.status === 'REJECTED' && req.manager_note && (
                                    <div className="flex items-center justify-center gap-1.5 mt-0.5 text-[9px] font-black text-[#dc3545] max-w-[200px] bg-red-50 px-2 py-1 border border-[#dc3545]/30 shadow-sm" title={req.manager_note}>
                                      <MessageSquare className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                                      <span className="truncate">{req.manager_note.replace(/\[.*?\] - /, '')}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              
                              {/* AKSİYON */}
                              <td className="p-4 text-center align-middle">
                                {(req.status === 'PENDING' || req.status === 'APPROVED') ? (
                                   <button 
                                     onClick={() => setCancelModal(req)} 
                                     className="text-white bg-[#0F172A] hover:bg-[#dc3545] px-4 py-1.5 rounded-none transition-all duration-200 text-[10px] font-black tracking-widest uppercase flex items-center justify-center gap-1.5 mx-auto border-2 border-[#0F172A] hover:border-[#dc3545] active:scale-95 shadow-sm"
                                   >
                                     <XCircle className="w-3.5 h-3.5" strokeWidth={2.5} /> İPTAL
                                   </button>
                                ) : (
                                   <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">-</span>
                                )}
                              </td>
                              
                            </tr>
                          ))
                        )}
                      </tbody>
                   </table>
                 </div>
               </div>

               {/* AYLIK LOG */}
               <div className="flex-1 bg-white border-2 border-slate-200 shadow-sm flex flex-col min-h-[350px]">
                 <div className="bg-[#0F172A] p-4 border-b-4 border-[#dc3545] flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <ListChecks className="w-4 h-4 text-[#dc3545]" />
                     <h3 className="text-[11px] font-black text-white uppercase tracking-widest hidden sm:block">AYLIK MESAİ & İZİN LOG DÖKÜMÜ</h3>
                   </div>
                   <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1">
                     <button onClick={() => handlePrevMonth()} className="p-1 hover:bg-slate-700 transition-colors text-slate-300">
                       <ChevronLeft className="w-4 h-4" />
                     </button>
                     <span className="text-[10px] font-black text-white uppercase tracking-widest min-w-[100px] text-center">
                       {currentMonthDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                     </span>
                     <button onClick={() => handleNextMonth()} disabled={currentMonthDate.getMonth() === new Date().getMonth() && currentMonthDate.getFullYear() === new Date().getFullYear()} className="p-1 hover:bg-slate-700 transition-colors text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent">
                       <ChevronRight className="w-4 h-4" />
                     </button>
                   </div>
                 </div>
                 <div className="overflow-x-auto flex-1 p-2">
                   <table className="w-full text-left border-collapse whitespace-nowrap">
                     <thead>
                       <tr className="border-b-2 border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                         <th className="p-4">Tarih</th>
                         <th className="p-4 text-center">Durum / Saat</th>
                         <th className="p-4 text-center">Net Süre</th>
                       </tr>
                     </thead>
                     <tbody>
                       {recentLogs.length === 0 ? (
                         <tr><td colSpan={3} className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Kayıt Bulunmuyor</td></tr>
                       ) : (
                         recentLogs.map((log) => {
                           const isLeave = log.status && log.status.startsWith('LEAVE_');
                           const leaveText = isLeave ? log.status.replace('LEAVE_', '').replace('_', ' ') : '';
                           const isOpen = log.check_out_time === null;

                           return (
                             <tr key={log.id} className={`border-b border-slate-100 transition-colors ${isLeave ? 'bg-blue-50/20' : 'hover:bg-slate-50'}`}>
                               <td className="p-4 font-mono text-xs font-bold text-slate-500">{formatDate(log.check_in_time)}</td>
                               <td className="p-4 font-mono text-sm font-bold text-center">
                                 {isLeave ? (
                                   <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-dashed ${
                                     leaveText === 'SAGLIK RAPORU' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-blue-50 text-blue-700 border-blue-300'
                                   }`}>
                                     {leaveText === 'SAGLIK RAPORU' ? 'SAĞLIK RAPORU' : `${leaveText}`}
                                   </span>
                                 ) : (
                                   <div className="flex items-center justify-center">
                                     <span className="text-emerald-700">{formatTime(log.check_in_time)}</span>
                                     <ArrowRight className="inline w-4 h-4 text-slate-300 mx-3" />
                                     {isOpen ? <span className="text-white text-[10px] px-2 py-0.5 bg-[#dc3545] font-black animate-pulse">EKSİK</span> : <span className="text-slate-700">{formatTime(log.check_out_time)}</span>}
                                   </div>
                                 )}
                               </td>
                               <td className="p-4 font-mono text-sm font-black text-slate-800 text-center">
                                 <span className="bg-slate-100 border border-slate-200 px-2 py-0.5">{log.working_hours ? `${log.working_hours}s` : "-"}</span>
                               </td>
                             </tr>
                           );
                         })
                       )}
                     </tbody>
                   </table>
                 </div>
               </div>

            </div>
          </div>
        </div>
      )}

      {/* REQUEST FORM - Endüstriyel Keskin Tasarım */}
      {step === "REQUEST_FORM" && employee && (
        <div className="flex flex-col w-full bg-slate-50 animate-in fade-in duration-300 min-h-[700px]">
          
          <div className="bg-[#0F172A] p-5 border-b-4 border-[#dc3545] flex justify-between items-center">
            <h3 className="text-sm font-black text-white uppercase tracking-[0.1em] flex items-center gap-3">
              <Plus className="w-5 h-5 text-[#dc3545]" strokeWidth={3} /> YENİ İZİN TALEBİ OLUŞTUR
            </h3>
            <button onClick={() => setStep("DASHBOARD")} className="text-[10px] font-black text-white hover:bg-[#dc3545] uppercase tracking-widest px-4 py-2 border border-slate-600 hover:border-[#dc3545] transition-colors">
              İPTAL ET / GERİ DÖN
            </button>
          </div>

          <form onSubmit={submitRequest} className="p-6 md:p-8 flex flex-col lg:flex-row gap-8">
            
            <div className="w-full lg:w-1/2 flex flex-col gap-6">
              
              {willAutoApprove && leaveType !== '' && (
                 <div className="bg-slate-900 border-l-4 border-emerald-500 p-4 flex items-start gap-3 shadow-md">
                   <ShieldAlert className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                   <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">SİSTEM BİLGİSİ: OTO-ONAY AKTİF</span>
                     <span className="text-xs font-bold text-slate-300 leading-relaxed mt-1">
                       {isManager ? "Yönetici yetkiniz bulunduğu için bu talep sistem tarafından anında onaylanacaktır." : "Sağlık Raporları kurallar gereği sistem tarafından otomatik onaylanır."}
                     </span>
                   </div>
                 </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.15em]">İZİN TİPİ SEÇİMİ</label>
                <select required value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="h-14 border-2 border-slate-300 rounded-none px-4 text-xs font-black text-slate-800 focus:border-[#0F172A] outline-none uppercase shadow-inner cursor-pointer transition-all bg-white">
                  <option value="">LÜTFEN BİR TİP SEÇİNİZ...</option>
                  <option value="UCRETLI">Ücretli İzin</option>
                  <option value="UCRETSİZ">Ücretsiz İzin</option>
                  <option value="YILLIK_IZIN">Yıllık Ücretli İzin</option>
                  <option value="EVLILIK">Evlilik İzni</option>
                  <option value="MAZERET">Mazeret İzni</option>
                  <option value="VEFAT">Vefat İzni</option>
                  <option value="DOGUM">Doğum İzni</option>
                  <option value="SAGLIK_RAPORU" className="text-[#dc3545] font-black">SAĞLIK RAPORU (SİSTEM OTO-ONAY)</option>
                  <option value="DIGER">Diğer...</option>
                </select>
                {leaveType === "DIGER" && (
                  <input type="text" required placeholder="Manuel belirtin..." value={customType} onChange={(e) => setCustomType(e.target.value)} className="mt-3 h-14 border-2 border-[#dc3545] rounded-none px-4 text-xs font-black outline-none uppercase bg-white text-[#0F172A] shadow-inner" />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.15em]">KAPSAM (SÜRE TİPİ)</label>
                <div className="flex bg-slate-200 p-1 border-2 border-slate-300 h-14">
                  <button type="button" onClick={() => setIsHalfDay(false)} className={`flex-1 text-xs font-black uppercase tracking-widest transition-all ${!isHalfDay ? "bg-[#0F172A] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>TAM GÜN</button>
                  <button type="button" onClick={() => setIsHalfDay(true)} className={`flex-1 text-xs font-black uppercase tracking-widest transition-all ${isHalfDay ? "bg-[#0F172A] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>YARIM GÜN</button>
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.15em]">AÇIKLAMA / İZİN NOTU</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Yöneticinize iletilmek üzere not ekleyebilirsiniz..." className="w-full border-2 border-slate-300 rounded-none p-4 text-sm font-bold text-slate-700 focus:border-[#0F172A] outline-none flex-1 min-h-[140px] resize-none shadow-inner"></textarea>
              </div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col gap-6">
              
              <div className="flex flex-col bg-white border-2 border-slate-300 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.15em]">ÇOKLU TARİH SEÇİCİ</label>
                  <span className="bg-[#0F172A] text-white px-3 py-1 text-[10px] font-black tracking-widest">{selectedDates.length} GÜN SEÇİLDİ</span>
                </div>
                
                <div className="flex items-center justify-between bg-slate-100 p-2 border border-slate-300 mb-4">
                  <button type="button" onClick={handlePrevMonth} className="p-2 hover:bg-slate-200 transition-colors border border-transparent hover:border-slate-300"><ChevronLeft className="w-4 h-4 text-slate-800" /></button>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                    {currentMonthDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                  </span>
                  <button type="button" onClick={handleNextMonth} className="p-2 hover:bg-slate-200 transition-colors border border-transparent hover:border-slate-300"><ChevronRight className="w-4 h-4 text-slate-800" /></button>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2 text-center bg-slate-800 text-white p-2">
                  {['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CTS', 'PAZ'].map(d => (
                    <span key={d} className="text-[9px] font-black uppercase tracking-widest">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5 bg-slate-50 p-2 border border-slate-200">
                  {generateCalendarDays()}
                </div>
              </div>

              <div className="mt-auto bg-slate-900 border-l-4 border-[#dc3545] p-6 shadow-xl flex items-center justify-between gap-6 relative overflow-hidden">
                <div className="flex flex-col text-left relative z-10">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">HESAPLANAN SÜRE</span>
                   <span className="text-4xl font-black text-white font-mono tracking-wide">
                     {isHalfDay ? selectedDates.length * 0.5 : selectedDates.length} <span className="text-sm text-[#dc3545] ml-1 tracking-widest">GÜN</span>
                   </span>
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading || selectedDates.length === 0} 
                  className={`relative z-10 h-16 px-8 rounded-none text-[11px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-3 active:scale-95 border-2 ${
                    loading || selectedDates.length === 0
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700" 
                      : "bg-[#dc3545] border-[#dc3545] hover:bg-red-700 hover:border-red-700 text-white shadow-lg"
                  }`}
                >
                  {loading ? "İŞLENİYOR..." : <><Check className="w-5 h-5" strokeWidth={3} /> {willAutoApprove ? 'OTO-ONAYLA VE İŞLE' : 'TALEBİ GÖNDER'}</>}
                </button>
              </div>

            </div>
          </form>
        </div>
      )}

    </div>
  );
}