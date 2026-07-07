"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  X, FileSpreadsheet, PackageOpen, Image as ImageIcon, 
  ArrowRight, CalendarDays, BarChart, MapPin, 
  CheckCircle2, AlertTriangle, Layers, Hash, QrCode
} from "lucide-react";
import type { Transfer } from "../page"; 

interface Props {
  transfer: Transfer;
  branchMap: Record<string, string>;
  onClose: () => void;
}

type TransferItemDetail = {
  id: string;
  requested_qty: number;
  sent_qty: number;
  received_qty: number;
  products: {
    barcode: string;
    sku: string | null;
    name: string;
    image_url: string | null;
  } | null;
};

export default function TransferDetailModal({ transfer, branchMap, onClose }: Props) {
  const [items, setItems] = useState<TransferItemDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Veritabanı Sorgusu (Tüm miktarlar %100 Dinamik Çekilir)
  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transfer_items")
      .select(`
        id,
        requested_qty,
        sent_qty,
        received_qty,
        products (
          barcode,
          sku,
          name,
          image_url
        )
      `)
      .eq("transfer_id", transfer.id)
      .order("id", { ascending: true }); 

    if (error) {
      console.error("Transfer içerik sorgu hatası:", error.message || error);
    } else if (data) {
      setItems(data as unknown as TransferItemDetail[]);
    }
    setLoading(false);
  }, [transfer.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Excel / CSV İndirme Motoru
  const handleDownloadExcel = () => {
    if (items.length === 0) return;

    const headers = ["Sira", "Barkod", "SKU", "Urun Adi", "Talep_Edilen", "Gonderilen", "Teslim_Alinan"];
    
    const csvRows = items.map((item, index) => {
      const rowNum = index + 1;
      const barcode = item.products?.barcode || "BARKOD_YOK";
      const sku = item.products?.sku || "-";
      const name = `"${(item.products?.name || "İsimsiz Ürün").replace(/"/g, '""')}"`; 
      const reqQty = item.requested_qty || 0;
      const sentQty = item.sent_qty || 0;
      const recQty = item.received_qty || 0;
      
      return `${rowNum};${barcode};${sku};${name};${reqQty};${sentQty};${recQty}`;
    });

    const csvContent = "sep=;\n" + headers.join(";") + "\n" + csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `LS_URUN_LISTESI_${transfer.transfer_code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fromName = branchMap[transfer.from_branch_id] || "Bilinmeyen Çıkış";
  const toName = branchMap[transfer.to_branch_id] || "Bilinmeyen Hedef";
  
  const stats = useMemo(() => {
    let totalReq = 0;
    let totalSent = 0;
    let totalRec = 0;
    items.forEach(i => {
      totalReq += i.requested_qty || 0;
      totalSent += i.sent_qty || 0;
      totalRec += i.received_qty || 0;
    });
    return { totalReq, totalSent, totalRec, uniqueItems: items.length };
  }, [items]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-6 animate-in fade-in duration-200">
      
      {/* MODAL CONTAINER */}
      <div className="bg-slate-100 w-full max-w-7xl h-[95vh] flex flex-col shadow-2xl border border-slate-700 overflow-hidden shadow-black">
        
        {/* DARK-INDUSTRIAL MODAL BAŞLIĞI */}
        <div className="bg-[#0f172b] px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center border-b-4 border-[#dc3545] shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#dc3545] p-2 flex items-center justify-center">
              <PackageOpen size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white text-lg sm:text-xl font-black uppercase tracking-widest leading-none mb-1 truncate">
                Transfer Ürün Listesi
              </h2>
              <div className="text-slate-400 text-[11px] font-bold tracking-widest flex items-center gap-2">
                <span className="text-slate-300">REF:</span>
                <span className="bg-slate-800 px-2 py-0.5 border border-slate-700 text-white flex items-center gap-1 shrink-0">
                  <Hash size={12}/>
                  {transfer.transfer_code}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-[#dc3545] p-2 border border-slate-700 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center group shrink-0 ml-2"
            title="Kapat"
          >
            <X size={24} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* OPERASYONEL ÖZET (KPI) KARTLARI */}
        <div className="bg-white border-b border-slate-300 p-4 shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shadow-sm z-10">
          
          <div className="bg-slate-50 border border-slate-200 p-3 flex flex-col justify-between min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2">
              <MapPin size={14} className="text-[#dc3545] shrink-0" /> Transfer Rotası
            </span>
            <div className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-800 min-w-0">
              <div className="flex items-center gap-2 overflow-hidden"><span className="w-10 text-slate-400 text-[10px] uppercase shrink-0">ÇIKIŞ</span> <span className="truncate">{fromName}</span></div>
              <div className="flex items-center gap-2 overflow-hidden"><span className="w-10 text-slate-400 text-[10px] uppercase shrink-0">HEDEF</span> <span className="truncate">{toName}</span></div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 flex flex-col justify-between min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2">
              <CalendarDays size={14} className="text-slate-500 shrink-0" /> Operasyon Bilgisi
            </span>
            <div className="flex justify-between items-end gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-slate-900 font-bold text-[13px] truncate">{new Date(transfer.created_at).toLocaleDateString("tr-TR")}</span>
                <span className="text-slate-400 text-[11px] font-medium">{new Date(transfer.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <span className={`px-2 py-1 text-[10px] font-black uppercase border tracking-widest shrink-0
                ${transfer.status === 'Tamamlandi' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 
                  transfer.status === 'Iptal' ? 'bg-red-100 text-red-800 border-red-300' : 
                  'bg-amber-100 text-amber-800 border-amber-300'}`}>
                {transfer.status}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 flex flex-col justify-between min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2">
              <Layers size={14} className="text-indigo-500 shrink-0" /> Toplam Hacim
            </span>
            <div className="flex justify-between items-center text-[13px] font-black">
              <div className="flex flex-col items-center border-r border-slate-300 pr-4 w-1/2">
                <span className="text-slate-900 text-lg leading-none">{stats.uniqueItems}</span>
                <span className="text-[9px] text-slate-400 uppercase tracking-widest text-center mt-1">Çeşit</span>
              </div>
              <div className="flex flex-col items-center pl-4 w-1/2">
                <span className="text-indigo-600 text-lg leading-none">{stats.totalReq}</span>
                <span className="text-[9px] text-slate-400 uppercase tracking-widest text-center mt-1">Adet Ürün</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center min-w-0">
            <button 
              onClick={handleDownloadExcel}
              disabled={loading || items.length === 0}
              className="h-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white flex flex-col items-center justify-center gap-1 p-3 text-[11px] font-black uppercase tracking-widest transition-colors shadow-sm active:scale-95"
            >
              <FileSpreadsheet size={24} className="mb-1 shrink-0" /> 
              <span className="text-center">Excel'e Aktar (CSV)</span>
              <span className="text-[9px] text-emerald-200 font-medium tracking-normal normal-case text-center">Kolonlara ayrılmış detaylı liste</span>
            </button>
          </div>

        </div>

        {/* DETAYLI ÜRÜN LİSTESİ (STABİL TABLO ALANI) */}
        <div className="flex-1 overflow-y-auto overflow-x-auto bg-slate-200 p-4">
          <div className="bg-white border border-slate-300 shadow-md">
            {loading ? (
              <div className="h-64 flex flex-col gap-3 items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">
                <BarChart size={32} className="text-slate-300" />
                Transfer dataları çözümleniyor...
              </div>
            ) : items.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 m-4 border-2 border-dashed border-slate-300">
                <PackageOpen size={32} className="mb-2 text-slate-300" />
                <span className="font-bold uppercase tracking-widest text-xs">Bu transfere atanmış ürün detayı bulunamadı.</span>
              </div>
            ) : (
              /* Taşmayı engelleyen table-fixed ve min-w kuralları uygulandı */
              <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
                <thead className="bg-[#0f172b] text-slate-300 text-[10px] sm:text-[11px] uppercase tracking-widest top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 w-12 text-center border-r border-slate-800">#</th>
                    <th className="p-3 w-16 text-center border-r border-slate-800">Görsel</th>
                    <th className="p-3 w-48 border-r border-slate-800">Ürün Kimliği</th>
                    <th className="p-3 w-auto border-r border-slate-800">Ürün Adı & Tanımı</th>
                    <th className="p-3 w-24 text-center border-r border-slate-800 bg-slate-800/50">Talep</th>
                    <th className="p-3 w-24 text-center border-r border-slate-800 bg-blue-900/20 text-blue-300">Gönderilen</th>
                    <th className="p-3 w-24 text-center bg-emerald-900/20 text-emerald-300">Teslim</th>
                  </tr>
                </thead>
                <tbody className="text-[12px] sm:text-[13px] font-medium text-slate-800">
                  {items.map((item, idx) => {
                    const product = item.products;
                    // Hata Tespiti Lojiği: Teslim alınan, gönderilenden azsa eksik ürün vardır.
                    const isMissing = (item.sent_qty || 0) > (item.received_qty || 0);
                    
                    return (
                      <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        
                        <td className="p-3 text-center font-black text-slate-400 border-r border-slate-200 bg-slate-50/50">
                          {idx + 1}
                        </td>
                        
                        <td className="p-2 border-r border-slate-200">
                          <div className="w-12 h-12 mx-auto bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                            {product?.image_url ? (
                              <img src={product.image_url} alt="Ürün" className="w-full h-full object-cover hover:scale-125 transition-transform duration-300" />
                            ) : (
                              <ImageIcon size={18} className="text-slate-300" />
                            )}
                          </div>
                        </td>

                        <td className="p-3 border-r border-slate-200 overflow-hidden">
                          <div className="flex items-start gap-2">
                            <QrCode size={14} className="text-[#dc3545] shrink-0 mt-0.5" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-black text-[#dc3545] tracking-widest uppercase text-[13px] break-all">
                                {product?.barcode || "TANIMSIZ"}
                              </span>
                              {product?.sku && (
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5 truncate">
                                  SKU: {product.sku}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-3 border-r border-slate-200">
                          <div className="font-bold leading-snug text-[13px] text-slate-900 line-clamp-3 break-words" title={product?.name}>
                            {product?.name || "Bilinmeyen Ürün"}
                          </div>
                        </td>

                        {/* Miktarlar (Dinamik Veriler) */}
                        <td className="p-3 text-center border-r border-slate-200 bg-slate-50">
                          <span className="font-black text-slate-900 text-[15px]">{item.requested_qty || 0}</span>
                        </td>
                        <td className="p-3 text-center border-r border-slate-200 bg-blue-50/30">
                          <span className="font-black text-blue-700 text-[15px]">{item.sent_qty || 0}</span>
                        </td>
                        <td className={`p-3 text-center ${isMissing ? 'bg-red-50/50' : 'bg-emerald-50/30'}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`font-black text-[15px] ${isMissing ? 'text-red-600' : 'text-emerald-700'}`}>
                              {item.received_qty || 0}
                            </span>
                            {isMissing ? (
                              <AlertTriangle size={14} className="text-red-500 shrink-0" title="Eksik Teslimat!" />
                            ) : (
                              <CheckCircle2 size={14} className="text-emerald-500 opacity-50 shrink-0" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}