"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { getInventoryProductDetailServer } from "@/app/actions/inventory-queries";
import type {
  InventoryDetail,
  InventoryLog,
  InventoryShelf,
} from "@/lib/inventory-types";
import { fold } from "@/lib/inventory-data";
import {
  control,
  CopyCode,
  EmptyState,
  number,
  ProductImage,
} from "./inventory-ui";

type Props = {
  productId: string;
  productName?: string | null;
  productBarcode?: string | null;
  productSku?: string | null;
  productImage?: string | null;
  branchId?: string | null;
  isGlobal?: boolean;
  onClose: () => void;
};
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}
function direction(log: InventoryLog): "IN" | "OUT" | "OTHER" {
  if (log.new_value.startsWith("+")) return "IN";
  if (log.new_value.startsWith("-")) return "OUT";
  return log.action_type.includes("PUTAWAY")
    ? "IN"
    : log.action_type.includes("PICKING")
      ? "OUT"
      : "OTHER";
}
function logShelf(description: string) {
  return (
    description
      .match(/RAF:\s*(.+?)(?=\s*\(ID:|\s*\|\s*SEBEP:|$)/i)?.[1]
      ?.trim() || "—"
  );
}
function logReason(description: string) {
  return description.match(/\|\s*SEBEP:\s*([\s\S]*)$/i)?.[1]?.trim();
}
function shelfLabel(shelf: InventoryShelf) {
  if (shelf.status === "normal") return "Sağlam";
  if (shelf.status === "unknown") return "Durum yok";
  const upper = shelf.name.toLocaleUpperCase("tr-TR");
  return upper.includes("-AZ-")
    ? "Az hasarlı"
    : /-(COK|ÇOK)-/.test(upper)
      ? "Çok hasarlı"
      : "Hasarlı";
}

export default function StockHistoryModal({
  productId,
  productName,
  productBarcode,
  productSku,
  productImage,
  branchId,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<InventoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shelfSearch, setShelfSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState<"ALL" | "IN" | "OUT">(
    "ALL",
  );
  const [logPage, setLogPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sequence = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const id = useId();
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Portal, scroll lock, focus trap and focus restoration work independently of data loading.
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0)
      document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight || "0") + scrollbarWidth}px`;
    setMounted(true);
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialogRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialogRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (!dialogRef.current?.contains(event.target as Node))
        closeRef.current?.focus();
    };
    document.addEventListener("keydown", handleKey, true);
    document.addEventListener("focusin", keepFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey, true);
      document.removeEventListener("focusin", keepFocus);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      previousFocus?.focus();
    };
  }, []);

  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const detail = await getInventoryProductDetailServer(productId);
      if (branchId && detail.branch.id !== branchId)
        throw new Error("Bağlı şube değişti. Paneli yeniden yükleyin.");
      if (request === sequence.current) {
        setData(detail);
        setLogPage(1);
      }
    } catch (cause) {
      if (request === sequence.current)
        setError(
          cause instanceof Error ? cause.message : "Ürün detayı yüklenemedi.",
        );
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [productId, branchId]);
  useEffect(() => {
    setData(null);
    setShelfSearch("");
    setLogSearch("");
    setMovementFilter("ALL");
    setExpanded(new Set());
    void load();
    return () => {
      sequence.current += 1;
    };
  }, [load]);

  const product = data?.product;
  const shelves = useMemo(
    () =>
      (product?.shelves || []).filter(
        (shelf) =>
          !shelfSearch.trim() ||
          fold(shelf.name).includes(fold(shelfSearch.trim())),
      ),
    [product, shelfSearch],
  );
  const logs = data?.logs || [];
  const visibleLogs = useMemo(
    () =>
      logs.filter(
        (log) =>
          (movementFilter === "ALL" || direction(log) === movementFilter) &&
          (!logSearch.trim() ||
            fold(
              `${log.description} ${log.employee_name} ${log.new_value}`,
            ).includes(fold(logSearch.trim()))),
      ),
    [logs, logSearch, movementFilter],
  );
  const logPages = Math.max(1, Math.ceil(visibleLogs.length / 20));
  const currentLogPage = Math.min(logPage, logPages);
  const shownLogs = visibleLogs.slice(
    (currentLogPage - 1) * 20,
    currentLogPage * 20,
  );
  const maxShelfQuantity = Math.max(
    1,
    ...shelves.map((shelf) => shelf.quantity),
  );
  const matchedShelfTotal = shelves.reduce(
    (sum, shelf) => sum + shelf.quantity,
    0,
  );
  const inCount = logs.filter((log) => direction(log) === "IN").length;
  const outCount = logs.filter((log) => direction(log) === "OUT").length;
  const name = product?.name || productName || "Ürün detayı";

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-slate-950/75 backdrop-blur-sm [color-scheme:light] sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-subtitle`}
        tabIndex={-1}
        className="flex h-[100dvh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-none border border-slate-700 bg-slate-50 text-slate-800 shadow-2xl outline-none sm:h-[92dvh] sm:max-h-[1000px] sm:max-w-[1380px] sm:rounded-sm"
      >
        <header className="relative flex shrink-0 items-start justify-between gap-4 bg-[#111827] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
              Ürün / Raf / Hareket arşivi
            </p>
            <h2
              id={`${id}-title`}
              className="mt-1.5 break-words text-base font-bold leading-6 text-white sm:text-lg"
            >
              {name}
            </h2>
            <p
              id={`${id}-subtitle`}
              className="mt-1.5 text-[11px] text-slate-400"
            >
              {data?.branch.name || "Bağlı şube"} · Ürün stok detayları
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Stok detayını kapat"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-[#dc3545] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <X size={19} />
          </button>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#dc3545] via-violet-600 to-transparent"
          />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid items-start gap-4 p-3 sm:p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="space-y-3 lg:sticky lg:top-4">
              <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 lg:grid-cols-1">
                <ProductImage
                  src={product?.image_url || productImage || null}
                  name={name}
                  className="aspect-square w-full"
                />
                <div className="min-w-0 border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Ürün kimliği
                  </p>
                  <p className="mt-2 break-words text-xs text-slate-500">
                    {product?.category || "Kategorisiz"}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-400">Barkod</p>
                  <CopyCode
                    value={product?.barcode || productBarcode || null}
                  />
                  <p className="mt-2 text-[10px] text-slate-400">SKU</p>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-700">
                    {product?.sku || productSku || "—"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-200 border border-slate-200 bg-white">
                <div className="p-3">
                  <span className="text-[10px] font-semibold text-slate-500">
                    Şube stoğu
                  </span>
                  <strong className="mt-1.5 block break-all font-mono text-2xl font-bold text-violet-700">
                    {loading ? "—" : number(product?.total_quantity || 0)}
                  </strong>
                  <span className="text-[10px] text-slate-400">adet</span>
                </div>
                <div className="p-3">
                  <span className="text-[10px] font-semibold text-slate-500">
                    Aktif raf
                  </span>
                  <strong className="mt-1.5 block font-mono text-2xl font-bold text-slate-800">
                    {loading ? "—" : number(product?.shelf_count || 0)}
                  </strong>
                  <span className="text-[10px] text-slate-400">
                    benzersiz raf
                  </span>
                </div>
              </div>
              <p className="hidden text-[11px] leading-5 text-slate-400 lg:block">
                Raf listesi ve hareketler yalnızca bağlı şubenin kayıtlarını
                içerir.
              </p>
            </aside>
            <div className="min-w-0 space-y-4">
              {loading ? (
                <div
                  role="status"
                  className="flex min-h-60 items-center justify-center gap-3 border border-slate-200 bg-white text-sm text-slate-500"
                >
                  <Loader2 size={22} className="animate-spin text-violet-600" />
                  Ürün detayları yükleniyor…
                </div>
              ) : error ? (
                <div
                  role="alert"
                  className="border border-red-200 bg-red-50 p-4"
                >
                  <p className="flex items-start gap-2 text-sm text-red-700">
                    <TriangleAlert size={17} className="shrink-0" />
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className={`${control} mt-3 !text-xs`}
                  >
                    Tekrar dene
                  </button>
                </div>
              ) : (
                <>
                  <section
                    aria-labelledby={`${id}-shelves`}
                    className="overflow-hidden border border-slate-300 bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-3 py-3 sm:px-4">
                      <div>
                        <h3
                          id={`${id}-shelves`}
                          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700"
                        >
                          <Layers size={15} className="text-violet-600" />
                          Raf dağılımı
                          <span className="border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                            {shelves.length}
                          </span>
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {shelfSearch ? "Eşleşen raflarda" : "Raflarda toplam"}{" "}
                          {number(matchedShelfTotal)} adet
                        </p>
                      </div>
                      <label className="relative w-full sm:w-52">
                        <Search
                          size={13}
                          className="absolute left-2.5 top-3 text-slate-400"
                        />
                        <span className="sr-only">Ürünün raflarında ara</span>
                        <input
                          type="search"
                          value={shelfSearch}
                          onChange={(event) =>
                            setShelfSearch(event.target.value)
                          }
                          placeholder="Raf listesinde ara…"
                          className="h-9 w-full border border-slate-300 bg-white pl-8 pr-2 text-xs outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                        />
                      </label>
                    </div>
                    {!shelves.length ? (
                      <EmptyState
                        title="Raf kaydı bulunamadı"
                        description={
                          shelfSearch
                            ? "Raf aramasını değiştirin."
                            : "Bu ürünün bağlı şubede aktif raf stoğu bulunmuyor."
                        }
                      />
                    ) : (
                      <div className="relative overflow-x-auto">
                        <table className="w-full table-fixed text-left">
                          <caption className="sr-only">
                            Ürünün bağlı şubedeki raf dağılımı
                          </caption>
                          <thead className="bg-[#172033] text-[10px] uppercase tracking-wider text-slate-300">
                            <tr>
                              <th scope="col" className="px-3 py-2 sm:px-4">
                                Raf / Lokasyon
                              </th>
                              <th scope="col" className="px-3 py-2">
                                Durum
                              </th>
                              <th
                                scope="col"
                                className="w-24 px-3 py-2 text-right text-white"
                              >
                                Stok
                              </th>
                              <th
                                scope="col"
                                className="hidden w-28 px-4 py-2 text-right sm:table-cell"
                              >
                                Dağılım
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {shelves.map((shelf, index) => (
                              <tr
                                key={`${shelf.shelf_id}:${shelf.name}:${index}`}
                                className="odd:bg-white even:bg-slate-50/70"
                              >
                                <td className="break-all px-3 py-3 font-mono font-semibold text-slate-700 sm:px-4">
                                  {shelf.name}
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold ${shelf.status === "hasarli" ? "border-red-200 bg-red-50 text-red-700" : shelf.status === "normal" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400"}`}
                                  >
                                    {shelf.status === "hasarli" && (
                                      <TriangleAlert size={10} />
                                    )}
                                    {shelfLabel(shelf)}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-base font-bold text-slate-900">
                                  {number(shelf.quantity)}
                                </td>
                                <td className="hidden px-4 py-3 sm:table-cell">
                                  <div
                                    aria-hidden="true"
                                    className="h-1.5 bg-slate-100"
                                  >
                                    <div
                                      style={{
                                        width: `${Math.max(0, Math.min(100, (shelf.quantity / maxShelfQuantity) * 100))}%`,
                                      }}
                                      className={`h-full ${shelf.status === "hasarli" ? "bg-[#dc3545]" : "bg-violet-500"}`}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                  <section
                    aria-labelledby={`${id}-logs`}
                    className="overflow-hidden border border-slate-300 bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-[#172033] px-3 py-3 sm:px-4">
                      <div>
                        <h3
                          id={`${id}-logs`}
                          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white"
                        >
                          <Activity size={15} className="text-violet-300" />
                          Hareket geçmişi
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {number(logs.length)} işlem{" "}
                          <span className="mx-1 text-slate-600">/</span>
                          <span className="text-emerald-400">
                            {number(inCount)} giriş
                          </span>{" "}
                          <span className="mx-1 text-slate-600">/</span>
                          <span className="text-red-400">
                            {number(outCount)} çıkış
                          </span>
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Yeniden eskiye
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 p-3 sm:flex-row">
                      <label className="relative min-w-0 flex-1">
                        <Search
                          size={14}
                          className="absolute left-2.5 top-3 text-slate-400"
                        />
                        <span className="sr-only">
                          Hareketlerde raf, operatör veya sebep ara
                        </span>
                        <input
                          type="search"
                          value={logSearch}
                          onChange={(event) => {
                            setLogSearch(event.target.value);
                            setLogPage(1);
                          }}
                          placeholder="Raf, operatör veya sebep ara…"
                          className="h-9 w-full border border-slate-300 bg-white pl-8 pr-2 text-xs outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                        />
                      </label>
                      <div className="flex border border-slate-200 bg-white p-0.5">
                        {(
                          [
                            { key: "ALL", label: "Tümü" },
                            { key: "IN", label: "Giriş" },
                            { key: "OUT", label: "Çıkış" },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            aria-pressed={movementFilter === option.key}
                            onClick={() => {
                              setMovementFilter(option.key);
                              setLogPage(1);
                            }}
                            className={`min-h-8 flex-1 px-3 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:flex-none ${movementFilter === option.key ? "bg-violet-700 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {!shownLogs.length ? (
                      <EmptyState
                        title="Hareket bulunamadı"
                        description={
                          logs.length
                            ? "Aramayı veya işlem türü filtresini değiştirin."
                            : "Bu ürünün barkoduyla eşleşen raflama veya kaldırma kaydı bulunamadı."
                        }
                      />
                    ) : (
                      <div className="relative hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[720px] text-left">
                          <caption className="sr-only">
                            Ürünün bağlı şubedeki raflama ve kaldırma
                            hareketleri
                          </caption>
                          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                            <tr>
                              <th scope="col" className="px-3 py-2">
                                Zaman
                              </th>
                              <th scope="col" className="px-3 py-2">
                                İşlem
                              </th>
                              <th scope="col" className="px-3 py-2">
                                Raf
                              </th>
                              <th scope="col" className="px-3 py-2">
                                Operatör
                              </th>
                              <th scope="col" className="px-3 py-2 text-right">
                                Adet
                              </th>
                              <th scope="col" className="w-10">
                                <span className="sr-only">Açıklama</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="text-[11px]">
                            {shownLogs.map((log) => (
                              <LogRows
                                key={log.id}
                                log={log}
                                expanded={expanded.has(log.id)}
                                panelId={`${id}-${log.id}`}
                                onToggle={() =>
                                  setExpanded((previous) => {
                                    const next = new Set(previous);
                                    if (next.has(log.id)) next.delete(log.id);
                                    else next.add(log.id);
                                    return next;
                                  })
                                }
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {shownLogs.length > 0 && (
                      <div className="divide-y divide-slate-200 md:hidden">
                        {shownLogs.map((log) => (
                          <LogCard
                            key={log.id}
                            log={log}
                            expanded={expanded.has(log.id)}
                            panelId={`${id}-${log.id}-mobile`}
                            onToggle={() =>
                              setExpanded((previous) => {
                                const next = new Set(previous);
                                if (next.has(log.id)) next.delete(log.id);
                                else next.add(log.id);
                                return next;
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-[10px] text-slate-400">
                        {number(visibleLogs.length)} işlem · {currentLogPage} /{" "}
                        {logPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Önceki hareket sayfası"
                          disabled={currentLogPage === 1}
                          onClick={() => setLogPage(currentLogPage - 1)}
                          className={`${control} !min-h-8 px-2`}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Sonraki hareket sayfası"
                          disabled={currentLogPage === logPages}
                          onClick={() => setLogPage(currentLogPage + 1)}
                          className={`${control} !min-h-8 px-2`}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-300 bg-white px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-5">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Clock3 size={12} />
            Türkiye saati · UTC+3
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Ürün detaylarını yenile"
              onClick={() => void load()}
              disabled={loading}
              className={`${control} flex items-center gap-2 !text-xs`}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Yenile</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 border border-slate-900 bg-slate-900 px-5 text-xs font-semibold text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Kapat
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function LogRows({
  log,
  expanded,
  panelId,
  onToggle,
}: {
  log: InventoryLog;
  expanded: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const incoming = direction(log) === "IN";
  const outgoing = direction(log) === "OUT";
  const reason = logReason(log.description);
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-violet-50/30">
        <td className="whitespace-nowrap px-3 py-2.5 text-[10px] text-slate-500">
          {formatDate(log.created_at)}
        </td>
        <td className="px-3 py-2.5">
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${incoming ? "text-emerald-700" : outgoing ? "text-red-600" : "text-violet-700"}`}
          >
            {incoming ? (
              <ArrowDownLeft size={13} />
            ) : (
              <ArrowUpRight size={13} />
            )}
            {incoming
              ? "Raflama"
              : outgoing
                ? "Raftan kaldırma"
                : log.action_type.replace(/_/g, " ")}
          </span>
        </td>
        <td className="px-3 py-2.5 font-mono text-[10px] text-slate-600">
          {logShelf(log.description)}
        </td>
        <td className="px-3 py-2.5 text-slate-500">{log.employee_name}</td>
        <td
          className={`px-3 py-2.5 text-right font-mono text-sm font-bold ${incoming ? "text-emerald-600" : "text-red-600"}`}
        >
          {log.new_value || "—"}
        </td>
        <td className="pr-2 text-right">
          <button
            type="button"
            aria-label={`${formatDate(log.created_at)} işlem açıklamasını ${expanded ? "kapat" : "aç"}`}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={onToggle}
            className="inline-flex h-8 w-8 items-center justify-center text-slate-400 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <ChevronDown size={14} className={expanded ? "rotate-180" : ""} />
          </button>
        </td>
      </tr>
      <tr
        id={panelId}
        hidden={!expanded}
        className="border-b border-slate-200 bg-violet-50/40"
      >
        <td colSpan={6} className="px-4 py-3">
          {reason && (
            <p className="mb-1 text-xs text-slate-700">
              <strong>Sebep: </strong>
              {reason}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words text-[11px] leading-6 text-slate-500">
            {log.description}
          </p>
        </td>
      </tr>
    </>
  );
}

function LogCard({
  log,
  expanded,
  panelId,
  onToggle,
}: {
  log: InventoryLog;
  expanded: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const incoming = direction(log) === "IN";
  return (
    <article className="p-3">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`flex items-center gap-1.5 text-xs font-semibold ${incoming ? "text-emerald-700" : "text-red-600"}`}
        >
          {incoming ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
          {incoming ? "Raflama" : "Raftan kaldırma"}
        </span>
        <strong
          className={`font-mono text-base ${incoming ? "text-emerald-600" : "text-red-600"}`}
        >
          {log.new_value || "—"}
        </strong>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        {formatDate(log.created_at)} · {log.employee_name}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="min-w-0 break-all font-mono text-[11px] text-slate-500">
          {logShelf(log.description)}
        </span>
        <button
          type="button"
          aria-label={`${formatDate(log.created_at)} işlem açıklamasını ${expanded ? "kapat" : "aç"}`}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-8 shrink-0 items-center gap-1 px-1 text-[10px] font-semibold text-violet-700"
        >
          Açıklama
          <ChevronDown size={12} className={expanded ? "rotate-180" : ""} />
        </button>
      </div>
      <div
        id={panelId}
        hidden={!expanded}
        className="mt-2 border border-slate-200 bg-slate-50 p-3"
      >
        <p className="whitespace-pre-wrap break-words text-[11px] leading-6 text-slate-500">
          {log.description}
        </p>
      </div>
    </article>
  );
}
