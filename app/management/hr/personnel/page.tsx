import { createClient } from '@/lib/supabase/server';
import { getBranches, getEmployees } from '@/app/actions/employee';
import CreateEmployeeClient from './_components/CreateEmployeeClient';
import { redirect } from 'next/navigation';
import { WmsPageHeader, WmsBadge } from '@/components/ui/wms';

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
      
      <WmsPageHeader
        eyebrow="İnsan Kaynakları / Terminal"
        title="Personel ve Terminal Yönetimi"
        description="Personel kimliklerini, QR yaka kartlarını ve terminal erişimlerini güvenle yönetin."
        actions={isDeveloper ? <WmsBadge tone="info">Geliştirici yetkisi</WmsBadge> : <WmsBadge tone="neutral">Şube erişimi</WmsBadge>}
      />

      {/* 3. İstemci bileşenine güvenli verileri ve DEV yetkisini besle */}
      <CreateEmployeeClient 
        branches={branches || []} 
        initialEmployees={employees || []} 
        isDeveloper={isDeveloper}
      />
    </div>
  );
}