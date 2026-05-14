// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Montserrat, Paytone_One } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ 
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const paytone = Paytone_One({ 
  weight: "400", 
  subsets: ["latin"],
  variable: "--font-paytone",
  display: "swap",
});

export const metadata: Metadata = { title: "LogiStock WMS" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      {/* Değişkenleri buraya ekliyoruz */}
      <body className={`${montserrat.variable} ${paytone.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}