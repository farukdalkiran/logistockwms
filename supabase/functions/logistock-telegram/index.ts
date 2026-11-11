import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TZ="Europe/Istanbul";
const j=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const env=(name:string)=>Deno.env.get(name)||"";
let settings:{allowed_chat_ids:string[];telegram_webhook_secret:string;db_hook_secret:string;setup_secret:string;setup_consumed:boolean;enabled:boolean}={allowed_chat_ids:[],telegram_webhook_secret:"",db_hook_secret:"",setup_secret:"",setup_consumed:false,enabled:false};
const ids=()=>settings.allowed_chat_ids||[];
const day=()=>new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const fmt=(str?:string|null)=>str?new Date(str).toLocaleTimeString("tr-TR",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}):"—";
const range=()=>{const d=day(),s=new Date(d+"T00:00:00+03:00");return {d,start:s.toISOString(),end:new Date(s.getTime()+86400000).toISOString()};};
const admin=()=>{
 const key=env("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(env("SUPABASE_SECRET_KEYS")||"{}").default;
 if(!key||!env("SUPABASE_URL"))throw Error("Database credentials missing");
 return createClient(env("SUPABASE_URL"),key,{auth:{persistSession:false,autoRefreshToken:false}});
};
async function loadSettings(){const {data,error}=await admin().from("telegram_runtime_config").select("allowed_chat_ids,telegram_webhook_secret,db_hook_secret,setup_secret,setup_consumed,enabled").eq("id",1).single();if(error||!data)throw Error("Telegram settings unavailable");settings=data as typeof settings;}
async function pages(table:string,select:string,dateColumn:string,start:string,end:string){
 const db=admin(),result:Record<string,unknown>[]=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await db.from(table).select(select).gte(dateColumn,start).lt(dateColumn,end).order(dateColumn).range(offset,offset+499);
  if(error)throw Error(error.message);
  result.push(...(data||[]));
  if((data||[]).length<500)break;
 }
 return result;
}
async function namesFor(idsArr:string[]){
 const map=new Map<string,string>(),db=admin(),unique=[...new Set(idsArr.filter(Boolean))];
 for(let i=0;i<unique.length;i+=100){const {data,error}=await db.from("employees").select("id,full_name").in("id",unique.slice(i,i+100));if(error)throw Error(error.message);for(const x of data||[])map.set(String(x.id),String(x.full_name));}
 return map;
}
async function mesai(){
 const {d,start,end}=range();
 const db=admin();
 const ins=await pages("attendance","employee_id,check_in_time,check_out_time,status","check_in_time",start,end);
 const outs=await pages("attendance","employee_id,check_in_time,check_out_time,status","check_out_time",start,end);
 const real=ins.filter(x=>x.employee_id&&!String(x.status||"").startsWith("LEAVE_"));
 const exits=outs.filter(x=>x.employee_id&&!String(x.status||"").startsWith("LEAVE_")&&x.status!=="AUTO_CLOSED_MISSING_OUT");
 const names=await namesFor([...real,...exits].map(x=>String(x.employee_id||"")));
 const rows=real.map(x=>`• ${names.get(String(x.employee_id))||x.employee_id}: ${fmt(x.check_in_time as string)} → ${fmt(x.check_out_time as string)}`);
 const other=exits.filter(x=>!real.some(y=>y.employee_id===x.employee_id&&y.check_in_time===x.check_in_time));
 return `👥 MESAİ — ${d}\nBugün giriş: ${real.length} | Çıkış: ${exits.length}\n${rows.join("\n")||"Bugün giriş yok."}${other.length?"\nÖnceki vardiyadan çıkanlar:\n"+other.map(x=>`• ${names.get(String(x.employee_id))||x.employee_id} ${fmt(x.check_out_time as string)}`).join("\n"):""}`;
}
async function kargo(){
 const {d,start,end}=range(),db=admin();
 const sessions=await pages("cargo_sessions","id,employee_id,carrier_name,status,total_items,started_at,completed_at","started_at",start,end);
 const names=await namesFor(sessions.map(x=>String(x.employee_id||"")));
 let scans=0;const lines:string[]=[];
 for(const s of sessions.slice(-35)){
  const {count,error}=await db.from("cargo_logs").select("id",{count:"exact",head:true}).eq("session_id",s.id);
  if(error)throw Error(error.message);
  scans+=count||0;
  lines.push(`• ${names.get(String(s.employee_id))||s.employee_id||"Bilinmiyor"} / ${s.carrier_name||"Kargo"}: ${count||0} okutma, ${s.status==="COMPLETED"?"tamamlandı":"devam ediyor"}`);
 }
 return `📦 KARGO — ${d}\nBaşlayan oturum: ${sessions.length} | Tamamlanan: ${sessions.filter(x=>x.status==="COMPLETED").length}\nSon 35 oturumda okutma: ${scans}\n${lines.join("\n")||"Kargo oturumu yok."}`;
}
async function sonOkutmalar(){
 const {start,end}=range(),db=admin();
 const {data,error}=await db.from("cargo_logs").select("tracking_number,scanned_at,session_id").gte("scanned_at",start).lt("scanned_at",end).order("scanned_at",{ascending:false}).limit(15);
 if(error)throw Error(error.message);
 const logs=data||[],sessionIds=[...new Set(logs.map(x=>x.session_id))];
 const {data:sessions,error:se}=sessionIds.length?await db.from("cargo_sessions").select("id,employee_id,carrier_name").in("id",sessionIds):{data:[],error:null};
 if(se)throw Error(se.message);
 const name=await namesFor((sessions||[]).map(x=>x.employee_id));
 const ss=new Map((sessions||[]).map(x=>[x.id,x]));
 return `🔎 SON OKUTMALAR — ${day()}\n${logs.map(x=>{const s=ss.get(x.session_id);return `• ${fmt(x.scanned_at)} ${name.get(s?.employee_id||"")||"Bilinmiyor"} / ${s?.carrier_name||"Kargo"} / ${x.tracking_number}`;}).join("\n")||"Bugün okutma yok."}`;
}
async function transfer(){
 const {d,start,end}=range();
 const rows=await pages("transfers","id,transfer_code,status,picker_employee_id,created_at","created_at",start,end);
 const names=await namesFor(rows.map(x=>String(x.picker_employee_id||"")));
 return `🚚 TRANSFER — ${d} (bugün oluşturulan)\nToplam: ${rows.length} | Yolda: ${rows.filter(x=>x.status==="Yolda").length} | Tamamlandı: ${rows.filter(x=>x.status==="Tamamlandi").length}\n${rows.slice(-35).map(x=>`• ${x.transfer_code}: ${x.status} | Toplayan: ${names.get(String(x.picker_employee_id))||"Henüz atanmadı"}`).join("\n")||"Transfer yok."}\nNot: Tamamlandı durumu fiziksel sayım doğrulaması değildir.`;
}
async function sonSayimlar(){
 const {start,end}=range(),db=admin();
 const {data,error}=await db.from("scan_logs").select("transfer_id,employee_id,barcode,scanned_qty,scan_type,status,created_at").gte("created_at",start).lt("created_at",end).order("created_at",{ascending:false}).limit(15);
 if(error)throw Error(error.message);
 const rows=data||[],pids=[...new Set(rows.map(x=>x.employee_id).filter(Boolean))],transferIds=[...new Set(rows.map(x=>x.transfer_id).filter(Boolean))];
 const [people,transfers]=await Promise.all([pids.length?db.from("profiles").select("id,full_name").in("id",pids):Promise.resolve({data:[],error:null}),transferIds.length?db.from("transfers").select("id,transfer_code").in("id",transferIds):Promise.resolve({data:[],error:null})]);
 const names=new Map((people.data||[]).map(x=>[x.id,x.full_name])),codes=new Map((transfers.data||[]).map(x=>[x.id,x.transfer_code]));
 return `🔎 SON TRANSFER SAYIMLARI — ${day()}\n${rows.map(x=>`• ${fmt(x.created_at)} ${names.get(x.employee_id)||"Bilinmiyor"} — ${codes.get(x.transfer_id)||"Transfer"} / ${x.scanned_qty||0} adet / ${x.status||""}`).join("\n")||"Bugün sayım hareketi yok."}`;
}
async function send(id:string,text:string){
 if(!ids().includes(id))throw Error("Unauthorized chat");
 const token=env("LOGISTOCK_TELEGRAM_BOT_TOKEN");if(!token)throw Error("Bot not configured");
 const chunks=text.match(/[\s\S]{1,3800}/g)||[];
 for(const chunk of chunks){
  let ok=false;
  for(let attempt=0;attempt<2;attempt++){
   const res=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:id,text:chunk,disable_web_page_preview:true,protect_content:true,allow_paid_broadcast:false})});
   if(res.ok){ok=true;break;}const apiError=await res.json().catch(()=>({description:"No details"}));console.error("Telegram API sendMessage rejected",res.status,String(apiError?.description||"unknown").slice(0,300));if(res.status===429&&attempt===0){await new Promise(r=>setTimeout(r,1100));continue;}throw Error("Telegram HTTP "+res.status+": "+String(apiError?.description||"No details").slice(0,250));
  }if(!ok)throw Error("Telegram rate limited");
 }
}
async function broadcast(text:string){let sent=0,failed=0;for(const id of ids()){try{await send(id,text);sent++;}catch(e){failed++;console.error("Send failed",String(e));}}return {sent,failed};}
function eventFrom(payload:any):{key:string;text:string}|null{
 const {type,table,record:r,old_record:o}=payload;if(!r||!r.id)return null;
 const created=type==="INSERT",changed=type==="UPDATE",time=Date.now();
 const recent=(timestamp?:string)=>!!timestamp&&Math.abs(time-new Date(timestamp).getTime())<180000;
 if(table==="attendance"){
  if(String(r.status||"").startsWith("LEAVE_"))return null;
  if(created&&r.check_in_time&&!r.check_out_time&&recent(r.check_in_time))return {key:`att:${r.id}:in`,text:`🟢 PERSONEL GİRİŞİ\nPersonel kodu: ${r.employee_id}\nSaat: ${fmt(r.check_in_time)}`};
  if(changed&&o&&o.check_out_time==null&&r.check_out_time&&r.status!=="AUTO_CLOSED_MISSING_OUT"&&recent(r.check_out_time))return {key:`att:${r.id}:out`,text:`🔴 PERSONEL ÇIKIŞI\nPersonel kodu: ${r.employee_id}\nSaat: ${fmt(r.check_out_time)}`};
 }
 if(table==="cargo_sessions"){
  if(created&&recent(r.started_at))return {key:`cargo:${r.id}:start`,text:`📦 KARGO OKUTMASI BAŞLADI\nPersonel kodu: ${r.employee_id}\nFirma: ${r.carrier_name}\nSaat: ${fmt(r.started_at)}`};
  if(changed&&o&&o.status!=="COMPLETED"&&r.status==="COMPLETED"&&recent(r.completed_at))return {key:`cargo:${r.id}:complete`,text:`✅ KARGO OTURUMU TAMAMLANDI\nPersonel kodu: ${r.employee_id}\nFirma: ${r.carrier_name}\nAdet: ${r.total_items??"—"}\nSaat: ${fmt(r.completed_at)}`};
 }
 if(table==="cargo_logs"&&created&&recent(r.scanned_at))
  return {key:`cargo-scan:${r.id}`,text:`📦 KARGO OKUTMA AKTİVİTESİ\nOturum: ${r.session_id}\nSon barkod: ${r.tracking_number}\nSaat: ${fmt(r.scanned_at)}\nNot: Okutma bildirimi en fazla 5 dakikada bir gönderilir.`};
 if(table==="scan_logs"&&created&&r.status==="SUCCESS"&&recent(r.created_at))
  return {key:`transfer-scan:${r.id}`,text:`🔎 TRANSFER SAYIMI DEVAM EDİYOR\nTransfer ID: ${r.transfer_id}\nSayım yapan ID: ${r.employee_id}\nAdet: ${r.scanned_qty}\nSaat: ${fmt(r.created_at)}\nNot: Bildirim en fazla 5 dakikada bir gönderilir.`};
 if(table==="transfers"){
  if(created&&recent(r.created_at))return {key:`transfer:${r.id}:create`,text:`🚚 TRANSFER OLUŞTURULDU\nTransfer: ${r.transfer_code}\nDurum: ${r.status}\nSaat: ${fmt(r.created_at)}`};
  if(changed&&o&&(o.status!==r.status||o.picker_employee_id!==r.picker_employee_id))return {key:`transfer:${r.id}:${r.status}:${r.picker_employee_id||"-"}`,text:`🚚 TRANSFER GÜNCELLENDİ\nTransfer: ${r.transfer_code}\nDurum: ${r.status}\nToplayan kodu: ${r.picker_employee_id||"Atanmadı"}`};
 }
 return null;
}
Deno.serve(async(req:Request)=>{
 try{await loadSettings();}catch(e){console.error("Settings unavailable",String(e));return j({error:"Configuration unavailable"},503);}
 const bot=env("LOGISTOCK_TELEGRAM_BOT_TOKEN"),allowed=ids();
 if(req.method==="GET"){
   const uri=new URL(req.url),key=uri.searchParams.get("setup")||"";
   if(!key||key!==settings.setup_secret||settings.setup_consumed)return j({error:"Not found"},404);
   if(!bot||allowed.length===0)return j({error:"Bot token missing"},503);
   const hook=env("SUPABASE_URL")+"/functions/v1/logistock-telegram";
   const res=await fetch(`https://api.telegram.org/bot${bot}/setWebhook`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:hook,secret_token:settings.telegram_webhook_secret,allowed_updates:["message"],drop_pending_updates:true})});
   const reply=await res.json();if(!res.ok||!reply.ok)return j({error:"Telegram webhook registration failed"},502);
   await fetch(`https://api.telegram.org/bot${bot}/setMyCommands`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({commands:[{command:"mesai",description:"Günlük personel giriş-çıkış"},{command:"kargo",description:"Kargo oturumları"},{command:"sonokutmalar",description:"Son 15 kargo okutma"},{command:"transfer",description:"Transfer durumları"},{command:"sonsayimlar",description:"Son 15 transfer sayımı"},{command:"rapor",description:"Günlük genel rapor"},{command:"yardim",description:"Komutlar"}]})});
   const {error}=await admin().from("telegram_runtime_config").update({enabled:true,setup_consumed:true}).eq("id",1);
   if(error)return j({error:"Webhook active but config update failed"},500);
   settings.enabled=true;
   const outcome=await broadcast("✅ Logistock Telegram botu etkinleştirildi. /mesai, /kargo, /sonokutmalar, /transfer, /rapor komutlarını kullanabilirsiniz.");
   return j({ok:outcome.failed===0,webhook:true,...outcome});
 }
 if(req.method!=="POST")return j({ok:false},405);
 if(!settings.enabled||!bot||allowed.length===0)return j({error:"Bot not enabled"},503);
 const telegramSecret=settings.telegram_webhook_secret,dbSecret=settings.db_hook_secret;
 const tg=req.headers.get("x-telegram-bot-api-secret-token");
 const dbHeader=req.headers.get("x-logistock-event-secret");
 const isTelegram=!!telegramSecret&&tg===telegramSecret;
 const isDatabase=!!dbSecret&&dbHeader===dbSecret;
 if(!isTelegram&&!isDatabase)return j({error:"Unauthorized"},401);
 let input:any;try{input=await req.json();}catch{return j({error:"Invalid JSON"},400);}
 if(isTelegram){
  const chat=String(input.message?.chat?.id||"");
  if(!allowed.includes(chat)||!input.message?.text)return j({ok:true,ignored:true});
  const cmd=String(input.message.text).trim().split(/\s+/)[0].replace(/^\//,"").split("@")[0].toLocaleLowerCase("tr-TR");
  const cmds:Record<string,()=>Promise<string>>={mesai,kargo,transfer,sonokutmalar:sonOkutmalar,sonsayimlar:sonSayimlar,rapor:async()=>[await mesai(),await kargo(),await transfer()].join("\n\n"),start:async()=>help(),yardim:async()=>help()};
  try{await send(chat,await (cmds[cmd]||cmds.yardim)());return j({ok:true});}
  catch(e){console.error("Command failed",String(e));return j({error:"Command failed",detail:String(e).slice(0,300)},500);}
 }
 if(isDatabase){
  if(input.type==="CHECK_BOT_IDENTITY"){
    const res=await fetch(`https://api.telegram.org/bot${bot}/getMe`);
    const info=await res.json().catch(()=>({}));
    return j({ok:!!info.ok,username:info.result?.username||null,is_bot:info.result?.is_bot||false},res.ok?200:502);
  }
  if(input.schema!=="public"||!["attendance","cargo_sessions","cargo_logs","transfers","scan_logs"].includes(input.table))return j({ok:true,ignored:true});
  const event=eventFrom(input);if(!event)return j({ok:true,ignored:true});
  const db=admin();
  const {error}=await db.from("telegram_notification_events").insert({event_key:event.key});
  if(error?.code==="23505")return j({ok:true,duplicate:true});
  if(error){console.error("Dedup store error",error.code);return j({error:"Storage error"},500);}
  try{
   const row=input.record;
   if(row?.employee_id){const names=await namesFor([String(row.employee_id)]);event.text=event.text.replace("Personel kodu: "+row.employee_id,"Personel: "+(names.get(String(row.employee_id))||row.employee_id));}
   if(input.table==="cargo_logs"&&row?.session_id){
    const {data:session}=await db.from("cargo_sessions").select("employee_id,carrier_name").eq("id",row.session_id).maybeSingle();
    if(session){const names=await namesFor([session.employee_id]);event.text=event.text.replace("Oturum: "+row.session_id,`Personel: ${names.get(session.employee_id)||session.employee_id}\nFirma: ${session.carrier_name}`);}
   }
   if(input.table==="scan_logs"&&row?.transfer_id){
    const [{data:transfer},{data:profile}]=await Promise.all([db.from("transfers").select("transfer_code").eq("id",row.transfer_id).maybeSingle(),row.employee_id?db.from("profiles").select("full_name").eq("id",row.employee_id).maybeSingle():Promise.resolve({data:null})]);
    if(transfer)event.text=event.text.replace("Transfer ID: "+row.transfer_id,"Transfer: "+transfer.transfer_code);
    if(profile)event.text=event.text.replace("Sayım yapan ID: "+row.employee_id,"Sayım yapan: "+profile.full_name);
   }
   if(row?.picker_employee_id){const names=await namesFor([String(row.picker_employee_id)]);event.text=event.text.replace("Toplayan kodu: "+row.picker_employee_id,"Toplayan: "+(names.get(String(row.picker_employee_id))||row.picker_employee_id));}
   const outcome=await broadcast(event.text);
   return j({ok:outcome.failed===0,...outcome},outcome.failed?207:200);
  }catch(e){console.error("Event failed",String(e));return j({error:"Event failed"},500);}
 }
 return j({error:"Unauthorized"},401);
});
function help(){return "🤖 Logistock komutları:\n/mesai — bugünkü giriş/çıkış\n/kargo — kargo oturumları, okutma adetleri\n/sonokutmalar — son 15 barkod\n/transfer — transferlerin durumu\n/rapor — günlük genel rapor\n/yardim — komut listesi";}