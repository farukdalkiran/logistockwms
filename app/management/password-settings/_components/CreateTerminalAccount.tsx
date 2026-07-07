"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { SmartphoneNfc, BriefcaseBusiness, Hash, Dices, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

type Branch = { id: string; name: string };

interface CreateTerminalAccountProps {
  branches: Branch[];
  onSuccess?: () => void;
}

export default function CreateTerminalAccount({ branches, onSuccess }: CreateTerminalAccountProps) {
  const [terminalUser, setTerminalUser] = useState({ fullName: "", positionTitle: "", branchId: "", terminalId: "" });
  const [isCreatingTerminalUser, setIsCreatingTerminalUser] = useState(false);

  const handleGenerateRandomTerminalId = () => {
    const randomId = Math.floor(10000 + Math.random() * 90000).toString();
    setTerminalUser((prev) => ({ ...prev, terminalId: randomId }));
  };

  const handleCreateTerminalUser = async () => {
    if (!terminalUser.fullName || !terminalUser.branchId || !terminalUser.terminalId) {
      return toast.error("Personel Adı, Şubesi ve Terminal ID zorunludur.");
    }
    if (terminalUser.terminalId.length !== 5) {
      return toast.error("Terminal ID kesinlikle 5 haneli olmalıdır.");
    }

    setIsCreatingTerminalUser(true);
    
    try {
      const { error } = await supabase.from("employees").insert({
        id: terminalUser.terminalId,
        full_name: terminalUser.fullName,
        position_title: terminalUser.positionTitle || "Saha Personeli",
        branch_id: terminalUser.branchId,
        is_active: true,
      });

      if (error) {
        if (error.code === "23505") throw new Error("Bu 5 haneli ID başka bir personelde kullanılıyor. Lütfen farklı bir ID girin.");
        throw error;
      }

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-black text-green-800 uppercase tracking-tight text-sm">Saha Kimliği Yaratıldı!</span>
          <p className="text-xs text-green-700">Personel terminal ekranlarına <strong className="font-mono text-black bg-white px-1 py-0.5 rounded ml-1">{terminalUser.terminalId}</strong> ID'si ile giriş yapabilir.</p>
        </div>,
        { duration: 6000, style: { background: "#f0fdf4", border: "1px solid #bbf7d0" } }
      );

      setTerminalUser({ fullName: "", positionTitle: "", branchId: "", terminalId: "" });
      if (onSuccess) onSuccess(); 
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingTerminalUser(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black">2</div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Saha Personeli & Terminal ID Atama</h2>
        <div className="flex-1 h-px bg-slate-200 ml-4"></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6 flex flex-col lg:flex-row gap-8">
        {/* SOL BÖLÜM */}
        <div className="lg:w-1/3 flex flex-col gap-4 border-r border-slate-100 pr-0 lg:pr-8">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-sm flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-orange-600">
              <SmartphoneNfc size={20} />
              <h3 className="text-sm font-black uppercase tracking-wide">Kişiye Özgü Saha ID</h3>
            </div>
            <p className="text-xs font-semibold text-orange-800 leading-relaxed">
              Terminal tarafında işlemler <strong>KİŞİ BAZLI</strong> yapılır. Depo ve raflarda ürün okutacak personele, şubesine bağlı <strong>5 Haneli bir ID</strong> verilmelidir.
            </p>
            <div className="text-[10px] bg-orange-100 text-orange-700 p-2 rounded border border-orange-200 font-bold">
              * Bu personellerin Web Paneli şifresi yoktur, sadece el terminaline giriş yapabilirler.
            </div>
          </div>
        </div>

        {/* SAĞ BÖLÜM */}
        <div className="lg:w-2/3 flex flex-col gap-5 justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Gerçek Ad Soyad</label>
              <input type="text" placeholder="Örn: Mehmet Demir" value={terminalUser.fullName} onChange={(e) => setTerminalUser({ ...terminalUser, fullName: e.target.value })} className="w-full px-4 h-11 bg-slate-50 border border-slate-200 rounded-sm text-sm font-bold text-slate-800 focus:border-[#dc3545] focus:bg-white outline-none transition-all" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Görev / Unvan (Opsiyonel)</label>
              <div className="relative">
                <BriefcaseBusiness className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Örn: Mal Kabul Görevlisi" value={terminalUser.positionTitle} onChange={(e) => setTerminalUser({ ...terminalUser, positionTitle: e.target.value })} className="w-full pl-10 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-sm text-sm font-bold text-slate-800 focus:border-[#dc3545] focus:bg-white outline-none transition-all" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest mb-1.5 block">* İşlem Yapacağı Ana Şube</label>
              <select value={terminalUser.branchId} onChange={(e) => setTerminalUser({ ...terminalUser, branchId: e.target.value })} className="w-full px-3 h-11 bg-slate-50 border border-slate-200 rounded-sm text-sm font-bold text-slate-700 focus:border-[#dc3545] focus:bg-white outline-none cursor-pointer appearance-none">
                <option value="" disabled>Bağlı Olduğu Şubeyi Seçin</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest mb-1.5 block">* 5 Haneli Terminal Kimliği (ID)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" maxLength={5} placeholder="10001" value={terminalUser.terminalId} onChange={(e) => setTerminalUser({ ...terminalUser, terminalId: e.target.value.replace(/[^0-9]/g, "") })} className="w-full pl-10 pr-3 h-11 bg-white border-2 border-slate-200 rounded-sm text-lg font-black text-slate-800 tracking-[0.2em] focus:border-[#dc3545] outline-none transition-all" />
                </div>
                <Button onClick={handleGenerateRandomTerminalId} className="h-11 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm shrink-0 font-bold text-xs">
                  <Dices size={16} className="mr-2 text-slate-500"/> Rastgele
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleCreateTerminalUser} disabled={isCreatingTerminalUser} className="w-full md:w-auto px-8 h-12 bg-[#dc3545] hover:bg-red-700 text-white font-black tracking-widest uppercase text-xs rounded-sm shadow-[0_4px_10px_rgba(220,53,69,0.3)] flex items-center justify-center gap-2 transition-all">
              <UserPlus size={16} />
              {isCreatingTerminalUser ? "Kaydediliyor..." : "Saha Personelini Sisteme Ekle"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}