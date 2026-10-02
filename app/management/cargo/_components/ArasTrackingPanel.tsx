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
import { 
  Trash2, 
  CheckCircle2, 
  Download, 
  UploadCloud, 
  Activity, 
  PackageCheck, 
  PackageOpen, 
  CalendarDays,
  PackageSearch,
  FileSpreadsheet,
  AlertTriangle
} from "lucide-react";

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

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchStats(selectedFileId);
    handleCancel(); 
  }, [selectedFileId]);

  useEffect(() => {
    if (!isExcelOpen && !isWipeModalOpen && !activeGroup) deliveryRef.current?.focus();
  }, [isExcelOpen, isWipeModalOpen, activeGroup, selectedFileId]);

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
    await fetchStats(selectedFileId);
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

  // 🚀 BARKOD MANTIĞI & OTOMATİK PROFİL SEÇİMİ
  const loadDeliveryData = async (targetDeliveryNo: string) => {
    setLoading(true);
    setUiStatus("idle");
    setStatusMessage(null);

    const result = await getShipmentsByDeliveryNumber(targetDeliveryNo, selectedFileId);

    if (result.success && result.data && result.data.length > 0) {
      const records = result.data as ShipmentData[];
      
      // CRITICAL: Eğer Global Moddaysa ve kayıt bulunduysa, otomatik olarak o dosyayı seç
      if (!selectedFileId && records[0].file_id) {
        setSelectedFileId(records[0].file_id);
      }

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

  // DOSYA YÖNETİMİ & SİLME FONKSİYONLARI
  const deleteSelectedFile = async () => {
    if (!selectedFileId) return;
    const currentFile = files.find(f => f.id === selectedFileId);
    
    const confirmDelete = window.confirm(`DİKKAT: "${currentFile?.filename}" isimli çalışma profili kalıcı olarak silinecektir. Onaylıyor musunuz?`);
    if (!confirmDelete) return;

    setLoading(true);
    const result = await deleteArasFile(selectedFileId); 
    if (result.success) {
      triggerFeedback("success", "PROFİL SİLİNDİ!");
      setSelectedFileId("");
      fetchInitialData();
    } else {
      triggerFeedback("error", "SİLME İŞLEMİ BAŞARISIZ!");
    }
    setLoading(false);
  };

  const handleGlobalWipe = async () => {
    setLoading(true);
    const result = await deleteArasFile(""); // Boş gönderildiğinde global wipe
    if (result.success) {
      triggerFeedback("success", "TÜM VERİTABANI SIFIRLANDI!");
      setIsWipeModalOpen(false);
      handleCancel();
      setSelectedFileId("");
      fetchInitialData();
    } else {
      triggerFeedback("error", "SIFIRLAMA BAŞARISIZ!");
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
      ? `ARAS_CIKTI_PROFIL_${selectedFileId}_${new Date().toISOString().split("T")[0]}.csv` 
      : `ARAS_CIKTI_TUMU_${new Date().toISOString().split("T")[0]}.csv`;
    
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
      case "success": return "bg-green-50/50 border-green-500 shadow-sm";
      case "error": return "bg-red-50/50 border-red-500 shadow-sm";
      case "update": return "bg-blue-50/50 border-blue-500 shadow-sm"; 
      case "warning": return "bg-orange-50/50 border-orange-500 shadow-sm";
      default: return "bg-white border-slate-200 shadow-sm";
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
      className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 bg-slate-50 hover:bg-[#dc3545] text-slate-500 hover:text-white border-l border-slate-200 hover:border-[#dc3545] transition-colors focus:outline-none rounded-r-md"
      title="Kopyala"
    >
      {copiedField === fieldId ? (
        <CheckCircle2 className="w-5 h-5 text-green-600 hover:text-white" />
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
      )}
    </button>
  );

  const progressPercent = stats.totalRecords > 0 ? Math.round((stats.processed / stats.totalRecords) * 100) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <>
      <div className="w-full flex flex-col gap-6 pb-12 font-['Quicksand'] animate-in fade-in duration-300">
        
        {/* 1. DARK-INDUSTRIAL KOMUTA MERKEZİ BAŞLIĞI */}
        <div className="bg-slate-900 rounded-md p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 shadow-lg border-b-4 border-[#dc3545]">
          
          <div className="flex items-center gap-4">
            <div className="bg-[#dc3545]/20 p-3 rounded-md border border-[#dc3545]/30">
              <PackageSearch className="text-[#dc3545] w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-widest uppercase flex items-center gap-2">
                EKSİK PARÇA <span className="text-[#dc3545]">B2C</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">
                Kargo Modülü - Hızlı Barkod Eşleştirme
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            {/* Native Select ile Profil Seçimi (Z-index hatası yaratmaz, endüstriyel durur) */}
            <div className="relative flex-1 sm:w-72 xl:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
              </div>
              <select
                value={selectedFileId}
                onChange={(e) => setSelectedFileId(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-md focus:outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] appearance-none cursor-pointer transition-colors"
              >
                <option value="">TÜM DOSYALARDA ÇALIŞ (GLOBAL)</option>
                {files.map(f => (
                  <option key={f.id} value={f.id}>{f.filename}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            {/* Seçili Dosyayı Silme Butonu (Sadece dosya seçiliyse görünür) */}
            {selectedFileId && (
              <button 
                onClick={deleteSelectedFile}
                className="h-11 px-4 bg-slate-800 hover:bg-red-900/50 text-[#dc3545] border border-slate-700 hover:border-[#dc3545]/50 rounded-md flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors shadow-sm shrink-0"
                title="Seçili Profili Sil"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">PROFİLİ SİL</span>
              </button>
            )}

            {/* Yeni Yükleme Butonu */}
            <button 
              onClick={() => setIsExcelOpen(true)}
              className="h-11 px-5 bg-[#dc3545] hover:bg-red-700 text-white rounded-md flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors shadow-sm shrink-0"
            >
              <UploadCloud className="w-4 h-4" />
              YENİ YÜKLE
            </button>
          </div>
        </div>

        {/* 2. DASHBOARD VE ÇIKTI BÖLÜMÜ (Yatay Grid) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          
          {/* İstatistikler */}
          <div className="col-span-1 xl:col-span-9 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-md p-3 flex items-center gap-4 shadow-sm relative overflow-hidden group">
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                  <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="text-[#dc3545] transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-xs font-black text-slate-800">%{progressPercent}</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">İlerleme</span>
                <span className="text-sm font-black text-slate-800">DURUM</span>
              </div>
            </div>

            <div className="bg-white rounded-md p-4 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-12 h-12 bg-slate-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Activity className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Toplam Kayıt</span>
              </div>
              <span className="text-xl font-black text-slate-800">{stats.totalRecords.toLocaleString("tr-TR")}</span>
            </div>

            <div className="bg-white rounded-md p-4 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-12 h-12 bg-green-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <PackageCheck className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-widest">İşlenen</span>
              </div>
              <span className="text-xl font-black text-slate-800">{stats.processed.toLocaleString("tr-TR")}</span>
            </div>

            <div className="bg-white rounded-md p-4 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-12 h-12 bg-orange-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center gap-2 text-orange-500 mb-1">
                <PackageOpen className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Kalan İşlem</span>
              </div>
              <span className="text-xl font-black text-slate-800">{stats.remaining.toLocaleString("tr-TR")}</span>
            </div>

            <div className="bg-white rounded-md p-4 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-12 h-12 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center gap-2 text-blue-500 mb-1">
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Bugün (İşlem)</span>
              </div>
              <span className="text-xl font-black text-slate-800">{stats.today.toLocaleString("tr-TR")}</span>
            </div>
          </div>

          {/* Çıktı İşlemleri & Sıfırlama */}
          <div className="col-span-1 xl:col-span-3 flex flex-col gap-3 justify-center">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={exportTwoColumnExcel}
                className="h-10 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                2 KOLON ÇIKTI
              </button>
              <button 
                onClick={exportExactOriginalExcel}
                className="h-10 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                TAM ÇIKTI
              </button>
            </div>
            <button 
              onClick={() => setIsWipeModalOpen(true)}
              className="h-10 w-full bg-red-50 hover:bg-red-100 text-[#dc3545] border border-red-200 rounded-md flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              TÜM VERİTABANINI SIFIRLA
            </button>
          </div>
        </div>

        {/* 3. İŞLEM BÖLGESİ (BARKOD OKUMA) */}
        <div className={`border transition-all duration-300 p-5 sm:p-8 flex flex-col gap-6 rounded-md ${getContainerStyles()} w-full min-w-0 bg-white`}>
          
          {statusMessage && (
            <div className={`p-4 text-sm font-bold uppercase tracking-widest border animate-in fade-in rounded-md break-words shadow-sm ${
              uiStatus === "error" ? "bg-red-50 text-red-700 border-red-200" :
              uiStatus === "update" ? "bg-blue-50 text-blue-700 border-blue-200" :
              uiStatus === "warning" ? "bg-orange-50 text-orange-700 border-orange-200" :
              "bg-green-50 text-green-700 border-green-200"
            }`}>
              {statusMessage}
            </div>
          )}

          {/* ADIM 1: SİPARİŞ / DELIVERY NO */}
          <div className={`transition-opacity duration-300 ${activeGroup ? "opacity-40 pointer-events-none" : "opacity-100"} w-full`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold">1</span>
              <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">
                SİPARİŞ VEYA DELIVERY NO
              </label>
            </div>
            <form onSubmit={handleDeliveryScan} className="flex flex-col sm:flex-row gap-3 w-full">
              <input
                ref={deliveryRef}
                type="text"
                value={deliveryNo}
                onChange={(e) => setDeliveryNo(e.target.value)}
                disabled={loading || activeGroup !== null}
                className="flex-1 h-14 bg-slate-50 border border-slate-200 px-5 py-3 text-lg font-bold  text-slate-900 rounded-md focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#dc3545]/20 focus:border-[#dc3545] disabled:bg-slate-100 uppercase placeholder:text-slate-400 transition-all"
                placeholder={selectedFileId ? "Sadece seçili dosyada ara..." : "Barkod okut veya yaz (Otomatik dosya seçimi aktiftir)..."}
                autoComplete="off"
              />
              <button 
                type="submit" 
                disabled={loading || !deliveryNo.trim() || activeGroup !== null}
                className="w-full sm:w-48 h-14 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm uppercase tracking-widest rounded-md transition-colors shadow-sm"
              >
                SORGULA
              </button>
            </form>
          </div>

          {/* ADIM 2: AKTİF SİPARİŞ DETAYLARI & EŞLEŞTİRME */}
          {activeGroup && (
            <div className="flex flex-col gap-0 animate-in slide-in-from-bottom-4 fade-in duration-300 bg-white border border-slate-200 shadow-sm rounded-md w-full min-w-0 mt-2 overflow-hidden">
              <div className={`h-1.5 w-full ${activeGroup.isUpdateMode ? 'bg-blue-500' : 'bg-[#dc3545]'}`}></div>

              {/* KPI HEADER */}
              <div className="bg-slate-50/50 border-b border-slate-100 p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-md px-4 py-2 shrink-0 shadow-sm">
                  <span className="bg-slate-100 text-slate-900 px-3 py-1 font-black text-lg rounded-sm">{activeGroup.count}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">KALEM<br/>SİPARİŞ</span>
                </div>
                
                {activeGroup.sdDocumentsMatch ? (
                  <div className="flex-1 flex items-center gap-3 bg-green-50/50 border border-green-200 rounded-md px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest truncate mb-0.5">SD DOCUMENT (TAM EŞLEŞME)</p>
                      <p className="text-sm font-semibold font-mono text-green-800 truncate">{activeGroup.uniqueSdDocuments[0] || 'KOD YOK'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-3 bg-orange-50/50 border border-orange-200 rounded-md px-4 py-3">
                    <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest truncate mb-0.5">FARKLI SD KODLARI İÇERİYOR</p>
                      <p className="text-xs font-semibold font-mono text-orange-800 break-all">{activeGroup.uniqueSdDocuments.join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* INFO BOARD */}
              <div className="p-5 sm:p-6 w-full border-b border-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 w-full min-w-0">
                  <div className="flex flex-col min-w-0 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ALICI AD SOYAD</p>
                      <div className="flex items-stretch bg-slate-50 border border-slate-200 rounded-md">
                        <span className="flex-1 flex items-center text-sm font-bold text-slate-800 uppercase truncate px-4 py-2.5">{activeGroup.primary.customer_name}</span>
                        <CopyIcon fieldId="name" textToCopy={activeGroup.primary.customer_name} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">İLETİŞİM BİLGİSİ</p>
                      <div className="flex items-stretch bg-slate-50 border border-slate-200 rounded-md">
                        <span className="flex-1 flex items-center text-sm font-semibold font-mono text-slate-700 truncate px-4 py-2.5">{activeGroup.primary.mobile_number}</span>
                        <CopyIcon fieldId="phone" textToCopy={formatPhoneForCopy(activeGroup.primary.mobile_number)} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col min-w-0 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ŞEHİR / BÖLGE</p>
                      <div className="flex items-stretch bg-slate-50 border border-slate-200 rounded-md">
                        <span className="flex-1 flex items-center text-sm font-bold text-slate-800 uppercase truncate px-4 py-2.5">
                          {activeGroup.primary.city} / {activeGroup.primary.region}
                        </span>
                        <CopyIcon fieldId="cityRegion" textToCopy={`${activeGroup.primary.city || ''} / ${activeGroup.primary.region || ''}`.trim()} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 h-full">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AÇIK ADRES & POSTA KODU</p>
                      <div className="flex items-stretch bg-slate-50 border border-slate-200 rounded-md flex-1">
                        <span className="flex-1 text-xs font-semibold text-slate-600 uppercase leading-relaxed break-words px-4 py-2.5">
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
              <div className={`${activeGroup.isUpdateMode ? 'bg-blue-50/30' : 'bg-slate-50/50'} p-5 sm:p-6 w-full`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-md text-white text-xs font-bold shadow-sm ${activeGroup.isUpdateMode ? 'bg-blue-500' : 'bg-[#dc3545]'}`}>2</span>
                  <label className={`text-sm font-bold uppercase tracking-widest ${activeGroup.isUpdateMode ? 'text-blue-700' : 'text-[#dc3545]'}`}>
                    {activeGroup.isUpdateMode ? 'KARGO BARKODUNU GÜNCELLE' : 'ARAS KARGO BARKODUNU OKUT'}
                  </label>
                </div>
                <form onSubmit={handleTrackingScan} className="flex flex-col sm:flex-row gap-3 w-full">
                  <input
                    ref={trackingRef}
                    type="text"
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    disabled={loading}
                    className={`flex-1 h-14 bg-white border px-5 text-xl font-bold font-mono text-slate-900 rounded-md focus:outline-none focus:ring-2 uppercase placeholder:text-slate-300 transition-all shadow-sm ${activeGroup.isUpdateMode ? 'border-blue-300 focus:ring-blue-500/20 focus:border-blue-500' : 'border-slate-300 focus:ring-[#dc3545]/20 focus:border-[#dc3545]'}`}
                    placeholder={activeGroup.isUpdateMode ? "Yeni barkod..." : "Kargo barkodu..."}
                    autoComplete="off"
                  />
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button 
                      type="submit" 
                      disabled={loading || !trackingNo.trim()}
                      className={`w-full sm:w-40 h-14 px-8 text-white font-bold text-sm uppercase tracking-widest transition-all rounded-md shadow-sm ${activeGroup.isUpdateMode ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300' : 'bg-[#dc3545] hover:bg-red-700 disabled:bg-red-300'}`}
                    >
                      {activeGroup.isUpdateMode ? 'GÜNCELLE' : 'KAYDET'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleCancel}
                      disabled={loading}
                      className="w-full sm:w-auto h-14 px-6 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-widest transition-colors border border-slate-200 rounded-md shadow-sm"
                    >
                      İPTAL
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALLAR */}
      <ExcelUploadDrawer 
        isOpen={isExcelOpen} 
        onClose={() => {
          setIsExcelOpen(false);
          fetchInitialData(); 
        }} 
        employeeId={employeeId} 
      />

      {isWipeModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white shadow-2xl w-full max-w-lg rounded-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-50 border-b border-red-100 p-5 sm:p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-md bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#dc3545]" />
              </div>
              <h2 className="text-red-700 font-bold text-base sm:text-lg tracking-widest uppercase">
                Veritabanı Sıfırlama
              </h2>
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-slate-800 font-bold text-base sm:text-lg mb-3">DİKKAT: Veriler kalıcı olarak yok edilecektir!</p>
              <p className="text-slate-500 text-xs sm:text-sm mb-6 sm:mb-8 leading-relaxed">
                Bu işlem geri alınamaz. Sisteme yüklenen TÜM Excel verileri ve yapılan kargo barkod eşleştirmeleri tamamen temizlenecektir.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={handleGlobalWipe} 
                  disabled={loading}
                  className="flex-1 bg-[#dc3545] hover:bg-red-700 text-white font-bold h-12 uppercase tracking-widest rounded-md transition-all disabled:opacity-50 text-xs sm:text-sm shadow-sm"
                >
                  {loading ? "SİLİNİYOR..." : "EVET, ONAYLIYORUM"}
                </button>
                <button 
                  onClick={() => setIsWipeModalOpen(false)} 
                  disabled={loading}
                  className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-bold h-12 uppercase tracking-widest border border-slate-200 rounded-md transition-colors text-xs sm:text-sm shadow-sm"
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