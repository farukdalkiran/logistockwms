"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, Download,
  FileSpreadsheet, History, Search, ShieldCheck, UploadCloud, UserRound, Users, X,
} from "lucide-react";
import type { LeaveDashboardData, LeaveEmployee } from "@/lib/hr/leave-management";
import { applyLeaveBalanceChanges, type LeaveBalanceChange } from "@/app/actions/hr-leave-management";

const card = "rounded-[5px] border border-slate-200 bg-white shadow-sm";
const field = "w-full rounded-[5px] border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#dc3545]";
const fmt = (n:number) => n.toLocaleString("tr-TR",{maximumFractionDigits:2});
const trDate = (date:string|null) => date ? date.split("-").reverse().join(".") : "-";
const clean = (v:unknown) => String(v??"").trim();
const formatStamp = (date:string) => new Date(date).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"});
const requestLabel = (type:string) => ({
  YILLIK_IZIN:"Yıllık izin", SAGLIK_RAPORU:"Sağlık raporu", MAZERET:"Mazeret",
  UCRETSİZ:"Ücretsiz izin", EVLILIK:"Evlilik izni", DIGER:"Diğer",
} as Record<string,string>)[type] || type.replace(/_/g," ");
const parseAmount = (v:unknown) => {
  if (v===null||v===undefined||clean(v)==="") return NaN;
  const text=typeof v==="number" ? String(v) : clean(v).replace(",",".");
  return Number(text);
};
const parseHireDate = (v:unknown):string|null => {
  if(v===null || v===undefined || clean(v)==="") return null;
  if(typeof v==="number"){
    const dt=new Date(Math.round((v-25569)*86400000));
    return isNaN(dt.getTime())?null:dt.toISOString().slice(0,10);
  }
  const s=clean(v);
  const m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const out=m ? `${m[3]}-${m[2]}-${m[1]}` : s;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(out)) return null;
  const dt=new Date(out+"T12:00:00Z");
  return !Number.isFinite(dt.getTime()) || dt.toISOString().slice(0,10)!==out ? null : out;
};

