import { Navbar } from "@/components/shared/Navbar"; 
import { Footer } from "@/components/shared/Footer";

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // h-screen yerine min-h-screen kullandık ve overflow-hidden'ı kaldırdık
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Navbar />

      <main className="flex-1 p-4 md:p-6">
        <div className="2xl:max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}