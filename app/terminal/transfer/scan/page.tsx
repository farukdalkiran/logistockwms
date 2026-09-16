"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ChevronLeft, TerminalSquare, UserCircle, MapPin, 
  ArrowRight, Hash, QrCode, AlertTriangle, CheckCircle2, 
  Package, Printer, ScanLine, Smartphone, Edit3, PlusCircle, MinusCircle, Database, Copy, Check
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
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  // Güvenlik State'leri
  const [isFetching, setIsFetching] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false); 
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastCameraScanTime = useRef<number>(0);

  // SPEED BOOST: In-Memory Cache (DB Sorgu Yükünü Azaltır)
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
    }, 2000); 
    return () => clearInterval(interval);
  }, []);

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
        return triggerFeedback('error', "Geçersiz veya Bulunamayan Evrak Kodu!");
      }

      // WMS MOD BELİRLEME (GÖNDERİCİ Mİ? ALICI MI?)
      let currentMode: 'outbound' | 'inbound' | null = null;
      const isMNS = tx.transfer_code.startsWith("MNS");

      if (tx.from_branch_id === branchId) currentMode = 'outbound';
      else if (tx.to_branch_id === branchId) currentMode = 'inbound';
      else if (isMNS || tx.picker_employee_id === empId) currentMode = 'outbound'; 

      if (!currentMode) {
        setIsFetching(false);
        return triggerFeedback('error', "ERİŞİM REDDEDİLDİ: Bu evrak şubenize ait değil!");
      }
      
      // STATÜ KONTROLLERİ
      if (currentMode === 'outbound' && tx.status === 'Yolda') {
        setIsFetching(false); return triggerFeedback('error', "Sevkiyat zaten çıkış yapmış!");
      }
      if (tx.status === 'Tamamlandi') {
        setIsFetching(false); return triggerFeedback('error', "Sayım evrağı tamamlanıp kapatılmış!");
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
      
      // İlk okutmada LGS evrağı ise Toplanıyor yap
      if (tx.status === 'Bekliyor' && !isMNS) {
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

      // ULTRA HIZLI ÖNBELLEK ÇÖZÜMLEME
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
        triggerFeedback('error', "HATA: Ürün sistemde (DB) bulunamadı!");
        return;
      }
      
      let currentScanMode = opState.current.scanMode;
      let currentQty = opState.current.selectedQty;
      let inputQty = typeof currentQty === 'string' ? parseInt(currentQty) || 1 : currentQty;
      if (inputQty < 1) inputQty = 1;

      const finalQtyToAdd = inputQty * resolved.qtyMulti;
      const qtyChange = currentScanMode === 'add' ? finalQtyToAdd : -finalQtyToAdd;
      
      const isMNS = activeTransfer.transfer_code.startsWith("MNS");
      // DİKKAT: İster LGS ister MNS olsun, Alım (Inbound) aşamasına geçmişse KATI kural uygulanır.
      const isFlexibleOutbound = isMNS && mode === 'outbound'; 

      let newItems = [...transferItems];
      let itemIndex = newItems.findIndex(i => i.products.id === resolved.product.id);

      // --- 1. LİSTEDE OLMAYAN ÜRÜN KONTROLÜ ---
      if (itemIndex === -1) {
        if (isFlexibleOutbound) {
          // SADECE GÖNDERİCİ AŞAMASINDAKİ MNS (Serbest Sayım) dinamik ürün ekleyebilir.
          if (qtyChange < 0) return triggerFeedback('error', "Olmayan ürünü iptal edemezsiniz!");
          
          const { data: newItem } = await supabase.from("transfer_items").insert({
            transfer_id: activeTransfer.id,
            product_id: resolved.product.id,
            requested_qty: qtyChange,
            approved_qty: qtyChange,
            sent_qty: qtyChange,
            received_qty: qtyChange, // MNS'de sayım direkt tamamlanır
            status: "Tamamlandi"
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
          // LGS (Gönderi/Teslim) veya MNS (Sadece Teslim) Aşaması -> Katı Kural (Listede Yok)
          return triggerFeedback('error', "AŞIM / HATA: Bu ürün gönderim listesinde (veya transferde) bulunmuyor!");
        }
      }

      // --- 2. LİSTEDE OLAN ÜRÜN LİMİT KONTROLLERİ ---
      const item = newItems[itemIndex];
      const currentCount = mode === 'outbound' ? item.sent_qty : item.received_qty;
      const proposedCount = currentCount + qtyChange;

      if (proposedCount < 0) {
        return triggerFeedback('error', `HATA: Sayım sıfırın altına düşemez.`);
      }

      let updatePayload: any = {};
      
      // Limit Belirleme: 
      // Gönderici ve Esnek (MNS) -> Sınır Yok (Infinity)
      // Gönderici ve Katı (LGS) -> Sınır: requested_qty (İstenen)
      // Alıcı (Teslim/Inbound - LGS ve MNS Fark Etmez) -> Sınır: sent_qty (Gönderilen)
      let reqLimit = Infinity;
      if (mode === 'outbound') {
         reqLimit = isFlexibleOutbound ? Infinity : item.requested_qty;
      } else if (mode === 'inbound') {
         reqLimit = item.sent_qty; // Teslim alımında MNS de olsa gönderileni aşamaz
      }

      if (proposedCount > reqLimit) {
         if (isFlexibleOutbound) {
           // MNS Gönderim Aşamasında sınır yok, ne okutursa veritabanındaki talebi de artırır
           updatePayload = { 
             sent_qty: proposedCount, 
             received_qty: proposedCount, 
             requested_qty: proposedCount, 
             approved_qty: proposedCount 
           };
           newItems[itemIndex].sent_qty = proposedCount;
           newItems[itemIndex].received_qty = proposedCount;
           newItems[itemIndex].requested_qty = proposedCount;
         } else {
           // Limit aşıldı!
           const limitName = mode === 'outbound' ? 'İstenen' : 'Gönderilen';
           return triggerFeedback('error', `AŞIM KORUMASI: ${limitName} (${reqLimit}) miktarını geçemezsiniz!`);
         }
      } else {
         if (mode === 'outbound') {
           updatePayload = { sent_qty: proposedCount };
           newItems[itemIndex].sent_qty = proposedCount;
           if (isFlexibleOutbound) { // MNS'te okunan kadar talebi de düşür/artır
             updatePayload.requested_qty = proposedCount;
             updatePayload.approved_qty = proposedCount;
             updatePayload.received_qty = proposedCount;
             newItems[itemIndex].requested_qty = proposedCount;
           }
         } else {
           updatePayload = { received_qty: proposedCount };
           newItems[itemIndex].received_qty = proposedCount;
         }
      }

      // Değişikliği Sync Havuzuna Ekle
      pendingSyncRef.current.set(item.id, updatePayload);
      setTransferItems(newItems);
      
      const referenceTotal = isFlexibleOutbound ? proposedCount : reqLimit;
      setLastScanned({ product: item.products, qtyChange: Math.abs(qtyChange), currentTotal: proposedCount, reqTotal: referenceTotal, type: currentScanMode });
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
    await flushPendingSync(); // Havuzu son kez temizle

    const isMNS = activeTransfer.transfer_code.startsWith("MNS");
    const newStatus = (isMNS || mode === 'inbound') ? 'Tamamlandi' : 'Yolda';
    
    await supabase.from("transfers").update({ status: newStatus }).eq("id", activeTransfer.id);
    
    if (newStatus === 'Tamamlandi') {
      await supabase.from("transfer_items").update({ status: 'Tamamlandi' }).eq("transfer_id", activeTransfer.id);
    }

    await supabase.from("transaction_logs").insert({
      employee_id: empId,
      branch_id: branchId,
      action_type: isMNS ? "MNS_COUNT_COMPLETE" : (mode === 'outbound' ? "TRANSFER_OUTBOUND_COMPLETE" : "TRANSFER_INBOUND_COMPLETE"),
      description: `${activeTransfer.transfer_code} kodlu ${isMNS ? 'serbest sayım' : (mode === 'outbound' ? 'çıkış' : 'giriş')} tamamlandı.`
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

  // SESSİZ KOPYALAMA İŞLEMİ (Feedback trigger kullanmadan)
  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 1500); 
  };

  // AKILLANDIRILMIŞ FOCUS ENGELLEYİCİ: Kullanıcı input'a, butona vs. tıklarsa focus'u ÇALMAZ!
  const forceFocus = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Tıklanan yer bir input, buton veya interaktif bir alan ise müdahale etme
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'A') {
      return;
    }
    // Sadece boşluğa tıklanırsa focus at
    if (activeTransfer && activeTab === 'terminal') {
      scanInputRef.current?.focus();
    }
  };

  // Dinamik Raporlama Lojiği
  const isMNS = activeTransfer?.transfer_code.startsWith("MNS");
  const isFlexibleOutbound = isMNS && mode === 'outbound';

  const totalReq = transferItems.reduce((acc, i) => acc + (isFlexibleOutbound ? Math.max(i.requested_qty, i.sent_qty) : (mode === 'outbound' ? i.requested_qty : i.sent_qty)), 0);
  const totalScanned = transferItems.reduce((acc, i) => acc + (mode === 'outbound' ? i.sent_qty : i.received_qty), 0);
  const totalMissing = Math.max(0, totalReq - totalScanned);
  const progressPercent = totalReq > 0 ? Math.round((totalScanned / totalReq) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col antialiased select-none print:bg-white" onClick={forceFocus}>
      
      {/* SHIMMER ANİMASYONU CSS (İnce Bar İçin) */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}} />

      {/* WMS YENİ HEADER: Dark-Industrial Bilgi Matrisi */}
      <div className="bg-[#0f172b] border-b border-slate-800 shadow-md shrink-0 z-50 print:hidden relative overflow-hidden">
        <div className="flex flex-col sm:flex-row max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 w-full relative z-10">
            
           {/* SOL KISIM: Marka ve Geri Butonu */}
           <div className="flex items-center gap-4 py-4 sm:pr-6 border-b sm:border-b-0 sm:border-r border-slate-800/80 sm:w-[30%]">
             <button onClick={handleBack} className="text-slate-400 hover:text-white p-2.5 bg-slate-800/60 hover:bg-[#dc3545] transition-all rounded-md shrink-0 border border-slate-700/50">
               <ChevronLeft size={20} strokeWidth={2.5} />
             </button>
             <div className="flex flex-col justify-center">
               <div className="flex items-center gap-2">
                 <TerminalSquare size={16} className="text-[#dc3545] shrink-0" strokeWidth={2.5} />
                 <span className="text-white text-[16px] font-black uppercase tracking-[0.15em] leading-none">LogiStock</span>
               </div>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">WMS Sayım Motoru</span>
             </div>
           </div>

           {/* SAĞ KISIM: Operatör ve Şube Bilgi Matrisi */}
           <div className="flex flex-1 items-center py-3 sm:py-0 sm:pl-6">
             <div className="flex w-full items-stretch justify-center sm:justify-end gap-2 sm:gap-6">
                <div className="flex flex-col justify-center items-center sm:items-end pr-4 sm:pr-6 border-r border-slate-800/80">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <UserCircle size={12} className="text-slate-400" />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AKTİF OPERATÖR</span>
                   </div>
                   <span className="text-[13px] font-black text-white uppercase tracking-wider truncate max-w-[120px] sm:max-w-full">
                     {empName}
                   </span>
                </div>

                <div className="flex flex-col justify-center items-center sm:items-end pr-4 sm:pr-6 border-r border-slate-800/80">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <MapPin size={12} className="text-[#dc3545]" />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">LOKASYON</span>
                   </div>
                   <span className="text-[13px] font-black text-[#dc3545] uppercase tracking-wider truncate max-w-[120px] sm:max-w-full">
                     {branchName}
                   </span>
                </div>

                <div className="flex flex-col justify-center items-center sm:items-end">
                   <div className="flex items-center gap-1.5 mb-0.5">
                     <Database size={12} className="text-emerald-500" />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">DURUM</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 animate-pulse rounded-full shadow-[0_0_8px_#10b981]"></div>
                     <span className="text-[13px] font-black text-emerald-400 uppercase tracking-wider">AKTİF</span>
                   </div>
                </div>
             </div>
           </div>

        </div>
      </div>

      {/* SAYIM BAŞLATMA EKRANI */}
      {!activeTransfer && (
        <div className="flex-1 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white p-8 border border-slate-300 shadow-xl max-w-md w-full flex flex-col gap-6 relative overflow-hidden rounded-md">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-slate-900 to-[#dc3545]"></div>

            <div className="flex flex-col items-center text-center gap-2 mb-2">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-md text-slate-800"><QrCode size={40} /></div>
              <h2 className="text-[18px] font-black uppercase text-slate-800 tracking-widest mt-2">Sayıma Başla</h2>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                Sevkiyat veya Mal Kabul işlemi için <strong className="text-slate-800">LGS</strong> kodunu, serbest sayım için <strong className="text-slate-800">MNS</strong> kodunu giriniz.
              </p>
            </div>
            <form onSubmit={startTransferScan} className="flex flex-col gap-4">
              <input 
                type="text" 
                autoFocus
                placeholder="Örn: LGS1024"
                value={transferCodeInput}
                onChange={e => setTransferCodeInput(e.target.value)}
                disabled={isFetching}
                className="w-full text-center font-black text-[24px] uppercase p-4 border-2 border-slate-300 focus:outline-none focus:border-[#dc3545] tracking-widest bg-slate-50 text-slate-900 rounded-md disabled:opacity-50 transition-colors"
              />
              <button type="submit" disabled={isFetching} className="w-full rounded-md bg-[#0F172A] border-2 border-[#0F172A] text-white p-4 font-black uppercase tracking-[0.2em] hover:bg-[#dc3545] hover:border-[#dc3545] transition-colors active:scale-95 shadow-md flex justify-center items-center h-14">
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
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-4 sm:px-6 py-4 font-black text-[12px] sm:text-[14px] tracking-widest uppercase shadow-2xl border-2 border-red-900 rounded-md animate-in slide-in-from-top-10 flex items-center gap-3 w-[95%] max-w-md text-center">
              <AlertTriangle size={24} className="shrink-0" /> {errorMsg}
            </div>
          )}

          {/* MAVİ-KURUMSAL KOKPİT BİLGİ PANELİ (Yeni Tasarım, Ortalı) */}
          <div className="w-full bg-[#0b1426] border-b border-blue-900/40 shadow-lg relative overflow-hidden z-10 shrink-0">
            {/* Dekoratif Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-3xl pointer-events-none rounded-full hidden md:block"></div>
            
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative z-10">
              
              {/* Sol Taraf: Transfer Bilgileri */}
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-md shrink-0">
                  {mode === 'outbound' ? <ArrowRight size={24} /> : <Package size={24} />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                    <Hash size={12}/> {activeTransfer.transfer_code}
                  </span>
                  <span className="text-[14px] md:text-[16px] font-black tracking-widest uppercase flex items-center gap-2 flex-wrap text-white leading-tight">
                    <span className="truncate">{activeTransfer.fromName}</span>
                    <ArrowRight size={14} className="text-blue-500/50 shrink-0"/>
                    <span className="truncate">{activeTransfer.toName}</span>
                  </span>
                </div>
              </div>
              
              {/* Sağ Taraf: Animasyonlu İnce Progress ve Rakamlar */}
              <div className="flex flex-col w-full md:w-[320px] border-t border-blue-800/50 md:border-none pt-4 md:pt-0">
                
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    {isMNS ? "MNS Serbest Sayım" : (mode === 'outbound' ? 'Sevkiyat (Çıkış)' : 'Mal Kabul (Giriş)')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">İlerleme: <span className="text-emerald-400">{progressPercent}%</span></span>
                    <div className="flex items-baseline gap-1.5 text-white bg-slate-900/50 px-2 py-0.5 rounded-sm border border-slate-700/50">
                      <span className="text-[18px] font-black leading-none font-mono">{totalScanned}</span>
                      <span className="text-blue-400/80 text-[10px] font-bold">/ {isFlexibleOutbound ? 'Limitsiz' : totalReq}</span>
                    </div>
                  </div>
                </div>

                {/* İnce Line Graph (Progress) Bar */}
                <div className="w-full h-1.5 bg-slate-900/80 rounded-full overflow-hidden relative shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-[#38bdf8] transition-all duration-700 ease-out relative overflow-hidden" 
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  >
                     {/* Akan Parlama Animasyonu */}
                     <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite]"></div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 flex flex-col lg:flex-row gap-4 sm:gap-6 z-10 overflow-hidden">
            
            {/* SOL KOLON: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0 overflow-y-auto lg:overflow-visible pb-4 lg:pb-0">
              
              <div className="flex bg-white border border-slate-200 p-1.5 rounded-md shadow-sm">
                <button 
                  onClick={() => setActiveTab('terminal')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all rounded-md ${activeTab === 'terminal' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <ScanLine size={16} /> Terminal
                </button>
                <button 
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all rounded-md ${activeTab === 'camera' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <Smartphone size={16} /> Kamera
                </button>
              </div>

              <div className="bg-white p-4 shadow-md border border-slate-200 rounded-md flex flex-col gap-4 relative">
                
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => { setScanMode('add'); setTimeout(() => scanInputRef.current?.focus(), 100); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 font-black uppercase tracking-widest text-[12px] transition-all border-2 rounded-md ${scanMode === 'add' ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                  >
                    <PlusCircle size={16}/> EKLE
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setScanMode('remove'); setTimeout(() => scanInputRef.current?.focus(), 100); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 font-black uppercase tracking-widest text-[12px] transition-all border-2 rounded-md ${scanMode === 'remove' ? 'bg-red-50 text-[#dc3545] border-red-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
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
                      placeholder="BARKOD OKUTUN"
                      // onBlur kaldırıldı! Artık focus sadece forceFocus tarafından kontrollü sağlanıyor.
                      className={`w-full text-center font-black text-[24px] uppercase p-4 border-2 rounded-md focus:outline-none tracking-widest transition-colors shadow-inner
                        ${scanMode === 'add' 
                          ? 'bg-slate-50 text-slate-900 border-slate-300 focus:border-emerald-500 placeholder:text-slate-300' 
                          : 'bg-red-50 text-[#dc3545] border-red-200 focus:border-[#dc3545] placeholder:text-red-200'}`}
                    />
                    <button type="submit" className="hidden" /> 
                  </form>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div id="reader" className={`w-full bg-slate-50 border-2 rounded-md overflow-hidden min-h-[250px] ${scanMode === 'add' ? 'border-slate-300' : 'border-red-400'}`} />
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
                        className={`flex-1 min-w-[44px] py-3 text-[14px] font-black transition-all border-2 rounded-md ${
                          selectedQty === qty 
                            ? (scanMode === 'add' ? 'bg-[#0F172A] border-[#0F172A] text-white shadow-md' : 'bg-[#dc3545] border-[#dc3545] text-white shadow-md')
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>

                  {/* TAMAMEN KLAVYEYE UYUMLU, SPİNNER'SIZ (OKSUZ) MANUEL GİRİŞ */}
                  <div className={`flex items-center gap-3 border-2 p-2 rounded-md transition-colors w-full overflow-hidden ${scanMode === 'add' ? 'bg-emerald-50/50 border-slate-200 focus-within:border-emerald-500' : 'bg-red-50/50 border-slate-200 focus-within:border-[#dc3545]'}`}>
                    <span className="text-slate-600 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel:</span>
                    <input 
                      type="number" 
                      min="1"
                      value={selectedQty}
                      onChange={e => setSelectedQty(e.target.value)}
                      onFocus={e => e.target.select()} // Tıklanınca sayıyı anında seçer, klavyeden hemen yazılır
                      className="flex-1 bg-transparent text-slate-900 font-black text-[22px] text-right focus:outline-none pr-2 min-w-0 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* ANLIK OKUNAN ÜRÜN BİLGİSİ */}
              <div className="bg-white border border-slate-200 rounded-md shadow-md p-5 flex flex-col items-center text-center gap-4 relative overflow-hidden">
                <div className={`absolute top-0 w-full h-1.5 ${lastScanned?.type === 'remove' ? 'bg-[#dc3545]' : 'bg-emerald-500'}`} />
                
                {lastScanned ? (
                  <>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-slate-200 p-2 shadow-sm rounded-md">
                      {lastScanned.product.image_url ? (
                        <img src={lastScanned.product.image_url} alt="Urun" className="w-full h-full object-contain rounded-sm" />
                      ) : (
                        <Package size={40} className="text-slate-300 w-full h-full" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[13px] font-black text-[#dc3545] tracking-widest uppercase truncate">{lastScanned.product.barcode}</span>
                      <span className="text-[12px] sm:text-[14px] font-bold text-slate-800 line-clamp-2 leading-tight">{lastScanned.product.name}</span>
                    </div>

                    <div className="w-full flex flex-col gap-2 mt-2 bg-slate-50 p-3 border border-slate-200 rounded-md">
                      <div className="flex justify-between items-end mb-1">
                        <span className={`text-[11px] sm:text-[12px] font-black uppercase tracking-widest ${lastScanned.type === 'remove' ? 'text-[#dc3545]' : 'text-emerald-600'}`}>
                          {lastScanned.type === 'remove' ? `-${lastScanned.qtyChange} İPTAL` : `+${lastScanned.qtyChange} EKLENDİ`}
                        </span>
                        <div className="flex items-baseline gap-1 shrink-0">
                          <span className="text-[20px] sm:text-[24px] font-black text-slate-900 leading-none">{lastScanned.currentTotal}</span>
                          <span className="text-[11px] sm:text-[12px] font-bold text-slate-400">/ {isFlexibleOutbound ? 'Limitsiz' : lastScanned.reqTotal}</span>
                        </div>
                      </div>
                      {!isFlexibleOutbound && (
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#0f172b] h-2 transition-all duration-500" style={{ width: `${Math.min((lastScanned.currentTotal / (lastScanned.reqTotal || 1)) * 100, 100)}%` }} />
                        </div>
                      )}
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

            {/* SAĞ KOLON: ÜRÜN LİSTESİ (Daha Kompakt) */}
            <div className="flex-1 bg-white border border-slate-200 shadow-md rounded-md flex flex-col overflow-hidden min-h-[400px]">
              <div className="bg-[#0f172b] px-4 py-3 flex justify-between items-center text-white shrink-0">
                <span className="text-[11px] font-black uppercase tracking-widest">Canlı Sayım Listesi</span>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-40 border-r border-slate-200">Barkod</th>
                      <th className="py-2 px-3 border-r border-slate-200">Ürün Adı</th>
                      <th className="py-2 px-3 w-16 text-center border-r border-slate-200">{isFlexibleOutbound ? 'Durum' : (mode === 'outbound' ? 'İstenen' : 'Gönderilen')}</th>
                      <th className="py-2 px-3 w-16 text-center text-[#dc3545] bg-red-50">Okunan</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] font-bold text-slate-800 divide-y divide-slate-100">
                    {transferItems.map((item) => {
                      const current = mode === 'outbound' ? item.sent_qty : item.received_qty;
                      const limit = isFlexibleOutbound ? current : (mode === 'outbound' ? item.requested_qty : item.sent_qty);
                      
                      const isComplete = current >= limit;
                      const isPartial = current > 0 && current < limit;
                      const isCopied = copiedBarcode === item.products.barcode;
                      
                      return (
                        <tr key={item.id} className={`${isComplete ? 'bg-emerald-50/40' : isPartial ? 'bg-orange-50/40' : 'bg-white'} hover:bg-slate-50 transition-colors`}>
                          <td className="py-1.5 px-3 border-r border-slate-100 overflow-hidden">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`tracking-widest uppercase truncate block flex-1 ${isComplete ? 'text-emerald-700' : 'text-[#dc3545]'}`}>
                                {item.products.barcode}
                              </span>
                              {/* SESSİZ BARKOD KOPYALAMA İKONU */}
                              <button
                                type="button"
                                onClick={() => handleCopyBarcode(item.products.barcode)}
                                className={`flex items-center gap-1 transition-colors p-1.5 rounded-md shrink-0 border ${isCopied ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                                title="Barkodu Kopyala"
                              >
                                {isCopied ? (
                                  <><Check size={12} strokeWidth={3}/></>
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-1.5 px-3 border-r border-slate-100">
                            <span className="line-clamp-2 leading-tight text-slate-700">{item.products.name}</span>
                          </td>
                          <td className="py-1.5 px-3 text-center border-r border-slate-100 bg-slate-50">
                            <span className="text-[12px] font-black text-slate-600">{isFlexibleOutbound ? 'MNS' : limit}</span>
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <span className={`text-[13px] sm:text-[14px] font-black ${isComplete ? 'text-emerald-600' : isPartial ? 'text-orange-600' : 'text-slate-400'}`}>
                              {current}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <button 
                  onClick={handleCompleteAndPrint}
                  disabled={totalScanned === 0 || isProcessing}
                  className="w-full bg-[#0f172b] disabled:bg-slate-300 text-white font-black text-[12px] sm:text-[14px] p-3.5 uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#dc3545] transition-colors shadow-sm active:scale-95 rounded-md"
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
              {isMNS ? 'SERBEST SAYIM (MNS) RAPORU' : (mode === 'outbound' ? 'SAYIM RAPORU - SEVKİYAT' : 'SAYIM RAPORU - MAL KABUL')}
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
              <span className="text-[16px] font-black">{isFlexibleOutbound ? 'Limitsiz' : totalReq}</span>
            </div>
            <div className="flex flex-col border-l border-r border-gray-400 px-4">
              <span className="text-[10px] text-gray-600 font-bold uppercase">Okunan</span>
              <span className="text-[16px] font-black">{totalScanned}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-600 font-bold uppercase">Eksik</span>
              <span className="text-[16px] font-black">{isFlexibleOutbound ? '0' : totalMissing}</span>
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
                  const limit = isFlexibleOutbound ? scanned : (mode === 'outbound' ? item.requested_qty : item.sent_qty);
                  return (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="py-1.5 whitespace-nowrap">{item.products.barcode}</td>
                      <td className="py-1.5 truncate max-w-[40mm]">{item.products.name}</td>
                      <td className="py-1.5 text-center font-black text-[12px] whitespace-nowrap">
                        {limit} / {scanned}
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