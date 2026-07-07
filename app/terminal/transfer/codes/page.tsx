"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ChevronLeft, TerminalSquare, UserCircle, MapPin, 
  ArrowRight, Layers, Clock, ChevronDown, ChevronUp,
  Info, CalendarDays, BarChart3, AlertCircle, CheckCircle2, ChevronRight, Eye
} from "lucide-react";
import TransferDetailModal from "./_components/TransferDetailModal"; // Modal bileşenimizi çağırıyoruz

export type Transfer = {
  id: string;
  transfer_code: string;
  status: string;
  from_branch_id: string;
  to_branch_id: string;
  created_at: string;
  creator: { full_name: string } | null;
  items: { requested_qty: number }[];
};

export default function TransferCodesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const branchName = searchParams.get("branch") || "Şube Terminali";

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branchMap, setBranchMap] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Detay Modal State'leri
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Veri Çekme Fonksiyonu
  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    
    const { data: branchesData } = await supabase.from("branches").select("id, name");
    const bMap: Record<string, string> = {};
    let currentBranchId = null;

    if (branchesData) {
      branchesData.forEach((b) => {
        bMap[b.id] = b.name;
        if (b.name === branchName.trim()) {
          currentBranchId = b.id;
        }
      });
      setBranchMap(bMap);
    }

    let query = supabase
      .from("transfers")
      .select(`
        id, transfer_code, status, created_at, from_branch_id, to_branch_id,
        items:transfer_items(requested_qty),
        creator:employees!picker_employee_id(full_name)
      `, { count: 'exact' });

    if (currentBranchId) {
      query = query.or(`from_branch_id.eq.${currentBranchId},to_branch_id.eq.${currentBranchId}`);
    } else {
      query = query.or(`from_branch_id.eq.${branchName},to_branch_id.eq.${branchName}`);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(page * 10, (page + 1) * 10 - 1);

    if (error) console.error("Sorgu Hatası:", error);
    if (data) {
      setTransfers(data as unknown as Transfer[]);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [branchName, page]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const stats = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let totalItemsVolume = 0;

    transfers.forEach(t => {
      if (t.status === "Bekliyor" || t.status === "Toplaniyor") pending++;
      if (t.status === "Tamamlandi") completed++;
      totalItemsVolume += t.items.reduce((sum, i) => sum + i.requested_qty, 0);
    });

    return { pending, completed, totalItemsVolume };
  }, [transfers]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getBranchName = (idOrName: string) => {
    return branchMap[idOrName] || idOrName;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Bekliyor': return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'Toplaniyor': return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'Hazir': return 'bg-orange-50 text-orange-800 border-orange-300';
      case 'Yolda': return 'bg-indigo-50 text-indigo-800 border-indigo-300';
      case 'Tamamlandi': return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'Iptal': return 'bg-red-50 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const handleOpenDetails = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] flex flex-col antialiased selection:bg-[#dc3545] selection:text-white pb-10">
      
      {/* BAŞLIK (Dark Heading) */}
      <div className="bg-[#0f172b] shadow-md shrink-0 border-b-4 border-[#dc3545]">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60 max-w-7xl mx-auto w-full">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white p-2 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 rounded-none transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <TerminalSquare size={18} className="text-[#dc3545]" />
            <span className="text-white text-[14px] sm:text-[15px] font-black uppercase tracking-widest">
              WMS / Transfer Yönetimi
            </span>
          </div>
          <div className="w-10" />
        </div>
        <div className="bg-slate-950 py-2.5 px-4">
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
            <span className="text-slate-400 flex items-center gap-1.5 truncate max-w-[180px] sm:max-w-none"><UserCircle size={14} className="text-slate-600 shrink-0"/> {empName} ({empId})</span>
            <span className="text-[#dc3545] flex items-center gap-1.5 truncate max-w-[180px] sm:max-w-none"><MapPin size={14} className="shrink-0"/> {branchName}</span>
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* EN ÜST BİLGİ KARTLARI (KPI PANEL) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border-l-4 border-slate-800 p-4 shadow-sm flex flex-col justify-between rounded-none min-w-0">
            <div className="flex justify-between items-start text-slate-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider block truncate">Sistem Toplamı</span>
              <BarChart3 size={16} className="shrink-0 ml-1" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{totalCount} <span className="text-xs font-bold text-slate-400 uppercase">Evrak</span></div>
          </div>

          <div className="bg-white border-l-4 border-amber-500 p-4 shadow-sm flex flex-col justify-between rounded-none min-w-0">
            <div className="flex justify-between items-start text-slate-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider block truncate">İşlemde / Bekleyen</span>
              <AlertCircle size={16} className="text-amber-500 shrink-0 ml-1" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">{stats.pending} <span className="text-xs font-bold text-slate-400 uppercase">Açık</span></div>
          </div>

          <div className="bg-white border-l-4 border-emerald-500 p-4 shadow-sm flex flex-col justify-between rounded-none min-w-0">
            <div className="flex justify-between items-start text-slate-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider block truncate">Sayfa Başarı Oranı</span>
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 ml-1" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">{stats.completed} <span className="text-xs font-bold text-slate-400 uppercase">Kapatılan</span></div>
          </div>

          <div className="bg-white border-l-4 border-[#dc3545] p-4 shadow-sm flex flex-col justify-between rounded-none min-w-0">
            <div className="flex justify-between items-start text-slate-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider block truncate">Sayfa Ürün Hacmi</span>
              <Layers size={16} className="text-[#dc3545] shrink-0 ml-1" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{stats.totalItemsVolume} <span className="text-xs font-bold text-slate-400 uppercase">Adet</span></div>
          </div>
        </div>

        {/* TRANSFER TABLOSU CONTAINER */}
        {loading ? (
          <div className="text-center py-20 bg-white border border-slate-200 text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">Depo Verileri Okunuyor...</div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-none shadow-sm">
            <Info size={36} className="mx-auto text-slate-300 mb-3"/>
            <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Aktif veya geçmiş transfer kaydı bulunamadı.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 shadow-sm rounded-none flex flex-col overflow-hidden">
            
            {/* Masaüstü Tablo Başlıkları */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800 text-[11px] font-black uppercase text-slate-200 tracking-widest border-b border-slate-950">
              <div className="col-span-3 min-w-0">Transfer Kodu</div>
              <div className="col-span-4 min-w-0">Transfer Rotası (Kaynak &gt; Hedef)</div>
              <div className="col-span-2 min-w-0">İşlem Durumu</div>
              <div className="col-span-2 min-w-0">Oluşturma Tarihi</div>
              <div className="col-span-1 min-w-0 text-center">Genişlet</div>
            </div>

            {/* Tablo Satırları */}
            {transfers.map((tx) => {
              const totalQty = tx.items.reduce((acc, i) => acc + i.requested_qty, 0);
              const isExpanded = expandedId === tx.id;
              const fromName = getBranchName(tx.from_branch_id);
              const toName = getBranchName(tx.to_branch_id);

              return (
                <div key={tx.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/80 transition-all">
                  
                  <div 
                    onClick={() => toggleExpand(tx.id)}
                    className={`cursor-pointer grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 items-center border-l-4 transition-all select-none ${isExpanded ? 'border-[#dc3545] bg-slate-50' : 'border-transparent hover:border-slate-300'}`}
                  >
                    {/* Transfer Kodu */}
                    <div className="col-span-1 md:col-span-3 flex items-center justify-between md:block min-w-0">
                      <span className="font-black text-[14px] sm:text-[15px] text-slate-900 tracking-widest block truncate">{tx.transfer_code}</span>
                      <span className="md:hidden text-slate-400 p-1 bg-white border border-slate-200 shadow-sm">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </div>

                    {/* Rota Kolonu */}
                    <div className="col-span-1 md:col-span-4 flex items-center gap-2 text-[12px] font-bold text-slate-600 min-w-0">
                      <span className="md:hidden text-slate-400 text-[10px] font-black uppercase tracking-wider shrink-0 w-12">Rota:</span>
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span className="truncate bg-white border border-slate-200 px-2 py-0.5 text-slate-800 md:border-none md:bg-transparent md:p-0">{fromName}</span>
                        <ArrowRight size={13} className="text-[#dc3545] shrink-0" />
                        <span className="truncate bg-white border border-slate-200 px-2 py-0.5 text-slate-800 md:border-none md:bg-transparent md:p-0">{toName}</span>
                      </div>
                    </div>

                    {/* Durum Kolonu */}
                    <div className="col-span-1 md:col-span-2 flex items-center gap-2 md:block min-w-0">
                      <span className="md:hidden text-slate-400 text-[10px] font-black uppercase tracking-wider shrink-0 w-12">Durum:</span>
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase border tracking-wider shrink-0 ${getStatusStyle(tx.status)}`}>
                        {tx.status}
                      </span>
                    </div>

                    {/* Zaman Kolonu */}
                    <div className="col-span-1 md:col-span-2 flex items-center gap-2 md:flex md:items-center md:gap-1.5 text-[12px] font-bold text-slate-500 min-w-0">
                      <span className="md:hidden text-slate-400 text-[10px] font-black uppercase tracking-wider shrink-0 w-12">Zaman:</span>
                      <Clock size={13} className="hidden md:inline shrink-0" />
                      <span className="truncate">{new Date(tx.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>

                    {/* Sağ Açılır Ok İkon Kutusu */}
                    <div className="hidden md:flex col-span-1 justify-center min-w-0">
                      <div className={`p-1.5 border transition-all ${isExpanded ? 'bg-[#dc3545] border-[#dc3545] text-white shadow-md' : 'bg-white border-slate-300 text-slate-500 shadow-sm'}`}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Alt Açılır Bilgi Kartları ve Detay Butonu */}
                  {isExpanded && (
                    <div className="bg-slate-100/50 p-4 border-t border-b border-slate-200/60 shadow-inner flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Sol Kart: Güzergah */}
                        <div className="bg-white p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1 mb-2 block">Detaylı Güzergah</span>
                          <div className="space-y-1.5 text-[12px] font-bold">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-slate-400 shrink-0">Çıkış Noktası:</span>
                              <span className="text-slate-900 truncate text-right">{fromName}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-slate-400 shrink-0">Teslim Noktası:</span>
                              <span className="text-slate-900 truncate text-right">{toName}</span>
                            </div>
                          </div>
                        </div>

                        {/* Orta Kart: Hacim ve Sorumlu */}
                        <div className="bg-white p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1 mb-2 block">Operasyon Verisi</span>
                          <div className="space-y-1.5 text-[12px] font-bold">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 flex items-center gap-1"><Layers size={12}/> Toplam Adet:</span>
                              <span className="bg-slate-900 text-white font-black px-1.5 py-0.5 text-[11px]">{totalQty} Ürün</span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-slate-400 flex items-center gap-1"><UserCircle size={12}/> Oluşturan:</span>
                              <span className="text-slate-900 truncate text-right">{tx.creator?.full_name || "Otomatik Sistem"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Sağ Kart: Tarih / Saat Damgası */}
                        <div className="bg-white p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1 mb-2 block">Zaman Damgası</span>
                          <div className="flex items-center gap-2.5 text-[12px] font-bold text-slate-800">
                            <CalendarDays size={18} className="text-slate-400 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-slate-900 tracking-wider">
                                {new Date(tx.created_at).toLocaleDateString("tr-TR")}
                              </span>
                              <span className="text-slate-400 text-[10px] font-medium tracking-widest">
                                SAAT: {new Date(tx.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* DETAY GÖR BUTONU */}
                      <div className="flex justify-end mt-2">
                        <button 
                          onClick={() => handleOpenDetails(tx)}
                          className="bg-[#dc3545] hover:bg-red-700 text-white flex items-center gap-2 px-6 py-2.5 rounded-none font-black text-[11px] uppercase tracking-widest transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                          <Eye size={16} /> İçeriği ve Detayları Gör
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* SAYFALAMA */}
        <div className="flex justify-between items-center bg-white p-3 border border-slate-200 shadow-sm rounded-none">
          <button 
            disabled={page === 0} 
            onClick={() => setPage(p => p - 1)} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-900 text-slate-800 hover:text-white font-black text-[11px] uppercase tracking-wider border border-slate-300 rounded-none disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-800 transition-all select-none"
          >
            <ChevronLeft size={14}/> Geri
          </button>
          <div className="font-black text-[11px] uppercase tracking-widest text-slate-400">
            Sayfa <span className="text-slate-900 text-[13px] mx-0.5">{page + 1}</span>
          </div>
          <button 
            disabled={(page + 1) * 10 >= totalCount} 
            onClick={() => setPage(p => p + 1)} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-900 text-slate-800 hover:text-white font-black text-[11px] uppercase tracking-wider border border-slate-300 rounded-none disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-800 transition-all select-none"
          >
            İleri <ChevronRight size={14}/>
          </button>
        </div>
      </main>

      {/* DETAY MODALI COMPONENT ÇAĞIRIMI */}
      {isModalOpen && selectedTransfer && (
        <TransferDetailModal 
          transfer={selectedTransfer}
          branchMap={branchMap}
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
}