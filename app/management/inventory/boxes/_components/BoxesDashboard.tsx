"use client";

import { useState, useEffect } from "react";
import { WmsPageHeader } from "@/components/ui/wms";
import { Button } from "@/components/ui/Button";
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
      <WmsPageHeader
        eyebrow="Envanter / Koli"
        title="Koli ve Master Barkod Yönetimi"
        description="Koli barkodlarını tanımlayın, Excel üzerinden aktarın ve raflama-toplama işlemlerini hızlandırın."
        actions={
          <>
            <Button variant="outline" onClick={() => setIsExcelDrawerOpen(true)}><Upload size={16}/>Excel ile yükle</Button>
            <Button onClick={() => setIsManualDrawerOpen(true)}><Plus size={16}/>Yeni koli oluştur</Button>
          </>
        }
      />
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