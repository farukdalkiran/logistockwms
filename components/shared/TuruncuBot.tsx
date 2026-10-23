"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Activity, ArrowRight, BellRing, Check, ChevronRight, Clock3, Loader2, MessageCircle, Minimize2, PackageCheck, RefreshCcw, Send, ShieldCheck, Volume2, VolumeX, X, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { acknowledgeTuruncuAnnouncement, askTuruncuBot, getTuruncuAttendance, getTuruncuFeed } from "@/app/actions/turuncubot";
import type { BotCard, BotResponse, Intent, Mood } from "@/lib/turuncubot/engine";

type Order={id:string;code:string;branch:string;requester:string;quantity:number;lines:number;createdAt:string};
type Notice={id:string;title:string;body:string;category:string;starts_at:string;action_href:string|null;action_label:string|null;read:boolean;show_missing_attendance:boolean};
type Feed={orders:Order[];announcements:Notice[];canAttendance:boolean;canOrders:boolean;canApprove:boolean;sugar:number;lastIntent:string};
type ChatLine={id:number;from:"bot"|"user";text:string;cards?:BotCard[];suggestions?:string[];intent?:Intent};
type GapReport={month:string;through:string;rows:{id:string;name:string;days:string[];pending:string[];halfDays:string[]}[];note:string};
type Tab="chat"|"orders"|"announcements";
const dateTime=(iso:string)=>new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
const number=(n:number)=>new Intl.NumberFormat("tr-TR").format(n);
const norm=(s:string)=>s.toLocaleLowerCase("tr-TR").replace(/ı/g,"i").trim();
const FIRST:ChatLine={id:1,from:"bot",text:"Selam! 🍊 Ben turuncuBOT. Mağaza siparişleri, depo stoğu, transferler, kargo, izin ve eksik mesai günlerini birlikte kontrol edebiliriz. Bugün neye bakalım?",suggestions:["Operasyon özeti","Eksik günleri göster","Bekleyen siparişler","Bugün kaç kargo var?"]};

