"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { processAttendanceScan } from "@/app/actions/attendance";
import { supabase } from "@/lib/supabase";
import { Check, AlertCircle, ScanLine, QrCode } from "lucide-react";

interface BarcodeScannerProps {
  branchId: string | null;
  branchName: string;
}

export default function BarcodeScanner({
  branchId,
  branchName,
}: BarcodeScannerProps) {
  const router = useRouter();
  const [actionType, setActionType] = useState<"IN" | "OUT">("IN");
  const [terminalId, setTerminalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);


useEffect(() => {
  // Sayfa ilk açıldığında QR okuyucuya hazır olsun.
  inputRef.current?.focus({ preventScroll: true });

  const realtimeChannel = supabase
    .channel("attendance_realtime_sync")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "attendance",
        filter: branchId
          ? `branch_id=eq.${branchId}`
          : undefined,
      },
      () => {
        router.refresh();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(realtimeChannel);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };
}, [branchId, router]);


  const triggerFeedback = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 4000);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const scannedValue = terminalId.trim();

    if (!scannedValue.startsWith('wms_')) {
      triggerFeedback("error", "GEÇERSİZ BARKOD! LÜTFEN SİSTEM QR KODUNU OKUTUNUZ.");
      setTerminalId("");
      return;
    }

    setTerminalId("");
    setLoading(true);

    try {
      const result = await processAttendanceScan(
        scannedValue, 
        actionType,
        branchId
      );

      triggerFeedback(result.success ? "success" : "error", result.message || "İŞLEM SONUCU ALINAMADI");

      if (result.success) {
        window.dispatchEvent(new CustomEvent("refresh-wms-attendance"));
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      triggerFeedback("error", "SİSTEM HATASI OLUŞTU");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const isOut = actionType === "OUT";
  const activeColor = isOut ? "#dc3545" : "#3d870c";

  return (
    <div className="bg-white border border-slate-300 w-full max-w-md flex flex-col shadow-2xl rounded-md overflow-hidden select-none relative z-10">
      
      {/* TAILWIND BAĞIMSIZ ÖZEL LAZER ANİMASYONU */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-laser {
          0% { top: 10%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan-laser {
          animation: scan-laser 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
        }
      `}} />

      {/* Üst Komuta Paneli */}
      <div
        className="bg-[#0F172B] p-5 flex justify-between items-center border-b-4 transition-colors duration-500 relative overflow-hidden"
        style={{ borderBottomColor: activeColor }}
      >
        <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] pointer-events-none"></div>
        <div className="flex flex-col justify-center relative z-10">
          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
            MESAİ KOMUTA MERKEZİ
          </span>
          <span className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wide">
            <span
              className={`w-2.5 h-2.5 rounded-sm shadow-[0_0_12px_currentColor] transition-colors duration-500 ${
                isOut ? "bg-[#dc3545] text-[#dc3545]" : "bg-[#3d870c] text-[#3d870c] animate-pulse"
              }`}
            ></span>
            {branchName}
          </span>
        </div>
      </div>

      <div className="p-6 flex flex-col items-center bg-slate-50">
        
        {/* ==================================================== */}
        {/* ENDÜSTRİYEL DİNAMİK QR GÖRSEL ALANI (ANİMASYONLU)    */}
        {/* ==================================================== */}
        <div className="relative p-[3px] mb-6 rounded-lg overflow-hidden shadow-lg group">
          
          {/* Dönen Radar Çerçevesi (Sweeping Glow Border) */}
          <div 
            className="absolute top-1/2 left-1/2 h-[250%] w-[250%] -translate-x-1/2 -translate-y-1/2 animate-[spin_4s_linear_infinite] opacity-60 transition-colors duration-500" 
            style={{ backgroundImage: `conic-gradient(transparent 0%, transparent 75%, ${activeColor} 100%)` }}
          />

          {/* İç Kutu (QR Alanı) */}
          <div className="w-48 h-48 bg-white relative flex items-center justify-center rounded-md overflow-hidden z-10">
            
            {/* Hedefleme Köşeleri (Pulsing Corners) */}
            <div className="absolute top-3 left-3 w-6 h-6 border-t-[3px] border-l-[3px] transition-colors duration-500 rounded-tl-sm z-10" style={{ borderColor: activeColor }}></div>
            <div className="absolute top-3 right-3 w-6 h-6 border-t-[3px] border-r-[3px] transition-colors duration-500 rounded-tr-sm z-10" style={{ borderColor: activeColor }}></div>
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-[3px] border-l-[3px] transition-colors duration-500 rounded-bl-sm z-10" style={{ borderColor: activeColor }}></div>
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-[3px] border-r-[3px] transition-colors duration-500 rounded-br-sm z-10" style={{ borderColor: activeColor }}></div>

            {/* İç Kesik Çizgili Kutu */}
            <div
              className="absolute inset-4 border-2 border-dashed transition-colors duration-500 pointer-events-none z-0"
              style={{ borderColor: `${activeColor}40` }}
            ></div>

            {/* Yukarı-Aşağı Hareket Eden Tarama Lazeri */}
            {!loading && (
              <div 
                className="absolute left-4 right-4 h-[2px] z-20 animate-scan-laser transition-colors duration-500"
                style={{ backgroundColor: activeColor, boxShadow: `0 0 12px 2px ${activeColor}` }}
              ></div>
            )}

            {/* Merkez QR İkonu */}
            <QrCode
              size={120}
              className={`z-10 transition-all duration-500 drop-shadow-md ${loading ? 'opacity-20 scale-95' : 'group-hover:scale-105'}`}
              color={activeColor}
              strokeWidth={1.5}
            />

            {/* Yükleniyor Spinner (Lazer Kapanır, Bu Çıkar) */}
            {loading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                <div className="w-10 h-10 border-4 border-t-transparent animate-spin rounded-full transition-colors duration-500" style={{ borderColor: activeColor, borderTopColor: 'transparent' }}></div>
              </div>
            )}
          </div>
        </div>

        {/* BİLGİ BANDI (QR OKUTMA) */}
        <div className="w-full flex items-start gap-2 text-slate-800 bg-slate-200/50 py-3 px-3 rounded-md mb-6 border border-slate-300 shadow-sm transition-all hover:bg-slate-200">
          <ScanLine size={18} className="text-slate-600 shrink-0 mt-0.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 leading-relaxed">
            Sistem dinamik QR kodları ile çalışmaktadır. Lütfen personel portalınızdaki QR kodu okutunuz.
          </span>
        </div>

        {/* İşlem Tipi Seçici */}
        <div className="bg-slate-200/80 p-1.5 rounded-md flex w-full mb-6 border border-slate-300 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActionType("IN");
              inputRef.current?.focus();
            }}
            className={`flex-1 py-3.5 text-xs font-black rounded-sm transition-all duration-300 uppercase tracking-widest min-h-[44px] active:scale-[0.98] ${
              !isOut
                ? "bg-[#3d870c] text-white shadow-[0_4px_12px_rgba(61,135,12,0.3)] ring-1 ring-[#3d870c]/50"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-300/50"
            }`}
          >
            MESAİ GİRİŞ
          </button>
          <button
            type="button"
            onClick={() => {
              setActionType("OUT");
              inputRef.current?.focus();
            }}
            className={`flex-1 py-3.5 text-xs font-black rounded-sm transition-all duration-300 uppercase tracking-widest min-h-[44px] active:scale-[0.98] ${
              isOut
                ? "bg-[#dc3545] text-white shadow-[0_4px_12px_rgba(220,53,69,0.3)] ring-1 ring-[#dc3545]/50"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-300/50"
            }`}
          >
            MESAİ ÇIKIŞ
          </button>
        </div>

        {/* Gizli QR Giriş Formu (Dinamik Aktiflik Göstergeli) */}
        <div 
          className="w-full flex flex-col gap-2 group relative overflow-hidden rounded-md h-12 border-2 transition-all duration-300 bg-white shadow-sm"
          style={{ 
            borderColor: loading ? '#e2e8f0' : activeColor,
            boxShadow: loading ? 'none' : `0 0 0 3px ${activeColor}20` 
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full h-full flex items-center px-3"
          >
            <div className="flex items-center gap-2 mr-3">
              {/* REC Işığı (Kırmızı/Yeşil) */}
              <div 
                className={`w-2 h-2 rounded-full animate-pulse transition-colors duration-500`}
                style={{ backgroundColor: loading ? '#94a3b8' : activeColor }}
              />
              <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">
                TARANIYOR
              </span>
            </div>
            <input
              id="terminal-input"
              ref={inputRef}
              type="text"
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)} 
              disabled={loading} 
              className="flex-1 bg-transparent border-none outline-none text-transparent caret-transparent font-mono text-sm tracking-widest selection:bg-transparent"
              autoComplete="off"
              autoFocus
            />
          </form>
        </div>

        {/* ENDÜSTRİYEL BİLGİ KARTI */}
        <div className="w-full min-h-[84px] mt-6 transition-all duration-300">
          {feedback && (
            <div
              className={`w-full relative overflow-hidden rounded-md border-2 text-left shadow-xl flex items-stretch animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-200 ${
                feedback.type === "success"
                  ? "bg-emerald-50 border-emerald-500"
                  : "bg-[#fff0f0] border-[#dc3545]"
              }`}
            >
              <div
                className={`flex items-center justify-center px-4 shrink-0 relative overflow-hidden ${
                  feedback.type === "success"
                    ? "bg-[#3d870c] text-white"
                    : "bg-[#dc3545] text-white"
                }`}
              >
                <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] pointer-events-none"></div>
                {feedback.type === "success" ? (
                  <Check strokeWidth={3} className="w-8 h-8 relative z-10" />
                ) : (
                  <AlertCircle strokeWidth={2.5} className="w-8 h-8 relative z-10" />
                )}
              </div>

              <div className="flex flex-col justify-center py-2.5 px-4 w-full bg-white">
                <div className="flex justify-between items-center mb-1">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest opacity-90 ${
                      feedback.type === "success"
                        ? "text-[#3d870c]"
                        : "text-[#dc3545]"
                    }`}
                  >
                    {feedback.type === "success" ? "SİSTEM ONAYI" : "KRİTİK UYARI"}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm font-mono tracking-widest ${
                      feedback.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}>
                      {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                  </span>
                </div>
                <span className="text-[13px] font-black tracking-wide leading-tight uppercase text-slate-800 font-mono">
                  {feedback.msg}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}