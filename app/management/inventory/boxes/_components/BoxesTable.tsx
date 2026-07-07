"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { deleteBoxesAction, updateBoxAction } from "@/app/actions/boxes";
import {
  Search,
  RefreshCw,
  Edit,
  Trash2,
  X,
  CheckSquare,
  Square,
  Box,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface BoxItem {
  id: string;
  box_barcode: string;
  product_id: string;
  quantity: number;
  created_at: string;
  products: {
    name: string;
    barcode: string;
    sku: string;
    image_url: string;
  } | any;
}

export default function BoxesTable({
  externalRefresh = 0,
}: {
  externalRefresh?: number;
}) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [boxes, setBoxes] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sayfalama (Pagination) States
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal States
  const [editingBox, setEditingBox] = useState<BoxItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [boxToDelete, setBoxToDelete] = useState<BoxItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Göstermelik Koli Görseli
  const DUMMY_BOX_IMAGE = "https://brikkehuset.no/cdn/shop/files/771u_10wl_210528_8_69c72010-adc6-4ded-80f7-a48bf02cbe4f.jpg?v=1728590936";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Arama değiştiğinde sayfayı 1'e sıfırla
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const fetchBoxes = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from("boxes")
        .select(`
          id, box_barcode, product_id, quantity, created_at,
          products (name, barcode, sku, image_url)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (debouncedSearch) {
        const { data: matchedProducts } = await supabase
          .from("products")
          .select("id")
          .or(`barcode.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%`);

        const productIds = matchedProducts?.map((p) => p.id) || [];

        if (productIds.length > 0) {
          query = query.or(`box_barcode.ilike.%${debouncedSearch}%,product_id.in.(${productIds.join(',')})`);
        } else {
          query = query.ilike("box_barcode", `%${debouncedSearch}%`);
        }
      }

      const { data, count, error } = await query;
      
      if (error) throw error;
      setBoxes((data as any) || []);
      if (count !== null) setTotalCount(count);
    } catch (error) {
      console.error("Koli Verisi Çekme Hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, currentPage]);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes, refreshTrigger, externalRefresh]);

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSelectAll = () =>
    setSelectedIds(
      selectedIds.length === boxes.length && boxes.length > 0
        ? []
        : boxes.map((b) => b.id),
    );

  const handleSelectBox = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id],
    );

  const handleUpdateBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBox) return;
    setEditLoading(true);

    const result = await updateBoxAction(
      editingBox.id,
      editingBox.box_barcode,
      editingBox.quantity,
      "3976" 
    );

    if (result.success) {
      setEditingBox(null);
      handleSuccess();
    } else {
      alert("Güncelleme hatası: " + result.error);
    }
    
    setEditLoading(false);
  };

  const executeDelete = async () => {
    if (!boxToDelete) return;
    setDeleteLoading(true);
    
    const result = await deleteBoxesAction([boxToDelete.id], "3976");

    if (result.success) {
      setSelectedIds((prev) => prev.filter((id) => id !== boxToDelete.id));
      setBoxToDelete(null);
      handleSuccess();
    } else {
      alert("Silme hatası: " + result.error);
    }
    setDeleteLoading(false);
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteLoading(true);

    const result = await deleteBoxesAction(selectedIds, "3976");

    if (result.success) {
      setIsBulkDeleteModalOpen(false);
      setSelectedIds([]);
      handleSuccess();
    } else {
      alert("Toplu silme hatası: " + result.error);
    }
    setBulkDeleteLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full font-['Quicksand']">
      
      {/* KONTROL MERKEZİ */}
      <div className="bg-white border border-slate-200 border-t-4 border-t-[#dc3545] rounded-sm shadow-sm flex flex-col md:flex-row items-center justify-between p-4 gap-4 relative overflow-hidden z-10">
        
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Dış Barkod, İç Barkod, SKU veya Ürün Adı ara..."
            className="w-full h-11 pl-11 pr-10 text-sm font-bold border border-slate-300 rounded-sm bg-slate-50 text-slate-800 outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] transition-all placeholder:text-slate-400 shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#dc3545] bg-white hover:bg-red-50 rounded-sm border border-transparent hover:border-red-200 transition-colors"
            >
              <X size={14} strokeWidth={3} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 px-3 py-1.5 rounded-sm border border-red-100 animate-in fade-in slide-in-from-right-4">
              <span className="text-xs font-black text-[#dc3545]">
                {selectedIds.length} Koli Seçili
              </span>
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="h-8 px-3 bg-[#dc3545] text-white rounded-sm text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 size={14} /> Toplu Sil
              </button>
            </div>
          )}
          
          <button
            onClick={handleSelectAll}
            className="h-11 px-4 flex items-center justify-center gap-2 text-xs font-black text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-sm transition-all shadow-sm uppercase whitespace-nowrap"
          >
            {selectedIds.length === boxes.length && boxes.length > 0 ? (
              <><CheckSquare size={16} className="text-[#dc3545]"/> Tümünü Bırak</>
            ) : (
              <><Square size={16} /> Tümünü Seç</>
            )}
          </button>

          <button
            onClick={handleSuccess}
            className="h-11 w-11 flex items-center justify-center text-slate-500 bg-white border border-slate-300 rounded-sm hover:text-[#dc3545] hover:bg-red-50 hover:border-red-200 transition-all shadow-sm group shrink-0"
            title="Verileri Yenile"
          >
            <RefreshCw
              size={18}
              className={`${loading ? "animate-spin text-[#dc3545]" : "group-hover:rotate-180 transition-transform duration-500"}`}
            />
          </button>
        </div>
      </div>

      {/* KART GRİD ALANI */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {[...Array(itemsPerPage)].map((_, i) => (
            <div key={i} className="h-72 bg-white rounded-lg border border-slate-200 shadow-sm animate-pulse flex flex-col">
              <div className="h-40 bg-slate-100 w-full border-b border-slate-200 rounded-t-lg"></div>
              <div className="p-4 flex-1 space-y-3">
                <div className="h-8 bg-slate-200 w-full rounded"></div>
                <div className="h-3 bg-slate-100 w-1/2 rounded mt-4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : boxes.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-sm shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-200">
            <Box size={32} className="opacity-50 text-slate-500" />
          </div>
          <p className="text-lg font-black text-slate-700">Koli Bulunamadı</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm text-center font-medium">
            Arama kriterlerinize uyan bir kayıt sistemde yok.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 min-h-[300px]">
            {boxes.map((box) => {
              const isSelected = selectedIds.includes(box.id);
              const product = Array.isArray(box.products) ? box.products[0] : box.products;
              
              const productName = product?.name || "Sistemde Ürün Bulunamadı";
              const productBarcode = product?.barcode || "Bilinmiyor";
              const productImage = product?.image_url || null;

              return (
                <div 
                  key={box.id} 
                  className={`group relative bg-white border-2 rounded-xl flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg
                    ${isSelected ? 'border-[#dc3545] shadow-[0_0_0_4px_rgba(220,53,69,0.1)]' : 'border-slate-200 hover:border-slate-300'}
                  `}
                >
                  {/* Sol Üst Checkbox */}
                  <div className="absolute top-2 left-2 z-20">
                    <button 
                      onClick={() => handleSelectBox(box.id)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-all shadow-sm border-2
                        ${isSelected ? 'bg-[#dc3545] border-[#dc3545] text-white' : 'bg-white/90 backdrop-blur border-slate-300 text-transparent hover:border-slate-400'}
                      `}
                    >
                      <CheckSquare size={16} className={isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75"} strokeWidth={3} />
                    </button>
                  </div>

                  {/* Görsel ve Miktar Alanı */}
                  <div className="w-full h-48 bg-slate-50 relative flex items-center justify-center border-b border-slate-100 overflow-hidden">
                    <img 
                      src={DUMMY_BOX_IMAGE} 
                      alt="Box" 
                      className="absolute w-36 h-36 object-contain transition-all duration-300 group-hover:opacity-0 group-hover:scale-95 mix-blend-multiply"
                    />
                    {productImage ? (
                      <img 
                        src={productImage} 
                        alt="Product" 
                        className="absolute w-full h-full bg-white object-contain opacity-0 scale-105 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 p-4" 
                      />
                    ) : (
                      <div className="absolute opacity-0 group-hover:opacity-100 flex flex-col items-center transition-all duration-300 text-slate-300 bg-slate-50/80 backdrop-blur w-full h-full justify-center">
                        <Package size={28} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Ürün Görseli Yok</span>
                      </div>
                    )}

                    {/* Koli İçi Adet Rozeti */}
                    <div className="absolute bottom-0 right-0 bg-[#dc3545] text-white pl-4 pr-3 py-1.5 rounded-tl-2xl flex items-center gap-2 shadow-[-4px_-4px_15px_rgba(220,53,69,0.2)] z-10">
                      <Layers size={18} className="opacity-70" strokeWidth={2.5}/>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black tabular-nums tracking-tighter leading-none">{box.quantity}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Adet</span>
                      </div>
                    </div>
                  </div>

                  {/* Bilgi Gövdesi */}
                  <div className="p-4 flex-1 flex flex-col bg-white">
                    <div className="bg-slate-800 rounded flex flex-col border-l-4 border-[#dc3545] px-3 py-2.5 mb-4 shadow-sm">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Dış Koli Barkodu</span>
                      <h3 className="font-mono font-black text-sm text-white truncate" title={box.box_barcode}>
                        {box.box_barcode}
                      </h3>
                    </div>

                    <div className="mt-auto flex flex-col gap-0.5">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">İçerik Tanımı</span>
                      <h4 className={`font-bold text-xs truncate ${!product ? 'text-amber-500' : 'text-slate-800'}`} title={productName}>
                        {productName}
                      </h4>
                      <p className="font-mono text-[10px] text-slate-500 truncate flex items-center gap-1.5 mt-1">
                        <Package size={12} className="opacity-50"/> 
                        {productBarcode} {product?.sku ? <span className="opacity-50 mx-0.5">•</span> : ''} {product?.sku}
                      </p>
                    </div>
                  </div>

                  {/* Aksiyon Butonları */}
                  <div className="flex border-t border-slate-100 bg-slate-50">
                    <button
                      onClick={() => setEditingBox(box)}
                      className="flex-1 flex justify-center items-center gap-1.5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 hover:text-[#dc3545] transition-colors border-r border-slate-200"
                    >
                      <Edit size={14} /> Düzenle
                    </button>
                    <button
                      onClick={() => setBoxToDelete(box)}
                      className="flex-1 flex justify-center items-center gap-1.5 py-3 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-[#dc3545] transition-colors"
                    >
                      <Trash2 size={14} /> Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SAYFALAMA KONTROLÜ (PAGINATION) */}
          {totalPages > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 border border-slate-200 rounded-sm shadow-sm gap-4">
              <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded border border-slate-100">
                Toplam <strong className="text-slate-800 mx-1">{totalCount}</strong> kayıttan <strong className="text-[#dc3545] mx-1">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalCount)}</strong> arası gösteriliyor.
              </span>
              
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded border border-slate-200">
                <button 
                  disabled={currentPage === 1 || loading}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-8 px-3 rounded flex items-center justify-center gap-1 text-xs font-bold text-slate-600 hover:bg-white hover:text-[#dc3545] hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all"
                >
                  <ChevronLeft size={14} strokeWidth={3} /> Önceki
                </button>
                
                <div className="flex items-center px-4 h-8 bg-white rounded border border-slate-200 shadow-inner">
                  <span className="text-xs font-black text-slate-700">
                    {currentPage} <span className="text-slate-400 mx-1">/</span> {totalPages}
                  </span>
                </div>
                
                <button 
                  disabled={currentPage === totalPages || totalPages === 0 || loading}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="h-8 px-3 rounded flex items-center justify-center gap-1 text-xs font-bold text-slate-600 hover:bg-white hover:text-[#dc3545] hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all"
                >
                  Sonraki <ChevronRight size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 1. Düzenleme Modalı */}
      {editingBox && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setEditingBox(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 border-t-4 border-[#dc3545]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Edit size={18} className="text-[#dc3545]" /> Koliyi Düzenle
              </h2>
              <button onClick={() => setEditingBox(null)} className="p-2 text-slate-400 hover:text-[#dc3545] bg-white border border-slate-200 rounded-md transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdateBox} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Dış Koli Barkodu</label>
                <input
                  type="text"
                  required
                  className="w-full h-11 px-3 border border-slate-300 rounded-md text-sm outline-none focus:border-[#dc3545] font-mono font-bold text-slate-800 transition-colors bg-slate-50"
                  value={editingBox.box_barcode}
                  onChange={(e) => setEditingBox({ ...editingBox, box_barcode: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Koli İçi Adet</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full h-11 px-3 border border-slate-300 rounded-md text-xl outline-none focus:border-[#dc3545] font-black text-[#dc3545] bg-slate-50 transition-colors"
                  value={editingBox.quantity || ''}
                  onChange={(e) => setEditingBox({ ...editingBox, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-4">
                <button type="button" onClick={() => setEditingBox(null)} className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-md hover:bg-slate-50 transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={editLoading} className="px-6 py-2 bg-[#dc3545] text-white font-bold rounded-md hover:bg-red-700 flex items-center gap-2 shadow-sm transition-colors">
                  {editLoading ? <Loader2 size={16} className="animate-spin" /> : "Güncelle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Tekil Silme Modalı */}
      {boxToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setBoxToDelete(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 p-6 border-t-4 border-[#dc3545]" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto border-4 border-white shadow-sm">
              <AlertCircle size={32} className="text-[#dc3545]" />
            </div>
            <h2 className="text-lg font-black text-slate-800 text-center mb-2">Koliyi Silmek İstediğinize Emin Misiniz?</h2>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              <strong className="text-white block mb-2 font-mono bg-slate-800 p-2 rounded shadow-inner tracking-widest text-base">
                {boxToDelete.box_barcode}
              </strong>
              Bu master barkod sistemden kalıcı olarak silinecektir.
            </p>
            <div className="flex gap-3 w-full">
              <button type="button" onClick={() => setBoxToDelete(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-md hover:bg-slate-50 transition-colors">İptal</button>
              <button type="button" onClick={executeDelete} disabled={deleteLoading} className="flex-1 py-2.5 bg-[#dc3545] text-white font-bold rounded-md hover:bg-red-700 flex items-center justify-center gap-2 transition-colors shadow-sm">
                {deleteLoading ? <Loader2 size={16} className="animate-spin" /> : "Kalıcı Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Toplu Silme Modalı */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsBulkDeleteModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 p-6 border-t-4 border-[#dc3545]" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto border-4 border-white shadow-sm">
              <AlertTriangle size={32} className="text-[#dc3545]" />
            </div>
            <h2 className="text-lg font-black text-slate-800 text-center mb-2">Toplu Koli Silme İşlemi</h2>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              Seçili <strong className="text-[#dc3545] font-black text-lg">{selectedIds.length}</strong> koli tanımını sistemden tamamen kaldırmak üzeresiniz.
            </p>
            <div className="flex gap-3 w-full">
              <button type="button" onClick={() => setIsBulkDeleteModalOpen(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-md hover:bg-slate-50 transition-colors">İptal</button>
              <button type="button" onClick={executeBulkDelete} disabled={bulkDeleteLoading} className="flex-1 py-2.5 bg-[#dc3545] text-white font-bold rounded-md hover:bg-red-700 flex items-center justify-center gap-2 transition-colors shadow-sm">
                {bulkDeleteLoading ? <Loader2 size={16} className="animate-spin" /> : "Seçilenleri Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}