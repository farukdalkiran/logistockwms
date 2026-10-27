"use client";

import { useEffect, useState } from "react";
import { getPublicHolidays,savePublicHoliday,removePublicHoliday } from "@/app/actions/public-holidays";
import { HOLIDAY_WINDOWS,istanbulDate,type HolidayPeriod,type PublicHoliday } from "@/lib/attendance/day-coverage";
import { 
  Clock, ShieldAlert, CheckCircle2, AlertCircle, Save, 
  UserCheck, Calendar, Search, CalendarDays, Zap, 
  Users, Trash2, PlusCircle, TerminalSquare, Edit2, RefreshCw, X, ArrowRight, LogIn, LogOut, Sun, CalendarRange, Info
} from "lucide-react";
import { 
  upsertDirectAttendance, 
  getAttendanceHistory, 
  deleteAttendance 
} from "@/app/actions/direct-attendance";
import { 
  analyzeAttendanceGaps, 
  processBulkMissingAttendance 
} from "@/app/actions/smart-attendance";
import { useRouter } from "next/navigation";

interface Employee { id: string; full_name: string; position_title: string; }

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  target_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  break_minutes: number;
  status: string;
}

interface Props {
  managerId: string;
  managerName: string;
  managerTitle: string;
  employees: Employee[];
}

// 🕒 UTC -> GMT+3 (İstanbul) Çevirici Fonksiyonlar
const formatLocalTime = (isoString: string | null) => {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul', hour12: false });
};

