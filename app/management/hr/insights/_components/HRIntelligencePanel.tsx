"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, BarChart3, CalendarClock, CalendarDays, CheckCircle2,
  Download, Edit3, FileClock, FileText, IdCard, PackageCheck,
  Search, ShieldCheck, UserRound, Users, X, AlertTriangle,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { updateEmployeeHR, type HREmployeeUpdate } from "@/app/actions/employee";
import type { HRIntelligence, HREmployee, HRRecord } from "@/lib/hr/insights";

const card = "rounded-[5px] border border-slate-200 bg-white shadow-sm";
const input = "w-full rounded-[5px] border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#dc3545]";
const toNumber = (n: number | string | null | undefined) => Number(n || 0);
const trDay = (value: string) => new Date(value).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
const trTime = (value: string | null) => value
  ? new Date(value).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" })
  : "-";
const shortDay = (d: string) => d ? d.split("-").reverse().join(".") : "-";
const dateKey = (value: string) => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));
const hours = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const isLeave = (r: HRRecord) => String(r.status || "").startsWith("LEAVE_") || Boolean(r.leave_request_id);
const isHoliday = (r: HRRecord) => r.status === "LEAVE_RESMI_TATIL" || Boolean(r.public_holiday_id);
const work = (r: HRRecord) => isLeave(r) || isHoliday(r) ? 0 : Math.max(0, toNumber(r.working_hours));
const approved = (status: string) => status === "APPROVED";

function Stat({ label, value, foot, icon: Icon }: {
  label: string; value: string | number; foot: string; icon: typeof Users;
}) {
  return <div className={card + " p-4"}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <Icon className="h-4 w-4 text-[#dc3545]" />
    </div>
    <div className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</div>
    <div className="mt-1 text-xs text-slate-500">{foot}</div>
  </div>;
}

