import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCatalogReview, catalogWritePayload, parseCatalogSheet } from "../lib/catalog-excel-review.ts";

const stored = [
  { id: "product-a", barcode: "5702018054697", sku: "43298", name: "Herschel x LEGO Çocuk Çantası", is_consumable: false },
  { id: "product-b", barcode: "5702018062470", sku: "60510", name: "Pop Quiz Termal Çanta", is_consumable: false },
];

const row = (override = {}) => ({
  "Barkod": "5702018054697",
  "SKU": "43298",
  "Ürün Adı": "Herschel x LEGO Çocuk Çantası",
  "Kategori": "Çantalar",
  "Görsel URL": "",
  "Sarf Malzeme mi?": "HAYIR",
  "Max Sipariş Limiti": "",
  ...override,
});

test("Mevcut barkod, SKU ve ad aynı kartı bulduğunda yalnızca bir güncelleme oluşturulur", () => {
  const items = parseCatalogSheet([row()]);
  const result = buildCatalogReview(items, stored);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "existing");
  assert.equal(result[0].existing.id, "product-a");
  assert.deepEqual(result[0].matchedOn, ["Barkod", "SKU", "Ad"]);
});

test("SKU ve isim eşleşiyor ama Excel barkodu farklıysa kart barkodu korunur", () => {
  const incoming = parseCatalogSheet([row({ "Barkod": "NEW-BARCODE", "Görsel URL": "" })]);
  const planned = buildCatalogReview(incoming, stored);
  assert.equal(planned[0].status, "existing");
  assert.match(planned[0].reason, /barkodu korunacak/);
  const payload = catalogWritePayload(incoming[0], true);
  assert.equal("barcode" in payload, false);
  assert.equal("image_url" in payload, false);
  assert.equal("max_order_limit" in payload, false);
  assert.equal(payload.name, "Herschel x LEGO Çocuk Çantası");
});

test("Aynı satırdaki barkod ve SKU farklı mevcut ürünlere aitse bloke edilir", () => {
  const planned = buildCatalogReview(parseCatalogSheet([row({ "SKU": "60510" })]), stored);
  assert.equal(planned[0].status, "conflict");
  assert.match(planned[0].reason, /farklı mevcut ürünlere/);
});

test("Dosya içindeki tekrar eden barkodlar farklı kayıtlar olarak oluşturulmaz", () => {
  const items = parseCatalogSheet([
    row({ "Barkod": "NEW-1", "SKU": "S-1", "Ürün Adı": "Birinci Ürün" }),
    row({ "Barkod": "NEW-1", "SKU": "S-2", "Ürün Adı": "İkinci Ürün" }),
  ]);
  const planned = buildCatalogReview(items, stored);
  assert.deepEqual(planned.map((item) => item.status), ["conflict", "conflict"]);
  assert.match(planned[0].reason, /Dosyada barkod tekrarlanıyor/);
});

test("Farklı Excel satırları tek bir mevcut kartı eşliyorsa yanlışlıkla iki güncelleme yapılmaz", () => {
  const items = parseCatalogSheet([
    row({ "Barkod": "5702018054697", "SKU": "", "Ürün Adı": "Farklı İsim 1" }),
    row({ "Barkod": "DIFFERENT", "SKU": "43298", "Ürün Adı": "Farklı İsim 2" }),
  ]);
  assert.deepEqual(buildCatalogReview(items, stored).map((item) => item.status), ["conflict", "conflict"]);
});

test("Mevcut barkod olmayan ürün yeni kart olarak planlanır", () => {
  const items = parseCatalogSheet([row({
    "Barkod": "X-999",
    "SKU": "X-999-S",
    "Ürün Adı": "Yeni Ürün",
  })]);
  const planned = buildCatalogReview(items, stored);
  assert.equal(planned[0].status, "new");
  const payload = catalogWritePayload(items[0], false);
  assert.equal(payload.barcode, "X-999");
  assert.equal(payload.image_url, null);
  assert.equal(payload.is_consumable, false);
});

test("Büyük küçük harf ve kenar boşluklarıyla eşleşme sağlanır", () => {
  const items = parseCatalogSheet([row({
    "Barkod": " 5702018054697 ",
    "SKU": " 43298 ",
    "Ürün Adı": "herschel x lego çocuk çantası",
  })]);
  assert.equal(buildCatalogReview(items, stored)[0].status, "existing");
});

test("Negatif, kesirli ve geçersiz limit kayıtları bloke edilir", () => {
  for (const value of ["-1", "3.5", "metin"]) {
    const items = parseCatalogSheet([row({
      "Barkod": "NEW-10",
      "SKU": "NEW-10",
      "Ürün Adı": "Yeni",
      "Max Sipariş Limiti": value,
    })]);
    assert.equal(buildCatalogReview(items, stored)[0].status, "conflict");
  }
});

test("Mevcut kartın boş SKU, kategori ve görseli silinmez; isteğe bağlı bilgiler güncellenir", () => {
  const items = parseCatalogSheet([row({
    "SKU": "",
    "Kategori": "",
    "Görsel URL": "",
    "Sarf Malzeme mi?": "",
    "Max Sipariş Limiti": "25",
  })]);
  const update = catalogWritePayload(items[0], true);
  assert.equal("sku" in update, false);
  assert.equal("category" in update, false);
  assert.equal("image_url" in update, false);
  assert.equal("is_consumable" in update, false);
  assert.equal(update.max_order_limit, 25);
});
