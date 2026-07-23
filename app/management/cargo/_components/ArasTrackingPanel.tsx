"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { 
  getShipmentsByDeliveryNumber, 
  saveArasTracking, 
  getProcessedExportData,
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

  const formatPhoneForCopy = (phone: string | null | undefined) => {
    if (!phone) return "";
    const idx = phone.indexOf('5');
    return idx !== -1 ? phone.substring(idx) : phone;
  };

  // Açık adres, il, ilçe ve posta kodunu tek bir metin bloğunda birleştirir
  const getFullAddress = (shipment: ShipmentData) => {
    const parts = [
      shipment.street,
      shipment.street_2,
      `${shipment.city} / ${shipment.region}`,
      `Posta Kodu: ${shipment.postal_code || "YOK"}`
    ];
    // Boş olan parçaları filtrele ve aralarına boşluk koyarak birleştir
    return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
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
      fetchTodayCount(); // Sayacı anında güncelle
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
      alert("İndirilecek işlenmiş kayıt bulunamadı.");
      return;
    }

    const headers = "Delivery Number;Aras Takip No\n";
    const rows = result.data.map((r: any) => `${r.delivery_number};${r.aras_tracking_number}`).join("\n");
    const csvContent = "\uFEFF" + headers + rows;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ARAS_GUNCEL_CIKTI_${new Date().toISOString().split("T")[0]}.csv`;
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
      className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 bg-slate-100 hover:bg-[#dc3545] text-slate-500 hover:text-white border border-slate-300 transition-colors rounded-none focus:outline-none focus:ring-2 focus:ring-[#dc3545] ml-2"
      title="Kopyala"
    >
      {copiedField === fieldId ? (
        <svg className="w-5 h-5 text-green-600 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
      )}
    </button>
  );

  return (
    <>
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 text-slate-800">
        
        {/* Modern Header & Komuta Merkezi */}
        <div className="bg-white border-2 border-slate-200 border-l-8 border-[#dc3545] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 rounded-none shadow-sm">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <div className="w-20 h-20 shrink-0 bg-slate-50 border-2 border-slate-200 p-1">
              <img 
                src="https://img.magnific.com/premium-vector/two-colorful-building-blocks-are-lying-white-background_96318-192043.jpg?semt=ais_hybrid&w=740&q=80" 
                alt="Lego Eksik Parça" 
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-widest uppercase truncate">
                  LEGO EKSİK PARÇA
                </h1>
                <span className="bg-[#dc3545] text-white text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold">
                  ARAS
                </span>
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-wider text-xs truncate">
                Müşteri Yedek Parça Kargo Operasyonları
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            {/* KPI Modülü - Sadece Toplam Sayı */}
            <div className="flex items-center gap-3 bg-slate-50 border-2 border-slate-200 px-4 py-2 w-full sm:w-auto justify-center">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">BUGÜN İŞLENEN</span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-widest leading-none">SİPARİŞ</span>
              </div>
              <span className="text-2xl font-black text-[#dc3545] leading-none">{todayCount}</span>
            </div>

            <button 
              onClick={() => setIsExcelOpen(true)}
              className="w-full sm:w-auto h-12 bg-slate-800 hover:bg-slate-900 text-white px-5 font-black text-sm uppercase tracking-wider transition-colors flex justify-center items-center gap-2 border-2 border-slate-900 rounded-none shadow-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1h16v-1M12 4v10m-4-4l4 4 4-4"></path></svg>
              <span>YÜKLE</span>
            </button>
            <button 
              onClick={exportTwoColumnExcel}
              className="w-full sm:w-auto h-12 bg-white hover:bg-slate-50 text-[#dc3545] px-5 font-black text-sm uppercase tracking-wider transition-colors flex justify-center items-center gap-2 border-2 border-[#dc3545] rounded-none shadow-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span>ÇIKTI AL (2 KOLON)</span>
            </button>
          </div>
        </div>

        {/* Merkezi Operasyon Modülü */}
        <div className={`w-full shadow-sm border-2 transition-colors duration-200 p-6 sm:p-8 flex flex-col gap-6 rounded-none ${getContainerStyles()}`}>
          
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
            <label className="block text-sm font-black text-slate-600 uppercase tracking-widest mb-3 border-b-2 border-slate-200 pb-2">
              1. ADIM: SİPARİŞ / DELIVERY NO
            </label>
            <form onSubmit={handleDeliveryScan} className="flex flex-col sm:flex-row gap-3 w-full">
              <input
                ref={deliveryRef}
                type="text"
                value={deliveryNo}
                onChange={(e) => setDeliveryNo(e.target.value)}
                disabled={loading || activeGroup !== null}
                className="flex-1 h-14 bg-white border-2 border-slate-300 px-4 text-xl font-black font-mono text-slate-900 focus:outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] disabled:bg-slate-100 rounded-none uppercase placeholder:text-slate-300"
                placeholder="BARKOD OKUTUNUZ"
                autoComplete="off"
              />
              <button 
                type="submit" 
                disabled={loading || !deliveryNo.trim() || activeGroup !== null}
                className="w-full sm:w-auto h-14 px-10 bg-[#dc3545] hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-lg uppercase tracking-widest transition-colors rounded-none border-2 border-red-800 shrink-0"
              >
                SORGULA
              </button>
            </form>
          </div>

          {/* ADIM 2: Aktif Sipariş Detayları */}
          {activeGroup && (
            <div className="flex flex-col gap-0 animate-in slide-in-from-bottom-2 fade-in duration-200 bg-white border-2 border-slate-300 shadow-sm relative rounded-none w-full min-w-0">
              <div className="absolute top-0 left-0 w-[6px] h-full bg-[#dc3545]"></div>

              {/* SD Document Analizi Lojiği */}
              <div className="bg-slate-50 border-b-2 border-slate-200 p-4 pl-6 sm:pl-8">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-3 bg-white border-2 border-slate-200 px-4 py-2 shrink-0">
                    <span className="bg-[#dc3545] text-white px-3 py-1 font-black text-lg">{activeGroup.count}</span>
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-tight">KALEM<br/>BULUNDU</span>
                  </div>
                  
                  {activeGroup.sdDocumentsMatch ? (
                    <div className="flex-1 flex items-center gap-3 bg-green-50 border-2 border-green-500 px-4 py-2">
                      <svg className="w-8 h-8 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-green-700 uppercase tracking-widest truncate">SD DOCUMENT: TÜMÜ EŞLEŞİYOR</p>
                        <p className="text-sm font-black font-mono text-green-900 truncate">{activeGroup.uniqueSdDocuments[0] || 'KOD YOK'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-3 bg-orange-50 border-2 border-orange-500 px-4 py-2">
                      <svg className="w-8 h-8 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest truncate">DİKKAT: FARKLI SD DOCUMENT KODLARI</p>
                        <p className="text-xs font-bold font-mono text-orange-900 break-all">{activeGroup.uniqueSdDocuments.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Müşteri ve Adres Detayları (2 Kolon) */}
              <div className="p-5 sm:p-6 pl-6 sm:pl-8 w-full border-b-2 border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-0">
                  
                  {/* Sol Kolon: Alıcı Bilgisi */}
                  <div className="flex flex-col min-w-0 gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ad Soyad</p>
                      <div className="flex items-stretch justify-between bg-white border border-slate-200 p-2">
                        <span className="flex items-center text-sm font-black text-slate-900 uppercase truncate px-1">{activeGroup.primary.customer_name}</span>
                        <CopyIcon fieldId="name" textToCopy={activeGroup.primary.customer_name} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Telefon Numarası</p>
                      <div className="flex items-stretch justify-between bg-white border border-slate-200 p-2">
                        <span className="flex items-center text-sm font-bold font-mono text-slate-700 truncate px-1">{activeGroup.primary.mobile_number}</span>
                        <CopyIcon fieldId="phone" textToCopy={formatPhoneForCopy(activeGroup.primary.mobile_number)} />
                      </div>
                    </div>
                  </div>

                  {/* Sağ Kolon: Birleşik Teslimat Adresi */}
                  <div className="flex flex-col min-w-0 gap-1 h-full">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tam Teslimat Adresi & Posta Kodu</p>
                    <div className="flex items-stretch justify-between bg-white border border-slate-200 p-2 flex-1">
                      <span className="text-sm font-bold text-slate-800 uppercase leading-relaxed break-words px-1">
                        {getFullAddress(activeGroup.primary)}
                      </span>
                      <div className="flex items-start">
                        <CopyIcon fieldId="fullAddress" textToCopy={getFullAddress(activeGroup.primary)} />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Barkod Eşleştirme Aksiyonu */}
              <div className="bg-slate-50 p-5 sm:p-6 pl-6 sm:pl-8 w-full">
                <label className="block text-sm font-black text-[#dc3545] uppercase tracking-widest mb-3 border-b-2 border-red-200 pb-2">
                  2. ADIM: ARAS KARGO BARKODU
                </label>
                <form onSubmit={handleTrackingScan} className="flex flex-col sm:flex-row gap-3 w-full">
                  <input
                    ref={trackingRef}
                    type="text"
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    disabled={loading}
                    className="flex-1 h-14 bg-white border-2 border-[#dc3545] px-4 text-xl font-black font-mono text-slate-900 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600 rounded-none uppercase placeholder:text-red-200"
                    placeholder="TAKİP NO OKUTUNUZ"
                    autoComplete="off"
                  />
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
                    <button 
                      type="submit" 
                      disabled={loading || !trackingNo.trim()}
                      className="w-full sm:w-auto h-14 px-10 bg-[#dc3545] hover:bg-red-700 disabled:bg-red-300 text-white font-black text-lg uppercase tracking-widest transition-colors rounded-none border-2 border-red-800"
                    >
                      KAYDET
                    </button>
                    <button 
                      type="button"
                      onClick={handleCancel}
                      disabled={loading}
                      className="w-full sm:w-auto h-14 px-6 bg-slate-300 hover:bg-slate-400 text-slate-800 font-black text-sm uppercase tracking-widest transition-colors rounded-none border-2 border-slate-400"
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

      <ExcelUploadDrawer 
        isOpen={isExcelOpen} 
        onClose={() => setIsExcelOpen(false)} 
        employeeId={employeeId} 
      />
    </>
  );
}