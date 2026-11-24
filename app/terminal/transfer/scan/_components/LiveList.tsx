"use client";

import { useState } from "react";
import { Check, Copy, Printer, FileSpreadsheet } from "lucide-react";
import { TransferItem } from "@/app/actions/useTransferScan";

interface LiveListProps {
  transferItems: TransferItem[];
  mode: 'outbound' | 'inbound' | null;
  isFlexibleOutbound: boolean;
  totalScanned: number;
  isProcessing: boolean;
  handleCompleteAndPrint: () => void;
  handleDownloadExcel: () => void;
  finished: boolean;
  isSpectator: boolean;
  reportError: string;
  onReset: () => void;
}

export default function LiveList({ transferItems, mode, isFlexibleOutbound, totalScanned, isProcessing, handleCompleteAndPrint, handleDownloadExcel, finished, isSpectator, reportError, onReset }: LiveListProps) {
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 1500); 
  };

  const scannedTypes = transferItems.filter(item => (mode === "outbound" ? item.sent_qty : item.received_qty) > 0).length;

  return (
    <div className="flex-1 bg-white border border-slate-200 shadow-md rounded-md flex flex-col overflow-hidden min-h-[400px]">
      <div className="bg-[#0f172b] px-4 py-3 flex justify-between items-center text-white shrink-0">
        <span className="text-sm font-black">{finished ? "Sayım tamamlandı" : "Canlı sayım listesi"}</span>
        <span className="text-xs font-bold text-slate-300">{scannedTypes} / {transferItems.length} kalem</span>
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
                      <button type="button" onClick={() => handleCopyBarcode(item.products.barcode)} className={`flex items-center gap-1 transition-colors p-1.5 rounded-md shrink-0 border ${isCopied ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`} title="Barkodu Kopyala">
                        {isCopied ? <Check size={12} strokeWidth={3}/> : <Copy size={12} />}
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
      
      <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
        <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 p-3 shadow-sm">
          <div className="flex items-center gap-2 text-slate-800 font-black text-sm"><FileSpreadsheet size={19} className="text-emerald-700" /> {finished ? "Nihai sayım raporu" : "Ara sayım raporu"}</div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{finished ? "Tüm ürünler ve net sayım adetleri. Teslim alan mağaza için boş adet sütunu." : "Bu Excel sadece şimdiye kadar okutulan verileri içermektedir. Nihai liste değildir."}</p>
          <button type="button" onClick={handleDownloadExcel} disabled={isProcessing || (finished ? transferItems.length === 0 : totalScanned === 0)} className="mt-3 w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-sm px-4 py-3 flex items-center justify-center gap-2 rounded-sm"><FileSpreadsheet size={18} /> {finished ? "Nihai Excel indir" : "Okutulanları Excel indir"} · A4</button>
        </div>
        {reportError && <p role="alert" className="text-xs font-bold text-red-700">{reportError}</p>}
        {finished ? <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => window.print()} className="border border-slate-300 bg-white py-3 text-xs font-bold flex items-center justify-center gap-2"><Printer size={16}/> Etiketi yazdır</button><button type="button" onClick={onReset} className="bg-slate-900 text-white py-3 text-xs font-bold">Yeni sayım</button></div> : !isSpectator && (
        <button 
          onClick={handleCompleteAndPrint}
          disabled={totalScanned === 0 || isProcessing}
          className="w-full bg-[#0f172b] disabled:bg-slate-300 text-white font-black text-[12px] sm:text-[14px] p-3.5 uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#dc3545] transition-colors shadow-sm active:scale-95 rounded-md"
        >
          <Printer size={20} /> BİTİR VE YAZDIR
        </button>)}
      </div>
    </div>
  );
}