"use client";

import { useState, useRef, useEffect } from "react";
import { ScanLine, Smartphone, AlertCircle, PlusCircle, MinusCircle, Edit3, Package, QrCode, Activity } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface ScannerEngineProps {
  isSpectator: boolean;
  activeTransfer: any;
  lastScanned: any;
  recentLogs: any[];
  isFlexibleOutbound: boolean;
  processBarcode: (barcode: string, scanMode: 'add'|'remove', qty: number) => void;
  // BURA DEĞİŞTİ: <HTMLInputElement> yerine <HTMLInputElement | null> yaptık
  scanInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function ScannerEngine({ isSpectator, activeTransfer, lastScanned, recentLogs, isFlexibleOutbound, processBarcode, scanInputRef }: ScannerEngineProps) {
  const [activeTab, setActiveTab] = useState<'terminal' | 'camera'>('terminal');
  const [scanMode, setScanMode] = useState<'add' | 'remove'>('add');
  const [scanInput, setScanInput] = useState("");
  const [selectedQty, setSelectedQty] = useState<number | string>(1);
  const qtyButtons = [1, 2, 3, 4, 5, 10];
  const lastCameraScanTime = useRef<number>(0);

  const handleTerminalScan = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = typeof selectedQty === 'string' ? parseInt(selectedQty) || 1 : selectedQty;
    processBarcode(scanInput, scanMode, qty);
    setScanInput("");
    setSelectedQty(1);
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    // İZLEYİCİ MODUNDA DEĞİLSE KAMERA AKTİF OLUR
    if (activeTransfer && activeTab === 'camera' && !isSpectator) {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 4, qrbox: { width: 250, height: 150 } }, 
        (decodedText) => {
           const now = Date.now();
           if (now - lastCameraScanTime.current < 2500) return;
           lastCameraScanTime.current = now;
           const qty = typeof selectedQty === 'string' ? parseInt(selectedQty) || 1 : selectedQty;
           processBarcode(decodedText, scanMode, qty);
           setSelectedQty(1);
        }, 
        (errorMessage) => { /* Yoksay */ }
      ).catch(err => console.error("Kamera başlatılamadı:", err));
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
    };
  }, [activeTransfer, activeTab, isSpectator, scanMode, selectedQty, processBarcode]);

