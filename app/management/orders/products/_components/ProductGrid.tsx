
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Minus,
  ArrowUp,
  ShoppingCart,
  ShoppingBasket,
  ExternalLink,
  PackageSearch,
  ImageOff,
  Check,
  Boxes,
  Search,
} from "lucide-react";
import { CartItem } from "@/types";

interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  image_url?: string;
  consumables?: boolean;
  comsunables?: boolean;
  is_consumable?: boolean;
  item_class?: string;
}

interface ProductGridProps {
  products: Product[];
  onAddToCart: (item: CartItem) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  totalCount: number;
  cartItemCount: number;
  onOpenCart: () => void;
}

const COLORS = {
  yellow: "#FFE722",
  red: "#DC3545",
  green: "#16A34A",
  dark: "#0F172A",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  surface: "#F8FAFC",
  white: "#FFFFFF",
};

// Veritabanından farklı tiplerde gelen boolean değerler
const checkTrue = (val: unknown) =>
  val === true ||
  val === "true" ||
  val === 1 ||
  val === "1";

// Ürün görseli, hata durumunda boş görsel alanı
function ProductImage({
  src,
  name,
}: {
  src?: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div
          className="w-14 h-14 flex items-center justify-center rounded-[4px]"
          style={{
            backgroundColor: "#F1F5F9",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <ImageOff
            size={25}
            strokeWidth={1.5}
            color="#94A3B8"
          />
        </div>

        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
          Görsel Bulunamadı
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className="pg-product-image absolute inset-0 w-full h-full object-contain p-4 sm:p-5"
    />
  );
}

export default function ProductGrid({
  products,
  onAddToCart,
  hasMore,
  onLoadMore,
  totalCount,
  cartItemCount,
  onOpenCart,
}: ProductGridProps) {
  const [quantities, setQuantities] = useState<
    Record<string, number | "">
  >({});

  const [addedStates, setAddedStates] = useState<
    Record<string, boolean>
  >({});

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Zamanlayıcı temizliği
  const addTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  useEffect(() => {
    setIsMounted(true);

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(addTimers.current).forEach(clearTimeout);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ADET ARTIRMA / AZALTMA
  const handleQuantityChange = (
    productId: string,
    delta: number
  ) => {
    setQuantities((prev) => {
      const current =
        typeof prev[productId] === "number"
          ? (prev[productId] as number)
          : 1;

      const next = current + delta;

      return {
        ...prev,
        [productId]: next > 0 ? next : 1,
      };
    });
  };

  // MANUEL ADET
  const handleManualQuantityChange = (
    productId: string,
    value: string
  ) => {
    if (value === "") {
      setQuantities((prev) => ({
        ...prev,
        [productId]: "",
      }));
      return;
    }

    const parsed = parseInt(value, 10);

    if (!isNaN(parsed) && parsed >= 0) {
      setQuantities((prev) => ({
        ...prev,
        [productId]: parsed,
      }));
    }
  };

  const handleQuantityBlur = (productId: string) => {
    setQuantities((prev) => {
      const current = prev[productId];

      if (
        current === "" ||
        current === 0 ||
        isNaN(Number(current))
      ) {
        return {
          ...prev,
          [productId]: 1,
        };
      }

      return prev;
    });
  };

  // SEPETE EKLEME MOTORU KORUNDU
  const handleAddToCart = useCallback(
    (product: Product) => {
      const rawQty = quantities[product.id];

      const qty =
        typeof rawQty === "number" && rawQty > 0
          ? rawQty
          : 1;

      onAddToCart({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        image_url: product.image_url || null,
        quantity: qty,
      });

      setAddedStates((prev) => ({
        ...prev,
        [product.id]: true,
      }));

      // Önceki zamanlayıcıyı temizle
      if (addTimers.current[product.id]) {
        clearTimeout(addTimers.current[product.id]);
      }

      addTimers.current[product.id] = setTimeout(() => {
        setAddedStates((prev) => ({
          ...prev,
          [product.id]: false,
        }));

        setQuantities((prev) => ({
          ...prev,
          [product.id]: 1,
        }));

        delete addTimers.current[product.id];
      }, 1500);
    },
    [quantities, onAddToCart]
  );

  const cartBadgeCount =
    cartItemCount > 99 ? "99+" : cartItemCount;

  const displayedTotal =
    totalCount > 0 ? totalCount : products.length;

  const progress =
    displayedTotal > 0
      ? Math.min(
          100,
          (products.length / displayedTotal) * 100
        )
      : 0;

  // SABİT SEPET / YUKARI ÇIK BUTONLARI
  const FloatingActions = () => {
    const visible = showScrollTop || cartItemCount > 0;

    return (
      <div
        className="pg-floating-actions"
        style={{
          position: "fixed",
          right: "16px",
          bottom: "max(16px, env(safe-area-inset-bottom))",
          zIndex: 2147483647,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "10px",
          opacity: visible ? 1 : 0,
          transform: visible
            ? "translateY(0)"
            : "translateY(25px)",
          pointerEvents: visible ? "auto" : "none",
          transition: "opacity .25s, transform .25s",
        }}
      >
        {cartItemCount > 0 && (
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Sepeti aç, ${cartItemCount} adet ürün`}
            className="pg-floating-cart flex items-center gap-3 px-4 py-3 rounded-[4px] shadow-xl"
            style={{
              backgroundColor: COLORS.dark,
              border: `2px solid ${COLORS.yellow}`,
              color: COLORS.white,
            }}
          >
            <div className="relative">
              <ShoppingCart
                size={23}
                color={COLORS.yellow}
                strokeWidth={2.2}
              />
            </div>

            <div className="flex flex-col text-left">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                TALEP SEPETİ
              </span>

              <span className="text-sm font-black leading-tight">
                {cartBadgeCount} ADET
              </span>
            </div>
          </button>
        )}

        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Sayfanın başına git"
            title="Yukarı çık"
            className="pg-scroll-top w-11 h-11 flex items-center justify-center rounded-[4px] shadow-lg"
            style={{
              backgroundColor: COLORS.yellow,
              color: COLORS.dark,
              border: `1px solid ${COLORS.dark}`,
            }}
          >
            <ArrowUp size={20} strokeWidth={2.7} />
          </button>
        )}
      </div>
    );
  };

  // BOŞ ÜRÜN DURUMU
  if (products.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center py-24 px-5 border border-dashed rounded-[4px]"
        style={{
          backgroundColor: COLORS.surface,
          borderColor: "#CBD5E1",
        }}
      >
        <div
          className="w-16 h-16 flex items-center justify-center mb-5 rounded-[4px]"
          style={{
            backgroundColor: "#FEF9C3",
            color: COLORS.dark,
          }}
        >
          <PackageSearch size={31} strokeWidth={1.7} />
        </div>

        <h3
          className="text-lg font-black uppercase tracking-wider"
          style={{ color: COLORS.text }}
        >
          Ürün Bulunamadı
        </h3>

        <p
          className="text-xs sm:text-sm font-semibold text-center mt-2"
          style={{ color: COLORS.muted }}
        >
          Arama kriterlerinize uygun ürün kaydı bulunamadı.
        </p>
      </div>
    );
  }

  return (
    <section className="pg-catalog relative w-full pb-24 font-['Quicksand']">
      <style>{`
        /* KATALOG BİLEŞENİNE ÖZEL STILLER */

        .pg-catalog {
          --pg-yellow: #FFE722;
          --pg-red: #DC3545;
          --pg-dark: #0F172A;
          --pg-border: #E2E8F0;
        }

        .pg-card {
          position: relative;
          isolation: isolate;
          border: 1px solid var(--pg-border);
          border-radius: 4px;
          overflow: hidden;
          background: #FFFFFF;
          transition:
            border-color .25s ease,
            box-shadow .25s ease,
            transform .25s ease;
        }

        .pg-card::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 3px;
          background: var(--pg-yellow);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .3s ease;
          z-index: 5;
        }

        .pg-card:hover {
          border-color: #E6C900;
          transform: translateY(-4px);
          box-shadow:
            0 10px 24px rgba(15,23,42,.08);
        }

        .pg-card:hover::before {
          transform: scaleX(1);
        }

        .pg-card:focus-within {
          border-color: #E6C900;
        }

        .pg-product-image {
          transition: transform .35s ease;
        }

        .pg-card:hover .pg-product-image {
          transform: scale(1.045);
        }

        /* ADET ALANI */
        .pg-quantity-input {
          appearance: textfield;
          -moz-appearance: textfield;
        }

        .pg-quantity-input::-webkit-outer-spin-button,
        .pg-quantity-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .pg-qty-button {
          transition: background-color .2s ease;
        }

        .pg-qty-button:hover:not(:disabled) {
          background-color: #E2E8F0 !important;
        }

        .pg-qty-button:focus-visible,
        .pg-quantity-input:focus-visible,
        .pg-add-button:focus-visible,
        .pg-lego-link:focus-visible {
          outline: 2px solid #0F172A;
          outline-offset: 2px;
        }

        /* TALEP BUTONU */
        .pg-add-button {
          transition:
            filter .2s ease,
            transform .2s ease;
        }

        .pg-add-button:hover:not(:disabled) {
          filter: brightness(.92);
        }

        .pg-add-button:active:not(:disabled) {
          transform: scale(.97);
        }

        /* LEGO.TR BUTONU */
        .pg-lego-link {
          transition:
            filter .2s ease,
            transform .2s ease;
        }

        .pg-lego-link:hover {
          filter: brightness(.96);
        }

        .pg-lego-link:hover .pg-external-icon {
          transform: translate(2px, -2px);
        }

        .pg-external-icon {
          transition: transform .2s ease;
        }

        /* SABİT BUTONLAR */
        .pg-floating-cart,
        .pg-scroll-top {
          transition: transform .2s ease, filter .2s ease;
        }

        .pg-floating-cart:hover,
        .pg-scroll-top:hover {
          transform: translateY(-3px);
        }

        @media (prefers-reduced-motion: reduce) {
          .pg-card,
          .pg-card::before,
          .pg-product-image,
          .pg-add-button,
          .pg-lego-link,
          .pg-floating-cart,
          .pg-scroll-top {
            transition: none;
          }

          .pg-card:hover,
          .pg-card:hover .pg-product-image {
            transform: none;
          }
        }
      `}</style>

      {/* KATALOG BAŞLIĞI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-[4px] shrink-0"
            style={{
              backgroundColor: COLORS.yellow,
              color: COLORS.dark,
            }}
          >
            <Boxes size={21} strokeWidth={2.2} />
          </div>

          <div className="min-w-0">
            <h2
              className="text-base sm:text-lg font-black uppercase tracking-wider"
              style={{ color: COLORS.dark }}
            >
              Ürün Kataloğu
            </h2>

            <p
              className="text-[11px] font-semibold mt-0.5"
              style={{ color: COLORS.muted }}
            >
              Ürün seçin, miktar belirleyin ve talebe ekleyin.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-3 px-3 py-2 rounded-[4px] border w-fit"
          style={{
            backgroundColor: COLORS.white,
            borderColor: COLORS.border,
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: COLORS.green }}
          />

          <span
            className="text-[10px] font-black uppercase tracking-wider"
            style={{ color: COLORS.muted }}
          >
            GÖSTERİLEN
          </span>

          <span
            className="font-mono text-sm font-black"
            style={{ color: COLORS.dark }}
          >
            {products.length.toLocaleString("tr-TR")}
            <span className="text-slate-300 mx-1">/</span>
            {displayedTotal.toLocaleString("tr-TR")}
          </span>
        </div>
      </div>

      {/* ÜRÜN GRİD: MASAÜSTÜ 4 SÜTUN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
        {products.map((product) => {
          const qty =
            quantities[product.id] !== undefined
              ? quantities[product.id]
              : 1;

          const isAdded = Boolean(addedStates[product.id]);

          // SARF MALZEMESİ TESPİTİ
          const isConsumable =
            checkTrue(product.is_consumable) ||
            checkTrue(product.consumables) ||
            checkTrue(product.comsunables);

          // APPAREL TESPİTİ
          const isApparel =
            String(product.item_class).toUpperCase() ===
              "APPAREL" ||
            String(product.category).toUpperCase() ===
              "APPAREL";

          // ORİJİNAL LEGO.TR GÖSTERİM KURALI
          const showLegoLink =
            !isConsumable &&
            !isApparel &&
            Boolean(product.sku);

          const legoUrl = `https://lego.tr/arama?q=${encodeURIComponent(
            product.sku || ""
          )}`;

          return (
            <article
              key={product.id}
              className="pg-card group flex flex-col min-w-0 h-full"
            >
              {/* KARE ÜRÜN GÖRSELİ */}
              <div
                className="relative aspect-square w-full overflow-hidden"
                style={{ backgroundColor: COLORS.surface }}
              >
                {/* Hafif arka plan noktaları */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-30"
                  style={{
                    backgroundImage:
                      "radial-gradient(#CBD5E1 0.7px, transparent 0.7px)",
                    backgroundSize: "16px 16px",
                  }}
                />

                <ProductImage
                  src={product.image_url}
                  name={product.name}
                />

                {/* Üst etiketler */}
                <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2 pointer-events-none">
                  <span
                    className="min-w-0 max-w-[72%] px-2.5 py-1.5 rounded-[3px] text-[9px] font-black uppercase tracking-wide truncate shadow-sm"
                    title={product.category || "GENEL"}
                    style={{
                      backgroundColor: COLORS.dark,
                      color: COLORS.white,
                    }}
                  >
                    {product.category || "GENEL"}
                  </span>

                  {(isConsumable || isApparel) && (
                    <span
                      className="shrink-0 px-2 py-1.5 rounded-[3px] text-[9px] font-black uppercase tracking-wide"
                      style={{
                        backgroundColor: COLORS.yellow,
                        color: COLORS.dark,
                      }}
                    >
                      {isConsumable ? "SARF" : "GİYİM"}
                    </span>
                  )}
                </div>
              </div>

              {/* ÜRÜN BİLGİLERİ */}
              <div className="flex flex-col flex-1 min-w-0 p-3.5 sm:p-4">

                {/* SKU */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span
                    className="min-w-0 max-w-full px-2 py-1.5 font-mono text-[11px] font-black tracking-wide truncate rounded-[3px]"
                    style={{
                      backgroundColor: "#F1F5F9",
                      color: "#475569",
                    }}
                    title={product.sku || "SKU-YOK"}
                  >
                    {product.sku || "SKU-YOK"}
                  </span>

                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
                    SKU
                  </span>
                </div>

                {/* ÜRÜN ADI */}
                <h3
                  className="mt-3 text-[13px] sm:text-sm font-black leading-snug line-clamp-2 min-h-[40px]"
                  style={{ color: COLORS.text }}
                  title={product.name}
                >
                  {product.name}
                </h3>

                {/* BARKOD */}
                <div className="mt-2 h-[18px] min-w-0 flex items-center">
                  {product.barcode ? (
                    <span
                      className="truncate font-mono text-[10px]"
                      style={{ color: "#94A3B8" }}
                      title={`Barkod: ${product.barcode}`}
                    >
                      BARKOD: {product.barcode}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300">
                      &nbsp;
                    </span>
                  )}
                </div>

                {/* ALT AKSİYONLAR */}
                <div className="mt-auto pt-4 flex flex-col gap-2.5">

                  {/* LEGO.TR BAĞLANTISI */}
                  {showLegoLink ? (
                    <a
                      href={legoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${product.sku} kodunu LEGO.TR üzerinde ara`}
                      aria-label={`${product.name} ürününü LEGO.TR üzerinde ara, yeni sekmede aç`}
                      className="pg-lego-link w-full h-9 flex items-center justify-between gap-2 px-3 rounded-[4px] no-underline"
                      style={{
                        backgroundColor: COLORS.yellow,
                        color: COLORS.dark,
                        border: `1px solid #EACF00`,
                        textDecoration: "none",
                      }}
                    >
                      <span className="min-w-0 flex items-center gap-2">
                        <Search
                          size={14}
                          strokeWidth={2.5}
                          className="shrink-0"
                        />

                        <span className="text-[10px] font-black uppercase tracking-wide truncate">
                          LEGO.TR'DE AÇ
                        </span>
                      </span>

                      <ExternalLink
                        size={15}
                        strokeWidth={2.5}
                        className="pg-external-icon shrink-0"
                      />
                    </a>
                  ) : (
                    <div
                      className="h-9 px-3 flex items-center gap-2 rounded-[4px] border border-dashed min-w-0"
                      style={{
                        backgroundColor: "#FAFAFA",
                        borderColor: COLORS.border,
                        color: "#94A3B8",
                      }}
                    >
                      <ExternalLink
                        size={14}
                        className="shrink-0"
                      />

                      <span className="text-[9px] font-bold uppercase tracking-wide truncate">
                        {isConsumable
                          ? "Sarf Malzemesi"
                          : isApparel
                          ? "Giyim Ürünü"
                          : "SKU Bulunamadı"}
                      </span>
                    </div>
                  )}

                  {/* ADET + TALEBE EKLE AYNI SATIR */}
                  <div className="grid grid-cols-[98px_minmax(0,1fr)] gap-2 w-full min-w-0">

                    {/* ADET SEÇİCİ */}
                    <div
                      className="h-10 flex items-center overflow-hidden min-w-0 rounded-[4px]"
                      style={{
                        border: `1px solid ${COLORS.border}`,
                        backgroundColor: COLORS.white,
                      }}
                    >
                      <button
                        type="button"
                        aria-label={`${product.name} adet azalt`}
                        onClick={() =>
                          handleQuantityChange(
                            product.id,
                            -1
                          )
                        }
                        className="pg-qty-button w-[29px] h-full shrink-0 flex items-center justify-center"
                        style={{
                          backgroundColor: "#F1F5F9",
                          color: COLORS.text,
                        }}
                      >
                        <Minus
                          size={14}
                          strokeWidth={2.5}
                        />
                      </button>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        aria-label={`${product.name} talep adedi`}
                        value={qty}
                        onChange={(e) =>
                          handleManualQuantityChange(
                            product.id,
                            e.target.value
                          )
                        }
                        onBlur={() =>
                          handleQuantityBlur(product.id)
                        }
                        className="pg-quantity-input flex-1 min-w-0 w-full h-full text-center text-xs font-black outline-none border-0 p-0"
                        style={{
                          color: COLORS.dark,
                          backgroundColor: COLORS.white,
                        }}
                      />

                      <button
                        type="button"
                        aria-label={`${product.name} adet artır`}
                        onClick={() =>
                          handleQuantityChange(
                            product.id,
                            1
                          )
                        }
                        className="pg-qty-button w-[29px] h-full shrink-0 flex items-center justify-center"
                        style={{
                          backgroundColor: "#F1F5F9",
                          color: COLORS.text,
                        }}
                      >
                        <Plus
                          size={14}
                          strokeWidth={2.5}
                        />
                      </button>
                    </div>

                    {/* TALEBE EKLE */}
                    <button
                      type="button"
                      onClick={() =>
                        handleAddToCart(product)
                      }
                      disabled={isAdded}
                      aria-label={`${product.name} talebe ekle`}
                      className="pg-add-button h-10 min-w-0 w-full px-2 flex items-center justify-center gap-1.5 rounded-[4px] text-white font-black uppercase tracking-wide text-[10px] disabled:cursor-default overflow-hidden"
                      style={{
                        backgroundColor: isAdded
                          ? COLORS.green
                          : COLORS.red,
                        color: COLORS.white,
                      }}
                    >
                      {isAdded ? (
                        <Check
                          size={15}
                          strokeWidth={3}
                          className="shrink-0"
                        />
                      ) : (
                        <ShoppingBasket
                          size={15}
                          strokeWidth={2.5}
                          className="shrink-0 hidden 2xl:block"
                        />
                      )}

                      <span className="min-w-0 truncate">
                        {isAdded
                          ? "EKLENDİ"
                          : "TALEBE EKLE"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* DAHA FAZLA GÖSTER */}
      {hasMore && (
        <div className="mt-10 flex flex-col items-center justify-center gap-4">

          <div className="w-full max-w-xs flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: COLORS.muted }}
              >
                ÜRÜN LİSTESİ
              </span>

              <span
                className="text-xs font-black font-mono"
                style={{ color: COLORS.dark }}
              >
                {products.length.toLocaleString("tr-TR")}
                {" / "}
                {displayedTotal.toLocaleString("tr-TR")}
              </span>
            </div>

            <div
              className="w-full h-[5px] overflow-hidden rounded-[2px]"
              style={{ backgroundColor: "#E2E8F0" }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  backgroundColor: COLORS.red,
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onLoadMore}
            className="group flex items-center justify-center gap-3 min-w-[230px] h-12 px-6 rounded-[4px] text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              backgroundColor: COLORS.dark,
              color: COLORS.white,
              border: `1px solid ${COLORS.dark}`,
            }}
          >
            <Plus
              size={18}
              strokeWidth={2.5}
              style={{ color: COLORS.yellow }}
            />

            DAHA FAZLA GÖSTER
          </button>

          <span className="text-[10px] font-medium text-slate-400">
            Daha fazla ürün için listeyi genişletebilirsiniz.
          </span>
        </div>
      )}

      {/* PORTAL FLOATING ACTIONS */}
      {isMounted &&
        createPortal(
          <FloatingActions />,
          document.body
        )}
    </section>
  );
}
