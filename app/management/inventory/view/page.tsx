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


      {/* CLIENT PANEL */}
      <div className="py-6">
        <div className="max-w-[1400px] mx-auto">
          <InventoryViewPanel branchId={branchId} isGlobal={isGlobal} />
        </div>
      </div>
      
    </div>
  );
}