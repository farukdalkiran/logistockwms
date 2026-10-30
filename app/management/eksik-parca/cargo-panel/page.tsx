"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Barcode,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  FolderCog,
  Hash,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  PackageOpen,
  Phone,
  RefreshCcw,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import {
  getShipmentsByDeliveryNumber,
  getProcessedExportData,
  getExactOriginalExportData,
  getKargoStats,
  getArasFiles,
  deleteArasFile,
} from "@/app/actions/aras-integration";
import {
  getCargoPanelExistingRecord,
  saveCargoPanelRecord,
  type CargoProcessType,
} from "@/app/actions/aras-panel-v2";
import ExcelUploadDrawer from "./ExcelUploadDrawer";

type Shipment = {
  id: string;
  file_id: string | null;
  customer_name: string | null;
  mobile_number: string | null;
  street: string | null;
  street_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  delivery_number: string;
  sd_document: string | null;
  aras_tracking_number: string | null;
  is_processed_aras: boolean | null;
};
type Profile = { id: string; filename: string; created_at?: string | null };
type Group = {
  records: Shipment[];
  primary: Shipment;
  fileId: string;
  count: number;
  uniqueSd: string[];
  processed: boolean;
};
type Stats = {
  totalFiles: number;
  total: number;
  processed: number;
  today: number;
};
type Notice = { message: string; type: "success" | "error" | "info" } | null;
type Option = { value: string; label: string };

const CARD = "rounded-[5px] border border-slate-200 bg-white shadow-sm";
const LABEL =
  "block text-xs font-semibold uppercase tracking-[.07em] text-slate-500";
const INPUT =
  "h-11 w-full rounded-[4px] border border-slate-300 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-100";
const BTN =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const BTN_OUTLINE = `${BTN} border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50`;

const MISSING_OPTIONS: Option[] = [
  { value: "address", label: "Eksik adres" },
  { value: "neighborhood", label: "Mahalle bilgisi eksik" },
  { value: "phone", label: "Telefon numarası eksik" },
  { value: "phone_invalid", label: "Telefon numarası hatalı" },
  { value: "building", label: "Apartman / kapı numarası eksik" },
  { value: "district", label: "İl / ilçe uyuşmazlığı" },
  { value: "street", label: "Sokak bilgisi eksik" },
  { value: "postcode", label: "Posta kodu hatalı" },
  { value: "other", label: "Diğer (açıklama gerekli)" },
];
const RETURN_OPTIONS: Option[] = [
  { value: "undelivered", label: "Teslimat yapılamadı" },
  { value: "refused", label: "Alıcı kabul etmedi" },
  { value: "cancelled", label: "Gönderi iptal edildi" },
  { value: "returned", label: "İade edildi" },
  { value: "other", label: "Diğer iade sebebi" },
];
const MISSING_LABELS: Record<string, string> = {
  address: "EKSİK ADRES",
  neighborhood: "EKSİK MAHALLE",
  phone: "TELEFON NUMARASI EKSİK",
  phone_invalid: "TELEFON NUMARASI HATALI",
  building: "APARTMAN / KAPI NUMARASI EKSİK",
  district: "İL / İLÇE UYUŞMAZLIĞI",
  street: "SOKAK BİLGİSİ EKSİK",
  postcode: "POSTA KODU HATALI",
  other: "DİĞER EKSİK BİLGİ",
};
const RETURN_LABELS: Record<string, string> = {
  undelivered: "TESLİMAT YAPILAMADI",
  refused: "ALICI KABUL ETMEDİ",
  cancelled: "GÖNDERİ İPTAL EDİLDİ",
  returned: "İADE EDİLDİ",
  other: "DİĞER İADE SEBEBİ",
};
const TEXT_ISSUE =
  /(EKS[Iİ]K|ADRES|MAHALLE|TELEFON|POSTA KODU|[Iİ]L[CÇ]E|APARTMAN|YANLI[SŞ]|HATALI|İLETİŞİM)/i;
const TRACKING_PATTERN = /^[A-Z0-9]{10,32}$/;

