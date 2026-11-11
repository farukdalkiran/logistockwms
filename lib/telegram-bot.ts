import { createClient } from "@supabase/supabase-js";

const TZ = "Europe/Istanbul";
export const commands = ["RAPOR", "MESAI", "KARGO", "TRANSFER", "YARDIM"] as const;
export type Command = typeof commands[number];
export function authorizedChatIds(): string[] {
  return (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "").split(",").map(x=>x.trim()).filter(x=>/^-?\d+$/.test(x));
}
export function parseCommand(text: string): Command | null {
  const key=text.trim().split(/\s+/)[0].replace(/^\//,"").split("@")[0].toLocaleUpperCase("tr-TR").replace(/İ/g,"I");
  return (commands as readonly string[]).includes(key) ? key as Command : null;
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
export async function sendTelegram(chatId:string,body:string): Promise<void> {
  if(!authorizedChatIds().includes(chatId)) throw new Error("Unauthorized Telegram chat");
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) throw new Error("Telegram token missing");
  // Paid broadcasts are never enabled. One message per request, within free-rate limits.
  for(const chunk of body.match(/[\s\S]{1,3900}/g) || []) {
    const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({chat_id:chatId,text:chunk,disable_web_page_preview:true}),cache:"no-store"
    });
    if(!response.ok) throw new Error(`Telegram API HTTP ${response.status}`);
    const result=await response.json() as {ok:boolean};
    if(!result.ok) throw new Error("Telegram send failed");
  }
}
export async function broadcastTelegram(text:string):Promise<{sent:number;failed:number}> {
  const ids=authorizedChatIds();
  let sent=0,failed=0;
  for(const id of ids) {try {await sendTelegram(id,text);sent++;}catch(e){failed++;console.error("Telegram recipient send failed",e);}}
  return {sent,failed};
}
export function eventText(event:"IN"|"OUT",name:string,instant:string):string {
  const date=new Date(instant);
  return `${event==="IN"?"🟢 PERSONEL GİRİŞİ":"🔴 PERSONEL ÇIKIŞI"}\nPersonel: ${name}\nTarih: ${date.toLocaleDateString("tr-TR",{timeZone:TZ})}\nSaat: ${time(instant)}`;
}
