// app/management/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { WmsPageHeader, WmsBadge } from "@/components/ui/wms";
import { Footer } from "@/components/shared/Footer";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDashboardDataServer } from "@/app/actions/dashboard";
import {
  Building2,
  Users,
  AlertCircle,
  Layers,
  Database,
  BoxSelect,
  Box,
  BellRing,
  UserCheck,
  RefreshCw,
} from "lucide-react";

import {
  TransferCenterSection,
  TransferData,
} from "./_components/TransferCenterSection";
import {
  CargoDistributionSection,
  CargoDistributionItem,
  CargoSessionData,
} from "./_components/CargoDistributionSection";
import {
  WarehouseLogsSection,
  PutawayLogData,
} from "./_components/WarehouseLogsSection";
import type { LeaveLogData } from "./_components/LeaveMovementsSection";
import { OrderTrackingSection } from "./_components/OrderTrackingSection";
import { StoreOrdersHomeSection } from "./_components/StoreOrdersHomeSection";
import { useWms } from "@/components/providers/WmsSessionProvider";

interface DashboardData {
  kpis: {
    branches: number;
    employees: number;
    stockVolume: number;
    pendingTotal: number;
    boxesTotal: number;
    productsTotal: number;
  };
  cargoDistribution: CargoDistributionItem[];
  recentTransfers: TransferData[];
  recentPutawayLogs: PutawayLogData[];
  recentLeaveLogs: LeaveLogData[];
  recentCargoSessions: CargoSessionData[];
  dbSizeMB: number;
  systemLoad: number;
}

let dashboardClientCache: {
  userId: string;
  data: DashboardData;
  timestamp: number;
} | null = null;

const CLIENT_CACHE_TTL = 2 * 60 * 1000; // 2 Dakika

