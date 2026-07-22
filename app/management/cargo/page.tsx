import ArasTrackingPanel from "./_components/ArasTrackingPanel";
import { supabase } from "@/lib/supabase";

export default async function CargoPage() {
  // Sunucu tarafında oturumu sessizce çözümlüyoruz.
  // Oturum yoksa (Dev ortamı) hata fırlatmasını konsola yansıtmıyoruz.
  const { data } = await supabase.auth.getUser();

  // WMS Mimarisi: Oturum bulunamazsa, sistemin kurucusu olan 
  // Developer (3976) ID'sine fallback yap (Global RLS Bypass).
  const employeeId = data?.user?.user_metadata?.employee_id || "3976";

  return (
    <div className="min-h-screen bg-slate-100 p-6 rounded-2xl">
       <ArasTrackingPanel employeeId={employeeId} />
    </div>
  );
}