"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Clock, Lock, FileText, ArrowRight, Check, AlertCircle, Trash2, Edit2, ListChecks, Clock4, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { submitLogRequest } from "@/app/actions/attendance-requests";
import { useRouter } from "next/navigation";
import { useWms } from "@/components/providers/WmsSessionProvider";

type EmployeeData = { id: string; full_name: string; branch_id: string; position_title: string };

export default function LogRequestPanel() {
  const router = useRouter();
  const { managerBranchId, isGlobal } = useWms();

  const [step, setStep] = useState<"LOGIN" | "DASHBOARD" | "REQUEST_FORM">("LOGIN");
  const [terminalId, setTerminalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const [requestType, setRequestType] = useState<"NEW" | "EDIT">("NEW");
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string | null>(null);
  const [reqDate, setReqDate] = useState("");
  const [reqCheckIn, setReqCheckIn] = useState("");
  const [reqCheckOut, setReqCheckOut] = useState("");
  const [reqReason, setReqReason] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ekrana girildiğinde veya input silindiğinde otomatik Focus
  useEffect(() => {
    if (step === "LOGIN") {
      inputRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (employee && step === "DASHBOARD") {
      fetchData(employee.id, currentMonth);
    }
  }, [currentMonth, employee, step]);

  const extractDateForInput = (iso: string) => iso ? iso.split("T")[0] : "";
  const extractTimeForInput = (iso: string) => iso ? new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--";

  const fetchData = async (empId: string, targetMonth: Date) => {
    const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).toISOString();
    const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: logsData } = await supabase
      .from("attendance")
      .select("id, check_in_time, check_out_time, status, working_hours")
      .eq("employee_id", empId)
      .gte("check_in_time", startOfMonth)
      .lte("check_in_time", endOfMonth)
      .order("check_in_time", { ascending: false });

    const { data: reqData } = await supabase
      .from("attendance_requests")
      .select("id, request_date, req_check_in, req_check_out, reason, attendance_id")
      .eq("employee_id", empId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });

    setRecentLogs(logsData || []);
    setPendingRequests(reqData || []);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (terminalId.length !== 5) {
      setFeedback({ type: "error", msg: "5 HANELİ ID GİRİNİZ" });
      setTerminalId("");
      inputRef.current?.focus();
      return;
    }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(true); 
    setFeedback(null);

    try {
      const { data: empData, error } = await supabase
        .from("employees")
        .select("id, full_name, branch_id, position_title")
        .eq("id", terminalId)
        .eq("is_active", true)
        .single();

      if (error || !empData) throw new Error("SİSTEMDE BÖYLE BİR PERSONEL BULUNAMADI");

      if (!isGlobal && empData.branch_id !== managerBranchId) {
         throw new Error("ERİŞİM ENGELLENDİ: PERSONEL FARKLI BİR ŞUBEYE KAYITLI!");
      }

      setEmployee(empData);
      setCurrentMonth(new Date()); 
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

  // 🎯 ENUM ÇÖZÜMÜ: HIZLI SİLME
  const handleDeleteQuick = async (id: string) => {
    if (!employee) return;
    if (!window.confirm("Bu kaydı kalıcı olarak silmek istediğinize emin misiniz? (İşlem geri alınamaz)")) return;
    
    setLoading(true);
    const logRecord = recentLogs.find(l => l.id === id);
    const logDate = logRecord ? logRecord.check_in_time.split("T")[0] : new Date().toISOString().split("T")[0];

    const result = await submitLogRequest({
      employee_id: employee.id,
      manager_branch_id: managerBranchId,
      attendance_id: id,
      request_date: logDate,
      req_check_in: null,
      req_check_out: null,
      // DİKKAT: Veritabanında kesin var olan, risksiz bir ENUM seçeneği gönderiyoruz
      reason: "TERMINAL_ARIZASI", 
      action_mode: "DELETE"
    });

    if (result.success) {
      alert("Sistem Mesajı: Kayıt başarıyla silindi.");
      await fetchData(employee.id, currentMonth); 
      router.refresh();
    } else {
      alert(result.message);
    }
    setLoading(false);
  };

  // 🎯 ENUM ÇÖZÜMÜ: FORM İÇİNDEN SİLME
  const handleDeleteFromForm = async () => {
    if (!employee || !selectedAttendanceId) return;
    if (!window.confirm("KAYDI KALICI OLARAK SİLMEK İSTEDİĞİNİZE EMİN MİSİNİZ? (İşlem geri alınamaz)")) return;
    
    setLoading(true);
    const result = await submitLogRequest({
      employee_id: employee.id,
      manager_branch_id: managerBranchId,
      attendance_id: selectedAttendanceId,
      request_date: reqDate,
      req_check_in: null,
      req_check_out: null,
      // DİKKAT: Veritabanında kesin var olan, risksiz bir ENUM seçeneği gönderiyoruz
      reason: "TERMINAL_ARIZASI", 
      action_mode: "DELETE"
    });

    if (result.success) {
      alert("Sistem Mesajı: Kayıt silme işlemi başarıyla gerçekleştirildi.");
      await fetchData(employee.id, currentMonth); 
      setStep("DASHBOARD");
      router.refresh();
    } else {
      alert(result.message);
    }
    setLoading(false);
  };

  const handleEditClick = (log: any) => {
    setRequestType("EDIT");
    setSelectedAttendanceId(log.id);
    setReqDate(extractDateForInput(log.check_in_time));
    setReqCheckIn(extractTimeForInput(log.check_in_time));
    setReqCheckOut(log.check_out_time ? extractTimeForInput(log.check_out_time) : "");
    setReqReason("");
    setStep("REQUEST_FORM");
  };

  const handleNewRequestClick = () => {
    setRequestType("NEW");
    setSelectedAttendanceId(null);
    setReqDate(new Date().toISOString().split("T")[0]); 
    setReqCheckIn(""); setReqCheckOut(""); setReqReason("");
    setStep("REQUEST_FORM");
  };

  const calculatePreview = () => {
    if (!reqCheckIn || !reqCheckOut) return { net: 0, break: 0, isValid: false };
    const inTime = new Date(`1970-01-01T${reqCheckIn}:00`);
    const outTime = new Date(`1970-01-01T${reqCheckOut}:00`);
    if (outTime < inTime) outTime.setDate(outTime.getDate() + 1);
    
    const diffHours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
    const breakH = diffHours > 5 ? 1 : 0;
    
    let exactNet = Math.max(0, diffHours - breakH);
    let roundedNet = Math.round(exactNet * 4) / 4;

    return { net: roundedNet.toFixed(2), break: breakH, isValid: true };
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setLoading(true);
    const reqInIso = reqCheckIn ? new Date(`${reqDate}T${reqCheckIn}:00`).toISOString() : null;
    const reqOutIso = reqCheckOut ? new Date(`${reqDate}T${reqCheckOut}:00`).toISOString() : null;

    const result = await submitLogRequest({
      employee_id: employee.id,
      manager_branch_id: managerBranchId,
      attendance_id: selectedAttendanceId,
      request_date: reqDate,
      req_check_in: reqInIso,
      req_check_out: reqOutIso,
      reason: reqReason,
      action_mode: requestType
    });

    if (result.success) {
      await fetchData(employee.id, currentMonth); 
      setStep("DASHBOARD");
      router.refresh();
    } else {
      alert(result.message);
    }
    setLoading(false);
  };

  const preview = calculatePreview();

  return (
    <div className="w-full flex flex-col shadow-xl rounded-lg overflow-hidden border border-slate-200 select-none bg-white transition-all duration-300 ease-in-out">
      
      {/* SEAMLESS INDUSTRIAL DARK HEADING */}
      <div className="w-full bg-[#0F172A] p-6 flex flex-col md:flex-row items-center justify-between border-b-4 border-[#dc3545] gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#dc3545] p-2.5 rounded-md shadow-md">
            <Clock className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-[0.1em] uppercase flex items-center gap-2 drop-shadow-sm">
              MESAİ DÜZELTME MERKEZİ
              {isGlobal && <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-sm text-[9px] font-black border border-red-500/30 ml-2">GLOBAL AUTH</span>}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]"></div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.15em]">Retroaktif Log Yönetimi</p>
            </div>
          </div>
        </div>

        {employee && (
          <div className="bg-slate-800/80 px-4 py-2 border border-slate-700 rounded-md flex items-center gap-4 shadow-inner backdrop-blur-sm">
             <div className="flex flex-col text-right border-r border-slate-600 pr-4">
               <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{employee.position_title || "OPERATÖR"}</span>
               <span className="text-sm font-black text-slate-100 tracking-widest uppercase">{employee.full_name}</span>
             </div>
             <button onClick={() => { setStep("LOGIN"); setEmployee(null); setTerminalId(""); }} className="text-[10px] font-black tracking-widest text-[#dc3545] hover:text-red-400 uppercase transition-colors">
               [ ÇIKIŞ ]
             </button>
          </div>
        )}
      </div>

      {/* LOGIN EKRANI */}
      {step === "LOGIN" && (
        <div className="flex flex-col md:flex-row w-full min-h-[480px] animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full md:w-5/12 bg-[#0F172A] p-12 flex flex-col justify-center relative overflow-hidden">
            <img 
              src="https://img.magnific.com/free-vector/audience-segmentation-abstract-concept-illustration_335657-1854.jpg?t=st=1781592163~exp=1781595763~hmac=a25d35cd4feb77a55af727198f5d97a31a25253adfe91b37a953002dcd0c00f0&w=1480" 
              alt="Auth" 
              className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-screen" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-transparent"></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl font-black tracking-[0.1em] uppercase text-white mb-2 drop-shadow-md">KİMLİK DOĞRULAMA</h2>
              <div className="w-12 h-1.5 bg-[#dc3545] mb-5 rounded-full shadow-[0_0_10px_rgba(220,53,69,0.5)]"></div>
              <p className="text-[12px] font-bold text-slate-300 uppercase tracking-wide leading-relaxed">
                GEÇMİŞ MESAİ LOGLARINIZA ERİŞMEK VE DÜZELTME TALEBİ OLUŞTURMAK İÇİN 5 HANELİ KİMLİK NUMARANIZI SİSTEME GİRİNİZ.
              </p>
            </div>
          </div>
          
          <div className="w-full md:w-7/12 p-12 flex flex-col justify-center items-center bg-slate-50 relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-30 rounded-bl-full pointer-events-none"></div>
            
            <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-6 relative z-10">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Personel Sicil No</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
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
                    className="h-20 w-full bg-white border-2 border-slate-200 rounded-lg pl-16 pr-4 text-center text-4xl font-black tracking-[0.6em] outline-none transition-all duration-200 focus:border-[#dc3545] focus:ring-4 focus:ring-red-500/10 text-slate-800 shadow-sm" 
                    autoComplete="off" 
                  />
                </div>
              </div>
              <button type="submit" disabled={loading || terminalId.length !== 5} className={`h-14 w-full flex items-center justify-center rounded-lg text-sm font-black tracking-[0.1em] uppercase transition-all duration-200 shadow-md active:scale-95 ${loading || terminalId.length !== 5 ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300" : "bg-[#0F172A] text-white hover:bg-[#dc3545] border border-[#0F172A] hover:border-[#dc3545]"}`}>
                {loading ? "SORGULANIYOR..." : "SİSTEME GİRİŞ YAP"}
              </button>
            </form>

            <div className={`mt-6 max-w-sm w-full p-4 bg-red-50 border-l-4 border-[#dc3545] text-[#dc3545] text-[11px] font-black uppercase tracking-widest flex items-center gap-3 shadow-sm transition-all duration-300 ease-in-out ${feedback ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={2.5} /> 
              <span>{feedback?.msg}</span>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD (Ay Bazlı Listeleme ve Satır Butonları) */}
      {step === "DASHBOARD" && employee && (
        <div className="flex flex-col md:flex-row w-full min-h-[550px] bg-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-full md:w-8/12 bg-white p-8 flex flex-col gap-6 border-r border-slate-200 shadow-sm">
            
            {pendingRequests.length > 0 && (
              <div className="border border-orange-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-orange-50 p-4 border-b border-orange-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-600" />
                  <h3 className="text-[11px] font-black text-orange-800 uppercase tracking-widest">BEKLEYEN YÖNETİCİ ONAYLARI</h3>
                </div>
                <table className="w-full text-left">
                  <tbody>
                    {pendingRequests.map(req => (
                      <tr key={req.id} className="border-b border-orange-100 last:border-0 hover:bg-orange-50/50 transition-colors">
                        <td className="p-4 font-mono text-sm font-black text-orange-900">{formatDate(req.request_date)}</td>
                        <td className="p-4 font-mono text-sm font-bold text-orange-800">
                          {formatTime(req.req_check_in)} <ArrowRight className="inline w-3 h-3 text-orange-400 mx-2" /> {formatTime(req.req_check_out)}
                        </td>
                        <td className="p-4 text-right"><span className="bg-orange-200 text-orange-900 px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest">BEKLİYOR</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden flex-1 shadow-sm flex flex-col">
              <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 pl-2">
                  <ListChecks className="w-4 h-4 text-slate-500" />
                  <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest hidden sm:block">AYLIK MESAİ DÖKÜMÜ</h3>
                </div>

                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-md p-1 shadow-sm">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-slate-100 rounded-sm transition-colors text-slate-600">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-black text-[#0F172A] uppercase tracking-widest min-w-[120px] text-center">
                    {currentMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                  </span>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()} className="p-1 hover:bg-slate-100 rounded-sm transition-colors text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <th className="p-4">Tarih</th>
                      <th className="p-4">Giriş / Çıkış Saati</th>
                      <th className="p-4 text-center">Net</th>
                      <th className="p-4 text-right">Aksiyonlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                          BU AY İÇİN KAYIT BULUNAMADI
                        </td>
                      </tr>
                    ) : (
                      recentLogs.map(log => {
                        const isOpen = log.check_out_time === null;
                        const isLeave = log.status && log.status.startsWith('LEAVE_');
                        
                        return (
                          <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                            <td className="p-4 font-mono text-sm font-black text-slate-700">{formatDate(log.check_in_time)}</td>
                            
                            <td className="p-4 font-mono text-sm font-bold">
                              {isLeave ? (
                                <span className="text-blue-600 text-[10px] bg-blue-50 border border-blue-200 px-2 py-1 rounded-sm uppercase tracking-widest">
                                  {log.status.replace('LEAVE_', '').replace(/_/g, ' ')}
                                </span>
                              ) : (
                                <>
                                  <span className="text-emerald-600">{formatTime(log.check_in_time)}</span>
                                  <ArrowRight className="inline w-4 h-4 text-slate-300 mx-3" />
                                  {isOpen ? <span className="text-[#dc3545] text-[10px] border border-[#dc3545]/30 px-2 py-0.5 rounded-sm bg-red-50 font-black animate-pulse">EKSİK</span> : <span className="text-slate-600">{formatTime(log.check_out_time)}</span>}
                                </>
                              )}
                            </td>
                            
                            <td className="p-4 font-mono text-sm font-bold text-slate-500 text-center bg-slate-50/50">{log.working_hours ? `${log.working_hours}s` : "-"}</td>
                            
                            <td className="p-4">
                              <div className="flex justify-end gap-2 opacity-100 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                                {!isLeave && (
                                  isOpen ? (
                                    <button onClick={() => handleEditClick(log)} className="px-3 py-1.5 bg-[#dc3545] text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-sm">
                                      ÇIKIŞ EKLE
                                    </button>
                                  ) : (
                                    <button onClick={() => handleEditClick(log)} className="p-2 bg-slate-100 text-slate-600 rounded-md hover:bg-[#0F172A] hover:text-white transition-all shadow-sm" title="Düzenle">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )
                                )}
                                <button onClick={() => handleDeleteQuick(log.id)} className="p-2 bg-red-50 text-[#dc3545] rounded-md hover:bg-[#dc3545] hover:text-white transition-all shadow-sm" title="Kaydı Sil">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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

          <div className="w-full md:w-4/12 p-8 flex flex-col justify-center bg-slate-50">
            <button onClick={handleNewRequestClick} className="w-full h-36 bg-[#0F172A] hover:bg-[#dc3545] text-white rounded-lg shadow-lg flex flex-col items-center justify-center gap-3 transition-all duration-300 active:scale-95 group border border-[#0F172A] hover:border-[#dc3545]">
              <div className="bg-white/10 p-3 rounded-full group-hover:bg-white/20 transition-colors">
                <Plus className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <span className="text-xs font-black tracking-widest uppercase">YENİ KAYIT EKLE</span>
            </button>
          </div>
        </div>
      )}

      {/* YENİ FORM EKRANI (Açık Tema & Temiz Okunabilirlik) */}
      {step === "REQUEST_FORM" && employee && (
        <div className="flex flex-col w-full bg-slate-50 p-6 md:p-10 animate-in fade-in slide-in-from-right-8 duration-300">
          
          <div className="bg-white border border-slate-200 shadow-sm rounded-lg flex flex-col overflow-hidden">
            
            {/* Form Başlığı */}
            <div className="bg-slate-100 border-b border-slate-200 p-5 flex justify-between items-center">
              <h3 className="text-sm font-black text-[#0F172A] uppercase tracking-[0.1em] flex items-center gap-3">
                <Clock4 className="w-5 h-5 text-[#dc3545]" /> 
                {requestType === "NEW" ? "YENİ KAYIT OLUŞTUR" : "KAYIT GÜNCELLE"}
              </h3>
              {requestType === "EDIT" && (
                <button type="button" onClick={handleDeleteFromForm} disabled={loading} className="flex items-center gap-2 bg-red-50 hover:bg-[#dc3545] text-[#dc3545] hover:text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all border border-red-200 shadow-sm active:scale-95">
                  <Trash2 className="w-3.5 h-3.5" /> SİL
                </button>
              )}
            </div>

            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
              
              {/* Sol: Bilgi & Öngörü Paneli */}
              <div className="w-full md:w-1/3 flex flex-col gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col gap-5">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Lütfen mesai saatlerini <strong className="text-slate-700">gerçekleştiği şekilde</strong> giriniz. Sistem PDKS kuralı gereği süreleri otomatik olarak 15 dakikalık dilimlere yuvarlayacaktır.
                    </p>
                  </div>
                  
                  <div className="h-px w-full bg-slate-200"></div>
                  
                  <div className={`rounded-md p-4 border-l-4 transition-colors ${preview.isValid ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-100 border-slate-300'}`}>
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Net Mesai</span>
                      <span className={`text-2xl font-black font-mono tracking-wider ${preview.isValid ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {preview.isValid ? `${preview.net}s` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mola Kesintisi</span>
                      <span className={`text-sm font-black font-mono tracking-wider ${preview.isValid ? 'text-red-500' : 'text-slate-400'}`}>
                        {preview.isValid ? `${preview.break}s` : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sağ: Form Girdileri */}
              <form onSubmit={submitRequest} className="w-full md:w-2/3 flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">İşlem Tarihi</label>
                    <input type="date" required disabled={requestType === "EDIT"} value={reqDate} onChange={(e) => setReqDate(e.target.value)} className="h-12 border border-slate-300 rounded-md px-3 font-mono text-sm font-bold outline-none focus:border-[#dc3545] focus:ring-2 focus:ring-red-500/10 disabled:bg-slate-100 shadow-sm transition-all" />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Giriş Saati</label>
                    <input type="time" value={reqCheckIn} onChange={(e) => setReqCheckIn(e.target.value)} className="h-12 border border-slate-300 rounded-md px-3 font-mono text-lg text-center font-black text-emerald-600 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 bg-white shadow-sm transition-all" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Çıkış Saati</label>
                    <input type="time" value={reqCheckOut} onChange={(e) => setReqCheckOut(e.target.value)} className="h-12 border border-slate-300 rounded-md px-3 font-mono text-lg text-center font-black text-[#dc3545] outline-none focus:border-[#dc3545] focus:ring-2 focus:ring-red-500/10 bg-white shadow-sm transition-all" />
                  </div>

                  {/* 🎯 TİPOGRAFİ/ENUM HATASI İHTİMALİNE KARŞI DEĞERLER DB'YE UYGUN ("MANUEL_DULZELTME") YAZILDI AMA SİLMEDE "TERMINAL_ARIZASI" KULLANILARAK RİSK SIFIRLANDI */}
                  <div className="sm:col-span-2 flex flex-col gap-1.5 mt-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">İşlem Mazeret Nedeni</label>
                    <select required value={reqReason} onChange={(e) => setReqReason(e.target.value)} className="h-12 border border-slate-300 rounded-md px-3 text-xs font-bold text-slate-700 outline-none focus:border-[#dc3545] focus:ring-2 focus:ring-red-500/10 uppercase bg-white shadow-sm transition-all cursor-pointer">
                      <option value="">LÜTFEN SEÇİNİZ...</option>
                      <option value="TERMINAL_ARIZASI">Terminal Okumadı / Arızalıydı</option>
                      <option value="UNUTMA">Sisteme Okutmayı Unuttum</option>
                      <option value="DIS_GOREV">Dış Görevdeydim / Sahadaydım</option>
                      <option value="MANUEL_DULZELTME">Yönetici / Sistem Revizyonu</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setStep("DASHBOARD")} className="px-6 h-12 bg-white border border-slate-300 text-slate-600 text-[10px] font-black tracking-widest uppercase rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
                    İPTAL ET
                  </button>
                  <button type="submit" disabled={loading} className="px-8 h-12 bg-[#dc3545] text-white text-[10px] font-black tracking-widest uppercase rounded-md hover:bg-red-700 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? "İŞLENİYOR..." : <><Check className="w-4 h-4" strokeWidth={3} /> ONAYLA VE KAYDET</>}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}