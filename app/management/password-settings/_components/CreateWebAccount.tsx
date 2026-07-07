"use client";

import { useState } from "react";
import { Store, BriefcaseBusiness, Network, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import { createSystemUser } from "@/app/actions/user";

type Branch = { id: string; name: string };
type Role = { id: number; role_code: string; role_name: string };

interface CreateWebAccountProps {
  branches: Branch[];
  roles: Role[];
  onSuccess?: () => void;
}

export default function CreateWebAccount({ branches, roles, onSuccess }: CreateWebAccountProps) {
  const [accountType, setAccountType] = useState<"branch" | "personal">("branch");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [newAccount, setNewAccount] = useState({ accountName: "", email: "", branchId: "", roleCode: "" });

  const handleCreateWebAccount = async () => {
    if (!newAccount.accountName || !newAccount.email || !newAccount.roleCode || !newAccount.branchId) {
      return toast.error("Lütfen şube dâhil tüm bilgileri eksiksiz doldurun.");
    }

    setIsSendingInvite(true);
    const tempPassword = `Lgs${Math.floor(1000 + Math.random() * 9000)}!`;

    try {
      const result = await createSystemUser({
        fullName: newAccount.accountName,
        email: newAccount.email,
        branchId: newAccount.branchId,
        roleCode: newAccount.roleCode,
        tempPassword: tempPassword,
      });

      if (result.success) {
        setNewAccount({ accountName: "", email: "", branchId: "", roleCode: "" });
        
        toast.success(
          <div className="flex flex-col gap-2 min-w-[280px]">
            <div className="border-b border-green-200 pb-2 mb-1">
              <span className="font-black text-green-800 uppercase tracking-tight text-sm">Web Hesabı Sisteme İşlendi!</span>
            </div>
            <div className="flex flex-col gap-1.5 font-mono">
              <div className="flex justify-between items-center bg-white/60 px-2 py-1.5 rounded">
                <span className="text-[10px] font-bold text-slate-500 uppercase font-sans">E-Posta:</span>
                <strong className="text-xs font-black text-slate-800 tracking-wider truncate max-w-[150px]">{newAccount.email}</strong>
              </div>
              <div className="flex justify-between items-center bg-white/60 px-2 py-1.5 rounded">
                <span className="text-[10px] font-bold text-slate-500 uppercase font-sans">Geçici Şifre:</span>
                <strong className="text-sm font-black text-[#dc3545] tracking-wider select-all">{tempPassword}</strong>
              </div>
            </div>
          </div>,
          { duration: 8000, style: { background: "#f0fdf4", border: "1px solid #bbf7d0" } }
        );

        if (onSuccess) onSuccess();
      } else {
        toast.error("Kayıt Hatası: " + result.error);
      }
    } catch (error: any) {
      toast.error("İşlem sırasında hata oluştu: " + error.message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black">1</div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sistem Kullanıcıları (Web Paneli)</h2>
        <div className="flex-1 h-px bg-slate-200 ml-4"></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6 flex flex-col lg:flex-row gap-8">
        {/* SOL BÖLÜM: Hesap Türü Seçimi */}
        <div className="lg:w-1/3 flex flex-col gap-6 border-r border-slate-100 pr-0 lg:pr-8">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase">Hesap Türü</h3>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
              Operasyon sürekliliği için masaüstü panel girişlerinde kişisel isimler yerine <strong className="text-[#dc3545]">Kurumsal Departman</strong> isimleri (E-Postaları) kullanmanız önerilir.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => setAccountType("branch")} className={`flex items-center gap-4 p-4 rounded-sm border-2 transition-all text-left ${accountType === "branch" ? "border-[#dc3545] bg-red-50/30 shadow-sm" : "border-slate-100 bg-slate-50 hover:border-slate-300"}`}>
              <Store size={24} className={accountType === "branch" ? "text-[#dc3545]" : "text-slate-400"} />
              <div className="flex flex-col">
                <span className={`text-xs font-black uppercase tracking-wider ${accountType === "branch" ? "text-slate-800" : "text-slate-600"}`}>Kurumsal Şube Hesabı</span>
                <span className="text-[10px] font-bold text-slate-400">Örn: Maltepe Merkez Depo</span>
              </div>
            </button>
            <button onClick={() => setAccountType("personal")} className={`flex items-center gap-4 p-4 rounded-sm border-2 transition-all text-left ${accountType === "personal" ? "border-slate-800 bg-slate-50 shadow-sm" : "border-slate-100 bg-slate-50 hover:border-slate-300"}`}>
              <BriefcaseBusiness size={24} className={accountType === "personal" ? "text-slate-800" : "text-slate-400"} />
              <div className="flex flex-col">
                <span className={`text-xs font-black uppercase tracking-wider ${accountType === "personal" ? "text-slate-800" : "text-slate-600"}`}>Bireysel Yönetici Hesabı</span>
                <span className="text-[10px] font-bold text-slate-400">Örn: Bölge Sorumlusu Ahmet Y.</span>
              </div>
            </button>
          </div>
        </div>

        {/* SAĞ BÖLÜM: Form Alanları */}
        <div className="lg:w-2/3 flex flex-col gap-5 justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                {accountType === "branch" ? "Kurumsal Sistem Adı" : "Yönetici Ad Soyad"}
              </label>
              <div className="relative">
                <Network className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder={accountType === "branch" ? "Örn: Anatolium Mağaza Ekibi" : "Örn: Ahmet Yılmaz"} value={newAccount.accountName} onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })} className="w-full pl-10 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-sm text-sm font-bold text-slate-800 focus:border-[#dc3545] focus:bg-white outline-none transition-all" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Sistem E-Posta Adresi</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="email" placeholder="ornek@logistock.com" value={newAccount.email} onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })} className="w-full pl-10 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-sm text-sm font-bold text-slate-800 focus:border-[#dc3545] focus:bg-white outline-none transition-all" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest mb-1.5 block">* Fiziksel Lokasyon (Zorunlu)</label>
              <select value={newAccount.branchId} onChange={(e) => setNewAccount({ ...newAccount, branchId: e.target.value })} className="w-full px-3 h-11 bg-slate-50 border border-slate-200 rounded-sm text-sm font-bold text-slate-700 focus:border-[#dc3545] focus:bg-white outline-none cursor-pointer appearance-none">
                <option value="" disabled>Hesabın Bağlanacağı Şube</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Departman Yetki Sınıfı</label>
              <select value={newAccount.roleCode} onChange={(e) => setNewAccount({ ...newAccount, roleCode: e.target.value })} className="w-full px-3 h-11 bg-slate-50 border border-slate-200 rounded-sm text-sm font-bold text-slate-700 focus:border-[#dc3545] focus:bg-white outline-none cursor-pointer appearance-none">
                <option value="" disabled>Yetki Sınıfı Belirleyin</option>
                {roles.map((r) => <option key={r.id} value={r.role_code}>{r.role_name}</option>)}
              </select>
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={handleCreateWebAccount} disabled={isSendingInvite} className="w-full md:w-auto px-8 h-12 bg-slate-800 hover:bg-slate-900 text-white font-black tracking-widest uppercase text-xs rounded-sm shadow-md flex items-center justify-center gap-2 transition-all">
              <UserPlus size={16} />
              {isSendingInvite ? "Veritabanına İşleniyor..." : "Web Hesabını Ekle & Şifre Üret"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}