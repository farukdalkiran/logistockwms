"use client";

import { useEffect, useState, type DragEvent } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import {
  buildCatalogReview,
  catalogWritePayload,
  parseCatalogSheet,
  type CatalogReviewRow,
  type StoredCatalogProduct,
} from "@/lib/catalog-excel-review";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Download, FileSpreadsheet,
  Info, Loader2, PackageCheck, RefreshCw, UploadCloud, X,
} from "lucide-react";

type ImportMode = "update" | "skip";
type ImportResult = {
  inserted: number;
  updated: number;
  ignored: number;
  conflicted: number;
  failures: string[];
};

const FETCH_PAGE_SIZE = 500;
const INSERT_BATCH_SIZE = 100;
const UPDATE_CONCURRENCY = 8;

async function loadCatalog(): Promise<StoredCatalogProduct[]> {
  const items: StoredCatalogProduct[] = [];
  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data, error } = await supabase.from("products")
      .select("id,barcode,sku,name,is_consumable")
      .order("id", { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    items.push(...(data || []));
    if (!data || data.length < FETCH_PAGE_SIZE) break;
  }
  return items;
}

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    {
      "Barkod": "8690000000001",
      "SKU": "PRD-001",
      "Ürün Adı": "Örnek Ticari Ürün",
      "Kategori": "Çanta",
      "Görsel URL": "",
      "Sarf Malzeme mi?": "HAYIR",
      "Max Sipariş Limiti": 50,
    },
    {
      "Barkod": "8690000000002",
      "SKU": "SRF-001",
      "Ürün Adı": "Örnek Sarf Malzemesi",
      "Kategori": "Ambalaj",
      "Görsel URL": "",
      "Sarf Malzeme mi?": "EVET",
      "Max Sipariş Limiti": 20,
    },
  ]);
  ws["!cols"] = [16, 18, 48, 22, 48, 21, 20].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Urun_Sablonu");
  XLSX.writeFile(wb, "LogiStock_Urun_Import_Sablonu.xlsx");
}

