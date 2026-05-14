"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Wifi, WifiOff, Database, Clock, ShieldCheck, 
  Lightbulb, BookOpen, Info, LifeBuoy, TerminalSquare, 
  Activity, ArrowUpRight 
} from 'lucide-react';

export const Footer = () => {
  const [time, setTime] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [appVersion, setAppVersion] = useState<string>('v1.0.0');

  useEffect(() => {
    // Proje versiyonunu çevre değişkeninden (veya package.json'dan) al
    // process.env.NEXT_PUBLIC_APP_VERSION tanımlı değilse fallback kullan
    setAppVersion(process.env.NEXT_PUBLIC_APP_VERSION || 'Build 2026.05');

    // Canlı Saat
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

  // Modal / Drawer tetikleyicileri (Tab kirliliğini önlemek için)
  const openFeedbackDrawer = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("İstek ve Öneri Drawer'ı açılıyor...");
    // TODO: setFeedbackDrawerOpen(true)
  };

  const openAboutModal = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Sistem Hakkında Modalı açılıyor...");
    // TODO: setAboutModalOpen(true)
  };

  return (
    <footer className="bg-[#0f172b] border-t border-slate-800 mt-auto w-full flex-shrink-0 relative z-40 select-none">
      
      {/* Üst Kısım: Hızlı Menüler ve Destek Panelleri */}
      <div className="container mx-auto 2xl:max-w-[1400px] px-4 sm:px-6 py-6 lg:py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          
          {/* 1. Kolon: Marka ve Özet */}
          <div className="flex flex-col gap-3">
            <h3 className="text-white font-black text-lg tracking-tight flex items-center gap-2">
              LogiStock <span className="text-[#dc3545]">WMS</span>
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xs">
              Sıfır hata toleranslı, gerçek zamanlı depo yönetim ve akıllı toplama (Smart Picking) platformu.
            </p>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-500">
              <ShieldCheck size={14} className="text-emerald-500" />
              Sistem Durumu: <span className="text-emerald-400">Tüm Servisler Aktif</span>
            </div>
          </div>

          {/* 2. Kolon: Operasyonel Kısayollar */}
          <div className="flex flex-col gap-3">
            <h4 className="text-slate-300 font-bold text-xs uppercase tracking-wider mb-1">Operasyon</h4>
            <Link href="/terminal/login" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max">
              <TerminalSquare size={14} /> El Terminali Bağlantısı
            </Link>
            <Link href="/management/print" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max">
              <ArrowUpRight size={14} /> Etiket ve Tutanak Çıktısı
            </Link>
            <Link href="/management/b2b" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max">
              <ArrowUpRight size={14} /> Sarf Malzeme Siparişi
            </Link>
          </div>

          {/* 3. Kolon: Destek & Geri Bildirim (Drawer/Modal Tetikleyiciler) */}
          <div className="flex flex-col gap-3">
            <h4 className="text-slate-300 font-bold text-xs uppercase tracking-wider mb-1">Merkez Destek</h4>
            <button onClick={openFeedbackDrawer} className="text-slate-400 hover:text-[#dc3545] hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max text-left">
              <Lightbulb size={14} /> İstek ve Öneri Bildir
            </button>
            <button className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max text-left">
              <LifeBuoy size={14} /> IT Destek Talebi Aç
            </button>
            <button onClick={openAboutModal} className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max text-left">
              <Info size={14} /> Sistem Hakkında
            </button>
          </div>

          {/* 4. Kolon: Dokümantasyon */}
          <div className="flex flex-col gap-3">
            <h4 className="text-slate-300 font-bold text-xs uppercase tracking-wider mb-1">Kılavuzlar</h4>
            <Link href="/docs/smart-picking" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max">
              <BookOpen size={14} /> Smart Picking Kullanımı
            </Link>
            <Link href="/docs/inventory" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max">
              <BookOpen size={14} /> Sayım ve İade Lojiği
            </Link>
            <Link href="/docs/api" className="text-slate-400 hover:text-white hover:translate-x-1 transition-all text-sm flex items-center gap-2 w-max">
              <Activity size={14} /> API Durumu
            </Link>
          </div>

        </div>
      </div>

      {/* Alt Kısım: Monitörler ve Telif */}
      <div className="border-t border-slate-800/80 bg-[#0a101d]">
        <div className="container mx-auto 2xl:max-w-[1400px] px-4 sm:px-6 py-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Sol: Telif ve Versiyon */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-4 text-center md:text-left">
              <p className="text-[11px] font-semibold text-slate-400">
                © {new Date().getFullYear()} LogiStock
              </p>
              <div className="hidden md:block w-px h-3.5 bg-slate-700"></div>
              <p className="text-[10px] font-mono font-medium text-slate-500 tracking-tight">
                {appVersion}
              </p>
              <div className="hidden md:block w-px h-3.5 bg-slate-700"></div>
              <p className="text-[11px] font-medium text-slate-400">
                Mimari & Geliştirme: <span className="font-bold text-white tracking-wide">Faruk Dalkıran</span>
              </p>
            </div>

            {/* Sağ: Gerçek Zamanlı Terminal Monitörleri */}
            <div className="flex flex-wrap justify-center items-center gap-3 md:gap-5">
              
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