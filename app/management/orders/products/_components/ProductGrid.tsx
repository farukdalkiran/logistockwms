"use client";

import React, { useState, useEffect } from "react";
import { Package, Plus, ChevronDown, X, Info, ShoppingCart, Loader2, CheckCircle2 } from "lucide-react";
import { CartItem } from "@/types/index";

interface ProductGridProps {
  products: any[];
  onAddToCart: (item: CartItem) => void;
  hasMore: boolean;
  onLoadMore: () => void | Promise<void>;
  totalCount: number;
  cartItemCount?: number;
  onOpenCart?: () => void;
}

export default function ProductGrid({ 
  products, 
  onAddToCart, 
  hasMore, 
  onLoadMore, 
  totalCount,
  cartItemCount = 0,
  onOpenCart
}: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; product: string; qty: number } | null>(null);

  // Otomatik Kapanan Minik Toast Lojiği
  useEffect(() => {
    if (toast?.visible) {
      const timer = setTimeout(() => {
        setToast((prev) => (prev ? { ...prev, visible: false } : null));
      }, 2000); // 2 saniyede kaybolur
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleAddToCartWithToast = (item: CartItem) => {
    onAddToCart(item);
    setToast({ visible: true, product: item.name, qty: item.quantity });
  };

  // Asenkron Pagination / Load More Simülasyonu
  const handleLoadMoreClick = async () => {
    setIsLoadingMore(true);
    try {
      await Promise.resolve(onLoadMore());
      // İnternet hızına bağlı yükleme hissiyatını korumak için ufak pay (UX için)
      await new Promise(resolve => setTimeout(resolve, 400));
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (!products || products.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-300 rounded-none shadow-sm w-full">
        <Package size={56} className="mb-4 text-slate-300" />
        <p className="font-mono text-sm uppercase tracking-widest font-black text-slate-500">Kriterlere uygun ürün bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 relative">
      
      {/* KÜÇÜLTÜLMÜŞ VE YUKARI TAŞINMIŞ MİNİ TOAST BİLDİRİMİ */}
      {toast && toast.visible && (
        <div className="fixed bottom-28 right-8 z-[70] animate-in slide-in-from-right-8 fade-in duration-200">
          <div className="bg-slate-800 border-l-4 border-emerald-500 p-2.5 shadow-xl flex items-center gap-3 w-64 rounded-sm">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="text-emerald-400 text-[9px] font-black uppercase tracking-widest leading-none mb-1">EKLENDİ</h4>
              <p className="text-white text-[11px] font-bold truncate leading-none">{toast.product}</p>
            </div>
            <div className="bg-slate-700 px-2 py-1 rounded-sm text-white text-[10px] font-mono font-black shrink-0">
              +{toast.qty}
            </div>
          </div>
        </div>
      )}

      {/* ZIPLAYAN SAĞ ALT SEPET BUTONU */}
      {cartItemCount > 0 && onOpenCart && (
        <button
          onClick={onOpenCart}
          className="fixed bottom-8 right-8 z-[60] bg-[#dc3545] hover:bg-red-700 text-white p-4 shadow-[0_5px_15px_rgba(220,53,69,0.5)] animate-bounce transition-colors border-2 border-slate-900 cursor-pointer rounded-xl flex items-center justify-center group"
          title="Sepeti Görüntüle"
        >
          <ShoppingCart size={28} className="group-hover:scale-110 transition-transform" />
          <span className="absolute -top-3 -right-3 bg-white text-[#dc3545] font-black text-sm w-8 h-8 flex items-center justify-center border-2 border-slate-900 rounded-xl shadow-md">
            {cartItemCount}
          </span>
        </button>
      )}

      {/* ÜRÜN GRID YAPISI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
        {products.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onAddToCart={handleAddToCartWithToast} 
            onInspect={() => setSelectedProduct(product)}
          />
        ))}
      </div>

      {/* DAHA FAZLA YÜKLE BUTONU VE ANİMASYONU */}
      {hasMore && (
        <div className="mt-8 flex flex-col items-center justify-center border-t border-slate-300 pt-8 pb-4 w-full">
          <p className="text-[11px] text-slate-500 mb-3 font-mono font-bold uppercase tracking-widest">
            {products.length} / {totalCount} Ürün Gösteriliyor
          </p>
          <button
            onClick={handleLoadMoreClick}
            disabled={isLoadingMore}
            className="flex items-center gap-2 bg-slate-800 border border-slate-800 hover:bg-[#dc3545] hover:border-[#dc3545] disabled:bg-slate-600 disabled:border-slate-600 disabled:cursor-not-allowed text-white px-8 py-3 rounded-none text-xs font-black uppercase tracking-widest transition-colors shadow-md cursor-pointer"
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <ChevronDown size={18} />
                Daha Fazla Yükle
              </>
            )}
          </button>
        </div>
      )}

      {selectedProduct && (
        <ProductDetailModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onAddToCart={handleAddToCartWithToast}
        />
      )}
    </div>
  );
}

function ProductCard({ product, onAddToCart, onInspect }: { product: any, onAddToCart: (item: CartItem) => void, onInspect: () => void }) {
  const [qty, setQty] = useState<number>(1);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (qty > 0) {
      onAddToCart({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        image_url: product.image_url,
        quantity: qty
      });
      setQty(1);
    }
  };

  return (
    <div 
      onClick={onInspect}
      className="bg-white border border-slate-300 flex flex-col hover:border-[#dc3545] hover:shadow-xl transition-all duration-200 group rounded-none overflow-hidden cursor-pointer w-full"
    >
      <div className="h-48 bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors z-10 flex items-center justify-center opacity-0 group-hover:opacity-100">
           <span className="bg-slate-900 text-white text-[11px] font-black px-4 py-2 uppercase tracking-widest transform translate-y-4 group-hover:translate-y-0 transition-all flex items-center gap-2 shadow-lg border border-slate-700">
             <Info size={16} className="text-[#dc3545]" /> İncele
           </span>
        </div>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
        ) : (
          <Package size={48} className="text-slate-300 group-hover:scale-110 transition-transform duration-500" />
        )}
      </div>
      
      <div className="bg-slate-800 border-t-2 border-[#dc3545] p-3.5 flex flex-col flex-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block truncate">
          {product.category || "KATEGORİSİZ"}
        </span>
        
        <div className="flex-1 mb-4">
          <h3 className="text-xs font-bold text-white leading-snug line-clamp-2" title={product.name}>
            {product.name}
          </h3>
          <p className="text-[11px] font-mono text-[#dc3545] mt-1.5 font-black tracking-wider">
            SKU: {product.sku || "N/A"}
          </p>
        </div>
        
        <div className="flex items-center gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-14 h-9 px-1 text-center bg-slate-700 border border-slate-600 text-white text-xs focus:outline-none focus:border-[#dc3545] font-mono font-bold rounded-none"
          />
          <button 
            onClick={handleAdd}
            className="flex-1 h-9 bg-[#dc3545] hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 rounded-none shadow-md cursor-pointer"
          >
            <Plus size={16} />
            Talep Et
          </button>
        </div>
      </div>
    </div>
  );
}

