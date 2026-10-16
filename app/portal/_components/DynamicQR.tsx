"use client";

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getFreshQR } from '@/app/actions/portal';

export default function DynamicQR() {
  const [qrValue, setQrValue] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    const fetchQR = async () => {
      const res = await getFreshQR();
      if (res.success && res.qrData) {
        setQrValue(res.qrData);
        setTimeLeft(15); // Yeni QR geldiğinde sayacı tam 15'e kur
      }
    };

    fetchQR();
    // Sunucu tarafındaki 15 saniyelik bloklarla tam eşleşmesi için 15000 ms
    const intervalId = setInterval(fetchQR, 15000); 
    
    const countdownId = setInterval(() => {
      setTimeLeft((prev) => (prev > 1 ? prev - 1 : 15));
    }, 1000);

    return () => {
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] flex flex-col items-center p-8 relative border border-white">
      {/* Barkod Alanı */}
      <div className="p-4 bg-white border-[3px] border-slate-100 rounded-2xl relative group">
        {qrValue ? (
          <QRCodeSVG 
            value={qrValue} 
            size={200} 
            level="H" 
            fgColor="#0f172b" 
            includeMargin={false} 
          />
        ) : (
          <div className="w-[200px] h-[200px] bg-slate-50 animate-pulse rounded-xl flex items-center justify-center">
            <span className="text-[10px] text-slate-400 font-black tracking-widest">ÜRETİLİYOR...</span>
          </div>
        )}
      </div>

      {/* Progress Bar ve Kırmızı Vurgu */}
      <div className="w-full mt-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">
            GÜVENLİK YENİLEMESİ
          </span>
          <span className="text-[11px] font-black text-[#dc3545] font-mono">
            00:{timeLeft.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#dc3545] transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 15) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}