"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { searchHomeCatalogAction } from "@/app/actions/catalog-home";
import { supabase } from "@/lib/supabase";

export type CatalogProduct = {
  id: string;
  name: string;
  barcode: string;
  sku: string | null;
  category: string | null;
  image_url: string | null;
  lgs_id: number;
  created_at: string | null;
  is_consumable: boolean | null;
};

export type CatalogBox = {
  id: string;
  box_barcode: string;
  quantity: number;
  lgs_id: number;
  created_at: string | null;
  products: {
    name: string;
    barcode: string;
    sku: string | null;
    image_url: string | null;
    lgs_id: number;
  } | null;
};

type Mode = "products" | "boxes";
type CatalogItem = CatalogProduct | CatalogBox;

const formatDate = (value: string | null) => {
  if (!value) return "Tarih bilgisi yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tarih bilgisi yok";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const isBox = (item: CatalogItem): item is CatalogBox => "box_barcode" in item;

export function CatalogActivitySection() {
  const [recentProducts, setRecentProducts] = useState<CatalogProduct[]>([]);
  const [recentBoxes, setRecentBoxes] = useState<CatalogBox[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState("");
  const recentRequestVersion = useRef(0);
  const recentLastFetchRef = useRef(0);
  const [mode, setMode] = useState<Mode>("products");
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);

  // Son kayıtlar dashboard cache'ine bağlı değildir. Oturum sahibi kullanıcı
  // products/boxes tablolarındaki SELECT RLS politikalarıyla salt okunur erişir.
  // Her istekte yalnızca 10'ar kayıt çekilir; arka planda polling yapılmaz.
  const loadRecent = useCallback(async () => {
    const requestId = ++recentRequestVersion.current;
    setIsLoadingRecent(true);
    setRecentError("");
    try {
      const [productsResult, boxesResult] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,barcode,sku,category,image_url,lgs_id,created_at,is_consumable")
          .order("created_at", { ascending: false })
          .order("lgs_id", { ascending: false })
          .limit(10),
        supabase
          .from("boxes")
          .select("id,box_barcode,quantity,lgs_id,created_at,products(name,barcode,sku,image_url,lgs_id)")
          .order("created_at", { ascending: false })
          .order("lgs_id", { ascending: false })
          .limit(10),
      ]);
      if (productsResult.error) throw productsResult.error;
      if (boxesResult.error) throw boxesResult.error;
      if (requestId !== recentRequestVersion.current) return;
      recentLastFetchRef.current = Date.now();
      setRecentProducts((productsResult.data || []) as CatalogProduct[]);
      setRecentBoxes(
        (boxesResult.data || []).map((box) => ({
          ...box,
          products: Array.isArray(box.products)
            ? (box.products[0] || null)
            : (box.products || null),
        })) as CatalogBox[]
      );
    } catch (err) {
      console.error("Son katalog kayıtları yüklenemedi:", err);
      if (requestId === recentRequestVersion.current) {
        setRecentError("Son ürün ve koli kayıtları yüklenemedi. Tekrar deneyin.");
      }
    } finally {
      if (requestId === recentRequestVersion.current) setIsLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
    return () => { recentRequestVersion.current += 1; };
  }, [loadRecent]);

  // Listeyi sayfayı yenilemeden, yalnızca Türkiye saatiyle 08:00-17:00
  // arasında ve son başarılı yüklemenin üzerinden 30 dk geçmişse güncelle.
  useEffect(() => {
    const updateIfStale = () => {
      if (document.visibilityState !== "visible") return;
      const hour = Number(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Istanbul", hour: "2-digit", hourCycle: "h23",
      }).format(new Date()));
      if (hour >= 8 && hour < 17 && Date.now() - recentLastFetchRef.current >= 30 * 60 * 1000) {
        void loadRecent();
      }
    };
    const timer = window.setInterval(updateIfStale, 60 * 1000);
    document.addEventListener("visibilitychange", updateIfStale);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateIfStale);
    };
  }, [loadRecent]);

  const closeModal = () => {
    setIsOpen(false);
    setSelected(null);
    setSearchText("");
    setResults([]);
    setError("");
    requestVersion.current += 1;
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    setSelected(null);
    setResults([]);
    setError("");
  };

  const openModal = (item?: CatalogItem) => {
    if (item) setMode(isBox(item) ? "boxes" : "products");
    setSelected(item || null);
    setSearchText("");
    setResults([]);
    setError("");
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKey);
    if (!selected) inputRef.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, selected]);

  useEffect(() => {
    if (!isOpen) return;
    const clean = searchText.trim();
    requestVersion.current += 1;
    const requestId = requestVersion.current;
    if (clean.length < 2) {
      setResults([]);
      setIsSearching(false);
      setError("");
      return;
    }
    setIsSearching(true);
    setError("");

    const timer = window.setTimeout(async () => {
      try {
        const result = await searchHomeCatalogAction(mode, clean);
        if (requestVersion.current !== requestId) return;
        if (result.success) {
          setResults((result.items || []) as CatalogItem[]);
        } else {
          setResults([]);
          setError(result.error || "Arama yapılamadı.");
        }
      } catch {
        if (requestVersion.current === requestId) {
          setResults([]);
          setError("Arama sırasında bağlantı hatası oluştu.");
        }
      } finally {
        if (requestVersion.current === requestId) setIsSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      requestVersion.current += 1;
    };
  }, [isOpen, mode, searchText]);

  const selectedProduct = selected && !isBox(selected) ? selected : null;
  const selectedBox = selected && isBox(selected) ? selected : null;

  return (
    <>
      <section aria-labelledby="catalog-title" className="lg:col-span-7 flex h-[600px] w-full min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <Boxes size={18} className="shrink-0 text-[#dc3545]" />
            <h2 id="catalog-title" className="text-sm font-black tracking-tight text-slate-900">Ürünler ve Koliler</h2>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 shadow-sm transition hover:border-[#dc3545] hover:text-[#dc3545]"
            title="Ürün veya koli ara"
            aria-label="Ürün veya koli ara"
          >
            <Search size={19} />
          </button>
        </header>

        {recentError && (
          <div role="alert" className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
            {recentError}
            <button type="button" onClick={() => void loadRecent()} className="ml-2 underline">Tekrar dene</button>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-100 overflow-y-auto md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="min-w-0 p-3 md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-black text-slate-900"><Package size={18} className="text-[#dc3545]" /> Ürünler</h3>
              </div>

            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {recentProducts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openModal(item)}
                  className="group flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-rose-300 hover:bg-rose-50/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#dc3545]"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                    {item.image_url ? <img src={item.image_url} alt={item.name + " ürün görseli"} loading="lazy" className="h-full w-full object-contain p-1" /> : <Package size={28} className="text-slate-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-extrabold leading-snug text-slate-800">{item.name}</p>
                    <p className="mt-1 truncate font-mono text-[10px] font-bold text-slate-500">{item.sku || item.barcode}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-rose-50 px-1.5 py-1 font-mono text-[10px] font-black text-[#b42332]">#{item.lgs_id}</span>
                      <span className="text-[9px] text-slate-400">{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="hidden shrink-0 text-slate-300 group-hover:text-[#dc3545] sm:block" />
                </button>
              ))}
            </div>
            {!recentError && recentProducts.length === 0 && (
              <p className="rounded-xl bg-slate-50 px-4 py-12 text-center text-xs font-medium text-slate-500">
                {isLoadingRecent ? "Ürünler yükleniyor..." : "Ürün kaydı bulunamadı."}
              </p>
            )}
          </div>
          <div className="min-w-0 p-3 md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-black text-slate-900"><Box size={18} className="text-indigo-600" /> Koliler</h3>
              </div>

            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {recentBoxes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openModal(item)}
                  className="group flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                    {item.products?.image_url ? <img src={item.products.image_url} alt={(item.products?.name || "Koli") + " ürün görseli"} loading="lazy" className="h-full w-full object-contain p-1" /> : <Box size={28} className="text-slate-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-extrabold leading-snug text-slate-800">{item.products?.name || "Ürün bilgisi olmayan koli"}</p>
                    <p className="mt-1 truncate font-mono text-[10px] font-bold text-slate-500">{item.box_barcode}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-indigo-50 px-1.5 py-1 font-mono text-[10px] font-black text-indigo-700">#{item.lgs_id}</span>
                      <span className="text-[10px] font-black text-slate-600">{item.quantity} adet</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="hidden shrink-0 text-slate-300 group-hover:text-indigo-600 sm:block" />
                </button>
              ))}
            </div>
            {!recentError && recentBoxes.length === 0 && (
              <p className="rounded-xl bg-slate-50 px-4 py-12 text-center text-xs font-medium text-slate-500">
                {isLoadingRecent ? "Koliler yükleniyor..." : "Koli kaydı bulunamadı."}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-[10px] font-medium text-slate-500 md:px-5">
          <span>Son eklenen {recentProducts.length} ürün ve {recentBoxes.length} koli listeleniyor.</span>
          <span>Salt okunur katalog · Ayrıntılar için karta tıklayın</span>
        </div>
      </section>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Ürün ve koli bilgi görüntüleme"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-[#142238] px-4 py-4 text-white">
              <div className="flex min-w-0 items-center gap-2">
                <Search size={18} className="text-red-300" />
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider">Katalog Sorgulama</h2>
                  <p className="text-[10px] font-medium text-slate-300">Yalnızca görüntüleme yetkisi</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} aria-label="Pencereyi kapat" className="rounded-md border border-white/20 p-2 hover:bg-white/10">
                <X size={19} />
              </button>
            </div>

            <div className="flex shrink-0 gap-2 border-b border-slate-200 p-3">
              <button type="button" onClick={() => chooseMode("products")} className={"flex-1 rounded-md px-3 py-2.5 text-xs font-black " + (mode === "products" ? "bg-[#142238] text-white" : "bg-slate-100 text-slate-600")}>Ürün ara</button>
              <button type="button" onClick={() => chooseMode("boxes")} className={"flex-1 rounded-md px-3 py-2.5 text-xs font-black " + (mode === "boxes" ? "bg-[#142238] text-white" : "bg-slate-100 text-slate-600")}>Koli ara</button>
            </div>
            <div className="relative shrink-0 px-4 py-3">
              <Search size={17} className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setSelected(null);
                }}
                maxLength={80}
                type="search"
                autoComplete="off"
                placeholder={mode === "products" ? "Ürün adı, barkod, SKU veya LGS ID" : "Koli barkodu, ürün adı veya LGS ID"}
                className="h-12 w-full rounded-md border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-[#dc3545] focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-5">
              {selected ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <button type="button" onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1 text-xs font-black text-slate-600 hover:text-[#dc3545]">
                    <ChevronLeft size={15} /> Sonuçlara dön
                  </button>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white sm:w-28">
                      {(selectedBox?.products?.image_url || selectedProduct?.image_url) ? (
                        <img src={(selectedBox?.products?.image_url || selectedProduct?.image_url) as string} alt="Ürün görseli" className="h-full w-full object-contain" />
                      ) : isBox(selected) ? <Box size={35} className="text-slate-400" /> : <Package size={35} className="text-slate-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{selectedBox ? "Koli tanımı" : "Ürün tanımı"}</span>
                      <h3 className="mt-1 break-words text-base font-black text-slate-900">{selectedBox ? selectedBox.products?.name || "Ürün bilgisi yok" : selectedProduct?.name}</h3>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        {[
                          ["LGS ID", "#" + selected.lgs_id],
                          [selectedBox ? "Koli barkodu" : "Ürün barkodu", selectedBox ? selectedBox.box_barcode : selectedProduct?.barcode || "-"],
                          [selectedBox ? "Koli içi adet" : "SKU", selectedBox ? selectedBox.quantity + " adet" : selectedProduct?.sku || "-"],
                          ["Oluşturulma", formatDate(selected.created_at)],
                          ...(selectedBox ? [["Bağlı ürün barkodu", selectedBox.products?.barcode || "-"], ["Ürün LGS ID", selectedBox.products?.lgs_id ? "#" + selectedBox.products.lgs_id : "-"]] : [["Kategori", selectedProduct?.category || "-"], ["Tür", selectedProduct?.is_consumable ? "Sarf malzeme" : "Ürün"]]),
                        ].map(([label, value]) => (
                          <div key={label} className="rounded border border-slate-200 bg-white p-2.5">
                            <span className="block text-[10px] font-bold text-slate-500">{label}</span>
                            <strong className="mt-1 block break-all font-mono text-[11px] text-slate-800">{value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {isSearching && <p className="py-8 text-center text-xs font-bold text-slate-500">Aranıyor...</p>}
                  {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
                  {!isSearching && !error && searchText.trim().length < 2 && (
                    <p className="py-10 text-center text-xs font-semibold text-slate-500">Aramak için en az 2 karakter girin.</p>
                  )}
                  {!isSearching && !error && searchText.trim().length >= 2 && results.length === 0 && (
                    <p className="py-10 text-center text-xs font-semibold text-slate-500">Eşleşen kayıt bulunamadı.</p>
                  )}
                  {!isSearching && results.map((item) => {
                    const box = isBox(item);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setSelected(item)}
                        className="flex w-full items-center gap-3 border-b border-slate-100 px-2 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {(box ? item.products?.image_url : item.image_url) ? (
                            <img src={(box ? item.products?.image_url : item.image_url) as string} alt="Ürün görseli" loading="lazy" className="h-full w-full object-contain p-1" />
                          ) : box ? <Box className="text-indigo-500" size={22} /> : <Package className="text-purple-500" size={22} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800">{box ? item.products?.name || item.box_barcode : item.name}</p>
                          <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                            {box ? item.box_barcode + " · " + item.quantity + " adet" : item.barcode}
                            {" · LGS #" + item.lgs_id}
                          </p>
                        </div>
                        <ChevronRight size={15} className="shrink-0 text-slate-400" />
                      </button>
                    );
                  })}
                </>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-semibold text-slate-500">
              {isSearching ? "Aranıyor..." : searchText.trim().length >= 2 ? results.length + " sonuç (en fazla 25)" : "Ürün ve koli kayıtları"}
              {" · Düzenleme ve silme işlemleri kapalı"}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
