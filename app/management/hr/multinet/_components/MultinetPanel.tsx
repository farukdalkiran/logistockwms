"use client";

import { useState, useEffect } from "react";
import { getMultinetCalculations, MultinetRecord } from "@/app/actions/multinet";

interface MultinetPanelProps {
  branchId: string | null;
  isGlobal: boolean;
}

const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export default function MultinetPanel({ branchId, isGlobal }: MultinetPanelProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [dailyFee, setDailyFee] = useState<number>(600);
  const [records, setRecords] = useState<MultinetRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchCalculations = async () => {
    if (!branchId && !isGlobal) return;
    setIsLoading(true);
    
    const [year, month] = selectedMonth.split("-").map(Number);
    const targetBranch = isGlobal && !branchId ? "GLOBAL" : branchId;
    
    const data = await getMultinetCalculations(targetBranch, year, month, dailyFee);
    
    setRecords(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCalculations();
  }, [selectedMonth, dailyFee, branchId]);

const handleExportExcel = () => {
    if (records.length === 0) return;
    const [year, month] = selectedMonth.split("-");
    
    const headers = [
       "Ad Soyad", "Hedef Gün", "Fazla Mesai/Gün", "Kesinti (İzin/Rapor/Eksik)", "Net Gün", 
      "Toplam Tutar (TL)", "Ayın 1'i (TL)", "Ayın 15'i (TL)", "Açıklamalar"
    ];
    
    const csvContent = [
      headers.join(";"),
      ...records.map(r => {
        // Açıklamaları pipe yerine excel hücresinde alt alta (CHAR(10) ile) yazdırıyoruz
        const formattedDetails = r.details.length > 0 ? r.details.join("\n") : "Standart Mesai";
        
        return [
          r.fullName,
          r.baseDays,
          r.extraDays,
          r.deductedDays,
          r.netDays,
          r.totalAmount,
          r.part1,
          r.part2,
          `"${formattedDetails}"` // Excel'in satır atlamasını tanıması için çift tırnak içine alıyoruz
        ].join(";");
      })
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Multinet_Hakedis_${year}_${month}.csv`;
    link.click();
  };

  const totalAmount = records.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const isCurrentMonth = selectedMonth === new Date().toISOString().slice(0, 7);
  
  const currentMonthIndex = parseInt(selectedMonth.split('-')[1], 10) - 1;
  const currentMonthName = MONTH_NAMES[currentMonthIndex];
  const nextMonthName = MONTH_NAMES[(currentMonthIndex + 1) % 12];

  return (
    <div className="flex flex-col flex-1 p-6 ">
      <div className="bg-zinc-900 border-l-4 border-[#53CF78] p-5 lg:p-6 shadow-md flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 rounded-none w-full">
        
        {/* Sol Kısım: Logo ve Bilgiler */}
        <div className="flex items-start gap-4 w-full xl:w-auto flex-1 min-w-0">
          <div className="flex flex-col flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight uppercase truncate">
              Multinet Ödeme & Hakediş Motoru
            </h1>
            <p className="text-zinc-400 text-xs lg:text-sm mt-1 truncate">
              Sonraki aya devreden mesai ve izin kesintilerinin otomatik hesaplandığı terminal.
            </p>
            
            <div className="mt-3 flex items-start gap-2 bg-[#53CF78]/10 border border-[#53CF78]/30 px-3 py-2 rounded-none">
              <svg className="w-4 h-4 text-[#53CF78] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[#53CF78] text-[11px] lg:text-xs font-semibold tracking-wide uppercase leading-relaxed">
                <span className="text-white font-bold mr-1">Devreden Bakiye:</span> 
                {currentMonthName} ayına ait eksik ve fazla çalışmalar, {nextMonthName} ayının 1'i ve 15'i ödemelerine yansıtılacaktır[cite: 1].
              </span>
            </div>

            {isCurrentMonth && (
              <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-none">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-amber-500 text-[11px] lg:text-xs font-semibold tracking-wide leading-relaxed">
                  <strong className="text-white font-bold mr-1">DİKKAT:</strong> Ay henüz bitmediği için haksız kesinti yapılmamış, hesaplamalar bugüne kadarki verilere göre optimize edilmiştir[cite: 1].
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Sağ Kısım: Kontroller */}
        <div className="flex flex-wrap items-end gap-3 w-full xl:w-auto shrink-0 bg-zinc-950/30 p-3 xl:p-0 xl:bg-transparent border border-zinc-800 xl:border-none">
          <div className="flex flex-col flex-1 sm:flex-initial min-w-[130px]">
            <label className="text-[10px] text-zinc-400 uppercase mb-1.5 font-semibold tracking-wider">Dönem Seçimi</label>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-zinc-800 text-white border border-zinc-700 px-3 py-0 outline-none focus:border-[#53CF78] transition-colors rounded-none w-full h-10 text-sm"
            />
          </div>
          
          <div className="flex flex-col flex-1 sm:flex-initial min-w-[130px]">
            <label className="text-[10px] text-zinc-400 uppercase mb-1.5 font-semibold tracking-wider">Günlük Çarpan (TL)</label>
            <input 
              type="number" 
              value={dailyFee}
              onChange={(e) => setDailyFee(Number(e.target.value))}
              className="bg-zinc-800 text-[#53CF78] font-bold border border-zinc-700 px-3 py-0 outline-none focus:border-[#53CF78] transition-colors rounded-none w-full h-10 text-sm"
            />
          </div>
          
          <button 
            onClick={handleExportExcel}
            className="flex-1 sm:flex-initial h-10 bg-[#53CF78] hover:bg-[#45b064] text-zinc-900 font-bold px-6 transition-all uppercase text-xs rounded-none shadow-[0_0_10px_rgba(83,207,120,0.15)] hover:shadow-[0_0_15px_rgba(83,207,120,0.3)] flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel İndir
          </button>
        </div>
      </div>
<div className="bg-zinc-900 border-l-4 border-[#53CF78] p-5 lg:p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-none w-full mb-6">
  
  {/* Sol Kısım: Logo ve Dinamik Bilgilendirme Alanı */}
  <div className="flex items-center gap-5 w-full md:w-auto flex-1 min-w-0 bg-[#53CF78]/5 border border-[#53CF78]/20 p-4 rounded-none relative overflow-hidden">
    
    {/* Arka Planda Şık Işıma Efekti */}
    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#53CF78]/10 rounded-full blur-2xl pointer-events-none" />

    {/* Yuvarlak, Büyük, Animasyonlu Border'a Sahip Logo Konteynerı */}
    <div className="relative w-16 h-16 lg:w-30 lg:h-30 shrink-0 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#53CF78] animate-[spin_12s_linear_infinite]" />
      <div className="absolute inset-0 rounded-full border-2 border-[#53CF78]/40 shadow-[0_0_15px_rgba(83,207,120,0.4)]" />
      
      <div className="relative w-12 h-12 lg:w-28 lg:h-28 bg-white rounded-full p-2 overflow-hidden flex items-center justify-center shadow-inner">
        <img 
          src="https://multinet.com.tr/sites/default/files/styles/just_webp/public/2024-02/icon1.png.webp?itok=cSsWdUpf" 
          alt="Multinet" 
          className="object-contain w-full h-full rounded-full"
        />
      </div>
    </div>

    {/* Dinamik Metinler */}
    <div className="flex flex-col flex-1 min-w-0 z-10 gap-1.5">
      <div className="flex items-center gap-2 text-xs lg:text-sm font-semibold text-zinc-200">
        <span className="w-2 h-2 rounded-full bg-[#53CF78] animate-pulse shrink-0" />
        <span>Veriler <strong className="text-[#53CF78] uppercase tracking-wide">{currentMonthName}</strong> ayından çekilmiştir.</span>
      </div>
      <div className="flex items-center gap-2 text-xs lg:text-sm font-semibold text-zinc-200">
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
        <span><strong className="text-blue-400 uppercase tracking-wide">{nextMonthName}</strong> ayı ki ödemeler aşağıda hesaplanmıştır[cite: 1].</span>
      </div>
    </div>
  </div>

  {/* Sağ Kısım: Varsa Ekstra Kontroller veya Durum Rozeti */}
  <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-zinc-950/40 border border-zinc-800 px-4 py-3 rounded-none">
    <svg className="w-5 h-5 text-[#53CF78] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">Durum Özeti</span>
      <span className="text-xs font-bold text-white uppercase tracking-tight">Aktif Dönem Hesaplaması</span>
    </div>
  </div>

</div>
      {/* KPI Barları */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 p-4 rounded-none shadow-sm">
          <p className="text-xs text-zinc-500 uppercase font-semibold">{nextMonthName} Ayı Toplam Ödeme</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">₺{totalAmount.toLocaleString('tr-TR')}</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 rounded-none shadow-sm border-b-4 border-b-blue-500">
          <p className="text-xs text-zinc-500 uppercase font-semibold">Aktif Personel</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{records.length}</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 rounded-none shadow-sm border-b-4 border-b-[#53CF78]">
          <p className="text-xs text-zinc-500 uppercase font-semibold">Eklenen Mesai Günü</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">+{records.reduce((acc, curr) => acc + curr.extraDays, 0)}</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 rounded-none shadow-sm border-b-4 border-b-red-500">
          <p className="text-xs text-zinc-500 uppercase font-semibold">Toplam Kesinti Günü</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">-{records.reduce((acc, curr) => acc + curr.deductedDays, 0)}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-zinc-200 shadow-sm flex-1 rounded-none overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-100 text-zinc-600 text-xs uppercase tracking-wider border-b border-zinc-300">
                <th className="p-4 font-bold">Personel</th>
                <th className="p-4 font-bold text-center">Hedef Gün</th>
                <th className="p-4 font-bold text-center text-[#53CF78]">Eklenen</th>
                <th className="p-4 font-bold text-center text-red-500">Kesilen</th>
                <th className="p-4 font-bold text-center border-r border-zinc-300">Net Gün</th>
                <th className="p-4 font-bold text-right bg-zinc-50">1 {nextMonthName}</th>
                <th className="p-4 font-bold text-right bg-zinc-50">15 {nextMonthName}</th>
                <th className="p-4 font-bold text-right bg-zinc-100 border-l border-zinc-300 text-zinc-900">Toplam (TL)</th>
                <th className="p-4 font-bold">Log & Kesinti Detayı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm text-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-500 font-medium">Hesaplamalar yapılıyor...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-500 font-medium">Bu aya ait veri bulunamadı.</td>
                </tr>
              ) : (
                records.map((row) => (
                  <tr key={row.employeeId} className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 font-semibold">{row.fullName}</td>
                    <td className="p-4 text-center font-bold text-zinc-800">{row.baseDays}</td>
                    <td className="p-4 text-center font-bold text-[#53CF78]">{row.extraDays > 0 ? `+${row.extraDays}` : "-"}</td>
                    <td className="p-4 text-center font-bold text-red-500">{row.deductedDays > 0 ? `-${row.deductedDays}` : "-"}</td>
                    <td className="p-4 text-center font-black border-r border-zinc-100">{row.netDays}</td>
                    
                    <td className="p-4 text-right bg-zinc-50 text-zinc-600">₺{row.part1.toLocaleString('tr-TR')}</td>
                    <td className="p-4 text-right bg-zinc-50 text-zinc-600">₺{row.part2.toLocaleString('tr-TR')}</td>
                    
                    <td className="p-4 text-right bg-zinc-100/50 border-l border-zinc-100 font-black text-[#45b064]">₺{row.totalAmount.toLocaleString('tr-TR')}</td>
                    
                    <td className="p-4 text-xs text-zinc-500 max-w-xs truncate" title={row.details.join(" | ")}>
                      {row.details.length > 0 ? row.details.join(" | ") : "Standart Mesai"}
                    </td>
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