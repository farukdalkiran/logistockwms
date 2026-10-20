"use client";

import { BoxSelect, LogIn, LogOut, Info } from "lucide-react";

export interface PutawayLogData {
  id: string;
  action_type: string;
  description: string;
  employee_name: string;
  created_at?: string;
}

interface Props {
  recentPutawayLogs: PutawayLogData[];
}

export function WarehouseLogsSection({ recentPutawayLogs }: Props) {
  return (
    <div className="lg:col-span-8 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[450px] overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm">
            <BoxSelect className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              Depo Operasyon Logları (Detaylı)
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">
              Gerçek Zamanlı Raf ve Stok Aksiyonları
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto w-full custom-scrollbar bg-white">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-widest text-slate-600 font-black">
              <th className="py-3 px-5 w-16 text-center border-r border-slate-200">Tür</th>
              <th className="py-3 px-5 w-1/4 border-r border-slate-200">Tarih & Personel</th>
              <th className="py-3 px-5 border-r border-slate-200">İşlem Detayı & Barkod Bilgisi</th>
              <th className="py-3 px-5 text-right w-32">Statü</th>
            </tr>
          </thead>
          <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-100">
            {recentPutawayLogs.map((log, idx) => {
              const action = log.action_type?.toUpperCase() || "";
              const isPutaway =
                action.includes("INBOUND") ||
                action.includes("PUTAWAY") ||
                action.includes("ADD");
              const isPicking =
                action.includes("OUTBOUND") ||
                action.includes("PICKING") ||
                action.includes("REMOVE");
              const formattedDesc = log.description?.replace(
                /\[(.*?)\]/g,
                '<strong class="text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-sm border border-slate-300 font-mono">[$1]</strong>'
              );

              return (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50 transition-colors animate-staggered"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <td className="py-3 px-5 text-center align-top border-r border-slate-100">
                    <div
                      className={`w-8 h-8 rounded-sm border flex items-center justify-center mx-auto shadow-sm ${
                        isPutaway
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : isPicking
                          ? "bg-red-50 border-red-300 text-[#dc3545]"
                          : "bg-slate-50 border-slate-300 text-slate-600"
                      }`}
                    >
                      {isPutaway ? (
                        <LogIn size={14} strokeWidth={2.5} />
                      ) : isPicking ? (
                        <LogOut size={14} strokeWidth={2.5} />
                      ) : (
                        <Info size={14} strokeWidth={2.5} />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-5 align-top border-r border-slate-100">
                    <span className="block font-black text-slate-900 uppercase text-xs truncate max-w-[180px]">
                      {log.employee_name}
                    </span>
                    {log.created_at && (
                      <span className="block text-[10px] font-mono font-bold text-slate-500 mt-1">
                        {new Date(log.created_at).toLocaleString("tr-TR")}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5 align-top border-r border-slate-100">
                    {formattedDesc ? (
                      <span
                        className="text-[11px] leading-relaxed text-slate-700 block mt-0.5"
                        dangerouslySetInnerHTML={{ __html: formattedDesc }}
                      ></span>
                    ) : (
                      <span className="text-[11px] leading-relaxed text-slate-700 block mt-0.5">
                        {log.description || "-"}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right align-top">
                    <span
                      className={`px-2.5 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap inline-block shadow-sm ${
                        isPutaway
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : isPicking
                          ? "bg-red-50 text-[#dc3545] border-red-300"
                          : "bg-slate-50 text-slate-700 border-slate-300"
                      }`}
                    >
                      {isPutaway ? "RAFLAMA (+)" : isPicking ? "ÇIKIŞ (-)" : "SİSTEM LOG"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {recentPutawayLogs.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-widest bg-white"
                >
                  Depo işlemi kaydı bulunamadı
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}