// BÜYÜTÜLMÜŞ VE BLUR'U KALDIRILMIŞ İNCELE MODALI
function ProductDetailModal({ product, onClose, onAddToCart }: { product: any, onClose: () => void, onAddToCart: (item: CartItem) => void }) {
  const [qty, setQty] = useState<number>(1);

  const handleAdd = () => {
    if (qty > 0) {
      onAddToCart({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        image_url: product.image_url,
        quantity: qty
      });
      onClose();
    }
  };

  // Yüksek çözünürlüklü görsel tespiti (K.jpg -> B.jpg çevrimi)
  const highResImageUrl = product.image_url ? product.image_url.replace(/K\.jpg$/i, 'B.jpg') : null;

  return (
    // Blur efekti tamamen kaldırıldı, mat siyah (bg-slate-900/80) kullanıldı.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80">
      <div className="relative bg-white rounded-none shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden border-2 border-slate-900 animate-in fade-in zoom-in-95 duration-200">
        
        {/* SOL TARAF - YÜKSEK ÇÖZÜNÜRLÜKLÜ DEVASA GÖRSEL ALANI */}
        <div className="w-full md:w-3/5 bg-slate-50 p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 relative min-h-[300px] md:min-h-[500px]">
           <span className="absolute top-4 left-4 bg-slate-800 text-white text-[11px] px-3 py-1 font-mono font-bold tracking-widest shadow-sm">
             BARKOD: {product.barcode || "YOK"}
           </span>
           {highResImageUrl ? (
             <img src={highResImageUrl} alt={product.name} className="w-full h-auto max-h-[26rem] object-contain drop-shadow-md" />
           ) : (
             <Package size={120} className="text-slate-300" />
           )}
        </div>

        {/* SAĞ TARAF - ÜRÜN DETAYLARI VE AKSİYON */}
        <div className="w-full md:w-2/5 p-8 flex flex-col justify-between bg-white">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="pr-4">
                <span className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest bg-red-50 px-2.5 py-1 border border-red-100">
                  {product.category || "Kategori Belirtilmemiş"}
                </span>
                <h2 className="text-xl font-black text-slate-900 leading-tight mt-3">
                  {product.name}
                </h2>
                <p className="text-sm font-mono text-slate-500 mt-2 font-bold tracking-wider">
                  SKU: {product.sku || "N/A"}
                </p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-[#dc3545] p-1.5 cursor-pointer bg-slate-100 hover:bg-red-50 transition-colors shrink-0 border border-transparent hover:border-red-200">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 text-xs text-slate-700 mb-6 font-mono flex flex-col gap-2">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-500">Sipariş Limiti:</span>
                <strong className="text-slate-900">{product.max_order_limit || "Sınırsız"}</strong>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold text-slate-500">Sarf Malzeme:</span>
                <strong className="text-slate-900">{product.is_consumable ? "Evet" : "Hayır"}</strong>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-[11px] font-black text-slate-800 uppercase mb-2.5 tracking-widest">Talep Miktarı</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-24 h-12 px-2 text-center border border-slate-300 text-base focus:outline-none focus:border-[#dc3545] font-mono rounded-none bg-white font-black text-slate-900"
              />
              <button 
                onClick={handleAdd}
                className="flex-1 h-12 bg-[#dc3545] hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-none shadow-md cursor-pointer border border-transparent"
              >
                <Plus size={18} />
                Sepete Ekle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}