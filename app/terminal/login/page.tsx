"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { AlertCircle, Loader2, MapPin, ScanFace, ArrowRight } from "lucide-react";

export default function TerminalLoginPage() {
  const router = useRouter();
  
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  
  const [deviceBranch, setDeviceBranch] = useState<{ id: string; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Cihazın bağlı olduğu yönetici oturumunu ve şubesini kontrol et
  useEffect(() => {
    const checkDeviceAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setError("CİHAZ YETKİSİZ: Lütfen önce Web Yöneticisi girişi yapın.");
          setAuthChecking(false);
          return;
        }

        // Yöneticinin profilinden şubesini bul
        const { data: profile } = await supabase
          .from("profiles")
          .select("branch_id, role, branches(name)")
          .eq("id", session.user.id)
          .single();

        if (profile?.branch_id) {
          setDeviceBranch({ 
            id: profile.branch_id, 
            name: (profile.branches as any)?.name || "Bilinmeyen Şube" 
          });
        } else if (profile?.role === "Developer" || profile?.role === "Admin") {
          setDeviceBranch({ id: "GLOBAL", name: "Merkez / Global Yetki" });
        } else {
          setError("Şube yetkisi bulunamadı.");
        }
      } catch (err) {
        setError("Oturum kontrolünde hata oluştu.");
      } finally {
        setAuthChecking(false);
      }
    };

    checkDeviceAuth();
  }, []);

  // 2. Kasa Mantığı: Barkod okuyucu için input'u her zaman odakta (focus) tut
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = employeeId.trim();

    if (cleanId.length !== 5) {
      setError("Lütfen 5 haneli Personel ID okutunuz.");
      setEmployeeId("");
      return;
    }

    if (!deviceBranch) return;

    setLoading(true);
    setError("");
    
    try {
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("id, full_name, branch_id, is_active")
        .eq("id", cleanId)
        .single();

      if (empError || !employee) {
        setError("Hatalı Personel ID girdiniz.");
        setEmployeeId("");
      } else if (!employee.is_active) {
        setError("Bu personel hesabı pasif durumdadır.");
        setEmployeeId("");
      } else if (deviceBranch.id !== "GLOBAL" && employee.branch_id !== deviceBranch.id) {
        setError(`Erişim Engellendi: Bu şubeye (${deviceBranch.name}) kayıtlı değilsiniz!`);
        setEmployeeId("");
      } else {
        // 1. ADIM: Başarılı Giriş -> LocalStorage'a yaz (Geriye dönük uyumluluk ve Menü sayfasının çökmemesi için)
        localStorage.setItem("terminal_employee_id", employee.id);
        localStorage.setItem("terminal_employee_name", employee.full_name);
        
        // 2. ADIM (ÇÖZÜM): Middleware kalkanını aşmak için Query Parametrelerini URL'ye zorunlu enjekte ediyoruz.
        const empName = encodeURIComponent(employee.full_name);
        const branchName = encodeURIComponent(deviceBranch.name);
        const targetUrl = `/terminal/menu?empId=${employee.id}&empName=${empName}&branch=${branchName}`;
        
        router.push(targetUrl);
      }
    } catch (err) {
      setError("Bağlantı hatası oluştu.");
      setEmployeeId("");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Oturum kontrolü ekranı
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#dc3545]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-['Quicksand'] relative overflow-hidden select-none">
      
      {/* Endüstriyel Arka Plan Deseni (Web ile Birebir Aynı) */}
      <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,#fff,#fff_1px,transparent_1px,transparent_20px)] pointer-events-none"></div>
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#dc3545]/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* MERKEZ KART */}
      <div className="w-full max-w-sm bg-white rounded-sm shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        
        {/* Üst Kırmızı Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#dc3545]"></div>

        <div className="p-8 md:p-10">
          
          {/* Logo ve Başlık */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-2 gap-2">
              <Logo variant="primary" className="text-4xl" />
              <span className="text-[#0f172b] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </div>
            <p className="text-xs text-slate-400 font-extrabold mt-2 tracking-widest uppercase">Operasyon Terminali</p>
            
            {/* Şube Bilgisi Rozeti */}
            <div className="mt-4 inline-flex items-center gap-1.5 bg-red-50 border border-red-100 text-[#dc3545] px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider shadow-sm">
              <MapPin size={14} />
              {deviceBranch?.name || "YETKİSİZ CİHAZ"}
            </div>
          </div>

          {/* Hata Mesajı */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-[#dc3545] px-4 py-3 rounded-sm flex items-start gap-3 text-xs font-bold mb-6 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> 
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Giriş Formu */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5 text-center">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Personel ID'nizi Okutun
              </label>
              
              <div className="relative mt-2">
                <ScanFace className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                <input
                  ref={inputRef}
                  type="password"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={loading || !deviceBranch}
                  autoComplete="off"
                  className="w-full h-16 pl-14 pr-4 bg-slate-50 border-2 border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-2 focus:ring-[#dc3545]/20 outline-none text-3xl text-center font-mono font-black text-slate-800 tracking-[0.3em] transition-all disabled:opacity-50"
                  placeholder="•••••"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading || !deviceBranch || employeeId.length === 0} 
              className="w-full h-14 mt-2 text-sm font-black tracking-wide bg-[#dc3545] hover:bg-red-700 rounded-sm shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <span className="animate-pulse">Bağlanıyor...</span>
              ) : (
                <>Terminali Başlat <ArrowRight size={18} /></>
              )}
            </Button>
          </form>

        </div>
      </div>

      {/* Footer Text */}
      <div className="absolute bottom-6 w-full text-center pointer-events-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">LogiStock WMS • Depo Yönetim Sistemi</span>
      </div>

    </div>
  );
}