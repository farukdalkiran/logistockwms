"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { processPutawayServer } from "@/app/actions/inventory"; 
import { initTerminalSessionServer } from "@/app/actions/system-auth"; // Kalkan Delici Motor
import { 
  ChevronLeft, TerminalSquare, UserCircle, MapPin, Hash, AlertTriangle, 
  Package, ScanLine, Smartphone, Edit3, ArrowRight, Database,
  BoxSelect, Server, PlusCircle, ClipboardList, Keyboard, X
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type SessionLogItem = {
  id: string; 
  product: { barcode: string; sku: string | null; name: string; image_url: string | null; };
  quantity: number;
  time: string;
};

type Shelf = { id: number; name: string; status: string; };

// --- DONANIMSAL SES MOTORU (Web Audio API) ---
const playScanSound = (type: 'success' | 'error') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch(e) { console.warn("Tarayıcı ses desteği kapalı"); }
};

export default function PutawayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube Terminali";

  const [branchId, setBranchId] = useState<string | null>(null);
  
  // HIZLANDIRICI: Rafları RAM'de tutacağız (Ağ gecikmesi yok)
  const [allShelves, setAllShelves] = useState<Shelf[]>([]);
  const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);
  const [shelfInput, setShelfInput] = useState("");

  const [activeTab, setActiveTab] = useState<'terminal' | 'camera'>('terminal');
  const [scanInput, setScanInput] = useState("");
  const [selectedQty, setSelectedQty] = useState<number | string>(1);
  const [lastScanned, setLastScanned] = useState<SessionLogItem | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLogItem[]>([]); 
  
  const [isProcessing, setIsProcessing] = useState(false); 
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  // KLAVYE TOGGLE: Artık manuel giriş varsayılan olarak kapalı. Butonla açılıyor.
  const [isManualMode, setIsManualMode] = useState(false);
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const shelfInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastCameraScanTime = useRef<number>(0);
  
  // SPEED BOOST: In-Memory Barcode Cache
  const barcodeResolverCache = useRef(new Map());

  const qtyButtons = [1, 2, 3, 4, 5, 10];

  const opState = useRef({ selectedQty });
  useEffect(() => { opState.current = { selectedQty }; }, [selectedQty]);

  // RADAR MOTORU (Klavye kapalıyken barkoda odaklanır)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isProcessing) {
        if (!activeShelf && document.activeElement !== shelfInputRef.current) {
          shelfInputRef.current?.focus();
        } else if (activeShelf && activeTab === 'terminal' && !isManualMode && document.activeElement !== scanInputRef.current) {
          scanInputRef.current?.focus();
        }
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeShelf, activeTab, isProcessing, isManualMode]);

