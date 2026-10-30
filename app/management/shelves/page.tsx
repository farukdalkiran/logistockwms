"use client";

import { useState } from "react";
import ShelvesDashboard from "./_components/ShelvesDashboard";
import ShelvesDragList from "./_components/ShelvesDragList";

export default function ShelvesPage() {
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="wms-page">
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
        <div className="mt-4">
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