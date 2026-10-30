import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeaveDashboard } from "@/lib/hr/leave-management";
import LeaveManagementPanel from "./_components/LeaveManagementPanel";
import Link from "next/link";

export const metadata = {
  title: "İzin Yönetimi ve Personel Bakiyeleri | LogiStock WMS",
};

export default async function LeaveManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; branch?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const year = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : undefined;
  try {
    const data = await getLeaveDashboard(year, params.branch);
    return <LeaveManagementPanel data={data} />;
  } catch (err) {
    return <div className="rounded-[5px] border border-red-200 bg-white p-8">
      <h1 className="text-xl font-bold text-slate-900">İzin yönetimi görüntülenemedi</h1>
      <p className="mt-2 text-sm text-red-700">{err instanceof Error ? err.message : "Erişim veya sorgu hatası."}</p>
      <Link href="/management/hr" className="mt-4 inline-block text-sm font-bold text-[#dc3545]">Mesai merkezine dön</Link>
    </div>;
  }
}
