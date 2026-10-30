"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

const CATEGORIES = ["GENERAL", "TECHNICAL", "ORDERS", "STOCK", "ATTENDANCE", "TRANSFER", "CARGO"] as const;
const STATES = ["OPEN", "IN_PROGRESS", "COMPLETED"] as const;

export type SupportCategory = (typeof CATEGORIES)[number];
export type SupportStatus = (typeof STATES)[number];
export type SupportTicket = {
  id: string;
  created_by: string;
  requester_name: string;
  branch_id: string | null;
  category: SupportCategory;
  subject: string;
  description: string;
  status: SupportStatus;
  developer_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};
export type WmsAnnouncement = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  target_branch_id: string | null;
  target_branch_ids?: string[] | null;
  expires_at?: string | null;
  deleted_at?: string | null;
  revision?: number;
  is_active: boolean;
  published_at: string;
  created_at: string;
};
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Caller identity always comes from a verified Supabase JWT, never a browser ID.
// For privileged writes, the profile role is independently read on the server.
async function actor() {
  const session = await createSessionClient();
  const { data, error } = await session.auth.getClaims();
  if (error || !data?.claims?.sub) throw new Error("Oturum açmanız gerekiyor.");
  const id = data.claims.sub;
  const db = adminDb();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,role,branch_id,full_name")
    .eq("id", id).single();
  if (profileError || !profile) throw new Error("Kullanıcı profili bulunamadı.");
  return {
    db, id,
    role: String(profile.role || ""),
    isDeveloper: profile.role === "Developer",
    branchId: profile.branch_id as string | null,
    name: String(profile.full_name || "WMS Kullanıcısı"),
  };
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "İşlem gerçekleştirilemedi.";
}