export default function ExcelUploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [review, setReview] = useState<CatalogReviewRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const newRows = review?.filter((item) => item.status === "new") || [];
  const existingRows = review?.filter((item) => item.status === "existing") || [];
  const conflictRows = review?.filter((item) => item.status === "conflict") || [];

  useEffect(() => {
    const closeOnEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", closeOnEsc);
    return () => window.removeEventListener("keydown", closeOnEsc);
  }, [loading, onClose]);

  const reset = () => {
    if (loading) return;
    setReview(null);
    setResult(null);
    setFileName("");
    setErrorLog(null);
    setProgress("");
  };

  const analyzeFile = async (file: File) => {
    setLoading(true);
    setReview(null);
    setResult(null);
    setErrorLog(null);
    setFileName(file.name);
    setProgress("Excel dosyası ve katalog karşılaştırılıyor...");
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Lütfen .xlsx veya .xls dosyası seçin.");
      if (file.size > 15 * 1024 * 1024) throw new Error("En fazla 15 MB Excel dosyası yüklenebilir.");

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");

      // raw:false barkod sütunundaki metin formatını ve varsa baştaki sıfırları korur.
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
        raw: false,
      });
      if (!rows.length) throw new Error("Excel dosyası boş.");
      if (rows.length > 20000) throw new Error("Tek seferde en fazla 20.000 satır analiz edilebilir.");
      if (!Object.hasOwn(rows[0], "Barkod") || !Object.hasOwn(rows[0], "Ürün Adı")) {
        throw new Error('Dosyada "Barkod" ve "Ürün Adı" sütunları olmalıdır.');
      }

      const incoming = parseCatalogSheet(rows);
      const stored = await loadCatalog();
      setReview(buildCatalogReview(incoming, stored));
    } catch (error: unknown) {
      setErrorLog(error instanceof Error ? error.message : "Excel dosyası işlenemedi.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const executeImport = async (mode: ImportMode) => {
    if (!review || loading || result) return;
    setLoading(true);
    setErrorLog(null);
    setProgress("Onaylanan kayıtlar işleniyor...");
    const summary: ImportResult = {
      inserted: 0,
      updated: 0,
      ignored: mode === "skip" ? existingRows.length : 0,
      conflicted: conflictRows.length,
      failures: [],
    };

    // İncelemede sorunlu görülen kartlara işlem yapılmaz.
    // Onay verilmeden hiçbir veritabanı yazması yapılmaz.
    try {
      if (mode === "update") {
        for (let from = 0; from < existingRows.length; from += UPDATE_CONCURRENCY) {
          const batch = existingRows.slice(from, from + UPDATE_CONCURRENCY);
          setProgress("Mevcut kartlar güncelleniyor: " + Math.min(from + batch.length, existingRows.length) + "/" + existingRows.length);

          const operations = await Promise.all(batch.map(async (item) => {
            const target = item.existing;
            if (!target) return { success: false, issue: "Satır " + item.incoming.line + ": ürün eşleşmesi yok." };
            try {
              const { data, error } = await supabase.from("products")
                .update(catalogWritePayload(item.incoming, true))
                .eq("id", target.id)
                .eq("barcode", target.barcode)
                .select("id");
              if (error) throw error;
              if (!data?.length) throw new Error("Ürün barkodu başka işlemde değişmiş veya yetki reddedilmiş.");
              return { success: true, issue: "" };
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : "Güncelleme hatası.";
              return { success: false, issue: "Satır " + item.incoming.line + " (" + item.incoming.barcode + "): " + message };
            }
          }));

          for (const operation of operations) {
            if (operation.success) summary.updated += 1;
            else summary.failures.push(operation.issue);
          }
        }
      }

      for (let from = 0; from < newRows.length; from += INSERT_BATCH_SIZE) {
        const batch = newRows.slice(from, from + INSERT_BATCH_SIZE);
        setProgress("Yeni ürünler ekleniyor: " + Math.min(from + batch.length, newRows.length) + "/" + newRows.length);
        const payloads = batch.map((item) => catalogWritePayload(item.incoming, false));
        const { error } = await supabase.from("products").insert(payloads);
        if (!error) {
          summary.inserted += batch.length;
          continue;
        }

        if (error.code !== "23505") {
          summary.failures.push("Satır " + batch[0].incoming.line + " ve sonrası (" + batch.length + " kayıt): " + error.message);
          continue;
        }

        // Onaydan sonra başka bir kullanıcı aynı barkodu eklediyse,
        // yalnızca o satırı atlayıp diğer yeni kartları kaydet.
        for (const item of batch) {
          const { error: rowError } = await supabase.from("products")
            .insert(catalogWritePayload(item.incoming, false));
          if (rowError) {
            summary.failures.push("Satır " + item.incoming.line + " (" + item.incoming.barcode + "): " +
              (rowError.code === "23505" ? "Bu kayıt artık mevcut, atlandı." : rowError.message));
          } else {
            summary.inserted += 1;
          }
        }
      }

      setResult(summary);
      if (summary.inserted || summary.updated) onSuccess();
    } catch (error: unknown) {
      setResult(summary);
      setErrorLog(error instanceof Error ? error.message : "Beklenmeyen kayıt hatası.");
      if (summary.inserted || summary.updated) onSuccess();
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleDrag = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !loading) void analyzeFile(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog" aria-modal="true" aria-labelledby="product-excel-title">
      <div className="flex h-[94vh] max-h-[850px] w-full max-w-5xl flex-col overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-red-50 text-[#dc3545]">
              <FileSpreadsheet size={21} />
            </div>
            <div>
              <h2 id="product-excel-title" className="text-base font-bold text-slate-900 md:text-lg">Excel ile Ürün Kataloğu Aktarımı</h2>
              <p className="mt-1 text-xs text-slate-500">Önce kontrol, sonra onay. Mevcut stok kayıtları korunur.</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} aria-label="Pencereyi kapat"
            className="rounded-[5px] p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40"><X size={20} /></button>
        </header>

        <div className="grid flex-1 min-h-0 grid-cols-1 overflow-y-auto lg:grid-cols-[290px_1fr] lg:overflow-hidden">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700"><Info size={16} /> Aktarım kuralları</p>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">Excel dosyasının ilk satırında <strong>Barkod</strong> ve <strong>Ürün Adı</strong> sütunları bulunmalıdır. SKU, kategori, görsel URL ve sipariş limiti isteğe bağlıdır.</p>
            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <div className="rounded-[5px] border border-slate-200 bg-white p-3">
                <p className="font-bold">Mevcutları Güncelle</p>
                <p className="mt-1 text-slate-500">Eşleşen kartın bilgileri güncellenir. Boş Excel hücreleri mevcut değeri silmez. Birincil barkod, stok ve sipariş geçmişi değiştirilmez.</p>
              </div>
              <div className="rounded-[5px] border border-slate-200 bg-white p-3">
                <p className="font-bold">Mevcutları Yoksay</p>
                <p className="mt-1 text-slate-500">Tanımlı kartlara dokunulmaz. Sadece yeni barkodlu ürünler eklenir.</p>
              </div>
              <div className="rounded-[5px] border border-amber-200 bg-amber-50 p-3">
                <p className="font-bold text-amber-900">Çelişkili eşleşmeler</p>
                <p className="mt-1 text-amber-800">Barkod ve SKU farklı ürünlere aitse o satır güvenlik için otomatik güncellenmez.</p>
              </div>
            </div>
            <button type="button" onClick={downloadTemplate}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[5px] border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
              <Download size={16} /> Örnek Excel Şablonunu İndir
            </button>
          </aside>

          <main className="flex min-h-[350px] flex-col gap-4 p-5 lg:overflow-y-auto">
            {errorLog && (
              <div className="flex items-start gap-2 rounded-[5px] border border-red-200 bg-red-50 p-3 text-xs text-red-800" role="alert">
                <AlertCircle size={17} className="shrink-0" /><span>{errorLog}</span>
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 rounded-[5px] border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700" role="status">
                <Loader2 size={16} className="animate-spin text-[#dc3545]" /> {progress}
              </div>
            )}

            {!review && (
              <label onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                className={"flex min-h-[300px] flex-1 cursor-pointer flex-col items-center justify-center rounded-[5px] border-2 border-dashed p-6 text-center transition-colors " +
                  (dragActive ? "border-red-500 bg-red-50" : "border-slate-300 bg-slate-50/50 hover:border-red-400") +
                  (loading ? " pointer-events-none opacity-50" : "")}>
                <input type="file" accept=".xlsx,.xls" className="hidden" disabled={loading}
                  onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeFile(file); event.target.value = ""; }} />
                <UploadCloud size={40} className="mb-3 text-slate-400" />
                <p className="text-base font-bold text-slate-800">Excel dosyasını sürükleyin veya seçin</p>
                <p className="mt-2 text-xs text-slate-500">.xlsx / .xls, en fazla 15 MB. Ön izlemeden önce kayıt yapılmaz.</p>
              </label>
            )}

            {review && !result && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Kayıt Ön İncelemesi</h3>
                    <p className="mt-1 max-w-md truncate text-xs text-slate-500" title={fileName}>{fileName}</p>
                  </div>
                  <button type="button" disabled={loading} onClick={reset}
                    className="flex items-center gap-1 rounded-[5px] border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    <RefreshCw size={14} /> Başka Dosya Seç
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-[5px] border border-slate-200 bg-white p-3"><p className="text-[11px] text-slate-500">Toplam satır</p><p className="mt-1 text-xl font-bold text-slate-900">{review.length}</p></div>
                  <div className="rounded-[5px] border border-emerald-200 bg-emerald-50 p-3"><p className="text-[11px] text-emerald-700">Yeni ürün</p><p className="mt-1 text-xl font-bold text-emerald-800">{newRows.length}</p></div>
                  <div className="rounded-[5px] border border-amber-200 bg-amber-50 p-3"><p className="text-[11px] text-amber-800">Mevcut ürün</p><p className="mt-1 text-xl font-bold text-amber-900">{existingRows.length}</p></div>
                  <div className="rounded-[5px] border border-red-200 bg-red-50 p-3"><p className="text-[11px] text-red-700">Kontrol gerekli</p><p className="mt-1 text-xl font-bold text-red-800">{conflictRows.length}</p></div>
                </div>

                {existingRows.length > 0 && (
                  <div className="rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <div className="flex items-start gap-2"><AlertTriangle size={17} className="shrink-0" />
                      <p><strong>{existingRows.length} ürün zaten veritabanında mevcut.</strong> Bunları güncellemek veya yoksaymak için aşağıdaki butonlardan birini seçin. Yeni ürünler her iki seçenekle de eklenecektir.</p>
                    </div>
                  </div>
                )}

                {existingRows.length > 0 && (
                  <section>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Eşleşen ürünler</h4>
                    <div className="max-h-48 overflow-auto rounded-[5px] border border-slate-200">
                      <table className="w-full min-w-[460px] text-left text-xs">
                        <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-2">Satır</th><th className="p-2">Ürün</th><th className="p-2">Eşleşme</th><th className="p-2">Uyarı</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {existingRows.slice(0, 100).map((item) => (
                            <tr key={item.incoming.line}>
                              <td className="p-2">{item.incoming.line}</td>
                              <td className="p-2"><p className="max-w-60 truncate font-semibold" title={item.existing?.name}>{item.existing?.name}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{item.existing?.barcode}</p></td>
                              <td className="p-2">{item.matchedOn?.join(", ")}</td>
                              <td className="p-2 text-amber-700">{item.reason || "Güncellenebilir"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {existingRows.length > 100 && <p className="mt-1 text-[11px] text-slate-500">İlk 100 eşleşme gösteriliyor.</p>}
                  </section>
                )}

                {conflictRows.length > 0 && (
                  <section>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-red-800"><AlertCircle size={15} /> İşlem yapılmayacak çelişkili satırlar ({conflictRows.length})</h4>
                    <div className="max-h-36 overflow-auto rounded-[5px] border border-red-200">
                      {conflictRows.slice(0, 60).map((item) => (
                        <div key={item.incoming.line} className="border-b border-red-100 p-2 text-xs last:border-b-0">
                          <span className="font-semibold">Satır {item.incoming.line} - {item.incoming.barcode || "Barkod yok"}</span>
                          <span className="ml-2 text-red-700">{item.reason}</span>
                        </div>
                      ))}
                    </div>
                    {conflictRows.length > 60 && <p className="mt-1 text-[11px] text-slate-500">İlk 60 sorun gösteriliyor.</p>}
                  </section>
                )}

                <div className="mt-auto rounded-[5px] border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-3 text-xs text-slate-600">Onay verilene kadar dosyadaki hiçbir ürün oluşturulmaz veya güncellenmez.</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {existingRows.length > 0 && (
                      <button type="button" disabled={loading} onClick={() => void executeImport("update")}
                        className="flex flex-1 items-center justify-center gap-2 rounded-[5px] bg-[#dc3545] px-4 py-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">
                        <PackageCheck size={16} /> Mevcutları Güncelle + Yenileri Ekle
                      </button>
                    )}
                    <button type="button" disabled={loading || (!newRows.length && !existingRows.length)}
                      onClick={() => void executeImport("skip")}
                      className="flex flex-1 items-center justify-center gap-2 rounded-[5px] border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                      {existingRows.length ? "Mevcutları Yoksay + Yenileri Ekle" : "Yeni Ürünleri Ekle"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {result && (
              <div className="flex flex-col gap-4 rounded-[5px] border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-3 text-emerald-800">
                  <CheckCircle2 size={26} /><h3 className="text-base font-bold">Aktarım Tamamlandı</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <p className="rounded-[5px] bg-white p-3 text-slate-700">Yeni eklenen <strong className="block text-xl text-emerald-800">{result.inserted}</strong></p>
                  <p className="rounded-[5px] bg-white p-3 text-slate-700">Güncellenen <strong className="block text-xl text-emerald-800">{result.updated}</strong></p>
                  <p className="rounded-[5px] bg-white p-3 text-slate-700">Yoksayılan <strong className="block text-xl text-slate-800">{result.ignored}</strong></p>
                  <p className="rounded-[5px] bg-white p-3 text-slate-700">Çelişkili <strong className="block text-xl text-red-700">{result.conflicted}</strong></p>
                </div>
                {result.failures.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-[5px] border border-amber-300 bg-white p-3 text-xs text-amber-900">
                    <p className="font-bold">{result.failures.length} kayıt işlenemedi</p>
                    {result.failures.slice(0, 50).map((issue, index) => <p className="mt-1" key={index}>{issue}</p>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={reset} className="rounded-[5px] border border-emerald-300 bg-white px-4 py-2.5 text-xs font-bold text-emerald-900">Yeni Dosya Seç</button>
                  <button type="button" onClick={onClose} className="rounded-[5px] bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">Kapat</button>
                </div>
              </div>
            )}
          </main>
        </div>
        <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-100 px-4 py-2 text-[10px] font-semibold text-slate-400">
          <UploadCloud size={13} /> LogiStock WMS / Ürün veri aktarımı
        </footer>
      </div>
    </div>
  );
}
