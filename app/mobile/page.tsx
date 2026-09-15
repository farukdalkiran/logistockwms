"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { 
  Lock, Smartphone, RefreshCw, AlertCircle, LogOut, User, Clock, CheckCircle2,
  ShieldAlert, CalendarDays, History, Bell, CalendarX2, Building2, WifiOff, ScanLine
} from "lucide-react";
import { 
  getActiveEmployeesList, registerMobileDevice, getDynamicQrPayload, 
  getMonthlyAttendanceStats, getEmployeeAttendanceHistory, getMissingAttendanceDays, getActiveBranches
} from "../actions/mobile"; // Dosya yolunu kendi yapına göre ayarla

// --- KALICI HAFIZA MOTORU ---
const setPersistentData = (key: string, value: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
    const d = new Date();
    d.setTime(d.getTime() + (10 * 365 * 24 * 60 * 60 * 1000));
    document.cookie = `${key}=${value};expires=${d.toUTCString()};path=/`;
  }
};

const getPersistentData = (key: string) => {
  if (typeof window === "undefined") return null;
  let val = localStorage.getItem(key);
  if (!val) {
    const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
    if (match) {
      val = match[2];
      localStorage.setItem(key, val);
    }
  }
  return val;
};

const clearPersistentData = () => {
  if (typeof window !== "undefined") {
    localStorage.clear();
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
  }
};

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
  const [isOffline, setIsOffline] = useState(false); // YENİ: Ağ Kopma Durumu
  
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
    
    try {
      const [s, h, missing] = await Promise.all([
        getMonthlyAttendanceStats(empId),
        getEmployeeAttendanceHistory(empId),
        getMissingAttendanceDays(empId)
      ]);
      setStats(s);
      setHistory(h);
      setMissingDays(missing);
    } catch (e) {
      console.error("İstatistikler yüklenemedi", e);
    }
    
    setView("dashboard");
  };

  useEffect(() => {
    const checkLocalSession = async () => {
      const savedEmpId = getPersistentData("wms_mobile_emp_id");
      const savedTerminal = getPersistentData("wms_mobile_terminal_code");
      const savedName = getPersistentData("wms_mobile_emp_name") || "Personel";
      
      if (savedEmpId && savedTerminal) {
        setPersistentData("wms_mobile_emp_id", savedEmpId);
        setPersistentData("wms_mobile_terminal_code", savedTerminal);
        await loadDashboardData(savedEmpId, savedTerminal, savedName);
      } else {
        const branchList = await getActiveBranches();
        setBranches(branchList);
      }
      setIsReady(true);
    };
    checkLocalSession();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      getActiveEmployeesList(selectedBranchId).then(list => {
        setEmployees(list);
        setSelectedEmpId(""); 
      });
    } else {
      setEmployees([]);
    }
  }, [selectedBranchId]);

  const getDeviceToken = () => {
    let token = getPersistentData("wms_device_token");
    if (!token) {
      token = crypto.randomUUID();
      setPersistentData("wms_device_token", token);
    }
    return token;
  };

  const handlePreRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedBranchId || !selectedEmpId || logistockId.length !== 5) {
      setError("Şube, Personel Seçimi ve 5 Haneli Kimlik Numarası Zorunludur.");
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
      setPersistentData("wms_mobile_emp_id", selectedEmpId);
      setPersistentData("wms_mobile_terminal_code", res.terminalCode);
      setPersistentData("wms_mobile_emp_name", res.fullName || "");
      await loadDashboardData(selectedEmpId, res.terminalCode, res.fullName || "");
    } else {
      setError(res.message || "İşlem başarısız. Bilgilerinizi kontrol edin.");
    }
    setLoading(false);
  };

  // --- AKILLI DİNAMİK QR MOTORU (Soft-Fail & Visibility API) ---
  const generateNewQR = useCallback(async () => {
    if (!terminalCode || document.hidden) return; // Ekran kilitliyse sunucuyu yorma
    
    setIsRefreshing(true);
    try {
      const token = getDeviceToken();
      const res = await getDynamicQrPayload(terminalCode, token);
      
      if (!res.success) {
        if (res.reason === "REVOKED") {
           // SADECE Gerçekten silindiyse oturumu kapat
           alert("GÜVENLİK İHLALİ: Cihazınızın erişim yetkisi Merkez Komuta tarafından askıya alınmıştır.");
           clearPersistentData();
           window.location.reload();
        } else {
           // Ağ hatası, Supabase Timeout vs. -> Çıkış yapma, Offline Mod'a geç
           setIsOffline(true);
        }
      } else {
        setQrPayload(res.payload || "");
        setProgress(100);
        setIsOffline(false); // Bağlantı geldi, arayüzü canlandır
      }
    } catch (err) {
      setIsOffline(true);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
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

    // EKSTRA GÜÇ: Ekran kilitlenip açıldığında (Uykudan Uyanma) anında yeni QR çek. 
    // Throttling/Race Condition'ı önler.
    const handleVisibilityChange = () => {
      if (!document.hidden) generateNewQR();
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (fetchTimer.current) clearInterval(fetchTimer.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [view, terminalCode, generateNewQR]);

  const handleManualRefresh = () => generateNewQR();
  const handleLockScreen = () => router.push('/login');

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
    return new Date(isoString).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }); 
  };

  if (!isReady) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-t-[#dc3545] border-slate-800 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className={`min-h-screen font-['Quicksand'] flex flex-col relative select-none overflow-x-hidden ${view === 'onboarding' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#dc3545] px-4 py-3 flex items-center gap-2 text-white">
              <ShieldAlert size={18} />
              <span className="text-[13px] font-black uppercase tracking-widest">Donanım Mühürleme</span>
            </div>
            <div className="p-6 flex flex-col gap-4 text-center">
              <p className="text-sm font-bold text-slate-300 leading-relaxed">
                Bu akıllı telefon cihazı <strong className="text-white">kalıcı olarak size</strong> zimmetlenecektir.
              </p>
              <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-md">
                <p className="text-[11px] font-bold text-orange-400 leading-relaxed uppercase tracking-wider">
                  Onaylandıktan sonra bu ID ile başka cihazdan giriş yapılamaz. Cihazı sadece Merkez Komuta sıfırlayabilir.
                </p>
              </div>
            </div>
            <div className="flex border-t border-slate-800 bg-slate-900/50">
              <button 
                type="button" onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-4 text-[12px] font-black text-slate-500 hover:text-slate-300 hover:bg-slate-800 uppercase tracking-widest transition-colors"
              >
                İptal Et
              </button>
              <div className="w-px bg-slate-800"></div>
              <button 
                type="button" onClick={handleConfirmRegister}
                className="flex-1 py-4 text-[12px] font-black text-[#dc3545] hover:bg-red-950/30 uppercase tracking-widest transition-colors"
              >
                Kabul Et & Kilitle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GÖRÜNÜM: 1 - CİHAZ EŞLEŞTİRME (DARK-INDUSTRIAL TASARIM) */}
      {view === "onboarding" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
          
          <div className="w-full max-w-sm mb-6 flex flex-col items-center gap-3">
             <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center shadow-lg shadow-black/50">
               <ScanLine className="w-8 h-8 text-[#dc3545]" />
             </div>
             <div className="text-center">
               <h1 className="text-white font-black text-2xl tracking-[0.2em] uppercase">LOGISTOCK</h1>
               <p className="text-[#dc3545] text-[10px] mt-1 font-bold leading-relaxed uppercase tracking-[0.3em]">
                 Terminal Bağlantı Modülü
               </p>
             </div>
          </div>

          <form onSubmit={handlePreRegister} className="w-full max-w-sm flex flex-col gap-5 bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800">
            
            {error && (
              <div className="bg-red-950/50 border border-red-900/50 p-3 rounded-md flex items-center gap-2 text-red-400 text-[11px] font-bold uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div> Operasyon Noktası
              </label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <select 
                  value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 bg-slate-950 border border-slate-800 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-[13px] font-bold text-slate-200 transition-all appearance-none"
                >
                  <option value="" className="text-slate-600">-- LOKASYON SEÇİN --</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-slate-700 rounded-full"></div> Personel Kimliği
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <select 
                  value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}
                  disabled={!selectedBranchId}
                  className="w-full h-14 pl-12 pr-4 bg-slate-950 border border-slate-800 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-[13px] font-bold text-slate-200 transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" className="text-slate-600">-- PERSONEL SEÇİN --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position_title})</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#dc3545] rounded-full animate-pulse shadow-[0_0_8px_#dc3545]"></div> Doğrulama PİN (5 Hane)
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <input
                  type="password" inputMode="numeric" maxLength={5}
                  value={logistockId} onChange={(e) => setLogistockId(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-14 pl-12 pr-4 bg-slate-950 border border-slate-800 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-2xl font-black text-white tracking-[0.5em] transition-all"
                  placeholder="•••••" autoComplete="off"
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading || !selectedEmpId || logistockId.length !== 5}
              className="bg-[#dc3545] text-white font-black uppercase tracking-[0.2em] h-14 mt-4 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(220,53,69,0.39)] active:scale-[0.98]"
            >
              {loading ? "MÜHÜRLENİYOR..." : "CİHAZI BAĞLA"}
            </button>
            
            <button type="button" onClick={() => router.push('/login')} className="text-[10px] font-bold text-slate-600 hover:text-slate-400 uppercase tracking-[0.2em] text-center mt-2 transition-colors">
              Web Paneline Dön
            </button>
          </form>
          
          <p className="text-slate-700 text-[9px] font-bold uppercase tracking-[0.3em] mt-8">
            LOGISTOCK WMS CORE V2.4
          </p>
        </div>
      )}

      {/* GÖRÜNÜM: 2 - KİŞİSEL MESAİ VE KİMLİK DASHBOARD'U (Terminal Tasarımı) */}
      {view === "dashboard" && (
        <div className="flex-1 flex flex-col relative z-10 overflow-y-auto pb-10">
          
          <div className="bg-slate-900 px-6 py-8 shadow-xl mb-6 sticky top-0 z-30 flex justify-between items-start border-b border-slate-800">
            <div className="text-white">
              <p className="text-[10px] font-black text-[#dc3545] uppercase tracking-[0.2em] mb-1">{getGreeting()}</p>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                {employeeName || "Personel"}
                <div className="bg-slate-800 p-1.5 rounded-md border border-slate-700 shadow-inner">
                  <Smartphone size={16} className="text-slate-300" strokeWidth={2.5} />
                </div>
              </h1>
            </div>
            
            <div className="flex gap-3 relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 relative"
              >
                <Bell size={18} />
                {missingDays.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md animate-pulse">
                    {missingDays.length}
                  </span>
                )}
              </button>
              
              <button 
                onClick={handleLockScreen} 
                className="w-10 h-10 bg-[#dc3545]/10 rounded-lg flex items-center justify-center text-[#dc3545] hover:bg-[#dc3545] hover:text-white transition-colors border border-[#dc3545]/30" 
              >
                <LogOut size={18} />
              </button>
              
              {/* Bildirim Paneli */}
              {showNotifications && (
                <div className="absolute top-12 right-0 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-50">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Sistem Bildirimleri</span>
                  </div>
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {missingDays.length > 0 ? (
                      missingDays.map((date, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 hover:bg-red-100 rounded-md transition-colors mb-1">
                          <CalendarX2 className="w-5 h-5 text-[#dc3545] shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-slate-800">Eksik Mesai Kaydı</span>
                            <span className="text-[10px] text-slate-500 leading-tight mt-1">
                              <strong>{formatDate(date)}</strong> tarihine ait giriş/çıkış veya izin kaydı bulunamadı.
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

          <div className="px-5 flex flex-col gap-6 max-w-md mx-auto w-full -mt-10 relative z-10">
            
            <div className="w-full bg-white rounded-xl overflow-hidden flex flex-col shadow-xl border border-slate-200">
              <div className="w-full bg-slate-100 h-1.5 relative overflow-hidden">
                 <div 
                   className={`h-full transition-all duration-100 ease-linear ${isOffline ? 'bg-slate-300' : 'bg-[#dc3545]'}`} 
                   style={{ width: `${progress}%` }}
                 ></div>
              </div>

              <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100 bg-slate-50">
                 <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    {isOffline ? (
                       <><WifiOff size={12} className="text-orange-500" /> BAĞLANTI BEKLENİYOR</>
                    ) : (
                       <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span> AKTİF KİMLİK</>
                    )}
                 </span>
                 <button 
                    onClick={handleManualRefresh} disabled={isRefreshing}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#dc3545] transition-colors bg-white px-3 py-1.5 rounded-md border border-slate-200 active:scale-95 shadow-sm"
                  >
                    Yenile <RefreshCw size={12} className={isRefreshing ? "animate-spin text-[#dc3545]" : ""} />
                 </button>
              </div>
              
              <div className="p-8 flex items-center justify-center bg-white relative">
                <div className={`p-4 rounded-xl border border-slate-100 shadow-sm transition-all duration-300 ${isRefreshing || isOffline ? 'opacity-30 scale-95 grayscale' : 'opacity-100 scale-100'}`}>
                  {qrPayload && !isOffline ? (
                    <QRCodeSVG value={qrPayload} size={220} level="M" fgColor="#0F172B" />
                  ) : (
                    <div className="w-[220px] h-[220px] flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      {isOffline ? (
                         <>
                           <WifiOff className="w-10 h-10 text-orange-300" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-center text-slate-400">Sunucu Bağlantısı<br/>Bekleniyor...</span>
                         </>
                      ) : (
                         <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* İstatistik ve Geçmiş Bölümü Orijinal Formatında (Light Industrial) Bırakıldı */}
            <div className="w-full grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm relative overflow-hidden">
                <Clock className="absolute -right-3 -bottom-3 w-16 h-16 text-slate-50" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 relative z-10">Aylık Toplam</span>
                <span className="text-2xl font-black text-slate-800 relative z-10">{stats.totalHours}<span className="text-[10px] text-slate-400 ml-1 tracking-widest">SAAT</span></span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm relative overflow-hidden">
                <AlertCircle className="absolute -right-3 -bottom-3 w-16 h-16 text-slate-50" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 relative z-10">İhlal / Geç Kalma</span>
                <span className={`text-2xl font-black relative z-10 ${stats.lateCount > 3 ? 'text-[#dc3545]' : stats.lateCount > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                  {stats.lateCount} <span className="text-[10px] opacity-70 ml-1 tracking-widest text-slate-400">KEZ</span>
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2 px-1">
                <History className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em]">Son Hareket Dökümü</span>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col divide-y divide-slate-100 shadow-sm">
                {history.length > 0 ? (
                  history.map((record) => {
                    const isLeave = record.status && record.status.startsWith('LEAVE_');
                    const leaveText = isLeave ? record.status.replace('LEAVE_', '').replace(/_/g, ' ') : '';
                    
                    return (
                      <div key={record.id} className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                            <CalendarDays size={13} className="text-[#dc3545]" />
                            {formatDate(record.check_in_time)}
                          </span>
                          {isLeave ? (
                            <span className="text-[10px] font-black text-blue-600 tracking-wider uppercase bg-blue-50 px-2 py-0.5 rounded-md w-max border border-blue-100">{leaveText}</span>
                          ) : (
                            <div className="flex gap-4 text-slate-500 font-mono text-[12px] font-bold">
                              <span>G: {formatTime(record.check_in_time)}</span>
                              <span>Ç: {record.check_out_time ? formatTime(record.check_out_time) : "--:--"}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end justify-center shrink-0">
                           {isLeave ? (
                             <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">ONAYLI</span>
                           ) : (
                             <span className={`text-[15px] font-black ${record.check_out_time ? 'text-slate-800' : 'text-emerald-500'}`}>
                               {record.working_hours ? `${Math.floor(record.working_hours)} S` : (record.check_out_time ? "0 S" : "İÇERİDE")}
                             </span>
                           )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-slate-400 text-[11px] font-bold uppercase tracking-widest flex flex-col items-center gap-3 bg-slate-50">
                    <Clock size={24} className="opacity-30" />
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