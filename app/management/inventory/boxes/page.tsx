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
    <div className="wms-page">
      {/* Üst Kısım: İstatistikler ve Aksiyon Butonları */}
      <BoxesDashboard onUpdate={handleUpdate} />

      {/* Alt Kısım: Akıllı Veri Tablosu */}
      <BoxesTable externalRefresh={refreshKey} />
    </div>
  );
}