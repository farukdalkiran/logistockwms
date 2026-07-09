"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Lock, Mail, AlertCircle, KeyRound, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  // Görünüm State'leri: 'login' | 'forgot'
  const [currentView, setCurrentView] = useState<'login' | 'forgot'>('login');
  
  // Zorunlu Şifre Değişim Modalı State'i
  const [showForceReset, setShowForceReset] = useState(false);

  // Form Verileri
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [forgotEmail, setForgotEmail] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // İşlem State'leri
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. NORMAL GİRİŞ AKIŞI
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // GEÇİCİ ŞİFRE KONTROLÜ (Lgs veya prj ile başlıyorsa)
      if (password.startsWith("Lgs") || password.startsWith("prj")) {
        setLoading(false);
        setShowForceReset(true); // Modalı aç, panele sokma
        return;
      }

      // Şifre normalse doğrudan sisteme al
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError('Giriş başarısız. Lütfen bilgilerinizi kontrol ediniz.');
      setLoading(false);
    }
  };

  // 2. ZORUNLU ŞİFRE YENİLEME AKIŞI (İlk Giriş)
  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Yeni şifreniz en az 6 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Girdiğiniz şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      // Supabase'de oturum açmış kullanıcının şifresini güncelliyoruz
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Başarılıysa sisteme al
      setShowForceReset(false);
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError('Şifre güncellenirken bir hata oluştu: ' + err.message);
      setLoading(false);
    }
  };

  // 3. ŞİFREMİ UNUTTUM AKIŞI
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/login?reset=true`, // Şifre sıfırlama linkine tıklandığında döneceği yer
      });

      if (resetError) throw resetError;

      setSuccessMsg('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
      setForgotEmail('');
    } catch (err: any) {
      setError('Mail gönderilemedi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-['Quicksand'] relative overflow-hidden">
      
      {/* Endüstriyel Arka Plan Deseni */}
      <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,#fff,#fff_1px,transparent_1px,transparent_20px)] pointer-events-none"></div>
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#dc3545]/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* MERKEZ KART */}
      <div className={`w-full max-w-md bg-white rounded-sm shadow-2xl relative z-10 transition-all duration-500 overflow-hidden ${showForceReset ? 'scale-105' : 'scale-100'}`}>
        
        {/* Üst Kırmızı Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#dc3545]"></div>

        <div className="p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="flex justify-center items-baseline mb-2 gap-2">
              <Logo variant="primary" className="text-4xl" />
              <span className="text-[#0f172b] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </div>
            <p className="text-xs text-slate-400 font-extrabold mt-2 tracking-widest uppercase">Depo Yönetim Sistemi</p>
          </div>

          {/* HATA VE BAŞARI MESAJLARI */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-[#dc3545] px-4 py-3 rounded-sm flex items-start gap-3 text-xs font-bold mb-6 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> 
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-sm flex items-start gap-3 text-xs font-bold mb-6 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> 
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* === GÖRÜNÜM: NORMAL GİRİŞ === */}
          {!showForceReset && currentView === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Kurumsal E-Posta</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all"
                    placeholder="ornek@logistock.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Sistem Şifresi</label>
                  <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setCurrentView('forgot'); }} className="text-[11px] font-bold text-[#dc3545] hover:text-red-700 transition-colors">
                    Şifremi Unuttum
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all tracking-widest"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 mt-4 text-[13px] font-black tracking-wide bg-slate-800 hover:bg-slate-900 rounded-sm shadow-sm flex items-center justify-center gap-2 transition-all">
                {loading ? <span className="animate-pulse">Bağlanıyor...</span> : <>Sisteme Giriş Yap <ArrowRight size={16} /></>}
              </Button>
            </form>
          )}

          {/* === GÖRÜNÜM: ŞİFREMİ UNUTTUM === */}
          {!showForceReset && currentView === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-2">
                <h3 className="text-sm font-black text-slate-800 uppercase">Şifre Sıfırlama</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-1">Sisteme kayıtlı e-posta adresinizi giriniz.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">E-Posta Adresi</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all"
                    placeholder="ornek@peeraj.com.tr"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <Button type="submit" disabled={loading} className="w-full h-12 text-[13px] font-black tracking-wide bg-[#dc3545] hover:bg-red-700 rounded-sm shadow-sm transition-all">
                  {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
                </Button>
                <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setCurrentView('login'); }} className="w-full h-10 text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-colors">
                  <ArrowLeft size={14} /> Giriş Ekranına Dön
                </button>
              </div>
            </form>
          )}

          {/* === GÖRÜNÜM: ZORUNLU ŞİFRE DEĞİŞİMİ (Lgs/prj Yakalandı) === */}
          {showForceReset && (
            <form onSubmit={handleForcePasswordChange} className="space-y-5 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex flex-col items-center text-center bg-orange-50 border border-orange-200 p-4 rounded-sm mb-2">
                <ShieldCheck size={28} className="text-orange-500 mb-2" />
                <h3 className="text-sm font-black text-orange-900 uppercase">Güvenlik Prosedürü</h3>
                <p className="text-[11px] font-bold text-orange-700 mt-1 leading-relaxed">
                  Sistem yöneticisi tarafından atanan <strong className="text-[#dc3545]">geçici şifre</strong> ile giriş yaptınız. LogiStock paneline erişmeden önce kendi güvenli şifrenizi belirlemelisiniz.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Yeni Şifreniz</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all tracking-widest"
                    placeholder="En az 6 karakter"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Yeni Şifre (Tekrar)</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all tracking-widest"
                    placeholder="Şifreyi doğrulayın"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 mt-4 text-[13px] font-black tracking-wide bg-[#dc3545] hover:bg-red-700 shadow-[0_4px_14px_rgba(220,53,69,0.3)] rounded-sm flex items-center justify-center gap-2 transition-all">
                {loading ? <span className="animate-pulse">Kaydediliyor...</span> : <>Şifreyi Kaydet ve Panele Geç <ArrowRight size={16} /></>}
              </Button>
            </form>
          )}

        </div>
      </div>
      
      {/* Footer Text */}
      <div className="absolute bottom-6 w-full text-center pointer-events-none">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">LogiStock WMS</span>
      </div>
    </div>
  );
}