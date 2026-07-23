"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { 
  getShipmentsByDeliveryNumber, 
  saveArasTracking, 
  getProcessedExportData,
  getExactOriginalExportData,
  getTodayProcessedCount
} from "@/app/actions/aras-integration";
import ExcelUploadDrawer from "./ExcelUploadDrawer";

interface ArasTrackingPanelProps {
  employeeId: string;
}

interface ShipmentData {
  id: string;
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
}

export default function ArasTrackingPanel({ employeeId }: ArasTrackingPanelProps) {
  const [isExcelOpen, setIsExcelOpen] = useState(false);

  const [deliveryNo, setDeliveryNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  
  const [activeGroup, setActiveGroup] = useState<ActiveGroupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState<number>(0);
  
  const [uiStatus, setUiStatus] = useState<"idle" | "success" | "error" | "warning">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const deliveryRef = useRef<HTMLInputElement>(null);
  const trackingRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTodayCount();
  }, []);

  useEffect(() => {
    if (!isExcelOpen) deliveryRef.current?.focus();
  }, [isExcelOpen]);

  useEffect(() => {
    if (uiStatus === "success" || uiStatus === "error") {
      const timer = setTimeout(() => setUiStatus("idle"), 2500);
      return () => clearTimeout(timer);
    }
  }, [uiStatus]);

  const fetchTodayCount = async () => {
    const res = await getTodayProcessedCount();
    if (res.success) setTodayCount(res.count);
  };

  const triggerFeedback = (status: "success" | "error" | "warning", msg: string) => {
    setUiStatus(status);
    setStatusMessage(msg);
  };

  const handleCopy = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000); 
  };

  // Telefonu '5' rakamından kesecek özel formatlayıcı
  const formatPhoneForCopy = (phone: string | null | undefined) => {
    if (!phone) return "";
    const idx = phone.indexOf('5');
    return idx !== -1 ? phone.substring(idx) : phone;
  };

  const handleDeliveryScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!deliveryNo.trim() || loading) return;

    setLoading(true);
    setUiStatus("idle");
    setStatusMessage(null);

    const result = await getShipmentsByDeliveryNumber(deliveryNo.trim());

    if (result.success && result.data && result.data.length > 0) {
      const records = result.data as ShipmentData[];
      const alreadyProcessed = records.find(r => r.is_processed_aras);
      
      if (alreadyProcessed) {
        triggerFeedback("warning", `İHLAL: ${deliveryNo} siparişi eşleştirilmiş! (Takip: ${alreadyProcessed.aras_tracking_number})`);
        setDeliveryNo("");
        deliveryRef.current?.focus();
      } else {
        const sdDocuments = records.map(r => r.sd_document).filter(Boolean);
        const uniqueSdDocuments = Array.from(new Set(sdDocuments));
        const sdDocumentsMatch = uniqueSdDocuments.length <= 1;

        setActiveGroup({
          records,
          count: records.length,
          primary: records[0],
          sdDocumentsMatch,
          uniqueSdDocuments
        });
        
        setTimeout(() => trackingRef.current?.focus(), 50);
      }
    } else {
      triggerFeedback("error", "SİPARİŞ BULUNAMADI! BARKODU KONTROL EDİN.");
      setDeliveryNo("");
      deliveryRef.current?.focus();
    }
    setLoading(false);
  };

  const handleTrackingScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !trackingNo.trim() || loading) return;

    setLoading(true);
    const result = await saveArasTracking(activeGroup.primary.delivery_number, trackingNo.trim(), employeeId);

    if (result.success) {
      triggerFeedback("success", `EŞLEŞTİRME BAŞARILI: ${activeGroup.primary.customer_name}`);
      setActiveGroup(null);
      setDeliveryNo("");
      setTrackingNo("");
      fetchTodayCount(); // KPI Sayacını Anında Güncelle
      setTimeout(() => deliveryRef.current?.focus(), 50);
    } else {
      triggerFeedback("error", "VERİTABANI YAZMA HATASI!");
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
    deliveryRef.current?.focus();
  };

  const exportTwoColumnExcel = async () => {
    const result = await getProcessedExportData();
    if (!result.success || !result.data || result.data.length === 0) {
      alert("İndirilecek kayıt bulunamadı.");
      return;
    }
    const headers = "Delivery Number;Aras Takip No\n";
    const rows = result.data.map((r: any) => `${r.delivery_number};${r.aras_tracking_number}`).join("\n");
    downloadBlob("\uFEFF" + headers + rows, `ARAS_IKILI_CIKTI_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const exportExactOriginalExcel = async () => {
    const result = await getExactOriginalExportData();
    if (!result.success || !result.data || result.data.length === 0) {
      alert("İndirilecek kayıt bulunamadı.");
      return;
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

    downloadBlob("\uFEFF" + headerRow + rows, `ORIJINAL_SABLON_CIKTI_${new Date().toISOString().split("T")[0]}.csv`);
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

  const getContainerStyles = () => {
    switch (uiStatus) {
      case "success": return "bg-green-50 border-green-500";
      case "error": return "bg-red-50 border-red-500";
      case "warning": return "bg-orange-50 border-orange-500";
      default: return "bg-white border-slate-300";
    }
  };

  const CopyIcon = ({ fieldId, textToCopy }: { fieldId: string, textToCopy: string }) => (
    <button 
      type="button"
      onClick={() => handleCopy(textToCopy, fieldId)}
      className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 bg-slate-100 hover:bg-[#dc3545] text-slate-500 hover:text-white border border-slate-300 transition-colors rounded-none focus:outline-none focus:ring-2 focus:ring-[#dc3545] ml-2"
      title="Kopyala"
    >
      {copiedField === fieldId ? (
        <svg className="w-4 h-4 text-green-600 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
      )}
    </button>
  );

  return (
    <>
      <div className="w-full flex flex-col gap-6 text-slate-800">
        
        {/* Endüstriyel Header Modülü */}
        <div className="w-full bg-white border-2 border-slate-200 border-l-8 border-[#dc3545] p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-none shadow-sm">
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="w-20 h-20 shrink-0 border-2 border-slate-200 bg-slate-50">
              <img 
                src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdmx4cjJodGhpM2VlbzRlcmZreGQxbHc5cHNjNnlpbDJycXJ4MGg0aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26DOM7YFBRsv7hYze/giphy.gif" 
                alt="Lego Header" 
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-center min-w-0 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-widest uppercase truncate">
                  LEGO EKSİK PARÇA
                </h1>
                <span className="bg-[#dc3545] text-white text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold">
                  ARAS ENT.
                </span>
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-wider text-xs truncate">
                Müşteri Yedek Parça Kargo Operasyonları
              </p>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-center gap-3 w-full lg:w-auto shrink-0 mt-2 lg:mt-0">
            <button 
              onClick={() => setIsExcelOpen(true)}
              className="h-10 bg-slate-800 hover:bg-slate-900 text-white px-4 font-black text-xs uppercase tracking-wider transition-colors flex justify-center items-center gap-2 border-2 border-slate-900 rounded-none shadow-none whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1h16v-1M12 4v10m-4-4l4 4 4-4"></path></svg>
              <span>EXCEL YÜKLE</span>
            </button>
            <button 
              onClick={exportTwoColumnExcel}
              className="h-10 bg-white hover:bg-slate-50 text-[#dc3545] px-4 font-black text-xs uppercase tracking-wider transition-colors flex justify-center items-center gap-2 border-2 border-[#dc3545] rounded-none shadow-none whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span>ÇIKTI (2 KOLON)</span>
            </button>
            <button 
              onClick={exportExactOriginalExcel}
              className="h-10 bg-white hover:bg-slate-50 text-slate-800 px-4 font-black text-xs uppercase tracking-wider transition-colors flex justify-center items-center gap-2 border-2 border-slate-300 rounded-none shadow-none whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              <span>ÇIKTI (TAM)</span>
            </button>
          </div>
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* SOL KOLON: Aktif İşlem Modülü (Daha Kompakt) */}
          <div className={`col-span-1 lg:col-span-8 shadow-sm border-2 transition-colors duration-200 p-5 flex flex-col gap-5 rounded-none ${getContainerStyles()} w-full min-w-0`}>
            
            {statusMessage && (
              <div className={`p-4 text-sm font-black uppercase tracking-widest border-2 shadow-none animate-in fade-in rounded-none break-words ${
                uiStatus === "error" ? "bg-red-50 text-red-700 border-red-500" :
                uiStatus === "warning" ? "bg-orange-50 text-orange-700 border-orange-500" :
                "bg-green-50 text-green-700 border-green-500"
              }`}>
                {statusMessage}
              </div>
            )}

            {/* ADIM 1: Delivery Kodu */}
            <div className={`transition-opacity duration-200 ${activeGroup ? "opacity-30 pointer-events-none" : "opacity-100"} w-full`}>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2 border-b-2 border-slate-200 pb-1">
                1. ADIM: SİPARİŞ / DELIVERY NO
              </label>
              <form onSubmit={handleDeliveryScan} className="flex flex-col sm:flex-row gap-3 w-full">
                <input
                  ref={deliveryRef}
                  type="text"
                  value={deliveryNo}
                  onChange={(e) => setDeliveryNo(e.target.value)}
                  disabled={loading || activeGroup !== null}
                  className="flex-1 h-12 bg-white border-2 border-slate-300 px-4 text-lg font-black font-mono text-slate-900 focus:outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] disabled:bg-slate-100 rounded-none uppercase placeholder:text-slate-300"
                  placeholder="BARKOD OKUTUNUZ"
                  autoComplete="off"
                />
                <button 
                  type="submit" 
                  disabled={loading || !deliveryNo.trim() || activeGroup !== null}
                  className="w-full sm:w-auto h-12 px-8 bg-[#dc3545] hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-sm uppercase tracking-widest transition-colors rounded-none border-2 border-red-800 shrink-0"
                >
                  SORGULA
                </button>
              </form>
            </div>

            {/* ADIM 2: Aktif Sipariş Detayları */}
            {activeGroup && (
              <div className="flex flex-col gap-0 animate-in slide-in-from-bottom-2 fade-in duration-200 bg-white border-2 border-slate-300 shadow-sm relative rounded-none w-full min-w-0">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#dc3545]"></div>

                {/* SD Document Analizi Lojiği */}
                <div className="bg-slate-50 border-b-2 border-slate-200 p-3 pl-5 sm:pl-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center gap-2 bg-white border-2 border-slate-200 px-3 py-1.5 shrink-0">
                      <span className="bg-[#dc3545] text-white px-2 py-0.5 font-black text-sm">{activeGroup.count}</span>
                      <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest leading-tight">KALEM<br/>BULUNDU</span>
                    </div>
                    
                    {activeGroup.sdDocumentsMatch ? (
                      <div className="flex-1 flex items-center gap-2 bg-green-50 border-2 border-green-500 px-3 py-1.5">
                        <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-green-700 uppercase tracking-widest truncate">SD DOCUMENT EŞLEŞİYOR</p>
                          <p className="text-xs font-black font-mono text-green-900 truncate">{activeGroup.uniqueSdDocuments[0] || 'KOD YOK'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center gap-2 bg-orange-50 border-2 border-orange-500 px-3 py-1.5">
                        <svg className="w-5 h-5 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest truncate">FARKLI SD KODLARI VAR</p>
                          <p className="text-xs font-bold font-mono text-orange-900 break-all">{activeGroup.uniqueSdDocuments.join(', ')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Müşteri ve Adres Detayları Panosu */}
                <div className="p-4 sm:p-5 pl-5 sm:pl-6 w-full border-b-2 border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 w-full min-w-0">
                    
                    {/* Sol Kolon */}
                    <div className="flex flex-col min-w-0 gap-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ad Soyad</p>
                        <div className="flex items-stretch justify-between bg-slate-50 border border-slate-200 p-1.5">
                          <span className="flex items-center text-sm font-black text-slate-900 uppercase truncate px-1">{activeGroup.primary.customer_name}</span>
                          <CopyIcon fieldId="name" textToCopy={activeGroup.primary.customer_name} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Telefon Numarası</p>
                        <div className="flex items-stretch justify-between bg-slate-50 border border-slate-200 p-1.5">
                          <span className="flex items-center text-sm font-bold font-mono text-slate-700 truncate px-1">{activeGroup.primary.mobile_number}</span>
                          <CopyIcon fieldId="phone" textToCopy={formatPhoneForCopy(activeGroup.primary.mobile_number)} />
                        </div>
                      </div>
                    </div>

                    {/* Sağ Kolon */}
                    <div className="flex flex-col min-w-0 gap-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">İl / İlçe</p>
                        <div className="flex items-stretch justify-between bg-slate-50 border border-slate-200 p-1.5">
                          <span className="flex items-center text-sm font-black text-slate-900 uppercase truncate px-1">
                            {activeGroup.primary.city} / {activeGroup.primary.region}
                          </span>
                          <CopyIcon fieldId="cityRegion" textToCopy={`${activeGroup.primary.city || ''} / ${activeGroup.primary.region || ''}`.trim()} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 h-full">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Açık Adres & Posta Kodu</p>
                        <div className="flex items-stretch justify-between bg-slate-50 border border-slate-200 p-1.5 flex-1">
                          <span className="text-xs font-bold text-slate-800 uppercase leading-snug break-words px-1">
                            {`${activeGroup.primary.street || ""} ${activeGroup.primary.street_2 || ""} - Posta Kodu: ${activeGroup.primary.postal_code || "YOK"}`.trim()}
                          </span>
                          <div className="flex items-start">
                            <CopyIcon fieldId="fullAddress" textToCopy={`${activeGroup.primary.street || ""} ${activeGroup.primary.street_2 || ""} - Posta Kodu: ${activeGroup.primary.postal_code || "YOK"}`.trim()} />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Barkod Eşleştirme Aksiyonu */}
                <div className="bg-slate-100 p-4 sm:p-5 pl-5 sm:pl-6 w-full">
                  <label className="block text-xs font-black text-[#dc3545] uppercase tracking-widest mb-2 border-b-2 border-red-200 pb-1">
                    2. ADIM: ARAS KARGO BARKODU
                  </label>
                  <form onSubmit={handleTrackingScan} className="flex flex-col sm:flex-row gap-3 w-full">
                    <input
                      ref={trackingRef}
                      type="text"
                      value={trackingNo}
                      onChange={(e) => setTrackingNo(e.target.value)}
                      disabled={loading}
                      className="flex-1 h-12 bg-white border-2 border-[#dc3545] px-4 text-xl font-black font-mono text-slate-900 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600 rounded-none uppercase placeholder:text-red-200"
                      placeholder="TAKİP NO OKUTUNUZ"
                      autoComplete="off"
                    />
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
                      <button 
                        type="submit" 
                        disabled={loading || !trackingNo.trim()}
                        className="w-full sm:w-auto h-12 px-8 bg-[#dc3545] hover:bg-red-700 disabled:bg-red-300 text-white font-black text-sm uppercase tracking-widest transition-colors rounded-none border-2 border-red-800"
                      >
                        KAYDET
                      </button>
                      <button 
                        type="button"
                        onClick={handleCancel}
                        disabled={loading}
                        className="w-full sm:w-auto h-12 px-6 bg-slate-300 hover:bg-slate-400 text-slate-800 font-black text-xs uppercase tracking-widest transition-colors rounded-none border-2 border-slate-400"
                      >
                        İPTAL
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* SAĞ KOLON: Bilgi ve Durum Paneli (Info Card) */}
          <div className="col-span-1 lg:col-span-4 flex flex-col gap-6 w-full h-full">
            
            {/* Animasyonlu Bilgi Panosu */}
            <div className="bg-white shadow-sm border-2 border-slate-300 rounded-none overflow-hidden flex flex-col">
              <div className="w-full h-48 sm:h-56 bg-slate-100 border-b-2 border-slate-300 relative">
                <img 
                  src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExczdxczR1bmp5cWNkYWx0MmV2b2xnZjB3MGJ0MHhsN2E2NTJvbGhqNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/yIYjkho5rKpVY7QzrU/giphy.gif" 
                  alt="Status Animation" 
                  className="w-full h-full object-cover opacity-90 mix-blend-multiply"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-1">SİSTEM DURUMU</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Eksik Parça Kargo Operasyon Modülü</p>
                </div>
                <div className="flex flex-col gap-2 border-t-2 border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">API Bağlantısı</span>
                    <span className="text-green-600 bg-green-50 px-2 py-0.5 border border-green-200">AKTİF</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Veritabanı Senk.</span>
                    <span className="text-green-600 bg-green-50 px-2 py-0.5 border border-green-200">AKTİF</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI İstatistik Kartı */}
            <div className="bg-white shadow-sm border-2 border-slate-300 rounded-none p-5 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#dc3545] opacity-10 rounded-full blur-xl"></div>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">BUGÜN İŞLENEN TEKİL SİPARİŞ</span>
              <span className="text-5xl font-black font-mono text-[#dc3545] drop-shadow-sm">{todayCount}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 border-t-2 border-slate-100 pt-2 w-full">Terminalde Anlık Güncellenir</span>
            </div>

          </div>

        </div>
      </div>

      <ExcelUploadDrawer 
        isOpen={isExcelOpen} 
        onClose={() => setIsExcelOpen(false)} 
        employeeId={employeeId} 
      />
    </>
  );
}