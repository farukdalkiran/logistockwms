import Link from "next/link";
import { ArrowRight, ClipboardList, PackageCheck } from "lucide-react";

export default function TerminalOrdersPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <span className="text-xs font-bold uppercase tracking-wide text-orange-600">WMS / Terminal</span>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Sipariş İşlemleri</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sipariş yönetimi için yetkili yönetim panelini kullanabilirsiniz. Terminal sipariş toplama ekranı bu rotada henüz yapılandırılmamış.
        </p>
        <Link href="/management/orders/approvals" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white">
          <ClipboardList size={18} /> Sipariş Yönetimi <ArrowRight size={16} />
        </Link>
      </div>
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
        <PackageCheck className="mr-2 inline-block" size={18} />
        Sipariş toplama motoru etkinleştirildiğinde bu bağlantı operasyon ekranına yönlendirilebilir.
      </div>
    </main>
  );
}
