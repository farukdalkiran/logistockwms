"use client";

import { useEffect, useState } from "react";
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
  Database,
  BoxSelect,
  Box,
  BellRing,
  UserCheck
} from "lucide-react";

import { TransferCenterSection, TransferData } from "./_components/TransferCenterSection";
import {
  CargoDistributionSection,
  CargoDistributionItem,
  CargoSessionData
} from "./_components/CargoDistributionSection";
import { WarehouseLogsSection, PutawayLogData } from "./_components/WarehouseLogsSection";
import { LeaveMovementsSection, LeaveLogData } from "./_components/LeaveMovementsSection";

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

export default function ManagementDashboard() {
  const { userProfile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!isAuthLoading) {
      if (!userProfile) {
        router.replace("/login");
        return;
      }
      fetchData();
    }
  }, [userProfile, isAuthLoading]);

  const fetchData = async () => {
    setLoading(true);
    const result = await getDashboardDataServer(userProfile!.id);
    if (result.success && result.data) setData(result.data as DashboardData);
    setLoading(false);
  };

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
              <div
                className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-[#dc3545] rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></div>
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
  const isGlobal =
    profileSafe?.role === "Developer" ||
    profileSafe?.role === "Admin" ||
    !profileSafe?.branch_id;

  const pendingTotal = data?.kpis?.pendingTotal ?? 0;
  const hasPending = pendingTotal > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Quicksand'] text-slate-800 selection:bg-[#dc3545] selection:text-white overflow-x-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-staggered {
          opacity: 0;
          animation: fadeSlideUp 0.3s ease-out forwards;
        }
      `
        }}
      />

      <Navbar />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden pb-16">
        {/* =========================================
            ÜST BLOK: HERO HEADER, UYARI PANELİ VE KPI KARTLARI
            ========================================= */}
        <div className="w-full bg-[#0F172B] border border-slate-800 border-l-[8px] border-l-[#dc3545] rounded-md shadow-md relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0"></div>

          <div className="relative z-10 p-6 lg:p-8 flex flex-col gap-1 w-full flex-1 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-3">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-sm shadow-inner">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-sm bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-sm h-2 w-2 bg-emerald-500"></span>
                </div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-mono">
                  {isGlobal ? "MASTER YETKİ AKTİF" : "LOKAL BAĞLANTI"}
                </span>
              </div>

              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-sm shadow-inner">
                <Building2
                  size={12}
                  className={isGlobal ? "text-blue-400" : "text-amber-400"}
                />
                <span
                  className={`text-[10px] font-black uppercase tracking-widest font-mono ${
                    isGlobal ? "text-blue-400" : "text-amber-400"
                  }`}
                >
                  {isGlobal
                    ? "MERKEZ KOMUTA"
                    : profileSafe?.branch_name || "ŞUBE ATANMADI"}
                </span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase leading-none">
              <span>HOŞ GELDİNİZ</span>
            </h1>

            <p className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em] font-mono mt-4 max-w-3xl leading-relaxed border-l-2 border-slate-700 pl-3">
              Mağaza ve depo arası iletişim ile transferlerin yönetildiği, kesintisiz ürün akışının sağlandığı, personel mesai ve izin haklarının takip edildiği tam otomatik depo yönetim altyapısı.
            </p>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-right bg-slate-900/80 border-t lg:border-t-0 border-l-0 lg:border-l border-slate-700/80 p-6 h-full w-full lg:w-auto shrink-0 justify-center lg:justify-end">
            <div className="flex flex-col gap-1 text-center lg:text-left border-b md:border-b-0 md:border-r border-slate-700 pb-4 md:pb-0 md:pr-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono flex items-center justify-center lg:justify-start gap-1.5">
                <Database size={14} className="text-[#dc3545]" /> DB Doluluk (Yük)
              </span>
              <div className="flex items-center justify-center lg:justify-start gap-3 mt-1.5">
                <div className="w-24 bg-slate-800 h-2.5 rounded-sm overflow-hidden border border-slate-700">
                  <div
                    className="bg-[#dc3545] h-full transition-all duration-700 ease-out"
                    style={{ width: `${data?.systemLoad || 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-black text-white font-mono">
                  %{data?.systemLoad || 0}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-center lg:text-right px-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                Sistem Saati
              </span>
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">
                {new Date().toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </div>
          </div>
        </div>

        {hasPending && (
          <div className="w-full bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-md shadow-sm relative overflow-hidden p-4 flex flex-col md:flex-row items-center justify-between gap-4 mt-1">
            <div className="relative z-10 flex flex-col gap-1 w-full">
              <div className="flex items-center gap-2 text-amber-800">
                <BellRing className="w-5 h-5 animate-bounce" />
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Yöneticinin Dikkatine
                </h2>
              </div>
              <p className="text-amber-700 font-bold text-xs uppercase tracking-widest mt-1 font-mono">
                Sistemde onayınızı bekleyen{" "}
                <span className="text-sm bg-amber-200 px-1.5 py-0.5 rounded-sm font-black border border-amber-300">
                  {pendingTotal}
                </span>{" "}
                adet <strong className="text-amber-900">İzin veya Mesai Düzeltme</strong> talebi bulunmaktadır.
              </p>
            </div>
            <button
              onClick={() => router.push("/management/hr/approvals")}
              className="relative z-10 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-md transition-colors shadow-sm flex items-center gap-2 shrink-0"
            >
              <UserCheck size={16} /> TALEPLERİ İNCELE
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
          {[
            {
              title: "Kayıtlı Ürün",
              value: data?.kpis.productsTotal.toLocaleString("tr-TR"),
              icon: BoxSelect,
              color: "text-purple-600",
              bg: "bg-purple-50 border-purple-200"
            },
            {
              title: "Toplam Stok",
              value: data?.kpis.stockVolume.toLocaleString("tr-TR"),
              icon: Layers,
              color: "text-[#dc3545]",
              bg: "bg-red-50 border-red-200"
            },
            {
              title: "Kayıtlı Koli",
              value: data?.kpis.boxesTotal.toLocaleString("tr-TR"),
              icon: Box,
              color: "text-indigo-600",
              bg: "bg-indigo-50 border-indigo-200"
            },
            {
              title: "Bağlı Şubeler",
              value: data?.kpis.branches,
              icon: Building2,
              color: "text-blue-600",
              bg: "bg-blue-50 border-blue-200"
            },
            {
              title: "Aktif Personel",
              value: data?.kpis.employees,
              icon: Users,
              color: "text-emerald-600",
              bg: "bg-emerald-50 border-emerald-200"
            },
            {
              title: "Bekleyen Onay",
              value: pendingTotal,
              icon: AlertCircle,
              color: "text-orange-600",
              bg: "bg-orange-50 border-orange-200"
            }
          ].map((kpi, idx) => (
            <div
              key={idx}
              className="bg-white p-4 border border-slate-200 shadow-sm rounded-md flex flex-col justify-between gap-3 transition-colors hover:border-slate-400 group"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-9 h-9 flex items-center justify-center rounded-md border ${kpi.bg}`}
                >
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-2xl font-black text-slate-800 leading-none truncate font-mono">
                  {kpi.value}
                </p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 truncate group-hover:text-slate-700 transition-colors">
                  {kpi.title}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* =========================================
            1. VE 2. AYRI SAYFA / BİLEŞEN ÇAĞRIMI
            ========================================= */}
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

        {/* =========================================
            3. VE 4. AYRI SAYFA / BİLEŞEN ÇAĞRIMI
            ========================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start mt-2">
          <WarehouseLogsSection
            recentPutawayLogs={data?.recentPutawayLogs || []}
          />
          <LeaveMovementsSection
            recentLeaveLogs={data?.recentLeaveLogs || []}
            getStatusStyle={getStatusStyle}
            getStatusText={getStatusText}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}