"use client";

import { useState } from "react";
import ShelvesDashboard from "./_components/ShelvesDashboard";
import ShelvesDragList from "./_components/ShelvesDragList";

export default function ShelvesPage() {
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="flex flex-col min-h-screen gap-6 bg-slate-50 p-4 md:p-6 lg:p-8">
      <ShelvesDashboard 
        selectedBranchId={selectedBranchId} 
        setSelectedBranchId={setSelectedBranchId}
        onShelfAdded={triggerRefresh}
        refreshTrigger={refreshKey}
      />
      
      {/* 
        Gereksiz kart tasarımı ve başlık kaldırıldı. 
        ShelvesDragList zaten kendi şık header'ına sahip. 
        Sadece mt-8 ile üstteki dashboard'dan ayırdık. 
      */}
      {selectedBranchId && (
        <div className="mt-18">
          <ShelvesDragList 
            key={`${selectedBranchId}-${refreshKey}`} 
            branchId={selectedBranchId} 
            onModified={triggerRefresh} 
          />
        </div>
      )}
    </div>
  );
}