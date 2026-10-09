
"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";

import {
  getShipmentsByDeliveryNumber,
  saveArasTracking,
  getProcessedExportData,
  getExactOriginalExportData,
  getKargoStats,
  getArasFiles,
  deleteArasFile,
} from "@/app/actions/aras-integration";

import ExcelUploadDrawer from "./ExcelUploadDrawer";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  PackageOpen,
  Phone,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  UploadCloud,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
   TYPES
============================================================ */

interface ArasTrackingPanelProps {
  employeeId: string;
}

interface ShipmentData {
  id: string;
  file_id: string;
  customer_name: string;
  mobile_number: string;
  street: string;
  street_2: string;
  city: string;
  region: string;
  postal_code: string;
  delivery_number: string;
  sd_document: string;
  aras_tracking_number: string | null;
  is_processed_aras: boolean;
}

interface ActiveGroupData {
  records: ShipmentData[];
  count: number;
  primary: ShipmentData;
  sdDocumentsMatch: boolean;
  uniqueSdDocuments: string[];
  isUpdateMode: boolean;
}

interface KargoFile {
  id: string;
  filename: string;
  created_at: string;
}

interface Stats {
  totalFiles: number;
  totalRecords: number;
  processed: number;
  remaining: number;
  today: number;
}

type StatusType =
  | "idle"
  | "success"
  | "error"
  | "warning"
  | "update";

type Accent = "blue" | "green" | "orange" | "purple" | "red";

const INITIAL_STATS: Stats = {
  totalFiles: 0,
  totalRecords: 0,
  processed: 0,
  remaining: 0,
  today: 0,
};

/* ============================================================
   HELPERS
============================================================ */

const formatNumber = (value: number) =>
  value.toLocaleString("tr-TR");

function splitName(fullName?: string | null) {
  if (!fullName) return { first: "", last: "" };

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return { first: parts[0], last: "" };
  }

  return {
    last: parts.pop() || "",
    first: parts.join(" "),
  };
}

function extractNeighborhood(
  street1?: string | null,
  street2?: string | null,
) {
  const address = `${street1 || ""} ${street2 || ""}`.trim();

  const match = address.match(
    /([a-zA-ZçğıöşüÇĞİÖŞÜ0-9\s.,-]+?)\s+(?:mahallesi|mah|mh)\b\.?/i,
  );

  if (!match?.[1]) return "MAHALLE BULUNAMADI";

  let neighborhood = match[1].trim();

  if (neighborhood.includes(",")) {
    neighborhood =
      neighborhood.split(",").pop()?.trim() || neighborhood;
  }

  return neighborhood.toLocaleUpperCase("tr-TR");
}

