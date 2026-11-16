import * as XLSX from "xlsx";
import {
  normalizeHeader, normalizedCode, warehouseFromName, wholeNumber,
  type StockRow,
} from "@/lib/hamurlabs-transfer";

export const HAMURLABS_COLUMNS = [
  "Ürün Kodu", "Barkod", "Alım Fiyatı", "Satış Fiyatı", "KDV",
  "Adet", "Paket Takip Numarası", "KDV'siz Satış Fiyatı", "Piyasa Fiyatı",
] as const;

type ReportResult = {
  rows: StockRow[];
  errors: string[];
  skipped: number;
};

const compact = (value: unknown) => normalizeHeader(value);
const indexOfHeading = (headings: unknown[], variants: string[]) =>
  headings.findIndex(h => variants.some(v => compact(h) === compact(v)));

const num = (value: unknown) => wholeNumber(value);

export async function readHamurlabsStockFile(file: File): Promise<ReportResult> {
  if (!/\.xlsx?$/i.test(file.name) || file.size > 25 * 1024 * 1024) {
    throw new Error("Stok raporu .xlsx veya .xls olmalı ve 25 MB'ı aşmamalı.");
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellText: true });
  const rows: StockRow[] = [];
  const errors: string[] = [];
  let skipped = 0;
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
    let headerAt = -1;
    let indices: Record<string, number> = {};
    for (let n = 0; n < Math.min(30, grid.length); n++) {
      const cells = grid[n] || [];
      const map = {
        barcode: indexOfHeading(cells, ["Barkod", "Ürün Barkodu"]),
        ean: indexOfHeading(cells, ["EAN", "EAN Barkod"]),
        sku: indexOfHeading(cells, ["SKU", "Stok Kodu"]),
        code: indexOfHeading(cells, ["Kod"]),
        name: indexOfHeading(cells, ["Ürün Adı", "Urun Adi"]),
        brand: indexOfHeading(cells, ["Marka"]),
        sellable: indexOfHeading(cells, ["Satılabilir Adet", "Satilabilir Adet"]),
        racked: indexOfHeading(cells, ["Raflanan Miktar"]),
        depot: indexOfHeading(cells, ["Depo", "Depo Adı"]),
        active: indexOfHeading(cells, ["Aktif mi"]),
      };
      if ((map.barcode >= 0 || map.ean >= 0 || map.sku >= 0) &&
           map.sellable >= 0 && map.depot >= 0) {
        indices = map;
        headerAt = n;
        break;
      }
    }
    if (headerAt === -1) {
      errors.push(sheetName + ": gerekli Barkod/EAN, Satılabilir Adet ve Depo başlıkları bulunamadı.");
      continue;
    }
    const at = (cells: unknown[], key: string) =>
      indices[key] >= 0 ? cells[indices[key]] : "";
    for (let line = headerAt + 1; line < grid.length; line++) {
      const cells = grid[line] || [];
      if (cells.every(v => String(v ?? "").trim() === "")) continue;
      let depot = warehouseFromName(at(cells, "depot"));
      let depotPos = indices.depot;
      if (!depot) {
        const found = cells.findIndex(cell => warehouseFromName(cell) !== null);
        if (found !== -1) {
          depotPos = found;
          depot = warehouseFromName(cells[found]);
        }
      }
      if (!depot) { skipped++; continue; }
      const barcode = normalizedCode(at(cells, "barcode") || at(cells, "ean"));
      const ean = normalizedCode(at(cells, "ean"));
      const sku = normalizedCode(at(cells, "sku"));
      if (!barcode && !sku) { skipped++; continue; }
      let sellable = num(at(cells, "sellable"));
      let racked = num(at(cells, "racked"));
      // Some exported reports omit a header cell and shift the depot by one.
      if (depotPos !== indices.depot || sellable === null) {
        const near = num(cells[depotPos - 2]);
        const previous = num(cells[depotPos - 1]);
        if (near !== null && previous !== null) {
          sellable = near;
          racked = previous;
        } else if (previous !== null) sellable = previous;
      }
      if (sellable === null) {
        errors.push(sheetName + " satır " + (line + 1) + ": geçersiz satılabilir adet.");
        continue;
      }
      const listedName = String(at(cells, "name") || "").trim();
      const codeName = String(at(cells, "code") || "").trim();
      const shifted = listedName.length <= 12 && codeName.length > 12;
      const name = shifted ? codeName : listedName || codeName;
      const activeValue = String(at(cells, "active") ||
        cells.find(v => /^(evet|hayir|hayır)$/i.test(String(v).trim())) || "").trim().toLocaleLowerCase("tr-TR");
      rows.push({
        barcode, ean, sku, name, brand: shifted ? listedName : String(at(cells, "brand") || "").trim(),
        warehouse: depot, sellable, racked: racked ?? 0,
        active: !["hayır", "hayir", "pasif", "false", "0"].includes(activeValue),
      });
    }
  }
  if (!rows.length) throw new Error(errors.join(" ") || "Excel'de geçerli depo stoku bulunamadı.");
  return { rows, errors, skipped };
}

