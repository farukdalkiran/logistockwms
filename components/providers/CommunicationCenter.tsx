"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Archive, ArrowLeft, Bell, CheckCircle2, ChevronRight, Clock3, Download,
  FileImage, Filter, Headset, Inbox, Loader2, LockKeyhole, Megaphone, MessageSquare, Pencil,
  Plus, RefreshCw, RotateCcw, Search, Send, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { useWms } from "@/components/providers/WmsSessionProvider";
import { submitSupportTicket, type SupportCategory } from "@/app/actions/notice-center";
import {
  acknowledgeAdvancedAnnouncement, getAdvancedAnnouncements, getAdvancedSupportOverview,
  getAdvancedTicketThread, getAnnouncementInsights, manageAdvancedTicket, manageAnnouncement,
  saveManagedAnnouncement, sendAdvancedTicketMessage, type Announcement, type AnnouncementPriority,
  type Branch, type Contact, type ReadPerson, type Ticket, type TicketMessage, type TicketPriority, type TicketStatus,
} from "@/app/actions/notice-center-advanced";

type Tab = "support" | "announcements";
type Props = { initialTab: Tab; onClose: () => void; onChanged: () => void };
const BOX = "rounded-[6px] border border-slate-200 bg-white shadow-sm";
const BTN = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] bg-[#dc3545] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50";
const INPUT = "min-h-11 w-full rounded-[5px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100";
const DATE = new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",dateStyle:"short",timeStyle:"short"});
const fmt = (date?: string | null) => date ? DATE.format(new Date(date)) : "—";
const shortId = (id:string) => id.substring(0,8).toUpperCase();
const STATUS: Record<TicketStatus,string> = {OPEN:"Açık",IN_PROGRESS:"İşlemde",COMPLETED:"Tamamlandı"};
const STATUS_TONES: Record<TicketStatus,string> = {OPEN:"border-rose-200 bg-rose-50 text-rose-700",IN_PROGRESS:"border-amber-200 bg-amber-50 text-amber-800",COMPLETED:"border-emerald-200 bg-emerald-50 text-emerald-700"};
const PRIORITIES: Record<TicketPriority,string> = {LOW:"Düşük",NORMAL:"Normal",HIGH:"Yüksek",URGENT:"Acil"};
const CATEGORIES: Array<{value:SupportCategory;label:string}> = [
  {value:"GENERAL",label:"Genel"},{value:"TECHNICAL",label:"Teknik"},
  {value:"ORDERS",label:"Sipariş"},{value:"STOCK",label:"Stok"},
  {value:"ATTENDANCE",label:"Puantaj"},{value:"TRANSFER",label:"Transfer"},{value:"CARGO",label:"Kargo"},
];
function tag(text:string,tone="border-slate-200 bg-slate-100 text-slate-700"){
  return <span className={`inline-flex rounded-[4px] border px-2 py-1 text-xs font-semibold ${tone}`}>{text}</span>;
}
function dateLocal(iso:string|null|undefined) {
  if(!iso) return "";
  const d=new Date(iso),pad=(x:number)=>String(x).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function downloadReport(name:string,rows:string[][]) {
  const content="\uFEFF"+rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=name;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function SupportView({onChanged}:{onChanged:()=>void}) {
  const { userId }=useWms();
  const [tickets,setTickets]=useState<Ticket[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [developer,setDeveloper]=useState(false);
  const [unread,setUnread]=useState<string[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [messages,setMessages]=useState<TicketMessage[]>([]);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("ACTIVE");
  const [showArchive,setShowArchive]=useState(false);
  const [compose,setCompose]=useState(false);
  const [category,setCategory]=useState<SupportCategory>("GENERAL");
  const [subject,setSubject]=useState("");
  const [description,setDescription]=useState("");
  const [reply,setReply]=useState("");
  const [internal,setInternal]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [threadLoading,setThreadLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const bottom=useRef<HTMLDivElement>(null);

  const refresh=useCallback(async (archive=false)=>{
    setLoading(true);setError("");
    const r=await getAdvancedSupportOverview(archive);
    setLoading(false);
    if(!r.ok){setError(r.error);return;}
    setTickets(r.data.tickets);setDeveloper(r.data.developer);
    setBranches(r.data.branches);setContacts(r.data.contacts);setUnread(r.data.unreadTicketIds);
    setSelected(current=>r.data.tickets.some(t=>t.id===current)?current:null);
  },[]);
  useEffect(()=>{void refresh(showArchive);},[refresh,showArchive]);
  const chosen=tickets.find(t=>t.id===selected)||null;
  const branchName=(id:string|null)=>branches.find(b=>b.id===id)?.name || "Merkez / Genel";
  const filtered=useMemo(()=>tickets.filter(t=>{
    if(filter!=="ACTIVE" && filter!==t.status) return false;
    const words=[t.subject,t.description,t.requester_name,branchName(t.branch_id),t.category,t.id].join(" ").toLocaleLowerCase("tr-TR");
    return words.includes(search.toLocaleLowerCase("tr-TR"));
  }),[tickets,filter,search,branches]);
  const counters={all:tickets.length,open:tickets.filter(t=>t.status==="OPEN").length,
    ongoing:tickets.filter(t=>t.status==="IN_PROGRESS").length,closed:tickets.filter(t=>t.status==="COMPLETED").length};
  const openThread=async(id:string)=>{
    setSelected(id);setCompose(false);setThreadLoading(true);setMessages([]);setError("");
    const r=await getAdvancedTicketThread(id);
    setThreadLoading(false);
    if(!r.ok){setError(r.error);return;}
    setMessages(r.data.messages);
    setUnread(current=>current.filter(v=>v!==id));
    requestAnimationFrame(()=>bottom.current?.scrollIntoView({block:"end",behavior:"smooth"}));
  };
  const create=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(busy)return;setBusy(true);setError("");
    const r=await submitSupportTicket({category,subject,description});
    setBusy(false);if(!r.ok){setError(r.error);return;}
    setSubject("");setDescription("");setCategory("GENERAL");setCompose(false);
    await refresh(showArchive);setSuccess("Destek talebi açıldı.");onChanged();
    void openThread(r.data.id);
  };
  const send=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!chosen||!reply.trim()||busy)return;
    setBusy(true);setError("");
    const r=await sendAdvancedTicketMessage(chosen.id,reply,developer&&internal);
    setBusy(false);if(!r.ok){setError(r.error);return;}
    setReply("");setInternal(false);
    await Promise.all([openThread(chosen.id),refresh(showArchive)]);
    onChanged();
  };
  const mutate=async(input:{status?:TicketStatus;priority?:TicketPriority;assigned_to?:string|null;archive?:boolean})=>{
    if(!chosen||busy)return;setBusy(true);setError("");setSuccess("");
    const r=await manageAdvancedTicket(chosen.id,input);
    setBusy(false);if(!r.ok){setError(r.error);return;}
    setSuccess(input.archive===true?"Tamamlanan talep arşive kaldırıldı.":input.archive===false?"Talep arşivden çıkarıldı.":"Talep güncellendi.");
    await refresh(showArchive);onChanged();
    if(input.archive===true && !showArchive)setSelected(null);
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-xl font-bold text-slate-900">Destek Talepleri ve Mesajlaşma</h3>
        <p className="mt-1 text-sm text-slate-600">Talep oluşturun, konuşma geçmişini izleyin ve çözümleri yönetin. Mesajlar yalnızca ilgili kullanıcıya ve Developer hesabına açıktır.</p></div>
      <div className="flex flex-wrap gap-2">
        {developer&&<button className={BTN} onClick={()=>{setShowArchive(v=>!v);setSelected(null);}}><Archive size={15}/>{showArchive?"Aktif Talepler":"Arşiv"}</button>}
        <button className={BTN} disabled={loading} onClick={()=>void refresh(showArchive)}><RefreshCw size={15}/>Yenile</button>
        <button className={PRIMARY} onClick={()=>{setCompose(true);setSelected(null);}}><Plus size={16}/>Yeni Talep</button>
      </div>
    </div>
    {error&&<div role="alert" className="rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    {success&&<div role="status" className="rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[[ "Toplam",counters.all],[ "Açık",counters.open],[ "İşlemde",counters.ongoing],[ "Tamamlanan",counters.closed]].map(([label,value])=>
        <div key={label} className={`${BOX} px-4 py-3`}><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</div></div>)}
    </div>
    <div className="grid min-h-[570px] gap-4 lg:grid-cols-[minmax(290px,.85fr)_minmax(0,1.55fr)]">
      <section className={`${BOX} min-w-0 overflow-hidden`}>
        <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
          <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} className={`${INPUT} pl-10`} placeholder="Başlık, şube, talep numarası ara"/></div>
          <select value={filter} onChange={e=>setFilter(e.target.value)} className={INPUT} aria-label="Talep durumuna göre filtrele">
            <option value="ACTIVE">Tüm durumlar</option><option value="OPEN">Açık</option><option value="IN_PROGRESS">İşlemde</option><option value="COMPLETED">Tamamlandı</option>
          </select>
        </div>
        <div className="max-h-[580px] space-y-1 overflow-y-auto p-2">
          {loading&&<p className="p-4 text-sm text-slate-500">Talepler yükleniyor...</p>}
          {!loading&&filtered.length===0&&<p className="p-5 text-sm text-slate-500">Bu filtreye uygun destek talebi bulunmuyor.</p>}
          {filtered.map(t=><button type="button" key={t.id} onClick={()=>void openThread(t.id)}
            className={`w-full rounded-[5px] border p-3 text-left transition ${selected===t.id?"border-rose-400 bg-rose-50":"border-transparent hover:border-slate-200 hover:bg-slate-50"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-slate-500">#{shortId(t.id)}</span>{tag(STATUS[t.status],STATUS_TONES[t.status])}</div>
            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-900">{unread.includes(t.id)&&<span className="h-2 w-2 rounded-full bg-rose-600" aria-label="Yeni mesaj"/>}{t.subject}</div>
            <div className="mt-1 text-xs text-slate-600">{t.requester_name} · {branchName(t.branch_id)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {tag(PRIORITIES[t.priority]||"Normal",t.priority==="URGENT"?"border-red-200 bg-red-50 text-red-700":undefined)}
              <span>{fmt(t.updated_at)}</span>
            </div>
          </button>)}
        </div>
      </section>
      <section className={`${BOX} min-w-0 overflow-hidden`}>
        {compose ? <form onSubmit={create} className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h4 className="text-lg font-bold text-slate-900">Yeni destek talebi aç</h4><button className={BTN} type="button" onClick={()=>setCompose(false)}><X size={16}/>Vazgeç</button></div>
          <label className="block text-sm font-semibold text-slate-700">Kategori
            <select value={category} onChange={e=>setCategory(e.target.value as SupportCategory)} className={`${INPUT} mt-2`}>
              {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
            </select></label>
          <label className="block text-sm font-semibold text-slate-700">Konu başlığı
            <input className={`${INPUT} mt-2`} required minLength={5} maxLength={140} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Örn. Stok kaydı güncellenmiyor"/></label>
          <label className="block text-sm font-semibold text-slate-700">Sorunun açıklaması
            <textarea className={`${INPUT} mt-2 min-h-36`} required minLength={10} maxLength={5000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Hangi adımda ne olduğunu ayrıntılı yazın."/></label>
          <button disabled={busy} className={PRIMARY} type="submit"><Send size={16}/>{busy?"Gönderiliyor...":"Destek talebini oluştur"}</button>
        </form> : chosen ? <div className="flex min-h-[600px] flex-col">
          <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">#{shortId(chosen.id)} · {branchName(chosen.branch_id)}</p>
                <h4 className="mt-1 break-words text-lg font-bold text-slate-900">{chosen.subject}</h4>
                <p className="mt-1 text-xs text-slate-600">{chosen.requester_name} · {fmt(chosen.created_at)} · {chosen.category}</p></div>
              <div className="flex flex-wrap gap-2">{tag(STATUS[chosen.status],STATUS_TONES[chosen.status])}{tag(PRIORITIES[chosen.priority])}</div>
            </div>
            <div className="rounded-[5px] border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 whitespace-pre-wrap break-words">{chosen.description}</div>
            {developer&&<div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-600">Durum
                <select className={`${INPUT} mt-1`} disabled={busy||Boolean(chosen.archived_at)} value={chosen.status} onChange={e=>void mutate({status:e.target.value as TicketStatus})}>
                  {Object.entries(STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select></label>
              <label className="text-xs font-semibold text-slate-600">Öncelik
                <select className={`${INPUT} mt-1`} disabled={busy} value={chosen.priority} onChange={e=>void mutate({priority:e.target.value as TicketPriority})}>
                  {Object.entries(PRIORITIES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select></label>
              <label className="text-xs font-semibold text-slate-600">Sorumlu
                <select className={`${INPUT} mt-1`} disabled={busy} value={chosen.assigned_to||""} onChange={e=>void mutate({assigned_to:e.target.value||null})}>
                  <option value="">Atanmamış</option>{contacts.filter(c=>c.role.toUpperCase()==="DEVELOPER").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select></label>
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">İlk yanıt: {fmt(chosen.first_response_at)} · Çözüm: {fmt(chosen.resolved_at)}</p>
              {developer&&chosen.status==="COMPLETED"&&
                <button type="button" disabled={busy} onClick={()=>void mutate({archive:!Boolean(chosen.archived_at)})}
                  className={BTN}><Archive size={15}/>{chosen.archived_at?"Arşivden çıkar":"Tamamlananı listeden kaldır"}</button>}
            </div>
          </div>
          <div className="max-h-[370px] min-h-[160px] flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4" aria-live="polite">
            {threadLoading&&<div className="text-sm text-slate-500">Mesaj geçmişi yükleniyor...</div>}
            {!threadLoading&&messages.length===0&&<div className="rounded-[5px] border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Henüz mesaj bulunmuyor. İlk yanıtı yazabilirsiniz.</div>}
            {messages.map(m=><div key={m.id} className={`flex ${m.sender_id===userId?"justify-end":"justify-start"}`}>
              <div className={`max-w-[92%] rounded-[7px] border px-3 py-2.5 text-sm sm:max-w-[83%] ${m.is_internal?"border-amber-300 bg-amber-50 text-amber-950":m.sender_id===userId?"border-rose-200 bg-rose-50 text-slate-900":"border-slate-200 bg-white text-slate-900"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
                  <span>{m.sender_name}{m.is_internal?" · Dahili not":""}</span><span className="font-normal text-slate-500">{fmt(m.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words leading-6">{m.body}</p>
              </div>
            </div>)}
            <div ref={bottom}/>
          </div>
          {chosen.status!=="COMPLETED"&&!chosen.archived_at ? <form onSubmit={send} className="space-y-2 border-t border-slate-200 bg-white p-4">
            <label className="block text-sm font-semibold text-slate-700">Mesaj yazın
              <textarea className={`${INPUT} mt-2 min-h-20`} maxLength={4000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Yanıtınızı buraya yazın..."/></label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {developer?<label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/><LockKeyhole size={14}/>Yalnız geliştiriciye özel dahili not</label>:<span className="text-xs text-slate-500">Yanıtınız destek ekibine iletilir.</span>}
              <button className={PRIMARY} type="submit" disabled={busy||!reply.trim()}><Send size={15}/>Mesaj Gönder</button>
            </div>
          </form>:<div className="border-t border-slate-200 bg-emerald-50 p-4 text-sm text-emerald-900">Bu talep tamamlandı. {developer?"Yeni mesajlaşma için durumu tekrar Açık yapın.":"Yeniden işlem gerekirse yeni destek talebi açın."}</div>}
        </div> : <div className="flex min-h-96 flex-col items-center justify-center px-8 text-center">
          <MessageSquare size={36} className="text-slate-400"/><h4 className="mt-3 text-base font-bold text-slate-900">Talep seçin veya yeni talep oluşturun</h4>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Mesajlaşma, talep durumu, sorumlu ve arşiv işlemleri burada görünür.</p>
        </div>}
      </section>
    </div>
  </div>;
}

function AnnouncementView({onChanged}:{onChanged:()=>void}) {
  const [announcements,setAnnouncements]=useState<Announcement[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [developer,setDeveloper]=useState(false);
  const [unread,setUnread]=useState<string[]>([]);
  const [metrics,setMetrics]=useState<Record<string,{target:number;seen:number;percent:number}>>({});
  const [search,setSearch]=useState("");
  const [viewFilter,setViewFilter]=useState("ALL");
  const [editing,setEditing]=useState<Announcement|null>(null);
  const [compose,setCompose]=useState(false);
  const [title,setTitle]=useState("");const [body,setBody]=useState("");
  const [targets,setTargets]=useState<string[]>([]);
  const [priority,setPriority]=useState<AnnouncementPriority>("NORMAL");
  const [isActive,setIsActive]=useState(true);
  const [published,setPublished]=useState("");
  const [expiry,setExpiry]=useState("");
  const [imageRemove,setImageRemove]=useState(false);
  const [selected,setSelected]=useState<Announcement|null>(null);
  const [insight,setInsight]=useState<Awaited<ReturnType<typeof getAnnouncementInsights>>|null>(null);
  const [insightBusy,setInsightBusy]=useState(false);
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    const result=await getAdvancedAnnouncements();setLoading(false);
    if(!result.ok){setError(result.error);return;}
    setAnnouncements(result.data.announcements);setDeveloper(result.data.developer);
    setUnread(result.data.unreadIds);setBranches(result.data.branches);setMetrics(result.data.metrics);
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const clearComposer=()=>{setEditing(null);setCompose(false);setTitle("");setBody("");setTargets([]);
    setPriority("NORMAL");setIsActive(true);setPublished("");setExpiry("");setImageRemove(false);};
  const edit=(a?:Announcement)=>{
    setSelected(null);setInsight(null);setCompose(true);setEditing(a||null);
    setTitle(a?.title||"");setBody(a?.body||"");
    setTargets(a?(a.target_branch_ids??(a.target_branch_id?[a.target_branch_id]:[])):[]);
    setPriority(a?.priority||"NORMAL");setIsActive(a?.is_active??true);
    setPublished(dateLocal(a?.published_at));setExpiry(dateLocal(a?.expires_at));
    setImageRemove(false);setError("");
  };
  const save=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(busy)return;setBusy(true);setError("");setNotice("");
    const form=new FormData(e.currentTarget);
    form.set("title",title);form.set("body",body);form.set("priority",priority);
    form.set("target_branch_ids",targets.join(","));form.set("is_active",String(isActive));
    form.set("published_at",published?new Date(published).toISOString():"");
    form.set("expires_at",expiry?new Date(expiry).toISOString():"");
    form.set("remove_image",String(imageRemove));
    if(editing)form.set("id",editing.id);
    const r=await saveManagedAnnouncement(form);setBusy(false);
    if(!r.ok){setError(r.error);return;}
    setNotice(editing?"Duyuru güncellendi. Yeni sürüm için okundu istatistikleri sıfırlandı.":"Duyuru kaydedildi.");
    clearComposer();await refresh();onChanged();
  };
  const act=async(a:Announcement,operation:"publish"|"archive"|"delete")=>{
    if(busy)return;
    if(operation==="delete"&&!window.confirm(`"${a.title}" duyurusunu kaldırmak istiyor musunuz? Okunma geçmişi rapor amaçlı korunur.`))return;
    setBusy(true);setError("");
    const r=await manageAnnouncement(a.id,operation);setBusy(false);
    if(!r.ok){setError(r.error);return;}
    setNotice(operation==="delete"?"Duyuru kaldırıldı.":operation==="archive"?"Duyuru yayından alındı.":"Duyuru yeniden yayında.");
    setSelected(null);setInsight(null);await refresh();onChanged();
  };
  const mark=async(a:Announcement)=>{
    const r=await acknowledgeAdvancedAnnouncement(a.id);
    if(!r.ok){setError(r.error);return;}
    setUnread(ids=>ids.filter(id=>id!==a.id));setNotice("Duyuru okundu olarak kaydedildi.");onChanged();
  };
  const openInsight=async(a:Announcement)=>{
    setSelected(a);setInsight(null);setInsightBusy(true);setError("");
    const r=await getAnnouncementInsights(a.id);setInsightBusy(false);
    if(!r.ok){setError(r.error);return;}setInsight(r);
  };
  const activeCount=announcements.filter(a=>a.is_active&&!a.deleted_at).length;
  const filtered=announcements.filter(a=>{
    const matches=(a.title+" "+a.body).toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"));
    return matches&&(viewFilter==="ALL"||(viewFilter==="ACTIVE"?a.is_active:!a.is_active));
  });
  const branchLabel=(a:Announcement)=>{const ids=a.target_branch_ids??(a.target_branch_id?[a.target_branch_id]:[]);
    return !ids.length?"Tüm şubeler":ids.map(id=>branches.find(b=>b.id===id)?.name||"Şube").join(", ");
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-xl font-bold text-slate-900">Duyuru ve Okunma Yönetimi</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Tüm duyuruları yönetin; şube hedefleri, yayın takvimi, okuyan kullanıcılar ve okunma oranlarını inceleyin. Okundu sayısı gerçek kullanıcı onaylarından oluşur.</p></div>
      <div className="flex flex-wrap gap-2"><button className={BTN} disabled={loading} onClick={()=>void refresh()}><RefreshCw size={15}/>Yenile</button>
        {developer&&<button className={PRIMARY} onClick={()=>edit()}><Plus size={16}/>Yeni Duyuru</button>}</div>
    </div>
    {error&&<div role="alert" className="rounded-[5px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    {notice&&<div role="status" className="rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[[ "Toplam duyuru",announcements.length],[ "Yayında",activeCount],[ "Yayından alınan",announcements.length-activeCount],[ "Okunmamış",unread.length]].map(([label,value])=>
        <div key={label} className={`${BOX} px-4 py-3`}><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p></div>)}
    </div>
    {compose&&developer&&<form onSubmit={save} className={`${BOX} space-y-4 p-4 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-bold text-slate-900">{editing?"Duyuruyu Düzenle":"Yeni Duyuru Oluştur"}</h4><button className={BTN} type="button" onClick={clearComposer}><X size={15}/>Vazgeç</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Başlık
          <input className={`${INPUT} mt-2`} required minLength={5} maxLength={150} value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <label className="text-sm font-semibold text-slate-700">Önem derecesi
          <select className={`${INPUT} mt-2`} value={priority} onChange={e=>setPriority(e.target.value as AnnouncementPriority)}>
            <option value="NORMAL">Normal</option><option value="IMPORTANT">Önemli</option><option value="URGENT">Acil</option>
          </select></label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">Duyuru metni
        <textarea className={`${INPUT} mt-2 min-h-36`} required minLength={5} maxLength={6000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Duyurunun açıklamasını girin..."/></label>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[5px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-800">Hedef şubeler</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Hiçbir şube seçilmezse bütün hesaplara yayınlanır. Birden fazla şube seçebilirsiniz.</p>
          <div className="mt-3 grid max-h-44 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {branches.map(b=><label key={b.id} className="flex items-center gap-2 rounded-[4px] border border-slate-200 bg-white p-2 text-sm text-slate-800">
              <input type="checkbox" checked={targets.includes(b.id)} onChange={e=>setTargets(current=>e.target.checked?[...current,b.id]:current.filter(id=>id!==b.id))}/>
              <span className="min-w-0 break-words">{b.name}</span>
            </label>)}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-600">{targets.length?targets.length+" şube seçildi":"Genel duyuru · Tüm şubeler"}</p>
        </section>
        <section className="space-y-3 rounded-[5px] border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-semibold text-slate-700">Yayın tarihi (boşsa şimdi)
            <input type="datetime-local" className={`${INPUT} mt-2`} value={published} onChange={e=>setPublished(e.target.value)}/></label>
          <label className="block text-sm font-semibold text-slate-700">Bitiş tarihi (isteğe bağlı)
            <input type="datetime-local" className={`${INPUT} mt-2`} value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)}/>Yayın aktif (işaret kaldırılırsa taslak/arşiv)
          </label>
        </section>
      </div>
      <label className="block text-sm font-semibold text-slate-700"><FileImage className="mr-1 inline h-4 w-4"/>Duyuru görseli (JPG, PNG, WEBP; en fazla 3 MB)
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className={`${INPUT} mt-2 cursor-pointer`}/></label>
      {editing?.image_url&&<label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={imageRemove} onChange={e=>setImageRemove(e.target.checked)}/>Mevcut görseli kaldır</label>}
      {editing&&<p className="rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Duyuru düzenlendiğinde revizyon numarası artar. Eski okunma kayıtları saklanır; yeni metin için kullanıcıların yeniden okundu onayı vermesi gerekir.</p>}
      <button className={PRIMARY} type="submit" disabled={busy}><Send size={15}/>{busy?"Kaydediliyor...":editing?"Duyuruyu Güncelle":"Duyuruyu Kaydet"}</button>
    </form>}
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
      <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400"/>
        <input className={`${INPUT} pl-10`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Duyuru ara..."/></div>
      <select value={viewFilter} onChange={e=>setViewFilter(e.target.value)} className={INPUT} aria-label="Yayın durumuna göre filtrele">
        <option value="ALL">Tüm duyurular</option><option value="ACTIVE">Yayında</option><option value="ARCHIVED">Yayında değil</option>
      </select>
    </div>
    {loading&&<p className="text-sm text-slate-600">Duyurular yükleniyor...</p>}
    {!loading&&filtered.length===0&&<p className={`${BOX} p-5 text-sm text-slate-600`}>Duyuru bulunmuyor.</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {filtered.map(a=><article key={a.id} className={`${BOX} min-w-0 overflow-hidden`}>
        {a.image_url&&<img src={a.image_url} alt="Duyuru görseli" className="h-40 w-full border-b border-slate-100 bg-slate-50 object-contain"/>}
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {tag(a.priority==="URGENT"?"Acil":a.priority==="IMPORTANT"?"Önemli":"Normal",a.priority==="URGENT"?"border-rose-200 bg-rose-50 text-rose-700":"border-slate-200 bg-slate-100 text-slate-700")}
            {tag(a.is_active?"Yayında":"Yayından kaldırıldı",a.is_active?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-slate-200 bg-slate-100 text-slate-600")}
          </div>
          <h4 className="break-words text-base font-bold text-slate-900">{a.title}</h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{a.body}</p>
          {developer&&metrics[a.id]&&<div className="rounded-[5px] border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-emerald-900">Okunma durumu</span>
              <span className="font-bold tabular-nums text-emerald-900">{metrics[a.id].seen} / {metrics[a.id].target} hesap · %{metrics[a.id].percent}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full rounded-full bg-emerald-600" style={{width:metrics[a.id].percent+"%"}}/>
            </div>
          </div>}
          <div className="space-y-1 text-xs text-slate-600">
            <p><strong>Hedef:</strong> {branchLabel(a)}</p>
            <p><strong>Yayın:</strong> {fmt(a.published_at)} · <strong>Bitiş:</strong> {fmt(a.expires_at)}</p>
            <p><strong>Sürüm:</strong> {a.revision} · <strong>Güncelleme:</strong> {fmt(a.updated_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {unread.includes(a.id)&&a.is_active&&<button className={BTN} onClick={()=>void mark(a)}><CheckCircle2 size={15}/>Okudum</button>}
            {developer&&<>
              <button className={BTN} onClick={()=>void openInsight(a)}><Users size={15}/>Kimler Gördü?</button>
              <button className={BTN} onClick={()=>edit(a)}><Pencil size={15}/>Düzenle</button>
              <button className={BTN} disabled={busy} onClick={()=>void act(a,a.is_active?"archive":"publish")}><Archive size={15}/>{a.is_active?"Yayından Al":"Yayınla"}</button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-[5px] border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50" disabled={busy} onClick={()=>void act(a,"delete")}><Trash2 size={15}/>Kaldır</button>
            </>}
          </div>
        </div>
      </article>)}
    </div>
    {selected&&developer&&<section className={`${BOX} space-y-4 p-4 sm:p-6`} aria-labelledby="announcement-report-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h4 id="announcement-report-title" className="text-lg font-bold text-slate-900">Duyuru Okunma Raporu</h4>
          <p className="mt-1 text-sm text-slate-600">{selected.title} · Sürüm {selected.revision}</p></div>
        <button className={BTN} onClick={()=>{setSelected(null);setInsight(null);}}><X size={15}/>Kapat</button>
      </div>
      {insightBusy&&<p className="text-sm text-slate-600">Okunma bilgileri hazırlanıyor...</p>}
      {insight?.ok&&<>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Hedef hesap",insight.data.total],["Okuyan",insight.data.seen],["Okumayan",insight.data.unseen],["Okunma oranı","%"+insight.data.percent]].map(([k,v])=>
            <div key={k} className="rounded-[5px] border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">{k}</p><p className="mt-1 text-2xl font-bold text-slate-900">{v}</p></div>)}
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:insight.data.percent+"%"}}/></div>
        <div className="flex flex-wrap justify-between gap-3">
          <h5 className="text-sm font-bold text-slate-900">Şubelere göre okuma dağılımı</h5>
          <button className={BTN} onClick={() => downloadReport(
            `DUYURU_OKUNMA_${selected.id.slice(0, 8)}.csv`,
            [
              ["Kullanıcı", "Şube", "Durum", "Okuma Tarihi"],
              ...insight.data.readers.map(p => [p.name, p.branch, "Okudu", fmt(p.read_at)]),
              ...insight.data.unread.map(p => [p.name, p.branch, "Okumadı", ""]),
            ],
          )}>
            <Download size={15}/>CSV Raporu</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {insight.data.byBranch.map(b=><div key={b.name} className="rounded-[5px] border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between gap-2 text-sm"><strong>{b.name}</strong><span>{b.seen}/{b.total}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{width:(b.total?b.seen/b.total*100:0)+"%"}}/></div>
          </div>)}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[5px] border border-emerald-200 bg-emerald-50/30 p-3">
            <h5 className="mb-2 text-sm font-bold text-emerald-900">Okuyan hesaplar ({insight.data.seen})</h5>
            <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {insight.data.readers.map(p=><div key={p.id} className="border-b border-emerald-100 py-2"><strong>{p.name}</strong><p className="text-xs text-slate-600">{p.branch} · {fmt(p.read_at)}</p></div>)}
              {!insight.data.readers.length&&<p className="text-slate-600">Henüz okundu onayı yok.</p>}
            </div>
          </div>
          <div className="rounded-[5px] border border-amber-200 bg-amber-50/30 p-3">
            <h5 className="mb-2 text-sm font-bold text-amber-900">Okumayan hesaplar ({insight.data.unseen})</h5>
            <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {insight.data.unread.map(p=><div key={p.id} className="border-b border-amber-100 py-2"><strong>{p.name}</strong><p className="text-xs text-slate-600">{p.branch}</p></div>)}
              {!insight.data.unread.length&&<p className="text-slate-600">Hedef hesapların tamamı okudu.</p>}
            </div>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-500">Hedef hesap sayısı mevcut kullanıcı profillerinden hesaplanır; aynı kişinin farklı hesapları ayrı sayılır. “Okudu”, duyurunun ilgili sürümünü açıp okundu onayı veren hesap anlamına gelir.</p>
      </>}
    </section>}
  </div>;
}

export default function CommunicationCenter({initialTab,onClose,onChanged}:Props) {
  const [tab,setTab]=useState<Tab>(initialTab);
  useEffect(()=>{setTab(initialTab);},[initialTab]);
  return <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-4">
    <section role="dialog" aria-modal="true" aria-label="LogiStock iletişim yönetim merkezi" className="flex max-h-[96dvh] min-h-[500px] w-full max-w-7xl flex-col overflow-hidden rounded-[8px] border border-slate-600 bg-white shadow-2xl">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-4 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <span className="rounded-[5px] bg-rose-600 p-2.5"><Headset size={20}/></span>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-300">LogiStock / Operasyon ve İletişim</p>
            <h2 className="text-lg font-bold sm:text-xl">Destek ve Duyuru Yönetim Merkezi</h2></div>
        </div>
        <button className="rounded-[5px] border border-white/20 p-2 text-white hover:bg-white/10" type="button" onClick={onClose} aria-label="Pencereyi kapat"><X size={20}/></button>
      </header>
      <div className="flex shrink-0 gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <button type="button" aria-pressed={tab==="support"} onClick={()=>setTab("support")} className={`inline-flex items-center gap-2 rounded-[5px] px-4 py-2.5 text-sm font-bold ${tab==="support"?"bg-rose-600 text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><Headset size={17}/>Destek Talepleri</button>
        <button type="button" aria-pressed={tab==="announcements"} onClick={()=>setTab("announcements")} className={`inline-flex items-center gap-2 rounded-[5px] px-4 py-2.5 text-sm font-bold ${tab==="announcements"?"bg-rose-600 text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><Megaphone size={17}/>Duyurular</button>
      </div>
      <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-6">
        {tab==="support"?<SupportView onChanged={onChanged}/>:<AnnouncementView onChanged={onChanged}/>}
      </main>
    </section>
  </div>;
}
