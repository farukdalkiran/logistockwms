"use client";

import { useState } from "react";
import CatalogNavigation from "@/components/wms/CatalogNavigation";
import ProductsDashboard from "./_components/ProductsDashboard";
import ProductsTable from "./_components/ProductTable";

export default function ProductsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUpdate = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-50 p-4 md:gap-5 md:p-6 lg:p-8">
      <CatalogNavigation active="products" />
      <ProductsDashboard onUpdate={handleUpdate} />
      <ProductsTable externalRefresh={refreshKey} />
    </div>
  );
}