export async function getNoticeCenterSnapshot(): Promise<Result<{
  developer: boolean;
  announcements: WmsAnnouncement[];
  branches: { id: string; name: string }[];
  unreadIds: string[];
  openTicketCount: number;
}>> {
  try {
    const ctx = await actor();
    const now = new Date().toISOString();
    let query = ctx.db.from("wms_announcements")
      .select("id,title,body,image_url,target_branch_id,target_branch_ids,expires_at,deleted_at,revision,is_active,published_at,created_at")
      .order("published_at", { ascending: false }).limit(100);
    if (!ctx.isDeveloper) {
      query = query.eq("is_active", true).lte("published_at", now).is("deleted_at", null);
    }
    const { data: announcements, error } = await query;
    if (error) throw new Error("Duyurular yüklenemedi.");
    const branchesResult = ctx.isDeveloper
      ? await ctx.db.from("branches").select("id,name").order("name")
      : { data: [] as { id: string; name: string }[], error: null };
    if (branchesResult.error) throw new Error("Şubeler alınamadı.");
    const isTargeted = (a: WmsAnnouncement) => a.target_branch_ids
      ? Boolean(ctx.branchId && a.target_branch_ids.includes(ctx.branchId))
      : (!a.target_branch_id || a.target_branch_id === ctx.branchId);
    const visible = ((announcements ?? []) as WmsAnnouncement[]).filter(a =>
      ctx.isDeveloper || (
        !a.deleted_at && a.is_active && Date.parse(a.published_at) <= Date.now() &&
        (!a.expires_at || Date.parse(a.expires_at) > Date.now()) && isTargeted(a)
      )
    );
    const current = visible.filter(a =>
      !a.deleted_at && a.is_active && Date.parse(a.published_at) <= Date.now() &&
      (!a.expires_at || Date.parse(a.expires_at) > Date.now()) && isTargeted(a)
    );
    const ids = current.map(a => a.id);
    const [readResult, ticketsResult] = await Promise.all([
      ids.length
        ? ctx.db.from("wms_announcement_reads")
          .select("announcement_id,revision").eq("user_id", ctx.id).in("announcement_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ctx.isDeveloper
        ? ctx.db.from("wms_support_tickets").select("id", { count: "exact", head: true })
          .neq("status", "COMPLETED").is("archived_at", null)
        : Promise.resolve({ count: 0, error: null }),
    ]);
    if (readResult.error || ticketsResult.error) throw new Error("Bildirim sayacı yüklenemedi.");
    const versions = new Map((readResult.data ?? []).map(r => [r.announcement_id, r.revision]));
    // Personel için yalnızca okunmamış destek yanıtlarının sayısı. Genel yenileme sıklığı değişmez.
    let supportIndicator = ticketsResult.count ?? 0;
    if (!ctx.isDeveloper) {
      const ownTickets = await ctx.db.from("wms_support_tickets")
        .select("id,last_message_at").eq("created_by", ctx.id).is("archived_at", null)
        .not("last_message_at", "is", "null").limit(100);
      if (ownTickets.error) throw ownTickets.error;
      const ids = (ownTickets.data || []).map(t => t.id);
      if (ids.length) {
        const views = await ctx.db.from("wms_support_ticket_views")
          .select("ticket_id,last_read_at").eq("user_id", ctx.id).in("ticket_id", ids);
        if (views.error) throw views.error;
        const lastRead = new Map((views.data || []).map(v => [v.ticket_id, v.last_read_at]));
        supportIndicator = (ownTickets.data || []).filter(t =>
          t.last_message_at && (!lastRead.get(t.id) ||
          Date.parse(t.last_message_at) > Date.parse(lastRead.get(t.id)!))
        ).length;
      }
    }
    return {
      ok: true,
      data: {
        developer: ctx.isDeveloper,
        announcements: visible,
        branches: (branchesResult.data ?? []) as { id: string; name: string }[],
        unreadIds: current.filter(a => versions.get(a.id) !== (a.revision ?? 1)).map(a => a.id),
        openTicketCount: supportIndicator,
      },
    };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function acknowledgeWmsAnnouncement(id: string): Promise<Result<true>> {
  try {
    if (!isUuid(id)) throw new Error("Geçersiz duyuru.");
    const ctx = await actor();
    const { data, error } = await ctx.db.from("wms_announcements")
      .select("revision,deleted_at,is_active,published_at,expires_at,target_branch_id,target_branch_ids")
      .eq("id", id).maybeSingle();
    if (error || !data || data.deleted_at || !data.is_active ||
      Date.parse(data.published_at) > Date.now() ||
      (data.expires_at && Date.parse(data.expires_at) <= Date.now())) {
      throw new Error("Duyuru yayında değil.");
    }
    const allowed = data.target_branch_ids
      ? Boolean(ctx.branchId && data.target_branch_ids.includes(ctx.branchId))
      : (!data.target_branch_id || ctx.branchId === data.target_branch_id);
    if (!allowed) throw new Error("Bu duyuru şubenize ait değil.");
    const { error: saveError } = await ctx.db.from("wms_announcement_reads")
      .upsert({ announcement_id: id, user_id: ctx.id, revision: data.revision, read_at: new Date().toISOString() },
        { onConflict: "announcement_id,user_id" });
    if (saveError) throw new Error("Okundu bilgisi kaydedilemedi.");
    return { ok: true, data: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function getSupportTickets(): Promise<Result<SupportTicket[]>> {
  try {
    const ctx = await actor();
    let query = ctx.db.from("wms_support_tickets")
      .select("id,created_by,requester_name,branch_id,category,subject,description,status,developer_note,resolved_at,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(100);
    if (!ctx.isDeveloper) query = query.eq("created_by", ctx.id);
    const { data, error } = await query;
    if (error) throw new Error("Destek talepleri alınamadı.");
    return { ok: true, data: (data ?? []) as SupportTicket[] };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function submitSupportTicket(input: {
  category: SupportCategory;
  subject: string;
  description: string;
}): Promise<Result<SupportTicket>> {
  try {
    const ctx = await actor();
    const category = String(input.category || "") as SupportCategory;
    const subject = String(input.subject || "").trim();
    const description = String(input.description || "").trim();
    if (!CATEGORIES.includes(category)) throw new Error("Destek konusu geçersiz.");
    if (subject.length < 5 || subject.length > 140) throw new Error("Başlık 5–140 karakter olmalı.");
    if (description.length < 10 || description.length > 5000) throw new Error("Açıklama 10–5000 karakter olmalı.");
    const { data, error } = await ctx.db.from("wms_support_tickets")
      .insert({
        created_by: ctx.id, requester_name: ctx.name, branch_id: ctx.branchId,
        category, subject, description, status: "OPEN",
      })
      .select("id,created_by,requester_name,branch_id,category,subject,description,status,developer_note,resolved_at,created_at,updated_at")
      .single();
    if (error || !data) throw new Error("Destek talebi kaydedilemedi.");
    return { ok: true, data: data as SupportTicket };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function setSupportTicketStatus(
  id: string, status: SupportStatus, developerNote: string,
): Promise<Result<true>> {
  try {
    if (!isUuid(id) || !STATES.includes(status)) throw new Error("Talep veya durum geçersiz.");
    const ctx = await actor();
    if (!ctx.isDeveloper) throw new Error("Bu işlem yalnızca Developer hesabına açıktır.");
    const note = developerNote.trim();
    if (note.length > 3000) throw new Error("Not en fazla 3000 karakter olabilir.");
    const { data, error } = await ctx.db.from("wms_support_tickets")
      .update({
        status,
        developer_note: note || null,
        updated_at: new Date().toISOString(),
        resolved_at: status === "COMPLETED" ? new Date().toISOString() : null,
        resolved_by: status === "COMPLETED" ? ctx.id : null,
      }).eq("id", id).select("id").maybeSingle();
    if (error || !data) throw new Error("Talep durumu değiştirilemedi.");
    return { ok: true, data: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

function fileLooksValid(file: File, bytes: Uint8Array) {
  if (file.type === "image/png") {
    return bytes.length > 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  }
  if (file.type === "image/jpeg") {
    return bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (file.type === "image/webp") {
    return bytes.length > 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function publishWmsAnnouncement(formData: FormData): Promise<Result<WmsAnnouncement>> {
  let uploadedPath: string | null = null;
  try {
    const ctx = await actor();
    if (!ctx.isDeveloper) throw new Error("Duyuru yayınlama yetkiniz yok.");
    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    const requestedBranch = String(formData.get("target_branch_id") || "").trim();
    let targetBranchId: string | null = null;
    if (requestedBranch) {
      if (!isUuid(requestedBranch)) throw new Error("Geçersiz şube.");
      const { data: branch } = await ctx.db.from("branches").select("id").eq("id", requestedBranch).maybeSingle();
      if (!branch) throw new Error("Hedef şube bulunamadı.");
      targetBranchId = branch.id;
    }
    if (title.length < 5 || title.length > 150) throw new Error("Duyuru başlığı 5–150 karakter olmalı.");
    if (body.length < 5 || body.length > 6000) throw new Error("Duyuru metni 5–6000 karakter olmalı.");

    let imageUrl: string | null = null;
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      if (image.size > 3 * 1024 * 1024) throw new Error("Görsel en fazla 3 MB olabilir.");
      const bytes = new Uint8Array(await image.arrayBuffer());
      if (!fileLooksValid(image, bytes)) throw new Error("Yalnızca JPEG, PNG veya WEBP görsel yükleyin.");
      const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
      uploadedPath = `${randomUUID()}.${extension}`;
      const { error: uploadError } = await ctx.db.storage.from("wms-announcements")
        .upload(uploadedPath, bytes, { upsert: false, contentType: image.type, cacheControl: "3600" });
      if (uploadError) throw new Error("Duyuru görseli yüklenemedi.");
      imageUrl = ctx.db.storage.from("wms-announcements").getPublicUrl(uploadedPath).data.publicUrl;
    }
    const { data, error } = await ctx.db.from("wms_announcements")
      .insert({ title, body, image_url: imageUrl, target_branch_id: targetBranchId, created_by: ctx.id, published_at: new Date().toISOString() })
      .select("id,title,body,image_url,target_branch_id,is_active,published_at,created_at")
      .single();
    if (error || !data) throw new Error("Duyuru kaydedilemedi.");
    return { ok: true, data: data as WmsAnnouncement };
  } catch (error) {
    if (uploadedPath) {
      try { await adminDb().storage.from("wms-announcements").remove([uploadedPath]); } catch {}
    }
    return { ok: false, error: message(error) };
  }
}

export async function setWmsAnnouncementActive(id: string, active: boolean): Promise<Result<true>> {
  try {
    if (!isUuid(id)) throw new Error("Duyuru kimliği geçersiz.");
    const ctx = await actor();
    if (!ctx.isDeveloper) throw new Error("Bu işlem yalnızca Developer hesabına açıktır.");
    const { data, error } = await ctx.db.from("wms_announcements")
      .update({ is_active: active }).eq("id", id).select("id").maybeSingle();
    if (error || !data) throw new Error("Duyuru durumu değiştirilemedi.");
    return { ok: true, data: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}
