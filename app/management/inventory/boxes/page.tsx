"use client";

import { useState } from "react";
import BoxesDashboard from "./_components/BoxesDashboard";
import BoxesTable from "./_components/BoxesTable";

export default function BoxesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUpdate = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col min-h-screen gap-6 bg-slate-50 p-4 md:p-6 lg:p-8">
      {/* Üst Kısım: İstatistikler ve Aksiyon Butonları */}
      <BoxesDashboard onUpdate={handleUpdate} />

      {/* Alt Kısım: Akıllı Veri Tablosu */}
      <BoxesTable externalRefresh={refreshKey} />
    </div>
  );
}