"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED";
export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "URGENT";
export type Ticket = {
  id: string; created_by: string; requester_name: string; branch_id: string | null;
  category: string; subject: string; description: string; status: TicketStatus;
  priority: TicketPriority; assigned_to: string | null; archived_at: string | null;
  developer_note: string | null; resolved_at: string | null; first_response_at: string | null;
  last_message_at: string | null; created_at: string; updated_at: string;
};
export type TicketMessage = {
  id: string; ticket_id: string; sender_id: string; sender_name: string;
  body: string; is_internal: boolean; created_at: string;
};
export type Announcement = {
  id: string; title: string; body: string; image_url: string | null;
  created_by: string | null; is_active: boolean; target_branch_id: string | null;
  target_branch_ids: string[] | null; priority: AnnouncementPriority; revision: number;
  published_at: string; created_at: string; updated_at: string; expires_at: string | null;
  deleted_at: string | null;
};
export type Contact = { id: string; name: string; branch_id: string | null; role: string };
export type Branch = { id: string; name: string };
export type ReadPerson = { id: string; name: string; branch: string; read_at: string | null };
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "İşlem başarısız.";
const isDeveloperRole = (role: string) => role.toLocaleUpperCase("tr-TR") === "DEVELOPER";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu ayarları eksik.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function actor() {
  const session = await createSessionClient();
  const { data: auth, error } = await session.auth.getUser();
  if (error || !auth.user) throw new Error("Oturum doğrulanamadı.");
  const db = admin();
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("role,branch_id,full_name").eq("id", auth.user.id).single();
  if (profileError || !profile) throw new Error("Kullanıcı profili bulunamadı.");
  return {
    id: auth.user.id, db, branchId: profile.branch_id as string | null,
    developer: isDeveloperRole(profile.role || ""),
    name: String(profile.full_name || auth.user.email || "WMS Kullanıcısı"),
  };
}
const ensureDeveloper = (developer: boolean) => {
  if (!developer) throw new Error("Bu işlem yalnızca Developer rolüyle yapılabilir.");
};
const validateId = (id: string) => { if (!UUID.test(id)) throw new Error("Geçersiz kayıt kimliği."); };
const text = (value: unknown, min: number, max: number, label: string) => {
  const s = String(value ?? "").trim();
  if (s.length < min || s.length > max) throw new Error(`${label} ${min}-${max} karakter olmalı.`);
  return s;
};
const isTargeted = (a: Announcement, branchId: string | null) => {
  if (a.target_branch_ids !== null) return Boolean(branchId && a.target_branch_ids.includes(branchId));
  return !a.target_branch_id || a.target_branch_id === branchId;
};

