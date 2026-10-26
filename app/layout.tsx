import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/components/providers/AuthProvider";

// WMS Güvenlik Duvarı ve Supabase Sunucu İstemcisi
import { createClient } from "@/lib/supabase/server";
import { WmsSessionProvider } from "@/components/providers/WmsSessionProvider";
import { OrderNotificationProvider } from "@/components/providers/OrderNotificationProvider";

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
  branchName: string | null;
  branchType: string | null;
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
    branchName: null,
    branchType: null,
  };

  // 4. EĞER GİRİŞ YAPILMIŞSA: VERİTABANINDAN YÖNETİCİ ŞUBESİNİ ÇEK
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id, role, branches(name,type)")
      .eq("id", user.id)
      .single();

    const relation = profile?.branches as unknown as
      | { name: string; type: string }
      | { name: string; type: string }[]
      | null;
    const branch = Array.isArray(relation) ? relation[0] : relation;

    sessionData = {
      branchName: branch?.name ?? null,
      branchType: branch?.type ?? null,
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
            <OrderNotificationProvider>
              <Toaster position="top-right" />
            {children}
          </OrderNotificationProvider>
          </WmsSessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
