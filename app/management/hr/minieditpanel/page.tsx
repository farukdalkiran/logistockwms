"use client";

import { useState, useEffect } from "react";
import { 
  Clock, CheckCircle2, AlertCircle, Save, 
  Search, Trash2, PlusCircle, Edit2, RefreshCw, X, ArrowRight, LogIn, LogOut, User
} from "lucide-react";
import { 
  upsertDirectAttendance, 
  getAttendanceHistory, 
  deleteAttendance 
} from "@/app/actions/direct-attendance";
import { useRouter } from "next/navigation";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  target_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  break_minutes: number;
  status: string;
}

interface Props {
  managerId: string;
}

// Sabitlenmiş Personel Bilgisi
const TARGET_EMPLOYEE_ID = "58204";
const TARGET_EMPLOYEE_NAME = "Personel (58204)";

// 🕒 UTC -> GMT+3 (İstanbul) Çevirici Fonksiyonlar
const formatLocalTime = (isoString: string | null) => {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul', hour12: false });
};

const getLocalInputTime = (isoString: string | null) => {
  if (!isoString) return ""; 
  return new Date(isoString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul', hour12: false });
};

export default function MiniAttendancePanel({ managerId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"HISTORY" | "NEW_RECORD">("HISTORY");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // --- TAB 1: GEÇMİŞ VE DÜZENLEME ---
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editEntryType, setEditEntryType] = useState<"IN_ONLY" | "IN_OUT">("IN_OUT");
  const [editForm, setEditForm] = useState({ check_in: "", check_out: "", break_minutes: 60, note: "MANUEL DÜZENLEME (Loglandı)" });

  // --- TAB 2: SIFIRDAN KAYIT ---
  const [newEntryType, setNewEntryType] = useState<"IN_ONLY" | "IN_OUT">("IN_OUT");
  const [newForm, setNewForm] = useState({ 
    target_date: new Date().toISOString().split('T')[0], 
    check_in: "08:00", 
    check_out: "17:00", 
    break_minutes: 60, 
    note: "MANUEL KAYIT EKLENDİ (Loglandı)" 
  });

  // Sayfa yüklendiğinde otomatik listele
  useEffect(() => {
    handleSearchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterYear]);

  // 1. SORGULAMA İŞLEMİ (Sadece 58204)
  const handleSearchHistory = async () => {
    setFetchingHistory(true);
    setFeedback(null);
    try {
      const res = await getAttendanceHistory(filterMonth, filterYear, TARGET_EMPLOYEE_ID);
      if (res.success && res.data) {
        setHistoryRecords(res.data);
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

  // 2. KAYIT DÜZENLEME
  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    if (!editForm.check_in) return setFeedback({ type: "error", msg: "Giriş saati zorunludur." });
    if (editEntryType === "IN_OUT" && !editForm.check_out) return setFeedback({ type: "error", msg: "Çıkış saati de zorunludur." });

    setLoading(true); setFeedback(null);
    
    const payload: any = {
      record_id: editingRecord.id,
      employee_id: TARGET_EMPLOYEE_ID,
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
      setFeedback({ type: "success", msg: "Kayıt başarıyla güncellendi ve loglandı." });
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
    if (!window.confirm("Bu kaydı tamamen silmek istediğinize emin misiniz?")) return;
    setFetchingHistory(true);
    
    const result = await deleteAttendance(recordId, managerId);
    
    if (result.success) {
      setFeedback({ type: "success", msg: "Kayıt silindi." });
      setHistoryRecords(prev => prev.filter(r => r.id !== recordId));
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message || "Silme başarısız." });
    }
    setFetchingHistory(false);
  };

  // 4. SIFIRDAN YENİ KAYIT
  const handleNewRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.check_in) return setFeedback({ type: "error", msg: "Giriş saati zorunludur." });
    if (newEntryType === "IN_OUT" && !newForm.check_out) return setFeedback({ type: "error", msg: "Çıkış saati zorunludur." });
    
    setLoading(true); setFeedback(null);
    
    const payload: any = { 
      employee_id: TARGET_EMPLOYEE_ID,
      target_date: newForm.target_date,
      check_in: newForm.check_in, 
      manager_id: managerId, 
      note: newForm.note,
      is_developer_override: true 
    };

    if (newEntryType === "IN_OUT") {
      payload.check_out = newForm.check_out;
      payload.break_minutes = newForm.break_minutes;
    }

    const result = await upsertDirectAttendance(payload);

    if (result.success) {
      setFeedback({ type: "success", msg: "Yeni mesai kaydı başarıyla eklendi." });
      setNewForm(prev => ({ ...prev, check_in: "08:00", check_out: "17:00" }));
      handleSearchHistory();
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message || "Kayıt işlemi başarısız." });
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col bg-slate-50 border border-slate-200 shadow-xl rounded-xl overflow-hidden font-['Quicksand'] select-none">
      
      {/* HEADER */}
      <div className="w-full bg-[#0F172B] px-6 py-5 flex items-center justify-between border-b-4 border-[#dc3545]">
        <div className="flex items-center gap-4">
          <div className="bg-[#dc3545] p-2.5 rounded-lg border border-red-500/50">
            <User className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-white tracking-widest uppercase">
              ÖZEL PERSONEL MESAİ PANELİ
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Sadece Yetkili İşlemler • {TARGET_EMPLOYEE_ID} ID'sine Kilitli
            </p>
          </div>
        </div>
      </div>

      {/* SEKMELER */}
      <div className="flex gap-3 px-6 py-4 bg-white border-b border-slate-200">
        <button onClick={() => { setActiveTab("HISTORY"); setFeedback(null); }} className={`flex-1 py-3 px-4 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-all ${activeTab === 'HISTORY' ? 'bg-[#0F172B] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
          <Search className="w-4 h-4" /> Geçmiş & Düzenle
        </button>
        <button onClick={() => { setActiveTab("NEW_RECORD"); setFeedback(null); }} className={`flex-1 py-3 px-4 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-all ${activeTab === 'NEW_RECORD' ? 'bg-[#dc3545] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
          <PlusCircle className="w-4 h-4" /> Yeni Mesai Ekle
        </button>
      </div>

      {feedback && (
        <div className={`mx-6 mt-5 px-4 py-3 border-l-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-widest rounded-r-lg ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-[#dc3545] text-[#dc3545]'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* TAB 1: GEÇMİŞ & SORGULAMA */}
      {activeTab === "HISTORY" && (
        <div className="p-6 flex flex-col gap-6 animate-in fade-in">
          <div className="flex gap-4 p-5 bg-white border border-slate-200 shadow-sm rounded-xl items-end">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dönem Seçimi</label>
              <div className="flex gap-3">
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="h-11 flex-1 bg-slate-50 border border-slate-200 px-3 text-xs font-black text-slate-700 uppercase outline-none focus:border-[#dc3545] rounded-lg">
                  {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{new Date(2026, i, 1).toLocaleString('tr-TR', {month: 'long'})}</option>)}
                </select>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="h-11 w-24 bg-slate-50 border border-slate-200 px-3 text-xs font-black text-slate-700 outline-none focus:border-[#dc3545] rounded-lg text-center">
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>
            <button onClick={handleSearchHistory} disabled={fetchingHistory} className="h-11 px-6 bg-[#0F172B] text-white text-[11px] font-black tracking-widest uppercase hover:bg-slate-800 transition-all rounded-lg flex items-center justify-center gap-2">
              {fetchingHistory ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} GETİR
            </button>
          </div>

          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-500 font-black tracking-widest uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4">Tarih</th>
                  <th className="px-5 py-4 text-center">Giriş</th>
                  <th className="px-5 py-4 text-center">Çıkış</th>
                  <th className="px-5 py-4 text-center">Statü</th>
                  <th className="px-5 py-4 text-center w-24">Aksiyon</th>
                </tr>
              </thead>
              <tbody className="font-bold text-slate-700 divide-y divide-slate-50">
                {historyRecords.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 uppercase tracking-widest">Kayıt Bulunamadı</td></tr>
                ) : (
                  historyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 text-slate-800">{record.target_date}</td>
                      <td className="px-5 py-4 text-center font-mono text-[13px]">{formatLocalTime(record.check_in_time)}</td>
                      <td className="px-5 py-4 text-center font-mono text-[13px]">{formatLocalTime(record.check_out_time)}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[9px] uppercase rounded-md border border-slate-200">{record.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center flex justify-center gap-2">
                        <button onClick={() => {
                          setEditingRecord(record);
                          setEditEntryType(record.check_out_time ? "IN_OUT" : "IN_ONLY");
                          setEditForm({
                            check_in: getLocalInputTime(record.check_in_time),
                            check_out: getLocalInputTime(record.check_out_time),
                            break_minutes: record.break_minutes,
                            note: "MANUEL DÜZENLEME (Loglandı)"
                          });
                        }} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-[#0F172B] hover:border-[#0F172B] rounded-lg">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteClick(record.id)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-[#dc3545] hover:border-[#dc3545] rounded-lg">
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

      {/* DÜZENLEME MODALI */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 shadow-2xl w-full max-w-sm rounded-2xl animate-in zoom-in-95">
            <div className="p-4 flex items-center justify-between border-b border-slate-200">
              <h2 className="text-sm font-black tracking-widest uppercase">Kayıt Düzenle</h2>
              <button onClick={() => setEditingRecord(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            
            <form onSubmit={handleUpdateRecord} className="p-5 flex flex-col gap-5">
              <div className="text-xs font-black text-center text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                {editingRecord.target_date}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setEditEntryType("IN_ONLY")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border ${editEntryType === 'IN_ONLY' ? 'bg-[#0F172B] text-white border-[#0F172B]' : 'bg-white text-slate-500 border-slate-200'}`}>Sadece Giriş</button>
                <button type="button" onClick={() => setEditEntryType("IN_OUT")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border ${editEntryType === 'IN_OUT' ? 'bg-[#0F172B] text-white border-[#0F172B]' : 'bg-white text-slate-500 border-slate-200'}`}>Giriş & Çıkış</button>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giriş Saati</label>
                  <input type="time" value={editForm.check_in} onChange={e => setEditForm({...editForm, check_in: e.target.value})} required className="h-11 w-full text-center border border-slate-200 font-mono font-black text-slate-800 rounded-lg focus:border-[#dc3545] outline-none" />
                </div>
                {editEntryType === "IN_OUT" && (
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Çıkış Saati</label>
                    <input type="time" value={editForm.check_out} onChange={e => setEditForm({...editForm, check_out: e.target.value})} required className="h-11 w-full text-center border border-slate-200 font-mono font-black text-slate-800 rounded-lg focus:border-[#dc3545] outline-none" />
                  </div>
                )}
              </div>
              
              <button type="submit" disabled={loading} className="h-11 w-full bg-[#dc3545] text-white text-[11px] font-black tracking-widest uppercase hover:bg-red-700 transition-colors rounded-lg flex items-center justify-center gap-2">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} KAYDET
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: YENİ KAYIT */}
      {activeTab === "NEW_RECORD" && (
        <div className="p-6 bg-slate-50 flex justify-center animate-in fade-in">
          <form onSubmit={handleNewRecordSubmit} className="bg-white border border-slate-200 shadow-sm rounded-xl w-full max-w-lg p-6 flex flex-col gap-6">
            
            <div className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black tracking-widest uppercase text-slate-700">
              Kilitli Personel: <span className="text-[#dc3545] ml-2">{TARGET_EMPLOYEE_NAME}</span>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button type="button" onClick={() => setNewEntryType("IN_ONLY")} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${newEntryType === 'IN_ONLY' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
                Sadece Giriş
              </button>
              <button type="button" onClick={() => setNewEntryType("IN_OUT")} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${newEntryType === 'IN_OUT' ? 'bg-white shadow-sm text-[#dc3545]' : 'text-slate-400'}`}>
                Giriş & Çıkış
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">İşlem Tarihi</label>
              <input type="date" value={newForm.target_date} onChange={e => setNewForm({...newForm, target_date: e.target.value})} className="h-11 w-full border border-slate-200 px-3 text-xs font-black text-slate-800 outline-none focus:border-[#dc3545] rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Giriş Saati</label>
                <input type="time" value={newForm.check_in} onChange={e => setNewForm({...newForm, check_in: e.target.value})} required className="h-11 w-full text-center border border-slate-200 font-mono font-black text-slate-800 outline-none focus:border-[#dc3545] rounded-lg" />
              </div>
              {newEntryType === "IN_OUT" && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Çıkış Saati</label>
                  <input type="time" value={newForm.check_out} onChange={e => setNewForm({...newForm, check_out: e.target.value})} required className="h-11 w-full text-center border border-slate-200 font-mono font-black text-slate-800 outline-none focus:border-[#dc3545] rounded-lg" />
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="h-12 mt-2 bg-[#0F172B] text-white text-[11px] font-black tracking-widest uppercase hover:bg-slate-800 transition-colors rounded-lg flex items-center justify-center gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SİSTEME LOGLU YAZ
            </button>
          </form>
        </div>
      )}
    </div>
  );
}