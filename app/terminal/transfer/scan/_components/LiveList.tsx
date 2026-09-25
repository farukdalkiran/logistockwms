"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { TransferItem } from "@/app/actions/useTransferScan";

interface LiveListProps {
  transferItems: TransferItem[];
  mode: 'outbound' | 'inbound' | null;
  isFlexibleOutbound: boolean;
  totalScanned: number;
  isProcessing: boolean;
  handleCompleteAndPrint: () => void;
}

export default function LiveList({ transferItems, mode, isFlexibleOutbound, totalScanned, isProcessing, handleCompleteAndPrint }: LiveListProps) {
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 1500); 
  };

  return (
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
  );
}