import React from "react";
import { getCommercialProducts } from "@/app/actions/orders";
import OrderClientWrapper from "./_components/OrderClientWrapper";

export default async function CommercialOrdersPage() {
  // Gerçek ürünleri Supabase'den çekiyoruz
  const products = await getCommercialProducts();

  return (
    <div className="flex flex-col bg-gray-100">
      <OrderClientWrapper initialProducts={products} />
    </div>
  );
}