"use client";

import { useState } from 'react';
import { Bell, LogOut, X, AlertTriangle } from 'lucide-react';
import { portalLogout } from '@/app/actions/portal';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';

interface HeaderProps {
  employee: any;
  stats: any;
}

export default function PortalHeader({ employee, stats }: HeaderProps) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = async () => {
    await portalLogout();
    router.push('/portal/login');
  };

  return (
    <>
      {/* KIRMIZI NAVBAR */}
      <div className="w-full h-16 bg-[#dc3545] flex items-center justify-between px-4 shadow-md relative z-40">
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-lg tracking-widest  opacity-90">Personel Paneli</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Bildirim Zili */}
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-10 h-10 flex items-center justify-center text-white/90 hover:bg-white/10 rounded-full transition-colors"
          >
            <Bell size={20} />
            {stats?.missingDays > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-white rounded-full animate-pulse"></span>
            )}
          </button>

          {/* Çıkış Yap */}
          <button 
            onClick={handleLogout}
            className="w-10 h-10 flex items-center justify-center text-white/90 hover:bg-white/10 rounded-full transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* BİLDİRİM ÇEKMECESİ (Dropdown Modal) */}
      {showNotifications && (
        <div className="absolute top-16 left-0 w-full px-4 pt-2 z-50 animate-in fade-in slide-in-from-top-4">
          <div className="bg-white w-full max-w-md mx-auto rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-3 flex justify-between items-center">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Sistem Bildirimleri</span>
              <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4">
              {stats?.missingDays > 0 ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} className="text-[#dc3545]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-black text-slate-800 uppercase tracking-wide">Eksik Mesai Uyarısı</span>
                    <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">
                      Bu ay <strong className="text-[#dc3545]">{stats.missingDays} gün</strong> eksik girişiniz tespit edilmiştir. (Hafta sonları hariç tutulmuştur).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Yeni bildiriminiz yok.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}