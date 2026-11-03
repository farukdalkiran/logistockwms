import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCargoContactSnapshot,
  formatCargoRecordAddress,
} from "../lib/cargo-contact.ts";

test("kargo kaydına kaydedilecek yedi iletişim/adres alanını alır", () => {
  const snapshot = buildCargoContactSnapshot({
    email: " musteri@example.com ",
    street: "Atatürk Caddesi 12",
    street_2: "B Blok Daire 4",
    city: "İstanbul",
    region: "Kadıköy",
    postal_code: "34710",
    country: "TR",
  });
  assert.deepEqual(snapshot, {
    email: "musteri@example.com",
    street: "Atatürk Caddesi 12",
    street_2: "B Blok Daire 4",
    city: "İstanbul",
    region: "Kadıköy",
    postal_code: "34710",
    country: "TR",
  });
  assert.equal(
    formatCargoRecordAddress(snapshot),
    "Atatürk Caddesi 12, B Blok Daire 4, Kadıköy, İstanbul, 34710, TR",
  );
});

test("ERP satırı boş geldiğinde kayıtlı iletişim ve adres bilgileri korunur", () => {
  const current = {
    email: "kayit@example.com",
    street: "Mevcut Sokak",
    street_2: null,
    city: "Ankara",
    region: null,
    postal_code: "06000",
    country: "TR",
  };
  const snapshot = buildCargoContactSnapshot({
    email: "",
    street: null,
    street_2: "Yeni Blok",
    city: undefined,
    postal_code: "",
    country: null,
  }, current);
  assert.equal(snapshot.email, current.email);
  assert.equal(snapshot.street, current.street);
  assert.equal(snapshot.city, current.city);
  assert.equal(snapshot.postal_code, current.postal_code);
  assert.equal(snapshot.country, current.country);
  assert.equal(snapshot.street_2, "Yeni Blok");
});
