import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import DeviceManagerPanel from "./_components/DeviceManagerPanel";

export const metadata = {
  title: "Cihaz Erişim Yönetimi | LogiStock WMS",
  description: "Mobil Terminal Eşleşme Kontrolleri",
};

export default async function DevicesPage() {
  // NEXT.JS GÜNCELLEMESİ: cookies() artık asenkron, await kullanmak zorunlu.
  const cookieStore = await cookies();

  // SUPABASE SSR GÜNCELLEMESİ: get/set/remove yerine getAll ve setAll kullanıyoruz.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Sunucu bileşenlerinde (Server Components) set işlemi bazen uyarı verebilir, sessizce yutulmalı.
          }
        },
      },
    }
  );

  // 1. Güvenli Şekilde Kullanıcı Oturumunu Çek (Network call yapmadan çerezden okur)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    redirect("/login");
  }

  const userId = session.user.id;

  // 2. Yöneticinin Profil ve Şube Bilgilerini Al
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", userId)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // 3. RLS Yetki Kalkanı Kararı: Sadece Developer ve Admin'ler tüm sistemi görebilir.
  const isGlobal = profile.role === "Developer" || profile.role === "Admin" || !profile.branch_id;

  return (
    <main className="p-4 md:p-8 bg-slate-100 min-h-[calc(100vh-64px)] w-full overflow-hidden">
      <DeviceManagerPanel 
        managerId={userId} 
        managerBranchId={profile.branch_id} 
        isGlobal={isGlobal} 
      />
    </main>
  );
}