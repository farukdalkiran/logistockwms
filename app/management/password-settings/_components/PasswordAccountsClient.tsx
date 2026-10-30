"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Building2, Check, ClipboardCopy, Eye, EyeOff,
  Hash, KeyRound, Laptop, LockKeyhole, Pencil, Plus, RefreshCw, Search, Shield,
  ShieldAlert, Smartphone, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { WmsPageHeader, WmsMetric, WmsBadge } from "@/components/ui/wms";
import {
  adminResetPassword, assignWebEmployeeIdentity, createSystemUser, createTerminalEmployee,
  deleteSystemUser, fetchAdminAccounts, updateSystemUser, updateTerminalEmployee,
  type AccountBranch, type PasswordDashboard, type TerminalAccount, type WebAccount,
} from "@/app/actions/user";

const CARD = "rounded-[6px] border border-slate-200 bg-white shadow-sm";
const FIELD = "mt-1.5 h-11 w-full rounded-[5px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-100 disabled:text-slate-500";
const LABEL = "block text-sm font-semibold text-slate-700";
const BTN = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50";
const PRIMARY = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] bg-[#dc3545] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50";
type Mode = "web" | "terminal";
type CreateMode = "web" | "terminal";
type Edit = {type:"web"; data:WebAccount} | {type:"terminal";data:TerminalAccount};
type Credential = {label:string;employeeId?:string;email?:string;password?:string;userId?:string};
const dateTime = (value:string|null) => value ? new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",dateStyle:"short"}).format(new Date(value)) : "—";
const isProtected=(role:string)=>role==="Developer"||role==="Admin";
function copyText(value:string){void navigator.clipboard.writeText(value);}
function MaskedUuid({value}:{value:string}) {
  return <span title={value} className="text-xs text-slate-500" aria-label={value}>Auth: {value.slice(0,8)}…</span>;
}
export default function PasswordAccountsClient({initial}:{initial:PasswordDashboard}) {
  const [dashboard,setDashboard]=useState(initial);
  const [tab,setTab]=useState<Mode>("web");
  const [formMode,setFormMode]=useState<CreateMode>("web");
  const [selectedBranch,setSelectedBranch]=useState(initial.isDeveloper?"":initial.ownBranchId||"");
  const [search,setSearch]=useState("");
  const [onlyUnlinked,setOnlyUnlinked]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [credential,setCredential]=useState<Credential|null>(null);
  const [showSecret,setShowSecret]=useState(false);
  const [edit,setEdit]=useState<Edit|null>(null);
  const [fullName,setFullName]=useState("");
  const [email,setEmail]=useState("");
  const [branchId,setBranchId]=useState(initial.isDeveloper?"":initial.ownBranchId||"");
  const [role,setRole]=useState("");
  const [employeeChoice,setEmployeeChoice]=useState("");
  const [position,setPosition]=useState("");
  const [preferredId,setPreferredId]=useState("");
  const branches=dashboard.branches;
  const branchLabel=(id:string|null)=>branches.find(b=>b.id===id)?.name||"Şube atanmadı";
  const isDeveloper=dashboard.isDeveloper;

  const refresh=async()=>{
    setRefreshing(true);
    const r=await fetchAdminAccounts();
    setRefreshing(false);
    if(!r.success){setError(r.error);return;}
    setDashboard(r);
  };
  const clearAlerts=()=>{setError("");setNotice("");};
  const clearForm=()=>{setFullName("");setEmail("");setPosition("");setPreferredId("");
    setRole("");setEmployeeChoice("");setBranchId(isDeveloper?"":dashboard.ownBranchId||"");
  };
  const openNew=(mode:CreateMode)=>{
    clearAlerts();setCredential(null);clearForm();setFormMode(mode);setShowForm(true);
    setEdit(null);window.scrollTo({top:0,behavior:"smooth"});
  };
  const openEdit=(row:Edit)=>{
    clearAlerts();setCredential(null);setShowForm(false);setEdit(row);
    setFullName(row.data.full_name||"");setBranchId(row.data.branch_id||"");
    if(row.type==="web"){setEmail(row.data.email||"");setRole(row.data.role);}
    else setPosition(row.data.position_title||"");
  };

  const handleCreate=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(busy)return;setBusy(true);clearAlerts();setCredential(null);
    try {
      if(formMode==="web"){
        const r=await createSystemUser({
          fullName,email,branchId,roleCode:role,linkedEmployeeId:employeeChoice||null,
          positionTitle:position||"Web Kullanıcısı",
        });
        if(!r.success)throw new Error(r.error);
        setCredential({label:"Web hesabı oluşturuldu",employeeId:r.employeeId,userId:r.userId,email,password:r.temporaryPassword});
        setNotice("Hesap ve personel ID başarıyla oluşturuldu. Geçici şifreyi şimdi güvenli şekilde iletin.");
      }else{
        const r=await createTerminalEmployee({fullName,positionTitle:position,branchId,preferredId});
        if(!r.success)throw new Error(r.error);
        setCredential({label:"Terminal personeli oluşturuldu",employeeId:r.employeeId});
        setNotice("Yeni 5 haneli terminal ID oluşturuldu.");
      }
      setShowForm(false);clearForm();await refresh();
    }catch(e){setError(e instanceof Error?e.message:"İşlem başarısız.");}
    finally{setBusy(false);}
  };
  const handleSave=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!edit||busy)return;setBusy(true);clearAlerts();
    try{
      const r=edit.type==="web"?
        await updateSystemUser({id:edit.data.id,fullName,email,role,branchId}):
        await updateTerminalEmployee({id:edit.data.id,fullName,positionTitle:position,branchId,isActive:edit.data.is_active});
      if(!r.success)throw new Error(r.error);
      setEdit(null);setNotice("Hesap bilgileri güncellendi.");await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Güncelleme yapılamadı.");}
    finally{setBusy(false);}
  };
  const handleReset=async(acc:WebAccount)=>{
    if(!window.confirm(`${acc.email||acc.full_name} hesabının giriş şifresi sıfırlansın mı?`))return;
    setBusy(true);clearAlerts();setCredential(null);
    const r=await adminResetPassword(acc.id);setBusy(false);
    if(!r.success){setError(r.error);return;}
    setCredential({label:"Yeni geçici giriş şifresi",email:acc.email||"",employeeId:acc.employee_id||undefined,password:r.newPassword,userId:acc.id});
    setNotice("Şifre değiştirildi. Yeni parola yalnızca bu pencerede gösteriliyor.");
    await refresh();
  };
  const handleDelete=async(acc:WebAccount)=>{
    if(!window.confirm(`${acc.full_name||acc.email} web hesabı kalıcı silinecek. Personel ID'si ve geçmiş operasyonlar korunacak. Onaylıyor musunuz?`))return;
    setBusy(true);clearAlerts();const r=await deleteSystemUser(acc.id);setBusy(false);
    if(!r.success){setError(r.error);return;}
    setNotice("Web hesabı kaldırıldı. İlişkili personel ve geçmiş kayıtlar korundu.");await refresh();
  };
  const assignId=async(acc:WebAccount)=>{
    if(!window.confirm(`${acc.full_name} için yeni benzersiz 5 haneli personel ID oluşturulsun mu?`))return;
    setBusy(true);clearAlerts();
    const r=await assignWebEmployeeIdentity(acc.id);setBusy(false);
    if(!r.success){setError(r.error);return;}
    setCredential({label:"Mevcut web hesabına personel ID bağlandı",employeeId:r.employeeId,email:acc.email||"",userId:acc.id});
    setNotice("Yeni personel ID web hesabına bağlandı.");await refresh();
  };
  const toggleTerminal=async(acc:TerminalAccount)=>{
    if(!window.confirm(`${acc.full_name} personelinin terminal girişi ${acc.is_active?"pasifleştirilsin":"etkinleştirilsin"} mi?`))return;
    setBusy(true);clearAlerts();
    const r=await updateTerminalEmployee({id:acc.id,fullName:acc.full_name,positionTitle:acc.position_title||"",branchId:acc.branch_id,isActive:!acc.is_active});
    setBusy(false);
    if(!r.success){setError(r.error);return;}
    setNotice("Terminal erişim durumu güncellendi.");await refresh();
  };
  const availableEmployees=useMemo(()=>{
    const linked=new Set(dashboard.webAccounts.map(w=>w.employee_id).filter(Boolean));
    return dashboard.terminalAccounts.filter(t=>t.branch_id===branchId&&!linked.has(t.id)&&t.is_active);
  },[dashboard,branchId]);
  const shownWeb=useMemo(()=>dashboard.webAccounts.filter(w=>{
    const branchOk=!isDeveloper||!selectedBranch||w.branch_id===selectedBranch;
    const term=[w.full_name,w.email,w.role,w.employee_id,w.id,branchLabel(w.branch_id)].join(" ").toLocaleLowerCase("tr-TR");
    return branchOk&&term.includes(search.toLocaleLowerCase("tr-TR"))&&(!onlyUnlinked||!w.employee_id);
  }),[dashboard,selectedBranch,search,onlyUnlinked,isDeveloper]);
  const shownTerminal=useMemo(()=>dashboard.terminalAccounts.filter(t=>{
    const term=[t.full_name,t.position_title,t.id,branchLabel(t.branch_id)].join(" ").toLocaleLowerCase("tr-TR");
    return (!isDeveloper||!selectedBranch||t.branch_id===selectedBranch)&&term.includes(search.toLocaleLowerCase("tr-TR"));
  }),[dashboard,selectedBranch,search,isDeveloper]);
  const accountCount=dashboard.webAccounts.length,terminalCount=dashboard.terminalAccounts.length;
  const missingIds=dashboard.webAccounts.filter(w=>!w.employee_id).length;
  const activeTerminals=dashboard.terminalAccounts.filter(t=>t.is_active).length;

  return <main className="mx-auto w-full max-w-[1620px] space-y-5 px-3 py-4 pb-20 text-slate-900 sm:px-5 lg:px-7">
    <WmsPageHeader
      eyebrow="Sistem / Güvenlik"
      title="Kullanıcı, Şifre ve Personel ID Merkezi"
      description="Web hesaplarını personel kimliklerine bağlayın; şifreleri, terminal yetkilerini ve şube erişimini güvenle yönetin."
      actions={
        <>
          <WmsBadge tone="info"><Building2 size={14}/>{isDeveloper ? "Developer · Tüm şubeler" : dashboard.ownBranchName}</WmsBadge>
          <button type="button" onClick={()=>void refresh()} disabled={refreshing||busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={refreshing?"animate-spin":""}/>Yenile
          </button>
        </>
      }
    />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <WmsMetric label="Web Hesabı" value={accountCount}/>
      <WmsMetric label="Aktif Terminal" value={activeTerminals}/>
      <WmsMetric label="Terminal Kaydı" value={terminalCount}/>
      <WmsMetric label="ID Eşleşmesi Eksik" value={missingIds}/>
    </div>

    {error&&<div role="alert" className="flex items-start gap-2 rounded-[5px] border border-rose-300 bg-rose-50 p-4 text-sm font-medium text-rose-800"><ShieldAlert size={18} className="shrink-0"/>{error}</div>}
    {notice&&<div role="status" className="flex items-start gap-2 rounded-[5px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"><BadgeCheck size={18} className="shrink-0"/>{notice}</div>}
    {credential&&<section className="rounded-[6px] border border-emerald-300 bg-emerald-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-emerald-900"><BadgeCheck size={19}/>{credential.label}</h2>
        <button type="button" className={BTN} onClick={()=>{setCredential(null);setShowSecret(false);}}><X size={15}/>Kapat</button>
      </div>
      <p className="mt-2 text-xs leading-5 text-emerald-800">Kimlik bilgilerini güvenli kanaldan iletin. Geçici şifre bu ekranda bir kez gösterilir; listede saklanmaz.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {credential.employeeId&&<div className="rounded-[5px] border border-emerald-200 bg-white p-3"><p className="text-xs text-slate-500">Personel / Terminal ID</p><div className="mt-1 flex items-center justify-between gap-2"><strong className="text-xl tabular-nums text-slate-900">{credential.employeeId}</strong><button onClick={()=>copyText(credential.employeeId!)} title="ID kopyala" className={BTN}><ClipboardCopy size={15}/></button></div></div>}
        {credential.email&&<div className="rounded-[5px] border border-emerald-200 bg-white p-3"><p className="text-xs text-slate-500">Web Giriş E-Postası</p><div className="mt-1 flex items-center justify-between gap-2"><span className="break-all text-sm font-bold text-slate-900">{credential.email}</span><button onClick={()=>copyText(credential.email!)} title="E-posta kopyala" className={BTN}><ClipboardCopy size={15}/></button></div></div>}
        {credential.password&&<div className="rounded-[5px] border border-emerald-200 bg-white p-3"><p className="text-xs text-slate-500">Tek Kullanımlık Geçici Şifre</p><div className="mt-1 flex items-center justify-between gap-2"><strong className="break-all text-sm text-slate-900">{showSecret?credential.password:"••••••••••••"}</strong><div className="flex gap-1"><button onClick={()=>setShowSecret(v=>!v)} title="Gizle / Göster" className={BTN}>{showSecret?<EyeOff size={15}/>:<Eye size={15}/>}</button><button onClick={()=>copyText(credential.password!)} title="Şifre kopyala" className={BTN}><ClipboardCopy size={15}/></button></div></div></div>}
      </div>
      {credential.userId&&<p className="mt-3 text-xs text-emerald-900">Auth kullanıcı kimliği: <code className="break-all">{credential.userId}</code></p>}
    </section>}

    <div className="flex flex-wrap gap-2">
      <button type="button" className={PRIMARY} onClick={()=>openNew("web")}><UserPlus size={17}/>Web Hesabı Oluştur</button>
      <button type="button" className={BTN} onClick={()=>openNew("terminal")}><Smartphone size={17}/>Terminal ID Oluştur</button>
    </div>

    {showForm&&<section className={`${CARD} space-y-5 p-4 sm:p-6`} aria-label="Hesap oluşturma formu">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-900">{formMode==="web"?"Yeni Web Hesabı ve Personel Kimliği":"Yeni Terminal Personeli"}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{formMode==="web"?"Oturum kaydı oluşturulur ve tekil 5 haneli çalışan ID'si bağlanır. Mevcut personel ID'si de seçebilirsiniz.":"Yeni saha personeli ID'si, şube ve personel bilgileriyle birlikte kaydedilir."}</p></div>
        <button type="button" onClick={()=>setShowForm(false)} className={BTN}><X size={16}/>Vazgeç</button>
      </div>
      <form onSubmit={handleCreate} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className={LABEL}>Hesap / Personel Adı
            <input className={FIELD} required minLength={3} maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Örn. Mehmet Demir"/></label>
          {formMode==="web"?<label className={LABEL}>Web Giriş E-Postası
            <input type="email" className={FIELD} required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="ornek@firma.com"/></label>:
            <label className={LABEL}>Görev / Unvan
              <input className={FIELD} maxLength={90} value={position} onChange={e=>setPosition(e.target.value)} placeholder="Örn. Depo Personeli"/></label>}
          <label className={LABEL}>Bağlı Şube
            <select className={FIELD} required disabled={!isDeveloper} value={branchId} onChange={e=>{setBranchId(e.target.value);setEmployeeChoice("");}}>
              <option value="">Şube seçin</option>{branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}
            </select></label>
          {formMode==="web"?<label className={LABEL}>Yetki Sınıfı
            <select className={FIELD} required value={role} onChange={e=>setRole(e.target.value)}><option value="">Rol seçin</option>
              {dashboard.roles.map(r=><option key={r.id} value={r.role_code}>{r.role_name} ({r.role_code})</option>)}</select></label>:
            <label className={LABEL}>Özel Terminal ID (İsteğe Bağlı)
              <input className={FIELD} inputMode="numeric" pattern="[1-9][0-9]{4}" maxLength={5} value={preferredId} onChange={e=>setPreferredId(e.target.value.replace(/\D/g,""))} placeholder="Boş bırakılırsa otomatik üretilir"/></label>}
        </div>
        {formMode==="web"&&<div className="space-y-3 rounded-[5px] border border-rose-100 bg-rose-50/40 p-4">
          <div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Hash size={16} className="text-rose-600"/>5 Haneli Personel ID Bağlantısı</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Yeni personel oluşturulmasını istemiyorsanız aynı şubedeki, başka web hesabına bağlı olmayan mevcut personeli seçin.</p></div>
          <label className={LABEL}>Personel Kaydı
            <select className={FIELD} value={employeeChoice} onChange={e=>setEmployeeChoice(e.target.value)}>
              <option value="">Yeni benzersiz 5 haneli ID otomatik oluştur</option>
              {availableEmployees.map(t=><option key={t.id} value={t.id}>{t.id} · {t.full_name}</option>)}
            </select></label>
          {employeeChoice===""&&<label className={LABEL}>Yeni Personel Görevi (Opsiyonel)
            <input className={FIELD} maxLength={90} value={position} onChange={e=>setPosition(e.target.value)} placeholder="Örn. Depo Sorumlusu"/></label>}
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="max-w-xl text-xs leading-5 text-slate-500">{formMode==="web"?"Parola güvenli şekilde sunucuda üretilir; hesap oluşturulduğunda bir defaya mahsus gösterilir.":"5 haneli kimlik çakışmaları sunucuda kontrol edilir."}</p>
          <button type="submit" disabled={busy||!branchId} className={PRIMARY}><Plus size={16}/>{busy?"Hesap oluşturuluyor...":formMode==="web"?"Web Hesabını ve ID'yi Oluştur":"Terminal Personelini Oluştur"}</button>
        </div>
      </form>
    </section>}

    <section className={CARD}>
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-lg font-bold text-slate-900">Hesap Listesi ve Erişim Yönetimi</h2>
          <p className="mt-1 text-sm text-slate-600">{isDeveloper?"Tüm şubeler için filtrelenebilir yönetim.":"Bu oturum yalnızca kendi şubesindeki kayıtları yönetebilir."}</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>{setTab("web");setOnlyUnlinked(false);}} className={`inline-flex min-h-10 items-center gap-2 rounded-[5px] px-4 py-2 text-sm font-bold ${tab==="web"?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-700"}`}><Laptop size={16}/>Web Hesapları</button>
          <button onClick={()=>{setTab("terminal");setOnlyUnlinked(false);}} className={`inline-flex min-h-10 items-center gap-2 rounded-[5px] px-4 py-2 text-sm font-bold ${tab==="terminal"?"bg-slate-900 text-white":"border border-slate-200 bg-white text-slate-700"}`}><Smartphone size={16}/>Terminal ID</button>
        </div>
      </div>
      <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400"/>
          <input className={`${FIELD} mt-0 pl-10`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ad, e-posta, ID veya rol ara"/></div>
        {isDeveloper?<select value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)} className={`${FIELD} mt-0`} aria-label="Şubeye göre filtrele">
          <option value="">Tüm şubeler</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
        </select>:<div className="flex min-h-11 items-center rounded-[5px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">{dashboard.ownBranchName}</div>}
        {tab==="web"?<label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={onlyUnlinked} onChange={e=>setOnlyUnlinked(e.target.checked)}/>ID'siz web hesapları</label>:
          <span className="flex items-center text-xs text-slate-500">Personel geçmiş kayıtları silinmez.</span>}
      </div>
      <div className="overflow-x-auto">
        {tab==="web"?<table className="w-full min-w-[950px] text-left">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr>
            <th className="px-4 py-3">Hesap ve İletişim</th><th className="px-4 py-3">Personel ID</th><th className="px-4 py-3">Şube / Rol</th><th className="px-4 py-3">Hesap Kimliği</th><th className="px-4 py-3 text-right">İşlemler</th>
          </tr></thead><tbody className="divide-y divide-slate-100">
          {shownWeb.map(w=><tr key={w.id} className="hover:bg-slate-50">
            <td className="px-4 py-3"><div className="text-sm font-bold text-slate-900">{w.full_name||"İsimsiz hesap"}</div><div className="mt-1 break-all text-xs text-slate-600">{w.email||"E-posta yok"}</div></td>
            <td className="px-4 py-3">{w.employee_id?<strong className="text-base tabular-nums text-emerald-800">{w.employee_id}</strong>:<span className="text-xs font-semibold text-amber-700">ID atanmadı</span>}</td>
            <td className="px-4 py-3"><div className="text-sm font-semibold text-slate-800">{branchLabel(w.branch_id)}</div><div className="mt-1 text-xs text-slate-500">{w.role}</div></td>
            <td className="px-4 py-3"><MaskedUuid value={w.id}/><div className="mt-1 text-xs text-slate-500">Oluşturma: {dateTime(w.created_at)}</div></td>
            <td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-1.5">
              {!w.employee_id&&<button className={BTN} disabled={busy} onClick={()=>void assignId(w)}><Hash size={14}/>ID Ata</button>}
              <button className={BTN} disabled={busy||w.id===dashboard.currentUserId} onClick={()=>void handleReset(w)} title={w.id===dashboard.currentUserId?"Kendi şifrenizi profilden değiştirin":"Geçici şifre üret"}><KeyRound size={14}/>Şifre Sıfırla</button>
              <button className={BTN} disabled={busy} onClick={()=>openEdit({type:"web",data:w})}><Pencil size={14}/>Düzenle</button>
              <button className={BTN} disabled={busy||w.id===dashboard.currentUserId} onClick={()=>void handleDelete(w)} title="Personel geçmişini koruyarak web oturum hesabını kaldır"><Trash2 size={14}/>Sil</button>
            </div></td>
          </tr>)}
          {!shownWeb.length&&<tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-500">Görüntülenecek web hesabı bulunamadı.</td></tr>}
          </tbody></table>:
          <table className="w-full min-w-[820px] text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Terminal ID</th><th className="px-4 py-3">Personel</th><th className="px-4 py-3">Şube / Görev</th><th className="px-4 py-3">Erişim Durumu</th><th className="px-4 py-3 text-right">İşlemler</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{shownTerminal.map(t=><tr key={t.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-lg font-bold tabular-nums text-slate-900">{t.id}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-900">{t.full_name}</td>
              <td className="px-4 py-3"><div className="text-sm text-slate-800">{branchLabel(t.branch_id)}</div><div className="mt-1 text-xs text-slate-500">{t.position_title||"Personel"}</div></td>
              <td className="px-4 py-3">{t.is_active?<span className="rounded-[4px] bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">Aktif</span>:<span className="rounded-[4px] bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">Pasif</span>}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2">
                <button className={BTN} disabled={busy} onClick={()=>openEdit({type:"terminal",data:t})}><Pencil size={14}/>Düzenle</button>
                <button className={BTN} disabled={busy} onClick={()=>void toggleTerminal(t)}>{t.is_active?"Pasifleştir":"Etkinleştir"}</button>
              </div></td>
            </tr>)}{!shownTerminal.length&&<tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-slate-500">Görüntülenecek terminal kaydı bulunamadı.</td></tr>}</tbody>
          </table>}
      </div>
      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        {tab==="web"?`${shownWeb.length} web hesabı gösteriliyor.`:`${shownTerminal.length} terminal personeli gösteriliyor.`}
        {" "}Şifreler güvenlik gerekçesiyle liste halinde görüntülenmez.
      </div>
    </section>

    {edit&&<div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/65 p-3" role="presentation"
      onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEdit(null);}}>
      <section role="dialog" aria-modal="true" aria-label="Hesap düzenle" className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-[7px] bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4 text-white"><div><p className="text-xs font-semibold text-rose-300">Hesap Erişim Yönetimi</p><h2 className="mt-1 text-lg font-bold">{edit.type==="web"?"Web Hesabını Düzenle":"Terminal Personelini Düzenle"}</h2></div>
          <button type="button" onClick={()=>setEdit(null)} className="rounded p-2 hover:bg-white/10" aria-label="Kapat"><X size={18}/></button></header>
        <form onSubmit={handleSave} className="min-h-0 space-y-4 overflow-y-auto p-5">
          <label className={LABEL}>Ad / Hesap Adı<input className={FIELD} required minLength={3} maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)}/></label>
          {edit.type==="web"?<>
            <label className={LABEL}>Giriş E-Postası<input className={FIELD} type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
            <label className={LABEL}>Yetki Sınıfı
              <select className={FIELD} required value={role} onChange={e=>setRole(e.target.value)}>
                {dashboard.roles.map(r=><option key={r.id} value={r.role_code}>{r.role_name} ({r.role_code})</option>)}
              </select></label>
            <div className="rounded-[5px] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Bağlı personel ID: <strong>{edit.data.employee_id||"Henüz oluşturulmamış"}</strong>. Bir kişinin personel ID'si değişmez.</div>
          </>:<>
            <label className={LABEL}>Unvan<input className={FIELD} maxLength={90} value={position} onChange={e=>setPosition(e.target.value)}/></label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={edit.data.is_active} onChange={e=>setEdit({type:"terminal",data:{...edit.data,is_active:e.target.checked}})}/>Terminal erişimi aktif</label>
          </>}
          <label className={LABEL}>Bağlı Şube
            <select className={FIELD} disabled={!isDeveloper} value={branchId} onChange={e=>setBranchId(e.target.value)}>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select></label>
          {edit.type==="web"&&edit.data.employee_id&&branchId!==edit.data.branch_id&&
            <p className="rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Web hesabına personel ID bağlı olduğundan şube değişimi, eşleşen personel kaydı aynı şubeye taşınmadan yapılamaz.
            </p>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className={BTN} onClick={()=>setEdit(null)}>İptal</button>
            <button disabled={busy} className={PRIMARY} type="submit"><Check size={16}/>{busy?"Kaydediliyor...":"Değişiklikleri Kaydet"}</button>
          </div>
        </form>
      </section>
    </div>}
  </main>;
}
