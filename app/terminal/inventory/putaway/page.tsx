"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ChevronLeft, TerminalSquare, UserCircle, MapPin, 
  Hash, QrCode, AlertTriangle, Package, 
  ScanLine, Smartphone, Edit3, CheckCircle2,
  Layers, BoxSelect, Server, ArrowRight
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

// Anında Kayıt Geçmişi İçin Tip
type SessionLogItem = {
  id: string; // Geçici UI id'si
  product: { barcode: string; sku: string | null; name: string; image_url: string | null; };
  quantity: number;
  time: string;
};

type Shelf = { id: number; name: string; status: string; };

export default function InstantPutawayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube Terminali";

  const [branchId, setBranchId] = useState<string | null>(null);
  
  // Raf Kilitleme State'leri
  const [shelfInput, setShelfInput] = useState("");
  const [activeShelf, setActiveShelf] = useState<Shelf | null>(null);

  // Operasyon State'leri
  const [activeTab, setActiveTab] = useState<'terminal' | 'camera'>('terminal');
  const [scanInput, setScanInput] = useState("");
  const [selectedQty, setSelectedQty] = useState<number | string>(1);
  const [lastScanned, setLastScanned] = useState<SessionLogItem | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLogItem[]>([]); 
  
  // Güvenlik ve UI State'leri
  const [isProcessing, setIsProcessing] = useState(false); 
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const shelfInputRef = useRef<HTMLInputElement>(null);
  const lastCameraScanTime = useRef<number>(0);
  const qtyButtons = [1, 2, 3, 4, 5, 10];

  // Ref Kalkanı (Stale Closure Engelleyici)
  const opState = useRef({ selectedQty });
  useEffect(() => { opState.current = { selectedQty }; }, [selectedQty]);

  // Agresif Focus (Donanım okuyucular için kesintisiz giriş)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isProcessing) {
        if (!activeShelf && document.activeElement !== shelfInputRef.current) {
          shelfInputRef.current?.focus();
        } else if (activeShelf && activeTab === 'terminal' && document.activeElement !== scanInputRef.current) {
          scanInputRef.current?.focus();
        }
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeShelf, activeTab, isProcessing]);

  // Şube ID'sini çek
  useEffect(() => {
    const initData = async () => {
      const { data: empData } = await supabase.from("employees").select("branch_id").eq("id", empId).single();
      if (empData?.branch_id) setBranchId(empData.branch_id); 
    };
    initData();
  }, [empId]);

  const playSound = useCallback((type: 'success' | 'error') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.4);
      }
    } catch (err) { console.warn("Audio API unsupported"); }
  }, []);

  const triggerFeedback = useCallback((type: 'success' | 'error', msg: string = "") => {
    playSound(type); setFlashState(type); if (type === 'error') setErrorMsg(msg);
    setTimeout(() => { setFlashState('idle'); if (type === 'error') setErrorMsg(""); }, 1000);
  }, [playSound]);

  // ÇÖZÜM: Raf ID'sini veya Raf Adını Algılayan Dinamik Sorgu
  const handleLockShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanShelf = shelfInput.trim().toUpperCase();
    if (!cleanShelf || !branchId) return;

    setIsProcessing(true);
    try {
      const isNumeric = /^\d+$/.test(cleanShelf);
      
      let query = supabase
        .from("shelves")
        .select("id, name, status")
        .eq("branch_id", branchId);

      if (isNumeric) {
        // Eğer girilen değer sadece sayılardan oluşuyorsa hem ID'ye hem isme bak
        query = query.or(`id.eq.${cleanShelf},name.ilike.${cleanShelf}`);
      } else {
        // String ise sadece isme (name) bak
        query = query.ilike("name", cleanShelf);
      }

      const { data: shelfData, error } = await query.maybeSingle();

      if (error || !shelfData) {
        triggerFeedback('error', `HATA: ${cleanShelf} numaralı/isimli raf bulunamadı!`);
        setShelfInput("");
      } else {
        setActiveShelf(shelfData);
        setShelfInput("");
        triggerFeedback('success');
      }
    } catch (err) {
      triggerFeedback('error', "Sistem Hatası!");
    } finally {
      setIsProcessing(false);
    }
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

      // 1. Koli (Box) Kontrolü
      const { data: boxData } = await supabase.from("boxes").select("product_id, quantity").eq("box_barcode", targetBarcode).maybeSingle();
      if (boxData) {
        const { data: pData } = await supabase.from("products").select("barcode").eq("id", boxData.product_id).single();
        if (pData) { targetBarcode = pData.barcode; inputQty = boxData.quantity * inputQty; }
      }

      // 2. Ürün Tespiti
      const { data: productDetails, error: pErr } = await supabase
        .from("products")
        .select("id, barcode, sku, name, image_url")
        .eq("barcode", targetBarcode)
        .maybeSingle();

      if (pErr || !productDetails) {
        triggerFeedback('error', "HATA: Ürün sistemde kayıtlı değil!");
        return;
      }

      // 3. ANINDA VERİTABANI KAYDI (STOK EKLENMESİ)
      const { data: existingStock } = await supabase
        .from("stocks")
        .select("quantity")
        .eq("product_id", productDetails.id)
        .eq("branch_id", branchId)
        .eq("shelf_id", activeShelf.id)
        .maybeSingle();

      if (existingStock) {
        await supabase.from("stocks").update({ 
            quantity: existingStock.quantity + inputQty,
            last_activity_at: new Date().toISOString()
          })
          .eq("product_id", productDetails.id)
          .eq("branch_id", branchId)
          .eq("shelf_id", activeShelf.id);
      } else {
        await supabase.from("stocks").insert({
            product_id: productDetails.id,
            branch_id: branchId,
            shelf_id: activeShelf.id,
            shelf_location: activeShelf.name,
            quantity: inputQty
          });
      }

      // 4. İŞLEMİN LOGLANMASI (Transaction Logs) - Raf ID eklendi
      await supabase.from("transaction_logs").insert({
        employee_id: empId,
        branch_id: branchId,
        action_type: "INVENTORY_PUTAWAY",
        description: `RAFLAMA: ${inputQty} ADET [${productDetails.barcode} - ${productDetails.name}] -> RAF: ${activeShelf.name} (ID: ${activeShelf.id})`,
        new_value: String(inputQty)
      });

      // 5. UI GÜNCELLEMESİ
      const logEntry: SessionLogItem = {
        id: Math.random().toString(36).substring(7),
        product: productDetails,
        quantity: inputQty,
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };

      setLastScanned(logEntry);
      setSessionLogs(prev => [logEntry, ...prev]);
      
      triggerFeedback('success');
      setSelectedQty(1); // Miktarı 1'e sıfırla

    } catch (error) {
      console.error(error);
      triggerFeedback('error', "İşlem Hatası!");
    } finally {
      setIsProcessing(false);
      setTimeout(() => scanInputRef.current?.focus(), 50); 
    }
  };

  const handleTerminalScan = (e: React.FormEvent) => {
    e.preventDefault();
    processBarcode(scanInput, false); 
    setScanInput("");
  };

  // Kamera Lojiği
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (activeShelf && activeTab === 'camera') {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 4, qrbox: { width: 250, height: 150 } }, 
        (decodedText) => processBarcode(decodedText, true), 
        () => {}
      ).catch(err => console.error("Kamera başlatılamadı:", err));
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
      }
    };
  }, [activeShelf, activeTab]);

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] flex flex-col antialiased select-none">
      
      {/* BAŞLIK (Dark-Industrial Heading - İndigo Temalı) */}
      <div className="bg-[#0f172b] shadow-md shrink-0 border-b-4 border-indigo-500">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60 max-w-7xl mx-auto w-full">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white p-2 bg-slate-800/40 hover:bg-slate-800 transition-all rounded-sm shrink-0">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Server size={18} className="text-indigo-500 hidden sm:block" />
            <span className="text-white text-[14px] sm:text-[15px] font-black uppercase tracking-widest line-clamp-1">
              Hızlı Raflama (Putaway)
            </span>
          </div>
          <div className="w-10 shrink-0" />
        </div>
        <div className="bg-slate-950 py-2.5 px-4">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center text-[11px] font-bold uppercase tracking-wider gap-1">
            <span className="text-slate-400 flex items-center gap-1.5"><UserCircle size={14} className="text-slate-600"/> {empName}</span>
            <span className="text-indigo-500 flex items-center gap-1.5"><MapPin size={14}/> {branchName}</span>
          </div>
        </div>
      </div>

      {/* 1. RAF BARKODU OKUTMA (KİLİT) EKRANI */}
      {!activeShelf && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col gap-6 rounded-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-[80px] pointer-events-none"></div>
            
            <div className="flex flex-col items-center text-center gap-3 mb-2 border-b border-slate-100 pb-6 relative z-10">
              <div className="bg-white border-2 border-slate-100 p-4 rounded-full text-[#0f172b] shadow-sm"><BoxSelect size={40} /></div>
              <h2 className="text-[18px] sm:text-[20px] font-black uppercase text-slate-800 tracking-widest">Raf Barkodunu Okut</h2>
              <p className="text-[12px] font-bold text-slate-500 max-w-sm leading-relaxed">
                İşlem yapmak istediğiniz rafın veya lokasyonun ID'sini / barkodunu okutarak sistemi o rafa kilitleyin.
              </p>
            </div>
            
            <form onSubmit={handleLockShelf} className="flex flex-col gap-4 relative z-10">
              <input 
                ref={shelfInputRef}
                type="text" 
                value={shelfInput}
                onChange={(e) => setShelfInput(e.target.value)}
                placeholder="RAF BARKODU / ID"
                disabled={isProcessing}
                className="w-full bg-slate-50 border-2 border-slate-300 text-slate-900 text-center text-[24px] tracking-widest uppercase font-black p-5 rounded-sm focus:outline-none focus:border-indigo-500 transition-colors shadow-inner disabled:opacity-50"
              />
              <button type="submit" disabled={isProcessing || !shelfInput} className="w-full bg-[#0f172b] text-white p-4 font-black uppercase tracking-widest hover:bg-indigo-600 disabled:bg-slate-300 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 rounded-sm">
                RAFI KİLİTLE VE BAŞLA <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. ANLIK OPERASYON EKRANI */}
      {activeShelf && (
        <div className="flex-1 flex flex-col relative">
          
          <div className={`pointer-events-none fixed inset-0 z-40 transition-colors duration-300 ${flashState === 'success' ? 'bg-indigo-500/20' : flashState === 'error' ? 'bg-red-600/40' : 'bg-transparent'}`} />

          {errorMsg && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-4 sm:px-6 py-4 font-black text-[12px] sm:text-[14px] tracking-widest uppercase shadow-2xl border-2 border-red-900 animate-in slide-in-from-top-10 flex items-center gap-3 w-[95%] max-w-md text-center">
              <AlertTriangle size={24} className="shrink-0" /> {errorMsg}
            </div>
          )}

          {/* KOKPİT BİLGİ PANELİ */}
          <div className="bg-[#0f172b] p-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-2 sm:p-3 border-2 shadow-sm bg-indigo-600 border-indigo-400 text-white shrink-0"><Server size={20} className="sm:w-6 sm:h-6" /></div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-0.5">
                  <Hash size={12}/> AKTİF RAF LOKASYONU
                </span>
                <span className="text-[16px] sm:text-[20px] font-black tracking-widest uppercase flex items-center gap-2 w-full text-indigo-400">
                  <span className="truncate">{activeShelf.name} (ID: {activeShelf.id})</span>
                </span>
              </div>
            </div>
            
            <div className="flex gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              <button onClick={() => setActiveShelf(null)} className="flex-1 sm:flex-none bg-slate-800 hover:bg-[#dc3545] border border-slate-700 hover:border-[#dc3545] text-white px-4 py-2 font-black text-[11px] uppercase tracking-widest transition-colors shadow-sm rounded-sm">
                RAF DEĞİŞTİR
              </button>
            </div>
          </div>

          <div className="flex-1 p-2 sm:p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 z-10 overflow-hidden">
            
            {/* SOL: OKUMA VE GÖRSEL MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0 overflow-y-auto lg:overflow-visible pb-4 lg:pb-0">
              
              <div className="flex bg-white border border-slate-200 p-1.5 rounded-sm shadow-sm">
                <button onClick={() => setActiveTab('terminal')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'terminal' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><ScanLine size={16} /> Terminal</button>
                <button onClick={() => setActiveTab('camera')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'camera' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Smartphone size={16} /> Kamera</button>
              </div>

              <div className="bg-white p-4 shadow-md border border-slate-200 flex flex-col gap-4 relative">
                
                <div className="w-full aspect-square sm:aspect-[4/3] bg-slate-50 border-2 border-slate-200 p-2 shadow-inner rounded-sm flex items-center justify-center relative overflow-hidden">
                  {lastScanned?.product.image_url ? (
                    <img src={lastScanned.product.image_url} alt="Urun" className="w-full h-full object-contain mix-blend-multiply animate-in fade-in zoom-in duration-300" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-300 gap-2">
                      <Package size={64} className="opacity-50" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Görsel Bekleniyor</span>
                    </div>
                  )}
                  {lastScanned && (
                    <div className="absolute bottom-0 left-0 w-full bg-[#0f172b]/90 backdrop-blur-sm p-2 text-center border-t border-slate-700">
                      <span className="text-white text-[12px] font-bold line-clamp-1">{lastScanned.product.name}</span>
                    </div>
                  )}
                </div>

                {activeTab === 'terminal' ? (
                  <form onSubmit={handleTerminalScan} className="flex flex-col gap-2">
                    <input 
                      ref={scanInputRef} 
                      type="text" 
                      value={scanInput} 
                      onChange={e => setScanInput(e.target.value)} 
                      placeholder="ÜRÜN OKUTUN" 
                      disabled={isProcessing} 
                      className="w-full text-center font-black text-[24px] uppercase p-4 border-2 focus:outline-none tracking-widest transition-colors shadow-inner disabled:opacity-50 bg-white text-slate-900 border-slate-300 focus:border-indigo-500 placeholder:text-slate-300" 
                    />
                    <button type="submit" className="hidden" /> 
                  </form>
                ) : (
                  <div id="reader" className="w-full bg-slate-50 border-2 border-slate-300 overflow-hidden min-h-[250px]" />
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 mt-2">
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12}/> Adet Seçimi (Çarpan)</span>
                  <div className="flex flex-wrap gap-2 mb-1">
                    {qtyButtons.map(qty => (
                      <button key={qty} type="button" onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 50); }} className={`flex-1 min-w-[44px] py-3 text-[14px] font-black transition-all border-2 rounded-sm ${selectedQty === qty ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{qty}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 border-2 border-slate-200 bg-indigo-50/30 p-2 rounded-sm transition-colors w-full overflow-hidden focus-within:border-indigo-500">
                    <span className="text-slate-600 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel:</span>
                    <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} className="flex-1 bg-transparent text-slate-900 font-black text-[22px] text-right focus:outline-none pr-2 min-w-0 w-full" />
                  </div>
                </div>

              </div>
            </div>

            {/* SAĞ: OTURUM LOGLARI (Sadece Görsel) */}
            <div className="flex-1 bg-white border border-slate-200 shadow-md flex flex-col overflow-hidden min-h-[400px]">
              <div className="bg-[#0f172b] px-4 py-3 flex justify-between items-center text-white shrink-0">
                <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2"><Layers size={14} className="text-indigo-400"/> Oturum Geçmişi</span>
                <span className="bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-widest border border-slate-700 rounded-sm shadow-sm text-indigo-300">{sessionLogs.length} İşlem</span>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto bg-slate-50">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead className="bg-white text-slate-500 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-20 border-r border-slate-200">Saat</th>
                      <th className="p-3 w-32 border-r border-slate-200">Barkod</th>
                      <th className="p-3 border-r border-slate-200">Ürün Adı</th>
                      <th className="p-3 w-20 text-center text-indigo-600 bg-indigo-50/50">Miktar</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] font-bold text-slate-800 divide-y divide-slate-100">
                    {sessionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white transition-colors bg-transparent animate-in fade-in duration-300">
                        <td className="p-3 border-r border-slate-100 text-slate-400 font-black">{log.time}</td>
                        <td className="p-3 border-r border-slate-100 overflow-hidden"><span className="tracking-widest uppercase truncate block text-slate-800">{log.product.barcode}</span></td>
                        <td className="p-3 border-r border-slate-100"><span className="line-clamp-1 text-[11px] leading-tight text-slate-600">{log.product.name}</span></td>
                        <td className="p-3 text-center bg-indigo-50/30"><span className="text-[15px] font-black text-indigo-600">+{log.quantity}</span></td>
                      </tr>
                    ))}
                    {sessionLogs.length === 0 && (
                      <tr><td colSpan={4} className="p-10 text-center text-slate-400 text-[12px] font-black uppercase tracking-widest border-dashed border-2 border-slate-200 m-4 block w-auto">Henüz işlem yapılmadı</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0 text-center">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   Her okutma işlemi anında veritabanına ve loglara yazılır. Kaydet butonuna basmanıza gerek yoktur.
                 </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}