function formatPhone(phone?: string | null) {
  if (!phone) return "";

  const index = phone.indexOf("5");
  return index !== -1 ? phone.substring(index) : phone;
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   THEME
============================================================ */

const ACCENTS = {
  blue: {
    line: "border-blue-500",
    text: "text-blue-300",
    icon: "bg-blue-500/20 text-blue-300",
  },
  green: {
    line: "border-emerald-500",
    text: "text-emerald-300",
    icon: "bg-emerald-500/20 text-emerald-300",
  },
  orange: {
    line: "border-amber-500",
    text: "text-amber-300",
    icon: "bg-amber-500/20 text-amber-300",
  },
  purple: {
    line: "border-violet-500",
    text: "text-violet-300",
    icon: "bg-violet-500/20 text-violet-300",
  },
  red: {
    line: "border-rose-500",
    text: "text-rose-300",
    icon: "bg-rose-500/20 text-rose-300",
  },
};

/* ============================================================
   METRIC CARD
============================================================ */

function MetricCard({
  title,
  value,
  icon: Icon,
  accent,
  subtitle,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  accent: Accent;
  subtitle: string;
}) {
  const theme = ACCENTS[accent];

  return (
    <div
      className={`relative bg-[#192438] border-2 border-slate-600/70 border-t-[4px] ${theme.line} rounded-[4px] p-4 sm:p-5 shadow-md min-w-0`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            {title}
          </p>

          <p
            className={`mt-3 text-2xl sm:text-3xl font-black tabular-nums ${theme.text}`}
          >
            {formatNumber(value)}
          </p>
        </div>

        <div
          className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-[3px] ${theme.icon}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <p className="mt-3 text-[10px] font-semibold text-slate-400">
        {subtitle}
      </p>
    </div>
  );
}

/* ============================================================
   COPY FIELD
============================================================ */

function CopyField({
  label,
  value,
  icon: Icon,
  accent = "blue",
  copied,
  onCopy,
  className = "",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: Accent;
  copied: boolean;
  onCopy: (value: string) => void;
  className?: string;
}) {
  const colors = {
    blue: "text-blue-600 hover:bg-blue-600",
    green: "text-emerald-600 hover:bg-emerald-600",
    orange: "text-amber-600 hover:bg-amber-500",
    purple: "text-violet-600 hover:bg-violet-600",
    red: "text-rose-600 hover:bg-rose-600",
  };

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-500" />

        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
          {label}
        </span>
      </div>

      <div className="flex items-stretch min-h-[48px] bg-white border-2 border-slate-300 rounded-[3px] overflow-hidden">
        <div className="flex-1 min-w-0 px-3 py-3 text-xs sm:text-sm font-extrabold text-slate-900 break-words select-text">
          {value || "-"}
        </div>

        <button
          type="button"
          disabled={!value}
          onClick={() => onCopy(value)}
          title={`${label} kopyala`}
          className={`w-11 shrink-0 flex items-center justify-center border-l-2 border-slate-300 transition-colors hover:text-white disabled:opacity-30 ${colors[accent]}`}
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   SECTION HEADER
============================================================ */

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  right,
  accent = "red",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  accent?: Accent;
}) {
  const lines = {
    blue: "border-blue-500",
    green: "border-emerald-500",
    orange: "border-amber-500",
    purple: "border-violet-500",
    red: "border-[#dc3545]",
  };

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 bg-[#172033] border-b-[3px] ${lines[accent]}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 flex items-center justify-center bg-white/10 border border-white/10 rounded-[3px] shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>

        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-white">
            {title}
          </h2>

          {subtitle && (
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-semibold mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {right}
    </div>
  );
}

/* ============================================================
   MAIN PANEL
============================================================ */

export default function ArasTrackingPanel({
  employeeId,
}: ArasTrackingPanelProps) {
  const [isExcelOpen, setIsExcelOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);

  const [files, setFiles] = useState<KargoFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState("");

  const [deliveryNo, setDeliveryNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  const [activeGroup, setActiveGroup] =
    useState<ActiveGroupData | null>(null);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [stats, setStats] = useState<Stats>(INITIAL_STATS);

  const [uiStatus, setUiStatus] = useState<StatusType>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const deliveryRef = useRef<HTMLInputElement>(null);
  const trackingRef = useRef<HTMLInputElement>(null);

  const selectedFileIdRef = useRef("");
  const scanRequestRef = useRef(false);
  const statsRequestRef = useRef(0);
  const operationRef = useRef(false);

  /* ========================================================
     NOTIFICATIONS
  ======================================================== */

  const triggerFeedback = (
    status: Exclude<StatusType, "idle">,
    message: string,
  ) => {
    setUiStatus(status);
    setStatusMessage(message);
  };

  useEffect(() => {
    if (uiStatus !== "success" && uiStatus !== "error") return;

    const timer = setTimeout(() => {
      setUiStatus("idle");
      setStatusMessage(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [uiStatus, statusMessage]);

  /* ========================================================
     DATA FETCHING
  ======================================================== */

  const fetchStats = useCallback(async (fileId: string) => {
    const requestId = ++statsRequestRef.current;

    try {
      const result = await getKargoStats(fileId);

      if (requestId !== statsRequestRef.current) return;

      if (result.success) {
        setStats({
          totalFiles: result.totalFiles ?? 0,
          totalRecords: result.total ?? 0,
          processed: result.processed ?? 0,
          remaining: Math.max(
            0,
            (result.total ?? 0) - (result.processed ?? 0),
          ),
          today: result.today ?? 0,
        });
      }
    } catch (error) {
      console.error("İstatistik hatası:", error);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    try {
      const result = await getArasFiles();

      if (result.success && result.data) {
        setFiles(result.data);

        // Silinmiş bir dosya seçiliyse temizle.
        const currentId = selectedFileIdRef.current;

        if (
          currentId &&
          !result.data.some((file) => file.id === currentId)
        ) {
          selectedFileIdRef.current = "";
          setSelectedFileId("");
        }
      }

      await fetchStats(selectedFileIdRef.current);
    } catch (error) {
      console.error("Dosyalar alınamadı:", error);
    }
  }, [fetchStats]);

  useEffect(() => {
    void fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    selectedFileIdRef.current = selectedFileId;
    void fetchStats(selectedFileId);
  }, [selectedFileId, fetchStats]);

  useEffect(() => {
    if (!isExcelOpen && !isWipeModalOpen && !activeGroup) {
      deliveryRef.current?.focus();
    }
  }, [isExcelOpen, isWipeModalOpen, activeGroup]);

  /* ========================================================
     COPY
  ======================================================== */

  const handleCopy = async (value: string, field: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);

      setTimeout(() => {
        setCopiedField((current) =>
          current === field ? null : current,
        );
      }, 1800);
    } catch {
      triggerFeedback("error", "Kopyalama işlemi başarısız.");
    }
  };

  /* ========================================================
     PROFILE
  ======================================================== */

  const handleCancel = () => {
    setActiveGroup(null);
    setTrackingNo("");
    setDeliveryNo("");
    setUiStatus("idle");
    setStatusMessage(null);

    setTimeout(() => deliveryRef.current?.focus(), 50);
  };

  const handleProfileChange = (newFileId: string) => {
    if (loading) return;

    selectedFileIdRef.current = newFileId;
    setSelectedFileId(newFileId);
    handleCancel();
  };

  /* ========================================================
     DELIVERY SCANNING + AUTO PROFILE
  ======================================================== */

  const loadDeliveryData = async (targetDeliveryNo: string) => {
    if (scanRequestRef.current) return;

    scanRequestRef.current = true;
    setLoading(true);
    setUiStatus("idle");
    setStatusMessage(null);

    try {
      let currentFileId = selectedFileIdRef.current;

      const result = await getShipmentsByDeliveryNumber(
        targetDeliveryNo,
        currentFileId,
      );

      if (!result.success || !result.data?.length) {
        triggerFeedback(
          "error",
          result.error || "SİPARİŞ BULUNAMADI!",
        );
        setDeliveryNo("");
        return;
      }

      let records = result.data as ShipmentData[];

      if (!currentFileId) {
        let detectedFileId = "";

        // Önce gelen kayıt üzerindeki dosya kimliğini dene.
        const validFileIds = new Set(files.map((f) => f.id));

        const matchingRecord = records.find(
          (record) =>
            record.file_id &&
            validFileIds.has(record.file_id),
        );

        if (matchingRecord) {
          detectedFileId = matchingRecord.file_id;
        }

        // file_id gelmediyse dosya bazlı sorgulama.
        if (!detectedFileId) {
          const fileList =
            files.length > 0
              ? files
              : ((await getArasFiles()).data ?? []);

          for (const file of fileList) {
            const fileResult =
              await getShipmentsByDeliveryNumber(
                targetDeliveryNo,
                file.id,
              );

            if (
              fileResult.success &&
              fileResult.data?.length
            ) {
              detectedFileId = file.id;
              records = fileResult.data as ShipmentData[];
              break;
            }
          }
        }

        if (!detectedFileId) {
          triggerFeedback(
            "warning",
            "Sipariş bulundu fakat ait olduğu Excel dosyası belirlenemedi.",
          );
          setDeliveryNo("");
          return;
        }

        // Profil otomatik seçiliyor.
        currentFileId = detectedFileId;

        selectedFileIdRef.current = detectedFileId;
        setSelectedFileId(detectedFileId);

        // Seçili dosyanın kayıtlarını yeniden al.
        const scopedResult =
          await getShipmentsByDeliveryNumber(
            targetDeliveryNo,
            detectedFileId,
          );

        if (
          !scopedResult.success ||
          !scopedResult.data?.length
        ) {
          triggerFeedback(
            "error",
            "Sipariş profili doğrulanamadı.",
          );
          setDeliveryNo("");
          return;
        }

        records = scopedResult.data as ShipmentData[];
      }

      const processedRecord = records.find(
        (record) => record.is_processed_aras,
      );

      const uniqueSdDocuments = Array.from(
        new Set(
          records
            .map((record) => record.sd_document)
            .filter(Boolean),
        ),
      );

      setActiveGroup({
        records,
        count: records.length,
        primary: records[0],
        sdDocumentsMatch: uniqueSdDocuments.length <= 1,
        uniqueSdDocuments,
        isUpdateMode: !!processedRecord,
      });

      setTrackingNo(
        processedRecord?.aras_tracking_number || "",
      );

      setDeliveryNo("");

      if (processedRecord) {
        triggerFeedback(
          "update",
          "Bu sipariş daha önce işlenmiş. Takip numarasını güncelleyebilirsiniz.",
        );
      }

      setTimeout(() => trackingRef.current?.focus(), 80);
    } catch (error) {
      console.error("Sipariş sorgulama hatası:", error);
      triggerFeedback(
        "error",
        "Sipariş sorgulanırken hata oluştu.",
      );
    } finally {
      scanRequestRef.current = false;
      setLoading(false);
    }
  };

  const handleDeliveryScan = async (event: FormEvent) => {
    event.preventDefault();

    if (!deliveryNo.trim() || loading) return;

    await loadDeliveryData(deliveryNo.trim());
  };

  /* ========================================================
     TRACKING SAVE
  ======================================================== */

  const handleTrackingScan = async (event: FormEvent) => {
    event.preventDefault();

    if (!activeGroup || !trackingNo.trim() || loading) return;

    setLoading(true);

    try {
      const result = await saveArasTracking(
        activeGroup.primary.delivery_number,
        trackingNo.trim(),
        employeeId,
        selectedFileIdRef.current,
      );

      if (result.success) {
        triggerFeedback(
          "success",
          activeGroup.isUpdateMode
            ? "KARGO TAKİP NUMARASI GÜNCELLENDİ!"
            : "BARKOD EŞLEŞTİRMESİ TAMAMLANDI!",
        );

        setActiveGroup(null);
        setTrackingNo("");

        void fetchStats(selectedFileIdRef.current);

        setTimeout(() => deliveryRef.current?.focus(), 80);
      } else {
        triggerFeedback(
          "error",
          result.error || "VERİTABANI YAZMA HATASI!",
        );

        trackingRef.current?.focus();
      }
    } catch (error) {
      console.error("Takip kaydetme hatası:", error);
      triggerFeedback(
        "error",
        "Takip numarası kaydedilemedi.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ========================================================
     DELETE SELECTED PROFILE
  ======================================================== */

  const deleteSelectedFile = async () => {
    if (!selectedFileIdRef.current || operationRef.current) return;

    const fileId = selectedFileIdRef.current;

    const file = files.find((item) => item.id === fileId);

    const confirmed = window.confirm(
      `DİKKAT!\n\n"${file?.filename || "Seçili profil"}" dosyası ve ilgili kayıtlar kalıcı olarak silinecek.\n\nBu işlemi onaylıyor musunuz?`,
    );

    if (!confirmed) return;

    operationRef.current = true;
    setLoading(true);

    try {
      const result = await deleteArasFile(fileId);

      if (result.success) {
        // Seçimi sıfırla.
        selectedFileIdRef.current = "";
        setSelectedFileId("");

        // Aktif işlemi sıfırla.
        handleCancel();

        // Dosya listesini anında güncelle.
        setFiles((previous) =>
          previous.filter((item) => item.id !== fileId),
        );

        triggerFeedback(
          "success",
          "SEÇİLİ ÇALIŞMA PROFİLİ SİLİNDİ!",
        );

        await fetchInitialData();
      } else {
        triggerFeedback(
          "error",
          result.error || "PROFİL SİLİNEMEDİ!",
        );
      }
    } catch (error) {
      console.error("Profil silme hatası:", error);
      triggerFeedback(
        "error",
        "Profil silinirken hata oluştu.",
      );
    } finally {
      operationRef.current = false;
      setLoading(false);
    }
  };

  /* ========================================================
     GLOBAL DATABASE WIPE
  ======================================================== */

  const handleGlobalWipe = async () => {
    if (operationRef.current) return;

    operationRef.current = true;
    setLoading(true);

    try {
      // Boş ID = mevcut backend'deki tüm verileri silme.
      const result = await deleteArasFile("");

      if (result.success) {
        setIsWipeModalOpen(false);

        selectedFileIdRef.current = "";
        setSelectedFileId("");

        setFiles([]);
        setStats(INITIAL_STATS);

        handleCancel();

        triggerFeedback(
          "success",
          "TÜM KARGO VERİTABANI SIFIRLANDI!",
        );

        await fetchInitialData();
      } else {
        triggerFeedback(
          "error",
          result.error || "VERİTABANI SIFIRLANAMADI!",
        );
      }
    } catch (error) {
      console.error("Sıfırlama hatası:", error);
      triggerFeedback(
        "error",
        "Sıfırlama sırasında hata oluştu.",
      );
    } finally {
      operationRef.current = false;
      setLoading(false);
    }
  };

  /* ========================================================
     TWO-COLUMN EXPORT
  ======================================================== */

  const exportTwoColumnExcel = async () => {
    if (exporting) return;

    setExporting(true);

    try {
      const fileId = selectedFileIdRef.current;
      const result = await getProcessedExportData(fileId);

      if (!result.success || !result.data?.length) {
        triggerFeedback(
          "warning",
          "İndirilecek kayıt bulunamadı.",
        );
        return;
      }

      const headers = "Delivery Number;Aras Takip No\n";

      const rows = result.data
        .map(
          (row) =>
            `${csvCell(row.delivery_number)};${csvCell(row.aras_tracking_number)}`,
        )
        .join("\n");

      const date = new Date().toISOString().split("T")[0];

      const filename = fileId
        ? `ARAS_CIKTI_PROFIL_${fileId}_${date}.csv`
        : `ARAS_CIKTI_TUMU_${date}.csv`;

      downloadCSV("\uFEFF" + headers + rows, filename);
    } catch (error) {
      console.error(error);
      triggerFeedback(
        "error",
        "Excel çıktısı oluşturulamadı.",
      );
    } finally {
      setExporting(false);
    }
  };

  /* ========================================================
     EXACT ORIGINAL EXPORT
  ======================================================== */

  const exportExactOriginalExcel = async () => {
    if (exporting) return;

    setExporting(true);

    try {
      const fileId = selectedFileIdRef.current;
      const result = await getExactOriginalExportData(fileId);

      if (!result.success || !result.data?.length) {
        triggerFeedback(
          "warning",
          "İndirilecek kayıt bulunamadı.",
        );
        return;
      }

      const originalHeaders = [
        "Shipment number",
        "Customer name",
        "Email",
        "1st Mobile number",
        "Street",
        "Street 2",
        "City",
        "Region",
        "Postal Code",
        "Country Code",
        "Customer material",
        "SD Document",
        "Delivery number",
        "Material",
        "Text",
        "Quantity",
        "UoM",
        "Export price",
        "Export price currency",
        "in local currency rate 53,29",
        "Country of origin",
        "Commodity Code from Plant",
        "Net Weight(gm)",
        "Invoice",
        "Aras Kargo Takip No",
      ];

      const rows = result.data
        .map((row: any) => {
          const values = [
            row.shipment_number,
            row.customer_name,
            row.email,
            row.mobile_number,
            row.street,
            row.street_2,
            row.city,
            row.region,
            row.postal_code,
            row.country,
            row.customer_material,
            row.sd_document,
            row.delivery_number,
            row.material,
            row.description_text,
            row.quantity,
            row.uom,
            row.export_price,
            row.export_price_currency,
            row.local_currency_rate,
            row.country_of_origin,
            row.commodity_code,
            row.net_weight_gm,
            row.invoice_number,
            row.aras_tracking_number,
          ];

          return values.map(csvCell).join(";");
        })
        .join("\n");

      const date = new Date().toISOString().split("T")[0];

      const filename = fileId
        ? `ORIJINAL_SABLON_PROFIL_${fileId}_${date}.csv`
        : `ORIJINAL_SABLON_TUMU_${date}.csv`;

      downloadCSV(
        "\uFEFF" + originalHeaders.join(";") + "\n" + rows,
        filename,
      );
    } catch (error) {
      console.error(error);
      triggerFeedback(
        "error",
        "Tam çıktı oluşturulamadı.",
      );
    } finally {
      setExporting(false);
    }
  };

  /* ========================================================
     DERIVED VALUES
  ======================================================== */

  const progressPercent =
    stats.totalRecords > 0
      ? Math.min(
          100,
          Math.round(
            (stats.processed / stats.totalRecords) * 100,
          ),
        )
      : 0;

  const selectedFile = files.find(
    (file) => file.id === selectedFileId,
  );

  const customer = activeGroup?.primary;

  const customerName = splitName(customer?.customer_name);

  const fullAddress = customer
    ? `${customer.street || ""} ${customer.street_2 || ""} - Posta Kodu: ${
        customer.postal_code || "YOK"
      }`.trim()
    : "";

  const notificationClasses = {
    idle: "",
    success: "bg-emerald-50 border-emerald-500 text-emerald-800",
    error: "bg-red-50 border-red-500 text-red-800",
    warning: "bg-amber-50 border-amber-500 text-amber-800",
    update: "bg-blue-50 border-blue-500 text-blue-800",
  };

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <>
      <div className="w-full min-w-0 pb-12 font-['Quicksand'] space-y-5 text-slate-800">

        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="relative overflow-hidden bg-[#111827] border-2 border-slate-700 border-l-[5px] border-l-[#dc3545] rounded-[4px] px-5 py-5 sm:px-7 sm:py-6 shadow-lg">
          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-red-900/20 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#dc3545] border border-red-400/30 rounded-[3px] flex items-center justify-center shadow-lg shrink-0">
                <Truck className="w-7 h-7 text-white" />
              </div>

              <div>
                <div className="flex items-center flex-wrap gap-3">
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                    Eksik Parça{" "}
                    <span className="text-[#ff5968]">B2C</span>
                  </h1>

                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-[2px]">
                    Operasyon
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 font-bold mt-1">
                  Aras Kargo Barkod Eşleştirme ve Sevkiyat Yönetimi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-[3px] px-3 py-2 self-start sm:self-auto">
              <span className="w-2 h-2 bg-emerald-400 rounded-[1px]" />
              <span className="text-[10px] font-black uppercase text-slate-200 tracking-wider">
                Panel Aktif
              </span>
            </div>
          </div>
        </header>

        {/* ==================================================
            METRICS
        ================================================== */}

        <section className="space-y-3">
          <div className="flex justify-between items-center gap-2 px-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#dc3545]" />

              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Operasyon İstatistikleri
              </h2>
            </div>

            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {selectedFileId ? "Seçili Profil" : "Tüm Kayıtlar"}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              title="Toplam Kayıt"
              value={stats.totalRecords}
              icon={Package}
              accent="blue"
              subtitle="Toplam sevkiyat kalemi"
            />

            <MetricCard
              title="Tamamlanan"
              value={stats.processed}
              icon={PackageCheck}
              accent="green"
              subtitle="Kargo barkodu eşleştirilen"
            />

            <MetricCard
              title="Bekleyen"
              value={stats.remaining}
              icon={PackageOpen}
              accent="orange"
              subtitle="Henüz işlem yapılmayan"
            />

            <MetricCard
              title="Bugünkü İşlem"
              value={stats.today}
              icon={Zap}
              accent="purple"
              subtitle="Günlük işlem performansı"
            />
          </div>

          {/* PROGRESS */}

          <div className="bg-[#192438] border-2 border-slate-600/70 rounded-[4px] px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-300" />

                <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                  Genel İlerleme
                </span>
              </div>

              <span className="text-lg font-black text-indigo-300 tabular-nums">
                %{progressPercent}
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-700 rounded-[2px] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-[#dc3545] transition-all duration-500 rounded-[2px]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
              <span>{formatNumber(stats.processed)} tamamlandı</span>
              <span>{formatNumber(stats.remaining)} bekliyor</span>
            </div>
          </div>
        </section>

        {/* ==================================================
            FILE MANAGEMENT
        ================================================== */}

        <section className="bg-white border-2 border-slate-300 rounded-[4px] overflow-hidden shadow-sm">
          <SectionHeader
            icon={FolderOpen}
            title="Çalışma Profili ve Dosya Yönetimi"
            subtitle="Excel profili seçimi, yükleme ve çıktı işlemleri"
            accent="purple"
            right={
              <span className="bg-violet-500/15 text-violet-200 border border-violet-500/30 text-[10px] font-black px-3 py-1.5 rounded-[2px]">
                {files.length} DOSYA
              </span>
            }
          />

          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col xl:flex-row gap-3">
              {/* PROFILE */}

              <div className="flex-1 min-w-0">
                <label
                  htmlFor="aras-profile"
                  className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2"
                >
                  Aktif Excel Profili
                </label>

                <div className="relative">
                  <FileSpreadsheet
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${
                      selectedFileId
                        ? "text-emerald-600"
                        : "text-indigo-600"
                    }`}
                  />

                  <select
                    id="aras-profile"
                    value={selectedFileId}
                    onChange={(event) =>
                      handleProfileChange(event.target.value)
                    }
                    disabled={loading}
                    className="w-full h-12 pl-11 pr-10 appearance-none bg-[#f1f5f9] border-2 border-slate-400 rounded-[3px] text-xs font-black text-slate-800 uppercase focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-500/10 cursor-pointer disabled:opacity-50"
                  >
                    <option value="">
                      TÜM VERİTABANINDA ARA
                    </option>

                    {files.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.filename}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                </div>
              </div>

              {/* EXPORT ACTIONS */}

              <div className="flex flex-col sm:flex-row xl:items-end gap-2 xl:pt-5">
                <button
                  type="button"
                  onClick={() => setIsExcelOpen(true)}
                  disabled={loading}
                  className="h-12 px-5 bg-[#dc3545] hover:bg-red-700 text-white rounded-[3px] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wide transition-colors disabled:opacity-50 shadow-sm"
                >
                  <UploadCloud className="w-4 h-4" />
                  Excel Yükle
                </button>

                <button
                  type="button"
                  onClick={exportTwoColumnExcel}
                  disabled={loading || exporting}
                  className="h-12 px-4 bg-[#172033] hover:bg-blue-700 text-white border-2 border-slate-600 rounded-[3px] flex items-center justify-center gap-2 text-[11px] font-black uppercase transition-colors disabled:opacity-50"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  2 Kolon
                </button>

                <button
                  type="button"
                  onClick={exportExactOriginalExcel}
                  disabled={loading || exporting}
                  className="h-12 px-4 bg-[#172033] hover:bg-emerald-700 text-white border-2 border-slate-600 rounded-[3px] flex items-center justify-center gap-2 text-[11px] font-black uppercase transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Tam Çıktı
                </button>
              </div>
            </div>

            {/* ACTIVE PROFILE INFO */}

            <div
              className={`border-l-[4px] rounded-[3px] px-4 py-3 flex items-center gap-3 ${
                selectedFileId
                  ? "bg-emerald-50 border-emerald-500"
                  : "bg-indigo-50 border-indigo-500"
              }`}
            >
              {selectedFileId ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <Search className="w-5 h-5 text-indigo-600 shrink-0" />
              )}

              <div className="min-w-0">
                <p
                  className={`text-[10px] font-black uppercase ${
                    selectedFileId
                      ? "text-emerald-700"
                      : "text-indigo-700"
                  }`}
                >
                  {selectedFileId
                    ? "Aktif Çalışma Profili"
                    : "Genel Arama Modu"}
                </p>

                <p className="text-xs font-bold text-slate-700 mt-1 break-all">
                  {selectedFileId
                    ? selectedFile?.filename || "Seçili dosya"
                    : "İlk barkod okunduğunda ilgili profil otomatik seçilir."}
                </p>
              </div>
            </div>

            {/* DANGER ZONE */}

            <div className="border-2 border-red-200 bg-red-50/50 rounded-[3px] overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-100 text-red-600 rounded-[3px] flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>

                  <div>
                    <p className="text-[11px] font-black uppercase text-red-800">
                      Veri Yönetimi
                    </p>

                    <p className="text-[10px] font-semibold text-red-600 mt-0.5">
                      Silme işlemleri kalıcıdır ve geri alınamaz.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  {/* DELETE PROFILE */}

                  <button
                    type="button"
                    onClick={deleteSelectedFile}
                    disabled={!selectedFileId || loading}
                    className="h-10 px-4 flex items-center justify-center gap-2 bg-white border-2 border-red-300 hover:bg-red-100 text-red-700 rounded-[3px] text-[11px] font-black uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    Profili Sil
                  </button>

                  {/* GLOBAL WIPE */}

                  <button
                    type="button"
                    onClick={() => setIsWipeModalOpen(true)}
                    disabled={loading}
                    className="h-10 px-4 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 border-2 border-red-600 text-white rounded-[3px] text-[11px] font-black uppercase transition-colors disabled:opacity-50"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Veritabanını Sıfırla
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================
            NOTIFICATIONS
        ================================================== */}

        {statusMessage && (
          <div
            role="status"
            className={`flex items-start gap-3 p-4 border-l-[5px] rounded-[3px] shadow-sm ${notificationClasses[uiStatus]}`}
          >
            {uiStatus === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : uiStatus === "error" ||
              uiStatus === "warning" ? (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            ) : (
              <RefreshCw className="w-5 h-5 shrink-0" />
            )}

            <span className="text-xs sm:text-sm font-black uppercase flex-1">
              {statusMessage}
            </span>

            <button
              type="button"
              onClick={() => {
                setStatusMessage(null);
                setUiStatus("idle");
              }}
              className="opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ==================================================
            SCANNER
        ================================================== */}

        <section className="bg-white border-2 border-slate-300 rounded-[4px] overflow-hidden shadow-md">
          <SectionHeader
            icon={ScanLine}
            title="Barkod İşlem Merkezi"
            subtitle="Sipariş sorgulama ve Aras Kargo eşleştirme"
            accent="red"
            right={
              <span
                className={`text-[10px] font-black uppercase px-3 py-1.5 border rounded-[2px] ${
                  activeGroup
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                }`}
              >
                {activeGroup ? "İşlem Devam Ediyor" : "Okumaya Hazır"}
              </span>
            }
          />

          <div className="p-4 sm:p-6 space-y-5">
            {/* STEP 1 */}

            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-8 h-8 flex items-center justify-center rounded-[3px] text-xs font-black text-white ${
                      activeGroup
                        ? "bg-emerald-600"
                        : "bg-indigo-600"
                    }`}
                  >
                    {activeGroup ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      "01"
                    )}
                  </span>

                  <label
                    htmlFor="aras-delivery"
                    className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-800"
                  >
                    Sipariş / Delivery Numarası
                  </label>
                </div>

                {activeGroup && (
                  <span className="text-[10px] font-black text-emerald-600 uppercase">
                    Sipariş Bulundu
                  </span>
                )}
              </div>

              <form
                onSubmit={handleDeliveryScan}
                className="flex flex-col sm:flex-row gap-2"
              >
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />

                  <input
                    id="aras-delivery"
                    ref={deliveryRef}
                    type="text"
                    value={deliveryNo}
                    onChange={(event) =>
                      setDeliveryNo(event.target.value)
                    }
                    disabled={loading || !!activeGroup}
                    placeholder="SİPARİŞ BARKODUNU OKUTUN..."
                    autoComplete="off"
                    className="w-full h-14 pl-12 pr-4 bg-[#f1f5f9] border-2 border-slate-400 rounded-[3px] text-base sm:text-lg font-black uppercase text-slate-900 placeholder:text-slate-400 placeholder:text-xs sm:placeholder:text-sm focus:outline-none focus:border-indigo-600 focus:bg-white disabled:opacity-50 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !deliveryNo.trim() ||
                    !!activeGroup
                  }
                  className="sm:w-40 h-14 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-[3px] text-xs font-black uppercase tracking-wide transition-colors"
                >
                  {loading && !activeGroup ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Sorgula
                </button>
              </form>
            </div>

            {/* IDLE STATE */}

            {!activeGroup && (
              <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-[3px] px-5 py-10 flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-[#172033] rounded-[3px] flex items-center justify-center mb-4">
                  <ScanLine className="w-7 h-7 text-indigo-300" />
                </div>

                <h3 className="text-sm font-black text-slate-800 uppercase">
                  Barkod Okutmaya Hazır
                </h3>

                <p className="mt-2 text-xs text-slate-500 max-w-md leading-relaxed font-medium">
                  Sipariş veya teslimat barkodunu okutun.
                  Müşteri bilgileri ve Aras Kargo eşleştirme
                  alanı otomatik açılacaktır.
                </p>
              </div>
            )}

            {/* ACTIVE ORDER */}

            {activeGroup && customer && (
              <div className="border-2 border-slate-300 rounded-[3px] overflow-hidden">

                {/* ORDER HEADER */}

                <div className="bg-[#172033] px-4 sm:px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 flex items-center justify-center bg-white/10 border border-white/10 rounded-[3px] text-white">
                      <Package className="w-6 h-6" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Aktif Sipariş
                      </p>

                      <p className="text-base sm:text-lg font-black text-white break-all">
                        {customer.delivery_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-white/10 border border-white/20 px-4 py-2 rounded-[3px]">
                      <span className="text-2xl font-black text-white tabular-nums">
                        {activeGroup.count}
                      </span>

                      <span className="ml-2 text-[10px] font-black uppercase text-slate-300">
                        Kalem
                      </span>
                    </div>

                    <span
                      className={`px-3 py-3 text-[10px] font-black uppercase rounded-[3px] ${
                        activeGroup.isUpdateMode
                          ? "bg-blue-600 text-white"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {activeGroup.isUpdateMode
                        ? "Güncelleme"
                        : "Yeni Eşleştirme"}
                    </span>
                  </div>
                </div>

                {/* SD DOCUMENT */}

                <div
                  className={`px-4 sm:px-5 py-3 flex items-start gap-3 border-b-2 ${
                    activeGroup.sdDocumentsMatch
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-amber-50 border-amber-300"
                  }`}
                >
                  {activeGroup.sdDocumentsMatch ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <p
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        activeGroup.sdDocumentsMatch
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {activeGroup.sdDocumentsMatch
                        ? "SD Document Tam Eşleşme"
                        : "Farklı SD Document Kodları"}
                    </p>

                    <p className="mt-1 text-xs sm:text-sm font-black font-mono text-slate-800 break-all">
                      {activeGroup.uniqueSdDocuments.join(", ") ||
                        "KOD YOK"}
                    </p>
                  </div>
                </div>

                {/* CUSTOMER DETAILS */}

                <div className="p-4 sm:p-5 bg-[#f8fafc]">
                  <div className="flex items-center gap-2 mb-4">
                    <UserRound className="w-4 h-4 text-indigo-600" />

                    <h3 className="text-xs font-black uppercase tracking-wide text-slate-800">
                      Alıcı ve Teslimat Bilgileri
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <CopyField
                      label="Müşteri Adı"
                      value={customerName.first}
                      icon={UserRound}
                      accent="blue"
                      copied={copiedField === "first"}
                      onCopy={(value) =>
                        handleCopy(value, "first")
                      }
                    />

                    <CopyField
                      label="Soyadı"
                      value={customerName.last}
                      icon={UserRound}
                      accent="purple"
                      copied={copiedField === "last"}
                      onCopy={(value) =>
                        handleCopy(value, "last")
                      }
                    />

                    <CopyField
                      label="Telefon Numarası"
                      value={formatPhone(customer.mobile_number)}
                      icon={Phone}
                      accent="green"
                      copied={copiedField === "phone"}
                      onCopy={(value) =>
                        handleCopy(value, "phone")
                      }
                    />

                    <CopyField
                      label="Şehir / Bölge"
                      value={`${customer.city || ""} / ${customer.region || ""}`}
                      icon={MapPin}
                      accent="blue"
                      copied={copiedField === "city"}
                      onCopy={(value) =>
                        handleCopy(value, "city")
                      }
                    />

                    <CopyField
                      label="Mahalle"
                      value={extractNeighborhood(
                        customer.street,
                        customer.street_2,
                      )}
                      icon={MapPin}
                      accent="orange"
                      copied={copiedField === "neighborhood"}
                      onCopy={(value) =>
                        handleCopy(value, "neighborhood")
                      }
                    />

                    <CopyField
                      label="Açık Adres"
                      value={fullAddress}
                      icon={MapPin}
                      accent="red"
                      copied={copiedField === "address"}
                      onCopy={(value) =>
                        handleCopy(value, "address")
                      }
                    />
                  </div>
                </div>

                {/* TRACKING INPUT */}

                <div
                  className={`p-4 sm:p-5 border-t-[4px] ${
                    activeGroup.isUpdateMode
                      ? "border-blue-600 bg-blue-50/50"
                      : "border-[#dc3545] bg-red-50/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <span
                      className={`w-8 h-8 flex items-center justify-center rounded-[3px] text-white text-xs font-black ${
                        activeGroup.isUpdateMode
                          ? "bg-blue-600"
                          : "bg-[#dc3545]"
                      }`}
                    >
                      02
                    </span>

                    <label
                      htmlFor="aras-tracking"
                      className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-800"
                    >
                      {activeGroup.isUpdateMode
                        ? "Aras Kargo Barkodunu Güncelle"
                        : "Aras Kargo Barkodunu Okut"}
                    </label>
                  </div>

                  <form
                    onSubmit={handleTrackingScan}
                    className="flex flex-col lg:flex-row gap-2"
                  >
                    <div className="relative flex-1 min-w-0">
                      <ScanLine
                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${
                          activeGroup.isUpdateMode
                            ? "text-blue-600"
                            : "text-[#dc3545]"
                        }`}
                      />

                      <input
                        id="aras-tracking"
                        ref={trackingRef}
                        type="text"
                        value={trackingNo}
                        onChange={(event) =>
                          setTrackingNo(event.target.value)
                        }
                        disabled={loading}
                        placeholder="ARAS TAKİP NUMARASI..."
                        autoComplete="off"
                        className={`w-full h-14 pl-12 pr-4 bg-white border-2 rounded-[3px] font-mono text-lg sm:text-xl font-black tracking-wide text-slate-900 uppercase placeholder:text-slate-400 placeholder:text-xs focus:outline-none disabled:opacity-50 ${
                          activeGroup.isUpdateMode
                            ? "border-blue-300 focus:border-blue-600"
                            : "border-red-300 focus:border-[#dc3545]"
                        }`}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={
                          loading || !trackingNo.trim()
                        }
                        className={`flex-1 lg:flex-none lg:min-w-[155px] h-14 px-5 rounded-[3px] text-white font-black uppercase text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ${
                          activeGroup.isUpdateMode
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-[#dc3545] hover:bg-red-700"
                        }`}
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}

                        {activeGroup.isUpdateMode
                          ? "Güncelle"
                          : "Kaydet"}
                      </button>

                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={loading}
                        className="h-14 px-5 bg-[#172033] hover:bg-slate-700 text-white rounded-[3px] text-xs font-black uppercase transition-colors disabled:opacity-50"
                      >
                        İptal
                      </button>
                    </div>
                  </form>

                  <div className="flex items-center gap-2 mt-3">
                    <ScanLine className="w-3.5 h-3.5 text-slate-500" />

                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                      Barkodu okutun ve Enter tuşuna basarak işlemi tamamlayın.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ==================================================
            FOOTER
        ================================================== */}

        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-[1px]" />

            <p className="text-[10px] text-slate-500 font-bold">
              Aras Kargo Entegrasyonu · Operasyon Yönetimi
            </p>
          </div>

          <span className="text-[10px] font-black text-slate-400 uppercase">
            B2C
          </span>
        </div>
      </div>

      {/* ======================================================
          EXCEL UPLOAD DRAWER
      ====================================================== */}

      <ExcelUploadDrawer
        isOpen={isExcelOpen}
        onClose={() => {
          setIsExcelOpen(false);
          void fetchInitialData();
        }}
        employeeId={employeeId}
      />

      {/* ======================================================
          GLOBAL WIPE CONFIRMATION MODAL
      ====================================================== */}

      {isWipeModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="aras-wipe-title"
            className="w-full max-w-lg bg-white border-2 border-red-500 rounded-[4px] shadow-2xl overflow-hidden"
          >
            {/* MODAL HEADER */}

            <div className="bg-[#172033] border-b-[4px] border-red-600 px-5 py-5 flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 bg-red-600 rounded-[3px] flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>

              <div className="flex-1">
                <h2
                  id="aras-wipe-title"
                  className="text-base sm:text-lg font-black uppercase text-white tracking-wide"
                >
                  Veritabanını Sıfırla
                </h2>

                <p className="text-[11px] font-bold text-red-300 mt-1">
                  Tüm veriler kalıcı olarak silinecek.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsWipeModalOpen(false)}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="p-5 sm:p-7">
              <div className="flex items-start gap-3 border-l-[4px] border-red-500 bg-red-50 p-4 rounded-[3px]">
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />

                <div>
                  <h3 className="text-sm font-black uppercase text-red-800">
                    Dikkat! Bu işlem geri alınamaz.
                  </h3>

                  <p className="text-xs font-semibold text-red-700 mt-2 leading-relaxed">
                    Sisteme yüklenen tüm Excel dosyaları ve
                    yapılan Aras Kargo barkod eşleştirmeleri
                    tamamen temizlenecektir.
                  </p>
                </div>
              </div>

              <div className="mt-5 border-2 border-slate-200 rounded-[3px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-600">
                    Yüklü Excel Dosyaları
                  </span>

                  <span className="text-lg font-black text-red-600">
                    {formatNumber(files.length)}
                  </span>
                </div>

                <div className="h-px bg-slate-200 my-3" />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-600">
                    Toplam Kayıt
                  </span>

                  <span className="text-lg font-black text-red-600">
                    {selectedFileId
                      ? "Tümü"
                      : formatNumber(stats.totalRecords)}
                  </span>
                </div>
              </div>

              <p className="mt-4 text-[11px] font-semibold text-slate-500 leading-relaxed">
                Devam etmeden önce gerekli Excel çıktılarını
                indirdiğinizden emin olun.
              </p>

              {/* MODAL BUTTONS */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsWipeModalOpen(false)}
                  disabled={loading}
                  className="h-13 min-h-12 bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 rounded-[3px] text-xs font-black uppercase text-slate-700 transition-colors disabled:opacity-50"
                >
                  Vazgeç
                </button>

                <button
                  type="button"
                  onClick={handleGlobalWipe}
                  disabled={loading}
                  className="h-13 min-h-12 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 border-2 border-red-600 text-white rounded-[3px] text-xs font-black uppercase transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}

                  {loading
                    ? "SİLİNİYOR..."
                    : "EVET, TÜMÜNÜ SİL"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
