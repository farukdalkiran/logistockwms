"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ChevronLeft, TerminalSquare, UserCircle, MapPin, 
  Hash, QrCode, AlertTriangle, Package, 
  Printer, ScanLine, Smartphone, Edit3, PlusCircle, MinusCircle, CheckCircle2, FileSpreadsheet,
  ArrowRight, Truck
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type ScannedItem = {
  product: { id: string; barcode: string; sku: string | null; name: string; image_url: string | null; };
  quantity: number;
};

type Branch = { id: string; name: string; type: string; };

export default function ManualTransferScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube Terminali";

  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fromBranchId, setFromBranchId] = useState<string>("");
  const [isCustomFrom, setIsCustomFrom] = useState(false);
  const [customFromBranch, setCustomFromBranch] = useState("");
  const [toBranchId, setToBranchId] = useState<string>("");
  const [isCustomTo, setIsCustomTo] = useState(false);
  const [customToBranch, setCustomToBranch] = useState("");
  const [branchId, setBranchId] = useState<string | null>(null);

  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'terminal' | 'camera'>('terminal');
  const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
  const [scanInput, setScanInput] = useState("");
  const [selectedQty, setSelectedQty] = useState<number | string>(1);
  const [lastScanned, setLastScanned] = useState<{product: any, qtyChange: number, currentTotal: number, type: 'add'|'remove'} | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [flashState, setFlashState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState("");
  
  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastCameraScanTime = useRef<number>(0);
  const qtyButtons = [1, 2, 3, 4, 5, 10];

  // ÇÖZÜM 1: Stale Closure Engelleyici Ref'ler (Hızlı okumada listenin ezilmesini önler)
  const opState = useRef({ scanMode, selectedQty });
  const itemsRef = useRef<ScannedItem[]>([]); 

  useEffect(() => { opState.current = { scanMode, selectedQty }; }, [scanMode, selectedQty]);

  // ÇÖZÜM 2: Agresif Focus (Donanım okuyucular için kesintisiz giriş)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSetupComplete && activeTab === 'terminal' && !isProcessing && !savedCode) {
        if (document.activeElement !== scanInputRef.current) {
          scanInputRef.current?.focus();
        }
      }
    }, 800);
    return () => clearInterval(interval);
  }, [isSetupComplete, activeTab, isProcessing, savedCode]);

  useEffect(() => {
    const initData = async () => {
      const { data: bData } = await supabase.from("branches").select("id, name, type").order("name");
      if (bData) setBranches(bData);

      const { data: empData } = await supabase.from("employees").select("branch_id").eq("id", empId).single();
      if (empData?.branch_id) {
        setFromBranchId(empData.branch_id);
        setBranchId(empData.branch_id); 
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
      if (now - lastCameraScanTime.current < 2000) return;
      lastCameraScanTime.current = now;
    }

    setIsProcessing(true);

    try {
      let targetBarcode = rawBarcode.trim();
      let currentScanMode = opState.current.scanMode;
      let currentQty = opState.current.selectedQty;
      
      let inputQty = typeof currentQty === 'string' ? parseInt(currentQty) || 1 : currentQty;
      if (inputQty < 1) inputQty = 1;

      // Hızlı Okuma Ref Klonlaması
      let currentItems = [...itemsRef.current];

      const { data: boxData } = await supabase.from("boxes").select("product_id, quantity").eq("box_barcode", targetBarcode).maybeSingle();
      if (boxData) {
        const { data: pData } = await supabase.from("products").select("barcode").eq("id", boxData.product_id).single();
        if (pData) { targetBarcode = pData.barcode; inputQty = boxData.quantity * inputQty; }
      }

      let existingItemIndex = currentItems.findIndex(i => i.product.barcode === targetBarcode);
      let productDetails = null;

      // DB'ye sadece ürün listede yoksa git (Performans artışı)
      if (existingItemIndex === -1) {
        const { data: newProduct, error: pErr } = await supabase.from("products").select("id, barcode, sku, name, image_url").eq("barcode", targetBarcode).maybeSingle();
        if (pErr || !newProduct) {
          triggerFeedback('error', "HATA: Ürün veritabanında bulunamadı!");
          return;
        }
        productDetails = newProduct;
      } else {
        productDetails = currentItems[existingItemIndex].product;
      }

      const qtyChange = currentScanMode === 'add' ? inputQty : -inputQty;
      const currentCount = existingItemIndex !== -1 ? currentItems[existingItemIndex].quantity : 0;
      const proposedQty = currentCount + qtyChange;

      if (proposedQty < 0) {
        triggerFeedback('error', "HATA! Sayım sıfırın altına düşemez.");
        return;
      }

      // Senkron Ref Güncellemesi ve Silme (0 Mantığı)
      if (existingItemIndex > -1) {
        if (proposedQty === 0) {
          currentItems.splice(existingItemIndex, 1);
        } else {
          currentItems[existingItemIndex] = { ...currentItems[existingItemIndex], quantity: proposedQty };
        }
      } else {
        if (proposedQty > 0) {
          currentItems.unshift({ product: productDetails, quantity: proposedQty });
        }
      }

      itemsRef.current = currentItems; // Ref'i anında güncelle (Stale closure bitti)
      setScannedItems(currentItems);   // UI'ı tetikle
      
      setLastScanned({ 
        product: productDetails, 
        qtyChange: Math.abs(qtyChange), 
        currentTotal: proposedQty,
        type: currentScanMode
      });
      
      triggerFeedback('success');
      setSelectedQty(1);

    } catch (error) {
      triggerFeedback('error', "İşlem Hatası!");
    } finally {
      setIsProcessing(false);
      setTimeout(() => scanInputRef.current?.focus(), 50); // Kesin geri odaklanma
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
  }, [isSetupComplete, activeTab, savedCode]);

  // ÇÖZÜM 3: MNS Yönlendirme (Statü) ve Veritabanı Lojiği
  const saveToDatabase = async () => {
    const finalItemsToSave = itemsRef.current; // Ref'ten en güncel listeyi al
    if (finalItemsToSave.length === 0) return triggerFeedback('error', "Liste boş!");
    setIsProcessing(true); setIsSaving(true);

    try {
      const finalFromBranchId = isCustomFrom ? null : fromBranchId;
      const finalToBranchId = isCustomTo ? null : toBranchId;

      // Akıllı Statü Lojiği: Bize giriyorsa bitti, bizden çıkıyorsa yolda.
      let finalStatus = "Bekliyor";
      if (!isCustomTo && finalToBranchId === branchId) {
        finalStatus = "Tamamlandi";
      } else if (!isCustomFrom && finalFromBranchId === branchId) {
        finalStatus = "Yolda";
      }

      const { data: lastTransfer } = await supabase.from("transfers").select("transfer_code").like("transfer_code", "MNS%").order("created_at", { ascending: false }).limit(1).maybeSingle();

      let finalNumber = 1001;
      if (lastTransfer?.transfer_code) {
        const numPart = lastTransfer.transfer_code.replace("MNS", "");
        finalNumber = (parseInt(numPart, 10) || 1000) + 1;
      }
      const newTransferCode = `MNS${finalNumber}`;

      const { data: transferRecord, error: txError } = await supabase.from("transfers").insert({
          transfer_code: newTransferCode,
          status: finalStatus, 
          from_branch_id: finalFromBranchId,
          to_branch_id: finalToBranchId,
          picker_employee_id: empId,
        }).select("id").single();

      if (txError) throw txError;

      // Karşı taraf check-in yapabilsin diye quantity mantığı
      const itemsToInsert = finalItemsToSave.map((item) => ({
        transfer_id: transferRecord.id,
        product_id: item.product.id,
        requested_qty: item.quantity,
        approved_qty: item.quantity,
        sent_qty: item.quantity, 
        received_qty: finalStatus === 'Tamamlandi' ? item.quantity : 0,
        status: finalStatus === 'Tamamlandi' ? "Tamamlandi" : "Bekliyor",
      }));

      const { error: itemsError } = await supabase.from("transfer_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      const fromNameForLog = isCustomFrom ? customFromBranch.trim() : branches.find(b => b.id === fromBranchId)?.name;
      const toNameForLog = isCustomTo ? customToBranch.trim() : branches.find(b => b.id === toBranchId)?.name;

      await supabase.from("transaction_logs").insert({
        employee_id: empId, branch_id: branchId, action_type: "MANUAL_SCAN_CREATED",
        description: `${newTransferCode} kodlu sayım/transfer fişi oluşturuldu (${finalStatus}). ROTA: [${fromNameForLog || '-'} -> ${toNameForLog || '-'}]`
      });

      setSavedCode(newTransferCode); setSavedStatus(finalStatus);
      setTimeout(() => window.print(), 500);

    } catch (err) {
      triggerFeedback('error', "Kayıt Hatası!");
    } finally {
      setIsProcessing(false); setIsSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    if (scannedItems.length === 0) return;
    const headers = ["Sira", "Barkod", "SKU", "Urun Adi", "Okunan_Adet"];
    const csvRows = scannedItems.map((item, index) => {
      return `${index + 1};${item.product?.barcode || "-"};${item.product?.sku || "-"};"${(item.product?.name || "İsimsiz").replace(/"/g, '""')}";${item.quantity}`;
    });
    const routeStr = `${isCustomFrom ? customFromBranch : branches.find(b=>b.id===fromBranchId)?.name} -> ${isCustomTo ? customToBranch : branches.find(b=>b.id===toBranchId)?.name}`;
    const csvContent = `sep=;\nROTA: ${routeStr}\n` + headers.join(";") + "\n" + csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.setAttribute("download", `${savedCode || 'MNS_SAYIM'}_RAPORU.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const totalScanned = scannedItems.reduce((acc, i) => acc + i.quantity, 0);
  const routeDisplay = `${isCustomFrom ? customFromBranch : branches.find(b=>b.id===fromBranchId)?.name || '-'} -> ${isCustomTo ? customToBranch : branches.find(b=>b.id===toBranchId)?.name || '-'}`;

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] flex flex-col antialiased select-none print:bg-white" onClick={() => scanInputRef.current?.focus()}>
      
      {/* BAŞLIK (Dark Heading) */}
      <div className="bg-[#0f172b] shadow-md shrink-0 border-b-4 border-[#dc3545] print:hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60 max-w-7xl mx-auto w-full">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white p-2 bg-slate-800/40 hover:bg-slate-800 transition-all rounded-sm shrink-0">
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <img src="/logo-placeholder.png" alt="Logo" className="h-6 w-auto object-contain hidden sm:block" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <TerminalSquare size={18} className="text-[#dc3545] sm:hidden" />
              <span className="text-white text-[14px] sm:text-[15px] font-black uppercase tracking-widest line-clamp-1">Serbest Sayım Motoru</span>
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

      {/* 1. KURULUM (SETUP) EKRANI */}
      {!isSetupComplete && (
        <div className="flex-1 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col gap-6 rounded-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="flex flex-col items-center text-center gap-3 mb-2 border-b border-slate-100 pb-6 relative z-10">
              <div className="bg-white border-2 border-slate-100 p-4 rounded-full text-[#0f172b] shadow-sm"><QrCode size={40} /></div>
              <h2 className="text-[18px] sm:text-[20px] font-black uppercase text-slate-800 tracking-widest">Serbest Sayım Oluştur</h2>
              <p className="text-[12px] font-bold text-slate-500 max-w-md leading-relaxed">Sistemsel kaydı olmayan plansız transfer veya sayımları okutarak yeni liste yaratın.</p>
            </div>
            
            <form onSubmit={handleStartCount} className="flex flex-col gap-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white p-2 rounded-full border border-slate-200 text-slate-400 shadow-sm"><ArrowRight size={20} /></div>

                {/* GÖNDEREN */}
                <div className="flex flex-col gap-2 bg-slate-50 p-5 border border-slate-200 rounded-sm shadow-inner transition-colors focus-within:bg-white focus-within:border-orange-300">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><MapPin size={14} className="text-orange-500" /> Çıkış (Gönderen)</label>
                  <select value={isCustomFrom ? "other" : fromBranchId} onChange={(e) => { if(e.target.value === "other") setIsCustomFrom(true); else { setIsCustomFrom(false); setFromBranchId(e.target.value); } }} className="w-full bg-white border-2 border-slate-200 text-slate-800 text-[14px] font-bold p-3 rounded-sm focus:outline-none focus:border-orange-500 transition-colors cursor-pointer">
                    <option value="" disabled>Şube Seçiniz...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.type})</option>)}
                    <option value="other" className="font-black text-orange-600">+ Özel Konum / Dışarıya</option>
                  </select>
                  {isCustomFrom && <input type="text" placeholder="Örn: X Müşterisi, İade vs." value={customFromBranch} onChange={e => setCustomFromBranch(e.target.value)} className="w-full mt-3 bg-white border-2 border-orange-400 p-3 text-[13px] font-bold rounded-sm focus:outline-none shadow-sm" autoFocus />}
                </div>

                {/* ALICI */}
                <div className="flex flex-col gap-2 bg-slate-50 p-5 border border-slate-200 rounded-sm shadow-inner transition-colors focus-within:bg-white focus-within:border-emerald-300">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Truck size={14} className="text-emerald-500" /> Varış (Alıcı)</label>
                  <select value={isCustomTo ? "other" : toBranchId} onChange={(e) => { if(e.target.value === "other") setIsCustomTo(true); else { setIsCustomTo(false); setToBranchId(e.target.value); } }} className="w-full bg-white border-2 border-slate-200 text-slate-800 text-[14px] font-bold p-3 rounded-sm focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer">
                    <option value="" disabled>Şube Seçiniz...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.type})</option>)}
                    <option value="other" className="font-black text-emerald-600">+ Özel Konum / Dışarıdan</option>
                  </select>
                  {isCustomTo && <input type="text" placeholder="Örn: X Tedarikçisi, Kargo vs." value={customToBranch} onChange={e => setCustomToBranch(e.target.value)} className="w-full mt-3 bg-white border-2 border-emerald-400 p-3 text-[13px] font-bold rounded-sm focus:outline-none shadow-sm" />}
                </div>
              </div>

              <button type="submit" className="w-full bg-[#0f172b] text-white p-4 sm:p-5 font-black uppercase tracking-[0.1em] hover:bg-[#dc3545] transition-all active:scale-95 shadow-md mt-2 flex items-center justify-center gap-3 text-[13px] rounded-sm">
                ROTA ONAYLA VE SAYIMA BAŞLA <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. OPERASYON EKRANI */}
      {isSetupComplete && (
        <div className="flex-1 flex flex-col print:hidden relative">
          
          <div className={`pointer-events-none fixed inset-0 z-40 transition-colors duration-300 ${flashState === 'success' ? 'bg-emerald-500/20' : flashState === 'error' ? 'bg-red-600/40' : 'bg-transparent'}`} />

          {errorMsg && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-4 sm:px-6 py-4 font-black text-[12px] sm:text-[14px] tracking-widest uppercase shadow-2xl border-2 border-red-900 animate-in slide-in-from-top-10 flex items-center gap-3 w-[95%] max-w-md text-center">
              <AlertTriangle size={24} className="shrink-0" /> {errorMsg}
            </div>
          )}

          <div className="bg-[#0f172b] p-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className={`p-2 sm:p-3 border-2 shadow-sm bg-purple-600 border-purple-400 text-white shrink-0`}><Package size={20} className="sm:w-6 sm:h-6" /></div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-0.5"><Hash size={12}/> {savedCode ? `${savedCode} OLUŞTURULDU` : "SERBEST SAYIM MODU"}</span>
                <span className="text-[14px] sm:text-[16px] font-black tracking-widest uppercase flex items-center gap-2 w-full"><span className="text-white truncate" title={routeDisplay}>{routeDisplay}</span></span>
              </div>
            </div>
            
            <div className="flex flex-col text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 border-slate-700 pt-3 sm:pt-0 shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Toplam Okunan</span>
              <div className="flex items-end gap-2 sm:justify-end">
                <span className={`text-[24px] font-black leading-none text-emerald-400`}>{totalScanned}</span>
                <span className="text-slate-500 text-[14px] font-bold">ADET</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-2 sm:p-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 z-10 overflow-hidden">
            
            {/* SOL: OKUMA MOTORU */}
            <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0 overflow-y-auto lg:overflow-visible pb-4 lg:pb-0">
              {!savedCode && (
                <>
                  <div className="flex bg-white border border-slate-200 p-1.5 rounded-sm shadow-sm">
                    <button onClick={() => setActiveTab('terminal')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'terminal' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><ScanLine size={16} /> Terminal</button>
                    <button onClick={() => setActiveTab('camera')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'camera' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Smartphone size={16} /> Kamera</button>
                  </div>

                  <div className="bg-white p-4 shadow-md border border-slate-200 flex flex-col gap-4 relative">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setScanMode('add'); setTimeout(() => scanInputRef.current?.focus(), 50); }} className={`flex-1 flex items-center justify-center gap-2 py-3 font-black uppercase tracking-widest text-[12px] transition-all border-2 ${scanMode === 'add' ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}><PlusCircle size={16}/> EKLE</button>
                      <button type="button" onClick={() => { setScanMode('remove'); setTimeout(() => scanInputRef.current?.focus(), 50); }} className={`flex-1 flex items-center justify-center gap-2 py-3 font-black uppercase tracking-widest text-[12px] transition-all border-2 ${scanMode === 'remove' ? 'bg-red-50 text-[#dc3545] border-red-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}><MinusCircle size={16}/> İPTAL ET</button>
                    </div>

                    {activeTab === 'terminal' ? (
                      <form onSubmit={handleTerminalScan} className="flex flex-col gap-2">
                        <input ref={scanInputRef} type="text" value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="BARKOD OKUTUN" disabled={isProcessing} className={`w-full text-center font-black text-[24px] uppercase p-4 border-2 focus:outline-none tracking-widest transition-colors shadow-inner disabled:opacity-50 ${scanMode === 'add' ? 'bg-white text-slate-900 border-slate-300 focus:border-emerald-500 placeholder:text-slate-300' : 'bg-red-50 text-[#dc3545] border-red-200 focus:border-[#dc3545] placeholder:text-red-200'}`} />
                        <button type="submit" className="hidden" /> 
                      </form>
                    ) : (
                      <div id="reader" className={`w-full bg-slate-50 border-2 overflow-hidden min-h-[250px] ${scanMode === 'add' ? 'border-slate-300' : 'border-red-400'}`} />
                    )}

                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 mt-2">
                      <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12}/> Adet Seçimi (Çarpan)</span>
                      <div className="flex flex-wrap gap-2 mb-1">
                        {qtyButtons.map(qty => (
                          <button key={qty} type="button" onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 50); }} className={`flex-1 min-w-[44px] py-3 text-[14px] font-black transition-all border-2 rounded-sm ${selectedQty === qty ? (scanMode === 'add' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-[#dc3545] border-[#dc3545] text-white shadow-md') : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{qty}</button>
                        ))}
                      </div>
                      <div className={`flex items-center gap-3 border-2 p-2 rounded-sm transition-colors w-full overflow-hidden ${scanMode === 'add' ? 'bg-emerald-50/50 border-slate-200 focus-within:border-emerald-500' : 'bg-red-50/50 border-slate-200 focus-within:border-[#dc3545]'}`}>
                        <span className="text-slate-600 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel:</span>
                        <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} className="flex-1 bg-transparent text-slate-900 font-black text-[22px] text-right focus:outline-none pr-2 min-w-0 w-full" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ANLIK OKUNAN ÜRÜN */}
              <div className="bg-white border border-slate-200 shadow-md p-5 flex flex-col items-center text-center gap-4 relative overflow-hidden flex-1">
                <div className={`absolute top-0 w-full h-1.5 ${lastScanned?.type === 'remove' ? 'bg-[#dc3545]' : 'bg-[#0f172b]'}`} />
                {lastScanned ? (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-slate-200 p-2 shadow-sm rounded-md mb-4">
                      {lastScanned.product.image_url ? <img src={lastScanned.product.image_url} alt="Urun" className="w-full h-full object-contain" /> : <Package size={40} className="text-slate-300 w-full h-full" />}
                    </div>
                    <div className="flex flex-col gap-1 w-full border-b border-slate-100 pb-4 mb-4">
                      <span className="text-[13px] font-black text-[#dc3545] tracking-widest uppercase truncate">{lastScanned.product.barcode}</span>
                      <span className="text-[12px] sm:text-[14px] font-bold text-slate-800 line-clamp-2 leading-tight">{lastScanned.product.name}</span>
                    </div>
                    <div className="w-full bg-slate-50 p-3 border border-slate-200 flex justify-between items-center rounded-sm">
                      <span className={`text-[11px] sm:text-[12px] font-black uppercase tracking-widest ${lastScanned.type === 'remove' ? 'text-[#dc3545]' : 'text-emerald-600'}`}>
                        {lastScanned.type === 'remove' ? `-${lastScanned.qtyChange} İPTAL` : `+${lastScanned.qtyChange} EKLENDİ`}
                      </span>
                      <div className="flex flex-col text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Bu Üründen Toplam</span>
                        <span className="text-[20px] sm:text-[24px] font-black text-slate-900 leading-none mt-0.5">{lastScanned.currentTotal}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-300 gap-3 py-10 my-auto">
                    {savedCode ? <CheckCircle2 size={56} className="text-emerald-500"/> : <QrCode size={48} className="text-slate-200" />}
                    <span className="font-black text-[11px] text-slate-400 uppercase tracking-widest text-center px-4">
                      {savedCode ? "İşlem Tamamlandı. Evrak Oluşturuldu." : "İlk barkodu okutmanız bekleniyor"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SAĞ: ÜRÜN LİSTESİ */}
            <div className="flex-1 bg-white border border-slate-200 shadow-md flex flex-col overflow-hidden min-h-[400px]">
              <div className="bg-[#0f172b] px-4 py-3 flex justify-between items-center text-white shrink-0">
                <span className="text-[11px] font-black uppercase tracking-widest">Sayım Listesi Özeti</span>
                <span className="bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-widest border border-slate-700 rounded-sm shadow-sm">{scannedItems.length} Kalem</span>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-32 border-r border-slate-200">Barkod</th>
                      <th className="p-3 border-r border-slate-200">Ürün Adı</th>
                      <th className="p-3 w-24 text-center text-emerald-600 bg-emerald-50">Okunan</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px] font-bold text-slate-800 divide-y divide-slate-100">
                    {scannedItems.map((item) => (
                      <tr key={item.product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-r border-slate-100 overflow-hidden"><span className="tracking-widest uppercase truncate block text-slate-800">{item.product.barcode}</span></td>
                        <td className="p-3 border-r border-slate-100"><span className="line-clamp-2 text-[11px] leading-tight">{item.product.name}</span></td>
                        <td className="p-3 text-center bg-emerald-50/30"><span className="text-[16px] font-black text-emerald-600">{item.quantity}</span></td>
                      </tr>
                    ))}
                    {scannedItems.length === 0 && (
                      <tr><td colSpan={3} className="p-8 text-center text-slate-400 text-[12px] font-black uppercase tracking-widest">Liste Boş</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col gap-3">
                {!savedCode ? (
                  <button onClick={saveToDatabase} disabled={totalScanned === 0 || isSaving} className="w-full bg-[#0f172b] disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-[12px] sm:text-[14px] p-4 sm:p-5 uppercase tracking-[0.1em] flex items-center justify-center gap-3 hover:bg-[#dc3545] transition-colors shadow-md active:scale-95 rounded-sm">
                    {isSaving ? <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"/> : <Printer size={20} />} İŞLEMİ BİTİR, KAYDET VE ETİKET YAZDIR
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => window.print()} className="bg-slate-900 text-white font-black text-[12px] p-4 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm rounded-sm"><Printer size={18} /> TEKRAR YAZDIR</button>
                    <button onClick={handleDownloadExcel} className="bg-emerald-600 text-white font-black text-[12px] p-4 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm rounded-sm"><FileSpreadsheet size={18} /> EXCEL (CSV) İNDİR</button>
                    <button onClick={() => window.location.reload()} className="col-span-1 sm:col-span-2 bg-white border-2 border-slate-300 text-slate-700 font-black text-[12px] p-4 uppercase tracking-widest hover:border-[#dc3545] hover:text-[#dc3545] transition-colors rounded-sm">YENİ SAYIM BAŞLAT</button>
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
            <p className="text-[14px] font-black mt-1 uppercase tracking-widest bg-black text-white py-1 inline-block px-4">{savedStatus === 'Yolda' ? 'GİDEN TRANSFER RAPORU' : 'MAL KABUL / SAYIM RAPORU'}</p>
          </div>
          <div className="flex flex-col gap-1.5 border-b-2 border-black pb-2 mb-2 text-[12px] font-bold uppercase shrink-0">
            <div className="flex justify-between items-end"><span className="text-gray-600">EVRAK KODU:</span> <span className="text-[18px] font-black leading-none">{savedCode || "KAYDEDİLMEMİŞ TASLAK"}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">TARİH:</span> <span>{new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">OPERATÖR:</span> <span>{empName}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">ROTA:</span> <span className="text-right truncate max-w-[60mm]">{routeDisplay}</span></div>
          </div>
          <div className="border-2 border-black p-2 mb-2 flex justify-center items-center text-center shrink-0 bg-gray-100">
            <div className="flex flex-col"><span className="text-[10px] text-gray-600 font-bold uppercase">Toplam Okunan Ürün</span><span className="text-[20px] font-black">{totalScanned} ADET</span></div>
          </div>
          <div className="flex-1 overflow-hidden mt-2">
            <table className="w-full text-left text-[10px] font-bold uppercase border-collapse">
              <thead><tr className="border-b border-black"><th className="py-1">Barkod</th><th className="py-1">Ürün Tanımı</th><th className="py-1 text-center">Okunan</th></tr></thead>
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