function Statistic({title,value,description,icon:Icon}:{title:string;value:string|number;description:string;icon:typeof Users}) {
  return <div className={card+" p-4"}>
    <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">{title}<Icon className="h-4 w-4 text-[#dc3545]"/></div>
    <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
    <p className="mt-1 text-xs text-slate-500">{description}</p>
  </div>;
}
function StatusTag({ok,children}:{ok:boolean;children:React.ReactNode}) {
  return <span className={`inline-block rounded-[5px] border px-2 py-1 text-xs font-bold ${ok?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-amber-200 bg-amber-50 text-amber-700"}`}>{children}</span>;
}
type Parsed = {employee:LeaveEmployee;newBalance:number;newDate:string|null};
function getWorkbookChanges(rows:Record<string,unknown>[], employees:LeaveEmployee[]) {
  if(rows.length>250) throw new Error("Bir şablonda en fazla 250 personel olabilir.");
  const byId=new Map(employees.map(e=>[e.id,e]));
  const seen=new Set<string>();
  const changes:Parsed[]=[];
  const issues:string[]=[];
  rows.forEach((row,index)=>{
    const line=index+2;
    const id=clean(row["PERSONEL ID"]);
    if(!id && !clean(row["PERSONEL ADI SOYADI"])) return;
    if(!/^\d{5}$/.test(id)) {issues.push(`Satır ${line}: PERSONEL ID tam 5 haneli olmalı.`);return;}
    if(seen.has(id)){issues.push(`Satır ${line}: ${id} birden fazla kez kullanılmış.`);return;}
    seen.add(id);
    const employee=byId.get(id);
    if(!employee){issues.push(`Satır ${line}: ${id} kayıtlı değil veya şubenizde bulunmuyor.`);return;}
    if(!employee.is_active){issues.push(`Satır ${line}: ${id} pasif personel.`);return;}
    if(clean(row["PERSONEL ADI SOYADI"]).toLocaleLowerCase("tr-TR") !== employee.full_name.toLocaleLowerCase("tr-TR")){
      issues.push(`Satır ${line}: ${id} isim eşleşmiyor.`);return;
    }
    const amount=parseAmount(row["KALAN İZİN (DÜZENLE)"]);
    if(!Number.isFinite(amount) || amount < -14 || amount > 999 || Math.round(amount*100)!==amount*100){
      issues.push(`Satır ${line}: KALAN İZİN değeri -14 ile 999 arasında sayısal bir değer olmalı.`);return;
    }
    const rawDate=row["İŞE GİRİŞ TARİHİ"];
    const date=parseHireDate(rawDate);
    if(clean(rawDate) && !date){issues.push(`Satır ${line}: İşe giriş tarihi geçersiz.`);return;}
    if((employee.leave_balance??0)!==amount || (date && date!==employee.employment_date)){
      changes.push({employee,newBalance:amount,newDate:date});
    }
  });
  return {changes,issues};
}

export default function LeaveManagementPanel({data}:{data:LeaveDashboardData}){
  const router=useRouter();
  const inputRef=useRef<HTMLInputElement>(null);
  const [search,setSearch]=useState("");
  const [balanceFilter,setBalanceFilter]=useState("ALL");
  const [selected,setSelected]=useState<string|null>(data.employees[0]?.id||null);
  const [preview,setPreview]=useState<Parsed[]>([]);
  const [warnings,setWarnings]=useState<string[]>([]);
  const [filename,setFilename]=useState("");
  const [reason,setReason]=useState("");
  const [updating,setUpdating]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [manual,setManual]=useState<string>("");
  const [manualDate,setManualDate]=useState<string>("");
  const [manualReason,setManualReason]=useState("");
  const [manualBusy,setManualBusy]=useState(false);

  const employee=data.employees.find(e=>e.id===selected)||data.employees[0];
  const leaves=useMemo(()=>data.leaves.filter(l=>l.employee_id===employee?.id),[data.leaves,employee?.id]);
  const audits=useMemo(()=>data.audits.filter(a=>a.employee_id===employee?.id),[data.audits,employee?.id]);
  const active=data.employees.filter(e=>e.is_active);
  const deficits=active.filter(e=>Number(e.leave_balance??0)<0);
  const low=active.filter(e=>(e.leave_balance??0)>=0&&(e.leave_balance??0)<=3);
  const annual=data.leaves.filter(l=>l.leave_type==="YILLIK_IZIN"&&l.status==="APPROVED");
  const pending=data.leaves.filter(l=>l.status==="PENDING");
  const used=annual.reduce((a,l)=>a+l.requested_days,0);
  const total=active.reduce((a,e)=>a+Number(e.leave_balance??0),0);
  const shown=data.employees.filter(e=>{
    const matched=`${e.full_name} ${e.id} ${e.position_title||""} ${e.branch_name}`
      .toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"));
    if(!matched)return false;
    if(balanceFilter==="NEGATIVE")return (e.leave_balance??0)<0;
    if(balanceFilter==="LOW")return (e.leave_balance??0)>=0&&(e.leave_balance??0)<=3;
    if(balanceFilter==="ACTIVE")return e.is_active;
    if(balanceFilter==="INACTIVE")return !e.is_active;
    return true;
  });

  const exportSheet=async(mode:"template"|"report")=>{
    const XLSX=await import("xlsx");
    const wb=XLSX.utils.book_new();
    const rows=data.employees.map(e=>({
      "PERSONEL ID":e.id,
      "PERSONEL ADI SOYADI":e.full_name,
      "ŞUBE":e.branch_name,
      "ÜNVAN":e.position_title||"",
      "İŞE GİRİŞ TARİHİ":e.employment_date||"",
      "MEVCUT BAKİYE":e.leave_balance??"",
      "KALAN İZİN (DÜZENLE)":e.leave_balance??"",
      ...(mode==="report"?{"AKTİF":e.is_active?"Evet":"Hayır","WEB HESABI":e.account?.email||""}:{}),
    }));
    const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{"PERSONEL ID":"Kayıt yok"}]);
    ws["!cols"]=[{wch:16},{wch:33},{wch:22},{wch:24},{wch:22},{wch:18},{wch:24},{wch:12},{wch:33}];
    XLSX.utils.book_append_sheet(wb,ws,"Personel İzin Bakiyesi");
    if(mode==="report"){
      const leaveRows=data.leaves.map(l=>({
        "PERSONEL ID":l.employee_id,"İZİN TÜRÜ":requestLabel(l.custom_leave_type||l.leave_type),
        "BAŞLANGIÇ":l.start_date,"BİTİŞ":l.end_date,"GÜN":l.requested_days,
        "YARIM GÜN":l.is_half_day?"Evet":"Hayır","DURUM":l.status,
        "AÇIKLAMA":l.reason||"",
      }));
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(leaveRows.length?leaveRows:[{"KAYIT":"Bulunamadı"}]),"İzin Talepleri");
    }
    XLSX.writeFile(wb,`LogiStock_${mode==="template"?"Izin_Sablonu":"Izin_Raporu"}_${data.year}.xlsx`);
  };

  const readFile=async(file:File)=>{
    setError("");setSuccess("");setPreview([]);setWarnings([]);setFilename(file.name);
    if(!/\.(xlsx|xls)$/i.test(file.name) || file.size>2*1024*1024){
      setError("Yalnızca 2 MB altındaki .xlsx veya .xls dosyaları kabul edilir.");return;
    }
    try{
      const XLSX=await import("xlsx");
      const workbook=XLSX.read(await file.arrayBuffer(),{type:"array"});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];
      if(!sheet)throw Error("Excel çalışma sayfası bulunamadı.");
      const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:null,raw:true});
      if(!rows.length)throw Error("Excel dosyası boş.");
      if(!rows[0] || !("PERSONEL ID" in rows[0]) ||
        !("PERSONEL ADI SOYADI" in rows[0]) || !("KALAN İZİN (DÜZENLE)" in rows[0])){
        throw Error("Eski şablon algılandı. Önce yeni ID'li izin şablonunu indirip onu düzenleyin.");
      }
      const {changes,issues}=getWorkbookChanges(rows,data.employees);
      setPreview(changes);setWarnings(issues);
      if(!changes.length && !issues.length)setSuccess("Şablonda mevcut bakiyelerden farklı bir değişiklik bulunmadı.");
    }catch(e){setError(e instanceof Error?e.message:"Excel dosyası işlenemedi.");}
  };

  const submitChanges=async()=>{
    if(!preview.length||warnings.length)return;
    setUpdating(true);setError("");setSuccess("");
    try{
      const updates:LeaveBalanceChange[]=preview.map(p=>({
        id:p.employee.id, full_name:p.employee.full_name, leave_balance:p.newBalance,
        expected_balance:p.employee.leave_balance, employment_date:p.newDate,
      }));
      const result=await applyLeaveBalanceChanges({updates,reason,branchId:data.branchId});
      setSuccess(`${result.updated} personel güncellendi, ${result.unchanged} kayıt değişmedi. İşlem geçmişe kaydedildi.`);
      setPreview([]);setWarnings([]);setFilename("");setReason("");
      if(inputRef.current)inputRef.current.value="";
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Değişiklikler kaydedilemedi.");}
    finally{setUpdating(false);}
  };

  const saveOne=async()=>{
    if(!employee)return;
    setManualBusy(true);setError("");setSuccess("");
    try{
      const amount=parseAmount(manual);
      const date=manualDate||null;
      const result=await applyLeaveBalanceChanges({branchId:employee.branch_id,
        reason:manualReason,updates:[{
          id:employee.id,full_name:employee.full_name,leave_balance:amount,
          expected_balance:employee.leave_balance,employment_date:date,
        }]});
      setSuccess(`${result.updated} personelin izin bakiyesi güncellendi ve kayıt altına alındı.`);
      setManualReason("");router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"İşlem başarısız.");}
    finally{setManualBusy(false);}
  };
  const choose=(e:LeaveEmployee)=>{
    setSelected(e.id);setManual(String(e.leave_balance??""));setManualDate(e.employment_date||"");
    setManualReason("");setError("");
  };
  const currentManual=employee && selected===employee.id ? manual : String(employee?.leave_balance??"");
  const currentDate=employee && selected===employee.id ? manualDate : employee?.employment_date||"";

  return <main className="space-y-5 pb-12">
    <header className="flex flex-col justify-between gap-5 rounded-[5px] border-l-[5px] border-[#dc3545] bg-[#0F172B] p-6 text-white lg:flex-row lg:items-center">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-red-300">LogiStock / İK Operasyon</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">İzin Yönetimi ve Personel Bakiyeleri</h1>
        <p className="mt-2 text-sm text-slate-300">Yıllık izin, rapor, personel ilişkileri, güvenli Excel ve değişiklik geçmişi.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/management/hr/insights" className="rounded-[5px] border border-slate-600 px-4 py-2.5 text-xs font-bold text-white">Personel 360</Link>
        <button type="button" onClick={()=>exportSheet("report")} className="inline-flex items-center gap-2 rounded-[5px] bg-[#dc3545] px-4 py-2.5 text-xs font-bold text-white"><Download size={15}/> Detaylı Excel raporu</button>
      </div>
    </header>

    <form method="get" className={card+" flex flex-wrap items-end gap-3 p-4"}>
      <label className="text-xs font-semibold text-slate-600">Rapor yılı
        <select name="year" defaultValue={data.year} className={field+" mt-1 min-w-32"}>
          {Array.from({length:8},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      {data.isGlobal && <label className="min-w-44 flex-1 text-xs font-semibold text-slate-600">Şube
        <select name="branch" defaultValue={data.branchId||"ALL"} className={field+" mt-1"}>
          <option value="ALL">Tüm şubeler</option>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>}
      {!data.isGlobal && <p className="px-2 py-3 text-xs text-slate-600">Yalnızca yetkili olduğunuz şube görüntüleniyor.</p>}
      <button type="submit" className="rounded-[5px] bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Raporu getir</button>
    </form>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <Statistic title="Aktif personel" value={active.length} description="Mevcut çalışan" icon={Users}/>
      <Statistic title="Toplam bakiye" value={fmt(total)+" gün"} description="Güncel izin bakiyesi" icon={CalendarDays}/>
      <Statistic title="Eksi bakiyeli" value={deficits.length} description="-14 gün alt limit" icon={AlertTriangle}/>
      <Statistic title="Kritik bakiye" value={low.length} description="0 ile 3 gün arası" icon={Clock3}/>
      <Statistic title="Kullanılan yıllık izin" value={fmt(used)+" gün"} description={data.year+" başlangıç tarihli onaylı"} icon={CheckCircle2}/>
      <Statistic title="Onay bekleyen" value={pending.length} description="Seçili yılın talepleri" icon={History}/>
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className={card+" overflow-hidden"}>
        <div className="border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Users size={18} className="text-[#dc3545]"/> Personel izin tablosu</h2>
          <div className="mt-3 flex gap-2">
            <label className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={16}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} className={field+" pl-9"} placeholder="Ad, ID, ünvan, şube" aria-label="Personel ara"/></label>
            <select className="rounded-[5px] border border-slate-300 bg-white px-2 text-xs text-slate-800" value={balanceFilter} onChange={e=>setBalanceFilter(e.target.value)} aria-label="Bakiye filtresi">
              <option value="ALL">Tümü</option><option value="ACTIVE">Aktif</option>
              <option value="NEGATIVE">Eksi bakiye</option><option value="LOW">0-3 gün</option>
              <option value="INACTIVE">Pasif</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-500">{shown.length} personel listeleniyor. Kişiye tıklayarak detayını açın.</p>
        </div>
        <div className="max-h-[700px] overflow-auto">
          <table className="w-full min-w-[450px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500"><tr>
              <th className="px-3 py-3">PERSONEL</th><th className="px-3 py-3">ŞUBE / ÜNVAN</th>
              <th className="px-3 py-3 text-right">BAKİYE</th><th className="px-3 py-3"></th>
            </tr></thead>
            <tbody>{shown.map(e=><tr key={e.id} onClick={()=>choose(e)} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${employee?.id===e.id?"bg-red-50/70":""}`}>
              <td className="px-3 py-3"><div className="font-bold text-slate-900">{e.full_name}</div>
                <div className="font-mono text-[11px] text-slate-500">{e.id} {e.account?"· Web hesabı bağlı":""}</div></td>
              <td className="px-3 py-3 text-slate-600">{e.branch_name}<div className="text-slate-400">{e.position_title||"-"}</div></td>
              <td className={`px-3 py-3 text-right font-bold tabular-nums ${(e.leave_balance??0)<0?"text-red-700":"text-slate-900"}`}>{e.leave_balance===null?"-":fmt(e.leave_balance)+" gün"}</td>
              <td className="px-3 py-3"><ArrowRight size={15} className="text-slate-400"/></td>
            </tr>)}
            {!shown.length&&<tr><td colSpan={4} className="p-8 text-center text-slate-500">Filtreye uygun personel bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card+" min-w-0 p-4 sm:p-5"}>
        {!employee?<p className="py-16 text-center text-sm text-slate-500">Personel seçimi bulunmuyor.</p>:<>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[5px] bg-slate-900 text-white"><UserRound size={20}/></div>
              <div><h2 className="font-bold text-slate-900">{employee.full_name}</h2>
              <p className="text-xs text-slate-500">{employee.id} · {employee.branch_name}</p></div>
            </div>
            <StatusTag ok={employee.is_active}>{employee.is_active?"Aktif":"Pasif"}</StatusTag>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 text-xs">
            <div><p className="text-slate-500">Güncel izin bakiyesi</p><p className="text-lg font-bold text-slate-900">{fmt(employee.leave_balance??0)} gün</p></div>
            <div><p className="text-slate-500">İşe giriş tarihi</p><p className="mt-1 font-bold text-slate-900">{trDate(employee.employment_date)}</p></div>
            <div><p className="text-slate-500">Bu yıl onaylı yıllık izin</p><p className="mt-1 font-bold text-slate-900">{fmt(leaves.filter(l=>l.leave_type==="YILLIK_IZIN"&&l.status==="APPROVED").reduce((s,l)=>s+l.requested_days,0))} gün</p></div>
            <div><p className="text-slate-500">Bağlı hesap</p><p className="mt-1 break-all font-semibold text-slate-900">{employee.account?.email||"Bağlı değil"}</p></div>
          </div>

          <div className="rounded-[5px] border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck size={16}/> Manuel bakiye düzenle</div>
            <p className="mb-3 text-xs text-slate-600">İzin bakiyesi ve işe giriş tarihi kayıtları. İşlem nedeni zorunludur.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-slate-600">Kalan izin (gün)
                <input key={employee.id+"-balance"} type="number" step="0.01" min={-14} max={999} className={field+" mt-1"} value={currentManual} onChange={e=>{setSelected(employee.id);setManual(e.target.value);}} disabled={!employee.is_active}/>
              </label>
              <label className="text-xs font-semibold text-slate-600">İşe giriş
                <input key={employee.id+"-date"} type="date" className={field+" mt-1"} value={currentDate} onChange={e=>{setSelected(employee.id);setManualDate(e.target.value);}} disabled={!employee.is_active}/>
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Değişiklik nedeni
              <input value={manualReason} onChange={e=>setManualReason(e.target.value)} maxLength={300} placeholder="Örn: Onaylanan İK düzeltmesi" className={field+" mt-1"} disabled={!employee.is_active}/>
            </label>
            <button type="button" onClick={saveOne} disabled={manualBusy||!employee.is_active||manualReason.trim().length<5}
              className="mt-3 rounded-[5px] bg-[#dc3545] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              {manualBusy?"Kaydediliyor...":"Bakiyeyi kaydet ve logla"}
            </button>
          </div>

          <div className="mt-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarDays size={16}/> {data.year} izin talepleri ({leaves.length})</h3>
            <div className="max-h-48 overflow-auto rounded-[5px] border border-slate-200">
              {leaves.map(l=><div key={l.id} className="flex justify-between gap-2 border-b border-slate-100 p-3 text-xs">
                <div><div className="font-bold text-slate-900">{requestLabel(l.custom_leave_type||l.leave_type)} · {fmt(l.requested_days)} gün</div>
                <p className="text-slate-500">{trDate(l.start_date)} - {trDate(l.end_date)} {l.is_half_day?"· Yarım gün":""}</p></div>
                <StatusTag ok={l.status==="APPROVED"}>{l.status}</StatusTag>
              </div>)}
              {!leaves.length&&<p className="p-5 text-center text-xs text-slate-500">Bu yıl izin talebi yok.</p>}
            </div>
          </div>
          <div className="mt-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><History size={16}/> Bakiye değişiklik geçmişi ({audits.length})</h3>
            <div className="max-h-48 overflow-auto rounded-[5px] border border-slate-200">
              {audits.map(a=><div key={a.id} className="border-b border-slate-100 p-3 text-xs">
                <div className="font-bold text-slate-900">{formatStamp(a.created_at)}</div>
                <p className="mt-1 break-words text-slate-600">{a.description}</p>
                <p className="mt-1 break-all font-mono text-slate-500">{a.old_value||"?"} → {a.new_value||"?"}</p>
              </div>)}
              {!audits.length&&<p className="p-5 text-center text-xs text-slate-500">Henüz bu yeni kayıt sistemiyle yapılmış düzenleme bulunmuyor.</p>}
            </div>
          </div>
          {(employee.legacy_remaining!==null && employee.legacy_remaining!==employee.leave_balance)&&
            <p className="mt-3 rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Eski “kalan_izin” alanı: {employee.legacy_remaining}. Aktif sistem “leave_balance” alanını kullanıyor. Eski alanlar otomatik eşitlenmiyor.</p>}
          <Link href="/management/password-settings" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#dc3545]">Bağlı hesap yönetimi <ArrowRight size={14}/></Link>
        </>}
      </section>
    </div>

    <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className={card+" flex flex-col p-5"}>
        <div className="mb-3 flex items-center gap-2 text-slate-900"><Download className="text-[#dc3545]" size={19}/><h2 className="text-base font-bold">1. Güvenli Excel şablonu</h2></div>
        <p className="text-sm leading-6 text-slate-600">Personel ID, ad, şube, işe giriş tarihi ve mevcut izin bakiyesi birlikte verilir. Yalnızca <strong>KALAN İZİN (DÜZENLE)</strong> sütununu düzenleyerek toplu bakiye güncelleyebilirsiniz.</p>
        <p className="mt-3 text-xs text-amber-700">Eski, ID içermeyen şablonlar artık kabul edilmez. Bu değişiklik yanlış personelin bakiyesinin değişmesini önler.</p>
        <button onClick={()=>exportSheet("template")} className="mt-auto inline-flex items-center justify-center gap-2 rounded-[5px] bg-slate-900 px-4 py-3 text-sm font-bold text-white sm:mt-5"><FileSpreadsheet size={17}/> Yeni şablonu indir</button>
      </div>
      <div className={card+" p-5"}>
        <div className="mb-3 flex items-center gap-2"><UploadCloud className="text-[#dc3545]" size={19}/><h2 className="text-base font-bold text-slate-900">2. Dosyayı doğrula ve güncelle</h2></div>
        <p className="mb-3 text-sm leading-6 text-slate-600">Yüklemeden önce tüm ID'ler, isimler ve izin bakiyeleri kontrol edilir. Hatalı satır varsa hiçbir kayıt değiştirilmez.</p>
        <label className="block cursor-pointer rounded-[5px] border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs font-semibold text-slate-700 hover:border-[#dc3545]">
          .xlsx veya .xls seçin (en fazla 2 MB)
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={e=>{const f=e.target.files?.[0];if(f)void readFile(f);}}/>
        </label>
        {filename&&<p className="mt-2 truncate text-xs text-slate-600">Dosya: {filename}</p>}
        {!!warnings.length&&<div role="alert" className="mt-3 rounded-[5px] border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <strong>{warnings.length} sorun bulundu, kayıt yapılmayacak:</strong>
          {warnings.slice(0,20).map((w,i)=><p key={i} className="mt-1">{w}</p>)}
        </div>}
        {!!preview.length&&<div className="mt-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Önizleme: {preview.length} güncellenecek personel</h3>
          <div className="max-h-40 overflow-auto rounded-[5px] border border-slate-200 text-xs">
            {preview.map(p=><div key={p.employee.id} className="flex justify-between gap-3 border-b border-slate-100 p-2.5">
              <span>{p.employee.full_name} ({p.employee.id})</span><strong className="tabular-nums">{p.employee.leave_balance??"Boş"} → {fmt(p.newBalance)} gün</strong>
            </div>)}
          </div>
          <label className="block text-xs font-semibold text-slate-700">Toplu işlem açıklaması
            <input value={reason} onChange={e=>setReason(e.target.value)} maxLength={300} placeholder="Örn: Ekim sonu izin bakiyesi mutabakatı" className={field+" mt-1"}/>
          </label>
          <button type="button" onClick={submitChanges} disabled={updating||warnings.length>0||reason.trim().length<5}
            className="w-full rounded-[5px] bg-[#dc3545] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {updating?"İşleniyor...":`${preview.length} değişikliği onayla ve kaydet`}
          </button>
        </div>}
      </div>
    </section>
    {error&&<div role="alert" className="flex items-start gap-2 rounded-[5px] border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18}/>{error}<button onClick={()=>setError("")} className="ml-auto" aria-label="Hata mesajını kapat"><X size={16}/></button></div>}
    {success&&<div role="status" className="flex items-start gap-2 rounded-[5px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18}/>{success}</div>}

    <footer className={card+" space-y-2 p-4 text-xs leading-5 text-slate-600"}>
      <p><strong>Hesaplama:</strong> Güncel izin bakiyesi <code>employees.leave_balance</code> alanından alınır. Onaylanan yıllık izin günleri ayrı raporlanır; rapor ve resmî tatil otomatik olarak yıllık izin kullanımı sayılmaz.</p>
      <p><strong>Hak ediş:</strong> Veritabanındaki mevcut yıllık hak ediş görevi çalışmaya devam eder. Bu panel geçmiş bakiyeleri yeniden hesaplayarak ikinci kez hak ediş eklemez.</p>
      <p><strong>Dönem:</strong> Yıl filtresi izin taleplerinin başlangıç tarihine uygulanır; personel izin bakiyeleri seçilen yılın tarihsel bakiyesi değil, güncel değeridir.</p>
    </footer>
  </main>;
}
