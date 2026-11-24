import * as XLSX from "xlsx";

// CommonJS exports CFB under default in Node; the browser ESM build exposes it directly.
const sheetjs = XLSX as unknown as { CFB?: any; default?: { CFB?: any } };
const CFB = sheetjs.CFB ?? sheetjs.default?.CFB;

type Product = { sku?: string | null; barcode?: string | null; name?: string | null };
export type CountLine = { product: Product | null; quantity: number };
export type CountReport = {
  code: string;
  route: string;
  operator?: string;
  partial: boolean;
  lines: CountLine[];
  date?: Date;
};

export function countReportRows(lines: CountLine[], partial: boolean) {
  return lines.map(({ product, quantity }) => ({
    sku: String(product?.sku ?? ""),
    barcode: String(product?.barcode ?? ""),
    name: String(product?.name ?? "Bilinmeyen ürün"),
    quantity: Number.isFinite(quantity) ? Math.max(0, quantity) : 0,
  })).filter(row => !partial || row.quantity > 0)
    .sort((a, b) => a.sku.localeCompare(b.sku, "tr", { numeric: true }) || a.barcode.localeCompare(b.barcode));
}

// Inline string cells preserve leading zeros and never evaluate product text as formulas.
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const str = (ref: string, value: string, style = 0) =>
  `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const num = (ref: string, value: number, style = 0) => `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
const row = (n: number, height: number, cells: string) => `<row r="${n}" ht="${height}" customHeight="1">${cells}</row>`;
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// SheetJS's ZIP container is already available in the project. Write the OOXML
// page settings explicitly because the standard worksheet writer omits them.
export function buildCountWorkbook(report: CountReport): Uint8Array {
  const rows = countReportRows(report.lines, report.partial);
  const last = rows.length + 6;
  const total = rows.reduce((sum, item) => sum + item.quantity, 0);
  const date = (report.date ?? new Date()).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const note = report.partial
    ? "Bu Excel sadece şimdiye kadar okutulan verileri içermektedir. Nihai liste değildir."
    : "Nihai sayım listesi. Teslim alınan adet mağaza tarafından elle doldurulacaktır.";
  const sheetRows = [
    row(1, 25, str("A1", report.partial ? "LOGISTOCK | ARA SAYIM LİSTESİ" : "LOGISTOCK | NİHAİ SAYIM LİSTESİ", 1)),
    row(2, 22, str("A2", "Evrak: " + report.code + "  |  " + report.route, 2)),
    row(3, 22, str("A3", "Tarih: " + date + (report.operator ? "  |  Operatör: " + report.operator : ""), 2)),
    row(4, 30, str("A4", note, 2)),
    row(5, 24, str("A5", `Ürün çeşidi: ${rows.length}  |  Toplam adet: ${total}`, 2)),
    row(6, 28, ["Ürün Kodu", "Barkod", "Ürün Adı", "Adet", "Teslim Alınan Adet"].map((h, i) => str("ABCDE"[i] + "6", h, 3)).join("")),
    ...rows.map((item, i) => {
      const n = i + 7;
      const height = Math.min(120, Math.max(29, 15 * Math.ceil(item.name.length / 34) + 8));
      return row(n, height, str("A"+n,item.sku,4) + str("B"+n,item.barcode,4) + str("C"+n,item.name,4) + num("D"+n,item.quantity,5) + `<c r="E${n}" s="5"/>`);
    }),
  ].join("");
  const sheet = `<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:E${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="15" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/><col min="3" max="3" width="44" customWidth="1"/><col min="4" max="4" width="9" customWidth="1"/><col min="5" max="5" width="20" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><mergeCells count="5">${[1,2,3,4,5].map(n=>`<mergeCell ref="A${n}:E${n}"/>`).join("")}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;R&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
  const styles = `<styleSheet xmlns="${ns}"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF9CA3AF"/></left><right style="thin"><color rgb="FF9CA3AF"/></right><top style="thin"><color rgb="FF9CA3AF"/></top><bottom style="thin"><color rgb="FF9CA3AF"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const pkgRel = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const files: Record<string,string> = {
    "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels": `<Relationships xmlns="${pkgRel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${ns}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets><sheet name="Sayım" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'Sayım'!$1:$6</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">'Sayım'!$A$1:$E$${last}</definedName></definedNames></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="${pkgRel}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheet,
    "xl/styles.xml": styles,
  };
  const zip = CFB.utils.cfb_new();
  for (const [path, body] of Object.entries(files)) {
    CFB.utils.cfb_add(zip, path, new TextEncoder().encode(declaration + body));
  }
  return Uint8Array.from(CFB.write(zip, { type: "array", fileType: "zip", compression: true }));
}

export function downloadCountWorkbook(report: CountReport) {
  const bytes = buildCountWorkbook(report);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = report.code.replace(/[^a-zA-Z0-9_-]/g, "_") + (report.partial ? "_ARA_SAYIM.xlsx" : "_NIHAI_SAYIM.xlsx");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
