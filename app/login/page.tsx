"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import SessionAlert from './_components/SessionAlert'
import { Lock, Mail, AlertCircle, KeyRound, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, Globe, ShieldAlert, Users } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] p-4 font-['Quicksand'] relative overflow-hidden">

      {/* Endüstriyel Arka Plan Deseni */}
      <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,#fff,#fff_1px,transparent_1px,transparent_20px)] pointer-events-none"></div>
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#dc3545]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* MERKEZ KART */}
      <div className={`w-full max-w-md bg-white rounded-md shadow-2xl relative z-10 transition-all duration-500 overflow-hidden border border-slate-200 ${showForceReset ? 'scale-105' : 'scale-100'}`}>
        
        {/* Üst Kırmızı Güvenlik Barı */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#dc3545]"></div>

        <div className="p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="flex justify-center items-baseline mb-2 gap-2">
              <Logo variant="primary" className="text-4xl drop-shadow-sm" />
              <span className="text-[#0f172b] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-extrabold mt-2 tracking-widest uppercase bg-slate-100 inline-block px-3 py-1 rounded-sm">Depo Yönetim Sistemi</p>
          </div>

          {/* HATA VE BAŞARI MESAJLARI */}
          {error && (
            <div className="bg-red-50 border-l-4 border-[#dc3545] text-[#dc3545] px-4 py-3 rounded-r-sm flex items-start gap-3 text-xs font-bold mb-6 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> 
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 px-4 py-3 rounded-r-sm flex items-start gap-3 text-xs font-bold mb-6 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> 
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}
          
          <SessionAlert />

          {/* === GÖRÜNÜM: NORMAL GİRİŞ === */}
          {!showForceReset && currentView === 'login' && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kurumsal E-Posta</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#dc3545] transition-colors" size={18} />
                    <input 
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 bg-slate-50 border-2 border-slate-100 rounded-md focus:bg-white focus:border-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                      placeholder="ornek@logistock.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sistem Şifresi</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#dc3545] transition-colors" size={18} />
                    <input 
                      type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 bg-slate-50 border-2 border-slate-100 rounded-md focus:bg-white focus:border-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all tracking-widest shadow-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-12 mt-4 text-[13px] font-black tracking-widest bg-slate-900 hover:bg-black rounded-md shadow-md flex items-center justify-center gap-2 transition-all">
                  {loading ? <span className="animate-pulse">Bağlanıyor...</span> : <>Sisteme Giriş Yap <ArrowRight size={16} /></>}
                </Button>
              </form>

              {/* Ekstra Menü ve Yönlendirmeler */}
              <div className="mt-8 pt-6 border-t-2 border-slate-100 border-dashed flex flex-col gap-4">
                
                {/* PERSONEL GİRİŞİ BUTONU (YENİ) */}
                <button 
                  type="button" 
                  onClick={() => router.push('/portal/login')} 
                  className="w-full h-12 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-widest rounded-md flex items-center justify-center gap-2 transition-all shadow-sm group"
                >
                  <Users size={18} className="text-slate-400 group-hover:text-[#dc3545] transition-colors" /> 
                  Sahadan Personel Girişi
                </button>

                <button 
                  type="button" 
                  onClick={() => { setError(''); setSuccessMsg(''); setCurrentView('forgot'); }} 
                  className="text-[10px] font-black text-slate-400 hover:text-[#dc3545] transition-colors uppercase tracking-widest text-center"
                >
                  Şifrenizi mi unuttunuz?
                </button>
              </div>
            </div>
          )}

          {/* === GÖRÜNÜM: ŞİFREMİ UNUTTUM === */}
          {!showForceReset && currentView === 'forgot' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {/* ... (Şifremi unuttum içeriği aynı kalıyor) ... */}
              <div className="text-center mb-6">
                <ShieldAlert size={36} className="mx-auto text-[#dc3545] mb-3" />
                <h3 className="text-[15px] font-black text-slate-800 uppercase tracking-widest">Güvenlik Protokolü</h3>
                <p className="text-[12px] font-bold text-slate-500 mt-2 leading-relaxed">
                  Kurumsal güvenlik politikaları gereği şifre sıfırlama işlemleri otomatik yapılamamaktadır. Lütfen sistem yöneticisi veya geliştirici ile iletişime geçin.
                </p>
              </div>

              <div className="space-y-3">
                <a href="mailto:faruk.dalkiran@peeraj.com.tr" className="w-full bg-slate-50 border border-slate-200 hover:border-[#dc3545] hover:bg-red-50 text-slate-700 hover:text-[#dc3545] p-3 rounded-md flex items-center justify-center gap-2 transition-colors text-[12px] font-black tracking-wider uppercase shadow-sm">
                  <Mail size={16} /> E-Posta Gönder
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
              {/* ... (Şifre yenileme formu aynı kalıyor) ... */}
              <div className="flex flex-col items-center text-center bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-md mb-2 shadow-sm">
                <ShieldCheck size={28} className="text-orange-500 mb-2" />
                <h3 className="text-sm font-black text-orange-900 uppercase tracking-widest">Güvenlik Prosedürü</h3>
                <p className="text-[11px] font-bold text-orange-700 mt-1 leading-relaxed">
                  Sistem yöneticisi tarafından atanan <strong className="text-[#dc3545]">geçici şifre</strong> ile giriş yaptınız. Sisteme erişmeden önce güvenli şifrenizi belirlemelisiniz.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Yeni Şifreniz</label>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#dc3545] transition-colors" size={18} />
                  <input 
                    type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border-2 border-slate-100 rounded-md focus:bg-white focus:border-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all tracking-widest shadow-sm"
                    placeholder="Güvenli şifrenizi girin"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Yeni Şifre (Tekrar)</label>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#dc3545] transition-colors" size={18} />
                  <input 
                    type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 bg-slate-50 border-2 border-slate-100 rounded-md focus:bg-white focus:border-[#dc3545] outline-none text-sm font-bold text-slate-800 transition-all tracking-widest shadow-sm"
                    placeholder="Şifreyi doğrulayın"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 mt-4 text-[12px] font-black tracking-widest bg-[#dc3545] hover:bg-red-700 shadow-md rounded-md flex items-center justify-center gap-2 transition-all uppercase">
                {loading ? <span className="animate-pulse">Kaydediliyor...</span> : <>Kaydet ve Panele Geç <ArrowRight size={16} /></>}
              </Button>
            </form>
          )}

        </div>
      </div>
      
      {/* Footer Text */}
      <div className="absolute bottom-6 w-full text-center pointer-events-none">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">LogiStock WMS 2026</span>
      </div>
    </div>
  );
}