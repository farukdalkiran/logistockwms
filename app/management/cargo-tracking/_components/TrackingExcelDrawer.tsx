"use client";

import { useState, useRef } from "react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrackingExcelDrawer({ isOpen, onClose }: DrawerProps) {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Örnek Şablon İndirme Motoru
  const downloadTemplate = () => {
    // Sütun başlıkları (İade kolonu eklendi)
    const headers = "Customer name;1st Mobile number;SD Document;Delivery number;Aras Shipment Number;Aras Tracking Number;İade\n";
    
    // Örnek bir satır verisi (İade default olarak "Hayır")
    const sampleRow = "FARUK DALKIRAN;5551234567;SD100293;DLV9921;SHP882910;40192837461;Hayır\n";
    
    // Türkçe karakter (UTF-8) uyumluluğu için BOM (\uFEFF) ekliyoruz
    const csvContent = "\uFEFF" + headers + sampleRow;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "LOGISTOCK_KARGO_SABLON.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    // TODO: Burada Server Action ile dosyayı Supabase'e yükleme / ayrıştırma işlemi yapılacak
    setTimeout(() => {
      setLoading(false);
      setSelectedFile(null);
      onClose();
    }, 1500);
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      {/* Arka Plan Karartması */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Yan Çekmece */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white border-l-4 border-[#dc3545] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-slate-900 p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <svg className="w-6 h-6 text-[#dc3545]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1h16v-1M12 4v10m-4-4l4 4 4-4"></path></svg>
            <h2 className="font-black uppercase tracking-widest text-sm">EXCEL İLE VERİ YÜKLE</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Şablon İndirme Alanı */}
          <div className="bg-blue-50 border-2 border-blue-500 p-4 mb-6 flex flex-col gap-3">
            <div>
              <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">SİSTEM ŞABLONU</h4>
              <p className="text-xs font-bold text-blue-900 leading-relaxed">
                Yükleyeceğiniz Excel dosyasında sütun isimlerinin sistemle tam eşleşmesi gerekir. <b>İade</b> durumu varsayılan olarak "Hayır" kabul edilir. Hata almamak için aşağıdaki hazır şablonu indirin.
              </p>
            </div>
            <button 
              type="button"
              onClick={downloadTemplate}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] px-4 py-3 uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              ÖRNEK ŞABLONU İNDİR (CSV)
            </button>
          </div>

          <form onSubmit={handleUpload} className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DOSYA SEÇİN (.CSV, .XLSX)</label>
              
              {!selectedFile ? (
                <div className="border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors relative h-32 flex flex-col items-center justify-center gap-2 cursor-pointer group">
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  />
                  <svg className="w-8 h-8 text-slate-400 group-hover:text-[#dc3545] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest group-hover:text-[#dc3545]">SÜRÜKLE VEYA TIKLA</span>
                </div>
              ) : (
                <div className="border-2 border-green-500 bg-green-50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-green-500 p-2 shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-green-900 truncate uppercase">{selectedFile.name}</p>
                      <p className="text-[10px] font-bold text-green-700">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleReset}
                    className="p-2 text-slate-400 hover:text-[#dc3545] transition-colors shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-auto pt-6 border-t-2 border-slate-100">
              <button 
                type="submit" 
                disabled={loading || !selectedFile}
                className="w-full h-14 bg-[#dc3545] hover:bg-red-700 text-white font-black uppercase tracking-widest transition-colors border-2 border-transparent disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500"
              >
                {loading ? "VERİLER İŞLENİYOR..." : "VERİLERİ YÜKLE VE İŞLE"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}