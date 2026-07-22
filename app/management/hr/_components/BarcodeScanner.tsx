"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { processAttendanceScan } from "@/app/actions/attendance";
import { supabase } from "@/lib/supabase";
import { QrCode, Check, AlertCircle } from "lucide-react";

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
    // Terminal açıldığında otomatik odaklan
    inputRef.current?.focus();

    // WMS Kiosk Lojiği: Ekranda nereye tıklanırsa tıklansın odak inputta kalsın
    const handleGlobalClick = () => inputRef.current?.focus();
    window.addEventListener("click", handleGlobalClick);

    // Sadece Realtime tetikleyicisi olarak kullanıyoruz, ölü data fetch işlemi kaldırıldı
    const realtimeChannel = supabase
      .channel("attendance_realtime_sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: branchId ? `branch_id=eq.${branchId}` : undefined,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("click", handleGlobalClick);
      supabase.removeChannel(realtimeChannel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [branchId, router]);

  // Info kartını gösterir ve input odağını asla kaybetmez
  const triggerFeedback = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 3500);

    // Timeout veya render sonrası odağın kaybolmasını engellemek için mini gecikmeli focus
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentId = terminalId;

    if (currentId.length !== 5) {
      triggerFeedback("error", "GEÇERSİZ KOD (5 HANELİ OLMALI)");
      setTerminalId("");
      return;
    }

    // KESİNTİSİZ HIZ: İstek başlamadan inputu hemen boşalt ki arkadan okutma devam etsin!
    setTerminalId("");
    setLoading(true);

    try {
      // 🚀 HIZ OPTİMİZASYONU: Double-trip kapatıldı. 
      // Personel var mı? Şube yetkisi doğru mu? Aktif mi? 
      // Bütün kontrolleri processAttendanceScan Server Action'ı yapıp bize result dönecek.
      const result = await processAttendanceScan(
        currentId,
        actionType,
        branchId
      );

      triggerFeedback(result.success ? "success" : "error", result.message || "İŞLEM SONUCU ALINAMADI");

      if (result.success) {
        // Await blokajı yok, arka planda UI yenilensin
        window.dispatchEvent(new CustomEvent("refresh-wms-attendance"));
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      triggerFeedback("error", "SİSTEM HATASI OLUŞTU");
    } finally {
      setLoading(false);
    }
  };

  const isOut = actionType === "OUT";
  const activeColor = isOut ? "#dc3545" : "#3d870c";

  return (
    <div className="bg-white border border-slate-300 w-full max-w-md flex flex-col shadow-2xl rounded-md overflow-hidden select-none">
      {/* Üst Komuta Paneli */}
      <div
        className="bg-[#0F172B] p-5 flex justify-between items-center border-b-4 transition-colors duration-300"
        style={{ borderBottomColor: activeColor }}
      >
        <div className="flex flex-col justify-center">
          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
            MESAİ KOMUTA MERKEZİ
          </span>
          <span className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wide">
            <span
              className={`w-2.5 h-2.5 rounded-sm shadow-sm transition-colors duration-300 ${
                isOut ? "bg-[#dc3545]" : "bg-[#3d870c] animate-pulse"
              }`}
            ></span>
            {branchName}
          </span>
        </div>
      </div>

      <div className="p-6 flex flex-col items-center bg-slate-50">
        {/* Endüstriyel Tarayıcı Görsel Alanı */}
        <div className="w-48 h-48 border-2 border-slate-200 bg-white relative mb-6 flex items-center justify-center shadow-sm rounded-md overflow-hidden group">
          <div className="absolute top-4 left-4 w-8 h-8 border-t-[4px] border-l-[4px] transition-colors duration-500 rounded-tl-[3px] z-10" style={{ borderColor: activeColor }}></div>
          <div className="absolute top-4 right-4 w-8 h-8 border-t-[4px] border-r-[4px] transition-colors duration-500 rounded-tr-[3px] z-10" style={{ borderColor: activeColor }}></div>
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-[4px] border-l-[4px] transition-colors duration-500 rounded-bl-[3px] z-10" style={{ borderColor: activeColor }}></div>
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-[4px] border-r-[4px] transition-colors duration-500 rounded-br-[3px] z-10" style={{ borderColor: activeColor }}></div>

          <div
            className="absolute inset-5 border-2 border-dashed transition-colors duration-500 pointer-events-none z-0"
            style={{ borderColor: `${activeColor}40` }}
          ></div>

          <QrCode
            size={160}
            className="z-10 transition-all duration-300 drop-shadow-md group-hover:scale-105"
            color={activeColor}
            strokeWidth={2}
          />
        </div>

        {/* İşlem Tipi Seçici */}
        <div className="bg-slate-200/80 p-1.5 rounded-md flex w-full mb-6 border border-slate-300 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActionType("IN");
              inputRef.current?.focus();
            }}
            className={`flex-1 py-3.5 text-xs font-black rounded-sm transition-all duration-200 uppercase tracking-widest min-h-[44px] active:scale-[0.98] ${
              !isOut
                ? "bg-[#3d870c] text-white shadow-md ring-1 ring-[#3d870c]/30"
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
            className={`flex-1 py-3.5 text-xs font-black rounded-sm transition-all duration-200 uppercase tracking-widest min-h-[44px] active:scale-[0.98] ${
              isOut
                ? "bg-[#dc3545] text-white shadow-md ring-1 ring-[#dc3545]/30"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-300/50"
            }`}
          >
            MESAİ ÇIKIŞ
          </button>
        </div>

        {/* Barkod Giriş Formu */}
        <div className="w-full flex flex-col gap-2 group">
          <label
            className="text-[11px] font-black text-slate-500 uppercase tracking-wider transition-colors group-focus-within:text-slate-800"
            htmlFor="terminal-input"
          >
            Çalışan ID Veya Barkodu Okutun
          </label>
          <form
            onSubmit={handleSubmit}
            className="relative w-full flex items-center shadow-sm"
          >
            <input
              id="terminal-input"
              ref={inputRef}
              type="password"
              value={terminalId}
              onChange={(e) => {
                setTerminalId(e.target.value.replace(/[^0-9]/g, ""));
              }}
              maxLength={5}
              disabled={false} 
              className={`h-16 w-full bg-white border-2 rounded-md pl-4 pr-16 font-mono text-center text-3xl font-black tracking-[0.3em] outline-none transition-all focus:bg-slate-50 focus:shadow-[0_0_0_4px_rgba(0,0,0,0.04)] ${
                isOut
                  ? "border-slate-300 focus:border-[#dc3545] text-[#dc3545]"
                  : "border-slate-300 focus:border-[#3d870c] text-[#3d870c]"
              }`}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading || terminalId.length !== 5}
              className={`absolute right-2 h-12 w-12 flex items-center justify-center rounded-md transition-all duration-200 active:scale-[0.92] ${
                loading || terminalId.length !== 5
                  ? "opacity-40 cursor-not-allowed grayscale"
                  : "hover:scale-105 shadow-md"
              } ${isOut ? "bg-[#dc3545] text-white" : "bg-[#3d870c] text-white"}`}
            >
              {loading ? (
                <div className="w-5 h-5 border-[3px] border-t-transparent border-white animate-spin rounded-full"></div>
              ) : (
                <Check strokeWidth={3} className="w-6 h-6" />
              )}
            </button>
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