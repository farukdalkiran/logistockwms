"use client";

import { ArrowLeft, Mail, ServerCrash } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[80vh] w-full bg-slate-50 font-['Quicksand'] overflow-hidden">
      
      {/* Endüstriyel Arka Plan Deseni */}
      <div className="absolute inset-0 opacity-[0.03] bg-[repeating-linear-gradient(45deg,#000,#000_1px,transparent_1px,transparent_10px)] pointer-events-none"></div>
      
      {/* Merkez Kart */}
      <div className="bg-white p-8 md:p-10 border border-slate-200  shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center max-w-lg w-full relative z-10 flex flex-col items-center">
        
        {/* Üst Kırmızı Güvenlik Şeridi */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#dc3545]"></div>

        {/* Güvenlik Kodu Badge */}
        <div className="absolute top-4 left-4 flex items-center gap-1.5 opacity-60">
          <ServerCrash size={14} className="text-slate-500" />
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            ERR_403_FORBIDDEN
          </span>
        </div>

        {/* Vektör Görsel Alanı */}
        <div className="w-full flex justify-center mt-6 mb-6">
          <img 
            src="https://i.hizliresim.com/r064hj5.jpg" 
            alt="Erişim Reddedildi" 
            className="w-56 md:w-64 h-auto object-contain pointer-events-none mix-blend-multiply"
          />
        </div>

        <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 tracking-tight uppercase">
          Erişim Reddedildi
        </h1>
        
        <p className="text-slate-500 text-sm mb-8 leading-relaxed font-semibold">
          Sahip olduğunuz sistem rolü <strong className="text-slate-700">bu modülü görüntülemek</strong> veya işlem yapmak için gerekli güvenlik izinlerine sahip değil.
        </p>

{/* İletişim / Destek Bloğu (Ortalanmış Premium Tasarım) */}
        <div className="w-full bg-slate-50/80 backdrop-blur-sm border border-slate-200 py-5 px-4  mb-8 flex flex-col items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-md hover:border-slate-300">
          
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Yetki Yükseltme Talebi İçin
          </span>
          
          <a 
            href="mailto:faruk.dalkiran@peeraj.com.tr" 
            className="group flex items-center justify-center gap-3 w-full max-w-full overflow-hidden cursor-pointer"
          >
            {/* İkon Dairesi */}
            <div className="p-2 bg-red-50 group-hover:bg-[#dc3545] text-[#dc3545] group-hover:text-white rounded-full shrink-0 transition-all duration-300 shadow-sm">
              <Mail size={16} />
            </div>
            
            {/* E-posta Metni */}
            <span className="text-[15px] font-bold text-slate-700 group-hover:text-[#dc3545] transition-colors truncate">
              faruk.dalkiran@peeraj.com.tr
            </span>
          </a>
          
        </div>

        {/* Aksiyon Butonları */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center w-full">
          <Button 
            onClick={() => router.back()} 
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-6 h-11  w-full sm:w-auto shadow-sm transition-colors"
          >
            <ArrowLeft size={16} className="mr-2" /> Geri Dön
          </Button>
          <Button 
            onClick={() => router.push("/management")} 
            className="bg-[#dc3545] hover:bg-red-700 text-white font-bold px-6 h-11  w-full sm:w-auto shadow-[0_4px_14px_rgba(220,53,69,0.25)] transition-all"
          >
            Anasayfaya Git
          </Button>
        </div>

      </div>
    </div>
  );
}