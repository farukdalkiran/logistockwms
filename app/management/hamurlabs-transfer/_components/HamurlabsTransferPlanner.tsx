"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  AlertCircle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, Download, FileSearch, FileSpreadsheet, Filter,
  Layers, Loader2, PackageCheck, RotateCcw, Search, ShieldCheck,
  SlidersHorizontal, Sparkles, Trash2, UploadCloud, X,
} from "lucide-react";
import { readHamurlabsCartonCatalog } from "@/app/actions/hamurlabs-transfer";
import {
  buildPackLookup, buildStockIndex, countBoxes, eligibilityOf,
  eligibleForTransfer, isValidTransferQuantity, normalizedCode,
  specialListMatches, suggestedTransfer,
  type CatalogProduct, type CatalogBox, type Mode,
  type PlannerSettings, type StockItem, type StockRow,
} from "@/lib/hamurlabs-transfer";
import {
  inspectHamurlabsSpecialFile, readHamurlabsSpecialList, readHamurlabsStockFile,
  exportHamurlabsPickingList, exportHamurlabsTransfer,
  type SpecialSheet,
} from "@/lib/hamurlabs-excel";

type Selection = {
  checked: boolean;
  quantity?: number;
  urgent: boolean;
  allowSingles: boolean;
  packOverride?: number | null;
};
type StockView = {
  item: StockItem;
  selection: Selection;
  pack: number | null;
  ambiguous: boolean;
  knownProduct: boolean;
  suggested: number;
  quantity: number;
  valid: boolean;
  reason: string;
};
type EligibilityFilter = "missing" | "lower" | "both" | "all";
type PageTab = "compare" | "special" | "basket";

const DEFAULT_SELECTION: Selection = { checked: false, urgent: false, allowSingles: false };
const DEFAULT_SETTINGS: PlannerSettings = {
  mode: "units", fixedUnits: 15, fixedBoxes: 1, perProductCap: 0, reserve: 0,
};
const PAGE_SIZE = 40;

function formatCount(value: number) {
  return value.toLocaleString("tr-TR");
}

