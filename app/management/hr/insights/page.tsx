import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getHRIntelligenceData } from "@/lib/hr/insights";
import HRIntelligencePanel from "./_components/HRIntelligencePanel";

export const metadata = { title: "İK Analiz ve Personel 360 | LogiStock WMS" };

export default async function HRInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; branch?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  try {
    const data = await getHRIntelligenceData(params.month, params.branch);
    return <HRIntelligencePanel initial={data} />;
  } catch (error) {
    return (
      <main className="space-y-5">
        <div className="rounded-[5px] border border-red-200 bg-white p-8">
          <h1 className="text-xl font-bold text-slate-900">İnsan kaynakları verileri açılamadı</h1>
          <p className="mt-3 text-sm text-red-700">{error instanceof Error ? error.message : "Yetki veya veri sorgusu hatası."}</p>
          <Link href="/management/hr" className="mt-5 inline-block text-sm font-bold text-[#dc3545]">Mesai merkezine dön</Link>
        </div>
      </main>
    );
  }
}
