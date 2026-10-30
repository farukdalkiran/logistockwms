import test from "node:test";
import assert from "node:assert/strict";
import { cargoExportValue, isValidCargoTracking, selectCargoExportRecord } from "../lib/cargo-export.ts";

const record = (changes = {}) => ({
  delivery_number: "1234567890", sd_document: "SD1", aras_tracking_number: null,
  missing_address: false, is_returned: false, note: null,
  file_name: "Ekim", created_at: "2026-10-30T08:00:00Z", ...changes,
});

test("geçerli takip numarasını korur", () => {
  assert.equal(cargoExportValue(record({ aras_tracking_number: "CPR123456789012" }), null), "CPR123456789012");
  assert.equal(cargoExportValue(null, "CPR123456789012"), "CPR123456789012");
  assert.equal(isValidCargoTracking("12345"), false);
  assert.equal(isValidCargoTracking("TELEFON NUMARASI EKSİK"), false);
});

test("eksik adres ve iade gerekçesi takip alanını ezer", () => {
  assert.equal(cargoExportValue(record({ missing_address: true, note: "TELEFON NUMARASI EKSİK — aranmalı" }), "CPR123456789012"), "TELEFON NUMARASI EKSİK — aranmalı");
  assert.equal(cargoExportValue(record({ is_returned: true, note: "ALICI KABUL ETMEDİ" }), "CPR123456789012"), "ALICI KABUL ETMEDİ");
  assert.equal(cargoExportValue(record({ missing_address: true }), null), "EKSİK ADRES - SEBEP BELİRTİLMEMİŞ");
});

test("legacy hata açıklamasını takip numarası sanmaz", () => {
  assert.equal(cargoExportValue(record({ aras_tracking_number: "MAHALLE BİLGİSİ EKSİK" }), null), "MAHALLE BİLGİSİ EKSİK");
  assert.equal(cargoExportValue(null, "TELEFON NUMARASI HATALI"), "TELEFON NUMARASI HATALI");
  assert.equal(cargoExportValue(null, "12345"), "TAKİP NUMARASI BULUNAMADI");
});

test("SD ve dosya profili karışmasına izin vermez", () => {
  const wrong = record({ sd_document: "SD2", file_name: "Ekim", note: "EKSİK ADRES" });
  const otherFile = record({ sd_document: "SD1", file_name: "Eylül", note: "İADE" });
  const matching = record({ sd_document: "SD1", file_name: "Ekim", aras_tracking_number: "CPR123456789012" });
  assert.equal(selectCargoExportRecord([wrong, otherFile, matching], ["SD1"], "Ekim"), matching);
  assert.equal(selectCargoExportRecord([wrong, otherFile], ["SD1"], "Ekim"), null);
});
