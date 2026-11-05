"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ManualBoxDrawer from "./ManualBoxDrawer";
import ExcelBoxUploadDrawer from "./ExcelBoxUploadDrawer";
import { Barcode, Boxes, FileSpreadsheet, Info, PackageCheck, Plus, ShieldCheck } from "lucide-react";

export default function BoxesDashboard({ onUpdate }: { onUpdate?: () => void }) {
  const [boxCount, setBoxCount] = useState<number | null>(null);
  const [isManualDrawerOpen, setIsManualDrawerOpen] = useState(false);
  const [isExcelDrawerOpen, setIsExcelDrawerOpen] = useState(false);

  const refreshCount = useCallback(async () => {
    // Önceki sürümde tüm koli satırları ve ürün ilişkileri her açılışta çekiliyordu.
    // Yalnızca HEAD + COUNT ile toplam kayıt sayısını oku.
    const { count, error } = await supabase.from("boxes")
      .select("id", { head: true, count: "exact" });
    if (error) {
      console.error("Koli sayısı okunamadı:", error.code);
      return;
    }
    setBoxCount(count);
  }, []);

  useEffect(() => { void refreshCount(); }, [refreshCount]);

  const handleSuccess = () => {
    void refreshCount();
    setIsManualDrawerOpen(false);
    setIsExcelDrawerOpen(false);
    onUpdate?.();
  };

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="relative flex min-h-[220px] w-full flex-col justify-between gap-6 overflow-hidden rounded-[5px] border border-slate-700 bg-slate-900 p-5 md:p-7 lg:flex-row">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(220,53,69,.15),transparent_45%)]" />
        <div className="relative z-10 flex max-w-2xl flex-col justify-center gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[5px] bg-[#dc3545] text-white">
              <Barcode size={25} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">Koli ve Master Barkod Yönetimi</h1>
              <p className="mt-1 text-xs font-semibold text-slate-300">Envanter / Tekil Koli Kartları</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-[5px] border border-slate-700 bg-slate-800/80 p-4 text-xs leading-relaxed text-slate-300">
            <Info size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            <p>Her dış koli barkodu yalnızca bir kez tanımlanır. Koli okutulduğunda ilişkili ürünün tanımlı adedi raflama ve toplama işlemlerinde kullanılır. Mükerrer kayıtlar mevcut kartı değiştirmeden durdurulur.</p>
          </div>
        </div>
        <div className="relative z-10 flex w-full flex-col justify-center gap-3 rounded-[5px] border border-slate-700 bg-slate-800/90 p-4 lg:w-80">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300">Koli Kartı İşlemleri</p>
          <button type="button" onClick={() => setIsExcelDrawerOpen(true)}
            className="flex h-11 items-center justify-center gap-2 rounded-[5px] border border-slate-600 bg-slate-950 px-4 text-xs font-bold text-white hover:bg-slate-700">
            <FileSpreadsheet size={16} aria-hidden="true" /> Excel ile Toplu Ekle
          </button>
          <button type="button" onClick={() => setIsManualDrawerOpen(true)}
            className="flex h-11 items-center justify-center gap-2 rounded-[5px] bg-[#dc3545] px-4 text-xs font-bold text-white hover:bg-red-700">
            <Plus size={16} aria-hidden="true" /> Yeni Koli Kartı
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[5px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase text-slate-500"><Boxes size={16} /> Toplam Koli Kartı</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{boxCount === null ? "..." : boxCount.toLocaleString("tr-TR")}</p>
        </div>
        <div className="rounded-[5px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase text-slate-500"><ShieldCheck size={16} /> Barkod Koruması</p>
          <p className="mt-2 text-sm font-bold text-emerald-700">Benzersiz barkod zorunlu</p>
        </div>
        <div className="rounded-[5px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase text-slate-500"><PackageCheck size={16} /> Ürün İlişkisi</p>
          <p className="mt-2 text-sm font-bold text-slate-800">Tanımlı ürün kartı gerekli</p>
        </div>
      </div>
      {isManualDrawerOpen && (
        <ManualBoxDrawer onClose={() => setIsManualDrawerOpen(false)} onSuccess={handleSuccess} />
      )}
      {isExcelDrawerOpen && (
        <ExcelBoxUploadDrawer onClose={() => setIsExcelDrawerOpen(false)} onSuccess={handleSuccess} />
      )}
    </section>
  );
}
