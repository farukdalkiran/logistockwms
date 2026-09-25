"use client";

import { ArrowRight, Hash, Eye, MonitorPlay } from "lucide-react";
import { TransferItem } from "@/app/actions/useTransferScan";

interface ProgressPanelProps {
  activeTransfer: any;
  transferItems: TransferItem[];
  mode: "outbound" | "inbound" | null;
  isMNS: boolean;
  userRole?: string;
  isSpectator: boolean;
  onToggleSpectator: () => void;
}

export default function ProgressPanel({
  activeTransfer,
  transferItems,
  mode,
  isMNS,
  userRole = "", 
  isSpectator,
  onToggleSpectator
}: ProgressPanelProps) {
  const isFlexibleOutbound = isMNS && mode === "outbound";

  const totalReq = transferItems.reduce((acc, i) => acc + (isFlexibleOutbound ? Math.max(i.requested_qty, i.sent_qty) : mode === "outbound" ? i.requested_qty : i.sent_qty), 0);
  const totalScanned = transferItems.reduce((acc, i) => acc + (mode === "outbound" ? i.sent_qty : i.received_qty), 0);
  const totalMissing = Math.max(0, totalReq - totalScanned);
  const progressPercent = totalReq > 0 ? Math.round((totalScanned / totalReq) * 100) : 0;

  // Güvenli rol kontrolü (Developer, DEVELOPER, developer hepsini kabul eder)
  const isDeveloper = userRole?.toLowerCase() === "developer";

  return (
    <div className="bg-[#0b1426]">
      <div className="bg-[#0b1426] max-w-[1400px] mx-auto p-6 shadow-lg border-b-4 border-blue-600 flex flex-col md:flex-row gap-6 items-center justify-between z-10 shrink-0 relative">
        
        {/* RGB YANAR DÖNER CSS ANIMASYONU (Sadece bu componente özel) */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes rgbShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .rgb-glow-bg {
            background: linear-gradient(90deg, #ff0055, #9900ff, #00d4ff, #ff0055);
            background-size: 300% 300%;
            animation: rgbShift 3s linear infinite;
          }
        `}} />

        {/* DEVELOPER ÖZEL: RGB YANAR DÖNER İZLEYİCİ MODU BUTONU (TAM ORTADA) */}
        {isDeveloper && (
          <div className="absolute left-1/2 top-0 md:top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <button 
              onClick={onToggleSpectator}
              className={`group relative overflow-hidden flex items-center justify-center p-[2px] rounded-full transition-all active:scale-95 shadow-2xl
                ${isSpectator ? 'shadow-[0_0_20px_rgba(153,0,255,0.6)]' : 'hover:shadow-[0_0_15px_rgba(0,212,255,0.4)]'}`}
            >
              {/* Animasyonlu RGB Border / Arkaplan */}
              <div className="absolute inset-0 rgb-glow-bg opacity-90 group-hover:opacity-100 transition-opacity"></div>
              
              {/* Buton İçeriği */}
              <div className="relative z-10 flex items-center gap-2 px-5 py-2 bg-[#0b1426] rounded-full text-white uppercase tracking-widest font-black text-[11px]">
                {isSpectator ? (
                  <>
                    <MonitorPlay size={16} className="text-[#00d4ff] animate-pulse" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00d4ff] to-[#ff0055]">İZLEYİCİ MODU AKTİF</span>
                  </>
                ) : (
                  <>
                    <Eye size={16} className="text-slate-300 group-hover:text-white transition-colors" />
                    <span className="text-slate-200 group-hover:text-white transition-colors">DEV MODU: İZLE</span>
                  </>
                )}
              </div>
            </button>
          </div>
        )}

        {/* Sol: Evrak Bilgisi */}
        <div className="flex flex-col gap-2 w-full md:w-1/3 mt-6 md:mt-0 items-center md:items-start">
          <span className="text-blue-400 font-bold text-[12px] flex items-center gap-2 uppercase tracking-widest">
            <Hash size={16} /> {activeTransfer.transfer_code}
          </span>
          <h2 className="text-white text-[18px] md:text-xl font-black uppercase flex items-center gap-3 text-center md:text-left">
            <span className="truncate max-w-[120px] sm:max-w-none">{activeTransfer.fromName}</span>
            <ArrowRight className="text-blue-500 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">{activeTransfer.toName}</span>
          </h2>
          <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-md text-[11px] font-bold w-max uppercase tracking-widest border border-blue-500/30">
            {isMNS ? "MNS Serbest Sayım" : mode === "outbound" ? "Sevkiyat (Çıkış)" : "Mal Kabul (Giriş)"}
          </span>
        </div>

        {/* Sağ: İlerleme Metrikleri */}
        <div className="flex-1 w-full flex flex-col gap-4">
          <div className="flex justify-between md:justify-end gap-6 md:gap-10 text-center">
            <div className="flex flex-col">
              <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Beklenen</span>
              <span className="text-white text-[24px] md:text-[28px] font-black leading-none">{isFlexibleOutbound ? "Limitsiz" : totalReq}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-widest">Okunan</span>
              <span className="text-emerald-400 text-[24px] md:text-[28px] font-black leading-none">{totalScanned}</span>
            </div>
            {!isFlexibleOutbound && (
              <div className="flex flex-col">
                <span className="text-[#dc3545] text-[11px] font-bold uppercase tracking-widest">Kalan</span>
                <span className="text-[#dc3545] text-[24px] md:text-[28px] font-black leading-none">{totalMissing}</span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 md:h-4 bg-slate-800 rounded-full overflow-hidden shadow-inner flex items-center relative">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-1000 ease-out relative overflow-hidden" style={{ width: `${Math.min(progressPercent, 100)}%` }}>
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}