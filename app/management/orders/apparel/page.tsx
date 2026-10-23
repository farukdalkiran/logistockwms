import React from "react";
import { getCatalogByClass } from "@/app/actions/orders";
import OrderClientWrapper from "../products/_components/OrderClientWrapper"; // Doğru yoldan çağırıldığından emin ol

export const dynamic = "force-dynamic";

export default async function ApparelOrdersPage() {
  // Veritabanındaki 'products' tablosunda item_class değeri 'APPAREL' olanları çeker.
  const products = await getCatalogByClass('APPAREL');

  return (
    <div className="flex flex-col bg-slate-100 min-h-screen">
      <OrderClientWrapper 
        initialProducts={products} // HATA BURADAYDI: initialItems yerine initialProducts yazıldı
        pageTitle="Mağaza Sarf Malzeme & Personel Kıyafet Talebi"
        pageSubtitle="Mağaza İçi Kullanım ve Personel Kotası"
        storageKey="wms_apparel_cart"
      />
    </div>
  );
}