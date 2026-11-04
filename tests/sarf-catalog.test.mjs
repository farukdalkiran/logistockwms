import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const { catalog } = JSON.parse(
  readFileSync(path.join(root, "data/consumables-catalog-2026.json"), "utf8"),
);

test("Mağaza sarf listesi ürünleri tekil SKU ile içerir", () => {
  assert.equal(catalog.length, 28);
  assert.equal(new Set(catalog.map((item) => item.sku)).size, catalog.length);
  assert.ok(catalog.every((item) => item.sku.startsWith("CONS-")));
  assert.ok(catalog.every((item) => item.max_order_limit > 0));
});

test("Her sarfın kişiselleştirilmiş katalog görsel dosyası bulunur", () => {
  for (const item of catalog) {
    const file = path.join(root, "public/catalog/sarf", item.sku.toLowerCase() + ".svg");
    assert.ok(existsSync(file), item.sku + " için görsel bulunamadı");
    const svg = readFileSync(file, "utf8");
    assert.ok(svg.includes("<svg"), item.sku + " geçerli SVG başlangıcına sahip değil");
  }
});

test("Birimler ve 250'lik değişim kartı paket mantığı tutarlı", () => {
  const exchange = catalog.find((item) => item.sku === "CONS-GIFT-EXCHANGE");
  assert.equal(exchange.order_unit, "PAKET");
  assert.equal(exchange.units_per_unit, 250);
  assert.equal(500 / exchange.units_per_unit, 2);

  for (const sku of ["CONS-BAM-BOX", "CONS-PAB-BOX"]) {
    assert.equal(catalog.find((p) => p.sku === sku)?.order_unit, "KOLİ");
  }
  for (const sku of ["CONS-CUP-PAPER", "CONS-CUP-PLASTIC"]) {
    assert.equal(catalog.find((p) => p.sku === sku)?.order_unit, "PAKET");
  }
  const allowed = ["ADET", "PAKET", "KOLİ", "RULO", "TOP"];
  assert.ok(catalog.every((item) => allowed.includes(item.order_unit)));
});
