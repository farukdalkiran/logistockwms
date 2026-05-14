// app/login/page.tsx
"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // createBrowserClient kullandığımız için giriş başarılıysa cookie otomatik yazılır.
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('E-posta veya şifre hatalı.');
      setLoading(false);
      return;
    }

    // Yönlendir ve middleware'in yeni durumu okuması için rotayı tazele
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 md:p-10 border border-slate-100">
        
        <div className="text-center mb-10">
          <Logo variant="primary" className="text-4xl" />
          <p className="text-sm text-slate-500 font-bold mt-2 tracking-wide">WMS Yönetim Sistemi</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-[var(--color-primary)] p-4 rounded-xl flex items-center gap-3 text-sm font-bold">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 ml-1">E-Posta Adresi</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-[var(--color-primary)] outline-none font-semibold text-slate-800 transition-colors"
                placeholder="ornek@logistock.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700 ml-1">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-[var(--color-primary)] outline-none font-semibold text-slate-800 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" isLoading={loading} className="w-full h-14 mt-6 text-lg tracking-wide">
            Sisteme Giriş Yap
          </Button>
        </form>
      </div>
    </div>
  );
}