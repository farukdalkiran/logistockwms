"use client";

import { useState } from "react";
import { Clock, ShieldAlert, CheckCircle2, AlertCircle, Save, UserCheck, Calendar } from "lucide-react";
import { upsertDirectAttendance } from "@/app/actions/direct-attendance";
import { useRouter } from "next/navigation";

interface Employee {
  id: string;
  full_name: string;
  position_title: string;
}

interface DirectAttendanceEditorProps {
  managerId: string;
  managerName: string;
  managerTitle: string;
  employees: Employee[];
}

export default function DirectAttendanceEditor({ managerId, managerName, managerTitle, employees }: DirectAttendanceEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [formData, setFormData] = useState({
    employee_id: "",
    target_date: new Date().toISOString().split('T')[0],
    check_in: "08:00",
    check_out: "18:00",
    break_minutes: 60,
    note: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (feedback) setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id) {
      setFeedback({ type: "error", msg: "LÜTFEN İŞLEM YAPILACAK PERSONELİ SEÇİN." });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const result = await upsertDirectAttendance({
      ...formData,
      manager_id: managerId
    });

    if (result.success) {
      setFeedback({ type: "success", msg: result.message });
      setFormData(prev => ({ ...prev, check_in: "08:00", check_out: "18:00", note: "" }));
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: result.message });
    }
    
    setLoading(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col shadow-xl rounded-none border-2 border-slate-300 select-none bg-white">
      <div className="w-full bg-[#0F172A] p-6 flex flex-col md:flex-row items-start md:items-center justify-between border-b-4 border-[#dc3545]">
        <div className="flex items-center gap-4">
          <div className="bg-[#dc3545] p-3 rounded-none shadow-[0_0_15px_rgba(220,53,69,0.3)]">
            <Clock className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-[0.1em] uppercase drop-shadow-sm">
              DİREKT MESAİ YÖNETİMİ
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-none animate-pulse"></div>
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-[0.15em]">Bypass & Doğrudan Kayıt Modülü</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 px-5 py-2.5 border border-slate-700 mt-4 md:mt-0 flex items-center gap-4 shadow-inner">
           <ShieldAlert className="w-5 h-5 text-amber-400" />
           <div className="flex flex-col text-right">
             <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{managerTitle}</span>
             <span className="text-xs font-black text-slate-100 tracking-widest uppercase">{managerName}</span>
           </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 flex flex-col gap-6 bg-slate-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" /> PERSONEL SEÇİMİ
            </label>
            <select 
              name="employee_id" 
              value={formData.employee_id} 
              onChange={handleChange}
              disabled={loading}
              className="h-12 w-full bg-white border-2 border-slate-300 px-4 text-sm font-black text-slate-800 uppercase outline-none focus:border-[#0F172A] transition-colors cursor-pointer"
            >
              <option value="">-- Personel Seçiniz --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.position_title})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> İŞLEM TARİHİ
            </label>
            <input 
              type="date" 
              name="target_date"
              value={formData.target_date}
              onChange={handleChange}
              disabled={loading}
              className="h-12 w-full bg-white border-2 border-slate-300 px-4 text-sm font-black text-slate-800 uppercase outline-none focus:border-[#0F172A] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">GİRİŞ SAATİ</label>
            <input 
              type="time" 
              name="check_in"
              value={formData.check_in}
              onChange={handleChange}
              disabled={loading}
              className="h-12 w-full bg-white border-2 border-slate-300 px-4 text-xl text-center font-mono font-black text-slate-800 outline-none focus:border-[#0F172A] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ÇIKIŞ SAATİ</label>
            <input 
              type="time" 
              name="check_out"
              value={formData.check_out}
              onChange={handleChange}
              disabled={loading}
              className="h-12 w-full bg-white border-2 border-slate-300 px-4 text-xl text-center font-mono font-black text-slate-800 outline-none focus:border-[#0F172A] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MOLA SÜRESİ (DAKİKA)</label>
            <input 
              type="number" 
              name="break_minutes"
              value={formData.break_minutes}
              onChange={handleChange}
              min="0"
              disabled={loading}
              className="h-12 w-full bg-white border-2 border-slate-300 px-4 text-lg font-mono font-black text-slate-800 outline-none focus:border-[#0F172A] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">YÖNETİCİ İŞLEM NOTU (ZORUNLU DEĞİL)</label>
            <textarea 
              name="note"
              value={formData.note}
              onChange={handleChange}
              disabled={loading}
              placeholder="Manuel giriş için açıklama..."
              className="h-24 w-full bg-white border-2 border-slate-300 p-4 text-sm font-medium text-slate-800 outline-none focus:border-[#0F172A] transition-colors resize-none"
            />
          </div>
        </div>

        {feedback && (
          <div className={`p-4 border-2 flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-sm ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-[#dc3545] text-[#dc3545]'}`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            {feedback.msg}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading} 
          className="h-14 w-full flex items-center justify-center gap-3 rounded-none text-sm font-black tracking-[0.1em] uppercase transition-all duration-200 shadow-md active:scale-95 bg-[#0F172A] text-white hover:bg-[#dc3545] border-2 border-[#0F172A] hover:border-[#dc3545] mt-2"
        >
          {loading ? "SİSTEME İŞLENİYOR..." : <><Save className="w-5 h-5" /> MESAİYİ DOĞRUDAN KAYDET</>}
        </button>
      </form>
    </div>
  );
}