export default function TuruncuBot(){
 const {userProfile}=useAuth(),pathname=usePathname(),router=useRouter();
 const eligible=!!userProfile&&norm(userProfile.branchName)==="online depo"&&!pathname.startsWith("/login");
 const [authorized,setAuthorized]=useState(false);
 const [open,setOpen]=useState(false),[tab,setTab]=useState<Tab>("chat"),[muted,setMuted]=useState(false);
 const [feed,setFeed]=useState<Feed|null>(null),[sugar,setSugar]=useState(42),[mood,setMood]=useState<Mood>("NORMAL");
 const [busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[input,setInput]=useState("");
 const [chat,setChat]=useState<ChatLine[]>([FIRST]),[alert,setAlert]=useState(""),[pulse,setPulse]=useState(false);
 const [gaps,setGaps]=useState<GapReport|null>(null);
 const [avatarFailed,setAvatarFailed]=useState(false);
 const ordersKnown=useRef<Set<string>|null>(null),noticesKnown=useRef<Set<string>|null>(null);
 const audio=useRef<AudioContext|null>(null),lineId=useRef(2),lastIntent=useRef<Intent>("chat"),fetching=useRef(false);
 const active=useRef(true),alertTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const bottom=useRef<HTMLDivElement|null>(null);
 const beep=useCallback(()=>{
   if(muted)return;
   try{
     const ctx=audio.current??new AudioContext();audio.current=ctx;
     if(ctx.state!=="running")void ctx.resume();
     const now=ctx.currentTime;
     for(const [i,f] of [523.25,659.25,783.99].entries()){
       const oscillator=ctx.createOscillator(),gain=ctx.createGain(),t=now+i*.12;
       oscillator.type="sine";oscillator.frequency.value=f;
       gain.gain.setValueAtTime(.0001,t);
       gain.gain.exponentialRampToValueAtTime(.065,t+.02);
       gain.gain.exponentialRampToValueAtTime(.0001,t+.23);
       oscillator.connect(gain).connect(ctx.destination);
       oscillator.start(t);oscillator.stop(t+.24);
     }
   }catch{/* Audio can require a prior user gesture; visual notices remain active. */}
 },[muted]);
 const announce=useCallback((message:string)=>{
   setAlert(message);setPulse(true);beep();
   if(alertTimer.current)clearTimeout(alertTimer.current);
   alertTimer.current=setTimeout(()=>{setPulse(false);setAlert("");},7000);
 },[beep]);
 const refresh=useCallback(async(silent=true)=>{
   if(fetching.current)return;
   fetching.current=true;if(!silent)setRefreshing(true);
   try{
     const data=await getTuruncuFeed();
     if(!active.current)return;
     const orderIds=new Set(data.orders.map(o=>o.id)),newsIds=new Set(data.announcements.map(n=>n.id));
     if(ordersKnown.current!==null){
       const fresh=data.orders.filter(o=>!ordersKnown.current!.has(o.id));
       if(fresh.length){
         const item=fresh[0];
         announce(fresh.length===1?"Yeni sipariş: "+item.branch+" · "+item.quantity+" adet":fresh.length+" yeni mağaza siparişi!");
       }
     }
     if(noticesKnown.current!==null&&data.announcements.some(x=>!noticesKnown.current!.has(x.id))){
       announce("Yeni duyuru geldi! 🍊");
     }
     ordersKnown.current=orderIds;noticesKnown.current=newsIds;
     setFeed(data);setAuthorized(true);
     if(!silent)setSugar(data.sugar);
   }catch(error){
     setAuthorized(false);
     if(!silent)console.warn("turuncuBOT:",error);
   }finally{fetching.current=false;if(active.current)setRefreshing(false);}
 },[announce]);

 useEffect(()=>{
   active.current=true;
   if(!eligible){setAuthorized(false);setFeed(null);return;}
   ordersKnown.current=null;noticesKnown.current=null;
   void refresh(false);
   const channel=supabase.channel("turuncubot-"+userProfile!.id)
     .on("postgres_changes",{event:"*",schema:"public",table:"bot_order_signals"},()=>{void refresh(true);})
     .on("postgres_changes",{event:"*",schema:"public",table:"bot_announcements"},()=>{void refresh(true);})
     .subscribe();
   const timer=setInterval(()=>void refresh(true),45000);
   return ()=>{active.current=false;clearInterval(timer);void supabase.removeChannel(channel);};
 },[eligible,userProfile?.id,refresh]);
 useEffect(()=>()=>{if(alertTimer.current)clearTimeout(alertTimer.current);if(audio.current)void audio.current.close();},[]);
 useEffect(()=>{if(tab==="chat"&&open)bottom.current?.scrollIntoView({block:"end",behavior:"smooth"});},[chat,tab,open]);

 const say=async(raw:string)=>{
   const message=raw.trim();if(!message||busy)return;
   setOpen(true);setTab("chat");setInput("");setBusy(true);
   const entry:ChatLine={id:lineId.current++,from:"user",text:message};
   setChat(rows=>[...rows.slice(-59),entry]);
   try{
     const answer:BotResponse=await askTuruncuBot(message,lastIntent.current);
     lastIntent.current=answer.intent;setSugar(answer.sugar);setMood(answer.mood);
     setChat(rows=>[...rows.slice(-59),{id:lineId.current++,from:"bot",text:answer.text,cards:answer.cards,suggestions:answer.suggestions,intent:answer.intent}]);
     if(answer.mood==="SPICY")setPulse(true);
   }catch(error){
     setChat(rows=>[...rows.slice(-59),{id:lineId.current++,from:"bot",text:error instanceof Error?error.message:"Yanıt oluşturulamadı; bir daha deneyelim."}]);
   }finally{setBusy(false);setTimeout(()=>setPulse(false),800);}
 };
 const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();void say(input);};
 const inspectGaps=async()=>{
   setRefreshing(true);
   try{setGaps(await getTuruncuAttendance());}
   catch(error){setGaps(null);setTab("chat");setChat(rows=>[...rows,{id:lineId.current++,from:"bot",text:error instanceof Error?error.message:"Puantaj sorgusu başarısız."}]);}
   finally{setRefreshing(false);}
 };
 const navigate=(href:string)=>{
   if(!href.startsWith("/")||href.startsWith("//"))return;
   router.push(href);
 };
 const unread=feed?.announcements.filter(n=>!n.read).length||0;
 const badge=(feed?.orders.length||0)+unread;
 const cardClasses=(tone?:BotCard["tone"])=>tone==="red"?"border-l-red-500":tone==="green"?"border-l-emerald-500":"border-l-orange-500";

 if(!eligible||!authorized)return null;
 return <div className="fixed z-[9995] bottom-6 right-6 hidden md:block text-slate-900">
   {alert&&!open&&<button type="button" onClick={()=>{setOpen(true);setTab(alert.includes("duyuru")?"announcements":"orders");setAlert("");}} className="absolute bottom-24 right-0 w-[310px] rounded-xl bg-slate-950 text-white p-4 border border-orange-500/40 shadow-2xl text-left animate-[bounce_1s_ease-in-out_1]">
     <div className="text-[10px] font-black tracking-[.18em] text-orange-300">TURUNCUBOT · CANLI UYARI</div>
     <p className="mt-2 text-sm font-bold">{alert}</p><span className="text-[11px] text-orange-300 font-bold">Talebi incele <ArrowRight size={12} className="inline"/></span>
   </button>}
   {open&&<section className="w-[440px] h-[min(720px,calc(100vh-115px))] mb-5 flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-[0_24px_80px_rgba(15,23,42,.28)]">
     <header className="relative shrink-0 overflow-hidden bg-slate-950 px-4 py-4 text-white border-b-[3px] border-orange-500">
       <div className="pointer-events-none absolute -right-12 -top-16 w-44 h-44 rounded-full bg-orange-500/25 blur-3xl"/>
       <div className="relative flex items-center gap-3">
         <div className={"w-14 h-14 rounded-full overflow-hidden ring-[3px] ring-orange-400 shrink-0 bg-orange-500 "+(pulse?"animate-bounce":"")}>
           {!avatarFailed?<Image src="/turuncu.jpg" alt="turuncuBOT" width={56} height={56} unoptimized onError={()=>setAvatarFailed(true)} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-3xl">🍊</div>}
         </div>
         <div className="flex-1 min-w-0">
           <div className="flex items-center gap-2"><h2 className="text-lg font-black tracking-tight">turuncu<span className="text-orange-400">BOT</span></h2><span className="bg-orange-500/15 text-orange-200 border border-orange-400/30 rounded-md text-[9px] px-2 py-1 font-bold">ONLINE DEPO</span></div>
           <p className="mt-0.5 text-[11px] text-slate-300">Akıllı WMS operasyon asistanı</p>
           <div className="flex items-center gap-1 text-[10px] mt-1 text-emerald-400 font-bold"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/> CANLI BİLDİRİM AKTİF</div>
         </div>
         <button type="button" title={muted?"Sesi aç":"Sesi kapat"} aria-label="Sesi aç/kapat" className="p-1 text-slate-300 hover:text-white" onClick={()=>setMuted(v=>!v)}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>
         <button type="button" title="Küçült" aria-label="Küçült" className="p-1 text-slate-300 hover:text-white" onClick={()=>setOpen(false)}><Minimize2 size={18}/></button>
       </div>
       <div className="relative mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex items-center gap-3">
         <span className="text-[11px] font-bold whitespace-nowrap">{mood==="SPICY"?"😤 Sinirli":mood==="CALM"?"😌 Sakin":"🍬 Keyifli"}</span>
         <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden"><div className={"h-full rounded-full transition-all duration-500 "+(mood==="SPICY"?"bg-red-500":mood==="CALM"?"bg-emerald-400":"bg-orange-400")} style={{width:sugar+"%"}}/></div>
         <span className="text-[10px] font-mono text-orange-200 whitespace-nowrap">{sugar}/100</span>
       </div>
     </header>
     <nav className="shrink-0 grid grid-cols-3 bg-slate-50 border-b border-slate-200 px-2">
       {([["chat","Sohbet",MessageCircle],["orders","Siparişler",PackageCheck],["announcements","Duyurular",BellRing]] as const).map(([name,label,Icon])=><button key={name} type="button" onClick={()=>setTab(name)} className={"relative py-3 text-[12px] font-bold flex items-center justify-center gap-1.5 border-b-[3px] transition-colors "+(tab===name?"border-orange-500 text-orange-600":"border-transparent text-slate-500 hover:text-slate-900")}><Icon size={14}/>{label}{name==="announcements"&&unread>0&&<span className="rounded-full bg-orange-500 text-white px-1 text-[10px]">{unread}</span>}</button>)}
     </nav>
     <div className="flex-1 min-h-0 overflow-y-auto bg-[#f8fafc] p-3 space-y-3">
       {tab==="chat"&&<>
         {chat.map(line=><div key={line.id} className={"flex "+(line.from==="user"?"justify-end":"justify-start")}>
           <div className={"max-w-[92%] rounded-2xl p-3 text-[13px] leading-relaxed "+(line.from==="user"?"rounded-br-sm bg-orange-500 text-white":"rounded-bl-sm bg-white text-slate-800 border border-slate-200 shadow-sm")}>
             <p className="whitespace-pre-wrap">{line.text}</p>
             {!!line.cards?.length&&<div className="space-y-2 mt-3">{line.cards.map((card,i)=><div key={i} className={"bg-slate-50 border border-slate-200 border-l-[3px] "+cardClasses(card.tone)+" rounded-lg p-2.5"}>
               <h3 className="font-extrabold text-xs text-slate-800">{card.title}</h3>
               {card.lines.map((row,j)=><p className="text-[11px] text-slate-600 mt-1" key={j}>{row}</p>)}
               {card.href&&<button type="button" onClick={()=>navigate(card.href!)} className="text-[11px] font-black text-orange-600 mt-2 flex items-center gap-1">{card.action||"İncele"} <ChevronRight size={13}/></button>}
             </div>)}</div>}
             {!!line.suggestions?.length&&<div className="mt-3 flex flex-wrap gap-1.5">{line.suggestions.slice(0,5).map((s,i)=><button type="button" key={i} onClick={()=>void say(s)} className="text-[10px] text-orange-700 border border-orange-200 rounded-full bg-orange-50 px-2.5 py-1.5 hover:bg-orange-100">{s}</button>)}</div>}
           </div>
         </div>)}
         {busy&&<div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin"/> turuncuBOT düşünüyor…</div>}
         <div ref={bottom}/>
       </>}
       {tab==="orders"&&<>
         <div className="flex items-center justify-between p-1"><div className="text-xs font-extrabold">ONAY BEKLEYEN SİPARİŞLER · {feed?.orders.length||0}</div><button type="button" onClick={()=>void refresh(false)} aria-label="Siparişleri yenile"><RefreshCcw size={15} className={refreshing?"animate-spin":""}/></button></div>
         {!feed?.orders.length&&<div className="py-12 text-center text-slate-500 text-sm">Bekleyen sipariş yok. 🍊</div>}
         {feed?.orders.map(o=><div key={o.id} className="rounded-xl bg-white p-3 border-l-[3px] border-l-orange-500 border border-slate-200 shadow-sm">
           <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="uppercase text-[10px] text-orange-600 font-black tracking-wide flex items-center gap-1"><Zap size={12}/> MAĞAZA TALEBİ</div><h3 className="font-black text-sm text-slate-900 mt-1 truncate">{o.code}</h3></div><div className="rounded-lg bg-orange-50 px-3 py-2 text-center shrink-0"><strong className="text-lg text-orange-600">{number(o.quantity)}</strong><div className="text-[9px] text-orange-800">ADET</div></div></div>
           <p className="mt-1 text-[12px] text-slate-600">🏬 {o.branch}</p><p className="mt-1 text-[12px] text-slate-600">👤 Talep: {o.requester}</p><p className="mt-1 text-[11px] text-slate-500">📦 {o.lines} kalem · {dateTime(o.createdAt)}</p>
           {feed.canApprove&&<button type="button" onClick={()=>navigate("/management/orders/approvals")} className="mt-3 flex w-full gap-1 items-center justify-center rounded-lg bg-slate-950 hover:bg-orange-600 text-white text-xs font-bold p-2.5 transition-colors">Talebi İncele <ArrowRight size={14}/></button>}
         </div>)}
       </>}
       {tab==="announcements"&&<>
         <div className="flex items-center justify-between p-1"><div className="text-xs font-extrabold">AKTİF DUYURULAR · {feed?.announcements.length||0}</div><button type="button" onClick={()=>void refresh(false)} aria-label="Duyuruları yenile"><RefreshCcw size={15} className={refreshing?"animate-spin":""}/></button></div>
         {!feed?.announcements.length&&<p className="py-12 text-center text-slate-500 text-sm">Şu an aktif duyuru yok.</p>}
         {feed?.announcements.map(n=><article key={n.id} className="rounded-xl p-4 border border-slate-200 bg-white shadow-sm">
           <div className="flex items-center justify-between"><span className="flex items-center gap-1 text-[10px] text-orange-600 font-black tracking-wide"><BellRing size={14}/> {n.category==="HR"?"PERSONEL & MESAİ":"OPERASYON DUYURUSU"}</span>{!n.read&&<span className="text-[9px] bg-orange-50 text-orange-600 font-bold rounded px-2 py-1">YENİ</span>}</div>
           <h3 className="font-black text-sm mt-2">{n.title}</h3><p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line">{n.body}</p>
           <div className="flex flex-wrap gap-2 mt-3">
             {n.action_href&&<button type="button" onClick={()=>navigate(n.action_href!)} className="px-3 py-2 text-[11px] bg-slate-950 text-white rounded-lg font-bold">{n.action_label||"İncele"} →</button>}
             {n.show_missing_attendance&&feed?.canAttendance&&<button type="button" onClick={()=>void inspectGaps()} className="px-3 py-2 text-[11px] bg-orange-50 border border-orange-200 text-orange-700 rounded-lg font-bold">Eksikleri Denetle</button>}
             {!n.read&&<button type="button" onClick={async()=>{try{await acknowledgeTuruncuAnnouncement(n.id);setFeed(f=>f?{...f,announcements:f.announcements.map(x=>x.id===n.id?{...x,read:true}:x)}:f);}catch{/* Reattempt after refresh. */}}} className="px-2 py-1 text-[11px] text-slate-500 underline">Okundu</button>}
           </div>
         </article>)}
         {gaps&&<article className="rounded-xl border border-amber-200 bg-white p-3">
           <h3 className="font-extrabold text-sm">📅 {gaps.month} · Eksik Günler</h3><p className="text-[11px] text-slate-500 mt-1">Kontrolün son günü: {gaps.through}</p>
           {gaps.rows.length?gaps.rows.map(p=><div key={p.id} className="border-b border-slate-100 py-2">
             <div className="flex items-center justify-between gap-2"><b className="text-xs">{p.name}</b><span className="text-[11px] font-black text-red-600">{p.days.length} eksik</span></div>
             {p.days.length>0&&<p className="text-[11px] mt-1 text-slate-600">Günler: {p.days.map(d=>d.slice(8,10)+"."+d.slice(5,7)).join(", ")}</p>}
             {p.pending.length>0&&<p className="text-[11px] text-amber-700 mt-1">Onay bekleyen: {p.pending.join(", ")}</p>}
             {p.halfDays.length>0&&<p className="text-[11px] text-amber-700 mt-1">Yarım gün kontrol: {p.halfDays.join(", ")}</p>}
           </div>):<p className="text-xs mt-3 text-emerald-600">Şüpheli eksik gün bulunamadı.</p>}
           <p className="text-[10px] text-slate-500 leading-relaxed mt-3">{gaps.note}</p>
         </article>}
       </>}
     </div>
     {tab==="chat"&&<form onSubmit={submit} className="shrink-0 flex gap-2 p-3 border-t border-slate-200 bg-white">
       <input value={input} onChange={e=>setInput(e.target.value)} disabled={busy} maxLength={500} placeholder="turuncuBOT'a bir şey sor..." className="min-w-0 flex-1 border border-slate-200 focus:outline-none focus:border-orange-400 rounded-xl bg-slate-50 text-xs px-3 py-3"/>
       <button type="submit" disabled={busy||!input.trim()} aria-label="Gönder" className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl p-3 text-white"><Send size={17}/></button>
     </form>}
     <div className="shrink-0 px-3 py-2 border-t border-slate-100 bg-white flex items-center justify-between text-[10px] text-slate-400">
       <span className="flex items-center gap-1"><ShieldCheck size={11}/> Sadece Online Depo hesapları</span><span className="flex items-center gap-1"><Activity size={11}/> 45 sn yedek senkronizasyon</span>
     </div>
   </section>}
   <button type="button" aria-label="turuncuBOT'u aç" onClick={()=>{setOpen(v=>!v);if(audio.current?.state==="suspended")void audio.current.resume();}} className={"relative ml-auto w-[80px] h-[80px] flex items-center justify-center rounded-full border-[4px] border-white bg-orange-500 shadow-[0_10px_35px_rgba(234,88,12,.45)] transition-transform hover:scale-105 "+(pulse?"animate-bounce":"")}>
     <div className={"pointer-events-none absolute -inset-2 rounded-full border-2 border-orange-400/70 "+(pulse?"animate-ping":"")}/>
     <div className="w-full h-full rounded-full overflow-hidden">
       {!avatarFailed?<Image src="/turuncu.jpg" alt="turuncuBOT" width={80} height={80} unoptimized onError={()=>setAvatarFailed(true)} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-4xl">🍊</div>}
     </div>
     {badge>0&&<span className="absolute -top-1 -right-1 bg-slate-950 border-2 border-white min-w-7 h-7 flex items-center justify-center rounded-full px-1 text-white font-black text-xs">{badge>99?"99+":badge}</span>}
     <span className="absolute -bottom-2 bg-slate-950 text-white text-[10px] font-black tracking-wide px-2 py-0.5 rounded">turuncuBOT</span>
   </button>
 </div>;
}
