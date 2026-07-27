'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Layers, MapPin, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import { getStockHistoryModalDataServer } from '@/app/actions/inventory';

// VERCEL TYPE ERROR ÇÖZÜMÜ: employees objesi yerine düz string kullanıyoruz
type LogItem = {
  id: string;
  created_at: string;
  action_type: string;
  description: string;
  new_value?: string; 
  employee_name: string; 
};

type ShelfItem = {
  shelf_location: string;
  quantity: number;
};

export default function StockHistoryModal({ 
  productId, 
  branchId, 
  isGlobal,
  productName, 
  onClose 
}: { 
  productId: string, 
  branchId: string | null, 
  isGlobal: boolean,
  productName: string | undefined | null, 
  onClose: () => void 
}) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ESC TUŞU İLE KAPATMA
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!productId) return; // ID yoksa boşuna arama yapma

    const fetchModalData = async () => {
      try {
        const safeProductName = productName || "";
        const searchKeyword = safeProductName.split(' ')[0] || "";

        const { shelves, logs } = await getStockHistoryModalDataServer(
          productId, 
          branchId, 
          isGlobal, 
          searchKeyword
        );

        // VERCEL HATASINI ÇÖZEN YER: Karmaşık veriyi düzleştiriyoruz (Flattening)
        const formattedLogs: LogItem[] = (logs || []).map((log: any) => {
          let empName = "SİSTEM (OTOMASYON)";
          if (log.employees) {
            if (Array.isArray(log.employees) && log.employees.length > 0) {
              empName = log.employees[0]?.full_name || empName;
            } else if (!Array.isArray(log.employees) && log.employees.full_name) {
              empName = log.employees.full_name;
            }
          }
          return {
            id: log.id,
            created_at: log.created_at,
            action_type: log.action_type,
            description: log.description,
            new_value: log.new_value,
            employee_name: empName,
          };
        });

        setShelves(shelves || []);
        setLogs(formattedLogs);
        
      } catch (err) {
        console.error("Modal Veri Çekme Hatası:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModalData();
  }, [productId, branchId, isGlobal, productName]);

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const extractShelfName = (desc: string) => {
    if (!desc) return "-";
    const match = desc.match(/RAF:\s*([A-Za-z0-9-]+)/);
    if (match && match[1]) return match[1];
    return "SİSTEM / TANIMSIZ";
  };

  const extractReason = (desc: string) => {
    if (!desc) return "-";
    if (desc.includes('| SEBEP:')) {
      return desc.split('| SEBEP:')[1].trim();
    }
    const cleanDesc = desc.replace(/\[.*?\]/, '').replace(/RAF:\s*[A-Za-z0-9-]+.*?$/, '').trim();
    return cleanDesc || "-";
  };

  const getShelfDamageStatus = (shelfName: string) => {
    const nameUpper = shelfName.toUpperCase();
    if (nameUpper.includes('-AZ-')) return { label: "AZ HASARLI RAF", color: "text-orange-800", bg: "bg-orange-200", border: "border-orange-400" };
    if (nameUpper.includes('-COK-')) return { label: "ÇOK HASARLI RAF", color: "text-white", bg: "bg-[#dc3545]", border: "border-red-600" };
    return null; 
  };

  // ARKA PLANA TIKLAYINCA KAPATMA
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div 
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-6xl bg-slate-100 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 border border-slate-700 rounded-sm overflow-hidden h-[95vh] lg:h-[85vh]">
        
        {/* HEADER */}
        <div className="bg-[#0f172b] p-4 flex items-center justify-between shrink-0 border-b-[4px] border-gradient-to-r from-purple-700 via-[#dc3545] to-[#0f172b]">
           <div className="flex items-center gap-3">
             <div className="bg-gradient-to-br from-purple-600 to-[#dc3545] p-2 rounded-sm shadow-[0_0_15px_rgba(107,33,168,0.4)]">
               <Activity size={20} className="text-white" />
             </div>
             <div className="flex flex-col">
               <h2 className="text-[14px] font-black text-white uppercase tracking-[0.15em] leading-none mb-0.5">STOK & RAF İZLEME EKRANI</h2>
               <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">{productName || 'Bilinmeyen Ürün'}</p>
             </div>
           </div>
           
           {/* ÇARPI İLE KAPATMA BUTONU */}
           <button onClick={onClose} className="text-slate-400 hover:text-white p-2 bg-slate-800 hover:bg-[#dc3545] rounded-sm transition-colors border border-slate-700 active:scale-90 flex items-center gap-1 group">
             <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block group-hover:text-white">Kapat</span>
             <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col p-4 sm:p-5 gap-5">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-purple-600">
               <Loader2 size={40} className="animate-spin" />
               <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Veri Arşivi Taranıyor...</span>
            </div>
          ) : (
            <>
              {/* 1. PANEL: RAF BİLGİSİ */}
              <div className="flex flex-col bg-white border border-slate-300 shadow-sm rounded-sm overflow-hidden shrink-0">
                <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex items-center gap-2">
                  <div className="p-1 bg-red-100 rounded-sm"><MapPin size={14} className="text-[#dc3545]" /></div>
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">AKTİF RAF DAĞILIMI</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#0f172b] text-slate-300 text-[9px] uppercase tracking-[0.15em]">
                      <tr>
                        <th className="px-3 py-2 w-12 text-center border-r border-slate-700"></th>
                        <th className="px-3 py-2 border-r border-slate-700">Raf Adı / Lokasyon</th>
                        <th className="px-3 py-2 border-r border-slate-700 text-center w-40">Hasar Statüsü</th>
                        <th className="px-3 py-2 text-center w-36 text-[#dc3545]">Mevcut Adet</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-bold text-slate-800 divide-y divide-slate-100">
                      {shelves.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
                            BU ÜRÜN ŞU ANDA HİÇBİR RAFTA BULUNMUYOR.
                          </td>
                        </tr>
                      ) : (
                        shelves.map((shelf, idx) => {
                          const damageInfo = getShelfDamageStatus(shelf.shelf_location);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 border-r border-slate-100 text-center">
                                <Layers size={14} className={damageInfo ? "text-[#dc3545]" : "text-emerald-600"} />
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100 font-mono text-[12px] text-[#0f172b] tracking-wider">
                                {shelf.shelf_location}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100 text-center">
                                {damageInfo ? (
                                   <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm ${damageInfo.bg} ${damageInfo.color} ${damageInfo.border} flex items-center justify-center gap-1 w-max mx-auto shadow-sm`}>
                                     <AlertTriangle size={10} /> {damageInfo.label}
                                   </span>
                                ) : (
                                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sağlam / Standart</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center bg-slate-50">
                                <span className={`text-[16px] font-black ${damageInfo ? 'text-[#dc3545]' : 'text-emerald-600'}`}>{shelf.quantity}</span>
                                <span className="text-[9px] text-slate-400 ml-1 uppercase tracking-widest">Adet</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. PANEL: LOG TABLOSU */}
              <div className="flex-1 flex flex-col bg-white border border-slate-300 shadow-sm rounded-sm overflow-hidden">
                <div className="bg-purple-50 p-2.5 border-b border-purple-200 flex items-center gap-2 shrink-0">
                  <div className="p-1 bg-purple-200 rounded-sm"><ShieldCheck size={14} className="text-purple-700" /></div>
                  <h3 className="text-[11px] font-black text-purple-900 uppercase tracking-[0.15em]">DETAYLI İŞLEM GEÇMİŞİ (HAREKET LOGU)</h3>
                </div>
                
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead className="bg-[#0f172b] text-slate-300 text-[9px] uppercase tracking-[0.15em] sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 border-r border-slate-700 w-32">Zaman</th>
                        <th className="px-3 py-2 border-r border-slate-700 w-36">Raf Bilgisi</th>
                        <th className="px-3 py-2 border-r border-slate-700 w-40">İşlem Türü</th>
                        <th className="px-3 py-2 border-r border-slate-700 text-center w-24 text-purple-400">Adet</th>
                        <th className="px-3 py-2 border-r border-slate-700 w-40">Operatör</th>
                        <th className="px-3 py-2">Detay / Sebep</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-bold text-slate-800 divide-y divide-slate-100">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
                            BU ÜRÜNE AİT HİÇBİR LOG KAYDI BULUNAMADI.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => {
                          const isAddition = log.action_type.includes('INBOUND') || log.action_type.includes('PUTAWAY') || log.new_value?.startsWith('+');
                          const isRemoval = log.action_type.includes('OUTBOUND') || log.action_type.includes('PICKING') || log.new_value?.startsWith('-');
                          
                          return (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 border-r border-slate-100 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                {formatDate(log.created_at)}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <div className="flex items-center gap-1">
                                  <MapPin size={12} className="text-slate-400 shrink-0" />
                                  <span className="text-[10px] font-black text-[#0f172b] uppercase tracking-widest truncate max-w-[120px]">
                                    {extractShelfName(log.description)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 uppercase tracking-widest border rounded-sm ${
                                  isAddition ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                  isRemoval ? 'bg-red-50 text-[#dc3545] border-red-200' : 
                                  'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                  {log.action_type.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100 text-center font-mono bg-slate-50/50">
                                {log.new_value ? (
                                  <span className={`text-[14px] font-black ${
                                    log.new_value.startsWith('+') ? 'text-emerald-600' : 
                                    log.new_value.startsWith('-') ? 'text-[#dc3545]' : 'text-slate-700'
                                  }`}>
                                    {log.new_value}
                                  </span>
                                ) : (
                                  <span className="text-[12px] text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <span className="text-[10px] font-black text-[#0f172b] uppercase tracking-wider truncate max-w-[140px] block">
                                  {log.employee_name}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[10px] font-bold text-slate-600 leading-tight">
                                {extractReason(log.description)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}