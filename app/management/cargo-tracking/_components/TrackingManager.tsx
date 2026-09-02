"use client";

import { useState } from "react";
import TrackingDashboard from "./TrackingDashboard";
import TrackingTable from "./TrackingTable";
import TrackingUploadPanel from "./TrackingUploadPanel";
import ArasTimelineModal from "./ArasTimelineModal";
import ArasTrackingPanel from "../../cargo/_components/ArasTrackingPanel"; 

type TabType = "DASHBOARD" | "PROCESS" | "SEARCH" | "UPLOAD";

interface ManagerProps {
  employeeId?: string; 
}

export default function TrackingManager({ employeeId = "00000" }: ManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("DASHBOARD");
  const [activeTrackingNo, setActiveTrackingNo] = useState<string | null>(null);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const tabs = [
    { id: "DASHBOARD", label: "PANEL", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
    { id: "PROCESS", label: "BARKOD İŞLEME", icon: "M12 4v16m8-8H4" },
    { id: "SEARCH", label: "SORGULAMA", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
    { id: "UPLOAD", label: "EXCEL YÜKLEME", icon: "M4 16v1h16v-1M12 4v10m-4-4l4 4 4-4" }
  ];

  return (
    <div className="w-full px-4 mx-auto flex flex-col text-slate-900 pb-12 font-['Quicksand'] bg-slate-50 min-h-screen shadow-2xl rounded-none">

      {/* 1. KESKİN VE KOYU HEADER */}
      <div className="w-full bg-slate-900 border-t-4 border-[#03DF95] p-6 lg:p-8 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-none">
        {/* Dekoratif Endüstriyel Işık */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#03DF95]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="flex items-center gap-6 relative z-10">
          {/* KÖŞELİ VE BÜYÜK GIF ALANI */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-black rounded-4xl border-2 border-slate-700 shadow-[4px_4px_0px_#03DF95] shrink-0 p-1 flex items-center justify-center overflow-hidden">
            <img 
              src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWJieW94cmgyMXM4bXF2ZWNnNnB6b2dxYm9yMGh0c2dydXp6NW1xdCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/VseXvvxwowwCc/giphy.gif" 
              alt="System Active" 
              className="w-full h-full object-cover opacity-90 mix-blend-screen" 
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-sm truncate">
              EKSİK PARÇA <span className="text-[#03DF95]">YÖNETİMİ</span>
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest truncate">
              WMS B2C ENTEGRASYON VE KONTROL AĞI
            </p>
          </div>
        </div>
      </div>

      {/* 2. ENDÜSTRİYEL MENÜ BARI (SEKMELER) */}
      <div className="w-full bg-slate-900 border-b-4 border-slate-800 flex flex-col sm:flex-row shadow-md relative z-20">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`flex-1 h-14 px-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest transition-all rounded-none border-r border-slate-800 last:border-r-0 ${
                isActive 
                  ? "bg-slate-800 text-[#03DF95] shadow-[inset_0px_-4px_0px_#03DF95]" 
                  : "bg-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d={tab.icon}></path>
              </svg>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. İÇERİK ALANI */}
      <div className="w-full min-w-0 py-4 lg:py-6  bg-slate-50">
        {activeTab === "DASHBOARD" && (
          <div className="animate-in fade-in duration-300 ease-out">
            <TrackingDashboard onNavigate={(tab) => handleTabChange(tab)} />
          </div>
        )}
        {activeTab === "PROCESS" && (
          <div className="animate-in fade-in duration-300 ease-out bg-white border-2 border-slate-200 shadow-[4px_4px_0px_#e2e8f0] p-4 sm:p-6 rounded-none">
            <ArasTrackingPanel employeeId={employeeId} /> 
          </div>
        )}
        {activeTab === "SEARCH" && (
          <div className="animate-in fade-in duration-300 ease-out">
            {/* onTrackClick Vercel hatası düzeltmesi için TrackingTable'ın kendisinde handle edilecek */}
            <TrackingTable />
          </div>
        )}
        {activeTab === "UPLOAD" && (
          <div className="animate-in fade-in duration-300 ease-out">
            <TrackingUploadPanel onUploadComplete={() => handleTabChange("SEARCH")} />
          </div>
        )}
      </div>

      {/* ARAS ZAMAN ÇİZELGESİ POP-UP MODALI */}
      {activeTrackingNo && (
        <ArasTimelineModal 
          trackingNo={activeTrackingNo} 
          onClose={() => setActiveTrackingNo(null)} 
        />
      )}
    </div>
  );
}