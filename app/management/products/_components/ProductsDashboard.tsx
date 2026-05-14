"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ManualProductDrawer from "./ManualProductDrawer";
import ExcelUploadDrawer from "./ExcelUploadDrawer";
import {
  Package,
  ShoppingCart,
  Activity,
  AlertTriangle,
  Plus,
  Upload,
  BarChart3,
  Box,
  Layers,
} from "lucide-react";

interface DashboardStats {
  total: number;
  products: number;
  consumables: number;
  critical: number;
  topCategories: { name: string; count: number; percentage: number }[];
}

export default function ProductsDashboard({
  onUpdate,
}: {
  onUpdate?: () => void;
}) {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    products: 0,
    consumables: 0,
    critical: 0,
    topCategories: [],
  });
  const [loading, setLoading] = useState(true);

  // Çekmece Stateleri
  const [isManualDrawerOpen, setIsManualDrawerOpen] = useState(false);
  const [isExcelDrawerOpen, setIsExcelDrawerOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { count: total } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      const { count: productsCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_consumable", false);
      const { count: consumablesCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_consumable", true);
      const { count: criticalCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .is("image_url", null);

      const { data: categoryData } = await supabase
        .from("products")
        .select("category");

      let topCats: { name: string; count: number; percentage: number }[] = [];

      if (categoryData && categoryData.length > 0 && total) {
        const catCounts = categoryData.reduce((acc: any, curr) => {
          const catName = curr.category || "Tanımsız";
          acc[catName] = (acc[catName] || 0) + 1;
          return acc;
        }, {});

        topCats = Object.keys(catCounts)
          .map((key) => ({
            name: key,
            count: catCounts[key],
            percentage: Math.round((catCounts[key] / total) * 100),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      }

      setStats({
        total: total || 0,
        products: productsCount || 0,
        consumables: consumablesCount || 0,
        critical: criticalCount || 0,
        topCategories: topCats,
      });
    } catch (error) {
      console.error("Dashboard Veri Hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSuccess = () => {
    fetchDashboardData(); 
    setIsManualDrawerOpen(false);
    setIsExcelDrawerOpen(false);
    if (onUpdate) onUpdate(); 
  };

  const consumablePercentage =
    stats.total > 0 ? Math.round((stats.consumables / stats.total) * 100) : 0;
  const productPercentage = stats.total > 0 ? 100 - consumablePercentage : 0;

  if (loading) {
    return (
      <div className="w-full h-48 bg-slate-100 animate-pulse rounded-lg border border-slate-200"></div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full shrink-0">
      
      {/* ==============================================
          1. HEADER VE AKSİYON BLOKLARI (Kesin Ayrım)
      ================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        
        {/* Sol Taraf: Sayfa Başlığı ve Açıklama */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-700 shrink-0">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Ürün ve Stok Yönetimi
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">
              Depo içerisindeki ürünleri ve sarf malzemeleri düzenleyin.
            </p>
          </div>
        </div>

        {/* Sağ Taraf: Birincil ve İkincil Aksiyonlar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => setIsExcelDrawerOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 h-10 px-5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-[#dc3545] transition-colors"
          >
            <Upload size={16} />
            Toplu Yükle (Excel)
          </button>
          
          <button
            onClick={() => setIsManualDrawerOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 h-10 px-5 bg-[#dc3545] text-white border border-[#dc3545] rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus size={16} strokeWidth={3} />
            Tekil Ürün Ekle
          </button>
        </div>
      </div>

      {/* ==============================================
          2. BAĞIMSIZ BİLGİ KARTLARI (KPI)
      ================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Kart 1: Toplam */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Toplam Kayıt</p>
            <Activity size={16} className="text-slate-400" />
          </div>
          <h3 className="text-3xl font-black text-slate-800">
            {stats.total.toLocaleString("tr-TR")}
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-2">
            Sistemde tanımlı tüm barkodlar.
          </p>
        </div>

        {/* Kart 2: Ürünler */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-full border-l-4 border-l-slate-700">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Ürünler</p>
            <Box size={16} className="text-slate-700" />
          </div>
          <h3 className="text-3xl font-black text-slate-800">
            {stats.products.toLocaleString("tr-TR")}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">%{productPercentage}</span>
            <span className="text-xs text-slate-400 font-medium">Hacim</span>
          </div>
        </div>

        {/* Kart 3: Sarf */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-full border-l-4 border-l-amber-500">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Sarf Malzemeler</p>
            <ShoppingCart size={16} className="text-amber-500" />
          </div>
          <h3 className="text-3xl font-black text-slate-800">
            {stats.consumables.toLocaleString("tr-TR")}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">%{consumablePercentage}</span>
            <span className="text-xs text-slate-400 font-medium">Hacim</span>
          </div>
        </div>

        {/* Kart 4: Uyarı */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between h-full border-l-4 border-l-[#dc3545]">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] font-bold text-[#dc3545] uppercase tracking-widest">Görseli Eksik</p>
            <AlertTriangle size={16} className="text-[#dc3545]" />
          </div>
          <h3 className="text-3xl font-black text-[#dc3545]">
            {stats.critical.toLocaleString("tr-TR")}
          </h3>
          <p className="text-xs text-red-400 font-medium mt-2">
            İşlem bekleyen kayıtlar.
          </p>
        </div>

      </div>

      {/* ==============================================
          3. GRAFİK VE DAĞILIM PANELLERİ
      ================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Sınıf Dağılımı Çubuğu */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
          <h4 className="text-sm font-black text-slate-800 mb-5 flex items-center gap-2">
            <Layers size={16} className="text-slate-400" /> Sınıf Dağılımı
          </h4>

          <div className="w-full h-5 bg-slate-100 rounded overflow-hidden flex mb-5 border border-slate-200">
            {stats.total === 0 ? (
              <div className="h-full w-full bg-slate-200"></div>
            ) : (
              <>
                <div
                  className="h-full bg-slate-700"
                  style={{ width: `${productPercentage}%` }}
                ></div>
                <div
                  className="h-full bg-amber-500 border-l border-white/20"
                  style={{ width: `${consumablePercentage}%` }}
                ></div>
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <div className="w-3 h-3 rounded-sm bg-slate-700"></div> Ürün
              </div>
              <span className="text-sm font-black text-slate-800">
                {stats.products.toLocaleString("tr-TR")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <div className="w-3 h-3 rounded-sm bg-amber-500"></div> Sarf Malzeme
              </div>
              <span className="text-sm font-black text-slate-800">
                {stats.consumables.toLocaleString("tr-TR")}
              </span>
            </div>
          </div>
        </div>

        {/* Kategori Hacimleri Tablosu */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
          <h4 className="text-sm font-black text-slate-800 mb-5 flex items-center gap-2">
            <BarChart3 size={16} className="text-slate-400" /> En Yüksek Hacimli Alt Kategoriler
          </h4>

          {stats.topCategories.length === 0 ? (
            <div className="w-full py-8 flex items-center justify-center text-sm font-bold text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
              Kategori verisi bulunamadı.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-32 md:w-48 shrink-0 text-sm font-bold text-slate-700 truncate">
                    {cat.name}
                  </div>
                  <div className="flex-1 h-6 bg-slate-50 rounded overflow-hidden flex items-center border border-slate-200">
                    <div
                      className="h-full bg-slate-300 relative flex items-center"
                      style={{ width: `${Math.max(cat.percentage, 1)}%` }}
                    >
                       <span className="absolute left-2 text-[10px] font-black text-slate-700">
                        {cat.count}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 shrink-0 text-right text-sm font-black text-slate-500">
                    %{cat.percentage}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==============================================
          ÇEKMECELER (DRAWERS)
      ================================================ */}
      {isManualDrawerOpen && (
        <ManualProductDrawer
          onClose={() => setIsManualDrawerOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
      {isExcelDrawerOpen && (
        <ExcelUploadDrawer
          onClose={() => setIsExcelDrawerOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}