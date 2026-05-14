// app/page.tsx (Örnek Kullanım)
import { Navbar } from '@/components/shared/Navbar';
import { Footer } from '@/components/shared/Footer';

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      
      {/* Ana İçerik */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
         <h1 className="text-2xl font-bold">Sosyal Dashboard</h1>

      </main>

      <Footer />
    </div>
  );
}