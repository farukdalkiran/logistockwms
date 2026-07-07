import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/components/providers/AuthProvider";

// YENİ İMPORTLAR: WMS Güvenlik Duvarı ve Supabase
import { createClient } from "@/lib/supabase/server";
import { WmsSessionProvider } from "@/components/providers/WmsSessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LogiStock WMS",
  description: "Warehouse Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  // 1. SUPABASE SUNUCU BAĞLANTISI VE OTURUM KONTROLÜ
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 2. VARSAYILAN (MİSAFİR) ŞUBE VE YETKİ VERİSİ
  let sessionData = { 
    userId: null, 
    managerBranchId: null, 
    isGlobal: false, 
    role: "GUEST" 
  };

  // 3. EĞER GİRİŞ YAPILMIŞSA: VERİTABANINDAN YÖNETİCİ ŞUBESİNİ ÇEK
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id, role")
      .eq("id", user.id)
      .single();

    sessionData = {
      userId: user.id,
      managerBranchId: profile?.branch_id || "GLOBAL",
      isGlobal: profile?.role === "Developer" || profile?.role === "Admin" || profile?.branch_id === null,
      role: profile?.role || "USER",
    };
  }

  return (
    <html lang="tr">
      <body className={inter.className}>
        <AuthProvider>
          {/* YENİ: TÜM UYGULAMAYI SARAN WMS ŞUBE KİLİDİ */}
          <WmsSessionProvider session={sessionData}>
            <Toaster position="top-right" />
            {children}
          </WmsSessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}