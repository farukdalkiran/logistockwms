import "server-only";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export type VerifiedActor = { id: string; role: string; branchId: string | null; isGlobal: boolean };

/**
 * Trusted authorization boundary for Server Actions.
 * Never accept a user ID, role, branch, or isGlobal flag from the browser.
 */
export async function requireWmsActor(): Promise<VerifiedActor> {
  const session = await createSessionClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) throw new Error("Oturum doğrulanamadı. Tekrar giriş yapınız.");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) throw new Error("Kullanıcı profili bulunamadı.");

  const isGlobal = profile.role === "Developer" || profile.role === "Admin";
  if (!isGlobal && !profile.branch_id) {
    throw new Error("İşlem için bağlı olduğunuz şube tanımlı değil.");
  }
  return { id: user.id, role: profile.role, branchId: profile.branch_id, isGlobal };
}

export async function requireSystemAdmin(): Promise<VerifiedActor> {
  const actor = await requireWmsActor();
  if (!actor.isGlobal) throw new Error("Bu işlem için yönetici yetkisi gerekli.");
  return actor;
}

export function assertBranchAccess(actor: VerifiedActor, branchId: string | null | undefined) {
  if (!actor.isGlobal && (!branchId || actor.branchId !== branchId)) {
    throw new Error("Bu şubede işlem yapma yetkiniz bulunmuyor.");
  }
}
