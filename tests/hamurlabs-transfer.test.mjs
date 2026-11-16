import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStockIndex, buildPackLookup, countBoxes, eligibilityOf, isValidTransferQuantity,
  normalizedCode, specialListMatches, suggestedTransfer, warehouseFromName,
} from "../lib/hamurlabs-transfer.ts";

const defaultSettings = {
  mode: "units", fixedUnits: 15, fixedBoxes: 1, perProductCap: 0, reserve: 0,
};

const rows = buildStockIndex([
  { barcode: "4895028511678", sku: "51167", name: "Çanta Etiketi", warehouse: "center", sellable: 181 },
  { barcode: "4895028511678", sku: "51167", name: "Çanta Etiketi", warehouse: "online", sellable: 95 },
  { barcode: "4895028515133", sku: "51513", name: "Jel Kalem", warehouse: "center", sellable: 8 },
  { barcode: "4895028516857", sku: "51685", name: "Highlighter", warehouse: "center", sellable: 12 },
  { barcode: "4895028516857", sku: "51685", name: "Highlighter", warehouse: "online", sellable: 40 },
]);

test("depo isimlerini ve Excel barkodlarını normalize eder", () => {
  assert.equal(warehouseFromName("Merkez Depo"), "center");
  assert.equal(warehouseFromName("Anatolium Online Depo"), "online");
  assert.equal(normalizedCode("4.895028511678e+12"), "4895028511678");
});

test("stokları barkoda göre iki depoda birleştirir, yok ile az koşulları ayrıdır", () => {
  assert.equal(rows.length, 3);
  assert.equal(eligibilityOf(rows[0]), "lower");
  assert.equal(eligibilityOf(rows[1]), "missing");
  assert.equal(eligibilityOf(rows[2]), "none");
});

test("tam koliye aşağı yuvarlar ve koli altı online sıfırsa tüm kullanılabilir tekli adedi önerir", () => {
  assert.equal(suggestedTransfer(rows[0], 12, defaultSettings), 12);
  assert.equal(suggestedTransfer(rows[1], 12, defaultSettings), 8);
  assert.equal(suggestedTransfer(rows[1], 12, { ...defaultSettings, reserve: 3 }), 5);
  assert.deepEqual(countBoxes(15, 12), { boxes: 1, singles: 3 });
});

test("üst limit ve stok rezervi aşılmaz, sabit koli miktarı uygulanır", () => {
  assert.equal(suggestedTransfer(rows[0], 12, { ...defaultSettings, mode: "boxes", fixedBoxes: 3 }), 36);
  assert.equal(suggestedTransfer(rows[0], 12, { ...defaultSettings, mode: "boxes", fixedBoxes: 3, perProductCap: 20 }), 12);
  assert.equal(suggestedTransfer(rows[0], 12, { ...defaultSettings, mode: "all", reserve: 80 }), 96);
  assert.equal(isValidTransferQuantity(rows[0], 13, 12, 0, 0, false), false);
  assert.equal(isValidTransferQuantity(rows[0], 13, 12, 0, 0, true), true);
  assert.equal(isValidTransferQuantity(rows[0], 1000, 12, 0, 0, true), false);
});

test("koli katsayıları ürün bazında okunur ve çelişkili tanımlar otomatik kullanılmaz", () => {
  const lookup = buildPackLookup(
    [{ id: "P1", barcode: "4895028511678", sku: "51167", name: "Etiket", alt_barcodes: [], is_active: true }],
    [{ product_id: "P1", quantity: 12 }, { product_id: "P1", quantity: 6 }],
  );
  const match = lookup(rows[0]);
  assert.equal(match.ambiguous, true);
  assert.equal(match.pack, null);
  assert.equal(specialListMatches(rows[0], new Set(["51167"])), true);
  assert.equal(specialListMatches(rows[0], new Set(["9999"])), false);
});
