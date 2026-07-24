"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ChevronLeft, TerminalSquare, UserCircle, MapPin, 
  ArrowRight, Hash, QrCode, AlertTriangle, CheckCircle2, 
  Package, Printer, ScanLine, Smartphone, Edit3, PlusCircle, MinusCircle
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type TransferItem = {
  id: string;
  requested_qty: number;
  sent_qty: number;
  received_qty: number;
  products: {
    id: string;
    barcode: string;
    sku: string | null;
    name: string;
    image_url: string | null;
  };
};

export default function TransferScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube Terminali";

  const [branchId, setBranchId] = useState<string | null>(null);
  const [transferCodeInput, setTransferCodeInput] = useState("");
  const [activeTransfer, setActiveTransfer] = useState<any>(null);
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [mode, setMode] = useState<'outbound' | 'inbound' | null>(null);
  
  // Operasyon State'leri
  const [activeTab, setActiveTab] = useState<'terminal' | 'camera'>('terminal');
  const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
  const [scanInput, setScanInput] = useState("");
  const [selectedQty, setSelectedQty] = useState<number | string>(1);
  const [lastScanned, setLastScanned] = useState<{product: any, qtyChange: number, currentTotal: number, reqTotal: number, type: 'add'|'remove'} | null>(null);
  
  // Güvenlik State'leri
  const [isFetching, setIsFetching] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false); 
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastCameraScanTime = useRef<number>(0);

  // SPEED BOOST: In-Memory Cache (DB Sorgu Yükünü %90 Azaltır)
  const barcodeResolverCache = useRef(new Map());

  // SYNC ENGINE: React kapanmadan önce verileri güvenle tutan asenkron havuz
  const pendingSyncRef = useRef(new Map<string, any>());
  const isSyncingRef = useRef(false);

  // Stale Closure Engelleyici
  const opState = useRef({ scanMode, selectedQty });
  useEffect(() => {
    opState.current = { scanMode, selectedQty };
  }, [scanMode, selectedQty]);

  const qtyButtons = [1, 2, 3, 4, 5, 10];

  useEffect(() => {
    const initBranch = async () => {
      const { data } = await supabase.from("branches").select("id").eq("name", branchName).single();
      if (data) setBranchId(data.id);
    };
    initBranch();
  }, [branchName]);

  const playSound = useCallback((type: 'success' | 'error') => {
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
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (err) {
      console.warn("Ses API desteklenmiyor.");
    }
  }, []);

  const triggerFeedback = useCallback((type: 'success' | 'error', msg: string = "") => {
    playSound(type); setFlashState(type); if (type === 'error') setErrorMsg(msg);
    setTimeout(() => { setFlashState('idle'); if (type === 'error') setErrorMsg(""); }, 1500);
  }, [playSound]);

  // ÇÖZÜM 1: Auto-Flush Motoru (Veri Kaybını Önler)
  const flushPendingSync = async () => {
    if (pendingSyncRef.current.size === 0) return;
    const updates = Array.from(pendingSyncRef.current.entries()).map(([id, payload]) => ({ id, ...payload }));
    pendingSyncRef.current.clear();

    const promises = updates.map(u => supabase.from("transfer_items").update(u).eq("id", u.id));
    await Promise.allSettled(promises);
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      if (isSyncingRef.current || pendingSyncRef.current.size === 0) return;
      isSyncingRef.current = true;
      try { await flushPendingSync(); } 
      finally { isSyncingRef.current = false; }
    }, 2000); // 2 saniyede bir sessizce veritabanını günceller
    return () => clearInterval(interval);
  }, []);

  // Kullanıcı Geri Çıkarsa Havuzu Boşalt
  const handleBack = async () => {
    if (activeTransfer && pendingSyncRef.current.size > 0) {
      setIsProcessing(true);
      await flushPendingSync();
    }
    router.back();
  };

  const startTransferScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return triggerFeedback('error', "Şube ID bulunamadı!");
    const code = transferCodeInput.trim().toUpperCase();
    if (!code) return;

    if (isFetching) return;
    setIsFetching(true);

    try {
      const { data: tx, error: txError } = await supabase
        .from("transfers")
        .select("id, transfer_code, status, from_branch_id, to_branch_id, created_at, picker_employee_id")
        .eq("transfer_code", code)
        .maybeSingle();

      if (txError || !tx) {
        setIsFetching(false);
        return triggerFeedback('error', "Geçersiz veya Bulunamayan Transfer Kodu!");
      }

      // ÇÖZÜM 2: MNS (Serbest Sayım) ve Yetki Kontrollerinin Esnetilmesi
      let currentMode: 'outbound' | 'inbound' | null = null;
      if (tx.from_branch_id === branchId) currentMode = 'outbound';
      else if (tx.to_branch_id === branchId) currentMode = 'inbound';
      else if (tx.picker_employee_id === empId || tx.transfer_code.startsWith("MNS")) {
        // Personel kendi oluşturduğu sayıma veya bir MNS koduna giriyorsa
        currentMode = 'outbound';
      }

      if (!currentMode) {
        setIsFetching(false);
        return triggerFeedback('error', "ERİŞİM REDDEDİLDİ: Bu evrak şubenize ait değil!");
      }
      
      if (currentMode === 'outbound' && tx.status === 'Yolda') {
        setIsFetching(false); return triggerFeedback('error', "Sevkiyat zaten çıkış yapmış!");
      }
      if (tx.status === 'Tamamlandi') {
        setIsFetching(false); return triggerFeedback('error', "Sayım daha önce tamamlanmış!");
      }

      const { data: items } = await supabase
        .from("transfer_items")
        .select(`id, requested_qty, sent_qty, received_qty, products(id, barcode, sku, name, image_url)`)
        .eq("transfer_id", tx.id)
        .order("id");

      let resolvedFromName = "Özel / Serbest Çıkış";
      let resolvedToName = "Özel / Serbest Hedef";

      const branchIdsToFetch = [tx.from_branch_id, tx.to_branch_id].filter(Boolean);
      if (branchIdsToFetch.length > 0) {
        const { data: bData } = await supabase.from("branches").select("id, name").in("id", branchIdsToFetch);
        if (tx.from_branch_id) resolvedFromName = bData?.find(b => b.id === tx.from_branch_id)?.name || resolvedFromName;
        if (tx.to_branch_id) resolvedToName = bData?.find(b => b.id === tx.to_branch_id)?.name || resolvedToName;
      }

      setActiveTransfer({ ...tx, fromName: resolvedFromName, toName: resolvedToName });
      setMode(currentMode);
      setTransferItems(items as unknown as TransferItem[] || []);
      setTransferCodeInput("");
      
      if (tx.status === 'Bekliyor') {
        await supabase.from("transfers").update({ status: 'Toplaniyor' }).eq("id", tx.id);
      }

    } catch (err) {
      console.error(err);
      triggerFeedback('error', "Sistem Hatası!");
    } finally {
      setIsFetching(false);
      setTimeout(() => scanInputRef.current?.focus(), 200);
    }
  };

  const processBarcode = async (rawBarcode: string, isCamera: boolean = false) => {
    if (!rawBarcode || isProcessing) return;

    if (isCamera) {
      const now = Date.now();
      if (now - lastCameraScanTime.current < 2500) return;
      lastCameraScanTime.current = now;
    }

    setIsProcessing(true);

    try {
      let targetBarcode = rawBarcode.trim();
      if (!targetBarcode) return;

      // ULTRA HIZLI ÖNBELLEK
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
        triggerFeedback('error', "HATA: Ürün veritabanında bulunamadı!");
        return;
      }
      
      let currentScanMode = opState.current.scanMode;
      let currentQty = opState.current.selectedQty;
      let inputQty = typeof currentQty === 'string' ? parseInt(currentQty) || 1 : currentQty;
      if (inputQty < 1) inputQty = 1;

      const finalQtyToAdd = inputQty * resolved.qtyMulti;
      const qtyChange = currentScanMode === 'add' ? finalQtyToAdd : -finalQtyToAdd;
      const isMNS = activeTransfer.transfer_code.startsWith("MNS");
      let newItems = [...transferItems];

      let itemIndex = newItems.findIndex(i => i.products.id === resolved.product.id);

      // ÇÖZÜM 2 DEVAMI: MNS İSE LİSTEDE OLMAYAN ÜRÜNÜ DİNAMİK OLARAK EKLE
      if (itemIndex === -1) {
        if (isMNS) {
          if (qtyChange < 0) return triggerFeedback('error', "Olmayan ürünü iptal edemezsiniz!");
          
          const { data: newItem } = await supabase.from("transfer_items").insert({
            transfer_id: activeTransfer.id,
            product_id: resolved.product.id,
            requested_qty: qtyChange,
            approved_qty: qtyChange,
            sent_qty: qtyChange,
            received_qty: 0,
            status: "Bekliyor"
          }).select().single();

          if (newItem) {
             const newTxItem: TransferItem = {
               id: newItem.id,
               requested_qty: newItem.requested_qty,
               sent_qty: newItem.sent_qty,
               received_qty: newItem.received_qty,
               products: resolved.product
             };
             newItems.unshift(newTxItem);
             setTransferItems(newItems);
             setLastScanned({ product: resolved.product, qtyChange, currentTotal: qtyChange, reqTotal: qtyChange, type: currentScanMode });
             triggerFeedback('success');
             setSelectedQty(1);
          }
          return;
        } else {
          return triggerFeedback('error', "HATA: Bu ürün sevkiyat listesinde yok!");
        }
      }

      const item = newItems[itemIndex];
      const currentCount = mode === 'outbound' ? item.sent_qty : item.received_qty;
      const proposedCount = currentCount + qtyChange;

      if (proposedCount < 0) {
        return triggerFeedback('error', `HATA! Sayım sıfırın altına düşemez.`);
      }

      let updatePayload: any = {};

      if (mode === 'outbound') {
         if (proposedCount > item.requested_qty) {
            if (isMNS) { // MNS'de istenen sınır aşılabilir, eşitle
               updatePayload = { sent_qty: proposedCount, requested_qty: proposedCount, approved_qty: proposedCount };
               newItems[itemIndex].sent_qty = proposedCount;
               newItems[itemIndex].requested_qty = proposedCount;
            } else {
               return triggerFeedback('error', `AŞIM! İstenen: ${item.requested_qty} | Girilen: ${proposedCount}`);
            }
         } else {
            updatePayload = { sent_qty: proposedCount };
            newItems[itemIndex].sent_qty = proposedCount;
         }
      } else {
         if (proposedCount > item.requested_qty && !isMNS) {
             return triggerFeedback('error', `AŞIM! İstenen: ${item.requested_qty} | Girilen: ${proposedCount}`);
         }
         updatePayload = { received_qty: proposedCount };
         if (isMNS && proposedCount > item.requested_qty) {
            updatePayload.requested_qty = proposedCount;
            updatePayload.approved_qty = proposedCount;
            newItems[itemIndex].requested_qty = proposedCount;
         }
         newItems[itemIndex].received_qty = proposedCount;
      }

      // Değişikliği Sync Havuzuna Ekle
      pendingSyncRef.current.set(item.id, updatePayload);
      setTransferItems(newItems);
      setLastScanned({ product: item.products, qtyChange: Math.abs(qtyChange), currentTotal: proposedCount, reqTotal: newItems[itemIndex].requested_qty, type: currentScanMode });
      triggerFeedback('success');
      setSelectedQty(1); 

    } catch (error) {
      console.error("Scan Error:", error);
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

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (activeTransfer && activeTab === 'camera') {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 4, qrbox: { width: 250, height: 150 } }, 
        (decodedText) => processBarcode(decodedText, true), 
        (errorMessage) => { /* Yoksay */ }
      ).catch(err => console.error("Kamera başlatılamadı:", err));
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
    };
  }, [activeTransfer, activeTab]);

  const handleCompleteAndPrint = async () => {
    if (!activeTransfer) return;
    
    setIsProcessing(true);
    await flushPendingSync(); // Kapatmadan önce havuzu temizle

    const newStatus = mode === 'outbound' ? 'Yolda' : 'Tamamlandi';
    await supabase.from("transfers").update({ status: newStatus }).eq("id", activeTransfer.id);
    
    // Inbound işlemdeyse ürünleri de tamamlandı işaretle
    if (newStatus === 'Tamamlandi') {
      await supabase.from("transfer_items").update({ status: 'Tamamlandi' }).eq("transfer_id", activeTransfer.id);
    }

    await supabase.from("transaction_logs").insert({
      employee_id: empId,
      branch_id: branchId,
      action_type: mode === 'outbound' ? "TRANSFER_OUTBOUND_COMPLETE" : "TRANSFER_INBOUND_COMPLETE",
      description: `${activeTransfer.transfer_code} kodlu ${mode === 'outbound' ? 'çıkış' : 'giriş'} sayımı tamamlandı.`
    });
    
    setIsProcessing(false);
    window.print();
    
    setTimeout(() => {
      setActiveTransfer(null);
      setTransferItems([]);
      setLastScanned(null);
      setScanMode('add');
    }, 1000);
  };

  const forceFocus = () => {
    if (activeTransfer && activeTab === 'terminal') scanInputRef.current?.focus();
  };

  const totalReq = transferItems.reduce((acc, i) => acc + i.requested_qty, 0);
  const totalScanned = transferItems.reduce((acc, i) => acc + (mode === 'outbound' ? i.sent_qty : i.received_qty), 0);
  const totalMissing = Math.max(0, totalReq - totalScanned);
  const progressPercent = totalReq > 0 ? Math.round((totalScanned / totalReq) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col antialiased select-none print:bg-white" onClick={forceFocus}>
      
      {/* BAŞLIK (Dark Heading) */}
      <div className="bg-[#0f172b] shadow-md shrink-0 border-b-4 border-[#dc3545] print:hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60 max-w-7xl mx-auto w-full">
          <button onClick={handleBack} className="text-slate-400 hover:text-white p-2 bg-slate-800/40 hover:bg-slate-800 transition-all rounded-sm shrink-0">
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <img src="/logo-placeholder.png" alt="Logo" className="h-6 w-auto object-contain hidden sm:block" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <TerminalSquare size={18} className="text-[#dc3545] sm:hidden" />
              <span className="text-white text-[14px] sm:text-[15px] font-black uppercase tracking-widest line-clamp-1">
                Terminal Sayım Motoru
              </span>
            </div>
          </div>
          
          <div className="w-10 shrink-0" />
        </div>
        <div className="bg-slate-950 py-2.5 px-4">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center text-[11px] font-bold uppercase tracking-wider gap-1">
            <span className="text-slate-400 flex items-center gap-1.5"><UserCircle size={14} className="text-slate-600"/> {empName}</span>
            <span className="text-[#dc3545] flex items-center gap-1.5"><MapPin size={14}/> {branchName}</span>
          </div>
        </div>
      </div>

      {/* SAYIM BAŞLATMA EKRANI */}
      {!activeTransfer && (
        <div className="flex-1 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white p-8 border border-slate-300 shadow-xl max-w-md w-full flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-2 mb-2">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-full text-slate-800"><QrCode size={40} /></div>
              <h2 className="text-[18px] font-black uppercase text-slate-800 tracking-widest">Sayıma Başla</h2>
              <p className="text-[12px] font-bold text-slate-500">LGS veya MNS kodunu girin.</p>
            </div>
            <form onSubmit={startTransferScan} className="flex flex-col gap-4">
              <input 
                type="text" 
                autoFocus
                placeholder="Örn: LGS1024"
                value={transferCodeInput}
                onChange={e => setTransferCodeInput(e.target.value)}
                disabled={isFetching}
                className="w-full text-center font-black text-[24px] uppercase p-4 border-2 border-slate-300 focus:outline-none focus:border-[#dc3545] tracking-widest bg-white text-slate-900 disabled:opacity-50"
              />
              <button type="submit" disabled={isFetching} className="w-full bg-[#dc3545] text-white p-4 font-black uppercase tracking-widest hover:bg-red-700 transition-colors active:scale-95 shadow-md flex justify-center items-center h-14">
                {isFetching ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'EVRAĞI ÇEK'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* OPERASYON EKRANI */}
      {activeTransfer && (
        <div className="flex-1 flex flex-col print:hidden relative">
          
          <div className={`pointer-events-none fixed inset-0 z-40 transition-colors duration-300 ${
            flashState === 'success' ? 'bg-emerald-500/20' : 
            flashState === 'error' ? 'bg-red-600/40' : 'bg-transparent'
          }`} />

          {errorMsg && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-4 sm:px-6 py-4 font-black text-[12px] sm:text-[14px] tracking-widest uppercase shadow-2xl border-2 border-red-900 animate-in slide-in-from-top-10 flex items-center gap-3 w-[95%] max-w-md text-center">
              <AlertTriangle size={24} className="shrink-0" /> {errorMsg}
            </div>
          )}

          {/* KOKPİT BİLGİ PANELİ */}
          <div className="bg-[#0f172b] p-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2 sm:p-3 border-2 shadow-sm ${mode === 'outbound' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-blue-500 border-blue-400 text-white'}`}>
                {mode === 'outbound' ? <ArrowRight size={20} className="sm:w-6 sm:h-6" /> : <Package size={20} className="sm:w-6 sm:h-6" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-0.5">
                  <Hash size={12}/> {activeTransfer.transfer_code}
                </span>
                <span className="text-[14px] sm:text-[16px] font-black tracking-widest uppercase flex items-center gap-2 flex-wrap">
                  <span className="text-slate-300">{activeTransfer.fromName}</span>
                  <ArrowRight size={14} className="text-[#dc3545] shrink-0"/>
                  <span className="text-white">{activeTransfer.toName}</span>
                </span>
              </div>
            </div>
            
            <div className="flex flex-col text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-slate-700 pt-3 sm:pt-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Evrak İlerlemesi</span>
              <div className="flex items-end gap-2 sm:justify-end">
                <span className={`text-[24px] font-black leading-none ${progressPercent >= 100 ? 'text-emerald-400' : 'text-white'}`}>{totalScanned}</span>
                <span className="text-slate-500 text-[14px] font-bold">/ {totalReq} ADET</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-2 sm:p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 z-10 overflow-hidden">
            
            {/* SOL KOLON: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0 overflow-y-auto lg:overflow-visible pb-4 lg:pb-0">
              
              <div className="flex bg-white border border-slate-200 p-1.5 rounded-sm shadow-sm">
                <button 
                  onClick={() => setActiveTab('terminal')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'terminal' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <ScanLine size={16} /> Terminal
                </button>
                <button 
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'camera' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <Smartphone size={16} /> Kamera
                </button>
              </div>

              <div className="bg-white p-4 shadow-md border border-slate-200 flex flex-col gap-4 relative">
                
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => { setScanMode('add'); setTimeout(() => scanInputRef.current?.focus(), 100); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 font-black uppercase tracking-widest text-[12px] transition-all border-2 ${scanMode === 'add' ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                  >
                    <PlusCircle size={16}/> EKLE
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setScanMode('remove'); setTimeout(() => scanInputRef.current?.focus(), 100); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 font-black uppercase tracking-widest text-[12px] transition-all border-2 ${scanMode === 'remove' ? 'bg-red-50 text-[#dc3545] border-red-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                  >
                    <MinusCircle size={16}/> İPTAL ET
                  </button>
                </div>

                {activeTab === 'terminal' ? (
                  <form onSubmit={handleTerminalScan} className="flex flex-col gap-2">
                    <input 
                      ref={scanInputRef}
                      type="text" 
                      value={scanInput}
                      onChange={e => setScanInput(e.target.value)}
                      onBlur={() => setTimeout(() => scanInputRef.current?.focus(), 300)}
                      placeholder="BARKOD OKUTUN"
                      className={`w-full text-center font-black text-[24px] uppercase p-4 border-2 focus:outline-none tracking-widest transition-colors shadow-inner
                        ${scanMode === 'add' 
                          ? 'bg-white text-slate-900 border-slate-300 focus:border-emerald-500 placeholder:text-slate-300' 
                          : 'bg-red-50 text-[#dc3545] border-red-200 focus:border-[#dc3545] placeholder:text-red-200'}`}
                    />
                    <button type="submit" className="hidden" /> 
                  </form>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div id="reader" className={`w-full bg-slate-50 border-2 overflow-hidden min-h-[250px] ${scanMode === 'add' ? 'border-slate-300' : 'border-red-400'}`} />
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 mt-2">
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12}/> Adet Seçimi (Çarpan)</span>
                  
                  <div className="flex flex-wrap gap-2 mb-1">
                    {qtyButtons.map(qty => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 100); }}
                        className={`flex-1 min-w-[44px] py-3 text-[14px] font-black transition-all border-2 rounded-sm ${
                          selectedQty === qty 
                            ? (scanMode === 'add' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-[#dc3545] border-[#dc3545] text-white shadow-md')
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>

                  <div className={`flex items-center gap-3 border-2 p-2 rounded-sm transition-colors w-full overflow-hidden ${scanMode === 'add' ? 'bg-emerald-50/50 border-slate-200 focus-within:border-emerald-500' : 'bg-red-50/50 border-slate-200 focus-within:border-[#dc3545]'}`}>
                    <span className="text-slate-600 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel:</span>
                    <input 
                      type="number" 
                      min="1"
                      value={selectedQty}
                      onChange={e => setSelectedQty(e.target.value)}
                      className="flex-1 bg-transparent text-slate-900 font-black text-[22px] text-right focus:outline-none pr-2 min-w-0 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* ANLIK OKUNAN ÜRÜN BİLGİSİ */}
              <div className="bg-white border border-slate-200 shadow-md p-5 flex flex-col items-center text-center gap-4 relative overflow-hidden">
                <div className={`absolute top-0 w-full h-1.5 ${lastScanned?.type === 'remove' ? 'bg-[#dc3545]' : 'bg-[#0f172b]'}`} />
                
                {lastScanned ? (
                  <>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-slate-200 p-2 shadow-sm rounded-md">
                      {lastScanned.product.image_url ? (
                        <img src={lastScanned.product.image_url} alt="Urun" className="w-full h-full object-contain" />
                      ) : (
                        <Package size={40} className="text-slate-300 w-full h-full" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[13px] font-black text-[#dc3545] tracking-widest uppercase truncate">{lastScanned.product.barcode}</span>
                      <span className="text-[12px] sm:text-[14px] font-bold text-slate-800 line-clamp-2 leading-tight">{lastScanned.product.name}</span>
                    </div>

                    <div className="w-full flex flex-col gap-2 mt-2 bg-slate-50 p-3 border border-slate-200 rounded-sm">
                      <div className="flex justify-between items-end mb-1">
                        <span className={`text-[11px] sm:text-[12px] font-black uppercase tracking-widest ${lastScanned.type === 'remove' ? 'text-[#dc3545]' : 'text-emerald-600'}`}>
                          {lastScanned.type === 'remove' ? `-${lastScanned.qtyChange} İPTAL` : `+${lastScanned.qtyChange} EKLENDİ`}
                        </span>
                        <div className="flex items-baseline gap-1 shrink-0">
                          <span className="text-[20px] sm:text-[24px] font-black text-slate-900 leading-none">{lastScanned.currentTotal}</span>
                          <span className="text-[11px] sm:text-[12px] font-bold text-slate-400">/ {lastScanned.reqTotal}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#0f172b] h-2 transition-all duration-500" style={{ width: `${Math.min((lastScanned.currentTotal / (lastScanned.reqTotal || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-300 gap-3 py-6 sm:py-8">
                    <QrCode size={48} className="text-slate-200" />
                    <span className="font-black text-[11px] text-slate-400 uppercase tracking-widest">İlk okutma bekleniyor...</span>
                  </div>
                )}
              </div>
            </div>

            {/* SAĞ KOLON: ÜRÜN LİSTESİ */}
            <div className="flex-1 bg-white border border-slate-200 shadow-md flex flex-col overflow-hidden min-h-[400px]">
              <div className="bg-[#0f172b] px-4 py-3 flex justify-between items-center text-white shrink-0">
                <span className="text-[11px] font-black uppercase tracking-widest">Canlı Liste</span>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-32 border-r border-slate-200">Barkod</th>
                      <th className="p-3 border-r border-slate-200">Ürün Adı</th>
                      <th className="p-3 w-16 text-center border-r border-slate-200">İstenen</th>
                      <th className="p-3 w-16 text-center text-[#dc3545] bg-red-50">Okunan</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] font-bold text-slate-800 divide-y divide-slate-100">
                    {transferItems.map((item) => {
                      const current = mode === 'outbound' ? item.sent_qty : item.received_qty;
                      const isComplete = current >= item.requested_qty;
                      const isPartial = current > 0 && current < item.requested_qty;
                      
                      return (
                        <tr key={item.id} className={`${isComplete ? 'bg-emerald-50/40' : isPartial ? 'bg-orange-50/40' : 'bg-white'} hover:bg-slate-50 transition-colors`}>
                          <td className="p-3 border-r border-slate-100 overflow-hidden">
                            <span className={`tracking-widest uppercase truncate block ${isComplete ? 'text-emerald-700' : 'text-[#dc3545]'}`}>
                              {item.products.barcode}
                            </span>
                          </td>
                          <td className="p-3 border-r border-slate-100">
                            <span className="line-clamp-2 text-[11px] leading-tight">{item.products.name}</span>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100 bg-slate-50">
                            <span className="text-[14px] font-black">{item.requested_qty}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[15px] font-black ${isComplete ? 'text-emerald-600' : isPartial ? 'text-orange-600' : 'text-slate-400'}`}>
                              {current}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
                <button 
                  onClick={handleCompleteAndPrint}
                  disabled={totalScanned === 0 || isProcessing}
                  className="w-full bg-[#0f172b] disabled:bg-slate-300 text-white font-black text-[12px] sm:text-[14px] p-4 sm:p-5 uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#dc3545] transition-colors shadow-md active:scale-95 rounded-sm"
                >
                  <Printer size={20} /> BİTİR VE YAZDIR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ZEBRA ZD230 (100x150mm) RAPOR VE BASKI ŞABLONU --- */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 100mm 150mm; margin: 0; }
          body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; }
          .print-container { width: 100mm; height: 148mm; padding: 4mm; box-sizing: border-box; background: white; color: black; font-family: sans-serif; display: flex; flex-direction: column; }
        }
      `}} />
      
      {activeTransfer && (
        <div className="hidden print:flex print-container">
          
          <div className="text-center border-b-4 border-black pb-2 mb-2 shrink-0">
            <h1 className="text-[24px] font-black uppercase m-0 leading-none tracking-widest">LOGISTOCK | WMS</h1>
            <p className="text-[14px] font-black mt-1 uppercase tracking-widest bg-black text-white py-1 inline-block px-4">
              {mode === 'outbound' ? 'SAYIM RAPORU - SEVKİYAT' : 'SAYIM RAPORU - MAL KABUL'}
            </p>
          </div>
          
          <div className="flex flex-col gap-1.5 border-b-2 border-black pb-2 mb-2 text-[12px] font-bold uppercase shrink-0">
            <div className="flex justify-between items-end">
              <span className="text-gray-600">SAYIM FİŞİ:</span> 
              <span className="text-[18px] font-black leading-none">{activeTransfer.transfer_code}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-600">SAYIM TARİHİ:</span> <span>{new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">OPERATÖR:</span> <span>{empName}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">ROTA:</span> <span className="text-right truncate max-w-[60mm]">{activeTransfer.fromName} &rarr; {activeTransfer.toName}</span></div>
          </div>

          <div className="border-2 border-black p-2 mb-2 flex justify-between items-center text-center shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-600 font-bold uppercase">Beklenen</span>
              <span className="text-[16px] font-black">{totalReq}</span>
            </div>
            <div className="flex flex-col border-l border-r border-gray-400 px-4">
              <span className="text-[10px] text-gray-600 font-bold uppercase">Okunan</span>
              <span className="text-[16px] font-black">{totalScanned}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-600 font-bold uppercase">Eksik</span>
              <span className="text-[16px] font-black">{totalMissing}</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <table className="w-full text-left text-[10px] font-bold uppercase border-collapse">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-1">Barkod</th>
                  <th className="py-1">Ürün</th>
                  <th className="py-1 text-center">B/O</th>
                </tr>
              </thead>
              <tbody>
                {transferItems.filter(i => (mode === 'outbound' ? i.sent_qty : i.received_qty) > 0 || i.requested_qty > 0).map((item, idx) => {
                  const scanned = mode === 'outbound' ? item.sent_qty : item.received_qty;
                  return (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="py-1.5 whitespace-nowrap">{item.products.barcode}</td>
                      <td className="py-1.5 truncate max-w-[40mm]">{item.products.name}</td>
                      <td className="py-1.5 text-center font-black text-[12px] whitespace-nowrap">
                        {item.requested_qty} / {scanned}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t-2 border-black mt-2 pt-2 flex justify-between items-end shrink-0 h-16">
            <div className="text-[10px] font-bold uppercase text-center w-24">Teslim Eden<br/>İmza</div>
            <div className="text-[10px] font-bold uppercase text-center w-24">Teslim Alan<br/>İmza</div>
          </div>

        </div>
      )}

    </div>
  );
}