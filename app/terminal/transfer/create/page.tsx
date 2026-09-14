"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  TerminalSquare,
  Layers,
  Hash,
  MapPin,
  CalendarClock,
  UserCircle,
  Building2,
  Info,
  QrCode,
  ArrowRightLeft
} from "lucide-react";

type Branch = {
  id: string;
  name: string;
  type: string;
};

type ExtractedItem = {
  id: string;
  barcode: string;
  quantity: number;
  productId?: string;
  productName?: string;
  sku?: string;
  isValid?: boolean;
};

export default function ExcelTransferCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Oturum verileri
  const empId = searchParams.get("empId") || "BİLİNMİYOR";
  const empName = searchParams.get("empName") || "Personel";
  const sessionBranchName = searchParams.get("branch") || "Şube Terminali";

  // State Yönetimi
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fromBranchId, setFromBranchId] = useState<string>("");
  const [toBranchId, setToBranchId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>("LGS-XXXX");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newBarcode, setNewBarcode] = useState("");
  const [newQty, setNewQty] = useState("");

  // Sayfalama (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Başlangıç verileri
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: branchData } = await supabase
          .from("branches")
          .select("id, name, type")
          .order("name");

        if (branchData) setBranches(branchData);

        const { data: empData } = await supabase
          .from("employees")
          .select("branch_id")
          .eq("id", empId)
          .single();

        if (empData?.branch_id) {
          setFromBranchId(empData.branch_id);
        }
      } catch (error) {
        console.error("Başlangıç verileri çekilemedi:", error);
      }
    };
    fetchInitialData();
  }, [empId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
    e.target.value = "";
  };

  // --- LGS KODU ÖNİZLEME ÜRETİCİSİ ---
  const generateNextLgsCodePreview = async () => {
    try {
      const { data: lastTransfer } = await supabase
        .from("transfers")
        .select("transfer_code")
        .like("transfer_code", "LGS%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1001;
      if (lastTransfer?.transfer_code) {
        const numPart = lastTransfer.transfer_code.replace("LGS", "");
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed)) {
          nextNumber = parsed + 1;
        }
      }
      setGeneratedCode(`LGS${nextNumber}`);
    } catch (error) {
      console.error("Kod üretim hatası:", error);
    }
  };

  // --- EXCEL İŞLEME VE VERİTABANI ÇAPRAZ KONTROLÜ ---
  const processExcelFile = async () => {
    if (!file) return alert("Lütfen bir excel dosyası seçin.");
    if (!fromBranchId) return alert("Lütfen çıkış şubesini seçin.");
    if (!toBranchId) return alert("Lütfen varış şubesini seçin.");
    if (fromBranchId === toBranchId) return alert("Çıkış ve varış şubesi aynı olamaz!");

    setIsProcessing(true);
    await generateNextLgsCodePreview();
    setCurrentPage(1);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

      if (rows.length < 2) throw new Error("Yüklenen Excel dosyası boş veya okunamadı.");

      let barcodeIdx = -1;
      let qtyIdx = -1;
      let startRow = -1;

      for (let i = 0; i < Math.min(20, rows.length); i++) {
        const rowHeaders = rows[i].map(h => String(h).trim().toLowerCase());
        
        let bIdx = rowHeaders.indexOf("barkod");
        if (bIdx === -1) bIdx = rowHeaders.indexOf("barcode");
        
        let qIdx = rowHeaders.indexOf("net adet");
        if (qIdx === -1) qIdx = rowHeaders.indexOf("miktar");
        if (qIdx === -1) qIdx = rowHeaders.indexOf("adet");

        if (bIdx !== -1 && qIdx !== -1) {
          barcodeIdx = bIdx;
          qtyIdx = qIdx;
          startRow = i + 1;
          break;
        }
      }

      if (startRow === -1) {
        throw new Error("Lütfen Excel'de tam olarak 'Barkod' ve 'Net Adet' sütunlarının var olduğundan emin olun.");
      }

      const aggregatedMap = new Map<string, number>();

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        const rawBarcode = row[barcodeIdx];
        const rawQty = row[qtyIdx];

        if (rawBarcode !== undefined && rawBarcode !== null && String(rawBarcode).trim() !== "") {
          let barcode = String(rawBarcode).trim();
          
          if (barcode.includes('e+') || barcode.includes('E+')) {
             barcode = Number(rawBarcode).toLocaleString('fullwide', {useGrouping: false});
          }

          let quantity = 0;
          if (typeof rawQty === "number") {
            quantity = rawQty;
          } else if (typeof rawQty === "string") {
            const parsed = parseInt(rawQty.replace(/[^0-9]/g, ""), 10);
            if (!isNaN(parsed)) quantity = parsed;
          }

          if (barcode && quantity > 0) {
            aggregatedMap.set(barcode, (aggregatedMap.get(barcode) || 0) + quantity);
          }
        }
      }

      const uniqueBarcodes = Array.from(aggregatedMap.keys());
      if (uniqueBarcodes.length === 0) throw new Error("Sistem geçerli barkod veya miktar verisi tespit edemedi.");

      const CHUNK_SIZE = 20; 
      let allProductsData: any[] = [];
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
      
      for (let i = 0; i < uniqueBarcodes.length; i += CHUNK_SIZE) {
        const chunk = uniqueBarcodes.slice(i, i + CHUNK_SIZE);
        const { data: dbChunk, error: dbError } = await supabase
          .from("products")
          .select("id, barcode, sku, name")
          .in("barcode", chunk);
        
        if (dbError) throw dbError;
        if (dbChunk) allProductsData = [...allProductsData, ...dbChunk];
        
        await delay(50);
      }

      const validated = Array.from(aggregatedMap.entries()).map(([barcode, quantity]) => {
        const dbMatch = allProductsData.find((p) => p.barcode === barcode);
        if (dbMatch) {
          return {
            id: Math.random().toString(36).substring(7),
            barcode: barcode,
            quantity: quantity,
            productId: dbMatch.id,
            productName: dbMatch.name,
            sku: dbMatch.sku,
            isValid: true,
          };
        }
        return {
          id: Math.random().toString(36).substring(7),
          barcode: barcode,
          quantity: quantity,
          productName: "SİSTEMDE BULUNAMADI",
          isValid: false,
        };
      });

      setExtractedItems(validated);
      setIsReviewOpen(true);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Excel işlenirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItemQty = (id: string, newQty: string) => {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty < 0) return;
    setExtractedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item)),
    );
  };

  const removeItem = (id: string) => {
    setExtractedItems((prev) => {
      const newList = prev.filter((item) => item.id !== id);
      const totalPages = Math.ceil(newList.length / itemsPerPage);
      if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
      return newList;
    });
  };

  const handleManualAdd = async () => {
    if (!newBarcode || !newQty) return;
    const qty = parseInt(newQty, 10);
    const cleanBarcode = newBarcode.trim();

    const { data: productData } = await supabase
      .from("products")
      .select("id, sku, barcode, name")
      .eq("barcode", cleanBarcode)
      .maybeSingle();

    setExtractedItems((prev) => [
      {
        id: Math.random().toString(36).substring(7),
        barcode: cleanBarcode,
        sku: productData?.sku,
        quantity: qty,
        productId: productData?.id,
        productName: productData?.name || "MANUEL GİRİŞ (SİSTEMDE YOK)",
        isValid: !!productData,
      },
      ...prev,
    ]);
    setNewBarcode("");
    setNewQty("");
    setCurrentPage(1); 
  };

  // --- NİHAİ KAYIT (LGS CODE & TRANSFER) ---
  const saveToDatabase = async () => {
    const validItems = extractedItems.filter(
      (i) => i.isValid && i.quantity > 0 && i.productId,
    );
    if (validItems.length === 0)
      return alert("Sisteme kaydedilecek geçerli ürün bulunamadı!");

    setIsSaving(true);
    try {
      const { data: lastTransfer } = await supabase
        .from("transfers")
        .select("transfer_code")
        .like("transfer_code", "LGS%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let finalNumber = 1001;
      if (lastTransfer?.transfer_code) {
        const numPart = lastTransfer.transfer_code.replace("LGS", "");
        finalNumber = (parseInt(numPart, 10) || 1000) + 1;
      }
      const finalTransferCode = `LGS${finalNumber}`;

      const { data: transferRecord, error: txError } = await supabase
        .from("transfers")
        .insert({
          transfer_code: finalTransferCode,
          status: "Bekliyor",
          from_branch_id: fromBranchId,
          to_branch_id: toBranchId,
          picker_employee_id: empId,
        })
        .select("id")
        .single();

      if (txError) throw txError;

      const itemsToInsert = validItems.map((item) => ({
        transfer_id: transferRecord.id,
        product_id: item.productId,
        requested_qty: item.quantity,
        approved_qty: item.quantity,
        sent_qty: 0,
        received_qty: 0,
        status: "Bekliyor",
      }));

      const { error: itemsError } = await supabase
        .from("transfer_items")
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;

      await supabase.from("transaction_logs").insert({
        employee_id: empId,
        branch_id: fromBranchId,
        action_type: "EXCEL_TRANSFER_CREATED",
        description: `${finalTransferCode} numaralı sevkiyat/sayım listesi Excel ile oluşturuldu.`,
        new_value: `${validItems.length} Çeşit (SKU)`,
      });

      alert(`BAŞARILI! ${finalTransferCode} kodlu sevkiyat/sayım fişi oluşturuldu.`);
      router.push(
        `/terminal/menu?empId=${empId}&empName=${encodeURIComponent(empName)}&branch=${encodeURIComponent(sessionBranchName)}`,
      );
    } catch (error: any) {
      console.error(error);
      alert(`Kayıt Hatası: ${error.message || "Veritabanına ulaşılamadı."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const validSKUCount = extractedItems.filter((i) => i.isValid).length;
  const totalQuantity = extractedItems
    .filter((i) => i.isValid)
    .reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  const fromBranchObj = branches.find((b) => b.id === fromBranchId);
  const toBranchObj = branches.find((b) => b.id === toBranchId);

  // Sayfalama (Pagination) Veri Hesaplaması
  const totalPages = Math.ceil(extractedItems.length / itemsPerPage);
  const paginatedItems = extractedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] select-none flex flex-col">
      <input
        type="file"
        accept=".xlsx, .xls"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {/* --- DARK HEADING KOKPİT --- */}
      <div className="bg-[#0f172b] flex flex-col shrink-0 shadow-md border-b-4 border-[#dc3545]">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/50">
          <button
            onClick={() => router.back()}
            className="text-slate-300 hover:text-white transition-colors active:scale-95 p-1 bg-slate-800/50 rounded-sm"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-2">
            <TerminalSquare size={20} className="text-[#dc3545]" />
            <span className="text-white text-[14px] md:text-[16px] font-black uppercase tracking-widest">
              Excel Sayım & Transfer
            </span>
          </div>
          <div className="w-8" />
        </div>

        <div className="bg-slate-900 py-2.5 px-6 flex justify-between items-center text-[11px] md:text-[12px] font-bold uppercase tracking-widest">
          <span className="text-slate-300 flex items-center gap-1.5 truncate">
            <UserCircle size={15} className="shrink-0 text-[#dc3545]" /> {empName}{" "}
            <span className="text-slate-500">({empId})</span>
          </span>
          <span className="text-slate-300 flex items-center gap-1.5 truncate">
            <MapPin size={15} className="shrink-0 text-[#dc3545]" /> {sessionBranchName}
          </span>
        </div>
      </div>

      {/* --- ANA YÜKLEME PANELİ (MASAÜSTÜ ODAKLI) --- */}
      <div className="flex-1 p-4 lg:p-8 w-full max-w-7xl mx-auto flex flex-col gap-6">
        {/* Bilgi Kartları (Readouts) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border-l-4 border-slate-800 p-4 rounded-sm shadow-sm flex items-start gap-4">
            <div className="bg-slate-100 p-2 rounded-sm text-slate-800 shrink-0">
              <Info size={24} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                İşlem Tipi
              </h4>
              <p className="text-[14px] font-bold text-slate-700 mt-1 truncate">
                Toplu Envanter Hareketi
              </p>
            </div>
          </div>
          <div className="bg-white border-l-4 border-slate-800 p-4 rounded-sm shadow-sm flex items-start gap-4">
            <div className="bg-slate-100 p-2 rounded-sm text-slate-800 shrink-0">
              <CalendarClock size={24} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Sistem Tarihi
              </h4>
              <p className="text-[14px] font-bold text-slate-700 mt-1 truncate">
                {new Date().toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="bg-white border-l-4 border-[#dc3545] p-4 rounded-sm shadow-sm flex items-start gap-4">
            <div className="bg-red-50 p-2 rounded-sm text-[#dc3545] shrink-0">
              <Building2 size={24} />
            </div>
            <div className="min-w-0">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Aktif Sistem
              </h4>
              <p className="text-[14px] font-bold text-slate-700 mt-1 truncate">
                LogiStock WMS
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* SOL KOLON: Şube Seçimi ve Dosya Yükleme */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">
            <div className="bg-white p-6 border border-slate-200 rounded-sm shadow-sm flex flex-col gap-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <ArrowRightLeft className="text-[#dc3545]" size={20} />
                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-widest">
                  Rota ve Lokasyon Belirleme
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gönderen Şube */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    Çıkış Şubesi (Kaynak)
                  </label>
                  <select
                    value={fromBranchId}
                    onChange={(e) => setFromBranchId(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 text-[14px] font-bold p-3 rounded-sm focus:outline-none focus:border-[#dc3545] focus:ring-4 focus:ring-red-50 transition-all min-h-[48px]"
                  >
                    <option value="" disabled>Şube Seçiniz...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Alıcı Şube */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    Varış Şubesi (Hedef)
                  </label>
                  <select
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 text-slate-800 text-[14px] font-bold p-3 rounded-sm focus:outline-none focus:border-[#dc3545] focus:ring-4 focus:ring-red-50 transition-all min-h-[48px]"
                  >
                    <option value="" disabled>Şube Seçiniz...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-44 bg-slate-50 border-2 border-dashed border-slate-300 rounded-sm flex flex-col items-center justify-center gap-4 text-slate-500 hover:border-[#dc3545] hover:text-[#dc3545] hover:bg-red-50 transition-all active:scale-[0.98] shadow-sm group"
            >
              <div className="p-4 rounded-full bg-white shadow-sm border border-slate-200 group-hover:border-red-200 group-hover:bg-red-100 transition-colors">
                <FileSpreadsheet size={32} strokeWidth={2} />
              </div>
              <div className="text-center">
                <span className="block text-[15px] font-black uppercase tracking-wider mb-1 text-slate-700 group-hover:text-[#dc3545]">
                  Excel Şablonunu Yükle (.xlsx)
                </span>
                <span className="block text-[12px] font-bold tracking-widest text-slate-400">
                  Gerekli Sütunlar: "Barkod" ve "Net Adet"
                </span>
              </div>
            </button>

            {file && (
              <div className="w-full bg-[#0f172b] p-4 rounded-sm flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3 overflow-hidden text-white">
                  <div className="bg-red-500/20 p-2 rounded-sm">
                    <FileSpreadsheet size={24} className="text-[#dc3545] shrink-0" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold truncate">{file.name}</span>
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-slate-400 hover:text-white hover:bg-[#dc3545] p-2.5 active:scale-90 transition-all bg-slate-800 rounded-sm flex items-center justify-center"
                >
                  <Trash2 size={18} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>

          {/* SAĞ KOLON: Aksiyon ve Kurallar */}
          <div className="w-full lg:w-96 flex flex-col gap-5 justify-between shrink-0">
            <div className="bg-white p-6 border border-slate-200 rounded-sm shadow-sm flex flex-col gap-5 flex-1">
              <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-3">
                Sistem İşleyiş Kuralları
              </h3>
              <ul className="text-[13px] font-bold text-slate-500 flex flex-col gap-5 leading-relaxed">
                <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#dc3545] mt-1.5 shrink-0" />
                  Sadece sisteme kayıtlı olan güncel şubeler arasında transfer planlanabilir.
                </li>
                <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#dc3545] mt-1.5 shrink-0" />
                  Yüklenen dosyadaki barkodlar ana ürün veritabanı ile eşleştirilir; sistemde olmayan ürünler hata logu üretir.
                </li>
                <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#dc3545] mt-1.5 shrink-0" />
                  İşlem sonunda açılacak onay ekranında miktarları revize edebilir veya ek barkod okutabilirsiniz.
                </li>
              </ul>
            </div>

            <button
              onClick={processExcelFile}
              disabled={!file || isProcessing}
              className={`w-full py-5 rounded-sm font-black text-[15px] uppercase tracking-widest shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                !file
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-[#0f172b] text-white hover:bg-slate-800"
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  VERİLER İŞLENİYOR
                </>
              ) : (
                <>İLERİ: ONAY EKRANI</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- ONAY VE DÜZENLEME EKRANI (FULL SCREEN MODAL) --- */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col font-['Quicksand'] animate-in fade-in duration-200">
          <div className="bg-[#0f172b] p-4 flex items-center justify-between border-b-4 border-[#dc3545] shadow-md shrink-0">
            <button
              onClick={() => setIsReviewOpen(false)}
              className="text-slate-400 hover:text-white p-2 transition-colors bg-slate-800 rounded-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col items-center min-w-0 mx-4">
              <h2 className="text-white text-[15px] md:text-[18px] font-black uppercase tracking-widest truncate">
                Tablo Onay & Eşleştirme
              </h2>
              <span className="text-emerald-400 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase mt-0.5 truncate">
                Eşleşen: {validSKUCount} | Hatalı: {extractedItems.length - validSKUCount}
              </span>
            </div>
            <div className="w-11 shrink-0" />
          </div>

          <div className="bg-white border-b border-slate-300 p-4 md:p-6 grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 shrink-0 shadow-sm text-[11px] sm:text-[12px] font-bold uppercase tracking-widest">
            <div className="flex flex-col gap-1.5 border-r border-slate-200 pr-2 sm:pr-4 min-w-0">
              <span className="text-slate-400 flex items-center gap-1">
                <Hash size={14} className="shrink-0" /> Transfer Kodu
              </span>
              <span className="text-[15px] sm:text-[18px] font-black text-[#dc3545] truncate">
                {generatedCode}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 lg:border-r border-slate-200 pr-2 sm:pr-4 min-w-0">
              <span className="text-slate-400 truncate">Çıkış Şubesi</span>
              <span className="text-[13px] sm:text-[14px] font-black text-slate-800 truncate" title={fromBranchObj?.name}>
                {fromBranchObj?.name || "-"}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 border-r border-slate-200 pr-2 sm:pr-4 min-w-0">
              <span className="text-slate-400 truncate">Varış Şubesi</span>
              <span className="text-[13px] sm:text-[14px] font-black text-slate-800 truncate" title={toBranchObj?.name}>
                {toBranchObj?.name || "-"}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 lg:border-r border-slate-200 pr-2 sm:pr-4 min-w-0">
              <span className="text-slate-400 truncate">Oluşturan</span>
              <span className="text-[13px] sm:text-[14px] font-black text-slate-800 truncate">
                {empName}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 min-w-0 col-span-2 lg:col-span-1 pt-2 border-t border-slate-200 lg:border-t-0 lg:pt-0">
              <span className="text-slate-400 flex items-center gap-1">
                <Layers size={14} className="shrink-0" /> Toplam Adet
              </span>
              <span className="text-[16px] sm:text-[18px] font-black text-slate-800 truncate">
                {totalQuantity} <span className="text-[12px] text-slate-400">ADET</span>
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-8 w-full max-w-7xl mx-auto flex flex-col gap-5">
            <div className="bg-white border border-slate-200 rounded-sm p-4 shadow-sm flex flex-col md:flex-row gap-4 shrink-0 items-end">
              <div className="flex-1 w-full flex flex-col gap-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  Manuel Barkod Ekle
                </label>
                <div className="relative">
                  <QrCode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Barkodu okutun veya yazın..."
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 text-[14px] font-bold p-3.5 pl-10 rounded-sm focus:outline-none focus:border-[#dc3545] focus:ring-4 focus:ring-red-50 transition-all min-h-[52px]"
                  />
                </div>
              </div>
              <div className="w-full md:w-32 flex flex-col gap-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  Adet
                </label>
                <input
                  type="number"
                  placeholder="Miktar"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 text-[14px] font-bold p-3.5 text-center rounded-sm focus:outline-none focus:border-[#dc3545] focus:ring-4 focus:ring-red-50 transition-all min-h-[52px]"
                />
              </div>
              <button
                onClick={handleManualAdd}
                className="w-full md:w-auto h-[52px] px-8 bg-slate-800 text-white rounded-sm active:scale-95 font-black text-[13px] tracking-widest uppercase flex items-center justify-center gap-2 hover:bg-[#dc3545] transition-colors"
              >
                <Plus size={18} strokeWidth={3} /> EKLE
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
                  <thead className="bg-[#0f172b] border-b border-slate-300 text-[11px] font-black text-white uppercase tracking-widest">
                    <tr>
                      <th className="p-4 w-16 text-center">Durum</th>
                      <th className="p-4 w-48">SKU / Barkod</th>
                      <th className="p-4 w-auto">Ürün Adı</th>
                      <th className="p-4 w-32 text-center">Net Adet</th>
                      <th className="p-4 w-20 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[13px] font-bold text-slate-700">
                    {paginatedItems.map((item) => (
                      <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${!item.isValid ? "bg-red-50/40" : ""}`}>
                        <td className="p-4 text-center align-middle">
                          {item.isValid ? (
                            <CheckCircle size={20} className="text-emerald-500 mx-auto" />
                          ) : (
                            <AlertTriangle size={20} className="text-[#dc3545] mx-auto" />
                          )}
                        </td>
                        <td className="p-4 align-middle overflow-hidden">
                          <div className={`font-black text-[14px] truncate ${!item.isValid ? "text-[#dc3545]" : "text-slate-800"}`} title={item.barcode}>
                            {item.barcode}
                          </div>
                          {item.sku && (
                            <div className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-1 truncate" title={item.sku}>
                              SKU: {item.sku}
                            </div>
                          )}
                        </td>
                        <td className="p-4 align-middle uppercase tracking-wide">
                          <div className="line-clamp-2" title={item.productName}>
                            {item.productName}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <input
                            type="number"
                            value={item.quantity || ""}
                            onChange={(e) => updateItemQty(item.id, e.target.value)}
                            className={`w-full h-[44px] border-2 rounded-sm text-center font-black text-[15px] focus:outline-none transition-colors ${item.isValid ? "border-slate-200 focus:border-slate-800 text-slate-800 bg-white" : "border-red-200 focus:border-[#dc3545] text-[#dc3545] bg-white"}`}
                          />
                        </td>
                        <td className="p-4 text-center align-middle">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="w-[44px] h-[44px] flex items-center justify-center text-slate-400 hover:bg-[#dc3545] hover:text-white rounded-sm transition-colors mx-auto active:scale-90"
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {extractedItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-400 text-[13px] font-bold tracking-widest uppercase">
                          Listede işlem görecek ürün bulunmuyor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* SAYFALAMA KONTROLLERİ */}
              {totalPages > 1 && (
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    Sayfa {currentPage} / {totalPages} (Toplam {extractedItems.length} Çeşit)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-slate-300 rounded-sm text-slate-600 disabled:opacity-50 hover:bg-slate-100 text-[11px] font-black uppercase tracking-widest transition-colors"
                    >
                      Önceki
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white border border-slate-300 rounded-sm text-slate-600 disabled:opacity-50 hover:bg-slate-100 text-[11px] font-black uppercase tracking-widest transition-colors"
                    >
                      Sonraki
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 mt-2 flex justify-end">
              <button
                onClick={saveToDatabase}
                disabled={isSaving || validSKUCount === 0}
                className="w-full md:w-auto md:min-w-[350px] min-h-[56px] py-4 px-8 bg-[#dc3545] disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-sm font-black text-[15px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-md"
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    KAYDEDİLİYOR
                  </>
                ) : (
                  <>
                    <CheckCircle size={22} strokeWidth={2.5} />
                    SİSTEME İŞLE ({generatedCode})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}