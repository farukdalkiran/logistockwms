import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMissingPartEmail,
  hasValidMissingPartOrderNumber,
  hasValidRecipientEmail,
  missingPartReason,
  outlookComposeUrl,
} from "../lib/missing-part-email.ts";

test("eksik bilgi gerekçesini anlaşılır müşteri metnine çevirir", () => {
  assert.equal(missingPartReason("EKSİK MAHALLE — kontrol gerekli"), "mahalle bilginizin eksik olması");
  assert.equal(missingPartReason("TELEFON NUMARASI EKSİK"), "telefon numaranızın eksik olması");
  assert.equal(missingPartReason("DİĞER EKSİK BİLGİ — Blok bilgisi yok"), "Blok bilgisi yok");
  assert.match(missingPartReason(null), /adres veya iletişim/);
});

test("taslakta T sipariş numarası, müşteri, gerekçe ve destek kanalları vardır", () => {
  const message = buildMissingPartEmail({
    customer_name: "Örnek Müşteri",
    sd_document: "T123456",
    note: "EKSİK ADRES",
  });
  assert.match(message.subject, /T123456/);
  assert.match(message.body, /Örnek Müşteri/);
  assert.match(message.body, /yurt dışından ülkemize ulaşmıştır/);
  assert.match(message.body, /adres bilgilerinizin eksik olması/);
  assert.match(message.body, /destek@LEGO\.tr/);
  assert.match(message.body, /\+90 530 958 04 76/);
  assert.match(message.body, /LEGO Müşteri Hizmetleri/);
});

test("e-posta ve T numarası doğrulanmadan Outlook taslağı açılmaz", () => {
  assert.equal(hasValidRecipientEmail("musteri@example.com"), true);
  assert.equal(hasValidRecipientEmail("eksik@"), false);
  assert.equal(hasValidMissingPartOrderNumber("T12345"), true);
  assert.equal(hasValidMissingPartOrderNumber("991234"), false);
});

test("Outlook bağlantısı konu ve gövdeyi doğru kodlar", () => {
  const draft = buildMissingPartEmail({
    customer_name: "Örnek",
    sd_document: "T999",
    note: "EKSİK SOKAK",
  });
  const url = new URL(outlookComposeUrl("musteri@example.com", draft.subject, draft.body));
  assert.equal(url.host, "outlook.office.com");
  assert.equal(url.searchParams.get("to"), "musteri@example.com");
  assert.equal(url.searchParams.get("subject"), draft.subject);
  assert.equal(url.searchParams.get("body"), draft.body);
});
