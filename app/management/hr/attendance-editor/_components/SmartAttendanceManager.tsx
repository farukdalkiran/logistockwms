"use client";

import { useState, useEffect, useTransition } from "react";
import { 
  Clock, ShieldAlert, CheckCircle2, AlertCircle, Save, 
  UserCheck, Calendar, Search, CalendarDays, Zap, 
  Users, Trash2, PlusCircle, TerminalSquare, Edit2, History, RefreshCw, X
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
  if (!isoString) return "08:00";
  return new Date(isoString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul', hour12: false });
};

export default function DeveloperAttendancePanel({ managerId, managerName, managerTitle, employees }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"HISTORY" | "NEW_RECORD" | "SMART_GAP">("HISTORY");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // --- TAB 1: GEÇMİŞ VE DÜZENLEME (HISTORY & EDIT) ---
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterEmpId, setFilterEmpId] = useState("");

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ check_in: "", check_out: "", break_minutes: 60, note: "DEV_OVERRIDE: Güncellendi." });

  // --- TAB 2: SIFIRDAN KAYIT (NEW RECORD) ---
  const [newForm, setNewForm] = useState({ 
    employee_id: "", target_date: new Date().toISOString().split('T')[0], 
    check_in: "08:00", check_out: "17:00", break_minutes: 60, note: "DEV_OVERRIDE: Sıfırdan zorla eklendi." 
  });

  // --- TAB 3: AKILLI EKSİK TARAMA (SMART GAP) ---
  const [gapMonth, setGapMonth] = useState(new Date().getMonth() + 1);
  const [gapYear, setGapYear] = useState(new Date().getFullYear());
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [gaps, setGaps] = useState<{ date: string; employeeIds: string[] }[]>([]);
  const [gapConfig, setGapConfig] = useState<Record<string, { isHoliday: boolean, checkIn: string, checkOut: string, breakMinutes: number }>>({});
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [customExcludeDate, setCustomExcludeDate] = useState("");

  // 1. GEÇMİŞİ SORGULA
  const handleSearchHistory = async () => {
    setFetchingHistory(true);
    setFeedback(null);
    try {
      const res = await getAttendanceHistory(filterMonth, filterYear, filterEmpId || null);
      if (res.success && res.data) {
        // Tabloda isim göstermek için employee tablosuyla eşleştirme
        const enrichedData = res.data.map(rec => {
          const emp = employees.find(e => e.id === rec.employee_id);
          return { ...rec, employee_name: emp ? emp.full_name : rec.employee_id };
        });
        setHistoryRecords(enrichedData);
        if(enrichedData.length === 0) setFeedback({ type: "success", msg: "Kriterlere uygun kayıt bulunamadı." });
      } else {
        setFeedback({ type: "error", msg: res.message });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setFetchingHistory(false);
    }
  };

  // 2. KAYDI GÜNCELLE (EDIT MODAL SUBMIT)
  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setLoading(true); setFeedback(null);
    
    const result = await upsertDirectAttendance({
      record_id: editingRecord.id,
      employee_id: editingRecord.employee_id,
      target_date: editingRecord.target_date,
      check_in: editForm.check_in,
      check_out: editForm.check_out,
      break_minutes: editForm.break_minutes,
      manager_id: managerId,
      note: editForm.note,
      is_developer_override: true 
    });

    if (result.success) {
      setFeedback({ type: "success", msg: "KAYIT İZ BIRAKMADAN GÜNCELLENDİ." });
      setEditingRecord(null);
      handleSearchHistory(); // Tabloyu yenile
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message });
    }
    setLoading(false);
  };

  // 3. KAYDI SİL
  const handleDeleteClick = async (recordId: string) => {
    if (!confirm("DİKKAT: Bu mesai kaydı tamamen silinecek ve LOG TUTULMAYACAK. Onaylıyor musun?")) return;
    setFetchingHistory(true);
    const result = await deleteAttendance(recordId, managerId, true);
    
    if (result.success) {
      setFeedback({ type: "success", msg: "KAYIT SİSTEMDEN KAZINDI." });
      setHistoryRecords(prev => prev.filter(r => r.id !== recordId));
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message });
    }
    setFetchingHistory(false);
  };

  // 4. SIFIRDAN YENİ KAYIT ZORLA
  const handleNewRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.employee_id) return setFeedback({ type: "error", msg: "LÜTFEN PERSONEL SEÇİN." });
    setLoading(true); setFeedback(null);
    
    const result = await upsertDirectAttendance({ 
      ...newForm, manager_id: managerId, is_developer_override: true 
    });

    if (result.success) {
      setFeedback({ type: "success", msg: "YENİ KAYIT SİSTEME ZORLA YAZILDI." });
      setNewForm(prev => ({ ...prev, check_in: "08:00", check_out: "17:00", note: "DEV_OVERRIDE: Sıfırdan zorla eklendi." }));
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message });
    }
    setLoading(false);
  };

  // 5. AKILLI EKSİK TARAMA & TOPLU İŞLEM (Aynı Bırakıldı, Sadece Stil Düzenlendi)
  const handleAnalyzeGaps = async () => {
    if (selectedEmps.length === 0) return setFeedback({ type: "error", msg: "LÜTFEN PERSONEL SEÇİN." });
    setLoading(true); setFeedback(null);
    const result = await analyzeAttendanceGaps(selectedEmps, gapYear, gapMonth, excludedDates);
    if (result.success && result.data) {
      setGaps(result.data);
      const initialConfig: any = {};
      result.data.forEach(g => { initialConfig[g.date] = { isHoliday: false, checkIn: "08:00", checkOut: "17:00", breakMinutes: 60 }; });
      setGapConfig(initialConfig);
      if(result.data.length === 0) setFeedback({ type: "success", msg: "EKSİK KAYIT BULUNAMADI." });
    } else { setFeedback({ type: "error", msg: result.message }); }
    setLoading(false);
  };

  const handleBulkSubmit = async () => {
    if (gaps.length === 0) return;
    if (!window.confirm("Seçili eksik günleri, LOG TUTMADAN sisteme işlemek istediğinize emin misiniz?")) return;
    setLoading(true); setFeedback(null);
    const payloads = gaps.map(g => ({ date: g.date, employeeIds: g.employeeIds, ...gapConfig[g.date] }));
    const result = await processBulkMissingAttendance(payloads, managerId, true);
    if (result.success) {
      setFeedback({ type: "success", msg: "TÜM KAYITLAR İZ BIRAKMADAN İŞLENDİ." });
      setGaps([]); router.refresh();
    } else { setFeedback({ type: "error", msg: result.message }); }
    setLoading(false);
  };

  return (
    <div className="w-full mx-auto flex flex-col bg-white border border-slate-300 shadow-2xl mb-10 select-none">
      
      {/* 🚀 ENDÜSTRİYEL DARK HEADING */}
      <div className="w-full bg-slate-950 p-6 flex flex-col md:flex-row items-start md:items-center justify-between border-b-4 border-[#dc3545] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ffffff_10px,#ffffff_20px)] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#dc3545] opacity-10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="bg-[#dc3545] p-3 shadow-[0_0_20px_rgba(220,53,69,0.4)] border border-red-400">
            <TerminalSquare className="w-7 h-7 text-white animate-pulse" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-[0.1em] uppercase drop-shadow-sm flex items-center gap-2">
              DEVELOPER OVERRIDE <span className="text-[#dc3545]">MODE</span>
            </h1>
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Log Bypass Aktif • Tam Veri Manipülasyonu
            </p>
          </div>
        </div>
      </div>

      {/* TABS (Sekmeler) */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button onClick={() => { setActiveTab("HISTORY"); setFeedback(null); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'HISTORY' ? 'border-[#dc3545] bg-white text-[#dc3545] shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-200/50'}`}>
          <Search className="w-4 h-4" /> GEÇMİŞ & SİL & DÜZENLE
        </button>
        <button onClick={() => { setActiveTab("NEW_RECORD"); setFeedback(null); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'NEW_RECORD' ? 'border-[#dc3545] bg-white text-[#dc3545] shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-200/50'}`}>
          <PlusCircle className="w-4 h-4" /> SIFIRDAN MESAİ ZORLA
        </button>
        <button onClick={() => { setActiveTab("SMART_GAP"); setFeedback(null); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'SMART_GAP' ? 'border-[#dc3545] bg-white text-[#dc3545] shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-200/50'}`}>
          <Zap className="w-4 h-4" /> AKILLI EKSİK TARAMA
        </button>
      </div>

      {feedback && (
        <div className={`mx-6 mt-6 p-4 border-2 flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-sm animate-in fade-in ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-[#dc3545] text-[#dc3545]'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* =========================================
          TAB 1: GEÇMİŞ & SORGULAMA (Ayrı Tablo Modülü)
          ========================================= */}
      {activeTab === "HISTORY" && (
        <div className="p-6 flex flex-col gap-6 bg-white min-h-[500px] animate-in fade-in">
          {/* FİLTRELEME ALANI */}
          <div className="flex flex-col md:flex-row items-end gap-4 p-5 border-2 border-slate-200 bg-slate-50">
            <div className="flex flex-col gap-1.5 w-full md:w-1/4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">PERSONEL (Opsiyonel)</label>
              <select value={filterEmpId} onChange={(e) => setFilterEmpId(e.target.value)} className="h-11 w-full bg-white border border-slate-300 px-3 text-sm font-bold text-slate-800 uppercase outline-none focus:border-[#dc3545]">
                <option value="">TÜM PERSONELLER</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 w-full md:w-1/4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AY / YIL</label>
              <div className="flex items-center gap-2">
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="h-11 flex-1 bg-white border border-slate-300 px-3 text-sm font-bold outline-none text-slate-800">
                  {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{new Date(2026, i, 1).toLocaleString('tr-TR', {month: 'long'}).toUpperCase()}</option>)}
                </select>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="h-11 w-24 bg-white border border-slate-300 px-2 text-sm font-bold outline-none text-slate-800 text-center">
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>
            <button onClick={handleSearchHistory} disabled={fetchingHistory} className="h-11 px-8 bg-slate-900 text-white text-xs font-black tracking-widest uppercase hover:bg-[#dc3545] transition-colors flex items-center justify-center gap-2 md:w-auto w-full">
              {fetchingHistory ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} SORGULA
            </button>
          </div>

          {/* VERİ TABLOSU */}
          <div className="overflow-x-auto border-2 border-slate-200">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-900 text-white font-black tracking-widest uppercase">
                <tr>
                  <th className="px-5 py-3.5 border-r border-slate-700">Tarih</th>
                  <th className="px-5 py-3.5 border-r border-slate-700">Personel</th>
                  <th className="px-5 py-3.5 border-r border-slate-700 text-center">Giriş (GMT+3)</th>
                  <th className="px-5 py-3.5 border-r border-slate-700 text-center">Çıkış (GMT+3)</th>
                  <th className="px-5 py-3.5 border-r border-slate-700 text-center">Statü</th>
                  <th className="px-5 py-3.5 text-center w-24">İşlem</th>
                </tr>
              </thead>
              <tbody className="font-medium text-slate-700 divide-y divide-slate-200">
                {historyRecords.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center font-bold text-slate-400 uppercase tracking-widest">Tabloda veri yok. Sorgulama yapınız.</td></tr>
                ) : (
                  historyRecords.map((record) => (
                    <tr key={record.id} className="even:bg-slate-50 hover:bg-amber-50/50 transition-colors">
                      <td className="px-5 py-3 border-r border-slate-200 font-bold">{record.target_date}</td>
                      <td className="px-5 py-3 border-r border-slate-200">{record.employee_name}</td>
                      <td className="px-5 py-3 border-r border-slate-200 text-center font-mono font-bold text-slate-900 bg-slate-100/50">
                        {formatLocalTime(record.check_in_time)}
                      </td>
                      <td className="px-5 py-3 border-r border-slate-200 text-center font-mono font-bold text-slate-900 bg-slate-100/50">
                        {formatLocalTime(record.check_out_time)}
                      </td>
                      <td className="px-5 py-3 border-r border-slate-200 text-center">
                        <span className="px-2 py-1 bg-slate-200 text-slate-800 font-black text-[9px] uppercase tracking-wider">{record.status}</span>
                      </td>
                      <td className="px-5 py-2 text-center flex items-center justify-center gap-2">
                        <button onClick={() => {
                          setEditingRecord(record);
                          setEditForm({
                            check_in: getLocalInputTime(record.check_in_time),
                            check_out: getLocalInputTime(record.check_out_time),
                            break_minutes: record.break_minutes,
                            note: "DEV_OVERRIDE: Güncellendi."
                          });
                        }} className="p-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors shadow-sm">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteClick(record.id)} className="p-2 bg-white border border-red-200 text-[#dc3545] hover:bg-[#dc3545] hover:text-white transition-colors shadow-sm">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT MODAL (Sadece Tablodan Düzenle Tıklanınca Açılır) */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border-4 border-slate-900 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 p-4 flex items-center justify-between">
              <h2 className="text-white text-sm font-black tracking-widest uppercase flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" /> KAYIT MANİPÜLASYONU
              </h2>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateRecord} className="p-6 flex flex-col gap-5">
              <div className="bg-slate-50 p-3 border border-slate-200 text-xs font-bold text-slate-700 flex justify-between">
                <span>{editingRecord.employee_name}</span>
                <span className="text-[#dc3545] font-black">{editingRecord.target_date}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">GİRİŞ (GMT+3)</label>
                  <input type="time" value={editForm.check_in} onChange={e => setEditForm({...editForm, check_in: e.target.value})} required className="h-12 w-full text-center border-2 border-slate-300 font-mono font-black text-slate-900 outline-none focus:border-[#dc3545]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">ÇIKIŞ (GMT+3)</label>
                  <input type="time" value={editForm.check_out} onChange={e => setEditForm({...editForm, check_out: e.target.value})} required className="h-12 w-full text-center border-2 border-slate-300 font-mono font-black text-slate-900 outline-none focus:border-[#dc3545]" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">MOLA (DAKİKA)</label>
                <input type="number" value={editForm.break_minutes} onChange={e => setEditForm({...editForm, break_minutes: Number(e.target.value)})} required className="h-12 w-full px-4 border-2 border-slate-300 font-mono font-black text-slate-900 outline-none focus:border-[#dc3545]" />
              </div>
              <button type="submit" disabled={loading} className="h-14 w-full bg-amber-500 text-white font-black tracking-widest uppercase hover:bg-amber-600 transition-colors shadow-md flex items-center justify-center gap-2 mt-2">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} SESSİZCE GÜNCELLE
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          TAB 2: SIFIRDAN YENİ KAYIT ZORLA (İzole Form)
          ========================================= */}
      {activeTab === "NEW_RECORD" && (
        <form onSubmit={handleNewRecordSubmit} className="p-8 flex flex-col gap-6 bg-white min-h-[500px] animate-in fade-in max-w-3xl mx-auto w-full">
          <div className="border-b-2 border-slate-100 pb-4 mb-2">
            <h2 className="text-sm font-black text-slate-800 tracking-widest uppercase flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#dc3545]" /> SIFIRDAN MESAİ OLUŞTUR
            </h2>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Tablodan bağımsız, sıfırdan kayıt oluşturur. Log bırakmaz.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">PERSONEL SEÇİMİ</label>
              <select value={newForm.employee_id} onChange={e => setNewForm({...newForm, employee_id: e.target.value})} className="h-14 w-full bg-slate-50 border-2 border-slate-300 px-4 text-sm font-black text-slate-800 uppercase outline-none focus:border-[#dc3545]">
                <option value="">-- Personel Seçiniz --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position_title})</option>)}
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">İŞLEM TARİHİ</label>
              <input type="date" value={newForm.target_date} onChange={e => setNewForm({...newForm, target_date: e.target.value})} className="h-14 w-full bg-slate-50 border-2 border-slate-300 px-4 text-sm font-black text-slate-900 outline-none focus:border-[#dc3545]" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">GİRİŞ SAATİ</label>
              <input type="time" value={newForm.check_in} onChange={e => setNewForm({...newForm, check_in: e.target.value})} className="h-14 w-full bg-slate-50 text-center border-2 border-slate-300 text-lg font-mono font-black text-slate-900 outline-none focus:border-[#dc3545]" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">ÇIKIŞ SAATİ</label>
              <input type="time" value={newForm.check_out} onChange={e => setNewForm({...newForm, check_out: e.target.value})} className="h-14 w-full bg-slate-50 text-center border-2 border-slate-300 text-lg font-mono font-black text-slate-900 outline-none focus:border-[#dc3545]" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="h-16 w-full bg-slate-950 text-white text-sm font-black tracking-[0.2em] uppercase hover:bg-[#dc3545] transition-colors shadow-lg flex items-center justify-center gap-3 mt-6">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-6 h-6" />} SİSTEME ZORLA YAZ
          </button>
        </form>
      )}

      {/* =========================================
          TAB 3: AKILLI EKSİK TARAMA (Düzenlenmiş Boşluklar)
          ========================================= */}
      {activeTab === "SMART_GAP" && (
        <div className="flex flex-col lg:flex-row bg-white animate-in fade-in min-h-[500px]">
          {/* SOL: Filtre */}
          <div className="w-full lg:w-4/12 border-r border-slate-200 bg-slate-50 p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">DÖNEM SEÇİMİ</label>
              <div className="flex items-center gap-2">
                <select value={gapMonth} onChange={e => setGapMonth(Number(e.target.value))} className="h-12 flex-1 bg-white border border-slate-300 font-bold text-xs px-3 outline-none text-slate-800">
                  {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{new Date(2026, i, 1).toLocaleString('tr-TR', {month: 'long'}).toUpperCase()}</option>)}
                </select>
                <select value={gapYear} onChange={e => setGapYear(Number(e.target.value))} className="h-12 w-24 bg-white border border-slate-300 font-bold text-xs px-2 outline-none text-slate-800 text-center">
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[#dc3545]" /> PERSONEL HAVUZU</span>
                <button onClick={() => setSelectedEmps(selectedEmps.length === employees.length ? [] : employees.map(e => e.id))} className="text-[9px] font-black text-[#dc3545] hover:underline">TÜMÜNÜ SEÇ</button>
              </div>
              <div className="h-48 overflow-y-auto border border-slate-300 bg-white p-1 divide-y divide-slate-100 shadow-inner">
                {employees.map(emp => (
                  <label key={emp.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selectedEmps.includes(emp.id)} onChange={() => setSelectedEmps(prev => prev.includes(emp.id) ? prev.filter(e => e !== emp.id) : [...prev, emp.id])} className="w-4 h-4 accent-[#dc3545]" />
                    <span className="text-xs font-bold text-slate-800 truncate">{emp.full_name}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleAnalyzeGaps} disabled={loading || selectedEmps.length === 0} className="h-14 w-full bg-[#0F172A] text-white text-xs font-black tracking-widest uppercase hover:bg-[#dc3545] transition-colors flex items-center justify-center gap-2 shadow-md">
              <Search className="w-4 h-4" /> EKSİKLERİ TARAT
            </button>
          </div>

          {/* SAĞ: Sonuçlar */}
          <div className="w-full lg:w-8/12 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
                <CalendarDays className="w-4 h-4 text-[#dc3545]" /> TESPİT EDİLEN EKSİK KAYITLAR ({gaps.length})
              </h3>
              
              {gaps.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400 opacity-60">
                  <CheckCircle2 className="w-16 h-16 mb-3 text-slate-300" strokeWidth={1.5} />
                  <p className="text-xs font-black tracking-widest uppercase">TARAMA BEKLENİYOR VEYA EKSİK YOK</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-2">
                  {gaps.map((gap) => (
                    <div key={gap.date} className={`p-4 border transition-all ${gapConfig[gap.date]?.isHoliday ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm`}>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 tracking-wide">{new Date(gap.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</span>
                        <span className="text-[10px] font-bold text-[#dc3545] uppercase mt-0.5">{gap.employeeIds.length} Çalışan Eksik</span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-300 shadow-sm cursor-pointer select-none">
                          <input type="checkbox" checked={gapConfig[gap.date]?.isHoliday} onChange={(e) => setGapConfig(p => ({...p, [gap.date]: {...p[gap.date], isHoliday: e.target.checked}}))} className="w-4 h-4 accent-amber-600" />
                          <span className="text-[10px] font-black uppercase text-amber-800">RESMİ TATİL</span>
                        </label>
                        
                        {!gapConfig[gap.date]?.isHoliday && (
                          <div className="flex items-center gap-2">
                            <input type="time" value={gapConfig[gap.date]?.checkIn} onChange={(e) => setGapConfig(p => ({...p, [gap.date]: {...p[gap.date], checkIn: e.target.value}}))} className="h-10 w-24 text-center bg-white border border-slate-300 text-sm font-mono font-black outline-none text-slate-800" />
                            <span className="text-slate-400 font-bold">-</span>
                            <input type="time" value={gapConfig[gap.date]?.checkOut} onChange={(e) => setGapConfig(p => ({...p, [gap.date]: {...p[gap.date], checkOut: e.target.value}}))} className="h-10 w-24 text-center bg-white border border-slate-300 text-sm font-mono font-black outline-none text-slate-800" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {gaps.length > 0 && (
              <button onClick={handleBulkSubmit} disabled={loading} className="h-16 w-full bg-emerald-600 text-white text-sm font-black tracking-[0.1em] uppercase hover:bg-emerald-700 shadow-lg transition-all flex items-center justify-center gap-3 mt-6 active:scale-95">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-6 h-6" />} LOGSUZ OLARAK TÜMÜNÜ SİSTEME BAS
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}