"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  X, PackagePlus, Barcode, Tag, Layers, 
  Image as ImageIcon, ShoppingCart, AlertCircle, 
  CheckCircle2, Info, Loader2, PackageSearch
} from "lucide-react";

export default function ManualProductModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    barcode: "",
    sku: "",
    name: "",
    category: "",
    image_url: "",
    is_consumable: false,
    max_order_limit: 0
  });

  // ESC ile kapatma
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.barcode.trim() || !formData.name.trim()) {
      setErrorLog("Barkod ve Ürün Adı alanları zorunludur.");
      return;
    }

    setLoading(true);
    setErrorLog(null);

    try {
      const { error } = await supabase.from("products").insert([{
        barcode: formData.barcode.trim(),
        sku: formData.sku.trim() || null,
        name: formData.name.trim(),
        category: formData.category.trim() || null,
        image_url: formData.image_url.trim() || null,
        is_consumable: formData.is_consumable,
        max_order_limit: formData.is_consumable ? formData.max_order_limit : 0
      }]);

      if (error) {
        // Benzersiz barkod hatası (PostgreSQL 23505 = unique_violation)
        if (error.code === '23505') {
          throw new Error("Bu barkod numarası sistemde zaten kayıtlı!");
        }
        throw error;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      setErrorLog(err.message || "Ürün kaydedilirken bir hata oluştu.");
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
              <PackagePlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Yeni Ürün Ekle</h2>
              <p className="text-xs text-slate-500 font-medium">Manuel olarak yeni bir ürün veya sarf malzeme kartı oluşturun.</p>
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
                <p className="text-slate-500 font-medium">Ürün kataloğa eklendi, tablo yenileniyor...</p>
              </div>
            ) : (
              <form id="productForm" onSubmit={handleSubmit} className="space-y-6">
                
                {errorLog && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl animate-in fade-in">
                    <AlertCircle size={20} className="shrink-0 text-[#dc3545] mt-0.5" />
                    <p className="text-sm font-medium">{errorLog}</p>
                  </div>
                )}

                {/* TEMEL BİLGİLER BÖLÜMÜ */}
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                    1. Temel Tanımlamalar
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Barkod Numarası <span className="text-[#dc3545]">*</span></label>
                      <div className="relative">
                        <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          required 
                          autoFocus
                          type="text" 
                          placeholder="Örn: 869..."
                          className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none transition-all placeholder:text-slate-400"
                          value={formData.barcode} 
                          onChange={e => setFormData({...formData, barcode: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">SKU Kodu</label>
                      <div className="relative">
                        <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Opsiyonel stok kodu"
                          className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none transition-all placeholder:text-slate-400"
                          value={formData.sku} 
                          onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-600">Ürün Adı <span className="text-[#dc3545]">*</span></label>
                      <input 
                        required 
                        type="text" 
                        placeholder="Tam ve açıklayıcı ürün adı girin"
                        className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800"
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Kategori</label>
                      <div className="relative">
                        <Layers size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Örn: Kırtasiye, Giyim"
                          className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none transition-all placeholder:text-slate-400"
                          value={formData.category} 
                          onChange={e => setFormData({...formData, category: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600">Görsel URL (Bağlantısı)</label>
                      <div className="relative">
                        <ImageIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="url" 
                          placeholder="https://..."
                          className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none transition-all placeholder:text-slate-400"
                          value={formData.image_url} 
                          onChange={e => setFormData({...formData, image_url: e.target.value})} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SARF MALZEME & B2B AYARLARI BÖLÜMÜ */}
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 mt-2">
                    2. Operasyon ve B2B Ayarları
                  </h3>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    
                    {/* Modern Switch Toggle */}
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${formData.is_consumable ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                          <ShoppingCart size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 group-hover:text-[#dc3545] transition-colors">Sarf Malzeme Tanımı</div>
                          <div className="text-xs text-slate-500 mt-0.5">Bu ürün sadece mağazalar (B2B) tarafından sipariş edilebilir.</div>
                        </div>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={formData.is_consumable}
                          onChange={e => setFormData({...formData, is_consumable: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#dc3545]"></div>
                      </div>
                    </label>

                    {/* Conditional Field: Sadece Sarf seçiliyse açılır */}
                    {formData.is_consumable && (
                      <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                          Maksimum Sipariş Limiti (Adet)
                          <Info size={14} className="text-slate-400" title="Bir şube tek seferde en fazla kaç adet sipariş verebilir?"/>
                        </label>
                        <input 
                          type="number" 
                          min="1" 
                          className="w-full sm:w-1/2 h-10 px-3 text-sm border-2 border-amber-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all font-bold text-amber-700 bg-amber-50"
                          value={formData.max_order_limit || ''} 
                          onChange={e => setFormData({...formData, max_order_limit: parseInt(e.target.value) || 0})} 
                        />
                      </div>
                    )}
                  </div>
                </div>

              </form>
            )}
          </div>

          {/* SAĞ KOLON: Canlı Önizleme (Live Preview) */}
          <div className="w-full lg:w-5/12 bg-slate-50 border-l border-slate-200 p-6 flex flex-col">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              Sistemdeki Görünümü
            </h3>
            
            <div className="flex-1 flex items-center justify-center">
              {/* Önizleme Kartı */}
              <div className="bg-white w-full max-w-[280px] rounded-2xl shadow-lg border border-slate-200 overflow-hidden group">
                
                {/* Resim Alanı */}
                <div className="w-full h-48 bg-slate-100 flex items-center justify-center relative border-b border-slate-100">
                  {formData.image_url ? (
                    <img 
                      src={formData.image_url} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  
                  {/* Resim Hatası veya Yokluğu Durumunda Gösterilecek Fallback */}
                  <div className={`absolute inset-0 flex flex-col items-center justify-center text-slate-400 ${formData.image_url ? 'hidden' : ''}`}>
                    <PackageSearch size={40} className="mb-2 opacity-50" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Görsel Yok</span>
                  </div>

                  {/* Kategori Badge */}
                  {formData.category && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 rounded text-[10px] font-bold shadow-sm">
                      {formData.category}
                    </span>
                  )}
                </div>

                {/* Ürün Detayları */}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-mono text-xs text-slate-500 font-semibold">{formData.barcode || "Barkod Bekleniyor..."}</p>
                    {formData.is_consumable ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black uppercase">Sarf</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase">Ürün</span>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 text-base leading-tight mb-3 line-clamp-2">
                    {formData.name || "Ürün Adı Girilmedi"}
                  </h4>
                  
                  {formData.sku && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2 py-1.5 rounded-md border border-slate-100 w-max">
                      <Tag size={12} /> SKU: <span className="font-bold text-slate-700">{formData.sku}</span>
                    </div>
                  )}

                  {formData.is_consumable && formData.max_order_limit > 0 && (
                    <div className="mt-3 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1.5 rounded border border-amber-100">
                      Limit: Şube başı maks {formData.max_order_limit} adet
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-center text-[10px] text-slate-400 mt-6 font-medium">
              El terminallerinde ve yönetim panellerinde ürün bu şekilde görünecektir.
            </p>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            İptal
          </button>
          <button 
            type="submit"
            form="productForm" // Form ID'si ile footer butonunu bağlıyoruz
            disabled={loading || success}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#dc3545] text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md disabled:opacity-70 min-w-[140px]"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Kaydediliyor</>
            ) : (
              "Ürünü Kaydet"
            )}
          </button>
        </div>

      </div>
    </div>
  );
}