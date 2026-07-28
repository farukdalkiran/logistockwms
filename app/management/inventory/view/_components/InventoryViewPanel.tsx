'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Loader2, Barcode, Box, Layers, Activity, FileSpreadsheet, Filter, ChevronLeft, ChevronRight, AlertTriangle,Database } from 'lucide-react';
import StockHistoryModal from './StockHistoryModal';
import { getAggregatedInventoryServer } from '@/app/actions/inventory'; 
import * as XLSX from 'xlsx';

type AggregatedProduct = {
  product_id: string; // Sunucudan gelen ID alanı bu şekilde garanti altındadır
  id?: string;
  name: string;
  sku: string | null;
  barcode: string;
  category: string | null;
  total_quantity: number;
  shelf_count: number;
  is_consumable: boolean;
  has_damaged_shelf: boolean;
};

export default function InventoryViewPanel({ branchId, isGlobal }: { branchId: string | null, isGlobal: boolean }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<AggregatedProduct[]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Rapor & Filtreleme
  const [reportFilter, setReportFilter] = useState<"ALL" | "COMMERCIAL" | "CONSUMABLE" | "DAMAGED" | "ACTIVE_SHELF" | "NO_STOCK">("ALL");
  
  // Sayfalama (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const [historyModalData, setHistoryModalData] = useState<{ productId: string, productName: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAllStock = async () => {
      try {
        const data = await getAggregatedInventoryServer("", branchId, isGlobal);
        setResults(data as any);
      } catch (err) {
        console.error("İlk Yükleme Hatası:", err);
      } finally {
        setIsInitialLoading(false);
        inputRef.current?.focus();
      }
    };
    fetchAllStock();
  }, [branchId, isGlobal]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setCurrentPage(1); 

    try {
      const aggregatedData = await getAggregatedInventoryServer(searchTerm, branchId, isGlobal);
      setResults(aggregatedData as any);
    } catch (err) {
      alert("Sorgulama sırasında bir hata oluştu.");
    } finally {
      setIsSearching(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearSearch = async () => {
    setSearchTerm("");
    setIsSearching(true);
    setCurrentPage(1);
    try {
      const data = await getAggregatedInventoryServer("", branchId, isGlobal);
      setResults(data as any);
    } finally {
      setIsSearching(false);
      inputRef.current?.focus();
    }
  };

  const filteredResults = useMemo(() => {
    return results.filter(item => {
      if (reportFilter === "COMMERCIAL") return item.is_consumable === false;
      if (reportFilter === "CONSUMABLE") return item.is_consumable === true;
      if (reportFilter === "DAMAGED") return item.has_damaged_shelf === true;
      if (reportFilter === "ACTIVE_SHELF") return item.shelf_count > 0 && !item.has_damaged_shelf;
      if (reportFilter === "NO_STOCK") return item.total_quantity === 0;
      return true; 
    });
  }, [results, reportFilter]);

  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredResults.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredResults, currentPage]);

  const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [reportFilter]);

  const handleExportExcel = () => {
    if (filteredResults.length === 0) return alert("Dışa aktarılacak veri bulunamadı.");

    const exportData = filteredResults.map(item => {
      let rafDurumuText = item.has_damaged_shelf ? "HASARLI RAF TESPİT EDİLDİ" : (item.shelf_count > 0 ? "Sağlam / Aktif" : "Raflanmadı");

      if (item.has_damaged_shelf) {
        rafDurumuText = "KISMİ VEYA AĞIR HASARLI RAF"; 
      }

      return {
        "Ürün Barkodu": item.barcode,
        "Ürün Kodu (SKU)": item.sku || "-",
        "Ürün Adı": item.name,
        "Kategori": item.category || "Tanımsız",
        "Tür": item.is_consumable ? "Sarf Malzeme" : "Ticari Ürün",
        "Raf Durumu": rafDurumuText,
        "Toplam Raflı Stok (Adet)": item.total_quantity
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stok_Raporu");
    
    worksheet['!cols'] = [ { wch: 18 }, { wch: 15 }, { wch: 45 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 20 } ];

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    XLSX.writeFile(workbook, `WMS_Stok_Raporu_${timestamp}.xlsx`);
  };

  if (isInitialLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-20 gap-4">
         <Loader2 size={40} className="animate-spin text-[#dc3545]" />
         <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Envanter Arşivi Derleniyor...</span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 animate-in fade-in duration-300">
      
{/* ========================================================= */}
      {/* 1. BİRLEŞİK HERO & KONTROL MERKEZİ (DARK-INDUSTRIAL) */}
      {/* ========================================================= */}
      <div className="w-full flex flex-col bg-slate-900 border border-slate-700 rounded-sm shadow-xl overflow-hidden mb-2 relative">
        
        {/* --- ÜST KISIM: GÖRSELLİ HERO ALANI --- */}
        <div className="relative w-full min-h-[200px] p-6 md:p-8 flex flex-col lg:flex-row justify-between gap-8">
          {/* Arka Plan Görseli ve Karartma */}
          <img 
            src="https://img.magnific.com/free-photo/spacious-warehouse-with-rows-shelves-forklift_84443-74085.jpg?t=st=1779108507~exp=1779112107~hmac=834c43fbd471b0766ff07fba31ef7c5cc6527409831e16ab7112e2dc4f5c9ac6&w=1480"
            alt="Inventory Management"
            className="absolute inset-0 w-full h-full object-cover opacity-[0.25] mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
          <div className="absolute right-0 top-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          
          {/* Sol Alan: Başlık ve Sistem Bilgi Kartı */}
          <div className="relative z-10 flex flex-col gap-5 w-full lg:max-w-2xl justify-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#dc3545] border border-red-400/50 rounded-sm shadow-[0_0_20px_rgba(220,53,69,0.3)]">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Canlı Stok ve Raf İzleme</h1>
                <p className="text-[#dc3545] text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-0.5">Real-Time Envanter Sorgu Merkezi</p>
              </div>
            </div>

            {/* Endüstriyel Info Kartı */}
            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 border-l-4 border-l-[#dc3545] p-4 rounded-sm flex gap-3 items-start shadow-inner">
              <Activity className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <h4 className="text-slate-200 text-[10px] font-black uppercase tracking-widest">Arama ve Log Bilgilendirmesi</h4>
                <p className="text-slate-400 text-[11px] font-semibold leading-relaxed">
                  Bu panel, bulunduğunuz şubedeki (veya global yetkideki) ürün stoklarını canlı listeler. Barkod/SKU ile arama yapabilir, stoku "0" olanları görebilir ve <strong className="text-slate-200">Mevcut Stok</strong> rakamlarına tıklayarak detaylı <strong className="text-slate-200">Raf Geçmiş Loglarını</strong> izleyebilirsiniz.
                </p>
              </div>
            </div>
          </div>

          {/* Sağ Alan: Statü Paneli */}
          <div className="relative z-10 w-full lg:w-72 flex flex-col justify-center">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-5 rounded-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Envanter Veri Motoru</label>
                <span className="flex items-center gap-1.5 text-[9px] font-black text-green-400 uppercase tracking-widest">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Aktif
                </span>
              </div>
              <div className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-slate-950 border border-slate-800 text-slate-300 rounded-sm text-[10px] font-black uppercase tracking-widest shadow-inner">
                <Database size={14} className="text-emerald-500" />
                Yetki: {isGlobal ? 'Global / Merkez' : 'Şube İçi İzole'}
              </div>
            </div>
          </div>
        </div>

        {/* --- ORTA KISIM: WMS ÇIKTI VE FİLTRELEME (DARK BAR) --- */}
        <div className="relative z-20 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 px-6 py-4 bg-[#0a101d]/80 border-t border-b border-slate-800 backdrop-blur-sm">
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-[#dc3545]/20 rounded-sm border border-[#dc3545]/30">
               <FileSpreadsheet size={14} className="text-[#dc3545]" /> 
             </div>
             <div className="flex flex-col">
               <h3 className="text-[12px] font-black text-white uppercase tracking-[0.2em]">WMS Çıktı Merkezi</h3>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Filtreye uyan <strong className="text-white">{filteredResults.length}</strong> kaydı Excel'e aktar</p>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 px-3 h-9 border border-slate-700 bg-slate-800 rounded-sm w-full sm:w-56 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all">
               <Filter size={14} className="text-purple-400 shrink-0" />
               <select 
                 value={reportFilter}
                 onChange={(e) => setReportFilter(e.target.value as any)}
                 className="bg-transparent text-[10px] font-black text-slate-200 uppercase tracking-widest outline-none cursor-pointer w-full appearance-none"
               >
                 <option value="ALL">Tüm Stokları Listele</option>
                 <option value="ACTIVE_SHELF">Sağlam / Aktif Raflar</option>
                 <option value="DAMAGED">Hasarlı Raftakiler (Tümü)</option>
                 <option value="COMMERCIAL">Sadece Ticari Ürünler</option>
                 <option value="CONSUMABLE">Sadece Sarf Malzemeler</option>
                 <option value="NO_STOCK">Stoku Sıfırlananlar</option>
               </select>
            </div>

            <button 
              onClick={handleExportExcel}
              disabled={filteredResults.length === 0}
              className="w-full sm:w-auto h-9 flex items-center justify-center gap-2 px-5 bg-gradient-to-r from-purple-700 to-[#dc3545] hover:from-purple-600 hover:to-red-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-black text-[10px] uppercase tracking-widest rounded-sm transition-all shadow-[0_0_10px_rgba(220,53,69,0.2)] shrink-0 active:scale-95"
            >
              <FileSpreadsheet size={14} /> EXCEL İNDİR
            </button>
          </div>
        </div>

        {/* --- ALT KISIM: ARAMA MOTORU (YÜKSEK KONTRAST) --- */}
        <div className="p-4 bg-slate-50">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
             <div className="flex-1 relative w-full">
               <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-600">
                  <Barcode size={18} />
               </div>
               <input 
                 ref={inputRef}
                 type="text" 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 placeholder="Katalogda Spesifik Bir Barkod veya SKU Arayın..."
                 className="w-full h-11 pl-10 pr-3 bg-white border border-slate-300 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 text-[12px] font-black uppercase tracking-widest text-[#0f172b] outline-none transition-all placeholder:text-slate-400 rounded-sm shadow-sm"
               />
             </div>
             
             <div className="flex items-center gap-2 w-full sm:w-auto">
               {searchTerm && (
                 <button type="button" onClick={handleClearSearch} className="h-11 px-5 text-[10px] bg-white border border-slate-300 font-black text-slate-500 uppercase hover:text-[#dc3545] hover:border-red-200 hover:bg-red-50 transition-colors w-full sm:w-auto rounded-sm shadow-sm">
                   TEMİZLE
                 </button>
               )}

               <button 
                 type="submit" 
                 disabled={isSearching || !searchTerm.trim()}
                 className="h-11 w-full sm:w-auto bg-[#0f172b] hover:bg-[#dc3545] disabled:bg-slate-300 px-8 text-white font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center transition-all active:scale-95 shadow-sm rounded-sm shrink-0"
               >
                 {isSearching ? <Loader2 size={16} className="animate-spin" /> : <><Search size={14} className="mr-1.5"/> BUL</>}
               </button>
             </div>
          </form>
        </div>
      </div>

      {/* 3. ANA STOK TABLOSU */}
      <div className="bg-white border border-slate-300 shadow-md flex flex-col overflow-hidden rounded-sm">
        <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-[11px] font-black text-[#0f172b] uppercase tracking-[0.15em] flex items-center gap-2">
            <Box size={14} className="text-[#dc3545]" /> DEPO STOK LİSTESİ
          </h3>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white border border-slate-300 px-2.5 py-0.5 shadow-sm rounded-sm">
            {filteredResults.length} SONUÇ
          </span>
        </div>

        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead className="bg-[#0f172b] text-slate-300 text-[9px] uppercase tracking-[0.15em]">
              <tr>
                <th className="px-3 py-2.5 border-r border-slate-800">Ürün Bilgisi</th>
                <th className="px-3 py-2.5 border-r border-slate-800 text-center">Barkod / SKU</th>
                <th className="px-3 py-2.5 border-r border-slate-800 text-center w-36">Raf Durumu</th>
                <th className="px-3 py-2.5 text-center text-purple-400 bg-gradient-to-b from-purple-950/40 to-slate-900 w-48">Mevcut Stok<br/><span className="text-[7px] text-slate-400 tracking-wider font-normal">(Hareket Logu İzle)</span></th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-bold text-slate-800 divide-y divide-slate-100">
              {paginatedResults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center flex-col justify-center gap-3">
                    <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block">BU FİLTRE VE ARAMAYA UYGUN STOK BULUNAMADI.</span>
                  </td>
                </tr>
              ) : (
                paginatedResults.map((item, idx) => (
                  <tr key={`${item.product_id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    
                    <td className="px-3 py-2 border-r border-slate-100 align-middle">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-black uppercase text-slate-900 leading-tight mb-0.5 truncate max-w-[300px]" title={item.name}>{item.name}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest">{item.category || 'Kategori Yok'}</span>
                            {item.is_consumable && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-sm uppercase tracking-widest border border-amber-200 leading-none">Sarf</span>}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-3 py-2 border-r border-slate-100 text-center font-mono align-middle">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-black text-[#dc3545] bg-red-50 px-1.5 py-0.5 border border-red-100 tracking-widest rounded-sm">{item.barcode}</span>
                        {item.sku && <span className="text-[9px] text-slate-500 tracking-widest bg-slate-100 px-1.5 py-0.5 rounded-sm border border-slate-200">{item.sku}</span>}
                      </div>
                    </td>
                    
                    <td className="px-3 py-2 border-r border-slate-100 text-center align-middle">
                      {item.has_damaged_shelf ? (
                         <div className="flex flex-col items-center gap-0.5 text-[#dc3545]">
                           <AlertTriangle size={14} />
                           <span className="text-[9px] font-black uppercase tracking-widest bg-red-50 text-[#dc3545] px-1.5 py-0.5 border border-red-200 shadow-sm rounded-sm">HASARLI RAF</span>
                         </div>
                      ) : item.shelf_count > 0 ? (
                         <div className="flex flex-col items-center gap-0.5 text-slate-600">
                           <Layers size={14} className="text-emerald-500" />
                           <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 px-1.5 py-0.5 border border-emerald-100 rounded-sm">
                             {item.shelf_count} Aktif Raf
                           </span>
                         </div>
                      ) : (
                         <div className="flex flex-col items-center gap-0.5 text-slate-400">
                           <Layers size={14} className="opacity-50" />
                           <span className="text-[9px] font-black uppercase tracking-widest">RAFTAN DÜŞMÜŞ</span>
                         </div>
                      )}
                    </td>
                    
                    {/* WMS: VURGULU STOK / LOG İZLEME ALANI: Açılmama Hatası (ID Problemi) Buradan Çözüldü */}
                    <td className="p-0 text-center align-middle bg-slate-50/50 w-48 h-full">
                      <button 
                        onClick={() => setHistoryModalData({ productId: item.product_id || item.id || '', productName: item.name })}
                        className={`w-full h-full flex items-center justify-between px-4 py-2 border-2 border-transparent transition-all group cursor-pointer shadow-sm active:scale-95 rounded-none ${
                          item.total_quantity === 0 
                            ? 'bg-red-50/50 hover:bg-red-100 hover:border-red-400' 
                            : 'bg-white hover:border-purple-500 hover:shadow-[0_0_10px_rgba(107,33,168,0.15)]'
                        }`}
                        title="Raf Geçmişini Görüntüle"
                      >
                          <span className={`text-[24px] font-black font-mono tracking-tighter transition-colors leading-none w-16 text-left ${
                            item.total_quantity === 0 ? 'text-[#dc3545]' : 'text-[#0f172b] group-hover:text-purple-700'
                          }`}>
                            {item.total_quantity}
                          </span>
                          
                          <div className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-sm transition-colors border ${
                            item.total_quantity === 0 
                              ? 'bg-red-100 border-red-200 group-hover:bg-[#dc3545] group-hover:border-[#dc3545]' 
                              : 'bg-slate-100 border-slate-200 group-hover:bg-purple-600 group-hover:border-purple-600'
                          }`}>
                            <Activity size={12} className={item.total_quantity === 0 ? "text-red-700 group-hover:text-white" : "text-slate-500 group-hover:text-white"} />
                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${item.total_quantity === 0 ? 'text-red-700 group-hover:text-white' : 'text-slate-500 group-hover:text-white'}`}>LOG İZLE</span>
                          </div>
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SAYFALAMA */}
        {totalPages > 1 && (
          <div className="bg-slate-100 border-t border-slate-200 p-3 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white border border-slate-300 px-2.5 py-1 shadow-sm rounded-sm">
              SAYFA {currentPage} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#0f172b] text-white disabled:bg-slate-300 disabled:text-slate-500 text-[9px] font-black uppercase tracking-widest hover:bg-[#dc3545] transition-colors shadow-sm active:scale-95 rounded-sm"
              >
                <ChevronLeft size={12} /> ÖNCEKİ
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#0f172b] text-white disabled:bg-slate-300 disabled:text-slate-500 text-[9px] font-black uppercase tracking-widest hover:bg-[#dc3545] transition-colors shadow-sm active:scale-95 rounded-sm"
              >
                SONRAKİ <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DOM'DAN SÖK-TAK İLE ÇALIŞAN MODAL YAPISI (Eski Veri Görünme Hatasını Engeller) */}
      {historyModalData && (
        <StockHistoryModal 
          branchId={branchId}
          isGlobal={isGlobal}
          productId={historyModalData.productId} 
          productName={historyModalData.productName}
          onClose={() => setHistoryModalData(null)} 
        />
      )}

    </div>
  );
}