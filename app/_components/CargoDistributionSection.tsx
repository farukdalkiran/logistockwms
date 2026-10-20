"use client";

import { Truck, Clock } from "lucide-react";

export interface CargoDistributionItem {
  carrier: string;
  count: number;
  color: string;
}

export interface CargoSessionData {
  id: string;
  carrier_name: string;
  status: string;
  total_items: number;
  started_at: string;
  completed_at: string;
  employee_name: string;
}

interface Props {
  cargoDistribution: CargoDistributionItem[];
  recentCargoSessions: CargoSessionData[];
  getStatusStyle: (status: string) => string;
  getStatusText: (status: string) => string;
}

export function CargoDistributionSection({
  cargoDistribution,
  recentCargoSessions,
  getStatusStyle,
  getStatusText
}: Props) {
  const cargoDist = cargoDistribution.map((c) => ({
    ...c,
    color:
      c.carrier.toUpperCase().includes("HEPSIJET") ||
      c.carrier.toUpperCase().includes("HEPSİJET")
        ? "#9333ea"
        : c.color
  }));

  const totalCargoCount = cargoDist.reduce((acc, curr) => acc + curr.count, 0);

  const renderConicGradient = () => {
    if (cargoDist.length === 0 || totalCargoCount === 0)
      return "conic-gradient(#f1f5f9 0% 100%)";
    let currentPercent = 0;
    const stops = cargoDist.map((item) => {
      const start = currentPercent;
      const end = currentPercent + (item.count / totalCargoCount) * 100;
      currentPercent = end;
      return `${item.color} ${start}% ${end}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  };

  const formatTimeRange = (start: string, end: string) => {
    if (!start) return "-";
    const t1 = new Date(start).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    });
    const t2 = end
      ? new Date(end).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit"
        })
      : "...";
    return `${t1} - ${t2}`;
  };

  return (
    <div className="lg:col-span-4 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[600px] overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm">
            <Truck className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              Kargo Dağılımı
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">
              Teslimat Firmaları Özeti
            </p>
          </div>
        </div>
      </div>

      {/* Üst Kısım: Donut Grafiği ve Toplamlar */}
      <div className="p-5 border-b border-slate-200 bg-white shrink-0 flex flex-col gap-4 relative">
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex-1 flex flex-col gap-1.5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Dağılım Özeti
            </h4>
            {cargoDist.map((c, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-[11px] font-black uppercase text-slate-700 tracking-widest bg-slate-50 px-3 py-2 border border-slate-200 rounded-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm border border-black/10"
                    style={{ backgroundColor: c.color }}
                  ></span>
                  {c.carrier}
                </span>
                <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-sm text-slate-800">
                  {c.count}
                </span>
              </div>
            ))}
            {cargoDist.length === 0 && (
              <span className="text-xs text-slate-400 font-bold uppercase mt-2">
                Veri Yok
              </span>
            )}
          </div>

          {/* Donut Grafiği */}
          <div className="flex shrink-0 items-center justify-center p-2">
            <div
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full shadow-inner relative flex items-center justify-center border-4 border-slate-50"
              style={{ background: renderConicGradient() }}
            >
              <div className="absolute w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-sm border border-slate-100">
                <span className="text-2xl font-black text-slate-800 font-mono tracking-tighter leading-none">
                  {totalCargoCount}
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Total Kargo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alt Kısım: Teslimat Yapanlar Logu */}
      <div className="p-3 border-b-2 border-slate-200 bg-slate-100 shrink-0">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5 pl-2">
          <Clock size={14} /> Son Teslimat Seansları
        </h4>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar bg-white">
        <table className="w-full text-left border-collapse min-w-[350px]">
          <thead className="bg-white sticky top-0 z-10">
            <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-black border-b-2 border-slate-100">
              <th className="py-2.5 px-4 border-r border-slate-100">Firma & Saat</th>
              <th className="py-2.5 px-4">Teslim Eden</th>
            </tr>
          </thead>
          <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-100">
            {recentCargoSessions.map((session, idx) => (
              <tr
                key={session.id}
                className="hover:bg-slate-50 transition-colors animate-staggered"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <td className="py-3 px-4 border-r border-slate-100">
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-slate-900 text-[11px] uppercase tracking-wider truncate max-w-[140px]">
                      {session.carrier_name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded-sm w-max border border-slate-200">
                      {formatTimeRange(session.started_at, session.completed_at)}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1.5 items-start">
                    <span className="text-slate-800 text-[11px] uppercase truncate max-w-[140px] font-black">
                      {session.employee_name}
                    </span>
                    <span
                      className={`px-2 py-0.5 border rounded-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm ${getStatusStyle(
                        session.status
                      )}`}
                    >
                      {getStatusText(session.status)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {recentCargoSessions.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="py-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest"
                >
                  Kayıt Bulunamadı
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}