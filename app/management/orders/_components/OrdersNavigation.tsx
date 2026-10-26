
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, ClipboardCheck, PackagePlus, Shirt, ShoppingBag, Warehouse } from "lucide-react";
import { useWms } from "@/components/providers/WmsSessionProvider";

const common = [
  { href: "/management/orders/products", label: "Ürün Talebi", icon: PackagePlus },
  { href: "/management/orders/apparel", label: "Sarf & Kıyafet", icon: Shirt },
  { href: "/management/orders/myorders", label: "Siparişlerim", icon: ShoppingBag },
];
const warehouse = [
  { href: "/management/orders/approvals", label: "Onay Merkezi", icon: ClipboardCheck },
  { href: "/management/orders/history", label: "İşlem Geçmişi", icon: Archive },
  { href: "/management/orders/store-orders", label: "Depo Talepleri", icon: Warehouse },
];

export default function OrdersNavigation() {
  const pathname = usePathname();
  const session = useWms();
  const isWarehouseManager = ["ADMIN", "DEVELOPER", "ADMNWH"].includes(session.role.toUpperCase());
  const items = isWarehouseManager ? [...common, ...warehouse] : common;
  return (
    <header className="orders-suite__header">
      <div className="orders-suite__identity">
        <span className="orders-suite__mark"><ShoppingBag size={19} /></span>
        <div>
          <p>LOGISTOCK WMS / SİPARİŞ OPERASYONLARI</p>
          <h2>Mağaza & Depo Sipariş Yönetimi</h2>
        </div>
      </div>
      <nav className="orders-suite__tabs" aria-label="Sipariş modülü bölümleri">
        {items.map(({ href, label, icon: Icon }) => {
          const selected = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              aria-current={selected ? "page" : undefined}
              className={"orders-suite__tab" + (selected ? " orders-suite__tab--active" : "")}>
              <Icon size={15} /> <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
