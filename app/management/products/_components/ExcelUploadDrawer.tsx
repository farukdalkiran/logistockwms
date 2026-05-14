"use client";

import { useState, DragEvent, useEffect } from "react";
import * as XLSX from "xlsx"; // npm install xlsx
import { supabase } from "@/lib/supabase";
import { 
  FileSpreadsheet, UploadCloud, AlertCircle, 
  CheckCircle2, Download, Loader2, Info, X, TableProperties
} from "lucide-react";

export default function ExcelUploadModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // ESC tuşu ile modali kapatma desteği
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, loading]);

  // Örnek Excel Şablonu İndirme (Supabase formatına tam uyumlu)
  const downloadTemplate = () => {
    const templateData = [
      {
        "Barkod": "8690000000001",
        "SKU": "PRD-001",
        "Ürün Adı": "Örnek Ticari Ürün",
        "Kategori": "Elektronik",
        "Görsel URL": "https://ornek.com/gorsel.jpg",
        "Sarf Malzeme mi?": "HAYIR",
        "Max Sipariş Limiti": 50
      },
      {
        "Barkod": "8690000000002",
        "SKU": "SRF-001",
        "Ürün Adı": "Koli Bandı 45x100",
        "Kategori": "Ambalaj",
        "Görsel URL": "",
        "Sarf Malzeme mi?": "EVET",
        "Max Sipariş Limiti": 1000
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Sütun genişliklerini ayarlayalım ki Excel şık açılsın
    ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 35 }, { wch: 18 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Urun_Sablonu");
    XLSX.writeFile(wb, "LogiStock_Toplu_Urun_Sablonu.xlsx");
  };

  // Drag & Drop İşleyicileri
  const handleDrag = (e: DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Ana İşleme Motoru (Supabase Entegrasyonu)
  const processFile = (file: File) => {
    setLoading(true);
    setErrorLog(null);
    setSuccessCount(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Verileri DB şemasına göre haritala ve temizle
        const formattedData = data.map((row: any) => ({
          barcode: String(row["Barkod"] || "").trim(),
          sku: String(row["SKU"] || "").trim(),
          name: String(row["Ürün Adı"] || "").trim(),
          category: String(row["Kategori"] || "").trim(),
          image_url: String(row["Görsel URL"] || "").trim() || null,
          is_consumable: String(row["Sarf Malzeme mi?"] || "").toUpperCase() === "EVET",
          max_order_limit: parseInt(row["Max Sipariş Limiti"]) || 0
        })).filter(item => item.barcode && item.name); // Sadece zorunlu alanları dolu olanları al

        if (formattedData.length === 0) {
          throw new Error("Excel dosyasında geçerli veri bulunamadı. Lütfen zorunlu alanların (Barkod, Ürün Adı) doldurulduğundan emin olun.");
        }

        // Supabase Upsert (Barkoda göre eşleşirse günceller, yoksa yeni ekler)
        const { error } = await supabase.from("products").upsert(formattedData, { onConflict: "barcode" });

        if (error) throw error;

        setSuccessCount(formattedData.length);
        onSuccess(); // Arka planda tabloyu yenile
        
        // Başarı mesajını gösterip modali otomatik kapat
        setTimeout(() => {
          onClose();
        }, 2500);

      } catch (err: any) {
        setErrorLog(err.message || "Dosya okunurken bilinmeyen bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    // FULL SCREEN OVERLAY
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in">
      
      {/* MODAL KAPSAYICI */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 relative">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#dc3545]/10 flex items-center justify-center text-[#dc3545]">
              <TableProperties size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Toplu Excel İçe Aktarımı</h2>
              <p className="text-xs text-slate-500 font-medium">LogiStock veritabanına on binlerce veriyi saniyeler içinde yükleyin.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY - 2 KOLONLU YAPI */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          
          {/* SOL KOLON: Kılavuz ve Şablon (Scrollable) */}
          <div className="w-full lg:w-5/12 bg-slate-50/50 border-r border-slate-200 p-6 overflow-y-auto">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Info size={16} className="text-indigo-500" />
              Veri Formatı Kuralları
            </h3>
            
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Sistemin verileri doğru ayıklaması ve raflanabilir hale getirmesi için 
              Excel dosyanızın <strong className="text-slate-800">1. Satırı</strong> sütun başlıklarına ayrılmalı ve aşağıdaki isimleri içermelidir:
            </p>

            {/* Kural Tablosu */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Sütun Başlığı</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-800">Barkod</td>
                    <td className="px-3 py-2 text-[#dc3545] font-bold">Zorunlu</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-800">Ürün Adı</td>
                    <td className="px-3 py-2 text-[#dc3545] font-bold">Zorunlu</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-800">SKU</td>
                    <td className="px-3 py-2 text-slate-400">Opsiyonel</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-800">Kategori</td>
                    <td className="px-3 py-2 text-slate-400">Opsiyonel</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-800">Görsel URL</td>
                    <td className="px-3 py-2 text-slate-400">Opsiyonel</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-800">Sarf Malzeme mi?</td>
                    <td className="px-3 py-2 text-slate-500 font-medium">"EVET" veya "HAYIR"</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-800">Max Sipariş Limiti</td>
                    <td className="px-3 py-2 text-slate-500 font-medium">Sadece Rakam (Örn: 50)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs text-indigo-800 mb-3 font-medium">
                Vakit kaybetmemek için hazır, formatı ayarlanmış boş şablonu indirebilirsiniz.
              </p>
              <button 
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 h-10 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-600 hover:text-white transition-colors shadow-sm"
              >
                <Download size={16} />
                Hazır Şablonu İndir
              </button>
            </div>
          </div>

          {/* SAĞ KOLON: Upload Alanı */}
          <div className="w-full lg:w-7/12 p-6 flex flex-col bg-white">
            
            {/* Dinamik Durum Ekranları */}
            {errorLog && (
              <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={20} className="shrink-0 text-[#dc3545] mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Yükleme Başarısız</h4>
                  <p className="text-xs font-medium">{errorLog}</p>
                </div>
              </div>
            )}

            {successCount !== null && (
              <div className="mb-6 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 p-5 rounded-xl animate-in fade-in slide-in-from-top-2 shadow-sm">
                <CheckCircle2 size={28} className="shrink-0 text-emerald-600" />
                <div>
                  <h4 className="font-black text-base">İşlem Tamamlandı!</h4>
                  <p className="text-sm font-medium">{successCount} adet veri başarıyla LogiStock veritabanına eklendi.</p>
                </div>
              </div>
            )}

            {/* Sürükle Bırak (Drag & Drop) Alanı */}
            {!successCount && (
              <label 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ease-in-out group min-h-[300px]
                  ${dragActive 
                    ? "border-[#dc3545] bg-red-50/50 scale-[0.99]" 
                    : "border-slate-300 hover:border-[#dc3545]/50 hover:bg-slate-50"
                  }
                  ${loading ? "opacity-50 pointer-events-none" : ""}
                `}
              >
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                  onChange={handleFileInput}
                  disabled={loading}
                />
                
                {loading ? (
                  <div className="flex flex-col items-center text-[#dc3545]">
                    <Loader2 size={48} className="animate-spin mb-4" />
                    <span className="font-black text-lg">Veriler Çözümleniyor...</span>
                    <span className="text-sm text-slate-500 mt-2">Supabase ile senkronize ediliyor, pencereyi kapatmayın.</span>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-white shadow-sm border border-slate-200 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-red-200 group-hover:shadow-md transition-all duration-300">
                      <FileSpreadsheet size={36} className="text-slate-400 group-hover:text-[#dc3545] transition-colors" />
                    </div>
                    <span className="text-slate-800 font-black text-xl mb-2 text-center">
                      Excel Dosyasını Buraya Sürükleyin
                    </span>
                    <span className="text-slate-500 text-sm font-medium text-center">
                      veya <span className="text-[#dc3545] underline underline-offset-2">bilgisayarınızdan seçin</span> (.xlsx, .xls)
                    </span>
                  </>
                )}
              </label>
            )}

            {/* Bilgi Footer */}
            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <UploadCloud size={14} />
              LogiStock Secure Upload Engine
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}