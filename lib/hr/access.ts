import "server-only";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const FULL_ACCESS_ROLES = new Set(["Developer", "Admin"]);
const VIEW_PERMISSIONS = new Set(["hr_tracking", "hr_reports", "hr_personnel", "hr_leave_management", "hr_logs"]);
const MANAGE_PERMISSIONS = new Set(["hr_personnel"]);

export async function getHRActor(manage = false) {
  const session = await createClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) throw new Error("Oturum bulunamadı.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("İK sunucu bağlantısı yapılandırılmamış.");

  // Service role yalnızca kimliği doğrulanmış ve yetkilendirilmiş sunucu işlemlerinde kullanılır.
  const db = createAdminClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("id, role, branch_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) throw new Error("Kullanıcı profili bulunamadı.");

  const role = String(profile.role || "");
  const isGlobal = FULL_ACCESS_ROLES.has(role);
  const branchId: string | null = profile.branch_id;
  if (!isGlobal && !branchId) throw new Error("İşlem için şube ataması gerekiyor.");

  if (!isGlobal) {
    const { data: assignedRole, error: roleError } = await db
      .from("roles").select("permissions").eq("role_code", role).maybeSingle();
    if (roleError) throw new Error("Rol yetkileri doğrulanamadı.");
    const rawPermissions: unknown = assignedRole?.permissions;
    const permissions = Array.isArray(rawPermissions)
      ? rawPermissions.map(String)
      : typeof rawPermissions === "string"
        ? rawPermissions.replace(/[{}"]/g, "").split(",").map(v => v.trim())
        : [];
    const allowed = manage ? MANAGE_PERMISSIONS : VIEW_PERMISSIONS;
    if (role !== "HR" && !permissions.some(permission => allowed.has(permission))) {
      throw new Error("İnsan kaynakları yönetim yetkiniz bulunmuyor.");
    }
  }

  return { db, userId: user.id, role, branchId, isGlobal, isDeveloper: role === "Developer" };
}

export function assertHRBranch(
  actor: Pick<Awaited<ReturnType<typeof getHRActor>>, "branchId" | "isGlobal">,
  targetBranch: string | null,
) {
  if (!targetBranch) throw new Error("Geçerli bir şube seçmelisiniz.");
  if (!actor.isGlobal && targetBranch !== actor.branchId) {
    throw new Error("Başka bir şubenin personeline işlem yapamazsınız.");
  }
  return targetBranch;
}
