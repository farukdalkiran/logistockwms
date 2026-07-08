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
    playSound(type);
    setFlashState(type);
    if (type === 'error') setErrorMsg(msg);
    setTimeout(() => {
      setFlashState('idle');
      if (type === 'error') setErrorMsg("");
    }, 1000);
  }, [playSound]);

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
        .select("id, transfer_code, status, from_branch_id, to_branch_id, created_at")
        .eq("transfer_code", code)
        .maybeSingle();

      if (txError || !tx) {
        setIsFetching(false);
        return triggerFeedback('error', "Geçersiz veya Bulunamayan Transfer Kodu!");
      }

      let currentMode: 'outbound' | 'inbound' | null = null;
      if (tx.from_branch_id === branchId) currentMode = 'outbound';
      else if (tx.to_branch_id === branchId) currentMode = 'inbound';

      if (!currentMode) {
        setIsFetching(false);
        return triggerFeedback('error', "ERİŞİM REDDEDİLDİ: Bu evrak şubenize ait değil!");
      }
      
      if (currentMode === 'outbound' && tx.status === 'Yolda') {
        setIsFetching(false);
        return triggerFeedback('error', "Sevkiyat zaten çıkış yapmış!");
      }
      if (tx.status === 'Tamamlandi') {
        setIsFetching(false);
        return triggerFeedback('error', "Sayım daha önce tamamlanmış!");
      }

      const { data: items } = await supabase
        .from("transfer_items")
        .select(`id, requested_qty, sent_qty, received_qty, products(id, barcode, sku, name, image_url)`)
        .eq("transfer_id", tx.id)
        .order("id");

      if (!items || items.length === 0) {
        setIsFetching(false);
        return triggerFeedback('error', "Evrak içeriği boş!");
      }

      let resolvedFromName = "Bilinmeyen Çıkış";
      let resolvedToName = "Bilinmeyen Hedef";

      const branchIdsToFetch = [tx.from_branch_id, tx.to_branch_id].filter(Boolean);
      if (branchIdsToFetch.length > 0) {
        const { data: bData } = await supabase.from("branches").select("id, name").in("id", branchIdsToFetch);
        if (tx.from_branch_id) resolvedFromName = bData?.find(b => b.id === tx.from_branch_id)?.name || resolvedFromName;
        if (tx.to_branch_id) resolvedToName = bData?.find(b => b.id === tx.to_branch_id)?.name || resolvedToName;
      }

      if (!tx.from_branch_id || !tx.to_branch_id) {
        const { data: logData } = await supabase
          .from("transaction_logs")
          .select("description")
          .ilike("description", `%${tx.transfer_code}%`)
          .eq("action_type", "EXCEL_TRANSFER_CREATED")
          .maybeSingle();

        if (logData) {
          const routeMatch = logData.description.match(/ROTA: \[(.*?) -> (.*?)\]/);
          if (routeMatch) {
            if (!tx.from_branch_id) resolvedFromName = routeMatch[1].trim();
            if (!tx.to_branch_id) resolvedToName = routeMatch[2].trim();
          }
        }
      }

      setActiveTransfer({ ...tx, fromName: resolvedFromName, toName: resolvedToName });
      setMode(currentMode);
      setTransferItems(items as unknown as TransferItem[]);
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
      // ÇÖZÜM: Mobil kamera hızı frenlendi. 3 saniyelik katı soğuma (cooldown) süresi eklendi.
      if (now - lastCameraScanTime.current < 3000) return;
      lastCameraScanTime.current = now;
    }

    setIsProcessing(true);

    try {
      let targetBarcode = rawBarcode.trim();
      let inputQty = typeof selectedQty === 'string' ? parseInt(selectedQty) || 1 : selectedQty;
      if (inputQty < 1) inputQty = 1;

      const { data: boxData } = await supabase
        .from("boxes")
        .select("product_id, quantity")
        .eq("box_barcode", targetBarcode)
        .maybeSingle();

      if (boxData) {
        const { data: pData } = await supabase.from("products").select("barcode").eq("id", boxData.product_id).single();
        if (pData) {
          targetBarcode = pData.barcode;
          inputQty = boxData.quantity * inputQty; 
        }
      }

      const qtyChange = scanMode === 'add' ? inputQty : -inputQty;

      const itemIndex = transferItems.findIndex(i => i.products.barcode === targetBarcode);
      if (itemIndex === -1) {
        triggerFeedback('error', "HATA: Ürün bu listede yok!");
        return;
      }

      const item = transferItems[itemIndex];
      const currentCount = mode === 'outbound' ? item.sent_qty : item.received_qty;
      const proposedCount = currentCount + qtyChange;

      if (proposedCount > item.requested_qty) {
        triggerFeedback('error', `AŞIM! İstenen: ${item.requested_qty} | Girmeye Çalıştığınız: ${proposedCount}`);
        return;
      }
      if (proposedCount < 0) {
        triggerFeedback('error', `HATA! Sayım sıfırın altına düşemez.`);
        return;
      }

      const newItems = [...transferItems];
      if (mode === 'outbound') newItems[itemIndex].sent_qty = proposedCount;
      else newItems[itemIndex].received_qty = proposedCount;

      setTransferItems(newItems);
      setLastScanned({ 
        product: item.products, 
        qtyChange: Math.abs(qtyChange), 
        currentTotal: proposedCount, 
        reqTotal: item.requested_qty,
        type: scanMode
      });
      triggerFeedback('success');
      setSelectedQty(1); 

      supabase.from("transfer_items").update({
        sent_qty: mode === 'outbound' ? proposedCount : item.sent_qty,
        received_qty: mode === 'inbound' ? proposedCount : item.received_qty
      }).eq("id", item.id).then();

    } catch (error) {
      console.error(error);
      triggerFeedback('error', "İşlem Hatası!");
    } finally {
      setIsProcessing(false);
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
        // ÇÖZÜM: Kameranın saniyedeki tarama hızı (fps) düşürülerek kontrolsüz okumalar engellendi.
        { fps: 4, qrbox: { width: 250, height: 150 } }, 
        (decodedText) => processBarcode(decodedText, true), 
        (errorMessage) => { /* Yoksay */ }
      ).catch(err => console.error("Kamera başlatılamadı:", err));
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
      }
    };
  }, [activeTransfer, activeTab]);

  const handleCompleteAndPrint = async () => {
    if (!activeTransfer) return;
    const newStatus = mode === 'outbound' ? 'Yolda' : 'Tamamlandi';
    await supabase.from("transfers").update({ status: newStatus }).eq("id", activeTransfer.id);
    await supabase.from("transaction_logs").insert({
      employee_id: empId,
      branch_id: branchId,
      action_type: mode === 'outbound' ? "TRANSFER_OUTBOUND_COMPLETE" : "TRANSFER_INBOUND_COMPLETE",
      description: `${activeTransfer.transfer_code} kodlu ${mode === 'outbound' ? 'çıkış' : 'giriş'} sayımı tamamlandı.`
    });
    
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
  const totalMissing = totalReq - totalScanned;
  const progressPercent = totalReq > 0 ? Math.round((totalScanned / totalReq) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] flex flex-col antialiased select-none print:bg-white" onClick={forceFocus}>
      
      {/* BAŞLIK (Dark Heading) */}
      <div className="bg-[#0f172b] shadow-md shrink-0 border-b-4 border-[#dc3545] print:hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60 max-w-7xl mx-auto w-full">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white p-2 bg-slate-800/40 hover:bg-slate-800 transition-all rounded-sm shrink-0">
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            {/* ÇÖZÜM: Görsel logo alanı eklendi (src yolunu kendi logonla değiştirebilirsin) */}
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
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
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
              <div className="bg-slate-100 p-4 rounded-full text-slate-400"><QrCode size={40} /></div>
              <h2 className="text-[18px] font-black uppercase text-slate-800 tracking-widest">Sayıma Başla</h2>
              <p className="text-[12px] font-bold text-slate-500">LGS kodunu girin veya okutun.</p>
            </div>
            <form onSubmit={startTransferScan} className="flex flex-col gap-4">
              <input 
                type="text" 
                autoFocus
                placeholder="Örn: LGS1024"
                value={transferCodeInput}
                onChange={e => setTransferCodeInput(e.target.value)}
                disabled={isFetching}
                className="w-full text-center font-black text-[24px] uppercase p-4 border-2 border-slate-300 focus:outline-none focus:border-[#dc3545] tracking-widest bg-slate-50 text-slate-900 disabled:opacity-50"
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
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-6 py-4 font-black text-[14px] md:text-[18px] tracking-widest uppercase shadow-2xl border-2 border-red-900 animate-in slide-in-from-top-10 flex items-center gap-3 w-[90%] md:w-auto text-center">
              <AlertTriangle size={28} className="shrink-0" /> {errorMsg}
            </div>
          )}

          {/* KOKPİT BİLGİ PANELİ */}
          <div className="bg-[#0f172b] p-4 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className={`p-3 border-2 shadow-sm ${mode === 'outbound' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-blue-500 border-blue-400 text-white'}`}>
                {mode === 'outbound' ? <ArrowRight size={24} /> : <Package size={24} />}
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-0.5">
                  <Hash size={12}/> {activeTransfer.transfer_code}
                </span>
                <span className="text-[16px] md:text-[18px] font-black tracking-widest uppercase flex items-center gap-2 flex-wrap">
                  <span className="text-slate-300">{activeTransfer.fromName}</span>
                  <ArrowRight size={14} className="text-[#dc3545]"/>
                  <span className="text-white">{activeTransfer.toName}</span>
                </span>
              </div>
            </div>
            
            <div className="flex flex-col text-left md:text-right w-full md:w-auto border-t md:border-t-0 border-slate-700 pt-3 md:pt-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Evrak İlerlemesi</span>
              <div className="flex items-end gap-2 md:justify-end">
                <span className={`text-[24px] font-black leading-none ${progressPercent === 100 ? 'text-emerald-400' : 'text-white'}`}>{totalScanned}</span>
                <span className="text-slate-500 text-[14px] font-bold">/ {totalReq} ADET</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 z-10">
            
            {/* SOL KOLON: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4">
              
              <div className="flex bg-slate-200 p-1.5 rounded-sm shadow-inner">
                <button 
                  onClick={() => setActiveTab('terminal')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'terminal' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ScanLine size={16} /> Terminal
                </button>
                <button 
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'camera' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Smartphone size={16} /> Kamera
                </button>
              </div>

              <div className="bg-slate-900 p-4 shadow-xl border border-slate-800 flex flex-col gap-4 relative">
                
                {/* İleri/Geri (Toggle) Motoru */}
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => { setScanMode('add'); setTimeout(() => scanInputRef.current?.focus(), 100); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-black uppercase tracking-widest text-[12px] transition-all border ${scanMode === 'add' ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                  >
                    <PlusCircle size={16}/> EKLE
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setScanMode('remove'); setTimeout(() => scanInputRef.current?.focus(), 100); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-black uppercase tracking-widest text-[12px] transition-all border ${scanMode === 'remove' ? 'bg-[#dc3545] text-white border-red-500 shadow-md' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                  >
                    <MinusCircle size={16}/> GERİ AL
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
                      placeholder="Barkod Okutun"
                      className={`w-full text-white border-2 focus:outline-none p-4 font-black text-[18px] text-center uppercase tracking-widest placeholder:text-slate-700 transition-colors ${scanMode === 'add' ? 'bg-slate-950 border-slate-700 focus:border-emerald-500' : 'bg-red-950 border-red-900 focus:border-[#dc3545]'}`}
                    />
                    <button type="submit" className="hidden" /> 
                  </form>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div id="reader" className={`w-full bg-black border-2 overflow-hidden min-h-[250px] ${scanMode === 'add' ? 'border-slate-700' : 'border-[#dc3545]'}`} />
                  </div>
                )}

                {/* ÇÖZÜM: Mobil taşma engellendi. Flex-wrap yapısına geçildi ve min-w-0 eklendi. */}
                <div className="flex flex-col gap-2 border-t border-slate-800 pt-4 mt-2">
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12}/> Adet Seçimi (Çarpan)</span>
                  
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {qtyButtons.map(qty => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 100); }}
                        className={`flex-1 min-w-[40px] py-3 text-[14px] font-black transition-all border rounded-sm ${
                          selectedQty === qty 
                            ? (scanMode === 'add' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-[#dc3545] border-red-500 text-white')
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-950 border border-slate-700 p-2 rounded-sm focus-within:border-slate-500 transition-colors w-full overflow-hidden">
                    <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel Adet:</span>
                    <input 
                      type="number" 
                      min="1"
                      value={selectedQty}
                      onChange={e => setSelectedQty(e.target.value)}
                      className="flex-1 bg-transparent text-white font-black text-[20px] text-right focus:outline-none pr-2 min-w-0 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* ANLIK OKUNAN ÜRÜN BİLGİSİ (Progress Readout) */}
              <div className="bg-white border border-slate-300 shadow-lg p-5 flex flex-col items-center text-center gap-4 relative overflow-hidden">
                <div className={`absolute top-0 w-full h-1.5 ${lastScanned?.type === 'remove' ? 'bg-[#dc3545]' : 'bg-slate-800'}`} />
                
                {lastScanned ? (
                  <>
                    <div className="w-24 h-24 bg-slate-50 border border-slate-200 p-2 shadow-inner">
                      {lastScanned.product.image_url ? (
                        <img src={lastScanned.product.image_url} alt="Urun" className="w-full h-full object-contain mix-blend-multiply" />
                      ) : (
                        <Package size={40} className="text-slate-300 w-full h-full" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[13px] font-black text-[#dc3545] tracking-widest uppercase truncate">{lastScanned.product.barcode}</span>
                      <span className="text-[14px] font-bold text-slate-800 line-clamp-2 leading-tight">{lastScanned.product.name}</span>
                    </div>

                    <div className="w-full flex flex-col gap-2 mt-2 bg-slate-50 p-3 border border-slate-200">
                      <div className="flex justify-between items-end mb-1">
                        <span className={`text-[12px] font-black uppercase tracking-widest ${lastScanned.type === 'remove' ? 'text-[#dc3545]' : 'text-emerald-600'}`}>
                          {lastScanned.type === 'remove' ? `-${lastScanned.qtyChange} İPTAL EDİLDİ` : `+${lastScanned.qtyChange} EKLENDİ`}
                        </span>
                        <div className="flex items-baseline gap-1 shrink-0">
                          <span className="text-[22px] font-black text-slate-900 leading-none">{lastScanned.currentTotal}</span>
                          <span className="text-[12px] font-bold text-slate-400">/ {lastScanned.reqTotal}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 h-2">
                        <div className="bg-slate-800 h-2 transition-all duration-500" style={{ width: `${Math.min((lastScanned.currentTotal / lastScanned.reqTotal) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-300 gap-3 py-8">
                    <QrCode size={48} />
                    <span className="font-bold text-[12px] uppercase tracking-widest">İlk barkodu okutmanız bekleniyor</span>
                  </div>
                )}
              </div>
            </div>

            {/* SAĞ KOLON: ÜRÜN LİSTESİ */}
            <div className="flex-1 bg-white border border-slate-300 shadow-md flex flex-col overflow-hidden min-h-[400px]">
              <div className="bg-[#0f172b] px-4 py-3 flex justify-between items-center text-white shrink-0">
                <span className="text-[11px] font-black uppercase tracking-widest">Canlı Sayım Listesi</span>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[500px]">
                  <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-300">
                    <tr>
                      <th className="p-3 w-36 border-r border-slate-200">Barkod</th>
                      <th className="p-3 border-r border-slate-200">Ürün Adı</th>
                      <th className="p-3 w-20 text-center border-r border-slate-200">İstenen</th>
                      <th className="p-3 w-20 text-center text-emerald-600 bg-emerald-50">Okunan</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] font-bold text-slate-800 divide-y divide-slate-200">
                    {transferItems.map((item) => {
                      const current = mode === 'outbound' ? item.sent_qty : item.received_qty;
                      const isComplete = current === item.requested_qty;
                      const isPartial = current > 0 && current < item.requested_qty;
                      
                      return (
                        <tr key={item.id} className={`${isComplete ? 'bg-emerald-50/50' : isPartial ? 'bg-amber-50/30' : 'bg-white'} hover:bg-slate-50 transition-colors`}>
                          <td className="p-3 border-r border-slate-100 overflow-hidden">
                            <span className={`tracking-widest uppercase truncate block ${isComplete ? 'text-emerald-700' : 'text-[#dc3545]'}`}>
                              {item.products.barcode}
                            </span>
                          </td>
                          <td className="p-3 border-r border-slate-100">
                            <span className="line-clamp-2 text-[11px]">{item.products.name}</span>
                          </td>
                          <td className="p-3 text-center border-r border-slate-100 bg-slate-50/50">
                            <span className="text-[14px] font-black">{item.requested_qty}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[15px] font-black ${isComplete ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-slate-400'}`}>
                              {current}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* TAMAMLA VE YAZDIR BUTONU */}
              <div className="p-4 bg-slate-100 border-t border-slate-300 shrink-0">
                <button 
                  onClick={handleCompleteAndPrint}
                  disabled={totalScanned === 0}
                  className="w-full bg-[#0f172b] disabled:bg-slate-400 text-white font-black text-[14px] p-5 uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#dc3545] transition-colors shadow-lg active:scale-95"
                >
                  <Printer size={20} /> İŞLEMİ BİTİR VE RAPOR YAZDIR
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