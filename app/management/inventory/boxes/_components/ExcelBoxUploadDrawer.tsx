"use client";

import { useState, DragEvent, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { bulkCreateBoxesAction } from "@/app/actions/boxes";
import { 
  FileSpreadsheet, UploadCloud, AlertCircle, 
  CheckCircle2, Download, Loader2, Info, X, TableProperties, AlertTriangle, Database
} from "lucide-react";

interface CorruptedRow {
  satir: number;
  box_barcode: string;
  product_barcode: string;
  quantity: any;
  hata_nedeni: string;
}

export default function ExcelBoxUploadDrawer({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(""); 
  const [dragActive, setDragActive] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [corruptedRows, setCorruptedRows] = useState<CorruptedRow[]>([]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, loading]);

  const downloadTemplate = () => {
    const templateData = [
      {
        "Dış Koli Barkodu": "BOX-86900001",
        "Koli İçi Ürün Barkodu": "8690000000001",
        "Koli İçi Adet": 24
      },
      {
        "Dış Koli Barkodu": "BOX-86900002",
        "Koli İçi Ürün Barkodu": "8690000000002",
        "Koli İçi Adet": 50
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{ wch: 22 }, { wch: 25 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Koli_Sablonu");
    XLSX.writeFile(wb, "LogiStock_Toplu_Koli_Sablonu.xlsx");
  };

  const downloadErrorLogExcel = () => {
    if (corruptedRows.length === 0) return;

    const exportData = corruptedRows.map(item => ({
      "Excel Satır No": item.satir,
      "Yüklenen Dış Koli Barkodu": item.box_barcode,
      "Yüklenen Ürün Barkodu": item.product_barcode,
      "Yüklenen Adet": item.quantity,
      "Kritik Hata Açıklaması": item.hata_nedeni
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 65 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hata_Raporu");
    XLSX.writeFile(wb, `LogiStock_Koli_Hatalari_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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

  const processFile = (file: File) => {
    setLoading(true);
    setErrorLog(null);
    setSuccessCount(null);
    setCorruptedRows([]);
    setLoadingStatus("Excel belgesi doğrulanıyor...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const excelRows: any[] = XLSX.utils.sheet_to_json(ws);

        if (excelRows.length === 0) {
          throw new Error("Excel dosyasında işlenecek veri satırı bulunamadı.");
        }

        const firstRow: any = excelRows[0];
        if (firstRow && (!firstRow.hasOwnProperty("Dış Koli Barkodu") || !firstRow.hasOwnProperty("Koli İçi Ürün Barkodu") || !firstRow.hasOwnProperty("Koli İçi Adet"))) {
          throw new Error("Geçersiz şablon yapısı! Sütunlar tam olarak 'Dış Koli Barkodu', 'Koli İçi Ürün Barkodu' ve 'Koli İçi Adet' olmalıdır.");
        }

        const SAFE_CHUNK_SIZE = 250;

        const excelProductBarcodes = Array.from(
          new Set(
            excelRows.map((row: any) => String(row["Koli İçi Ürün Barkodu"] || "").trim())
          )
        ).filter(Boolean);

        const barcodeToIdMap = new Map<string, string>();
        const totalChunks = Math.ceil(excelProductBarcodes.length / SAFE_CHUNK_SIZE);

        // --- 1. ETAP: ÜRÜN KARTLARI TARAMA KUYRUĞU ---
        for (let i = 0; i < excelProductBarcodes.length; i += SAFE_CHUNK_SIZE) {
          const currentChunkIdx = Math.floor(i / SAFE_CHUNK_SIZE) + 1;
          setLoadingStatus(`Ürün Kartları Doğrulanıyor: Paket ${currentChunkIdx} / ${totalChunks}`);
          
          const chunk = excelProductBarcodes.slice(i, i + SAFE_CHUNK_SIZE);
          
          const { data: dbProducts, error: dbError } = await supabase
            .from("products")
            .select("id, barcode")
            .in("barcode", chunk);

          if (dbError) throw dbError;
          dbProducts?.forEach((p) => barcodeToIdMap.set(p.barcode, p.id));
        }

        // --- 2. ETAP: BELLEK İÇİ AYIKLAMA ---
        setLoadingStatus("Tanımsız ve hatalı satırlar ayrıştırılıyor...");
        const validBoxes: any[] = [];
        const temporaryCorrupted: CorruptedRow[] = [];

        excelRows.forEach((row: any, index: number) => {
          const boxBarcode = String(row["Dış Koli Barkodu"] || "").trim();
          const productBarcode = String(row["Koli İçi Ürün Barkodu"] || "").trim();
          const quantity = parseInt(row["Koli İçi Adet"]);
          const rowNum = index + 2;

          if (!boxBarcode || !productBarcode || isNaN(quantity) || quantity <= 0) {
            temporaryCorrupted.push({
              satir: rowNum,
              box_barcode: boxBarcode || "EKSİK",
              product_barcode: productBarcode || "EKSİK",
              quantity: row["Koli İçi Adet"] || "GEÇERSİZ",
              hata_nedeni: "Eksik veri hücresi veya hatalı koli miktar tanımı."
            });
            return;
          }

          const productId = barcodeToIdMap.get(productBarcode);
          if (!productId) {
            temporaryCorrupted.push({
              satir: rowNum,
              box_barcode: boxBarcode,
              product_barcode: productBarcode,
              quantity: quantity,
              hata_nedeni: "Bu ürün barkodu sistemde kayıtlı değil. Önce ürün kartı açılmalıdır."
            });
            return;
          }

          validBoxes.push({
            box_barcode: boxBarcode,
            product_id: productId,
            quantity: quantity
          });
        });

        setCorruptedRows(temporaryCorrupted);

        if (validBoxes.length === 0) {
          throw new Error(`İşlem durduruldu. Dosyadaki ${temporaryCorrupted.length} satırın tamamı tanımsız ürün içeriyor.`);
        }

        // --- 3. ETAP: VERİTABANI ENJEKSİYON KUYRUĞU (KESİNTİSİZ AKIŞ) ---
        const totalInsertChunks = Math.ceil(validBoxes.length / SAFE_CHUNK_SIZE);
        let insertedCount = 0;

        for (let i = 0; i < validBoxes.length; i += SAFE_CHUNK_SIZE) {
          const currentInsertIdx = Math.floor(i / SAFE_CHUNK_SIZE) + 1;
          setLoadingStatus(`Koli Tanımları Akıtılıyor: Paket ${currentInsertIdx} / ${totalInsertChunks}`);
          
          const chunk = validBoxes.slice(i, i + SAFE_CHUNK_SIZE);
          
          // Güncellenen Server Action çağrılıyor
          const result = await bulkCreateBoxesAction(chunk, "3976");
          if (!result.success) {
            throw new Error(result.error);
          }
          insertedCount += chunk.length;
        }

        setSuccessCount(insertedCount);
        onSuccess();
        
        if (temporaryCorrupted.length === 0) {
          setTimeout(() => {
            onClose();
          }, 2000);
        }

      } catch (err: any) {
        setErrorLog(err.message || "Toplu aktarım sırasında bir altyapı hatası oluştu.");
      } finally {
        setLoading(false);
        setLoadingStatus("");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in">
      <div className="bg-white rounded-sm shadow-2xl w-full max-w-5xl h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 relative border border-slate-200">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-[#dc3545]/10 flex items-center justify-center text-[#dc3545]">
              <TableProperties size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Toplu Koli Yükleme Otomasyonu</h2>
              <p className="text-xs text-slate-500 font-medium">Büyük ölçekli koli listelerini otomatik ayıklayarak sisteme entegre edin.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-sm transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          
          {/* SOL KOLON */}
          <div className="w-full lg:w-5/12 bg-slate-50/50 border-r border-slate-200 p-6 overflow-y-auto">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Info size={16} className="text-[#dc3545]" />
              Kuyruk Filtreleme Kuralları
            </h3>
            
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Sistemimiz 4000+ satırlı büyük listelerde sunucu kilitlenmelerini önlemek amacıyla veriyi <strong>250'şerli alt paketlere</strong> bölerek işler. Sistemde zaten kayıtlı olan koli barkodları otomatik olarak pas geçilir (Eksik Tamamlama Modu).
            </p>

            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden mb-6 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Sütun Başlığı</th>
                    <th className="px-3 py-2">Doğrulama Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-900">Dış Koli Barkodu</td>
                    <td className="px-3 py-2 text-slate-500">Zorunlu</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-900">Koli İçi Ürün Barkodu</td>
                    <td className="px-3 py-2 text-amber-600 font-bold">Otomatik Eşleşme</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-slate-900">Koli İçi Adet</td>
                    <td className="px-3 py-2 text-slate-800">Sayısal (&gt;0)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-sm p-4">
              <button 
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 h-10 bg-white border border-red-200 text-[#dc3545] rounded-sm text-sm font-bold hover:bg-[#dc3545] hover:text-white transition-colors shadow-sm uppercase tracking-wider"
              >
                <Download size={16} />
                Şablon İndir
              </button>
            </div>
          </div>

          {/* SAĞ KOLON */}
          <div className="w-full lg:w-7/12 p-6 flex flex-col bg-white overflow-y-auto">
            
            {errorLog && (
              <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-sm animate-in fade-in">
                <AlertCircle size={20} className="shrink-0 text-[#dc3545] mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Kritik Hata Oluştu</h4>
                  <p className="text-xs font-semibold leading-relaxed">{errorLog}</p>
                </div>
              </div>
            )}

            {successCount !== null && (
              <div className="space-y-4 mb-5 animate-in fade-in">
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-sm shadow-sm">
                  <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
                  <div>
                    <h4 className="font-black text-sm">Aktarım Tamamlandı</h4>
                    <p className="text-xs font-semibold">Tüm veri paketleri tarandı, eksik olan koliler başarıyla yazıldı.</p>
                  </div>
                </div>

                {corruptedRows.length > 0 && (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-amber-50 border border-amber-200 p-4 rounded-sm text-amber-800">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider">Ayıklanan Hata Raporu</h4>
                        <p className="text-xs font-medium mt-0.5">Sistemde karşılığı olmayan veya hatalı <strong className="text-slate-900">{corruptedRows.length} satır</strong> bypass edildi.</p>
                      </div>
                    </div>
                    <button
                      onClick={downloadErrorLogExcel}
                      className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-sm text-xs font-bold transition-all shadow-sm uppercase tracking-wider"
                    >
                      <Download size={14} />
                      Hata Listesini İndir
                    </button>
                  </div>
                )}
              </div>
            )}

            {!successCount && (
              <label 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-sm cursor-pointer transition-all duration-200 ease-in-out group min-h-[280px]
                  ${dragActive 
                    ? "border-[#dc3545] bg-red-50/50 scale-[0.99]" 
                    : "border-slate-300 hover:border-[#dc3545]/50 hover:bg-slate-50"
                  }
                  ${loading ? "bg-slate-50 border-[#dc3545]/40 pointer-events-none" : ""}
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
                  <div className="flex flex-col items-center justify-center p-6 w-full max-w-sm text-center">
                    <div className="relative mb-6 flex items-center justify-center">
                      <Loader2 size={56} className="animate-spin text-[#dc3545]" strokeWidth={3} />
                      <Database size={20} className="absolute text-slate-700 animate-pulse" />
                    </div>
                    <span className="font-black text-slate-800 text-sm uppercase tracking-wider">Toplu İşlem Kuyruğu Devrede</span>
                    
                    <div className="mt-4 px-4 py-2 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-sm border border-slate-800 shadow-inner w-full tracking-wide text-left">
                      <span className="text-slate-500">logistock_wms_engine$</span> {loadingStatus}
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3 animate-pulse">Lütfen pencereyi kapatmayın...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-white shadow-sm border border-slate-200 rounded-sm flex items-center justify-center mb-5 group-hover:scale-105 group-hover:border-red-200 group-hover:shadow-md transition-all">
                      <FileSpreadsheet size={28} className="text-slate-400 group-hover:text-[#dc3545] transition-colors" />
                    </div>
                    <span className="text-slate-800 font-black text-lg mb-1 text-center">
                      Koli Excel Dosyasını Buraya Bırakın
                    </span>
                    <span className="text-slate-500 text-xs font-medium text-center">
                      veya <span className="text-[#dc3545] underline underline-offset-2">cihazınızdan seçin</span> (.xlsx, .xls)
                    </span>
                  </>
                )}
              </label>
            )}

            <div className="mt-auto pt-6 flex items-center justify-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-100">
              <UploadCloud size={12} />
              LogiStock Kuyruk Yönetim Otomasyonu
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}