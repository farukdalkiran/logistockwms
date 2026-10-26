"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2,
  Clock3, Filter, Loader2, MapPin, PackageCheck, PackageSearch,
  RefreshCw, Search, ShoppingBag, SlidersHorizontal, Truck, X,
} from "lucide-react";
import { getMyOrders } from "@/app/actions/my-orders";
import {
  DEFAULT_FILTERS, STATUS_FILTER_LABELS, quantity,
  type Filters, type ListResult, type StatusFilter,
} from "@/lib/my-orders/types";
import OrderCard from "./_components/OrderCard";
import OrderDetailModal from "./_components/OrderDetailModal";

const TABS: StatusFilter[] = [
  "ALL", "PENDING", "PROCESSING", "READY_TO_SHIP", "DONE", "CANCELLED",
];

function pages(current: number, max: number) {
  return [...new Set([1, current - 1, current, current + 1, max]
    .filter((n) => n > 0 && n <= max))].sort((a, b) => a - b);
}

export default function MyOrdersPage() {
  const router = useRouter();
  const [result, setResult] = useState<ListResult | null>(null);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, pageSize: 10 });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const request = useRef(0);
  const listTop = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const load = useCallback(async (silent = false) => {
    const id = ++request.current;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await getMyOrders(filters);
      if (id !== request.current) return;
      if (!response.ok) throw new Error(response.error);
      setResult(response.data);
      setError("");
    } catch (err) {
      if (id === request.current)
        setError(err instanceof Error ? err.message : "Siparişler alınamadı.");
    } finally {
      if (id === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    void load();
    return () => { request.current++; };
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => prev.search === searchInput.trim()
        ? prev : { ...prev, search: searchInput.trim(), page: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !selectedRef.current) void load(true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  const change = (patch: Partial<Filters>) =>
    setFilters((previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }));

  const reset = () => {
    setSearchInput("");
    setFilters({ ...DEFAULT_FILTERS, pageSize: filters.pageSize });
  };

  const closeDetail = useCallback(() => {
    setSelected(null);
    void load(true);
  }, [load]);

  const current = result?.page ?? 1;
  const totalPages = Math.max(1, Math.ceil((result?.count ?? 0) / filters.pageSize));
  const pageList = pages(current, totalPages);
  const appliedFilters = Boolean(filters.search || filters.kind !== "ALL" || filters.from || filters.to);
  const hasFilters = appliedFilters || filters.status !== "ALL";

  const goPage = (page: number) => {
    change({ page });
    listTop.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  const metric = result?.metrics;

  return (
    <main className="min-h-screen bg-[#f3f5f9] pb-12 text-slate-900">
      <div className="mx-auto max-w-[1530px] space-y-5 px-3 py-5 sm:px-5 lg:px-8">
        <header className="overflow-hidden rounded-lg border border-[#162238] bg-[#131f34] shadow-[0_10px_28px_rgba(15,23,42,0.14)]">
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 px-5 py-5 sm:px-7">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white">
                <ShoppingBag size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-red-300">
                  LogiStock WMS / Mağaza Operasyonları
                </p>
                <h1 className="mt-1 text-[23px] font-black tracking-tight text-white sm:text-[27px]">
                  Siparişlerim
                </h1>
                <p className="mt-1 text-[12px] font-medium text-slate-300">
                  Mağaza taleplerinizi, hazırlık ve teslimat süreçlerini tek ekranda yönetin.
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">
                  <MapPin size={13} className="text-red-300" />
                  {result?.branch.name || "Bağlı mağaza yükleniyor"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void load(true)} disabled={loading || refreshing}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-500 bg-white/10 px-3 text-[11px] font-bold text-white transition hover:bg-white/20 disabled:opacity-50">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                Yenile
              </button>
              <button type="button" onClick={() => router.back()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-[11px] font-bold text-slate-200 transition hover:bg-white/10">
                <ArrowLeft size={14} /> Geri
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/10 lg:grid-cols-4">
            {[
              { title: "Toplam Sipariş", value: metric?.total, icon: ShoppingBag, tone: "text-white" },
              { title: "Onay Bekleyen", value: metric?.pending, icon: Clock3, tone: "text-amber-300" },
              { title: "Gönderim Aşamasında", value: metric?.ready_to_ship, icon: Truck, tone: "text-sky-300" },
              { title: "Tamamlanan", value: metric?.completed, icon: CheckCircle2, tone: "text-emerald-300" },
            ].map(({ title, value, icon: Icon, tone }) => (
              <div key={title} className="flex items-center justify-between gap-3 bg-[#192942] px-4 py-3.5 sm:px-6">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</span>
                  <strong className={"mt-1 block text-[26px] font-black leading-none " + tone}>
                    {value === undefined ? "—" : quantity(value)}
                  </strong>
                </div>
                <Icon size={20} className={tone + " opacity-75"} />
              </div>
            ))}
          </div>
        </header>

        <section ref={listTop} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-[#1e293b] px-5 py-3.5">
            <div>
              <h2 className="text-[14px] font-black text-white">Sipariş Listesi</h2>
              <p className="mt-0.5 text-[10px] font-medium text-slate-300">
                Ürün ve sarf siparişlerinin bütün işlem aşamaları
              </p>
            </div>
            <span className="rounded border border-white/20 bg-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-100">
              {quantity(result?.count ?? 0)} kayıt
            </span>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-[#f8fafc] px-3 pt-2 sm:px-5"
            aria-label="Sipariş durumu filtreleri">
            {TABS.map((key) => {
              const active = filters.status === key;
              const count = key === "PENDING" ? metric?.pending
                : key === "READY_TO_SHIP" ? metric?.ready_to_ship
                : key === "DONE" ? metric?.completed : key === "ALL" ? metric?.total : undefined;
              return (
                <button type="button" key={key} aria-current={active ? "page" : undefined}
                  onClick={() => change({ status: key })}
                  className={
                    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] px-3 py-2.5 text-[11px] font-bold transition " +
                    (active
                      ? "border-[#dc3545] text-slate-950"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800")
                  }>
                  {STATUS_FILTER_LABELS[key]}
                  {count !== undefined && (
                    <span className={active
                      ? "rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-[#c52639]"
                      : "rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"}>
                      {quantity(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3.5 lg:flex-row lg:items-center lg:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-[#dc3545] focus-within:ring-1 focus-within:ring-red-100">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input value={searchInput} maxLength={120}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Sipariş kodu, ürün adı, SKU veya barkod ara..."
                aria-label="Siparişlerde ara"
                className="h-10 min-w-0 w-full bg-transparent text-[12px] font-medium text-slate-800 outline-none placeholder:text-slate-400" />
              {searchInput && <button type="button" onClick={() => setSearchInput("")}
                aria-label="Aramayı temizle" className="text-slate-400 hover:text-slate-900"><X size={15}/></button>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={filters.kind} aria-label="Sipariş türü"
                onChange={(e) => change({kind: e.target.value as Filters["kind"]})}
                className="h-10 min-w-[125px] flex-1 rounded-md border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 lg:flex-none">
                <option value="ALL">Tüm türler</option>
                <option value="PRODUCT">Ürün</option>
                <option value="CONSUMABLE">Sarf</option>
                <option value="MIXED">Ürün + Sarf</option>
              </select>
              <select value={filters.sort} aria-label="Sıralama"
                onChange={(e) => change({sort:e.target.value as Filters["sort"]})}
                className="h-10 min-w-[140px] flex-1 rounded-md border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 lg:flex-none">
                <option value="newest">En yeni</option>
                <option value="oldest">En eski</option>
              </select>
              <button type="button" aria-expanded={advanced} onClick={() => setAdvanced((open) => !open)}
                className={
                  "inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-[11px] font-bold " +
                  (advanced || filters.from || filters.to
                    ? "border-[#dc3545] bg-red-50 text-[#c52639]"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")
                }>
                <SlidersHorizontal size={14}/> Tarih
              </button>
            </div>
          </div>

          {advanced && (
            <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:px-5">
              <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-600">
                Başlangıç tarihi
                <input type="date" value={filters.from} max={filters.to || undefined}
                  onChange={(e) => change({from:e.target.value})}
                  className="h-9 rounded border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-800" />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-bold text-slate-600">
                Bitiş tarihi
                <input type="date" value={filters.to} min={filters.from || undefined}
                  onChange={(e) => change({to:e.target.value})}
                  className="h-9 rounded border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-800" />
              </label>
              {hasFilters && (
                <button type="button" onClick={reset}
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-slate-300 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-100">
                  <X size={13} /> Filtreleri temizle
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#f8fafc] px-4 py-2.5 lg:px-5">
            <span className="text-[11px] font-bold text-slate-600">
              {loading ? "Siparişler yükleniyor…" : quantity(result?.count ?? 0) + " sipariş görüntüleniyor"}
            </span>
            <div className="flex items-center gap-3">
              {hasFilters && <button type="button" onClick={reset}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#dc3545] hover:underline">
                Filtreleri sıfırla <X size={12}/>
              </button>}
              {result?.updatedAt && (
                <small className="hidden text-[10px] font-medium text-slate-400 sm:block">
                  Son senkronizasyon: {new Intl.DateTimeFormat("tr-TR", {
                    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
                  }).format(new Date(result.updatedAt))}
                </small>
              )}
            </div>
          </div>

          <div className="space-y-3 bg-[#f3f5f9] p-3 sm:p-4 lg:p-5">
            {error && (
              <div role="alert"
                className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-[12px] font-bold text-red-800">
                <AlertCircle size={17} />
                <span className="flex-1">{error}</span>
                <button type="button" onClick={() => void load()} className="underline">Tekrar dene</button>
              </div>
            )}
            {loading ? (
              <div role="status" className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-md border border-slate-200 bg-white">
                <Loader2 size={26} className="animate-spin text-[#dc3545]"/>
                <strong className="text-[12px] text-slate-700">Siparişleriniz yükleniyor…</strong>
              </div>
            ) : !error && result?.rows.length ? (
              result.rows.map((order) => (
                <OrderCard key={order.id} order={order} onOpen={() => setSelected(order.id)} />
              ))
            ) : !error ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-md border border-slate-200 bg-white p-6 text-center">
                <PackageSearch size={34} className="text-slate-400"/>
                <strong className="text-[14px] font-black text-slate-800">
                  {hasFilters ? "Filtrenize uygun sipariş yok" : "Henüz sipariş oluşturulmamış"}
                </strong>
                <p className="max-w-sm text-[12px] text-slate-500">
                  {hasFilters ? "Başka bir durum, tarih veya ürün seçerek yeniden deneyin." : "Mağazanızın ürün ve sarf talepleri burada görünecek."}
                </p>
                {hasFilters && <button type="button" onClick={reset}
                  className="rounded bg-[#dc3545] px-3 py-2 text-[11px] font-bold text-white">Tüm siparişleri göster</button>}
              </div>
            ) : null}
          </div>

          {result && !loading && !error && result.count > 0 && (
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 lg:px-5">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
                <span>{quantity((current - 1) * filters.pageSize + 1)}–{quantity(Math.min(current * filters.pageSize,result.count))} / {quantity(result.count)}</span>
                <select value={filters.pageSize} aria-label="Sayfa başına sipariş"
                  onChange={(e) => change({pageSize:Number(e.target.value)})}
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-[11px]">
                  {[10,20,50].map(n=><option key={n} value={n}>{n} / sayfa</option>)}
                </select>
              </div>
              <nav aria-label="Sipariş sayfaları" className="flex items-center gap-1">
                <button disabled={current<=1} onClick={()=>goPage(current-1)}
                  aria-label="Önceki sayfa" className="grid h-8 w-8 place-items-center rounded border border-slate-200 disabled:opacity-40">
                  <ChevronLeft size={15}/>
                </button>
                {pageList.map((p,i)=>(
                  <span key={p} className="flex items-center gap-1">
                    {i>0 && p-pageList[i-1]>1 && <span className="px-1 text-slate-400">…</span>}
                    <button type="button" onClick={()=>goPage(p)} aria-current={current===p?"page":undefined}
                      className={"grid h-8 min-w-8 place-items-center rounded border px-2 text-[11px] font-bold "+
                        (current===p?"border-[#dc3545] bg-[#dc3545] text-white":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                      {p}
                    </button>
                  </span>
                ))}
                <button disabled={current>=totalPages} onClick={()=>goPage(current+1)}
                  aria-label="Sonraki sayfa" className="grid h-8 w-8 place-items-center rounded border border-slate-200 disabled:opacity-40">
                  <ChevronRight size={15}/>
                </button>
              </nav>
            </footer>
          )}
        </section>

        <p className="text-center text-[11px] font-medium text-slate-500">
          Sipariş durumları merkez depo işlemlerine göre güncellenir. Teslimatı yalnızca ürünler mağazanıza ulaştığında onaylayın.
        </p>
      </div>
      {selected && <OrderDetailModal orderId={selected} close={closeDetail} />}
    </main>
  );
}
