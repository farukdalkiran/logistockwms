"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { ServerCrash, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

// ====================================================================================
// ROTA - YETKİ HARİTASI
// ====================================================================================
const ROUTE_PERMISSIONS = [
  { path: "/management/products", module: "products_catalog", exact: true },
  { path: "/management/inventory/view", module: "inventory_view", exact: false },
  { path: "/management/shelves", module: "shelves", exact: false },
  { path: "/management/inventory/boxes", module: "inventory_boxes", exact: false },
  { path: "/management/hr/approvals", module: "hr_approvals", exact: false },
  { path: "/management/hr/leaves", module: "hr_leaves", exact: false },
  { path: "/management/hr/personnel", module: "hr_personnel", exact: false },
  { path: "/management/hr/logs", module: "hr_logs", exact: false },
  { path: "/management/hr/reports", module: "hr_reports", exact: false },
  { path: "/management/hr/leave-management", module: "hr_leave_management", exact: false },
  { path: "/management/hr", module: "hr_tracking", exact: true },
  { path: "/management/cargo", module: "cargo", exact: false },
  { path: "/management/role-settings", module: "role_settings", exact: false },
  { path: "/management/password-settings", module: "password_settings", exact: false },
  { path: "/management/settings", module: "system_settings", exact: false },
];

export const ManagementGuard = ({ children }: { children: React.ReactNode }) => {
  const { userProfile, isLoading: isAuthLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  
  const [accessState, setAccessState] = useState<"VERIFYING" | "DENIED" | "GRANTED">("VERIFYING");
  const [blockedModule, setBlockedModule] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!userProfile) {
      router.replace("/login");
      return;
    }

    const verifyAccess = async () => {
      const requiredRoute = ROUTE_PERMISSIONS.find((route) => 
        route.exact ? pathname === route.path : pathname.startsWith(route.path)
      );

      if (!requiredRoute) {
        setAccessState("GRANTED");
        return;
      }

      // Mutlak Otorite (Developer) her zaman geçer
      if (userProfile.role === "Developer" || userProfile.role === "Admin" || userProfile.isGlobalAdmin) {
        setAccessState("GRANTED");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("roles")
          .select("permissions")
          .eq("role_code", userProfile.role)
          .single();

        if (error || !data) throw new Error("Yetki Bulunamadı");

        let perms = data.permissions;
        if (typeof perms === "string") {
          perms = perms.replace(/^{|}$/g, "").split(",").map((s: string) => s.trim().replace(/(^"|"$)/g, "")).filter(Boolean);
        }
        if (!Array.isArray(perms)) perms = [];

        // Yetki Kontrolü
        if (!perms.includes(requiredRoute.module)) {
          setBlockedModule(requiredRoute.module);
          setAccessState("DENIED");
        } else {
          setAccessState("GRANTED");
        }
      } catch (err) {
        setBlockedModule("BİLİNMEYEN MODÜL");
        setAccessState("DENIED");
      }
    };

    setAccessState("VERIFYING"); // Artık güvenli çünkü aşağıda {children}'ı yok etmiyoruz.
    verifyAccess();
  }, [userProfile, isAuthLoading, pathname, router]);

  return (
    <div className="relative w-full h-full min-h-screen">
      
      {/* DURUM 1: DOĞRULANIYOR (OVERLAY) */}
      {accessState === "VERIFYING" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm min-h-[60vh] w-full font-['Quicksand']">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#dc3545] rounded-full animate-spin"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
              Güvenlik Kalkanı Doğrulanıyor...
            </span>
          </div>
        </div>
      )}

      {/* DURUM 2: REDDEDİLDİ (OVERLAY) */}
      {accessState === "DENIED" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white min-h-[75vh] w-full font-['Quicksand'] overflow-hidden">
          {/* Endüstriyel Arka Plan Deseni */}
          <div className="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,#000,#000_1px,transparent_1px,transparent_10px)] pointer-events-none"></div>
          
          <div className="bg-white p-8 md:p-10 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center max-w-lg w-full relative z-10 flex flex-col items-center rounded-sm">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#dc3545]"></div>

            <div className="absolute top-4 left-4 flex items-center gap-1.5 opacity-60">
              <ServerCrash size={14} className="text-slate-500" />
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                ERR_403_FORBIDDEN
              </span>
            </div>

            <div className="w-full flex justify-center mt-6 mb-6">
              <img 
                src="https://img.magnific.com/free-vector/infodemic-concept_23-2148735686.jpg?semt=ais_hybrid&w=740&q=80" 
                alt="Erişim Reddedildi" 
                className="w-56 md:w-64 h-auto object-contain pointer-events-none mix-blend-multiply"
              />
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 tracking-tight uppercase">
              Erişim Reddedildi
            </h1>
            
            <p className="text-slate-500 text-sm mb-8 leading-relaxed font-semibold">
              Sahip olduğunuz sistem rolü <strong className="text-slate-700">bu modülü ({blockedModule}) görüntülemek</strong> veya işlem yapmak için gerekli güvenlik izinlerine sahip değil.
            </p>

            <div className="w-full bg-slate-50/80 backdrop-blur-sm border border-slate-200 py-5 px-4 mb-8 flex flex-col items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-md hover:border-slate-300 rounded-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Yetki Yükseltme Talebi İçin
              </span>
              <a 
                href="mailto:faruk.dalkiran@peeraj.com.tr" 
                className="group flex items-center justify-center gap-3 w-full max-w-full overflow-hidden cursor-pointer"
              >
                <div className="p-2 bg-red-50 group-hover:bg-[#dc3545] text-[#dc3545] group-hover:text-white rounded-full shrink-0 transition-all duration-300 shadow-sm">
                  <Mail size={16} />
                </div>
                <span className="text-[15px] font-bold text-slate-700 group-hover:text-[#dc3545] transition-colors truncate">
                  faruk.dalkiran@peeraj.com.tr
                </span>
              </a>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center w-full">
              <Button 
                onClick={() => router.push("/")} 
                className="bg-[#dc3545] hover:bg-red-700 text-white font-bold px-6 h-11 w-full sm:w-auto shadow-[0_4px_14px_rgba(220,53,69,0.25)] transition-all rounded-sm"
              >
                Anasayfaya Git
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* KRİTİK NOKTA: {children} ASLA DOM'DAN SİLİNMEZ. 
          Eğer yetki yoksa bileşenler CSS ile gizlenir, böylece Next.js segment router'ı çökmez. */}
      <div className={accessState === "GRANTED" ? "block" : "hidden pointer-events-none"}>
        {children}
      </div>

    </div>
  );
};