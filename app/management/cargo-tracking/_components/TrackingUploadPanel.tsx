"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Trash2, 
  AlertTriangle 
} from "lucide-react";

interface UploadPanelProps {
  onUploadComplete: () => void;
}

interface ParsedRow {
  rowNumber: number;
  customer_name: string;
  mobile_number: string;
  sd_document: string;
  delivery_number: string;
  aras_shipment_number: string;
  aras_tracking_number: string;
  is_returned: boolean;
  item_count: number;
  isValid: boolean;
  errorReasons: string[];
  missing_address: boolean; // Veritabanı ile eşleşen doğru isim
}

export default function TrackingUploadPanel({ onUploadComplete }: UploadPanelProps) {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [validData, setValidData] = useState<ParsedRow[]>([]);
  const [invalidData, setInvalidData] = useState<ParsedRow[]>([]);
  
  const [activeTab, setActiveTab] = useState<"VALID" | "INVALID">("VALID");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;
  
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, isUploading: false });

  const downloadTemplate = () => {
    const headers = "Customer name;1st Mobile number;SD Document;Delivery number;Aras Shipment Number;Aras Tracking Number;İade;Eksik Adres\n";
    const sampleRow = "FARUK DALKIRAN;5551234567;T555555;4000000;6666666666;999999999;Hayır;Hayır\n";
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

  const handleReset = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setValidData([]);
    setInvalidData([]);
    setActiveTab("VALID");
    setCurrentPage(1);
    setUploadProgress({ current: 0, total: 0, isUploading: false });
  };

  const formatLargeNumber = (val: any): string => {
    if (val === null || val === undefined || val === "") return "";
    
    if (typeof val === 'number') {
      try {
        return BigInt(val).toString();
      } catch {
        return String(val).trim();
      }
    }
    
    return String(val).trim();
  };

  const formatPhoneNumber = (phone: any): string => {
    if (!phone) return "";
    const strPhone = formatLargeNumber(phone);
    const indexOf5 = strPhone.indexOf('5');
    if (indexOf5 !== -1) return strPhone.substring(indexOf5);
    return strPhone.replace(/^0+/, '');
  };

  const handleProcessFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { raw: true, defval: "" });

      const missingDocs: ParsedRow[] = [];
      const aggregatedMap = new Map<string, ParsedRow>();

      jsonData.forEach((row, index) => {
        const rowNum = index + 2; 
        
        let sdDoc = formatLargeNumber(row["SD Document"]);
        const delNo = formatLargeNumber(row["Delivery number"]);
        const shipmentNo = formatLargeNumber(row["Aras Shipment Number"] || row["Shipment number"]);
        const trackingNo = formatLargeNumber(row["Aras Tracking Number"] || row["Aras Kargo Takip No"]);
        
        const excelMissingStatus = row["Eksik Adres"]?.toString().trim().toLowerCase() === "evet";
        const hasLetter = /[a-zA-ZçğöşüıÇĞÖŞÜİ]/i;
        const isMissingAddress = excelMissingStatus || hasLetter.test(trackingNo) || hasLetter.test(shipmentNo) || (trackingNo === "" && shipmentNo === "");

        const parsedRow: ParsedRow = {
          rowNumber: rowNum,
          customer_name: row["Customer name"]?.toString().trim() || "",
          mobile_number: formatPhoneNumber(row["1st Mobile number"]),
          sd_document: sdDoc,
          delivery_number: delNo,
          aras_shipment_number: shipmentNo,
          aras_tracking_number: trackingNo,
          is_returned: row["İade"]?.toString().trim().toLowerCase() === "evet",
          item_count: 1,
          isValid: true,
          errorReasons: [],
          missing_address: isMissingAddress
        };

        if (!sdDoc || !delNo) {
          parsedRow.isValid = false;
          parsedRow.errorReasons.push("SD Document veya Delivery No eksik.");
          parsedRow.sd_document = sdDoc || `BOS_SD_${rowNum}`;
          parsedRow.delivery_number = delNo || `BOS_DEL_${rowNum}`;
          missingDocs.push(parsedRow);
          return;
        }

        if (aggregatedMap.has(sdDoc)) {
          const existing = aggregatedMap.get(sdDoc)!;
          if (existing.delivery_number === delNo) {
            existing.item_count += 1;
          } else {
            parsedRow.isValid = false;
            parsedRow.errorReasons.push(`SD Document (${sdDoc}) farklı bir Delivery No ile çakışıyor.`);
            missingDocs.push(parsedRow);
          }
        } else {
          aggregatedMap.set(sdDoc, parsedRow);
        }
      });

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

      const finalValid: ParsedRow[] = [];
      const finalInvalid: ParsedRow[] = [...missingDocs];

      Array.from(aggregatedMap.values()).forEach((item) => {
        if (existingDbSdDocs.has(item.sd_document)) {
          item.isValid = false;
          item.errorReasons.push(`Veritabanında zaten kayıtlı.`);
          finalInvalid.push(item);
        } else {
          finalValid.push(item);
        }
      });

      setValidData(finalValid);
      setInvalidData(finalInvalid);
      setActiveTab(finalValid.length > 0 ? "VALID" : "INVALID");
      setCurrentPage(1);
      setShowConfirmModal(true);

    } catch (error) {
      console.error("Excel okuma hatası:", error);
      alert("Dosya okunamadı veya veritabanı kontrolü yapılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const forceIncludeInvalidData = () => {
    if(invalidData.length === 0) return;
    
    const forcedData = invalidData.map(item => ({ ...item, isValid: true, errorReasons: ["ZORLA EKLENDİ: " + item.errorReasons.join(", ")] }));
    
    setValidData(prev => [...prev, ...forcedData]);
    setInvalidData([]);
    setActiveTab("VALID");
    setCurrentPage(1);
  };

  const executeUpload = async () => {
    if (validData.length === 0) return;

    setUploadProgress({ current: 0, total: validData.length, isUploading: true });
    const CHUNK_SIZE = 500; 

    try {
      for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
        const chunk = validData.slice(i, i + CHUNK_SIZE).map(item => ({
          customer_name: item.customer_name,
          mobile_number: item.mobile_number,
          sd_document: item.sd_document,
          delivery_number: item.delivery_number,
          aras_shipment_number: item.aras_shipment_number,
          aras_tracking_number: item.aras_tracking_number,
          is_returned: item.is_returned,
          item_count: item.item_count,
          missing_address: item.missing_address 
        }));
        
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

  const currentDisplayData = activeTab === "VALID" ? validData : invalidData;
  const totalPages = Math.ceil(currentDisplayData.length / rowsPerPage) || 1;
  const paginatedData = currentDisplayData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="w-full bg-white border border-slate-200 shadow-xl rounded-2xl p-6 lg:p-8 flex flex-col gap-8 animate-in fade-in duration-300 relative font-['Quicksand']">
      
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* SOL KOLON: BİLGİLENDİRME VE ŞABLON */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-4 mb-5 border-b border-slate-200 pb-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl bg-slate-900 overflow-hidden shadow-sm">
                <img 
                  src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdmx4cjJodGhpM2VlbzRlcmZreGQxbHc5cHNjNnlpbDJycXJ4MGg0aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26DOM7YFBRsv7hYze/giphy.gif" 
                  alt="Data Processing" 
                  className="w-full h-full object-cover opacity-90" 
                />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-[#03DF95]/20 text-[#00b377] p-1.5 rounded-md shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-widest truncate">SİSTEM TALİMATLARI</h2>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-slate-600 leading-relaxed">
                  Yükleyeceğiniz belgede eşleşme sorunları yaşamamak için en az şu <b>8 kolonun</b> eksiksiz bulunması zorunludur:
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {["Customer name", "1st Mobile number", "SD Document", "Delivery number", "Aras Shipment Number", "Aras Tracking Number", "İade", "Eksik Adres"].map((col, i) => (
                <span key={i} className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded-md shadow-sm">
                  {col}
                </span>
              ))}
            </div>

            <ul className="flex flex-col gap-3 border-t border-slate-200 pt-4">
              <li className="text-xs font-semibold text-slate-600 flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#03DF95] shrink-0 mt-1.5"></div> 
                <span>Aynı <b>SD Document</b> ve <b>Delivery No</b> birleştirilip "Kalem Sayısı" olur.</span>
              </li>
              <li className="text-xs font-semibold text-orange-600 flex items-start gap-2 bg-orange-50 p-2 rounded-md border border-orange-100">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5"></div> 
                <span><b>Takip Numarası boş bırakılabilir.</b> Eğer numara yerine <b>metin (harf)</b> yazılmışsa sistem bu kaydı <u className="font-bold">Eksik/Hatalı Adres</u> kabul eder ve veritabanına öyle kaydeder.</span>
              </li>
            </ul>
          </div>

          <button 
            type="button"
            onClick={downloadTemplate}
            className="w-full h-12 sm:h-14 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-xl shadow-sm"
          >
            <Download className="w-4 h-4" />
            RESMİ ŞABLONU İNDİR (CSV)
          </button>
        </div>

        {/* SAĞ KOLON: DOSYA YÜKLEME ALANI */}
        <form onSubmit={handleProcessFile} className="xl:col-span-7 flex flex-col gap-6 h-full">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="bg-slate-900 text-[#03DF95] p-2 rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">GÜVENLİ DOSYA YÜKLEME</h2>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-h-[250px]">
            {!selectedFile ? (
              <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-[#03DF95]/5 hover:border-[#03DF95] transition-all relative h-full flex flex-col items-center justify-center gap-4 cursor-pointer group">
                <input 
                  ref={fileInputRef}
                  type="file" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                />
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-[#03DF95] transition-colors" />
                </div>
                <div className="text-center">
                  <span className="block text-sm font-black text-slate-700 uppercase tracking-widest group-hover:text-[#03DF95]">SÜRÜKLE VEYA TIKLA</span>
                  <span className="text-xs font-medium text-slate-400 mt-1">.csv veya .xlsx formatları desteklenir</span>
                </div>
              </div>
            ) : (
              <div className="border border-green-200 rounded-2xl bg-green-50/50 p-6 flex flex-col items-center justify-center h-full shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#03DF95]"></div>
                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#03DF95]" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-slate-800 truncate mb-1">{selectedFile.name}</p>
                  <p className="text-xs font-bold text-slate-500 bg-white border border-slate-200 inline-block px-3 py-1 rounded-full shadow-sm mb-4">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button type="button" onClick={handleReset} className="text-xs font-bold text-red-500 uppercase tracking-widest hover:text-red-600 flex items-center gap-1 bg-white px-4 py-2 rounded-lg border border-red-100 shadow-sm transition-colors">
                  <Trash2 className="w-4 h-4" /> İPTAL ET
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading || !selectedFile}
            className="w-full h-14 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-sm uppercase tracking-widest transition-colors rounded-xl shadow-md mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> İŞLENİYOR...</>
            ) : "VERİLERİ BİRLEŞTİR VE İNCELE"}
          </button>
        </form>
      </div>

      {/* POP-UP ONAY VE VERİ İNCELEME EKRANI (MODAL) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm transition-all font-['Quicksand']">
          <div className="bg-white shadow-2xl w-full max-w-6xl rounded-2xl overflow-hidden flex flex-col h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-[#03DF95]/20 p-2 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-[#03DF95]" />
                </div>
                <h2 className="text-white font-black uppercase tracking-widest text-base sm:text-lg">ÖNİZLEME VE ONAY MERKEZİ</h2>
              </div>
              {!uploadProgress.isUploading && (
                <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-50 flex flex-col min-h-0 overflow-hidden">
              
              {/* Sekmeler (Tabs) */}
              <div className="flex items-center gap-2 p-4 pb-0 border-b border-slate-200 shrink-0">
                <button 
                  onClick={() => {setActiveTab("VALID"); setCurrentPage(1)}}
                  className={`px-6 py-3 font-bold text-xs uppercase tracking-widest transition-all border-b-2 rounded-t-lg ${activeTab === "VALID" ? "border-[#03DF95] bg-white text-[#03DF95]" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> GEÇERLİ KAYITLAR ({validData.length})
                  </div>
                </button>
                <button 
                  onClick={() => {setActiveTab("INVALID"); setCurrentPage(1)}}
                  className={`px-6 py-3 font-bold text-xs uppercase tracking-widest transition-all border-b-2 rounded-t-lg ${activeTab === "INVALID" ? "border-orange-500 bg-white text-orange-600" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> HATALI KAYITLAR ({invalidData.length})
                  </div>
                </button>
              </div>

              {/* Hatalı Kayıtlar için Aksiyon Uyarısı */}
              {activeTab === "INVALID" && invalidData.length > 0 && (
                <div className="bg-orange-50 border-b border-orange-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                  <div className="min-w-0 pr-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-black text-orange-800 uppercase tracking-widest mb-1">EKSİK VEYA MÜKERRER KAYITLAR</h3>
                      <p className="text-xs font-semibold text-orange-700">Bu kayıtlar veritabanına <u className="font-bold">eklenmeyecektir</u>. Ancak uyarıları dikkate alarak yine de yüklemeye zorlayabilirsiniz.</p>
                    </div>
                  </div>
                  <button 
                    onClick={forceIncludeInvalidData} 
                    className="shrink-0 w-full sm:w-auto bg-white border border-orange-200 hover:bg-orange-100 text-orange-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-colors shadow-sm"
                  >
                    YİNE DE EKLE (ZORLA)
                  </button>
                </div>
              )}

              {/* Tablo Alanı */}
              <div className="flex-1 overflow-auto bg-white">
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead className="sticky top-0 bg-white border-b border-slate-200 shadow-sm z-10">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Satır</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Müşteri</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">SD Document</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Delivery No</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Shipment / Takip No</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Adet</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-orange-500 uppercase tracking-widest text-center whitespace-nowrap">Eksik Adres</th>
                      {activeTab === "INVALID" && (
                        <th className="px-4 py-3 text-[10px] font-bold text-red-500 uppercase tracking-widest whitespace-nowrap">Hata Nedeni</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {currentDisplayData.length === 0 ? (
                      <tr>
                        <td colSpan={activeTab === "INVALID" ? 8 : 7} className="px-4 py-16 text-center text-sm font-semibold text-slate-400 bg-slate-50/50">
                          Bu kategoride gösterilecek kayıt bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2 text-xs font-bold text-slate-400">#{row.rowNumber}</td>
                          <td className="px-4 py-2 text-xs font-bold text-slate-700 truncate max-w-[150px]">{row.customer_name || "-"}</td>
                          <td className="px-4 py-2 text-xs font-mono font-bold text-slate-900">{row.sd_document}</td>
                          <td className="px-4 py-2 text-xs font-bold text-slate-700">{row.delivery_number}</td>
                          <td className="px-4 py-2 text-xs font-mono text-slate-600 font-medium">
                            <span className="block text-[10px] text-slate-400">S: {row.aras_shipment_number || "-"}</span>
                            
                            {/* DASHBOARD MANTIĞI: EKSİK ADRES GÖSTERİMİ */}
                            {row.missing_address ? (
                              <div className="flex flex-col items-start gap-1 p-1 mt-1 bg-orange-50 border border-orange-200 rounded-md">
                                <span className="text-orange-700 text-[9px] font-bold uppercase flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> EKSİK/HATALI ADRES
                                </span>
                                <span className="text-slate-700 font-semibold text-[10px] truncate max-w-[150px]" title={/[a-zA-Z]/.test(row.aras_shipment_number) ? row.aras_shipment_number : row.aras_tracking_number}>
                                  {/[a-zA-Z]/.test(row.aras_shipment_number) ? row.aras_shipment_number : row.aras_tracking_number}
                                </span>
                              </div>
                            ) : (
                              <span className="block text-slate-900 font-bold mt-0.5">T: {row.aras_tracking_number || "-"}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold font-mono ${
                              row.item_count > 1 ? "bg-[#03DF95]/10 text-[#00b377]" : "bg-slate-100 text-slate-500"
                            }`}>
                              {row.item_count}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {row.missing_address ? (
                              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200">EVET</span>
                            ) : (
                              <span className="text-slate-400 text-xs font-medium">-</span>
                            )}
                          </td>
                          {activeTab === "INVALID" && (
                            <td className="px-4 py-2 text-xs font-medium text-red-600 max-w-[250px] truncate" title={row.errorReasons.join(", ")}>
                              {row.errorReasons.join(" | ")}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sayfalama Alanı */}
              <div className="bg-white border-t border-slate-200 p-3 flex justify-between items-center shrink-0">
                <span className="text-[11px] font-bold text-slate-500">
                  Sayfa <span className="text-slate-900">{currentPage}</span> / {totalPages}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || uploadProgress.isUploading}
                    className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase disabled:opacity-50 transition-colors hover:bg-slate-50 shadow-sm"
                  >ÖNCEKİ</button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || uploadProgress.isUploading || currentDisplayData.length === 0}
                    className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase disabled:opacity-50 transition-colors hover:bg-slate-50 shadow-sm"
                  >SONRAKİ</button>
                </div>
              </div>

              {/* Progress Bar */}
              {uploadProgress.isUploading && (
                <div className="w-full bg-slate-100 h-8 relative overflow-hidden shrink-0 border-t border-slate-200">
                  <div 
                    className="bg-[#03DF95] h-full transition-all duration-300 flex items-center justify-end pr-2" 
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  >
                    <div className="absolute inset-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress_1s_linear_infinite]" />
                  </div>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-800 mix-blend-overlay tracking-widest z-10">
                    {uploadProgress.current} / {uploadProgress.total} KAYIT AKTARILIYOR...
                  </span>
                </div>
              )}

            </div>

            {/* Modal Footer (Action Butonları) */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col-reverse sm:flex-row gap-3 shrink-0 rounded-b-2xl">
              <button 
                onClick={() => setShowConfirmModal(false)}
                disabled={uploadProgress.isUploading}
                className="w-full sm:w-32 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold h-12 rounded-xl uppercase tracking-widest transition-colors disabled:opacity-50 text-xs shadow-sm"
              >
                İPTAL
              </button>
              <button 
                onClick={executeUpload}
                disabled={uploadProgress.isUploading || validData.length === 0}
                className="flex-1 bg-[#03DF95] hover:bg-[#02c784] text-slate-900 h-12 rounded-xl font-black uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-xs shadow-sm"
              >
                {uploadProgress.isUploading ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> VERİTABANINA YAZILIYOR</>
                ) : (
                  <>GEÇERLİ OLAN {validData.length} KAYDI YÜKLE</>
                )}
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