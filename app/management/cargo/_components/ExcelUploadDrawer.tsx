"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { uploadArasExcelToServer } from "@/app/actions/excel-upload";

interface ExcelUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
}

export default function ExcelUploadDrawer({ isOpen, onClose, employeeId }: ExcelUploadDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (jsonData.length === 0) {
          setMessage({ text: "Excel dosyası boş veya okunamadı.", type: "error" });
          return;
        }
        
        setFileData(jsonData);
        setMessage({ text: `${jsonData.length} satır veri başarıyla okundu. Yüklemeye hazır.`, type: "success" });
      } catch (err) {
        setMessage({ text: "Dosya formatı desteklenmiyor veya hatalı.", type: "error" });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async () => {
    if (!fileData) return;
    
    setLoading(true);
    setMessage(null);

    try {
      // WMS Kuralı: Next.js serileştirme hatasını aşmak için Deep Clone
      const plainData = JSON.parse(JSON.stringify(fileData));
      const result = await uploadArasExcelToServer(plainData, employeeId);

      if (result.success) {
        setMessage({ text: `${result.count} adet sipariş başarıyla veritabanına aktarıldı.`, type: "success" });
        setFileData(null);
        setTimeout(() => {
          onClose();
          setMessage(null);
        }, 2000);
      } else {
        setMessage({ text: result.error || "Bilinmeyen bir hata oluştu.", type: "error" });
      }
    } catch (error) {
      setMessage({ text: "Veri gönderilirken beklenmeyen bir hata oluştu.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      <div 
        className={`fixed top-0 right-0 h-full w-full md:w-[500px] bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l-4 border-[#dc3545] rounded-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-slate-900 p-6 flex justify-between items-center border-b-2 border-[#dc3545]">
          <div>
            <h2 className="text-xl font-black text-white tracking-widest uppercase">ERP EXCEL AKTARIM</h2>
            <p className="text-sm text-slate-400 mt-1 font-medium">Staging alanına ham veri yükleme.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="bg-white border-2 border-slate-300 rounded-none p-6 shadow-sm mb-6">
            <label className="block text-sm font-black text-slate-800 uppercase tracking-wide mb-4">
              1. Dosya Seçimi (XLSX/CSV)
            </label>
            <div className="relative border-2 border-dashed border-slate-400 p-8 hover:bg-slate-100 transition-colors text-center cursor-pointer group">
               <input 
                 type="file" 
                 accept=".xlsx, .xls, .csv" 
                 onChange={handleFileUpload}
                 disabled={loading}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
               />
               <svg className="mx-auto h-12 w-12 text-slate-400 group-hover:text-[#dc3545] transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
               <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                 SÜRÜKLE VEYA <span className="text-[#dc3545] underline">SEÇ</span>
               </p>
            </div>
          </div>

          {message && (
            <div className={`p-4 text-sm font-bold uppercase tracking-wide shadow-sm mb-6 border-2 ${message.type === "error" ? "bg-red-50 text-red-800 border-red-500" : "bg-green-50 text-green-800 border-green-500"}`}>
              {message.text}
            </div>
          )}

          {fileData && !loading && (
             <div className="bg-slate-200 border-2 border-slate-400 p-4 mb-6">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">VERİ HAZIR</h4>
                <p className="text-xs text-slate-600 font-bold uppercase">{fileData.length} SATIR OKUNDU.</p>
             </div>
          )}
        </div>

        <div className="p-6 bg-slate-200 border-t-2 border-slate-300">
          <button
            onClick={handleSubmit}
            disabled={!fileData || loading}
            className="w-full h-12 bg-[#dc3545] hover:bg-red-700 disabled:bg-slate-400 disabled:border-slate-500 text-white font-black text-lg uppercase tracking-widest border-2 border-red-800 shadow-sm transition-colors flex items-center justify-center gap-2 rounded-none"
          >
            {loading ? "İŞLENİYOR..." : "SİSTEME AKTAR"}
          </button>
        </div>
      </div>
    </>
  );
}