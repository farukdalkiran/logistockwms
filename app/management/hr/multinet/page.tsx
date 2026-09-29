import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MultinetPanel from "./_components/MultinetPanel";

export const metadata = {
  title: "Multinet Yönetimi | LogiStock WMS",
};

export default async function MultinetPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("branch_id, role")
    .eq("id", session.user.id)
    .single();

  if (!profile) redirect("/login");

  // Global yetki kontrolü
  const isGlobal = profile.role === "Developer" || profile.role === "Admin" || !profile.branch_id;
  const activeBranchId = isGlobal ? null : profile.branch_id;

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50">
      <MultinetPanel branchId={activeBranchId} isGlobal={isGlobal} />
    </div>
  );
}