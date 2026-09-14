"use client";

import { useState, useEffect } from "react";
import { 
  Smartphone, ShieldAlert, CheckCircle2, AlertCircle, 
  RefreshCw, Search, Unlock, Building2, UserX
} from "lucide-react";
import { getBranchDevices, getAllBranches, revokeDeviceToken } from "@/app/actions/device-manager";
import { useRouter } from "next/navigation";

interface Props {
  managerId: string;
  managerBranchId: string | null;
  isGlobal: boolean; 
}

export default function DeviceManagerPanel({ managerId, managerBranchId, isGlobal }: Props) {
  const router = useRouter();
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(managerBranchId || "");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      
      if (isGlobal) {
        const branchRes = await getAllBranches();
        if (branchRes.success && branchRes.data) setBranches(branchRes.data);
      }

      if (selectedBranch) {
        const empRes = await getBranchDevices(selectedBranch);
        if (empRes.success && empRes.data) setEmployees(empRes.data);
      } else {
        setEmployees([]);
      }
      
      setLoading(false);
    };

    fetchInitialData();
  }, [selectedBranch, isGlobal]);

  const handleRevoke = async (employeeId: string, empName: string) => {
    if (!window.confirm(`DİKKAT: ${empName} adlı personelin cihaz kilidini kırmak üzeresiniz. Personel cihazını yeniden kaydetmek zorunda kalacaktır. Onaylıyor musunuz?`)) return;
    
    setActionLoading(employeeId);
    setFeedback(null);
    
    const res = await revokeDeviceToken(employeeId, managerId);
    
    if (res.success) {
      setFeedback({ type: "success", msg: `${empName} cihaz bağlantısı koparıldı.` });
      setEmployees(prev => prev.map(emp => emp.id === employeeId ? { ...emp, device_token: null } : emp));
      router.refresh();
    } else {
      setFeedback({ type: "error", msg: res.message || "İşlem başarısız." });
    }
    setActionLoading(null);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.id.includes(searchQuery)
  );

  return (
    <div className="w-full mx-auto flex flex-col font-['Quicksand'] select-none bg-slate-50 border border-slate-200 shadow-xl rounded-sm overflow-hidden min-h-[500px]">
      
      {/* 1. MİNİMAL BAĞIMSIZ GÖRSEL BANNER */}
      <div className="w-full h-32 md:h-40 bg-slate-200 shrink-0 border-b border-slate-300">
        <img 
          src="https://img.magnific.com/free-photo/flat-lay-colorful-cogwheels-arrangement_23-2149382396.jpg?t=st=1789367361~exp=1789370961~hmac=62249abfa939121644af21ddeadbe46cb407b39ea1ce7a315d18b3d29a96d089&w=1480" 
          alt="Device Management" 
          className="w-full h-full object-cover grayscale-[30%]"
        />
      </div>

      {/* 2. ENDÜSTRİYEL HEADER KISMI */}
      <div className="w-full bg-[#0F172B] px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between border-b-4 border-[#dc3545]">
        <div className="flex items-center gap-4">
          <div className="bg-[#dc3545] p-2.5 shadow-sm rounded-sm">
            <Smartphone className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white tracking-widest uppercase">
              Cihaz <span className="text-[#dc3545]">Yönetimi</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] flex items-center gap-1.5 mt-0.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Terminal Eşleşme Kontrolleri
            </p>
          </div>
        </div>

        {/* MİNİMAL VE OKUNABİLİR ŞUBE SEÇİCİ */}
        {isGlobal && (
          <div className="mt-4 md:mt-0 w-full md:w-auto">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Global Şube Kontrolü</label>
            <div className="relative flex items-center">
              <Building2 className="absolute left-3 w-4 h-4 text-slate-400" />
              <select 
                value={selectedBranch} 
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="h-10 w-full md:w-64 pl-9 pr-4 bg-white border border-slate-300 text-slate-800 text-xs font-black uppercase tracking-wider rounded-sm outline-none focus:border-[#dc3545] transition-colors cursor-pointer"
              >
                <option value="">-- Şube Seçin --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 md:p-8 flex flex-col gap-6">
        
        {/* Geri Bildirim Alert */}
        {feedback && (
          <div className={`p-4 border-l-4 flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-sm bg-white ${feedback.type === 'success' ? 'border-emerald-500 text-emerald-700' : 'border-[#dc3545] text-[#dc3545]'}`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            {feedback.msg}
          </div>
        )}

        {/* Arama Barı (Keskin Hatlar) */}
        <div className="flex bg-white border border-slate-300 rounded-sm overflow-hidden h-12 focus-within:border-[#dc3545] transition-colors">
          <div className="w-12 flex items-center justify-center bg-slate-50 border-r border-slate-200">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="Personel Adı veya 5 Haneli ID ile Ara..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none px-4 text-xs font-black text-slate-700 uppercase tracking-widest placeholder:text-slate-300"
          />
        </div>

        {/* Veri Tablosu */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden min-h-[300px]">
          {loading ? (
            <div className="w-full h-[300px] flex flex-col items-center justify-center gap-4 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-[#dc3545]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Kayıtlar Çekiliyor...</span>
            </div>
          ) : !selectedBranch ? (
            <div className="w-full h-[300px] flex flex-col items-center justify-center gap-4 text-slate-400">
              <Building2 className="w-10 h-10 opacity-30 text-slate-300" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">İşlem yapmak için şube seçiniz.</span>
            </div>
          ) : employees.length === 0 ? (
            <div className="w-full h-[300px] flex flex-col items-center justify-center gap-4 text-slate-400">
              <UserX className="w-10 h-10 opacity-30 text-slate-300" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Bu şubeye kayıtlı aktif personel bulunamadı.</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="w-full h-[300px] flex flex-col items-center justify-center gap-4 text-slate-400">
              <Search className="w-10 h-10 opacity-30 text-slate-300" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Arama kriterinize uygun personel bulunamadı.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#0F172B] text-white font-black tracking-widest uppercase text-[10px]">
                  <tr>
                    <th className="px-5 py-4 border-r border-slate-700 w-24">ID</th>
                    <th className="px-5 py-4 border-r border-slate-700">Personel Bilgisi</th>
                    <th className="px-5 py-4 border-r border-slate-700 text-center w-36">Durum</th>
                    <th className="px-5 py-4 text-right w-40">Erişim Aksiyonu</th>
                  </tr>
                </thead>
                <tbody className="font-bold text-slate-700 divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const isPaired = !!emp.device_token;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 border-r border-slate-100 font-mono text-[13px] font-black text-slate-500 tracking-[0.2em] bg-slate-50/50">{emp.id}</td>
                        <td className="px-5 py-4 border-r border-slate-100">
                          <div className="flex flex-col gap-1">
                            <span className="text-[12px] font-black text-slate-800 uppercase tracking-wide">{emp.full_name}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{emp.position_title}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 border-r border-slate-100 text-center">
                          {isPaired ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm text-[9px] font-black uppercase tracking-widest">
                              <Smartphone className="w-3.5 h-3.5" /> Mühürlü
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-sm text-[9px] font-black uppercase tracking-widest">
                              <UserX className="w-3.5 h-3.5 opacity-50" /> Cihaz Yok
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleRevoke(emp.id, emp.full_name)}
                            disabled={!isPaired || actionLoading === emp.id}
                            className={`inline-flex items-center justify-center gap-2 h-10 px-4 w-full rounded-sm text-[10px] font-black uppercase tracking-widest transition-colors ${
                              isPaired 
                                ? 'bg-white border border-[#dc3545] text-[#dc3545] hover:bg-[#dc3545] hover:text-white' 
                                : 'bg-slate-50 border border-slate-200 text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            {actionLoading === emp.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Unlock className="w-4 h-4" /> KİLİDİ KIR
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}