export async function readHamurlabsSpecialList(file: File): Promise<string[]> {
  if (!/\.xlsx?$/i.test(file.name) || file.size > 15 * 1024 * 1024) {
    throw new Error("Özel liste .xlsx veya .xls olmalı ve 15 MB'ı aşmamalı.");
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellText: true });
  const keys = new Set<string>();
  for (const sheetName of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1, defval: "", raw: false,
    });
    const headerIndex = grid.findIndex((row, i) => i < 15 &&
      row.some(x => ["Barkod", "EAN", "SKU", "Ürün Kodu"].some(h => compact(x) === compact(h))));
    const header = headerIndex >= 0 ? grid[headerIndex] : [];
    const keyIndex = headerIndex >= 0
      ? indexOfHeading(header, ["Barkod", "EAN", "SKU", "Ürün Kodu"])
      : 0;
    for (const row of grid.slice(headerIndex >= 0 ? headerIndex + 1 : 0)) {
      const code = normalizedCode(row[keyIndex]);
      if (code && !["BARKOD", "EAN", "SKU", "ÜRÜNKODU", "URUNKODU"].includes(code.replace(/\s+/g, ""))) {
        keys.add(code);
      }
    }
  }
  return [...keys];
}

export function exportHamurlabsTransfer(rows: { barcode: string; quantity: number }[]) {
  const header = [...HAMURLABS_COLUMNS];
  const grid: (string | number)[][] = [header];
  for (const row of rows) {
    grid.push(["", normalizedCode(row.barcode), "", "", "", row.quantity, "", "", ""]);
  }
  const ws = XLSX.utils.aoa_to_sheet(grid);
  ws["!cols"] = [16, 22, 17, 17, 10, 12, 25, 25, 18].map(wch => ({ wch }));
  for (let r = 1; r <= rows.length; r++) {
    const cell = ws["B" + (r + 1)];
    if (cell) { cell.t = "s"; cell.z = "@"; }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, "Transfer");
  XLSX.writeFile(workbook, "HamurLabs_Merkez_Online_Transfer.xlsx", { bookType: "xlsx" });
}

export function exportHamurlabsPickingList(rows: {
  sku: string; barcode: string; name: string; center: number; online: number;
  quantity: number; pack: number | null; boxes: number; singles: number; urgent: boolean;
}[]) {
  const grid: (string | number)[][] = [[
    "SKU", "Barkod", "Ürün Adı", "Merkez Stok", "Online Stok",
    "Transfer Adedi", "Koli İçi", "Tam Koli", "Tekil Adet", "Öncelik",
  ]];
  rows.forEach(row => grid.push([
    row.sku, row.barcode, row.name, row.center, row.online, row.quantity,
    row.pack || "", row.boxes, row.singles, row.urgent ? "ACİL" : "NORMAL",
  ]));
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  sheet["!cols"] = [15, 22, 58, 16, 16, 17, 13, 13, 13, 14].map(wch => ({ wch }));
  rows.forEach((_, i) => {
    const cell = sheet["B" + (i + 2)];
    if (cell) { cell.t = "s"; cell.z = "@"; }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Toplama Listesi");
  XLSX.writeFile(wb, "HamurLabs_Transfer_Toplama_Listesi.xlsx", { bookType: "xlsx" });
}
