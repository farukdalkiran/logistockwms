'use client';

import { ImageOff, CheckCheck, Trash2, Check, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { processOrderApproval } from "@/app/actions/order-approvals";
import { useRouter } from "next/navigation";

export default function OrderReviewPanel({ order, stocks, warehouses, activeWarehouseId }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditable = order.status === 'PENDING';
  
  const REASONS = ['Stok yok', 'Yetersiz stok', 'Hasarlı / Satışa uygun değil', 'Dağıtım kotalı', 'Diğer'];

  // Depo değiştirildiğinde URL'i güncelleyip stokları sunucudan tekrar çeker
  const handleWarehouseChange = (e: any) => {
    const url = new URL(window.location.href);
    url.searchParams.set('warehouse', e.target.value);
    router.push(url.pathname + url.search);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const result = await processOrderApproval(formData);
    
    setLoading(false);
    if (result.success) {
      alert(result.message); // UI kitinize göre (Örn: react-hot-toast) değiştirebilirsiniz.
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Üst Bilgi Başlığı */}
      <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            {order.order_code}
            {order.status === 'PENDING' && <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded font-bold">BEKLİYOR</span>}
            {order.status === 'APPROVED' && <span className="bg-green-200 text-green-800 text-xs px-2 py-1 rounded font-bold">ONAYLANDI</span>}
          </h2>
          <p className="text-sm font-semibold text-slate-600 mt-1">{order.branch?.name}</p>
        </div>
        
        {isEditable && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Stok Kaynağı:</span>
            <select 
              className="border border-slate-300 rounded p-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#dc3545]"
              value={activeWarehouseId}
              onChange={handleWarehouseChange}
            >
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Sipariş Kalemleri ve Karar Formu */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
        <input type="hidden" name="order_id" value={order.id} />
        <input type="hidden" name="warehouse_id" value={activeWarehouseId} />

        <div className="flex-1 p-6 space-y-6">
          {order.order_items.map((item: any) => {
            const product = item.product || {};
            const stockInfo = stocks[item.product_id] || { quantity: 0, locations: [] };
            const isStockShort = stockInfo.quantity < item.requested_qty;

            return (
              <div key={item.id} className="flex gap-4 border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                
                {/* Görsel */}
                <div className="w-20 h-20 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 p-1">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
                  ) : (
                    <ImageOff className="text-slate-300" size={24} />
                  )}
                </div>

                {/* Ürün Bilgisi */}
                <div className="flex-1">
                  <div className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded inline-block mb-1">
                    {product.sku || 'SKU YOK'}
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-2">{product.name}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-1">{product.barcode}</p>
                  
                  <div className="mt-3 flex gap-6 items-center">
                    <div className="text-sm">
                      <span className="text-slate-500 text-xs font-semibold">Talep:</span>
                      <strong className="ml-1 text-slate-900 text-lg">{item.requested_qty}</strong>
                    </div>

                    {isEditable && (
                      <div className="text-sm pl-6 border-l border-slate-200">
                        <span className="text-slate-500 text-xs font-semibold">Depo Stok:</span>
                        <strong className={`ml-1 text-lg ${isStockShort ? 'text-orange-600' : 'text-green-600'}`}>
                          {stockInfo.quantity}
                        </strong>
                        <span className="text-xs text-slate-400 block -mt-1 truncate max-w-[150px]" title={stockInfo.locations.join(', ')}>
                          {stockInfo.locations.join(', ') || 'Raf Yok'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Karar Mekanizması */}
                {isEditable ? (
                  <div className="w-[280px] bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Depo Kararı</label>
                    <div className="grid grid-cols-3 gap-1 mb-3">
                      {/* CSS :has() seçici mantığını Next.js state'i (veya HTML native defaultChecked) ile simüle ediyoruz */}
                      <label className="cursor-pointer">
                        <input type="radio" name={`decision_${item.id}`} value="APPROVE" className="peer sr-only" defaultChecked />
                        <div className="flex flex-col items-center justify-center p-2 rounded border border-slate-300 bg-white text-slate-500 peer-checked:bg-slate-800 peer-checked:text-white peer-checked:border-slate-800 transition-colors">
                          <Check size={14} className="mb-1" />
                          <span className="text-[9px] font-bold">TAM ONAY</span>
                        </div>
                      </label>
                      <label className="cursor-pointer">
                        <input type="radio" name={`decision_${item.id}`} value="REVISE" className="peer sr-only" />
                        <div className="flex flex-col items-center justify-center p-2 rounded border border-slate-300 bg-white text-slate-500 peer-checked:bg-orange-100 peer-checked:text-orange-700 peer-checked:border-orange-400 transition-colors">
                          <SlidersHorizontal size={14} className="mb-1" />
                          <span className="text-[9px] font-bold">REVİZE</span>
                        </div>
                      </label>
                      <label className="cursor-pointer">
                        <input type="radio" name={`decision_${item.id}`} value="REMOVE" className="peer sr-only" />
                        <div className="flex flex-col items-center justify-center p-2 rounded border border-slate-300 bg-white text-slate-500 peer-checked:bg-red-100 peer-checked:text-red-700 peer-checked:border-red-400 transition-colors">
                          <Trash2 size={14} className="mb-1" />
                          <span className="text-[9px] font-bold">KALDIR</span>
                        </div>
                      </label>
                    </div>

                    {/* Revize Inputları (Sadece Revize ve Kaldır Seçiliyken Zorunlu) - İleri düzey UI için state eklenebilir, şimdilik native DOM ile bırakıyoruz */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                         <input type="number" name={`qty_${item.id}`} placeholder="Adet" defaultValue={item.requested_qty} className="w-16 p-1.5 text-xs border rounded outline-none" />
                         <select name={`reason_${item.id}`} className="flex-1 p-1.5 text-xs border rounded outline-none">
                            <option value="">Sebep Seçin...</option>
                            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                      </div>
                      <input type="text" name={`note_${item.id}`} placeholder="Ek Açıklama (Zorunlu değil)" className="w-full p-1.5 text-xs border rounded outline-none" />
                    </div>
                  </div>
                ) : (
                  <div className="w-[250px] bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col justify-center">
                    <span className="text-xs text-slate-500 font-bold uppercase mb-1">Karar:</span>
                    {item.approved_qty === item.requested_qty ? (
                      <span className="text-green-600 font-bold text-sm">Tamamı Onaylandı ({item.approved_qty} Adet)</span>
                    ) : item.approved_qty === 0 ? (
                      <div>
                        <span className="text-red-600 font-bold text-sm">Siparişten Kaldırıldı</span>
                        <p className="text-xs text-slate-500 mt-1">{item.revision_reason}</p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-orange-600 font-bold text-sm">Revize Edildi ({item.approved_qty} Adet)</span>
                        <p className="text-xs text-slate-500 mt-1">{item.revision_reason}</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )
          })}
        </div>

        {/* Aksiyon Footer */}
        {isEditable && (
          <div className="p-4 bg-slate-900 border-t-4 border-[#dc3545] flex items-center justify-between mt-auto">
            <div className="text-white">
              <strong className="block text-sm">İşlemi Tamamla</strong>
              <span className="text-[10px] text-slate-400">Azaltılan veya kaldırılan ürünlerde sebep belirtmek zorunludur.</span>
            </div>
            <div className="flex gap-3">
              <button 
                type="submit" 
                name="intent" 
                value="approve_all" 
                disabled={loading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-sm font-semibold border border-slate-600 transition disabled:opacity-50"
              >
                Tümünü Onayla
              </button>
              <button 
                type="submit" 
                name="intent" 
                value="review" 
                disabled={loading}
                className="px-4 py-2 flex items-center gap-2 bg-[#dc3545] hover:bg-red-700 text-white rounded-md text-sm font-bold transition disabled:opacity-50"
              >
                <CheckCheck size={16} /> Kararları Kaydet
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}