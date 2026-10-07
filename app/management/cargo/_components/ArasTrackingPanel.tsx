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
  AlertTriangle,
  Copy,
  MapPin,
  User,
  Phone,
  Building2,
  MapPinned,
  Zap,
  BarChart3
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

  // Profil değiştiğinde dataları güncelle (Otomatik seçimlerde stats'ı da günceller)
  useEffect(() => {
    fetchStats(selectedFileId);
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
      
      // HATA 1 ÇÖZÜMÜ: Global moddaysak ilk gelen datanın ait olduğu dosyayı otomatik seç.
      // DİKKAT: Burada handleProfileChange (içinde iptal fonksiyonu barındıran) yerine, 
      // SADECE state güncelliyoruz ki ekran SİLİNMESİN.
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

  // KULLANICI MANUEL OLARAK DROPDOWN'DAN SEÇİM YAPTIĞINDA ÇALIŞIR
  const handleProfileChange = (newFileId: string) => {
    setSelectedFileId(newFileId);
    handleCancel(); // Sadece MANUEL seçimde ekranı temizle.
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
    const result = await deleteArasFile(""); 
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

  // YARDIMCI FONKSİYONLAR
  const splitName = (fullName: string | null) => {
    if (!fullName) return { first: "", last: "" };
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return { first: parts[0], last: "" };
    const last = parts.pop() || "";
    const first = parts.join(" ");
    return { first, last };
  };

  // HATA 2 ÇÖZÜMÜ: SAF MAHALLE AYRIŞTIRMA (MAH, MH, MAHALLESİ EKLERİNDEN ARINDIRILMIŞ)
  const extractNeighborhood = (street1: string | null, street2: string | null) => {
    const fullAddress = `${street1 || ""} ${street2 || ""}`.trim();
    
    // Grup 1 (match[1]) sadece mahalle ismini alır. Mah/Mh ekleri Grup 2'de (match[2]) dışarıda kalır.
    const match = fullAddress.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ0-9\s.-]+?)\s+(mah|mh|mahallesi)\b\.?/i);
    
    if (match && match[1]) {
      let pureMahalle = match[1].trim(); 
      // Regex hatası veya adres kirliliği önlemi: Eğer virgül veya çizgi varsa, sadece son parçasını temiz olarak al.
      if (pureMahalle.includes(',')) {
        pureMahalle = pureMahalle.split(',').pop()?.trim() || pureMahalle;
      }
      return pureMahalle.toUpperCase();
    }
    return "MAHALLE BULUNAMADI";
  };

  const formatPhoneForCopy = (phone: string | null | undefined) => {
    if (!phone) return "";
    const idx = phone.indexOf('5');
    return idx !== -1 ? phone.substring(idx) : phone;
  };

  const getContainerStyles = () => {
    switch (uiStatus) {
      case "success": return "border-emerald-500 shadow-emerald-500/20 shadow-lg";
      case "error": return "border-red-500 shadow-red-500/20 shadow-lg";
      case "update": return "border-blue-500 shadow-blue-500/20 shadow-lg"; 
      case "warning": return "border-amber-500 shadow-amber-500/20 shadow-lg";
      default: return "border-slate-200 shadow-sm";
    }
  };

  // Canlı ve Renkli CopyBox Bileşeni
  const CopyBox = ({ fieldId, textToCopy, label, icon: Icon, theme }: { fieldId: string, textToCopy: string, label: string, icon: any, theme: 'blue' | 'emerald' | 'amber' | 'indigo' | 'rose' }) => {
    const themes = {
      blue: "bg-blue-50/50 text-blue-800 border-blue-200 hover:bg-blue-600 hover:text-white",
      emerald: "bg-emerald-50/50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white",
      amber: "bg-amber-50/50 text-amber-900 border-amber-200 hover:bg-amber-600 hover:text-white",
      indigo: "bg-indigo-50/50 text-indigo-800 border-indigo-200 hover:bg-indigo-600 hover:text-white",
      rose: "bg-rose-50/50 text-rose-800 border-rose-200 hover:bg-rose-600 hover:text-white"
    };

    return (
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-center gap-1.5 opacity-80 pl-1">
          <Icon className="w-4 h-4" />
          <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
        </div>
        <div className="flex items-stretch bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden group">
          <span className="flex-1 flex items-center text-sm font-bold uppercase truncate px-4 py-2.5 text-slate-800 select-all">
            {textToCopy || "-"}
          </span>
          <button 
            type="button"
            onClick={() => handleCopy(textToCopy, fieldId)}
            className={`flex-shrink-0 inline-flex items-center justify-center w-14 border-l transition-all focus:outline-none ${themes[theme]}`}
            title="Kopyala"
          >
            {copiedField === fieldId ? (
              <CheckCircle2 className="w-5 h-5 animate-in zoom-in" />
            ) : (
              <Copy className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </div>
      </div>
    );
  };

  const progressPercent = stats.totalRecords > 0 ? Math.round((stats.processed / stats.totalRecords) * 100) : 0;

  return (
    <>
      <div className="w-full flex flex-col gap-6 pb-12 font-['Quicksand'] animate-in fade-in duration-300">
        
        {/* 1. VİBRANT (CANLI) KOMUTA MERKEZİ BAŞLIĞI */}
        <div className="bg-slate-900 rounded-xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-xl border-b-4 border-[#dc3545] relative overflow-hidden">
          
          {/* Dekoratif Arka Plan Çizgileri */}
          <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-slate-800/50 to-transparent pointer-events-none"></div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-gradient-to-br from-[#dc3545] to-red-700 p-3.5 rounded-lg shadow-lg shadow-red-900/50">
              <PackageSearch className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-widest uppercase flex items-center gap-2">
                EKSİK PARÇA <span className="text-[#dc3545]">B2C</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                Akıllı Barkod Eşleştirme & Kargo Modülü
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto relative z-10">
            {/* YENİLENMİŞ VE STABİL DROPDOWN ALANI */}
            <div className="relative flex-1 min-w-[280px]">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FileSpreadsheet className={`w-4 h-4 ${selectedFileId ? 'text-emerald-400' : 'text-slate-400'}`} />
              </div>
              <select
                value={selectedFileId}
                onChange={(e) => handleProfileChange(e.target.value)}
                className={`block w-full pl-11 pr-10 py-3.5 bg-slate-800/80 backdrop-blur-md text-white text-xs font-bold uppercase tracking-widest rounded-lg focus:outline-none focus:ring-2 appearance-none cursor-pointer transition-all border ${selectedFileId ? 'border-emerald-500/50 focus:ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-slate-700 focus:ring-[#dc3545]/50'}`}
              >
                <option value="">🌐 TÜM VERİTABANINDA ÇALIŞ</option>
                {files.map(f => (
                  <option key={f.id} value={f.id}>📄 {f.filename}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            {selectedFileId && (
              <button 
                onClick={deleteSelectedFile}
                className="h-[50px] px-4 bg-slate-800 hover:bg-red-950/50 text-red-400 border border-slate-700 hover:border-red-500/50 rounded-lg flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm shrink-0"
                title="Seçili Profili Sil"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">PROFİLİ SİL</span>
              </button>
            )}

            <button 
              onClick={() => setIsExcelOpen(true)}
              className="h-[50px] px-6 bg-gradient-to-r from-[#dc3545] to-red-700 hover:from-red-600 hover:to-red-800 text-white rounded-lg flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-900/30 shrink-0 border border-red-500/50"
            >
              <UploadCloud className="w-4 h-4" />
              YENİ YÜKLE
            </button>
          </div>
        </div>

        {/* 2. YENİ RENKLİ (VIBRANT) İSTATİSTİK PANELI */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          
          {/* Sol Kısım - 4 Renkli İstatistik Kartı */}
          <div className="col-span-1 xl:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* İlerleme (Ana Metrik) */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl p-5 text-white shadow-lg shadow-indigo-200 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Genel İlerleme</span>
                <BarChart3 className="w-5 h-5 text-indigo-200" />
              </div>
              <div className="relative z-10">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-black">{progressPercent}%</span>
                  <span className="text-xs font-semibold text-indigo-200 mb-1.5">Tamamlandı</span>
                </div>
                <div className="w-full bg-indigo-900/50 rounded-full h-1.5">
                  <div className="bg-white h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
            </div>

            {/* Toplam Kayıt */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Toplam Kayıt</span>
                <div className="p-2 bg-blue-50 rounded-lg text-blue-500 group-hover:scale-110 transition-transform"><Activity className="w-4 h-4" /></div>
              </div>
              <span className="text-3xl font-black text-slate-800">{stats.totalRecords.toLocaleString("tr-TR")}</span>
            </div>

            {/* İşlenen */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">İşlenen Sipariş</span>
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-500 group-hover:scale-110 transition-transform"><PackageCheck className="w-4 h-4" /></div>
              </div>
              <span className="text-3xl font-black text-slate-800">{stats.processed.toLocaleString("tr-TR")}</span>
            </div>

            {/* Kalan */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bekleyen / Kalan</span>
                <div className="p-2 bg-amber-50 rounded-lg text-amber-500 group-hover:scale-110 transition-transform"><PackageOpen className="w-4 h-4" /></div>
              </div>
              <span className="text-3xl font-black text-slate-800">{stats.remaining.toLocaleString("tr-TR")}</span>
            </div>

          </div>

          {/* Sağ Kısım - Çıktı ve Aksiyonlar */}
          <div className="col-span-1 flex flex-col gap-3 justify-center">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 rounded-lg text-rose-500">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bugünkü İşlem</p>
                  <p className="text-xl font-black text-slate-800">{stats.today.toLocaleString("tr-TR")}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={exportTwoColumnExcel} className="h-11 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">
                <Download className="w-3.5 h-3.5" /> 2 KOLON
              </button>
              <button onClick={exportExactOriginalExcel} className="h-11 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">
                <Download className="w-3.5 h-3.5" /> TAM ÇIKTI
              </button>
            </div>
          </div>
        </div>

        {/* 3. İŞLEM BÖLGESİ (BARKOD OKUMA) - VİBRANT BÖLGE */}
        <div className={`transition-all duration-300 p-6 sm:p-8 flex flex-col gap-6 rounded-2xl bg-white border-2 ${getContainerStyles()} w-full min-w-0`}>
          
          {statusMessage && (
            <div className={`p-4 text-sm font-bold uppercase tracking-widest border animate-in fade-in rounded-xl break-words shadow-sm flex items-center gap-3 ${
              uiStatus === "error" ? "bg-red-50 text-red-700 border-red-200" :
              uiStatus === "update" ? "bg-blue-50 text-blue-700 border-blue-200" :
              uiStatus === "warning" ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              {uiStatus === "success" && <CheckCircle2 className="w-5 h-5" />}
              {uiStatus === "error" && <AlertTriangle className="w-5 h-5" />}
              {statusMessage}
            </div>
          )}

          {/* ADIM 1: SİPARİŞ / DELIVERY NO */}
          <div className={`transition-opacity duration-300 ${activeGroup ? "opacity-30 pointer-events-none" : "opacity-100"} w-full`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 text-white text-sm font-black shadow-md">1</span>
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
                className="flex-1 h-16 bg-slate-50 border-2 border-slate-200 px-6 py-3 text-xl font-black text-slate-900 rounded-xl focus:outline-none focus:bg-white focus:border-[#dc3545] focus:ring-4 focus:ring-[#dc3545]/10 disabled:bg-slate-100 uppercase placeholder:text-slate-300 placeholder:font-semibold transition-all"
                placeholder={selectedFileId ? "SADECE SEÇİLİ PROFİLDE ARA..." : "BARKOD OKUT VEYA YAZ (OTOMATİK SEÇİM AKTİF)..."}
                autoComplete="off"
              />
              <button 
                type="submit" 
                disabled={loading || !deliveryNo.trim() || activeGroup !== null}
                className="w-full sm:w-48 h-16 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
              >
                SORGULA
              </button>
            </form>
          </div>

          {/* ADIM 2: AKTİF SİPARİŞ DETAYLARI & EŞLEŞTİRME (VIBRANT BENTO BOX) */}
          {activeGroup && (
            <div className="flex flex-col gap-0 animate-in slide-in-from-bottom-4 fade-in duration-300 bg-white border border-slate-200 shadow-xl rounded-2xl w-full min-w-0 mt-4 overflow-hidden">
              
              <div className={`h-2 w-full ${activeGroup.isUpdateMode ? 'bg-blue-500' : 'bg-[#dc3545]'}`}></div>

              {/* KPI HEADER */}
              <div className="bg-slate-50 p-5 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-3 shrink-0 shadow-sm">
                  <span className="bg-slate-900 text-white px-3.5 py-1.5 font-black text-xl rounded-lg">{activeGroup.count}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">KALEM<br/>SİPARİŞ</span>
                </div>
                
                {activeGroup.sdDocumentsMatch ? (
                  <div className="flex-1 flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 shadow-sm">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest truncate mb-0.5">SD DOCUMENT (TAM EŞLEŞME)</p>
                      <p className="text-base font-black font-mono text-emerald-900 truncate">{activeGroup.uniqueSdDocuments[0] || 'KOD YOK'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 shadow-sm">
                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest truncate mb-0.5">FARKLI SD KODLARI İÇERİYOR</p>
                      <p className="text-sm font-black font-mono text-amber-900 break-all">{activeGroup.uniqueSdDocuments.join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* BENTO BOX INFO BOARD */}
              <div className="p-5 sm:p-6 w-full border-b border-slate-100 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full min-w-0">
                  
                  {/* İSİM & SOYİSİM */}
                  <div className="col-span-1 bg-slate-50 rounded-xl p-5 flex flex-col gap-4 border border-slate-100">
                    {(() => {
                      const { first, last } = splitName(activeGroup.primary.customer_name);
                      return (
                        <>
                          <CopyBox fieldId="firstName" textToCopy={first} label="MÜŞTERİ ADI" icon={User} theme="blue" />
                          <CopyBox fieldId="lastName" textToCopy={last} label="SOYADI" icon={User} theme="blue" />
                        </>
                      );
                    })()}
                  </div>

                  {/* TELEFON & ŞEHİR */}
                  <div className="col-span-1 bg-slate-50 rounded-xl p-5 flex flex-col gap-4 border border-slate-100">
                    <CopyBox 
                      fieldId="phone" 
                      textToCopy={formatPhoneForCopy(activeGroup.primary.mobile_number)} 
                      label="İLETİŞİM NUMARASI" 
                      icon={Phone} 
                      theme="indigo" 
                    />
                    <CopyBox 
                      fieldId="cityRegion" 
                      textToCopy={`${activeGroup.primary.city || ''} / ${activeGroup.primary.region || ''}`.trim()} 
                      label="ŞEHİR & BÖLGE" 
                      icon={MapPin} 
                      theme="emerald" 
                    />
                  </div>

                  {/* MAHALLE & AÇIK ADRES */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-1 flex flex-col gap-5">
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <CopyBox 
                        fieldId="neighborhood" 
                        textToCopy={extractNeighborhood(activeGroup.primary.street, activeGroup.primary.street_2)} 
                        label="MAHALLE (OTOMATİK AYRIŞTIRILDI)" 
                        icon={Building2} 
                        theme="amber" 
                      />
                    </div>
                    <div className="bg-slate-50 rounded-xl p-5 flex-1 flex flex-col border border-slate-100">
                       <CopyBox 
                        fieldId="fullAddress" 
                        textToCopy={`${activeGroup.primary.street || ""} ${activeGroup.primary.street_2 || ""} - Posta Kodu: ${activeGroup.primary.postal_code || "YOK"}`.trim()} 
                        label="AÇIK ADRES BÜTÜNÜ" 
                        icon={MapPinned} 
                        theme="rose" 
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* ARAS KARGO INPUT */}
              <div className={`${activeGroup.isUpdateMode ? 'bg-blue-50/50' : 'bg-slate-50/50'} p-6 sm:p-8 w-full`}>
                <div className="flex items-center gap-3 mb-5">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg text-white text-sm font-black shadow-md ${activeGroup.isUpdateMode ? 'bg-blue-500' : 'bg-[#dc3545]'}`}>2</span>
                  <label className={`text-base font-black uppercase tracking-widest ${activeGroup.isUpdateMode ? 'text-blue-700' : 'text-[#dc3545]'}`}>
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
                    className={`flex-1 h-16 bg-white border-2 px-6 text-2xl font-black font-mono text-slate-900 rounded-xl focus:outline-none focus:ring-4 uppercase placeholder:text-slate-300 placeholder:font-semibold transition-all shadow-sm ${activeGroup.isUpdateMode ? 'border-blue-200 focus:ring-blue-500/20 focus:border-blue-500' : 'border-slate-200 focus:ring-[#dc3545]/20 focus:border-[#dc3545]'}`}
                    placeholder={activeGroup.isUpdateMode ? "YENİ BARKOD..." : "KARGO BARKODU..."}
                    autoComplete="off"
                  />
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button 
                      type="submit" 
                      disabled={loading || !trackingNo.trim()}
                      className={`w-full sm:w-48 h-16 px-8 text-white font-black text-sm uppercase tracking-widest transition-all rounded-xl shadow-lg active:scale-95 ${activeGroup.isUpdateMode ? 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50' : 'bg-gradient-to-r from-[#dc3545] to-red-700 hover:from-red-600 hover:to-red-800 disabled:opacity-50'}`}
                    >
                      {activeGroup.isUpdateMode ? 'GÜNCELLE' : 'KAYDET'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleCancel}
                      disabled={loading}
                      className="w-full sm:w-auto h-16 px-8 bg-white hover:bg-slate-100 text-slate-700 font-black text-sm uppercase tracking-widest transition-colors border-2 border-slate-200 rounded-xl shadow-sm active:scale-95"
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
          <div className="bg-white shadow-2xl w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-50 border-b border-red-100 p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-[#dc3545]" />
              </div>
              <h2 className="text-red-700 font-black text-lg tracking-widest uppercase">
                Veritabanı Sıfırlama
              </h2>
            </div>
            <div className="p-8">
              <p className="text-slate-800 font-black text-lg mb-3">DİKKAT: Veriler kalıcı olarak yok edilecektir!</p>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed font-semibold">
                Bu işlem geri alınamaz. Sisteme yüklenen TÜM Excel verileri ve yapılan kargo barkod eşleştirmeleri tamamen temizlenecektir.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleGlobalWipe} 
                  disabled={loading}
                  className="flex-1 bg-[#dc3545] hover:bg-red-700 text-white font-black h-14 uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 text-sm shadow-md active:scale-95"
                >
                  {loading ? "SİLİNİYOR..." : "EVET, ONAYLIYORUM"}
                </button>
                <button 
                  onClick={() => setIsWipeModalOpen(false)} 
                  disabled={loading}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black h-14 uppercase tracking-widest rounded-xl transition-colors text-sm shadow-sm active:scale-95"
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