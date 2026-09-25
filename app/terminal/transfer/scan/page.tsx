"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChevronLeft, TerminalSquare, UserCircle, MapPin, Database, QrCode, AlertTriangle } from "lucide-react";
import { useTransferScan } from "@/app/actions/useTransferScan";

import ProgressPanel from "./_components/ProgressPanel";
import ScannerEngine from "./_components/ScannerEngine";
import LiveList from "./_components/LiveList";

export default function TransferScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube Terminali";
  
  const initialSpectator = searchParams.get("viewOnly") === "true";
  const [isSpectator, setIsSpectator] = useState(initialSpectator);
  
  // YENİ: Otomatik Rol Çekme State'i
  const [userRole, setUserRole] = useState("user");

  const scanInputRef = useRef<HTMLInputElement>(null);
  const [transferCodeInput, setTransferCodeInput] = useState("");

  const {
    branchId, activeTransfer, setActiveTransfer, transferItems, setTransferItems,
    mode, lastScanned, setLastScanned, recentLogs, isFetching, isProcessing, setIsProcessing,
    flashState, errorMsg, startTransferScan, processBarcode, flushPendingSync
  } = useTransferScan(empId, branchName, isSpectator);

  // YENİ: Veritabanından pozisyonu (rolü) otomatik çekme
  useEffect(() => {
    const fetchEmployeeRole = async () => {
      if (empId && empId !== "BİLİNMİYOR") {
        const { data, error } = await supabase
          .from("employees")
          .select("position_title")
          .eq("id", empId)
          .single();
        
        if (data?.position_title) {
          setUserRole(data.position_title);
        }
      }
    };
    fetchEmployeeRole();
  }, [empId]);

  const forceFocus = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'A') return;
    if (activeTransfer && !isSpectator) scanInputRef.current?.focus();
  };

  const handleBack = async () => {
    if (activeTransfer && !isSpectator) {
      setIsProcessing(true);
      await flushPendingSync();
    }
    router.back();
  };

  const onSubmitStart = (e: React.FormEvent) => {
    e.preventDefault();
    startTransferScan(transferCodeInput.trim().toUpperCase());
  };

  const handleCompleteAndPrint = async () => {
    if (!activeTransfer || isSpectator) return;
    setIsProcessing(true);
    await flushPendingSync(); 

    const isMNS = activeTransfer.transfer_code.startsWith("MNS");
    const newStatus = (isMNS || mode === 'inbound') ? 'Tamamlandi' : 'Yolda';
    await supabase.from("transfers").update({ status: newStatus }).eq("id", activeTransfer.id);
    if (newStatus === 'Tamamlandi') await supabase.from("transfer_items").update({ status: 'Tamamlandi' }).eq("transfer_id", activeTransfer.id);

    await supabase.from("transaction_logs").insert({
      employee_id: empId, branch_id: branchId,
      action_type: isMNS ? "MNS_COUNT_COMPLETE" : (mode === 'outbound' ? "TRANSFER_OUTBOUND_COMPLETE" : "TRANSFER_INBOUND_COMPLETE"),
      description: `${activeTransfer.transfer_code} kodlu ${isMNS ? 'serbest sayım' : (mode === 'outbound' ? 'çıkış' : 'giriş')} tamamlandı.`
    });
    
    setIsProcessing(false);
    window.print();
    setTimeout(() => { setActiveTransfer(null); setTransferItems([]); setLastScanned(null); }, 1000);
  };

  const isMNS = activeTransfer?.transfer_code.startsWith("MNS");
  const isFlexibleOutbound = isMNS && mode === 'outbound';
  const totalReq = transferItems.reduce((acc, i) => acc + (isFlexibleOutbound ? Math.max(i.requested_qty, i.sent_qty) : (mode === 'outbound' ? i.requested_qty : i.sent_qty)), 0);
  const totalScanned = transferItems.reduce((acc, i) => acc + (mode === 'outbound' ? i.sent_qty : i.received_qty), 0);
  const totalMissing = Math.max(0, totalReq - totalScanned);

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col antialiased select-none print:bg-white" onClick={forceFocus}>
      <style dangerouslySetInnerHTML={{__html: `@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}} />

      {/* HEADER BÖLÜMÜ */}
      <div className="bg-[#0f172b] border-b border-slate-800 shadow-md shrink-0 z-50 print:hidden relative overflow-hidden">
        <div className="flex flex-col sm:flex-row max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 w-full relative z-10">
           <div className="flex items-center gap-4 py-4 sm:pr-6 border-b sm:border-b-0 sm:border-r border-slate-800/80 sm:w-[30%]">
             <button onClick={handleBack} className="text-slate-400 hover:text-white p-2.5 bg-slate-800/60 hover:bg-[#dc3545] transition-all rounded-md shrink-0 border border-slate-700/50">
               <ChevronLeft size={20} strokeWidth={2.5} />
             </button>
             <div className="flex flex-col justify-center">
               <div className="flex items-center gap-2"><TerminalSquare size={16} className="text-[#dc3545] shrink-0" strokeWidth={2.5} /><span className="text-white text-[16px] font-black uppercase tracking-[0.15em] leading-none">LogiStock</span></div>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{isSpectator ? 'İzleyici Terminali' : 'WMS Sayım Motoru'}</span>
             </div>
           </div>
           <div className="flex flex-1 items-center py-3 sm:py-0 sm:pl-6">
             <div className="flex w-full items-stretch justify-center sm:justify-end gap-2 sm:gap-6">
                <div className="flex flex-col justify-center items-center sm:items-end pr-4 sm:pr-6 border-r border-slate-800/80">
                   <div className="flex items-center gap-1.5 mb-0.5"><UserCircle size={12} className="text-slate-400" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AKTİF OPERATÖR</span></div>
                   <span className="text-[13px] font-black text-white uppercase tracking-wider truncate">{empName}</span>
                </div>
                <div className="flex flex-col justify-center items-center sm:items-end pr-4 sm:pr-6 border-r border-slate-800/80">
                   <div className="flex items-center gap-1.5 mb-0.5"><MapPin size={12} className="text-[#dc3545]" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">LOKASYON</span></div>
                   <span className="text-[13px] font-black text-[#dc3545] uppercase tracking-wider truncate">{branchName}</span>
                </div>
                <div className="flex flex-col justify-center items-center sm:items-end">
                   <div className="flex items-center gap-1.5 mb-0.5"><Database size={12} className="text-emerald-500" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">DURUM</span></div>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 animate-pulse rounded-full shadow-[0_0_8px_#10b981]"></div>
                     <span className="text-[13px] font-black text-emerald-400 uppercase tracking-wider">AKTİF</span>
                   </div>
                </div>
             </div>
           </div>
        </div>
      </div>

      {/* SAYIM BAŞLATMA */}
      {!activeTransfer && (
        <div className="flex-1 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white p-8 border border-slate-300 shadow-xl max-w-md w-full flex flex-col gap-6 relative overflow-hidden rounded-md">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-slate-900 to-[#dc3545]"></div>
            <div className="flex flex-col items-center text-center gap-2 mb-2">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-md text-slate-800"><QrCode size={40} /></div>
              <h2 className="text-[18px] font-black uppercase text-slate-800 tracking-widest mt-2">{isSpectator ? "Evrak Takibi Başlat" : "Sayıma Başla"}</h2>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                Sevkiyat veya Mal Kabul işlemi için <strong className="text-slate-800">LGS</strong> kodunu, serbest sayım için <strong className="text-slate-800">MNS</strong> kodunu giriniz.
              </p>
            </div>
            <form onSubmit={onSubmitStart} className="flex flex-col gap-4">
              <input type="text" autoFocus placeholder="Örn: LGS1024" value={transferCodeInput} onChange={e => setTransferCodeInput(e.target.value)} disabled={isFetching} className="w-full text-center font-black text-[24px] uppercase p-4 border-2 border-slate-300 focus:outline-none focus:border-[#dc3545] tracking-widest bg-slate-50 text-slate-900 rounded-md disabled:opacity-50 transition-colors" />
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
          <div className={`pointer-events-none fixed inset-0 z-40 transition-colors duration-300 ${flashState === 'success' ? 'bg-emerald-500/20' : flashState === 'error' ? 'bg-red-600/40' : 'bg-transparent'}`} />
          {errorMsg && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-4 sm:px-6 py-4 font-black text-[12px] sm:text-[14px] tracking-widest uppercase shadow-2xl border-2 border-red-900 rounded-md animate-in slide-in-from-top-10 flex items-center gap-3 w-[95%] max-w-md text-center">
              <AlertTriangle size={24} className="shrink-0" /> {errorMsg}
            </div>
          )}

          <ProgressPanel 
            activeTransfer={activeTransfer} 
            transferItems={transferItems} 
            mode={mode} 
            isMNS={isMNS} 
            userRole={userRole} // <--- BURASI ARTIK DB'DEN GELİYOR
            isSpectator={isSpectator}
            onToggleSpectator={() => setIsSpectator(!isSpectator)}
          />

          <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 flex flex-col lg:flex-row gap-4 sm:gap-6 z-10 overflow-hidden">
            <ScannerEngine 
              isSpectator={isSpectator} 
              activeTransfer={activeTransfer} 
              lastScanned={lastScanned} 
              recentLogs={recentLogs}
              isFlexibleOutbound={isFlexibleOutbound} 
              processBarcode={processBarcode} 
              scanInputRef={scanInputRef} 
            />
            <LiveList 
              transferItems={transferItems} 
              mode={mode} 
              isFlexibleOutbound={isFlexibleOutbound} 
              totalScanned={totalScanned} 
              isProcessing={isProcessing} 
              handleCompleteAndPrint={handleCompleteAndPrint} 
            />
          </div>
        </div>
      )}

      {/* ZEBRA ZD230 RAPOR ŞABLONU (ORİJİNAL) */}
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: 100mm 150mm; margin: 0; } body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; } .print-container { width: 100mm; height: 148mm; padding: 4mm; box-sizing: border-box; background: white; color: black; font-family: sans-serif; display: flex; flex-direction: column; } }`}} />
      
      {activeTransfer && (
        <div className="hidden print:flex print-container">
          <div className="text-center border-b-4 border-black pb-2 mb-2 shrink-0">
            <h1 className="text-[24px] font-black uppercase m-0 leading-none tracking-widest">LOGISTOCK | WMS</h1>
            <p className="text-[14px] font-black mt-1 uppercase tracking-widest bg-black text-white py-1 inline-block px-4">
              {isMNS ? 'SERBEST SAYIM (MNS) RAPORU' : (mode === 'outbound' ? 'SAYIM RAPORU - SEVKİYAT' : 'SAYIM RAPORU - MAL KABUL')}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 border-b-2 border-black pb-2 mb-2 text-[12px] font-bold uppercase shrink-0">
            <div className="flex justify-between items-end"><span className="text-gray-600">SAYIM FİŞİ:</span> <span className="text-[18px] font-black leading-none">{activeTransfer.transfer_code}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">SAYIM TARİHİ:</span> <span>{new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">OPERATÖR:</span> <span>{empName}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">ROTA:</span> <span className="text-right truncate max-w-[60mm]">{activeTransfer.fromName} &rarr; {activeTransfer.toName}</span></div>
          </div>
          <div className="border-2 border-black p-2 mb-2 flex justify-between items-center text-center shrink-0">
            <div className="flex flex-col"><span className="text-[10px] text-gray-600 font-bold uppercase">Beklenen</span><span className="text-[16px] font-black">{isFlexibleOutbound ? 'Limitsiz' : totalReq}</span></div>
            <div className="flex flex-col border-l border-r border-gray-400 px-4"><span className="text-[10px] text-gray-600 font-bold uppercase">Okunan</span><span className="text-[16px] font-black">{totalScanned}</span></div>
            <div className="flex flex-col"><span className="text-[10px] text-gray-600 font-bold uppercase">Eksik</span><span className="text-[16px] font-black">{isFlexibleOutbound ? '0' : totalMissing}</span></div>
          </div>
          <div className="flex-1 overflow-hidden">
            <table className="w-full text-left text-[10px] font-bold uppercase border-collapse">
              <thead><tr className="border-b border-black"><th className="py-1">Barkod</th><th className="py-1">Ürün</th><th className="py-1 text-center">B/O</th></tr></thead>
              <tbody>
                {transferItems.filter(i => (mode === 'outbound' ? i.sent_qty : i.received_qty) > 0 || i.requested_qty > 0).map((item, idx) => {
                  const scanned = mode === 'outbound' ? item.sent_qty : item.received_qty;
                  const limit = isFlexibleOutbound ? scanned : (mode === 'outbound' ? item.requested_qty : item.sent_qty);
                  return (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="py-1.5 whitespace-nowrap">{item.products.barcode}</td>
                      <td className="py-1.5 truncate max-w-[40mm]">{item.products.name}</td>
                      <td className="py-1.5 text-center font-black text-[12px] whitespace-nowrap">{limit} / {scanned}</td>
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