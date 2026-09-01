"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

interface UploadPanelProps {
  onUploadComplete: () => void;
}

interface ValidatedData {
  customer_name: string;
  mobile_number: string;
  sd_document: string;
  delivery_number: string;
  aras_shipment_number: string;
  aras_tracking_number: string;
  is_returned: boolean;
  item_count: number; // YENİ: Kalem Sayısı
}

interface InvalidRow {
  rowNumber: number;
  reason: string;
}

export default function TrackingUploadPanel({ onUploadComplete }: UploadPanelProps) {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [validData, setValidData] = useState<ValidatedData[]>([]);
  const [invalidData, setInvalidData] = useState<InvalidRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, isUploading: false });

  const downloadTemplate = () => {
    const headers = "Customer name;1st Mobile number;SD Document;Delivery number;Aras Shipment Number;Aras Tracking Number;İade\n";
    const sampleRow = "FARUK DALKIRAN;5551234567;SD100293;DLV9921;SHP882910;40192837461;Hayır\n";
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

  const downloadErrorLog = () => {
    if (invalidData.length === 0) return;
    const headers = "Excel Satir No;Hata Nedeni\n";
    const rows = invalidData.map(err => `${err.rowNumber};${err.reason}`).join("\n");
    const csvContent = "\uFEFF" + headers + rows;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "LOGISTOCK_HATALI_SATIRLAR.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setValidData([]);
    setInvalidData([]);
    setCurrentPage(1);
    setUploadProgress({ current: 0, total: 0, isUploading: false });
  };

  // Telefon Numarası Formatlayıcı
  const formatPhoneNumber = (phone: any): string => {
    if (!phone) return "";
    const strPhone = phone.toString().trim();
    const indexOf5 = strPhone.indexOf('5');
    if (indexOf5 !== -1) {
      return strPhone.substring(indexOf5);
    }
    return strPhone.replace(/^0+/, '');
  };

  // EXCEL OKUMA VE BİRLEŞTİRME (AGGREGATION) MOTORU
  const handleProcessFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

      const invalid: InvalidRow[] = [];
      const aggregatedMap = new Map<string, any>(); // SD Document'a göre birleştirme haritası

      // 1. Excel'i oku, Hataları ayıkla ve Yinelenenleri Birleştir
      jsonData.forEach((row, index) => {
        const rowNum = index + 2; 
        const sdDoc = row["SD Document"]?.toString().trim();
        const delNo = row["Delivery number"]?.toString().trim();

        if (!sdDoc || !delNo) {
          invalid.push({ rowNumber: rowNum, reason: "SD Document veya Delivery Number eksik." });
          return;
        }

        // Eğer SD Document daha önce eklendiyse (Mükerrerlik durumu)
        if (aggregatedMap.has(sdDoc)) {
          const existing = aggregatedMap.get(sdDoc);
          
          // Hem SD Doc hem de Delivery aynıysa -> Bu bir kalem/ürün yinelemesidir, adet artır.
          if (existing.delivery_number === delNo) {
            existing.item_count += 1;
          } else {
            // SD Doc aynı ama Delivery farklı -> Kural ihlali! SD Document benzersiz olmalı.
            invalid.push({ rowNumber: rowNum, reason: `Çakışma: SD Document (${sdDoc}) daha önce farklı bir Delivery Number ile kullanılmış.` });
          }
        } else {
          // İlk kez karşılaşılan SD Document -> Map'e ekle
          aggregatedMap.set(sdDoc, {
            rowNumber: rowNum, // Hata fırlatmak gerekirse satır nosunu tut
            customer_name: row["Customer name"]?.toString().trim() || "",
            mobile_number: formatPhoneNumber(row["1st Mobile number"]),
            sd_document: sdDoc,
            delivery_number: delNo,
            aras_shipment_number: row["Aras Shipment Number"]?.toString().trim() || "",
            aras_tracking_number: row["Aras Tracking Number"]?.toString().trim() || "",
            is_returned: row["İade"]?.toString().trim().toLowerCase() === "evet",
            item_count: 1 // Başlangıçta 1 Kalem
          });
        }
      });

      // 2. Birleştirilmiş SD Document'ları Supabase veritabanında kontrol et
      const extractedSdDocuments = Array.from(aggregatedMap.keys());
      const existingDbSdDocs = new Set<string>();
      const chunkSize = 200;
      
      for (let i = 0; i < extractedSdDocuments.length; i += chunkSize) {
        const chunk = extractedSdDocuments.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;

        const { data: existingData, error } = await supabase
          .from("cargo_records")
          .select("sd_document")
          .in("sd_document", chunk);

        if (!error && existingData) {
          existingData.forEach(record => existingDbSdDocs.add(record.sd_document));
        }
      }

      // 3. Veritabanı Mükerrer Kontrolü ve Son Geçerli Listeyi (ValidData) Oluşturma
      const valid: ValidatedData[] = [];
      Array.from(aggregatedMap.values()).forEach((item) => {
        if (existingDbSdDocs.has(item.sd_document)) {
          invalid.push({ rowNumber: item.rowNumber, reason: `Mükerrer Veri: SD Document (${item.sd_document}) veritabanında zaten kayıtlı.` });
        } else {
          // Veritabanında yoksa güvenli şekilde sisteme yazılacak listeye al
          valid.push({
            customer_name: item.customer_name,
            mobile_number: item.mobile_number,
            sd_document: item.sd_document,
            delivery_number: item.delivery_number,
            aras_shipment_number: item.aras_shipment_number,
            aras_tracking_number: item.aras_tracking_number,
            is_returned: item.is_returned,
            item_count: item.item_count
          });
        }
      });

      setValidData(valid);
      setInvalidData(invalid);
      setCurrentPage(1);
      setShowConfirmModal(true);

    } catch (error) {
      console.error("Excel okuma hatası:", error);
      alert("Dosya okunamadı veya veritabanı kontrolü yapılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const executeUpload = async () => {
    if (validData.length === 0) return;

    setUploadProgress({ current: 0, total: validData.length, isUploading: true });
    const CHUNK_SIZE = 500; 

    try {
      for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
        const chunk = validData.slice(i, i + CHUNK_SIZE);
        // Supabase bulk insert (item_count kolonu ile birlikte gidecek)
        const { error } = await supabase.from("cargo_records").insert(chunk);
        
        if (error) throw error;
        
        await new Promise(resolve => setTimeout(resolve, 300));
        setUploadProgress(prev => ({ ...prev, current: Math.min(i + CHUNK_SIZE, validData.length) }));
      }

      setShowConfirmModal(false);
      handleReset();
      onUploadComplete(); 

    } catch (error: any) {
      console.error("Yükleme hatası:", error);
      alert("Veritabanına yazarken bir hata oluştu: " + error.message);
    } finally {
      setUploadProgress(prev => ({ ...prev, isUploading: false }));
    }
  };

  const totalPages = Math.ceil(validData.length / rowsPerPage);
  const paginatedData = validData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="w-full bg-white border-2 border-slate-300 shadow-[4px_4px_0px_#e2e8f0] p-6 lg:p-10 flex flex-col gap-8 animate-in fade-in duration-300 relative">
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">
        {/* SOL KOLON: BİLGİLENDİRME VE ŞABLON */}
        <div className="flex flex-col gap-6">
          
          <div className="bg-slate-50 border-2 border-slate-200 p-5">
            <div className="flex items-start gap-4 mb-5 border-b-2 border-slate-200 pb-5">
              <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 border-4 border-slate-800 bg-slate-900 overflow-hidden">
                <img 
                  src="https://i.giphy.com/l4q8jaqercFIbYdhu.webp" 
                  alt="Data Processing" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-[#dc3545] text-white p-1 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-widest truncate">SİSTEM TALİMATLARI</h2>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-slate-600 leading-relaxed">
                  Yükleyeceğiniz belgede eşleşme sorunları yaşamamak için <b>aşağıdaki 7 kolonun</b> eksiksiz bulunması zorunludur:
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {["Customer name", "1st Mobile number", "SD Document", "Delivery number", "Aras Shipment Number", "Aras Tracking Number", "İade"].map((col, i) => (
                <span key={i} className="bg-white border border-slate-300 text-slate-700 px-2 py-1 text-[10px] font-black tracking-widest uppercase shadow-sm">
                  {col}
                </span>
              ))}
            </div>

            <ul className="flex flex-col gap-2 border-t-2 border-slate-100 pt-4">
              <li className="text-xs font-black text-slate-700 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#dc3545] shrink-0"></span> Aynı <b>SD Document</b> ve <b>Delivery Numarasına</b> sahip satırlar birleştirilip "Kalem Sayısı" olarak kaydedilir.</li>
              <li className="text-xs font-black text-slate-700 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-slate-500 shrink-0"></span> Telefon numaralarındaki alan kodları (Örn: 0, +90) atılarak sisteme saf format kaydedilir.</li>
              <li className="text-xs font-black text-slate-700 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-[#dc3545] shrink-0"></span> İade durumu varsayılan olarak "Hayır" kabul edilir.</li>
            </ul>
          </div>

          <button 
            type="button"
            onClick={downloadTemplate}
            className="w-full h-14 bg-blue-50 border-2 border-blue-600 hover:bg-blue-600 text-blue-700 hover:text-white font-black text-[11px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            RESMİ ŞABLONU İNDİR (CSV)
          </button>
        </div>

        {/* SAĞ KOLON: DOSYA YÜKLEME ALANI */}
        <form onSubmit={handleProcessFile} className="flex flex-col gap-6 h-full">
          <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-4">
            <div className="bg-slate-900 text-white p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            </div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">GÜVENLİ DOSYA YÜKLEME</h2>
          </div>

          <div className="flex flex-col gap-2 flex-1">
            {!selectedFile ? (
              <div className="border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors relative h-full min-h-[200px] flex flex-col items-center justify-center gap-3 cursor-pointer group">
                <input 
                  ref={fileInputRef}
                  type="file" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                />
                <svg className="w-12 h-12 text-slate-300 group-hover:text-[#dc3545] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span className="text-sm font-black text-slate-400 uppercase tracking-widest group-hover:text-[#dc3545]">SÜRÜKLE VEYA TIKLA</span>
              </div>
            ) : (
              <div className="border-2 border-green-500 bg-green-50 p-6 flex items-center justify-between h-full min-h-[200px]">
                <div className="flex flex-col items-center justify-center w-full gap-4">
                  <div className="bg-green-500 p-4 rounded-full">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-black text-green-900 truncate uppercase mb-1">{selectedFile.name}</p>
                    <p className="text-xs font-bold text-green-700 bg-green-200 inline-block px-2 py-1 rounded">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <button type="button" onClick={handleReset} className="mt-2 text-[10px] font-black text-[#dc3545] uppercase tracking-widest hover:underline">
                    İPTAL ET VE BAŞKA DOSYA SEÇ
                  </button>
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading || !selectedFile}
            className="w-full h-16 bg-slate-900 hover:bg-[#dc3545] text-white font-black text-sm uppercase tracking-widest transition-colors border-2 border-transparent disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> BİRLEŞTİRİLİYOR...</>
            ) : "VERİLERİ BİRLEŞTİR VE İNCELE"}
          </button>
        </form>
      </div>

      {/* POP-UP ONAY VE VERİ İNCELEME EKRANI (MODAL) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/95 p-4 backdrop-blur-sm transition-all">
          <div className="bg-white border-4 border-[#dc3545] shadow-2xl w-full max-w-6xl rounded-none flex flex-col h-[90vh] animate-in zoom-in-95 duration-200">
            
            <div className="bg-[#dc3545] p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                <h2 className="text-white font-black uppercase tracking-widest text-lg">VERİ ONAY VE AYIKLAMA MERKEZİ</h2>
              </div>
              {!uploadProgress.isUploading && (
                <button onClick={() => setShowConfirmModal(false)} className="text-white hover:text-slate-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex flex-col gap-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border-2 border-green-500 p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="block text-3xl font-black text-green-600 leading-none mb-1">{validData.length}</span>
                    <span className="text-[10px] font-black text-green-800 uppercase tracking-widest">BİRLEŞTİRİLMİŞ GEÇERLİ KAYIT</span>
                  </div>
                  <svg className="w-10 h-10 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <div className="bg-white border-2 border-[#dc3545] p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="block text-3xl font-black text-[#dc3545] leading-none mb-1">{invalidData.length}</span>
                    <span className="text-[10px] font-black text-red-800 uppercase tracking-widest">HATALI / EKSİK (DIŞLANAN)</span>
                  </div>
                  <svg className="w-10 h-10 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
              </div>

              {invalidData.length > 0 && (
                <div className="bg-red-50 border-l-4 border-[#dc3545] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0 pr-4">
                    <h3 className="text-sm font-black text-[#dc3545] uppercase tracking-widest mb-1">DİKKAT: KAYITLAR DIŞLANDI</h3>
                    <p className="text-xs font-bold text-red-900">Mükerrer SD Document veya eksik verili {invalidData.length} kayıt veritabanına <u>yazılmayacaktır</u>. Hatalı kayıtları excel olarak indirip sebebiyle birlikte görebilirsiniz.</p>
                  </div>
                  <button onClick={downloadErrorLog} className="shrink-0 w-full sm:w-auto bg-[#dc3545] hover:bg-red-700 text-white px-4 py-3 sm:py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    HATALARI İNDİR (CSV)
                  </button>
                </div>
              )}

              {validData.length > 0 && (
                <div className="bg-white border-2 border-slate-300 shadow-sm flex-1 flex flex-col min-h-0">
                  <div className="bg-slate-100 border-b-2 border-slate-300 p-3 flex justify-between items-center shrink-0">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">SİSTEME YAZILACAK VERİLER (ÖNİZLEME)</span>
                    <span className="text-[10px] font-bold text-slate-500 font-mono">Sayfa {currentPage} / {totalPages}</span>
                  </div>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Müşteri</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Telefon</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">SD Document</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Delivery No</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Takip No</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Adet / Kalem</th>
                          <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">İade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2 text-xs font-bold text-slate-800 truncate max-w-[150px]">{row.customer_name || "-"}</td>
                            <td className="px-4 py-2 text-xs font-mono font-bold text-slate-600">{row.mobile_number || "-"}</td>
                            <td className="px-4 py-2 text-xs font-mono font-black text-slate-900">{row.sd_document}</td>
                            <td className="px-4 py-2 text-xs font-black text-slate-800">{row.delivery_number}</td>
                            <td className="px-4 py-2 text-xs font-mono text-[#dc3545] font-bold">{row.aras_tracking_number || "-"}</td>
                            
                            {/* KALEM SAYISI KUTUCUĞU */}
                            <td className="px-4 py-2 text-center">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black font-mono shadow-sm border ${
                                row.item_count > 1 ? "bg-slate-900 text-white border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                {row.item_count}
                              </span>
                            </td>

                            <td className="px-4 py-2 text-center">
                              {row.is_returned ? 
                                <span className="bg-orange-100 text-orange-800 px-2 py-0.5 text-[9px] font-black uppercase border border-orange-200">EVET</span> : 
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 text-[9px] font-black uppercase border border-slate-200">HAYIR</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="bg-slate-50 border-t-2 border-slate-200 p-2 flex justify-end gap-2 shrink-0">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || uploadProgress.isUploading}
                      className="px-4 py-1.5 bg-white border border-slate-300 text-[10px] font-black text-slate-700 uppercase disabled:opacity-50 transition-colors hover:bg-slate-100"
                    >ÖNCEKİ</button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || uploadProgress.isUploading}
                      className="px-4 py-1.5 bg-white border border-slate-300 text-[10px] font-black text-slate-700 uppercase disabled:opacity-50 transition-colors hover:bg-slate-100"
                    >SONRAKİ</button>
                  </div>
                </div>
              )}

              {uploadProgress.isUploading && (
                <div className="w-full bg-slate-200 h-8 relative overflow-hidden border-2 border-slate-300 shrink-0 shadow-inner">
                  <div 
                    className="bg-green-500 h-full transition-all duration-300 flex items-center justify-end pr-2 overflow-hidden" 
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  >
                    <div className="absolute inset-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress_1s_linear_infinite]" />
                  </div>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-900 mix-blend-overlay tracking-widest z-10">
                    {uploadProgress.current} / {uploadProgress.total} KAYIT BİRLEŞTİRİLİP AKTARILIYOR...
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t-4 border-slate-300 flex gap-4 shrink-0">
              <button 
                onClick={executeUpload}
                disabled={uploadProgress.isUploading || validData.length === 0}
                className="flex-1 bg-slate-900 hover:bg-[#dc3545] text-white h-14 font-black uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {uploadProgress.isUploading ? (
                  <><svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> VERİTABANINA YAZILIYOR</>
                ) : (
                  <>BİRLEŞTİRİLEN VERİLERİ YAZ ({validData.length} BİLEŞİK KAYIT)</>
                )}
              </button>
              <button 
                onClick={() => setShowConfirmModal(false)}
                disabled={uploadProgress.isUploading}
                className="w-32 bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-700 font-black h-14 uppercase tracking-widest transition-colors disabled:opacity-50"
              >
                İPTAL
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress {
          0% { background-position: 1rem 0; }
          100% { background-position: 0 0; }
        }
      `}} />
    </div>
  );
}