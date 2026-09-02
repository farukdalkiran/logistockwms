"use client";

import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/lib/supabase"; 
import * as XLSX from "xlsx"; 
import toast, { Toaster } from "react-hot-toast";
import { Truck, Undo2, Search,AlertTriangle } from 'lucide-react';

interface ShipmentRecord {
  id: string;
  customer_name: string;
  mobile_number: string;
  sd_document: string;
  delivery_number: string;
  aras_shipment_number: string;
  aras_tracking_number: string;
  is_returned: boolean;
  item_count: number;
  created_at: string;
}

interface TableProps {
  onTrackClick?: (trackingNo: string) => void; 
}

type SortKey = keyof ShipmentRecord;
type SortDirection = "asc" | "desc";
type FilterType = "ALL" | "RETURN" | "ERROR" | "NORMAL";
type FieldFilterType = "ALL" | "SD" | "DELIVERY" | "CUSTOMER" | "TRACKING";

export default function TrackingTable({ onTrackClick }: TableProps) {
  const [records, setRecords] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ARAMA STATE'LERİ (Yazarken ayrı, aratınca ayrı çalışır)
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [returnModal, setReturnModal] = useState<{isOpen: boolean, id: string, currentStatus: boolean}>({ 
    isOpen: false, 
    id: "", 
    currentStatus: false 
  });
  const [isReturning, setIsReturning] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(15);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: "created_at", direction: "desc" });
  
  const [filterType, setFilterType] = useState<FilterType>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [specificField, setSpecificField] = useState<FieldFilterType>("ALL");

  useEffect(() => {
    let isMounted = true; 

    const fetchRecords = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("cargo_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2500);

      if (isMounted) {
        if (!error && data) {
          setRecords(data as ShipmentRecord[]); 
        } else if (error) {
          toast.error("Veritabanından veriler çekilirken sorun oluştu.");
          console.error("Veri çekme hatası:", error);
        }
        setLoading(false);
      }
    };

    fetchRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  // YENİ EKSİK ADRES MANTIĞI: Sadece Shipment veya Tracking alanında harf/metin varsa hatalıdır.
  const isAddressError = (rec: ShipmentRecord) => {
    const s = rec.aras_shipment_number || "";
    const t = rec.aras_tracking_number || "";
    // Türkçe veya İngilizce harf içeriyorsa true döner
    return /[a-zA-ZçğöşüıÇĞÖŞÜİ]/.test(s) || /[a-zA-ZçğöşüıÇĞÖŞÜİ]/.test(t);
  };

  const triggerReturnToggle = (id: string, currentStatus: boolean) => {
    setReturnModal({ isOpen: true, id, currentStatus });
  };

  const confirmReturnToggle = async () => {
    setIsReturning(true);
    const { id, currentStatus } = returnModal;
    const newStatus = !currentStatus;

    try {
      const { data, error } = await supabase
        .from("cargo_records")
        .update({ is_returned: newStatus })
        .eq("id", id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("İşlem yetkisi reddedildi.");

      setRecords(prev => prev.map(r => r.id === id ? { ...r, is_returned: newStatus } : r));
      setReturnModal({ isOpen: false, id: "", currentStatus: false });
      
      if (newStatus) {
        toast.success("Kayıt İADE olarak güncellendi.", {
          style: { border: '1px solid #03DF95', background: '#0f172a', color: '#03DF95' }
        });
      } else {
        toast.success("İade iptal edildi, kayıt normale döndü.", {
          style: { border: '1px solid #475569', background: '#0f172a', color: '#fff' }
        });
      }

    } catch (err: any) {
      console.error("İade Güncelleme Hatası:", err);
      toast.error("Hata: " + err.message);
    } finally {
      setIsReturning(false);
    }
  };

  const applyDatePreset = (preset: "TODAY" | "WEEK" | "MONTH") => {
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "TODAY") {
      setStartDate(formatDate(now));
      setEndDate(formatDate(now));
    } else if (preset === "WEEK") {
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      setStartDate(formatDate(lastWeek));
      setEndDate(formatDate(now));
    } else if (preset === "MONTH") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDate(startOfMonth));
      setEndDate(formatDate(now));
    }
  };

  const resetAllFilters = () => {
    setFilterType("ALL");
    setStartDate("");
    setEndDate("");
    setSpecificField("ALL");
    setSearchInput("");
    setSearchQuery("");
    toast.success("Filtreler temizlendi.");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  // GÜVENLİ FİLTRELEME MOTORU
  let processedRecords = records.filter(rec => {
    const searchUpper = searchQuery ? searchQuery.toUpperCase() : "";
    let matchesSearch = true;

    if (searchUpper) {
      const customer = rec.customer_name ? rec.customer_name.toUpperCase() : "";
      const sdDoc = rec.sd_document ? rec.sd_document.toUpperCase() : "";
      const tracking = rec.aras_tracking_number ? rec.aras_tracking_number.toUpperCase() : "";
      const shipment = rec.aras_shipment_number ? rec.aras_shipment_number.toUpperCase() : "";
      const delivery = rec.delivery_number ? rec.delivery_number.toUpperCase() : "";
      const phone = rec.mobile_number || "";

      if (specificField === "SD") {
        matchesSearch = sdDoc.includes(searchUpper);
      } else if (specificField === "DELIVERY") {
        matchesSearch = delivery.includes(searchUpper);
      } else if (specificField === "CUSTOMER") {
        matchesSearch = customer.includes(searchUpper);
      } else if (specificField === "TRACKING") {
        matchesSearch = tracking.includes(searchUpper) || shipment.includes(searchUpper);
      } else {
        matchesSearch = customer.includes(searchUpper) ||
          sdDoc.includes(searchUpper) ||
          tracking.includes(searchUpper) ||
          shipment.includes(searchUpper) ||
          delivery.includes(searchUpper) ||
          phone.includes(searchUpper);
      }
    }
    
    const matchesSelectFilter = 
      filterType === "ALL" ? true :
      filterType === "RETURN" ? rec.is_returned === true :
      filterType === "ERROR" ? isAddressError(rec) :
      filterType === "NORMAL" ? (!rec.is_returned && !isAddressError(rec)) : true;

    let matchesDate = true;
    const recordTime = new Date(rec.created_at).getTime();
    if (startDate) matchesDate = matchesDate && (recordTime >= new Date(startDate).getTime());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && (recordTime <= end.getTime());
    }

    return matchesSearch && matchesSelectFilter && matchesDate;
  });

  if (sortConfig !== null) {
    processedRecords.sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";

      if (sortConfig.key === "created_at") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortConfig.key === "item_count") {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(processedRecords.length / rowsPerPage) || 1;
  if (currentPage > totalPages) setCurrentPage(1);
  const paginatedRecords = processedRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(paginatedRecords.map(r => r.id));
    else setSelectedIds([]);
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.from("cargo_records").delete().in("id", selectedIds).select();
      if (error) throw error; 
      if (!data || data.length === 0) throw new Error("Silme yetkiniz yok veya RLS kuralları engelledi.");

      const deletedCount = selectedIds.length;
      setRecords(prev => prev.filter(r => !selectedIds.includes(r.id)));
      setSelectedIds([]);
      setShowDeleteModal(false);
      
      if (paginatedRecords.length === deletedCount && currentPage > 1) setCurrentPage(p => p - 1);
      toast.success(`${deletedCount} kayıt başarıyla silindi.`, {
        icon: '🗑️', style: { border: '1px solid #ef4444', background: '#0f172a', color: '#fff' }
      });
    } catch (err: any) {
      toast.error(`Silme Hatası: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToExcel = () => {
    const dataToExport = selectedIds.length > 0 ? processedRecords.filter(r => selectedIds.includes(r.id)) : processedRecords;
    if (dataToExport.length === 0) return toast.error("Dışa aktarılacak veri bulunamadı.");

    const exportData = dataToExport.map(r => ({
      "Yüklenme Tarihi": new Date(r.created_at).toLocaleString('tr-TR'),
      "Müşteri": r.customer_name,
      "SD Document": r.sd_document,
      "Delivery No": r.delivery_number,
      "Telefon": r.mobile_number,
      "Aras Shipment No": r.aras_shipment_number,
      "Takip No": r.aras_tracking_number,
      "Kalem": r.item_count || 1,
      "Durum": r.is_returned ? "İADE" : (isAddressError(r) ? "EKSİK/HATALI ADRES" : "NORMAL")
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rapor");
    XLSX.writeFile(workbook, `WMS_Rapor_${new Date().getTime()}.xlsx`);
    toast.success("Excel başarıyla indirildi.");
  };

  const openArasTrack = (trackingNo: string) => {
    if (!trackingNo || /[a-zA-Z]/.test(trackingNo)) return;
    window.open(`https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${trackingNo}`, "Aras_Takip", "width=1000,height=750,left=200,top=100");
  };

  const SortHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: SortKey; align?: "left" | "center" | "right" }) => {
    const isActive = sortConfig?.key === sortKey;
    return (
      <th 
        className={`px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-900 transition-colors select-none text-${align}`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-1.5 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
          {label}
          <div className="flex flex-col text-slate-300">
            <svg className={`w-2.5 h-2.5 ${isActive && sortConfig?.direction === 'asc' ? 'text-[#03DF95]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7"></path></svg>
            <svg className={`w-2.5 h-2.5 -mt-1 ${isActive && sortConfig?.direction === 'desc' ? 'text-[#03DF95]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="w-full bg-white border border-slate-200 shadow-xl flex flex-col min-w-0 overflow-hidden">
      <Toaster 
        position="bottom-right" 
        toastOptions={{ style: { borderRadius: '12px', background: '#334155', color: '#fff', fontSize: '13px' } }} 
      />

      {/* ŞIK VE MODERN FİLTRE PANELİ (Koyu Tema & Turkuaz Accent) */}
      <div className="bg-slate-900 border-b border-slate-800 p-5 sm:p-7 flex flex-col gap-6 text-white w-full relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#03DF95]/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="flex flex-col">
              <h2 className="text-xl sm:text-3xl font-black tracking-wide text-white drop-shadow-sm">
                Kayıt <span className="text-[#03DF95]">Sorgulama</span>
              </h2>
              <p className="text-slate-400 text-[11px] sm:text-xs font-bold tracking-widest uppercase mt-1">Gelişmiş Veri Filtreleme ve Kontrol Paneli</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="bg-[#03DF95]/10 text-[#03DF95] border border-[#03DF95]/30 px-3 py-1.5 rounded-lg text-xs font-bold shadow-inner">
                  {processedRecords.length} KAYIT BULUNDU
                </span>
                <span className="bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold shadow-inner">
                  {processedRecords.filter(r=>r.is_returned).length} İADE
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {selectedIds.length > 0 && (
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white h-11 px-5 rounded-lg text-xs font-black transition-all shadow-md flex items-center gap-2 uppercase tracking-wider"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                SİL ({selectedIds.length})
              </button>
            )}
            <button 
              onClick={exportToExcel}
              className="bg-[#03DF95] hover:bg-[#02c784] text-slate-900 h-11 px-5 rounded-lg text-xs font-black transition-all shadow-md flex items-center gap-2 uppercase tracking-wider"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1h16v-1M12 4v10m-4-4l4 4 4-4"></path></svg>
              EXCEL İNDİR
            </button>
            <button 
              onClick={resetAllFilters}
              className="bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 h-11 px-5 rounded-lg text-[11px] font-black border border-slate-600 transition-colors uppercase tracking-widest"
            >
              Sıfırla
            </button>
          </div>
        </div>

        {/* ANA ARAMA ÇUBUĞU (PERFORMANS İÇİN FORMLU YAPI) */}
        <form onSubmit={handleSearchSubmit} className="relative w-full z-10 pt-2 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
               <Search className="w-5 h-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-12 sm:h-14 pl-12 pr-4 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#03DF95] focus:ring-1 focus:ring-[#03DF95] uppercase placeholder:text-slate-500 transition-all shadow-inner"
              placeholder="İSİM, TAKİP NO, SD DOCUMENT VEYA TELEFON YAZIN..."
            />
          </div>
          <button 
            type="submit" 
            className="h-12 sm:h-14 bg-[#03DF95] hover:bg-[#02c784] text-slate-900 px-8 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-md"
          >
            ARA
          </button>
        </form>

        {/* FİLTRE GRID YAPISI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full relative z-10 pt-4 border-t border-slate-800/50">
          
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-[#03DF95] tracking-widest uppercase">Kargo Durumu</label>
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as FilterType); setCurrentPage(1); }}
                className="h-12 w-full bg-slate-800/80 border border-slate-700 text-white px-4 rounded-xl text-xs font-bold focus:outline-none focus:border-[#03DF95] focus:ring-1 focus:ring-[#03DF95] transition-all cursor-pointer appearance-none shadow-inner"
              >
                <option value="ALL">KARIŞIK (TÜMÜ)</option>
                <option value="NORMAL">NORMAL (TESLİMAT)</option>
                <option value="RETURN">SADECE İADELER</option>
                <option value="ERROR">EKSİK / HATALI ADRES</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-[#03DF95] tracking-widest uppercase">Arama Odağı</label>
            <div className="relative">
              <select
                value={specificField}
                onChange={(e) => { setSpecificField(e.target.value as any); setCurrentPage(1); }}
                className="h-12 w-full bg-slate-800/80 border border-slate-700 text-white px-4 rounded-xl text-xs font-bold focus:outline-none focus:border-[#03DF95] focus:ring-1 focus:ring-[#03DF95] transition-all cursor-pointer appearance-none shadow-inner"
              >
                <option value="ALL">GENEL ARAMA (TÜM ALANLAR)</option>
                <option value="CUSTOMER">SADECE MÜŞTERİ ADI</option>
                <option value="SD">SADECE SD DOCUMENT</option>
                <option value="DELIVERY">SADECE DELIVERY NO</option>
                <option value="TRACKING">SADECE TAKİP NO</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center h-4">
              <label className="text-[11px] font-bold text-[#03DF95] tracking-widest uppercase">Tarih Aralığı</label>
              <div className="flex gap-1">
                <button onClick={() => applyDatePreset("TODAY")} className="text-[9px] font-black text-slate-300 hover:text-slate-900 hover:bg-[#03DF95] px-2 py-0.5 rounded transition-all uppercase tracking-wider">Bugün</button>
                <span className="text-slate-700 text-[10px] mx-0.5">|</span>
                <button onClick={() => applyDatePreset("WEEK")} className="text-[9px] font-black text-slate-300 hover:text-slate-900 hover:bg-[#03DF95] px-2 py-0.5 rounded transition-all uppercase tracking-wider">Hafta</button>
                <span className="text-slate-700 text-[10px] mx-0.5">|</span>
                <button onClick={() => applyDatePreset("MONTH")} className="text-[9px] font-black text-slate-300 hover:text-slate-900 hover:bg-[#03DF95] px-2 py-0.5 rounded transition-all uppercase tracking-wider">Ay</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="h-12 w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl text-[11px] font-bold px-3 focus:outline-none focus:border-[#03DF95] transition-all uppercase shadow-inner" 
                />
              </div>
              <span className="text-slate-500 font-black text-sm">-</span>
              <div className="relative flex-1">
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="h-12 w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl text-[11px] font-bold px-3 focus:outline-none focus:border-[#03DF95] transition-all uppercase shadow-inner" 
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* VERİ TABLOSU */}
      <div className="overflow-x-auto w-full flex-1 bg-white">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              <th className="px-4 py-3 w-12 text-center border-r border-slate-100">
                <input type="checkbox" checked={paginatedRecords.length > 0 && selectedIds.length === paginatedRecords.length} onChange={handleSelectAll} className="w-4 h-4 cursor-pointer accent-[#03DF95] rounded-md border-slate-300" />
              </th>
              <SortHeader label="Yüklenme" sortKey="created_at" />
              <SortHeader label="Müşteri Bilgisi" sortKey="customer_name" />
              <SortHeader label="Evrak & Sipariş" sortKey="sd_document" />
              <SortHeader label="Kargo Numaraları" sortKey="aras_tracking_number" />
              <SortHeader label="Adet" sortKey="item_count" align="center" />
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Durum</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right pr-6">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-24 text-center bg-white">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <svg className="animate-spin w-8 h-8 text-[#03DF95]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-sm font-medium text-slate-500">Veriler Yükleniyor...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-20 text-center text-sm font-medium text-slate-500 bg-slate-50/50">
                  Belirtilen kriterlere uygun kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((rec) => {
                const addressErr = isAddressError(rec);
                const isSelected = selectedIds.includes(rec.id);
                
                return (
                  <tr key={rec.id} className={`transition-all hover:bg-slate-50 ${isSelected ? "bg-emerald-50/50" : "bg-white"}`}>
                    <td className="px-4 py-3 text-center border-r border-slate-100">
                      <input type="checkbox" checked={isSelected} onChange={() => handleSelect(rec.id)} className="w-4 h-4 cursor-pointer accent-[#03DF95] rounded-md border-slate-300" />
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-semibold text-slate-800 block">{new Date(rec.created_at).toLocaleDateString('tr-TR')}</span>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5">{new Date(rec.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">{rec.customer_name || "-"}</span>
                      <span className="text-[11px] font-medium text-slate-500 block mt-0.5">{rec.mobile_number || "Telefon Yok"}</span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-700"><span className="text-[10px] text-slate-400 font-normal">SD:</span> {rec.sd_document}</span>
                        <span className="text-xs font-bold text-slate-700"><span className="text-[10px] text-slate-400 font-normal">DN:</span> {rec.delivery_number}</span>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      {addressErr ? (
                        <div className="flex flex-col items-start gap-1 p-1.5 bg-orange-50 border border-orange-200 rounded-md">
                          <span className="text-orange-700 text-[9px] font-bold uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> EKSİK/HATALI ADRES
                          </span>
                          <span className="text-slate-700 text-[11px] font-semibold truncate max-w-[200px]" title={/[a-zA-Z]/.test(rec.aras_shipment_number) ? rec.aras_shipment_number : rec.aras_tracking_number}>
                            {/[a-zA-Z]/.test(rec.aras_shipment_number) ? rec.aras_shipment_number : rec.aras_tracking_number}
                          </span>
                        </div>
                      ) : (
                        <div className={`flex flex-col gap-0.5 ${rec.is_returned ? 'text-slate-400 line-through opacity-70' : 'text-slate-900'}`}>
                          <span className="text-[11px] font-semibold"><span className="text-[10px] text-slate-400 font-normal mr-1">S:</span>{rec.aras_shipment_number || "-"}</span>
                          <span className="text-[11px] font-bold text-[#03DF95]"><span className="text-[10px] text-slate-400 font-normal mr-1">T:</span>{rec.aras_tracking_number || "-"}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shadow-sm border ${
                        rec.item_count > 1 ? "bg-slate-900 text-[#03DF95] border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}>
                        {rec.item_count}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {rec.is_returned ? (
                        <span className="bg-red-100 text-red-700 px-2.5 py-1 text-[10px] font-bold uppercase rounded-md border border-red-200">İade</span>
                      ) : (
                        <span className="text-slate-400 text-sm font-medium">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right pr-6 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => triggerReturnToggle(rec.id, rec.is_returned)}
                          className={`p-2 rounded-lg transition-all border shadow-sm ${
                            rec.is_returned 
                              ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-700" 
                              : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:text-orange-700"
                          }`}
                          title={rec.is_returned ? "İadeyi İptal Et" : "İadeye Çek"}
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => openArasTrack(rec.aras_tracking_number)}
                          disabled={!rec.aras_tracking_number || addressErr}
                          className="p-2 rounded-lg bg-[#03DF95] hover:bg-[#02c784] text-slate-900 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 transition-all border border-[#03DF95] shadow-sm"
                          title="Kargo Takip"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* SAYFALAMA VE GÖSTERİM BARI */}
      {!loading && processedRecords.length > 0 && (
        <div className="bg-white border-t border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row justify-between items-center gap-4 rounded-b-2xl">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <span className="text-xs font-medium text-slate-500">
              Sayfa <span className="text-[#03DF95] font-bold mx-1">{currentPage}</span> / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">Gösterim:</span>
              <select 
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-2 focus:outline-none rounded-lg cursor-pointer"
              >
                <option value={15}>15 Satır</option>
                <option value={30}>30 Satır</option>
                <option value={50}>50 Satır</option>
                <option value={100}>100 Satır</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-2 bg-white border border-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">«</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Önceki</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Sonraki</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-2 bg-white border border-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">»</button>
          </div>
        </div>
      )}

      {/* İADE ONAY MODALI */}
      {returnModal.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 shadow-xl w-full max-w-sm flex flex-col rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-5 flex items-center justify-center ${!returnModal.currentStatus ? "bg-orange-500" : "bg-slate-800"}`}>
              <h2 className="font-bold text-sm text-white uppercase tracking-widest">
                {!returnModal.currentStatus ? "İade İşlemi Onayı" : "İade İptal Onayı"}
              </h2>
            </div>
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <p className="text-sm font-medium text-slate-700 leading-relaxed">
                {!returnModal.currentStatus 
                  ? "Bu paketi fiziki olarak teslim aldığınızı ve sisteme iade olarak işleneceğini onaylıyor musunuz?" 
                  : "Bu paketin iade durumunu kaldırıp normal statüsüne almak istediğinize emin misiniz?"}
              </p>
              <div className="flex gap-3 w-full mt-4">
                <button onClick={() => setReturnModal({isOpen: false, id: "", currentStatus: false})} disabled={isReturning} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-12 text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm">İptal</button>
                <button onClick={confirmReturnToggle} disabled={isReturning} className={`flex-1 text-white font-bold h-12 text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm ${!returnModal.currentStatus ? "bg-orange-500 hover:bg-orange-600 border-orange-600" : "bg-[#03DF95] hover:bg-[#02c784] text-slate-900 border-[#03DF95]"}`}>
                  {isReturning ? "İşleniyor" : "Onayla"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SİLME ONAY MODALI */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 shadow-xl w-full max-w-md flex flex-col rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-500 p-5 flex items-center justify-center">
              <h2 className="text-white font-bold text-sm text-center uppercase tracking-widest">Kalıcı Silme Onayı</h2>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              <div className="text-center w-full">
                <h3 className="text-2xl font-black text-red-600 mb-2">{selectedIds.length} Kayıt</h3>
                <p className="text-sm font-medium text-slate-700 leading-relaxed bg-red-50 p-4 rounded-xl border border-red-100">
                  Seçili kayıtlar veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz, onaylıyor musunuz?
                </p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-12 text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm">İptal</button>
                <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold h-12 text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm border-red-600">
                  {isDeleting ? "Siliniyor" : "Evet, Sil"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}