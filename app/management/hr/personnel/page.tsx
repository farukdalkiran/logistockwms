import { createClient } from '@/lib/supabase/server';
import { getBranches, getEmployees } from '@/app/actions/employee';
import CreateEmployeeClient from './_components/CreateEmployeeClient';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Terminal Personelleri | LogiStock WMS',
};

export default async function PersonnelPage() {
  const supabase = await createClient();
  
  // 1. Sunucu tarafında kimlik ve yetki çözümü
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  const managerBranchId = profile.branch_id;
  const isGlobal = profile.role === 'Developer' || profile.role === 'Admin' || !profile.branch_id;
  
  // Developer kontrolü (Client bileşenine gönderilecek)
  const isDeveloper = profile.role === 'Developer';

  // 2. Yetkiye göre filtrelenmiş verileri çek
  const [branches, employees] = await Promise.all([
    getBranches(managerBranchId, isGlobal).catch(() => []),
    getEmployees(managerBranchId, isGlobal).catch(() => [])
  ]);

  return (
    <div className="w-full">
      
      {/* MODERN SHARP & INDUSTRIAL HEADING PANEL */}
      <div className="mb-8 relative overflow-hidden bg-[#0B1121] px-6 py-10 sm:px-10 border border-slate-800 border-l-[6px] border-l-[#dc3545] rounded-none shadow-[4px_4px_0px_0px_rgba(30,41,59,1)]">
        
        {/* Endüstriyel Izgara (Grid) Arka Planı */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:linear-gradient(to_bottom,white,transparent)] opacity-20 pointer-events-none"></div>

        {/* Keskin Degrade Aydınlatma */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#dc3545]/5 to-transparent pointer-events-none"></div>

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="flex-1">
            
            {/* Rozetler (Tamamen Köşeli) */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="bg-[#dc3545]/10 text-[#dc3545] text-[10px] font-black px-3 py-1.5 rounded-none tracking-[0.2em] uppercase border border-[#dc3545]/30 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#dc3545] animate-pulse"></span>
                WMS Operasyon Merkezi
              </span>
              {isDeveloper && (
                <span className="bg-indigo-900/40 text-indigo-400 text-[10px] font-black px-3 py-1.5 rounded-none tracking-[0.2em] uppercase border border-indigo-500/30 flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                  <span className="w-1.5 h-1.5 bg-indigo-500"></span>
                  Geliştirici Yetkisi Aktif
                </span>
              )}
            </div>
            
            {/* Başlık */}
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
              Personel <span className="text-slate-600 font-light">/</span> Terminal Yön.
            </h1>
            
            {/* Açıklama */}
            <p className="text-slate-400 mt-5 text-sm font-medium max-w-2xl leading-relaxed border-l-2 border-slate-700 pl-4">
              Saha operasyonları için benzersiz terminal erişim kodları üretin, yüksek güvenlikli (Level-H) QR yaka kartları basın ve yetkilendirmeleri yönetin.
            </p>

            {/* Terminal Durum Detayları */}
            <div className="mt-7 flex items-center gap-8 text-xs text-slate-500 font-mono tracking-widest uppercase">
              <div className="flex flex-col gap-1">
                <span className="text-slate-600">Sistem_Durumu</span>
                <span className="text-emerald-500 flex items-center gap-1.5 font-bold">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  Çevrimiçi
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-600">Şifreleme</span>
                <span className="text-slate-300 font-bold">256-BIT AES</span>
              </div>
            </div>
            
          </div>

          {/* Sağ Taraftaki İkon / Görsel (Keskin Hatlı Teknik Çerçeve) */}
          <div className="hidden lg:flex relative w-80 h-64 bg-[#050811] border border-slate-800 p-2 flex-shrink-0 group shadow-2xl">
            {/* Dekoratif Köşe Vurguları */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#dc3545]"></div>
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#dc3545]"></div>
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#dc3545]"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#dc3545]"></div>

            {/* Görsel İçeriği */}
            <div className="w-full h-full relative overflow-hidden bg-slate-900 border border-slate-800/50">
              {/* Kırmızımsı Filtre Ekranı */}
              <div className="absolute inset-0 bg-[#dc3545]/10 mix-blend-overlay z-10 group-hover:bg-transparent transition-all duration-700"></div>
              
              <img 
                src="https://img.magnific.com/free-vector/company-staff-coworkers-team-business-partners-office-workers-corporate-employees-multicultural-group-people-isolated-flat-design-element-concept-illustration_335657-1668.jpg?t=st=1782721810~exp=1782725410~hmac=73287d28c3eb9ee292eda45305dad1eebaa84378df7d2f363461dfb3ef3b95b8&w=1480" 
                alt="Ekip Çalışması" 
                className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
              />
              
              {/* Eski Tip Monitör Scanline Efekti */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.1)_1px,transparent_1px)] bg-[size:100%_3px] z-20 pointer-events-none"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. İstemci bileşenine güvenli verileri ve DEV yetkisini besle */}
      <CreateEmployeeClient 
        branches={branches || []} 
        initialEmployees={employees || []} 
        isDeveloper={isDeveloper}
      />
    </div>
  );
}