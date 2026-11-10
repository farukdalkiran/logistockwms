// app/management/_components/TransferCenterSection.tsx
"use client";

import { useState } from "react";
import {
  Package,
  Truck,
  Timer,
  CheckCircle2,
  BarChart2,
  ArrowRight,
  Users,
  Search,
  Eye,
  X,
  UserCheck,
  ScanLine,
  AlertTriangle,
  Calendar,
  Hash,
  Box,
  Activity,
  FileText,
  Layers,
  Download,
  Clock
} from "lucide-react";
import { getTransferDetailsServer } from "@/app/actions/dashboard";

export interface TransferData {
  id: string;
  transfer_code: string;
  status: string;
  created_at: string;
  from_branch_name: string;
  to_branch_name: string;
  picker_name: string;
}

interface TransferItemDetail {
  id: string;
  product_id: string;
  barcode: string;
  sku: string;
  name: string;
  category: string;
  is_consumable: boolean;
  image_url: string | null;
  requested_qty: number;
  approved_qty: number;
  sent_qty: number;
  received_qty: number;
}

interface TransferFullDetail {
  id: string;
  transfer_code: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  tracking_barcode: string;
  from_branch: string;
  to_branch: string;
  carrier_name: string;
  carrier_type: string;
  actors: {
    creator: { isAssigned: boolean; name: string; title: string; time: string };
    picker: { isAssigned: boolean; name: string; title: string };
    completer: { isCompleted: boolean; name: string; title: string; time: string | null };
  };
  items: TransferItemDetail[];
  timeline: {
    id: string;
    action_type: string;
    description: string;
    created_at: string;
    employee_name: string;
  }[];
}

interface Props {
  recentTransfers: TransferData[];
  getStatusStyle: (status: string) => string;
  getStatusText: (status: string) => string;
}

