"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ShoppingCart, Search, Filter, Box, ArrowDownWideNarrow, Layers, Building2, ShieldCheck, AlertTriangle, CheckCircle2, X } from "lucide-react";
import ProductGrid from "./ProductGrid";
import OrderCartView from "./OrderCartView";
import { CartItem } from "@/types/index";

interface OrderClientWrapperProps {
  initialProducts: any[];
}

export default function OrderClientWrapper({ initialProducts }: OrderClientWrapperProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Varsayılan sıralama "En Yeniler"
  const [sortBy, setSortBy] = useState<string>("newest");
  
  const [pageSize, setPageSize] = useState<number>(28);
  const [visibleCount, setVisibleCount] = useState<number>(28);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  
  // WMS Endüstriyel Toast State
  const [toast, setToast] = useState<{ visible: boolean; product: string; qty: number } | null>(null);

  const handleAddToCart = (item: CartItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });

    setToast({ visible: true, product: item.name, qty: item.quantity });
  };

  useEffect(() => {
    if (toast?.visible) {
      const timer = setTimeout(() => {
        setToast((prev) => (prev ? { ...prev, visible: false } : null));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(initialProducts.map((p) => p.category).filter(Boolean)));
    cats.sort((a, b) => a.localeCompare(b, "tr"));
    return ["Tümü", ...cats];
  }, [initialProducts]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = initialProducts.filter((p) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query);
      const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      if (sortBy === "name-asc") return (a.name || "").localeCompare(b.name || "", "tr");
      if (sortBy === "sku-asc") return (a.sku || "").localeCompare(b.sku || "", "tr");
      
      if (sortBy === "newest") {
        // created_at verisi varsa zaman damgasına göre (Time) kıyasla (En yeni en üstte)
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        // Fallback: Eğer orders.ts'den created_at çekilmeyi unutulduysa eski string ID metoduna düş
        return String(b.id || "").localeCompare(String(a.id || ""));
      }
      return 0;
    });

    return result;
  }, [initialProducts, searchQuery, selectedCategory, sortBy]);

  const displayedProducts = filteredAndSortedProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAndSortedProducts.length;

  return (
    <div className="flex flex-col w-full min-w-0 bg-slate-50 min-h-screen relative pb-12">
      


      {/* Yönetim Paneli Hero */}
      <div 
        className="relative bg-slate-800 text-white border-b-4 border-[#dc3545] p-6 shadow-md bg-cover bg-center rounded-none shrink-0"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1586528116311-ad8ed7c83a7f?q=80&w=2070&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 bg-slate-900/85"></div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#dc3545]/10 border border-[#dc3545] text-[#dc3545] rounded-none shadow-sm hidden sm:flex">
              <Box size={28} />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest flex items-center gap-2 drop-shadow-md text-white">
                B2B Ticari Ürün Sipariş Paneli
              </h1>
              <p className="text-slate-300 text-[11px] font-mono mt-1 font-bold">
                {showCart ? "Sipariş Onay ve Sepet Özeti" : `Aktif Katalog: ${initialProducts.length} Ürün | Merkez Depo Eş Zamanlı Talep Havuzu`}
              </p>
            </div>
          </div>

          {showCart ? (
            <button
              onClick={() => setShowCart(false)}
              className="bg-white hover:bg-slate-200 text-slate-900 px-6 py-3 font-black uppercase text-xs tracking-widest transition-colors flex items-center gap-2 border border-slate-300 rounded-none shadow-sm cursor-pointer"
            >
              Kataloğa Geri Dön
            </button>
          ) : (
            <button
              onClick={() => setShowCart(true)}
              className="relative bg-[#dc3545] hover:bg-red-700 text-white px-6 py-3 font-black uppercase text-xs tracking-widest transition-colors flex items-center gap-2 rounded-none shadow-[0_0_15px_rgba(220,53,69,0.3)] cursor-pointer"
            >
              <ShoppingCart size={18} />
              Sepeti Görüntüle
              {cartItems.length > 0 && (
                <span className="absolute -top-3 -right-3 bg-white text-[#dc3545] font-black text-xs w-7 h-7 flex items-center justify-center border-2 border-[#dc3545] rounded-none shadow-lg animate-pulse">
                  {cartItems.length}
                </span>
              )}
            </button>
          )}
        </div>

        {!showCart && (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-700 text-[11px] text-slate-300">
            <div className="flex items-center gap-3 bg-slate-800/60 p-3 border border-slate-700">
              <Building2 size={18} className="text-[#dc3545] shrink-0" />
              <span><strong className="text-white uppercase tracking-wider">Senkronizasyon:</strong> Talepler anlık merkeze düşer.</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-800/60 p-3 border border-slate-700">
              <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
              <span><strong className="text-white uppercase tracking-wider">Fiziki Stok:</strong> Onaylar fiziki stoğa göredir.</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-800/60 p-3 border border-slate-700">
              <AlertTriangle size={18} className="text-amber-500 shrink-0" />
              <span><strong className="text-white uppercase tracking-wider">Revizyon:</strong> Adetler merkezce revize edilebilir.</span>
            </div>
          </div>
        )}
      </div>

      <div className="w-full px-4 lg:px-6 pt-6">
        {showCart ? (
          <OrderCartView 
            cartItems={cartItems} 
            setCartItems={setCartItems} 
            onBack={() => setShowCart(false)} 
          />
        ) : (
          <div className="flex flex-col md:flex-row items-stretch w-full min-w-0 gap-6">
            
            {/* KATEGORİ FİLTRESİ */}
            <div className="w-full md:w-64 bg-white border border-slate-300 shadow-sm shrink-0 flex flex-col rounded-none">
              <div className="bg-slate-800 text-white p-4 border-b-4 border-[#dc3545] flex items-center justify-between shrink-0">
                <span className="font-black uppercase text-xs tracking-widest flex items-center gap-2">
                  <Filter size={16} className="text-[#dc3545]" />
                  Kategori
                </span>
                <span className="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 font-mono border border-slate-600">
                  {categories.length} ADET
                </span>
              </div>
              
              <div className="flex flex-col p-2 gap-0.5 flex-1 bg-slate-50">
                {categories.map((cat) => {
                  const isActive = (cat === "Tümü" && !selectedCategory) || selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === "Tümü" ? null : cat)}
                      className={`w-full text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer border-l-4 rounded-none ${
                        isActive
                          ? "bg-slate-800 text-white border-l-[#dc3545]"
                          : "bg-white text-slate-600 border-l-transparent hover:bg-slate-200 hover:text-slate-900 border border-transparent"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ÜRÜN İÇERİK ALANI */}
            <div className="flex-1 flex flex-col min-w-0 w-full gap-4">
              
              <div className="bg-white border border-slate-300 shadow-sm flex flex-col sm:flex-row items-center justify-between p-3 gap-4 rounded-none">
                <div className="relative flex-1 w-full flex items-center">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#dc3545]" size={18} />
                  <input
                    type="text"
                    placeholder="SKU, Barkod veya Ürün Adı..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-none text-xs focus:outline-none focus:border-slate-800 focus:bg-white font-mono font-bold transition-colors"
                  />
                  {/* Arama Temizleme (Clear) İkonu */}
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-[#dc3545] transition-colors p-1"
                      title="Aramayı Temizle"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                  <div className="flex items-center bg-slate-50 border border-slate-300 px-3 py-2 rounded-none">
                    <ArrowDownWideNarrow size={16} className="text-slate-500 mr-2" />
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-transparent text-[11px] font-black text-slate-800 focus:outline-none cursor-pointer appearance-none pr-2 uppercase tracking-wider"
                    >
                      <option value="newest">En Yeniler</option>
                      <option value="name-asc">İsim (A-Z)</option>
                      <option value="sku-asc">SKU (A-Z)</option>
                    </select>
                  </div>

                  <div className="flex items-center bg-slate-50 border border-slate-300 px-3 py-2 rounded-none">
                    <Layers size={16} className="text-slate-500 mr-2" />
                    <select 
                      value={pageSize} 
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="bg-transparent text-[11px] font-black text-slate-800 focus:outline-none cursor-pointer appearance-none pr-2 uppercase tracking-wider font-mono"
                    >
                      <option value={28}>28</option>
                      <option value={56}>56</option>
                      <option value={112}>112</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="w-full min-w-0">
                <ProductGrid 
                  products={displayedProducts}
                  onAddToCart={handleAddToCart}
                  hasMore={hasMore}
                  onLoadMore={() => setVisibleCount((prev) => prev + pageSize)}
                  totalCount={filteredAndSortedProducts.length}
                  cartItemCount={cartItems.length}
                  onOpenCart={() => setShowCart(true)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}