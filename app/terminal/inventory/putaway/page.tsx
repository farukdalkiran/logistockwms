"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { processPutawayServer } from "@/app/actions/inventory"; 
import { 
  ChevronLeft, UserCircle, MapPin, Hash, AlertTriangle, 
  Package, ScanLine, Smartphone, Edit3, ArrowRight,
  BoxSelect, Server, PlusCircle, ClipboardList, Keyboard
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
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'success') {
      // Başarılı: İnce ve kısa bir bip
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else {
      // Hata: Kalın ve uzun uyarı sesi (Buzzer)
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
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
  
  const [shelfInput, setShelfInput] = useState("");
  const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);

  const [activeTab, setActiveTab] = useState<'terminal' | 'camera'>('terminal');
  const [scanInput, setScanInput] = useState("");
  const [selectedQty, setSelectedQty] = useState<number | string>(1);
  const [lastScanned, setLastScanned] = useState<SessionLogItem | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLogItem[]>([]); 
  
  const [isProcessing, setIsProcessing] = useState(false); 
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  // FIX: Android Terminal Klavye Auto-Focus Kapatıcısı
  const [isManualInputFocused, setIsManualInputFocused] = useState(false);
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const shelfInputRef = useRef<HTMLInputElement>(null);
  const lastCameraScanTime = useRef<number>(0);
  const qtyButtons = [1, 2, 3, 4, 5, 10];

  const opState = useRef({ selectedQty });
  useEffect(() => { opState.current = { selectedQty }; }, [selectedQty]);

  // FIX: Radar motoru klavye açılınca duraklar, kapanınca taramaya devam eder
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isProcessing && !isManualInputFocused) {
        if (!activeShelf && document.activeElement !== shelfInputRef.current) {
          shelfInputRef.current?.focus();
        } else if (activeShelf && activeTab === 'terminal' && document.activeElement !== scanInputRef.current) {
          scanInputRef.current?.focus();
        }
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeShelf, activeTab, isProcessing, isManualInputFocused]);

  useEffect(() => {
    const initData = async () => {
      const { data: empData } = await supabase.from("employees").select("branch_id").eq("id", empId).single();
      if (empData?.branch_id) setBranchId(empData.branch_id); 
    };
    initData();
  }, [empId]);

  const triggerFeedback = useCallback((type: 'success' | 'error', msg: string = "") => {
    playScanSound(type); // Ses motoru tetiklenir
    setFlashState(type); 
    if (type === 'error') setErrorMsg(msg);
    setTimeout(() => { setFlashState('idle'); if (type === 'error') setErrorMsg(""); }, 2000);
  }, []);

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

      const { data: boxData } = await supabase.from("boxes").select("product_id, quantity").eq("box_barcode", targetBarcode).maybeSingle();
      if (boxData) {
        const { data: pData } = await supabase.from("products").select("barcode").eq("id", boxData.product_id).single();
        if (pData) { targetBarcode = pData.barcode; inputQty = boxData.quantity * inputQty; }
      }

      const { data: productDetails, error: pErr } = await supabase.from("products").select("id, barcode, sku, name, image_url").eq("barcode", targetBarcode).maybeSingle();
      if (pErr || !productDetails) {
        triggerFeedback('error', "HATA: Ürün bulunamadı!");
        setIsProcessing(false); setScanInput(""); return;
      }

      const serverResponse = await processPutawayServer({
        productId: productDetails.id,
        branchId: branchId,
        shelfId: activeShelf.id,
        shelfName: activeShelf.name,
        quantity: inputQty,
        empId: empId,
        productDetails: productDetails
      });

      if (!serverResponse.success) {
        triggerFeedback('error', `Sunucu: ${serverResponse.error}`);
        setIsProcessing(false); setScanInput(""); return;
      }

      const logEntry: SessionLogItem = {
        id: Math.random().toString(36).substring(7),
        product: productDetails,
        quantity: inputQty,
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      setLastScanned(logEntry);
      setSessionLogs(prev => [logEntry, ...prev]);
      
      triggerFeedback('success');
      setSelectedQty(1); // Okuma sonrası adeti 1'e resetle

    } catch (error) { 
      triggerFeedback('error', "Kayıt Hatası!"); 
    } finally { 
      setIsProcessing(false); 
      setScanInput(""); 
      // İşlem bitince odağı tekrar ana inputa al (eğer klavyede değilsek)
      if(!isManualInputFocused) setTimeout(() => scanInputRef.current?.focus(), 50); 
    }
  };

  const handleTerminalScan = (e?: React.FormEvent | React.KeyboardEvent) => { 
    if(e) e.preventDefault(); 
    processBarcode(scanInput, false); 
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (activeShelf && activeTab === 'camera') {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 4, qrbox: { width: 250, height: 150 } }, 
        (decodedText) => processBarcode(decodedText, true), 
        () => {}
      ).catch(console.error);
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error); };
  }, [activeShelf, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col antialiased select-none">
      
      {/* ŞIK ENDÜSTRİYEL HEADING (Kırmızı & Mor Vurgulu, Aydınlık Tema Uyumlu) */}
      <div className="bg-white shadow-sm shrink-0 relative overflow-hidden z-20 border-b border-slate-200">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-[#dc3545]"></div>
        <div className="flex items-center justify-between p-3 sm:p-4 max-w-7xl mx-auto w-full relative z-10">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 p-2 sm:p-3 transition-all rounded-sm shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center border border-slate-200">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-2">
              <PlusCircle size={16} className="text-purple-600 hidden sm:block" />
              <span className="text-slate-900 text-[16px] sm:text-[18px] font-black uppercase tracking-widest">
                Hızlı Raflama
              </span>
            </div>
            <span className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} className="text-[#dc3545]"/> {branchName}
            </span>
          </div>
          <div className="w-11 shrink-0 flex justify-end">
             <div className="bg-purple-100 text-purple-700 w-10 h-10 rounded-full flex items-center justify-center font-black text-[12px] border-2 border-purple-200 shadow-sm">
                {empName.substring(0,2).toUpperCase()}
             </div>
          </div>
        </div>
      </div>

      {/* 1. RAF BARKODU KİLİTLEME (AYDINLIK & ŞIK TEMA) */}
      {!activeShelf && (
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute top-1/4 -right-20 w-64 h-64 bg-purple-200/40 rounded-full blur-[80px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 -left-20 w-64 h-64 bg-red-200/40 rounded-full blur-[80px] pointer-events-none"></div>
          
          <div className="bg-white p-6 sm:p-10 border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col gap-6 rounded-sm relative z-10">
            
            <div className="flex flex-col items-center text-center gap-3 mb-2 border-b border-slate-100 pb-6">
              <div className="bg-purple-50 border-2 border-purple-100 p-4 rounded-full text-purple-600 shadow-sm">
                <BoxSelect size={40} />
              </div>
              <h2 className="text-[18px] sm:text-[20px] font-black uppercase text-slate-800 tracking-widest">Rafı Kilitle</h2>
              <p className="text-[12px] font-bold text-slate-500 max-w-sm leading-relaxed">
                İşlem yapmak istediğiniz rafın ID'sini terminalden okutarak veya yazarak kilitli hale getirin.
              </p>
            </div>
            
            <form onSubmit={handleLockShelf} className="flex flex-col gap-4">
              {/* FIX: Android Enter Yakalayıcı */}
              <input 
                ref={shelfInputRef}
                type="text" 
                value={shelfInput}
                onChange={(e) => setShelfInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLockShelf(e)}
                placeholder="RAF BARKODU"
                disabled={isProcessing}
                className="w-full min-h-[64px] bg-slate-50 border-2 border-slate-300 text-slate-900 text-center text-[22px] sm:text-[24px] tracking-widest uppercase font-black font-mono p-4 rounded-sm focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all shadow-inner disabled:opacity-50"
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
          {/* Flaş Efektleri */}
          <div className={`pointer-events-none fixed inset-0 z-40 transition-colors duration-300 ${flashState === 'success' ? 'bg-green-500/10' : flashState === 'error' ? 'bg-[#dc3545]/20' : 'bg-transparent'}`} />

          {errorMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#dc3545] text-white px-4 sm:px-6 py-4 font-black text-[12px] sm:text-[14px] tracking-widest uppercase shadow-2xl border-2 border-red-900 flex items-center gap-3 w-[95%] max-w-md text-center rounded-sm animate-in slide-in-from-top-4">
              <AlertTriangle size={24} className="shrink-0" /> {errorMsg}
            </div>
          )}

          {/* RAF BİLGİ PANELİ */}
          <div className="bg-white p-3 sm:p-4 flex justify-between items-center gap-2 z-10 shrink-0 border-b border-slate-200 shadow-sm relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-600"></div>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pl-2">
              <div className="p-2 border border-purple-100 shadow-sm shrink-0 rounded-sm bg-purple-50 text-purple-600">
                <Server size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                  <Hash size={10}/> AKTİF RAF
                </span>
                <span className="text-[14px] sm:text-[18px] font-black tracking-widest uppercase text-slate-800 truncate flex items-center gap-2">
                  {activeShelf.name} <span className="text-purple-500 text-[12px] bg-purple-50 px-1.5 py-0.5 rounded-sm font-mono border border-purple-100">(ID:{activeShelf.id})</span>
                </span>
              </div>
            </div>
            
            <button onClick={() => setActiveShelf(null)} className="shrink-0 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 px-3 sm:px-5 py-2 sm:py-3 min-h-[44px] font-black text-[10px] sm:text-[12px] uppercase tracking-widest transition-colors shadow-sm rounded-sm flex items-center justify-center">
              DEĞİŞTİR
            </button>
          </div>

          <div className="flex-1 p-2 sm:p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-2 sm:gap-6 z-10 overflow-hidden">
            
            {/* SOL: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-2 sm:gap-4 shrink-0">
              
              {/* Tab Geçişleri */}
              <div className="flex bg-white border border-slate-200 p-1 rounded-sm shadow-sm">
                <button onClick={() => setActiveTab('terminal')} className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 py-2 text-[11px] sm:text-[12px] font-black uppercase tracking-widest transition-all rounded-sm ${activeTab === 'terminal' ? 'bg-purple-50 text-purple-700 border-2 border-purple-200 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={16} /> Terminal</button>
                <button onClick={() => setActiveTab('camera')} className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 py-2 text-[11px] sm:text-[12px] font-black uppercase tracking-widest transition-all rounded-sm ${activeTab === 'camera' ? 'bg-purple-50 text-purple-700 border-2 border-purple-200 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Smartphone size={16} /> Kamera</button>
              </div>

              <div className="bg-white p-3 sm:p-4 shadow-sm border border-slate-200 flex flex-col gap-3 rounded-sm relative">
                
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
                    {/* FIX: Terminal Enter OnKeyDown */}
                    <input 
                      ref={scanInputRef} 
                      type="text" 
                      value={scanInput} 
                      onChange={e => setScanInput(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleTerminalScan(e)}
                      placeholder="ÜRÜN/KOLİ OKUT" 
                      disabled={isProcessing} 
                      className="w-full min-h-[56px] sm:min-h-[64px] text-center font-black text-[18px] sm:text-[20px] uppercase p-3 sm:p-4 border-2 focus:outline-none tracking-widest transition-all shadow-inner disabled:opacity-50 bg-slate-50 text-slate-900 border-slate-300 focus:border-[#dc3545] focus:bg-white placeholder:text-slate-400 font-mono rounded-sm" 
                    />
                    <button type="submit" className="hidden" /> 
                  </form>
                ) : (
                  <div id="reader" className="w-full bg-slate-950 border-2 border-slate-800 overflow-hidden min-h-[200px] sm:min-h-[250px] rounded-sm" />
                )}

                {/* ADET ÇARPANI (Manuel Klavye Destekli) */}
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 mt-1">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12} className="text-purple-500"/> Adet Çarpanı</span>
                  
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                    {qtyButtons.map(qty => (
                      <button key={qty} type="button" onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 50); }} className={`flex-1 min-h-[48px] text-[15px] font-black transition-all border-2 rounded-sm flex items-center justify-center ${selectedQty === qty ? 'bg-[#dc3545] border-[#dc3545] text-white shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:bg-slate-100'}`}>{qty}</button>
                    ))}
                  </div>
                  
                  {/* FIX: Klavye Auto-Focus Yönetimi ve Numpad Desteği */}
                  <div className={`flex items-center gap-2 border-2 p-1.5 rounded-sm transition-colors w-full min-h-[48px] ${isManualInputFocused ? 'border-purple-500 bg-purple-50/50 ring-4 ring-purple-500/10' : 'border-slate-200 bg-slate-50'}`}>
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
                         // Klavye kapanınca tekrar radarı okuyucuya çek
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

            {/* SAĞ: OTURUM LOGLARI (BEYAZ TEMA, ŞIK TABLO) */}
            <div className="flex-1 bg-white border border-slate-200 shadow-sm flex flex-col overflow-hidden rounded-sm mt-2 lg:mt-0 h-48 lg:h-auto min-h-[250px]">
              
              <div className="bg-slate-50 px-3 sm:px-4 py-3 flex justify-between items-center border-b border-slate-200 shrink-0">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-700">
                  <ClipboardList size={16} className="text-purple-600"/> İşlem Geçmişi
                </span>
                <span className="bg-white px-2 py-0.5 text-[10px] font-bold tracking-widest border border-slate-200 rounded-sm shadow-sm text-slate-600">
                  {sessionLogs.length} Kayıt
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead className="bg-white text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="p-2 sm:p-3 w-16 sm:w-20 border-r border-slate-100">Saat</th>
                      <th className="p-2 sm:p-3 w-28 sm:w-32 border-r border-slate-100">Barkod</th>
                      <th className="p-2 sm:p-3 border-r border-slate-100">Ürün Adı</th>
                      <th className="p-2 sm:p-3 w-16 sm:w-20 text-center text-[#dc3545] bg-red-50/50">Miktar</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] sm:text-[12px] font-bold text-slate-800 divide-y divide-slate-100">
                    {sessionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors bg-transparent animate-in fade-in duration-300">
                        <td className="p-2 sm:p-3 border-r border-slate-100 text-slate-400 font-black">{log.time}</td>
                        <td className="p-2 sm:p-3 border-r border-slate-100 overflow-hidden">
                          <span className="tracking-widest uppercase truncate block text-purple-700 font-mono bg-purple-50 px-1 py-0.5 rounded-sm border border-purple-100">
                            {log.product.barcode}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 border-r border-slate-100">
                          <span className="line-clamp-1 leading-tight text-slate-700">{log.product.name}</span>
                        </td>
                        <td className="p-2 sm:p-3 text-center bg-red-50/30">
                          <span className="text-[14px] sm:text-[15px] font-black text-[#dc3545]">+{log.quantity}</span>
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