export default function ManagementDashboard() {
  const { userProfile, isLoading: isAuthLoading } = useAuth();
  const { branchType, branchName } = useWms();
  const isOnlineWarehouse = branchType === "Depo" && branchName === "Online Depo";
  const isStore = branchType === "Mağaza";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchedUserIdRef = useRef<string | null>(null);
  const userId = userProfile?.id;

  const fetchData = useCallback(
    async (force = false) => {
      if (!userId) return;

      const now = Date.now();
      if (
        !force &&
        dashboardClientCache &&
        dashboardClientCache.userId === userId &&
        now - dashboardClientCache.timestamp < CLIENT_CACHE_TTL
      ) {
        setData(dashboardClientCache.data);
        setLoading(false);
        return;
      }

      if (force) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await getDashboardDataServer(userId, force);
      if (result.success && result.data) {
        const freshData = result.data as DashboardData;
        setData(freshData);
        dashboardClientCache = {
          userId,
          data: freshData,
          timestamp: Date.now(),
        };
      }

      setLoading(false);
      setIsRefreshing(false);
    },
    [userId]
  );

  useEffect(() => {
    if (!isAuthLoading) {
      if (!userId) {
        router.replace("/login");
        return;
      }
      if (fetchedUserIdRef.current !== userId) {
        fetchedUserIdRef.current = userId;
        fetchData(false);
      }
    }
  }, [userId, isAuthLoading, fetchData, router]);

  const getStatusStyle = (status: string) => {
    const s = status?.toUpperCase().replace("İ", "I") || "";
    if (s === "TAMAMLANDI" || s === "COMPLETED" || s === "APPROVED")
      return "bg-emerald-50 text-emerald-700 border-emerald-300";
    if (s === "YOLDA" || s === "ACTIVE")
      return "bg-blue-50 text-blue-700 border-blue-300";
    if (s === "BEKLIYOR" || s === "PENDING")
      return "bg-orange-50 text-orange-700 border-orange-300";
    if (s === "TOPLANIYOR")
      return "bg-purple-50 text-purple-700 border-purple-300";
    if (s === "REJECTED" || s === "IPTAL")
      return "bg-red-50 text-[#dc3545] border-red-300";
    return "bg-slate-50 text-slate-600 border-slate-300";
  };

  const getStatusText = (status: string) => {
    const s = status?.toUpperCase().replace("İ", "I") || "";
    if (s === "APPROVED") return "ONAYLANDI";
    if (s === "PENDING") return "BEKLİYOR";
    if (s === "REJECTED") return "REDDEDİLDİ";
    if (s === "COMPLETED") return "TAMAMLANDI";
    if (s === "ACTIVE") return "DEVAM EDİYOR";
    return status || "DURUM YOK";
  };

  if (isAuthLoading || (loading && !data)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden">
        <Navbar />
        <main className="flex-1 w-full flex flex-col items-center justify-center min-h-[80vh] p-4">
          <div className="flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
              <div className="w-2 h-2 bg-[#dc3545] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-mono">
              Sistem Yükleniyor...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const profileSafe = userProfile as Record<string, any> | null;
  const isGlobal = profileSafe?.role === "Developer" || profileSafe?.role === "Admin" || !profileSafe?.branch_id;
  const pendingTotal = data?.kpis?.pendingTotal ?? 0;
  const hasPending = pendingTotal > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 selection:bg-[#dc3545] selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden pb-16">
        
        {/* Tek tip açık tema sayfa başlığı ve operasyon bilgisi */}
        <WmsPageHeader
          eyebrow="LogiStock WMS / Operasyon"
          title="Operasyon Merkezi"
          description="Tüm şube, depo ve personel operasyonlarının merkezi görünümü."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <WmsBadge tone={isGlobal ? "info" : "success"}>{isGlobal ? "Global erişim" : (profileSafe?.branch_name || "Şube erişimi")}</WmsBadge>
              <span className="text-xs font-semibold text-slate-500">Sistem yükü %{data?.systemLoad || 0}</span>
              <span className="text-sm font-bold tabular-nums text-slate-700">{new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                title="Verileri yenile"
                className="inline-flex min-h-10 items-center gap-2 rounded-[5px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> Yenile
              </button>
            </div>
          }
        />

        {/* Uyarı Paneli (Mobil uyumlu hale getirildi) */}
        {hasPending && (
          <div className="w-full bg-amber-50 border border-amber-200 border-l-[4px] border-l-amber-500 rounded-md shadow-sm p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-1">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-2 text-amber-800">
                <BellRing className="w-5 h-5 animate-bounce" />
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Yöneticinin Dikkatine
                </h2>
              </div>
              <p className="text-amber-700 font-semibold text-xs sm:text-sm mt-1">
                Sistemde onayınızı bekleyen <span className="inline-block bg-amber-200 px-2 py-0.5 rounded font-black border border-amber-300">{pendingTotal}</span> adet <strong className="text-amber-900">İzin veya Mesai Düzeltme</strong> talebi bulunmaktadır.
              </p>
            </div>
            <button
              onClick={() => router.push("/management/hr/approvals")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-md transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0 w-full md:w-auto"
            >
              <UserCheck size={16} /> TALEPLERİ İNCELE
            </button>
          </div>
        )}

        {/* KPI KARTLARI */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 w-full">
          {[
            {
              title: "Kayıtlı Ürün",
              value: data?.kpis.productsTotal.toLocaleString("tr-TR"),
              icon: BoxSelect,
              color: "text-purple-600",
              bg: "bg-purple-50 border-purple-200",
            },
            {
              title: "Toplam Stok",
              value: data?.kpis.stockVolume.toLocaleString("tr-TR"),
              icon: Layers,
              color: "text-[#dc3545]",
              bg: "bg-red-50 border-red-200",
            },
            {
              title: "Kayıtlı Koli",
              value: data?.kpis.boxesTotal.toLocaleString("tr-TR"),
              icon: Box,
              color: "text-indigo-600",
              bg: "bg-indigo-50 border-indigo-200",
            },
            {
              title: "Bağlı Şubeler",
              value: data?.kpis.branches,
              icon: Building2,
              color: "text-blue-600",
              bg: "bg-blue-50 border-blue-200",
            },
            {
              title: "Aktif Personel",
              value: data?.kpis.employees,
              icon: Users,
              color: "text-emerald-600",
              bg: "bg-emerald-50 border-emerald-200",
            },
            {
              title: "Bekleyen Onay",
              value: pendingTotal,
              icon: AlertCircle,
              color: "text-orange-600",
              bg: "bg-orange-50 border-orange-200",
            },
          ].map((kpi, idx) => (
            <div
              key={idx}
              className="bg-white p-4 border border-slate-200 shadow-sm rounded-md flex flex-col justify-between gap-3 transition-colors hover:border-slate-400 group"
            >
              <div className="flex items-start justify-between">
                <div className={`w-9 h-9 flex items-center justify-center rounded-md border ${kpi.bg}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-xl sm:text-2xl font-black text-slate-800 leading-none truncate font-mono">
                  {kpi.value}
                </p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 truncate group-hover:text-slate-700 transition-colors">
                  {kpi.title}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 1. VE 2. BÖLÜMLER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          <TransferCenterSection
            recentTransfers={data?.recentTransfers || []}
            getStatusStyle={getStatusStyle}
            getStatusText={getStatusText}
          />
          <CargoDistributionSection
            cargoDistribution={data?.cargoDistribution || []}
            recentCargoSessions={data?.recentCargoSessions || []}
            getStatusStyle={getStatusStyle}
            getStatusText={getStatusText}
          />
        </div>

        {/* 3. VE 4. BÖLÜMLER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          <WarehouseLogsSection
            recentPutawayLogs={data?.recentPutawayLogs || []}
          />
          {isOnlineWarehouse ? <OrderTrackingSection /> : isStore ? <StoreOrdersHomeSection /> : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}