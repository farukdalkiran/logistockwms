"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Barcode,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";

import { getStockHistoryModalDataServer } from "@/app/actions/inventory";

type LogItem = {
  id: string;
  created_at: string;
  action_type: string;
  description: string;
  new_value: string;
  employee_name: string;
};

type ShelfItem = {
  shelf_location: string;
  quantity: number;
};

type Props = {
  productId: string;
  productName: string;
  productBarcode?: string;
  productSku?: string | null;
  expectedTotal?: number;
  selectedShelfId?: number | null;
  branchId: string | null;
  isGlobal: boolean;
  onClose: () => void;
};

const PAGE_SIZE = 15;
const nf = new Intl.NumberFormat("tr-TR");

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Beklenmeyen bir hata oluştu.";
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getShelfStatus(name: string) {
  const upper = name.toLocaleUpperCase("tr-TR");

  if (upper.includes("-COK-")) {
    return {
      label: "Çok Hasarlı",
      className: "border-red-300 bg-red-100 text-red-800",
    };
  }

  if (upper.includes("-AZ-")) {
    return {
      label: "Az Hasarlı",
      className: "border-amber-300 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: "Standart / Belirsiz",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  };
}

function extractShelfName(description: string) {
  if (!description) return "-";

  return description.match(/RAF:\s*([A-Za-z0-9_-]+)/i)?.[1] || "-";
}

function extractReason(description: string) {
  if (!description) return "-";

  if (description.includes("| SEBEP:")) {
    return description.split("| SEBEP:")[1]?.trim() || "-";
  }

  return (
    description
      .replace(/\[.*?\]/g, "")
      .replace(/RAF:\s*[A-Za-z0-9_-]+/gi, "")
      .trim() || "-"
  );
}

function getMovementType(log: LogItem) {
  const action = log.action_type.toUpperCase();
  const value = log.new_value;

  if (
    action.includes("INBOUND") ||
    action.includes("PUTAWAY") ||
    value.startsWith("+")
  ) {
    return "IN";
  }

  if (
    action.includes("OUTBOUND") ||
    action.includes("PICKING") ||
    value.startsWith("-")
  ) {
    return "OUT";
  }

  return "OTHER";
}

export default function StockHistoryModal({
  productId,
  productName,
  productBarcode,
  productSku,
  expectedTotal,
  branchId,
  isGlobal,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"SHELVES" | "LOGS">("SHELVES");

  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [logSearch, setLogSearch] = useState("");
  const [logFilter, setLogFilter] = useState("ALL");
  const [logPage, setLogPage] = useState(1);

  const loadData = useCallback(async () => {
    if (!productId) {
      setError("Ürün kimliği bulunamadı.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const keyword = productName.trim().split(/\s+/)[0] || "";

      const response = await getStockHistoryModalDataServer(
        productId,
        branchId,
        isGlobal,
        keyword,
      );

      const shelfRows: ShelfItem[] = (response.shelves || []).map((item) => ({
        shelf_location: String(item.shelf_location || "-"),
        quantity: Number(item.quantity) || 0,
      }));

      const logRows: LogItem[] = (response.logs || []).map((log: any) => {
        let employeeName = "Sistem / Otomasyon";

        if (log.employees) {
          if (Array.isArray(log.employees)) {
            employeeName = log.employees[0]?.full_name || employeeName;
          } else {
            employeeName = log.employees.full_name || employeeName;
          }
        }

        return {
          id: String(log.id),
          created_at: String(log.created_at || ""),
          action_type: String(log.action_type || "SYSTEM"),
          description: String(log.description || ""),
          new_value: String(log.new_value ?? ""),
          employee_name: employeeName,
        };
      });

      logRows.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setShelves(shelfRows);
      setLogs(logRows);
    } catch (err) {
      setError(getErrorMessage(err));
      setShelves([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [productId, productName, branchId, isGlobal]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEsc);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const groupedShelves = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of shelves) {
      const name = item.shelf_location || "-";

      map.set(name, (map.get(name) || 0) + Number(item.quantity || 0));
    }

    return Array.from(map.entries())
      .map(([shelf_location, quantity]) => ({
        shelf_location,
        quantity,
      }))
      .sort(
        (a, b) =>
          b.quantity - a.quantity ||
          a.shelf_location.localeCompare(b.shelf_location, "tr"),
      );
  }, [shelves]);

  const shelfTotal = groupedShelves.reduce(
    (sum, shelf) => sum + shelf.quantity,
    0,
  );

  const damagedCount = groupedShelves.filter((shelf) => {
    const name = shelf.shelf_location.toUpperCase();

    return name.includes("-AZ-") || name.includes("-COK-");
  }).length;

  const maxQuantity = Math.max(
    1,
    ...groupedShelves.map((shelf) => shelf.quantity),
  );

  const filteredLogs = useMemo(() => {
    const term = logSearch.toLocaleLowerCase("tr-TR").trim();

    return logs.filter((log) => {
      if (logFilter !== "ALL" && getMovementType(log) !== logFilter) {
        return false;
      }

      if (!term) return true;

      return [
        log.action_type,
        log.description,
        log.new_value,
        log.employee_name,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(term);
    });
  }, [logs, logSearch, logFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));

  const safePage = Math.min(logPage, totalPages);

  const paginatedLogs = filteredLogs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const exportLogs = () => {
    if (!filteredLogs.length) return;

    const worksheet = XLSX.utils.json_to_sheet(
      filteredLogs.map((log) => ({
        Tarih: formatDate(log.created_at),
        Raf: extractShelfName(log.description),
        "İşlem Türü": log.action_type,
        Adet: log.new_value,
        Operatör: log.employee_name,
        Açıklama: log.description,
      })),
    );

    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 25 },
      { wch: 25 },
      { wch: 14 },
      { wch: 26 },
      { wch: 60 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Hareket_Gecmisi");

    XLSX.writeFile(workbook, `WMS_Log_${productBarcode || productId}.xlsx`);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 p-0 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Stok ve raf detayları"
        className="flex h-full w-full max-w-[1400px] flex-col overflow-hidden border border-slate-500 bg-[#f3f5f8] shadow-2xl sm:h-[94vh]"
      >
        {/* HEADER */}
        <div className="shrink-0 border-b-[3px] border-[#dc3545] bg-[#111c2f] p-4 text-white md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="hidden border border-slate-600 bg-slate-800 p-3 sm:block">
                <Package size={22} />
              </div>

              <div className="min-w-0">
                <div className="text-[11px] text-red-300">
                  LOGISTOCK / STOK DETAYLARI
                </div>

                <h2 className="mt-1 text-xl leading-7 text-white md:text-2xl">
                  {productName || "Bilinmeyen Ürün"}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
                  {productBarcode && (
                    <span className="flex items-center gap-2">
                      <Barcode size={14} />
                      {productBarcode}
                    </span>
                  )}

                  <span>SKU: {productSku || "-"}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex shrink-0 items-center gap-2 border border-slate-600 bg-slate-800 px-3 py-2 text-xs hover:bg-[#dc3545]"
            >
              Kapat
              <X size={18} />
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid shrink-0 grid-cols-2 border-b border-slate-300 bg-white lg:grid-cols-4">
          {[
            {
              label: "RAF STOK TOPLAMI",
              value: loading ? "-" : nf.format(shelfTotal),
            },
            {
              label: "RAF SAYISI",
              value: loading ? "-" : nf.format(groupedShelves.length),
            },
            {
              label: "HASARLI RAF KODU",
              value: loading ? "-" : nf.format(damagedCount),
            },
            {
              label: "HAREKET KAYDI",
              value: loading ? "-" : nf.format(logs.length),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border-r border-b border-slate-200 p-4 lg:border-b-0"
            >
              <div className="text-[10px] text-slate-500">{item.label}</div>
              <div className="mt-2 text-2xl text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex shrink-0 border-b border-slate-300 bg-white px-3">
          <button
            type="button"
            onClick={() => setActiveTab("SHELVES")}
            className={`flex items-center gap-2 border-b-[3px] px-4 py-4 text-xs ${
              activeTab === "SHELVES"
                ? "border-[#dc3545] text-slate-900"
                : "border-transparent text-slate-500"
            }`}
          >
            <Layers size={16} />
            Raf Dağılımı
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("LOGS")}
            className={`flex items-center gap-2 border-b-[3px] px-4 py-4 text-xs ${
              activeTab === "LOGS"
                ? "border-[#dc3545] text-slate-900"
                : "border-transparent text-slate-500"
            }`}
          >
            <Activity size={16} />
            Hareket Geçmişi
          </button>
        </div>

        {/* CONTENT */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
          {loading ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-[#dc3545]" />
              <span className="text-xs text-slate-500">
                Raf ve hareket kayıtları getiriliyor...
              </span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle size={18} />
              {error}
            </div>
          ) : activeTab === "SHELVES" ? (
            <div className="overflow-hidden border border-slate-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-4 py-4">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-[#dc3545]" />
                  <h3 className="text-sm text-slate-900">Aktif Raf Dağılımı</h3>
                </div>

                <span className="text-xs text-slate-600">
                  {groupedShelves.length} raf / {nf.format(shelfTotal)} adet
                </span>
              </div>

              {typeof expectedTotal === "number" &&
                expectedTotal !== shelfTotal && (
                  <div className="flex gap-2 border-b border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertTriangle size={16} className="shrink-0" />
                    Liste toplamı ({nf.format(expectedTotal)}) ile detay toplamı
                    ({nf.format(shelfTotal)}) uyuşmuyor. Verileri yenileyip
                    sunucu sorgularının aynı stok kapsamını kullandığını kontrol
                    edin.
                  </div>
                )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] border-collapse text-left">
                  <thead className="bg-[#172338] text-[11px] text-white">
                    <tr>
                      <th className="border-r border-slate-700 px-4 py-4">
                        Raf / Lokasyon
                      </th>
                      <th className="border-r border-slate-700 px-4 py-4 text-center">
                        Raf Durumu
                      </th>
                      <th className="border-r border-slate-700 px-4 py-4">
                        Stok Dağılımı
                      </th>
                      <th className="px-4 py-4 text-right">Mevcut Adet</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 text-xs">
                    {groupedShelves.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-14 text-center text-slate-500"
                        >
                          Bu ürün için raf kaydı bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      groupedShelves.map((shelf) => {
                        const status = getShelfStatus(shelf.shelf_location);

                        const percent =
                          shelfTotal > 0
                            ? (shelf.quantity / shelfTotal) * 100
                            : 0;

                        const width = (shelf.quantity / maxQuantity) * 100;

                        return (
                          <tr
                            key={shelf.shelf_location}
                            className="hover:bg-slate-50"
                          >
                            <td className="border-r border-slate-100 px-4 py-4 text-slate-900">
                              <div className="flex items-center gap-2">
                                <Layers size={15} className="text-[#dc3545]" />
                                {shelf.shelf_location}
                              </div>
                            </td>

                            <td className="border-r border-slate-100 px-4 py-4 text-center">
                              <span
                                className={`inline-flex border px-2 py-1 text-[11px] ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </td>

                            <td className="border-r border-slate-100 px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 bg-slate-100">
                                  <div
                                    className="h-2 bg-[#dc3545]"
                                    style={{
                                      width: `${Math.max(
                                        0,
                                        Math.min(100, width),
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <span className="w-14 text-right text-slate-600">
                                  %
                                  {percent.toLocaleString("tr-TR", {
                                    maximumFractionDigits: 1,
                                  })}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-right">
                              <span className="text-lg text-slate-900">
                                {nf.format(shelf.quantity)}
                              </span>
                              <span className="ml-1 text-[10px] text-slate-400">
                                Adet
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {groupedShelves.length > 0 && (
                    <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-sm text-slate-900">
                      <tr>
                        <td colSpan={3} className="px-4 py-4">
                          Toplam Raf Stoku
                        </td>
                        <td className="px-4 py-4 text-right">
                          {nf.format(shelfTotal)} Adet
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-300 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 p-4">
                <div>
                  <h3 className="text-sm text-slate-900">
                    Detaylı İşlem Geçmişi
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Ürün giriş, çıkış ve sistem işlemleri
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void loadData()}
                    className="flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <RefreshCw size={14} />
                    Yenile
                  </button>

                  <button
                    type="button"
                    onClick={exportLogs}
                    disabled={filteredLogs.length === 0}
                    className="flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-xs disabled:opacity-40"
                  >
                    <Download size={14} />
                    Excel
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 border-b border-slate-200 p-3">
                <div className="relative min-w-[200px] flex-1">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={logSearch}
                    onChange={(event) => {
                      setLogSearch(event.target.value);
                      setLogPage(1);
                    }}
                    placeholder="Raf, operatör veya işlem ara..."
                    className="h-10 w-full border border-slate-300 pl-10 pr-3 text-xs outline-none focus:border-[#dc3545]"
                  />
                </div>

                <select
                  value={logFilter}
                  onChange={(event) => {
                    setLogFilter(event.target.value);
                    setLogPage(1);
                  }}
                  className="h-10 border border-slate-300 bg-white px-3 text-xs"
                >
                  <option value="ALL">Tüm Hareketler</option>
                  <option value="IN">Giriş Hareketleri</option>
                  <option value="OUT">Çıkış Hareketleri</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] border-collapse text-left">
                  <thead className="bg-[#172338] text-[11px] text-white">
                    <tr>
                      <th className="px-3 py-3">Tarih / Saat</th>
                      <th className="px-3 py-3">Raf</th>
                      <th className="px-3 py-3">İşlem</th>
                      <th className="px-3 py-3 text-center">Miktar</th>
                      <th className="px-3 py-3">Operatör</th>
                      <th className="px-3 py-3">Açıklama</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 text-xs">
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-12 text-center text-slate-500"
                        >
                          Hareket kaydı bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => {
                        const direction = getMovementType(log);

                        return (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                              {formatDate(log.created_at)}
                            </td>

                            <td className="px-3 py-3 text-slate-800">
                              {extractShelfName(log.description)}
                            </td>

                            <td className="px-3 py-3">
                              <span
                                className={`inline-block border px-2 py-1 text-[11px] ${
                                  direction === "IN"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : direction === "OUT"
                                      ? "border-red-200 bg-red-50 text-red-700"
                                      : "border-slate-200 bg-slate-100 text-slate-600"
                                }`}
                              >
                                {log.action_type.replace(/_/g, " ")}
                              </span>
                            </td>

                            <td className="px-3 py-3 text-center text-sm text-slate-900">
                              {log.new_value || "-"}
                            </td>

                            <td className="px-3 py-3 text-slate-800">
                              {log.employee_name}
                            </td>

                            <td className="max-w-[400px] px-3 py-3 text-slate-600">
                              {extractReason(log.description)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">
                  {nf.format(filteredLogs.length)} kayıt
                </span>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setLogPage(safePage - 1)}
                    className="border border-slate-300 bg-white p-2 disabled:opacity-30"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <span className="text-xs text-slate-700">
                    {safePage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setLogPage(safePage + 1)}
                    className="border border-slate-300 bg-white p-2 disabled:opacity-30"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
