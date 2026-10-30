import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MultinetPanel from "./_components/MultinetPanel";

export const metadata = { title: "Multinet Yönetimi | LogiStock WMS" };

export default async function MultinetPage() {
  const supabase = await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError || !user) redirect("/login");
  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("branch_id,role").eq("id",user.id).single();
  if(profileError || !profile) redirect("/login");

  const isGlobal=profile.role==="Developer" || profile.role==="Admin";
  const {data:depots,error:depotsError}=await supabase.from("branches")
    .select("id,name,type").eq("type","Depo").order("name");
  if(depotsError) throw new Error("Depo listesi alınamadı.");

  const availableBranches=(depots||[])
    .filter(b=>isGlobal || b.id===profile.branch_id)
    .map(b=>({id:b.id,name:b.name}));
  const initialBranch=availableBranches.find(b=>b.id===profile.branch_id)?.id
    || (isGlobal ? availableBranches[0]?.id : undefined);

  if(!initialBranch) {
    return (
      <main className="p-6 bg-slate-50 min-h-full">
        <div className="bg-white border border-red-200 rounded-[5px] p-6 text-slate-800">
          <h1 className="font-bold text-lg">Multinet erişimi bulunamadı</h1>
          <p className="text-sm mt-2">Hesabınıza bağlı bir depo bulunmuyor. Yalnızca yetkili olduğunuz deponun personel verileri görüntülenebilir.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full w-full bg-slate-50">
      <MultinetPanel
        initialBranchId={initialBranch}
        branches={availableBranches}
        canChooseBranch={isGlobal}
      />
    </main>
  );
}
