
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import InventoryViewPanel from "./_components/InventoryViewPanel";

export const metadata = {
  title: "Canlı Stok Görüntüleme | LogiStock WMS",
};

export default async function InventoryViewPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Component: salt okunur
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const isGlobal =
    profile.role === "Developer" ||
    profile.role === "Admin";

  const branchId: string | null = profile.branch_id ?? null;

  if (!isGlobal && !branchId) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[1500px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          Hesabınıza bağlı bir şube bulunamadı.
          Stok görüntülemek için yöneticinizle iletişime geçin.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f8] px-3 py-5 md:px-6 md:py-7">
      <div className="mx-auto w-full max-w-[1550px]">
        <InventoryViewPanel
          branchId={branchId}
          isGlobal={isGlobal}
        />
      </div>
    </main>
  );
}
