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

  const items: CatalogItem[] = mode === "products" ? recentProducts : recentBoxes;
  const selectedProduct = selected && !isBox(selected) ? selected : null;
  const selectedBox = selected && isBox(selected) ? selected : null;

  return (
    <>
      <section className="lg:col-span-4 flex h-[600px] min-w-0 w-full flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-slate-200 bg-slate-50 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-md border border-slate-300 bg-white p-2 shadow-sm">
              <Boxes className="h-5 w-5 text-slate-700" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Son Katalog Kayıtları
              </h3>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Ürün ve koli tanımları · Salt okunur
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void loadRecent()}
            disabled={isLoadingRecent}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-[#dc3545] hover:text-[#dc3545] disabled:opacity-50"
            aria-label="Son katalog kayıtlarını yenile"
            title="Son kayıtları yenile"
          >
            <RefreshCw size={15} className={isLoadingRecent ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:border-[#dc3545] hover:text-[#dc3545]"
            aria-label="Ürün veya koli ara"
          >
            <Search size={15} />
            <span className="hidden sm:inline">ARA</span>
          </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3" role="tablist" aria-label="Son kayıt türü">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "products"}
            onClick={() => chooseMode("products")}
            className={"flex min-h-11 items-center justify-center gap-2 rounded-md border px-2 text-[11px] font-black transition " +
              (mode === "products"
                ? "border-[#dc3545] bg-red-50 text-[#b42332]"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100")}
          >
            <Package size={16} />
            Son 10 Ürün
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "boxes"}
            onClick={() => chooseMode("boxes")}
            className={"flex min-h-11 items-center justify-center gap-2 rounded-md border px-2 text-[11px] font-black transition " +
              (mode === "boxes"
                ? "border-[#dc3545] bg-red-50 text-[#b42332]"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100")}
          >
            <Box size={16} />
            Son 10 Koli
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {mode === "products" ? "En son eklenen ürünler" : "En son tanımlanan koliler"}
          </span>
          <span className="font-mono text-[10px] font-bold text-slate-400">{items.length} kayıt</span>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {items.map((item) => {
            const box = isBox(item);
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => openModal(item)}
                className="group flex min-h-[65px] w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#dc3545]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                  {box ? <Box size={19} className="text-indigo-600" /> : <Package size={19} className="text-purple-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-black text-slate-800">
                    {box ? item.products?.name || "Ürünü belirtilmemiş koli" : item.name}
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] font-bold text-slate-500">
                    {box ? item.box_barcode : item.barcode}
                    {box ? " · " + item.quantity + " adet" : item.sku ? " · " + item.sku : ""}
                  </p>
                  <p className="mt-1 text-[9px] font-medium text-slate-400">
                    LGS #{item.lgs_id} · {formatDate(item.created_at)}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-400 group-hover:text-[#dc3545]" />
              </button>
            );
          })}
          {recentError && (
            <div role="alert" className="mx-3 mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              {recentError}
              <button type="button" onClick={() => void loadRecent()} className="mt-2 block text-[#b42332] underline">
                Tekrar dene
              </button>
            </div>
          )}
          {items.length === 0 && !recentError && (
            <div className="flex h-44 flex-col items-center justify-center gap-2 p-4 text-center text-slate-400">
              <Boxes size={28} />
              <p className="text-xs font-semibold">
                {isLoadingRecent ? "Son kayıtlar yükleniyor..." : "Henüz kayıt bulunamadı."}
              </p>
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            onClick={() => openModal()}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white text-xs font-black text-slate-700 transition hover:border-[#dc3545] hover:text-[#dc3545]"
          >
            <Search size={16} /> Ürün veya koli arat
          </button>
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
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
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
                        {box ? <Box className="shrink-0 text-indigo-600" size={18} /> : <Package className="shrink-0 text-purple-600" size={18} />}
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
