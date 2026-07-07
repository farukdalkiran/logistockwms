"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { KeyRound, ShieldAlert } from "lucide-react";
import CreateWebAccount from "./_components/CreateWebAccount";
import CreateTerminalAccount from "./_components/CreateTerminalAccount";
import AccountsTable from "./_components/AccountsTable";

export default function PasswordAccessPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Tabloyu yenilemek için tetikleyici state

  useEffect(() => {
    // Şubeleri ve Rolleri formlar için sayfa yüklendiğinde bir kez çekiyoruz
    const fetchDropdownData = async () => {
      try {
        const [branchesRes, rolesRes] = await Promise.all([
          supabase.from("branches").select("id, name").order("name"),
          supabase.from("roles").select("id, role_code, role_name").order("role_name")
        ]);

        if (branchesRes.error) throw branchesRes.error;
        if (rolesRes.error) throw rolesRes.error;

        setBranches(branchesRes.data || []);
        setRoles(rolesRes.data || []);
      } catch (error) {
        console.error("Dropdown verileri çekilirken hata:", error);
      }
    };

    fetchDropdownData();
  }, []);

  // Yeni bir hesap/ID oluşturulduğunda AccountsTable'ı tetikleyip verileri yeniletir
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col gap-10 pb-20 font-['Quicksand'] max-w-[1600px] mx-auto">
      
      {/* ==================================================================================== */}
      {/* 0. ENDÜSTRİYEL DARK HEADING (WMS KOMUTA MERKEZİ KONSEPTİ) */}
      {/* ==================================================================================== */}
      <div className="relative w-full flex flex-col justify-center p-6 md:p-8 bg-slate-900 border border-slate-700 rounded-sm shadow-xl overflow-hidden sticky top-0 z-40">
        <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.05)_10px,rgba(255,255,255,0.05)_20px)] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#dc3545]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#dc3545] border border-red-400/30 rounded-sm shadow-[0_0_15px_rgba(220,53,69,0.4)]">
                <KeyRound className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Kullanıcı & Şifre Yönetimi</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium tracking-wide max-w-2xl">
              Web hesaplarını, departman izinlerini ve saha personelinin terminal ID'lerini yönetin. Kritik şifre sıfırlama işlemleri bu alandan yapılır.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-sm shrink-0">
            <ShieldAlert size={18} className="text-[#dc3545]" />
            <span className="text-[10px] font-bold text-red-200 uppercase tracking-widest">Yetkili Erişim</span>
          </div>
        </div>
      </div>

      {/* ==================================================================================== */}
      {/* 1. MODÜL: WEB HESABI OLUŞTURMA */}
      {/* ==================================================================================== */}
      <CreateWebAccount 
        branches={branches} 
        roles={roles} 
        onSuccess={handleRefresh} 
      />

      {/* ==================================================================================== */}
      {/* 2. MODÜL: TERMİNAL ID OLUŞTURMA */}
      {/* ==================================================================================== */}
      <CreateTerminalAccount 
        branches={branches} 
        onSuccess={handleRefresh} 
      />

      {/* ==================================================================================== */}
      {/* 3. MODÜL: VERİ TABLOSU, ŞİFRE SIFIRLAMA VE DÜZENLEME İŞLEMLERİ */}
      {/* ==================================================================================== */}
      <AccountsTable 
        refreshTrigger={refreshTrigger} 
      />

    </div>
  );
}