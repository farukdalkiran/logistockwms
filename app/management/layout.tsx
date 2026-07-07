import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar"; 
import { Footer } from "@/components/shared/Footer";

export default async function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. GÜVENLİK DUVARI (AUTH GUARD): Sadece oturum kontrolü yapıyoruz.
  // Not: Profil ve şube verilerini artık root (app/layout.tsx) hallediyor.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Oturumu olmayan biri URL'den /management yazarak girmeye çalışırsa şutla
  if (!user) {
    redirect("/login");
  }

  // 2. ORİJİNAL WMS ARAYÜZÜ (Senin Kurgun)
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />

      <main className="flex-1 p-4 md:p-6">
        <div className="2xl:max-w-[1400px] mx-auto w-full">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}