"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { Logo } from "@/components/ui/Logo";
import { ScanLine, AlertTriangle, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function TerminalLoginPage() {
  const router = useRouter();
  const { userProfile, isLoading } = useAuth();
  
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Kasa Mantığı: Donanım (Barkod) okuyucular için input'u daima odakta tut
  useEffect(() => {
    inputRef.current?.focus();
    const interval = setInterval(() => {
      if (!isProcessing && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const forceFocus = () => {
    inputRef.current?.focus();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanId = employeeId.trim();
    if (!cleanId || cleanId.length !== 5) {
      setError("HATA: Lütfen 5 haneli Personel ID okutunuz.");
      setEmployeeId("");
      inputRef.current?.focus();
      return;
    }

    if (!userProfile?.branchName) {
      setError("CİHAZ YETKİSİZ: Web oturumu bulunamadı.");
      return;
    }

    setIsProcessing(true);

    try {
      const { data: employee, error: dbError } = await supabase
        .from("employees")
        .select("id, full_name, is_active") // RLS kalkanını aştık, Çapraz Şube esnekliği için branch_id blokajı kaldırıldı.
        .eq("id", cleanId)
        .single();

      if (dbError || !employee) {
        setError("HATA: Personel bulunamadı veya ID hatalı.");
        setEmployeeId("");
        inputRef.current?.focus();
        return;
      }

      if (!employee.is_active) {
        setError("HATA: Bu personelin hesabı pasif durumdadır.");
        setEmployeeId("");
        inputRef.current?.focus();
        return;
      }

      // ÇÖZÜM: Middleware'in istediği parametreler Query String olarak URL'e zırhlanıp enjekte ediliyor.
      const branchName = userProfile?.branchName || "Bilinmeyen Şube";
      const targetUrl = `/terminal/menu?empId=${employee.id}&empName=${encodeURIComponent(employee.full_name)}&branch=${encodeURIComponent(branchName)}`;
      
      router.push(targetUrl);

    } catch (err) {
      console.error(err);
      setError("Sistem Hatası: Bağlantı koptu.");
      setEmployeeId("");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-['Quicksand']">
        <Loader2 size={40} className="animate-spin text-[#dc3545]" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-slate-50 font-['Quicksand'] flex flex-col items-center justify-center p-4 select-none relative overflow-hidden" 
      onClick={forceFocus}
    >
      {/* Endüstriyel Zemin Deseni (Light Mode) */}
      <div className="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,#000,#000_1px,transparent_1px,transparent_20px)] pointer-events-none"></div>

      {/* Üst Kilit Bilgisi (Device Lock) */}
      <div className="absolute top-0 left-0 w-full bg-[#0f172b] p-3 text-center border-b-4 border-[#dc3545] shadow-md flex justify-center items-center gap-2 z-20">
        <ShieldCheck size={16} className="text-emerald-400" />
        <span className="text-white text-[12px] font-black uppercase tracking-widest">
          CİHAZ KİLİTLİ: {userProfile?.isGlobalAdmin ? "MERKEZ / GLOBAL YETKİ" : (userProfile?.branchName || "YETKİ BEKLENİYOR")}
        </span>
      </div>

      {/* MERKEZ KART */}
      <div className="w-full max-w-sm bg-white rounded-sm shadow-xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-500 mt-10 border border-slate-200">
        
        {/* Üst Kırmızı Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#dc3545]"></div>

        <div className="p-8 md:p-10">
          
          {/* Logo ve Başlık */}
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="bg-slate-50 p-4 rounded-2xl shadow-inner border border-slate-100 mb-4">
              <ScanLine size={42} className="text-slate-800" />
            </div>
            <div className="flex justify-center items-end mb-1 gap-2">
              <Logo variant="primary" className="text-3xl" />
              <span className="text-[#0f172b] font-black text-[14px] tracking-tight uppercase opacity-90 mb-[2px]">
                WMS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-black mt-1 tracking-widest uppercase">Operasyon Terminali</p>
          </div>

          {/* Hata Ekranı */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-[#dc3545] px-4 py-3 rounded-sm flex items-start gap-3 text-[11px] font-bold mb-6 animate-in fade-in slide-in-from-top-2 uppercase tracking-wide">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> 
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Giriş Formu */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 text-center">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                Personel ID / Yaka Kartı
              </label>
              
              <div className="relative mt-2">
                <input
                  ref={inputRef}
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={isProcessing || !userProfile}
                  autoComplete="off"
                  className="w-full h-16 bg-slate-50 border-2 border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-2 focus:ring-[#dc3545]/10 outline-none text-[32px] text-center font-black text-slate-900 tracking-[0.3em] transition-all disabled:opacity-50 placeholder:text-slate-300 placeholder:text-[16px] placeholder:tracking-widest placeholder:font-bold shadow-inner"
                  placeholder="ID BEKLENİYOR..."
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isProcessing || !userProfile || employeeId.length === 0} 
              className="w-full h-14 mt-2 text-[13px] font-black tracking-widest bg-[#dc3545] hover:bg-red-700 rounded-sm shadow-md flex items-center justify-center gap-2 transition-all uppercase"
            >
              {isProcessing ? (
                <span className="animate-pulse flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Yükleniyor...</span>
              ) : (
                <>Terminali Aç <ArrowRight size={18} /></>
              )}
            </Button>
          </form>

        </div>
      </div>

      {/* Footer Text */}
      <div className="absolute bottom-6 w-full text-center pointer-events-none z-10">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-80">
          LogiStock WMS • Depo Yönetim Sistemi
        </span>
      </div>

    </div>
  );
}