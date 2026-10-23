"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, Bot, ChevronRight, ClipboardList, Clock3, FileWarning, MessageCircle, Minimize2, PackageCheck, RefreshCcw, Send, ShieldCheck, Sparkles, Volume2, VolumeX, X, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { acknowledgeEmreAnnouncement, getEmreAttendanceGaps, getEmreBotFeed } from "@/app/actions/emrebot";

type Announcement={id:string;title:string;body:string;category:string;read:boolean;show_missing_attendance:boolean;action_href:string|null;action_label:string|null};
type Order={id:string;code:string;branch:string;requester:string;quantity:number;lines:number;createdAt:string};
type Feed={canOrders:boolean;canAttendance:boolean;orders:Order[];announcements:Announcement[]};
type Gaps={rows:{id:string;name:string;days:string[];pending:string[]}[];month:string;through:string;note:string};
const date=(v:string)=>new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
const initialMessage="Merhaba! Ben Turuncu, namıdiğer emreBOT. Siparişleri ve duyuruları takip ediyorum. Biraz şekerliyim ama işlerimiz tıkırında. 🍬";

export default function EmreBot(){
  const {userProfile}=useAuth();
  const pathname=usePathname(),router=useRouter();
  const [open,setOpen]=useState(false),[muted,setMuted]=useState(false),[tab,setTab]=useState<"orders"|"news"|"chat">("orders");
  const [feed,setFeed]=useState<Feed|null>(null),[gaps,setGaps]=useState<Gaps|null>(null);
  const [loading,setLoading]=useState(false),[alert,setAlert]=useState(""),[pulse,setPulse]=useState(false);
  const [query,setQuery]=useState(""),[reply,setReply]=useState(initialMessage);
  const known=useRef<Set<string>|null>(null),newsKnown=useRef<Set<string>|null>(null);
  const refreshing=useRef(false),audio=useRef<AudioContext|null>(null),pulseTimeout=useRef<ReturnType<typeof setTimeout>|null>(null);
  const active=!!userProfile && !pathname.startsWith("/login") && !pathname.startsWith("/terminal") && !pathname.startsWith("/portal");

  const bell=useCallback(()=>{
    if(muted)return;
    try{
      const context=audio.current??new AudioContext();audio.current=context;
      if(context.state!=="running")void context.resume();
      const start=context.currentTime;
      for(const [i,f] of [523.25,659.25,783.99].entries()){
        const osc=context.createOscillator(),gain=context.createGain(),t=start+i*0.115;
        osc.type="sine";osc.frequency.setValueAtTime(f,t);
        gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.065,t+.018);gain.gain.exponentialRampToValueAtTime(.0001,t+.23);
        osc.connect(gain).connect(context.destination);osc.start(t);osc.stop(t+.24);
      }
    }catch{/* Browser gesture policy may block sound; visual notification remains. */}
  },[muted]);
  const animate=useCallback((message:string)=>{
    setAlert(message);setPulse(true);bell();
    if(pulseTimeout.current)clearTimeout(pulseTimeout.current);
    pulseTimeout.current=setTimeout(()=>{setPulse(false);setAlert("");},6000);
  },[bell]);
  const refresh=useCallback(async(silent=true)=>{
    if(refreshing.current)return;
    refreshing.current=true;if(!silent)setLoading(true);
    try{
      const next=await getEmreBotFeed();
      const visibleOrders=next.orders as Order[],visibleNews=next.announcements as Announcement[];
      const ids=new Set(visibleOrders.map(o=>o.id));
      const newsIds=new Set(visibleNews.map(n=>n.id));
      if(known.current!==null){
        const fresh=visibleOrders.filter(o=>!known.current!.has(o.id));
        if(fresh.length){animate(fresh.length===1? `Yeni sipariş! ${fresh[0].branch} · ${fresh[0].quantity} adet` :`${fresh.length} yeni sipariş geldi!`);setTab("orders");}
      }
      if(newsKnown.current!==null){
        const fresh=visibleNews.filter(n=>!newsKnown.current!.has(n.id));
        if(fresh.length){animate("Yeni bir duyurumuz var!");setTab("news");}
      }
      known.current=ids;newsKnown.current=newsIds;
      setFeed(next);setGaps(null);
    }catch(error){if(!silent)console.error("emreBOT:",error);}
    finally{refreshing.current=false;setLoading(false);}
  },[animate]);

  useEffect(()=>{
    if(!active)return;
    known.current=null;newsKnown.current=null;
    void refresh();
    const channel=supabase.channel("emrebot-notify-"+userProfile.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"bot_order_signals"},()=>{void refresh();})
      .on("postgres_changes",{event:"*",schema:"public",table:"bot_announcements"},()=>{void refresh();})
      .subscribe();
    const timer=setInterval(()=>{void refresh();},45000);
    return ()=>{clearInterval(timer);void supabase.removeChannel(channel);};
  },[active,userProfile?.id,refresh]);
  useEffect(()=>()=>{if(pulseTimeout.current)clearTimeout(pulseTimeout.current);},[]);
  const checkGaps=async()=>{setLoading(true);try{setGaps(await getEmreAttendanceGaps());setTab("news");}catch(e){setReply(e instanceof Error?e.message:"Mesai verisi alınamadı.");setTab("chat");}finally{setLoading(false);}};
  const ask=(raw:string)=>{
    const q=raw.trim();if(!q)return;
    const t=q.toLocaleLowerCase("tr-TR");
    if(/sipariş|talep|ürün|sarf/.test(t)){setTab("orders");setReply("Sipariş merkezini açtım. Gelen taleplerde adet, talep eden ve mağaza bilgisi var. Talebi İncele butonundan devam et.");}
    else if(/mesai|eksik|izin|rapor/.test(t)){setTab("news");setReply("Puantajları ancak onaylı izinler, raporlar ve takvim kontrolleriyle değerlendiririm. Duyurudaki Eksikleri Denetle butonuna bas. Yarım gün ve vardiya kayıtlarını İK ayrıca doğrulamalı.");}
    else if(/duyuru|haber/.test(t)){setTab("news");setReply("Duyuru panosunu açtım. 28–29 Ekim mesai hatırlatması planlandı.");}
    else if(/şeker|insülin|turuncu|kızgın/.test(t)){setReply("Şekerim biraz yükselmiş olabilir! 🍊 Ama sanal bir botum; insülin kullanmıyorum. Tatlı tatlı işleri toparlayalım.");}
    else setReply("Ben henüz canlı bir dil modeli değilim; sipariş, duyuru ve mesai kayıtlarıyla ilgili yönlendirme yapabilen akıllı bir WMS asistanıyım. 'Siparişler' veya 'Mesai' yazabilirsin.");
    setQuery("");
  };
  if(!active)return null;
  const unread=(feed?.announcements||[]).filter(x=>!x.read).length;
  const counts=(feed?.orders||[]).length+unread;
  return <div className="hidden md:block fixed right-6 bottom-6 z-[9990] text-slate-900" style={{fontFamily:"Inter, sans-serif"}}>
    {alert&&!open&&<button type="button" onClick={()=>setOpen(true)} className="absolute bottom-24 right-0 w-72 text-left bg-[#111827] text-white border border-orange-500/60 rounded-xl px-4 py-3 shadow-2xl animate-[bounce_1s_ease-in-out_1]"><div className="text-[10px] font-black text-orange-300 tracking-[.2em] mb-1">EMREBOT · CANLI UYARI</div><div className="font-semibold text-sm">{alert}</div><span className="text-orange-300 text-[11px]">Görüntüle →</span></button>}
    {open&&<div className="w-[415px] h-[min(680px,calc(100vh-116px))] mb-4 bg-white rounded-2xl border border-slate-200 shadow-[0_24px_90px_rgba(15,23,42,0.28)] overflow-hidden flex flex-col">
      <div className="relative bg-[#111827] p-4 text-white border-b-4 border-orange-500 overflow-hidden">
        <div className="absolute -right-8 -top-12 w-40 h-40 rounded-full bg-orange-500/20 blur-2xl"/>
        <div className="relative flex gap-3 items-center">
          <div className={`w-14 h-14 shrink-0 rounded-full border-2 border-orange-400 flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-red-600 shadow-[0_0_22px_rgba(249,115,22,.45)] ${pulse?"animate-bounce":""}`}><Bot size={30}/></div>
          <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><strong className="text-lg tracking-tight">emre<span className="text-orange-400">BOT</span></strong><span className="text-[9px] bg-orange-500/20 text-orange-200 border border-orange-400/30 rounded px-2 py-1 font-bold">TURUNCU 🍊</span></div><p className="text-[11px] text-slate-300">WMS Akıllı Operasyon Asistanı</p><div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> CANLI TAKİP AKTİF</div></div>
          <button type="button" aria-label="Sesi aç/kapat" onClick={()=>setMuted(v=>!v)} className="text-slate-300 hover:text-white p-1">{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button>
          <button type="button" aria-label="Küçült" onClick={()=>setOpen(false)} className="text-slate-300 hover:text-white p-1"><Minimize2 size={17}/></button>
        </div>
      </div>
      <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200 px-2">
        {([["orders","Siparişler",PackageCheck],["news","Duyurular",BellRing],["chat","emreBOT",MessageCircle]] as const).map(([key,label,Icon])=><button key={key} type="button" onClick={()=>setTab(key)} className={`py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-[3px] transition-colors ${tab===key?"text-orange-600 border-orange-500":"text-slate-500 border-transparent hover:text-slate-900"}`}><Icon size={14}/>{label}{key==="news"&&unread>0&&<span className="text-[9px] text-white bg-orange-500 px-1 rounded-full">{unread}</span>}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto bg-[#fafbfc] p-3 space-y-3">
        {tab==="orders"&&(feed?.canOrders?<><div className="flex items-center justify-between p-2"><span className="text-xs font-black text-slate-700">ONAY BEKLEYEN TALEPLER · {feed?.orders.length||0}</span><button onClick={()=>void refresh(false)} aria-label="Yenile"><RefreshCcw size={15} className={loading?"animate-spin":""}/></button></div>{!feed?.orders.length&&<div className="p-7 text-center text-slate-500 text-sm">Şu an bekleyen yeni talep yok. Turuncu nöbette! 🍊</div>}{feed?.orders.map(order=><article key={order.id} className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-orange-500 shadow-sm p-3"><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] uppercase font-black text-orange-600 flex items-center gap-1"><Zap size={11}/> ONAY BEKLEYEN SİPARİŞ</div><div className="font-extrabold text-slate-900 mt-1">{order.code}</div></div><div className="bg-orange-50 rounded-lg px-2 py-1 text-center"><div className="font-black text-orange-600 text-lg leading-none">{order.quantity}</div><div className="text-[9px] text-orange-700">ADET</div></div></div><div className="text-[12px] text-slate-600 space-y-1 mt-2"><p>🏬 <b>{order.branch}</b></p><p>👤 Talep eden: <b>{order.requester}</b></p><p>📦 {order.lines} kalem ürün · {date(order.createdAt)}</p></div><button onClick={()=>router.push("/management/orders/approvals")} className="mt-3 w-full flex justify-center items-center gap-2 bg-[#111827] hover:bg-orange-600 transition-colors text-white py-2.5 rounded-lg text-xs font-bold">Talebi İncele <ChevronRight size={14}/></button></article>)}</>:<div className="p-7 text-center text-sm text-slate-500">Sipariş bildirimleri merkez depo yetkililerine açıktır.</div>)}
        {tab==="news"&&<><div className="flex items-center justify-between p-2"><span className="text-xs font-black text-slate-700">AKTİF DUYURULAR</span><button onClick={()=>void refresh(false)} aria-label="Yenile"><RefreshCcw size={15} className={loading?"animate-spin":""}/></button></div>{!feed?.announcements.length&&<div className="p-7 text-sm text-center text-slate-500">Aktif duyuru bulunmuyor.</div>}{feed?.announcements.map(n=><article key={n.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><div className="flex items-center gap-2 mb-2 text-orange-600"><BellRing size={16}/><span className="text-[10px] font-black tracking-widest">{n.category==="HR"?"İNSAN KAYNAKLARI":"DUYURU"}</span>{!n.read&&<span className="ml-auto bg-orange-100 text-orange-700 rounded px-2 py-0.5 text-[10px]">YENİ</span>}</div><h3 className="text-base font-extrabold">{n.title}</h3><p className="text-xs text-slate-600 leading-relaxed mt-2 whitespace-pre-line">{n.body}</p><div className="flex gap-2 mt-3 flex-wrap">{n.action_href&&<button onClick={()=>router.push(n.action_href!)} className="bg-[#111827] text-white text-[11px] px-3 py-2 rounded-lg font-bold">{n.action_label||"İncele"} →</button>}{n.show_missing_attendance&&feed.canAttendance&&<button onClick={()=>void checkGaps()} className="border border-orange-200 text-orange-700 bg-orange-50 text-[11px] px-3 py-2 rounded-lg font-bold">Eksikleri Denetle</button>}{!n.read&&<button onClick={async()=>{await acknowledgeEmreAnnouncement(n.id);setFeed(old=>old?{...old,announcements:old.announcements.map(a=>a.id===n.id?{...a,read:true}:a)}:old);}} className="text-[11px] text-slate-500 px-2 underline">Okundu</button>}</div></article>)}
          {gaps&&<section className="rounded-xl border border-amber-200 bg-white p-3"><div className="font-black text-xs text-slate-800 flex items-center gap-2"><FileWarning size={15} className="text-orange-600"/> {gaps.month} · Eksik Gün Denetimi</div><p className="text-[10px] text-slate-500 mt-1">Kontrol edilen son gün: {gaps.through}</p>{gaps.rows.length===0?<p className="text-xs text-emerald-600 mt-3">Şüpheli eksik gün bulunamadı.</p>:gaps.rows.map(p=><div key={p.id} className="border-t border-slate-100 py-2 mt-2"><div className="flex justify-between font-bold text-xs"><span>{p.name}</span><span className="text-orange-700">{p.days.length} eksik</span></div><div className="text-[10px] text-slate-600 mt-1">{p.days.join(", ")||"Eksik gün yok"}</div>{p.pending.length>0&&<div className="text-[10px] text-amber-700">İncelemede: {p.pending.join(", ")}</div>}</div>)}<p className="text-[10px] mt-3 text-slate-500 leading-relaxed">{gaps.note}</p></section>}</>}
        {tab==="chat"&&<><div className="flex gap-2 items-start"><div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white shrink-0"><Bot size={20}/></div><p className="rounded-xl rounded-tl-none border bg-white p-3 text-xs text-slate-700 leading-relaxed">{reply}</p></div><div className="flex flex-wrap gap-2 pl-10">{["Gelen siparişler","Duyurular","Eksik mesai günleri","Turuncu nasılsın?"].map(s=><button key={s} onClick={()=>ask(s)} className="text-[11px] border border-orange-200 rounded-full px-3 py-2 bg-white hover:bg-orange-50 text-orange-700">{s}</button>)}</div><div className="text-[10px] text-slate-400 px-3 flex gap-1 items-center"><ShieldCheck size={12}/> Bu sürüm kural tabanlıdır; serbest üretken AI henüz etkin değildir.</div></>}
      </div>
      {tab==="chat"&&<form onSubmit={e=>{e.preventDefault();ask(query);}} className="flex items-center gap-2 p-3 border-t bg-white"><input value={query} onChange={e=>setQuery(e.target.value)} maxLength={240} placeholder="emreBOT'a yaz..." className="flex-1 bg-slate-50 rounded-lg text-xs border border-slate-200 p-3 outline-none focus:border-orange-400"/><button aria-label="Gönder" type="submit" className="p-3 rounded-lg bg-orange-500 text-white"><Send size={16}/></button></form>}
      <div className="px-4 py-2 flex justify-between items-center border-t text-[10px] text-slate-400 bg-white"><span>🍊 emreBOT v1.0 · LogiStock WMS</span><span className="flex items-center gap-1"><Clock3 size={11}/> 45 sn yedek senkronizasyon</span></div>
    </div>}
    <button type="button" aria-label="emreBOT'u aç" onClick={()=>{setOpen(v=>!v);if(audio.current?.state==="suspended")void audio.current.resume();}} className={`relative ml-auto flex items-center justify-center w-[76px] h-[76px] rounded-full border-[4px] border-white bg-gradient-to-br from-orange-400 via-orange-500 to-red-600 text-white shadow-[0_10px_35px_rgba(234,88,12,.45)] hover:scale-105 transition-transform ${pulse?"animate-bounce":""}`}><span className={`absolute inset-[-9px] rounded-full border-2 border-orange-400/70 ${pulse?"animate-ping":""}`}/><Bot size={38} strokeWidth={1.8}/>{counts>0&&<span className="absolute -top-1 -right-1 bg-[#111827] text-white border-2 border-white min-w-7 h-7 rounded-full px-1 flex items-center justify-center text-xs font-black">{counts>99?"99+":counts}</span>}<span className="absolute -bottom-2 bg-[#111827] text-white rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wider">emreBOT</span></button>
  </div>;
}
