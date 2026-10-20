// app/management/_components/WarehouseLogsSection.tsx
"use client";

import { BoxSelect, LogIn, LogOut, Info, Building2, User, Hash } from "lucide-react";

export interface PutawayLogData {
  id: string;
  action_type: string;
  description: string;
  employee_name: string;
  branch_name?: string; // Şube/Mağaza adı (opsiyonel)
  created_at?: string;
}

interface Props {
  recentPutawayLogs: PutawayLogData[];
}

export function WarehouseLogsSection({ recentPutawayLogs }: Props) {
  return (
    <div className="lg:col-span-8 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[450px] overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm">
            <BoxSelect className="w-5 h-5 text-[#dc3545]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              Depo Operasyon Logları (Detaylı)
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">
              Gerçek Zamanlı Raf, Stok ve Mağaza Aksiyonları
            </p>
          </div>
        </div>
      </div>

      {/* Tablo Alanı */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto w-full bg-white custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-10">
            <tr className="text-[11px] uppercase tracking-widest text-slate-600 font-black">
              <th className="py-3 px-4 w-16 text-center border-r border-slate-200">Tür</th>
              <th className="py-3 px-4 w-1/3 border-r border-slate-200">Personel & Şube</th>
              <th className="py-3 px-4 border-r border-slate-200">İşlem Açıklaması & Detay</th>
              <th className="py-3 px-4 text-right w-32">Statü</th>
            </tr>
          </thead>
          <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-100">
            {recentPutawayLogs.map((log, idx) => {
              const action = log.action_type?.toUpperCase() || "";
              const isPutaway =
                action.includes("INBOUND") ||
                action.includes("PUTAWAY") ||
                action.includes("ADD") ||
                action.includes("GIRIS");
              const isPicking =
                action.includes("OUTBOUND") ||
                action.includes("PICKING") ||
                action.includes("REMOVE") ||
                action.includes("CIKIS");

              // Köşeli parantez içindeki kod/barkod/raf ifadelerini şık badge'lere dönüştür
              const formattedDesc = log.description?.replace(
                /\[(.*?)\]/g,
                '<span class="inline-flex items-center gap-1 font-mono text-[11px] font-black text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm mx-0.5 shadow-2xs"><span class="w-1.5 h-1.5 rounded-full bg-[#dc3545]"></span>$1</span>'
              );

              return (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50/80 transition-colors animate-staggered"
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  {/* Tür İkonu */}
                  <td className="py-3 px-4 text-center align-top border-r border-slate-100">
                    <div
                      className={`w-8 h-8 rounded-sm border flex items-center justify-center mx-auto shadow-2xs ${
                        isPutaway
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : isPicking
                          ? "bg-red-50 border-red-300 text-[#dc3545]"
                          : "bg-blue-50 border-blue-300 text-blue-700"
                      }`}
                    >
                      {isPutaway ? (
                        <LogIn size={15} strokeWidth={2.5} />
                      ) : isPicking ? (
                        <LogOut size={15} strokeWidth={2.5} />
                      ) : (
                        <Info size={15} strokeWidth={2.5} />
                      )}
                    </div>
                  </td>

                  {/* Personel & Şube Bilgisi */}
                  <td className="py-3 px-4 align-top border-r border-slate-100">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-slate-900 font-black">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span className="uppercase text-xs truncate max-w-[180px]">
                          {log.employee_name || "Sistem Operatörü"}
                        </span>
                      </div>
                      {log.branch_name && (
                        <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-wider w-max shadow-2xs">
                          <Building2 size={11} className="text-amber-600 shrink-0" />
                          <span>{log.branch_name}</span>
                        </div>
                      )}
                      {log.created_at && (
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          {new Date(log.created_at).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* İşlem Açıklaması */}
                  <td className="py-3 px-4 align-top border-r border-slate-100">
                    {formattedDesc ? (
                      <div
                        className="text-[11px] leading-relaxed text-slate-800 font-medium mt-0.5"
                        dangerouslySetInnerHTML={{ __html: formattedDesc }}
                      ></div>
                    ) : (
                      <span className="text-[11px] leading-relaxed text-slate-700 block mt-0.5">
                        {log.description || "-"}
                      </span>
                    )}
                  </td>

                  {/* Statü Etiketi */}
                  <td className="py-3 px-4 text-right align-top">
                    <span
                      className={`px-2.5 py-1 border rounded-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap inline-block shadow-2xs ${
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