// ÇÖZÜM 1: INIT VERİ ÇEKİMİ (Kalkan Delici Server Action ile)
  useEffect(() => {
    const initData = async () => {
      if (!empId) return;
      const session = await initTerminalSessionServer(empId);
      
      if (session.success) {
        // Tip güvenliği için branchId'yi string olarak garantiliyoruz
        setBranchId(session.branchId as string); 
        
        // Vercel Build Hatası Çözümü: undefined ihtimaline karşı fallback array ve Type Casting
        setAllShelves((session.shelves as Shelf[]) || []); 
      } else {
        triggerFeedback('error', "Terminal Hatası: " + (session.error || "Bilinmeyen Hata"));
      }
    };
    initData();
  }, [empId]);

  const triggerFeedback = useCallback((type: 'success' | 'error', msg: string = "") => {
    playScanSound(type); 
    setFlashState(type); 
    if (type === 'error') setErrorMsg(msg);
    setTimeout(() => { setFlashState('idle'); if (type === 'error') setErrorMsg(""); }, 2000);
  }, []);

  // ÇÖZÜM 2: SIFIR GECİKMELİ RAF KİLİTLEME (Ağ İsteği Yok)
  const handleLockShelf = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const cleanShelf = shelfInput.trim().toUpperCase();
    if (!cleanShelf || !branchId || isProcessing || allShelves.length === 0) return;

    setIsProcessing(true);
    
    const isNumeric = /^\d+$/.test(cleanShelf);
    const targetShelf = allShelves.find(s => 
      (isNumeric && s.id.toString() === cleanShelf) || 
      s.name.toUpperCase() === cleanShelf
    );

    if (!targetShelf) {
      triggerFeedback('error', `HATA: ${cleanShelf} rafı bulunamadı!`);
      setShelfInput("");
      setIsProcessing(false);
      return;
    }

    setActiveShelf(targetShelf);
    setShelfInput("");
    triggerFeedback('success');
    setIsProcessing(false);
  };

  // ÇÖZÜM 3: CACHE DESTEKLİ HIZLI BARKOD OKUMA
  const processBarcode = async (rawBarcode: string, isCamera: boolean = false) => {
    if (!rawBarcode || isProcessing || !activeShelf || !branchId) return;
    if (isCamera) {
      const now = Date.now();
      if (now - lastCameraScanTime.current < 2000) return;
      lastCameraScanTime.current = now;
    }

    setIsProcessing(true);
    try {
      let targetBarcode = rawBarcode.trim();
      let currentQty = opState.current.selectedQty;
      let inputQty = typeof currentQty === 'string' ? parseInt(currentQty) || 1 : currentQty;
      if (inputQty < 1) inputQty = 1;

      // ULTRA HIZLI ÖNBELLEK ÇÖZÜMLEME
      let resolved = barcodeResolverCache.current.get(targetBarcode);

      if (!resolved) {
        // 1. Koli Check
        const { data: boxData } = await supabase.from("boxes").select("product_id, quantity").eq("box_barcode", targetBarcode).maybeSingle();
        if (boxData) {
          const { data: pData } = await supabase.from("products").select("id, barcode, sku, name, image_url").eq("id", boxData.product_id).single();
          if (pData) {
            resolved = { product: pData, qtyMulti: boxData.quantity };
            barcodeResolverCache.current.set(targetBarcode, resolved); 
            barcodeResolverCache.current.set(pData.barcode, { product: pData, qtyMulti: 1 });
          }
        } else {
          // 2. Ürün Check
          const { data: pData } = await supabase.from("products").select("id, barcode, sku, name, image_url").eq("barcode", targetBarcode).maybeSingle();
          if (pData) {
            resolved = { product: pData, qtyMulti: 1 };
            barcodeResolverCache.current.set(targetBarcode, resolved);
          }
        }
      }

      if (!resolved) {
        triggerFeedback('error', "HATA: Ürün sistemde (DB) bulunamadı!");
        setIsProcessing(false); setScanInput(""); return;
      }

      const finalQty = inputQty * resolved.qtyMulti;

      // SUNUCU AKSİYONU (Stok Ekleme)
      const serverResponse = await processPutawayServer({
        productId: resolved.product.id,
        branchId: branchId,
        shelfId: activeShelf.id,
        shelfName: activeShelf.name,
        quantity: finalQty,
        empId: empId,
        productDetails: resolved.product
      });

      if (!serverResponse.success) {
        triggerFeedback('error', `Sunucu: ${serverResponse.error}`);
        setIsProcessing(false); setScanInput(""); return;
      }

      const logEntry: SessionLogItem = {
        id: Math.random().toString(36).substring(7),
        product: resolved.product,
        quantity: finalQty,
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      setLastScanned(logEntry);
      setSessionLogs(prev => [logEntry, ...prev]);
      
      triggerFeedback('success');
      setSelectedQty(1);

    } catch (error) { 
      triggerFeedback('error', "Kayıt Hatası!"); 
    } finally { 
      setIsProcessing(false); 
      setScanInput(""); 
      if(!isManualMode) setTimeout(() => scanInputRef.current?.focus(), 50); 
    }
  };

  const handleTerminalScan = (e?: React.FormEvent | React.KeyboardEvent) => { 
    if(e) e.preventDefault(); 
    processBarcode(scanInput, false); 
  };

  // KAMERA OKUYUCU MOTORU (Kararlı Döngü)
  useEffect(() => {
    let isMounted = true;

    const stopCamera = async () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch (err) {
          console.error("Kamera durdurma hatası:", err);
        } finally {
          html5QrCodeRef.current = null;
        }
      }
    };

    if (activeShelf && activeTab === 'camera') {
      const timer = setTimeout(() => {
        const readerElement = document.getElementById("reader");
        if (readerElement && isMounted) {
          const qrScanner = new Html5Qrcode("reader");
          html5QrCodeRef.current = qrScanner;

          qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } }, 
            (decodedText) => {
              if (isMounted) processBarcode(decodedText, true);
            }, 
            () => {}
          ).catch((err) => console.error("Kamera başlatılamadı:", err));
        }
      }, 200);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [activeShelf, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col antialiased select-none print:bg-white" onClick={() => { if(!isManualMode && activeTab==='terminal') scanInputRef.current?.focus(); }}>
      
      {/* WMS YENİ HEADER: Dark-Industrial Bilgi Matrisi (Raflama Kırmızı/Mor Konsept) */}
      <div className="bg-[#0f172b] border-b-4 border-[#dc3545] shadow-xl shrink-0 z-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#dc3545]/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row max-w-7xl mx-auto w-full relative z-10">
           {/* SOL KISIM: Marka ve Geri Butonu */}
           <div className="flex items-center gap-4 p-4 border-b sm:border-b-0 sm:border-r border-slate-800/80 sm:w-[30%] bg-slate-950/20">
             <button onClick={() => router.back()} className="text-slate-400 hover:text-white p-2.5 bg-slate-800/60 hover:bg-[#dc3545] transition-all rounded-sm shrink-0 border border-slate-700/50">
               <ChevronLeft size={20} strokeWidth={2.5} />
             </button>
             <div className="flex flex-col justify-center">
               <div className="flex items-center gap-2">
                 <TerminalSquare size={16} className="text-[#dc3545] shrink-0" strokeWidth={2.5} />
                 <span className="text-white text-[16px] font-black uppercase tracking-[0.15em] leading-none">LogiStock</span>
               </div>
               <span className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest mt-1">Hızlı Raflama Motoru</span>
             </div>
           </div>

           {/* SAĞ KISIM: Operatör ve Şube Bilgi Matrisi */}
           <div className="flex flex-1 items-center p-3 sm:p-0">
             <div className="flex w-full items-stretch justify-center gap-1 sm:gap-2">
                <div className="flex-1 flex flex-col justify-center items-center sm:items-start py-2 sm:px-6 border-r border-slate-800/80">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <UserCircle size={12} className="text-slate-400" />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AKTİF OPERATÖR</span>
                   </div>
                   <span className="text-[13px] font-black text-white uppercase tracking-wider truncate max-w-[120px] sm:max-w-full">
                     {empName}
                   </span>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center sm:items-start py-2 sm:px-6 border-r border-slate-800/80">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <MapPin size={12} className="text-purple-500" />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">OTURUM LOKASYONU</span>
                   </div>
                   <span className="text-[13px] font-black text-purple-400 uppercase tracking-wider truncate max-w-[120px] sm:max-w-full">
                     {branchName}
                   </span>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center sm:items-start py-2 sm:px-6">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <Database size={12} className="text-emerald-500" />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SİSTEM DURUMU</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                     <span className="text-[13px] font-black text-emerald-400 uppercase tracking-wider">AKTİF</span>
                   </div>
                </div>
             </div>
           </div>
        </div>
      </div>

      {/* 1. RAF BARKODU KİLİTLEME */}
      {!activeShelf && (
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-1/4 -right-20 w-64 h-64 bg-purple-200/40 rounded-full blur-[80px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 -left-20 w-64 h-64 bg-red-200/40 rounded-full blur-[80px] pointer-events-none"></div>
          
          <div className="bg-white p-6 sm:p-10 border border-slate-200 shadow-xl max-w-lg w-full flex flex-col gap-6 rounded-sm relative z-10">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-800 to-[#dc3545]"></div>

            <div className="flex flex-col items-center text-center gap-3 mb-2 border-b border-slate-100 pb-6">
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-full text-purple-600 shadow-sm">
                <BoxSelect size={40} />
              </div>
              <h2 className="text-[18px] sm:text-[20px] font-black uppercase text-slate-800 tracking-widest">Rafı Kilitle</h2>
              <p className="text-[12px] font-bold text-slate-500 max-w-sm leading-relaxed">
                İşlem yapmak istediğiniz rafın ID'sini terminalden okutarak veya yazarak sistemi kilitli hale getirin.
              </p>
            </div>
            
            <form onSubmit={handleLockShelf} className="flex flex-col gap-4">
              <input 
                ref={shelfInputRef}
                type="text" 
                value={shelfInput}
                onChange={(e) => setShelfInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLockShelf(e)}
                placeholder="RAF BARKODU"
                disabled={isProcessing || allShelves.length === 0}
                className="w-full min-h-[64px] bg-slate-50 border-2 border-slate-300 text-slate-900 text-center text-[22px] sm:text-[24px] tracking-widest uppercase font-black font-mono p-4 rounded-sm focus:outline-none focus:border-purple-500 transition-all shadow-inner disabled:opacity-50"
              />
              <button type="submit" disabled={isProcessing || !shelfInput} className="w-full min-h-[56px] bg-[#dc3545] text-white p-4 font-black uppercase tracking-widest hover:bg-red-700 disabled:bg-slate-300 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 rounded-sm">
                KİLİTLE VE BAŞLA <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. OPERASYON KOKPİTİ */}
      {activeShelf && (
        <div className="flex-1 flex flex-col relative h-full">
          <div className={`pointer-events-none fixed inset-0 z-40 transition-colors duration-300 ${flashState === 'success' ? 'bg-green-500/10' : flashState === 'error' ? 'bg-[#dc3545]/20' : 'bg-transparent'}`} />

          {errorMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#dc3545] text-white px-4 sm:px-6 py-4 font-black text-[12px] sm:text-[14px] tracking-widest uppercase shadow-2xl border-2 border-red-900 animate-in slide-in-from-top-4 flex items-center gap-3 w-[95%] max-w-md text-center rounded-sm">
              <AlertTriangle size={24} className="shrink-0" /> {errorMsg}
            </div>
          )}

          {/* KOKPİT ÜST BİLGİ PANELİ */}
          <div className="bg-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 shrink-0 border-b-2 border-slate-200 shadow-sm relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-600"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="p-2 sm:p-3 border-2 shadow-sm rounded-sm bg-purple-50 border-purple-200 text-purple-600">
                <Server size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-[12px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-2 mb-0.5">
                  <Hash size={12}/> AKTİF RAF KİLİDİ
                </span>
                <span className="text-[14px] sm:text-[18px] font-black tracking-widest uppercase flex items-center gap-2 flex-wrap text-slate-800">
                  {activeShelf.name} <span className="text-purple-500 text-[12px] bg-purple-50 px-1.5 py-0.5 rounded-sm font-mono border border-purple-100">(ID:{activeShelf.id})</span>
                </span>
              </div>
            </div>
            
            <button onClick={() => setActiveShelf(null)} className="shrink-0 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 px-4 py-3 min-h-[44px] font-black text-[11px] uppercase tracking-widest transition-colors shadow-sm rounded-sm flex items-center justify-center">
              RAFI DEĞİŞTİR
            </button>
          </div>

          <div className="flex-1 p-2 sm:p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 z-10 overflow-hidden">
            
            {/* SOL KOLON: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0 overflow-y-auto lg:overflow-visible pb-4 lg:pb-0">
              
              <div className="flex bg-white border border-slate-200 p-1.5 rounded-sm shadow-sm">
                <button onClick={() => setActiveTab('terminal')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all rounded-sm ${activeTab === 'terminal' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={16} /> Terminal</button>
                <button onClick={() => setActiveTab('camera')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all rounded-sm ${activeTab === 'camera' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Smartphone size={16} /> Kamera</button>
              </div>

              <div className="bg-white p-4 shadow-md border border-slate-200 flex flex-col gap-4 rounded-sm relative">
                
                {/* Ürün Görseli Alanı */}
                <div className="w-full h-32 sm:h-48 lg:aspect-[4/3] lg:h-auto bg-slate-50 border-2 border-slate-200 border-dashed p-2 shadow-inner rounded-sm flex items-center justify-center relative overflow-hidden">
                  {lastScanned?.product.image_url ? (
                    <img src={lastScanned.product.image_url} alt="Urun" className="w-full h-full object-contain mix-blend-multiply animate-in fade-in zoom-in duration-300" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-300 gap-2">
                      <Package size={48} className="opacity-50 sm:w-16 sm:h-16" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Barkod Bekleniyor</span>
                    </div>
                  )}
                  {lastScanned && (
                    <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md p-2 text-center border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                      <span className="text-slate-800 text-[11px] sm:text-[12px] font-bold line-clamp-1">{lastScanned.product.name}</span>
                    </div>
                  )}
                </div>

                {/* Barkod Okuma Formu */}
                {activeTab === 'terminal' ? (
                  <form onSubmit={handleTerminalScan} className="flex flex-col gap-2">
                    <input 
                      ref={scanInputRef} 
                      type="text" 
                      value={scanInput} 
                      onChange={e => setScanInput(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleTerminalScan(e)}
                      placeholder="ÜRÜN/KOLİ OKUT" 
                      disabled={isProcessing} 
                      className="w-full min-h-[56px] sm:min-h-[64px] text-center font-black text-[18px] sm:text-[20px] uppercase p-3 sm:p-4 border-2 focus:outline-none tracking-widest transition-all shadow-inner disabled:opacity-50 bg-slate-50 text-slate-900 border-slate-300 focus:border-purple-500 focus:bg-white placeholder:text-slate-400 font-mono rounded-sm" 
                    />
                    <button type="submit" className="hidden" /> 
                  </form>
                ) : (
                  <div id="reader" className="w-full bg-slate-950 border-2 border-slate-800 overflow-hidden min-h-[200px] sm:min-h-[250px] rounded-sm" />
                )}

                {/* ADET ÇARPANI VE MANUAL GİRİŞ TOGGLE */}
                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12} className="text-purple-500"/> Adet Seçimi</span>
                    
                    {/* KLAVYE TOGGLE BUTONU */}
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsManualMode(!isManualMode);
                        if (!isManualMode) setTimeout(() => manualInputRef.current?.focus(), 100);
                        else setTimeout(() => scanInputRef.current?.focus(), 100);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border ${isManualMode ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {isManualMode ? <X size={14}/> : <Keyboard size={14}/>}
                      {isManualMode ? 'KLAVYEYİ KAPAT' : 'KLAVYE AÇ'}
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-1">
                    {qtyButtons.map(qty => (
                      <button 
                        key={qty} 
                        type="button" 
                        onClick={() => { setSelectedQty(qty); if(!isManualMode) setTimeout(() => scanInputRef.current?.focus(), 50); }} 
                        className={`flex-1 min-w-[44px] py-3 text-[14px] font-black transition-all border-2 rounded-sm ${selectedQty === qty ? 'bg-[#dc3545] border-[#dc3545] text-white shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:bg-slate-100'}`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                  
                  {/* MANUEL GİRİŞ KUTUSU (Sadece Toggle Açıksa Görünür) */}
                  {isManualMode && (
                    <div className="flex items-center gap-3 border-2 p-2 rounded-sm transition-colors w-full overflow-hidden bg-purple-50/50 border-purple-300 focus-within:border-purple-600 animate-in slide-in-from-top-2">
                      <span className="text-purple-700 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel:</span>
                      <input 
                        ref={manualInputRef}
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={selectedQty} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setSelectedQty(val);
                        }} 
                        className="flex-1 bg-transparent text-slate-900 font-black text-[22px] text-right focus:outline-none pr-2 min-w-0 w-full" 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SAĞ KOLON: OTURUM LOGLARI (Canlı Liste) */}
            <div className="flex-1 bg-white border border-slate-200 shadow-md flex flex-col overflow-hidden min-h-[400px]">
              <div className="bg-[#0f172b] px-4 py-3 flex justify-between items-center text-white shrink-0">
                <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                  <ClipboardList size={16} className="text-purple-500"/> Oturum Geçmişi
                </span>
                <span className="bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-widest border border-slate-700 rounded-sm shadow-sm text-purple-300">
                  {sessionLogs.length} Kayıt
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-16 border-r border-slate-200">Saat</th>
                      <th className="p-3 w-32 border-r border-slate-200">Barkod</th>
                      <th className="p-3 border-r border-slate-200">Ürün Adı</th>
                      <th className="p-3 w-16 text-center text-emerald-700 bg-emerald-50">Okunan</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] font-bold text-slate-800 divide-y divide-slate-100">
                    {sessionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors bg-white animate-in fade-in duration-300">
                        <td className="p-3 border-r border-slate-100 text-slate-400 font-black">{log.time}</td>
                        <td className="p-3 border-r border-slate-100 overflow-hidden">
                          <span className="tracking-widest uppercase truncate block text-slate-700 font-mono bg-slate-100 px-1 py-0.5 rounded-sm border border-slate-200">
                            {log.product.barcode}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-100">
                          <span className="line-clamp-2 leading-tight text-slate-700">{log.product.name}</span>
                        </td>
                        <td className="p-3 text-center bg-emerald-50/40">
                          <span className="text-[15px] font-black text-emerald-600">+{log.quantity}</span>
                        </td>
                      </tr>
                    ))}
                    {sessionLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 sm:p-12 text-center text-slate-400 text-[10px] sm:text-[12px] font-black uppercase tracking-widest border-dashed border-2 border-slate-100 m-4 block w-auto">
                          Mevcut oturumda işlem yok
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}