"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Wifi, WifiOff, Database, Clock, ShieldCheck, 
  Info, LifeBuoy, TerminalSquare, Package, Users,
  ArrowUpRight, Target, LayoutDashboard, Settings, ShoppingCart
} from 'lucide-react';
import { Logo } from "@/components/ui/Logo";
export const Footer = () => {
  const [time, setTime] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [appVersion, setAppVersion] = useState<string>('v1.0.0');

  useEffect(() => {
    // Proje versiyonunu çevre değişkeninden al (Yoksa varsayılan)
    setAppVersion(process.env.NEXT_PUBLIC_APP_VERSION || 'Build 2026.07');

    // Canlı Saat (Terminal Monitörü için)
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // İnternet (Wi-Fi) Bağlantı Kontrolü
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <footer className="bg-[#0f172b] border-t border-slate-800 mt-auto w-full flex-shrink-0 relative z-1 select-none">
      
      {/* Üst Kısım: Sistem Özeti ve Menüler */}
      <div className="container mx-auto 2xl:max-w-[1400px] px-4 sm:px-6 py-8 lg:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* 1. Kolon: Marka ve Özet (Görsel Eklenebilir Alan) */}
          <div className="flex flex-col gap-4">
            {/* LOGO ALANI - Görsel eklemek istersen <img src="/logo.png" /> kullanabilirsin */}
            <Link
              href="/"
              className="flex-shrink-0 flex items-center cursor-pointer gap-2"
            >
              <Logo variant="primary" className="text-3xl" />
              <span className="text-[#fff] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </Link>
            
            <p className="text-slate-400 text-[13px] leading-relaxed max-w-xs font-medium">
              Sıfır hata toleranslı, gerçek zamanlı depo yönetim, akıllı raflama ve Smart Picking ekosistemi.
            </p>
            
            <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 w-max px-3 py-1.5 rounded border border-slate-700/50">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="text-emerald-400">Tüm Servisler Aktif</span>
            </div>
          </div>

          {/* 2. Kolon: Saha & Terminal */}
          <div className="flex flex-col gap-3.5">
            <h4 className="text-slate-300 font-black text-xs uppercase tracking-widest mb-1 flex items-center gap-2">
              <TerminalSquare size={14} className="text-[#dc3545]" /> Saha & Terminal
            </h4>
            <Link href="/terminal/login" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <TerminalSquare size={14} /> El Terminali Girişi
            </Link>
            <Link href="/terminal/transfer" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <Target size={14} /> Smart Picking (Toplama)
            </Link>
            <Link href="/terminal/counting" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <ArrowUpRight size={14} /> Dinamik Sayım & İade
            </Link>
          </div>

          {/* 3. Kolon: Yönetim Merkezi */}
          <div className="flex flex-col gap-3.5">
            <h4 className="text-slate-300 font-black text-xs uppercase tracking-widest mb-1 flex items-center gap-2">
              <LayoutDashboard size={14} className="text-[#dc3545]" /> Yönetim Merkezi
            </h4>
            <Link href="/management/products" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <Package size={14} /> Ürün ve Stok Kataloğu
            </Link>
            <Link href="/management/hr" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <Users size={14} /> Mesai ve İK Paneli
            </Link>
            <Link href="/management/role-settings" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <Settings size={14} /> Erişim Ayarları
            </Link>
          </div>

          {/* 4. Kolon: Kurumsal & Destek */}
          <div className="flex flex-col gap-3.5">
            <h4 className="text-slate-300 font-black text-xs uppercase tracking-widest mb-1 flex items-center gap-2">
              <LifeBuoy size={14} className="text-[#dc3545]" /> Kurumsal & Destek
            </h4>
            <Link href="/management/b2b" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <ShoppingCart size={14} /> Sarf Malzeme Siparişi
            </Link>
            {/* Burada yazacağın Sistem Hakkında sayfasını işaret ettik */}
            <Link href="/management/about" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <Info size={14} /> Sistem Hakkında
            </Link>
            {/* IT Destek Talep Paneli veya Mail Yönlendirmesi */}
            <Link href="/management/help" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max font-semibold">
              <LifeBuoy size={14} /> IT Destek & Yardım
            </Link>
          </div>

        </div>
      </div>

      {/* Alt Kısım: Monitörler ve Telif (Bottom Bar) */}
      <div className="border-t border-slate-800/80 bg-[#0a101d]">
        <div className="container mx-auto 2xl:max-w-[1400px] px-4 sm:px-6 py-3.5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Sol: Telif, Mimar ve Versiyon */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4 text-center md:text-left">
              <p className="text-[11px] font-semibold text-slate-400">
                © {new Date().getFullYear()} LogiStock WMS
              </p>
              <div className="hidden md:block w-px h-3.5 bg-slate-700"></div>
              <p className="text-[11px] font-medium text-slate-400">
                Mimari & Geliştirme: <span className="font-bold text-white tracking-wide">Faruk Dalkıran</span>
              </p>
              <div className="hidden md:block w-px h-3.5 bg-slate-700"></div>
              <p className="text-[10px] font-mono font-bold text-slate-500 tracking-tight bg-slate-800 px-2 py-0.5 rounded">
                {appVersion}
              </p>
            </div>

            {/* Sağ: Gerçek Zamanlı Terminal Monitörleri */}
            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-5">
              
              {/* Ağ Durumu */}
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isOnline ? 'text-slate-400' : 'text-[#dc3545]'}`}>
                {isOnline ? (
                  <Wifi size={12} className="text-emerald-400" />
                ) : (
                  <WifiOff size={12} className="animate-pulse" />
                )}
                <span className="hidden sm:inline">{isOnline ? 'Bağlantı Stabil' : 'Terminal Çevrimdışı'}</span>
                <span className="sm:hidden">{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              <div className="w-px h-3.5 bg-slate-700"></div>

              {/* Veritabanı Soketi */}
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                </span>
                <Database size={12} className="text-slate-500 hidden sm:block" />
                Supabase <span className="hidden sm:inline">Socket</span>
              </div>

              <div className="w-px h-3.5 bg-slate-700"></div>

              {/* Sistem Saati */}
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200 font-mono bg-[#0f172b] px-2.5 py-1 rounded border border-slate-700/50 min-w-[75px] justify-center shadow-inner">
                <Clock size={12} className="text-[#dc3545]" />
                {time || '--:--:--'}
              </div>

            </div>
          </div>
        </div>
      </div>
      
      {/* iOS/Android El Terminali Safe-Area Boşluğu */}
      <div className="h-safe-area-bottom w-full bg-[#0a101d]"></div>
    </footer>
  );
};