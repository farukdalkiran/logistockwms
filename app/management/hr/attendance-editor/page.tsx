import { createClient } from "@/lib/supabase/server";
import SmartAttendanceManager from "./_components/SmartAttendanceManager";
import { redirect } from "next/navigation";

export const revalidate = 0;

export default async function AttendanceEditorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, branch_id")
    .eq("id", user.id)
    .single();

  const isGlobal = !profile?.branch_id || profile?.role === 'Developer' || profile?.role === 'Admin';
  
  // 🛡️ YÖNETİCİ KİMLİĞİ (Terminal ID'si olan 39760 atandı)
  const managerMock = {
    id: "39760", 
    full_name: "Faruk Dalkıran", 
    position_title: profile?.role || "SİSTEM MİMARI"
  };

  let query = supabase.from("employees").select("id, full_name, position_title").eq("is_active", true);
  
  if (!isGlobal && profile?.branch_id) {
    query = query.eq("branch_id", profile.branch_id);
  }

  const { data: employees, error } = await query.order("full_name", { ascending: true });

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 font-black uppercase tracking-widest border-2 border-red-600 bg-red-50 m-4">
        VERİTABANI BAĞLANTI HATASI: {error.message}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full min-h-[calc(100vh-4rem)] bg-slate-100 flex items-start justify-center">
      <SmartAttendanceManager 
        managerId={managerMock.id}
        managerName={managerMock.full_name}
        managerTitle={managerMock.position_title}
        employees={employees || []}
      />
    </div>
  );
}