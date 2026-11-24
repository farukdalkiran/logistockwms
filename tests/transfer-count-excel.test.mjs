import test from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { buildCountWorkbook, countReportRows } from "../lib/transfer-count-excel.ts";

const lines = [
  { product: { sku: "002", barcode: "0012345678901", name: "LEGO & <Ürün>" }, quantity: 3 },
  { product: { sku: "001", barcode: "999", name: "Okutulmadı" }, quantity: 0 },
  { product: { sku: "003", barcode: "0001", name: "=1+1" }, quantity: 2 },
];

test("partial contains only positive net count; final retains zero rows", () => {
  assert.deepEqual(countReportRows(lines, true).map(r => r.quantity), [3, 2]);
  assert.deepEqual(countReportRows(lines, false).map(r => r.quantity), [0, 3, 2]);
});

test("valid XLSX, text codes, blank receipt cells and A4 print settings", () => {
  const report = { code: "LGS123", route: "A → B", partial: true, lines };
  const bytes = buildCountWorkbook(report);
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  assert.equal(sheet.A6.v, "Ürün Kodu");
  assert.equal(sheet.E6.v, "Teslim Alınan Adet");
  assert.equal(sheet.A7.v, "002");
  assert.equal(sheet.B7.v, "0012345678901");
  assert.equal(sheet.C7.v, "LEGO & <Ürün>");
  assert.equal(sheet.D7.v, 3);
  assert.ok(!sheet.E7 || sheet.E7.v == null || sheet.E7.v === "");
  assert.equal(sheet.C8.v, "=1+1");
  assert.equal(sheet.C8.f, undefined);
  assert.match(sheet.A4.v, /sadece şimdiye kadar okutulan/);
  const zip = XLSX.CFB.read(bytes, { type: "array" });
  const read = name => new TextDecoder().decode(zip.FileIndex[zip.FullPaths.findIndex(p => p.endsWith(name))].content);
  assert.match(read("/xl/worksheets/sheet1.xml"), /paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/);
  assert.match(read("/xl/workbook.xml"), /_xlnm.Print_Titles/);
  const final = XLSX.read(buildCountWorkbook({ ...report, partial: false }), { type: "array" }).Sheets["Sayım"];
  assert.equal(final.D7.v, 0);
  assert.equal(final.D8.v, 3);
});
