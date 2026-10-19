
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Barcode,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  Layers,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";

import { getAggregatedInventoryServer } from "@/app/actions/inventory";
import StockHistoryModal from "./StockHistoryModal";

type AggregatedProduct = {
  product_id: string;
  id?: string;
  name: string;
  sku: string | null;
  barcode: string;
  category: string | null;
  total_quantity: number;
  shelf_count: number;
  is_consumable: boolean;
  has_damaged_shelf: boolean;
};

type Shelf = {
  id: number;
  name: string;
  status: string;
  branch_id: string;
};

type Stock = {
  id: string;
  product_id: string | null;
  branch_id: string | null;
  shelf_id: number | null;
  shelf_location: string | null;
  quantity: number;
};

type DisplayProduct = AggregatedProduct & {
  selected_quantity: number;
};

type ReportFilter =
  | "ALL"
  | "COMMERCIAL"
  | "CONSUMABLE"
  | "DAMAGED"
  | "ACTIVE_SHELF"
  | "NO_STOCK";

type SortType =
  | "STOCK_DESC"
  | "STOCK_ASC"
  | "NAME";

type ModalProduct = {
  productId: string;
  productName: string;
  totalQuantity: number;
  barcode: string;
  sku: string | null;
};

const PAGE_SIZE = 15;
const BATCH_SIZE = 500;

const nf = new Intl.NumberFormat("tr-TR");

const formatNumber = (value: number) =>
  nf.format(Number(value) || 0);

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Beklenmeyen bir hata oluştu.";
}

function normalizeProduct(
  item: AggregatedProduct
): AggregatedProduct {
  return {
    ...item,
    product_id: String(item.product_id || item.id || ""),
    name: item.name || "İsimsiz Ürün",
    barcode: item.barcode || "",
    sku: item.sku || null,
    category: item.category || null,
    total_quantity: Number(item.total_quantity) || 0,
    shelf_count: Number(item.shelf_count) || 0,
    is_consumable: Boolean(item.is_consumable),
    has_damaged_shelf: Boolean(item.has_damaged_shelf),
  };
}

