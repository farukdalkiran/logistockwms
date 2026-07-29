"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { processPickingServer } from "@/app/actions/inventory"; 
import { 
  ChevronLeft, UserCircle, MapPin, Hash, AlertTriangle, 
  PackageMinus, ScanLine, Smartphone, Edit3, ArrowRight,
  BoxSelect, Server, ClipboardList, Info, Keyboard, ListTodo
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
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'success') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
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
  
  const [shelfInput, setShelfInput] = useState("");
  const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);

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
  
  // KLAVYE FOCUS HIRSIZLIĞI KORUMASI
  const [isManualInputFocused, setIsManualInputFocused] = useState(false);
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const shelfInputRef = useRef<HTMLInputElement>(null);
  const requestedByRef = useRef<HTMLInputElement>(null);
  const otherDescRef = useRef<HTMLInputElement>(null);
  const lastCameraScanTime = useRef<number>(0);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const qtyButtons = [1, 2, 3, 4, 5, 10];

  const opState = useRef({ selectedQty });
  useEffect(() => { opState.current = { selectedQty }; }, [selectedQty]);

  // AUTO-FOCUS RADAR MOTORU (Klavye veya Modal açıksa odağı çalmaz)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isProcessing && !pendingRemoval && !isManualInputFocused) {
        if (!activeShelf && document.activeElement !== shelfInputRef.current) {
          shelfInputRef.current?.focus();
        } else if (activeShelf && activeTab === 'terminal' && document.activeElement !== scanInputRef.current) {
          scanInputRef.current?.focus();
        }
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeShelf, activeTab, isProcessing, pendingRemoval, isManualInputFocused]);

  useEffect(() => {
    const initData = async () => {
      const { data: empData } = await supabase.from("employees").select("branch_id").eq("id", empId).single();
      if (empData?.branch_id) setBranchId(empData.branch_id);
    };
    initData();
  }, [empId]);

  const triggerFeedback = useCallback((type: 'success' | 'error', msg: string = "") => {
    playScanSound(type); 
    setFlashState(type); 
    if (type === 'error') setErrorMsg(msg);
    setTimeout(() => { setFlashState('idle'); if (type === 'error') setErrorMsg(""); }, 2000);
  }, []);

  // RAF KİLİTLEME
  const handleLockShelf = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const cleanShelf = shelfInput.trim().toUpperCase();
    if (!cleanShelf || !branchId || isProcessing) return;

    setIsProcessing(true);
    try {
      const isNumeric = /^\d+$/.test(cleanShelf);
      let query = supabase.from("shelves").select("id, name, status").eq("branch_id", branchId);
      
      if (isNumeric) query = query.or(`id.eq.${cleanShelf},name.ilike.${cleanShelf}`);
      else query = query.ilike("name", cleanShelf);

      const { data: shelfData, error } = await query.maybeSingle();

      if (error || !shelfData) {
        triggerFeedback('error', `HATA: ${cleanShelf} rafı bulunamadı!`);
        setShelfInput("");
      } else {
        setActiveShelf(shelfData);
        setShelfInput("");
        triggerFeedback('success');
      }
    } catch (err) { triggerFeedback('error', "Sistem Hatası!"); } 
    finally { setIsProcessing(false); }
  };

  // ÜRÜN BARKOD İŞLEME MOTORU
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

      // 1. Koli (Box) Barkodu Kontrolü
      const { data: boxData } = await supabase.from("boxes").select("product_id, quantity").eq("box_barcode", targetBarcode).maybeSingle();
      if (boxData) {
        const { data: pData } = await supabase.from("products").select("barcode").eq("id", boxData.product_id).single();
        if (pData) { targetBarcode = pData.barcode; inputQty = boxData.quantity * inputQty; }
      }

      // 2. Ürünü Doğrudan Ürünler Tablosundan Çek
      const { data: productDetails, error: pErr } = await supabase.from("products")
        .select("id, barcode, sku, name, image_url")
        .eq("barcode", targetBarcode)
        .maybeSingle();

      if (pErr || !productDetails) {
        triggerFeedback('error', "HATA: Ürün bulunamadı!");
        setIsProcessing(false); setScanInput(""); return;
      }

      // 3. Raf HASARLI ise Modal Tetikle, Değilse Doğrudan Sunucuya Gönder
      if (activeShelf.status?.toUpperCase() === 'HASARLI') {
        setPendingRemoval({ product: productDetails, qty: inputQty });
        setIsProcessing(false); 
      } else {
        await finalizeRemoval(productDetails, inputQty, null);
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
    finally { setIsProcessing(false); setScanInput(""); if(!isManualInputFocused) setTimeout(() => scanInputRef.current?.focus(), 50); }
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

  // KAMERA OKUYUCU MOTORU (Html5Qrcode Lifecyle Fix)
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
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col antialiased select-none">
      
      {/* HEADER - SADECE BURASI DARK (Koyu Endüstriyel) */}
      <div className="bg-[#0b101e] shadow-xl shrink-0 border-b-4 border-[#dc3545] relative overflow-hidden z-20">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-red-900/20 to-black/40 pointer-events-none"></div>
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-800/60 max-w-7xl mx-auto w-full relative z-10">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 p-2 sm:p-3 transition-all rounded-sm shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-2">
              <PackageMinus size={18} className="text-[#dc3545] hidden sm:block" />
              <span className="text-white text-[15px] sm:text-[16px] font-black uppercase tracking-widest line-clamp-1 drop-shadow-md">
                Raftan Kaldırma (Picking)
              </span>
            </div>
            <span className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} className="text-[#dc3545]"/> {branchName}
            </span>
          </div>
          <div className="w-11 shrink-0 flex justify-end">
             <div className="bg-red-900/30 text-red-400 w-10 h-10 rounded-full flex items-center justify-center font-black text-[12px] border border-red-900/50 shadow-sm">
                {empName.substring(0,2).toUpperCase()}
             </div>
          </div>
        </div>
      </div>

      {/* 1. RAF BARKODU KİLİTLEME (AYDINLIK TEMA) */}
      {!activeShelf && (
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
          <div className="absolute top-1/4 -right-20 w-64 h-64 bg-red-200/40 rounded-full blur-[80px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 -left-20 w-64 h-64 bg-orange-200/30 rounded-full blur-[80px] pointer-events-none"></div>
          
          <div className="bg-white p-6 sm:p-10 border border-slate-200 shadow-xl max-w-lg w-full flex flex-col gap-6 rounded-sm relative z-10">
            
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
                disabled={isProcessing}
                className="w-full min-h-[64px] bg-slate-50 border-2 border-slate-300 text-slate-900 text-center text-[22px] sm:text-[24px] tracking-widest uppercase font-black font-mono p-4 rounded-sm focus:outline-none focus:border-[#dc3545] focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner disabled:opacity-50"
              />
              <button type="submit" disabled={isProcessing || !shelfInput} className="w-full min-h-[56px] bg-[#dc3545] text-white p-4 font-black uppercase tracking-widest hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 rounded-sm">
                KİLİTLE VE BAŞLA <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. OPERASYON KOKPİTİ (AYDINLIK TEMA) */}
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
                      onFocus={() => setIsManualInputFocused(true)}
                      onBlur={() => setIsManualInputFocused(false)}
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
                        onFocus={() => setIsManualInputFocused(true)}
                        onBlur={() => setIsManualInputFocused(false)}
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
                        onFocus={() => setIsManualInputFocused(true)}
                        onBlur={() => setIsManualInputFocused(false)}
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

          {/* RAF BİLGİ PANELİ */}
          <div className="bg-white p-3 sm:p-4 flex justify-between items-center gap-2 z-10 shrink-0 border-b border-slate-200 shadow-sm relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#dc3545]"></div>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pl-2">
              <div className={`p-2 border-2 shadow-sm shrink-0 rounded-sm ${activeShelf.status?.toUpperCase() === 'HASARLI' ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-red-50 border-red-100 text-[#dc3545]'}`}>
                <Server size={18} className="sm:w-5 sm:h-5" />
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
            
            <button onClick={() => setActiveShelf(null)} className="shrink-0 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition-colors shadow-sm rounded-sm flex items-center justify-center">
              DEĞİŞTİR
            </button>
          </div>

          <div className="flex-1 p-2 sm:p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-2 sm:gap-6 z-10 overflow-hidden">
            
            {/* SOL: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-2 sm:gap-4 shrink-0">
              <div className="flex bg-white border border-slate-200 p-1 rounded-sm shadow-sm">
                <button onClick={() => setActiveTab('terminal')} className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 py-2 text-[11px] sm:text-[12px] font-black uppercase tracking-widest transition-all rounded-sm ${activeTab === 'terminal' ? 'bg-[#0f172b] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={16} /> Terminal</button>
                <button onClick={() => setActiveTab('camera')} className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 py-2 text-[11px] sm:text-[12px] font-black uppercase tracking-widest transition-all rounded-sm ${activeTab === 'camera' ? 'bg-[#0f172b] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Smartphone size={16} /> Kamera</button>
              </div>

              <div className="bg-white p-3 sm:p-4 shadow-sm border border-slate-200 flex flex-col gap-3 rounded-sm relative">
                
                {/* Ürün Görseli */}
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
                    <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md p-1.5 sm:p-2 text-center border-t border-slate-200 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
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

                {/* ADET ÇARPANI VE MANUEL GİRİŞ */}
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 mt-1">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12} className="text-[#dc3545]"/> Düşülecek Adet Seçimi</span>
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                    {qtyButtons.map(qty => (
                      <button key={qty} type="button" onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 50); }} className={`flex-1 min-h-[48px] text-[15px] font-black transition-all border-2 rounded-sm flex items-center justify-center ${selectedQty === qty ? 'bg-[#dc3545] border-[#dc3545] text-white shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:bg-slate-100'}`}>{qty}</button>
                    ))}
                  </div>
                  
                  <div className={`flex items-center gap-2 border-2 p-1.5 rounded-sm transition-colors w-full min-h-[48px] ${isManualInputFocused ? 'border-[#dc3545] bg-red-50/50 ring-4 ring-red-500/10' : 'border-slate-200 bg-slate-50'}`}>
                    <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0 flex items-center gap-1">
                      <Keyboard size={14}/> Manuel:
                    </span>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={selectedQty} 
                      onFocus={() => setIsManualInputFocused(true)}
                      onBlur={() => {
                        setIsManualInputFocused(false);
                        setTimeout(() => scanInputRef.current?.focus(), 100);
                      }}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSelectedQty(val);
                      }} 
                      className="flex-1 bg-transparent text-slate-900 font-black text-[20px] text-right focus:outline-none pr-2 min-w-0 w-full" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SAĞ: OTURUM LOGLARI (AYDINLIK TEMA) */}
            <div className="flex-1 bg-white border border-slate-200 shadow-sm flex flex-col overflow-hidden rounded-sm mt-2 lg:mt-0 h-48 lg:h-auto min-h-[250px]">
              <div className="bg-slate-50 px-3 sm:px-4 py-3 flex justify-between items-center border-b border-slate-200 shrink-0">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-700"><ListTodo size={16} className="text-[#dc3545]"/> Çıkarılan Ürünler</span>
                <span className="bg-white px-2 py-0.5 text-[10px] font-bold tracking-widest border border-slate-200 rounded-sm shadow-sm text-slate-600">{sessionLogs.length} Kayıt</span>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse min-w-[450px]">
                  <thead className="bg-white text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="p-2 sm:p-3 w-16 sm:w-20 border-r border-slate-100">Saat</th>
                      <th className="p-2 sm:p-3 w-28 sm:w-32 border-r border-slate-100">Barkod</th>
                      <th className="p-2 sm:p-3 border-r border-slate-100">Ürün Adı</th>
                      <th className="p-2 sm:p-3 w-16 sm:w-20 text-center text-[#dc3545] bg-red-50/50">Düşülen</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] sm:text-[12px] font-bold text-slate-800 divide-y divide-slate-100">
                    {sessionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors bg-transparent animate-in fade-in duration-300">
                        <td className="p-2 sm:p-3 border-r border-slate-100 text-slate-400 font-black">{log.time}</td>
                        <td className="p-2 sm:p-3 border-r border-slate-100 overflow-hidden">
                           <span className="tracking-widest uppercase truncate block text-[#0f172b] font-mono bg-slate-100 px-1 py-0.5 rounded-sm border border-slate-200">{log.product.barcode}</span>
                        </td>
                        <td className="p-2 sm:p-3 border-r border-slate-100">
                          <span className="line-clamp-1 leading-tight text-slate-700">{log.product.name}</span>
                          {log.reason && <span className="block mt-1 text-[9px] text-[#dc3545] bg-red-50 px-1.5 py-0.5 rounded-sm w-fit border border-red-100 flex items-center gap-1"><Info size={10}/> {log.reason}</span>}
                        </td>
                        <td className="p-2 sm:p-3 text-center bg-red-50/30"><span className="text-[14px] sm:text-[15px] font-black text-[#dc3545]">- {log.quantity}</span></td>
                      </tr>
                    ))}
                    {sessionLogs.length === 0 && (
                      <tr><td colSpan={4} className="p-8 sm:p-12 text-center text-slate-400 text-[10px] sm:text-[12px] font-black uppercase tracking-widest border-dashed border-2 border-slate-100 m-4 block w-auto">Mevcut oturumda işlem yok</td></tr>
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