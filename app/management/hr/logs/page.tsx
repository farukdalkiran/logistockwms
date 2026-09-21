import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
// import LogRequestPanel from "./_components/LogRequestPanel";

export const metadata = {
  title: "Personel Mesai Düzeltme | LogiStock WMS",
};

export default async function HrLogsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("branch_id, role")
    .eq("id", user.id)
    .single();

  const isGlobal = profile?.role === "Developer" || profile?.role === "Admin" || profile?.branch_id === null;
  const managerBranchId = profile?.branch_id || "GLOBAL";

  return (
    <div className="w-full min-h-screen bg-slate-50 p-4 lg:p-8 flex flex-col items-center pt-20">
      
      {/* 
        MESAİ LOG DÜZENLEME MODÜLÜ ASKIYA ALINMIŞTIR 
        <LogRequestPanel managerBranchId={managerBranchId} isGlobal={isGlobal} /> 
      */}

      <div className="max-w-2xl w-full bg-white border-l-4 border-[#dc3545] p-6 shadow-sm rounded-r-md">
        <div className="flex items-center gap-3 mb-4 border-b pb-3">
          <svg className="w-7 h-7 text-[#dc3545]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Sistem Uyarısı: Modül Kapatıldı</h2>
        </div>
        
        <div className="text-slate-700 space-y-3 text-sm md:text-base leading-relaxed">
          <p className="font-semibold text-slate-900">
            Mesai log düzenlemeleri askıya alınmıştır.
          </p>
          <p>
            Herhangi bir personel kayıt unutmamalıdır. Her kullanıcının kendi giriş çıkışını manuel düzenlemesi veya yöneticiler tarafından bu logların değiştirilmesi sistem genelinde durdurulmuştur.
          </p>
          <p className="inline-block bg-[#dc3545]/10 text-[#dc3545] font-semibold p-3 rounded-md border border-[#dc3545]/20">
            Her personel, kendi giriş ve çıkışını WMS terminalleri üzerinden anlık olarak takip etmekle yükümlüdür.
          </p>
        </div>
      </div>

    </div>
  );
}