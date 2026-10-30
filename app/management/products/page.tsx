"use client";

import { useState } from "react";
import ProductsDashboard from "./_components/ProductsDashboard";
import ProductsTable from "./_components/ProductTable";

export default function ProductsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUpdate = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col min-h-screen gap-6 bg-slate-50 p-4 md:p-6 lg:p-8">
      {/* Üst Kısım: İstatistikler ve Aksiyon Butonları */}
      <ProductsDashboard onUpdate={handleUpdate} />

      {/* Alt Kısım: Akıllı Veri Tablosu */}
      <ProductsTable externalRefresh={refreshKey} />
    </div>
  );
}