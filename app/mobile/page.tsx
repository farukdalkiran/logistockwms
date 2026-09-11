"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { 
  Lock, Smartphone, RefreshCw, AlertCircle, LogOut, User, Clock, CheckCircle2,
  ShieldAlert, CalendarDays, History, Bell, CalendarX2, Building2
} from "lucide-react";
import { 
  getActiveEmployeesList, registerMobileDevice, getDynamicQrPayload, 
  getMonthlyAttendanceStats, getEmployeeAttendanceHistory, getMissingAttendanceDays, getActiveBranches
} from "../actions/mobile";

export default function MobileEmployeePanel() {
  const router = useRouter();

  const [isReady, setIsReady] = useState(false);
  const [view, setView] = useState<"onboarding" | "dashboard">("onboarding");
  
  const [branches, setBranches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [logistockId, setLogistockId] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Dashboard State'leri
  const [terminalCode, setTerminalCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [progress, setProgress] = useState(100);
  
  const [stats, setStats] = useState({ totalHours: 0, lateCount: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [missingDays, setMissingDays] = useState<string[]>([]); 
  const [showNotifications, setShowNotifications] = useState(false); 

  const [isRefreshing, setIsRefreshing] = useState(false);

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const fetchTimer = useRef<NodeJS.Timeout | null>(null);

  const loadDashboardData = async (empId: string, termCode: string, empName: string) => {
    setSelectedEmpId(empId);
    setTerminalCode(termCode);
    setEmployeeName(empName);
    
    const [s, h, missing] = await Promise.all([
      getMonthlyAttendanceStats(empId),
      getEmployeeAttendanceHistory(empId),
      getMissingAttendanceDays(empId)
    ]);
    
    setStats(s);
    setHistory(h);
    setMissingDays(missing);
    setView("dashboard");
  };

  useEffect(() => {
    const checkLocalSession = async () => {
      const savedEmpId = localStorage.getItem("wms_mobile_emp_id");
      const savedTerminal = localStorage.getItem("wms_mobile_terminal_code");
      const savedName = localStorage.getItem("wms_mobile_emp_name") || "Personel";
      
      if (savedEmpId && savedTerminal) {
        await loadDashboardData(savedEmpId, savedTerminal, savedName);
      } else {
        const branchList = await getActiveBranches();
        setBranches(branchList);
      }
      setIsReady(true);
    };
    checkLocalSession();
  }, []);

  // Şube Değişince O Şubenin Personellerini Çek
  useEffect(() => {
    if (selectedBranchId) {
      getActiveEmployeesList(selectedBranchId).then(list => {
        setEmployees(list);
        setSelectedEmpId(""); // Şube değiştiğinde personeli sıfırla
      });
    } else {
      setEmployees([]);
    }
  }, [selectedBranchId]);

  const getDeviceToken = () => {
    let token = localStorage.getItem("wms_device_token");
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem("wms_device_token", token);
    }
    return token;
  };

  const handlePreRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!selectedBranchId || !selectedEmpId || logistockId.length !== 5) {
      setError("Lütfen Şube, Ad-Soyad ve 5 haneli ID'nizi eksiksiz girin.");
      return;
    }
    if (selectedEmpId !== logistockId) {
      setError("Seçilen personel ile girilen ID eşleşmiyor.");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmRegister = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    
    const token = getDeviceToken();
    const res = await registerMobileDevice(selectedEmpId, logistockId, token);

    if (res.success && res.terminalCode) {
      localStorage.setItem("wms_mobile_emp_id", selectedEmpId);
      localStorage.setItem("wms_mobile_terminal_code", res.terminalCode);
      localStorage.setItem("wms_mobile_emp_name", res.fullName || "");
      await loadDashboardData(selectedEmpId, res.terminalCode, res.fullName || "");
    } else {
      setError(res.message || "İşlem başarısız. Bilgilerinizi kontrol edin.");
    }
    setLoading(false);
  };

  // --- DİNAMİK QR MOTORU VE GÜVENLİK (KILL-SWITCH) KONTROLÜ ---
  const generateNewQR = useCallback(async () => {
    if (!terminalCode) return;
    setIsRefreshing(true);
    
    const token = getDeviceToken();
    const res = await getDynamicQrPayload(terminalCode, token);
    
    // EĞER YÖNETİCİ CİHAZI VERİTABANINDAN SİLMİŞSE (NULL YAPMIŞSA)
    if (!res.success && res.reason === "REVOKED") {
       alert("GÜVENLİK UYARISI: Cihazınızın sistem bağlantısı yönetici tarafından kesilmiştir.");
       localStorage.clear();
       window.location.reload();
       return;
    }

    setQrPayload(res.payload || "");
    setProgress(100);
    setTimeout(() => setIsRefreshing(false), 500);
  }, [terminalCode]);

  useEffect(() => {
    if (view !== "dashboard" || !terminalCode) return;
    generateNewQR(); 
    
    progressTimer.current = setInterval(() => {
      setProgress((prev) => (prev > 0 ? prev - 1 : 0));
    }, 100);

    fetchTimer.current = setInterval(() => {
      generateNewQR();
    }, 10000);

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (fetchTimer.current) clearInterval(fetchTimer.current);
    };
  }, [view, terminalCode, generateNewQR]);

  const handleManualRefresh = () => {
    generateNewQR();
  };

  // Web Paneline Dönüş (Cihaz Kilidini KORUR)
  const handleLockScreen = () => {
    router.push('/login');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "GÜNAYDIN";
    if (hour < 18) return "İYİ ÇALIŞMALAR";
    return "İYİ AKŞAMLAR";
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return "--:--";
    return new Date(isoString).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };
  
  const formatDate = (isoString: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleDateString("tr-TR", { day: "numeric", month: "long" }); 
  };

  if (!isReady) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-t-[#dc3545] border-slate-200 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col relative select-none overflow-x-hidden">
      
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-lg overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#dc3545] px-4 py-3 flex items-center gap-2 text-white">
              <ShieldAlert size={20} />
              <span className="text-[13px] font-black uppercase tracking-widest">Cihaz Eşleştirme</span>
            </div>
            <div className="p-6 flex flex-col gap-4 text-center">
              <p className="text-sm font-bold text-slate-700 leading-relaxed">
                Bu akıllı telefon <strong>kalıcı olarak size</strong> zimmetlenecektir.
              </p>
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-md">
                <p className="text-[11px] font-bold text-orange-800 leading-relaxed">
                  Onayladıktan sonra kendi LogiStock ID'niz ile başka hiçbir telefondan giriş yapamazsınız. Başka bir personel de bu cihazı kullanamaz. Sadece Yöneticiniz sıfırlayabilir.
                </p>
              </div>
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50">
              <button 
                type="button" onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-4 text-[12px] font-black text-slate-500 hover:bg-slate-100 uppercase tracking-widest transition-colors"
              >
                İptal Et
              </button>
              <div className="w-px bg-slate-200"></div>
              <button 
                type="button" onClick={handleConfirmRegister}
                className="flex-1 py-4 text-[12px] font-black text-[#dc3545] hover:bg-red-50 uppercase tracking-widest transition-colors"
              >
                Kabul Et ve Kilitle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GÖRÜNÜM: 1 - CİHAZ EŞLEŞTİRME (ONBOARDING) */}
      {view === "onboarding" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
          <form onSubmit={handlePreRegister} className="w-full max-w-sm flex flex-col gap-5 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Smartphone className="w-8 h-8 text-[#dc3545]" />
              </div>
              <h1 className="text-slate-800 font-black text-xl tracking-widest uppercase">Cihaz Kaydı</h1>
              <p className="text-slate-400 text-xs mt-2 font-bold leading-relaxed uppercase tracking-wider">
                Personel Mobil Terminali
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-md flex items-center gap-2 text-[#dc3545] text-[11px] font-bold uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Çalıştığınız Şube</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select 
                  value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-md focus:border-[#dc3545] focus:bg-white outline-none text-[13px] font-bold text-slate-700 transition-colors appearance-none shadow-inner"
                >
                  <option value="">-- Şube Seçiniz --</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ad Soyad Seçimi</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select 
                  value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}
                  disabled={!selectedBranchId}
                  className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-md focus:border-[#dc3545] focus:bg-white outline-none text-[13px] font-bold text-slate-700 transition-colors appearance-none shadow-inner disabled:opacity-50"
                >
                  <option value="">-- Listeden Kendinizi Seçin --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position_title})</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">5 Haneli LogiStock ID</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password" inputMode="numeric" maxLength={5}
                  value={logistockId} onChange={(e) => setLogistockId(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-md focus:border-[#dc3545] focus:bg-white outline-none text-xl font-black text-slate-800 tracking-[0.4em] transition-colors shadow-inner"
                  placeholder="•••••" autoComplete="off"
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading || !selectedEmpId || logistockId.length !== 5}
              className="bg-[#dc3545] text-white font-black uppercase tracking-widest h-12 mt-4 rounded-md hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md active:scale-95"
            >
              {loading ? "KONTROL EDİLİYOR..." : "CİHAZI EŞLEŞTİR"}
            </button>
            
            <button type="button" onClick={() => router.push('/login')} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest text-center mt-2 transition-colors">
              Web Paneline Dön
            </button>
          </form>
        </div>
      )}

      {/* GÖRÜNÜM: 2 - KİŞİSEL MESAİ VE KİMLİK DASHBOARD'U */}
      {view === "dashboard" && (
        <div className="flex-1 flex flex-col relative z-10 overflow-y-auto pb-10">
          
          <div className="bg-[#dc3545] px-6 py-8 rounded-b-[2rem] shadow-lg mb-6 sticky top-0 z-30 flex justify-between items-start">
            <div className="text-white">
              <p className="text-[10px] font-black text-red-200 uppercase tracking-widest mb-1 opacity-90">{getGreeting()}</p>
              <h1 className="text-2xl font-black tracking-tight">{employeeName || "Personel"}</h1>
            </div>
            
            <div className="flex gap-2 relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm shadow-inner relative"
              >
                <Bell size={18} />
                {missingDays.length > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-amber-400 text-amber-900 text-[10px] font-black flex items-center justify-center rounded-full shadow-md animate-bounce">
                    {missingDays.length}
                  </span>
                )}
              </button>
              
              <button 
                onClick={handleLockScreen} 
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm shadow-inner" 
                title="Web Paneline Dön"
              >
                <LogOut size={18} />
              </button>

              {showNotifications && (
                <div className="absolute top-12 right-0 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-50">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Sistem Bildirimleri</span>
                  </div>
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {missingDays.length > 0 ? (
                      missingDays.map((date, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-red-50/50 hover:bg-red-50 rounded-md transition-colors mb-1">
                          <CalendarX2 className="w-5 h-5 text-[#dc3545] shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-slate-800">Eksik Mesai Kaydı</span>
                            <span className="text-[10px] text-slate-500 leading-tight mt-1">
                              <strong>{formatDate(date)}</strong> tarihine ait giriş/çıkış verisi veya izin kaydı bulunamadı. Lütfen yöneticinize bildirin.
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center flex flex-col items-center justify-center text-slate-400">
                        <CheckCircle2 size={24} className="mb-2 opacity-50 text-emerald-500" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Okunmamış Bildirim Yok</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 flex flex-col gap-6 max-w-md mx-auto w-full -mt-12 relative z-10">
            
            <div className="w-full bg-white rounded-xl overflow-hidden flex flex-col shadow-xl border border-slate-100">
              <div className="w-full bg-slate-100 h-1.5 relative">
                 <div className="bg-[#dc3545] h-full transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
              </div>

              <div className="px-5 py-4 flex justify-between items-center border-b border-slate-50">
                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span>
                    Dinamik Kimlik
                 </span>
                 <button 
                    onClick={handleManualRefresh} disabled={isRefreshing}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#dc3545] transition-colors bg-slate-50 px-2.5 py-1.5 rounded-full border border-slate-100 active:scale-95"
                  >
                    Yenile <RefreshCw size={12} className={isRefreshing ? "animate-spin text-[#dc3545]" : ""} />
                 </button>
              </div>
              
              <div className="p-6 flex items-center justify-center bg-white relative">
                <div className={`p-4 rounded-xl border border-slate-100 shadow-sm transition-opacity duration-300 ${isRefreshing ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
                  {qrPayload ? (
                    <QRCodeSVG value={qrPayload} size={220} level="M" fgColor="#0F172B" />
                  ) : (
                    <div className="w-[220px] h-[220px] flex items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-slate-200 animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col shadow-sm relative overflow-hidden">
                <Clock className="absolute -right-2 -bottom-2 w-14 h-14 text-slate-50" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 relative z-10">Aylık Toplam</span>
                <span className="text-xl font-black text-slate-800 relative z-10">{stats.totalHours}<span className="text-[10px] text-slate-400 ml-1 tracking-widest">SAAT</span></span>
              </div>
              <div className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col shadow-sm relative overflow-hidden">
                <AlertCircle className="absolute -right-2 -bottom-2 w-14 h-14 text-slate-50" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 relative z-10">Geç Kalma İhlali</span>
                <span className={`text-xl font-black relative z-10 ${stats.lateCount > 3 ? 'text-[#dc3545]' : stats.lateCount > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                  {stats.lateCount} <span className="text-[10px] opacity-70 ml-1 tracking-widest text-slate-400">KEZ</span>
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2 px-1">
                <History className="w-4 h-4 text-[#dc3545]" />
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Son Mesai Hareketleri</span>
              </div>
              
              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden flex flex-col divide-y divide-slate-50 shadow-sm">
                {history.length > 0 ? (
                  history.map((record) => {
                    const isLeave = record.status && record.status.startsWith('LEAVE_');
                    const leaveText = isLeave ? record.status.replace('LEAVE_', '').replace(/_/g, ' ') : '';
                    
                    return (
                      <div key={record.id} className="flex justify-between items-center p-4 text-xs hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <CalendarDays size={13} className="text-[#dc3545]" />
                            {formatDate(record.check_in_time)}
                          </span>
                          {isLeave ? (
                            <span className="text-[10px] font-black text-blue-600 tracking-wider uppercase bg-blue-50 px-2 py-0.5 rounded-full w-max">{leaveText}</span>
                          ) : (
                            <div className="flex gap-3 text-slate-500 font-mono text-[11px] font-bold">
                              <span>G: {formatTime(record.check_in_time)}</span>
                              <span>Ç: {record.check_out_time ? formatTime(record.check_out_time) : "--:--"}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 shrink-0">
                           {isLeave ? (
                             <span className="text-xs font-black text-slate-400">Onaylı İzin</span>
                           ) : (
                             <span className={`text-[13px] font-black ${record.check_out_time ? 'text-slate-800' : 'text-emerald-500'}`}>
                               {record.working_hours ? `${Math.floor(record.working_hours)}S` : (record.check_out_time ? "0S" : "İÇERİDE")}
                             </span>
                           )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-slate-400 text-[11px] font-bold uppercase tracking-wider flex flex-col items-center gap-2">
                    <Clock size={20} className="opacity-20" />
                    Henüz kayıt bulunmuyor
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}