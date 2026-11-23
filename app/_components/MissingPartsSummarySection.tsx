"use client";

import { CheckCircle2, MapPinOff, PackageSearch, CircleHelp } from "lucide-react";

interface MissingPartsSummary {
  totalParts: number;
  successful: number;
  missingAddress: number;
  unclassified: number;
}

export function MissingPartsSummarySection({ summary }: { summary?: MissingPartsSummary }) {
  const totalParts = summary?.totalParts ?? 0;
  const successful = summary?.successful ?? 0;
  const missingAddress = summary?.missingAddress ?? 0;
  const unclassified = summary?.unclassified ?? 0;

  return (
    <section aria-labelledby="missing-parts-title" className="lg:col-span-4 min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#dc3545] text-white"><PackageSearch size={18} /></span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#b42332]">Günlük Operasyon</p>
            <h2 id="missing-parts-title" className="text-sm font-black text-slate-900">Eksik Parça Özeti</h2>
          </div>
        </div>
        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500">Bugün</span>
      </header>
      <div className="border-b border-slate-100 bg-gradient-to-r from-rose-50/80 to-white px-4 py-4">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Toplam Eksik Parça Adedi</span>
        <p className="mt-1 font-mono text-3xl font-black tabular-nums text-slate-900">{totalParts.toLocaleString("tr-TR")} <span className="text-xs font-semibold text-slate-500">adet</span></p>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 size={17} className="text-emerald-600" />
          <strong className="mt-2 block font-mono text-2xl font-black tabular-nums text-emerald-800">{successful.toLocaleString("tr-TR")}</strong>
          <span className="text-[11px] font-bold text-emerald-800">Başarılı adres</span>
        </div>
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
          <MapPinOff size={17} className="text-rose-600" />
          <strong className="mt-2 block font-mono text-2xl font-black tabular-nums text-rose-800">{missingAddress.toLocaleString("tr-TR")}</strong>
          <span className="text-[11px] font-bold text-rose-800">Eksik adres</span>
        </div>
      </div>
      {unclassified > 0 && (
        <p className="mx-4 mb-4 flex items-center gap-1.5 text-[10px] font-medium text-amber-700">
          <CircleHelp size={13} /> {unclassified} kaydın adres durumu henüz belirtilmedi.
        </p>
      )}
      <footer className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-[10px] text-slate-500">
        Türkiye saatiyle bugünkü kayıtlar · Adres sayıları kayıt bazındadır
      </footer>
    </section>
  );
}
