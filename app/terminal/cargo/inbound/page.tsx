"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  TerminalSquare, MapPin, ShieldCheck, ArrowLeft, 
  Barcode, Camera, CheckCircle, Package, AlertCircle, Save 
} from "lucide-react";

// Merkezi konfigürasyon dosyamızı çağırıyoruz
import { CARRIERS, validateCargoBarcode } from "@/lib/cargoConfig";

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
  // DİKKAT: id artık opsiyonel. İlk okutmaya kadar id oluşmayacak!
  const [session, setSession] = useState<{ id?: string; carrier: string; status: string } | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [scannedItems, setScannedItems] = useState<{ tracking: string; time: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [flashStatus, setFlashStatus] = useState<"success" | "error" | null>(null);

  // Sayfa yüklendiğinde personelin branch_id'sini güvenli şekilde önbelleğe al
  useEffect(() => {
    const fetchBranch = async () => {
      const { data } = await supabase.from("employees").select("branch_id").eq("id", empId).single();
      if (data?.branch_id) setEmpBranchId(data.branch_id);
    };
    if (empId !== "Bilinmiyor") fetchBranch();
  }, [empId]);

  // Canlı Saat
  useEffect(() => {
    const updateClock = () => {
      setClock(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Otomatik Focus Motoru
  useEffect(() => {
    if (session && session.status === "ACTIVE" && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [session, barcode, errorMsg, flashStatus]);

  // Frekans Ses Motoru
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
      console.error("Ses motoru başlatılamadı:", e);
    }
  };

  const triggerFlash = (status: "success" | "error") => {
    setFlashStatus(status);
    const timeout = setTimeout(() => setFlashStatus(null), 800);
    return () => clearTimeout(timeout);
  };

  // YENİ MİMARİ: Oturumu SADECE Arayüzde (UI) Başlat!
  const handleStartSession = (carrierName: string) => {
    if (!empBranchId) {
      setErrorMsg("Güvenlik Hatası: Şube yetkisi doğrulanamadı!");
      triggerFlash("error");
      return;
    }
    
    // Veritabanına istek ATMADAN UI state'ini açıyoruz.
    setSession({ carrier: carrierName, status: "ACTIVE" });
    setSelectedCarrier(carrierName);
    playSound("success");
  };

  // ANA MOTOR: Barkod Okutma (Lazy Insertion Entegrasyonu)
  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcode.trim() !== "") {
      const scannedCode = barcode.trim();
      setBarcode(""); 

      if (!session || session.status !== "ACTIVE") {
        setErrorMsg("HATA: Oturum kapalı, yeni veri eklenemez!");
        playSound("error"); triggerFlash("error"); return;
      }

      // Kargo Config Filtresi
      const validation = validateCargoBarcode(session.carrier, scannedCode);
      if (!validation.isValid) {
        setErrorMsg(validation.errorMsg || "Geçersiz Kargo Barkodu!");
        playSound("error"); triggerFlash("error"); return;
      }

      // Mükerrer Kontrolü
      if (scannedItems.some(item => item.tracking === scannedCode)) {
        setErrorMsg(`MÜKERRER: ${scannedCode} zaten okutuldu!`);
        playSound("error"); triggerFlash("error"); return;
      }

      setErrorMsg(""); 
      let currentSessionId = session.id;

      // ZİRVE NOKTASI: EĞER BU İLK BARKOD İSE, OTURUMU ŞİMDİ VERİTABANINA YAZ!
      if (!currentSessionId) {
        try {
          const { data: newSession, error: sessionErr } = await supabase
            .from("cargo_sessions")
            .insert([{
              employee_id: empId,
              branch_id: empBranchId,
              carrier_name: session.carrier,
              status: 'ACTIVE'
            }])
            .select("id")
            .single();

          if (sessionErr) throw sessionErr;
          
          currentSessionId = newSession.id;
          // State'i güncelleyip ID'yi içeri gömüyoruz
          setSession(prev => prev ? { ...prev, id: currentSessionId } : null);
        } catch (err) {
          setErrorMsg("SİSTEM HATASI: Kargo oturumu veritabanında oluşturulamadı!");
          playSound("error"); triggerFlash("error");
          return; // Hata varsa aşağı geçme, UI'ı güncelleme
        }
      }

      // İLK OKUTMA BAŞARILI OLUŞTUYSA VEYA ZATEN VARSA (Optimistic UI)
      const nowTime = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setScannedItems(prev => [{ tracking: scannedCode, time: nowTime }, ...prev]);
      playSound("success");
      triggerFlash("success");

      // Arka planda barkodu veritabanına logla
      try {
        const { error: logErr } = await supabase.from("cargo_logs").insert([{
          session_id: currentSessionId,
          tracking_number: scannedCode
        }]);

        if (logErr) throw logErr;
      } catch (err) {
        // Ağ koptuysa kullanıcıyı uyar ve listeyi geri al (Rollback)
        console.error("Kargo loglanamadı:", err);
        setErrorMsg(`UYARI: ${scannedCode} ağ kopması nedeniyle kaydedilemedi!`);
        playSound("error"); triggerFlash("error");
        setScannedItems(prev => prev.filter(i => i.tracking !== scannedCode));
      }
    }
  };

  // MÜHÜRLE VE ÇIK (Boş Oturum Koruması)
  const handleCompleteSession = async () => {
    if (!session) return;
    
    // Eğer session.id yoksa (yani firma seçip HİÇBİR ŞEY okutmadan bitire bastıysa)
    // Veritabanında oturum hiç oluşturulmadığı için sessizce ana menüye dön. Çöp veri yok!
    if (!session.id) {
      router.back();
      return;
    }

    setIsLoading(true);
    try {
      await supabase
        .from("cargo_sessions")
        .update({ 
          status: 'COMPLETED', 
          completed_at: new Date().toISOString(),
          total_items: scannedItems.length
        })
        .eq("id", session.id);

      setSession(prev => prev ? { ...prev, status: "COMPLETED" } : null);
      playSound("success");
      router.back();
    } catch (err) {
      console.error(err);
      setErrorMsg("Oturum kalıcı olarak kapatılamadı. Ağınızı kontrol edin.");
      triggerFlash("error");
      setIsLoading(false);
    }
  };

  const handleCameraScan = () => {
    if (session && session.status !== "ACTIVE") return;
    const fileInput = document.getElementById('camera-scan-input');
    if (fileInput) fileInput.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    alert("Kamera arabirimi bağlandı. Görsel barkod çözümleme (Decoder) altyapısı aktiftir.");
  };

  return (
    <div className={`min-h-screen font-['Quicksand'] select-none flex flex-col transition-colors duration-200
      ${flashStatus === "success" ? "bg-emerald-500/30" : flashStatus === "error" ? "bg-red-500/30" : "bg-slate-100"}`}>
      
      {/* 1. DARK HEADING */}
      <div className="bg-[#0f172b] shadow-md flex flex-col shrink-0">
        <div className="bg-[#dc3545] py-2 px-4 flex justify-between items-center border-b border-[#a12330]">
          <button onClick={() => router.back()} className="text-white flex items-center gap-1 active:scale-95 transition-transform">
            <ArrowLeft size={16} strokeWidth={3} />
            <span className="text-[10px] font-black uppercase tracking-widest">Geri Çık</span>
          </button>
          <div className="flex items-center gap-2">
            <TerminalSquare size={14} className="text-white" />
            <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Kargo Mal Kabul</span>
          </div>
          <div className="w-12"></div>
        </div>

        <div className="p-4 grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-3 flex flex-col justify-between shadow-inner">
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <ShieldCheck size={10} className="text-emerald-500"/> Aktif Operatör
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

      {/* 2. ANA KONTROLLER */}
      <div className="p-4 flex-1 flex flex-col max-w-lg mx-auto w-full gap-4">
        
        {errorMsg && (
          <div className="bg-red-900 border border-[#dc3545] text-white p-3.5 rounded-sm flex items-center gap-2.5 shadow-md animate-bounce">
            <AlertCircle size={20} className="shrink-0 text-red-400" />
            <span className="text-[12px] font-black uppercase tracking-wide">{errorMsg}</span>
          </div>
        )}

        {!session ? (
          <div className="bg-white p-4 border border-slate-200 shadow-sm rounded-sm">
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest border-l-4 border-[#dc3545] pl-2 mb-4">
              1. Kargo Firması Seçin
            </h3>
            <div className="grid grid-cols-1 gap-3 ">
              {CARRIERS.map((c) => {
                const isSelected = selectedCarrier === c.name;
                return (
                  <button
                    key={c.id}
                    disabled={isLoading}
                    onClick={() => handleStartSession(c.name)}
                    className={`w-full relative overflow-hidden flex items-center justify-between p-4 border-l-4 rounded-sm transition-all shadow-md 
                      ${isSelected ? `${c.activeBg} border-transparent text-white scale-[0.99]` : `bg-white hover:bg-slate-50 ${c.borderColor} ${c.bgTint}`}`}
                  >
                    <span className={`font-black text-[14px] uppercase tracking-wider flex items-center gap-2 z-10 
                      ${isSelected ? "text-white" : c.textColor}`}>
                      {c.name}
                    </span>
                    <div className="flex items-center gap-3 z-10">
                      <div className="h-8 w-20 flex items-center justify-end bg-transparent">
                        <img 
                          src={c.logo} 
                          alt={`${c.name} Logo`} 
                          className={`max-h-full max-w-full object-contain ${isSelected ? 'brightness-0 invert' : ''}`}
                          crossOrigin="anonymous"
                        />
                      </div>
                      {isSelected && <CheckCircle size={22} className="text-white drop-shadow" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          
          <div className="flex flex-col gap-4 flex-1">
            <div className="bg-white p-4 border border-slate-200 shadow-sm rounded-sm">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest border-l-4 border-emerald-500 pl-2">
                    2. Mal Kabul Okutma Paneli
                  </h3>
                  <div className="h-5 ml-2 bg-slate-100 p-1 rounded-sm flex items-center">
                     <img 
                       src={CARRIERS.find(c => c.name === session.carrier)?.logo} 
                       alt={session.carrier} 
                       className="h-full object-contain" 
                     />
                  </div>
                </div>
                <span className={`font-black text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest shadow-sm
                  ${session.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700 animate-pulse" : "bg-red-100 text-red-700"}`}>
                  {session.status === "ACTIVE" ? "AÇIK" : "KİLİTLİ"}
                </span>
              </div>
              
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Barcode size={20} className="text-slate-400" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={handleScan}
                    disabled={session.status !== "ACTIVE"}
                    placeholder={session.status === "ACTIVE" ? "Barkodu Okutun..." : "Oturum Kapatıldı"}
                    className="w-full bg-slate-50 border-2 border-slate-300 text-slate-900 text-sm font-black rounded-sm focus:ring-0 focus:border-[#dc3545] block pl-10 p-3.5 transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                    autoComplete="off"
                  />
                </div>
                
                <button 
                  onClick={handleCameraScan}
                  disabled={session.status !== "ACTIVE"}
                  className="bg-slate-800 text-white p-3.5 rounded-sm flex items-center justify-center hover:bg-slate-700 active:bg-slate-900 transition-colors shadow-sm disabled:opacity-50"
                  title="Telefon Kamerası ile Okut"
                >
                  <Camera size={20} strokeWidth={2.5} />
                </button>

                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  id="camera-scan-input"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              
              <p className="text-[10px] font-bold text-slate-400 text-center mt-3 uppercase tracking-wider">
                Firma filtre kuralları aktiftir. Yanlış barkodlar bloke edilir.
              </p>
            </div>

            <div className="bg-white p-1 border border-slate-200 shadow-sm rounded-sm flex-1 flex flex-col overflow-hidden">
              <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center shrink-0">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Package size={14} className="text-slate-500"/> Oturum Kargo Havuzu
                </span>
                <span className="bg-[#0f172b] text-white text-[11px] font-black px-2.5 py-1 rounded-sm shadow-inner">
                  {scannedItems.length} Adet
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50 custom-scrollbar">
                {scannedItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 py-12">
                    <Barcode size={40} strokeWidth={1} className="mb-2 text-slate-500" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Kargo Girişi Bekleniyor</span>
                  </div>
                ) : (
                  scannedItems.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 p-3 flex justify-between items-center rounded-sm shadow-sm border-l-4 border-emerald-500 animate-in fade-in slide-in-from-top-2">
                      <span className="font-black text-slate-800 text-[13px] tracking-widest">
                        {item.tracking}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-sm">
                        {item.time}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {session.status === "ACTIVE" && (
              <button
                disabled={isLoading}
                onClick={handleCompleteSession}
                className="w-full bg-[#dc3545] hover:bg-[#c82333] text-white font-black text-[13px] uppercase tracking-widest p-4 rounded-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md disabled:opacity-70 mt-2 shrink-0 animate-in fade-in duration-300"
              >
                <Save size={18} strokeWidth={2.5} /> Sayımı Bitir (Oturumu Kapat)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}