async function authorizeTicket(ctx: Awaited<ReturnType<typeof actor>>, ticketId: string) {
  validateId(ticketId);
  const { data, error } = await ctx.db.from("wms_support_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (error || !data) throw new Error("Destek talebi bulunamadı.");
  if (!ctx.developer && data.created_by !== ctx.id) throw new Error("Bu talebe erişim yetkiniz bulunmuyor.");
  return data as Ticket;
}

export async function getAdvancedSupportOverview(includeArchived = false): Promise<Result<{
  tickets: Ticket[]; branches: Branch[]; contacts: Contact[]; unreadTicketIds: string[];
  developer: boolean;
}>> {
  try {
    const ctx = await actor();
    let query = ctx.db.from("wms_support_tickets").select("*")
      .order("updated_at", { ascending: false }).limit(200);
    if (!ctx.developer) query = query.eq("created_by", ctx.id);
    if (!includeArchived) query = query.is("archived_at", null);
    const [ticketsResult, branchesResult, contactsResult] = await Promise.all([
      query,
      ctx.db.from("branches").select("id,name").order("name").limit(200),
      ctx.developer
        ? ctx.db.from("profiles").select("id,full_name,branch_id,role").order("full_name").limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (ticketsResult.error) throw ticketsResult.error;
    if (branchesResult.error) throw branchesResult.error;
    if (contactsResult.error) throw contactsResult.error;
    const tickets = (ticketsResult.data || []) as Ticket[];
    const ids = tickets.map(t => t.id);
    const views = ids.length
      ? await ctx.db.from("wms_support_ticket_views").select("ticket_id,last_read_at")
        .eq("user_id", ctx.id).in("ticket_id", ids)
      : { data: [], error: null };
    if (views.error) throw views.error;
    const viewMap = new Map((views.data || []).map(v => [v.ticket_id, v.last_read_at]));
    const unreadTicketIds = tickets.filter(t =>
      t.last_message_at && (!viewMap.get(t.id) || Date.parse(t.last_message_at) > Date.parse(viewMap.get(t.id)!))
    ).map(t => t.id);
    return { ok: true, data: {
      tickets, developer: ctx.developer, unreadTicketIds,
      branches: (branchesResult.data || []) as Branch[],
      contacts: (contactsResult.data || []).map(p => ({
        id: p.id, name: p.full_name || "WMS Kullanıcısı", branch_id: p.branch_id, role: p.role,
      })),
    } };
  } catch (e) { return { ok: false, error: errorMessage(e) }; }
}

export async function getAdvancedTicketThread(ticketId: string): Promise<Result<{
  ticket: Ticket; messages: TicketMessage[];
}>> {
  try {
    const ctx = await actor();
    const ticket = await authorizeTicket(ctx, ticketId);
    const { data, error } = await ctx.db.from("wms_support_messages")
      .select("id,ticket_id,sender_id,sender_name,body,is_internal,created_at")
      .eq("ticket_id", ticketId).order("created_at").limit(400);
    if (error) throw error;
    await ctx.db.from("wms_support_ticket_views").upsert({
      ticket_id: ticketId, user_id: ctx.id, last_read_at: new Date().toISOString(),
    }, { onConflict: "ticket_id,user_id" });
    return { ok: true, data: {
      ticket,
      messages: ((data || []) as TicketMessage[]).filter(m => ctx.developer || !m.is_internal),
    } };
  } catch (e) { return { ok: false, error: errorMessage(e) }; }
}

export async function sendAdvancedTicketMessage(ticketId: string, body: string, internal = false): Promise<Result<TicketMessage>> {
  try {
    const ctx = await actor();
    const ticket = await authorizeTicket(ctx, ticketId);
    if (ticket.archived_at || ticket.status === "COMPLETED") throw new Error("Tamamlanan veya arşivlenen talebe mesaj yazılamaz. Önce yeniden açın.");
    if (internal && !ctx.developer) throw new Error("Dahili not yalnızca Developer hesabına açıktır.");
    const clean = text(body, 1, 4000, "Mesaj");
    const now = new Date().toISOString();
    const { data, error } = await ctx.db.from("wms_support_messages").insert({
      ticket_id: ticketId, sender_id: ctx.id, sender_name: ctx.name, body: clean, is_internal: internal,
    }).select("id,ticket_id,sender_id,sender_name,body,is_internal,created_at").single();
    if (error || !data) throw error || new Error("Mesaj gönderilemedi.");
    const updates: Record<string, unknown> = { last_message_at: now, updated_at: now };
    if (ctx.developer && !internal && !ticket.first_response_at) updates.first_response_at = now;
    if (ctx.developer && ticket.status === "OPEN") updates.status = "IN_PROGRESS";
    const { error: updateError } = await ctx.db.from("wms_support_tickets").update(updates).eq("id", ticketId);
    if (updateError) throw new Error("Mesaj kaydedildi ancak talep özeti güncellenemedi.");
    await ctx.db.from("wms_support_ticket_views").upsert({
      ticket_id: ticketId, user_id: ctx.id, last_read_at: now,
    }, { onConflict: "ticket_id,user_id" });
    return { ok: true, data: data as TicketMessage };
  } catch (e) { return { ok: false, error: errorMessage(e) }; }
}

export async function manageAdvancedTicket(ticketId: string, input: {
  status?: TicketStatus; priority?: TicketPriority; assigned_to?: string | null;
  archive?: boolean; developer_note?: string;
}): Promise<Result<true>> {
  try {
    const ctx = await actor(); ensureDeveloper(ctx.developer);
    const ticket = await authorizeTicket(ctx, ticketId);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.status !== undefined) {
      if (!["OPEN", "IN_PROGRESS", "COMPLETED"].includes(input.status)) throw new Error("Geçersiz durum.");
      if (ticket.archived_at) throw new Error("Arşivlenmiş kayıt önce arşivden çıkarılmalı.");
      updates.status = input.status;
      updates.resolved_at = input.status === "COMPLETED" ? new Date().toISOString() : null;
      updates.resolved_by = input.status === "COMPLETED" ? ctx.id : null;
    }
    if (input.priority !== undefined) {
      if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(input.priority)) throw new Error("Geçersiz öncelik.");
      updates.priority = input.priority;
    }
    if (input.assigned_to !== undefined) {
      if (input.assigned_to !== null) {
        validateId(input.assigned_to);
        const { data } = await ctx.db.from("profiles").select("id").eq("id", input.assigned_to).maybeSingle();
        if (!data) throw new Error("Atanacak kullanıcı bulunamadı.");
      }
      updates.assigned_to = input.assigned_to;
    }
    if (input.developer_note !== undefined) updates.developer_note = text(input.developer_note || " ", 0, 3000, "Çözüm notu") || null;
    if (input.archive !== undefined) {
      if (input.archive && ticket.status !== "COMPLETED") throw new Error("Yalnızca tamamlanmış talepler kaldırılabilir.");
      updates.archived_at = input.archive ? new Date().toISOString() : null;
      updates.archived_by = input.archive ? ctx.id : null;
    }
    const { error } = await ctx.db.from("wms_support_tickets").update(updates).eq("id", ticketId);
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) { return { ok: false, error: errorMessage(e) }; }
}

// Existing anonymous/branch sessions are never trusted to choose who can read an announcement.
async function eligibleAnnouncements(ctx: Awaited<ReturnType<typeof actor>>) {
  let query = ctx.db.from("wms_announcements").select("*").order("created_at", { ascending: false }).limit(150);
  if (!ctx.developer) query = query.is("deleted_at", null).eq("is_active", true)
    .lte("published_at", new Date().toISOString());
  const { data, error } = await query;
  if (error) throw error;
  const now = Date.now();
  return ((data || []) as Announcement[]).filter(a =>
    ctx.developer || (
      (!a.expires_at || Date.parse(a.expires_at) > now) && isTargeted(a, ctx.branchId)
    )
  );
}

export type AnnouncementMetric = { target: number; seen: number; percent: number };
export async function getAdvancedAnnouncements(): Promise<Result<{
  announcements: Announcement[]; branches: Branch[]; developer: boolean; unreadIds: string[];
  metrics: Record<string, AnnouncementMetric>;
}>> {
  try {
    const ctx = await actor();
    const [announcements, branchResult] = await Promise.all([
      eligibleAnnouncements(ctx),
      ctx.developer ? ctx.db.from("branches").select("id,name").order("name").limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (branchResult.error) throw branchResult.error;
    const ids = announcements.filter(a =>
      a.is_active && !a.deleted_at && Date.parse(a.published_at) <= Date.now()
    ).map(a => a.id);
    const result = ids.length
      ? await ctx.db.from("wms_announcement_reads").select("announcement_id,revision")
        .eq("user_id", ctx.id).in("announcement_id", ids)
      : { data: [], error: null };
    if (result.error) throw result.error;
    const readMap = new Map((result.data || []).map(r => [r.announcement_id, r.revision]));
    const metrics: Record<string, AnnouncementMetric> = {};
    if (ctx.developer && announcements.length) {
      // Tek seferde okuma geçmişi + hesaplar. Her duyuru için ayrı sorgu açma.
      const [peopleResult, allReadsResult] = await Promise.all([
        ctx.db.from("profiles").select("id,branch_id").limit(2500),
        ctx.db.from("wms_announcement_reads").select("announcement_id,user_id,revision")
          .in("announcement_id", announcements.map(a => a.id)).limit(10000),
      ]);
      if (peopleResult.error || allReadsResult.error) throw new Error("Duyuru okunma sayaçları yüklenemedi.");
      const people = peopleResult.data || [];
      const readsByAnnouncement = new Map<string, Set<string>>();
      for (const a of announcements) readsByAnnouncement.set(a.id, new Set<string>());
      for (const read of (allReadsResult.data || [])) {
        const a = announcements.find(item => item.id === read.announcement_id);
        if (a && a.revision === read.revision) readsByAnnouncement.get(a.id)?.add(read.user_id);
      }
      for (const a of announcements) {
        const targeted = people.filter(p => isTargeted(a, p.branch_id));
        const readSet = readsByAnnouncement.get(a.id)!;
        const seen = targeted.filter(p => readSet.has(p.id)).length;
        metrics[a.id] = {
          target: targeted.length, seen,
          percent: targeted.length ? Math.round(seen / targeted.length * 100) : 0,
        };
      }
    }
    return { ok: true, data: {
      announcements, branches: (branchResult.data || []) as Branch[], developer: ctx.developer,
      unreadIds: announcements.filter(a => ids.includes(a.id) && readMap.get(a.id) !== a.revision).map(a => a.id),
      metrics,
    } };
  } catch (e) { return { ok: false, error: errorMessage(e) }; }
}

export async function acknowledgeAdvancedAnnouncement(id: string): Promise<Result<true>> {
  try {
    const ctx = await actor(); validateId(id);
    const { data: announcement } = await ctx.db.from("wms_announcements").select("*").eq("id", id).maybeSingle();
    const a = announcement as Announcement | null;
    if (!a || a.deleted_at || !a.is_active || Date.parse(a.published_at) > Date.now()
      || (a.expires_at && Date.parse(a.expires_at) <= Date.now()) || !isTargeted(a, ctx.branchId)) {
      throw new Error("Duyuru artık erişilebilir değil.");
    }
    const { error } = await ctx.db.from("wms_announcement_reads").upsert({
      announcement_id: id, user_id: ctx.id, revision: a.revision, read_at: new Date().toISOString(),
    }, { onConflict: "announcement_id,user_id" });
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) { return { ok: false, error: errorMessage(e) }; }
}

export async function getAnnouncementInsights(id: string): Promise<Result<{
  total: number; seen: number; unseen: number; percent: number;
  readers: ReadPerson[]; unread: ReadPerson[];
  byBranch: { name: string; total: number; seen: number }[];
}>> {
  try {
    const ctx = await actor(); ensureDeveloper(ctx.developer); validateId(id);
    const { data: a, error: announceError } = await ctx.db.from("wms_announcements").select("*").eq("id", id).maybeSingle();
    if (announceError || !a) throw new Error("Duyuru bulunamadı.");
    const announcement = a as Announcement;
    const [profilesResult, branchesResult, readsResult] = await Promise.all([
      ctx.db.from("profiles").select("id,full_name,branch_id").limit(2500),
      ctx.db.from("branches").select("id,name").limit(200),
      ctx.db.from("wms_announcement_reads").select("user_id,read_at,revision")
        .eq("announcement_id", id).limit(2500),
    ]);
    if (profilesResult.error || branchesResult.error || readsResult.error) throw new Error("Okunma raporu yüklenemedi.");
    const branches = new Map((branchesResult.data || []).map(b => [b.id, b.name]));
    const readMap = new Map((readsResult.data || [])
      .filter(r => r.revision === announcement.revision)
      .map(r => [r.user_id, r.read_at]));
    const people: ReadPerson[] = (profilesResult.data || [])
      .filter(p => isTargeted(announcement, p.branch_id))
      .map(p => ({ id: p.id, name: p.full_name || "İsimsiz kullanıcı",
        branch: branches.get(p.branch_id || "") || "Merkez / Global", read_at: readMap.get(p.id) || null }));
    const seen = people.filter(p => p.read_at);
    const unread = people.filter(p => !p.read_at);
    const by = new Map<string, { name: string; total: number; seen: number }>();
    for (const person of people) {
      const line = by.get(person.branch) || { name: person.branch, total: 0, seen: 0 };
      line.total++; if (person.read_at) line.seen++;
      by.set(person.branch, line);
    }
    return { ok: true, data: {
      total: people.length, seen: seen.length, unseen: unread.length,
      percent: people.length ? Math.round(seen.length / people.length * 100) : 0,
      readers: seen.sort((x,y) => Date.parse(y.read_at!) - Date.parse(x.read_at!)),
      unread, byBranch: [...by.values()].sort((x,y) => x.name.localeCompare(y.name,"tr")),
    } };
  } catch (e) { return { ok: false, error: errorMessage(e) }; }
}
function validateImage(file: File, bytes: Uint8Array) {
  if (file.type === "image/png") return bytes.length > 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  if (file.type === "image/jpeg") return bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (file.type === "image/webp") return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}
export async function saveManagedAnnouncement(form: FormData): Promise<Result<Announcement>> {
  let path: string | null = null;
  try {
    const ctx = await actor(); ensureDeveloper(ctx.developer);
    const id = String(form.get("id") || "").trim();
    if (id) validateId(id);
    const title = text(form.get("title"), 5, 150, "Başlık");
    const body = text(form.get("body"), 5, 6000, "Duyuru metni");
    const priority = String(form.get("priority") || "NORMAL") as AnnouncementPriority;
    if (!["NORMAL", "IMPORTANT", "URGENT"].includes(priority)) throw new Error("Geçersiz önem derecesi.");
    const targetStrings = String(form.get("target_branch_ids") || "").split(",").map(s => s.trim()).filter(Boolean);
    const targets = [...new Set(targetStrings)];
    if (targets.some(id => !UUID.test(id))) throw new Error("Hedef şube kimliği geçersiz.");
    if (targets.length) {
      const { data: branchRows, error } = await ctx.db.from("branches").select("id").in("id", targets);
      if (error || branchRows?.length !== targets.length) throw new Error("Hedef şubeler doğrulanamadı.");
    }
    const published = String(form.get("published_at") || "");
    const publishedAt = published ? new Date(published) : new Date();
    if (!Number.isFinite(publishedAt.getTime())) throw new Error("Yayın tarihi geçersiz.");
    const expiryValue = String(form.get("expires_at") || "");
    const expiresAt = expiryValue ? new Date(expiryValue) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= publishedAt)) throw new Error("Bitiş tarihi yayın tarihinden sonra olmalı.");
    const active = String(form.get("is_active") || "true") === "true";
    let previous: Announcement | null = null;
    if (id) {
      const { data, error } = await ctx.db.from("wms_announcements").select("*").eq("id", id).maybeSingle();
      if (error || !data || data.deleted_at) throw new Error("Düzenlenecek duyuru bulunamadı.");
      previous = data as Announcement;
    }
    let imageUrl = previous?.image_url || null;
    if (form.get("remove_image") === "true") imageUrl = null;
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      if (image.size > 3 * 1024 * 1024) throw new Error("Görsel en fazla 3 MB olabilir.");
      const bytes = new Uint8Array(await image.arrayBuffer());
      if (!validateImage(image, bytes)) throw new Error("JPEG, PNG veya WEBP görsel seçin.");
      const ext = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
      path = `${randomUUID()}.${ext}`;
      const { error } = await ctx.db.storage.from("wms-announcements")
        .upload(path, bytes, { upsert: false, contentType: image.type, cacheControl: "3600" });
      if (error) throw new Error("Görsel yüklenemedi.");
      imageUrl = ctx.db.storage.from("wms-announcements").getPublicUrl(path).data.publicUrl;
    }
    const payload = {
      title, body, priority, image_url: imageUrl, is_active: active,
      target_branch_ids: targets.length ? targets : null,
      target_branch_id: targets.length === 1 ? targets[0] : null,
      published_at: publishedAt.toISOString(), expires_at: expiresAt?.toISOString() || null,
      updated_at: new Date().toISOString(),
    };
    const result = previous
      ? await ctx.db.from("wms_announcements").update({ ...payload, revision: previous.revision + 1 })
          .eq("id", id).eq("revision", previous.revision).select("*").maybeSingle()
      : await ctx.db.from("wms_announcements").insert({ ...payload, created_by: ctx.id })
          .select("*").maybeSingle();
    if (result.error || !result.data) throw new Error("Duyuru kaydedilemedi, başka bir işlem güncellemiş olabilir.");
    return { ok: true, data: result.data as Announcement };
  } catch (e) {
    if (path) { try { await admin().storage.from("wms-announcements").remove([path]); } catch {} }
    return { ok: false, error: errorMessage(e) };
  }
}

export async function manageAnnouncement(id: string, operation: "publish" | "archive" | "delete"): Promise<Result<true>> {
  try {
    const ctx = await actor(); ensureDeveloper(ctx.developer); validateId(id);
    const { data: announcement } = await ctx.db.from("wms_announcements").select("id,deleted_at").eq("id", id).maybeSingle();
    if (!announcement || announcement.deleted_at) throw new Error("Duyuru bulunamadı.");
    const update = operation === "delete"
      ? { deleted_at: new Date().toISOString(), is_active: false }
      : { is_active: operation === "publish" };
    const { error } = await ctx.db.from("wms_announcements")
      .update({ ...update, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return { ok: true, data: true };
  } catch (e) { return { ok: false, error: errorMessage(e) }; }
}