export function TransferCenterSection({
  recentTransfers,
  getStatusStyle,
  getStatusText
}: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pop-up (Modal) State'leri
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [selectedSummary, setSelectedSummary] = useState<TransferData | null>(null);
  const [transferDetail, setTransferDetail] = useState<TransferFullDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"ITEMS" | "TIMELINE">("ITEMS");

  const normalizeStatus = (s: string) => s?.toUpperCase().replace("İ", "I") || "";

  const tStats = {
    yolda: recentTransfers.filter((t) => normalizeStatus(t.status) === "YOLDA").length,
    toplaniyor: recentTransfers.filter((t) => normalizeStatus(t.status) === "TOPLANIYOR").length,
    bekliyor: recentTransfers.filter((t) => normalizeStatus(t.status) === "BEKLIYOR").length,
    tamamlandi: recentTransfers.filter((t) => normalizeStatus(t.status) === "TAMAMLANDI").length
  };

  // Tablo Filtreleme
  const filteredTransfers = recentTransfers.filter((tx) => {
    const normStatus = normalizeStatus(tx.status);
    const matchesStatus = statusFilter === "ALL" || normStatus === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tx.transfer_code?.toLowerCase().includes(q) ||
      tx.from_branch_name?.toLowerCase().includes(q) ||
      tx.to_branch_name?.toLowerCase().includes(q) ||
      tx.picker_name?.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  // Pop-up Açma ve Veriyi Sunucudan Çekme
  const handleOpenDetail = async (tx: TransferData) => {
    setSelectedSummary(tx);
    setIsModalOpen(true);
    setModalLoading(true);
    setActiveTab("ITEMS");
    setTransferDetail(null);

    const res = await getTransferDetailsServer(tx.id);
    if (res.success && res.data) {
      setTransferDetail(res.data as TransferFullDetail);
    }
    setModalLoading(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSummary(null);
    setTransferDetail(null);
  };

  // 1. ANA TRANSFER LİSTESİNİ EXCEL (CSV) OLARAK İNDİRME
  const handleExportTransferListExcel = () => {
    if (filteredTransfers.length === 0) return;

    const headers = [
      "Transfer Kodu",
      "Kaynak Şube",
      "Hedef Şube",
      "Toplayan Personel",
      "Durum",
      "Oluşturulma Tarihi"
    ];

    const rows = filteredTransfers.map((tx) => [
      tx.transfer_code || "-",
      tx.from_branch_name || "-",
      tx.to_branch_name || "-",
      tx.picker_name || "-",
      getStatusText(tx.status),
      tx.created_at ? new Date(tx.created_at).toLocaleString("tr-TR") : "-"
    ]);

    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
        )
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `LogiStock_Transfer_Listesi_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. SEÇİLİ TRANSFERİN DETAYLI ÜRÜN VE PERSONEL LİSTESİNİ EXCEL OLARAK İNDİRME (ID'SİZ)
  const handleExportDetailItemsExcel = () => {
    if (!transferDetail) return;

    const metaRows = [
      ["TRANSFER DETAY RAPORU", transferDetail.transfer_code],
      ["Rota", `${transferDetail.from_branch} -> ${transferDetail.to_branch}`],
      ["Durum", getStatusText(transferDetail.status)],
      ["1. Oluşturan", transferDetail.actors.creator.name],
      [
        "2. Depoda Toplayan",
        transferDetail.actors.picker.isAssigned
          ? transferDetail.actors.picker.name
          : "Henüz Atanmadı"
      ],
      [
        "3. Teslim Sayımını Tamamlayan",
        transferDetail.actors.completer.isCompleted
          ? transferDetail.actors.completer.name
          : "-"
      ],
      []
    ];

    const itemHeaders = [
      "Barkod",
      "SKU",
      "Ürün Adı",
      "Kategori",
      "Tür",
      "Talep Edilen Adet",
      "Onaylanan Adet",
      "Sevk Edilen Adet",
      "Sayılan (Teslim) Adet",
      "Fark"
    ];

    const itemRows = transferDetail.items.map((item) => [
      item.barcode,
      item.sku,
      item.name,
      item.category,
      item.is_consumable ? "SARF MALZEME" : "TİCARİ ÜRÜN",
      item.requested_qty,
      item.approved_qty,
      item.sent_qty,
      item.received_qty,
      transferDetail.actors.completer.isCompleted
        ? item.received_qty - item.sent_qty
        : "-"
    ]);

    const csvContent =
      "\uFEFF" +
      [...metaRows, itemHeaders, ...itemRows]
        .map((row) =>
          row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")
        )
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Transfer_${transferDetail.transfer_code}_Urun_Detaylari.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Pop-up İçi Toplam Hesaplamaları
  const itemTotals = transferDetail?.items.reduce(
    (acc, item) => {
      acc.requested += item.requested_qty;
      acc.approved += item.approved_qty;
      acc.sent += item.sent_qty;
      acc.received += item.received_qty;
      if (
        transferDetail.actors.completer.isCompleted &&
        item.sent_qty !== item.received_qty
      ) {
        acc.discrepancies += 1;
      }
      return acc;
    },
    { requested: 0, approved: 0, sent: 0, received: 0, discrepancies: 0 }
  ) || { requested: 0, approved: 0, sent: 0, received: 0, discrepancies: 0 };

  return (
    <>
      <div className="lg:col-span-8 bg-white border border-slate-300 shadow-sm rounded-md flex flex-col w-full h-[600px] overflow-hidden">
        {/* 1. Header, Arama Çubuğu ve Liste Excel Butonu */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border-b-2 border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-md border border-slate-300 shadow-sm">
              <Package className="w-5 h-5 text-[#dc3545]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  Transfer & Toplama Merkezi
                </h3>
                <span className="bg-slate-200 text-slate-700 text-[10px] font-mono font-black px-2 py-0.5 rounded-sm">
                  {filteredTransfers.length} KAYIT
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">
                Detayları ve ürün içeriklerini görmek için satıra tıklayın
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Hızlı Arama Inputu */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="LS Kodu, Şube, Personel..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-sm text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#dc3545] transition-colors font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Ana Liste Excel İndirme Butonu */}
            <button
              type="button"
              onClick={handleExportTransferListExcel}
              disabled={filteredTransfers.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer"
              title="Filtrelenmiş Transfer Listesini Excel (CSV) Olarak İndir"
            >
              <Download size={13} />
              <span className="hidden md:inline">EXCEL İNDİR</span>
            </button>
          </div>
        </div>

        {/* 2. İnteraktif İstatistik ve Filtre Butonları */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-200 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "YOLDA" ? "ALL" : "YOLDA")}
            className={`flex flex-col items-center p-3.5 border-r border-slate-200 transition-all cursor-pointer ${
              statusFilter === "YOLDA"
                ? "bg-blue-50/80 border-b-2 border-b-blue-600"
                : "hover:bg-slate-50"
            }`}
          >
            <span className="text-2xl font-black text-slate-800 font-mono">{tStats.yolda}</span>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1 flex items-center gap-1">
              <Truck size={12} /> GÖNDERİLDİ
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "TOPLANIYOR" ? "ALL" : "TOPLANIYOR")
            }
            className={`flex flex-col items-center p-3.5 border-r border-slate-200 transition-all cursor-pointer ${
              statusFilter === "TOPLANIYOR"
                ? "bg-purple-50/80 border-b-2 border-b-purple-600"
                : "hover:bg-slate-50"
            }`}
          >
            <span className="text-2xl font-black text-slate-800 font-mono">
              {tStats.toplaniyor}
            </span>
            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-1 flex items-center gap-1">
              <Package size={12} /> SAYIMDA
              {tStats.toplaniyor > 0 && (
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-sm animate-pulse"></span>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "BEKLIYOR" ? "ALL" : "BEKLIYOR")}
            className={`flex flex-col items-center p-3.5 border-r border-slate-200 transition-all cursor-pointer ${
              statusFilter === "BEKLIYOR"
                ? "bg-orange-50/80 border-b-2 border-b-orange-500"
                : "hover:bg-slate-50"
            }`}
          >
            <span className="text-2xl font-black text-slate-800 font-mono">{tStats.bekliyor}</span>
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest mt-1 flex items-center gap-1">
              <Timer size={12} /> BEKLİYOR
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "TAMAMLANDI" ? "ALL" : "TAMAMLANDI")
            }
            className={`flex flex-col items-center p-3.5 transition-all cursor-pointer ${
              statusFilter === "TAMAMLANDI"
                ? "bg-emerald-50/80 border-b-2 border-b-emerald-600"
                : "hover:bg-slate-50"
            }`}
          >
            <span className="text-2xl font-black text-slate-800 font-mono">
              {tStats.tamamlandi}
            </span>
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> TAMAMLANDI
            </span>
          </button>
        </div>

        {/* 3. Tıklanabilir Sparkline Grafiği */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex flex-col gap-1.5 relative">
          <div className="flex items-center justify-between relative z-10">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
              <BarChart2 size={13} className="text-slate-500" /> Son 30 Transfer Yoğunluğu (Tıkla & İncele)
            </h4>
            {statusFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest hover:underline font-mono"
              >
                Filtreyi Temizle ({statusFilter})
              </button>
            )}
          </div>
          <div className="flex items-end gap-[3px] h-9 w-full relative z-10 border-b-2 border-slate-300 pb-1 px-1">
            {recentTransfers.slice(0, 30).map((tx, idx) => {
              let barColor = "bg-slate-300";
              let h = "h-3";
              const s = normalizeStatus(tx.status);
              if (s === "TAMAMLANDI") {
                barColor = "bg-emerald-500";
                h = "h-full";
              } else if (s === "YOLDA") {
                barColor = "bg-blue-500";
                h = "h-7";
              } else if (s === "TOPLANIYOR") {
                barColor = "bg-purple-500";
                h = "h-5";
              } else if (s === "BEKLIYOR") {
                barColor = "bg-orange-500";
                h = "h-4";
              } else if (s === "REJECTED" || s === "IPTAL") {
                barColor = "bg-[#dc3545]";
                h = "h-2";
              }
              return (
                <div
                  key={tx.id || idx}
                  onClick={() => handleOpenDetail(tx)}
                  title={`${tx.transfer_code} (${tx.from_branch_name} -> ${tx.to_branch_name}) - Detay için tıkla`}
                  className={`flex-1 ${barColor} ${h} hover:opacity-75 hover:scale-y-105 rounded-t-sm transition-all duration-150 cursor-pointer`}
                ></div>
              );
            })}
            {recentTransfers.length === 0 && (
              <div className="w-full text-center text-slate-500 text-xs font-bold uppercase mt-2">
                Veri Yok
              </div>
            )}
          </div>
        </div>

        {/* 4. Detaylı Transfer Tablosu */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto w-full bg-white">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-10">
              <tr className="text-[11px] uppercase tracking-widest text-slate-600 font-black">
                <th className="py-3 px-4 w-32 border-r border-slate-200">TR Kodu</th>
                <th className="py-3 px-4 border-r border-slate-200">Rota (Kaynak → Hedef)</th>
                <th className="py-3 px-4 border-r border-slate-200">Toplayan Personel</th>
                <th className="py-3 px-4 text-right border-r border-slate-200">Durum & Tarih</th>
                <th className="py-3 px-4 text-center w-24">İncele</th>
              </tr>
            </thead>
            <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-100">
              {filteredTransfers.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => handleOpenDetail(tx)}
                  className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 font-black text-slate-900 border-r border-slate-100">
                    <span className="bg-white group-hover:border-[#dc3545] group-hover:text-[#dc3545] transition-colors text-slate-800 px-2.5 py-1 rounded-sm font-mono text-[11px] border border-slate-300 shadow-sm inline-flex items-center gap-1">
                      <Hash size={11} className="text-slate-400 group-hover:text-[#dc3545]" />
                      {tx.transfer_code}
                    </span>
                  </td>

                  <td className="py-3 px-4 border-r border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-slate-600 font-bold truncate max-w-[130px]"
                        title={tx.from_branch_name}
                      >
                        {tx.from_branch_name}
                      </span>
                      <ArrowRight size={14} className="text-[#dc3545] shrink-0" />
                      <span
                        className="text-slate-900 font-black truncate max-w-[130px]"
                        title={tx.to_branch_name}
                      >
                        {tx.to_branch_name}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-700 uppercase text-[11px] font-bold border-r border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate max-w-[140px]">{tx.picker_name}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right border-r border-slate-100">
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 border rounded-sm text-[9px] font-black uppercase tracking-widest whitespace-nowrap inline-flex items-center gap-1.5 ${getStatusStyle(
                          tx.status
                        )}`}
                      >
                        {["YOLDA", "TOPLANIYOR"].includes(normalizeStatus(tx.status)) && (
                          <span className="w-1.5 h-1.5 rounded-sm bg-current animate-pulse"></span>
                        )}
                        {getStatusText(tx.status)}
                      </span>
                      {tx.created_at && (
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {new Date(tx.created_at).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(tx);
                      }}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 group-hover:bg-[#dc3545] text-slate-700 group-hover:text-white border border-slate-300 group-hover:border-[#dc3545] rounded-sm text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Eye size={12} /> DETAY
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTransfers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-widest"
                  >
                    Kritere uygun transfer kaydı bulunamadı
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          AÇILIR TRANSFER DETAY POP-UP (ID GİZLİLİĞİ + GERÇEK STATÜ KUTULARI)
          ===================================================================== */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200 overflow-hidden"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white border-2 border-slate-800 rounded-md shadow-2xl w-full max-w-5xl h-[88vh] max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL DARK INDUSTRIAL HEADER */}
            <div className="bg-[#0F172B] border-b-2 border-slate-800 border-l-[6px] border-l-[#dc3545] px-5 py-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-sm flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-[#dc3545]" />
                  <span className="font-mono text-base font-black text-white tracking-wider">
                    {selectedSummary?.transfer_code}
                  </span>
                </div>

                {selectedSummary && (
                  <span
                    className={`px-2.5 py-1 border rounded-sm text-[10px] font-black uppercase tracking-widest ${getStatusStyle(
                      selectedSummary.status
                    )}`}
                  >
                    {getStatusText(selectedSummary.status)}
                  </span>
                )}

                <div className="hidden sm:flex items-center gap-2 text-xs font-black text-slate-300 uppercase bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-sm">
                  <span>{selectedSummary?.from_branch_name}</span>
                  <ArrowRight size={14} className="text-[#dc3545]" />
                  <span className="text-white">{selectedSummary?.to_branch_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {transferDetail && (
                  <button
                    type="button"
                    onClick={handleExportDetailItemsExcel}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors border border-emerald-500 cursor-pointer"
                    title="Bu Transferin Ürün Listesini Excel Olarak İndir"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">LİSTEYİ EXCEL İNDİR</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-9 h-9 rounded-sm bg-slate-800 hover:bg-[#dc3545] text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-slate-700 cursor-pointer"
                  title="Kapat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* MODAL SCROLLABLE BODY */}
            {modalLoading ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2.5 h-2.5 bg-[#dc3545] rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest font-mono">
                  Transfer Kalemleri ve Operasyon Kayıtları Çözümleniyor...
                </p>
              </div>
            ) : transferDetail ? (
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 p-4 sm:p-6 bg-slate-50">
                {/* 1. OPERASYONEL SORUMLULUK ZİNCİRİ (ID'SİZ & GERÇEK DURUM DUYARLI) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                  {/* KUTU 1: OLUŞTURAN */}
                  <div className="bg-white border border-slate-300 border-l-4 border-l-blue-600 rounded-sm p-3.5 shadow-xs flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest font-mono">
                        1. TRANSFERİ OLUŞTURAN
                      </span>
                      <FileText size={15} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase truncate">
                        {transferDetail.actors.creator.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                        {transferDetail.actors.creator.title}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Oluşturma:</span>
                      <span className="font-bold text-slate-700">
                        {transferDetail.actors.creator.time
                          ? new Date(transferDetail.actors.creator.time).toLocaleString("tr-TR")
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* KUTU 2: TOPLAYAN (PICKER) - Atanmadıysa soluk/boş görünür */}
                  <div
                    className={`rounded-sm p-3.5 flex flex-col justify-between gap-2 transition-all ${
                      transferDetail.actors.picker.isAssigned
                        ? "bg-white border border-slate-300 border-l-4 border-l-purple-600 shadow-xs"
                        : "bg-slate-100/70 border border-dashed border-slate-300 border-l-4 border-l-slate-400 opacity-80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest font-mono ${
                          transferDetail.actors.picker.isAssigned
                            ? "text-purple-600"
                            : "text-slate-500"
                        }`}
                      >
                        2. DEPO TOPLAMA / HAZIRLAYAN
                      </span>
                      <Package
                        size={15}
                        className={
                          transferDetail.actors.picker.isAssigned
                            ? "text-purple-600"
                            : "text-slate-400"
                        }
                      />
                    </div>
                    <div>
                      {transferDetail.actors.picker.isAssigned ? (
                        <>
                          <p className="text-sm font-black text-slate-900 uppercase truncate">
                            {transferDetail.actors.picker.name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                            {transferDetail.actors.picker.title}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-black text-slate-400 uppercase italic">
                            — Henüz Atanmadı —
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                            Toplama işlemi bekleniyor
                          </p>
                        </>
                      )}
                    </div>
                    <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Lojistik / Araç:</span>
                      <span className="font-bold text-slate-700 truncate max-w-[150px]">
                        {transferDetail.carrier_name}
                      </span>
                    </div>
                  </div>

                  {/* KUTU 3: SAYIMI & TESLİMATI TAMAMLAYAN - Sadece TAMAMLANDI ise dolu görünür, değilse boş kalır */}
                  <div
                    className={`rounded-sm p-3.5 flex flex-col justify-between gap-2 transition-all ${
                      transferDetail.actors.completer.isCompleted
                        ? "bg-white border border-slate-300 border-l-4 border-l-emerald-600 shadow-xs"
                        : "bg-slate-100/70 border border-dashed border-slate-300 border-l-4 border-l-slate-300 opacity-75"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest font-mono ${
                          transferDetail.actors.completer.isCompleted
                            ? "text-emerald-600"
                            : "text-slate-400"
                        }`}
                      >
                        3. TESLİM SAYIMINI TAMAMLAYAN
                      </span>
                      {transferDetail.actors.completer.isCompleted ? (
                        <UserCheck size={15} className="text-emerald-600" />
                      ) : (
                        <Clock size={15} className="text-slate-400" />
                      )}
                    </div>

                    {transferDetail.actors.completer.isCompleted ? (
                      <>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase truncate">
                            {transferDetail.actors.completer.name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                            {transferDetail.actors.completer.title}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>Tamamlanma:</span>
                          <span className="font-bold text-emerald-700">
                            {transferDetail.actors.completer.time
                              ? new Date(transferDetail.actors.completer.time).toLocaleString(
                                  "tr-TR"
                                )
                              : "Tamamlandı"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="py-1">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-wider italic">
                            — Henüz Teslim Sayımı Yapılmadı —
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                            Varış şubesinde barkod okutulması bekleniyor
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>Tamamlanma:</span>
                          <span>-</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 2. MİKTAR VE SEKME ÖZET BARI */}
                <div className="bg-white border border-slate-300 rounded-sm p-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-slate-500" />
                      <div>
                        <span className="block text-[9px] font-black text-slate-400 uppercase">
                          Kalem Çeşidi
                        </span>
                        <span className="text-sm font-black font-mono text-slate-800">
                          {transferDetail.items.length} SKU
                        </span>
                      </div>
                    </div>

                    <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>

                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase">
                        Talep Edilen
                      </span>
                      <span className="text-sm font-black font-mono text-slate-700">
                        {itemTotals.requested} Adet
                      </span>
                    </div>

                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase">
                        Onaylanan
                      </span>
                      <span className="text-sm font-black font-mono text-blue-600">
                        {itemTotals.approved} Adet
                      </span>
                    </div>

                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase">
                        Sevk Edilen
                      </span>
                      <span className="text-sm font-black font-mono text-purple-600">
                        {itemTotals.sent} Adet
                      </span>
                    </div>

                    <div>
                      <span className="block text-[9px] font-black text-slate-400 uppercase">
                        Sayılan (Teslim)
                      </span>
                      <span className="text-sm font-black font-mono text-emerald-600">
                        {transferDetail.actors.completer.isCompleted
                          ? `${itemTotals.received} Adet`
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* SEKME GEÇİŞİ */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-sm border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveTab("ITEMS")}
                      className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer ${
                        activeTab === "ITEMS"
                          ? "bg-[#0F172B] text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Ürün Listesi ({transferDetail.items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("TIMELINE")}
                      className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer ${
                        activeTab === "TIMELINE"
                          ? "bg-[#0F172B] text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Terminal Logları ({transferDetail.timeline.length})
                    </button>
                  </div>
                </div>

                {/* SAYIM FARKI KRİTİK UYARISI */}
                {itemTotals.discrepancies > 0 && (
                  <div className="bg-red-50 border border-red-300 border-l-4 border-l-[#dc3545] p-3 rounded-sm flex items-center gap-3 shrink-0">
                    <AlertTriangle className="w-5 h-5 text-[#dc3545] shrink-0" />
                    <p className="text-xs font-bold text-[#dc3545] uppercase tracking-wider">
                      DİKKAT: Bu transferde gönderilen (sent_qty) ile mağazada teslim alınan
                      (received_qty) arasında{" "}
                      <span className="underline font-black">
                        {itemTotals.discrepancies} kalemde sayım farkı
                      </span>{" "}
                      tespit edilmiştir!
                    </p>
                  </div>
                )}

                {/* 3. SEKME İÇERİĞİ: ÜRÜN MATRİSİ VEYA LOGLAR */}
                {activeTab === "ITEMS" ? (
                  <div className="bg-white border border-slate-300 rounded-sm overflow-hidden shadow-xs shrink-0">
                    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left border-collapse min-w-[640px]">
                        <thead className="bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-10">
                          <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                            <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center">
                              #
                            </th>
                            <th className="py-2.5 px-3 border-r border-slate-200">
                              Ürün & Barkod / SKU
                            </th>
                            <th className="py-2.5 px-3 text-center border-r border-slate-200 w-24">
                              Talep
                            </th>
                            <th className="py-2.5 px-3 text-center border-r border-slate-200 w-24">
                              Onay
                            </th>
                            <th className="py-2.5 px-3 text-center border-r border-slate-200 w-24">
                              Sevk
                            </th>
                            <th className="py-2.5 px-3 text-center border-r border-slate-200 w-24">
                              Sayılan
                            </th>
                            <th className="py-2.5 px-3 text-right w-32">Sayım Durumu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                          {transferDetail.items.map((item, index) => {
                            const isCompleted = transferDetail.actors.completer.isCompleted;
                            const hasDiff =
                              isCompleted && item.sent_qty !== item.received_qty;

                            return (
                              <tr
                                key={item.id}
                                className={
                                  hasDiff ? "bg-red-50/70 hover:bg-red-50" : "hover:bg-slate-50"
                                }
                              >
                                <td className="py-2.5 px-3 border-r border-slate-100 font-mono text-[11px] font-black text-slate-400 text-center">
                                  {index + 1}
                                </td>

                                <td className="py-2.5 px-3 border-r border-slate-100">
                                  <div className="flex items-center gap-2.5">
                                    {item.image_url ? (
                                      <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0 bg-white"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                        <Box size={15} className="text-slate-400" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-900 truncate max-w-[320px]">
                                        {item.name}
                                      </p>
                                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-0.5">
                                        <span>BARKOD: {item.barcode}</span>
                                        <span>•</span>
                                        <span>SKU: {item.sku}</span>
                                        {item.is_consumable && (
                                          <span className="bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0 rounded-sm text-[9px] font-black">
                                            SARF
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-center border-r border-slate-100 font-mono text-slate-600">
                                  {item.requested_qty}
                                </td>
                                <td className="py-2.5 px-3 text-center border-r border-slate-100 font-mono text-blue-700 font-black">
                                  {item.approved_qty}
                                </td>
                                <td className="py-2.5 px-3 text-center border-r border-slate-100 font-mono text-purple-700 font-black">
                                  {item.sent_qty}
                                </td>
                                <td className="py-2.5 px-3 text-center border-r border-slate-100 font-mono text-emerald-700 font-black">
                                  {isCompleted ? item.received_qty : "-"}
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  {hasDiff ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-[#dc3545] border border-red-300 rounded-sm text-[9px] font-black uppercase">
                                      FARK: {item.received_qty - item.sent_qty}
                                    </span>
                                  ) : isCompleted ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-sm text-[9px] font-black uppercase">
                                      TAM EŞLEŞTİ
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-300 rounded-sm text-[9px] font-black uppercase">
                                      BEKLENİYOR
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {transferDetail.items.length === 0 && (
                            <tr>
                              <td
                                colSpan={7}
                                className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest"
                              >
                                Bu transfere ait ürün kalemi bulunamadı
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-300 rounded-sm p-4 flex flex-col gap-2.5 max-h-[380px] overflow-y-auto shrink-0">
                    {transferDetail.timeline.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-sm"
                      >
                        <div className="flex items-start gap-2.5">
                          <Activity size={15} className="text-[#dc3545] mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-black text-slate-900 uppercase">
                                {log.employee_name}
                              </span>
                              <span className="text-[9px] font-black uppercase bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-sm">
                                {log.action_type}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 mt-1">{log.description}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
                          {new Date(log.created_at).toLocaleString("tr-TR")}
                        </span>
                      </div>
                    ))}
                    {transferDetail.timeline.length === 0 && (
                      <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Bu transfer kodu için kayıtlı terminal logu bulunamadı
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs font-bold uppercase text-[#dc3545]">
                Transfer detayı yüklenemedi.
              </div>
            )}

            {/* MODAL FOOTER */}
            <div className="bg-slate-100 border-t border-slate-300 px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                <Calendar size={13} />
                <span>
                  Kayıt Tarihi:{" "}
                  {selectedSummary?.created_at
                    ? new Date(selectedSummary.created_at).toLocaleString("tr-TR")
                    : "-"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {transferDetail && (
                  <button
                    type="button"
                    onClick={handleExportDetailItemsExcel}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} /> EXCEL İNDİR
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-sm transition-colors cursor-pointer"
                >
                  KAPAT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}