const RenderLogFeed = () => (
    <div className="w-full bg-white rounded-xl p-4 flex flex-col gap-3 shadow-md border border-slate-200 h-[220px]">
      
      {/* BAŞLIK */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 shrink-0">
        <div className="bg-blue-100 p-1.5 rounded-md text-blue-600">
          <Activity size={14} strokeWidth={3} />
        </div>
        <span className="text-[11px] text-slate-700 font-black uppercase tracking-widest">
          Canlı Akış (Son 15)
        </span>
      </div>

      {/* LİSTE */}
      <div className="flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
        {!recentLogs || recentLogs.length === 0 ? (
          <span className="text-[12px] text-slate-400 font-bold text-center mt-4">Henüz işlem yapılmadı.</span>
        ) : (
          recentLogs.map((log, i) => {
            const isSuccess = log.status === 'SUCCESS';
            const isAdd = log.scan_type === 'ADD';

            // İşlem tipine göre renk temaları
            let itemClasses = "";
            let badgeClasses = "";
            let qtyText = "";

            if (!isSuccess) {
              itemClasses = "bg-red-50 border-red-100";
              badgeClasses = "bg-red-200 text-red-700";
              qtyText = "HATA";
            } else if (isAdd) {
              itemClasses = "bg-emerald-50 border-emerald-100";
              badgeClasses = "bg-emerald-200 text-emerald-800";
              qtyText = `+${log.scanned_qty}`;
            } else {
              itemClasses = "bg-orange-50 border-orange-100";
              badgeClasses = "bg-orange-200 text-orange-800";
              qtyText = `-${log.scanned_qty}`;
            }

            return (
              <div key={log.id || i} className={`flex items-center justify-between p-2 rounded-lg border ${itemClasses} shrink-0 transition-all`}>
                
                {/* SOL: Saat ve Barkod */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 bg-white/70 px-1.5 py-0.5 rounded shadow-sm">
                    {new Date(log.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`text-[13px] font-black tracking-wide ${!isSuccess ? 'text-red-400 line-through' : 'text-slate-800'}`}>
                    {log.barcode}
                  </span>
                </div>

                {/* SAĞ: Adet (Badge) */}
                <span className={`text-[12px] font-black px-2 py-0.5 rounded shadow-sm ${badgeClasses}`}>
                  {qtyText}
                </span>
                
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // İZLEYİCİ MODU EKRANI
  if (isSpectator) {
    return (
      <div className="w-full lg:w-[420px] bg-slate-900 border-2 border-blue-500/50 p-6 rounded-xl flex flex-col items-center justify-start text-center gap-4 shadow-xl shrink-0 h-max">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse shrink-0">
           <AlertCircle size={32} className="text-blue-400" />
        </div>
        <h3 className="text-white text-lg font-black uppercase tracking-widest">İzleyici Modu Aktif</h3>
        <p className="text-blue-300 text-[11px] font-bold">Sayım başka bir cihazdan yapılıyor. Buradan işlemi canlı takip edebilirsiniz.</p>
        
        {lastScanned && (
          <div className="mt-2 w-full bg-white rounded-md p-4 flex flex-col items-center gap-2 border-b-4 border-emerald-500 relative overflow-hidden shadow-lg shrink-0">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full mb-1">SON OKUTULAN</span>
            <span className="text-[20px] font-black text-slate-900 leading-none">{lastScanned.product.barcode}</span>
            <span className="text-[12px] font-bold text-slate-600 line-clamp-1">{lastScanned.product.name}</span>
            <span className={`mt-1 text-[14px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md ${lastScanned.type === 'remove' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {lastScanned.type === 'remove' ? `-${lastScanned.qtyChange} İPTAL` : `+${lastScanned.qtyChange} EKLENDİ`}
            </span>
          </div>
        )}

        <RenderLogFeed />
      </div>
    );
  }

  // NORMAL OPERATÖR EKRANI
  return (
    <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0 overflow-y-auto lg:overflow-visible pb-4 lg:pb-0">
      
      {/* SEKMELER */}
      <div className="flex bg-white border border-slate-200 p-1.5 rounded-md shadow-sm">
        <button onClick={() => setActiveTab('terminal')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all rounded-md ${activeTab === 'terminal' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <ScanLine size={16} /> Terminal
        </button>
        <button onClick={() => setActiveTab('camera')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-black uppercase tracking-widest transition-all rounded-md ${activeTab === 'camera' ? 'bg-[#0f172b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Smartphone size={16} /> Kamera
        </button>
      </div>

      {/* OKUTMA MOTORU */}
      <div className="bg-white p-4 shadow-md border border-slate-200 rounded-md flex flex-col gap-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => { setScanMode('add'); setTimeout(() => scanInputRef.current?.focus(), 100); }} className={`flex-1 flex items-center justify-center gap-2 py-3 font-black uppercase tracking-widest text-[12px] transition-all border-2 rounded-md ${scanMode === 'add' ? 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
            <PlusCircle size={16}/> EKLE
          </button>
          <button type="button" onClick={() => { setScanMode('remove'); setTimeout(() => scanInputRef.current?.focus(), 100); }} className={`flex-1 flex items-center justify-center gap-2 py-3 font-black uppercase tracking-widest text-[12px] transition-all border-2 rounded-md ${scanMode === 'remove' ? 'bg-red-50 text-[#dc3545] border-red-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
            <MinusCircle size={16}/> İPTAL ET
          </button>
        </div>

        {activeTab === 'terminal' ? (
          <form onSubmit={handleTerminalScan} className="flex flex-col gap-2">
            <input 
              ref={scanInputRef} type="text" value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="BARKOD OKUTUN"
              className={`w-full text-center font-black text-[24px] uppercase p-4 border-2 rounded-md focus:outline-none tracking-widest transition-colors shadow-inner ${scanMode === 'add' ? 'bg-slate-50 text-slate-900 border-slate-300 focus:border-emerald-500 placeholder:text-slate-300' : 'bg-red-50 text-[#dc3545] border-red-200 focus:border-[#dc3545] placeholder:text-red-200'}`}
            />
            <button type="submit" className="hidden" /> 
          </form>
        ) : (
          <div id="reader" className={`w-full bg-slate-50 border-2 rounded-md overflow-hidden min-h-[250px] ${scanMode === 'add' ? 'border-slate-300' : 'border-red-400'}`} />
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 mt-2">
          <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={12}/> Adet Seçimi (Çarpan)</span>
          <div className="flex flex-wrap gap-2 mb-1">
            {qtyButtons.map(qty => (
              <button key={qty} type="button" onClick={() => { setSelectedQty(qty); setTimeout(() => scanInputRef.current?.focus(), 100); }} className={`flex-1 min-w-[44px] py-3 text-[14px] font-black transition-all border-2 rounded-md ${selectedQty === qty ? (scanMode === 'add' ? 'bg-[#0F172A] border-[#0F172A] text-white shadow-md' : 'bg-[#dc3545] border-[#dc3545] text-white shadow-md') : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {qty}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-3 border-2 p-2 rounded-md transition-colors w-full overflow-hidden ${scanMode === 'add' ? 'bg-emerald-50/50 border-slate-200 focus-within:border-emerald-500' : 'bg-red-50/50 border-slate-200 focus-within:border-[#dc3545]'}`}>
            <span className="text-slate-600 text-[11px] font-black uppercase tracking-widest whitespace-nowrap pl-2 shrink-0">Manuel:</span>
            <input 
              type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} onFocus={e => e.target.select()}
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
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-slate-200 p-2 shadow-sm rounded-md shrink-0">
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

      {/* LOG EKRANI */}
      <RenderLogFeed />

    </div>
  );
}