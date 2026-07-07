"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { createBoxAction } from "@/app/actions/boxes"; // Önceki adımda yazdığımız Server Action
import { 
  X, Barcode, Layers, 
  Image as ImageIcon, AlertCircle, 
  CheckCircle2, Loader2, PackageSearch,
  Box, ArrowRight, Hash, Check
} from "lucide-react";

export default function ManualBoxModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    box_barcode: "",
    product_barcode: "",
    quantity: 1,
  });

  // Ürün Önizleme State (Barkod girildikçe veritabanından çekilir)
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [productNotFound, setProductNotFound] = useState(false);

  // ESC ile kapatma
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, loading]);

  // Canlı Ürün Arama Motoru (Debounce ile)
  useEffect(() => {
    const searchBarcode = formData.product_barcode.trim();
    
    if (searchBarcode.length < 3) {
      setPreviewProduct(null);
      setProductNotFound(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingProduct(true);
      setProductNotFound(false);
      
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, image_url, category, sku, is_consumable")
          .eq("barcode", searchBarcode)
          .single();

        if (error || !data) {
          setPreviewProduct(null);
          setProductNotFound(true);
        } else {
          setPreviewProduct(data);
          setProductNotFound(false);
        }
      } catch (err) {
        setPreviewProduct(null);
        setProductNotFound(true);
      } finally {
        setIsSearchingProduct(false);
      }
    }, 500); // 500ms debounce (Kullanıcı yazmayı bitirene kadar bekle)

    return () => clearTimeout(delayDebounceFn);
  }, [formData.product_barcode]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.box_barcode.trim() || !formData.product_barcode.trim() || formData.quantity <= 0) {
      setErrorLog("Lütfen tüm alanları geçerli şekilde doldurun.");
      return;
    }

    if (!previewProduct || productNotFound) {
      setErrorLog("Girdiğiniz ürün barkodu sistemde bulunamadı. Lütfen geçerli bir ürün barkodu girin.");
      return;
    }

    setLoading(true);
    setErrorLog(null);

    try {
      // Önceki adımda hazırladığımız Server Action'ı çağırıyoruz.
      // Not: "3976" Faruk Dalkıran'ın ID'si. Eğer sisteme auth entegreyse dinamik verilebilir.
      const result = await createBoxAction({
        box_barcode: formData.box_barcode.trim(),
        product_id: previewProduct.id,
        quantity: formData.quantity
      }, "3976");

      if (!result.success) {
        throw new Error(result.error);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      setErrorLog(err.message || "Koli kaydedilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // FULL SCREEN OVERLAY
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      
      {/* MODAL KAPSAYICI */}
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#dc3545]/10 flex items-center justify-center text-[#dc3545]">
              <Box size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Tekil Koli (Master Barkod) Oluştur</h2>
              <p className="text-xs text-slate-500 font-medium">Toplu raflama ve toplama işlemleri için dış koli barkodu tanımlayın.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY - 2 KOLONLU YAPI */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          
          {/* SOL KOLON: Form Alanı */}
          <div className="w-full lg:w-7/12 p-6 overflow-y-auto">
            
            {success ? (
              <div className="h-full flex flex-col items-center justify-center text-emerald-600 animate-in zoom-in-95">
                <CheckCircle2 size={64} className="mb-4" />
                <h3 className="text-2xl font-black text-slate-800 mb-2">Başarıyla Kaydedildi!</h3>
                <p className="text-slate-500 font-medium">Koli sisteme işlendi, tablo yenileniyor...</p>
              </div>
            ) : (
              <form id="boxForm" onSubmit={handleSubmit} className="space-y-6">
                
                {errorLog && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl animate-in fade-in">
                    <AlertCircle size={20} className="shrink-0 text-[#dc3545] mt-0.5" />
                    <p className="text-sm font-medium">{errorLog}</p>
                  </div>
                )}

                {/* TEMEL BİLGİLER BÖLÜMÜ */}
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                    1. Koli Tanımlamaları
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    
                    {/* Dış Koli Barkodu */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-600">Dış Koli Barkodu (Master Barcode) <span className="text-[#dc3545]">*</span></label>
                      <div className="relative">
                        <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          required 
                          autoFocus
                          type="text" 
                          placeholder="Örn: BOX-8691010..."
                          className="w-full h-11 pl-9 pr-3 text-sm border-2 border-slate-300 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none transition-all placeholder:text-slate-400 font-bold text-slate-800"
                          value={formData.box_barcode} 
                          onChange={e => setFormData({...formData, box_barcode: e.target.value.toUpperCase()})} 
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">Bu barkod, kolinin dış yüzeyine yapıştırılacak veya okutulacak ana barkoddur.</p>
                    </div>

                    {/* İç Ürün Barkodu */}
                    <div className="space-y-1.5 sm:col-span-2 mt-2">
                      <label className="text-xs font-bold text-slate-600 flex justify-between items-center">
                        <span>Koli İçi Ürün Barkodu <span className="text-[#dc3545]">*</span></span>
                        
                        {/* Arama Durum İndikatörü */}
                        {isSearchingProduct && <span className="text-blue-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Aranıyor...</span>}
                        {!isSearchingProduct && previewProduct && <span className="text-emerald-600 flex items-center gap-1"><Check size={12} /> Ürün Eşleşti</span>}
                        {!isSearchingProduct && productNotFound && formData.product_barcode.length > 2 && <span className="text-[#dc3545] flex items-center gap-1"><X size={12} /> Bulunamadı!</span>}
                      </label>
                      
                      <div className="relative">
                        <PackageSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          required 
                          type="text" 
                          placeholder="Ürün barkodunu okutun veya yazın..."
                          className={`w-full h-11 pl-9 pr-3 text-sm border-2 rounded-lg outline-none transition-all placeholder:text-slate-400 font-bold
                            ${previewProduct ? 'border-emerald-400 bg-emerald-50 text-emerald-800 focus:border-emerald-500 focus:ring-emerald-500' : 
                              productNotFound && formData.product_barcode.length > 2 ? 'border-red-400 bg-red-50 text-red-800 focus:border-red-500 focus:ring-red-500' : 
                              'border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-slate-800'
                            }
                          `}
                          value={formData.product_barcode} 
                          onChange={e => setFormData({...formData, product_barcode: e.target.value})} 
                        />
                      </div>
                    </div>

                    {/* Koli İçi Adet */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-600">Koli İçi Ürün Adedi <span className="text-[#dc3545]">*</span></label>
                      <div className="relative w-full sm:w-1/2">
                        <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          required 
                          type="number" 
                          min="1"
                          className="w-full h-11 pl-9 pr-3 text-sm border-2 border-slate-300 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none transition-all font-black text-slate-800 bg-slate-50"
                          value={formData.quantity || ''} 
                          onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} 
                        />
                      </div>
                    </div>

                  </div>
                </div>

              </form>
            )}
          </div>

          {/* SAĞ KOLON: Canlı Önizleme (Live Preview) */}
          <div className="w-full lg:w-5/12 bg-slate-50 border-l border-slate-200 p-6 flex flex-col relative overflow-hidden">
            
            {/* Arka plan deseni (WMS Depo hissi) */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
              Terminal Önizlemesi
            </h3>
            
            <div className="flex-1 flex items-center justify-center relative z-10">
              
              {/* Ürün Bulunamadı / Bekleniyor Ekranı */}
              {!previewProduct ? (
                <div className="text-center p-8 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200 border-dashed">
                  <Box size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-500">Ürün Barkodu Bekleniyor</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Sol taraftaki forma geçerli bir ürün barkodu girdiğinizde, koli içeriği burada belirecektir.</p>
                </div>
              ) : (
                
                /* Bulunan Ürün Koli Önizleme Kartı */
                <div className="bg-white w-full max-w-[280px] rounded-2xl shadow-xl border border-slate-200 overflow-hidden group animate-in zoom-in-95 duration-300 relative">
                  
                  {/* Koli Adet Badge'i (Sol Üstte Vurgulu) */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[#dc3545] text-white px-3 py-1.5 rounded-lg shadow-lg">
                    <X size={14} className="opacity-80"/>
                    <span className="font-black text-lg leading-none">{formData.quantity}</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-80 mt-0.5">Adet</span>
                  </div>

                  {/* Resim Alanı */}
                  <div className="w-full h-40 bg-slate-100 flex items-center justify-center relative border-b border-slate-100 p-4">
                    {previewProduct.image_url ? (
                      <img 
                        src={previewProduct.image_url} 
                        alt={previewProduct.name} 
                        className="w-full h-full object-contain drop-shadow-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    
                    {/* Resim Hatası veya Yokluğu Durumunda Gösterilecek Fallback */}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center text-slate-400 ${previewProduct.image_url ? 'hidden' : ''}`}>
                      <PackageSearch size={40} className="mb-2 opacity-40" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Görsel Yok</span>
                    </div>

                    {/* Kategori Badge */}
                    {previewProduct.category && (
                      <span className="absolute bottom-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 rounded text-[9px] font-bold shadow-sm uppercase tracking-wider">
                        {previewProduct.category}
                      </span>
                    )}
                  </div>

                  {/* Ürün Detayları */}
                  <div className="p-4 bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-mono text-[11px] text-slate-500 font-bold">{formData.product_barcode}</p>
                      {previewProduct.is_consumable && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black uppercase">Sarf</span>
                      )}
                    </div>
                    
                    <h4 className="font-bold text-slate-800 text-sm leading-tight mb-3 line-clamp-2" title={previewProduct.name}>
                      {previewProduct.name}
                    </h4>
                    
                    {/* Koli Dönüşüm İndikatörü */}
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Box size={14} className="text-slate-400"/>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Koli İçeriği</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-[#dc3545]">
                        {formData.quantity} <span className="text-[10px] font-bold text-slate-500">Birim</span>
                      </div>
                    </div>
                  </div>
                </div>

              )}
            </div>
            
            <p className="text-center text-[10px] text-slate-400 mt-6 font-medium relative z-10">
              Terminal bu dış barkodu okuduğunda, stok veya raf işlemi tanımlı adet kadar çarpılarak tek seferde yapılacaktır.
            </p>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0 relative z-20">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            İptal
          </button>
          <button 
            type="submit"
            form="boxForm" // Form ID'si ile footer butonunu bağlıyoruz
            disabled={loading || success || !previewProduct || productNotFound || formData.quantity <= 0 || !formData.box_barcode}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#dc3545] text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed min-w-[150px]"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Kaydediliyor</>
            ) : (
              "Koliyi Tanımla"
            )}
          </button>
        </div>

      </div>
    </div>
  );
}