function NumberField({ label, value, onChange, hint }: {
  label: string; value: number; onChange: (value: number) => void; hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input type="number" min="0" step="1" value={value}
        onChange={event => onChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
      {hint && <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>}
    </label>
  );
}

export default function HamurlabsTransferPlanner() {
  const [catalog, setCatalog] = useState<{ products: CatalogProduct[]; boxes: CatalogBox[] } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [rawRows, setRawRows] = useState<StockRow[]>([]);
  const [stockFiles, setStockFiles] = useState<string[]>([]);
  const [appendStock, setAppendStock] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockNotes, setStockNotes] = useState<string[]>([]);
  const [selection, setSelection] = useState<Record<string, Selection>>({});
  const [tab, setTab] = useState<PageTab>("compare");
  const [eligibilityFilter, setEligibilityFilter] = useState<EligibilityFilter>("missing");
  const [settings, setSettings] = useState<PlannerSettings>(DEFAULT_SETTINGS);
  const [totalCap, setTotalCap] = useState(0);
  const [query, setQuery] = useState("");
  const [minimumCenter, setMinimumCenter] = useState(0);
  const [minimumGap, setMinimumGap] = useState(0);
  const [onlyWithPack, setOnlyWithPack] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const [specialOnly, setSpecialOnly] = useState(false);
  const [specialFileName, setSpecialFileName] = useState("");
  const [pendingSpecialFile, setPendingSpecialFile] = useState<File | null>(null);
  const [specialSheets, setSpecialSheets] = useState<SpecialSheet[]>([]);
  const [specialSheetName, setSpecialSheetName] = useState("");
  const [specialColumn, setSpecialColumn] = useState(-1);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [specialUploaded, setSpecialUploaded] = useState<string[]>([]);
  const [specialInput, setSpecialInput] = useState("");
  const [specialError, setSpecialError] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("gap");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let live = true;
    readHamurlabsCartonCatalog()
      .then(data => { if (live) { setCatalog(data); setCatalogError(""); } })
      .catch(error => { if (live) setCatalogError(error instanceof Error ? error.message : "Koli bilgileri alınamadı."); })
      .finally(() => { if (live) setCatalogLoading(false); });
    return () => { live = false; };
  }, []);

  const items = useMemo(() => buildStockIndex(rawRows), [rawRows]);
  const packLookup = useMemo(() =>
    catalog ? buildPackLookup(catalog.products, catalog.boxes) : null, [catalog]);
  const specialCodes = useMemo(() => new Set([
    ...specialUploaded,
    ...specialInput.split(/[\s,;]+/).map(normalizedCode).filter(Boolean),
  ]), [specialUploaded, specialInput]);

  const views = useMemo<StockView[]>(() => items.map(item => {
    const s = selection[item.key] || DEFAULT_SELECTION;
    const match = packLookup?.(item);
    const pack = s.packOverride !== undefined && s.packOverride !== null
      ? s.packOverride : match?.pack || null;
    const ambiguous = Boolean(match?.ambiguous && !s.packOverride);
    const suggested = suggestedTransfer(item, pack, settings);
    const quantity = s.quantity !== undefined ? s.quantity : suggested;
    let reason = "";
    if (!item.barcode) reason = "HamurLabs çıktısı için barkod gerekli.";
    else if (!eligibleForTransfer(item)) reason = item.active ? "Stok koşuluna uymuyor." : "Ürün pasif.";
    else if (ambiguous) reason = "Birden fazla koli içi adet var; koli adedini elle girin.";
    else if (!isValidTransferQuantity(item, quantity, pack, settings.reserve, settings.perProductCap, s.allowSingles)) {
      reason = "Miktar, koli katı, stok rezervi veya ürün üst limitini kontrol edin.";
    }
    return { item, selection: s, pack, ambiguous, knownProduct: Boolean(match?.productId), suggested, quantity, valid: !reason, reason };
  }), [items, selection, packLookup, settings]);

  const stats = useMemo(() => ({
    missing: views.filter(v => v.item.active && eligibilityOf(v.item) === "missing").length,
    lower: views.filter(v => v.item.active && eligibilityOf(v.item) === "lower").length,
    noPack: views.filter(v => eligibleForTransfer(v.item) && !v.pack).length,
  }), [views]);

  const brands = useMemo(() => [...new Set(items.map(x => x.brand).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "tr")), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return views.filter(v => {
      const kind = eligibilityOf(v.item);
      if (eligibilityFilter !== "all" && eligibilityFilter !== "both" && kind !== eligibilityFilter) return false;
      if (eligibilityFilter === "both" && kind === "none") return false;
      if (eligibilityFilter !== "all" && !v.item.active) return false;
      if (minimumCenter > v.item.center || minimumGap > v.item.center - v.item.online) return false;
      if (onlyWithPack && !v.pack) return false;
      if (onlySelected && !v.selection.checked) return false;
      if (brand && v.item.brand !== brand) return false;
      if (specialOnly && !specialListMatches(v.item, specialCodes)) return false;
      return !q || [v.item.barcode, v.item.ean, v.item.sku, v.item.name, v.item.brand]
        .some(text => text.toLocaleLowerCase("tr-TR").includes(q));
    }).sort((a, b) => {
      if (a.selection.urgent !== b.selection.urgent) return a.selection.urgent ? -1 : 1;
      if (sort === "center") return b.item.center - a.item.center;
      if (sort === "online") return a.item.online - b.item.online;
      if (sort === "name") return a.item.name.localeCompare(b.item.name, "tr");
      return (b.item.center - b.item.online) - (a.item.center - a.item.online);
    });
  }, [views, eligibilityFilter, query, minimumCenter, minimumGap, onlyWithPack,
    onlySelected, brand, specialOnly, specialCodes, sort]);

  useEffect(() => { setPage(1); }, [eligibilityFilter, query, minimumCenter,
    minimumGap, onlyWithPack, onlySelected, brand, specialOnly, sort, tab]);

  const selectedViews = useMemo(() => views.filter(v => v.selection.checked)
    .sort((a, b) => Number(b.selection.urgent) - Number(a.selection.urgent) ||
      a.item.name.localeCompare(b.item.name, "tr")), [views]);
  const selectedQty = selectedViews.reduce((sum, row) => sum + row.quantity, 0);
  const selectedInvalid = selectedViews.filter(row => !row.valid);
  const exceededCap = totalCap > 0 && selectedQty > totalCap;
  const canExport = catalog !== null && !catalogLoading && selectedViews.length > 0 &&
    selectedInvalid.length === 0 && !exceededCap;

  const matchingSpecial = views.filter(v => specialListMatches(v.item, specialCodes));
  const eligibleSpecial = matchingSpecial.filter(v => eligibleForTransfer(v.item));
  const specialKeysFound = new Set<string>();
  matchingSpecial.forEach(v => [v.item.barcode, v.item.ean, v.item.sku].forEach(key => {
    if (specialCodes.has(normalizedCode(key))) specialKeysFound.add(normalizedCode(key));
  }));
  const missingSpecial = [...specialCodes].filter(x => !specialKeysFound.has(x));

  function changeSelection(key: string, patch: Partial<Selection>) {
    setSelection(current => ({
      ...current,
      [key]: { ...DEFAULT_SELECTION, ...(current[key] || {}), ...patch },
    }));
  }

  function selectFiltered(checked: boolean, scope: "filtered" | "page" | "special" = "filtered") {
    const target = scope === "page" ? gridPage : scope === "special" ? eligibleSpecial : filtered;
    setSelection(current => {
      const next = { ...current };
      for (const row of target) {
        if (!eligibleForTransfer(row.item) || !row.item.barcode || (checked && (!row.valid || row.quantity <= 0))) continue;
        next[row.item.key] = { ...DEFAULT_SELECTION, ...(next[row.item.key] || {}), checked };
      }
      return next;
    });
  }

  async function onStockUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setStockLoading(true);
    setMessage("");
    try {
      if (appendStock && files.some(file => stockFiles.includes(file.name))) {
        throw new Error("Bu dosya daha önce yüklendi; stokların iki kez sayılmaması için farklı bir dosya seçin.");
      }
      const combined: StockRow[] = [];
      const warnings: string[] = [];
      const seen = new Set<string>();
      for (const file of files) {
        if (seen.has(file.name + ":" + file.size)) continue;
        seen.add(file.name + ":" + file.size);
        const report = await readHamurlabsStockFile(file);
        combined.push(...report.rows);
        warnings.push(...report.errors);
        if (report.skipped) warnings.push(file.name + ": " + report.skipped + " depo dışı/eksik satır atlandı.");
      }
      if (!combined.length) throw new Error("Yüklenecek stok bulunamadı.");
      setRawRows(current => appendStock ? [...current, ...combined] : combined);
      setStockFiles(current => appendStock ? [...current, ...files.map(f => f.name)] : files.map(f => f.name));
      setStockNotes(current => (appendStock ? [...current, ...warnings] : warnings).slice(0, 12));
      setSelection({});
      setTab("compare");
      setMessage(formatCount(combined.length) + (appendStock ? " stok satırı önceki rapora eklendi." : " stok satırı analiz edildi.") + " Transfer için ürün seçebilirsiniz.");
    } catch (error) {
      setMessage((error instanceof Error ? error.message : "Stok raporu açılamadı.") + (stockFiles.length ? " Önceki rapor korunuyor." : ""));
    } finally {
      setStockLoading(false);
    }
  }

  async function onSpecialUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSpecialError("");
    setCampaignLoading(true);
    try {
      const sheets = await inspectHamurlabsSpecialFile(file);
      const first = sheets.find(sheet => sheet.suggestedColumn >= 0) || sheets[0];
      setPendingSpecialFile(file);
      setSpecialSheets(sheets);
      setSpecialSheetName(first.sheetName);
      setSpecialColumn(first.suggestedColumn);
      setTab("special");
    } catch (error) {
      setSpecialError(error instanceof Error ? error.message : "Özel liste açılamadı.");
      setPendingSpecialFile(null);
    } finally {
      setCampaignLoading(false);
    }
  }

  async function applySpecialColumn() {
    if (!pendingSpecialFile || specialColumn < 0) {
      setSpecialError("Barkodların bulunduğu sütunu seçmelisin.");
      return;
    }
    const sheet = specialSheets.find(s => s.sheetName === specialSheetName);
    if (!sheet || !sheet.columns.some(column => column.index === specialColumn)) return;
    setCampaignLoading(true);
    setSpecialError("");
    try {
      const codes = await readHamurlabsSpecialList(pendingSpecialFile, sheet.sheetName, specialColumn, sheet.headerRow);
      if (!codes.length) throw new Error("Seçilen sütunda barkod bulunamadı.");
      setSpecialUploaded(codes);
      setSpecialFileName(pendingSpecialFile.name);
      setSpecialOnly(true);
      setEligibilityFilter("both");
      setTab("special");
      setPendingSpecialFile(null);
      setMessage(formatCount(codes.length) + " barkod seçilen sütundan alındı. Ürünler otomatik transfere eklenmedi.");
    } catch (error) {
      setSpecialError(error instanceof Error ? error.message : "Barkodlar okunamadı.");
    } finally {
      setCampaignLoading(false);
    }
  }

  function clearPlan() {
    if (selectedViews.length > 0 && !window.confirm("Seçilen tüm transfer satırları sıfırlansın mı?")) return;
    setSelection({});
  }

  function download(kind: "hamurlabs" | "picking") {
    if (!canExport) return;
    const lines = selectedViews.map(v => ({
      sku: v.item.sku, barcode: v.item.barcode, name: v.item.name,
      center: v.item.center, online: v.item.online,
      quantity: v.quantity, pack: v.pack,
      ...countBoxes(v.quantity, v.pack), urgent: v.selection.urgent,
    }));
    if (kind === "hamurlabs") exportHamurlabsTransfer(lines);
    else exportHamurlabsPickingList(lines);
    setReviewOpen(false);
  }

  const gridPage = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const eligibleFiltered = filtered.filter(row => eligibleForTransfer(row.item) && row.item.barcode && row.valid && row.quantity > 0);
  const eligiblePage = gridPage.filter(row => eligibleForTransfer(row.item) && row.item.barcode && row.valid && row.quantity > 0);
  const selectedFilteredCount = eligibleFiltered.filter(row => row.selection.checked).length;
  const selectedPageCount = eligiblePage.filter(row => row.selection.checked).length;
  const allPageSelected = eligiblePage.length > 0 && selectedPageCount === eligiblePage.length;
  const activeSpecialSheet = specialSheets.find(sheet => sheet.sheetName === specialSheetName);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5 pb-12 text-slate-800">
      <header className="overflow-hidden rounded-[7px] border border-slate-800 bg-[#101a2d] shadow-lg">
        <div className="h-1.5 bg-[#dc3545]" />
        <div className="flex flex-col gap-5 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[6px] bg-white p-2 shadow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://lego.hamurlabs.io/site_media/images/favicon.ico"
                alt="HamurLabs" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-red-300">
                <span>HamurLabs Entegrasyonu</span><span className="h-1 w-1 rounded-full bg-slate-500" />
                <span>Excel Planlama</span>
              </div>
              <h1 className="text-xl font-black tracking-tight text-white md:text-2xl">Merkez → Online Transfer Planlama</h1>
              <p className="mt-1 max-w-2xl text-xs text-slate-300">
                Stok raporlarını karşılaştır, koli bazında planla, istediğin ürünleri onayla ve HamurLabs çıktısı oluştur.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[5px] border border-slate-700 bg-slate-900/60 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://lego.storeturkey.com.tr/Data/EditorFiles/brand-lego-1.svg"
              alt="LEGO" className="h-10 w-10 shrink-0 object-contain" />
            <div className="text-xs font-bold text-white">
              <p>HAMURLABS</p><p className="mt-0.5 text-[10px] font-medium text-slate-400">Stok değiştirmeyen bağımsız araç</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Toplam stok çeşidi", value: items.length, subtitle: "Excel'den okundu", icon: Layers },
          { label: "Online depoda bulunmayan", value: stats.missing, subtitle: "Merkezde stok var", icon: FileSearch },
          { label: "Online depoda daha az", value: stats.lower, subtitle: "Farkı pozitif", icon: SlidersHorizontal },
          { label: "Seçilmiş transfer", value: selectedViews.length, subtitle: formatCount(selectedQty) + " adet", icon: ClipboardCheck },
        ].map(card => (
          <div key={card.label} className="rounded-[5px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wide">{card.label}</span>
              <card.icon size={17} className="text-[#dc3545]" />
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums">{formatCount(card.value)}</p>
            <p className="mt-1 text-sm text-slate-600">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <label className="flex min-h-40 cursor-pointer flex-col justify-between rounded-[6px] border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm transition hover:border-red-400 hover:bg-red-50/30">
          <input type="file" accept=".xlsx,.xls" multiple className="sr-only"
            onChange={event => void onStockUpload(event)} disabled={stockLoading} />
          <div className="flex items-center gap-3">
            <span className="rounded bg-red-50 p-3 text-[#dc3545]"><UploadCloud size={23} /></span>
            <div><h2 className="text-sm font-black">1. Depo bazlı stok raporu yükle</h2>
              <p className="mt-1 text-[11px] text-slate-500">Merkez + Yeni Depo tek dosyada veya ayrı Excel'ler</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-700">
            {stockLoading ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            {stockLoading ? "Rapor okunuyor..." : stockFiles.length ? stockFiles.join(", ") : "Excel dosyası seç · XLSX / XLS"}
          </div>
        </label>
        <label className="flex min-h-40 cursor-pointer flex-col justify-between rounded-[6px] border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm transition hover:border-red-400 hover:bg-red-50/30">
          <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={event => void onSpecialUpload(event)} />
          <div className="flex items-center gap-3">
            <span className="rounded bg-slate-100 p-3 text-slate-700"><FileSearch size={23} /></span>
            <div><h2 className="text-sm font-black">2. Kampanya / özel ürün listesi</h2>
              <p className="mt-1 text-sm text-slate-600">Excel sayfasını ve <strong>barkod sütununu</strong> seçerek toplu uygunluk sorgula</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-700">
            <FileSpreadsheet size={15} />
            {pendingSpecialFile ? pendingSpecialFile.name + " · sütun seçimi bekleniyor" : specialFileName ? specialFileName + " · " + formatCount(specialUploaded.length) + " kod" : "Kampanya Excel dosyasını seç"}
          </div>
        </label>
      </section>

      {stockFiles.length > 0 && <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <input type="checkbox" checked={appendStock} onChange={e => setAppendStock(e.target.checked)} className="accent-red-600" />
        Yeni seçilecek Excel dosyalarını mevcut stok raporuna ekle (ayrı Merkez ve Yeni Depo raporları için)
      </label>}

      {(message || catalogError || stockNotes.length > 0 || specialError) && (
        <div className="space-y-1 rounded-[5px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {message && <p>{message}</p>}
          {catalogError && <p><AlertCircle size={14} className="mr-1 inline" /> Koli kataloğu: {catalogError}</p>}
          {specialError && <p>{specialError}</p>}
          {stockNotes.map((note, index) => <p key={index}>• {note}</p>)}
        </div>
      )}
      {catalogLoading && <p className="flex items-center gap-2 text-xs text-slate-600"><Loader2 size={14} className="animate-spin" /> Supabase ürün/koli bilgileri hazırlanıyor...</p>}
      {catalog && <p className="flex items-center gap-2 text-[11px] text-emerald-700">
        <ShieldCheck size={14} /> Supabase: {formatCount(catalog.products.length)} ürün, {formatCount(catalog.boxes.length)} koli tanımı okundu. Veritabanına yazılmaz.
      </p>}

      <div className="flex flex-wrap gap-2 rounded-[5px] border border-slate-200 bg-white p-2 shadow-sm">
        {([
          ["compare", "Stok karşılaştırma", Filter],
          ["special", "Özel liste sorgula", Search],
          ["basket", "Transfer listem", PackageCheck],
        ] as const).map(([key, label, Icon]) => (
          <button type="button" key={key} onClick={() => {
            setTab(key);
            if (key === "special") { setSpecialOnly(true); setEligibilityFilter("both"); }
            if (key === "basket") setOnlySelected(true);
            else setOnlySelected(false);
          }} className={"inline-flex items-center gap-2 rounded-[4px] px-4 py-2.5 text-xs font-bold transition " +
            (tab === key ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100")}>
            <Icon size={15} /> {label}
            {key === "basket" && <span className="rounded bg-white/15 px-1.5 py-0.5">{selectedViews.length}</span>}
          </button>
        ))}
      </div>

      {pendingSpecialFile && activeSpecialSheet && (
        <section className="rounded-lg border-2 border-blue-200 bg-blue-50 p-5 shadow-sm" aria-label="Kampanya Excel sütun eşleştirme">
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-slate-900">Kampanya Excel'i — barkod sütununu seç</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              <strong>{pendingSpecialFile.name}</strong> dosyasında hangi sütunda ürün barkodları varsa onu seç.
              Sadece bu sütundaki değerler sorgulanır; diğer alanlar görmezden gelinir.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">Excel sayfası
              <select value={specialSheetName} onChange={event => {
                const next = specialSheets.find(s => s.sheetName === event.target.value);
                setSpecialSheetName(event.target.value);
                setSpecialColumn(next?.suggestedColumn ?? -1);
              }} className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                {specialSheets.map(sheet => <option key={sheet.sheetName} value={sheet.sheetName}>{sheet.sheetName}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">Barkod sütunu
              <select value={specialColumn} onChange={event => setSpecialColumn(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value={-1}>Barkod sütununu seç...</option>
                {activeSpecialSheet.columns.map(column =>
                  <option key={column.index} value={column.index}>
                    Sütun {column.index + 1} — {column.label}
                  </option>)}
              </select>
            </label>
          </div>
          {specialColumn >= 0 && <div className="mt-3 rounded-md border border-blue-100 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Seçilen sütundaki örnek değerler</p>
            <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-800">
              {activeSpecialSheet.columns.find(column => column.index === specialColumn)?.sample.join(" · ") || "Boş sütun"}
            </p>
          </div>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => void applySpecialColumn()} disabled={specialColumn < 0 || campaignLoading}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#dc3545] px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40">
              {campaignLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Seçilen barkod sütunuyla sorgula
            </button>
            <button type="button" onClick={() => { setPendingSpecialFile(null); setSpecialSheets([]); }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">İptal</button>
          </div>
        </section>
      )}

      {tab === "special" && (
        <section className="rounded-[5px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-[#dc3545]" />
            <h2 className="text-lg font-extrabold">Toplu kampanya / özel ürün sorgulama</h2>
          </div>
          <p className="mb-3 text-sm leading-relaxed text-slate-700">
            Kampanya Excel'inde seçtiğin barkod sütunu veya buraya yapıştırdığın barkodlarla stok raporu karşılaştırılır.
            Eşleşen ürünler otomatik eklenmez; listeye alacağın ürünleri sen belirlersin.
          </p>
          <textarea value={specialInput} onChange={e => { setSpecialInput(e.target.value); setSpecialOnly(true); }}
            rows={4} placeholder={"Barkodları alt alta ya da virgülle ayırarak yaz...\n4895028526511\n4895028515133"}
            className="w-full rounded-md border border-slate-300 p-3 font-mono text-sm leading-6 outline-none focus:border-red-500" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              <strong>{formatCount(specialCodes.size)}</strong> kod sorguda · <strong>{formatCount(matchingSpecial.length)}</strong> eşleşen ·
              <strong> {formatCount(eligibleSpecial.length)}</strong> transfere uygun · <strong>{formatCount(missingSpecial.length)}</strong> bulunamadı
            </p>
            <button type="button" onClick={() => {
              setSpecialUploaded([]); setSpecialInput(""); setSpecialFileName(""); setSpecialOnly(false);
            }} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-red-600">
              <Trash2 size={14} /> Özel listeyi temizle
            </button>
          </div>
          {eligibleSpecial.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm font-semibold text-slate-800">{eligibleSpecial.length} uygun kampanya ürünü bulundu</span>
              <button type="button" onClick={() => selectFiltered(true, "special")}
                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700">
                Uygun kampanya ürünlerinin tümünü seç
              </button>
              <button type="button" onClick={() => selectFiltered(false, "special")}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800">
                Kampanya seçimini kaldır
              </button>
            </div>
          )}
          {missingSpecial.length > 0 && (
            <details className="mt-3 text-xs text-amber-800">
              <summary className="cursor-pointer font-bold">Stok raporunda bulunamayan kodlar ({missingSpecial.length})</summary>
              <p className="mt-2 max-h-24 overflow-auto rounded bg-amber-50 p-2 font-mono break-all">{missingSpecial.slice(0, 100).join(" · ")}</p>
            </details>
          )}
        </section>
      )}

      <section className="rounded-[5px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-extrabold text-slate-900">Transfer miktarı kuralları</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">Koli bilgisi varsa tam koliye aşağı yuvarlanır. Manuel düzenlemeler ürün bazında korunur.</p>
          </div>
          <button type="button" title="Miktar ayarlarını sıfırla" onClick={() => { setSettings(DEFAULT_SETTINGS); setTotalCap(0); }}
            className="rounded border border-slate-200 p-2 text-slate-500 hover:text-red-600"><RotateCcw size={17} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Miktar hesaplama</span>
            <select value={settings.mode} onChange={e => setSettings(s => ({ ...s, mode: e.target.value as Mode }))}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-bold">
              <option value="units">Standart adet</option>
              <option value="boxes">Sabit tam koli</option>
              <option value="balance">Depoları dengele</option>
              <option value="all">Merkezdeki uygun tüm stok</option>
            </select>
          </label>
          {settings.mode === "boxes" ?
            <NumberField label="Her ürüne kaç koli?" value={settings.fixedBoxes}
              onChange={n => setSettings(s => ({ ...s, fixedBoxes: n }))} /> :
            <NumberField label="Standart adet" value={settings.fixedUnits}
              onChange={n => setSettings(s => ({ ...s, fixedUnits: n }))} hint={settings.mode === "units" ? "Örn. 15 adet" : "Standart modunda kullanılır"} />
          }
          <NumberField label="Ürün başı üst limit" value={settings.perProductCap}
            onChange={n => setSettings(s => ({ ...s, perProductCap: n }))} hint="0 = sınırsız" />
          <NumberField label="Merkezde bırakılacak" value={settings.reserve}
            onChange={n => setSettings(s => ({ ...s, reserve: n }))} hint="Her üründen asgari adet" />
          <NumberField label="Toplam transfer üst limiti" value={totalCap} onChange={setTotalCap}
            hint="0 = sınırsız · aşılırsa çıktı engellenir" />
        </div>
        <div className="mt-3 rounded-[5px] bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
          <strong>Tekli ürün istisnası:</strong> Online depoda hiç yoksa ve merkezde rezerv sonrası kalan miktar bir koliden azsa,
          tüm uygun tekil adetler önerilir. Koli büyüklüğü çakışan ürünlerde elle seçim gerekir.
          Koli bilgisi olmayan ürünlerde standart tekil adet uygulanır.
        </div>
      </section>

      <section className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold text-slate-900">Ürün uygunluğu ve transfer seçimi</h2>
              <p className="mt-1 text-[11px] text-slate-500">{formatCount(filtered.length)} filtreye uyan · {formatCount(views.length)} toplam ürün · {selectedFilteredCount} seçili</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => selectFiltered(true, "filtered")} disabled={!eligibleFiltered.length}
                className="min-h-11 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40">
                Filtrelenen tüm uygun ürünleri seç ({eligibleFiltered.length})
              </button>
              <button type="button" onClick={() => selectFiltered(false, "filtered")}
                className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100">
                Filtrelenenlerin seçimini kaldır
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Stok koşulu</span>
              <select value={eligibilityFilter} onChange={e => setEligibilityFilter(e.target.value as EligibilityFilter)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="missing">Online depoda hiç yok</option>
                <option value="lower">Online depoda daha az</option>
                <option value="both">İki uygun filtre birlikte</option>
                <option value="all">Tüm ürünler (inceleme)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Barkod / SKU / Ürün</span>
              <div className="relative"><Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ara..."
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-red-400" />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Marka</span>
              <select value={brand} onChange={e => setBrand(e.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Tüm markalar</option>
                {brands.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <NumberField label="Minimum merkez stoku" value={minimumCenter} onChange={setMinimumCenter} />
            <NumberField label="Minimum stok farkı" value={minimumGap} onChange={setMinimumGap} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5 rounded-md border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked={onlyWithPack}
              onChange={e => setOnlyWithPack(e.target.checked)} className="accent-red-600" /> Koli bilgisi olanlar</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={specialOnly}
              onChange={e => setSpecialOnly(e.target.checked)} className="accent-red-600" /> Sadece özel listemdeki ürünler</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={onlySelected}
              onChange={e => setOnlySelected(e.target.checked)} className="accent-red-600" /> Seçilmiş ürünler</label>
            <label className="ml-auto flex items-center gap-2">Sırala:
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1">
                <option value="gap">En büyük stok farkı</option>
                <option value="center">Merkez stok yüksek</option>
                <option value="online">Online stok düşük</option>
                <option value="name">Ürün adı</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-800">
            <input type="checkbox" checked={allPageSelected} disabled={!eligiblePage.length}
              onChange={event => selectFiltered(event.target.checked, "page")}
              className="h-5 w-5 accent-[#dc3545]" />
            Bu sayfadaki uygun ürünlerin tümünü seç ({eligiblePage.length})
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span>{selectedPageCount} / {eligiblePage.length} seçili</span>
            <button type="button" onClick={() => selectFiltered(false, "page")} disabled={!selectedPageCount}
              className="rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40">
              Sayfa seçimini kaldır
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1190px] text-left text-sm">
            <thead className="bg-slate-200 text-xs font-extrabold uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-3 py-3 text-center">Seç</th>
                <th className="px-3 py-3">Ürün / Barkod</th>
                <th className="px-3 py-3 text-center">Merkez</th>
                <th className="px-3 py-3 text-center">Online</th>
                <th className="px-3 py-3 text-center">Fark</th>
                <th className="px-3 py-3 text-center">Koli içi</th>
                <th className="px-3 py-3 text-center">Transfer adedi</th>
                <th className="px-3 py-3 text-center">Koli + Tekil</th>
                <th className="px-3 py-3 text-center">Acil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {gridPage.map(row => {
                const i = row.item;
                const pieces = countBoxes(row.quantity, row.pack);
                return (
                  <tr key={i.key} className={row.selection.checked ? "bg-red-50 hover:bg-red-100/60" : "odd:bg-white even:bg-slate-50 hover:bg-blue-50/60"}>
                    <td className="px-3 py-3 text-center align-top">
                      <input type="checkbox" checked={row.selection.checked}
                        disabled={!eligibleForTransfer(i) || !i.barcode}
                        onChange={e => changeSelection(i.key, { checked: e.target.checked })}
                        aria-label={i.name + " transfere seç"}
                        className="mt-2 h-5 w-5 accent-[#dc3545]" />
                    </td>
                    <td className="min-w-[290px] max-w-[430px] px-4 py-4 align-top">
                      <p className="text-sm font-bold leading-6 text-slate-950">{i.name || "İsimsiz ürün"}</p>
                      <p className="mt-1 font-mono text-xs font-medium text-slate-600">Barkod: {i.barcode || "Yok"} · SKU: {i.sku || "Yok"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {eligibilityOf(i) === "missing" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Online yok</span>}
                        {eligibilityOf(i) === "lower" && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">Online az</span>}
                        {!i.active && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold">Pasif</span>}
                        {row.ambiguous && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Koli çakışması</span>}
                        {!row.knownProduct && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">Katalogda yok</span>}
                      </div>
                      {row.selection.checked && !row.valid && <p className="mt-2 text-xs font-bold text-red-700">{row.reason}</p>}
                    </td>
                    <td className="px-3 py-4 text-center align-top font-bold tabular-nums">{formatCount(i.center)}</td>
                    <td className="px-3 py-4 text-center align-top font-bold tabular-nums">{formatCount(i.online)}</td>
                    <td className="px-3 py-4 text-center align-top tabular-nums text-slate-500">{formatCount(i.center - i.online)}</td>
                    <td className="px-2 py-3 text-center align-top">
                      <input type="number" min="1" step="1" title="Koli içi adet: elle değiştirebilirsin"
                        value={row.pack || ""} placeholder="—"
                        onChange={e => changeSelection(i.key, { packOverride: e.target.value === "" ? null : Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                        className="h-11 w-20 rounded-md border border-slate-300 bg-white px-2 text-center text-sm font-bold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
                      {row.selection.packOverride && <button type="button" onClick={() => changeSelection(i.key, { packOverride: null })}
                        className="mt-1 block w-full text-xs text-slate-600 underline">DB'ye dön</button>}
                    </td>
                    <td className="px-2 py-3 text-center align-top">
                      <input type="number" min="0" step="1" value={row.quantity}
                        disabled={!eligibleForTransfer(i)}
                        onChange={e => changeSelection(i.key, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        className={"h-11 w-24 rounded-md border bg-white px-2 text-center text-base font-extrabold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 " +
                          (row.selection.checked && !row.valid ? "border-red-500 text-red-700" : "border-slate-300")} />
                      {row.selection.quantity !== undefined &&
                        <button type="button" onClick={() => changeSelection(i.key, { quantity: undefined })}
                          className="mt-1 block w-full text-xs text-slate-600 underline">Otomatik ({row.suggested})</button>}
                    </td>
                    <td className="px-2 py-3 text-center align-top">
                      <p className="mt-2 whitespace-nowrap text-sm font-bold text-slate-800">{pieces.boxes} koli + {pieces.singles} tekil</p>
                      {row.pack && row.pack > 1 && (
                        <label className="mt-2 flex cursor-pointer items-center justify-center gap-1 text-xs text-slate-700">
                          <input type="checkbox" checked={row.selection.allowSingles}
                            onChange={e => changeSelection(i.key, { allowSingles: e.target.checked })} />
                          Tekil istisna
                        </label>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center align-top">
                      <button type="button" onClick={() => changeSelection(i.key, { urgent: !row.selection.urgent })}
                        aria-label={i.name + " aciliyet değiştir"}
                        className={"mt-1 rounded-md px-3 py-2 text-xs font-bold " +
                          (row.selection.urgent ? "bg-red-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-red-50")}>
                        {row.selection.urgent ? "ACİL" : "Normal"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {gridPage.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-sm text-slate-500">
                  {items.length === 0 ? "Başlamak için depo stok Excel'ini yükle." : "Bu koşullara uygun ürün bulunamadı."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-600">Sayfa {page}/{totalPages} · Sayfa başı {PAGE_SIZE} ürün</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(n => Math.max(1, n - 1))} disabled={page <= 1}
              className="rounded border border-slate-300 bg-white p-2 disabled:opacity-30"><ChevronLeft size={15} /></button>
            <button type="button" onClick={() => setPage(n => Math.min(totalPages, n + 1))} disabled={page >= totalPages}
              className="rounded border border-slate-300 bg-white p-2 disabled:opacity-30"><ChevronRight size={15} /></button>
          </div>
        </div>
      </section>

      <section className="sticky bottom-3 z-30 flex flex-col gap-3 rounded-[6px] border border-slate-800 bg-[#101a2d] p-4 text-white shadow-2xl md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Onay bekleyen transfer listesi</p>
          <p className="mt-1 text-lg font-black">
            {formatCount(selectedViews.length)} ürün <span className="text-slate-500">·</span> {formatCount(selectedQty)} adet
          </p>
          {exceededCap && <p className="text-[11px] font-bold text-red-300">Toplam transfer üst limiti aşıldı ({formatCount(totalCap)} adet).</p>}
          {selectedInvalid.length > 0 && <p className="text-[11px] font-bold text-red-300">{selectedInvalid.length} ürünün miktarı/koli bilgisi düzeltilmeli.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={clearPlan} disabled={!selectedViews.length}
            className="flex items-center gap-2 rounded-[4px] border border-slate-600 px-3 py-2.5 text-xs font-bold hover:bg-slate-800 disabled:opacity-40">
            <Trash2 size={15} /> Listeyi temizle
          </button>
          <button type="button" onClick={() => { setTab("basket"); setOnlySelected(true); }}
            className="flex items-center gap-2 rounded-[4px] border border-slate-600 px-3 py-2.5 text-xs font-bold hover:bg-slate-800">
            <ClipboardCheck size={15} /> Seçilenleri incele
          </button>
          <button type="button" onClick={() => setReviewOpen(true)} disabled={!canExport}
            className="flex items-center gap-2 rounded-[4px] bg-[#dc3545] px-4 py-2.5 text-xs font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Download size={16} /> HamurLabs Excel hazırla <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {reviewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Transfer onayı">
          <div className="w-full max-w-xl rounded-[7px] border border-slate-300 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-black">Transfer dosyasını onayla</h2>
                <p className="mt-1 text-xs text-slate-500">Yalnızca tek tek veya toplu olarak seçtiğin ürünler dışa aktarılır.</p></div>
              <button type="button" onClick={() => setReviewOpen(false)} aria-label="Kapat" className="rounded p-1 hover:bg-slate-100"><X size={19} /></button>
            </div>
            <div className="my-4 grid grid-cols-3 gap-2">
              {[
                ["Ürün çeşidi", selectedViews.length],
                ["Transfer adedi", selectedQty],
                ["Acil ürün", selectedViews.filter(x => x.selection.urgent).length],
              ].map(([title, number]) => <div key={title} className="rounded bg-slate-100 p-3">
                <p className="text-[10px] text-slate-500">{title}</p>
                <p className="mt-1 text-xl font-black">{formatCount(Number(number))}</p>
              </div>)}
            </div>
            <p className="text-xs text-slate-600">HamurLabs çıktısı yalnızca 9 standart sütun içerir. Ürün Kodu ve fiyat alanları boş; Barkod ve Adet dolu olacaktır. Koli dökümü ayrıca indirilebilir.</p>
            {!canExport && <p className="mt-3 text-xs font-bold text-red-600">Liste geçerli değil. Kapatıp sorunlu miktarları düzeltin.</p>}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => download("picking")} disabled={!canExport}
                className="flex flex-1 items-center justify-center gap-2 rounded border border-slate-300 px-3 py-3 text-xs font-bold hover:bg-slate-100 disabled:opacity-40">
                <FileSpreadsheet size={16} /> Toplama Listesi Excel
              </button>
              <button type="button" onClick={() => download("hamurlabs")} disabled={!canExport}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-[#dc3545] px-3 py-3 text-xs font-black text-white hover:bg-red-700 disabled:opacity-40">
                <CheckCircle2 size={16} /> Onayla ve HamurLabs indir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
