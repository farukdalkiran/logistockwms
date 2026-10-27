import { createClient } from "@/lib/supabase/server";
import SmartAttendanceManager from "./_components/SmartAttendanceManager";
import { redirect } from "next/navigation";

export const revalidate = 0;

export default async function AttendanceEditorPage() {
  const supabase = await createClient();
  // Local JWT verification avoids a separate /auth/v1/user network request
  // on every visit to the editor.
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, branch_id")
    .eq("id", claims.claims.sub)
    .single();
  if (!profile) redirect("/management");

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
    <div className="w-full min-h-[calc(100vh-4rem)] bg-slate-50 p-0 sm:p-2 flex items-start justify-center">
      <SmartAttendanceManager 
        managerId={managerMock.id}
        managerName={managerMock.full_name}
        managerTitle={managerMock.position_title}
        employees={employees || []}
      />
    </div>
  );
}