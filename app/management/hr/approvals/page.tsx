import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ApprovalPanel from "./_components/ApprovalPanel";

export const metadata = {
  title: "Onay Merkezi | LogiStock WMS",
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
    <div className="w-full min-h-screen bg-slate-50 p-4 lg:p-8">
      <ApprovalPanel managerBranchId={managerBranchId} isGlobal={isGlobal} />
    </div>
  );
}