import React from "react";
import { getCatalogByClass } from "@/app/actions/orders";
import OrderClientWrapper from "../products/_components/OrderClientWrapper";

export const dynamic = "force-dynamic";

export default async function CommercialOrdersPage() {
  const products = await getCatalogByClass('B2B');

  return (
    <div className="flex flex-col bg-slate-100 min-h-screen">
      <OrderClientWrapper 
        initialProducts={products}
        pageTitle="B2B Ticari Ürün Sipariş Paneli"
        pageSubtitle="Merkez Depo Eş Zamanlı Talep Havuzu"
        storageKey="wms_b2b_cart" 
      />
    </div>
  );
}