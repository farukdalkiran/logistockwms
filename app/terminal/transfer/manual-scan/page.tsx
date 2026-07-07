"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ChevronLeft, TerminalSquare, UserCircle, MapPin, 
  Hash, QrCode, AlertTriangle, Package, 
  Printer, ScanLine, Smartphone, Edit3, PlusCircle, MinusCircle, CheckCircle2, FileSpreadsheet
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

// Serbest Sayım Dinamik Liste Tipi
type ScannedItem = {
  product: {
    id: string;
    barcode: string;
    sku: string | null;
    name: string;
    image_url: string | null;
  };
  quantity: number;
};

type Branch = { id: string; name: string; type: string; };

export default function ManualTransferScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube Terminali";

  // Kurulum (Setup) State'leri
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fromBranchId, setFromBranchId] = useState<string>("");
  const [isCustomFrom, setIsCustomFrom] = useState(false);
  const [customFromBranch, setCustomFromBranch] = useState("");
  const [toBranchId, setToBranchId] = useState<string>("");
  const [isCustomTo, setIsCustomTo] = useState(false);
  const [customToBranch, setCustomToBranch] = useState("");
  const [branchId, setBranchId] = useState<string | null>(null);

  // Operasyon State'leri
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'terminal' | 'camera'>('terminal');
  const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
  const [scanInput, setScanInput] = useState("");
  const [selectedQty, setSelectedQty] = useState<number | string>(1);
  const [lastScanned, setLastScanned] = useState<{product: any, qtyChange: number, currentTotal: number, type: 'add'|'remove'} | null>(null);
  
  // Güvenlik ve Sonuç State'leri
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastCameraScanTime = useRef<number>(0);
  const qtyButtons = [1, 2, 3, 4, 5, 10];

  useEffect(() => {
    const initData = async () => {
      const { data: bData } = await supabase.from("branches").select("id, name, type").order("name");
      if (bData) setBranches(bData);

      const { data: empData } = await supabase.from("employees").select("branch_id").eq("id", empId).single();
      if (empData?.branch_id) {
        setFromBranchId(empData.branch_id);
        setBranchId(empData.branch_id); // Aktif şubemiz
      }
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

  const handleStartCount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCustomFrom && !fromBranchId) return triggerFeedback('error', "Çıkış şubesini seçiniz.");
    if (isCustomFrom && !customFromBranch.trim()) return triggerFeedback('error', "Çıkış lokasyon adını giriniz.");
    if (!isCustomTo && !toBranchId) return triggerFeedback('error', "Varış şubesini seçiniz.");
    if (isCustomTo && !customToBranch.trim()) return triggerFeedback('error', "Varış lokasyon adını giriniz.");
    
    const fId = isCustomFrom ? customFromBranch.trim() : fromBranchId;
    const tId = isCustomTo ? customToBranch.trim() : toBranchId;
    if (fId === tId) return triggerFeedback('error', "Çıkış ve varış rotası aynı olamaz!");

    setIsSetupComplete(true);
    setTimeout(() => scanInputRef.current?.focus(), 200);
  };

  const processBarcode = async (rawBarcode: string, isCamera: boolean = false) => {
    if (!rawBarcode || isProcessing) return;

    if (isCamera) {
      const now = Date.now();
      if (now - lastCameraScanTime.current < 1500) return;
      lastCameraScanTime.current = now;
    }

    setIsProcessing(true);

    try {
      let targetBarcode = rawBarcode.trim();
      let inputQty = typeof selectedQty === 'string' ? parseInt(selectedQty) || 1 : selectedQty;
      if (inputQty < 1) inputQty = 1;

      // 1. Koli Çözümleyici
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

      // 2. Ürünü Listeden veya DB'den Bul
      let existingItemIndex = scannedItems.findIndex(i => i.product.barcode === targetBarcode);
      let productDetails = null;

      if (existingItemIndex === -1) {
        const { data: newProduct, error: pErr } = await supabase
          .from("products")
          .select("id, barcode, sku, name, image_url")
          .eq("barcode", targetBarcode)
          .maybeSingle();

        if (pErr || !newProduct) {
          triggerFeedback('error', "HATA: Ürün veritabanında bulunamadı!");
          return;
        }
        productDetails = newProduct;
      } else {
        productDetails = scannedItems[existingItemIndex].product;
      }

      // 3. Ekleme / Çıkarma Hesaplaması
      const qtyChange = scanMode === 'add' ? inputQty : -inputQty;
      const currentQty = existingItemIndex !== -1 ? scannedItems[existingItemIndex].quantity : 0;
      const proposedQty = currentQty + qtyChange;

      if (proposedQty < 0) {
        triggerFeedback('error', "HATA! Sayım sıfırın altına düşemez.");
        return;
      }

      let updatedList = [...scannedItems];
      if (existingItemIndex > -1) {
        if (proposedQty === 0) {
          updatedList.splice(existingItemIndex, 1);
        } else {
          updatedList[existingItemIndex].quantity = proposedQty;
        }
      } else {
        if (proposedQty > 0) {
          updatedList.unshift({
            product: productDetails,
            quantity: proposedQty
          });
        }
      }

      setScannedItems(updatedList);
      setLastScanned({ 
        product: productDetails, 
        qtyChange: Math.abs(qtyChange), 
        currentTotal: proposedQty,
        type: scanMode
      });
      triggerFeedback('success');
      setSelectedQty(1);

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
    if (isSetupComplete && activeTab === 'camera' && !savedCode) {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } }, 
        (decodedText) => processBarcode(decodedText, true), 
        () => {}
      ).catch(err => console.error("Kamera başlatılamadı:", err));
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
      }
    };
  }, [isSetupComplete, activeTab, savedCode]);

  // Nihai Kayıt ve Yazdırma
  const saveToDatabase = async () => {
    if (scannedItems.length === 0) return triggerFeedback('error', "Liste boş!");
    setIsProcessing(true);
    setIsSaving(true);

    try {
      const finalFromBranchId = isCustomFrom ? null : fromBranchId;
      const finalToBranchId = isCustomTo ? null : toBranchId;

      // Akıllı Durum Lojiği (Bizden çıkıyorsa Yolda, bize giriyorsa Tamamlandı)
      const finalStatus = (!isCustomFrom && finalFromBranchId === branchId) ? "Yolda" : "Tamamlandi";

      const { data: lastTransfer } = await supabase
        .from("transfers")
        .select("transfer_code")
        .like("transfer_code", "MNS%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // MNS1001 formatı (Tiresiz)
      let finalNumber = 1001;
      if (lastTransfer?.transfer_code) {
        const numPart = lastTransfer.transfer_code.replace("MNS", "");
        finalNumber = (parseInt(numPart, 10) || 1000) + 1;
      }
      const newTransferCode = `MNS${finalNumber}`;

      const { data: transferRecord, error: txError } = await supabase
        .from("transfers")
        .insert({
          transfer_code: newTransferCode,
          status: finalStatus, 
          from_branch_id: finalFromBranchId,
          to_branch_id: finalToBranchId,
          picker_employee_id: empId,
        })
        .select("id")
        .single();

      if (txError) throw txError;

      const itemsToInsert = scannedItems.map((item) => ({
        transfer_id: transferRecord.id,
        product_id: item.product.id,
        requested_qty: item.quantity,
        approved_qty: item.quantity,
        sent_qty: item.quantity, 
        received_qty: item.quantity,
        status: "Tamamlandi",
      }));

      const { error: itemsError } = await supabase.from("transfer_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      const fromNameForLog = isCustomFrom ? customFromBranch.trim() : branches.find(b => b.id === fromBranchId)?.name;
      const toNameForLog = isCustomTo ? customToBranch.trim() : branches.find(b => b.id === toBranchId)?.name;

      await supabase.from("transaction_logs").insert({
        employee_id: empId,
        branch_id: branchId,
        action_type: "MANUAL_SCAN_CREATED",
        description: `${newTransferCode} kodlu serbest sayım fişi oluşturuldu. ROTA: [${fromNameForLog || 'Bilinmiyor'} -> ${toNameForLog || 'Bilinmiyor'}]`
      });

      setSavedCode(newTransferCode);
      setSavedStatus(finalStatus);
      setTimeout(() => window.print(), 500);

    } catch (err) {
      console.error(err);
      triggerFeedback('error', "Kayıt Hatası!");
    } finally {
      setIsProcessing(false);
      setIsSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    if (scannedItems.length === 0) return;
    const headers = ["Sira", "Barkod", "SKU", "Urun Adi", "Okunan_Adet"];
    const csvRows = scannedItems.map((item, index) => {
      const rowNum = index + 1;
      const barcode = item.product?.barcode || "-";
      const sku = item.product?.sku || "-";
      const name = `"${(item.product?.name || "İsimsiz").replace(/"/g, '""')}"`; 
      return `${rowNum};${barcode};${sku};${name};${item.quantity}`;
    });

    const routeStr = `${isCustomFrom ? customFromBranch : branches.find(b=>b.id===fromBranchId)?.name} -> ${isCustomTo ? customToBranch : branches.find(b=>b.id===toBranchId)?.name}`;
    const csvContent = `sep=;\nROTA: ${routeStr}\n` + headers.join(";") + "\n" + csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${savedCode || 'MNS_SAYIM'}_RAPORU.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const forceFocus = () => {
    if (isSetupComplete && activeTab === 'terminal' && !savedCode) scanInputRef.current?.focus();
  };

  const totalScanned = scannedItems.reduce((acc, i) => acc + i.quantity, 0);
  const routeDisplay = `${isCustomFrom ? customFromBranch : branches.find(b=>b.id===fromBranchId)?.name || 'Bilinmiyor'} -> ${isCustomTo ? customToBranch : branches.find(b=>b.id===toBranchId)?.name || 'Bilinmiyor'}`;

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] flex flex-col antialiased select-none print:bg-white" onClick={forceFocus}>
      
      {/* BAŞLIK (Dark Heading) */}
      <div className="bg-[#0f172b] shadow-md shrink-0 border-b-4 border-[#dc3545] print:hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60 max-w-7xl mx-auto w-full">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white p-2 bg-slate-800/40 hover:bg-slate-800 transition-all rounded-sm">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <TerminalSquare size={18} className="text-[#dc3545]" />
            <span className="text-white text-[14px] sm:text-[15px] font-black uppercase tracking-widest">
              Serbest Sayım Motoru
            </span>
          </div>
          <div className="w-10" />
        </div>
        <div className="bg-slate-950 py-2.5 px-4">
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
            <span className="text-slate-400 flex items-center gap-1.5"><UserCircle size={14} className="text-slate-600"/> {empName}</span>
            <span className="text-[#dc3545] flex items-center gap-1.5"><MapPin size={14}/> {branchName}</span>
          </div>
        </div>
      </div>

      {/* 1. KURULUM (SETUP) EKRANI */}
      {!isSetupComplete && (
        <div className="flex-1 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white p-6 border border-slate-300 shadow-xl max-w-2xl w-full flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-2 mb-2 border-b border-slate-100 pb-4">
              <div className="bg-slate-100 p-4 rounded-full text-slate-400"><QrCode size={40} /></div>
              <h2 className="text-[18px] font-black uppercase text-slate-800 tracking-widest">Serbest Sayım Oluştur</h2>
              <p className="text-[12px] font-bold text-slate-500">Bu modül ile plansız transfer veya siparişleri okutarak yeni liste yaratabilirsiniz.</p>
            </div>
            
            <form onSubmit={handleStartCount} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Çıkış Şubesi (Gönderen)</label>
                  <select 
                    value={isCustomFrom ? "other" : fromBranchId} 
                    onChange={(e) => {
                      if(e.target.value === "other") setIsCustomFrom(true);
                      else { setIsCustomFrom(false); setFromBranchId(e.target.value); }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-[14px] font-bold p-3 rounded-sm focus:outline-none focus:border-[#dc3545]"
                  >
                    <option value="" disabled>Şube Seçiniz...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.type})</option>)}
                    <option value="other" className="font-black text-[#dc3545]">+ Geçici / Manuel (Tabloyu Kirletmez)</option>
                  </select>
                  {isCustomFrom && (
                    <input type="text" placeholder="Örn: Müşteri Siparişi A" value={customFromBranch} onChange={e => setCustomFromBranch(e.target.value)} className="w-full mt-2 bg-white border border-[#dc3545] p-3 text-[13px] font-bold rounded-sm focus:outline-none" autoFocus />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Varış Şubesi (Alıcı)</label>
                  <select 
                    value={isCustomTo ? "other" : toBranchId} 
                    onChange={(e) => {
                      if(e.target.value === "other") setIsCustomTo(true);
                      else { setIsCustomTo(false); setToBranchId(e.target.value); }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-[14px] font-bold p-3 rounded-sm focus:outline-none focus:border-[#dc3545]"
                  >
                    <option value="" disabled>Şube Seçiniz...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.type})</option>)}
                    <option value="other" className="font-black text-[#dc3545]">+ Geçici / Manuel (Tabloyu Kirletmez)</option>
                  </select>
                  {isCustomTo && (
                    <input type="text" placeholder="Örn: X Kargo Firması" value={customToBranch} onChange={e => setCustomToBranch(e.target.value)} className="w-full mt-2 bg-white border border-[#dc3545] p-3 text-[13px] font-bold rounded-sm focus:outline-none" />
                  )}
                </div>
              </div>

              <button type="submit" className="w-full bg-[#dc3545] text-white p-4 font-black uppercase tracking-widest hover:bg-red-700 transition-colors active:scale-95 shadow-md mt-2">
                SAYIMA BAŞLA
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. OPERASYON (SAYIM) EKRANI */}
      {isSetupComplete && (
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
              <div className={`p-3 border-2 shadow-sm bg-purple-600 border-purple-400 text-white`}>
                <Package size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-0.5">
                  <Hash size={12}/> {savedCode ? `${savedCode} OLUŞTURULDU` : "SERBEST SAYIM MODU"}
                </span>
                <span className="text-[14px] md:text-[16px] font-black tracking-widest uppercase flex items-center gap-2">
                  <span className="text-white truncate max-w-[150px] md:max-w-[300px]" title={routeDisplay}>{routeDisplay}</span>
                </span>
              </div>
            </div>
            
            <div className="flex flex-col text-left md:text-right w-full md:w-auto border-t md:border-t-0 border-slate-700 pt-3 md:pt-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Toplam Okunan</span>
              <div className="flex items-end gap-2 md:justify-end">
                <span className={`text-[24px] font-black leading-none text-emerald-400`}>{totalScanned}</span>
                <span className="text-slate-500 text-[14px] font-bold">ADET</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 z-10">
            
            {/* SOL KOLON: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4">
              
              {!savedCode && (
                <>
                  <div className="flex bg-slate-200 p-1.5 rounded-sm shadow-inner">
                    <button onClick={() => setActiveTab('terminal')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'terminal' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                      <ScanLine size={16} /> Terminal Cihazı
                    </button>
                    <button onClick={() => setActiveTab('camera')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'camera' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                      <Smartphone size={16} /> Telefon Kamerası
                    </button>
                  </div>

                  <div className="bg-slate-900 p-4 shadow-xl border border-slate-800 flex flex-col gap-4 relative">
                    
                    {/* Toggle: Ekle/Çıkar */}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setScanMode('add'); setTimeout(() => scanInputRef.current?.focus(), 100); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-black uppercase tracking-widest text-[12px] transition-all border ${scanMode === 'add' ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
                        <PlusCircle size={16}/> EKLE
                      </button>
                      <button type="button" onClick={() => { setScanMode('remove'); setTimeout(() => scanInputRef.current?.focus(), 100); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-black uppercase tracking-widest text-[12px] transition-all border ${scanMode === 'remove' ? 'bg-[#dc3545] text-white border-red-500 shadow-md' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
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
                          onBlur={() => setTimeout(() => { if(!savedCode) scanInputRef.current?.focus() }, 300)}
                          placeholder="Barkod Okutun"
                          disabled={isProcessing}
                          className={`w-full text-white border-2 focus:outline-none p-4 font-black text-[18px] text-center uppercase tracking-widest placeholder:text-slate-700 transition-colors ${scanMode === 'add' ? 'bg-slate-950 border-slate-700 focus:border-emerald-500' : 'bg-red-950 border-red-900 focus:border-[#dc3545]'} disabled:opacity-50`}
                        />
                        <button type="submit" className="hidden" /> 
                      </form>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div id="reader" className={`w-full bg-black border-2 overflow-hidden min-h-[250px] ${scanMode === 'add' ? 'border-slate-700' : 'border-[#dc3545]'}`} />
                      </div>
                    )}

                    {/* Miktar Çarpanı */}
                    <div className="flex flex-col gap-2 border-t border-slate-800 pt-4 mt-2">
                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12}/> Adet Seçimi (Çarpan)</span>
                      <div className="grid grid-cols-6 gap-1.5 mb-2">
                        {qtyButtons.map(qty => (
                          <button key={qty} type="button" onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 100); }} className={`py-3 text-[14px] font-black transition-all border rounded-sm ${selectedQty === qty ? (scanMode === 'add' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-[#dc3545] border-red-500 text-white') : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
                            {qty}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 bg-slate-950 border border-slate-700 p-2 rounded-sm focus-within:border-slate-500 transition-colors">
                        <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2">Manuel Adet:</span>
                        <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} className="flex-1 bg-transparent text-white font-black text-[20px] text-right focus:outline-none pr-2" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ANLIK OKUNAN ÜRÜN BİLGİSİ */}
              <div className="bg-white border border-slate-300 shadow-lg p-5 flex flex-col items-center text-center gap-4 relative overflow-hidden flex-1">
                <div className={`absolute top-0 w-full h-1.5 ${lastScanned?.type === 'remove' ? 'bg-[#dc3545]' : 'bg-slate-800'}`} />
                
                {lastScanned ? (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-24 h-24 bg-slate-50 border border-slate-200 p-2 shadow-inner mb-4">
                      {lastScanned.product.image_url ? (
                        <img src={lastScanned.product.image_url} alt="Urun" className="w-full h-full object-contain mix-blend-multiply" />
                      ) : (
                        <Package size={40} className="text-slate-300 w-full h-full" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 w-full border-b border-slate-100 pb-4 mb-4">
                      <span className="text-[13px] font-black text-[#dc3545] tracking-widest uppercase truncate">{lastScanned.product.barcode}</span>
                      <span className="text-[14px] font-bold text-slate-800 line-clamp-2 leading-tight">{lastScanned.product.name}</span>
                    </div>

                    <div className="w-full bg-slate-50 p-3 border border-slate-200 flex justify-between items-center">
                      <span className={`text-[12px] font-black uppercase tracking-widest ${lastScanned.type === 'remove' ? 'text-[#dc3545]' : 'text-emerald-600'}`}>
                        {lastScanned.type === 'remove' ? `-${lastScanned.qtyChange} İPTAL EDİLDİ` : `+${lastScanned.qtyChange} EKLENDİ`}
                      </span>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Bu Üründen Toplam</span>
                        <span className="text-[24px] font-black text-slate-900 leading-none">{lastScanned.currentTotal}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-300 gap-3 py-10 my-auto">
                    {savedCode ? <CheckCircle2 size={56} className="text-emerald-500"/> : <QrCode size={48} />}
                    <span className="font-bold text-[12px] uppercase tracking-widest">
                      {savedCode ? "İşlem Tamamlandı" : "İlk barkodu okutmanız bekleniyor"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SAĞ KOLON: ÜRÜN LİSTESİ */}
            <div className="flex-1 bg-white border border-slate-300 shadow-md flex flex-col overflow-hidden">
              <div className="bg-[#0f172b] px-4 py-3 flex justify-between items-center text-white">
                <span className="text-[11px] font-black uppercase tracking-widest">Sayım Listesi Özeti</span>
                <span className="bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-widest border border-slate-700">{scannedItems.length} Kalem</span>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[400px]">
                  <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-300">
                    <tr>
                      <th className="p-3 w-36 border-r border-slate-200">Barkod</th>
                      <th className="p-3 border-r border-slate-200">Ürün Adı</th>
                      <th className="p-3 w-24 text-center text-emerald-600 bg-emerald-50">Okunan</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] font-bold text-slate-800 divide-y divide-slate-200">
                    {scannedItems.map((item) => (
                      <tr key={item.product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-r border-slate-100 overflow-hidden">
                          <span className="tracking-widest uppercase truncate block text-slate-800">{item.product.barcode}</span>
                        </td>
                        <td className="p-3 border-r border-slate-100">
                          <span className="line-clamp-2 text-[11px]">{item.product.name}</span>
                        </td>
                        <td className="p-3 text-center bg-emerald-50/30">
                          <span className="text-[16px] font-black text-emerald-600">{item.quantity}</span>
                        </td>
                      </tr>
                    ))}
                    {scannedItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 text-[12px] font-black uppercase tracking-widest">Liste Boş</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* KAYDET VE YAZDIR ALANI */}
              <div className="p-4 bg-slate-100 border-t border-slate-300 shrink-0 flex flex-col gap-3">
                {!savedCode ? (
                  <button 
                    onClick={saveToDatabase}
                    disabled={totalScanned === 0 || isSaving}
                    className="w-full bg-[#0f172b] disabled:bg-slate-400 text-white font-black text-[14px] p-5 uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#dc3545] transition-colors shadow-lg active:scale-95"
                  >
                    {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Printer size={20} />}
                    İŞLEMİ BİTİR, KAYDET VE ETİKET YAZDIR
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => window.print()}
                      className="bg-slate-900 text-white font-black text-[12px] p-4 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
                    >
                      <Printer size={18} /> TEKRAR YAZDIR
                    </button>
                    <button 
                      onClick={handleDownloadExcel}
                      className="bg-emerald-600 text-white font-black text-[12px] p-4 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <FileSpreadsheet size={18} /> EXCEL (CSV) İNDİR
                    </button>
                    <button 
                      onClick={() => window.location.reload()}
                      className="col-span-2 bg-white border-2 border-slate-300 text-slate-700 font-black text-[12px] p-4 uppercase tracking-widest hover:border-[#dc3545] hover:text-[#dc3545] transition-colors"
                    >
                      YENİ SAYIM BAŞLAT
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ZEBRA ZD230 (100x150mm) RAPOR ŞABLONU --- */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 100mm 150mm; margin: 0; }
          body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; }
          .print-container { width: 100mm; height: 148mm; padding: 4mm; box-sizing: border-box; background: white; color: black; font-family: sans-serif; display: flex; flex-direction: column; }
        }
      `}} />
      
      {isSetupComplete && (
        <div className="hidden print:flex print-container">
          
          <div className="text-center border-b-4 border-black pb-2 mb-2 shrink-0">
            <h1 className="text-[24px] font-black uppercase m-0 leading-none tracking-widest">LOGISTOCK | WMS</h1>
            <p className="text-[14px] font-black mt-1 uppercase tracking-widest bg-black text-white py-1 inline-block px-4">
              {savedStatus === 'Yolda' ? 'GİDEN TRANSFER RAPORU' : 'MAL KABUL / SAYIM RAPORU'}
            </p>
          </div>
          
          <div className="flex flex-col gap-1.5 border-b-2 border-black pb-2 mb-2 text-[12px] font-bold uppercase shrink-0">
            <div className="flex justify-between items-end">
              <span className="text-gray-600">EVRAK KODU:</span> 
              <span className="text-[18px] font-black leading-none">{savedCode || "KAYDEDİLMEMİŞ TASLAK"}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-600">TARİH:</span> <span>{new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">OPERATÖR:</span> <span>{empName}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">ROTA:</span> <span className="text-right truncate max-w-[60mm]">{routeDisplay}</span></div>
          </div>

          <div className="border-2 border-black p-2 mb-2 flex justify-center items-center text-center shrink-0 bg-gray-100">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-600 font-bold uppercase">Toplam Okunan Ürün</span>
              <span className="text-[20px] font-black">{totalScanned} ADET</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden mt-2">
            <table className="w-full text-left text-[10px] font-bold uppercase border-collapse">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-1">Barkod</th>
                  <th className="py-1">Ürün Tanımı</th>
                  <th className="py-1 text-center">Okunan</th>
                </tr>
              </thead>
              <tbody>
                {scannedItems.map((item) => (
                  <tr key={item.product.id} className="border-b border-gray-300">
                    <td className="py-1.5 whitespace-nowrap">{item.product.barcode}</td>
                    <td className="py-1.5 truncate max-w-[50mm]">{item.product.name}</td>
                    <td className="py-1.5 text-center font-black text-[12px]">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}