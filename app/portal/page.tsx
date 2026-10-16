import { redirect } from 'next/navigation';
import { getPortalSession, getPortalStats } from '@/app/actions/portal';
import PortalHeader from './_components/PortalHeader';
import DynamicQR from './_components/DynamicQR';
import { Clock, CalendarDays, AlertTriangle, MapPin, Info } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export default async function PortalDashboardPage() {
  const employee = await getPortalSession();
  
  if (!employee) {
    redirect('/portal/login');
  }

  const fetchedStats = await getPortalStats();
  const safeStats = fetchedStats || {
    totalHours: '0.0',
    overTime: '0.0',
    missingDays: 0,
    logs: []
  };

  const today = new Intl.DateTimeFormat('tr-TR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(new Date());

  // TS HATASI ÇÖZÜMÜ: Server action'da zaten çözümlenmiş (resolved) ismi kullanıyoruz.
  // Diziden name okumaya çalışıp tip hatası fırlatmasının önüne geçildi.
  const branchName = employee.resolvedBranchName || 'MERKEZ KADRO';

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] relative pb-12 flex flex-col selection:bg-[#dc3545] selection:text-white">
      
      {/* 1. KIRMIZI NAVBAR VE BİLDİRİMLER */}
      <PortalHeader employee={employee} stats={safeStats} />

      {/* 2. YARIM KIRMIZI ARKA PLAN GEÇİŞİ */}
      <div className="absolute top-16 left-0 w-full h-52 bg-[#dc3545] rounded-b-[2.5rem] shadow-sm z-0">
        <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,#000,#000_1px,transparent_1px,transparent_20px)] pointer-events-none rounded-b-[2.5rem]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-white/10 blur-3xl rounded-full pointer-events-none"></div>
      </div>

      {/* 3. ANA İÇERİK */}
      <div className="relative z-10 flex flex-col px-4 pt-6 w-full max-w-md mx-auto">
        
        {/* Lokasyon ve Selamlama */}
        <div className="text-center mb-8 text-white flex flex-col items-center">
          <span className="text-[11px] font-bold tracking-widest uppercase opacity-90 mb-1.5 bg-black/20 px-3 py-1 rounded-sm border border-white/10 flex items-center gap-1.5">
            <MapPin size={12} className="text-red-200" /> {branchName}
          </span>
          <h2 className="text-[18px] font-black tracking-wide uppercase drop-shadow-sm">
            MERHABA, {employee.full_name.split(' ')[0]}
          </h2>
          <p className="text-[10px] font-bold tracking-widest opacity-80 mt-1 uppercase">
            {today}
          </p>
        </div>

        {/* Canlı QR Modülü */}
        <div className="mb-6 animate-in fade-in zoom-in-95 duration-500 delay-100">
          <DynamicQR />
        </div>

        {/* 4. AYLIK İSTATİSTİK ÖZETİ */}
        <div className="w-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <div className="bg-[#0f172b] px-4 py-3 border-b-[3px] border-[#dc3545] flex justify-between items-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none"></div>
            <span className="text-[11px] font-black text-white tracking-widest uppercase relative z-10">
              Aylık Puantaj Özeti
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
            <div className="p-4 flex flex-col items-center justify-center gap-1 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <Clock className="w-4 h-4 text-slate-400 mb-0.5" />
              <span className="text-2xl font-mono font-black text-slate-800 tracking-tighter drop-shadow-sm">{safeStats.totalHours}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Saat</span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center gap-1 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <CalendarDays className="w-4 h-4 text-slate-400 mb-0.5" />
              <span className="text-2xl font-mono font-black text-[#dc3545] tracking-tighter drop-shadow-sm">{safeStats.overTime}</span>
              <span className="text-[9px] font-black text-[#dc3545] uppercase tracking-widest">Ek Mesai</span>
            </div>
          </div>

          <div className={`p-4 flex items-center justify-between transition-colors ${safeStats.missingDays > 0 ? 'bg-[#fff0f0]' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className={safeStats.missingDays > 0 ? "text-[#dc3545]" : "text-slate-400"} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${safeStats.missingDays > 0 ? "text-[#dc3545]" : "text-slate-500"}`}>
                Devamsızlık / Eksik Gün
              </span>
            </div>
            <span className={`text-lg font-mono font-black ${safeStats.missingDays > 0 ? "text-[#dc3545]" : "text-slate-800"}`}>
              {safeStats.missingDays}
            </span>
          </div>
        </div>

        {/* 5. AYLIK HAREKET DÖKÜMÜ (LOG TABLOSU) */}
        <div className="w-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
            <span className="text-[10px] font-black text-slate-600 tracking-widest uppercase">
              Günlük Giriş-Çıkış Hareketleri
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4 whitespace-nowrap">Tarih</th>
                  <th className="py-2.5 px-3">Giriş</th>
                  <th className="py-2.5 px-3">Çıkış</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Süre (Sa)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {safeStats.logs && safeStats.logs.length > 0 ? (
                  safeStats.logs.map((log: any, index: number) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">{log.date}</td>
                      <td className="py-3 px-3 font-mono font-medium text-[#3d870c]">{log.checkIn}</td>
                      <td className="py-3 px-3 font-mono font-medium text-[#dc3545]">{log.checkOut}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 text-right">{log.hours}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-bold tracking-widest uppercase text-[10px]">
                      Bu ay henüz mesai kaydınız bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. OPERASYON TALİMATI */}
        <div className="w-full bg-slate-200/50 border border-slate-200 rounded-xl p-4 flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
          <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Kullanım Talimatı</span>
            <p className="text-[10px] font-bold text-slate-500 mt-1 leading-relaxed">
              Ekrandaki QR kodu, depo turnikelerine veya el terminallerine <strong>10-15 cm</strong> mesafeden okutunuz.
            </p>
          </div>
        </div>

        {/* Sistem İmzası */}
        <div className="flex flex-col items-center justify-center mt-8 gap-2 opacity-40">
           <Logo variant="dark" className="text-2xl grayscale" />
        </div>

      </div>
    </div>
  );
}