const getLocalInputTime = (isoString: string | null) => {
  if (!isoString) return ""; 
  return new Date(isoString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul', hour12: false });
};

export default function DeveloperAttendancePanel({ managerId, managerName, managerTitle, employees }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"HISTORY" | "NEW_RECORD" | "SMART_GAP" | "HOLIDAYS">("HISTORY");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // --- TAB 1: GEÇMİŞ VE DÜZENLEME ---
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterEmpId, setFilterEmpId] = useState("");

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editEntryType, setEditEntryType] = useState<"IN_ONLY" | "IN_OUT">("IN_OUT");
  const [editForm, setEditForm] = useState({ check_in: "", check_out: "", break_minutes: 60, note: "DEV_OVERRIDE: Güncellendi." });

  // --- TAB 2: SIFIRDAN KAYIT ---
  const [newEntryType, setNewEntryType] = useState<"IN_ONLY" | "IN_OUT">("IN_OUT");
  const [newForm, setNewForm] = useState({ 
    employee_id: "", 
    target_date: new Date().toISOString().split('T')[0], 
    check_in: "08:00", 
    check_out: "17:00", 
    break_minutes: 60, 
    note: "DEV_OVERRIDE: Sıfırdan zorla eklendi." 
  });

  // --- TAB 3: AKILLI EKSİK TARAMA (Tarih Aralığı) ---
  const [gapStartDate, setGapStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [gapEndDate, setGapEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [gaps, setGaps] = useState<{ date: string; employeeIds: string[]; partialEmployeeIds: string[] }[]>([]);
  const [gapConfig, setGapConfig] = useState<Record<string, { isHoliday: boolean, checkIn: string, checkOut: string, breakMinutes: number }>>({});
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [holidayDate,setHolidayDate]=useState(()=>{
    const tomorrow=new Date(Date.now()+86400000);
    return istanbulDate(tomorrow.toISOString());
  });
  const [holidayTitle,setHolidayTitle]=useState("Resmî Tatil");
  const [holidayPeriod,setHolidayPeriod]=useState<HolidayPeriod>("AFTERNOON");
  const [holidayList,setHolidayList]=useState<PublicHoliday[]>([]);
  const [holidayLoading,setHolidayLoading]=useState(false);
  const [holidayLoaded,setHolidayLoaded]=useState(false);
  const fetchHolidays=async()=>{
    setHolidayLoading(true);
    const result=await getPublicHolidays(`${new Date().getFullYear()-1}-01-01`,`${new Date().getFullYear()+2}-12-31`);
    if(result.success){setHolidayList(result.data);setHolidayLoaded(true);}
    else setFeedback({type:"error",msg:result.message});
    setHolidayLoading(false);
  };
  useEffect(()=>{
    if(activeTab==="HOLIDAYS" && !holidayLoaded)void fetchHolidays();
  },[activeTab,holidayLoaded]);
  const saveHoliday=async(e:React.FormEvent)=>{
    e.preventDefault();setLoading(true);setFeedback(null);
    const result=await savePublicHoliday({holiday_date:holidayDate,title:holidayTitle,period:holidayPeriod});
    if(result.success){setFeedback({type:"success",msg:result.message||"Tatil kaydedildi."});await fetchHolidays();router.refresh();}
    else setFeedback({type:"error",msg:result.message});
    setLoading(false);
  };
  const removeHoliday=async(id:string)=>{
    if(!window.confirm("Resmî tatili kaldırmak istiyor musunuz? Gerçek mesai kayıtları korunacak."))return;
    setLoading(true);
    const result=await removePublicHoliday(id);
    if(result.success){setFeedback({type:"success",msg:result.message||"Tatil kaldırıldı."});await fetchHolidays();router.refresh();}
    else setFeedback({type:"error",msg:result.message});
    setLoading(false);
  };
  const fillableCount=gaps.reduce((sum,g)=>sum+g.employeeIds.length,0);


  // 1. SORGULAMA İŞLEMİ
  const handleSearchHistory = async () => {
    setFetchingHistory(true);
    setFeedback(null);
    try {
      const res = await getAttendanceHistory(filterMonth, filterYear, filterEmpId || null);
      if (res.success && res.data) {
        const enrichedData = res.data.map(rec => {
          const emp = employees.find(e => e.id === rec.employee_id);
          return { ...rec, employee_name: emp ? emp.full_name : rec.employee_id };
        });
        setHistoryRecords(enrichedData);
        if(enrichedData.length === 0) setFeedback({ type: "success", msg: "Kriterlere uygun kayıt bulunamadı." });
      } else {
        setFeedback({ type: "error", msg: res.message || "Sorgulama hatası." });
      }
    } catch (error) {
      console.error(error);
      setFeedback({ type: "error", msg: "Sistemsel bir hata oluştu." });
    } finally {
      setFetchingHistory(false);
    }
  };

  // 2. KAYIT DÜZENLEME (Geçersiz Zaman Hatasını Kökten Çözen Dinamik Obje Mantığı)
  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    if (!editForm.check_in) return setFeedback({ type: "error", msg: "Giriş saati zorunludur." });
    if (editEntryType === "IN_OUT" && !editForm.check_out) return setFeedback({ type: "error", msg: "Giriş & Çıkış seçildiğinde çıkış saati de zorunludur." });

    setLoading(true); setFeedback(null);
    
    // YENİ GÜVENLİK DUVARI: Objeye SADECE ihtiyaç olan verileri koyuyoruz (Null veya empty string yollamıyoruz)
    const payload: any = {
      record_id: editingRecord.id,
      employee_id: editingRecord.employee_id,
      target_date: editingRecord.target_date,
      check_in: editForm.check_in, 
      manager_id: managerId,
      note: editForm.note,
      is_developer_override: true 
    };

    if (editEntryType === "IN_OUT") {
      payload.check_out = editForm.check_out;
      payload.break_minutes = editForm.break_minutes;
    }

    const result = await upsertDirectAttendance(payload);

    if (result.success) {
      setFeedback({ type: "success", msg: "Mesai kaydı güncellendi." });
      setEditingRecord(null);
      handleSearchHistory(); 
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message || "Güncelleme başarısız." });
    }
    setLoading(false);
  };

  // 3. KAYIT SİLME
  const handleDeleteClick = async (recordId: string) => {
    if (!confirm("DİKKAT: Bu mesai kaydı tamamen silinecek ve LOG TUTULMAYACAK. Onaylıyor musun?")) return;
    setFetchingHistory(true);
    
    const result = await deleteAttendance(recordId, managerId);
    
    if (result.success) {
      setFeedback({ type: "success", msg: "KAYIT SİSTEMDEN KAZINDI." });
      setHistoryRecords(prev => prev.filter(r => r.id !== recordId));
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message || "Silme başarısız." });
    }
    setFetchingHistory(false);
  };

  // 4. SIFIRDAN YENİ KAYIT (Sadece Giriş Eklendiğinde Çıkış Sütununu Göndermeyen Yapı)
  const handleNewRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.employee_id) return setFeedback({ type: "error", msg: "LÜTFEN PERSONEL SEÇİN." });
    if (!newForm.check_in) return setFeedback({ type: "error", msg: "Giriş saati zorunludur." });
    if (newEntryType === "IN_OUT" && !newForm.check_out) return setFeedback({ type: "error", msg: "Çıkış saati zorunludur." });
    
    setLoading(true); setFeedback(null);
    
    // Sadece gerekli kolonları içeren dinamik payload:
    const payload: any = { 
      employee_id: newForm.employee_id,
      target_date: newForm.target_date,
      check_in: newForm.check_in, 
      manager_id: managerId, 
      is_developer_override: true 
    };

    if (newEntryType === "IN_OUT") {
      payload.check_out = newForm.check_out;
      payload.break_minutes = newForm.break_minutes;
    }

    const result = await upsertDirectAttendance(payload);

    if (result.success) {
      setFeedback({ type: "success", msg: "Mesai kaydı oluşturuldu." });
      setNewForm(prev => ({ ...prev, check_in: "08:00", check_out: "17:00", employee_id: "" }));
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message || "Kayıt işlemi başarısız." });
    }
    setLoading(false);
  };

  // 5. AKILLI EKSİK TARAMA & TOPLU İŞLEM (TARİH ARALIĞI GÜNCELLEMESİ)
  const handleAnalyzeGaps = async () => {
    if (selectedEmps.length === 0) return setFeedback({ type: "error", msg: "LÜTFEN PERSONEL SEÇİN." });
    if (!gapStartDate || !gapEndDate) return setFeedback({ type: "error", msg: "Lütfen başlangıç ve bitiş tarihlerini seçin." });
    if (new Date(gapStartDate) > new Date(gapEndDate)) return setFeedback({ type: "error", msg: "Başlangıç tarihi bitiş tarihinden büyük olamaz." });

    setLoading(true); setFeedback(null);
    
    // NOT: analyzeAttendanceGaps fonksiyonunun Server Action tarafında bu imzayı desteklediğinden emin ol.
    // (Aksi takdirde app/actions/smart-attendance.ts dosyasını (startDate, endDate) alacak şekilde güncellemen gerekir.)
    const result = await analyzeAttendanceGaps(selectedEmps, gapStartDate, gapEndDate, excludedDates);
    
    if (result.success && result.data) {
      setGaps(result.data);
      const initialConfig: any = {};
      result.data.forEach((g: any) => { initialConfig[g.date] = { isHoliday: false, checkIn: "08:00", checkOut: "17:00", breakMinutes: 60 }; });
      setGapConfig(initialConfig);
      if(result.data.length === 0) setFeedback({ type: "success", msg: "EKSİK KAYIT BULUNAMADI." });
    } else { 
      setFeedback({ type: "error", msg: result.message || "Tarama başarısız oldu." }); 
    }
    setLoading(false);
  };

  const handleBulkSubmit = async () => {
    if (fillableCount === 0) return;
    if (!window.confirm("Seçili eksik günleri, LOG TUTMADAN sisteme işlemek istediğinize emin misiniz?")) return;
    setLoading(true); setFeedback(null);
    const payloads = gaps.filter(g=>g.employeeIds.length).map(g => ({ date: g.date, employeeIds: g.employeeIds, ...gapConfig[g.date], isHoliday:false }));
    const result = await processBulkMissingAttendance(payloads, managerId);
    if (result.success) {
      setFeedback({ type: "success", msg: "Eksik mesai kayıtları işlendi." });
      setGaps([]); router.refresh();
    } else { 
      setFeedback({ type: "error", msg: result.message || "İşlem başarısız." }); 
    }
    setLoading(false);
  };

  const tabs=[
    {id:"HISTORY" as const,label:"Mesai Geçmişi",icon:Search},
    {id:"NEW_RECORD" as const,label:"Manuel Mesai",icon:PlusCircle},
    {id:"SMART_GAP" as const,label:"Eksik Gün Tarama",icon:Zap},
    ...(managerTitle === "Developer"
      ? [{id:"HOLIDAYS" as const,label:"Resmî Tatiller",icon:Sun}]
      : []),
  ];
  return (
    <div className="mx-auto flex w-full flex-col overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm">
      <header className="border-b-2 border-[#dc3545] bg-[#101b2e] px-5 py-6 text-white md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-[5px] border border-white/15 bg-white/10 p-3"><CalendarRange size={24} className="text-red-400"/></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-red-300">LogiStock • İnsan Kaynakları</p>
              <h1 className="mt-1 text-xl font-black tracking-tight md:text-2xl">Puantaj ve Resmî Tatil Yönetimi</h1>
              <p className="mt-1 text-[11px] font-medium text-slate-300">Gerçek giriş–çıkış, izin saatleri ve resmî tatiller ayrı tutulur.</p>
            </div>
          </div>
          <span className="rounded-[5px] border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-200">{employees.length} aktif personel</span>
        </div>
      </header>
      <nav aria-label="Puantaj editörü bölümleri" className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3 lg:grid-cols-4">
        {tabs.map(({id,label,icon:Icon})=>(
          <button key={id} type="button" onClick={()=>{setActiveTab(id);setFeedback(null);}}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-[5px] border px-3 py-2.5 text-[11px] font-extrabold transition-colors ${activeTab===id?"border-[#dc3545] bg-[#dc3545] text-white":"border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-white"}`}>
            <Icon size={16}/>{label}
          </button>
        ))}
      </nav>
      {feedback && (
        <div className={`mx-6 mt-6 px-5 py-4 border-l-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-widest shadow-sm rounded-r-lg animate-in slide-in-from-top-2 ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-[#dc3545] text-[#dc3545]'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {activeTab === "HOLIDAYS" && (
        <div className="grid gap-5 bg-slate-50 p-4 md:grid-cols-12 md:p-7">
          <form onSubmit={saveHoliday} className="space-y-5 self-start rounded-[5px] border border-slate-200 bg-white p-5 shadow-sm md:col-span-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="rounded-[5px] bg-red-50 p-2 text-[#dc3545]"><Sun size={20}/></span>
              <div>
                <h2 className="text-sm font-black text-slate-900">Resmî tatil tanımla</h2>
                <p className="mt-1 text-[11px] text-slate-500">Tüm şubeler için uygulanır. Puantaja tatil saat kredisi ekler.</p>
              </div>
            </div>
            <label className="block text-xs font-bold text-slate-700">Tatil adı
              <input required minLength={3} maxLength={160} value={holidayTitle} onChange={e=>setHolidayTitle(e.target.value)}
                className="mt-2 h-11 w-full rounded-[5px] border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#dc3545] focus:outline-none"/>
            </label>
            <label className="block text-xs font-bold text-slate-700">Tarih
              <input required type="date" value={holidayDate} onChange={e=>setHolidayDate(e.target.value)}
                className="mt-2 h-11 w-full rounded-[5px] border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#dc3545] focus:outline-none"/>
            </label>
            <div>
              <p className="mb-2 text-xs font-bold text-slate-700">Tatil süresi</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["AFTERNOON","MORNING","FULL"] as HolidayPeriod[]).map(period=>{
                  const info=HOLIDAY_WINDOWS[period];
                  return <button type="button" key={period} onClick={()=>setHolidayPeriod(period)}
                    className={`rounded-[5px] border px-3 py-3 text-left transition-colors ${holidayPeriod===period?"border-[#dc3545] bg-red-50 text-red-800":"border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400"}`}>
                      <span className="block text-[11px] font-black">{period==="AFTERNOON"?"Öğleden sonra":period==="MORNING"?"Sabah":"Tam gün"}</span>
                      <span className="mt-1 block text-[10px] font-mono">{info.start}–{info.end}</span>
                      <span className="mt-1 block text-[10px] font-bold">{info.hours} saat</span>
                    </button>;
                })}
              </div>
            </div>
            <div className="rounded-[5px] border border-blue-200 bg-blue-50 p-3 text-[11px] leading-5 text-blue-800">
              <Info size={15} className="mr-1 inline"/> Resmî tatil gerçek mesai girişlerini değiştirmez. Örnek: sabah 4 saat çalışma/izin + 13.00–17.00 resmî tatil.
            </div>
            <button type="submit" disabled={loading||holidayLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[5px] bg-[#dc3545] text-xs font-black text-white hover:bg-red-700 disabled:opacity-50">
              {loading?<RefreshCw className="animate-spin" size={16}/>:<Save size={16}/>} Tatili kaydet
            </button>
          </form>
          <section className="self-start overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm md:col-span-7">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#101b2e] px-5 py-4 text-white">
              <div>
                <h2 className="text-sm font-black">Tanımlanmış resmî tatiller</h2>
                <p className="mt-1 text-[11px] text-slate-300">Gerçek giriş–çıkış veya izin satırlarını silmez.</p>
              </div>
              <button type="button" onClick={()=>void fetchHolidays()} disabled={holidayLoading}
                className="rounded-[5px] border border-white/20 p-2 hover:bg-white/10" title="Tatilleri yenile"><RefreshCw size={16} className={holidayLoading?"animate-spin":""}/></button>
            </div>
            <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
              {holidayList.length===0 && <p className="p-8 text-center text-xs text-slate-500">Henüz resmî tatil tanımlanmamış.</p>}
              {holidayList.map(h=>(
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
                  <div>
                    <p className="text-[13px] font-black text-slate-800">{h.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{new Date(h.holiday_date+"T12:00:00+03:00").toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul",day:"numeric",month:"long",year:"numeric"})} · {h.start_time.slice(0,5)}–{h.end_time.slice(0,5)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-[5px] border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-black text-red-700">{h.credited_hours} saat</span>
                    <button type="button" onClick={()=>{setHolidayDate(h.holiday_date);setHolidayTitle(h.title);setHolidayPeriod(h.period);}}
                      className="rounded-[5px] border border-slate-200 p-2 text-slate-500 hover:border-slate-400" title="Düzenle"><Edit2 size={15}/></button>
                    <button type="button" onClick={()=>void removeHoliday(h.id)} className="rounded-[5px] border border-red-200 p-2 text-red-600 hover:bg-red-50" title="Sil"><Trash2 size={15}/></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* =========================================
          TAB 1: GEÇMİŞ & SORGULAMA 
          ========================================= */}
      {activeTab === "HISTORY" && (
        <div className="p-6 md:p-8 flex flex-col gap-8 bg-slate-50 min-h-[500px] animate-in fade-in">
          
          <div className="flex flex-col md:flex-row items-end gap-5 p-6 bg-white border border-slate-200 shadow-sm rounded-[5px]">
            <div className="flex flex-col gap-2 w-full md:w-1/3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Personel (Opsiyonel)</label>
              <select value={filterEmpId} onChange={(e) => setFilterEmpId(e.target.value)} className="h-12 w-full bg-slate-50 border border-slate-200 px-4 text-xs font-black text-slate-700 uppercase outline-none focus:border-[#0F172B] focus:bg-white rounded-[5px] transition-colors cursor-pointer">
                <option value="">-- Tüm Personeller --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-1/3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dönem Seçimi</label>
              <div className="flex items-center gap-3">
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="h-12 flex-1 bg-slate-50 border border-slate-200 px-4 text-xs font-black text-slate-700 uppercase outline-none focus:border-[#0F172B] focus:bg-white rounded-[5px] transition-colors cursor-pointer">
                  {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{new Date(2026, i, 1).toLocaleString('tr-TR', {month: 'long'})}</option>)}
                </select>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="h-12 w-28 bg-slate-50 border border-slate-200 px-3 text-xs font-black text-slate-700 outline-none focus:border-[#0F172B] focus:bg-white rounded-[5px] transition-colors text-center cursor-pointer">
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>
            <button onClick={handleSearchHistory} disabled={fetchingHistory} className="h-12 px-8 bg-[#0F172B] text-white text-xs font-black tracking-widest uppercase hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2.5 md:w-auto w-full rounded-[5px] active:scale-95">
              {fetchingHistory ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} SORGULA
            </button>
          </div>

          <div className="overflow-x-auto bg-white border border-slate-200 rounded-[5px] shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-500 font-black tracking-widest uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Tarih</th>
                  <th className="px-6 py-4">Personel</th>
                  <th className="px-6 py-4 text-center">Giriş (GMT+3)</th>
                  <th className="px-6 py-4 text-center">Çıkış (GMT+3)</th>
                  <th className="px-6 py-4 text-center">Statü</th>
                  <th className="px-6 py-4 text-center w-28">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="font-bold text-slate-700 divide-y divide-slate-50">
                {historyRecords.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-16 text-center font-bold text-slate-400 uppercase tracking-widest">Tabloda veri yok. Sorgulama yapınız.</td></tr>
                ) : (
                  historyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-black text-slate-800">{record.target_date}</td>
                      <td className="px-6 py-4 uppercase text-slate-600">{record.employee_name}</td>
                      <td className="px-6 py-4 text-center font-mono text-[13px] font-black text-slate-600">
                        {formatLocalTime(record.check_in_time)}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-[13px] font-black text-slate-600">
                        {formatLocalTime(record.check_out_time)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-600 font-black text-[9px] uppercase tracking-wider rounded-md border border-slate-200">{record.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {record.status?.startsWith("LEAVE_") ? (
                          <span className="text-[10px] font-bold text-blue-600">İzin talebinden yönetilir</span>
                        ) : <div className="flex items-center justify-center gap-2">
                        <button onClick={() => {
                          setEditingRecord(record);
                          setEditEntryType(record.check_out_time ? "IN_OUT" : "IN_ONLY");
                          setEditForm({
                            check_in: getLocalInputTime(record.check_in_time),
                            check_out: getLocalInputTime(record.check_out_time),
                            break_minutes: record.break_minutes,
                            note: "DEV_OVERRIDE: Güncellendi."
                          });
                        }} className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-[#0F172B] hover:border-[#0F172B] transition-all shadow-sm rounded-[5px] active:scale-95">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteClick(record.id)} className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-[#dc3545] hover:border-[#dc3545] hover:bg-red-50 transition-all shadow-sm rounded-[5px] active:scale-95">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        </div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ŞIK DÜZENLEME MODALI */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-slate-50 border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden rounded-[5px] animate-in zoom-in-95 duration-200">
            <div className="bg-white p-5 flex items-center justify-between border-b border-slate-200">
              <h2 className="text-slate-800 text-sm font-black tracking-widest uppercase flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Edit2 className="w-4 h-4" />
                </div>
                Kayıt Manipülasyonu
              </h2>
              <button onClick={() => setEditingRecord(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            
            <form onSubmit={handleUpdateRecord} className="p-7 flex flex-col gap-7">
              <div className="flex justify-between items-center bg-white p-4 rounded-[5px] border border-slate-200 shadow-sm uppercase tracking-wider text-xs font-black text-slate-700">
                <span>{editingRecord.employee_name}</span>
                <span className="text-amber-600 bg-amber-50 px-3 py-1 rounded-md">{editingRecord.target_date}</span>
              </div>

              {/* YENİ: AKICI SEGMENTED CONTROL (Radyo Tasarımı) */}
              <div className="flex flex-col gap-2 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kayıt Türü Seçimi</label>
                <div className="relative flex items-center p-1 bg-slate-200/70 border border-slate-200 rounded-[5px] shadow-inner w-full">
                  <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[5px] shadow-sm border border-slate-200 transition-transform duration-300 ease-out ${editEntryType === 'IN_OUT' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}></div>
                  
                  <button type="button" onClick={() => setEditEntryType("IN_ONLY")} className={`relative z-10 flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${editEntryType === 'IN_ONLY' ? 'text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    <LogIn className="w-3.5 h-3.5" /> Sadece Giriş
                  </button>
                  <button type="button" onClick={() => setEditEntryType("IN_OUT")} className={`relative z-10 flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${editEntryType === 'IN_OUT' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    <LogOut className="w-3.5 h-3.5" /> Giriş & Çıkış
                  </button>
                </div>
              </div>
              
              <div className="flex gap-4 items-end bg-white p-5 rounded-[5px] border border-slate-200 shadow-sm relative overflow-hidden transition-all duration-300">
                <div className="flex-1 flex flex-col gap-2 relative z-10">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Clock className="w-3 h-3 text-amber-500" /> Giriş Saati</label>
                  <input type="time" value={editForm.check_in} onChange={e => setEditForm({...editForm, check_in: e.target.value})} required className="h-12 w-full text-center bg-slate-50 border border-slate-200 font-mono text-base font-black text-slate-800 outline-none focus:border-amber-500 focus:bg-white rounded-[5px] transition-colors" />
                </div>
                
                {editEntryType === "IN_OUT" && (
                  <>
                    <ArrowRight className="w-5 h-5 text-slate-300 mb-3.5 shrink-0 relative z-10 animate-in slide-in-from-left-2 fade-in" />
                    <div className="flex-1 flex flex-col gap-2 relative z-10 animate-in slide-in-from-right-4 fade-in duration-300">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Clock className="w-3 h-3 text-emerald-500" /> Çıkış Saati</label>
                      <input type="time" value={editForm.check_out} onChange={e => setEditForm({...editForm, check_out: e.target.value})} required className="h-12 w-full text-center bg-slate-50 border border-slate-200 font-mono text-base font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white rounded-[5px] transition-colors" />
                    </div>
                  </>
                )}
              </div>
              
              {editEntryType === "IN_OUT" && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-4 fade-in duration-300">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mola Kesintisi (Dakika)</label>
                  <input type="number" value={editForm.break_minutes} onChange={e => setEditForm({...editForm, break_minutes: Number(e.target.value)})} required className="h-12 w-full px-5 bg-white border border-slate-200 font-mono text-base font-black text-slate-800 outline-none focus:border-emerald-500 rounded-[5px] transition-colors shadow-sm" />
                </div>
              )}
              
              <button type="submit" disabled={loading} className="h-14 w-full bg-amber-500 text-white text-xs font-black tracking-widest uppercase hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 mt-2 rounded-[5px] active:scale-95">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} DEĞİŞİKLİKLERİ UYGULA
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          TAB 2: SIFIRDAN YENİ KAYIT ZORLA 
          ========================================= */}
      {activeTab === "NEW_RECORD" && (
        <div className="p-6 md:p-8 bg-slate-50 min-h-[500px] flex justify-center animate-in fade-in">
          <form onSubmit={handleNewRecordSubmit} className="bg-white border border-slate-200 shadow-xl rounded-[5px] w-full max-w-2xl p-8 flex flex-col gap-8 h-max">
            
            <div className="flex flex-col items-center text-center gap-2 pb-6 border-b border-slate-100">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center border border-red-100">
                <PlusCircle className="w-7 h-7 text-[#dc3545]" />
              </div>
              <h2 className="text-lg font-black text-slate-800 tracking-widest uppercase mt-2">Manuel Mesai Ekle</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider max-w-sm">Tablodan bağımsız logsuz kayıt. İhtiyacınıza göre tekli veya çiftli giriş yapabilirsiniz.</p>
            </div>

            {/* YENİ: AKICI SEGMENTED CONTROL (Radyo Tasarımı) */}
            <div className="flex flex-col gap-2.5 max-w-md mx-auto w-full">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">Kayıt Türü Seçimi</label>
              <div className="relative flex items-center p-1 bg-slate-100 border border-slate-200 rounded-[5px] shadow-inner w-full">
                <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[5px] shadow-sm border border-slate-200 transition-transform duration-300 ease-out ${newEntryType === 'IN_OUT' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}></div>
                
                <button type="button" onClick={() => setNewEntryType("IN_ONLY")} className={`relative z-10 flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${newEntryType === 'IN_ONLY' ? 'text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  <LogIn className="w-4 h-4" /> Sadece Giriş
                </button>
                <button type="button" onClick={() => setNewEntryType("IN_OUT")} className={`relative z-10 flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${newEntryType === 'IN_OUT' ? 'text-[#dc3545]' : 'text-slate-500 hover:text-slate-700'}`}>
                  <LogOut className="w-4 h-4" /> Giriş & Çıkış
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[5px] border border-slate-100">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Personel Seçimi</label>
                <select value={newForm.employee_id} onChange={e => setNewForm({...newForm, employee_id: e.target.value})} className="h-12 w-full bg-white border border-slate-200 px-4 text-[13px] font-black text-slate-800 uppercase outline-none focus:border-[#dc3545] rounded-[5px] shadow-sm transition-colors cursor-pointer">
                  <option value="">-- Listeden Personel Seçin --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position_title})</option>)}
                </select>
              </div>
              
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">İşlem Tarihi</label>
                <input type="date" value={newForm.target_date} onChange={e => setNewForm({...newForm, target_date: e.target.value})} className="h-12 w-full bg-white border border-slate-200 px-4 text-[13px] font-black text-slate-800 outline-none focus:border-[#dc3545] rounded-[5px] shadow-sm transition-colors cursor-pointer" />
              </div>

              <div className={`grid gap-6 md:col-span-2 transition-all duration-300 ${newEntryType === "IN_OUT" ? "grid-cols-3" : "grid-cols-1"}`}>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Clock className="w-3 h-3 text-[#dc3545]" /> Giriş Saati</label>
                  <input type="time" value={newForm.check_in} onChange={e => setNewForm({...newForm, check_in: e.target.value})} required className="h-12 w-full bg-white text-center border border-slate-200 text-lg font-mono font-black text-slate-800 outline-none focus:border-[#dc3545] rounded-[5px] shadow-sm transition-colors" />
                </div>

                {newEntryType === "IN_OUT" && (
                  <>
                    <div className="flex flex-col gap-2 animate-in slide-in-from-right-4 fade-in duration-300">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Clock className="w-3 h-3 text-[#dc3545]" /> Çıkış Saati</label>
                      <input type="time" value={newForm.check_out} onChange={e => setNewForm({...newForm, check_out: e.target.value})} required className="h-12 w-full bg-white text-center border border-slate-200 text-lg font-mono font-black text-slate-800 outline-none focus:border-[#dc3545] rounded-[5px] shadow-sm transition-colors" />
                    </div>
                    <div className="flex flex-col gap-2 animate-in slide-in-from-right-4 fade-in duration-300 delay-75">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">Mola Kesintisi (Dk)</label>
                      <input type="number" value={newForm.break_minutes} onChange={e => setNewForm({...newForm, break_minutes: Number(e.target.value)})} required className="h-12 w-full bg-white text-center border border-slate-200 text-lg font-mono font-black text-slate-800 outline-none focus:border-[#dc3545] rounded-[5px] shadow-sm transition-colors" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading} className="h-14 w-full bg-[#0F172B] text-white text-[13px] font-black tracking-widest uppercase hover:bg-slate-800 transition-colors shadow-xl flex items-center justify-center gap-3 rounded-[5px] active:scale-95">
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} SİSTEME LOGSUZ YAZ
            </button>
          </form>
        </div>
      )}

      {/* =========================================
          TAB 3: AKILLI EKSİK TARAMA (Tarih Aralığı Güncellemesi)
          ========================================= */}
      {activeTab === "SMART_GAP" && (
        <div className="flex flex-col lg:flex-row bg-slate-50 animate-in fade-in min-h-[500px]">
          {/* SOL: Filtre */}
          <div className="w-full lg:w-4/12 border-r border-slate-200 bg-white p-6 md:p-8 flex flex-col gap-7 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
            
            {/* YENİ: TARİH ARALIĞI SEÇİMİ */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tarama Aralığı (Başlangıç - Bitiş)</label>
              <div className="flex items-center gap-3">
                <input type="date" value={gapStartDate} onChange={e => setGapStartDate(e.target.value)} className="h-12 flex-1 bg-slate-50 border border-slate-200 font-black text-[13px] px-3 outline-none text-slate-700 uppercase rounded-[5px] shadow-sm focus:border-amber-500 focus:bg-white transition-colors cursor-pointer" />
                <span className="text-slate-300 font-black">-</span>
                <input type="date" value={gapEndDate} onChange={e => setGapEndDate(e.target.value)} className="h-12 flex-1 bg-slate-50 border border-slate-200 font-black text-[13px] px-3 outline-none text-slate-700 uppercase rounded-[5px] shadow-sm focus:border-amber-500 focus:bg-white transition-colors cursor-pointer" />
              </div>
            </div>

            <div className="flex flex-col gap-2.5 flex-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users className="w-4 h-4 text-amber-500" /> Personel Havuzu</span>
                <button onClick={() => setSelectedEmps(selectedEmps.length === employees.length ? [] : employees.map(e => e.id))} className="text-[9px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md transition-colors">TÜMÜNÜ SEÇ</button>
              </div>
              <div className="h-[280px] overflow-y-auto border border-slate-200 bg-slate-50 p-2 divide-y divide-slate-100 shadow-inner rounded-[5px]">
                {employees.map(emp => (
                  <label key={emp.id} className="flex items-center gap-3 p-3 bg-white mb-1 rounded-[5px] border border-transparent hover:border-amber-200 hover:shadow-sm cursor-pointer transition-all">
                    <input type="checkbox" checked={selectedEmps.includes(emp.id)} onChange={() => setSelectedEmps(prev => prev.includes(emp.id) ? prev.filter(e => e !== emp.id) : [...prev, emp.id])} className="w-4 h-4 accent-amber-500" />
                    <span className="text-xs font-black text-slate-700 truncate uppercase">{emp.full_name}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleAnalyzeGaps} disabled={loading || selectedEmps.length === 0} className="h-14 w-full bg-amber-500 text-white text-[11px] font-black tracking-widest uppercase hover:bg-amber-600 transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 rounded-[5px] active:scale-95">
              <Search className="w-4 h-4" /> EKSİKLERİ TARAT
            </button>
          </div>

          {/* SAĞ: Sonuçlar */}
          <div className="w-full lg:w-8/12 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2.5 border-b-2 border-slate-200 pb-4">
                <CalendarDays className="w-5 h-5 text-amber-500" /> Tespit Edilen Eksik Kayıtlar ({gaps.length})
              </h3>
              
              {gaps.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400 opacity-60">
                  <CheckCircle2 className="w-24 h-24 mb-5 text-slate-300" strokeWidth={1.5} />
                  <p className="text-xs font-black tracking-widest uppercase">Tarama Bekleniyor veya Eksik Yok</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-3">
                  {gaps.map((gap) => (
                    <div key={gap.date} className={`p-5 border transition-all rounded-[5px] ${gapConfig[gap.date]?.isHoliday ? 'border-amber-400 bg-amber-50 shadow-md' : 'border-slate-200 bg-white shadow-sm hover:shadow-md'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5`}>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-black text-slate-900 tracking-wide uppercase">{new Date(gap.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</span>
                        <span className="text-[10px] font-black text-amber-600 uppercase bg-amber-100/50 px-2.5 py-1 rounded-md w-max border border-amber-200">{gap.employeeIds.length} tam gün eksik</span>
                        {gap.partialEmployeeIds?.length > 0 && <span className="max-w-72 text-[10px] font-bold leading-5 text-rose-700">{gap.partialEmployeeIds.length} çalışanda yarım gün eksik. Sistem bu süreyi otomatik “çalıştı” yazmayacak; gerçek mesai veya ikinci izin dilimi eklenmelidir.</span>}
                      </div>
                      
                      <div className="flex items-center gap-5">
                        {gap.employeeIds.length > 0 && (
                          <div className="flex items-center gap-2">
                            <input type="time" value={gapConfig[gap.date]?.checkIn} onChange={(e) => setGapConfig(p => ({...p, [gap.date]: {...p[gap.date], checkIn: e.target.value}}))} className="h-11 w-24 text-center bg-slate-50 border border-slate-200 text-sm font-mono font-black outline-none text-slate-800 rounded-[5px] focus:border-amber-500 focus:bg-white transition-colors" />
                            <span className="text-slate-300 font-black">-</span>
                            <input type="time" value={gapConfig[gap.date]?.checkOut} onChange={(e) => setGapConfig(p => ({...p, [gap.date]: {...p[gap.date], checkOut: e.target.value}}))} className="h-11 w-24 text-center bg-slate-50 border border-slate-200 text-sm font-mono font-black outline-none text-slate-800 rounded-[5px] focus:border-amber-500 focus:bg-white transition-colors" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {fillableCount > 0 && (
              <button onClick={handleBulkSubmit} disabled={loading} className="h-16 w-full bg-emerald-600 text-white text-[13px] font-black tracking-widest uppercase hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-3 mt-6 rounded-[5px] active:scale-95">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-6 h-6" />} EKSİK MESAİLERİ KAYDET
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}