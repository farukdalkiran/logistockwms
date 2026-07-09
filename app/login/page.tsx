"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Lock, Mail, AlertCircle, KeyRound, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2,Globe, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  // Görünüm State'leri: 'login' | 'forgot'
  const [currentView, setCurrentView] = useState<'login' | 'forgot'>('login');
  
  // Zorunlu Şifre Değişim Modalı State'i
  const [showForceReset, setShowForceReset] = useState(false);

  // Form Verileri
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
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
        setShowForceReset(true); 
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

  // 2. ZORUNLU ŞİFRE YENİLEME AKIŞI (Katı Güvenlik Kuralları)
  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Katı Şifre Güvenlik Kalkanı
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
    
    if (!passwordRegex.test(newPassword)) {
      setError('Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermelidir.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Girdiğiniz şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setShowForceReset(false);
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError('Şifre güncellenirken bir hata oluştu: ' + err.message);
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
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <form onSubmit={handleLogin} className="space-y-5">
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
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Sistem Şifresi</label>
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

              {/* Şifremi Unuttum Linki Alt Tarafa Alındı */}
              <div className="mt-6 text-center border-t border-slate-100 pt-4">
                <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setCurrentView('forgot'); }} className="text-[11px] font-bold text-slate-400 hover:text-[#dc3545] transition-colors uppercase tracking-wider">
                  Şifrenizi mi unuttunuz?
                </button>
              </div>
            </div>
          )}

          {/* === GÖRÜNÜM: ŞİFREMİ UNUTTUM (Geliştirici İletişim Paneli) === */}
          {!showForceReset && currentView === 'forgot' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <ShieldAlert size={36} className="mx-auto text-[#dc3545] mb-3" />
                <h3 className="text-[15px] font-black text-slate-800 uppercase tracking-widest">Güvenlik Protokolü</h3>
                <p className="text-[12px] font-bold text-slate-500 mt-2 leading-relaxed">
                  Kurumsal güvenlik politikaları gereği şifre sıfırlama işlemleri otomatik yapılamamaktadır. Lütfen sistem yöneticisi veya geliştirici ile iletişime geçin.
                </p>
              </div>

              <div className="space-y-3">
                <a href="mailto:faruk.dalkiran@peeraj.com.tr" className="w-full bg-slate-50 border border-slate-200 hover:border-[#dc3545] hover:bg-red-50 text-slate-700 hover:text-[#dc3545] p-3 rounded-sm flex items-center justify-center gap-2 transition-colors text-[12px] font-black tracking-wider uppercase">
                  <Mail size={16} /> E-Posta Gönder
                </a>
                <a href="https://www.linkedin.com/in/faruk-dalk%C4%B1ran-461698233/" target="_blank" rel="noopener noreferrer" className="w-full bg-[#0077b5]/10 border border-[#0077b5]/20 hover:bg-[#0077b5]/20 text-[#0077b5] p-3 rounded-sm flex items-center justify-center gap-2 transition-colors text-[12px] font-black tracking-wider uppercase">
                  <Globe size={16} /> LinkedIn Profili
                </a>
              </div>

              <div className="mt-6">
                <button type="button" onClick={() => { setError(''); setCurrentView('login'); }} className="w-full h-10 text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-colors uppercase tracking-wider">
                  <ArrowLeft size={14} /> Giriş Ekranına Dön
                </button>
              </div>
            </div>
          )}

          {/* === GÖRÜNÜM: ZORUNLU ŞİFRE DEĞİŞİMİ === */}
          {showForceReset && (
            <form onSubmit={handleForcePasswordChange} className="space-y-5 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex flex-col items-center text-center bg-orange-50 border border-orange-200 p-4 rounded-sm mb-2">
                <ShieldCheck size={28} className="text-orange-500 mb-2" />
                <h3 className="text-sm font-black text-orange-900 uppercase tracking-widest">Güvenlik Prosedürü</h3>
                <p className="text-[11px] font-bold text-orange-700 mt-1 leading-relaxed">
                  Sistem yöneticisi tarafından atanan <strong className="text-[#dc3545]">geçici şifre</strong> ile giriş yaptınız. LogiStock paneline erişmeden önce güvenli şifrenizi belirlemelisiniz.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm">
                <ul className="text-[10px] font-bold text-slate-500 space-y-1">
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500"/> En az 8 karakter uzunluğunda</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500"/> En az 1 büyük ve 1 küçük harf</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500"/> En az 1 rakam içermelidir</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Yeni Şifreniz</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all tracking-widest"
                    placeholder="Güvenli şifrenizi girin"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Yeni Şifre (Tekrar)</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-sm focus:bg-white focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all tracking-widest"
                    placeholder="Şifreyi doğrulayın"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 mt-4 text-[12px] font-black tracking-widest bg-[#dc3545] hover:bg-red-700 shadow-[0_4px_14px_rgba(220,53,69,0.3)] rounded-sm flex items-center justify-center gap-2 transition-all uppercase">
                {loading ? <span className="animate-pulse">Kaydediliyor...</span> : <>Kaydet ve Panele Geç <ArrowRight size={16} /></>}
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