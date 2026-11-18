"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Terminal login kontrolü mevcut oturumun süresinde de geçerli olmalı.
 * URL parametresi veya yerel depolama tek başına bir aktiflik kanıtı değildir.
 */
export default function TerminalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/terminal/login";
  const [validatedPath, setValidatedPath] = useState<string | null>(null);

  useEffect(() => {
    if (isLogin) return;

    let disposed = false;
    const deny = () => {
      if (disposed) return;
      localStorage.removeItem("terminal_employee_id");
      localStorage.removeItem("terminal_employee_name");
      setValidatedPath(null);
      router.replace("/terminal/login?blocked=1");
    };

    const validate = async () => {
      if (disposed) return;
      const storedId = localStorage.getItem("terminal_employee_id");
      const urlId = new URLSearchParams(window.location.search).get("empId");

      // Önceki bir terminalden kopyalanan bağlantı farklı personel adına açılamaz.
      if (!storedId || (urlId && storedId !== urlId)) {
        deny();
        return;
      }

      const { data, error } = await supabase
        .from("employees")
        .select("id, is_active")
        .eq("id", storedId)
        .maybeSingle();

      if (disposed) return;
      if (error || !data || data.is_active !== true) {
        deny();
        return;
      }
      setValidatedPath(pathname);
    };

    const checkIfVisible = () => {
      if (document.visibilityState === "visible") void validate();
    };

    void validate();
    // Halihazırda açık terminal ekranında pasif yapılma durumunu da yakala.
    const interval = window.setInterval(checkIfVisible, 60 * 1000);
    document.addEventListener("visibilitychange", checkIfVisible);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkIfVisible);
    };
  }, [pathname, router, isLogin]);

  if (!isLogin && validatedPath !== pathname) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-5 text-center text-sm font-semibold text-slate-200">
        Terminal personel yetkisi doğrulanıyor…
      </div>
    );
  }

  return <>{children}</>;
}
