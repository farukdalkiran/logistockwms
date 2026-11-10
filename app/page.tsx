// app/management/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDashboardDataServer } from "@/app/actions/dashboard";
import {
  Building2,
  Users,
  AlertCircle,
  Layers,
  BoxSelect,
  Box,
  BellRing,
  UserCheck,
  RefreshCw,
  Truck,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";

import {
  TransferCenterSection,
  TransferData,
} from "./_components/TransferCenterSection";
import type {
  CargoDistributionItem,
  CargoSessionData,
} from "./_components/CargoDistributionSection";
import { CatalogActivitySection } from "./_components/CatalogActivitySection";
import {
  WarehouseLogsSection,
  PutawayLogData,
} from "./_components/WarehouseLogsSection";
import type { LeaveLogData } from "./_components/LeaveMovementsSection";
import { CargoOverviewSection } from "./_components/CargoOverviewSection";
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

const CLIENT_CACHE_TTL = 30 * 60 * 1000; // 30 dakika

export default function ManagementDashboard() {
  const { userProfile, isLoading: isAuthLoading } = useAuth();
  const { branchName } = useWms();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshError, setRefreshError] = useState("");
  const inFlightRef = useRef(false);

  const fetchedUserIdRef = useRef<string | null>(null);
  const userId = userProfile?.id;

  const fetchData = useCallback(
    async (force = false) => {
      if (!userId || inFlightRef.current) return;
      const now = Date.now();
      if (!force && dashboardClientCache && dashboardClientCache.userId === userId &&
          now - dashboardClientCache.timestamp < CLIENT_CACHE_TTL) {
        setData(dashboardClientCache.data);
        setLoading(false);
        return;
      }

      inFlightRef.current = true;
      if (force) setIsRefreshing(true);
      else setLoading(true);
      setRefreshError("");

      try {
        const result = await getDashboardDataServer(userId, force);
        if (result.success && result.data) {
          const freshData = result.data as DashboardData;
          const timestamp = Date.now();
          setData(freshData);
          dashboardClientCache = { userId, data: freshData, timestamp };
        } else {
          setRefreshError(result.error || "Veriler güncellenemedi.");
        }
      } catch {
        setRefreshError("Sunucu bağlantısı kurulamadı. Son veriler korunuyor.");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
        inFlightRef.current = false;
      }
    },
    [userId]
  );

  useEffect(() => {
    if (isAuthLoading) return;
    if (!userId) {
      router.replace("/login");
      return;
    }
    if (fetchedUserIdRef.current !== userId) {
      fetchedUserIdRef.current = userId;
      void fetchData(false);
    }
  }, [userId, isAuthLoading, fetchData, router]);

  // Sekme açıkken her dakika yalnızca yerel zamanı kontrol eder; API isteği
  // 08:00-17:00 (Türkiye) arasında ve son başarılı yüklemeden 30 dk sonra yapılır.
  useEffect(() => {
    if (!userId || isAuthLoading) return;

    const updateIfDue = () => {
      if (document.visibilityState !== "visible") return;
      const hour = Number(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Istanbul", hour: "2-digit", hourCycle: "h23",
      }).format(new Date()));
      if (hour < 8 || hour >= 17) return;
      if (!dashboardClientCache || dashboardClientCache.userId !== userId ||
          Date.now() - dashboardClientCache.timestamp >= CLIENT_CACHE_TTL) {
        void fetchData(true);
      }
    };

    const timer = window.setInterval(updateIfDue, 60 * 1000);
    document.addEventListener("visibilitychange", updateIfDue);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateIfDue);
    };
  }, [userId, isAuthLoading, fetchData]);

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
      <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] overflow-x-hidden">
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
  const isGlobal = profileSafe?.isGlobalAdmin === true;
  const pendingTotal = data?.kpis?.pendingTotal ?? 0;
  const hasPending = pendingTotal > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] text-slate-800 selection:bg-[#dc3545] selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden pb-16">
        
        {/* Yenilenen ana başlık: iş akışı ve güncelleme bilgisi */}
        <section className="relative overflow-hidden rounded-[26px] bg-[#101a2c] text-white shadow-xl shadow-slate-200/70">
          <div className="pointer-events-none absolute -right-24 -top-36 h-96 w-96 rounded-full bg-[#dc3545]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(90deg,white_1px,transparent_1px),linear-gradient(white_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="relative grid grid-cols-1 lg:grid-cols-12">
            <div className="px-6 py-8 sm:px-8 md:py-10 lg:col-span-8">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> OPERASYON MERKEZİ
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-200">
                  <Building2 size={13} /> {isGlobal ? "Tüm şubeler" : profileSafe?.branch_name || branchName || "Şube görünümü"}
                </span>
              </div>
              <p className="mt-7 text-sm font-black tracking-[0.16em] text-rose-300">LOGISTOCK / WMS</p>
              <h1 className="mt-2 max-w-2xl text-3xl font-black leading-[1.13] tracking-tight sm:text-4xl lg:text-5xl">
                Operasyonun tüm akışı <span className="text-rose-400">tek ekranda.</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-slate-300">
                Kargo adetlerini izleyin, transferleri takip edin ve güncel ürün-koli kayıtlarında hızlıca arama yapın.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void fetchData(true)}
                  disabled={isRefreshing}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#dc3545] px-5 text-xs font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-[#c32b3b] disabled:opacity-50"
                >
                  <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? "Güncelleniyor..." : "Paneli yenile"}
                </button>
              </div>
            </div>
            <div className="flex flex-col justify-center border-t border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:col-span-4 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400"><CalendarDays size={15} /> Güncel görünüm</div>
              <p className="mt-3 text-lg font-black text-white">
                {new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <Truck size={19} className="text-rose-300" />
                  <strong className="mt-3 block font-mono text-2xl font-black">
                    {(data?.cargoDistribution || []).reduce((total, item) => total + item.count, 0).toLocaleString("tr-TR")}
                  </strong>
                  <span className="text-[11px] font-medium text-slate-400">Bugünkü kargo</span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <ArrowUpRight size={19} className="text-emerald-300" />
                  <strong className="mt-3 block font-mono text-2xl font-black">{data?.recentTransfers.length || 0}</strong>
                  <span className="text-[11px] font-medium text-slate-400">Son transferler</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        {refreshError && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-800">
            {refreshError}
          </div>
        )}

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

        {/* 1. SATIR: SOL KARGO (4) / SAĞ TRANSFER (8) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          <CargoOverviewSection
            cargoDistribution={data?.cargoDistribution || []}
            recentCargoSessions={data?.recentCargoSessions || []}
          />
          <TransferCenterSection
            recentTransfers={data?.recentTransfers || []}
            getStatusStyle={getStatusStyle}
            getStatusText={getStatusText}
          />
        </div>

        {/* 2. SATIR: SOL ÜRÜN/KOLİ (7) / SAĞ LOGLAR (5) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          <CatalogActivitySection />
          <WarehouseLogsSection
            recentPutawayLogs={data?.recentPutawayLogs || []}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}