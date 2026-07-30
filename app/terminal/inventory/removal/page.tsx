"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { processPickingServer } from "@/app/actions/inventory"; 
import { initTerminalSessionServer } from "@/app/actions/system-auth"; // Kalkan Delici Motor
import { 
  ChevronLeft, TerminalSquare, UserCircle, MapPin, Hash, AlertTriangle, 
  PackageMinus, ScanLine, Smartphone, Edit3, ArrowRight, Database,
  BoxSelect, Server, ClipboardList, Info, Keyboard, X, ListTodo
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type SessionLogItem = {
  id: string; 
  product: { barcode: string; sku: string | null; name: string; image_url: string | null; };
  quantity: number;
  time: string;
  reason?: string;
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
  } catch(e) { console.warn("Tarayıcı ses desteği kapalı veya kısıtlı"); }
};

export default function PickingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube Terminali";

  const [branchId, setBranchId] = useState<string | null>(null);
  
  // HIZLANDIRICI: Rafları RAM'de tutuyoruz
  const [allShelves, setAllShelves] = useState<Shelf[]>([]);
  const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);
  const [shelfInput, setShelfInput] = useState("");

  const [activeTab, setActiveTab] = useState<'terminal' | 'camera'>('terminal');
  const [scanInput, setScanInput] = useState("");
  const [selectedQty, setSelectedQty] = useState<number | string>(1);
  const [lastScanned, setLastScanned] = useState<SessionLogItem | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLogItem[]>([]); 
  
  // Hasarlı Raf Modal State'leri
  const [pendingRemoval, setPendingRemoval] = useState<{product: any, qty: number} | null>(null);
  const [removalReason, setRemovalReason] = useState("eksik_parca");
  const [requestedBy, setRequestedBy] = useState("");
  const [otherDescription, setOtherDescription] = useState("");

  const [isProcessing, setIsProcessing] = useState(false); 
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  // KLAVYE TOGGLE
  const [isManualMode, setIsManualMode] = useState(false);
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const shelfInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const requestedByRef = useRef<HTMLInputElement>(null);
  const otherDescRef = useRef<HTMLInputElement>(null);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastCameraScanTime = useRef<number>(0);
  
  // SPEED BOOST: In-Memory Barcode Cache
  const barcodeResolverCache = useRef(new Map());

  const qtyButtons = [1, 2, 3, 4, 5, 10];

  const opState = useRef({ selectedQty });
  useEffect(() => { opState.current = { selectedQty }; }, [selectedQty]);

  // RADAR MOTORU (Klavye veya Modal açıksa duraklar)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isProcessing && !pendingRemoval && !isManualMode) {
        if (!activeShelf && document.activeElement !== shelfInputRef.current) {
          shelfInputRef.current?.focus();
        } else if (activeShelf && activeTab === 'terminal' && document.activeElement !== scanInputRef.current) {
          scanInputRef.current?.focus();
        }
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeShelf, activeTab, isProcessing, pendingRemoval, isManualMode]);

  // ÇÖZÜM 1: INIT VERİ ÇEKİMİ (Kalkan Delici Server Action ile RLS Aşımı)
  useEffect(() => {
    const initData = async () => {
      if (!empId) return;
      const session = await initTerminalSessionServer(empId);
      
      if (session.success) {
        setBranchId(session.branchId);
        setAllShelves(session.shelves);
      } else {
        triggerFeedback('error', "Terminal Hatası: " + session.error);
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

  // ÇÖZÜM 2: SIFIR GECİKMELİ RAF KİLİTLEME
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
      triggerFeedback('error', `HATA: ${cleanShelf} rafı bu şubede bulunamadı!`);
      setShelfInput("");
      setIsProcessing(false);
      return;
    }

    setActiveShelf(targetShelf);
    setShelfInput("");
    triggerFeedback('success');
    setIsProcessing(false);
  };

  // ÇÖZÜM 3: CACHE DESTEKLİ BARKOD OKUMA
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

      // HIZLI ÖNBELLEK ÇÖZÜMLEME
      let resolved = barcodeResolverCache.current.get(targetBarcode);

      if (!resolved) {
        const { data: boxData } = await supabase.from("boxes").select("product_id, quantity").eq("box_barcode", targetBarcode).maybeSingle();
        if (boxData) {
          const { data: pData } = await supabase.from("products").select("id, barcode, sku, name, image_url").eq("id", boxData.product_id).single();
          if (pData) {
            resolved = { product: pData, qtyMulti: boxData.quantity };
            barcodeResolverCache.current.set(targetBarcode, resolved); 
            barcodeResolverCache.current.set(pData.barcode, { product: pData, qtyMulti: 1 });
          }
        } else {
          const { data: pData } = await supabase.from("products").select("id, barcode, sku, name, image_url").eq("barcode", targetBarcode).maybeSingle();
          if (pData) {
            resolved = { product: pData, qtyMulti: 1 };
            barcodeResolverCache.current.set(targetBarcode, resolved);
          }
        }
      }

      if (!resolved) {
        triggerFeedback('error', "HATA: Ürün sistemde bulunamadı!");
        setIsProcessing(false); setScanInput(""); return;
      }

      const finalQty = inputQty * resolved.qtyMulti;

      // HASARLI RAF MODALI TETİKLEYİCİSİ
      if (activeShelf.status?.toUpperCase() === 'HASARLI') {
        setPendingRemoval({ product: resolved.product, qty: finalQty });
        setIsProcessing(false); 
      } else {
        await finalizeRemoval(resolved.product, finalQty, null);
      }
    } catch (error) { 
      triggerFeedback('error', "İşlem Hatası!"); 
      setIsProcessing(false); 
      setScanInput(""); 
    }
  };

  const finalizeRemoval = async (productDetails: any, qty: number, reasonDetails: string | null) => {
    setIsProcessing(true);
    try {
      const serverResponse = await processPickingServer({
        productId: productDetails.id,
        branchId: branchId!,
        shelfId: activeShelf!.id,
        shelfName: activeShelf!.name,
        quantity: qty,
        empId: empId,
        productDetails: productDetails,
        reasonDetails: reasonDetails
      });

      if (!serverResponse.success) {
        triggerFeedback('error', `HATA: ${serverResponse.error}`);
        setIsProcessing(false); setScanInput(""); return;
      }

      const logEntry: SessionLogItem = {
        id: Math.random().toString(36).substring(7),
        product: productDetails,
        quantity: qty,
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        reason: reasonDetails || undefined
      };

      setLastScanned(logEntry);
      setSessionLogs(prev => [logEntry, ...prev]);
      
      triggerFeedback('success');
      setSelectedQty(1);
      setPendingRemoval(null);
      setRemovalReason("eksik_parca"); setRequestedBy(""); setOtherDescription("");
      
    } catch (err) { triggerFeedback('error', "Kayıt Hatası!"); } 
    finally { setIsProcessing(false); setScanInput(""); if(!isManualMode) setTimeout(() => scanInputRef.current?.focus(), 50); }
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingRemoval) return;

    let finalReason = "";
    if (removalReason === "yonetici_hediye") {
      if(!requestedBy.trim()) return requestedByRef.current?.focus();
      finalReason = `Yönetici Talepli Hediye (Talep Eden: ${requestedBy.trim()})`;
    } else if (removalReason === "diger") {
      if(!otherDescription.trim()) return otherDescRef.current?.focus();
      finalReason = `Diğer: ${otherDescription.trim()}`;
    } else {
      finalReason = "Eksik Parça Tedariği (Müşteri/Mağaza Talepli)";
    }

    finalizeRemoval(pendingRemoval.product, pendingRemoval.qty, finalReason);
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
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col antialiased select-none print:bg-white" onClick={() => { if(!isManualMode && !pendingRemoval && activeTab==='terminal') scanInputRef.current?.focus(); }}>
      
      {/* WMS YENİ HEADER: Dark-Industrial Bilgi Matrisi */}
      <div className="bg-[#0b101e] shadow-xl shrink-0 border-b-4 border-[#dc3545] relative overflow-hidden z-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[100px] pointer-events-none"></div>

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
               <span className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest mt-1">Raftan Alma (Picking) Motoru</span>
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
                     <MapPin size={12} className="text-orange-500" />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">OTURUM LOKASYONU</span>
                   </div>
                   <span className="text-[13px] font-black text-orange-400 uppercase tracking-wider truncate max-w-[120px] sm:max-w-full">
                     {branchName}
                   </span>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center sm:items-start py-2 sm:px-6">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <Database size={12} className="text-[#dc3545]" />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SİSTEM DURUMU</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-[#dc3545] animate-pulse shadow-[0_0_8px_#dc3545]"></div>
                     <span className="text-[13px] font-black text-red-400 uppercase tracking-wider">AKTİF</span>
                   </div>
                </div>
             </div>
           </div>
        </div>
      </div>

      {/* 1. RAF BARKODU KİLİTLEME */}
      {!activeShelf && (
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
          <div className="absolute top-1/4 -right-20 w-64 h-64 bg-red-200/40 rounded-full blur-[80px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 -left-20 w-64 h-64 bg-orange-200/30 rounded-full blur-[80px] pointer-events-none"></div>
          
          <div className="bg-white p-6 sm:p-10 border border-slate-200 shadow-xl max-w-lg w-full flex flex-col gap-6 rounded-sm relative z-10">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 to-[#dc3545]"></div>

            <div className="flex flex-col items-center text-center gap-3 mb-2 border-b border-slate-100 pb-6">
              <div className="bg-red-50 border-2 border-red-100 p-4 rounded-full text-[#dc3545] shadow-sm"><BoxSelect size={40} /></div>
              <h2 className="text-[18px] sm:text-[20px] font-black uppercase text-slate-800 tracking-widest">Raf Barkodunu Okut</h2>
              <p className="text-[12px] font-bold text-slate-500 max-w-sm leading-relaxed">
                Ürün eksilteceğiniz rafın ID'sini terminalden okutarak sistemi kilitli hale getirin.
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
                className="w-full min-h-[64px] bg-slate-50 border-2 border-slate-300 text-slate-900 text-center text-[22px] sm:text-[24px] tracking-widest uppercase font-black font-mono p-4 rounded-sm focus:outline-none focus:border-[#dc3545] focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner disabled:opacity-50"
              />
              <button type="submit" disabled={isProcessing || !shelfInput} className="w-full min-h-[56px] bg-[#dc3545] text-white p-4 font-black uppercase tracking-widest hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 rounded-sm">
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

          {/* HASARLI RAF MODALI */}
          {pendingRemoval && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-sm shadow-2xl w-full max-w-md flex flex-col overflow-hidden border-t-4 border-[#dc3545]">
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
                  <AlertTriangle className="text-[#dc3545]" size={24}/>
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-[14px]">Hasarlı Raf Çıkışı</h3>
                    <p className="text-[11px] text-slate-600 font-bold uppercase mt-0.5">Lütfen stok düşüm sebebini seçiniz.</p>
                  </div>
                </div>
                <form onSubmit={handleModalSubmit} className="p-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">İşlem Gerekçesi</label>
                    <select 
                      value={removalReason} 
                      onChange={(e) => setRemovalReason(e.target.value)}
                      className="w-full border-2 border-slate-300 p-3 min-h-[48px] rounded-sm bg-slate-50 text-slate-800 font-bold text-[13px] focus:outline-none focus:border-[#dc3545]"
                    >
                      <option value="eksik_parca">Eksik Parça Tedariği (Müşteri/Mağaza)</option>
                      <option value="yonetici_hediye">Yönetici Talepli Hediye</option>
                      <option value="diger">Diğer / Manuel Giriş</option>
                    </select>
                  </div>

                  {removalReason === "yonetici_hediye" && (
                    <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                      <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Talep Eden Kişi / Yönetici</label>
                      <input 
                        ref={requestedByRef}
                        type="text" 
                        value={requestedBy} 
                        onChange={(e) => setRequestedBy(e.target.value)}
                        placeholder="Örn: İsmail Bey"
                        className="w-full border-2 border-slate-300 p-3 min-h-[48px] rounded-sm focus:outline-none focus:border-[#dc3545] font-bold text-[13px]"
                      />
                    </div>
                  )}

                  {removalReason === "diger" && (
                    <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                      <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Açıklama</label>
                      <input 
                        ref={otherDescRef}
                        type="text" 
                        value={otherDescription} 
                        onChange={(e) => setOtherDescription(e.target.value)}
                        placeholder="Örn: Ürün kırık çıktı"
                        className="w-full border-2 border-slate-300 p-3 min-h-[48px] rounded-sm focus:outline-none focus:border-[#dc3545] font-bold text-[13px]"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => {setPendingRemoval(null); setScanInput(""); setTimeout(() => scanInputRef.current?.focus(), 50);}} className="flex-1 min-h-[48px] bg-slate-200 text-slate-700 font-black text-[12px] uppercase tracking-widest rounded-sm hover:bg-slate-300 transition-colors">İptal</button>
                    <button type="submit" disabled={isProcessing} className="flex-1 min-h-[48px] bg-[#dc3545] text-white font-black text-[12px] uppercase tracking-widest rounded-sm hover:bg-red-700 transition-colors shadow-md">Stoğu Düş</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* KOKPİT ÜST BİLGİ PANELİ */}
          <div className="bg-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 shrink-0 border-b-2 border-slate-200 shadow-sm relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#dc3545]"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className={`p-2 sm:p-3 border-2 shadow-sm rounded-sm ${activeShelf.status?.toUpperCase() === 'HASARLI' ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-red-50 border-red-100 text-[#dc3545]'}`}>
                <Server size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                  <Hash size={10}/> AKTİF RAF
                </span>
                <span className="text-[14px] sm:text-[18px] font-black tracking-widest uppercase text-slate-800 truncate flex items-center gap-2">
                  {activeShelf.name} 
                  {activeShelf.status?.toUpperCase() === 'HASARLI' ? (
                    <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-sm border border-amber-200 ml-2">HASARLI RAF</span>
                  ) : (
                    <span className="text-[#dc3545] text-[12px] bg-red-50 px-1.5 py-0.5 rounded-sm font-mono border border-red-100 ml-2">(ID:{activeShelf.id})</span>
                  )}
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
                      <PackageMinus size={48} className="opacity-50 sm:w-16 sm:h-16" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Düşülecek Barkod Bekleniyor</span>
                    </div>
                  )}
                  {lastScanned && (
                    <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md p-2 text-center border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                      <span className="text-slate-800 text-[11px] sm:text-[12px] font-bold line-clamp-1">{lastScanned.product.name}</span>
                    </div>
                  )}
                </div>

                {/* Barkod Okuma Formu / Kamera Alanı */}
                {activeTab === 'terminal' ? (
                  <form onSubmit={handleTerminalScan} className="flex flex-col gap-2">
                    <input 
                      ref={scanInputRef} 
                      type="text" 
                      value={scanInput} 
                      onChange={e => setScanInput(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleTerminalScan(e)}
                      placeholder="DÜŞÜLECEK ÜRÜN" 
                      disabled={isProcessing} 
                      className="w-full min-h-[56px] sm:min-h-[64px] text-center font-black text-[18px] sm:text-[20px] uppercase p-3 sm:p-4 border-2 focus:outline-none tracking-widest transition-all shadow-inner disabled:opacity-50 bg-slate-50 text-slate-900 border-slate-300 focus:border-[#dc3545] focus:bg-white placeholder:text-slate-400 font-mono rounded-sm" 
                    />
                    <button type="submit" className="hidden" /> 
                  </form>
                ) : (
                  <div id="reader" className="w-full bg-slate-950 border-2 border-slate-800 overflow-hidden min-h-[200px] sm:min-h-[250px] rounded-sm" />
                )}

                {/* ADET ÇARPANI VE MANUEL GİRİŞ TOGGLE */}
                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12} className="text-[#dc3545]"/> Düşülecek Adet Seçimi</span>
                    
                    {/* KLAVYE TOGGLE BUTONU */}
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsManualMode(!isManualMode);
                        if (!isManualMode) setTimeout(() => manualInputRef.current?.focus(), 100);
                        else setTimeout(() => scanInputRef.current?.focus(), 100);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border ${isManualMode ? 'bg-[#0f172b] border-slate-800 text-white shadow-md' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {isManualMode ? <X size={14}/> : <Keyboard size={14}/>}
                      {isManualMode ? 'KLAVYEYİ KAPAT' : 'MANUEL GİRİŞ'}
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
                    <div className="flex items-center gap-3 border-2 p-2 rounded-sm transition-colors w-full overflow-hidden bg-red-50/50 border-red-300 focus-within:border-[#dc3545] animate-in slide-in-from-top-2">
                      <span className="text-red-700 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel:</span>
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
                  <ListTodo size={16} className="text-[#dc3545]"/> Çıkarılan Ürünler
                </span>
                <span className="bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-widest border border-slate-700 rounded-sm shadow-sm text-red-400">
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
                      <th className="p-3 w-16 text-center text-[#dc3545] bg-red-50">Düşülen</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] font-bold text-slate-800 divide-y divide-slate-100">
                    {sessionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors bg-white animate-in fade-in duration-300">
                        <td className="p-3 border-r border-slate-100 text-slate-400 font-black">{log.time}</td>
                        <td className="p-3 border-r border-slate-100 overflow-hidden">
                           <span className="tracking-widest uppercase truncate block text-[#0f172b] font-mono bg-slate-100 px-1 py-0.5 rounded-sm border border-slate-200">{log.product.barcode}</span>
                        </td>
                        <td className="p-3 border-r border-slate-100">
                          <span className="line-clamp-2 leading-tight text-slate-700">{log.product.name}</span>
                          {log.reason && <span className="block mt-1 text-[9px] text-[#dc3545] bg-red-50 px-1.5 py-0.5 rounded-sm w-fit border border-red-100 flex items-center gap-1"><Info size={10}/> {log.reason}</span>}
                        </td>
                        <td className="p-3 text-center bg-red-50/40">
                          <span className="text-[15px] font-black text-[#dc3545]">- {log.quantity}</span>
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