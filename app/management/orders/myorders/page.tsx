"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { getMyOrders } from "@/app/actions/my-orders";
import {
  DEFAULT_FILTERS,
  STATUS_FILTER_LABELS,
  quantity,
  type Filters,
  type ListResult,
  type StatusFilter,
} from "@/lib/my-orders/types";
import OrderCard from "./_components/OrderCard";
import OrderDetailModal from "./_components/OrderDetailModal";
import s from "./myorders.module.css";

function pageNumbers(page: number, total: number) {
  return [
    ...new Set(
      [1, page - 1, page, page + 1, total].filter((n) => n > 0 && n <= total),
    ),
  ].sort((a, b) => a - b);
}
function FilterFields({
  filters,
  change,
}: {
  filters: Filters;
  change: (patch: Partial<Filters>) => void;
}) {
  return (
    <>
      <label className={s.field}>
        Sipariş durumu
        <select
          value={filters.status}
          onChange={(e) => change({ status: e.target.value as StatusFilter })}
        >
          {Object.entries(STATUS_FILTER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={s.field}>
        Sipariş türü
        <select
          value={filters.kind}
          onChange={(e) => change({ kind: e.target.value as Filters["kind"] })}
        >
          <option value="ALL">Ürün + Sarf</option>
          <option value="PRODUCT">Ürün siparişleri</option>
          <option value="CONSUMABLE">Sarf siparişleri</option>
          <option value="MIXED">Karma siparişler</option>
        </select>
      </label>
      <label className={s.field}>
        Başlangıç tarihi
        <input
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => change({ from: e.target.value })}
        />
      </label>
      <label className={s.field}>
        Bitiş tarihi
        <input
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => change({ to: e.target.value })}
        />
      </label>
    </>
  );
}
export default function MyOrdersPage() {
  const router = useRouter(),
    [result, setResult] = useState<ListResult | null>(null),
    [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS),
    [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [filtersOpen, setFiltersOpen] = useState(false);
  const request = useRef(0),
    top = useRef<HTMLDivElement>(null),
    selectedRef = useRef(selected);
  selectedRef.current = selected;
  const load = useCallback(
    async (silent = false) => {
      const id = ++request.current;
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const r = await getMyOrders(filters);
        if (id !== request.current) return;
        if (!r.ok) throw new Error(r.error);
        setResult(r.data);
        setError("");
      } catch (e) {
        if (id === request.current)
          setError(e instanceof Error ? e.message : "Siparişler alınamadı.");
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filters],
  );
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setFilters((old) =>
          old.search === searchInput.trim()
            ? old
            : { ...old, search: searchInput.trim(), page: 1 },
        ),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !selectedRef.current)
        void load(true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [load]);
  const change = (patch: Partial<Filters>) =>
    setFilters((old) => ({ ...old, ...patch, page: patch.page ?? 1 }));
  const reset = () => {
    setSearchInput("");
    setFilters({ ...DEFAULT_FILTERS, pageSize: filters.pageSize });
  };
  const close = useCallback(() => {
    setSelected(null);
    void load(true);
  }, [load]);
  const current = result?.page ?? 1,
    totalPages = Math.max(
      1,
      Math.ceil((result?.count ?? 0) / filters.pageSize),
    ),
    pages = pageNumbers(current, totalPages);
  const active =
    filters.status !== "ALL" ||
    filters.kind !== "ALL" ||
    Boolean(filters.from || filters.to || searchInput);
  const go = (page: number) => {
    change({ page });
    top.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  return (
    <main className={s.app}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.logo}>
            <span>WMS</span>
            <b>Mağaza siparişleri</b>
          </div>
          <div className={s.headerRight}>
            <span>
              <MapPin size={14} />
              {result?.branch.name || "Mağaza bilgisi yükleniyor"}
            </span>
            <button onClick={() => router.back()}>
              <ArrowLeft size={15} />
              Geri
            </button>
          </div>
        </div>
      </header>
      <div className={s.layout}>
        <aside
          className={`${s.sidebar} ${filtersOpen ? s.sidebarOpen : ""}`}
          aria-label="Sipariş filtreleri"
        >
          <div className={s.accountHeading}>
            <span>MAĞAZA PANELİ</span>
            <h2>Hesabım</h2>
          </div>
          <div className={s.accountActive}>
            <ShoppingBag size={18} />
            <strong>Siparişlerim</strong>
          </div>
          <div className={s.filterHeading}>
            <h3>Sipariş filtreleri</h3>
            {active && <button onClick={reset}>Temizle</button>}
          </div>
          <FilterFields filters={filters} change={change} />
          <div className={s.branchInfo}>
            <MapPin size={17} />
            <div>
              <strong>{result?.branch.name || "Bağlı olduğunuz şube"}</strong>
              <p>Bu mağazaya ait ürün ve sarf talepleri listelenir.</p>
            </div>
          </div>
        </aside>
        <section className={s.mainContent} ref={top}>
          <div className={s.pageHeading}>
            <div>
              <p>Mağaza paneli / Siparişlerim</p>
              <h1>Siparişlerim</h1>
              <span>
                Ürün ve sarf taleplerinizin tüm aşamalarını buradan takip edin.
              </span>
            </div>
            <button
              className={s.button}
              disabled={loading || refreshing}
              onClick={() => void load(true)}
            >
              <RefreshCw
                size={15}
                className={refreshing ? s.spin : undefined}
              />
              {refreshing ? "Güncelleniyor" : "Yenile"}
            </button>
          </div>
          {result && (
            <div className={s.summaryLine}>
              <span>
                <ShoppingBag size={14} />
                <b>{quantity(result.metrics.total)}</b> sipariş kaydı
              </span>
              <span>
                <Clock3 size={14} />
                <b>{quantity(result.metrics.pending)}</b> onay bekliyor
              </span>
              <span className={s.summaryDispatch}>
                <Truck size={14} />
                <b>{quantity(result.metrics.ready_to_ship)}</b> hazırlandı &
                gönderiliyor
              </span>
            </div>
          )}
          <div className={s.listControls}>
            <div className={s.search}>
              <Search size={18} />
              <input
                value={searchInput}
                maxLength={120}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Sipariş no, ürün adı, SKU veya barkod ara"
                aria-label="Sipariş veya ürün ara"
              />
              {searchInput && (
                <button
                  aria-label="Aramayı temizle"
                  onClick={() => setSearchInput("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <select
              value={filters.sort}
              onChange={(e) =>
                change({ sort: e.target.value as Filters["sort"] })
              }
              aria-label="Sipariş sıralaması"
            >
              <option value="newest">En yeni siparişler</option>
              <option value="oldest">En eski siparişler</option>
            </select>
            <button
              className={s.mobileFilterButton}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <Filter size={16} />
              Filtreler
            </button>
          </div>
          <div className={s.mobileFilters}>
            {filtersOpen && <FilterFields filters={filters} change={change} />}
          </div>
          <div className={s.resultLine}>
            <span>
              {loading
                ? "Siparişler getiriliyor…"
                : `${quantity(result?.count ?? 0)} sipariş bulundu`}
            </span>
            {active && (
              <button onClick={reset}>
                Filtreleri temizle
                <X size={12} />
              </button>
            )}
            <small>
              {result?.updatedAt
                ? `Son güncelleme ${new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(result.updatedAt))}`
                : ""}
            </small>
          </div>
          {error && (
            <div className={s.error} role="alert">
              <AlertCircle size={19} />
              <span>{error}</span>
              <button onClick={() => void load()}>Tekrar dene</button>
            </div>
          )}
          {loading ? (
            <div className={s.empty} role="status">
              <Loader2 className={s.spin} size={30} />
              <strong>Siparişleriniz yükleniyor</strong>
              <p>Güncel durum ve ürün bilgileri hazırlanıyor.</p>
            </div>
          ) : !error && result?.rows.length ? (
            <div className={s.orderList}>
              {result.rows.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onOpen={() => setSelected(order.id)}
                />
              ))}
            </div>
          ) : !error ? (
            <div className={s.empty}>
              <PackageSearch size={42} />
              <strong>
                {active
                  ? "Aramanıza uygun sipariş bulunamadı"
                  : "Henüz siparişiniz bulunmuyor"}
              </strong>
              <p>
                {active
                  ? "Arama veya filtreleri değiştirerek tekrar deneyebilirsiniz."
                  : "Oluşturduğunuz ürün ve sarf talepleri burada görünecek."}
              </p>
              {active && (
                <button className={s.button} onClick={reset}>
                  Tüm siparişleri göster
                </button>
              )}
            </div>
          ) : null}
          {result && !loading && !error && result.count > 0 && (
            <footer className={s.pagination}>
              <div>
                <span>
                  {(current - 1) * filters.pageSize + 1}–
                  {Math.min(current * filters.pageSize, result.count)} /{" "}
                  {quantity(result.count)} sipariş
                </span>
                <select
                  aria-label="Sayfa başına sipariş"
                  value={filters.pageSize}
                  onChange={(e) => change({ pageSize: Number(e.target.value) })}
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} / sayfa
                    </option>
                  ))}
                </select>
              </div>
              <nav aria-label="Sipariş sayfaları">
                <button
                  disabled={current <= 1}
                  onClick={() => go(current - 1)}
                  aria-label="Önceki sayfa"
                >
                  <ChevronLeft size={16} />
                </button>
                {pages.map((page, index) => (
                  <span key={page}>
                    {index > 0 && page - pages[index - 1] > 1 && <i>…</i>}
                    <button
                      onClick={() => go(page)}
                      aria-current={current === page ? "page" : undefined}
                    >
                      {page}
                    </button>
                  </span>
                ))}
                <button
                  disabled={current >= totalPages}
                  onClick={() => go(current + 1)}
                  aria-label="Sonraki sayfa"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </footer>
          )}
        </section>
      </div>
      {selected && <OrderDetailModal orderId={selected} close={close} />}
    </main>
  );
}
