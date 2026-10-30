"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { uploadArasExcelToServer } from "@/app/actions/excel-upload";
import { FileSpreadsheet, X, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";

interface ExcelUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
}

export default function ExcelUploadDrawer({ isOpen, onClose, employeeId }: ExcelUploadDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string>(""); // YENİ: Dosya/Profil Adı State'i
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    
    // Dosya adını uzantıdan (.xlsx, .csv) temizleyerek otomatik State'e yaz
    const rawName = file.name.replace(/\.[^/.]+$/, "");
    setFileName(rawName);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (jsonData.length === 0) {
          setMessage({ text: "Excel dosyası boş veya okunamadı.", type: "error" });
          return;
        }
        
        setFileData(jsonData);
        setMessage({ text: `${jsonData.length} satır veri başarıyla okundu.`, type: "success" });
      } catch (err) {
        setMessage({ text: "Dosya formatı desteklenmiyor veya hatalı.", type: "error" });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async () => {
    if (!fileData || !fileName.trim()) {
      setMessage({ text: "Lütfen bir dosya seçin ve profil adını girin.", type: "error" });
      return;
    }
    
    setLoading(true);
    setMessage(null);

    try {
      // WMS Kuralı: Next.js serileştirme hatasını aşmak için Deep Clone
      const plainData = JSON.parse(JSON.stringify(fileData));
      
      // DİKKAT: Backend'e artık fileName parametresi de gönderiliyor
      const result = await uploadArasExcelToServer(plainData, employeeId, fileName.trim().toUpperCase());

      if (result.success) {
        setMessage({ text: `${result.count} adet sipariş "${fileName.toUpperCase()}" profiliyle aktarıldı.`, type: "success" });
        setTimeout(() => {
          handleReset();
          onClose();
        }, 2000);
      } else {
        setMessage({ text: result.error || "Bilinmeyen bir hata oluştu.", type: "error" });
      }
    } catch (error) {
      setMessage({ text: "Veri gönderilirken beklenmeyen bir hata oluştu.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFileData(null);
    setFileName("");
    setMessage(null);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[8990] bg-slate-950/65 backdrop-blur-[2px]"
          onClick={loading ? undefined : onClose}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        aria-labelledby="excel-upload-title"
        className={`fixed inset-y-0 right-0 z-[9000] flex w-full max-w-[540px] flex-col border-l border-emerald-300 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-emerald-800 bg-emerald-950 px-5 py-5 text-white sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="shrink-0 rounded-[5px] border border-emerald-300/25 bg-white/10 p-2.5">
              <FileSpreadsheet className="h-6 w-6 text-emerald-200" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Excel ve Profil Yönetim Merkezi</p>
              <h2 id="excel-upload-title" className="mt-1 text-xl font-bold leading-snug">Yeni Dosya Yükle</h2>
              <p className="mt-1 text-sm leading-5 text-emerald-100">Excel / CSV dosyasını okuyup yeni bir gönderi profili oluşturun.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Excel yükleme panelini kapat"
            onClick={onClose}
            disabled={loading}
            className="shrink-0 rounded-[5px] border border-white/20 p-2 text-emerald-50 transition hover:bg-white/15 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {message && (
            <div
              role={message.type === "error" ? "alert" : "status"}
              className={`flex items-start gap-2 rounded-[5px] border p-3 text-sm leading-6 ${message.type === "error" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}
            >
              {message.type === "error" ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <section className="rounded-[6px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-[4px] bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">01</span>
              <h3 className="text-base font-bold text-slate-900">Excel / CSV dosyası seçin</h3>
            </div>
            <p className="mb-4 text-sm leading-6 text-slate-600">
              Aras ERP gönderi şablonunu yükleyin. Dosyadaki ilk sayfa okunur ve satır sayısı kontrol edilir.
            </p>
            {!fileData ? (
              <label className="relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[5px] border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-5 text-center transition hover:border-emerald-600 hover:bg-emerald-50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed"
                  aria-label="Excel veya CSV dosyası seç"
                />
                <UploadCloud className="h-8 w-8 text-emerald-700" />
                <span className="mt-3 text-sm font-bold text-emerald-900">Dosyayı seçmek için tıklayın</span>
                <span className="mt-1 text-xs text-slate-600">XLSX, XLS veya CSV biçimleri desteklenir</span>
              </label>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-emerald-300 bg-emerald-50 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">{fileData.length.toLocaleString("tr-TR")} satır okundu</p>
                    <p className="mt-1 break-all text-xs text-emerald-800">{fileName}</p>
                  </div>
                </div>
                <button type="button" onClick={handleReset} disabled={loading} className="min-h-9 rounded-[4px] border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50">
                  Dosyayı Değiştir
                </button>
              </div>
            )}
          </section>

          <section className="rounded-[6px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-[4px] bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">02</span>
              <h3 className="text-base font-bold text-slate-900">Profil adını belirleyin</h3>
            </div>
            <p className="mb-3 text-sm leading-6 text-slate-600">
              Bu ad daha sonra kargo gönderilerini seçerken kullanılacak. Dosya adından otomatik doldurulur.
            </p>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="aras-upload-profile-name">Profil adı</label>
            <input
              id="aras-upload-profile-name"
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              disabled={!fileData || loading}
              placeholder="Örn. EKİM SEVKİYAT LİSTESİ"
              autoComplete="off"
              className="h-12 w-full rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
            />
          </section>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <p className="mb-3 text-xs leading-5 text-slate-500">
            Aktarma işlemi, seçilen gönderileri yeni profil altında kaydeder.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!fileData || !fileName.trim() || loading}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[5px] bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {loading ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" /> Dosya aktarılıyor...</>
            ) : (
              <><UploadCloud className="h-5 w-5" /> Dosyayı Sisteme Aktar</>
            )}
          </button>
        </footer>
      </div>
    </>
  );
}