export default function InventoryViewPanel({
  branchId,
  isGlobal,
}: {
  branchId: string | null;
  isGlobal: boolean;
}) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // DATA
  const [products, setProducts] = useState<AggregatedProduct[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);

  // SEARCH
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedShelfId, setSelectedShelfId] = useState("");

  // FILTER
  const [reportFilter, setReportFilter] =
    useState<ReportFilter>("ALL");

  // DEFAULT: EN YÜKSEK STOK
  const [sortType, setSortType] =
    useState<SortType>("STOCK_DESC");

  const [currentPage, setCurrentPage] = useState(1);

  // STATUS
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [shelfLoading, setShelfLoading] = useState(false);
  const [shelfReady, setShelfReady] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [shelfError, setShelfError] = useState<string | null>(null);

  const [modalProduct, setModalProduct] =
    useState<ModalProduct | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const productRequestRef = useRef(0);
  const shelfRequestRef = useRef(0);

  // --------------------------------------------------
  // 1. PRODUCT QUERY
  // --------------------------------------------------

  const loadProducts = useCallback(
    async (term: string, initial = false) => {
      const requestId = ++productRequestRef.current;

      if (initial) {
        setInitialLoading(true);
      } else {
        setSearching(true);
      }

      setError(null);

      try {
        const response = await getAggregatedInventoryServer(
          term,
          branchId,
          isGlobal
        );

        if (requestId !== productRequestRef.current) return;

        if (!Array.isArray(response)) {
          throw new Error("Geçersiz ürün listesi alındı.");
        }

        const normalized = response
          .map((item) =>
            normalizeProduct(item as AggregatedProduct)
          )
          .filter((item) => item.product_id);

        setProducts(normalized);
        setCurrentPage(1);
      } catch (err) {
        if (requestId !== productRequestRef.current) return;

        setError(
          `Ürün sorgulaması başarısız: ${getErrorMessage(err)}`
        );
      } finally {
        if (requestId === productRequestRef.current) {
          setInitialLoading(false);
          setSearching(false);
        }
      }
    },
    [branchId, isGlobal]
  );

  // --------------------------------------------------
  // 2. SHELF / STOCK QUERY
  // --------------------------------------------------

  const loadShelfData = useCallback(async () => {
    const requestId = ++shelfRequestRef.current;

    setShelfLoading(true);
    setShelfReady(false);
    setShelfError(null);

    try {
      if (!isGlobal && !branchId) {
        throw new Error("Şube bilgisi bulunamadı.");
      }

      let shelfQuery = supabase
        .from("shelves")
        .select("id,name,status,branch_id")
        .order("name", { ascending: true });

      if (!isGlobal && branchId) {
        shelfQuery = shelfQuery.eq("branch_id", branchId);
      }

      const { data: shelfData, error: shelfDbError } =
        await shelfQuery;

      if (shelfDbError) throw shelfDbError;

      const allStocks: Stock[] = [];
      let start = 0;

      while (true) {
        let stockQuery = supabase
          .from("stocks")
          .select(
            "id,product_id,branch_id,shelf_id,shelf_location,quantity"
          )
          .order("id", { ascending: true })
          .range(start, start + BATCH_SIZE - 1);

        if (!isGlobal && branchId) {
          stockQuery = stockQuery.eq("branch_id", branchId);
        }

        const { data, error: stockDbError } = await stockQuery;

        if (stockDbError) throw stockDbError;

        const batch = (data || []) as Stock[];
        allStocks.push(...batch);

        if (batch.length < BATCH_SIZE) break;

        start += BATCH_SIZE;
      }

      if (requestId !== shelfRequestRef.current) return;

      setShelves((shelfData || []) as Shelf[]);
      setStocks(allStocks);
      setShelfReady(true);
    } catch (err) {
      if (requestId !== shelfRequestRef.current) return;

      setShelfError(getErrorMessage(err));
      setShelfReady(false);
    } finally {
      if (requestId === shelfRequestRef.current) {
        setShelfLoading(false);
      }
    }
  }, [supabase, branchId, isGlobal]);

  useEffect(() => {
    void loadProducts("", true);
    void loadShelfData();

    return () => {
      productRequestRef.current += 1;
      shelfRequestRef.current += 1;
    };
  }, [loadProducts, loadShelfData]);

  // --------------------------------------------------
  // 3. STOCK AGGREGATION
  // --------------------------------------------------

  const shelfMap = useMemo(() => {
    return new Map(
      shelves.map((shelf) => [shelf.id, shelf])
    );
  }, [shelves]);

  const selectedShelf = useMemo(() => {
    return shelves.find(
      (shelf) => String(shelf.id) === selectedShelfId
    );
  }, [shelves, selectedShelfId]);

  const stockByProduct = useMemo(() => {
    const result = new Map<
      string,
      {
        total: number;
        shelfIds: Set<number>;
        damaged: boolean;
        selectedQuantity: number;
      }
    >();

    for (const stock of stocks) {
      if (!stock.product_id) continue;

      const current = result.get(stock.product_id) || {
        total: 0,
        shelfIds: new Set<number>(),
        damaged: false,
        selectedQuantity: 0,
      };

      const quantity = Number(stock.quantity) || 0;

      current.total += quantity;

      if (stock.shelf_id !== null && quantity > 0) {
        current.shelfIds.add(stock.shelf_id);

        const shelf = shelfMap.get(stock.shelf_id);

        if (shelf?.status === "hasarli") {
          current.damaged = true;
        }
      }

      if (
        selectedShelfId &&
        stock.shelf_id === Number(selectedShelfId)
      ) {
        current.selectedQuantity += quantity;
      }

      result.set(stock.product_id, current);
    }

    return result;
  }, [stocks, shelfMap, selectedShelfId]);

  // --------------------------------------------------
  // 4. GLOBAL COUNTS
  // --------------------------------------------------

  // All accessible stock records.
  // Independent of product search and report filters.
  const warehouseTotalStock = useMemo(() => {
    if (!shelfReady) return null;

    return stocks.reduce(
      (sum, stock) => sum + (Number(stock.quantity) || 0),
      0
    );
  }, [stocks, shelfReady]);

  const warehouseProductCount = useMemo(() => {
    if (!shelfReady) return null;

    return new Set(
      stocks
        .filter((stock) => Number(stock.quantity) > 0)
        .map((stock) => stock.product_id)
        .filter(Boolean)
    ).size;
  }, [stocks, shelfReady]);

  const warehouseShelfCount = useMemo(() => {
    if (!shelfReady) return null;

    return new Set(
      stocks
        .filter(
          (stock) =>
            Number(stock.quantity) > 0 &&
            stock.shelf_id !== null
        )
        .map((stock) => stock.shelf_id)
    ).size;
  }, [stocks, shelfReady]);

  const warehouseSelectedShelfTotal = useMemo(() => {
    if (!shelfReady || !selectedShelfId) return null;

    return stocks.reduce((sum, stock) => {
      if (stock.shelf_id === Number(selectedShelfId)) {
        return sum + (Number(stock.quantity) || 0);
      }

      return sum;
    }, 0);
  }, [stocks, shelfReady, selectedShelfId]);

  // --------------------------------------------------
  // 5. PRODUCTS + FILTER
  // --------------------------------------------------

  const visibleProducts = useMemo<DisplayProduct[]>(() => {
    const filtered = products
      .map((product) => {
        const info = stockByProduct.get(product.product_id);

        return {
          ...product,

          total_quantity: shelfReady
            ? info?.total ?? 0
            : product.total_quantity,

          shelf_count: shelfReady
            ? info?.shelfIds.size ?? 0
            : product.shelf_count,

          has_damaged_shelf: shelfReady
            ? info?.damaged ?? false
            : product.has_damaged_shelf,

          selected_quantity: info?.selectedQuantity ?? 0,
        };
      })
      .filter((product) => {
        if (selectedShelfId) {
          if (
            !shelfReady ||
            product.selected_quantity <= 0
          ) {
            return false;
          }
        }

        switch (reportFilter) {
          case "COMMERCIAL":
            return !product.is_consumable;

          case "CONSUMABLE":
            return product.is_consumable;

          case "DAMAGED":
            return product.has_damaged_shelf;

          case "ACTIVE_SHELF":
            return (
              product.shelf_count > 0 &&
              !product.has_damaged_shelf
            );

          case "NO_STOCK":
            return product.total_quantity === 0;

          default:
            return true;
        }
      });

    // DEFAULT SORT: HIGHEST STOCK FIRST
    filtered.sort((a, b) => {
      const qtyA = selectedShelfId
        ? a.selected_quantity
        : a.total_quantity;

      const qtyB = selectedShelfId
        ? b.selected_quantity
        : b.total_quantity;

      if (sortType === "STOCK_DESC") {
        return (
          qtyB - qtyA ||
          a.name.localeCompare(b.name, "tr")
        );
      }

      if (sortType === "STOCK_ASC") {
        return (
          qtyA - qtyB ||
          a.name.localeCompare(b.name, "tr")
        );
      }

      return a.name.localeCompare(b.name, "tr");
    });

    return filtered;
  }, [
    products,
    stockByProduct,
    selectedShelfId,
    reportFilter,
    sortType,
    shelfReady,
  ]);

  // --------------------------------------------------
  // 6. FILTERED TOTALS
  // --------------------------------------------------

  const filteredTotalStock = useMemo(() => {
    return visibleProducts.reduce(
      (sum, item) => sum + item.total_quantity,
      0
    );
  }, [visibleProducts]);

  const filteredSelectedShelfStock = useMemo(() => {
    return visibleProducts.reduce(
      (sum, item) => sum + item.selected_quantity,
      0
    );
  }, [visibleProducts]);

  const filteredInStockCount = useMemo(() => {
    return visibleProducts.filter(
      (item) => item.total_quantity > 0
    ).length;
  }, [visibleProducts]);

  const filteredZeroStockCount = useMemo(() => {
    return visibleProducts.filter(
      (item) => item.total_quantity === 0
    ).length;
  }, [visibleProducts]);

  // --------------------------------------------------
  // 7. PAGINATION
  // --------------------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(visibleProducts.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;

    return visibleProducts.slice(
      start,
      start + PAGE_SIZE
    );
  }, [visibleProducts, safePage]);

  const firstRecord =
    visibleProducts.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1;

  const lastRecord = Math.min(
    safePage * PAGE_SIZE,
    visibleProducts.length
  );

  // --------------------------------------------------
  // 8. ACTIONS
  // --------------------------------------------------

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    void loadProducts(searchTerm.trim());
  };

  const handleClear = () => {
    setSearchTerm("");
    setSelectedShelfId("");
    setReportFilter("ALL");
    setSortType("STOCK_DESC");
    setCurrentPage(1);

    void loadProducts("");

    inputRef.current?.focus();
  };

  const handleRefresh = () => {
    void loadProducts(searchTerm.trim());
    void loadShelfData();
  };

  const exportExcel = () => {
    if (!visibleProducts.length) return;

    const rows = visibleProducts.map((item, index) => ({
      "Sıra": index + 1,
      "Barkod": item.barcode,
      "SKU": item.sku || "-",
      "Ürün Adı": item.name,
      "Kategori": item.category || "-",
      "Tür": item.is_consumable
        ? "Sarf Malzeme"
        : "Ticari Ürün",
      "Toplam Stok": item.total_quantity,
      "Raf Sayısı": item.shelf_count,
      "Hasarlı Raf": item.has_damaged_shelf
        ? "Evet"
        : "Hayır",
      ...(selectedShelfId
        ? {
            "Seçili Raf": selectedShelf?.name || "-",
            "Seçili Raf Adedi": item.selected_quantity,
          }
        : {}),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 20 },
      { wch: 55 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 15 },
      { wch: 28 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Stok_Raporu"
    );

    const date = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/Istanbul",
    });

    XLSX.writeFile(
      workbook,
      `WMS_Stok_Raporu_${date}.xlsx`
    );
  };

  const isBusy = initialLoading || searching || shelfLoading;

  const getStatValue = (value: number | null) => {
    if (value === null) return "—";

    return formatNumber(value);
  };

  // --------------------------------------------------
  // 9. RENDER
  // --------------------------------------------------

  return (
    <div className="flex w-full flex-col gap-5 text-slate-800">

      {/* HEADER */}
      <section className="overflow-hidden border border-slate-700 bg-[#111c2f] text-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 p-5 lg:flex-row lg:items-center lg:p-7">
          <div className="flex items-start gap-4">
            <div className="border border-red-400/30 bg-[#dc3545] p-3">
              <Layers size={24} />
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-red-300">
                LOGISTOCK WMS / ENVANTER YÖNETİMİ
              </div>

              <h1 className="mt-2 text-2xl text-white md:text-3xl">
                Canlı Stok ve Raf Sorgulama
              </h1>

              <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-300">
                Barkod, SKU veya ürün adına göre arama yapın.
                Raf seçerek lokasyon bazlı stokları görüntüleyin.
                Stoklar varsayılan olarak en yüksek adetten
                en düşük adede doğru sıralanır.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="border border-slate-600 bg-slate-800 px-4 py-3">
              <span className="block text-[10px] text-slate-400">
                ERİŞİM KAPSAMI
              </span>

              <span className="mt-1 block text-sm text-white">
                {isGlobal
                  ? "Global / Merkez"
                  : "Şube Envanteri"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isBusy}
              className="flex h-[60px] items-center gap-2 border border-slate-600 bg-slate-800 px-4 text-xs text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={isBusy ? "animate-spin" : ""}
              />
              Yenile
            </button>
          </div>
        </div>

        <div className="h-[3px] bg-[#dc3545]" />
      </section>

      {/* ERRORS */}
      {error && (
        <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle size={17} className="shrink-0" />
          {error}
        </div>
      )}

      {shelfError && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <AlertTriangle size={17} className="shrink-0" />

          <div>
            <div>Raf verileri okunamadı.</div>
            <div className="mt-1">{shelfError}</div>
            <div className="mt-1">
              Ürün sorgulaması kullanılabilir; ancak genel
              depo toplamı ve raf dağılımı doğrulanamadı.
            </div>
          </div>
        </div>
      )}

      {/* SEARCH */}
      <section className="border border-slate-300 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-5 py-3">
          <Search size={16} className="text-[#dc3545]" />

          <h2 className="text-sm text-slate-900">
            Gelişmiş Envanter Arama
          </h2>
        </div>

        <form onSubmit={handleSearch} className="p-4 md:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px_auto]">

            <div>
              <label
                htmlFor="inventory-search"
                className="mb-2 block text-[11px] text-slate-600"
              >
                Ürün Adı / Barkod / SKU
              </label>

              <div className="relative">
                <Barcode
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="inventory-search"
                  ref={inputRef}
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Ürün adı, barkod veya SKU giriniz..."
                  className="h-11 w-full border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-[#dc3545]"
                />

                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    aria-label="Aramayı temizle"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#dc3545]"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="inventory-shelf"
                className="mb-2 block text-[11px] text-slate-600"
              >
                Raf / Lokasyon
              </label>

              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#dc3545]"
                />

                <select
                  id="inventory-shelf"
                  value={selectedShelfId}
                  disabled={!shelfReady || shelfLoading}
                  onChange={(event) => {
                    setSelectedShelfId(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-11 w-full appearance-none border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-[#dc3545] disabled:bg-slate-100"
                >
                  <option value="">
                    {shelfLoading
                      ? "Raflar yükleniyor..."
                      : "Tüm Raflar"}
                  </option>

                  {shelves.map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      {shelf.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={searching}
                className="flex h-11 flex-1 items-center justify-center gap-2 bg-[#111c2f] px-6 text-xs text-white hover:bg-[#dc3545] disabled:opacity-50 lg:flex-none"
              >
                {searching ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                SORGULA
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="h-11 border border-slate-300 bg-slate-100 px-4 text-xs text-slate-700 hover:bg-slate-200"
              >
                TEMİZLE
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* WAREHOUSE TOTALS */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "GENEL TOPLAM RAF STOĞU",
            value: warehouseTotalStock,
            icon: Layers,
            note: "Erişilebilir tüm stok kayıtları",
          },
          {
            label: "STOKLU ÜRÜN ÇEŞİDİ",
            value: warehouseProductCount,
            icon: Package,
            note: "Stokta bulunan farklı ürünler",
          },
          {
            label: selectedShelfId
              ? "SEÇİLİ RAF TOPLAMI"
              : "KULLANILAN RAF",
            value: selectedShelfId
              ? warehouseSelectedShelfTotal
              : warehouseShelfCount,
            icon: MapPin,
            note: selectedShelfId
              ? selectedShelf?.name || "Seçili raf"
              : "Stok bulunan raf sayısı",
          },
          {
            label: "FİLTRELİ STOK TOPLAMI",
            value: initialLoading || searching
              ? null
              : filteredTotalStock,
            icon: Activity,
            note: "Listede filtreye uyan ürünler",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border border-slate-300 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">
                {stat.label}
              </span>

              <stat.icon
                size={17}
                className="text-[#dc3545]"
              />
            </div>

            <div className="mt-3 text-2xl text-slate-900">
              {shelfLoading &&
              stat.label !== "FİLTRELİ STOK TOPLAMI"
                ? "..."
                : getStatValue(stat.value)}
            </div>

            <div className="mt-1 truncate text-[10px] text-slate-400">
              {stat.note}
            </div>
          </div>
        ))}
      </section>

      {/* TABLE */}
      <section className="overflow-hidden border border-slate-300 bg-white shadow-sm">

        {/* TABLE TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 bg-slate-100 px-4 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Package
                size={17}
                className="text-[#dc3545]"
              />

              <h2 className="text-sm text-slate-900">
                Depo Stok Listesi
              </h2>
            </div>

            <p className="mt-1 text-[11px] text-slate-500">
              {formatNumber(visibleProducts.length)} ürün
              {" · "}
              {formatNumber(filteredTotalStock)} adet toplam
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter size={15} className="text-slate-500" />

            <select
              value={reportFilter}
              onChange={(event) => {
                setReportFilter(
                  event.target.value as ReportFilter
                );
                setCurrentPage(1);
              }}
              className="h-9 border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none"
            >
              <option value="ALL">Tüm Ürünler</option>
              <option value="ACTIVE_SHELF">
                Sağlam / Aktif Raf
              </option>
              <option value="DAMAGED">
                Hasarlı Raftakiler
              </option>
              <option value="COMMERCIAL">
                Ticari Ürünler
              </option>
              <option value="CONSUMABLE">
                Sarf Malzemeler
              </option>
              <option value="NO_STOCK">
                Stoku Sıfır Olanlar
              </option>
            </select>

            <select
              value={sortType}
              onChange={(event) => {
                setSortType(event.target.value as SortType);
                setCurrentPage(1);
              }}
              className="h-9 border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none"
            >
              <option value="STOCK_DESC">
                Stok: Çoktan Aza
              </option>
              <option value="STOCK_ASC">
                Stok: Azdan Çoğa
              </option>
              <option value="NAME">
                Ürün Adına Göre
              </option>
            </select>

            <button
              type="button"
              onClick={exportExcel}
              disabled={!visibleProducts.length || searching}
              className="flex h-9 items-center gap-2 border border-emerald-700 bg-emerald-700 px-4 text-xs text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              <FileSpreadsheet size={15} />
              EXCEL
            </button>
          </div>
        </div>

        {/* SELECTED SHELF */}
        {selectedShelf && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-red-800">
              <MapPin size={15} />

              <span>
                Seçilen Raf: {selectedShelf.name}
              </span>

              <span className="text-red-600">
                / {formatNumber(
                  warehouseSelectedShelfTotal ?? 0
                )} adet
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedShelfId("");
                setCurrentPage(1);
              }}
              className="text-xs text-red-700 underline"
            >
              Raf filtresini kaldır
            </button>
          </div>
        )}

        {/* TABLE CONTENT */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left">
            <thead className="bg-[#172338] text-[11px] text-white">
              <tr>
                <th className="w-12 border-r border-slate-700 px-3 py-4 text-center">
                  #
                </th>

                <th className="border-r border-slate-700 px-4 py-4">
                  Ürün / Kategori
                </th>

                <th className="border-r border-slate-700 px-4 py-4">
                  Barkod / SKU
                </th>

                <th className="border-r border-slate-700 px-4 py-4 text-center">
                  Ürün Türü
                </th>

                <th className="border-r border-slate-700 px-4 py-4 text-center">
                  Raf Durumu
                </th>

                <th className="w-36 border-r border-slate-700 px-4 py-4 text-center">
                  Toplam Stok
                </th>

                {selectedShelfId && (
                  <th className="w-32 border-r border-slate-700 px-4 py-4 text-center">
                    Seçili Raf
                  </th>
                )}

                <th className="w-32 px-4 py-4 text-center">
                  İşlem
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {initialLoading || searching || shelfLoading ? (
                <tr>
                  <td
                    colSpan={selectedShelfId ? 8 : 7}
                    className="px-4 py-20 text-center"
                  >
                    <Loader2
                      size={26}
                      className="mx-auto animate-spin text-[#dc3545]"
                    />

                    <div className="mt-3 text-xs text-slate-500">
                      Stok kayıtları hazırlanıyor...
                    </div>
                  </td>
                </tr>
              ) : selectedShelfId && !shelfReady ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-16 text-center text-sm text-amber-700"
                  >
                    Raf verileri okunamadığı için raf
                    sonuçları gösterilemiyor.
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectedShelfId ? 8 : 7}
                    className="px-4 py-20 text-center"
                  >
                    <Search
                      size={27}
                      className="mx-auto text-slate-300"
                    />

                    <div className="mt-3 text-sm text-slate-500">
                      Arama kriterlerine uygun stok bulunamadı.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((item, index) => (
                  <tr
                    key={item.product_id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    {/* ROW NUMBER */}
                    <td className="border-r border-slate-100 px-3 py-4 text-center text-[11px] text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + index + 1}
                    </td>

                    {/* PRODUCT */}
                    <td className="border-r border-slate-100 px-4 py-4">
                      <div
                        className="max-w-[350px] text-[13px] leading-5 text-slate-900"
                        title={item.name}
                      >
                        {item.name}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500">
                        {item.category || "Kategorisiz"}
                      </div>
                    </td>

                    {/* BARCODE */}
                    <td className="border-r border-slate-100 px-4 py-4">
                      <div className="text-xs text-[#dc3545]">
                        {item.barcode}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500">
                        {item.sku || "SKU Yok"}
                      </div>
                    </td>

                    {/* TYPE */}
                    <td className="border-r border-slate-100 px-4 py-4 text-center">
                      <span
                        className={`inline-block border px-2 py-1 text-[11px] ${
                          item.is_consumable
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.is_consumable
                          ? "Sarf Malzeme"
                          : "Ticari Ürün"}
                      </span>
                    </td>

                    {/* SHELF */}
                    <td className="border-r border-slate-100 px-4 py-4 text-center">
                      <div className="text-sm text-slate-900">
                        {item.shelf_count} Raf
                      </div>

                      <div
                        className={`mt-1 text-[11px] ${
                          item.has_damaged_shelf
                            ? "text-red-600"
                            : item.shelf_count > 0
                            ? "text-emerald-700"
                            : "text-slate-400"
                        }`}
                      >
                        {item.has_damaged_shelf
                          ? "Hasarlı Raf"
                          : item.shelf_count > 0
                          ? "Aktif Raf"
                          : "Raf Kaydı Yok"}
                      </div>
                    </td>

                    {/* TOTAL QUANTITY */}
                    <td className="border-r border-slate-100 bg-slate-50/60 px-4 py-4 text-center">
                      <div
                        className={`text-[23px] leading-none ${
                          item.total_quantity === 0
                            ? "text-red-600"
                            : "text-slate-900"
                        }`}
                      >
                        {formatNumber(item.total_quantity)}
                      </div>

                      <div className="mt-1 text-[10px] text-slate-400">
                        Adet
                      </div>
                    </td>

                    {/* SELECTED SHELF QUANTITY */}
                    {selectedShelfId && (
                      <td className="border-r border-slate-100 bg-red-50/50 px-4 py-4 text-center">
                        <div className="text-xl text-[#dc3545]">
                          {formatNumber(item.selected_quantity)}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-500">
                          Adet
                        </div>
                      </td>
                    )}

                    {/* ACTION */}
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setModalProduct({
                            productId: item.product_id,
                            productName: item.name,
                            totalQuantity: item.total_quantity,
                            barcode: item.barcode,
                            sku: item.sku,
                          })
                        }
                        className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-700 transition-colors hover:border-[#dc3545] hover:text-[#dc3545]"
                      >
                        <Activity size={14} />
                        Detay / Log
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* TABLE TOTAL */}
            {!isBusy && paginatedProducts.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100">
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-4 text-xs text-slate-700"
                  >
                    Filtreye Uyan Toplam
                    {" · "}
                    {formatNumber(visibleProducts.length)} ürün
                    {" · "}
                    {formatNumber(filteredInStockCount)} stoklu
                    {" · "}
                    {formatNumber(filteredZeroStockCount)} stoksuz
                  </td>

                  <td className="px-4 py-4 text-center text-lg text-slate-900">
                    {formatNumber(filteredTotalStock)}
                  </td>

                  {selectedShelfId && (
                    <td className="px-4 py-4 text-center text-lg text-[#dc3545]">
                      {formatNumber(filteredSelectedShelfStock)}
                    </td>
                  )}

                  <td className="px-4 py-4 text-center text-[11px] text-slate-500">
                    ADET
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-slate-50 px-4 py-3">
          <div className="text-[11px] text-slate-500">
            {formatNumber(firstRecord)} -{" "}
            {formatNumber(lastRecord)}
            {" / "}
            {formatNumber(visibleProducts.length)} kayıt

            <span className="ml-3">
              Sayfa {safePage} / {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() =>
                setCurrentPage(safePage - 1)
              }
              className="flex items-center gap-1 border border-slate-300 bg-white px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft size={15} />
              Önceki
            </button>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setCurrentPage(safePage + 1)
              }
              className="flex items-center gap-1 border border-slate-300 bg-white px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-30"
            >
              Sonraki
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* MODAL */}
      {modalProduct && (
        <StockHistoryModal
          key={modalProduct.productId}
          branchId={branchId}
          isGlobal={isGlobal}
          productId={modalProduct.productId}
          productName={modalProduct.productName}
          productBarcode={modalProduct.barcode}
          productSku={modalProduct.sku}
          expectedTotal={modalProduct.totalQuantity}
          selectedShelfId={
            selectedShelfId
              ? Number(selectedShelfId)
              : null
          }
          onClose={() => setModalProduct(null)}
        />
      )}
    </div>
  );
}
