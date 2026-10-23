"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, Loader2, PackageCheck, RefreshCcw, Search, Send, ShieldCheck, X } from "lucide-react";
import { getApprovalOrders, getApprovalDetail, decideApproval } from "@/app/actions/order-approvals";
import { DEFAULT_FILTERS, dateLabel, kindLabel, numberLabel, statusLabel, type Filters, type ListResult, type OrderDetail } from "@/lib/order-approvals/types";

export default function StoreOrderApprovalPage(){
 const [filters,setFilters]=useState<Filters>({...DEFAULT_FILTERS});
 const [data,setData]=useState<ListResult|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [detail,setDetail]=useState<OrderDetail|null>(null),[detailLoading,setDetailLoading]=useState(false);
 const [qty,setQty]=useState<Record<string,number>>({}),[reasons,setReasons]=useState<Record<string,string>>({});
 const [empId,setEmpId]=useState(""),[note,setNote]=useState(""),[saving,setSaving]=useState(false),[notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
   setLoading(true);setError("");
   const r=await getApprovalOrders(filters);
   if(r.ok)setData(r.data);else setError(r.error);
   setLoading(false);
 },[filters]);
 useEffect(()=>{void refresh();},[refresh]);
 const open=async(id:string)=>{
   setDetailLoading(true);setError("");setNotice("");
   const r=await getApprovalDetail(id);
   if(r.ok){setDetail(r.data);setQty(Object.fromEntries(r.data.items.map(i=>[i.id,i.approved_qty??i.requested_qty])));setReasons(Object.fromEntries(r.data.items.map(i=>[i.id,i.revision_reason||""])));}
   else setError(r.error);
   setDetailLoading(false);
 };
 const act=async(action:"APPROVE"|"REJECT")=>{
   if(!detail||saving)return;
   if(!/^\d{1,5}$/.test(empId.trim())){setNotice("İşlemi yapan personelin sayısal ID bilgisini giriniz.");return;}
   setSaving(true);setNotice("");
   const res=await decideApproval({orderId:detail.id,employeeId:empId.trim(),action,note,items:detail.items.map(x=>({id:x.id,qty:Math.max(0,Number(qty[x.id]??x.requested_qty)),reason:reasons[x.id]||""}))});
   if(res.ok){setDetail(null);setNotice("Sipariş kararı sisteme işlendi.");await refresh();}
   else setNotice(res.error);
   setSaving(false);
 };
 const count=Math.max(1,Math.ceil((data?.count||0)/filters.pageSize));
 return <div className="mx-auto max-w-[1280px] space-y-5">
   <div className="rounded-2xl bg-[#111827] text-white p-6 border-b-4 border-orange-500 shadow-sm">
     <div className="flex items-center gap-2 text-orange-300 font-black tracking-[.15em] text-[10px]"><ShieldCheck size={14}/> ONLINE DEPO · YETKİLİ SİPARİŞ KONTROLÜ</div>
     <div className="mt-2 flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-2xl font-black">Mağaza Siparişleri</h1><p className="text-sm mt-1 text-slate-300">Bekleyen siparişleri, ürün kalemlerini ve onay durumlarını görüntüleyin.</p></div><button type="button" onClick={()=>void refresh()} className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-bold flex items-center gap-2"><RefreshCcw size={16}/> Yenile</button></div>
   </div>
   {notice&&<div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">{notice}</div>}
   {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-2 text-sm text-red-700"><AlertCircle size={17}/>{error}</div>}
   <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
    {([["Onay bekleyen",data?.metrics.pending],["Hazırlanıyor",data?.metrics.preparing],["Gönderiliyor",data?.metrics.ready_to_ship],["Reddedilen",data?.metrics.rejected],["Bekleyen adet",data?.metrics.pending_quantity]] as const).map(([title,value])=><div key={title} className="rounded-xl bg-white p-3 border border-slate-200"><p className="text-[11px] text-slate-500 font-bold">{title}</p><p className="mt-1 text-xl font-black">{numberLabel(value||0)}</p></div>)}
   </div>
   <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-3">
     <label className="flex-1 min-w-[220px] flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={16} className="text-slate-400"/><input className="min-w-0 w-full py-2.5 text-sm outline-none" value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value.slice(0,120),page:1}))} placeholder="Sipariş, mağaza veya talep eden..."/></label>
     <select aria-label="Durum" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value as Filters["status"],page:1}))}>
       <option value="ALL">Tüm durumlar</option><option value="PENDING">Onay bekleyen</option><option value="PREPARING">Hazırlanıyor</option><option value="READY_TO_SHIP">Gönderiliyor</option><option value="REJECTED">Reddedilen</option>
     </select>
     <select aria-label="Tür" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={filters.kind} onChange={e=>setFilters(f=>({...f,kind:e.target.value as Filters["kind"],page:1}))}><option value="ALL">Tümü</option><option value="PRODUCT">Ürün</option><option value="CONSUMABLE">Sarf</option><option value="MIXED">Karma</option></select>
   </div>
   <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
     <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
       <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide"><tr><th className="p-4">Sipariş</th><th className="p-4">Mağaza / Talep Eden</th><th className="p-4">Tür</th><th className="p-4 text-right">İstenen</th><th className="p-4">Durum</th><th className="p-4 text-right">İşlem</th></tr></thead>
       <tbody className="divide-y divide-slate-100">
       {loading&&<tr><td className="p-10 text-center text-slate-500" colSpan={6}><Loader2 className="inline animate-spin" size={20}/> Siparişler yükleniyor…</td></tr>}
       {!loading&&!data?.rows.length&&<tr><td className="p-10 text-center text-slate-500" colSpan={6}>Kriterlere uygun sipariş bulunmadı.</td></tr>}
       {!loading&&data?.rows.map(o=><tr key={o.id} className="hover:bg-slate-50">
         <td className="p-4"><b className="text-slate-900">{o.order_code}</b><div className="text-[11px] text-slate-400 mt-1">{dateLabel(o.created_at,true)}</div></td>
         <td className="p-4"><div className="font-bold">{o.branch_name}</div><div className="text-[11px] text-slate-500">{o.requester_name}</div></td>
         <td className="p-4 text-slate-600">{kindLabel(o)}</td><td className="p-4 text-right font-black">{numberLabel(o.requested_total)}</td>
         <td className="p-4"><span className="rounded-lg bg-orange-50 text-orange-700 px-2.5 py-1 text-[11px] font-black">{statusLabel(o.status)}</span></td>
         <td className="p-4 text-right"><button type="button" onClick={()=>void open(o.id)} className="rounded-lg bg-[#111827] text-white px-3 py-2 text-[11px] font-bold whitespace-nowrap">Talebi İncele <ArrowRight size={12} className="inline"/></button></td>
       </tr>)}
       </tbody>
     </table></div>
     <div className="border-t p-4 flex justify-between items-center text-xs text-slate-500"><span>{numberLabel(data?.count||0)} sipariş</span><div className="flex items-center gap-2"><button type="button" disabled={filters.page<=1} onClick={()=>setFilters(f=>({...f,page:f.page-1}))} className="rounded border p-2 disabled:opacity-40"><ChevronLeft size={16}/></button><span>{filters.page} / {count}</span><button type="button" disabled={filters.page>=count} onClick={()=>setFilters(f=>({...f,page:f.page+1}))} className="rounded border p-2 disabled:opacity-40"><ChevronRight size={16}/></button></div></div>
   </div>
   {detailLoading&&<div className="fixed inset-0 z-[10050] bg-slate-950/50 flex items-center justify-center text-white"><Loader2 className="animate-spin" size={28}/></div>}
   {detail&&<div className="fixed inset-0 z-[10050] bg-slate-950/70 backdrop-blur-sm p-4 md:p-8 flex items-center justify-center" onClick={()=>setDetail(null)}>
      <div onClick={e=>e.stopPropagation()} className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#111827] text-white p-5 flex justify-between items-start gap-3">
          <div><div className="text-[10px] text-orange-300 font-black uppercase">Sipariş detayı</div><h2 className="text-xl font-black mt-1">{detail.order_code}</h2><p className="text-xs text-slate-300 mt-1">{detail.branch_name} · {detail.requester_name} · {statusLabel(detail.status)}</p></div>
          <button type="button" onClick={()=>setDetail(null)} aria-label="Kapat"><X size={20}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="border rounded-lg overflow-x-auto"><table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[11px]"><tr><th className="text-left p-3">Ürün</th><th className="text-right p-3">Talep</th><th className="text-right p-3">Depo</th><th className="text-right p-3">Onay adedi</th><th className="text-left p-3">Gerekçe</th></tr></thead>
            <tbody>{detail.items.map(i=><tr key={i.id} className="border-t"><td className="p-3"><b>{i.product?.name||"Ürün"}</b><p className="text-[11px] text-slate-500">{i.product?.sku||"SKU yok"}</p></td><td className="text-right p-3">{i.requested_qty}</td><td className="text-right p-3">{i.warehouse_stock}</td><td className="p-3"><input type="number" min={0} disabled={detail.status!=="PENDING"} className="border rounded-md text-right p-2 w-24" value={qty[i.id]??i.requested_qty} onChange={e=>setQty(v=>({...v,[i.id]:Number(e.target.value)||0}))}/></td><td className="p-3"><input disabled={detail.status!=="PENDING"} className="border rounded-md p-2 w-full min-w-28 text-xs" value={reasons[i.id]||""} onChange={e=>setReasons(v=>({...v,[i.id]:e.target.value.slice(0,500)}))} placeholder="Revize nedeni"/></td></tr>)}</tbody>
          </table></div>
          {detail.status==="PENDING"&&<div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
            <div className="text-xs font-black text-orange-900">ONAY / RED KARARI</div>
            <div className="flex flex-wrap gap-2"><input value={empId} onChange={e=>setEmpId(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="Personel ID" className="flex-1 border rounded-lg text-sm p-3 min-w-32"/><input value={note} onChange={e=>setNote(e.target.value.slice(0,2000))} placeholder="İşlem notu" className="flex-[2] border rounded-lg text-sm p-3 min-w-48"/></div>
            {notice&&<p className="text-xs text-red-600">{notice}</p>}
            <div className="flex gap-2 justify-end"><button disabled={saving} type="button" onClick={()=>void act("REJECT")} className="rounded-lg px-4 py-2 bg-white border border-red-300 text-red-700 text-xs font-black disabled:opacity-50">Reddet</button><button disabled={saving} type="button" onClick={()=>void act("APPROVE")} className="rounded-lg px-4 py-2 bg-orange-500 text-white text-xs font-black disabled:opacity-50 flex items-center gap-2">{saving?<Loader2 size={14} className="animate-spin"/>:<CheckCircle2 size={14}/>} Onayla</button></div>
          </div>}
          {!!detail.events.length&&<section className="border rounded-xl p-4"><h3 className="font-black text-sm">İşlem geçmişi</h3>{detail.events.map(e=><div key={e.id} className="border-t mt-2 pt-2 text-xs text-slate-600">{e.action} · {e.actor_name} · {dateLabel(e.created_at)}{e.note&&<p>{e.note}</p>}</div>)}</section>}
        </div>
      </div>
   </div>}
 </div>;
}
