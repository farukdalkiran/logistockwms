"use client";

import { useState, useEffect } from "react";
import { getShipmentsForTable } from "@/app/actions/shipment-table";

export default function ShipmentsTable() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "processed">("all");

  const fetchData = async () => {
    setLoading(true);
    const result = await getShipmentsForTable(search.trim(), filter);
    if (result.success && result.data) {
      setData(result.data);
    }
    setLoading(false);
  };

  // İlk yükleme ve filtre değişimlerinde tetikle
  useEffect(() => {
    fetchData();
  }, [filter]);

  // Arama inputu için Debounce (Yazmayı bitirince arasın)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col">
      
      {/* 1. Kısım: Birleşik Kontrol Merkezi (Endüstriyel Dark Heading) */}
      <div className="bg-slate-900 p-5 border-b-4 border-[#dc3545] flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-wide uppercase">Sipariş & Kargo Havuzu</h2>
          <p className="text-slate-400 text-sm mt-0.5">Sisteme yüklenen tüm siparişlerin durumunu izleyin.</p>
        </div>

        {/* Filtre ve Arama Alanı */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Arama Kutusu */}
          <div className="relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#dc3545] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Delivery No / Müşteri Ara..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full md:w-72 bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-lg pl-10 pr-4 focus:outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] transition-all"
            />
          </div>

          {/* Durum Filtresi (Toggle) */}
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button 
              onClick={() => setFilter("all")}
              className={`px-4 h-9 rounded-md text-sm font-bold transition-colors ${filter === "all" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
            >
              Tümü
            </button>
            <button 
              onClick={() => setFilter("pending")}
              className={`px-4 h-9 rounded-md text-sm font-bold transition-colors ${filter === "pending" ? "bg-orange-500/20 text-orange-400 shadow-sm" : "text-slate-400 hover:text-white"}`}
            >
              Bekleyen
            </button>
            <button 
              onClick={() => setFilter("processed")}
              className={`px-4 h-9 rounded-md text-sm font-bold transition-colors ${filter === "processed" ? "bg-green-500/20 text-green-400 shadow-sm" : "text-slate-400 hover:text-white"}`}
            >
              Kargolanan
            </button>
          </div>
        </div>
      </div>

      {/* 2. Kısım: Akıllı Veri Tablosu (Light-Industrial) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-200">
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Durum</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery No</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Müşteri & Adres</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Kargo Takip No</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Yükleme Tarihi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 relative">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <svg className="animate-spin h-8 w-8 text-[#dc3545] mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-slate-500 font-medium">Veriler yükleniyor...</span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 font-medium bg-slate-50">
                  Bu kriterlere uygun sipariş bulunamadı.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                  
                  {/* Status Badge */}
                  <td className="py-4 px-6 align-middle">
                    {row.is_processed_aras ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-green-100 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        KARGOLANDI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-orange-100 text-orange-700 border border-orange-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        BEKLİYOR
                      </span>
                    )}
                  </td>

                  {/* Delivery No (Monospace WMS format) */}
                  <td className="py-4 px-6 align-middle">
                    <div className="font-mono text-sm font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200 inline-block">
                      {row.delivery_number}
                    </div>
                  </td>

                  {/* Müşteri ve Adres Bilgisi */}
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-800">{row.customer_name}</div>
                    <div className="text-xs text-slate-500 font-medium truncate max-w-[250px] mt-0.5" title={`${row.street} ${row.city}`}>
                      {row.city} / {row.region}
                    </div>
                  </td>

                  {/* Kargo Takip No */}
                  <td className="py-4 px-6 align-middle font-mono text-sm">
                    {row.aras_tracking_number ? (
                      <span className="font-bold text-slate-700">{row.aras_tracking_number}</span>
                    ) : (
                      <span className="text-slate-400 font-medium text-xs">Atanmadı</span>
                    )}
                  </td>

                  {/* Tarih */}
                  <td className="py-4 px-6 align-middle text-sm text-slate-500 font-medium">
                    {new Date(row.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer Info */}
      {!loading && data.length > 0 && (
        <div className="bg-slate-50 p-4 border-t border-slate-200 text-xs font-bold text-slate-500 flex justify-between items-center">
          <span>Toplam <span className="text-slate-800">{data.length}</span> kayıt listeleniyor.</span>
          <span className="text-slate-400">LogiStock WMS v7.0</span>
        </div>
      )}
    </div>
  );
}