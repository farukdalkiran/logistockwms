import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { PackageSearch, Info, Database } from 'lucide-react';

import InventoryViewPanel from './_components/InventoryViewPanel';

export const metadata = {
  title: 'Canlı Stok Görüntüleme | LogiStock WMS',
};

export default async function InventoryViewPage() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* Sadece Okuma */ },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', session.user.id)
    .single();

  const isGlobal = profile?.role === 'Developer' || profile?.role === 'Admin' || !profile?.branch_id;
  const branchId = profile?.branch_id;

  return (
    <div className="flex flex-col min-h-screen gap-6 bg-slate-50 p-4 md:p-6 lg:p-8">
      
      {/* 
        YENİ ENDÜSTRİYEL HERO HEADER 
        Karanlık depo arka planı, Info kartı ve Sistem Aksiyon Statüsü
      */}
      <div className="relative w-full min-h-[220px] flex flex-col lg:flex-row justify-between p-6 md:p-8 bg-slate-900 border-b-2 border-slate-400 overflow-hidden gap-8 rounded-sm mb-6">
        
        {/* Arka Plan Görseli ve Endüstriyel Karartma */}
        <img 
          src="https://img.magnific.com/free-photo/spacious-warehouse-with-rows-shelves-forklift_84443-74085.jpg?t=st=1779108507~exp=1779112107~hmac=834c43fbd471b0766ff07fba31ef7c5cc6527409831e16ab7112e2dc4f5c9ac6&w=1480"
          alt="Inventory Management"
          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
        
        {/* Sol Alan: Başlık ve Sistem Bilgi Kartı */}
        <div className="relative z-10 flex flex-col gap-6 w-full lg:max-w-2xl justify-center">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-[#dc3545] border border-red-400/50 rounded-sm shadow-[0_0_20px_rgba(220,53,69,0.3)]">
              <PackageSearch className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Canlı Stok ve Raf İzleme</h1>
              <p className="text-[#dc3545] text-xs font-bold uppercase tracking-widest mt-1">Real-Time Envanter Sorgu Merkezi</p>
            </div>
          </div>

          {/* Endüstriyel Info Kartı */}
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 border-l-4 border-l-[#dc3545] p-4 md:p-5 rounded-sm flex gap-4 items-start shadow-inner">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1.5">
              <h4 className="text-slate-200 text-xs font-bold uppercase tracking-widest">Arama ve Log Bilgilendirmesi</h4>
              <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                Bu panel, bulunduğunuz şubedeki (veya global yetkideki) ürün stoklarını canlı olarak listeler. Barkod veya SKU ile arama yapabilir, stoku "0" olan ürünleri görebilir ve <strong className="text-slate-200">Mevcut Stok</strong> rakamlarına tıklayarak detaylı <strong className="text-slate-200">Raf Geçmiş Loglarını</strong> izleyebilirsiniz.
              </p>
            </div>
          </div>
        </div>

        {/* Sağ Alan: Statü Paneli */}
        <div className="relative z-10 w-full lg:w-80 flex flex-col justify-center">
          <div className="bg-slate-800/90 backdrop-blur-md border border-slate-600 p-5 rounded-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Envanter Veri Motoru</label>
              <span className="flex items-center gap-2 text-[10px] font-black text-green-400 uppercase tracking-widest">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                Aktif
              </span>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="w-full flex items-center justify-center gap-2 h-11 px-4 bg-slate-950 border border-slate-500 text-slate-200 rounded-sm text-[11px] font-black uppercase tracking-widest shadow-inner">
                <Database size={16} className="text-emerald-500" />
                Yetki: {isGlobal ? 'Global / Merkez' : 'Şube İçi İzole'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CLIENT PANEL */}
      <div className="py-6">
        <div className="max-w-[1400px] mx-auto">
          <InventoryViewPanel branchId={branchId} isGlobal={isGlobal} />
        </div>
      </div>
      
    </div>
  );
}