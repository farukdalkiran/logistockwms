"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { 
  getShipmentByDeliveryNumber, 
  saveArasTracking, 
  getProcessedExportData 
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
  aras_tracking_number: string | null;
  is_processed_aras: boolean;
}

export default function ArasTrackingPanel({ employeeId }: ArasTrackingPanelProps) {
  const [isExcelOpen, setIsExcelOpen] = useState(false);

  const [deliveryNo, setDeliveryNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  
  const [activeShipment, setActiveShipment] = useState<ShipmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<ShipmentData[]>([]);
  
  const [uiStatus, setUiStatus] = useState<"idle" | "success" | "error" | "warning">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  // Kopyalama işlemi için görsel geribildirim state'i
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const deliveryRef = useRef<HTMLInputElement>(null);
  const trackingRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isExcelOpen) deliveryRef.current?.focus();
  }, [isExcelOpen]);

  useEffect(() => {
    if (uiStatus === "success" || uiStatus === "error") {
      const timer = setTimeout(() => setUiStatus("idle"), 2500);
      return () => clearTimeout(timer);
    }
  }, [uiStatus]);

  const triggerFeedback = (status: "success" | "error" | "warning", msg: string) => {
    setUiStatus(status);
    setStatusMessage(msg);
  };

  // Tek Tıkla Kopyalama Fonksiyonu
  const handleCopy = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000); 
  };

  const handleDeliveryScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!deliveryNo.trim() || loading) return;

    setLoading(true);
    setUiStatus("idle");
    setStatusMessage(null);

    const result = await getShipmentByDeliveryNumber(deliveryNo.trim());

    if (result.success && result.data) {
      if (result.data.is_processed_aras) {
        triggerFeedback("warning", `İHLAL: ${deliveryNo} numaralı sipariş daha önce eşleştirilmiş! (Takip: ${result.data.aras_tracking_number})`);
        setDeliveryNo("");
        deliveryRef.current?.focus();
      } else {
        setActiveShipment(result.data);
        setTimeout(() => trackingRef.current?.focus(), 50);
      }
    } else {
      triggerFeedback("error", "SİPARİŞ BULUNAMADI! BARKODU VEYA EXCEL'İ KONTROL EDİN.");
      setDeliveryNo("");
      deliveryRef.current?.focus();
    }
    setLoading(false);
  };

  const handleTrackingScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeShipment || !trackingNo.trim() || loading) return;

    setLoading(true);
    const result = await saveArasTracking(activeShipment.id, trackingNo.trim(), employeeId);

    if (result.success) {
      triggerFeedback("success", `EŞLEŞTİRME BAŞARILI: ${activeShipment.customer_name}`);
      setRecentScans(prev => [{...activeShipment, aras_tracking_number: trackingNo.trim(), is_processed_aras: true}, ...prev].slice(0, 8));
      setActiveShipment(null);
      setDeliveryNo("");
      setTrackingNo("");
      setTimeout(() => deliveryRef.current?.focus(), 50);
    } else {
      triggerFeedback("error", "VERİTABANI YAZMA HATASI!");
      trackingRef.current?.focus();
    }
    
    setLoading(false);
  };

  const handleCancel = () => {
    setActiveShipment(null);
    setTrackingNo("");
    setDeliveryNo("");
    setUiStatus("idle");
    setStatusMessage(null);
    deliveryRef.current?.focus();
  };

  const exportToExcel = async () => {
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
    link.download = `LEGO_Eksik_Parca_Kargo_${new Date().toISOString().split("T")[0]}.csv`;
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

  // Kopyalama İkonu Bileşeni
  const CopyIcon = ({ fieldId, textToCopy }: { fieldId: string, textToCopy: string }) => (
    <button 
      type="button"
      onClick={() => handleCopy(textToCopy, fieldId)}
      className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 hover:bg-[#dc3545] text-slate-500 hover:text-white border border-slate-300 transition-colors rounded-none focus:outline-none focus:ring-2 focus:ring-[#dc3545] ml-2"
      title="Kopyala"
    >
      {copiedField === fieldId ? (
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
      ) : (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
      )}
    </button>
  );

  return (
    <>
      <div className="w-full flex flex-col gap-6 text-slate-800">
        
        {/* Modern Aydınlık Tematik Header (Sıfır Taşma) */}
        <div className="w-full bg-white border-2 border-slate-200 border-l-8 border-[#dc3545] p-4 flex flex-col md:flex-row items-start md:items-center gap-4 rounded-none shadow-sm">
          
          {/* Kare Görsel Modülü */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-slate-50 border-2 border-slate-200 p-1">
            <img 
              src="https://img.magnific.com/premium-vector/two-colorful-building-blocks-are-lying-white-background_96318-192043.jpg?semt=ais_hybrid&w=740&q=80" 
              alt="Lego Eksik Parça" 
              className="w-full h-full object-cover"
            />
          </div>

          {/* Başlık ve Info Box */}
          <div className="flex-1 min-w-0 flex flex-col justify-center w-full">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-widest uppercase truncate">
                LEGO EKSİK PARÇA TERMİNALİ
              </h1>
              <span className="bg-[#dc3545] text-white text-[10px] sm:text-xs px-2 py-1 uppercase tracking-widest font-bold">
                ARAS ENT.
              </span>
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-wider text-xs sm:text-sm truncate">
              Müşteri Yedek Parça Kargo Operasyonları
            </p>
          </div>
          
          {/* Aksiyon Butonları (Mobil Uyumlu) */}
          <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => setIsExcelOpen(true)}
              className="w-full sm:w-auto min-h-[48px] bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 font-black uppercase tracking-wider transition-colors flex justify-center items-center gap-2 border-2 border-slate-300 rounded-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M4 16v1h16v-1M12 4v10m-4-4l4 4 4-4"></path></svg>
              <span>EXCEL YÜKLE</span>
            </button>
            <button 
              onClick={exportToExcel}
              className="w-full sm:w-auto min-h-[48px] bg-white hover:bg-slate-50 text-[#dc3545] px-6 font-black uppercase tracking-wider transition-colors flex justify-center items-center gap-2 border-2 border-[#dc3545] rounded-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <span>GÜN SONU (CSV)</span>
            </button>
          </div>
        </div>

        {/* Ana İçerik Grid Yapısı */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* SOL KOLON: Aktif İşlem Modülü */}
          <div className={`col-span-1 lg:col-span-8 shadow-sm border-2 transition-colors duration-200 p-5 lg:p-6 flex flex-col gap-6 rounded-none ${getContainerStyles()} w-full min-w-0`}>
            
            {statusMessage && (
              <div className={`p-4 text-sm sm:text-base font-black uppercase tracking-widest border-2 shadow-none animate-in fade-in rounded-none break-words ${
                uiStatus === "error" ? "bg-red-50 text-red-700 border-red-500" :
                uiStatus === "warning" ? "bg-orange-50 text-orange-700 border-orange-500" :
                "bg-green-50 text-green-700 border-green-500"
              }`}>
                {statusMessage}
              </div>
            )}

            {/* ADIM 1: Delivery Kodu */}
            <div className={`transition-opacity duration-200 ${activeShipment ? "opacity-30 pointer-events-none" : "opacity-100"} w-full`}>
              <label className="block text-sm font-black text-slate-600 uppercase tracking-widest mb-3 border-b-2 border-slate-200 pb-2">
                1. ADIM: SİPARİŞ / DELIVERY NO
              </label>
              <form onSubmit={handleDeliveryScan} className="flex flex-col sm:flex-row gap-3 w-full">
                <input
                  ref={deliveryRef}
                  type="text"
                  value={deliveryNo}
                  onChange={(e) => setDeliveryNo(e.target.value)}
                  disabled={loading || activeShipment !== null}
                  className="flex-1 min-h-[56px] bg-white border-2 border-slate-300 px-4 sm:px-6 text-xl sm:text-2xl font-black text-slate-900 focus:outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] disabled:bg-slate-100 rounded-none shadow-inner uppercase placeholder:text-slate-300 w-full min-w-0"
                  placeholder="BARKOD OKUTUNUZ"
                  autoComplete="off"
                />
                <button 
                  type="submit" 
                  disabled={loading || !deliveryNo.trim() || activeShipment !== null}
                  className="w-full sm:w-auto min-h-[56px] px-8 sm:px-12 bg-[#dc3545] hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-xl uppercase tracking-widest transition-colors rounded-none border-2 border-red-800 shadow-none shrink-0"
                >
                  SORGULA
                </button>
              </form>
            </div>

            {/* ADIM 2: Aktif Sipariş & Takip Kodu Girişi */}
            {activeShipment && (
              <div className="flex flex-col gap-0 animate-in slide-in-from-bottom-2 fade-in duration-200 bg-white border-2 border-slate-300 shadow-sm relative rounded-none w-full min-w-0">
                <div className="absolute top-0 left-0 w-[6px] h-full bg-[#dc3545]"></div>

                {/* Detaylı Müşteri & Lokasyon Paneli */}
                <div className="p-5 sm:p-6 pl-6 sm:pl-8 w-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-0">
                    
                    {/* Alıcı Bilgi Kartı */}
                    <div className="flex flex-col min-w-0 bg-slate-50 border-2 border-slate-200 p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-4 border-b-2 border-slate-200 pb-2">
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">ALICI BİLGİSİ</span>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Ad Soyad</p>
                        <div className="flex items-stretch justify-between bg-white border border-slate-200 p-2 min-h-[44px]">
                          <span className="flex items-center text-base sm:text-lg font-black text-slate-900 uppercase break-words leading-tight truncate px-1">{activeShipment.customer_name}</span>
                          <CopyIcon fieldId="name" textToCopy={activeShipment.customer_name} />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Telefon Numarası</p>
                        <div className="flex items-stretch justify-between bg-white border border-slate-200 p-2 min-h-[44px]">
                          <span className="flex items-center text-sm sm:text-base font-bold font-mono text-slate-700 tracking-tight truncate px-1">{activeShipment.mobile_number}</span>
                          <CopyIcon fieldId="phone" textToCopy={activeShipment.mobile_number} />
                        </div>
                      </div>
                    </div>

                    {/* Lokasyon Bilgi Kartı */}
                    <div className="flex flex-col min-w-0 bg-slate-50 border-2 border-slate-200 p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-4 border-b-2 border-slate-200 pb-2">
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="square" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">TESLİMAT ADRESİ</span>
                      </div>

                      <div className="mb-4">
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Açık Adres & İl/İlçe</p>
                         <div className="flex items-stretch justify-between bg-white border border-slate-200 p-2">
                            <div className="flex flex-col justify-center min-w-0 px-1 py-1">
                               <span className="text-xs sm:text-sm font-bold text-slate-800 uppercase leading-snug break-words">
                                 {activeShipment.street} {activeShipment.street_2}
                               </span>
                               <span className="font-black text-slate-900 text-sm uppercase break-words mt-1">
                                 {activeShipment.city} / {activeShipment.region}
                               </span>
                            </div>
                            <CopyIcon fieldId="address" textToCopy={`${activeShipment.street} ${activeShipment.street_2} ${activeShipment.city} / ${activeShipment.region}`} />
                         </div>
                      </div>

                      <div className="mt-auto">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Posta Kodu</p>
                        <div className="flex items-stretch justify-between bg-white border border-slate-200 p-2 min-h-[44px]">
                          <span className="flex items-center text-sm sm:text-base font-black font-mono text-slate-900 px-1">{activeShipment.postal_code || "YOK"}</span>
                          <CopyIcon fieldId="postal" textToCopy={activeShipment.postal_code || ""} />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Barkod Eşleştirme Aksiyonu */}
                <div className="bg-slate-100 border-t-2 border-slate-300 p-5 sm:p-6 pl-6 sm:pl-8 w-full">
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
                      className="flex-1 min-h-[56px] sm:min-h-[64px] bg-white border-2 border-[#dc3545] px-4 sm:px-6 text-xl sm:text-3xl font-black font-mono text-slate-900 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600 rounded-none shadow-inner placeholder:text-red-200 uppercase w-full min-w-0"
                      placeholder="TAKİP NO OKUTUNUZ"
                      autoComplete="off"
                    />
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
                      <button 
                        type="submit" 
                        disabled={loading || !trackingNo.trim()}
                        className="w-full sm:w-auto min-h-[56px] sm:min-h-[64px] px-8 lg:px-12 bg-[#dc3545] hover:bg-red-700 disabled:bg-red-300 text-white font-black text-xl uppercase tracking-widest transition-colors shadow-none rounded-none border-2 border-red-800"
                      >
                        KAYDET
                      </button>
                      <button 
                        type="button"
                        onClick={handleCancel}
                        disabled={loading}
                        className="w-full sm:w-auto min-h-[56px] sm:min-h-[64px] px-6 lg:px-8 bg-slate-300 hover:bg-slate-400 text-slate-800 font-black text-lg uppercase tracking-widest transition-colors rounded-none border-2 border-slate-400"
                      >
                        İPTAL
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* SAĞ KOLON: Log Terminali */}
          <div className="col-span-1 lg:col-span-4 bg-white shadow-sm border-2 border-slate-300 flex flex-col rounded-none min-h-[400px] w-full">
            <div className="p-4 sm:p-5 border-b-2 border-slate-200 bg-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs sm:text-sm">SON EŞLEŞTİRMELER</h3>
              <span className="bg-[#dc3545] text-white text-xs font-black px-2 py-1 rounded-none border border-red-800">{recentScans.length}</span>
            </div>
            
            <div className="flex-1 p-0 overflow-y-auto bg-slate-50 w-full">
              {recentScans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <svg className="w-10 h-10 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span className="text-xs uppercase tracking-widest font-black">BEKLEMEDE</span>
                </div>
              ) : (
                <ul className="flex flex-col divide-y-2 divide-slate-200 w-full">
                  {recentScans.map((scan, index) => (
                    <li key={scan.id + index} className="p-4 bg-white hover:bg-slate-50 transition-colors animate-in slide-in-from-right-2 fade-in rounded-none min-w-0 border-l-4 border-transparent hover:border-[#dc3545]">
                      <div className="flex flex-col gap-2 mb-3">
                        <span className="font-black text-slate-900 text-sm uppercase leading-tight break-words">{scan.customer_name}</span>
                        <div className="flex items-stretch justify-between">
                           <span className="flex items-center text-xs font-bold text-slate-500 font-mono">
                             DLV: {scan.delivery_number}
                           </span>
                           <CopyIcon fieldId={`dlv-${index}`} textToCopy={scan.delivery_number} />
                        </div>
                      </div>
                      <div className="flex items-stretch justify-between text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 p-1">
                        <span className="flex items-center font-mono pl-2 break-all">TRK: {scan.aras_tracking_number}</span>
                        <CopyIcon fieldId={`trk-${index}`} textToCopy={scan.aras_tracking_number || ""} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
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