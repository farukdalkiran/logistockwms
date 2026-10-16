"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { portalLogin, portalChangePassword } from '@/app/actions/portal';
import { ArrowRight, AlertCircle, ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export default function PortalLoginPage() {
  const router = useRouter();

  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  
  // Şifre Değiştirme Modu
  const [showForceReset, setShowForceReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (empId.length !== 5) {
      setError('ID numaranız tam 5 haneli olmalıdır.');
      setLoading(false);
      return;
    }

    const res = await portalLogin(empId, password);

    if (!res.success) {
      setError(res.message || 'Geçersiz ID veya Şifre!');
      setLoading(false);
      return;
    }

    if (res.requirePasswordChange) {
      setShowForceReset(true);
      setLoading(false);
      return;
    }

    // Başarılı giriş -> Doğrudan dinamik QR paneline
    router.push('/portal');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword.length < 6) {
      setError('Yeni şifreniz en az 6 karakter olmalıdır.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Girdiğiniz şifreler eşleşmiyor.');
      setLoading(false);
      return;
    }

    const res = await portalChangePassword(empId, newPassword);

    if (res.success) {
      router.push('/portal');
    } else {
      setError(res.message || 'Şifre güncellenirken hata oluştu.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] p-4 font-['Quicksand'] relative overflow-hidden">
      
      {/* Endüstriyel Karanlık Arka Plan Çizgileri */}
      <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,#fff,#fff_1px,transparent_1px,transparent_20px)] pointer-events-none"></div>

      {/* MERKEZ KART (Aydınlık / Light) */}
      <div className={`w-full max-w-sm bg-white rounded-md shadow-[0_0_50px_rgba(0,0,0,0.6)] relative z-10 overflow-hidden border border-slate-200 transition-all duration-500 ${showForceReset ? 'scale-[1.02]' : ''}`}>
        
        {/* Üst Kırmızı Güvenlik Barı */}
        <div className="w-full h-1.5 bg-[#dc3545]"></div>

        <div className="p-8">
          
          {/* Logo ve Başlık Alanı */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-baseline mb-2 gap-2">
              <Logo variant="primary" className="text-4xl drop-shadow-sm" />
              <span className="text-[#0f172b] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-2 bg-slate-50 inline-block px-3 py-1 rounded-sm border border-slate-100">
              Saha Personel Girişi
            </p>
          </div>

          {/* Dinamik Hata Mesajı Banner'ı */}
          {error && (
            <div className="bg-red-50 border-l-4 border-[#dc3545] text-[#dc3545] px-4 py-3 rounded-r-sm flex items-start gap-3 text-[11px] font-bold mb-6 shadow-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> 
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* 1. GÖRÜNÜM: NORMAL GİRİŞ */}
          {!showForceReset ? (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">5 Haneli ID Numaranız</label>
                <input 
                  type="text" required value={empId} 
                  onChange={(e) => setEmpId(e.target.value.replace(/\D/g, '').slice(0,5))}
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-200 rounded-md focus:bg-white focus:border-[#dc3545] outline-none text-xl text-center font-mono font-black text-[#0f172b] transition-all tracking-[0.2em] shadow-sm"
                  placeholder="00000"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">Sistem Şifreniz</label>
                <input 
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-200 rounded-md focus:bg-white focus:border-[#dc3545] outline-none text-lg text-center font-mono font-bold text-[#0f172b] transition-all tracking-widest shadow-sm"
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" disabled={loading} className="w-full h-12 mt-4 text-[13px] font-black tracking-widest text-white bg-[#0f172b] hover:bg-black active:scale-[0.98] rounded-md shadow-md flex items-center justify-center gap-2 transition-all uppercase">
                {loading ? <span className="animate-pulse">Bağlanıyor...</span> : <>Sisteme Bağlan <ArrowRight size={16} /></>}
              </button>
            </form>
          ) : (
            
            /* 2. GÖRÜNÜM: ZORUNLU ŞİFRE YENİLEME */
            <form onSubmit={handlePasswordChange} className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-md mb-2 flex flex-col items-center text-center shadow-sm">
                <span className="text-[11px] font-black text-orange-900 uppercase tracking-wider mb-1">Geçici Şifre Tespit Edildi</span>
                <span className="text-[10px] font-bold text-orange-700 leading-relaxed">
                  Panele erişmeden önce kendi şifrenizi belirlemelisiniz.
                </span>
              </div>

              <div className="space-y-1.5">
                <input 
                  type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-200 rounded-md focus:bg-white focus:border-[#dc3545] outline-none text-sm text-center font-mono font-bold text-[#0f172b] transition-all tracking-widest shadow-sm"
                  placeholder="Yeni Şifreniz"
                />
              </div>

              <div className="space-y-1.5">
                <input 
                  type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-200 rounded-md focus:bg-white focus:border-[#dc3545] outline-none text-sm text-center font-mono font-bold text-[#0f172b] transition-all tracking-widest shadow-sm"
                  placeholder="Şifre Tekrar"
                />
              </div>

              <button type="submit" disabled={loading} className="w-full h-12 mt-4 text-[13px] font-black tracking-widest text-white bg-[#dc3545] hover:bg-red-700 active:scale-[0.98] rounded-md shadow-md flex items-center justify-center gap-2 transition-all uppercase">
                {loading ? <span className="animate-pulse">Kaydediliyor...</span> : <>Kaydet ve Panele Geç <ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          {/* Alt Yönlendirme */}
          <div className="mt-8 pt-6 border-t border-slate-100 border-dashed">
            <button 
              type="button" 
              onClick={() => router.push('/login')} 
              className="w-full text-[10px] font-bold text-slate-400 hover:text-[#0f172b] flex items-center justify-center gap-1.5 transition-colors uppercase tracking-widest"
            >
              <ArrowLeft size={14} /> Yönetici Ekranına Dön
            </button>
          </div>

        </div>
      </div>
      
    </div>
  );
}