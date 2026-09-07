"use client";

import { useState, useEffect } from "react";
import { getKargoStats, getPerformanceByDateRange } from "@/app/actions/aras-integration";

interface PerformanceProps {
  employeeId?: string;
}

interface DailyPerformance {
  date: string; // YYYY-MM-DD
  count: number;
  first_time: string; // HH:mm
  last_time: string; // HH:mm
  height?: string; // CSS için (Frontend'de hesaplanacak)
}

export default function TrackingPerformancePanel({ employeeId }: PerformanceProps) {
  const [stats, setStats] = useState({ totalRecords: 0, processed: 0, remaining: 0, today: 0 });
  
  // Ana Veri Havuzu (Grafik, Liste ve Excel buradan beslenir)
  const [performanceData, setPerformanceData] = useState<DailyPerformance[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Tarih Aralığı State'leri (Varsayılan: Son 7 Gün)
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // 1. Genel İstatistikleri Çek (Değişmedi, doğru çalışıyor)
  useEffect(() => {
    fetchGlobalStats();
  }, []);

  // 2. Tarih Seçildikçe Liste ve Grafiği Güncelle
  useEffect(() => {
    fetchHistoricalData(startDate, endDate);
  }, [startDate, endDate]);

  const fetchGlobalStats = async () => {
    const res = await getKargoStats(""); 
    if (res.success) {
      setStats({ 
        totalRecords: res.total, 
        processed: res.processed, 
        remaining: res.total - res.processed,
        today: res.today 
      });
    }
  };

const fetchHistoricalData = async (start: string, end: string) => {
    setIsLoadingData(true);
    try {
      // Backend'den gerçek veriyi çekiyoruz
      const rawData = await getPerformanceByDateRange(start, end);
      
      // Grafikteki çubukların yüksekliğini (CSS % değerini) hesaplamak için max değeri bul
      const maxCount = Math.max(...rawData.map((d: any) => d.count), 1);
      
      const enrichedData = rawData.map((d: any) => ({
        ...d,
        height: `${(d.count / maxCount) * 100}%` // Çubukların tepeye oranla boyu
      }));

      setPerformanceData(enrichedData); // Hem liste, hem grafik, hem Excel bu veriyle besleniyor
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Başarılı İşlem Bildirim Sesi
  const playSuccessBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Tarayıcı desteklemiyorsa sessizce geç
    }
  };

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelExport = () => {
    if (!startDate || !endDate) return alert("Lütfen tarih aralığı seçiniz.");
    if (new Date(startDate) > new Date(endDate)) return alert("Başlangıç tarihi, bitiş tarihinden büyük olamaz.");
    if (performanceData.length === 0) return alert("İndirilecek veri bulunamadı.");

    setIsExporting(true);

    setTimeout(() => {
      // Excel, doğrudan ekrandaki tablo (performanceData) verisinden beslenir. Senkronizasyon %100'dür.
      const headers = "Tarih;İşlenen Adet;İlk İşlem Saati;Son İşlem Saati\n";
      const rows = performanceData.map(r => `${r.date};${r.count};${r.first_time};${r.last_time}`).join("\n");
      const fileName = `ARAS_ESLESTIRME_PERFORMANS_${startDate}_${endDate}.csv`;
      
      downloadBlob("\uFEFF" + headers + rows, fileName);
      playSuccessBeep();
      setIsExporting(false);
    }, 800);
  };

  return (
    <div className="w-full flex flex-col gap-6 font-['Quicksand'] pb-8">
      
      {/* 1. VIBRANT HEADER */}
      <div className="w-full bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-100/50 to-teal-100/50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="relative z-10 flex-1">
          <h2 className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500 uppercase tracking-widest flex items-center gap-3">
            GELİŞMİŞ ANALİZ MOTORU
          </h2>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">
            Aras Kargo Eşleştirme Hızı, Verimlilik ve Tarih Bazlı Dökümler
          </p>
        </div>
        
        <div className="relative z-10 bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-100/50 px-5 py-3 rounded-xl shadow-sm">
          <div className="text-[10px] text-blue-600/70 font-black uppercase tracking-widest mb-1">Geçerli Mod</div>
          <div className="text-sm text-blue-700 font-black uppercase tracking-widest flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.6)]"></span>
            GLOBAL HAVUZ
          </div>
        </div>
      </div>

      {/* 2. DİNAMİK & RENKLİ KPI KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
        <div className="bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl p-6 flex flex-col justify-between shadow-lg shadow-blue-500/20 text-white relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/3"></div>
          <span className="text-[11px] font-black uppercase tracking-widest mb-4 opacity-90">Bugün Eşleştirilen</span>
          <div className="text-5xl font-black font-mono drop-shadow-sm">{stats.today}</div>
        </div>
        
        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm transition-transform duration-300 hover:-translate-y-1">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Kümülatif Eşleştirilen</span>
          <div className="text-4xl font-black font-mono text-slate-800">{stats.processed}</div>
        </div>
        
        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm transition-transform duration-300 hover:-translate-y-1">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Sistemdeki Toplam Sipariş</span>
          <div className="text-4xl font-black font-mono text-slate-800">{stats.totalRecords}</div>
        </div>
        
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm transition-transform duration-300 hover:-translate-y-1 relative overflow-hidden">
          <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-4">Bekleyen Sipariş (Kalan)</span>
          <div className="text-4xl font-black font-mono text-rose-600">{stats.remaining}</div>
        </div>
      </div>

      {/* 3. ANA GRAFİK VE TARİH SEÇİCİ BÖLGESİ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full items-start">
        
        {/* Sol Kolon: Günlük Barkod Okuma Grafiği */}
        <div className="xl:col-span-2 w-full bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] h-full flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                Tarih Bazlı İşlem Grafiği
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">Seçilen aralıktaki günlük tempo dağılımı (Sadece gerçek veriler)</p>
            </div>
            <div className="bg-blue-50/50 text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border border-blue-100">
              {performanceData.length} AKTİF GÜN
            </div>
          </div>
          
          <div className="flex-1 min-h-[200px] w-full flex items-end justify-between gap-2 sm:gap-4 border-b-2 border-slate-50 pb-2 relative">
            {isLoadingData ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 animate-spin text-teal-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </div>
            ) : performanceData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-400 uppercase tracking-widest">
                BU TARİH ARALIĞINDA İŞLEM BULUNAMADI
              </div>
            ) : (
              performanceData.map((data, index) => {
                const dayStr = new Date(data.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end relative">
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 absolute -top-12 bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-xl mb-1 whitespace-nowrap pointer-events-none shadow-xl z-20 scale-95 group-hover:scale-100">
                      {data.count} Kayıt
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-slate-800 rotate-45"></div>
                    </div>
                    
                    <div 
                      className="w-full max-w-[60px] bg-gradient-to-t from-blue-600 to-teal-400 opacity-80 group-hover:opacity-100 transition-all duration-300 relative rounded-t-lg group-hover:shadow-[0_0_15px_rgba(20,184,166,0.4)]" 
                      style={{ height: data.height || '0%' }}
                    >
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-white/30 rounded-t-lg"></div>
                    </div>
                    
                    <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600 transition-colors uppercase mt-2">
                      {dayStr}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sağ Kolon: Animasyonlu Kontrol Paneli */}
        <div className="xl:col-span-1 w-full bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden flex flex-col h-full relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-teal-400"></div>
          
          <div className="p-6 sm:p-8 flex flex-col gap-6 flex-1 justify-center">
            <div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                VERİ KONTROLÜ
              </h3>
              <p className="text-[11px] font-bold text-slate-500 mt-2 uppercase tracking-wide leading-relaxed">
                Aşağıdaki tarihlere göre hem grafik hem de liste eşzamanlı olarak güncellenir.
              </p>
            </div>

            <div className="flex flex-col gap-5 mt-2">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Başlangıç Tarihi</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-12 w-full bg-slate-50 border border-slate-200 px-4 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 transition-all uppercase rounded-xl cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Bitiş Tarihi</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-12 w-full bg-slate-50 border border-slate-200 px-4 text-sm font-bold text-slate-700 outline-none focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 transition-all uppercase rounded-xl cursor-pointer"
                />
              </div>
            </div>

            <button 
              onClick={handleExcelExport}
              disabled={isExporting || performanceData.length === 0}
              className="mt-4 h-14 w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white text-[13px] font-black uppercase tracking-widest transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(20,184,166,0.3)] flex items-center justify-center gap-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isExporting ? (
                <>
                  <svg className="w-5 h-5 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  HAZIRLANIYOR...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  EXCEL ÇIKTISI AL
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. YENİ EKLENEN BÖLÜM: Ekranda Liste (Table) Görünümü */}
      <div className="w-full bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden flex flex-col">
        <div className="bg-slate-50 border-b border-slate-100 p-5 sm:p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
              GÜNLÜK OPERASYON LİSTESİ
            </h3>
            <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Tarih seçimine göre filtrelenmiş net veriler</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">TARİH</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">İŞLENEN (ADET)</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">İLK İŞLEM SAATİ</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">SON İŞLEM SAATİ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {performanceData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Bu aralıkta listelenecek veri yok
                  </td>
                </tr>
              ) : (
                performanceData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-black text-slate-700 font-mono">
                      {new Date(row.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-md text-sm font-black font-mono">
                        {row.count}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm font-bold text-slate-500 font-mono text-center">{row.first_time}</td>
                    <td className="py-4 px-6 text-sm font-bold text-slate-500 font-mono text-center">{row.last_time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}