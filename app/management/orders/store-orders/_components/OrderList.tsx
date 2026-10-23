'use client';

import Link from "next/link";
import { Search, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrderList({ orders, total, currentParams, branches }: any) {
  const router = useRouter();
  
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(currentParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page'); // Filtre değişince 1. sayfaya dön
    router.push(`?${params.toString()}`);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PENDING': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded text-[10px] font-bold">BEKLİYOR</span>;
      case 'APPROVED': return <span className="px-2 py-1 bg-green-100 text-green-700 border border-green-300 rounded text-[10px] font-bold">ONAYLANDI</span>;
      case 'PARTIALLY_APPROVED': return <span className="px-2 py-1 bg-orange-100 text-orange-700 border border-orange-300 rounded text-[10px] font-bold">REVİZE EDİLDİ</span>;
      case 'REJECTED': return <span className="px-2 py-1 bg-red-100 text-red-700 border border-red-300 rounded text-[10px] font-bold">İPTAL</span>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filtreler */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Sipariş Kodu (ORD-...)"
            defaultValue={currentParams.q}
            onChange={(e) => updateFilter('q', e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-[#dc3545] outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select 
            className="w-full p-2 text-xs border border-slate-300 rounded-md outline-none focus:border-[#dc3545]"
            value={currentParams.status || 'PENDING'}
            onChange={(e) => updateFilter('status', e.target.value)}
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="PENDING">Bekleyenler</option>
            <option value="APPROVED">Onaylananlar</option>
            <option value="PARTIALLY_APPROVED">Revize Edilenler</option>
            <option value="REJECTED">Reddedilenler</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-2">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Kayıt bulunamadı.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {orders.map((order: any) => {
              const isSelected = currentParams.order === order.id;
              const totalItems = order.order_items.length;
              const totalQty = order.order_items.reduce((sum: number, item: any) => sum + item.requested_qty, 0);

              return (
                <Link 
                  href={`?${new URLSearchParams({...currentParams, order: order.id}).toString()}`}
                  key={order.id}
                  className={`block p-4 rounded-lg border transition-all ${isSelected ? 'bg-red-50 border-[#dc3545] border-l-4' : 'bg-white border-slate-200 hover:border-slate-300 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-800">{order.order_code}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="text-sm font-semibold text-slate-700 truncate">{order.branch?.name}</div>
                  <div className="mt-3 flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>{totalItems} Kalem • {totalQty} Adet</span>
                    <span>{new Date(order.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}