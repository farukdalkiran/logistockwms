"use client";

import { useState } from "react";
import { Clock, ShieldAlert, CheckCircle2, AlertCircle, Save, UserCheck, Calendar, Search, CalendarDays, Zap, Users, Trash2, PlusCircle } from "lucide-react";
import { upsertDirectAttendance } from "@/app/actions/direct-attendance";
import { analyzeAttendanceGaps, processBulkMissingAttendance } from "@/app/actions/smart-attendance";
import { useRouter } from "next/navigation";

interface Employee { id: string; full_name: string; position_title: string; }

interface Props {
  managerId: string;
  managerName: string;
  managerTitle: string;
  employees: Employee[];
}

export default function SmartAttendanceManager({ managerId, managerName, managerTitle, employees }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"MANUAL" | "SMART_GAP">("MANUAL");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Manuel Form State
  const [manualForm, setManualForm] = useState({ employee_id: "", target_date: new Date().toISOString().split('T')[0], check_in: "08:00", check_out: "17:00", break_minutes: 60, note: "" });

  // Smart Gap State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [gaps, setGaps] = useState<{ date: string; employeeIds: string[] }[]>([]);
  const [gapConfig, setGapConfig] = useState<Record<string, { isHoliday: boolean, checkIn: string, checkOut: string, breakMinutes: number }>>({});
  
  // 🛡️ Yeni: İşlemden Hariç Tutulacak / Çıkarılacak Günler Listesi
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [customExcludeDate, setCustomExcludeDate] = useState("");

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.employee_id) return setFeedback({ type: "error", msg: "LÜTFEN PERSONEL SEÇİN." });
    setLoading(true); setFeedback(null);
    const result = await upsertDirectAttendance({ ...manualForm, manager_id: managerId });
    if (result.success) {
      setFeedback({ type: "success", msg: result.message });
      setManualForm(prev => ({ ...prev, check_in: "08:00", check_out: "17:00", note: "" }));
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message });
    }
    setLoading(false);
  };

  const handleAnalyzeGaps = async () => {
    if (selectedEmps.length === 0) return setFeedback({ type: "error", msg: "LÜTFEN TARANACAK PERSONELLERİ SEÇİN." });
    setLoading(true); setFeedback(null);
    
    const result = await analyzeAttendanceGaps(selectedEmps, selectedYear, selectedMonth, excludedDates);
    if (result.success && result.data) {
      setGaps(result.data);
      const initialConfig: any = {};
      result.data.forEach(g => {
        initialConfig[g.date] = { isHoliday: false, checkIn: "08:00", checkOut: "17:00", breakMinutes: 60 };
      });
      setGapConfig(initialConfig);
      if(result.data.length === 0) setFeedback({ type: "success", msg: "SEÇİLİ AY İÇİN EKSİK KAYIT BULUNAMADI." });
    } else {
      setFeedback({ type: "error", msg: result.message });
    }
    setLoading(false);
  };

  const handleBulkSubmit = async () => {
    if (gaps.length === 0) return;
    if (!window.confirm("Seçili eksik günleri sisteme işlemek istediğinize emin misiniz?")) return;
    
    setLoading(true); setFeedback(null);
    const payloads = gaps.map(g => ({
      date: g.date,
      employeeIds: g.employeeIds,
      ...gapConfig[g.date]
    }));

    const result = await processBulkMissingAttendance(payloads, managerId);
    if (result.success) {
      setFeedback({ type: "success", msg: result.message });
      setGaps([]);
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message });
    }
    setLoading(false);
  };

  const toggleEmp = (id: string) => {
    setSelectedEmps(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };
  const toggleAllEmps = () => {
    setSelectedEmps(selectedEmps.length === employees.length ? [] : employees.map(e => e.id));
  };

  const addExcludedDate = () => {
    if (!customExcludeDate) return;
    if (!excludedDates.includes(customExcludeDate)) {
      setExcludedDates([...excludedDates, customExcludeDate]);
    }
    setCustomExcludeDate("");
  };

  const removeExcludedDate = (dateStr: string) => {
    setExcludedDates(excludedDates.filter(d => d !== dateStr));
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col shadow-2xl rounded-none border border-slate-300 select-none bg-white overflow-hidden">
      
      {/* 🚀 ENDÜSTRİYEL DARK HEADING */}
      <div className="w-full bg-[#0F172A] p-6 flex flex-col md:flex-row items-start md:items-center justify-between border-b-4 border-[#dc3545]">
        <div className="flex items-center gap-4">
          <div className="bg-[#dc3545] p-3 shadow-[0_0_15px_rgba(220,53,69,0.4)]">
            <Clock className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-[0.1em] uppercase drop-shadow-sm">MESAİ KONTROL & KAYIT MERKEZİ</h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.15em] mt-1">Bypass & Akıllı Eksik Tarama Modülü</p>
          </div>
        </div>
        <div className="bg-slate-900/90 px-5 py-2.5 border border-slate-700 mt-4 md:mt-0 flex items-center gap-4 shadow-inner">
           <ShieldAlert className="w-5 h-5 text-amber-400" />
           <div className="flex flex-col text-right">
             <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{managerTitle}</span>
             <span className="text-xs font-black text-slate-100 tracking-widest uppercase">{managerName}</span>
           </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-200 bg-slate-100/70">
        <button onClick={() => setActiveTab("MANUAL")} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'MANUAL' ? 'border-[#dc3545] bg-white text-[#dc3545] shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-200/50'}`}>
          <UserCheck className="w-4 h-4" /> TEKİL MESAİ GİRİŞİ
        </button>
        <button onClick={() => setActiveTab("SMART_GAP")} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'SMART_GAP' ? 'border-[#dc3545] bg-white text-[#dc3545] shadow-sm' : 'border-transparent text-slate-500 hover:bg-slate-200/50'}`}>
          <Zap className="w-4 h-4" /> AKILLI EKSİK TARAMA & GÜN ÇIKARMA
        </button>
      </div>

      {feedback && (
        <div className={`m-6 p-4 border-2 flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-sm animate-in fade-in ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-[#dc3545] text-[#dc3545]'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* --- TAB 1: TEKİL MANUEL GİRİŞ --- */}
      {activeTab === "MANUAL" && (
        <form onSubmit={handleManualSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white animate-in fade-in">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">PERSONEL SEÇİMİ</label>
            <select name="employee_id" value={manualForm.employee_id} onChange={(e) => setManualForm({...manualForm, employee_id: e.target.value})} className="h-12 w-full bg-slate-50 border-2 border-slate-200 px-4 text-sm font-black text-slate-800 uppercase outline-none focus:border-[#dc3545] transition-colors">
              <option value="">-- Personel Seçiniz --</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position_title})</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">İŞLEM TARİHİ</label>
            <input type="date" value={manualForm.target_date} onChange={(e) => setManualForm({...manualForm, target_date: e.target.value})} className="h-12 w-full bg-slate-50 border-2 border-slate-200 px-4 font-black text-slate-800 outline-none focus:border-[#dc3545] transition-colors" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">GİRİŞ - ÇIKIŞ SAATİ</label>
            <div className="flex items-center gap-2">
               <input type="time" value={manualForm.check_in} onChange={(e) => setManualForm({...manualForm, check_in: e.target.value})} className="h-12 w-full bg-slate-50 text-center border-2 border-slate-200 font-mono font-black text-slate-800 outline-none focus:border-[#dc3545]" />
               <input type="time" value={manualForm.check_out} onChange={(e) => setManualForm({...manualForm, check_out: e.target.value})} className="h-12 w-full bg-slate-50 text-center border-2 border-slate-200 font-mono font-black text-slate-800 outline-none focus:border-[#dc3545]" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">MOLA (DAKİKA) & NOT</label>
            <div className="flex items-center gap-2">
               <input type="number" value={manualForm.break_minutes} onChange={(e) => setManualForm({...manualForm, break_minutes: Number(e.target.value)})} className="h-12 w-28 bg-slate-50 text-center border-2 border-slate-200 font-mono font-black text-slate-800 outline-none focus:border-[#dc3545]" />
               <input type="text" placeholder="Yönetici Açıklaması..." value={manualForm.note} onChange={(e) => setManualForm({...manualForm, note: e.target.value})} className="h-12 w-full bg-slate-50 px-4 border-2 border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-[#dc3545]" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="md:col-span-2 h-14 w-full flex items-center justify-center gap-3 bg-[#0F172A] text-white text-xs font-black tracking-[0.15em] uppercase hover:bg-[#dc3545] transition-colors mt-4 shadow-md">
            {loading ? "İŞLENİYOR..." : <><Save className="w-5 h-5" /> MESAİYİ DOĞRUDAN KAYDET</>}
          </button>
        </form>
      )}

      {/* --- TAB 2: AKILLI EKSİK TARAMA & GÜN ÇIKARMA --- */}
      {activeTab === "SMART_GAP" && (
        <div className="flex flex-col lg:flex-row bg-white animate-in-fade min-h-[550px]">
          
          {/* SOL: Filtreleme, Personel Seçimi ve Hariç Tutulan Günler (Gün Çıkarma) */}
          <div className="w-full lg:w-4/12 border-r border-slate-200 bg-slate-50 p-6 flex flex-col gap-5">
            
            {/* Ay / Yıl Seçimi */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">DÖNEM SEÇİMİ</label>
              <div className="flex items-center gap-2">
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="h-11 flex-1 bg-white border-2 border-slate-200 font-black text-xs px-3 outline-none text-slate-800">
                  {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{new Date(2026, i, 1).toLocaleString('tr-TR', {month: 'long'}).toUpperCase()}</option>)}
                </select>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="h-11 w-28 bg-white border-2 border-slate-200 font-black text-xs px-3 outline-none text-slate-800 text-center">
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>

            {/* Personel Listesi */}
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[#dc3545]" /> PERSONEL HAVUZU</span>
                <button onClick={toggleAllEmps} className="text-[9px] font-black text-[#dc3545] hover:underline">TÜMÜNÜ SEÇ / BIRAK</button>
              </div>
              <div className="h-44 overflow-y-auto border-2 border-slate-200 bg-white p-1 divide-y divide-slate-100">
                {employees.map(emp => (
                  <label key={emp.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selectedEmps.includes(emp.id)} onChange={() => toggleEmp(emp.id)} className="w-4 h-4 accent-[#dc3545]" />
                    <span className="text-xs font-bold text-slate-800 truncate">{emp.full_name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 🛡️ YENİ: İstenmeyen Günleri Çıkarma Bölümü (Exclude Days) */}
            <div className="flex flex-col gap-1.5 border-t border-slate-200 pt-4">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-[#dc3545]" /> HARİÇ TUTulacak Günler (GÜN ÇIKARMA)
              </label>
              <div className="flex items-center gap-2">
                <input type="date" value={customExcludeDate} onChange={e => setCustomExcludeDate(e.target.value)} className="h-10 flex-1 bg-white border border-slate-300 px-3 text-xs font-mono font-bold text-slate-800 outline-none" />
                <button onClick={addExcludedDate} type="button" className="h-10 px-3 bg-slate-800 text-white text-xs font-black uppercase tracking-wider hover:bg-[#dc3545] transition-colors flex items-center gap-1">
                  <PlusCircle className="w-4 h-4" /> EKLE
                </button>
              </div>
              {excludedDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                  {excludedDates.map(d => (
                    <span key={d} className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1 text-[10px] font-mono font-black text-[#dc3545]">
                      {d}
                      <button onClick={() => removeExcludedDate(d)} className="hover:text-black">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleAnalyzeGaps} disabled={loading || selectedEmps.length === 0} className="h-12 w-full bg-[#0F172A] text-white text-xs font-black tracking-widest uppercase hover:bg-[#dc3545] transition-colors flex items-center justify-center gap-2 shadow-md">
              <Search className="w-4 h-4" /> EKSİKLERİ VE BOŞLUKLARI TARAT
            </button>
          </div>

          {/* SAĞ: Tespit Edilen Eksik Günler Komuta Paneli */}
          <div className="w-full lg:w-8/12 p-6 flex flex-col bg-white justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
                <CalendarDays className="w-4 h-4 text-[#dc3545]" /> TESPİT EDİLEN EKSİK KAYITLAR VE TATİL YÖNETİMİ ({gaps.length})
              </h3>
              
              {gaps.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400 opacity-60">
                  <CheckCircle2 className="w-16 h-16 mb-3 text-slate-300" strokeWidth={1.5} />
                  <p className="text-xs font-black tracking-widest uppercase">TARAMA BEKLENİYOR VEYA EKSİK KAYIT BULUNAMADI</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-2">
                  {gaps.map((gap) => (
                    <div key={gap.date} className={`p-4 border-2 transition-all ${gapConfig[gap.date]?.isHoliday ? 'border-amber-400 bg-amber-50/60' : 'border-slate-200 bg-slate-50/80'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm`}>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 tracking-wide">{new Date(gap.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{gap.employeeIds.length} Çalışanın Kaydı Eksik</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <label className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-300 shadow-sm cursor-pointer select-none">
                          <input type="checkbox" checked={gapConfig[gap.date]?.isHoliday} onChange={(e) => setGapConfig(p => ({...p, [gap.date]: {...p[gap.date], isHoliday: e.target.checked}}))} className="w-4 h-4 accent-amber-600" />
                          <span className="text-[10px] font-black uppercase text-amber-800">RESMİ TATİL (0 SAAT)</span>
                        </label>
                        
                        {!gapConfig[gap.date]?.isHoliday && (
                          <div className="flex items-center gap-1.5">
                            <input type="time" value={gapConfig[gap.date]?.checkIn} onChange={(e) => setGapConfig(p => ({...p, [gap.date]: {...p[gap.date], checkIn: e.target.value}}))} className="h-9 w-20 text-center bg-white border border-slate-300 text-xs font-mono font-black outline-none text-slate-800" title="Giriş" />
                            <span className="text-slate-400 font-bold">➜</span>
                            <input type="time" value={gapConfig[gap.date]?.checkOut} onChange={(e) => setGapConfig(p => ({...p, [gap.date]: {...p[gap.date], checkOut: e.target.value}}))} className="h-9 w-20 text-center bg-white border border-slate-300 text-xs font-mono font-black outline-none text-slate-800" title="Çıkış" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {gaps.length > 0 && (
              <button onClick={handleBulkSubmit} disabled={loading} className="h-14 w-full bg-emerald-600 text-white text-xs font-black tracking-widest uppercase hover:bg-emerald-700 shadow-lg transition-all flex items-center justify-center gap-2 mt-6 active:scale-95">
                {loading ? "SİSTEME İŞLENİYOR..." : <><CheckCircle2 className="w-5 h-5" /> ONAYLA VE TÜM EKSİKLERİ SİSTEME BAS</>}
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
