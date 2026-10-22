"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  Barcode,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Warehouse,
  X,
} from "lucide-react";
import { getInventorySnapshotServer } from "@/app/actions/inventory-queries";
import { filterInventory } from "@/lib/inventory-data";
import type {
  InventoryFilters,
  InventoryProduct,
  InventorySnapshot,
} from "@/lib/inventory-types";
import StockHistoryModal from "./StockHistoryModal";
import {
  control,
  CopyCode,
  EmptyState,
  LoadingRows,
  number,
} from "./inventory-ui";

type Props = { branchId?: string | null; isGlobal?: boolean };
const defaults: InventoryFilters = {
  product: "",
  shelf: "",
  kind: "ALL",
  status: "ALL",
  category: "ALL",
  sort: "STOCK_DESC",
};

export default function InventoryViewPanel({ branchId }: Props) {
  const [snapshot, setSnapshot] = useState<{
    scope: string;
    data: InventorySnapshot;
  } | null>(null);
  const [filters, setFilters] = useState<InventoryFilters>(defaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InventoryProduct | null>(null);
  const sequence = useRef(0);
  const id = useId();
  // Props only trigger a reload. The authorized branch is resolved by the server session.
  const scope = branchId || "session";
  const data = snapshot?.scope === scope ? snapshot.data : null;
  const deferredProduct = useDeferredValue(filters.product);
  const deferredShelf = useDeferredValue(filters.shelf);
  const isFiltering =
    deferredProduct !== filters.product || deferredShelf !== filters.shelf;
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError(null);
    setExportError(null);
    try {
      const result = await getInventorySnapshotServer();
      if (current === sequence.current) setSnapshot({ scope, data: result });
    } catch (cause) {
      if (current === sequence.current)
        setError(
          cause instanceof Error ? cause.message : "Şube stokları yüklenemedi.",
        );
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [scope]);
  useEffect(() => {
    setFilters(defaults);
    setSelected(null);
    setPage(1);
    void load();
    return () => {
      sequence.current += 1;
    };
  }, [load]);
  const change = <K extends keyof InventoryFilters>(
    key: K,
    value: InventoryFilters[K],
  ) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };
  const rows = useMemo(
    () =>
      filterInventory(data?.products || [], {
        ...filters,
        product: deferredProduct,
        shelf: deferredShelf,
      }),
    [data, filters, deferredProduct, deferredShelf],
  );
  const categories = useMemo(
    () =>
      [
        ...new Set(
          (data?.products || []).map(
            (product) => product.category || "Kategorisiz",
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    [data],
  );
  const narrowedByShelf =
    !!deferredShelf.trim() ||
    filters.status === "DAMAGED" ||
    filters.status === "ACTIVE_SHELF";
  const resultQuantity = rows.reduce(
    (sum, product) => sum + product.total_quantity,
    0,
  );
  const matchedQuantity = rows.reduce(
    (sum, product) => sum + product.matched_quantity,
    0,
  );
  const filterCount =
    Number(!!filters.product.trim()) +
    Number(!!filters.shelf.trim()) +
    Number(filters.kind !== "ALL") +
    Number(filters.status !== "ALL") +
    Number(filters.category !== "ALL");
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const shownRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const reset = () => {
    setFilters(defaults);
    setPage(1);
  };
  const exportExcel = async () => {
    if (!rows.length || loading || isFiltering) return;
    setExporting(true);
    setExportError(null);
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(
        rows.map((product) => ({
          Şube: data?.branch.name || "",
          "Ürün Adı": product.name,
          SKU: product.sku || "",
          Barkod: product.barcode || "",
          Kategori: product.category || "Kategorisiz",
          Tür: product.is_consumable ? "Sarf malzeme" : "Ticari ürün",
          "Raf Sayısı": product.shelf_count,
          "Şube Stok (Adet)": product.total_quantity,
          ...(narrowedByShelf
            ? { "Eşleşen Raf Stok (Adet)": product.matched_quantity }
            : {}),
        })),
      );
      worksheet["!cols"] = [24, 55, 16, 20, 22, 18, 15, 22, 26].map((wch) => ({
        wch,
      }));
      worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1:H1" };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Şube Stokları");
      const date = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Istanbul",
      }).format(new Date());
      XLSX.writeFile(workbook, `WMS_Sube_Stok_${date}.xlsx`);
    } catch {
      setExportError("Excel çıktısı oluşturulamadı.");
    } finally {
      setExporting(false);
    }
  };
  const stats = data?.summary;

  return (
    <section className="w-full min-w-0 space-y-4 text-slate-800 [color-scheme:light]">
      <header className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-sm border border-slate-800 bg-[#111827] px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-3">
          <div className="hidden border border-white/10 bg-white/5 p-2.5 sm:block">
            <Warehouse size={22} className="text-violet-300" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              WMS / Envanter yönetimi
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
              Stok ve raf takibi<span className="text-[#dc3545]">.</span>
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-9 items-center gap-2 border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-200">
            <ShieldCheck size={14} className="text-violet-300" />
            {data?.branch.name || "Bağlı şube"}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-2 border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Yükleniyor" : "Yenile"}
          </button>
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#dc3545] via-violet-600 to-transparent"
        />
      </header>
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Metric
          label="Şube toplam raf stoğu"
          value={stats?.total_quantity}
          unit="adet"
          tone="violet"
          icon={<Package size={17} />}
          detail="Tüm raf kayıtları · aramadan bağımsız"
        />
        <Metric
          label="Stoklu ürün"
          value={stats?.stocked_product_count}
          unit="çeşit"
          tone="slate"
          icon={<Layers size={17} />}
          detail={`${stats ? number(stats.product_count) : "—"} kayıtlı ürün`}
        />
        <Metric
          label="Aktif raf"
          value={stats?.active_shelf_count}
          unit="raf"
          tone="slate"
          icon={<MapPin size={17} />}
          detail="Pozitif stok bulunan benzersiz raflar"
        />
        <Metric
          label="Hasarlı raf stoğu"
          value={stats?.damaged_quantity}
          unit="adet"
          tone="red"
          icon={<TriangleAlert size={17} />}
          detail="Hasarlı raflardaki toplam miktar"
          onClick={() =>
            change("status", filters.status === "DAMAGED" ? "ALL" : "DAMAGED")
          }
          active={filters.status === "DAMAGED"}
        />
      </div>
      <div className="overflow-hidden rounded-sm border border-slate-300 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
            <label className="relative block">
              <Barcode
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3 text-violet-600"
              />
              <span className="sr-only">Barkod, SKU veya ürün adı ara</span>
              <input
                type="search"
                value={filters.product}
                onChange={(event) => change("product", event.target.value)}
                placeholder="Barkod, SKU veya ürün adı…"
                className="h-11 w-full min-w-0 rounded-sm border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500"
              />
            </label>
            <label className="relative block">
              <MapPin
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3.5 text-violet-600"
              />
              <span className="sr-only">Raf adına göre ara</span>
              <input
                type="search"
                list={`${id}-shelves`}
                value={filters.shelf}
                onChange={(event) => change("shelf", event.target.value)}
                placeholder="Raf adına göre ara…"
                className="h-11 w-full min-w-0 rounded-sm border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500"
              />
              <datalist id={`${id}-shelves`}>
                {data?.shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.name} />
                ))}
              </datalist>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((value) => !value)}
                className={`${control} flex flex-1 items-center justify-center gap-2 !text-xs lg:flex-none`}
              >
                <SlidersHorizontal size={15} />
                Filtreler
                {filterCount > 0 && (
                  <span className="bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">
                    {filterCount}
                  </span>
                )}
                <ChevronDown
                  size={12}
                  className={showFilters ? "rotate-180" : ""}
                />
              </button>
              <button
                type="button"
                onClick={() => void exportExcel()}
                disabled={!rows.length || loading || exporting || isFiltering}
                className={`${control} flex flex-1 items-center justify-center gap-2 !border-violet-700 !bg-violet-700 !text-xs !text-white hover:!bg-violet-800 lg:flex-none`}
              >
                {exporting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                Excel indir
              </button>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div
              className="flex border border-slate-200 bg-slate-50 p-0.5"
              aria-label="Ürün türü"
            >
              {(
                [
                  { key: "ALL", label: "Tüm ürünler" },
                  { key: "COMMERCIAL", label: "Ticari" },
                  { key: "CONSUMABLE", label: "Sarf" },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={filters.kind === option.key}
                  onClick={() => change("kind", option.key)}
                  className={`min-h-9 flex-1 px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:flex-none ${filters.kind === option.key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-slate-400">
              <ArrowDownWideNarrow size={15} />
              <span className="sr-only">Sıralama</span>
              <select
                value={filters.sort}
                onChange={(event) =>
                  change("sort", event.target.value as InventoryFilters["sort"])
                }
                className="min-h-9 flex-1 rounded-sm border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-violet-500 sm:flex-none"
              >
                <option value="STOCK_DESC">Stok: yüksekten düşüğe</option>
                <option value="STOCK_ASC">Stok: düşükten yükseğe</option>
                <option value="NAME">Ürün adı: A → Z</option>
                <option value="SKU">SKU: artan</option>
              </select>
            </label>
          </div>
          {showFilters && (
            <div className="grid gap-3 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-slate-500">
                <span>Raf / stok durumu</span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    change(
                      "status",
                      event.target.value as InventoryFilters["status"],
                    )
                  }
                  className={`${control} block w-full !text-xs outline-none focus:ring-2 focus:ring-violet-500`}
                >
                  <option value="ALL">Tüm durumlar</option>
                  <option value="ACTIVE_SHELF">Sağlam rafta</option>
                  <option value="DAMAGED">Hasarlı rafta</option>
                  <option value="NO_STOCK">Kayıtlı sıfır stok</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-500">
                <span>Kategori</span>
                <select
                  value={filters.category}
                  onChange={(event) => change("category", event.target.value)}
                  className={`${control} block w-full !text-xs outline-none focus:ring-2 focus:ring-violet-500`}
                >
                  <option value="ALL">Tüm kategoriler</option>
                  {filters.category !== "ALL" &&
                    !categories.includes(filters.category) && (
                      <option value={filters.category}>
                        {filters.category}
                      </option>
                    )}
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {filterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">{filterCount} filtre etkin</span>
              {filters.shelf && (
                <span className="inline-flex items-center gap-2 border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700">
                  <MapPin size={12} />
                  {filters.shelf}
                  <button
                    type="button"
                    aria-label="Raf aramasını temizle"
                    onClick={() => change("shelf", "")}
                    className="p-1"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={reset}
                className="min-h-8 font-semibold text-red-600 underline underline-offset-4"
              >
                Tümünü temizle
              </button>
            </div>
          )}
        </div>
        {(error || exportError) && (
          <div
            role="alert"
            className="m-3 flex flex-wrap items-center gap-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <TriangleAlert size={16} />
            <div className="flex-1">
              {error || exportError}
              {error && data && (
                <p className="mt-1 text-xs">
                  Son başarılı yüklemenin verileri gösteriliyor.
                </p>
              )}
            </div>
            {error && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void load()}
                className={`${control} !text-xs`}
              >
                Tekrar dene
              </button>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2.5 sm:px-4">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Layers size={14} className="text-violet-600" />
            Envanter listesi
            <span className="border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {number(rows.length)}
            </span>
          </h2>
          <span role="status" className="text-xs text-slate-500">
            {isFiltering ? (
              "Filtreleniyor…"
            ) : narrowedByShelf ? (
              <>
                Eşleşen rafta{" "}
                <strong className="text-violet-700">
                  {number(matchedQuantity)} adet
                </strong>
                <span className="mx-2 text-slate-300">/</span>Ürünlerin şube
                stoğu {number(resultQuantity)}
              </>
            ) : (
              <>
                Sonuçlarda{" "}
                <strong className="text-slate-700">
                  {number(resultQuantity)} adet
                </strong>
              </>
            )}
          </span>
        </div>
        <div aria-busy={loading || isFiltering}>
          {loading ? (
            <LoadingRows />
          ) : !shownRows.length ? (
            <EmptyState
              title={error ? "Veriler yüklenemedi" : "Ürün bulunamadı"}
              description={
                error
                  ? "Yeniden yüklemek için tekrar deneyin."
                  : "Ürün veya raf aramasını ve filtreleri kontrol edin."
              }
            />
          ) : (
            <>
              <div className="relative hidden overflow-x-auto md:block">
                <table className="w-full min-w-[880px] border-collapse text-left">
                  <caption className="sr-only">
                    Bağlı şubenin stokları. Varsayılan sıralama stok miktarına
                    göre azalandır.
                  </caption>
                  <thead className="bg-[#172033] text-[10px] uppercase tracking-wider text-slate-300">
                    <tr>
                      <th scope="col" className="w-[38%] px-4 py-2.5">
                        Ürün adı
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        SKU
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Barkod
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-center">
                        Raf
                      </th>
                      {narrowedByShelf && (
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-right text-violet-300"
                        >
                          Eşleşen raf
                        </th>
                      )}
                      <th
                        scope="col"
                        aria-sort={
                          filters.sort === "STOCK_DESC"
                            ? "descending"
                            : filters.sort === "STOCK_ASC"
                              ? "ascending"
                              : "none"
                        }
                        className="px-3 py-2.5 text-right text-white"
                      >
                        Şube stoğu
                      </th>
                      <th scope="col" className="w-14 pr-3">
                        <span className="sr-only">Detay</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {shownRows.map((product) => (
                      <tr
                        key={product.product_id}
                        className="odd:bg-white even:bg-slate-50/60 hover:!bg-violet-50/60"
                      >
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            disabled={product.is_unlinked}
                            onClick={() => setSelected(product)}
                            className="block text-left text-xs font-semibold leading-5 text-slate-800 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:text-slate-400"
                          >
                            {product.name}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-500">
                          {product.sku || "—"}
                        </td>
                        <td className="px-3 py-1">
                          <CopyCode value={product.barcode} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-center">
                          <span
                            className={
                              product.has_damaged_shelf
                                ? "font-semibold text-red-600"
                                : "text-slate-500"
                            }
                          >
                            {number(product.shelf_count)}
                            {product.has_damaged_shelf && (
                              <TriangleAlert
                                size={11}
                                aria-label="Hasarlı raf var"
                                className="ml-1.5 inline"
                              />
                            )}
                          </span>
                        </td>
                        {narrowedByShelf && (
                          <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-violet-700">
                            {number(product.matched_quantity)}
                          </td>
                        )}
                        <td
                          className={`px-3 py-2 text-right font-mono text-[15px] font-bold tabular-nums ${product.total_quantity === 0 ? "text-red-600" : "text-slate-900"}`}
                        >
                          {number(product.total_quantity)}
                        </td>
                        <td className="py-1 pr-3 text-right">
                          <button
                            type="button"
                            disabled={product.is_unlinked}
                            aria-label={`${product.name} stok detayını aç`}
                            onClick={() => setSelected(product)}
                            className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-white text-slate-500 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-40"
                          >
                            <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-200 md:hidden">
                {shownRows.map((product) => (
                  <article
                    key={product.product_id}
                    className="space-y-2 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 text-xs font-semibold leading-5 text-slate-800">
                        {product.name}
                      </h3>
                      <span className="shrink-0 font-mono text-lg font-bold text-slate-900">
                        {number(product.total_quantity)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <CopyCode value={product.barcode} />
                      <span className="font-mono text-[10px] text-slate-400">
                        SKU {product.sku || "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        {narrowedByShelf
                          ? `Eşleşen rafta ${number(product.matched_quantity)} adet`
                          : `${number(product.shelf_count)} raf`}
                        {product.has_damaged_shelf && (
                          <span className="ml-2 text-red-600">
                            Hasarlı raf var
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={product.is_unlinked}
                        onClick={() => setSelected(product)}
                        className="inline-flex min-h-9 items-center gap-2 border border-violet-200 bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 disabled:opacity-40"
                      >
                        Stok detayı
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
        <footer className="flex flex-col justify-between gap-3 border-t border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:px-4">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span>
              {rows.length ? number((currentPage - 1) * pageSize + 1) : 0}–
              {number(Math.min(currentPage * pageSize, rows.length))} /{" "}
              {number(rows.length)} ürün
            </span>
            <label>
              <span className="sr-only">Sayfa başına ürün sayısı</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="min-h-9 border border-slate-200 bg-white px-2 text-[11px] outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value={25}>25 / sayfa</option>
                <option value={50}>50 / sayfa</option>
                <option value={100}>100 / sayfa</option>
              </select>
            </label>
          </div>
          <nav
            aria-label="Envanter sayfaları"
            className="flex items-center justify-between gap-2"
          >
            <button
              type="button"
              aria-label="Önceki sayfa"
              disabled={currentPage === 1 || loading}
              onClick={() => setPage(currentPage - 1)}
              className={`${control} !min-h-9 px-2`}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-2 text-[11px] font-semibold text-slate-500">
              Sayfa {currentPage} / {pages}
            </span>
            <button
              type="button"
              aria-label="Sonraki sayfa"
              disabled={currentPage === pages || loading}
              onClick={() => setPage(currentPage + 1)}
              className={`${control} !min-h-9 px-2`}
            >
              <ChevronRight size={15} />
            </button>
          </nav>
        </footer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-5 text-slate-400">
        <span>Yalnızca bağlı şubenin raf stokları gösterilir.</span>
        <span>
          {data
            ? `Son yükleme: ${new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }).format(new Date(data.loaded_at))}`
            : "Veri bekleniyor"}
        </span>
      </div>
      {selected && (
        <StockHistoryModal
          key={`${scope}:${selected.product_id}`}
          productId={selected.product_id}
          productName={selected.name}
          productBarcode={selected.barcode}
          productSku={selected.sku}
          productImage={selected.image_url}
          branchId={data?.branch.id}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  unit,
  tone,
  icon,
  detail,
  onClick,
  active,
}: {
  label: string;
  value?: number;
  unit: string;
  tone: "violet" | "slate" | "red";
  icon: ReactNode;
  detail: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const border =
    tone === "violet"
      ? "border-l-violet-600"
      : tone === "red"
        ? "border-l-[#dc3545]"
        : "border-l-slate-400";
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold leading-5 text-slate-500">
          {label}
        </span>
        <span
          className={
            tone === "red"
              ? "text-red-500"
              : tone === "violet"
                ? "text-violet-600"
                : "text-slate-400"
          }
        >
          {icon}
        </span>
      </div>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
        <strong
          className={`break-all font-mono text-2xl font-bold tabular-nums ${tone === "red" && value ? "text-red-600" : "text-slate-900"}`}
        >
          {value === undefined ? "—" : number(value)}
        </strong>
        <span className="text-[11px] text-slate-400">{unit}</span>
      </p>
      <p className="mt-1 text-[10px] leading-5 text-slate-400">{detail}</p>
    </>
  );
  const className = `min-w-0 border border-l-[3px] ${border} bg-white p-3 text-left ${active ? "ring-1 ring-violet-400" : ""} ${onClick ? "transition hover:bg-red-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500" : ""}`;
  return onClick ? (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
