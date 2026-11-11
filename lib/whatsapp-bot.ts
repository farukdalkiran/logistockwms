import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

const TZ = "Europe/Istanbul";
export const commands = ["RAPOR", "MESAI", "KARGO", "TRANSFER", "YARDIM"] as const;
export type Command = typeof commands[number];

export function allowedNumbers(): string[] {
  return (process.env.WHATSAPP_ALLOWED_NUMBERS || "").split(",").map(x => x.replace(/\D/g, "")).filter(Boolean);
}
export function isAllowed(number: string): boolean { return allowedNumbers().includes(number.replace(/\D/g, "")); }
export function parseCommand(text: string): Command | null {
  const normalized = text.trim().toLocaleUpperCase("tr-TR").replace(/İ/g, "I");
  return (commands as readonly string[]).includes(normalized) ? normalized as Command : null;
}
export function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const provided = signature.slice(7);
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
}
export function todayTR(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const p = (k: string) => parts.find(x => x.type === k)?.value || "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}
function dayRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Geçersiz tarih");
  const begin = new Date(`${date}T00:00:00+03:00`);
  return { start: begin.toISOString(), end: new Date(begin.getTime() + 86400000).toISOString() };
}
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu anahtarları eksik");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function time(value: string | null) {
  return value ? new Date(value).toLocaleTimeString("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "—";
}
async function allPages<T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const result = await fetchPage(offset, offset + 999);
    if (result.error) throw new Error(result.error.message);
    const chunk = result.data || [];
    rows.push(...chunk);
    if (chunk.length < 1000) return rows;
  }
  throw new Error("Rapor satır sınırı aşıldı");
}
export async function attendanceReport(date: string): Promise<string> {
  const { start, end } = dayRange(date), client = db();
  const rows = await allPages<{ employee_id: string | null; check_in_time: string | null; check_out_time: string | null; status: string | null }>((from,to) =>
    client.from("attendance").select("employee_id,check_in_time,check_out_time,status").gte("check_in_time",start).lt("check_in_time",end).not("check_in_time","is",null).order("check_in_time").range(from,to));
  const punches = rows.filter(r => r.employee_id && r.check_in_time && !String(r.status || "").startsWith("LEAVE_"));
  const ids = [...new Set(punches.map(r => r.employee_id!))];
  const names = new Map<string,string>();
  for (let i=0;i<ids.length;i+=100) {
    const {data,error}=await client.from("employees").select("id,full_name").in("id",ids.slice(i,i+100));
    if(error) throw new Error(error.message);
    (data||[]).forEach(e=>names.set(e.id,e.full_name));
  }
  const lines = punches.sort((a,b)=>(names.get(a.employee_id!) || a.employee_id || "").localeCompare(names.get(b.employee_id!) || b.employee_id || "", "tr")).map(r =>
    `• ${names.get(r.employee_id!) || r.employee_id}: ${time(r.check_in_time)} → ${time(r.check_out_time)}`);
  return `👥 MESAİ | ${date}\nGiriş yapan: ${ids.length} kişi | Açık mesai: ${punches.filter(r=>!r.check_out_time).length}\n${lines.join("\n") || "Kayıt yok."}`;
}
export async function cargoReport(date: string): Promise<string> {
  const {start,end} = dayRange(date), client=db();
  const rows = await allPages<{id:string;delivery_number:string|null;sd_document:string|null;is_returned:boolean|null;missing_address:boolean|null}>((from,to)=>
    client.from("cargo_records").select("id,delivery_number,sd_document,is_returned,missing_address").gte("created_at",start).lt("created_at",end).order("created_at").order("id").range(from,to));
  const latest = new Map<string,typeof rows[number]>();
  for (const r of rows) latest.set(`${r.delivery_number || r.id}|\u0000${r.sd_document || ""}`,r);
  const items=[...latest.values()];
  const [sessions,logs] = await Promise.all([
    client.from("cargo_sessions").select("id,status,total_items").gte("started_at",start).lt("started_at",end),
    client.from("cargo_logs").select("id", { count: "exact", head: true }).gte("scanned_at",start).lt("scanned_at",end)
  ]);
  if(sessions.error) throw new Error(sessions.error.message);
  if(logs.error) throw new Error(logs.error.message);
  return `📦 KARGO | ${date}\nKargo kayıtları: ${rows.length}\nTekil gönderi: ${items.length}\nİade: ${items.filter(x=>x.is_returned).length} | Eksik adres: ${items.filter(x=>!x.is_returned && x.missing_address).length}\nKargo oturumu: ${sessions.data?.length || 0} | Okutma: ${logs.count || 0}\nNot: Kargo kaydı/okutma, kargoya fiziksel teslimin kesin kanıtı değildir.`;
}
export async function transferReport(date: string): Promise<string> {
  const {start,end} = dayRange(date), client=db();
  const rows=await allPages<{id:string;transfer_code:string;status:string;created_at:string;shipped_at:string|null}>((from,to)=>
    client.from("transfers").select("id,transfer_code,status,created_at,shipped_at").gte("created_at",start).lt("created_at",end).order("created_at").range(from,to));
  const ids=rows.map(x=>x.id);
  const items: Array<{transfer_id:string;sent_qty:number|null;received_qty:number|null}> = [];
  for(let i=0;i<ids.length;i+=100){
    const batch = ids.slice(i,i+100);
    const result=await allPages<typeof items[number]>((from,to)=>client.from("transfer_items").select("transfer_id,sent_qty,received_qty").in("transfer_id",batch).range(from,to));
    items.push(...result);
  }
  const details=rows.map(t=>{
    const parts=items.filter(i=>i.transfer_id===t.id);
    const status=t.status;
    const allCounted=parts.length>0 && parts.every(x=>Number(x.sent_qty||0)===Number(x.received_qty||0));
    const result=status==="Tamamlandi" ? (allCounted?"Tamamlandı / adetler eşit":"Tamamlandı / sayım farkı veya eksik veri") : (allCounted?"Adetler eşit, durum açık":"Sayım bekliyor veya fark var");
    return `• ${t.transfer_code}: ${status} — ${result}`;
  });
  return `🚚 TRANSFER | ${date} (bugün açılanlar)\nOluşturulan: ${rows.length} | Yolda: ${rows.filter(x=>x.status==="Yolda").length} | Tamamlanan: ${rows.filter(x=>x.status==="Tamamlandi").length}\n${details.join("\n")||"Transfer yok."}\nNot: Eşit adetler, bağımsız okutma onayının yerine geçmez.`;
}
export async function report(command: Command,date=todayTR()):Promise<string> {
  if(command==="YARDIM") return "Logistock komutları: RAPOR, MESAI, KARGO, TRANSFER, YARDIM";
  if(command==="MESAI") return attendanceReport(date);
  if(command==="KARGO") return cargoReport(date);
  if(command==="TRANSFER") return transferReport(date);
  const results=await Promise.all([attendanceReport(date),cargoReport(date),transferReport(date)]);
  return results.join("\n\n");
}
export async function sendWhatsApp(to:string,body:string,template=false): Promise<void> {
  const token=process.env.WHATSAPP_ACCESS_TOKEN,phone=process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version=process.env.WHATSAPP_GRAPH_VERSION || "v25.0";
  if(!token||!phone||!/^v\d+\.\d+$/.test(version)) throw new Error("WhatsApp API yapılandırması eksik");
  const payload=template ? {
    messaging_product:"whatsapp",to,type:"template",
    template:{name:process.env.WHATSAPP_DAILY_TEMPLATE_NAME || "logistock_daily_report",language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE || "tr"},components:[{type:"body",parameters:[{type:"text",text:body.slice(0,900)}]}]}
  } : {messaging_product:"whatsapp",to,type:"text",text:{body:body.slice(0,4096)}};
  const response=await fetch(`https://graph.facebook.com/${version}/${phone}/messages`,{
    method:"POST",headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"
  });
  if(!response.ok) throw new Error(`WhatsApp API HTTP ${response.status}: ${(await response.text()).slice(0,400)}`);
}
