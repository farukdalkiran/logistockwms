"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ChevronLeft, TerminalSquare, UserCircle, MapPin, 
  ArrowRight, Layers, Clock, ChevronDown, ChevronUp,
  Info, CalendarDays, BarChart3, AlertCircle, CheckCircle2, ChevronRight, Eye, PackageOpen, Truck
} from "lucide-react";
import TransferDetailModal from "./_components/TransferDetailModal"; 

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

  // ÇÖZÜM 1: Durum bazlı animasyonlu statü (Radar Ping / Pulse / Solid)
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Yolda': 
        return (
          <div className="flex items-center gap-2 bg-orange-50 text-orange-800 border border-orange-300 px-2 py-0.5 rounded-none w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-600"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider">Yolda / Transferde</span>
          </div>
        );
      case 'Toplaniyor': 
        return (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-none w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider">Sayım / Toplama</span>
          </div>
        );
      case 'Tamamlandi': 
        return (
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-none w-fit shadow-sm">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider">Teslim / Tamamlandı</span>
          </div>
        );
      case 'Bekliyor': 
        return (
          <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-none w-fit">
            <Clock size={12} className="text-amber-600" />
            <span className="text-[10px] font-black uppercase tracking-wider">İşlem Bekliyor</span>
          </div>
        );
      case 'Iptal': 
        return (
          <div className="flex items-center gap-1.5 bg-red-50 text-red-800 border border-red-300 px-2 py-0.5 rounded-none w-fit">
            <AlertCircle size={12} className="text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-wider">İptal Edildi</span>
          </div>
        );
      default: 
        return (
          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded-none w-fit">
            <span className="text-[10px] font-black uppercase tracking-wider">{status}</span>
          </div>
        );
    }
  };

  const handleOpenDetails = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] flex flex-col antialiased selection:bg-[#dc3545] selection:text-white pb-10 relative">
      
      {/* ÇÖZÜM 3: DEPO GÖRSELLİ DİNAMİK HERO HEADER */}
      <div className="relative h-32 sm:h-40 shrink-0 border-b-4 border-[#dc3545] overflow-hidden group shadow-md">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: `url('https://img.magnific.com/free-vector/warehouse-interior-logistics-cargo-delivery_107791-1777.jpg?t=st=1783584649~exp=1783588249~hmac=e8964f146db5ae77a34bd16b1cf253f0d186adee6482861950eb6be361e6b722&w=1480')` }}
        />
        <div className="absolute inset-0 bg-slate-950/50 mix-blend-multiply z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172b] to-transparent z-10" />

        <div className="relative z-20 w-full h-full p-4 sm:p-6 flex flex-col justify-between max-w-7xl mx-auto">
          <div className="flex justify-between items-start">
            <button onClick={() => router.back()} className="text-slate-300 hover:text-white bg-slate-900/50 hover:bg-[#dc3545] p-2 border border-slate-700 hover:border-red-400 transition-all backdrop-blur-sm min-w-[40px] min-h-[40px] flex items-center justify-center rounded-sm shrink-0 shadow-sm">
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 backdrop-blur-sm px-3 py-1.5 shadow-sm rounded-sm">
              <UserCircle size={14} className="text-slate-400 shrink-0"/> 
              <span className="text-[10px] font-black uppercase text-slate-200 tracking-widest truncate max-w-[120px] sm:max-w-none">{empName}</span>
            </div>
          </div>
          
          <div className="flex items-end gap-3 sm:gap-4 drop-shadow-md">
            <div className="bg-[#dc3545] p-2.5 sm:p-3 shadow-lg border border-red-400/30 rounded-sm shrink-0">
              <TerminalSquare size={24} className="text-white sm:w-7 sm:h-7" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-white text-[16px] sm:text-[22px] font-black uppercase tracking-widest leading-none mb-1.5 truncate">
                Transfer Yönetimi
              </h1>
              <div className="text-slate-300 text-[10px] sm:text-[11px] font-bold tracking-widest flex items-center gap-1.5 truncate">
                <MapPin size={12} className="text-[#dc3545] shrink-0" />
                <span className="truncate">AKTİF ŞUBE: {branchName}</span>
              </div>
            </div>
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
              <div className="col-span-1 min-w-0 text-center">Detay</div>
            </div>

            {/* Tablo Satırları */}
            {transfers.map((tx) => {
              const totalQty = tx.items.reduce((acc, i) => acc + i.requested_qty, 0);
              const isExpanded = expandedId === tx.id;
              const fromName = getBranchName(tx.from_branch_id);
              const toName = getBranchName(tx.to_branch_id);

              return (
                <div key={tx.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/80 transition-all">
                  
                  {/* ÇÖZÜM 2: Kusursuz Mobil Hizalama (Truncate ve Min-W Zırhları) */}
                  <div 
                    onClick={() => toggleExpand(tx.id)}
                    className={`cursor-pointer grid grid-cols-1 md:grid-cols-12 gap-2.5 md:gap-4 p-4 items-center border-l-4 transition-all select-none ${isExpanded ? 'border-[#dc3545] bg-slate-50' : 'border-transparent hover:border-slate-300'}`}
                  >
                    {/* Transfer Kodu */}
                    <div className="col-span-1 md:col-span-3 flex items-center justify-between md:block min-w-0">
                      <span className="font-black text-[15px] sm:text-[16px] text-slate-900 tracking-widest block truncate">{tx.transfer_code}</span>
                      <span className="md:hidden text-slate-400 p-1.5 bg-white border border-slate-200 shadow-sm shrink-0">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </div>

                    {/* Rota Kolonu */}
                    <div className="col-span-1 md:col-span-4 flex items-center gap-2 text-[12px] font-bold text-slate-600 min-w-0">
                      <span className="md:hidden text-slate-400 text-[10px] font-black uppercase tracking-wider shrink-0 w-12">Rota:</span>
                      <div className="flex items-center gap-1.5 min-w-0 w-full">
                        <span className="truncate bg-white border border-slate-200 px-2 py-0.5 text-slate-800 md:border-none md:bg-transparent md:p-0 min-w-0" title={fromName}>{fromName}</span>
                        <ArrowRight size={13} className="text-[#dc3545] shrink-0" />
                        <span className="truncate bg-white border border-slate-200 px-2 py-0.5 text-slate-800 md:border-none md:bg-transparent md:p-0 min-w-0" title={toName}>{toName}</span>
                      </div>
                    </div>

                    {/* Durum Kolonu (Animasyonlu) */}
                    <div className="col-span-1 md:col-span-2 flex items-center gap-2 md:block min-w-0 pt-1 md:pt-0">
                      <span className="md:hidden text-slate-400 text-[10px] font-black uppercase tracking-wider shrink-0 w-12">Durum:</span>
                      {getStatusBadge(tx.status)}
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
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1 mb-2 block flex items-center gap-1.5"><Truck size={12}/> Detaylı Güzergah</span>
                          <div className="space-y-1.5 text-[12px] font-bold min-w-0">
                            <div className="flex justify-between items-center gap-2 min-w-0">
                              <span className="text-slate-400 shrink-0">Çıkış Noktası:</span>
                              <span className="text-slate-900 truncate text-right min-w-0" title={fromName}>{fromName}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2 min-w-0">
                              <span className="text-slate-400 shrink-0">Varış Noktası:</span>
                              <span className="text-slate-900 truncate text-right min-w-0" title={toName}>{toName}</span>
                            </div>
                          </div>
                        </div>

                        {/* Orta Kart: Hacim ve Sorumlu */}
                        <div className="bg-white p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1 mb-2 block flex items-center gap-1.5"><Info size={12}/> Operasyon Verisi</span>
                          <div className="space-y-1.5 text-[12px] font-bold min-w-0">
                            <div className="flex justify-between items-center min-w-0 gap-2">
                              <span className="text-slate-400 flex items-center gap-1 shrink-0"><Layers size={12}/> Toplam Adet:</span>
                              <span className="bg-slate-900 text-white font-black px-1.5 py-0.5 text-[11px] shrink-0">{totalQty} Ürün</span>
                            </div>
                            <div className="flex justify-between items-center gap-2 min-w-0">
                              <span className="text-slate-400 flex items-center gap-1 shrink-0"><UserCircle size={12}/> Oluşturan:</span>
                              <span className="text-slate-900 truncate text-right min-w-0" title={tx.creator?.full_name || "Sistem"}>{tx.creator?.full_name || "Sistem"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Sağ Kart: Tarih / Saat Damgası */}
                        <div className="bg-white p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1 mb-2 block flex items-center gap-1.5"><Clock size={12}/> Zaman Damgası</span>
                          <div className="flex items-center gap-2.5 text-[12px] font-bold text-slate-800 min-w-0 mt-1">
                            <CalendarDays size={18} className="text-slate-400 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-slate-900 tracking-wider truncate">
                                {new Date(tx.created_at).toLocaleDateString("tr-TR")}
                              </span>
                              <span className="text-slate-400 text-[10px] font-medium tracking-widest truncate">
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
                          <PackageOpen size={16} /> İçeriği ve Detayları Gör
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