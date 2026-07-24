import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { FileSpreadsheet } from 'lucide-react';

// İç bileşenler
import LeaveExcelDownloader from './_components/LeaveExcelDownloader';
import LeaveExcelUploader from './_components/LeaveExcelUploader';

export const metadata = {
  title: 'Toplu İzin Yönetimi | LogiStock WMS',
};

export default async function LeaveManagementPage() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // RSC'de sadece okuma
        },
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

  if (!isGlobal && profile?.role !== 'HR') {
    redirect('/management/unauthorized');
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6  transition-all duration-300">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Light-Industrial Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 uppercase flex items-center gap-3">
              <span className="w-2 h-6 bg-[#dc3545] inline-block rounded-sm"></span>
              Toplu İzin Güncelleme (Excel)
            </h1>
            <p className="text-slate-500 mt-1 pl-5 text-sm">
              Mevcut izin bakiyelerini dışa aktarın, şablonda düzenleyip sisteme yükleyin. Sistem, yüklenen şablondaki "KALAN İZİN" sütununu baz alır. Limit: -14 Gün.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-md shadow-sm">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700">Aktif Şablon: V.2</span>
          </div>
        </div>

        {/* Operasyon Modülleri Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LeaveExcelDownloader branchId={branchId} isGlobal={isGlobal} />
          <LeaveExcelUploader branchId={branchId} isGlobal={isGlobal} />
        </div>

      </div>
    </div>
  );
}