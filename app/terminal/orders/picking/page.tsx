import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";

export default function TerminalOrderPickingPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 md:p-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-orange-600">
          <ScanLine size={16} /> Terminal / Toplama
        </div>
        <h1 className="mt-3 text-2xl font-black text-slate-900">Sipariş Toplama</h1>
        <p className="mt-2 text-sm text-slate-600">
          Bu ekranın barkod okutma ve toplama bileşeni henüz tanımlı değil.
          Eksik bir toplama işlemi başlatmamak için burada veritabanı işlemi yapılmıyor.
        </p>
        <Link href="/terminal/orders" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white">
          <ArrowLeft size={16} /> Sipariş Terminaline Dön
        </Link>
      </section>
    </main>
  );
}
