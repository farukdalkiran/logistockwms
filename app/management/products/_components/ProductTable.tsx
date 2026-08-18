"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  X,
  CheckSquare,
  Square,
  PackageSearch,
  Loader2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ZoomIn,
  Layers,
  Tags,
  ArrowDownUp,
  RotateCcw,
} from "lucide-react";

interface Product {
  id: string;
  barcode: string;
  alt_barcodes: string[]; // YENİ EKLENEN
  sku: string;
  name: string;
  category: string;
  is_consumable: boolean;
  max_order_limit: number;
  image_url: string;
  created_at: string;
}

export default function ProductsTable({
  externalRefresh = 0,
}: {
  externalRefresh?: number;
}) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<
    { name: string; isConsumable: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState({ category: "all", type: "all" });
  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc",
  });

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const isFilterActive = Object.values(filters).some((v) => v !== "all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchCategories = async () => {
    try {
      const { data: catData } = await supabase
        .from("products")
        .select("category, is_consumable");

      if (catData) {
        const validCats = catData.filter((d) => d.category);
        const uniqueCats = Array.from(
          new Set(
            validCats.map((c) =>
              JSON.stringify({
                name: c.category,
                isConsumable: c.is_consumable,
              }),
            ),
          ),
        ).map((c) => JSON.parse(c));

        setCategories(uniqueCats);
      }
    } catch (error) {
      console.error("Kategori Hatası:", error);
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("products").select("*", { count: "exact" });

      if (debouncedSearch) {
        // İsim, SKU, Ana Barkod veya Alternatif Barkod Dizisinde (exact match) arama
        query = query.or(
          `barcode.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%,alt_barcodes.cs.{${debouncedSearch}}`,
        );
      }
      if (filters.category !== "all")
        query = query.eq("category", filters.category);
      if (filters.type === "consumable")
        query = query.eq("is_consumable", true);
      if (filters.type === "commercial")
        query = query.eq("is_consumable", false);

      const from = (page - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query
        .order(sortConfig.key, { ascending: sortConfig.direction === "asc" })
        .range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setProducts(data || []);
      if (count !== null) setTotalCount(count);
    } catch (error) {
      console.error("Tablo Hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters, sortConfig, page, rowsPerPage]);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchProducts, refreshTrigger, externalRefresh]);

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSelectAll = () =>
    setSelectedIds(
      selectedIds.length === products.length && products.length > 0
        ? []
        : products.map((p) => p.id),
    );
  const handleSelectRow = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id],
    );

  const availableCategories = Array.from(
    new Set(
      categories
        .filter((c) =>
          filters.type === "all"
            ? true
            : filters.type === "consumable"
              ? c.isConsumable
              : !c.isConsumable,
        )
        .map((c) => c.name),
    ),
  );

  const exportToCSV = async () => {
    setLoading(true);
    try {
      let allExportData: any[] = [];
      let from = 0;
      const step = 1000;
      let fetchMore = true;

      while (fetchMore) {
        let query = supabase
          .from("products")
          .select("*")
          .range(from, from + step - 1);
        if (debouncedSearch)
          query = query.or(
            `barcode.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%`,
          );
        if (filters.category !== "all")
          query = query.eq("category", filters.category);
        if (filters.type === "consumable")
          query = query.eq("is_consumable", true);
        if (filters.type === "commercial")
          query = query.eq("is_consumable", false);

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allExportData = [...allExportData, ...data];
          from += step;
        } else {
          fetchMore = false;
        }
      }

      const headers = [
        "ID",
        "Barkod",
        "SKU",
        "Ürün Adı",
        "Kategori",
        "Sınıf",
        "Max Sipariş",
      ];
      const csvRows = allExportData.map(
        (p) =>
          `"${p.id}";"${p.barcode}";"${p.sku || ""}";"${p.name.replace(/"/g, '""')}";"${p.category || ""}";"${p.is_consumable ? "Sarf Malzeme" : "Ürün"}";"${p.max_order_limit || 0}"`,
      );

      const csvContent =
        "\uFEFF" + headers.join(";") + "\n" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `LogiStock_Urunler_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (error) {
      console.error("Export hatası:", error);
      alert("Dışa aktarma sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditLoading(true);
    const { error } = await supabase
      .from("products")
      .update({
        sku: editingProduct.sku,
        name: editingProduct.name,
        category: editingProduct.category,
        image_url: editingProduct.image_url,
        is_consumable: editingProduct.is_consumable,
        max_order_limit: editingProduct.is_consumable
          ? editingProduct.max_order_limit
          : 0,
      })
      .eq("id", editingProduct.id);

    if (!error) {
      setEditingProduct(null);
      handleSuccess();
    } else alert("Güncelleme hatası: " + error.message);
    setEditLoading(false);
  };

  const executeDelete = async () => {
    if (!productToDelete) return;
    setDeleteLoading(true);
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productToDelete.id);

    if (!error) {
      setProductToDelete(null);
      handleSuccess();
      setSelectedIds((prev) => prev.filter((id) => id !== productToDelete.id));
    } else alert("Silme hatası: " + error.message);
    setDeleteLoading(false);
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteLoading(true);

    const { error } = await supabase
      .from("products")
      .delete()
      .in("id", selectedIds);

    if (!error) {
      setIsBulkDeleteModalOpen(false);
      setSelectedIds([]);
      handleSuccess();
    } else {
      alert("Toplu silme hatası: " + error.message);
    }
    setBulkDeleteLoading(false);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 bg-white rounded-sm shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        {/* ================================================================= */}
        {/* BİRLEŞİK KONTROL MERKEZİ (FERAH, AYDINLIK VE YÜKSEK KONTRASTLI) */}
        {/* ================================================================= */}
        <div className="bg-white border border-slate-200 border-t-4 border-t-[#dc3545] rounded-sm shadow-sm flex flex-col shrink-0 relative overflow-hidden z-10 font-['Quicksand']">
          {/* Hafif Endüstriyel Dokunuş (Sadece çok silik bir arka plan çizgisi) */}
          <div className="absolute inset-0 opacity-[0.015] bg-[repeating-linear-gradient(45deg,#000,#000_1px,transparent_1px,transparent_10px)] pointer-events-none"></div>

          {/* 1. SATIR: HIZLI ARAMA VE DIŞA AKTARMA ARAÇLARI */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
            {/* Arama Çubuğu (Light Tema Yüksek Kontrast) */}
            <div className="relative w-full md:max-w-lg">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Barkod, SKU veya Ürün Adı ile hızlı ara..."
                className="w-full h-10 pl-11 pr-10 text-sm font-semibold border border-slate-300 rounded-sm bg-white text-slate-800 outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] transition-all placeholder:text-slate-400 shadow-sm"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#dc3545] bg-slate-100 hover:bg-red-50 rounded-sm transition-colors"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              )}
            </div>

            {/* Sağ Taraf: İndirme ve Yenileme Butonları */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                onClick={exportToCSV}
                className="h-10 flex items-center justify-center gap-2 px-4 bg-white border border-slate-300 text-slate-700 hover:text-[#dc3545] hover:bg-red-50 hover:border-red-200 rounded-sm text-[11px] font-black uppercase tracking-wider transition-all shadow-sm"
              >
                <Download size={16} /> CSV İndir
              </button>
              <button
                onClick={handleSuccess}
                className="h-10 w-10 flex items-center justify-center text-slate-500 bg-white border border-slate-300 rounded-sm hover:text-[#dc3545] hover:bg-red-50 hover:border-red-200 transition-all shadow-sm group shrink-0"
                title="Verileri Yenile"
              >
                <RefreshCw
                  size={16}
                  className={`${loading ? "animate-spin text-[#dc3545]" : "group-hover:rotate-180 transition-transform duration-500"}`}
                />
              </button>
            </div>
          </div>

          {/* 2. SATIR: SABİT DETAYLI FİLTRELEME PANELİ */}
          <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 bg-white">
            {/* 1. Ürün Sınıfı */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Layers size={14} className="text-[#dc3545]" /> 1. Ürün Sınıfı
              </label>
              <select
                className="w-full h-10 bg-slate-50 border border-slate-200 text-slate-700 rounded-sm px-3 text-sm outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] font-bold shadow-sm transition-all cursor-pointer hover:border-slate-300"
                value={filters.type}
                onChange={(e) => {
                  setFilters((f) => ({
                    ...f,
                    type: e.target.value,
                    category: "all",
                  }));
                  setPage(1);
                }}
              >
                <option value="all">Tümü (Sarf & Ürün)</option>
                <option value="commercial">Ürünler</option>
                <option value="consumable">Sarf Malzemeler</option>
              </select>
            </div>

            {/* 2. Alt Kategori */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Tags size={14} className="text-[#dc3545]" /> 2. Alt Kategori
              </label>
              <select
                className="w-full h-10 bg-slate-50 border border-slate-200 text-slate-700 rounded-sm px-3 text-sm outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300"
                value={filters.category}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, category: e.target.value }));
                  setPage(1);
                }}
                disabled={availableCategories.length === 0}
              >
                <option value="all">Tüm Kategoriler</option>
                {availableCategories.map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Sıralama Ölçütü */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <ArrowDownUp size={14} className="text-[#dc3545]" /> Sıralama
                Algoritması
              </label>
              <select
                className="w-full h-10 bg-slate-50 border border-slate-200 text-slate-700 rounded-sm px-3 text-sm outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] font-bold shadow-sm transition-all cursor-pointer hover:border-slate-300"
                value={`${sortConfig.key}-${sortConfig.direction}`}
                onChange={(e) => {
                  const [key, direction] = e.target.value.split("-");
                  setSortConfig({ key, direction });
                  setPage(1);
                }}
              >
                <option value="created_at-desc">
                  En Yeni Eklenenler (Önce)
                </option>
                <option value="created_at-asc">
                  En Eski Eklenenler (Önce)
                </option>
                <option value="name-asc">İsimlendirme (A-Z)</option>
                <option value="name-desc">İsimlendirme (Z-A)</option>
                <option value="max_order_limit-desc">
                  Sipariş Limiti (Yüksekten Düşüğe)
                </option>
              </select>
            </div>

            {/* 4. Genel Sıfırlama Butonu */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ category: "all", type: "all" });
                  setSortConfig({ key: "created_at", direction: "desc" });
                  setSearchTerm("");
                  setPage(1);
                }}
                className="h-10 px-4 flex items-center justify-center gap-2 text-[11px] font-black text-slate-600 bg-slate-100 border border-slate-200 hover:bg-red-50 hover:text-[#dc3545] hover:border-red-200 rounded-sm transition-all w-full shadow-sm uppercase tracking-wider"
              >
                <RotateCcw size={14} strokeWidth={2.5} /> FİLTRELERİ SIFIRLA
              </button>
            </div>
          </div>
        </div>

        {/* TOPLU İŞLEM ÇUBUĞU */}
        {selectedIds.length > 0 && (
          <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center justify-between animate-in fade-in slide-in-from-top-2 shrink-0">
            <span className="text-sm font-bold text-[#dc3545]">
              {selectedIds.length} kayıt seçildi
            </span>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="text-xs font-bold px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 shadow-sm transition-all flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Toplu Sil
            </button>
          </div>
        )}

        {/* TABLO GÖVDESİ */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left text-[13px] text-slate-600">
            <thead className="bg-slate-50 text-slate-700 sticky top-0 z-10 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="p-3 w-12 text-center">
                  <button
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-[#dc3545] transition-colors"
                  >
                    {selectedIds.length === products.length &&
                    products.length > 0 ? (
                      <CheckSquare size={18} className="text-[#dc3545]" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th className="p-3 font-bold w-20 text-center">Görsel</th>
                <th
                  className="p-3 font-bold cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort("barcode")}
                >
                  <div className="flex items-center gap-1">
                    Barkod / SKU{" "}
                    {sortConfig.key === "barcode" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      ))}
                  </div>
                </th>
                <th
                  className="p-3 font-bold cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Ürün Adı{" "}
                    {sortConfig.key === "name" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      ))}
                  </div>
                </th>
                <th className="p-3 font-bold">Kategori</th>
                <th className="p-3 font-bold text-center">Sınıf</th>
                <th className="p-3 font-bold text-right pr-6">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="p-4 bg-slate-50/50 h-16"></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/30">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-inner">
                        <PackageSearch
                          size={32}
                          className="opacity-50 text-slate-500"
                        />
                      </div>
                      <p className="text-base font-bold text-slate-600">
                        Kayıt bulunamadı.
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                        Arama kriterlerinizi veya sınıf filtrelerinizi
                        değiştirerek tekrar deneyin.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className={`hover:bg-slate-50 transition-colors group/row ${selectedIds.includes(product.id) ? "bg-red-50/30" : ""}`}
                  >
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleSelectRow(product.id)}
                        className="text-slate-300 hover:text-[#dc3545] transition-colors"
                      >
                        {selectedIds.includes(product.id) ? (
                          <CheckSquare size={18} className="text-[#dc3545]" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="p-3 flex justify-center">
                      {product.image_url ? (
                        <div
                          className="relative w-12 h-12 rounded cursor-pointer group/image overflow-hidden shadow-sm border border-slate-200 bg-white"
                          onClick={() => setZoomedImage(product.image_url)}
                          title="Görseli Büyüt"
                        >
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover/image:scale-110 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <ZoomIn size={18} className="text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-400">
                          <PackageSearch size={18} />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-bold text-slate-800">
                        {product.barcode}
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        {product.sku || "SKU Yok"}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-700 group-hover/row:text-[#dc3545] transition-colors">
                        {product.name}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold border border-slate-200 shadow-sm">
                        {product.category || "Tanımsız"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {product.is_consumable ? (
                        <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[11px] font-black uppercase tracking-wider shadow-sm">
                          Sarf Malzeme
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-black uppercase tracking-wider shadow-sm">
                          Ürün
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-2 opacity-80 group-hover/row:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="p-1.5 text-slate-500 bg-white border border-slate-200 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 rounded-md transition-all shadow-sm"
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => setProductToDelete(product)}
                          className="p-1.5 text-slate-500 bg-white border border-slate-200 hover:text-[#dc3545] hover:bg-red-50 hover:border-red-200 rounded-md transition-all shadow-sm"
                          title="Kalıcı Olarak Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* TABLO SAYFALAMA */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-medium text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span>Sayfa başına:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#dc3545] bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div>
            Toplam{" "}
            <span className="font-bold text-slate-800">{totalCount}</span>{" "}
            kayıttan{" "}
            <span className="font-bold text-slate-800">
              {totalCount > 0 ? (page - 1) * rowsPerPage + 1 : 0} -{" "}
              {Math.min(page * rowsPerPage, totalCount)}
            </span>{" "}
            arası
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-slate-200 bg-white rounded hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
            >
              Önceki
            </button>
            <button
              disabled={page * rowsPerPage >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-slate-200 bg-white rounded hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* MODALLAR */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          {/* Şık, Beyaz ve Kare Formatta (aspect-square) Modal Gövdesi */}
          <div
            className="relative bg-white p-4 rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md aspect-square flex flex-col items-center justify-center animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Şık Kırmızı Kapatma Butonu */}
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-8 right-8 w-10 h-10 bg-red-50 text-[#dc3545] rounded-lg flex items-center justify-center hover:bg-[#dc3545] hover:text-white border border-[#e09d9d] transition-all duration-200 z-10 shadow-sm"
            >
              <X size={20} strokeWidth={2.5} />
            </button>

            {/* Görsel Çerçevesi */}
            <div className="w-full h-full flex items-center justify-center rounded-sm bg-slate-50 border border-slate-100 overflow-hidden relative">
              <img
                src={zoomedImage}
                alt="Büyütülmüş Ürün Görseli"
                className="max-w-full max-h-full object-contain mix-blend-multiply"
              />
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setEditingProduct(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Edit size={18} className="text-[#dc3545]" /> Ürünü Düzenle
              </h2>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-md"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdateProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">
                    Barkod
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full h-10 px-3 border border-slate-300 rounded-md font-mono text-sm bg-slate-50 text-slate-500 cursor-not-allowed shadow-inner"
                    value={editingProduct.barcode}
                    readOnly
                    title="Barkod değiştirilemez"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">
                    SKU
                  </label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm outline-none focus:border-[#dc3545] shadow-sm transition-colors"
                    value={editingProduct.sku || ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        sku: e.target.value,
                      })
                    }
                  />
                  
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-slate-600">
                    Ürün Adı *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm outline-none focus:border-[#dc3545] font-bold shadow-sm transition-colors"
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">
                    Kategori
                  </label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm outline-none focus:border-[#dc3545] shadow-sm transition-colors"
                    value={editingProduct.category || ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        category: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">
                    Görsel URL
                  </label>
                  <input
                    type="url"
                    className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm outline-none focus:border-[#dc3545] shadow-sm transition-colors"
                    value={editingProduct.image_url || ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        image_url: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[#dc3545] rounded border-slate-300 focus:ring-[#dc3545]"
                    checked={editingProduct.is_consumable}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        is_consumable: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm font-bold text-slate-700 select-none">
                    Bu bir Sarf Malzemedir
                  </span>
                </label>
                {editingProduct.is_consumable && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                    <label className="text-xs font-bold text-amber-600">
                      Max Sipariş:
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-24 h-9 px-2 border border-amber-300 bg-amber-50 rounded-md text-sm font-bold outline-none focus:border-amber-500 shadow-sm transition-colors"
                      value={editingProduct.max_order_limit || 0}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          max_order_limit: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                )}
              </div>
              <div className="pt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-6 py-2 bg-[#dc3545] text-white font-bold rounded-lg hover:bg-red-700 flex items-center gap-2 shadow-sm transition-colors"
                >
                  {editLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Değişiklikleri Kaydet"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {productToDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setProductToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 p-6 border-t-4 border-[#dc3545]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto border-4 border-white shadow-sm">
              <AlertCircle size={32} className="text-[#dc3545]" />
            </div>
            <h2 className="text-xl font-black text-slate-800 text-center mb-2">
              Ürünü Silmek İstediğinize Emin Misiniz?
            </h2>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              <strong className="text-slate-800 block mb-2 text-base bg-slate-50 p-2 rounded border border-slate-100">
                {productToDelete.barcode} - {productToDelete.name}
              </strong>
              Sistemden kalıcı olarak silinecektir.{" "}
              <span className="text-[#dc3545] font-bold block mt-1">
                Bu işlem geri alınamaz.
              </span>
            </p>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 bg-[#dc3545] text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {deleteLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Kalıcı Olarak Sil"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkDeleteModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setIsBulkDeleteModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 p-6 border-t-4 border-[#dc3545]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto border-4 border-white shadow-sm">
              <AlertTriangle size={32} className="text-[#dc3545]" />
            </div>
            <h2 className="text-xl font-black text-slate-800 text-center mb-2">
              Toplu Silme İşlemi
            </h2>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              Seçili{" "}
              <strong className="text-slate-800 font-bold">
                {selectedIds.length}
              </strong>{" "}
              kaydı sistemden kalıcı olarak silmek istediğinize emin misiniz?{" "}
              <span className="text-[#dc3545] font-bold block mt-1">
                Bu işlem geri alınamaz.
              </span>
            </p>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={executeBulkDelete}
                disabled={bulkDeleteLoading}
                className="flex-1 py-2.5 bg-[#dc3545] text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {bulkDeleteLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Seçilenleri Sil"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
