import Link from "next/link";
import { Boxes, Package, ShieldCheck } from "lucide-react";

export default function CatalogNavigation({ active }: { active: "products" | "boxes" }) {
  return (
    <nav aria-label="Katalog yönetimi sayfaları" className="rounded-[5px] border border-slate-200 bg-white px-4 py-3 shadow-sm md:px-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">LogiStock WMS / Envanter</p>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShieldCheck size={16} className="text-emerald-600" aria-hidden="true" />
            Ana veri ve barkod yönetimi
          </div>
        </div>
        <div className="flex rounded-[5px] border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Katalog ekranları">
          <Link href="/management/products" aria-current={active === "products" ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[4px] px-4 py-2 text-xs font-bold transition-colors sm:flex-none ${active === "products" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>
            <Package size={15} aria-hidden="true" /> Ürün Kartları
          </Link>
          <Link href="/management/inventory/boxes" aria-current={active === "boxes" ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[4px] px-4 py-2 text-xs font-bold transition-colors sm:flex-none ${active === "boxes" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>
            <Boxes size={15} aria-hidden="true" /> Koli Barkodları
          </Link>
        </div>
      </div>
    </nav>
  );
}
