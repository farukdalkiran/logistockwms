"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CalendarDays, ChevronDown, ChevronUp, Download,
  FileText, RefreshCw, ShieldCheck, Users, Wallet,
} from "lucide-react";
import { getMultinetCalculations, type MultinetRecord } from "@/app/actions/multinet";

type Depot = {id:string;name:string};
type Props = {initialBranchId:string;branches:Depot[];canChooseBranch:boolean};
const MONTHS=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const ISTANBUL_MONTH=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit"})
  .formatToParts(new Date()).reduce((acc,p)=>{
    if(p.type==="year")acc.year=p.value;
    if(p.type==="month")acc.month=p.value;
    return acc;
  },{year:"",month:""}).year+"-"+new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",month:"2-digit"}).format(new Date());
const money=(n:number)=>n.toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const count=(n:number)=>n.toLocaleString("tr-TR",{maximumFractionDigits:1});
const dateLabel=(date:string)=>date.slice(8,10)+"."+date.slice(5,7)+"."+date.slice(0,4);
function csvCell(value:unknown):string {
  const raw=String(value??"");
  const safe=/^[=+\-@\t\r]/.test(raw)?"'"+raw:raw;
  return '"'+safe.replace(/"/g,'""')+'"';
}

export default function MultinetPanel({initialBranchId,branches,canChooseBranch}:Props) {
  const [branchId,setBranchId]=useState(initialBranchId);
  const [period,setPeriod]=useState(ISTANBUL_MONTH);
  const [dailyFee,setDailyFee]=useState(600);
  const [records,setRecords]=useState<MultinetRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [expanded,setExpanded]=useState<string[]>([]);
  const [refreshKey,setRefreshKey]=useState(0);
  const [query,setQuery]=useState("");

  useEffect(()=>{
    let active=true;
    const [year,month]=period.split("-").map(Number);
    setLoading(true);
    setError("");
    getMultinetCalculations(branchId,year,month,dailyFee)
      .then(data=>{if(active){setRecords(data);setExpanded([]);}})
      .catch(e=>{if(active){setRecords([]);setError(e instanceof Error?e.message:"Hesaplama başarısız.");}})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[period,dailyFee,branchId,refreshKey]);

  const [year,month]=period.split("-").map(Number);
  const nextMonth=month===12?1:month+1;
  const nextYear=month===12?year+1:year;
  const selectedName=MONTHS[month-1]||"";
  const targetName=MONTHS[nextMonth-1]||"";
  const branchName=branches.find(b=>b.id===branchId)?.name||"Depo";
  const totals=useMemo(()=>records.reduce((acc,r)=>({
    total:acc.total+r.totalAmount,net:acc.net+r.netDays,
    deduction:acc.deduction+r.deductedDays,extra:acc.extra+r.extraDays,
    missing:acc.missing+r.missingDays,leave:acc.leave+r.leaveDays,
    report:acc.report+r.reportDays,holiday:acc.holiday+r.holidayProtectedDays,
  }),{total:0,net:0,deduction:0,extra:0,missing:0,leave:0,report:0,holiday:0}),[records]);
  const filtered=records.filter(r=>r.fullName.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  const toggle=(id:string)=>setExpanded(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);

  function exportCsv() {
    if(!records.length || loading || error)return;
    const header=["Personel","Depo","Kaynak Ay","Ödeme Ayı","Hedef Gün","Çalışılan Gün",
      "Ek Mesai","İzin Kesintisi","Rapor Kesintisi","Eksik Gün Kesintisi","Toplam Kesinti",
      "Resmî Tatil Korunan","Net Gün","1. Ödeme (TL)","15. Ödeme (TL)","Toplam (TL)","Kesinti Detayları"];
    const lines=[
      header.map(csvCell).join(";"),
      ...records.map(r=>[
        r.fullName,branchName,period,String(nextYear)+"-"+String(nextMonth).padStart(2,"0"),
        r.baseDays,r.workedDays,r.extraDays,r.leaveDays,r.reportDays,r.missingDays,
        r.deductedDays,r.holidayProtectedDays,r.netDays,r.part1,r.part2,r.totalAmount,
        r.deductions.map(d=>dateLabel(d.date)+" "+d.reason+" ("+count(d.days)+" gün)").join("\n")
      ].map(csvCell).join(";"))
    ];
    const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download="Multinet_"+period+"_"+branchName.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ-]+/g,"_")+".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 space-y-5 text-slate-900">
      <header className="bg-slate-900 text-white border-l-4 border-[#dc3545] rounded-[5px] p-5 md:p-6">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="uppercase text-[11px] tracking-widest font-bold text-red-300">İnsan Kaynakları · Yemek Bakiyesi</p>
            <h1 className="font-bold text-xl md:text-2xl mt-2">Multinet Hakediş & Kesinti Raporu</h1>
            <p className="text-slate-300 text-sm mt-2 leading-6">
              {selectedName} {year} devamsızlık ve izinleri, {targetName} {nextYear} ayının hafta içi günlerinden düşülür.
              Resmî tatillerde kesinti yapılmaz. Açık ay için yalnızca tamamlanan günler değerlendirilir.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-300 mt-3">
              <ShieldCheck size={16}/><span>Veriler yalnızca seçili deponun personeliyle sınırlandırılır.</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            {canChooseBranch&&(
              <label className="block text-xs text-slate-300">Depo
                <select value={branchId} onChange={e=>setBranchId(e.target.value)}
                  className="block mt-1 bg-slate-800 text-white border border-slate-600 p-2.5 min-w-[160px] h-10 rounded-[5px] text-sm">
                  {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
            <label className="block text-xs text-slate-300">Kaynak dönem
              <input type="month" value={period} onChange={e=>setPeriod(e.target.value)}
                className="block mt-1 bg-slate-800 border border-slate-600 text-white rounded-[5px] h-10 p-2 text-sm"/>
            </label>
            <label className="block text-xs text-slate-300">Günlük bedel (TL)
              <input type="number" min="0" max="100000" step="0.01" value={dailyFee}
                onChange={e=>setDailyFee(Number(e.target.value))}
                className="block mt-1 w-32 bg-slate-800 border border-slate-600 text-white rounded-[5px] h-10 p-2 text-sm"/>
            </label>
            <button type="button" onClick={()=>setRefreshKey(n=>n+1)} disabled={loading}
              className="h-10 p-2.5 rounded-[5px] border border-slate-600 text-white hover:bg-slate-800 disabled:opacity-50"
              aria-label="Hesaplamayı yenile" title="Yenile"><RefreshCw size={17}/></button>
            <button type="button" onClick={exportCsv} disabled={!records.length||loading||!!error}
              className="h-10 inline-flex items-center gap-2 px-4 rounded-[5px] bg-[#dc3545] text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">
              <Download size={16}/> CSV / Excel
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
        <p className="text-slate-600"><strong className="text-slate-900">{branchName}</strong> · Ödeme dönemi: <strong>{targetName} {nextYear}</strong></p>
        <p className="text-xs text-slate-500">Hesap: sonraki ayın hafta içi günleri + ek mesai − rapor / izin / devamsızlık</p>
      </div>

      {error&&<div role="alert" className="flex items-start gap-2 p-4 rounded-[5px] bg-red-50 border border-red-200 text-sm text-red-800">
        <AlertCircle size={18}/><span>{error}</span>
      </div>}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Multinet özeti">
        {[
          {label:"Toplam ödeme",value:money(totals.total),icon:<Wallet size={18}/>,accent:"border-l-[#dc3545]"},
          {label:"Personel",value:count(records.length),icon:<Users size={18}/>,accent:"border-l-blue-500"},
          {label:"Toplam kesinti",value:count(totals.deduction)+" gün",icon:<FileText size={18}/>,accent:"border-l-amber-500"},
          {label:"Korunan resmî tatil",value:count(totals.holiday)+" gün",icon:<CalendarDays size={18}/>,accent:"border-l-emerald-500"},
        ].map(item=>(
          <article key={item.label} className={"bg-white border border-slate-200 border-l-4 rounded-[5px] p-4 "+item.accent}>
            <div className="flex justify-between text-slate-500 text-xs font-semibold gap-2"><span>{item.label}</span>{item.icon}</div>
            <strong className="block mt-3 text-xl md:text-2xl break-words">{loading?"…":item.value}</strong>
          </article>
        ))}
      </section>

      <section className="bg-white border border-slate-200 rounded-[5px] overflow-hidden">
        <div className="flex flex-wrap justify-between items-center gap-3 p-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold">Personel bazlı hakediş</h2>
            <p className="mt-1 text-xs text-slate-500">Kesinti sebeplerini görmek için personel satırını açın.</p>
          </div>
          <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Personel ara…" aria-label="Personel ara"
            className="border border-slate-300 px-3 py-2 rounded-[5px] text-sm min-w-[200px]"/>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 text-xs">
              <tr>
                <th className="p-3">Personel</th><th className="p-3 text-center">Hedef</th>
                <th className="p-3 text-center">Ek</th><th className="p-3 text-center">İzin</th>
                <th className="p-3 text-center">Rapor</th><th className="p-3 text-center">Eksik gün</th>
                <th className="p-3 text-center">Net gün</th><th className="p-3 text-right">1 {targetName}</th>
                <th className="p-3 text-right">15 {targetName}</th><th className="p-3 text-right">Toplam</th>
                <th className="p-3 text-center">Açıklama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading?<tr><td colSpan={11} className="text-center p-8 text-slate-500">Depo verileri hesaplanıyor…</td></tr>:
                filtered.length===0?<tr><td colSpan={11} className="text-center p-8 text-slate-500">Gösterilecek personel bulunamadı.</td></tr>:
                filtered.map(r=>{
                  const open=expanded.includes(r.employeeId);
                  return (
                    <tr key={r.employeeId} className="align-top">
                      <td className="p-3 font-semibold whitespace-nowrap">{r.fullName}</td>
                      <td className="p-3 text-center">{count(r.baseDays)}</td>
                      <td className="p-3 text-center text-emerald-700">+{count(r.extraDays)}</td>
                      <td className="p-3 text-center text-amber-700">{count(r.leaveDays)}</td>
                      <td className="p-3 text-center text-amber-700">{count(r.reportDays)}</td>
                      <td className="p-3 text-center text-red-700">{count(r.missingDays)}</td>
                      <td className="p-3 text-center font-bold">{count(r.netDays)}</td>
                      <td className="p-3 text-right whitespace-nowrap">{money(r.part1)}</td>
                      <td className="p-3 text-right whitespace-nowrap">{money(r.part2)}</td>
                      <td className="p-3 text-right font-bold whitespace-nowrap">{money(r.totalAmount)}</td>
                      <td className="p-3 text-center">
                        <button type="button" aria-expanded={open} aria-controls={"detail-"+r.employeeId}
                          onClick={()=>toggle(r.employeeId)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 rounded-[5px] hover:bg-slate-200 text-xs font-semibold">
                          {open?<ChevronUp size={14}/>:<ChevronDown size={14}/>} Detay
                        </button>
                        {open&&(
                          <div id={"detail-"+r.employeeId} className="text-left mt-3 w-[260px] md:w-[340px] max-w-[70vw] bg-slate-50 border border-slate-200 rounded-[5px] p-3 space-y-3 text-xs font-normal">
                            <p className="font-bold text-slate-900">Kesinti nedenleri ({count(r.deductedDays)} gün)</p>
                            {r.deductions.length===0?<p className="text-emerald-700">Kesinti bulunmuyor.</p>:
                              <ul className="space-y-2">{r.deductions.map((d,i)=>(
                                <li key={d.date+"-"+d.kind+"-"+i} className="border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                                  <div className="flex justify-between gap-3">
                                    <span className="font-semibold">{dateLabel(d.date)} · {d.kind==="REPORT"?"Rapor":d.kind==="LEAVE"?"İzin":"Eksik gün"}</span>
                                    <span className="text-red-700 whitespace-nowrap">−{count(d.days)} gün</span>
                                  </div>
                                  <p className="text-slate-600 mt-1 whitespace-normal break-words">{d.reason}</p>
                                </li>
                              ))}</ul>}
                            {r.holidayNotes.length>0&&<div className="border-t border-slate-200 pt-2">
                              <p className="font-bold text-emerald-700 mb-1">Kesilmeyen resmî tatiller</p>
                              {r.holidayNotes.map((note,i)=><p key={i} className="mt-1 text-slate-600 whitespace-normal">{note}</p>)}
                            </div>}
                            {r.details.length>0&&<div className="border-t border-slate-200 pt-2">
                              <p className="font-bold text-blue-700 mb-1">Ek mesai</p>
                              {r.details.map((note,i)=><p key={i} className="mt-1 whitespace-normal text-slate-600">{note}</p>)}
                            </div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-slate-500">Hesaplama bilgilendirme amaçlıdır. Onaylanmış izin, puantaj ve tatil kayıtlarının son durumuna göre yenilenir. Günlük bedel burada değiştirilebilir; veri tabanındaki kayıtlar güncellenmez.</p>
    </div>
  );
}
