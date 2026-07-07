"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ManualBoxDrawer from "./ManualBoxDrawer";
import ExcelBoxUploadDrawer from "./ExcelBoxUploadDrawer";
import {
  Info,
  Package,
  Plus,
  Upload,
  Box,
  Layers,
  Barcode,
  Hash,
  Activity,
  Clock,
  PieChart
} from "lucide-react";

interface BoxDashboardStats {
  totalBoxes: number;
  bulkUnitBoxes: number;
  avgQuantityPerBox: number;
  sizeDistribution: { label: string; count: number; percentage: number; color: string; desc: string }[];
  recentBoxesList: any[];
}

export default function BoxesDashboard({
  onUpdate,
}: {
  onUpdate?: () => void;
}) {
  const [stats, setStats] = useState<BoxDashboardStats>({
    totalBoxes: 0,
    bulkUnitBoxes: 0,
    avgQuantityPerBox: 0,
    sizeDistribution: [],
    recentBoxesList: [],
  });
  const [loading, setLoading] = useState(true);

  // Çekmece Stateleri
  const [isManualDrawerOpen, setIsManualDrawerOpen] = useState(false);
  const [isExcelDrawerOpen, setIsExcelDrawerOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: boxesData, error } = await supabase
        .from("boxes")
        .select(`
          box_barcode, 
          quantity, 
          product_id, 
          created_at,
          products (name, barcode)
        `);

      if (error) throw error;

      if (boxesData) {
        const totalBoxes = boxesData.length;
        let totalQuantity = 0;
        let bulkUnitBoxes = 0;
        
        // Dağılım Matrisi (Tekil, Küçük, Orta, Büyük koli hacimleri)
        const dist = { single: 0, small: 0, medium: 0, large: 0 };

        boxesData.forEach((b) => {
          totalQuantity += b.quantity;
          if (b.quantity === 1) {
            dist.single++;
          } else {
            bulkUnitBoxes++;
            if (b.quantity <= 10) dist.small++;
            else if (b.quantity <= 50) dist.medium++;
            else dist.large++;
          }
        });

        const avgQuantityPerBox = totalBoxes > 0 ? Math.round(totalQuantity / totalBoxes) : 0;

        const sizeDistribution = [
          { label: "Tekil Paket", desc: "1 Adet", count: dist.single, percentage: totalBoxes ? Math.round((dist.single / totalBoxes) * 100) : 0, color: "bg-slate-400" },
          { label: "Küçük Koli", desc: "2-10 Adet", count: dist.small, percentage: totalBoxes ? Math.round((dist.small / totalBoxes) * 100) : 0, color: "bg-emerald-500" },
          { label: "Orta Koli", desc: "11-50 Adet", count: dist.medium, percentage: totalBoxes ? Math.round((dist.medium / totalBoxes) * 100) : 0, color: "bg-amber-500" },
          { label: "Büyük/Palet", desc: "51+ Adet", count: dist.large, percentage: totalBoxes ? Math.round((dist.large / totalBoxes) * 100) : 0, color: "bg-[#dc3545]" },
        ];

        // Son eklenen 5 kaydı tarih sırasına göre ayır
        const recentBoxesList = [...boxesData]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);

        setStats({
          totalBoxes,
          bulkUnitBoxes,
          avgQuantityPerBox,
          sizeDistribution,
          recentBoxesList,
        });
      }
    } catch (error) {
      console.error("Koli Dashboard Veri Hatası:", error);
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

  const bulkPercentage = stats.totalBoxes > 0 ? Math.round((stats.bulkUnitBoxes / stats.totalBoxes) * 100) : 0;

  if (loading) {
    return (
      <div className="w-full h-48 bg-slate-100 animate-pulse rounded-lg border border-slate-200"></div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full shrink-0 font-['Quicksand']">
      
      {/* ==============================================
          1. ENDÜSTRİYEL MASTER PANEL (Koli Yönetimi) - DOKUNULMADI
      ================================================ */}
      <div className="relative w-full min-h-[220px] flex flex-col lg:flex-row justify-between p-6 md:p-8 bg-slate-900 border-b-2 border-slate-400 overflow-hidden gap-8 rounded-sm mb-2">
        
        <img 
          src="https://images.unsplash.com/photo-1586528116311-ad8ed7c83a7f?q=80&w=2070&auto=format&fit=crop"
          alt="Box Management"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
        
        <div className="relative z-10 flex flex-col gap-6 w-full lg:max-w-2xl justify-center">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-[#dc3545] border border-red-400/50 rounded-sm shadow-[0_0_20px_rgba(220,53,69,0.3)]">
              <Barcode className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Koli ve Master Barkod Yönetimi</h1>
              <p className="text-[#dc3545] text-xs font-bold uppercase tracking-widest mt-1">Akıllı Toplama ve Raflama Sistemi</p>
            </div>
          </div>

          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 border-l-4 border-l-[#dc3545] p-4 md:p-5 rounded-sm flex gap-4 items-start shadow-inner">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1.5">
              <h4 className="text-slate-200 text-xs font-bold uppercase tracking-widest">Master Barkod Bilgilendirmesi</h4>
              <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                Bu panelde, içindeki ürün adedi önceden tanımlanmış <strong className="text-slate-200">Dış Koli Barkodları</strong> üretilir. Operatörler terminalden bu barkodu okuttuğunda, sistem tekil ürün yerine tanımlı miktar kadar ürünü tek seferde rafa alır (Putaway) veya toplar (Picking).
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full lg:w-80 flex flex-col justify-center">
          <div className="bg-slate-800/90 backdrop-blur-md border border-slate-600 p-5 rounded-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Koli Tanımlama Merkezi</label>
              <span className="flex items-center gap-2 text-[10px] font-black text-green-400 uppercase tracking-widest">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                Aktif
              </span>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsExcelDrawerOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-11 px-4 bg-slate-950 border border-slate-500 text-slate-200 rounded-sm text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 hover:text-white hover:border-[#dc3545]/50 transition-all shadow-inner"
              >
                <Upload size={16} />
                Excel İle Koli Yükle
              </button>
              
              <button
                onClick={() => setIsManualDrawerOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-11 px-4 bg-[#dc3545] text-white border border-transparent rounded-sm text-[11px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_15px_rgba(220,53,69,0.4)]"
              >
                <Plus size={16} strokeWidth={3} />
                Tekil Koli Oluştur
              </button>
            </div>
          </div>
        </div>
      </div>
      {isManualDrawerOpen && (
        <ManualBoxDrawer
          onClose={() => setIsManualDrawerOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
      {isExcelDrawerOpen && (
        <ExcelBoxUploadDrawer
          onClose={() => setIsExcelDrawerOpen(false)}
          onSuccess={handleSuccess}
        />
      )} 
      
    </div>
  );
}