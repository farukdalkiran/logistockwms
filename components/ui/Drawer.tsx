"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Drawer({ title, onClose, children }: DrawerProps) {
  // ESC tuşu ile çekmeceyi kapatabilme kolaylığı (Operasyonel hız için)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Arka plan karartması (Tıklayınca da kapanır) */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Sağdan açılan panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Üst Başlık ve Kapatma Butonu */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-500 hover:text-[#dc3545] hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* İçerik Alanı (Formlar, Excel Yükleme vb. buraya gelir) */}
        <div className="flex-1 overflow-y-auto bg-white">
          {children}
        </div>

      </div>
    </div>
  );
}