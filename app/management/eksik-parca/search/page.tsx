"use client";

import { Fragment, useEffect, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase"; 
import * as XLSX from "xlsx"; 
import toast, { Toaster } from "react-hot-toast";
import { Undo2, Search, AlertTriangle, RefreshCw, Trash2, FileText, Mail } from 'lucide-react';
import { formatCargoRecordAddress } from "@/lib/cargo-contact";
import { buildMissingPartEmail, hasValidMissingPartOrderNumber, hasValidRecipientEmail, getMissingPartIssue, onePostaComposeUrl } from "@/lib/missing-part-email";

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
  missing_address: boolean;
  oneposta_opened_at?: string | null;
  note?: string;
  email?: string | null;
  street?: string | null;
  street_2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  address?: string;
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
  const [expandedContact, setExpandedContact] = useState<{ id: string; field: "email" | "address" | "note" } | null>(null);
  const [openingOnePostaId, setOpeningOnePostaId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [returnModal, setReturnModal] = useState<{isOpen: boolean, id: string, currentStatus: boolean}>({ 
    isOpen: false, id: "", currentStatus: false 
  });
  const [isReturning, setIsReturning] = useState(false);

  // YENİ: NOT MODALI STATE
  const [noteModal, setNoteModal] = useState<{isOpen: boolean, id: string, note: string}>({
    isOpen: false, id: "", note: ""
  });
  const [isSavingNote, setIsSavingNote] = useState(false);

  // VERİTABANINDAN VERİ ÇEKME FONKSİYONU
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
          query = query.or(`customer_name.ilike.%${searchQuery}%,sd_document.ilike.%${searchQuery}%,delivery_number.ilike.%${searchQuery}%,mobile_number.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,street.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,aras_tracking_number.ilike.%${searchQuery}%,aras_shipment_number.ilike.%${searchQuery}%`);
        }
      }

      if (filterType === "RETURN") {
        query = query.eq("is_returned", true);
      } else if (filterType === "ERROR") {
        query = query.eq("missing_address", true);
      } else if (filterType === "NORMAL") {
        query = query.eq("is_returned", false).or('missing_address.eq.false,missing_address.is.null');
      }

      if (startDate) query = query.gte("created_at", `${startDate}T00:00:00Z`);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59Z`);

      query = query
        .order(sortConfig.key, { ascending: sortConfig.direction === "asc" })
        .order("id", { ascending: true }); 

      const from = (currentPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      // Müşteri iletişim verileri bu tablodaki kalıcı kopyadan gelir.
      // Ana ERP dosyasının silinmesi artık görünümü veya e-posta taslaklarını etkilemez.
      setRecords(((data || []) as ShipmentRecord[]).map((record) => ({
        ...record,
        address: formatCargoRecordAddress(record),
      })));
      // Filtre veya sayfa değiştiğinde önceki sayfanın seçimleri yeni sayfaya taşınmaz.
      setSelectedIds([]);
      setExpandedContact(null);
      if (count !== null) setTotalRecordsCount(count);

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

  const saveNote = async () => {
    setIsSavingNote(true);
    try {
      const { error } = await supabase
        .from("cargo_records")
        .update({ note: noteModal.note })
        .eq("id", noteModal.id);

      if (error) throw error;

      setRecords(prev => prev.map(r => r.id === noteModal.id ? { ...r, note: noteModal.note } : r));
      toast.success("Not başarıyla kaydedildi.", {
        style: { border: '1px solid #03DF95', background: '#0f172a', color: '#03DF95' }
      });
      setNoteModal({ isOpen: false, id: "", note: "" });
    } catch (err: any) {
      toast.error("Not kaydedilemedi: " + err.message);
    } finally {
      setIsSavingNote(false);
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
      "E-posta (Kayıt)": r.email || "",
      "Tam Adres (Kayıt)": r.address || "",
      "Adres Satırı": r.street || "",
      "İkinci Adres Satırı": r.street_2 || "",
      "İl": r.city || "",
      "Bölge": r.region || "",
      "Posta Kodu": r.postal_code || "",
      "Ülke": r.country || "",
      "Aras Shipment No": r.aras_shipment_number,
      "Takip No": r.aras_tracking_number,
      "Kalem": r.item_count || 1,
      "Durum": r.is_returned ? "İADE" : (r.missing_address ? "EKSİK/HATALI ADRES" : "NORMAL"),
      "Ek Notlar": r.note || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rapor");
    XLSX.writeFile(workbook, `WMS_Rapor_${new Date().getTime()}.xlsx`);
  };

  const openOnePostaDraft = async (record: ShipmentRecord) => {
    if (!record.missing_address || record.is_returned || openingOnePostaId === record.id) return;
    if (!hasValidRecipientEmail(record.email)) {
      toast.error("Bu kaydın geçerli bir alıcı e-posta adresi yok.");
      return;
    }
    if (!hasValidMissingPartOrderNumber(record.sd_document)) {
      toast.error("T ile başlayan eksik parça sipariş numarası kontrol edilmeli.");
      return;
    }

    const message = buildMissingPartEmail(record);
    // Sekmeyi kullanıcı tıklaması sırasında aç: veritabanı yanıtını beklemek
    // tarayıcının açılır pencere engeline takılabilir.
    window.open(onePostaComposeUrl(record.email!, message.subject, message.body), "_blank", "noopener,noreferrer");

    setOpeningOnePostaId(record.id);
    try {
      const { data, error } = await supabase
        .from("cargo_records")
        .update({ oneposta_opened_at: new Date().toISOString() })
        .eq("id", record.id)
        .select("oneposta_opened_at")
        .single();
      if (error) throw error;

      setRecords((previous) => previous.map((row) =>
        row.id === record.id ? { ...row, oneposta_opened_at: data.oneposta_opened_at } : row
      ));
      toast.success("1Posta açılışı kaydedildi.");
    } catch (error) {
      console.error("1Posta açılışı kaydedilemedi:", error);
      toast.error("1Posta açıldı ancak işlem kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setOpeningOnePostaId(null);
    }
  };

  // KARGO TAKİP BUTONU İÇİN DİNAMİK YÖNLENDİRİCİ (Hepsijet ve Aras Ayrımı)
  const openTrack = (trackingNo: string, isHepsijet: boolean) => {
    if (!trackingNo) return;
    
    if (isHepsijet) {
      window.open(`https://www.hepsijet.com/gonderi-takibi/${trackingNo}`, "Hepsijet_Takip", "width=1000,height=750,left=200,top=100");
    } else {
      // Sadece Aras kargolarda harf kontrolü yap, Hepsijet'i sal.
      if (/[a-zA-Z]/.test(trackingNo)) return;
      window.open(`https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${trackingNo}`, "Aras_Takip", "width=1000,height=750,left=200,top=100");
    }
  };

  const totalPages = Math.ceil(totalRecordsCount / rowsPerPage) || 1;

  const SortHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: SortKey; align?: "left" | "center" | "right" }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        className={`px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 cursor-pointer transition-colors hover:text-slate-900 select-none ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-1.5 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
          {label}
          <div className="flex flex-col text-slate-300">
            <svg className={`w-3 h-3 ${isActive && sortConfig.direction === 'asc' ? 'text-[#03DF95]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7"></path></svg>
            <svg className={`w-3 h-3 -mt-1 ${isActive && sortConfig.direction === 'desc' ? 'text-[#03DF95]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
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
              <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Sunucu Tabanlı Filtreleme ve Kontrol</p>
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
                className="bg-red-500 hover:bg-red-600 text-white h-10 px-4 rounded-md text-xs font-black transition-colors flex items-center gap-2 uppercase tracking-wider"
              >
                <Trash2 className="w-4 h-4" /> SİL ({selectedIds.length})
              </button>
            )}
            <button 
              onClick={exportToExcel}
              className="bg-[#03DF95] hover:bg-[#02c784] text-slate-900 h-10 px-4 rounded-md text-xs font-black transition-colors flex items-center gap-2 uppercase tracking-wider"
            >
              EXCEL İNDİR
            </button>
            <button 
              onClick={resetAllFilters}
              className="bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 h-10 px-4 rounded-md text-xs font-black border border-slate-700 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Sıfırla
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
              placeholder="İSİM, E-POSTA, ADRES, TAKİP NO VEYA TELEFON..."
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
            <label className="text-xs font-bold text-[#03DF95] tracking-widest uppercase">Kargo Durumu</label>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value as FilterType); setCurrentPage(1); }}
              className="h-10 w-full bg-slate-800 border border-slate-700 text-white px-3 rounded-md text-xs font-bold focus:outline-none focus:border-[#03DF95] cursor-pointer"
            >
              <option value="ALL">KARIŞIK (TÜMÜ)</option>
              <option value="NORMAL">NORMAL (TESLİMAT)</option>
              <option value="RETURN">SADECE İADELER</option>
              <option value="ERROR">EKSİK / HATALI ADRES</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#03DF95] tracking-widest uppercase">Arama Odağı</label>
            <select
              value={specificField}
              onChange={(e) => { setSpecificField(e.target.value as any); setCurrentPage(1); }}
              className="h-10 w-full bg-slate-800 border border-slate-700 text-white px-3 rounded-md text-xs font-bold focus:outline-none focus:border-[#03DF95] cursor-pointer"
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
              <label className="text-xs font-bold text-[#03DF95] tracking-widest uppercase">Tarih Aralığı</label>
              <div className="flex gap-1">
                <button type="button" onClick={() => applyDatePreset("TODAY")} className="text-[10px] font-bold text-slate-400 hover:text-white px-1">Bugün</button>
                <span className="text-slate-600">|</span>
                <button type="button" onClick={() => applyDatePreset("WEEK")} className="text-[10px] font-bold text-slate-400 hover:text-white px-1">Hafta</button>
                <span className="text-slate-600">|</span>
                <button type="button" onClick={() => applyDatePreset("MONTH")} className="text-[10px] font-bold text-slate-400 hover:text-white px-1">Ay</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="h-10 w-full bg-slate-800 border border-slate-700 text-white rounded-md text-xs font-bold px-2 focus:outline-none focus:border-[#03DF95]" 
              />
              <span className="text-slate-500 font-black">-</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="h-10 w-full bg-slate-800 border border-slate-700 text-white rounded-md text-xs font-bold px-2 focus:outline-none focus:border-[#03DF95]" 
              />
            </div>
          </div>

        </div>
      </div>

      <div className="border-b border-blue-100 bg-blue-50 px-5 py-3 text-xs text-blue-900">
        <span className="font-bold">Eksik parça bilgilendirme:</span> E-posta ve tüm adres alanları cargo_records kaydında kalıcı olarak saklanır.
        E-posta, adres ve notları satırdaki detay düğmelerinden açabilirsiniz. Eksik bilgi kayıtları turuncu; 1Posta butonuna basılmış kayıtlar yeşil işaretlenir. Bu kayıt açılma bilgisidir, gerçek gönderim onayı değildir.
      </div>

      {/* VERİ TABLOSU */}
      <div className="w-full min-w-0 max-w-full flex-1 overflow-x-auto overscroll-x-contain bg-white">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[9%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[5%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 w-10 text-center border-r border-slate-100">
                <input type="checkbox" checked={records.length > 0 && selectedIds.length === records.length} onChange={handleSelectAll} className="w-4 h-4 cursor-pointer accent-[#03DF95] rounded-sm" />
              </th>
              <SortHeader label="Yüklenme" sortKey="created_at" />
              <SortHeader label="Müşteri Bilgisi" sortKey="customer_name" />
              <SortHeader label="Evrak & Sipariş" sortKey="sd_document" />
              <SortHeader label="Kargo Numaraları" sortKey="aras_tracking_number" />
              <SortHeader label="Adet" sortKey="item_count" align="center" />
              <th className="px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Durum</th>
              <th className="px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Kayıt Detayları</th>
              <th className="px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-24 text-center bg-white">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <svg className="animate-spin w-8 h-8 text-[#03DF95]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-sm font-medium text-slate-500">Sunucudan Veriler Çekiliyor...</span>
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-20 text-center text-sm font-medium text-slate-500 bg-slate-50/50">
                  Belirtilen kriterlere uygun kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              records.map((rec) => {
                
                // MİMARİ MÜDAHALE: CPR Hepsijet olduğu için harf kuralını ez (Bypass)
                const trackingStr = rec.aras_tracking_number || "";
                const shipmentStr = rec.aras_shipment_number || "";
                const isHepsijet = trackingStr.toUpperCase().startsWith("CPR") || shipmentStr.toUpperCase().startsWith("CPR");
                
                // Veritabanında true olsa bile, Hepsijet ise "Eksik Adres" hatasını kaldır
                const addressErr = rec.missing_address && !isHepsijet;
                const onePostaOpened = Boolean(rec.oneposta_opened_at); 

                const isSelected = selectedIds.includes(rec.id);
                const isEmailOpen = expandedContact?.id === rec.id && expandedContact.field === "email";
                const isAddressOpen = expandedContact?.id === rec.id && expandedContact.field === "address";
                const isNoteOpen = expandedContact?.id === rec.id && expandedContact.field === "note";
                const issue = getMissingPartIssue(rec.note);
                
                return (
                  <Fragment key={rec.id}>
                  <tr className={`transition-colors ${addressErr && !rec.is_returned ? (onePostaOpened ? "bg-emerald-50 hover:bg-emerald-100/70" : "bg-orange-50 hover:bg-orange-100/70") : isSelected ? "bg-emerald-50/40 hover:bg-emerald-50" : "bg-white hover:bg-slate-50"}`}>
                    <td className={`border-l-[3px] border-r border-slate-100 px-2 py-3 text-center ${addressErr && !rec.is_returned ? (onePostaOpened ? "border-l-emerald-500" : "border-l-orange-400") : "border-l-transparent"}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => handleSelect(rec.id)} className="w-4 h-4 cursor-pointer accent-[#03DF95] rounded-sm" />
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-800 block">{new Date(rec.created_at).toLocaleDateString('tr-TR')}</span>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5">{new Date(rec.created_at).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    
                    <td className="min-w-0 px-2 py-3">
                      <span className="block truncate text-xs font-bold text-slate-900" title={rec.customer_name || ""}>{rec.customer_name || "-"}</span>
                      <span className="text-xs font-medium text-slate-500 block mt-0.5">{rec.mobile_number || "Telefon Yok"}</span>
                    </td>
                    
                    <td className="min-w-0 px-2 py-3">
                      <div className="min-w-0 space-y-1">
                        <span className="block truncate text-[11px] font-bold text-slate-700" title={rec.sd_document}><span className="mr-1 text-[10px] font-normal text-slate-400">SD:</span>{rec.sd_document || "-"}</span>
                        <span className="block truncate text-[11px] font-bold text-slate-700" title={rec.delivery_number}><span className="mr-1 text-[10px] font-normal text-slate-400">DN:</span>{rec.delivery_number || "-"}</span>
                      </div>
                    </td>
                    
                    <td className="min-w-0 px-2 py-3">
                      {addressErr ? (
                        <div className="min-w-0 rounded-md border border-orange-200 bg-orange-100/60 p-1.5">
                          <span className="flex items-center gap-1 text-[10px] font-bold leading-tight text-orange-800">
                            <AlertTriangle className="w-3.5 h-3.5" /> EKSİK/HATALI ADRES
                          </span>
                          <span className="block max-w-full truncate text-[11px] font-semibold text-slate-700" title={/[a-zA-Z]/.test(rec.aras_shipment_number) ? rec.aras_shipment_number : rec.aras_tracking_number}>
                            {/[a-zA-Z]/.test(rec.aras_shipment_number) ? rec.aras_shipment_number : rec.aras_tracking_number || "Numara Yok"}
                          </span>
                        </div>
                      ) : (
                        <div className={`min-w-0 space-y-1 ${rec.is_returned ? 'text-slate-400 line-through opacity-70' : 'text-slate-900'}`}>
                          <span className="block truncate text-[11px] font-semibold" title={rec.aras_shipment_number}><span className="mr-1 text-[10px] font-normal text-slate-400">S:</span>{rec.aras_shipment_number || "-"}</span>
                          <span className="block truncate text-[11px] font-bold text-emerald-700" title={rec.aras_tracking_number}><span className="mr-1 text-[10px] font-normal text-slate-400">T:</span>{rec.aras_tracking_number || "-"}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-1 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold border ${
                        rec.item_count > 1 ? "bg-slate-900 text-[#03DF95] border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}>
                        {rec.item_count}
                      </span>
                    </td>

                    <td className="min-w-0 px-2 py-3">
                      {rec.is_returned ? (
                        <span className="inline-flex rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">İade</span>
                      ) : addressErr ? (
                        <div className="min-w-0">
                          <span className="inline-flex items-center gap-1 rounded border border-orange-200 bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-900">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> Eksik bilgi
                          </span>
                          {onePostaOpened && (
                            <span className="mt-1.5 block rounded border border-emerald-300 bg-emerald-100 px-2 py-1 text-[10px] font-bold leading-tight text-emerald-900" title="1Posta taslağı açıldı; gönderim doğrulanmadı">
                              1Posta açıldı · {new Date(rec.oneposta_opened_at!).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          )}
                          <span className="mt-1.5 block break-words text-[11px] font-semibold leading-tight text-orange-900">{issue.title}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Normal</span>
                      )}
                    </td>
                    <td className="min-w-0 px-2 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button type="button" aria-expanded={isEmailOpen} onClick={() => setExpandedContact(isEmailOpen ? null : { id: rec.id, field: "email" })} className={`rounded border px-2 py-1.5 text-[10px] font-bold transition-colors ${isEmailOpen ? "border-blue-300 bg-blue-100 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}>E-posta</button>
                        <button type="button" aria-expanded={isAddressOpen} onClick={() => setExpandedContact(isAddressOpen ? null : { id: rec.id, field: "address" })} className={`rounded border px-2 py-1.5 text-[10px] font-bold transition-colors ${isAddressOpen ? "border-blue-300 bg-blue-100 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}>Adres</button>
                        <button type="button" aria-expanded={isNoteOpen} onClick={() => setExpandedContact(isNoteOpen ? null : { id: rec.id, field: "note" })} className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold transition-colors ${isNoteOpen ? "border-orange-300 bg-orange-100 text-orange-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}><FileText className="h-3 w-3" /> Not</button>
                      </div>
                    </td>
                    <td className="min-w-0 px-2 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {addressErr && !rec.is_returned && (
                          <button
                            type="button"
                            onClick={() => void openOnePostaDraft(rec)}
                            disabled={!hasValidRecipientEmail(rec.email) || !hasValidMissingPartOrderNumber(rec.sd_document) || openingOnePostaId === rec.id}
                            title={!hasValidRecipientEmail(rec.email) ? "Kayıt e-posta adresi eksik veya hatalı" : !hasValidMissingPartOrderNumber(rec.sd_document) ? "T ile başlayan sipariş numarası bulunamadı" : onePostaOpened ? "1Posta taslağını tekrar aç; önceki açılış kaydedildi" : "1Posta taslağı aç; açılma zamanı kaydedilir, otomatik gönderilmez"}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40 ${onePostaOpened ? "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0" /> {openingOnePostaId === rec.id ? "Kaydediliyor" : onePostaOpened ? "Tekrar Aç" : "1Posta"}
                          </button>
                        )}
                        <button 
                          onClick={() => triggerReturnToggle(rec.id, rec.is_returned)}
                          className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold transition-colors ${
                            rec.is_returned 
                              ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-700" 
                              : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:text-orange-700"
                          }`}
                          title={rec.is_returned ? "İadeyi İptal Et" : "İadeye Çek"}
                        >
                          <Undo2 className="h-3.5 w-3.5 shrink-0" />
                          {rec.is_returned ? "İadeyi Kaldır" : "İade"}
                        </button>

                        {/* FİRMAYA GÖRE DEĞİŞEN DİNAMİK TAKİP BUTONU */}
                        {!addressErr && (
                        <button 
                          onClick={() => openTrack(rec.aras_tracking_number, isHepsijet)}
                          disabled={!rec.aras_tracking_number || addressErr}
                          className={`inline-flex items-center gap-1 rounded border border-transparent px-2 py-1.5 text-[10px] font-bold transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 ${
                            isHepsijet 
                              ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                              : "bg-red-600 hover:bg-red-700 text-white"
                          }`}
                          title={isHepsijet ? "Hepsijet Kargo Takip" : "Aras Kargo Takip"}
                        >
                          {isHepsijet ? (
                            <img src="https://www.hepsijet.com/images/hepsijet.svg" className="h-3 brightness-0 invert" alt="Hepsijet" />
                          ) : (
                            <img src="https://inet.araskargo.com.tr/assets/images/INET%20TR%20Logos/aras-logo.png" className="h-3 object-contain brightness-0 invert" alt="Aras" />
                          )}
                          Takip
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {(isEmailOpen || isAddressOpen || isNoteOpen) && (
                    <tr className="border-t border-orange-100 bg-slate-50">
                      <td colSpan={9} className="px-4 py-3 sm:px-6">
                        {isEmailOpen ? (
                          <div className="max-w-4xl">
                            <p className="mb-1 text-xs font-semibold text-slate-600">Kayıtlı E-posta Adresi</p>
                            <p className="select-text break-all text-sm font-semibold text-slate-900">{rec.email?.trim() || "E-posta bilgisi bulunamadı."}</p>
                          </div>
                        ) : isAddressOpen ? (
                          <div className="max-w-5xl">
                            <p className="mb-1 text-xs font-semibold text-slate-600">Sistemde Kayıtlı Adres</p>
                            {addressErr && <p className="mb-2 rounded border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-900"><span className="font-bold">Eksik Bilgi Nedeni:</span> {issue.title}{issue.detail ? " • " + issue.detail : ""}</p>}
                            <p className="select-text whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">{rec.address || "Adres bilgisi bulunamadı."}</p>
                            <div className="mt-3 grid gap-x-6 gap-y-2 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                              {([
                                ["Adres satırı", rec.street],
                                ["Adres ek satırı", rec.street_2],
                                ["İl", rec.city],
                                ["Bölge / İlçe", rec.region],
                                ["Posta kodu", rec.postal_code],
                                ["Ülke", rec.country],
                              ] as const).map(([label, value]) => (
                                <div key={label} className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
                                  <p className="select-text break-words text-xs font-medium text-slate-800">{value?.trim() || "Belirtilmemiş"}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-5xl">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-600">Kayıt Notu ve Eksik Bilgi Gerekçesi</p>
                              <button
                                type="button"
                                onClick={() => setNoteModal({ isOpen: true, id: rec.id, note: rec.note || "" })}
                                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                {rec.note ? "Notu Düzenle" : "Not Ekle"}
                              </button>
                            </div>
                            {addressErr ? (
                              <div className="mt-2 rounded border border-orange-200 bg-orange-50 p-3">
                                <p className="text-xs font-bold text-orange-900">Eksik Bilgi Nedeni: {issue.title}</p>
                                {issue.detail && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">Ek Açıklama: {issue.detail}</p>}
                              </div>
                            ) : (
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{rec.note?.trim() || "Bu kayda henüz not eklenmemiş."}</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* SAYFALAMA BARI */}
      {!loading && totalRecordsCount > 0 && (
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <span className="text-xs font-bold text-slate-500">
              Sayfa <span className="text-slate-900 font-black mx-1">{currentPage}</span> / {totalPages}
            </span>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Satır:</span>
              <select 
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="h-8 bg-white border border-slate-200 text-slate-700 text-xs font-bold px-1 focus:outline-none rounded cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold rounded hover:bg-slate-100 transition-colors">«</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold rounded hover:bg-slate-100 transition-colors uppercase tracking-widest">Önceki</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold rounded hover:bg-slate-100 transition-colors uppercase tracking-widest">Sonraki</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-white border border-slate-200 disabled:opacity-50 text-slate-600 text-xs font-bold rounded hover:bg-slate-100 transition-colors">»</button>
          </div>
        </div>
      )}

      {/* NOT MODALI */}
      {noteModal.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white shadow-xl w-full max-w-md flex flex-col rounded-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-4 flex items-center justify-between">
              <h2 className="font-bold text-sm text-white uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#03DF95]" />
                Kayıt Notu
              </h2>
              <button onClick={() => setNoteModal({isOpen: false, id: "", note: ""})} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Kargo ile ilgili gelişmeleri / notları yazın
              </label>
              <textarea
                value={noteModal.note}
                onChange={(e) => setNoteModal(prev => ({...prev, note: e.target.value}))}
                placeholder="Örn: Müşteriye ulaşılamadı. Yeni takip numarası ile tekrar gönderildi: 123456789"
                className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:border-[#03DF95] focus:ring-1 focus:ring-[#03DF95] resize-none transition-all"
              />
              <div className="flex gap-2 w-full mt-2">
                <button 
                  onClick={() => setNoteModal({isOpen: false, id: "", note: ""})} 
                  disabled={isSavingNote} 
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold h-10 text-[11px] uppercase tracking-widest rounded transition-colors"
                >
                  İptal
                </button>
                <button 
                  onClick={saveNote} 
                  disabled={isSavingNote} 
                  className="flex-1 bg-[#03DF95] hover:bg-[#02c784] text-slate-900 font-bold h-10 text-[11px] uppercase tracking-widest rounded transition-colors"
                >
                  {isSavingNote ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
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
          <div className="bg-white shadow-xl w-full max-w-md flex flex-col rounded-md overflow-hidden">
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