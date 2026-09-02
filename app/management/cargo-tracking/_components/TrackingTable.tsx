"use client";

import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase"; 
import * as XLSX from "xlsx"; 
import toast, { Toaster } from "react-hot-toast";
import { Truck, Undo2, Search, AlertTriangle, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';

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

type SortKey = keyof ShipmentRecord;
type SortDirection = "asc" | "desc";
type FilterType = "ALL" | "RETURN" | "ERROR" | "NORMAL";
type FieldFilterType = "ALL" | "SD" | "DELIVERY" | "CUSTOMER" | "TRACKING";

export default function TrackingTable() {
  const [records, setRecords] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecordsCount, setTotalRecordsCount] = useState(0);
  
  // ARAMA VE FİLTRE STATE'LERİ
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [filterType, setFilterType] = useState<FilterType>("ALL");
  const [specificField, setSpecificField] = useState<FieldFilterType>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // SAYFALAMA VE SIRALAMA
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(15);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: "created_at", direction: "desc" });

  // MODALLAR
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [returnModal, setReturnModal] = useState<{isOpen: boolean, id: string, currentStatus: boolean}>({ 
    isOpen: false, id: "", currentStatus: false 
  });
  const [isReturning, setIsReturning] = useState(false);

  // YENİ EKSİK ADRES MANTIĞI
  const isAddressError = (rec: ShipmentRecord) => {
    const s = String(rec.aras_shipment_number || "").trim();
    const t = String(rec.aras_tracking_number || "").trim();
    const hasLetter = /[a-zA-ZçğöşüıÇĞÖŞÜİ]/i;
    return hasLetter.test(t) || hasLetter.test(s) || (t === "" && s === "");
  };

  // VERİTABANINDAN VERİ ÇEKME FONKSİYONU (SERVER-SIDE)
  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase.from("cargo_records").select("*", { count: "exact" });

      if (searchQuery) {
        if (specificField === "SD") query = query.ilike("sd_document", `%${searchQuery}%`);
        else if (specificField === "DELIVERY") query = query.ilike("delivery_number", `%${searchQuery}%`);
        else if (specificField === "CUSTOMER") query = query.ilike("customer_name", `%${searchQuery}%`);
        else if (specificField === "TRACKING") {
          query = query.or(`aras_tracking_number.ilike.%${searchQuery}%,aras_shipment_number.ilike.%${searchQuery}%`);
        } else {
          query = query.or(`customer_name.ilike.%${searchQuery}%,sd_document.ilike.%${searchQuery}%,delivery_number.ilike.%${searchQuery}%,mobile_number.ilike.%${searchQuery}%,aras_tracking_number.ilike.%${searchQuery}%,aras_shipment_number.ilike.%${searchQuery}%`);
        }
      }

      if (filterType === "RETURN") {
        query = query.eq("is_returned", true);
      } else if (filterType === "NORMAL") {
        query = query.eq("is_returned", false);
      }

      if (startDate) query = query.gte("created_at", `${startDate}T00:00:00Z`);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59Z`);

      query = query.order(sortConfig.key, { ascending: sortConfig.direction === "asc" });
      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      let finalData = data as ShipmentRecord[];
      
      if (filterType === "ERROR") {
        const allQuery = supabase.from("cargo_records").select("*");
        const allRes = await allQuery;
        if(allRes.data) {
           const allErrors = allRes.data.filter(rec => isAddressError(rec));
           setTotalRecordsCount(allErrors.length);
           finalData = allErrors.slice(from, to);
        }
      } else if (filterType === "NORMAL") {
        const allNormal = finalData.filter(rec => !isAddressError(rec));
        setRecords(allNormal);
        if (count !== null) setTotalRecordsCount(count); 
      } else {
        setRecords(finalData);
        if (count !== null) setTotalRecordsCount(count);
      }

    } catch (err: any) {
      toast.error("Veri çekme hatası.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, rowsPerPage, sortConfig, filterType, specificField, startDate, endDate, searchQuery]);


  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setCurrentPage(1);
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
    setCurrentPage(1);
    toast.success("Filtreler temizlendi.");
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(records.map(r => r.id));
    else setSelectedIds([]);
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const triggerReturnToggle = (id: string, currentStatus: boolean) => {
    setReturnModal({ isOpen: true, id, currentStatus });
  };

  const confirmReturnToggle = async () => {
    setIsReturning(true);
    const { id, currentStatus } = returnModal;
    const newStatus = !currentStatus;

    try {
      const { data, error } = await supabase.from("cargo_records").update({ is_returned: newStatus }).eq("id", id).select();
      if (error || !data || data.length === 0) throw new Error("İşlem yetkisi reddedildi.");

      setRecords(prev => prev.map(r => r.id === id ? { ...r, is_returned: newStatus } : r));
      setReturnModal({ isOpen: false, id: "", currentStatus: false });
      toast.success(newStatus ? "Kayıt İADE olarak güncellendi." : "İade iptal edildi.", {
        style: { border: `1px solid ${newStatus ? '#03DF95' : '#475569'}`, background: '#0f172a', color: newStatus ? '#03DF95' : '#fff' }
      });
    } catch (err: any) {
      toast.error("Hata: " + err.message);
    } finally {
      setIsReturning(false);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("cargo_records").delete().in("id", selectedIds);
      if (error) throw error; 

      toast.success(`${selectedIds.length} kayıt başarıyla silindi.`, {
        icon: '🗑️', style: { border: '1px solid #ef4444', background: '#0f172a', color: '#fff' }
      });
      setSelectedIds([]);
      setShowDeleteModal(false);
      fetchRecords(); 
    } catch (err: any) {
      toast.error(`Silme Hatası: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToExcel = async () => {
    toast.success("Mevcut sayfa Excel'e aktarılıyor...");
    const exportData = records.map(r => ({
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
  };

  const openArasTrack = (trackingNo: string) => {
    if (!trackingNo || /[a-zA-Z]/.test(trackingNo)) return;
    window.open(`https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${trackingNo}`, "Aras_Takip", "width=1000,height=750,left=200,top=100");
  };

  const totalPages = Math.ceil(totalRecordsCount / rowsPerPage) || 1;

  const SortHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: SortKey; align?: "left" | "center" | "right" }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        className={`px-4 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-900 transition-colors select-none text-${align}`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-1.5 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
          {label}
          <div className="flex flex-col text-slate-300">
            <svg className={`w-2.5 h-2.5 ${isActive && sortConfig.direction === 'asc' ? 'text-[#03DF95]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7"></path></svg>
            <svg className={`w-2.5 h-2.5 -mt-1 ${isActive && sortConfig.direction === 'desc' ? 'text-[#03DF95]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="w-full bg-white border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden rounded-md font-['Quicksand']">
      <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: '8px', background: '#0f172a', color: '#fff', fontSize: '12px' } }} />

      {/* FİLTRE PANELİ */}
      <div className="bg-slate-900 border-b border-slate-800 p-5 sm:p-7 flex flex-col gap-6 text-white w-full relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#03DF95]/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="flex flex-col">
              <h2 className="text-xl sm:text-2xl font-black tracking-wide text-white drop-shadow-sm">
                Kayıt <span className="text-[#03DF95]">Sorgulama</span>
              </h2>
              <p className="text-slate-400 text-[11px] font-bold tracking-widest uppercase mt-1">Sunucu Tabanlı Filtreleme ve Kontrol</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="bg-[#03DF95]/10 text-[#03DF95] border border-[#03DF95]/30 px-3 py-1 rounded-md text-xs font-bold shadow-sm">
                  {totalRecordsCount.toLocaleString('tr-TR')} KAYIT BULUNDU
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {selectedIds.length > 0 && (
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white h-10 px-4 rounded-md text-[11px] font-black transition-colors flex items-center gap-2 uppercase tracking-wider"
              >
                <Trash2 className="w-4 h-4" /> SİL ({selectedIds.length})
              </button>
            )}
            <button 
              onClick={exportToExcel}
              className="bg-[#03DF95] hover:bg-[#02c784] text-slate-900 h-10 px-4 rounded-md text-[11px] font-black transition-colors flex items-center gap-2 uppercase tracking-wider"
            >
              EXCEL İNDİR
            </button>
            <button 
              onClick={resetAllFilters}
              className="bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 h-10 px-4 rounded-md text-[10px] font-black border border-slate-700 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <RefreshCw className="w-3 h-3" /> Sıfırla
            </button>
          </div>
        </div>

        {/* ARAMA ÇUBUĞU */}
        <form onSubmit={handleSearchSubmit} className="relative w-full z-10 pt-2 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
               <Search className="w-5 h-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-slate-800 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:border-[#03DF95] uppercase placeholder:text-slate-500 transition-colors"
              placeholder="İSİM, TAKİP NO, SD DOCUMENT VEYA TELEFON YAZIN..."
            />
          </div>
          <button 
            type="submit" 
            className="h-12 bg-[#03DF95] hover:bg-[#02c784] text-slate-900 px-8 rounded-md text-xs font-black uppercase tracking-widest transition-colors"
          >
            ARA
          </button>
        </form>

        {/* FİLTRE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full relative z-10 pt-4 border-t border-slate-800/50">
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[#03DF95] tracking-widest uppercase">Kargo Durumu</label>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value as FilterType); setCurrentPage(1); }}
              className="h-10 w-full bg-slate-800 border border-slate-700 text-white px-3 rounded-md text-[11px] font-bold focus:outline-none focus:border-[#03DF95] cursor-pointer"
            >
              <option value="ALL">KARIŞIK (TÜMÜ)</option>
              <option value="NORMAL">NORMAL (TESLİMAT)</option>
              <option value="RETURN">SADECE İADELER</option>
              <option value="ERROR">EKSİK / HATALI ADRES</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[#03DF95] tracking-widest uppercase">Arama Odağı</label>
            <select
              value={specificField}
              onChange={(e) => { setSpecificField(e.target.value as any); setCurrentPage(1); }}
              className="h-10 w-full bg-slate-800 border border-slate-700 text-white px-3 rounded-md text-[11px] font-bold focus:outline-none focus:border-[#03DF95] cursor-pointer"
            >
              <option value="ALL">GENEL ARAMA</option>
              <option value="CUSTOMER">SADECE MÜŞTERİ ADI</option>
              <option value="SD">SADECE SD DOCUMENT</option>
              <option value="DELIVERY">SADECE DELIVERY NO</option>
              <option value="TRACKING">SADECE TAKİP NO</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center h-4">
              <label className="text-[10px] font-bold text-[#03DF95] tracking-widest uppercase">Tarih Aralığı</label>
              <div className="flex gap-1">
                <button type="button" onClick={() => applyDatePreset("TODAY")} className="text-[9px] font-bold text-slate-400 hover:text-white px-1">Bugün</button>
                <span className="text-slate-600">|</span>
                <button type="button" onClick={() => applyDatePreset("WEEK")} className="text-[9px] font-bold text-slate-400 hover:text-white px-1">Hafta</button>
                <span className="text-slate-600">|</span>
                <button type="button" onClick={() => applyDatePreset("MONTH")} className="text-[9px] font-bold text-slate-400 hover:text-white px-1">Ay</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="h-10 w-full bg-slate-800 border border-slate-700 text-white rounded-md text-[11px] font-bold px-2 focus:outline-none focus:border-[#03DF95]" 
              />
              <span className="text-slate-500 font-black">-</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="h-10 w-full bg-slate-800 border border-slate-700 text-white rounded-md text-[11px] font-bold px-2 focus:outline-none focus:border-[#03DF95]" 
              />
            </div>
          </div>

        </div>
      </div>

      {/* VERİ TABLOSU */}
      <div className="overflow-x-auto w-full flex-1 bg-white">
        <table className="w-full text-left border-collapse min-w-[1250px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 w-10 text-center border-r border-slate-100">
                <input type="checkbox" checked={records.length > 0 && selectedIds.length === records.length} onChange={handleSelectAll} className="w-3.5 h-3.5 cursor-pointer accent-[#03DF95] rounded-sm" />
              </th>
              <SortHeader label="Yüklenme" sortKey="created_at" />
              <SortHeader label="Müşteri Bilgisi" sortKey="customer_name" />
              <SortHeader label="Evrak & Sipariş" sortKey="sd_document" />
              <SortHeader label="Kargo Numaraları" sortKey="aras_tracking_number" />
              <SortHeader label="Adet" sortKey="item_count" align="center" />
              <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Durum</th>
              <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right pr-6">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-24 text-center bg-white">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <svg className="animate-spin w-8 h-8 text-[#03DF95]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-sm font-medium text-slate-500">Sunucudan Veriler Çekiliyor...</span>
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-20 text-center text-sm font-medium text-slate-500 bg-slate-50/50">
                  Belirtilen kriterlere uygun kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              records.map((rec) => {
                const addressErr = isAddressError(rec);
                const isSelected = selectedIds.includes(rec.id);
                
                return (
                  <tr key={rec.id} className={`transition-colors hover:bg-slate-50 ${isSelected ? "bg-emerald-50/30" : "bg-white"}`}>
                    <td className="px-4 py-3 text-center border-r border-slate-100">
                      <input type="checkbox" checked={isSelected} onChange={() => handleSelect(rec.id)} className="w-3.5 h-3.5 cursor-pointer accent-[#03DF95] rounded-sm" />
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-slate-800 block">{new Date(rec.created_at).toLocaleDateString('tr-TR')}</span>
                      <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{new Date(rec.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">{rec.customer_name || "-"}</span>
                      <span className="text-[10px] font-medium text-slate-500 block mt-0.5">{rec.mobile_number || "Telefon Yok"}</span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-slate-700"><span className="text-[9px] text-slate-400 font-normal mr-1">SD:</span>{rec.sd_document}</span>
                        <span className="text-[11px] font-bold text-slate-700"><span className="text-[9px] text-slate-400 font-normal mr-1">DN:</span>{rec.delivery_number}</span>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      {addressErr ? (
                        <div className="flex flex-col items-start gap-1 p-1.5 bg-orange-50 border border-orange-200 rounded-md w-fit">
                          <span className="text-orange-700 text-[9px] font-bold uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> EKSİK/HATALI ADRES
                          </span>
                          <span className="text-slate-700 text-[10px] font-semibold truncate max-w-[180px]" title={/[a-zA-Z]/.test(rec.aras_shipment_number) ? rec.aras_shipment_number : rec.aras_tracking_number}>
                            {/[a-zA-Z]/.test(rec.aras_shipment_number) ? rec.aras_shipment_number : rec.aras_tracking_number || "Numara Yok"}
                          </span>
                        </div>
                      ) : (
                        <div className={`flex flex-col gap-0.5 ${rec.is_returned ? 'text-slate-400 line-through opacity-70' : 'text-slate-900'}`}>
                          <span className="text-[11px] font-semibold"><span className="text-[9px] text-slate-400 font-normal mr-1">S:</span>{rec.aras_shipment_number || "-"}</span>
                          <span className="text-[11px] font-bold text-[#03DF95]"><span className="text-[9px] text-slate-400 font-normal mr-1">T:</span>{rec.aras_tracking_number || "-"}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold border ${
                        rec.item_count > 1 ? "bg-slate-900 text-[#03DF95] border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}>
                        {rec.item_count}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {rec.is_returned ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-bold uppercase rounded border border-red-200">İade</span>
                      ) : (
                        <span className="text-slate-400 text-xs font-medium">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right pr-6 whitespace-nowrap">
                      {/* DÜZENLENEN İŞLEM BUTONLARI */}
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => triggerReturnToggle(rec.id, rec.is_returned)}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1.5 transition-colors border ${
                            rec.is_returned 
                              ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200" 
                              : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                          }`}
                        >
                          {rec.is_returned ? <Undo2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {rec.is_returned ? "İADEYİ İPTAL ET" : "İADEYE ÇEK"}
                        </button>

                        <button 
                          onClick={() => openArasTrack(rec.aras_tracking_number)}
                          disabled={!rec.aras_tracking_number || addressErr}
                          className="px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1.5 bg-[#03DF95] hover:bg-[#02c784] text-slate-900 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 transition-colors border border-transparent disabled:border-slate-200"
                        >
                          <Truck className="w-3 h-3" />
                          {addressErr ? "TAKİP YOK" : "KARGO TAKİP"}
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

      {/* SAYFALAMA BARI */}
      {!loading && totalRecordsCount > 0 && (
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold text-slate-500">
              Sayfa <span className="text-slate-900 font-black mx-1">{currentPage}</span> / {totalPages}
            </span>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Satır:</span>
              <select 
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="h-7 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold px-1 focus:outline-none rounded cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2.5 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-600 text-[11px] font-bold rounded hover:bg-slate-100 transition-colors">«</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-600 text-[11px] font-bold rounded hover:bg-slate-100 transition-colors uppercase tracking-widest">Önceki</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-600 text-[11px] font-bold rounded hover:bg-slate-100 transition-colors uppercase tracking-widest">Sonraki</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2.5 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-600 text-[11px] font-bold rounded hover:bg-slate-100 transition-colors">»</button>
          </div>
        </div>
      )}

      {/* İADE MODALI */}
      {returnModal.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white shadow-xl w-full max-w-sm flex flex-col rounded-md overflow-hidden">
            <div className={`p-4 flex items-center justify-center ${!returnModal.currentStatus ? "bg-orange-500" : "bg-slate-800"}`}>
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
              <div className="flex gap-2 w-full mt-2">
                <button onClick={() => setReturnModal({isOpen: false, id: "", currentStatus: false})} disabled={isReturning} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-10 text-[11px] uppercase tracking-widest rounded transition-colors">İptal</button>
                <button onClick={confirmReturnToggle} disabled={isReturning} className={`flex-1 text-white font-bold h-10 text-[11px] uppercase tracking-widest rounded transition-colors ${!returnModal.currentStatus ? "bg-orange-500 hover:bg-orange-600" : "bg-[#03DF95] hover:bg-[#02c784] text-slate-900"}`}>
                  {isReturning ? "İşleniyor" : "Onayla"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SİLME MODALI */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white shadow-xl w-full max-w-sm flex flex-col rounded-md overflow-hidden">
            <div className="bg-red-500 p-4 flex items-center justify-center">
              <h2 className="text-white font-bold text-sm text-center uppercase tracking-widest">Kalıcı Silme Onayı</h2>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              <div className="text-center w-full">
                <h3 className="text-xl font-black text-red-600 mb-2">{selectedIds.length} Kayıt</h3>
                <p className="text-sm font-medium text-slate-700 leading-relaxed bg-red-50 p-3 rounded border border-red-100">
                  Seçili kayıtlar veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz.
                </p>
              </div>
              <div className="flex gap-2 w-full mt-2">
                <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-10 text-[11px] uppercase tracking-widest rounded transition-colors">İptal</button>
                <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold h-10 text-[11px] uppercase tracking-widest rounded transition-colors">
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