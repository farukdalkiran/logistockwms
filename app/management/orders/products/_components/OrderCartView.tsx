"use client";

import React, { Dispatch, SetStateAction, useState } from "react";
import { Trash2, ShoppingCart, Send, Loader2, ArrowLeft, AlertCircle, ShieldAlert, CheckCircle2, Box } from "lucide-react";
import { CartItem } from "@/types";

interface OrderCartViewProps {
  cartItems: CartItem[];
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  onBack: () => void;
}

export default function OrderCartView({ cartItems, setCartItems, onBack }: OrderCartViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleRemove = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty < 1) return;
    setCartItems((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, quantity: newQty } : item))
    );
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    
    // TODO: Supabase Server Action entegrasyonu
    setTimeout(() => {
      setIsSubmitting(false);
      setCartItems([]);
      alert("Sipariş talebi Merkez Depo'ya başarıyla iletildi!");
      onBack();
    }, 1200);
  };

  if (cartItems.length === 0) {
    return (
      <div className="bg-white border border-slate-200 py-24 px-6 flex flex-col items-center justify-center text-center shadow-sm w-full">
        <div className="w-16 h-16 bg-red-50 border border-red-100 flex items-center justify-center mb-4 text-[#dc3545]">
          <ShoppingCart size={32} />
        </div>
        <h2 className="text-base font-black text-slate-800 uppercase tracking-wide mb-1">Talep Sepetiniz Boş</h2>
        <p className="text-slate-500 font-mono text-xs mb-6 max-w-md font-bold">
          Merkez depodan talep etmek istediğiniz sarf malzemeleri ve ürünleri seçmek için kataloğa geri dönebilirsiniz.
        </p>
        <button 
          onClick={onBack}
          className="bg-slate-800 hover:bg-[#dc3545] text-white px-6 py-3 font-bold uppercase text-xs tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <ArrowLeft size={16} />
          Ürün Kataloğuna Geri Dön
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full items-start">
      
      {/* ÜST BİLGİ KARTLARI VE BÜYÜTÜLMÜŞ LEGO LOOP GIF ALANI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
        
        {/* Bilgi Kartı 1: Operasyonel Akış (4 Kolon) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-red-50 text-[#dc3545] border border-red-100 shrink-0">
            <Box size={22} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-1">Merkez Senkronizasyonu</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Talepler onaylandığı an Merkez Depo toplama havuzuna işlenir ve kargo hazırlığı başlar.
            </p>
          </div>
        </div>

        {/* Bilgi Kartı 2: Onay Süreci (4 Kolon) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-5 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-1">Fiziki Stok Kontrolü</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Miktarlar depo yöneticileri tarafından fiziki stok dengesine göre revize edilebilir.
            </p>
          </div>
        </div>

        {/* Büyütülmüş Lego Loop GIF Alanı (4 Kolon - Panel Dominant Yapı) */}
        <div className="lg:col-span-4 bg-slate-800 text-white border-l-4 border-[#dc3545] p-5 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="z-10 pr-2">
            <span className="text-[9px] font-mono text-[#dc3545] font-black tracking-widest uppercase block mb-1">WMS B2B MOTORU</span>
            <h4 className="text-xs font-black uppercase tracking-wider text-white mb-0.5">Akıllı Talep Yönetimi</h4>
            <p className="text-[10px] text-slate-400 font-mono">Real-time Stok Havuzu</p>
          </div>
          <div className="w-24 h-20 shrink-0 bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden z-10 shadow-inner">
            <img 
              src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXl5c3BnMGZsa25sMXk4NWQ1YXczaWxtazNvNGNnbDdmZTR0YTh3eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/SIMKP4dNU5znPHWSVZ/giphy.gif" 
              alt="Lego Parçaları Loop"
              className="w-full h-full object-cover scale-110"
            />
          </div>
        </div>

      </div>

      {/* İÇERİK BÖLÜMÜ: TABLO VE ÖZET KARTI */}
      <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
        
        {/* Sol Taraf: Sepet Kalemleri Tablosu */}
        <div className="flex-1 bg-white border border-slate-200 shadow-sm flex flex-col w-full overflow-hidden">
          <div className="bg-slate-50 text-slate-800 p-4 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-[#dc3545]" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Talep Edilen Ürün Kalemleri
              </h2>
            </div>
            <span className="bg-[#dc3545] text-white text-[10px] font-black px-2 py-0.5 font-mono tracking-wider">
              {cartItems.length} ÇEŞİT / {totalItems} ADET
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-black tracking-wider">
                  <th className="p-3.5 w-20 text-center">Görsel</th>
                  <th className="p-3.5">SKU & Ürün Adı</th>
                  <th className="p-3.5 text-center w-40">Talep Miktarı</th>
                  <th className="p-3.5 text-center w-24">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cartItems.map((item) => (
                  <tr key={item.product_id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-3.5 text-center">
                      <div className="w-12 h-12 bg-white border border-slate-200 flex items-center justify-center mx-auto overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <ShoppingCart size={16} className="text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-[11px] text-[#dc3545] font-bold tracking-wider mb-0.5">{item.sku}</div>
                      <div className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">{item.name}</div>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center border border-slate-300 bg-white shadow-xs">
                        <button
                          onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono text-xs font-bold transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-3 py-1 font-mono font-bold text-xs text-slate-800 min-w-[2.5rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono text-xs font-bold transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <button 
                        onClick={() => handleRemove(item.product_id)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-[#dc3545] border border-slate-200 hover:border-[#dc3545] transition-colors inline-flex items-center justify-center cursor-pointer shadow-xs"
                        title="Sepetten Çıkar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sağ Taraf: Sipariş Özeti ve Aksiyon Paneli */}
        <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 text-slate-800 p-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <ShieldAlert size={15} className="text-[#dc3545]" />
                Sipariş Özeti
              </h3>
              <span className="text-[10px] font-mono text-slate-400 font-bold">WMS-B2B</span>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs font-medium text-slate-600 border-b border-slate-100 pb-3">
                <span>Toplam Ürün Çeşidi:</span>
                <span className="text-slate-800 font-mono font-bold text-sm">{cartItems.length}</span>
              </div>
              
              <div className="flex justify-between items-center text-xs font-medium text-slate-600 border-b border-slate-100 pb-3">
                <span>Toplam Talep Adedi:</span>
                <span className="text-[#dc3545] font-mono font-black text-base">{totalItems} Adet</span>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 p-3 flex gap-2.5 items-start">
                <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] font-medium text-amber-900 leading-relaxed">
                  Gönderdiğiniz talepler Merkez Depo sistemine anlık düşer. Yetkililer fiziki stok durumuna göre miktarları <strong className="text-amber-950 font-bold">approved_qty</strong> üzerinden revize edebilir.
                </p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="w-full bg-[#dc3545] hover:bg-red-700 disabled:bg-slate-400 text-white py-3.5 font-bold uppercase text-xs tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Merkeze İletiliyor...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Talebi Merkez Depoya Gönder
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}