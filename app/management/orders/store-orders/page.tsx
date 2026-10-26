import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Warehouse, RefreshCw, ClipboardList, Package } from "lucide-react";
import Link from "next/link";
import OrderList from "./_components/OrderList";
import OrderReviewPanel from "./_components/OrderReviewPanel";

export const dynamic = 'force-dynamic';

export default async function StoreOrdersPage({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams;
  const client = await createClient();
  const { data: session } = await client.auth.getUser();

  if (!session.user) redirect('/login');

  // Parametreleri al
  const status = params.status || 'PENDING';
  const page = Number(params.page) || 1;
  const selectedOrderId = params.order || null;
  const search = params.q || '';
  const selectedWarehouseId = params.warehouse || '';

  // 1. Şubeleri ve Kullanıcı Profilini Çek
  const [{ data: branches }, { data: profile }] = await Promise.all([
    client.from('branches').select('id, name, type').order('name'),
    client.from('profiles').select('branch_id').eq('id', session.user.id).single()
  ]);

  const warehouses = (branches || []).filter(b => b.type === 'Depo');
  
  // Varsayılan Depo Belirleme
  const defaultWarehouse = warehouses.find(w => w.id === profile?.branch_id)?.id || warehouses[0]?.id;
  const activeWarehouseId = selectedWarehouseId || defaultWarehouse;

  // 2. Siparişleri Çek (Filtrelemeli)
  let query = client
    .from('orders')
    .select(`
      id, order_code, status, created_at, requested_by,
      branch:branches!orders_branch_id_fkey(name),
      order_items(requested_qty)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);

  if (status !== 'ALL') query = query.eq('status', status);
  if (search) query = query.ilike('order_code', `%${search}%`);

  const { data: orders, count: totalOrders } = await query;

  // 3. Seçili Sipariş Varsa Detayını ve Stokları Çek
  let selectedOrderDetails = null;
  let stocks: any = {};

  if (selectedOrderId) {
    const { data: detailData } = await client
      .from('orders')
      .select(`
        id, order_code, status, created_at, requested_by,
        branch:branches!orders_branch_id_fkey(name),
        order_items(
          id, product_id, requested_qty, approved_qty, revision_reason,
          product:products(id, name, sku, barcode, image_url)
        )
      `)
      .eq('id', selectedOrderId)
      .single();

    selectedOrderDetails = detailData;

    // Eğer sipariş PENDING ise ve bir depo seçiliyse, ürünlerin bu depodaki stoklarını çek
    if (selectedOrderDetails?.status === 'PENDING' && activeWarehouseId) {
      const productIds = selectedOrderDetails.order_items.map((item: any) => item.product_id);
      if (productIds.length > 0) {
        const { data: stockData } = await client
          .from('stocks')
          .select('product_id, quantity, shelf_location')
          .eq('branch_id', activeWarehouseId)
          .in('product_id', productIds);
        
        // Stokları product_id'ye göre maple (Grupla)
        stockData?.forEach(st => {
          if (!stocks[st.product_id]) stocks[st.product_id] = { quantity: 0, locations: [] };
          stocks[st.product_id].quantity += st.quantity;
          if (st.shelf_location) stocks[st.product_id].locations.push(st.shelf_location);
        });
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 lg:p-8">
      {/* Dark-Industrial Header */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-[#dc3545]">
        <div>
          <span className="flex items-center gap-2 text-[#dc3545] font-bold text-xs tracking-widest uppercase mb-1">
            <Warehouse size={16} /> Merkez Depo Komuta
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mağaza Sipariş & Talepler</h1>
          <p className="text-slate-500 text-sm mt-1">Gelen mağaza taleplerini depo stok durumuna göre inceleyin ve onaylayın.</p>
        </div>
        <Link 
          href="/management/orders/store-orders" 
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-md transition-colors text-sm font-semibold border border-slate-300"
        >
          <RefreshCw size={16} /> Ekranı Yenile
        </Link>
      </header>

      {/* Ana Kapsayıcı Grid (Layout) */}
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        
        {/* SOL: SİPARİŞ LİSTESİ */}
        <aside className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
          <OrderList 
            orders={orders || []} 
            total={totalOrders || 0}
            currentParams={params}
            branches={branches || []}
          />
        </aside>

        {/* SAĞ: SİPARİŞ DETAY VE ONAY PANELİ */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[calc(100vh-200px)] overflow-y-auto">
          {!selectedOrderDetails ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center gap-4">
              <ClipboardList size={64} className="opacity-20" />
              <h2 className="text-xl font-bold text-slate-600">İncelemek İçin Sipariş Seçin</h2>
              <p className="text-sm max-w-sm">Mağazaların talep ettiği ürünler, talep adetleri ve depo karar işlemleri burada görüntülenir.</p>
            </div>
          ) : (
            <OrderReviewPanel 
              order={selectedOrderDetails} 
              stocks={stocks} 
              warehouses={warehouses}
              activeWarehouseId={activeWarehouseId}
            />
          )}
        </section>

      </div>
    </main>
  );
}