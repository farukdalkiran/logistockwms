"use client";

import React, { useEffect, useRef, useState } from "react";

interface BarcodeInputProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

export const BarcodeInput: React.FC<BarcodeInputProps> = ({ 
  onScan, 
  placeholder = "Barkod okutunuz...", 
  isLoading = false 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  // ODAK KORUMA MANTIĞI: Personelin ekrana tıklamasına gerek kalmadan cihazı sürekli okumaya hazır tutar.
  useEffect(() => {
    const enforceFocus = () => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        const activeTag = document.activeElement?.tagName;
        // Başka bir input veya textarea'ya bilerek tıklanmadıysa odağı geri çal
        if (activeTag !== "INPUT" && activeTag !== "TEXTAREA") {
           inputRef.current.focus();
        }
      }
    };

    // Tıklama ve dokunma olaylarında odağı denetle
    document.addEventListener("click", enforceFocus);
    document.addEventListener("touchend", enforceFocus);
    
    // Donanımsal gecikmeleri önlemek için periyodik kontrol
    const interval = setInterval(enforceFocus, 1000);

    // İlk yüklemede odaklan
    if (inputRef.current) {
        inputRef.current.focus();
    }

    return () => {
      document.removeEventListener("click", enforceFocus);
      document.removeEventListener("touchend", enforceFocus);
      clearInterval(interval);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Endüstriyel okuyucular barkod sonuna 'Enter' (Carriage Return) ekler.
    if (e.key === "Enter") {
      e.preventDefault();
      const scannedValue = value.trim();
      if (scannedValue !== "") {
        onScan(scannedValue); // Üst bileşene tetikleme gönder
        setValue(""); // Hızlı ardışık okumalar için inputu anında temizle
      }
    }
  };

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
        {/* Barkod İkonu - İşlem sırasında #dc3545 rengine döner */}
        <svg 
          className={`w-6 h-6 transition-colors duration-200 ${isLoading ? 'text-[#dc3545]' : 'text-gray-400'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      </div>
      
      <input
        ref={inputRef}
        type="text"
        className="block w-full p-5 pl-14 text-lg font-bold text-white bg-[#1c2030] border-2 border-gray-700 rounded-2xl focus:ring-0 focus:border-[#dc3545] outline-none transition-all shadow-inner placeholder-gray-500"
        placeholder={isLoading ? "İşleniyor..." : placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />
      
      {isLoading && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-5">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#dc3545]"></div>
        </div>
      )}
    </div>
  );
};