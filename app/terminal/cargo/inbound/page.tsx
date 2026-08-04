"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  TerminalSquare, MapPin, ShieldCheck, ArrowLeft, 
  Barcode, CheckCircle, Package, AlertCircle, Save, AlertTriangle, RotateCcw, Play, Clock
} from "lucide-react";

// Server Actions
import { 
  getEmployeeBranchServer, getActiveCargoSessions, getSessionLogsServer, 
  createCargoSessionServer, logCargoBarcodeServer, completeCargoSessionServer 
} from "@/app/actions/cargo";

// Merkezi konfigürasyon
import { CARRIERS, validateCargoBarcode } from "@/lib/cargoConfig";

interface ActiveSession {
  id: string;
  carrier_name: string;
  started_at: string;
}

export default function CargoInboundPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Terminal Props
  const empId = searchParams.get("empId") || "Bilinmiyor";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube";

  // State Yönetimi
  const [empBranchId, setEmpBranchId] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [session, setSession] = useState<{ id?: string; carrier: string; status: string } | null>(null);
  const [barcode, setBarcode] = useState("");
  const [scannedItems, setScannedItems] = useState<{ tracking: string; time: string }[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [flashStatus, setFlashStatus] = useState<"success" | "error" | null>(null);
  
  // Modal State
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  // Başlangıç: Şube Çekimi (Server Action)
  useEffect(() => {
    const fetchBranch = async () => {
      const res = await getEmployeeBranchServer(empId);
      if (res.success && res.branchId) {
        setEmpBranchId(res.branchId);
      } else {
        setErrorMsg("Şube yetkisi reddedildi!");
      }
    };
    if (empId !== "Bilinmiyor") fetchBranch();
  }, [empId]);

  // Açık Oturumları Çek
  useEffect(() => {
    if (empBranchId && !session) {
      loadActiveSessions();
    }
  }, [empBranchId, session]);

  // Canlı Saat
  useEffect(() => {
    const updateClock = () => {
      setClock(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Terminal Auto-Focus
  useEffect(() => {
    if (session && session.status === "ACTIVE" && !isCompleteModalOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [session, barcode, errorMsg, flashStatus, isCompleteModalOpen]);

  // Ses Motoru
  const playSound = (type: "success" | "error") => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // Sessiz yut
    }
  };

  const triggerFlash = (status: "success" | "error") => {
    setFlashStatus(status);
    const timeout = setTimeout(() => setFlashStatus(null), 800);
    return () => clearTimeout(timeout);
  };

  // MİMARİ: Açık Oturumları Yükle
  const loadActiveSessions = async () => {
    if (!empBranchId) return;
    const res = await getActiveCargoSessions(empBranchId);
    if (res.success && res.data) {
      setActiveSessions((res.data as ActiveSession[]) || []);
    } else {
      setErrorMsg(res.error || "Oturumlar getirilemedi.");
    }
  };

  // MİMARİ: Var Olan Bir Oturuma Devam Et (Resume)
  const handleResumeSession = async (activeSession: ActiveSession) => {
    setIsLoading(true);
    setErrorMsg("");
    
    const res = await getSessionLogsServer(activeSession.id);
    if (res.success && res.data) {
      const mappedLogs = res.data.map((log: any) => ({
        tracking: log.tracking_number,
        time: "GEÇMİŞ" 
      }));
      setScannedItems(mappedLogs);
      setSession({ id: activeSession.id, carrier: activeSession.carrier_name, status: "ACTIVE" });
      playSound("success");
    } else {
      setErrorMsg("Oturum verileri geri yüklenemedi!");
      playSound("error"); triggerFlash("error");
    }
    setIsLoading(false);
  };

  // MİMARİ: Sıfırdan Yeni Oturum Başlat
  const handleStartNewSession = (carrierName: string) => {
    if (!empBranchId) {
      setErrorMsg("Güvenlik Hatası: Şube yetkisi doğrulanamadı!");
      triggerFlash("error");
      return;
    }
    setScannedItems([]);
    setSession({ carrier: carrierName, status: "ACTIVE" });
    playSound("success");
  };

  // ANA MOTOR: Barkod Okutma (Server Action Loglama & TS Strict Fix)
  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcode.trim() !== "") {
      const scannedCode = barcode.trim().toUpperCase();
      setBarcode(""); 

      if (!session || session.status !== "ACTIVE") {
        setErrorMsg("HATA: Oturum kapalı, okutma yapılamaz!");
        playSound("error"); triggerFlash("error"); return;
      }

      const validation = validateCargoBarcode(session.carrier, scannedCode);
      if (!validation.isValid) {
        setErrorMsg(validation.errorMsg || "GEÇERSİZ BARKOD!");
        playSound("error"); triggerFlash("error"); return;
      }

      if (scannedItems.some(item => item.tracking === scannedCode)) {
        setErrorMsg(`MÜKERRER: ${scannedCode} ZATEN OKUTULDU!`);
        playSound("error"); triggerFlash("error"); return;
      }

      setErrorMsg(""); 
      let currentSessionId = session.id;

      // Lazy Insertion: İlk barkodsa oturumu DB'ye kaydet
      if (!currentSessionId) {
        if (!empBranchId) return;
        const res = await createCargoSessionServer(empId, empBranchId, session.carrier);
        if (res.success && res.id) {
          currentSessionId = res.id;
          setSession(prev => prev ? { ...prev, id: currentSessionId } : null);
        } else {
          setErrorMsg("SİSTEM HATASI: Kargo oturumu oluşturulamadı!");
          playSound("error"); triggerFlash("error"); return;
        }
      }

      // VERCEL TS STRICT FIX: currentSessionId'nin kesinlikle string olduğunu garantile (Type Guard)
      if (!currentSessionId) {
        setErrorMsg("SİSTEM HATASI: Oturum Kimliği Doğrulanamadı!");
        return;
      }

      const nowTime = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setScannedItems(prev => [{ tracking: scannedCode, time: nowTime }, ...prev]);
      playSound("success");
      triggerFlash("success");

      // Arka plan kayıt (currentSessionId artık TS için güvenli bir string)
      const logRes = await logCargoBarcodeServer(currentSessionId, scannedCode);
      if (!logRes.success) {
        setErrorMsg(`UYARI: ${scannedCode} ağ kopması nedeniyle kaydedilemedi!`);
        playSound("error"); triggerFlash("error");
        setScannedItems(prev => prev.filter(i => i.tracking !== scannedCode));
      }
    }
  };

  // MÜHÜRLE VE ÇIK (Server Action)
  const handleCompleteSession = async () => {
    if (!session) return;
    
    if (!session.id) {
      setSession(null);
      setIsCompleteModalOpen(false);
      return;
    }

    setIsLoading(true);
    const res = await completeCargoSessionServer(session.id, scannedItems.length);
    
    if (res.success) {
      playSound("success");
      setIsCompleteModalOpen(false);
      setSession(null); 
    } else {
      setErrorMsg("Oturum kapatılamadı. Ağınızı kontrol edin.");
      triggerFlash("error");
      setIsCompleteModalOpen(false);
    }
    setIsLoading(false);
  };

  // Güvenli Geri Dönüş
  const handleBack = () => {
    if (session) {
      setSession(null); 
    } else {
      router.back(); 
    }
  };

  return (
    <>
      <div className={`min-h-screen font-['Quicksand'] select-none flex flex-col transition-colors duration-200
        ${flashStatus === "success" ? "bg-green-500/20" : flashStatus === "error" ? "bg-[#dc3545]/20" : "bg-slate-100"}`}>
        
        {/* 1. DARK-INDUSTRIAL HEADING */}
        <div className="bg-slate-900 shadow-md flex flex-col shrink-0 border-b-4 border-[#dc3545]">
          <div className="bg-[#dc3545] py-3 px-4 flex justify-between items-center">
            <button onClick={handleBack} className="text-white flex items-center gap-2 active:scale-95 transition-transform hover:text-slate-200">
              <ArrowLeft size={18} strokeWidth={3} />
              <span className="text-xs font-black uppercase tracking-widest">GERİ DÖN</span>
            </button>
            <div className="flex items-center gap-2 bg-black/20 px-3 py-1 border border-black/30 rounded-none">
              <TerminalSquare size={16} className="text-white" />
              <span className="text-white text-xs font-black uppercase tracking-[0.2em]">KARGO MAL KABUL</span>
            </div>
            <div className="w-20"></div>
          </div>

          <div className="p-4 grid grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
            <div className="bg-slate-800 border border-slate-700 p-3 flex flex-col justify-between rounded-none shadow-inner">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                <ShieldCheck size={14} className="text-green-500"/> AKTİF OPERATÖR
              </span>
              <span className="text-white font-black text-sm uppercase tracking-wide truncate mt-1">
                {empName}
              </span>
            </div>
            <div className="bg-slate-800 border border-slate-700 p-3 flex flex-col justify-between text-right rounded-none shadow-inner">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 flex justify-end items-center gap-2">
                <MapPin size={14} className="text-[#dc3545]" /> LOKASYON
              </span>
              <span className="text-white font-bold text-xs uppercase tracking-wide truncate mt-1">
                {branchName}
              </span>
              <span className="text-[#dc3545] font-mono text-xl font-black tracking-tight mt-1">
                {clock}
              </span>
            </div>
          </div>
        </div>

        {/* 2. DİNAMİK ANA EKRAN */}
        <div className="p-4 flex-1 flex flex-col max-w-3xl mx-auto w-full gap-5">
          
          {errorMsg && (
            <div className="bg-[#dc3545] text-white p-4 flex items-center gap-3 shadow-[4px_4px_0px_rgba(0,0,0,0.2)] animate-in slide-in-from-top-2 rounded-none border-l-4 border-white">
              <AlertCircle size={24} className="shrink-0 text-white" />
              <span className="text-sm font-black uppercase tracking-wider leading-snug">{errorMsg}</span>
            </div>
          )}

          {!session ? (
            // AŞAMA 1: OTURUM SEÇİM EKRANI
            <div className="flex flex-col gap-8 w-full animate-in fade-in duration-300">
              
              {/* Yarım Kalan Açık Oturumlar */}
              {activeSessions.length > 0 && (
                <div className="bg-slate-900 shadow-[6px_6px_0px_#cbd5e1] rounded-none border-2 border-slate-800">
                  <div className="bg-[#dc3545] p-3.5 flex items-center gap-2 border-b-2 border-slate-800">
                    <RotateCcw size={18} className="text-white" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">
                      YARIM KALAN İŞLEMLER
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeSessions.map(active => (
                      <button
                        key={active.id}
                        disabled={isLoading}
                        onClick={() => handleResumeSession(active)}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white p-4 flex flex-col justify-between transition-colors shadow-sm active:scale-[0.98] text-left rounded-none h-28 relative overflow-hidden"
                      >
                        <div className="flex justify-between w-full items-start">
                          <p className="font-black text-base uppercase tracking-widest">{active.carrier_name}</p>
                          <div className="bg-white/10 p-1.5 border border-white/20">
                            <Clock size={16} className="text-slate-300" />
                          </div>
                        </div>
                        <div className="mt-auto flex justify-between w-full items-end">
                          <p className="text-[10px] font-bold text-slate-400 font-mono uppercase">
                            GİRİŞ: {new Date(active.started_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <div className="bg-[#dc3545] text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border border-red-400">
                            DEVAM ET
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Yeni Oturum Başlat */}
              <div className="bg-white border-2 border-slate-300 shadow-[6px_6px_0px_#e2e8f0] rounded-none">
                <div className="bg-slate-100 border-b-2 border-slate-300 p-3.5 flex items-center gap-2">
                  <Package size={18} className="text-slate-800" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    YENİ MAL KABUL OTURUMU
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CARRIERS.map((c) => (
                    <button
                      key={c.id}
                      disabled={isLoading}
                      onClick={() => handleStartNewSession(c.name)}
                      className="w-full bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 p-4 flex flex-col items-center justify-center gap-3 transition-colors shadow-sm active:scale-[0.98] h-32 rounded-none border-l-8 border-l-[#dc3545]"
                    >
                      <div className="h-10 w-full flex items-center justify-center bg-transparent opacity-80 mix-blend-multiply">
                        <img 
                          src={c.logo} 
                          alt={`${c.name} Logo`} 
                          className="max-h-full max-w-full object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <span className="font-black text-[13px] text-slate-800 uppercase tracking-widest">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            // AŞAMA 2: TERMİNAL OKUTMA EKRANI
            <div className="flex flex-col gap-5 flex-1 animate-in fade-in duration-300 h-full">
              
              <div className="bg-white p-5 border-2 border-slate-300 shadow-[6px_6px_0px_#e2e8f0] rounded-none">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-widest border-l-4 border-green-500 pl-3">
                      TERMİNAL: {session.carrier}
                    </h3>
                  </div>
                  <span className="font-black text-[10px] px-3 py-1.5 uppercase tracking-widest border-2 bg-green-100 text-green-800 border-green-300 shadow-sm rounded-none">
                    AÇIK OTURUM
                  </span>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Barcode size={24} className="text-slate-400" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={handleScan}
                    disabled={session.status !== "ACTIVE"}
                    placeholder="BARKOD OKUTUN VEYA YAZIN..."
                    className="w-full bg-slate-50 border-2 border-slate-300 text-slate-900 text-xl font-black font-mono rounded-none focus:ring-0 focus:border-[#dc3545] block pl-14 p-5 transition-colors uppercase disabled:opacity-50 disabled:bg-slate-200 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)]"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="bg-white border-2 border-slate-300 shadow-[6px_6px_0px_#e2e8f0] rounded-none flex-1 flex flex-col overflow-hidden min-h-[350px]">
                <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0 border-b-4 border-[#dc3545]">
                  <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-500"/> OKUTULAN HAVUZ
                  </span>
                  <span className="bg-[#dc3545] text-white text-xs font-black px-4 py-1.5 rounded-none border border-red-400 shadow-inner">
                    {scannedItems.length} ADET
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 custom-scrollbar">
                  {scannedItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-80 py-12 gap-3">
                      <Barcode size={56} strokeWidth={1.5} className="text-slate-300" />
                      <span className="text-sm font-black uppercase tracking-widest">OKUTMA BEKLENİYOR</span>
                    </div>
                  ) : (
                    scannedItems.map((item, idx) => (
                      <div key={idx} className="bg-white border-2 border-slate-200 p-4 flex justify-between items-center rounded-none border-l-[6px] border-l-green-500 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <span className="font-black font-mono text-slate-800 text-lg tracking-wider">
                          {item.tracking}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 border-2 border-slate-200 px-3 py-1 font-mono bg-slate-50">
                          {item.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                disabled={isLoading}
                onClick={() => setIsCompleteModalOpen(true)}
                className="w-full bg-[#dc3545] hover:bg-red-700 text-white font-black text-base uppercase tracking-widest p-5 rounded-none flex items-center justify-center gap-3 transition-colors shadow-[6px_6px_0px_rgba(220,53,69,0.3)] disabled:opacity-50 disabled:shadow-none mt-2 shrink-0 border-2 border-red-800 active:translate-y-[2px]"
              >
                <Save size={24} strokeWidth={2.5} /> SAYIMI BİTİR VE MÜHÜRLE
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KRİTİK ONAY MODALI (MÜHÜRLEME) */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-[999] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200 font-['Quicksand']">
          <div className="bg-white max-w-md w-full border-4 border-[#dc3545] shadow-[16px_16px_0px_rgba(0,0,0,0.3)] rounded-none">
            <div className="bg-[#dc3545] p-5 flex items-center gap-3">
              <AlertTriangle size={32} className="text-white" />
              <h2 className="text-white font-black text-2xl uppercase tracking-widest">
                İŞLEMİ MÜHÜRLE
              </h2>
            </div>
            <div className="p-8 flex flex-col gap-6">
              <div className="bg-red-50 border-2 border-red-200 p-4">
                <p className="text-[#dc3545] font-black text-lg uppercase leading-snug text-center">
                  SAYIM KAPATILACAKTIR!
                </p>
              </div>
              <p className="text-slate-700 font-bold text-sm leading-relaxed text-center">
                Bu oturumu onayladığınız an veriler kilitlenerek arşive aktarılır. 
                <span className="text-[#dc3545] font-black block mt-3 underline underline-offset-4">
                  Bu işlem kesinlikle geri alınamaz ve sonradan kargo eklenemez.
                </span>
              </p>
              <div className="flex flex-col gap-3 mt-4">
                <button 
                  onClick={handleCompleteSession}
                  disabled={isLoading}
                  className="w-full bg-[#dc3545] hover:bg-red-700 text-white font-black h-16 text-sm uppercase tracking-widest border-2 border-red-800 transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.15)] active:translate-y-[2px] active:shadow-none disabled:opacity-50 rounded-none"
                >
                  {isLoading ? "MÜHÜRLENİYOR..." : "EVET, SAYIMI MÜHÜRLE"}
                </button>
                <button 
                  onClick={() => setIsCompleteModalOpen(false)}
                  disabled={isLoading}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-black h-14 text-sm uppercase tracking-widest border-2 border-slate-300 transition-colors rounded-none"
                >
                  İPTAL VE GERİ DÖN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}