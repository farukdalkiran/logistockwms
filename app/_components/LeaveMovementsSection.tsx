"use client";

import { CalendarDays, Clock } from "lucide-react";

export interface LeaveLogData {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  employee_name: string;
}

interface Props {
  recentLeaveLogs: LeaveLogData[];
  getStatusStyle: (status: string) => string;
  getStatusText: (status: string) => string;
}

export function LeaveMovementsSection({
  recentLeaveLogs,
  getStatusStyle,
  getStatusText
}: Props) {
  const formatDateRange = (start: string, end: string) => {
    if (!start) return "-";
    const d1 = new Date(start).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short"
    });
    const d2 = end
      ? new Date(end).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "short"
        })
      : "Devam Ediyor";
    return d1 === d2 ? d1 : `${d1} - ${d2}`;
  };

  return (
    <div className="lg:col-span-4 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[450px] overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm">
            <CalendarDays className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              Personel İzinleri
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">
              Son Onaylanan & Bekleyenler
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2 bg-slate-100/50">
        {recentLeaveLogs.slice(0, 10).map((log, idx) => (
          <div
            key={log.id}
            className="flex flex-col border border-slate-200 bg-white p-3 rounded-md shadow-sm transition-colors hover:border-slate-400 animate-staggered"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-black text-slate-900 uppercase truncate pr-2">
                {log.employee_name}
              </span>
              <span
                className={`px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-widest border shrink-0 shadow-sm ${getStatusStyle(
                  log.status
                )}`}
              >
                {getStatusText(log.status)}
              </span>
            </div>
            <div className="flex justify-between items-end mt-1 border-t border-slate-100 pt-2">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Clock size={12} className="text-slate-500" />
                <span className="text-[10px] font-mono font-bold tracking-wider text-slate-700">
                  {formatDateRange(log.start_date, log.end_date)}
                </span>
              </div>
              <span className="inline-block bg-slate-50 border border-slate-300 px-2 py-0.5 rounded-sm text-[9px] text-slate-700 font-black uppercase shadow-sm">
                {log.leave_type?.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        ))}
        {recentLeaveLogs.length === 0 && (
          <div className="py-16 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
            İzin Kaydı Bulunmuyor
          </div>
        )}
      </div>
    </div>
  );
}