function Tag({ children, positive = false }: { children: React.ReactNode; positive?: boolean }) {
  return <span className={`inline-flex rounded-[5px] border px-2 py-1 text-[11px] font-semibold ${positive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{children}</span>;
}

function EditForm({ person, branches, isGlobal, onClose, onSaved }: {
  person: HREmployee; branches: HRIntelligence["branches"]; isGlobal: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const [value, setValue] = useState<HREmployeeUpdate>({
    id: person.id, full_name: person.full_name, position_title: person.position_title || "",
    branch_id: person.branch_id, employment_date: person.employment_date,
    birthday: person.birthday, is_active: person.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = (key: keyof HREmployeeUpdate, v: string | boolean) =>
    setValue(current => ({ ...current, [key]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try { await updateEmployeeHR(value); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : "Kayıt yapılamadı."); }
    finally { setSaving(false); }
  };
  return <form onSubmit={submit} className="mt-4 space-y-4 rounded-[5px] border border-red-200 bg-red-50/40 p-4">
    <div className="flex items-center justify-between">
      <h3 className="font-bold text-slate-900">Personel bilgilerini düzenle</h3>
      <button type="button" onClick={onClose} aria-label="Düzenlemeyi kapat"><X size={18} /></button>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">Ad soyad
        <input className={input + " mt-1"} value={value.full_name} onChange={e => change("full_name", e.target.value)} required minLength={2} maxLength={120} />
      </label>
      <label className="text-xs font-semibold text-slate-600">Ünvan
        <input className={input + " mt-1"} value={value.position_title} onChange={e => change("position_title", e.target.value)} required minLength={2} maxLength={80} />
      </label>
      <label className="text-xs font-semibold text-slate-600">Şube
        <select className={input + " mt-1"} value={value.branch_id} disabled={!isGlobal || Boolean(person.account)} onChange={e => change("branch_id", e.target.value)}>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">İşe başlama tarihi
        <input type="date" className={input + " mt-1"} value={value.employment_date || ""} onChange={e => change("employment_date", e.target.value)} />
      </label>
      <label className="text-xs font-semibold text-slate-600">Doğum tarihi
        <input type="date" className={input + " mt-1"} value={value.birthday || ""} onChange={e => change("birthday", e.target.value)} />
      </label>
      <label className="flex items-center gap-2 pt-4 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={value.is_active} disabled={Boolean(person.account)} onChange={e => change("is_active", e.target.checked)} />
        Aktif personel
      </label>
    </div>
    {person.account && <p className="text-xs text-amber-700">Web hesabı bağlı personelin şubesi ve aktifliği Hesap Yönetimi'nden güncellenmelidir.</p>}
    {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    <button type="submit" disabled={saving} className="rounded-[5px] bg-[#dc3545] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Kaydediliyor..." : "Değişiklikleri kaydet"}</button>
  </form>;
}

export default function HRIntelligencePanel({ initial }: { initial: HRIntelligence }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(initial.employees[0]?.id || null);
  const [editing, setEditing] = useState(false);
  const [detailTab, setDetailTab] = useState<"attendance" | "leaves" | "requests" | "operations">("attendance");

  const filtered = useMemo(() => initial.employees.filter(e => {
    const matched = `${e.full_name} ${e.id} ${e.position_title || ""} ${e.branch_name}`
      .toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"));
    return matched && (status === "ALL" || (status === "ACTIVE" ? e.is_active : !e.is_active));
  }), [initial.employees, query, status]);

  const person = initial.employees.find(e => e.id === selectedId) || initial.employees[0];
  const attendance = useMemo(() => initial.attendance.filter(r => r.employee_id === person?.id), [initial.attendance, person?.id]);
  const leaves = useMemo(() => initial.leaves.filter(r => r.employee_id === person?.id), [initial.leaves, person?.id]);
  const corrections = useMemo(() => initial.corrections.filter(r => r.employee_id === person?.id), [initial.corrections, person?.id]);
  const operations = useMemo(() => initial.operations.filter(r => r.employee_id === person?.id), [initial.operations, person?.id]);
  const sessions = useMemo(() => initial.cargoSessions.filter(r => r.employee_id === person?.id), [initial.cargoSessions, person?.id]);

  const totalHours = initial.attendance.reduce((s, r) => s + work(r), 0);
  const holidayHours = initial.attendance.filter(isHoliday).reduce((s,r) => s + Math.max(0,toNumber(r.working_hours)),0);
  const missingOut = initial.attendance.filter(r => !isLeave(r) && !isHoliday(r) && !r.check_out_time).length;
  const approvedLeaves = initial.leaves.filter(l => approved(l.status)).length;
  const employeeHours = attendance.reduce((s, r) => s + work(r), 0);
  const chart = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const record of attendance) {
      const day = dateKey(record.check_in_time);
      byDay.set(day, (byDay.get(day) || 0) + work(record));
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date: date.slice(8) + "." + date.slice(5, 7), hours: Number(total.toFixed(2)) }));
  }, [attendance]);

  const selectPerson = (id: string) => { setSelectedId(id); setDetailTab("attendance"); setEditing(false); };
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const book = XLSX.utils.book_new();
    const staff = initial.employees.map(e => ({
      "Personel ID": e.id, "Ad Soyad": e.full_name, "Ünvan": e.position_title,
      "Şube": e.branch_name, "Durum": e.is_active ? "Aktif" : "Pasif",
      "İşe Başlama": e.employment_date || "", "Doğum Tarihi": e.birthday || "",
      "Kalan İzin": e.kalan_izin ?? e.leave_balance ?? "",
      "Web Hesabı": e.account?.email || "", "Rol": e.account?.role || "",
      "Fiili Mesai (Saat)": Number(initial.attendance.filter(a => a.employee_id === e.id).reduce((s,r) => s + work(r),0).toFixed(2)),
    }));
    const movements = initial.attendance.map(r => ({
      "Personel ID": r.employee_id, "Tarih (TR)": trDay(r.check_in_time),
      "Giriş (TR)": trTime(r.check_in_time), "Çıkış (TR)": trTime(r.check_out_time),
      "Fiili Çalışma": work(r), "Kayıtlı Saat": toNumber(r.working_hours),
      "Mola": toNumber(r.break_hours), "Durum": r.status || "",
    }));
    const izin = initial.leaves.map(l => ({
      "Personel ID": l.employee_id, "Tür": l.custom_leave_type || l.leave_type,
      "Başlangıç": l.start_date, "Bitiş": l.end_date, "Talep Edilen Gün": l.requested_days,
      "Yarım Gün": l.is_half_day ? "Evet" : "Hayır", "Durum": l.status,
    }));
    for (const [name, rows] of [["Personeller",staff], ["Mesai",movements], ["İzinler",izin]] as const) {
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Kayıt": "Veri bulunamadı" }]), name);
    }
    XLSX.writeFile(book, `LogiStock_IK_360_${initial.month}.xlsx`);
  };

  return <main className="space-y-5 pb-12">
    <header className="flex flex-col justify-between gap-5 rounded-[5px] border-l-[5px] border-[#dc3545] bg-[#0F172B] p-6 text-white lg:flex-row lg:items-center">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-red-300">LogiStock / İnsan Kaynakları</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">İK Analiz ve Personel 360</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">Personel, mesai, izin, web hesabı ve operasyon ilişkilerini tek merkezden inceleyin.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/management/hr" className="rounded-[5px] border border-slate-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Mesai merkezi</Link>
        <Link href="/management/hr/personnel" className="rounded-[5px] border border-slate-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Personel ekle</Link>
        <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-[5px] bg-[#dc3545] px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"><Download size={16}/> Excel</button>
      </div>
    </header>

    <form action="/management/hr/insights" method="get" className={card + " flex flex-wrap items-end gap-4 p-4"}>
      <label className="min-w-40 flex-1 text-xs font-semibold text-slate-600">Rapor dönemi
        <input key={initial.month} className={input + " mt-1"} type="month" name="month" defaultValue={initial.month} min="2024-01" max="2100-12" required />
      </label>
      {initial.isGlobal && <label className="min-w-52 flex-1 text-xs font-semibold text-slate-600">Şube
        <select key={initial.selectedBranch || "ALL"} className={input + " mt-1"} name="branch" defaultValue={initial.selectedBranch || "ALL"}>
          <option value="ALL">Tüm şubeler</option>
          {initial.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>}
      {!initial.isGlobal && <div className="py-2 text-sm font-medium text-slate-600">Yalnızca bağlı olduğunuz şube görüntülenir.</div>}
      <button type="submit" className="rounded-[5px] bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Raporu oluştur</button>
    </form>

    {initial.truncated.length > 0 && <div role="alert" className="flex gap-2 rounded-[5px] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <AlertTriangle size={18} className="shrink-0"/> {initial.truncated.join(", ")} verileri 5.000 satır sınırına ulaştı. Toplamlar eksik olabilir; şube filtresi kullanın.
    </div>}

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <Stat icon={Users} label="Personel" value={initial.employees.length} foot="Tüm aktif/pasif kayıtlar"/>
      <Stat icon={CheckCircle2} label="Aktif personel" value={initial.employees.filter(e=>e.is_active).length} foot="Çalışan statüsü"/>
      <Stat icon={CalendarClock} label="Fiili mesai" value={hours(totalHours) + " sa"} foot="Seçili ay / izin hariç"/>
      <Stat icon={CalendarDays} label="Resmi tatil kaydı" value={hours(holidayHours) + " sa"} foot="Çalışmadan ayrı gösterilir"/>
      <Stat icon={FileText} label="Onaylı izin" value={approvedLeaves} foot="Tüm dönemlerdeki talep sayısı"/>
      <Stat icon={AlertTriangle} label="Açık çıkış" value={missingOut} foot="Seçili ay / çıkışı eksik"/>
    </section>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)]">
      <section className={card + " overflow-hidden"}>
        <div className="border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Users size={18} className="text-[#dc3545]"/> Personel rehberi</h2>
          <div className="mt-3 flex gap-2">
            <label className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-slate-400"/>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="İsim, ID, ünvan veya şube" className={input + " pl-9"} aria-label="Personel ara"/>
            </label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-[5px] border border-slate-300 bg-white px-2 text-xs text-slate-700" aria-label="Durum filtresi">
              <option value="ALL">Tümü</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Pasif</option>
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-500">{filtered.length} personel listeleniyor</p>
        </div>
        <div className="max-h-[690px] overflow-y-auto">
          {filtered.length ? filtered.map(e=><button type="button" key={e.id} onClick={()=>selectPerson(e.id)}
            className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${person?.id===e.id ? "bg-red-50/70" : ""}`}>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900">{e.full_name}</span>
              <span className="block truncate text-xs text-slate-500">{e.id} · {e.position_title || "Ünvan yok"} · {e.branch_name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {e.account && <ShieldCheck size={15} className="text-emerald-600"/>}
              <Tag positive={e.is_active}>{e.is_active?"Aktif":"Pasif"}</Tag>
              <ArrowRight size={14} className="text-slate-400"/>
            </span>
          </button>) : <p className="p-8 text-center text-sm text-slate-500">Aradığınız koşullarda personel bulunamadı.</p>}
        </div>
      </section>

      <section className={card + " min-w-0 p-4 sm:p-5"}>
        {!person ? <div className="py-20 text-center text-sm text-slate-500">Personel kaydı bulunamadı.</div> : <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[5px] bg-slate-900 text-white"><UserRound size={22}/></div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{person.full_name}</h2>
                <p className="text-xs text-slate-500">{person.position_title || "Ünvan yok"} · {person.branch_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tag positive={person.is_active}>{person.is_active ? "Aktif" : "Pasif"}</Tag>
              {initial.canManage && <button onClick={()=>setEditing(!editing)} className="inline-flex items-center gap-2 rounded-[5px] border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"><Edit3 size={14}/> Düzenle</button>}
            </div>
          </div>

          {editing && <EditForm key={person.id} person={person} branches={initial.branches} isGlobal={initial.isGlobal}
            onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);router.refresh();}}/>}

          <div className="grid grid-cols-2 gap-3 py-4 text-sm sm:grid-cols-3">
            <div><p className="text-xs text-slate-500">Personel ID</p><p className="font-mono font-bold text-slate-900">{person.id}</p></div>
            <div><p className="text-xs text-slate-500">İşe giriş</p><p className="font-semibold text-slate-800">{person.employment_date ? shortDay(person.employment_date) : "Belirtilmedi"}</p></div>
            <div><p className="text-xs text-slate-500">Doğum günü</p><p className="font-semibold text-slate-800">{person.birthday ? shortDay(person.birthday) : "Belirtilmedi"}</p></div>
            <div><p className="text-xs text-slate-500">İzin bakiyesi</p><p className="font-semibold text-slate-800">{person.kalan_izin ?? person.leave_balance ?? "Belirtilmedi"}</p></div>
            <div><p className="text-xs text-slate-500">Toplam izin hakkı</p><p className="font-semibold text-slate-800">{person.toplam_izin_hakki ?? "Belirtilmedi"}</p></div>
            <div><p className="text-xs text-slate-500">Bu ay fiili çalışma</p><p className="font-semibold text-slate-800">{hours(employeeHours)} saat</p></div>
          </div>
          <div className="rounded-[5px] border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><IdCard size={16}/> Bağlı web hesabı</div>
            {person.account ? <div className="text-xs leading-6 text-slate-700">
              <div className="break-all"><strong>Hesap:</strong> {person.account.email || person.account.id}</div>
              <div><strong>Yetki:</strong> {person.account.role}</div>
              <div><strong>Hesap ID:</strong> <span className="font-mono">{person.account.id}</span></div>
            </div> : <p className="text-xs text-slate-500">Bu personel ID'siyle eşleşen web hesabı bulunmuyor.</p>}
            <Link href="/management/password-settings" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#dc3545]">Hesap yönetimi <ArrowRight size={12}/></Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[5px] bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Mesai kaydı</p><p className="text-lg font-bold text-slate-900">{attendance.length}</p></div>
            <div className="rounded-[5px] bg-slate-50 p-3"><p className="text-[11px] text-slate-500">İzin talebi</p><p className="text-lg font-bold text-slate-900">{leaves.length}</p></div>
            <div className="rounded-[5px] bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Düzeltme talebi</p><p className="text-lg font-bold text-slate-900">{corrections.length}</p></div>
            <div className="rounded-[5px] bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Kargo oturumu</p><p className="text-lg font-bold text-slate-900">{sessions.length}</p></div>
          </div>
          <div className="mt-4 rounded-[5px] border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">Günlük net mesai grafiği</h3><BarChart3 size={17} className="text-[#dc3545]"/></div>
            {chart.length ? <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 10, right: 5, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip formatter={(v) => [hours(Number(v ?? 0)) + " saat", "Fiili mesai"]}/>
                  <Bar dataKey="hours" fill="#dc3545" radius={[3,3,0,0]} maxBarSize={22}/>
                </BarChart>
              </ResponsiveContainer>
            </div> : <p className="py-12 text-center text-xs text-slate-500">Seçili ay için mesai hareketi bulunmuyor.</p>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            {([
              ["attendance","Mesai", FileClock], ["leaves","İzinler", CalendarDays],
              ["requests","Düzeltmeler", FileText], ["operations","Operasyon", Activity],
            ] as const).map(([key,label,Icon])=><button key={key} onClick={()=>setDetailTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-[5px] px-3 py-2 text-xs font-bold ${detailTab===key?"bg-slate-900 text-white":"bg-slate-100 text-slate-600"}`}><Icon size={14}/>{label}</button>)}
          </div>
          <div className="max-h-80 overflow-auto">
            {detailTab==="attendance" && (attendance.length ? attendance.slice(0,60).map(a=><div key={a.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-xs">
              <div><div className="font-semibold text-slate-800">{trDay(a.check_in_time)} · {trTime(a.check_in_time)} - {trTime(a.check_out_time)}</div>
                <div className="text-slate-500">{a.status || "Mesai"} · Mola: {hours(toNumber(a.break_hours))} sa</div></div>
              <div className="shrink-0 font-bold text-slate-900">{isHoliday(a) ? "Resmi tatil" : isLeave(a) ? "İzin" : hours(work(a))+" sa"}</div>
            </div>) : <p className="py-5 text-xs text-slate-500">Mesai kaydı yok.</p>)}
            {detailTab==="leaves" && (leaves.length ? leaves.slice(0,60).map(l=><div key={l.id} className="flex justify-between gap-3 border-b border-slate-100 py-3 text-xs">
              <div><div className="font-semibold text-slate-800">{l.custom_leave_type || l.leave_type}</div><div className="text-slate-500">{shortDay(l.start_date)} - {shortDay(l.end_date)} · {l.requested_days} gün {l.is_half_day ? "· Yarım gün":""}</div></div>
              <Tag positive={approved(l.status)}>{l.status}</Tag>
            </div>) : <p className="py-5 text-xs text-slate-500">İzin talebi yok.</p>)}
            {detailTab==="requests" && (corrections.length ? corrections.slice(0,60).map(r=><div key={r.id} className="flex justify-between gap-3 border-b border-slate-100 py-3 text-xs">
              <div><div className="font-semibold text-slate-800">{shortDay(r.request_date)} · {r.request_type || "Mesai düzeltme"}</div><div className="max-w-xs text-slate-500">{r.reason}</div></div><Tag positive={approved(r.status)}>{r.status}</Tag>
            </div>) : <p className="py-5 text-xs text-slate-500">Mesai düzeltme talebi yok.</p>)}
            {detailTab==="operations" && <>
              {operations.length ? operations.slice(0,40).map(r=><div key={r.id} className="border-b border-slate-100 py-2.5 text-xs">
                <div className="font-semibold text-slate-800">{r.action_type} · {trDay(r.created_at)} {trTime(r.created_at)}</div>
                {r.description && <div className="text-slate-500">{r.description}</div>}
              </div>) : <p className="py-3 text-xs text-slate-500">Bu ay operasyon kaydı yok.</p>}
              {sessions.length > 0 && <div className="mt-3 border-t border-slate-200 pt-2">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800"><PackageCheck size={14}/> Kargo oturumları</p>
                {sessions.slice(0,30).map(s=><div key={s.id} className="flex justify-between gap-2 border-b border-slate-100 py-2 text-xs">
                  <span>{s.carrier_name} · {s.started_at ? trDay(s.started_at) : "-"} · {s.status || "-"}</span>
                  <span className="font-bold">{s.total_items ?? 0} adet</span>
                </div>)}
              </div>}
            </>}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Mesai ve operasyon hareketleri seçili aya; izin ve düzeltme talepleri personelin kayıtlı geçmişine aittir. Listelerde son 60 kayıt gösterilir.</p>
        </>}
      </section>
    </div>
    <nav className={card + " flex flex-wrap gap-2 p-4 text-xs font-semibold"}>
      <Link className="rounded-[5px] bg-slate-100 px-3 py-2 text-slate-700" href="/management/hr/reports">Klasik puantaj raporu</Link>
      <Link className="rounded-[5px] bg-slate-100 px-3 py-2 text-slate-700" href="/management/hr/leave-management">İzin bakiyesi yönetimi</Link>
      <Link className="rounded-[5px] bg-slate-100 px-3 py-2 text-slate-700" href="/management/hr/attendance-editor">Mesai düzeltme</Link>
      <Link className="rounded-[5px] bg-slate-100 px-3 py-2 text-slate-700" href="/management/hr/multinet">Multinet hesaplamaları</Link>
    </nav>
  </main>;
}
