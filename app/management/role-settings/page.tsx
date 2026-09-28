import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server"; // Server tarafı Supabase istemcisi
import RoleSettingsClient from "./_components/RoleSettingsClient"; // İşlemleri yapacağın Client bileşen

export default async function RoleSettingsPage() {
  const supabase = createClient();
  
  // 1. Sunucu tarafında güvenli oturum kontrolü
  const { data: { user }, error: authError } = await (await supabase).auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // 2. Profil ve Yetki Kontrolü
  const { data: profile } = await (await supabase)
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user.id)
    .single();

  // Developer veya Global Admin değilse yetkisiz sayfasına at
  const isGlobal = profile?.role === "Developer" || profile?.branch_id === null;
  if (!isGlobal) {
    redirect("/management/unauthorized");
  }

  // 3. Veriyi Client bileşenine props olarak enjekte et
  return (
    <div className="flex flex-col w-full h-full">
      <RoleSettingsClient userProfile={profile} />
    </div>
  );
}