function normalizeResult<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object") {
    const value =
      (res as { data?: unknown; rows?: unknown }).data ??
      (res as { rows?: unknown }).rows;
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}
function errorFrom(res: unknown, fallback = "İşlem gerçekleştirilemedi.") {
  if (!res || typeof res !== "object") return fallback;
  const e = (res as { error?: unknown }).error;
  return typeof e === "string" ? e : fallback;
}
function hasFailure(res: unknown) {
  return Boolean(
    res &&
    typeof res === "object" &&
    (res as { success?: boolean }).success === false,
  );
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}
function fullNameParts(value: string | null) {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    first: parts.slice(0, -1).join(" ") || parts[0] || "",
    last: parts.length > 1 ? (parts.at(-1) ?? "") : "",
  };
}
function extractNeighborhood(...addresses: Array<string | null>) {
  const address = addresses.filter(Boolean).join(" ");
  const match = address.match(
    /(?:^|[,.;])\s*([\p{L}0-9][\p{L}0-9\s'-]{1,45}?)\s+(?:mahallesi|mah\.?|mh\.?)(?=\s|,|\.|$)/iu,
  );
  return match?.[1]?.trim() ?? "";
}
function parseReason(
  note: string | null,
  status: CargoProcessType,
): { reason: string; detail: string } {
  const raw = String(note ?? "").trim();
  const labels = status === "missing" ? MISSING_LABELS : RETURN_LABELS;
  const match = Object.entries(labels).find(([, label]) =>
    raw.toLocaleUpperCase("tr-TR").startsWith(label.toLocaleUpperCase("tr-TR")),
  );
  return match
    ? {
        reason: match[0],
        detail: raw
          .slice(match[1].length)
          .replace(/^\s*[—:-]\s*/, "")
          .trim(),
      }
    : { reason: "other", detail: raw };
}
function csvField(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}
function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = `\uFEFF${[headers, ...rows].map((values) => values.map(csvField).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const ORIGINAL_COLUMNS: Array<[string, string]> = [
  ["Shipment number", "shipment_number"],
  ["Customer name", "customer_name"],
  ["Email", "email"],
  ["1st Mobile number", "mobile_number"],
  ["Street", "street"],
  ["Street 2", "street_2"],
  ["City", "city"],
  ["Region", "region"],
  ["Postal Code", "postal_code"],
  ["Country Code", "country"],
  ["Customer material", "customer_material"],
  ["SD Document", "sd_document"],
  ["Delivery number", "delivery_number"],
  ["Material", "material"],
  ["Text", "description_text"],
  ["Quantity", "quantity"],
  ["UoM", "uom"],
  ["Export price", "export_price"],
  ["Export price currency", "export_price_currency"],
  ["in local currency rate 53,29", "local_currency_rate"],
  ["Country of origin", "country_of_origin"],
  ["Commodity Code from Plant", "commodity_code"],
  ["Net Weight(gm)", "net_weight_gm"],
  ["Invoice", "invoice_number"],
  ["Aras Kargo Takip No", "aras_tracking_number"],
];

export default function ArasTrackingPanel({
  employeeId,
}: {
  employeeId: string;
}) {
  const [files, setFiles] = useState<Profile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState(""); // "" = tum veritabaninda ara
  const [stats, setStats] = useState<Stats>({
    totalFiles: 0,
    total: 0,
    processed: 0,
    today: 0,
  });
  const [deliveryNo, setDeliveryNo] = useState("");
  const [group, setGroup] = useState<Group | null>(null);
  const [type, setType] = useState<CargoProcessType>("success");
  const [reason, setReason] = useState("address");
  const [trackingNo, setTrackingNo] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"short" | "original" | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [wipeConfirmation, setWipeConfirmation] = useState("");
  const [showUploader, setShowUploader] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [notice, setNotice] = useState<Notice>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback(
    (message: string, kind: "success" | "error" | "info" = "info") => {
      setNotice({ message, type: kind });
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
      notificationTimer.current = setTimeout(() => setNotice(null), 6000);
    },
    [],
  );
  useEffect(
    () => () => {
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    },
    [],
  );

  const loadFiles = useCallback(async () => {
    try {
      const result = await getArasFiles();
      if (hasFailure(result))
        throw new Error(errorFrom(result, "Dosyalar alınamadı."));
      setFiles(normalizeResult<Profile>(result));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Profiller yüklenemedi.", "error");
    }
  }, [toast]);
  const loadStats = useCallback(async (fileId: string) => {
    try {
      const result = await getKargoStats(fileId);
      if (hasFailure(result)) return;
      const o = (result ?? {}) as Record<string, unknown>;
      setStats({
        totalFiles: Number(o.totalFiles ?? 0),
        total: Number(o.total ?? o.totalRecords ?? 0),
        processed: Number(o.processed ?? 0),
        today: Number(o.today ?? 0),
      });
    } catch {
      /* İstatistik arizasi operasyonu engellemesin. */
    }
  }, []);
  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);
  useEffect(() => {
    void loadStats(selectedFileId);
  }, [loadStats, selectedFileId]);
  function formatPhoneForCopy(value: string | null) {
    const digits = String(value ?? "").replace(/\D/g, "");

    // Türkiye ülke kodunu temizle
    if (digits.startsWith("90") && digits.length === 12) {
      return digits.slice(2);
    }

    // Baştaki 0'ı kaldır
    if (digits.startsWith("0") && digits.length === 11) {
      return digits.slice(1);
    }

    return digits;
  }
  const selectedFileName =
    files.find((f) => f.id === selectedFileId)?.filename ??
    "TÜM VERİTABANINDA ÇALIŞ";
  const remaining = Math.max(stats.total - stats.processed, 0);
  const percentage =
    stats.total > 0
      ? Math.min(100, Math.round((stats.processed / stats.total) * 100))
      : 0;
  const names = useMemo(
    () => fullNameParts(group?.primary.customer_name ?? null),
    [group],
  );
  const address = useMemo(() => {
    const a = group?.primary;
    if (!a) return { line: "", location: "", neighborhood: "" };
    return {
      line: [a.street, a.street_2].filter(Boolean).join(", "),
      location: [a.region, a.city, a.postal_code].filter(Boolean).join(" / "),
      neighborhood: extractNeighborhood(a.street, a.street_2),
    };
  }, [group]);

  const copy = useCallback(
    async (value: string, label: string) => {
      if (!value.trim())
        return toast("Kopyalanacak bilgi bulunamadı.", "error");
      try {
        await navigator.clipboard.writeText(value);
        toast(`${label} kopyalandı.`, "success");
      } catch {
        toast("Kopyalama yapılamadı. Tarayıcı iznini kontrol edin.", "error");
      }
    },
    [toast],
  );

  const clearForm = useCallback(() => {
    setGroup(null);
    setDeliveryNo("");
    setType("success");
    setTrackingNo("");
    setReason("address");
    setExtraNote("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const lookup = useCallback(async () => {
    const target = deliveryNo.trim().replace(/\s/g, "");
    if (!/^\d{7,20}$/.test(target))
      return toast("Geçerli Delivery Number okutun.", "error");
    setLoading(true);
    setGroup(null);
    setTrackingNo("");
    setExtraNote("");
    setReason("address");
    try {
      const result = await getShipmentsByDeliveryNumber(target, selectedFileId);
      if (hasFailure(result))
        throw new Error(errorFrom(result, "Gönderi bulunamadı."));
      const records = normalizeResult<Shipment>(result);
      if (!records.length)
        throw new Error("Bu Delivery Number için kayıt bulunamadı.");
      const autoFile = records[0]?.file_id || selectedFileId;
      if (!autoFile)
        throw new Error("Gönderinin bağlı olduğu dosya profili belirlenemedi.");
      if (!selectedFileId && autoFile) setSelectedFileId(autoFile); // Otomatik profil seçimi korunur.
      const related = records.filter(
        (r) => !r.file_id || r.file_id === autoFile,
      );
      const primary = related[0];
      const uniqueSd = [
        ...new Set(
          related
            .map((r) => r.sd_document?.trim())
            .filter((x): x is string => Boolean(x)),
        ),
      ];
      setGroup({
        records: related,
        primary,
        fileId: autoFile,
        count: related.length,
        uniqueSd,
        processed: related.some((r) => r.is_processed_aras === true),
      });

      // Eski veride hata aciklamasi takip alanina yazilmisti: okumada tanı, yeni kayıtta tekrarlama.
      const legacy = primary.aras_tracking_number?.trim() ?? "";
      if (TEXT_ISSUE.test(legacy)) {
        setType("missing");
        setReason("other");
        setExtraNote(legacy);
      } else if (TRACKING_PATTERN.test(legacy.toUpperCase())) {
        setType("success");
        setTrackingNo(legacy);
      } else {
        setType("success");
      }

      const stored = await getCargoPanelExistingRecord(target, autoFile);
      if (stored.success && stored.data) {
        const r = stored.data;
        const nextType: CargoProcessType = r.missing_address
          ? "missing"
          : r.is_returned
            ? "returned"
            : "success";
        setType(nextType);
        if (nextType === "success") {
          const raw = (r.aras_tracking_number ?? "").trim();
          setTrackingNo(TRACKING_PATTERN.test(raw.toUpperCase()) ? raw : "");
          setExtraNote(r.note ?? "");
        } else {
          const parsed = parseReason(r.note, nextType);
          setReason(parsed.reason);
          setExtraNote(parsed.detail);
        }
      }
      toast(
        `${related.length} satır eşleştirildi. ${related.some((r) => r.is_processed_aras) ? "Kayıt güncelleme modu." : "Yeni işlem."}`,
        "success",
      );
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Sorgu sırasında hata oluştu.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [deliveryNo, selectedFileId, toast]);

  const chooseType = (next: CargoProcessType) => {
    setType(next);
    setExtraNote("");
    setReason(next === "returned" ? "undelivered" : "address");
  };
  const isValidTracking =
    TRACKING_PATTERN.test(trackingNo.trim().toUpperCase()) &&
    !TEXT_ISSUE.test(trackingNo);
  const canSave = Boolean(
    group &&
    !saving &&
    !loading &&
    (type !== "success" || isValidTracking) &&
    (type === "success" || reason !== "other" || extraNote.trim().length >= 3),
  );

  const save = async () => {
    if (!group || !canSave) return;
    setSaving(true);
    try {
      const result = await saveCargoPanelRecord({
        deliveryNumber: group.primary.delivery_number,
        fileId: group.fileId,
        status: type,
        trackingNumber: type === "success" ? trackingNo.trim() : undefined,
        reason: type === "success" ? undefined : reason,
        extraNote: extraNote.trim(),
      });
      if (!result.success) throw new Error(result.error);
      toast(
        result.updated
          ? "Gönderi kaydı güncellendi."
          : "Yeni kargo kaydı oluşturuldu.",
        "success",
      );
      await loadStats(selectedFileId);
      clearForm();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Kayıt başarısız.", "error");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async (mode: "short" | "original") => {
    setExporting(mode);
    try {
      const result =
        mode === "short"
          ? await getProcessedExportData(selectedFileId)
          : await getExactOriginalExportData(selectedFileId);
      if (hasFailure(result))
        throw new Error(errorFrom(result, "Dışa aktarma başarısız."));
      const data = normalizeResult<Record<string, unknown> | unknown[]>(result);
      if (!data.length) throw new Error("Dışa aktarılacak veri bulunamadı.");
      const stamp = new Date().toLocaleDateString("sv-SE", {
        timeZone: "Europe/Istanbul",
      });
      const target = selectedFileId || "TUMU";
      if (mode === "short") {
        downloadCsv(
          `ARAS_CIKTI_${target}_${stamp}.csv`,
          ["Delivery Number", "Takip Numarası / Eksik Bilgi Nedeni"],
          data.map((row) =>
            Array.isArray(row)
              ? [row[0], row[1]]
              : [
                  row.delivery_number ?? row["Delivery Number"],
                  row.aras_tracking_number ?? row["Aras Takip No"],
                ],
          ),
        );
      } else {
        downloadCsv(
          `ORIJINAL_SABLON_${target}_${stamp}.csv`,
          ORIGINAL_COLUMNS.map(([title]) => title),
          data.map((row) =>
            Array.isArray(row)
              ? row
              : ORIGINAL_COLUMNS.map(
                  ([title, key]) => row[key] ?? row[title] ?? "",
                ),
          ),
        );
      }
      toast(`${data.length} kayıt dışa aktarıldı.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "CSV oluşturulamadı.", "error");
    } finally {
      setExporting(null);
    }
  };

  const deleteProfile = async () => {
    if (!confirm || (!confirm.id && wipeConfirmation !== "SIFIRLA")) return;
    setProfileBusy(true);
    try {
      const result = await deleteArasFile(confirm.id); // "" = tum profiller ve tum kayitlar.
      if (hasFailure(result))
        throw new Error(errorFrom(result, "Silme başarısız."));
      const wasCurrent = !confirm.id || confirm.id === selectedFileId;
      if (wasCurrent) {
        setSelectedFileId("");
        clearForm();
      }
      await loadFiles();
      await loadStats(wasCurrent ? "" : selectedFileId);
      toast(
        confirm.id ? "Profil silindi." : "Tüm profiller / veriler sıfırlandı.",
        "success",
      );
      setConfirm(null);
      setWipeConfirmation("");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Silme işlemi başarısız.",
        "error",
      );
    } finally {
      setProfileBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] space-y-4 overflow-x-hidden bg-slate-50 px-3 py-3 text-slate-900 sm:px-5 sm:py-5 lg:px-7">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">WMS / Eksik Parça</p>
          <h1 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">Kargo İşleme Formu</h1>
          <p className="mt-1 text-xs text-slate-500">Delivery Number ara, alıcıyı doğrula, sonucu kaydet.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[4px] bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Personel: {employeeId}</span>
          <button type="button" onClick={() => { void loadFiles(); void loadStats(selectedFileId); }} className={BTN_OUTLINE}>
            <RefreshCcw className="h-4 w-4" /> Yenile
          </button>
        </div>
      </header>

      <section className={`${CARD} p-3 sm:px-4`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {[
            ["Toplam gönderi", stats.total],
            ["İşlenen", stats.processed],
            ["Kalan", remaining],
            ["Bugün işlenen", stats.today],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{Number(value).toLocaleString("tr-TR")}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-500" style={{ width: `${percentage}%` }} />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">%{percentage} tamamlandı</span>
        </div>
      </section>

      {/* Masaüstünde sorgu/alıcı solda, işlem formu sağda. */}
      <section className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(370px,.85fr)]">
        <div className="min-w-0 space-y-4">
        <div className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3 py-3 sm:px-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <ScanLine className="h-4 w-4 text-rose-600" /> 01 · Gönderi
              Sorgulama
            </h2>
            <span className="text-[11px] text-slate-500">
              Barkod / Delivery Number
            </span>
          </div>
          <div className="space-y-3 p-3 sm:p-4">
            <label className={LABEL} htmlFor="aras-file-select">
              Aktif dosya profili
            </label>
            <div className="relative min-w-0">
              <select
                id="aras-file-select"
                className={`${INPUT} appearance-none pr-9`}
                value={selectedFileId}
                onChange={(e) => {
                  setSelectedFileId(e.target.value);
                  clearForm();
                }}
              >
                <option value="">
                  TÜM VERİTABANINDA ÇALIŞ · Otomatik profil tespiti
                </option>
                {files.map((file) => (
                  <option value={file.id} key={file.id}>
                    {file.filename}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Barcode className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  ref={inputRef}
                  value={deliveryNo}
                  onChange={(e) => setDeliveryNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) {
                      e.preventDefault();
                      void lookup();
                    }
                  }}
                  placeholder="Delivery Number okutun..."
                  inputMode="numeric"
                  autoComplete="off"
                  className={`${INPUT} pl-10`}
                  aria-label="Delivery Number"
                />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void lookup()}
                className={`${BTN} w-full border-rose-700 bg-rose-600 text-white hover:bg-rose-700 sm:w-auto sm:min-w-[145px]`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}{" "}
                Sorgula
              </button>
              <button
                type="button"
                onClick={clearForm}
                aria-label="Sorguyu temizle"
                className={`${BTN_OUTLINE} w-full sm:w-auto`}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="sm:hidden">Temizle</span>
              </button>
            </div>
            <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Global
              modda ilk eşleşmede dosya profili otomatik seçilir; başka profilde
              aramak için global moda dönün.
            </div>
          </div>
        </div>

        <div className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <UserRound className="h-4 w-4 text-rose-600" /> 02 · Alıcı ve
              Gönderi Bilgileri
            </h2>
            {group && (
              <span className="rounded-[3px] border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                {group.processed ? "Kayıt güncelleme" : "Yeni gönderi"}
              </span>
            )}
          </div>
          {!group ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="rounded-[5px] bg-slate-100 p-4">
                <ScanLine className="h-9 w-9 text-slate-400" />
              </div>
              <div className="font-semibold">Henüz gönderi seçilmedi</div>
              <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                Sorgudan sonra müşteri bilgileri, adres alanları, SD belgeleri
                ve kopyalama araçları burada görüntülenecek.
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-3 sm:p-4">
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <InfoBox
                  title="Müşteri"
                  value={group.primary.customer_name || "—"}
                  icon={<UserRound className="h-4 w-4" />}
                  onCopy={() =>
                    void copy(group.primary.customer_name || "", "Müşteri adı")
                  }
                />
                <InfoBox
                  title="Telefon"
                  value={group.primary.mobile_number || "—"}
                  icon={<Phone className="h-4 w-4" />}
                  onCopy={() =>
                    void copy(
                      formatPhoneForCopy(group.primary.mobile_number),
                      "Telefon",
                    )
                  }
                />
                <InfoBox
                  title="Delivery Number"
                  value={group.primary.delivery_number}
                  icon={<Barcode className="h-4 w-4" />}
                  onCopy={() =>
                    void copy(group.primary.delivery_number, "Delivery Number")
                  }
                />
                <InfoBox
                  title="SD Document"
                  value={group.uniqueSd.join(" · ") || "—"}
                  icon={<Hash className="h-4 w-4" />}
                  onCopy={() =>
                    void copy(group.uniqueSd.join(", "), "SD Document")
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["Ad", names.first],
                  ["Soyad", names.last],
                  ["Mahalle", address.neighborhood],
                ].map(([title, value]) => (
                  <button
                    type="button"
                    key={title}
                    onClick={() => void copy(value, title)}
                    className="min-h-[68px] min-w-0 rounded-[4px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-rose-300 hover:bg-rose-50"
                  >
                    <div className="mb-1 flex items-center justify-between gap-1 text-[11px] font-bold uppercase text-slate-500">
                      {title}
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                    </div>
                    <div className="break-words text-sm font-semibold leading-5 text-slate-800">
                      {value || "—"}
                    </div>
                  </button>
                ))}
              </div>
              <div className="min-w-0 rounded-[4px] border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={LABEL}>
                    <MapPin className="mr-1 inline h-3.5 w-3.5" /> Adres
                    bilgileri
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline"
                    onClick={() =>
                      void copy(
                        [address.line, address.location]
                          .filter(Boolean)
                          .join(" / "),
                        "Adres",
                      )
                    }
                  >
                    <Copy className="h-3.5 w-3.5" /> Kopyala
                  </button>
                </div>
                <p className="break-words text-sm leading-6 text-slate-800">
                  {address.line || "Adres satırı bulunamadı."}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {address.location || "Konum bilgisi yok"}
                </p>
              </div>
              <div className="rounded-[4px] border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold">
                  <span>Gönderi Satırları</span>
                  <span>
                    {group.count} satır / {group.uniqueSd.length} SD
                  </span>
                </div>
                <div className="max-h-48 overflow-auto">
                  {group.records.map((r, index) => (
                    <div
                      key={r.id || index}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                    >
                      <span className="font-mono text-slate-700">
                        {r.sd_document || "SD belirtilmemiş"}
                      </span>
                      <span
                        className={
                          r.is_processed_aras
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-amber-700"
                        }
                      >
                        {r.is_processed_aras ? "İşlenmiş" : "Bekliyor"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        </div>
        <div className="min-w-0 xl:sticky xl:top-4">
        <div className={`${CARD} min-w-0 overflow-hidden`}>
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Clipboard className="h-4 w-4 text-rose-600" /> 03 · İşlem Durumu
              ve Kayıt
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              İşlem tipine göre gereken alanlar otomatik belirlenir.
            </p>
          </div>
          <div className="space-y-4 p-3 sm:p-5">
            <fieldset disabled={!group || saving}>
              <legend className={LABEL}>İşlem sonucu</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([
                  { value: "success", label: "Gönderildi" },
                  { value: "missing", label: "Eksik bilgi" },
                  { value: "returned", label: "İade" },
                ] as const).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={type === item.value}
                    onClick={() => chooseType(item.value)}
                    className={`min-h-11 rounded-[4px] border px-2 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${type === item.value
                      ? "border-rose-600 bg-rose-50 text-rose-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div
              className={`flex items-start gap-3 rounded-[4px] border p-3 ${type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : type === "missing" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}
            >
              {type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : type === "missing" ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <div className="text-sm font-bold">
                  {type === "success"
                    ? "Başarılı gönderim"
                    : type === "missing"
                      ? "Eksik bilgi kaydı"
                      : "İade kaydı"}
                </div>
                <p className="mt-1 text-xs leading-relaxed">
                  {type === "success"
                    ? "Geçerli takip numarası zorunlu. Hata açıklaması takip alanına kabul edilmez."
                    : type === "missing"
                      ? "missing_address = true kaydedilir. Açıklama yalnızca note alanına yazılır."
                      : "is_returned = true kaydedilir. Hata gerekçesi note alanına yazılır."}
                </p>
              </div>
            </div>
            {type === "success" ? (
              <div>
                <label className={LABEL} htmlFor="aras-tracking">
                  Aras takip numarası <span className="text-rose-600">*</span>
                </label>
                <input
                  id="aras-tracking"
                  disabled={!group || saving}
                  autoComplete="off"
                  className={`${INPUT} mt-1.5 ${trackingNo && !isValidTracking ? "border-rose-400" : ""}`}
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void save();
                    }
                  }}
                  placeholder="Örn: CPR123456789012"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  En az 10 karakter, yalnızca harf/rakam. 5-6 haneli dahili
                  kodlar engellenir.
                </p>
              </div>
            ) : (
              <div>
                <label className={LABEL} htmlFor="aras-reason">
                  {type === "missing"
                    ? "Eksik bilgi gerekçesi"
                    : "İade gerekçesi"}{" "}
                  <span className="text-rose-600">*</span>
                </label>
                <div className="relative mt-1.5">
                  <select
                    id="aras-reason"
                    disabled={!group || saving}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`${INPUT} appearance-none pr-9`}
                  >
                    {(type === "missing"
                      ? MISSING_OPTIONS
                      : RETURN_OPTIONS
                    ).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
            )}
            <div>
              <label className={LABEL} htmlFor="aras-note">
                Ek açıklama{" "}
                {type !== "success" && reason === "other"
                  ? "*"
                  : "(isteğe bağlı)"}
              </label>
              <textarea
                id="aras-note"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value.slice(0, 500))}
                disabled={!group || saving}
                rows={3}
                placeholder="Açıklama yazın..."
                className="mt-1.5 w-full resize-y rounded-[4px] border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 disabled:bg-slate-100"
              />
              <div className="text-right text-[11px] text-slate-400">
                {extraNote.length}/500
              </div>
            </div>
            <div className="rounded-[4px] border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
              <strong>Kayıt önizleme:</strong>{" "}
              {type === "success"
                ? `Takip no: ${trackingNo || "—"}`
                : type === "missing"
                  ? `Eksik adres: EVET • ${MISSING_LABELS[reason] || "—"}`
                  : `İade: EVET • ${RETURN_LABELS[reason] || "—"}`}
            </div>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void save()}
              className={`${BTN} h-12 w-full border-rose-700 bg-rose-600 text-white hover:bg-rose-700`}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}{" "}
              {group?.processed ? "Kaydı Güncelle" : "İşlemi Kaydet"}{" "}
              <ArrowRight className="ml-auto h-4 w-4" />
            </button>
            <p className="text-center text-xs text-slate-500">
              Durum değişikliği, aktif profilin tüm eşleşen ERP satırlarına
              uygulanır.
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* DISA AKTARMA */}
      <section className={`${CARD} p-4`}>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Download className="h-4 w-4 text-rose-600" /> Veri Dışa Aktarma
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Aktif profil:{" "}
              <span className="font-semibold text-slate-800">
                {selectedFileName}
              </span>
              . İkinci sütunda takip numarası; eksik bilgi veya iade varsa kayıtlı gerekçe bulunur.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto">
            <button
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => void exportCsv("short")}
              className={BTN_OUTLINE}
            >
              {exporting === "short" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}{" "}
              2 Sütun: Takip / Sebep
            </button>
            <button
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => void exportCsv("original")}
              className={BTN_OUTLINE}
            >
              {exporting === "original" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}{" "}
              Orijinal Şablon CSV
            </button>
          </div>
        </div>
      </section>

      {/* PROFIL ISLEMLERI ANA OPERASYONDAN AYRI */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Dosya ve Profil Yönetimi</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Yeni dosya ekleme ve mevcut profilleri yönetme işlemleri ayrı
              tutulur.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {files.length} profil
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`${CARD} border-t-[3px] border-t-emerald-500 p-4`}>
            <div className="flex items-start gap-3">
              <div className="rounded-[4px] bg-emerald-50 p-2.5 text-emerald-700">
                <FileUp className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold">Yeni Profil Yükle</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Excel/CSV gönderi dosyanı mevcut yükleme modülüyle içe aktar.
                </p>
                <button
                  type="button"
                  className={`${BTN_OUTLINE} mt-3`}
                  onClick={() => setShowUploader(true)}
                >
                  <FileUp className="h-4 w-4" /> Dosya Yükle
                </button>
              </div>
            </div>
          </div>
          <div className={`${CARD} border-t-[3px] border-t-rose-500 p-4`}>
            <div className="flex items-start gap-3">
              <div className="rounded-[4px] bg-rose-50 p-2.5 text-rose-700">
                <FolderCog className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold">Profilleri Yönet</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Yüklenmiş dosyaları incele, tek profil sil veya tüm
                  veritabanını sıfırla.
                </p>
                <button
                  type="button"
                  className={`${BTN_OUTLINE} mt-3`}
                  onClick={() => setShowProfiles(true)}
                >
                  <FolderCog className="h-4 w-4" /> Profil Yönetimi
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BILDIRIM */}
      {notice && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-[9999] flex max-w-[calc(100vw-2rem)] items-start gap-2 rounded-[5px] border bg-white p-3.5 text-sm shadow-xl sm:max-w-md ${notice.type === "success" ? "border-emerald-300 text-emerald-800" : notice.type === "error" ? "border-rose-300 text-rose-800" : "border-slate-300 text-slate-800"}`}
        >
          {notice.type === "error" ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <BadgeCheck className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1 leading-5">{notice.message}</span>
          <button
            type="button"
            aria-label="Bildirimi kapat"
            onClick={() => setNotice(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* PROFIL YONETIM MODALI */}
      {showProfiles && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-slate-950/65 p-3"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowProfiles(false);
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Profil yönetimi"
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
              <div>
                <h3 className="font-bold">Profil Yönetimi</h3>
                <p className="mt-0.5 text-xs text-slate-300">
                  Yüklü dosyalar ve silme seçenekleri
                </p>
              </div>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setShowProfiles(false)}
                className="rounded-[4px] p-1.5 hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="divide-y divide-slate-200 border border-slate-200">
                {files.length ? (
                  files.map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="break-all text-sm font-semibold">
                          {f.filename}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {fmtDate(f.created_at)}{" "}
                          {f.id === selectedFileId ? "• Aktif profil" : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirm({ id: f.id, name: f.filename })
                        }
                        className={`${BTN} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}
                      >
                        <Trash2 className="h-4 w-4" /> Sil
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Henüz profil yüklenmemiş.
                  </div>
                )}
              </div>
              <div className="mt-5 rounded-[5px] border border-rose-200 bg-rose-50 p-3">
                <div className="flex items-start gap-2 text-sm font-semibold text-rose-900">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> Tehlikeli
                  işlem
                </div>
                <p className="my-2 text-xs leading-5 text-rose-800">
                  Tüm veritabanını sıfırlama, mevcut{" "}
                  <code>deleteArasFile("")</code> işlevini çalıştırır. Geri
                  alınamaz.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setWipeConfirmation("");
                    setConfirm({ id: "", name: "TÜM PROFİLLER VE VERİLER" });
                  }}
                  className={`${BTN} border-rose-700 bg-rose-700 text-white hover:bg-rose-800`}
                >
                  <Trash2 className="h-4 w-4" /> Tüm Veritabanını Sıfırla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SILME ONAYI */}
      {confirm && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/75 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="aras-delete-title"
            className="w-full max-w-md rounded-[5px] border border-rose-300 bg-white p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              <h3 id="aras-delete-title" className="font-bold">
                Kalıcı Silme Onayı
              </h3>
            </div>
            <p className="break-words text-sm leading-6 text-slate-700">
              <strong>{confirm.name}</strong> için silme işlemi geri alınamaz.
              Devam etmek istediğinize emin misiniz?
            </p>
            {!confirm.id && (
              <div className="mt-3">
                <label className={LABEL} htmlFor="aras-confirm-wipe">
                  Tümünü silmek için SIFIRLA yazın
                </label>
                <input
                  id="aras-confirm-wipe"
                  className={`${INPUT} mt-1`}
                  value={wipeConfirmation}
                  onChange={(e) => setWipeConfirmation(e.target.value)}
                  placeholder="SIFIRLA"
                  autoComplete="off"
                />
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => setConfirm(null)}
                className={BTN_OUTLINE}
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={
                  profileBusy || (!confirm.id && wipeConfirmation !== "SIFIRLA")
                }
                onClick={() => void deleteProfile()}
                className={`${BTN} border-rose-700 bg-rose-700 text-white hover:bg-rose-800`}
              >
                {profileBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}{" "}
                Kalıcı Olarak Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESKI EXCEL YUKLEME FONKSIYONU KORUNDU */}
      <ExcelUploadDrawer
        isOpen={showUploader}
        employeeId={employeeId}
        onClose={() => {
          setShowUploader(false);
          void loadFiles();
          void loadStats(selectedFileId);
        }}
      />
    </main>
  );
}

function InfoBox({
  title,
  value,
  icon,
  onCopy,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  onCopy: () => void;
}) {
  return (
    <div className="min-w-0 rounded-[4px] border border-slate-200 bg-white p-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
        {icon}
        {title}
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 break-all text-sm font-semibold leading-5 sm:break-words">
          {value}
        </span>
        <button
          type="button"
          aria-label={`${title} kopyala`}
          onClick={onCopy}
          className="shrink-0 rounded-[3px] border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-rose-600"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
