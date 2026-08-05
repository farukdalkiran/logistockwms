"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { uploadArasExcelToServer } from "@/app/actions/excel-upload";
import { FileSpreadsheet, X, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";

interface ExcelUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
}

export default function ExcelUploadDrawer({ isOpen, onClose, employeeId }: ExcelUploadDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string>(""); // YENİ: Dosya/Profil Adı State'i
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    
    // Dosya adını uzantıdan (.xlsx, .csv) temizleyerek otomatik State'e yaz
    const rawName = file.name.replace(/\.[^/.]+$/, "");
    setFileName(rawName);

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
        setMessage({ text: `${jsonData.length} satır veri başarıyla okundu.`, type: "success" });
      } catch (err) {
        setMessage({ text: "Dosya formatı desteklenmiyor veya hatalı.", type: "error" });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async () => {
    if (!fileData || !fileName.trim()) {
      setMessage({ text: "Lütfen bir dosya seçin ve profil adını girin.", type: "error" });
      return;
    }
    
    setLoading(true);
    setMessage(null);

    try {
      // WMS Kuralı: Next.js serileştirme hatasını aşmak için Deep Clone
      const plainData = JSON.parse(JSON.stringify(fileData));
      
      // DİKKAT: Backend'e artık fileName parametresi de gönderiliyor
      const result = await uploadArasExcelToServer(plainData, employeeId, fileName.trim().toUpperCase());

      if (result.success) {
        setMessage({ text: `${result.count} adet sipariş "${fileName.toUpperCase()}" profiliyle aktarıldı.`, type: "success" });
        setTimeout(() => {
          handleReset();
          onClose();
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

  const handleReset = () => {
    setFileData(null);
    setFileName("");
    setMessage(null);
  };

  return (
    <>
      {/* KARARTMA (BACKDROP) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
          onClick={loading ? undefined : onClose}
        />
      )}

      {/* DRAWER PANELİ */}
      <div 
        className={`fixed top-0 right-0 h-full w-full md:w-[500px] bg-slate-50 shadow-[-12px_0_30px_rgba(0,0,0,0.3)] z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l-8 border-[#dc3545] rounded-none font-['Quicksand'] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="bg-slate-900 p-6 flex justify-between items-center border-b-4 border-[#dc3545] shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-widest uppercase leading-none">ERP BATCH YÜKLEME</h2>
              <p className="text-[11px] text-slate-400 mt-1.5 font-bold uppercase tracking-widest font-mono">Staging Ham Veri Aktarımı</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="text-slate-400 hover:text-[#dc3545] transition-colors p-2 disabled:opacity-50">
            <X strokeWidth={3} className="w-6 h-6" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          
          {/* DURUM MESAJI */}
          {message && (
            <div className={`p-4 flex items-start gap-3 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] border-2 rounded-none animate-in slide-in-from-top-2 ${message.type === "error" ? "bg-red-50 border-[#dc3545] text-[#dc3545]" : "bg-emerald-50 border-emerald-500 text-emerald-700"}`}>
              {message.type === "error" ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
              <span className="text-xs font-black uppercase tracking-wider leading-relaxed">{message.text}</span>
            </div>
          )}

          {/* ADIM 1: DOSYA SEÇİMİ */}
          <div className="bg-white border-2 border-slate-300 rounded-none p-6 shadow-[6px_6px_0px_#e2e8f0]">
            <label className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-l-4 border-[#dc3545] pl-2">
              1. BATCH DOSYASI (XLSX / CSV)
            </label>
            
            {!fileData ? (
              <div className="relative border-2 border-dashed border-slate-400 bg-slate-50 p-8 hover:bg-slate-100 hover:border-slate-500 transition-colors text-center cursor-pointer group">
                 <input 
                   type="file" 
                   accept=".xlsx, .xls, .csv" 
                   onChange={handleFileUpload}
                   disabled={loading}
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                 />
                 <UploadCloud className="mx-auto h-12 w-12 text-slate-400 group-hover:text-[#dc3545] transition-colors mb-3" strokeWidth={1.5} />
                 <p className="text-sm font-black text-slate-700 uppercase tracking-wider">
                   SÜRÜKLE VEYA <span className="text-[#dc3545] underline underline-offset-4">BİLGİSAYARDAN SEÇ</span>
                 </p>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 font-mono">Max: 10 MB - Aras Şablonu</p>
              </div>
            ) : (
              <div className="bg-emerald-50 border-2 border-emerald-500 p-4 flex items-center justify-between shadow-inner">
                 <div className="flex items-center gap-3 min-w-0">
                   <div className="bg-emerald-500 text-white p-1.5"><CheckCircle2 className="w-4 h-4" /></div>
                   <div className="min-w-0">
                     <p className="text-xs font-black text-emerald-900 uppercase tracking-widest truncate font-mono">{fileData.length} SATIR OKUNDU</p>
                     <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mt-0.5 truncate">Belleğe Alındı</p>
                   </div>
                 </div>
                 <button onClick={handleReset} disabled={loading} className="text-[10px] font-black uppercase text-[#dc3545] hover:underline underline-offset-2 tracking-widest">DEĞİŞTİR</button>
              </div>
            )}
          </div>

          {/* ADIM 2: DOSYA (PROFİL) İSMİNİ BELİRLE */}
          {fileData && (
            <div className="bg-white border-2 border-slate-300 rounded-none p-6 shadow-[6px_6px_0px_#e2e8f0] animate-in fade-in slide-in-from-bottom-4">
              <label className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-l-4 border-[#dc3545] pl-2">
                2. ÇALIŞMA PROFİLİ ADI
              </label>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 leading-relaxed">
                Bu kayıtlar sisteme hangi isimle (Batch) kaydedilsin? Daha sonra Terminal ekranında bu ismi seçeceksiniz.
              </p>
              <input 
                type="text" 
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                disabled={loading}
                className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-black font-mono text-slate-900 focus:outline-none focus:border-[#dc3545] uppercase shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)]"
                placeholder="ÖRNEK: SABAH_SEVKİYATI_1"
                autoComplete="off"
              />
            </div>
          )}
        </div>

        {/* FOOTER AKSİYONU */}
        <div className="p-6 bg-slate-200 border-t-4 border-slate-300 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!fileData || !fileName.trim() || loading}
            className="w-full h-14 bg-[#dc3545] hover:bg-red-700 disabled:bg-slate-300 disabled:border-slate-400 disabled:text-slate-500 text-white font-black text-base uppercase tracking-widest border-2 border-red-800 shadow-[6px_6px_0px_rgba(220,53,69,0.3)] disabled:shadow-none transition-all active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-3 rounded-none"
          >
            {loading ? (
              <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> YÜKLENİYOR...</span>
            ) : (
              <><UploadCloud className="w-5 h-5" strokeWidth={2.5}/> VERİTABANINA AKTAR</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}