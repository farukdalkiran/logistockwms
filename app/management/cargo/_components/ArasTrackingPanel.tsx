"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { 
  getShipmentsByDeliveryNumber, 
  saveArasTracking, 
  getProcessedExportData,
  getExactOriginalExportData,
  getKargoStats,
  getArasFiles, 
  deleteArasFile
} from "@/app/actions/aras-integration";
import ExcelUploadDrawer from "./ExcelUploadDrawer";

interface ArasTrackingPanelProps {
  employeeId: string;
}

interface ShipmentData {
  id: string;
  file_id: string;
  customer_name: string;
  mobile_number: string;
  street: string;
  street_2: string;
  city: string;
  region: string;
  postal_code: string;
  delivery_number: string;
  sd_document: string;
  aras_tracking_number: string | null;
  is_processed_aras: boolean;
}

interface ActiveGroupData {
  records: ShipmentData[];
  count: number;
  primary: ShipmentData;
  sdDocumentsMatch: boolean;
  uniqueSdDocuments: string[];
  isUpdateMode: boolean; 
}

interface KargoFile {
  id: string;
  filename: string;
  created_at: string;
}

export default function ArasTrackingPanel({ employeeId }: ArasTrackingPanelProps) {
  const [isExcelOpen, setIsExcelOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const [files, setFiles] = useState<KargoFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");

  const [deliveryNo, setDeliveryNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  
  const [activeGroup, setActiveGroup] = useState<ActiveGroupData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [stats, setStats] = useState({ totalFiles: 0, totalRecords: 0, processed: 0, remaining: 0, today: 0 });
  const [uiStatus, setUiStatus] = useState<"idle" | "success" | "error" | "warning" | "update">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const deliveryRef = useRef<HTMLInputElement>(null);
  const trackingRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInitialData();
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchStats(selectedFileId);
    handleCancel(); 
  }, [selectedFileId]);

  useEffect(() => {
    if (!isExcelOpen && !isWipeModalOpen && !activeGroup && !isProfileMenuOpen) deliveryRef.current?.focus();
  }, [isExcelOpen, isWipeModalOpen, activeGroup, selectedFileId, isProfileMenuOpen]);

  useEffect(() => {
    if (uiStatus === "success" || uiStatus === "error") {
      const timer = setTimeout(() => setUiStatus("idle"), 2500);
      return () => clearTimeout(timer);
    }
  }, [uiStatus]);

  const fetchInitialData = async () => {
    const filesRes = await getArasFiles();
    if (filesRes.success && filesRes.data) {
      setFiles(filesRes.data);
    }
    await fetchStats("");
  };

  const fetchStats = async (fileId: string) => {
    const res = await getKargoStats(fileId);
    if (res.success) {
      setStats({ 
        totalFiles: res.totalFiles || files.length,
        totalRecords: res.total, 
        processed: res.processed, 
        remaining: res.total - res.processed,
        today: res.today 
      });
    }
  };

  const triggerFeedback = (status: "success" | "error" | "warning" | "update", msg: string) => {
    setUiStatus(status);
    setStatusMessage(msg);
  };

  const handleCopy = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000); 
  };

  const loadDeliveryData = async (targetDeliveryNo: string) => {
    setLoading(true);
    setUiStatus("idle");
    setStatusMessage(null);

    const result = await getShipmentsByDeliveryNumber(targetDeliveryNo, selectedFileId);

    if (result.success && result.data && result.data.length > 0) {
      const records = result.data as ShipmentData[];
      const alreadyProcessed = records.find(r => r.is_processed_aras);
      
      const sdDocuments = records.map(r => r.sd_document).filter(Boolean);
      const uniqueSdDocuments = Array.from(new Set(sdDocuments));
      
      setActiveGroup({
        records,
        count: records.length,
        primary: records[0],
        sdDocumentsMatch: uniqueSdDocuments.length <= 1,
        uniqueSdDocuments,
        isUpdateMode: !!alreadyProcessed
      });

      if (alreadyProcessed) {
        triggerFeedback("update", `DİKKAT: Bu sipariş daha önce kargolanmış!`);
        setTrackingNo(alreadyProcessed.aras_tracking_number || "");
      } else {
        setTrackingNo("");
      }
      
      setDeliveryNo("");
      setTimeout(() => trackingRef.current?.focus(), 50);
    } else {
      triggerFeedback("error", result.error || "SİPARİŞ BULUNAMADI!");
      setDeliveryNo("");
      deliveryRef.current?.focus();
    }
    setLoading(false);
  };

  const handleDeliveryScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!deliveryNo.trim() || loading) return;
    await loadDeliveryData(deliveryNo.trim());
  };

  const handleTrackingScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !trackingNo.trim() || loading) return;

    setLoading(true);
    const result = await saveArasTracking(activeGroup.primary.delivery_number, trackingNo.trim(), employeeId, selectedFileId);

    if (result.success) {
      triggerFeedback("success", activeGroup.isUpdateMode ? `GÜNCELLEME BAŞARILI` : `EŞLEŞTİRME BAŞARILI`);
      setActiveGroup(null);
      setTrackingNo("");
      fetchStats(selectedFileId); 
      setTimeout(() => deliveryRef.current?.focus(), 50);
    } else {
      triggerFeedback("error", result.error || "VERİTABANI YAZMA HATASI!");
      trackingRef.current?.focus();
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setActiveGroup(null);
    setTrackingNo("");
    setDeliveryNo("");
    setUiStatus("idle");
    setStatusMessage(null);
    setTimeout(() => deliveryRef.current?.focus(), 50);
  };

  const handleDeleteFile = async () => {
    setLoading(true);
    const result = await deleteArasFile(selectedFileId); 
    if (result.success) {
      triggerFeedback("success", selectedFileId ? "ÇALIŞMA PROFİLİ SİLİNDİ!" : "TÜM VERİTABANI SIFIRLANDI!");
      setIsWipeModalOpen(false);
      handleCancel();
      setSelectedFileId("");
      fetchInitialData();
    } else {
      triggerFeedback("error", "SİLME İŞLEMİ BAŞARISIZ!");
    }
    setLoading(false);
  };

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTwoColumnExcel = async () => {
    const result = await getProcessedExportData(selectedFileId);
    if (!result.success || !result.data || result.data.length === 0) {
      alert("İndirilecek kayıt bulunamadı."); return;
    }
    const headers = "Delivery Number;Aras Takip No\n";
    const rows = result.data.map((r: any) => `${r.delivery_number};${r.aras_tracking_number}`).join("\n");
    const fileName = selectedFileId 
      ? `ARAS_ÇIKTI_PROFIL_${selectedFileId}_${new Date().toISOString().split("T")[0]}.csv` 
      : `ARAS_ÇIKTI_TUMU_${new Date().toISOString().split("T")[0]}.csv`;
    
    downloadBlob("\uFEFF" + headers + rows, fileName);
  };

  const exportExactOriginalExcel = async () => {
    const result = await getExactOriginalExportData(selectedFileId);
    if (!result.success || !result.data || result.data.length === 0) {
      alert("İndirilecek kayıt bulunamadı."); return;
    }
    const originalHeaders = [
      "Shipment number", "Customer name", "Email", "1st Mobile number", "Street", 
      "Street 2", "City", "Region", "Postal Code", "Country Code", "Customer material", 
      "SD Document", "Delivery number", "Material", "Text", "Quantity", "UoM", 
      "Export price", "Export price currency", "in local currency rate 53,29", 
      "Country of origin", "Commodity Code from Plant", "Net Weight(gm)", "Invoice", 
      "Aras Kargo Takip No"
    ];
    const headerRow = originalHeaders.join(";") + "\n";
    const rows = result.data.map((row: any) => {
      const rowValues = [
        row.shipment_number, row.customer_name, row.email, row.mobile_number, 
        row.street, row.street_2, row.city, row.region, row.postal_code, row.country, 
        row.customer_material, row.sd_document, row.delivery_number, row.material, 
        row.description_text, row.quantity, row.uom, row.export_price, row.export_price_currency, 
        row.local_currency_rate, row.country_of_origin, row.commodity_code, row.net_weight_gm, 
        row.invoice_number, row.aras_tracking_number
      ];
      return rowValues.map(val => val == null ? '""' : `"${String(val).replace(/"/g, '""')}"`).join(";");
    }).join("\n");
    
    const fileName = selectedFileId 
      ? `ORIJINAL_SABLON_PROFIL_${selectedFileId}_${new Date().toISOString().split("T")[0]}.csv` 
      : `ORIJINAL_SABLON_TUMU_${new Date().toISOString().split("T")[0]}.csv`;
    
    downloadBlob("\uFEFF" + headerRow + rows, fileName);
  };

  const getContainerStyles = () => {
    switch (uiStatus) {
      case "success": return "bg-green-50/80 border-green-500 shadow-sm";
      case "error": return "bg-red-50/80 border-[#dc3545] shadow-sm";
      case "update": return "bg-blue-50/80 border-blue-500 shadow-sm"; 
      case "warning": return "bg-orange-50/80 border-orange-500 shadow-sm";
      default: return "bg-white border-slate-300 shadow-sm";
    }
  };

  const formatPhoneForCopy = (phone: string | null | undefined) => {
    if (!phone) return "";
    const idx = phone.indexOf('5');
    return idx !== -1 ? phone.substring(idx) : phone;
  };

  const CopyIcon = ({ fieldId, textToCopy }: { fieldId: string, textToCopy: string }) => (
    <button 
      type="button"
      onClick={() => handleCopy(textToCopy, fieldId)}
      className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 bg-slate-50 hover:bg-[#dc3545] text-slate-500 hover:text-white border-l-2 border-slate-200 hover:border-[#dc3545] transition-colors rounded-none focus:outline-none"
      title="Kopyala"
    >
      {copiedField === fieldId ? (
        <svg className="w-5 h-5 text-green-600 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
      )}
    </button>
  );

  const selectedFileName = selectedFileId ? files.find(f => f.id === selectedFileId)?.filename : "TÜM DOSYALARDA ÇALIŞ (GLOBAL)";
  const progressPercent = stats.totalRecords > 0 ? Math.round((stats.processed / stats.totalRecords) * 100) : 0;

  return (
    <>
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 text-slate-800 pb-12 font-['Quicksand']">
        
        {/* HERO HEADER */}
        <div className="w-full bg-white border-2 border-slate-300 border-l-8 border-l-[#dc3545] p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-[4px_4px_0px_#e2e8f0]">
          
          <div className="flex flex-col sm:flex-row items-center gap-5 w-full lg:w-auto">
            <div className="w-24 h-24 shrink-0 border-2 border-slate-300 bg-slate-50 relative overflow-hidden hidden sm:block">
              <img 
                src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdmx4cjJodGhpM2VlbzRlcmZreGQxbHc5cHNjNnlpbDJycXJ4MGg0aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26DOM7YFBRsv7hYze/giphy.gif" 
                alt="Lego Header" 
                className="w-full h-full object-cover opacity-90"
              />
            </div>

            <div className="flex flex-col justify-center min-w-0 text-center sm:text-left w-full sm:w-auto">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-widest uppercase truncate">
                  EKSİK PARÇA <span className="text-[#dc3545]">B2C</span>
                </h1>
                <span className="bg-slate-900 text-white text-[10px] px-3 py-1 uppercase tracking-widest font-bold">
                  KARGO MODÜLÜ
                </span>
              </div>
              
              {/* BATCH PROFİL SEÇİCİ */}
              <div className="relative w-full sm:w-[360px]" ref={profileMenuRef}>
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="w-full h-11 bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 focus:border-[#dc3545] text-[13px] font-bold font-mono text-slate-800 flex items-center justify-between px-4 transition-colors rounded-none outline-none"
                >
                  <div className="flex items-center gap-2 truncate">
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                    <span className="truncate">{selectedFileName}</span>
                  </div>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isProfileMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                
                {isProfileMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white border-2 border-slate-300 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-72 overflow-y-auto">
                    <div className="p-3 border-b-2 border-slate-100 bg-slate-50">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Çalışma Profilini / Dosyayı Seçin</span>
                    </div>
                    <button 
                      onClick={() => { setSelectedFileId(""); setIsProfileMenuOpen(false); }}
                      className={`w-full text-left px-5 py-4 text-xs font-black uppercase transition-colors hover:bg-slate-100 border-b-2 border-slate-100 ${!selectedFileId ? 'bg-red-50 text-[#dc3545] border-l-4 border-l-[#dc3545]' : 'text-slate-700'}`}
                    >
                      TÜM DOSYALARDA ÇALIŞ (GLOBAL MOD)
                    </button>
                    {files.map(f => (
                      <button 
                        key={f.id}
                        onClick={() => { setSelectedFileId(f.id); setIsProfileMenuOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-xs font-bold transition-colors hover:bg-slate-100 border-b border-slate-100 group ${selectedFileId === f.id ? 'bg-slate-800 text-white border-l-4 border-l-[#dc3545]' : 'text-slate-600'}`}
                      >
                        <div className="truncate font-mono text-sm">{f.filename}</div>
                        <div className={`text-[10px] mt-1 ${selectedFileId === f.id ? 'text-slate-400' : 'text-slate-400 group-hover:text-[#dc3545]'}`}>Yüklenme: {new Date(f.created_at).toLocaleString('tr-TR')}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DİJİTAL READOUT KPI */}
          <div className="flex flex-col gap-2 w-full lg:w-auto shrink-0 bg-slate-900 border-2 border-slate-800 p-4">
            <div className="flex items-center justify-between gap-6 px-2">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TOPLAM</span>
                <span className="text-2xl font-black font-mono text-white leading-none mt-1">{stats.totalRecords}</span>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">KALAN</span>
                <span className="text-2xl font-black font-mono text-orange-500 leading-none mt-1">{stats.remaining}</span>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">İŞLENEN</span>
                <span className="text-2xl font-black font-mono text-green-400 leading-none mt-1">{stats.processed}</span>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BUGÜN</span>
                <span className="text-2xl font-black font-mono text-[#dc3545] leading-none mt-1">{stats.today}</span>
              </div>
            </div>
            <div className="w-full bg-slate-800 h-2 mt-2 relative overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-400 h-full transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        </div>

        {/* AKSİYON BUTONLARI (Flex-Row Compact) */}
        <div className="flex flex-wrap items-center justify-end gap-3 w-full shrink-0">
          <button 
            onClick={() => setIsWipeModalOpen(true)}
            className="h-11 bg-red-50 hover:bg-red-100 text-[#dc3545] px-4 font-black text-[11px] uppercase tracking-widest transition-colors flex justify-center items-center gap-2 border-2 border-red-200 mr-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            <span className="hidden sm:inline">{selectedFileId ? "DOSYAYI SİL" : "TÜMÜNÜ SIFIRLA"}</span>
          </button>
          
          <button 
            onClick={() => setIsExcelOpen(true)}
            className="h-11 bg-slate-900 hover:bg-slate-800 text-white px-5 font-black text-[11px] uppercase tracking-widest transition-colors flex justify-center items-center gap-2 border-2 border-slate-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1h16v-1M12 4v10m-4-4l4 4 4-4"></path></svg>
            YENİ PROFİL YÜKLE
          </button>
          
          <button 
            onClick={exportTwoColumnExcel}
            className="h-11 bg-white hover:bg-slate-50 text-[#dc3545] px-5 font-black text-[11px] uppercase tracking-widest transition-colors flex justify-center items-center gap-2 border-2 border-[#dc3545]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            ÇIKTI (2 KOLON)
          </button>
          
          <button 
            onClick={exportExactOriginalExcel}
            className="h-11 bg-white hover:bg-slate-50 text-slate-800 px-5 font-black text-[11px] uppercase tracking-widest transition-colors flex justify-center items-center gap-2 border-2 border-slate-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            ÇIKTI (TAM ŞABLON)
          </button>
        </div>

        <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* SOL KOLON: AKTİF BARKOD İŞLEM BÖLGESİ */}
          <div className={`col-span-1 xl:col-span-8 shadow-sm border-2 transition-colors duration-300 p-6 flex flex-col gap-6 rounded-none ${getContainerStyles()} w-full min-w-0 bg-white`}>
            
            {statusMessage && (
              <div className={`p-4 text-sm font-black uppercase tracking-widest border-2 shadow-none animate-in fade-in rounded-none break-words ${
                uiStatus === "error" ? "bg-red-100 text-red-800 border-[#dc3545]" :
                uiStatus === "update" ? "bg-blue-100 text-blue-800 border-blue-600" :
                uiStatus === "warning" ? "bg-orange-100 text-orange-800 border-orange-600" :
                "bg-green-100 text-green-800 border-green-600"
              }`}>
                {statusMessage}
              </div>
            )}

            {/* ADIM 1: SİPARİŞ / DELIVERY NO */}
            <div className={`transition-opacity duration-300 ${activeGroup ? "opacity-40 pointer-events-none" : "opacity-100"} w-full`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-6 h-6 bg-slate-900 text-white text-xs font-black">1</span>
                <label className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  SİPARİŞ VEYA DELIVERY NO
                </label>
              </div>
              <form onSubmit={handleDeliveryScan} className="flex flex-col sm:flex-row gap-4 w-full">
                <input
                  ref={deliveryRef}
                  type="text"
                  value={deliveryNo}
                  onChange={(e) => setDeliveryNo(e.target.value)}
                  disabled={loading || activeGroup !== null}
                  className="flex-1 h-14 bg-white border-2 border-slate-300 px-5 text-xl font-black font-mono text-slate-900 focus:outline-none focus:border-[#dc3545] disabled:bg-slate-100 uppercase placeholder:text-slate-300"
                  placeholder={selectedFileId ? "SADECE SEÇİLİ DOSYADA ARA..." : "BARKOD OKUT VEYA YAZ..."}
                  autoComplete="off"
                />
                <button 
                  type="submit" 
                  disabled={loading || !deliveryNo.trim() || activeGroup !== null}
                  className="w-full sm:w-48 h-14 bg-slate-900 hover:bg-[#dc3545] disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-sm uppercase tracking-widest transition-colors border-2 border-slate-800 disabled:border-slate-300"
                >
                  SORGULA
                </button>
              </form>
            </div>

            {/* ADIM 2: AKTİF SİPARİŞ DETAYLARI & EŞLEŞTİRME */}
            {activeGroup && (
              <div className="flex flex-col gap-0 animate-in slide-in-from-bottom-4 fade-in duration-300 bg-white border-2 border-slate-300 relative rounded-none w-full min-w-0 mt-2">
                <div className={`absolute top-0 left-0 w-2 h-full ${activeGroup.isUpdateMode ? 'bg-blue-500' : 'bg-[#dc3545]'}`}></div>

                {/* KPI HEADER */}
                <div className="bg-slate-100 border-b-2 border-slate-200 p-4 pl-6 sm:pl-8 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                  <div className="flex items-center gap-3 bg-white border-2 border-slate-200 px-4 py-2 shrink-0">
                    <span className="bg-slate-900 text-white px-3 py-1 font-black text-lg">{activeGroup.count}</span>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-tight">KALEM<br/>SİPARİŞ</span>
                  </div>
                  
                  {activeGroup.sdDocumentsMatch ? (
                    <div className="flex-1 flex items-center gap-3 bg-green-50 border-2 border-green-500 px-4 py-2">
                      <svg className="w-6 h-6 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-green-800 uppercase tracking-widest truncate">SD DOCUMENT (TAM EŞLEŞME)</p>
                        <p className="text-sm font-black font-mono text-green-900 truncate">{activeGroup.uniqueSdDocuments[0] || 'KOD YOK'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-3 bg-orange-50 border-2 border-orange-500 px-4 py-2">
                      <svg className="w-6 h-6 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest truncate">FARKLI SD KODLARI İÇERİYOR</p>
                        <p className="text-xs font-bold font-mono text-orange-900 break-all">{activeGroup.uniqueSdDocuments.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* INFO BOARD */}
                <div className="p-5 sm:p-6 pl-6 sm:pl-8 w-full border-b-2 border-slate-200">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 w-full min-w-0">
                    <div className="flex flex-col min-w-0 gap-5">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALICI AD SOYAD</p>
                        <div className="flex items-stretch bg-white border-2 border-slate-200">
                          <span className="flex-1 flex items-center text-sm font-black text-slate-900 uppercase truncate px-3 py-2">{activeGroup.primary.customer_name}</span>
                          <CopyIcon fieldId="name" textToCopy={activeGroup.primary.customer_name} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">İLETİŞİM BİLGİSİ</p>
                        <div className="flex items-stretch bg-white border-2 border-slate-200">
                          <span className="flex-1 flex items-center text-sm font-black font-mono text-slate-700 truncate px-3 py-2">{activeGroup.primary.mobile_number}</span>
                          <CopyIcon fieldId="phone" textToCopy={formatPhoneForCopy(activeGroup.primary.mobile_number)} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col min-w-0 gap-5">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ŞEHİR / BÖLGE</p>
                        <div className="flex items-stretch bg-white border-2 border-slate-200">
                          <span className="flex-1 flex items-center text-sm font-black text-slate-900 uppercase truncate px-3 py-2">
                            {activeGroup.primary.city} / {activeGroup.primary.region}
                          </span>
                          <CopyIcon fieldId="cityRegion" textToCopy={`${activeGroup.primary.city || ''} / ${activeGroup.primary.region || ''}`.trim()} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 h-full">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AÇIK ADRES & POSTA KODU</p>
                        <div className="flex items-stretch bg-white border-2 border-slate-200 flex-1">
                          <span className="flex-1 text-xs font-bold text-slate-700 uppercase leading-relaxed break-words px-3 py-2">
                            {`${activeGroup.primary.street || ""} ${activeGroup.primary.street_2 || ""} - Posta Kodu: ${activeGroup.primary.postal_code || "YOK"} --DN: ${activeGroup.primary.delivery_number}`.trim()}
                          </span>
                          <div className="flex items-start">
                            <CopyIcon fieldId="fullAddress" textToCopy={`${activeGroup.primary.street || ""} ${activeGroup.primary.street_2 || ""} - Posta Kodu: ${activeGroup.primary.postal_code || "YOK"} --DN: ${activeGroup.primary.delivery_number}`.trim()} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ARAS KARGO INPUT */}
                <div className={`${activeGroup.isUpdateMode ? 'bg-blue-50/50' : 'bg-slate-50'} p-5 sm:p-6 pl-6 sm:pl-8 w-full`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`flex items-center justify-center w-6 h-6 text-white text-xs font-black ${activeGroup.isUpdateMode ? 'bg-blue-600' : 'bg-[#dc3545]'}`}>2</span>
                    <label className={`text-sm font-black uppercase tracking-widest ${activeGroup.isUpdateMode ? 'text-blue-700' : 'text-[#dc3545]'}`}>
                      {activeGroup.isUpdateMode ? 'KARGO BARKODUNU GÜNCELLE' : 'ARAS KARGO BARKODUNU OKUT'}
                    </label>
                  </div>
                  <form onSubmit={handleTrackingScan} className="flex flex-col sm:flex-row gap-4 w-full">
                    <input
                      ref={trackingRef}
                      type="text"
                      value={trackingNo}
                      onChange={(e) => setTrackingNo(e.target.value)}
                      disabled={loading}
                      className={`flex-1 h-14 bg-white border-2 px-5 text-2xl font-black font-mono text-slate-900 focus:outline-none uppercase placeholder:text-slate-300 placeholder:text-lg ${activeGroup.isUpdateMode ? 'border-blue-400 focus:border-blue-600' : 'border-[#dc3545]'}`}
                      placeholder={activeGroup.isUpdateMode ? "YENİ BARKOD..." : "KARGO BARKODU..."}
                      autoComplete="off"
                    />
                    <div className="flex gap-4">
                      <button 
                        type="submit" 
                        disabled={loading || !trackingNo.trim()}
                        className={`h-14 px-10 text-white font-black text-sm uppercase tracking-widest transition-all border-2 ${activeGroup.isUpdateMode ? 'bg-blue-600 hover:bg-blue-700 border-blue-800 disabled:bg-blue-300 disabled:border-blue-300' : 'bg-[#dc3545] hover:bg-red-700 border-red-800 disabled:bg-red-300 disabled:border-red-300'}`}
                      >
                        {activeGroup.isUpdateMode ? 'GÜNCELLE' : 'KAYDET'}
                      </button>
                      <button 
                        type="button"
                        onClick={handleCancel}
                        disabled={loading}
                        className="h-14 px-8 bg-white hover:bg-slate-100 text-slate-800 font-black text-xs uppercase tracking-widest transition-colors border-2 border-slate-300"
                      >
                        İPTAL
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* SAĞ KOLON: KABİN TASARIMLI SİSTEM AĞI PANO */}
          <div className="col-span-1 xl:col-span-4 flex flex-col gap-6 w-full h-full">
            <div className="bg-white shadow-sm border-2 border-slate-300 flex flex-col h-full rounded-none">
              
              <div className="bg-slate-50 p-4 border-b-4 border-[#dc3545] flex items-center justify-between">
                <h3 className="text-slate-800 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#dc3545]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>
                  AĞ & TERMİNAL DURUMU
                </h3>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 border-2 border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[9px] text-slate-600 font-black tracking-widest">ONLINE</span>
                </div>
              </div>
              
              <div className="p-5 flex flex-col gap-4 flex-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ÇALIŞMA PROFİLİ</span>
                  <div className="bg-slate-50 border-2 border-slate-200 p-2 flex items-center justify-between">
                    <span className={`text-[11px] font-black tracking-widest ${selectedFileId ? 'text-blue-700' : 'text-slate-700'}`}>
                      {selectedFileId ? "İZOLE MOD (LOCKED)" : "GENEL ARAMA (GLOBAL)"}
                    </span>
                    {selectedFileId && <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">VERİTABANI MOTORU</span>
                  <div className="bg-slate-50 border-2 border-slate-200 p-2 flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700 tracking-widest">PAGINATED LOOP</span>
                    <span className="text-[9px] font-black bg-[#dc3545] text-white px-2 py-0.5">LİMİTSİZ</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SORGULAMA TİPİ</span>
                  <div className="bg-slate-50 border-2 border-slate-200 p-2 flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700 tracking-widest">CROSS-COLUMN</span>
                    <span className="text-[9px] font-black bg-slate-800 text-white px-2 py-0.5">AKTİF</span>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t-2 border-slate-200">
                  <div className="w-full bg-green-50 border-2 border-green-500 p-2.5 flex items-center justify-center gap-2 shadow-sm">
                     <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                     <span className="text-[10px] font-black text-green-700 tracking-widest">SUNUCU BAĞLANTISI STABİL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ExcelUploadDrawer 
        isOpen={isExcelOpen} 
        onClose={() => {
          setIsExcelOpen(false);
          fetchInitialData(); 
        }} 
        employeeId={employeeId} 
      />

      {isWipeModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-[#dc3545] shadow-xl w-full max-w-lg rounded-none overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#dc3545] p-5 flex items-center gap-4">
              <svg className="w-8 h-8 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <h2 className="text-white font-black text-xl tracking-widest uppercase">
                {selectedFileId ? "ÇALIŞMA PROFİLİNİ SİL" : "VERİTABANI SIFIRLAMA"}
              </h2>
            </div>
            <div className="p-8">
              <p className="text-slate-900 font-black text-lg mb-3 uppercase leading-snug">DİKKAT: Veriler kalıcı olarak yok edilecektir!</p>
              <p className="text-slate-600 font-bold text-sm mb-8 leading-relaxed">
                Bu işlem geri alınamaz. 
                {selectedFileId ? " Sadece seçili dosyaya ait ham veriler ve kargo eşleştirmeleri silinecektir." : " Sisteme yüklenen TÜM Excel verileri ve yapılan kargo barkod eşleştirmeleri tamamen temizlenecektir."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleDeleteFile} 
                  disabled={loading}
                  className="flex-1 bg-[#dc3545] hover:bg-red-700 text-white font-black h-14 uppercase tracking-widest border-2 border-red-800 transition-all disabled:opacity-50"
                >
                  {loading ? "SİLİNİYOR..." : "EVET, ONAYLIYORUM"}
                </button>
                <button 
                  onClick={() => setIsWipeModalOpen(false)} 
                  disabled={loading}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black h-14 uppercase tracking-widest border-2 border-slate-300 transition-colors"
                >
                  İPTAL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}