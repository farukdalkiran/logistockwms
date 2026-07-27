import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar"; 
import { Footer } from "@/components/shared/Footer";
import { ManagementGuard } from "@/components/shared/ManagementGuard"; // <- İstemci (Rota) Bekçisi

export default async function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. SUNUCU TARAFLI GÜVENLİK DUVARI (AUTH GUARD)
  // Sadece aktif oturum kontrolü yapıyoruz. Oturumu olmayan direkt şutlanır.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. ORİJİNAL WMS ARAYÜZÜ VE ROTA KALKANI
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />

      <main className="flex-1 p-4 md:p-6">
        <div className="2xl:max-w-[1400px] mx-auto w-full relative z-10">
          {/* 
            3. İSTEMCİ TARAFLI ROTA BEKÇİSİ 
            İçerideki sayfalara güvenlik kodu yazmaya gerek kalmadan,
            kullanıcının girmeye çalıştığı URL'yi burada kontrol edip engelliyoruz.
          */}
          <ManagementGuard>
            {children}
          </ManagementGuard>
        </div>
      </main>

      <Footer />
    </div>
  );
}