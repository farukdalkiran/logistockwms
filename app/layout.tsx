import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/components/providers/AuthProvider";

// WMS Güvenlik Duvarı ve Supabase Sunucu İstemcisi
import { createClient } from "@/lib/supabase/server";
import { WmsSessionProvider } from "@/components/providers/WmsSessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LogiStock WMS",
  description: "Warehouse Management System",
};

// 1. WMS Oturum Verisinin Mimari İskeleti (Type Definition)
// Bu katman, TypeScript'in Inferred Type (Çıkarımsal Tip) kilitlenmesini engeller.
export type WmsSessionData = {
  userId: string | null;
  managerBranchId: string | null;
  isGlobal: boolean;
  role: string;
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 2. SUPABASE SUNUCU BAĞLANTISI VE OTURUM KONTROLÜ
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. AÇIK TİP TANIMLI (EXPLICIT TYPING) VARSAYILAN ŞUBE VE YETKİ VERİSİ
  let sessionData: WmsSessionData = {
    userId: null,
    managerBranchId: null,
    isGlobal: false,
    role: "GUEST",
  };

  // 4. EĞER GİRİŞ YAPILMIŞSA: VERİTABANINDAN YÖNETİCİ ŞUBESİNİ ÇEK
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id, role")
      .eq("id", user.id)
      .single();

    sessionData = {
      userId: user.id, // Artık TypeScript hata fırlatmaz, string değer güvenle atanır.
      managerBranchId: profile?.branch_id || "GLOBAL",
      isGlobal:
        profile?.role === "Developer" ||
        profile?.role === "Admin" ||
        profile?.branch_id === null,
      role: profile?.role || "USER",
    };
  }

  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="/favicon.png" type="image/svg+xml" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {/* TÜM UYGULAMAYI SARAN WMS ŞUBE KİLİDİ */}
          <WmsSessionProvider session={sessionData}>
            <Toaster position="top-right" />
            {children}
          </WmsSessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
