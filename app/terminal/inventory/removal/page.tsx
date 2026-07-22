"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { processPickingServer } from "@/app/actions/inventory"; // YENİ: Server Action Entegre Edildi
import { 
  ChevronLeft, UserCircle, MapPin, Hash, AlertTriangle, 
  Package, ScanLine, Smartphone, Edit3, ArrowRight,
  BoxSelect, Server, MinusCircle, ClipboardList, Info
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
  
  // Hasarlı Raf Modal State'leri (Artık stocks dizisine ihtiyaç yok, sunucu hallediyor)
  const [pendingRemoval, setPendingRemoval] = useState<{product: any, qty: number} | null>(null);
  const [removalReason, setRemovalReason] = useState("eksik_parca");
  const [requestedBy, setRequestedBy] = useState("");
  const [otherDescription, setOtherDescription] = useState("");

  const [isProcessing, setIsProcessing] = useState(false); 
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const shelfInputRef = useRef<HTMLInputElement>(null);
  const requestedByRef = useRef<HTMLInputElement>(null);
  const otherDescRef = useRef<HTMLInputElement>(null);
  const lastCameraScanTime = useRef<number>(0);
  const qtyButtons = [1, 2, 3, 4, 5, 10];

  const opState = useRef({ selectedQty });
  useEffect(() => { opState.current = { selectedQty }; }, [selectedQty]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isProcessing && !pendingRemoval) {
        if (!activeShelf && document.activeElement !== shelfInputRef.current) {
          shelfInputRef.current?.focus();
        } else if (activeShelf && activeTab === 'terminal' && document.activeElement !== scanInputRef.current) {
          scanInputRef.current?.focus();
        }
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeShelf, activeTab, isProcessing, pendingRemoval]);

  useEffect(() => {
    const initData = async () => {
      const { data: empData } = await supabase.from("employees").select("branch_id").eq("id", empId).single();
      if (empData?.branch_id) setBranchId(empData.branch_id); 
    };
    initData();
  }, [empId]);

  const triggerFeedback = useCallback((type: 'success' | 'error', msg: string = "") => {
    setFlashState(type); if (type === 'error') setErrorMsg(msg);
    setTimeout(() => { setFlashState('idle'); if (type === 'error') setErrorMsg(""); }, 2000);
  }, []);

  const handleLockShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanShelf = shelfInput.trim().toUpperCase();
    if (!cleanShelf || !branchId) return;

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

      // Koli (Box) Kontrolü
      const { data: boxData } = await supabase.from("boxes").select("product_id, quantity").eq("box_barcode", targetBarcode).maybeSingle();
      if (boxData) {
        const { data: pData } = await supabase.from("products").select("barcode").eq("id", boxData.product_id).single();
        if (pData) { targetBarcode = pData.barcode; inputQty = boxData.quantity * inputQty; }
      }

      // Ürün Tespiti
      const { data: productDetails, error: pErr } = await supabase.from("products").select("id, barcode, sku, name, image_url").eq("barcode", targetBarcode).maybeSingle();
      if (pErr || !productDetails) {
        triggerFeedback('error', "HATA: Ürün bulunamadı!");
        setIsProcessing(false); setScanInput(""); return;
      }

      // Raf HASARLI ise Modal'ı tetikle, Değilse doğrudan Server'a gönder
      if (activeShelf.status?.toUpperCase() === 'HASARLI') {
        setPendingRemoval({ product: productDetails, qty: inputQty });
        setIsProcessing(false); 
      } else {
        await finalizeRemoval(productDetails, inputQty, null);
      }
    } catch (error) { triggerFeedback('error', "İşlem Hatası!"); setIsProcessing(false); setScanInput(""); }
  };

  const finalizeRemoval = async (productDetails: any, qty: number, reasonDetails: string | null) => {
    setIsProcessing(true);
    try {
      // ÇÖZÜM: Stok düşümü ve RLS bypass için Server Action çağrılıyor
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

      // UI Log Güncellemesi
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
    finally { setIsProcessing(false); setScanInput(""); setTimeout(() => scanInputRef.current?.focus(), 50); }
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

  const handleTerminalScan = (e: React.FormEvent) => { e.preventDefault(); processBarcode(scanInput, false); };

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col antialiased select-none">
      
      {/* HEADER - MODERN AYDINLIK (Kırmızı Vurgu) */}
      <div className="bg-white shadow-sm shrink-0 border-b-4 border-[#dc3545]">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100 max-w-7xl mx-auto w-full">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 p-2 sm:p-3 transition-all rounded-sm shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <MinusCircle size={18} className="text-[#dc3545] hidden sm:block" />
            <span className="text-slate-800 text-[15px] sm:text-[16px] font-black uppercase tracking-widest line-clamp-1">
              Raftan Kaldırma (Picking)
            </span>
          </div>
          <div className="w-11 shrink-0" />
        </div>
        <div className="bg-slate-50 py-2 px-3 sm:px-4">
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider gap-1">
            <span className="text-slate-500 flex items-center gap-1.5 truncate"><UserCircle size={14} className="text-slate-400 shrink-0"/> <span className="truncate">{empName}</span></span>
            <span className="text-[#dc3545] flex items-center gap-1.5 shrink-0"><MapPin size={14}/> {branchName}</span>
          </div>
        </div>
      </div>

      {/* 1. RAF BARKODU KİLİTLEME */}
      {!activeShelf && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-xl max-w-lg w-full flex flex-col gap-6 rounded-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 rounded-full blur-[80px] pointer-events-none"></div>
            
            <div className="flex flex-col items-center text-center gap-3 mb-2 border-b border-slate-100 pb-6 relative z-10">
              <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-full text-[#dc3545] shadow-sm"><BoxSelect size={40} /></div>
              <h2 className="text-[18px] sm:text-[20px] font-black uppercase text-slate-800 tracking-widest">Raf Barkodunu Okut</h2>
              <p className="text-[12px] font-bold text-slate-500 max-w-sm leading-relaxed">
                Ürün eksilteceğiniz rafın ID'sini okutarak sistemi kilitli hale getirin.
              </p>
            </div>
            
            <form onSubmit={handleLockShelf} className="flex flex-col gap-4 relative z-10">
              <input 
                ref={shelfInputRef}
                type="text" 
                value={shelfInput}
                onChange={(e) => setShelfInput(e.target.value)}
                placeholder="RAF ID / BARKODU"
                disabled={isProcessing}
                className="w-full min-h-[64px] bg-white border-2 border-slate-300 text-slate-900 text-center text-[22px] sm:text-[24px] tracking-widest uppercase font-black p-4 rounded-sm focus:outline-none focus:border-[#dc3545] transition-colors shadow-sm disabled:opacity-50"
              />
              <button type="submit" disabled={isProcessing || !shelfInput} className="w-full min-h-[56px] bg-[#dc3545] text-white p-4 font-black uppercase tracking-widest hover:bg-red-700 disabled:bg-slate-300 transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 rounded-sm">
                RAFI KİLİTLE <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. OPERASYON KOKPİTİ */}
      {activeShelf && (
        <div className="flex-1 flex flex-col relative h-full">
          <div className={`pointer-events-none fixed inset-0 z-40 transition-colors duration-300 ${flashState === 'success' ? 'bg-green-500/20' : flashState === 'error' ? 'bg-[#dc3545]/30' : 'bg-transparent'}`} />

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

          {/* RAF BİLGİ PANELİ */}
          <div className="bg-white p-3 sm:p-4 flex justify-between items-center gap-2 z-10 shrink-0 border-b border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className={`p-2 border-2 shadow-sm shrink-0 rounded-sm ${activeShelf.status?.toUpperCase() === 'HASARLI' ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                <Server size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                  <Hash size={10}/> AKTİF RAF
                </span>
                <span className="text-[14px] sm:text-[18px] font-black tracking-widest uppercase text-slate-800 truncate flex items-center gap-2">
                  {activeShelf.name} 
                  {activeShelf.status?.toUpperCase() === 'HASARLI' && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-sm border border-amber-200">HASARLI RAF</span>}
                </span>
              </div>
            </div>
            
            <button onClick={() => setActiveShelf(null)} className="shrink-0 bg-white hover:bg-slate-100 border-2 border-slate-200 text-slate-700 px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] font-black text-[10px] sm:text-[11px] uppercase tracking-widest transition-colors shadow-sm rounded-sm flex items-center justify-center">
              DEĞİŞTİR
            </button>
          </div>

          <div className="flex-1 p-2 sm:p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-2 sm:gap-6 z-10 overflow-hidden">
            
            {/* SOL: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-2 sm:gap-4 shrink-0">
              <div className="flex bg-white border border-slate-200 p-1 rounded-sm shadow-sm">
                <button onClick={() => setActiveTab('terminal')} className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 py-2 text-[11px] sm:text-[12px] font-black uppercase tracking-widest transition-all rounded-sm ${activeTab === 'terminal' ? 'bg-slate-100 text-slate-900 border-2 border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><ScanLine size={16} /> Terminal</button>
                <button onClick={() => setActiveTab('camera')} className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 py-2 text-[11px] sm:text-[12px] font-black uppercase tracking-widest transition-all rounded-sm ${activeTab === 'camera' ? 'bg-slate-100 text-slate-900 border-2 border-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Smartphone size={16} /> Kamera</button>
              </div>

              <div className="bg-white p-3 sm:p-4 shadow-sm border border-slate-200 flex flex-col gap-3 rounded-sm relative">
                <div className="w-full h-32 sm:h-48 lg:aspect-[4/3] lg:h-auto bg-slate-50 border-2 border-slate-200 p-2 shadow-inner rounded-sm flex items-center justify-center relative overflow-hidden">
                  {lastScanned?.product.image_url ? (
                    <img src={lastScanned.product.image_url} alt="Urun" className="w-full h-full object-contain mix-blend-multiply animate-in fade-in zoom-in duration-300" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-300 gap-2">
                      <Package size={48} className="opacity-50 sm:w-16 sm:h-16" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Görsel Bekleniyor</span>
                    </div>
                  )}
                  {lastScanned && (
                    <div className="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md p-1.5 sm:p-2 text-center border-t border-slate-200">
                      <span className="text-slate-800 text-[11px] sm:text-[12px] font-bold line-clamp-1">{lastScanned.product.name}</span>
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
                      placeholder="DÜŞÜLECEK ÜRÜN BARKODU" 
                      disabled={isProcessing} 
                      className="w-full min-h-[56px] sm:min-h-[64px] text-center font-black text-[18px] sm:text-[20px] uppercase p-3 sm:p-4 border-2 focus:outline-none tracking-widest transition-colors shadow-inner disabled:opacity-50 bg-white text-slate-900 border-slate-300 focus:border-[#dc3545] placeholder:text-slate-300 rounded-sm" 
                    />
                    <button type="submit" className="hidden" /> 
                  </form>
                ) : (
                  <div id="reader" className="w-full bg-slate-50 border-2 border-slate-300 overflow-hidden min-h-[200px] sm:min-h-[250px] rounded-sm" />
                )}

                <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 mt-1">
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12}/> Düşülecek Adet Seçimi</span>
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                    {qtyButtons.map(qty => (
                      <button key={qty} type="button" onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 50); }} className={`flex-1 min-h-[48px] text-[15px] font-black transition-all border-2 rounded-sm flex items-center justify-center ${selectedQty === qty ? 'bg-[#dc3545] border-[#dc3545] text-white shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:bg-slate-100'}`}>{qty}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 border-2 border-slate-200 bg-red-50/20 p-1.5 rounded-sm transition-colors w-full focus-within:border-[#dc3545] min-h-[48px]">
                    <span className="text-slate-600 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel:</span>
                    <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} className="flex-1 bg-transparent text-slate-900 font-black text-[20px] text-right focus:outline-none pr-2 min-w-0 w-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* SAĞ: OTURUM LOGLARI */}
            <div className="flex-1 bg-white border border-slate-200 shadow-sm flex flex-col overflow-hidden rounded-sm mt-2 lg:mt-0 h-48 lg:h-auto min-h-[200px]">
              <div className="bg-slate-50 px-3 sm:px-4 py-3 flex justify-between items-center border-b border-slate-200 shrink-0">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-700"><ClipboardList size={16} className="text-slate-400"/> Düşüm Geçmişi</span>
                <span className="bg-white px-2 py-0.5 text-[10px] font-bold tracking-widest border border-slate-200 rounded-sm shadow-sm text-slate-600">{sessionLogs.length} Kayıt</span>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto bg-white">
                <table className="w-full text-left border-collapse min-w-[450px]">
                  <thead className="bg-slate-50 text-slate-500 text-[9px] sm:text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="p-2 sm:p-3 w-16 sm:w-20 border-r border-slate-200">Saat</th>
                      <th className="p-2 sm:p-3 w-28 sm:w-32 border-r border-slate-200">Barkod</th>
                      <th className="p-2 sm:p-3 border-r border-slate-200">Ürün Adı</th>
                      <th className="p-2 sm:p-3 w-16 sm:w-20 text-center text-[#dc3545] bg-red-50/50">Miktar</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] sm:text-[12px] font-bold text-slate-800 divide-y divide-slate-100">
                    {sessionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors bg-transparent animate-in fade-in duration-300">
                        <td className="p-2 sm:p-3 border-r border-slate-100 text-slate-400 font-black">{log.time}</td>
                        <td className="p-2 sm:p-3 border-r border-slate-100 overflow-hidden"><span className="tracking-widest uppercase truncate block text-slate-700">{log.product.barcode}</span></td>
                        <td className="p-2 sm:p-3 border-r border-slate-100">
                          <span className="line-clamp-1 leading-tight text-slate-700">{log.product.name}</span>
                          {log.reason && <span className="block mt-1 text-[9px] text-[#dc3545] bg-red-50 px-1.5 py-0.5 rounded-sm w-fit border border-red-100 flex items-center gap-1"><Info size={10}/> {log.reason}</span>}
                        </td>
                        <td className="p-2 sm:p-3 text-center bg-red-50/30"><span className="text-[14px] sm:text-[15px] font-black text-[#dc3545]">-{log.quantity}</span></td>
                      </tr>
                    ))}
                    {sessionLogs.length === 0 && (
                      <tr><td colSpan={4} className="p-6 sm:p-10 text-center text-slate-400 text-[10px] sm:text-[12px] font-black uppercase tracking-widest border-dashed border-2 border-slate-200 m-4 block w-auto">Henüz raf düşümü yapılmadı</td></tr>
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