import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMissingPartEmail,
  hasValidMissingPartOrderNumber,
  hasValidRecipientEmail,
  missingPartReason,
  getMissingPartIssue,
  outlookComposeUrl,
  onePostaComposeUrl,
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
    address: "Atatürk Caddesi 12, Daire 3, İstanbul, 34000, TR",
  });
  assert.equal(message.subject, "Lego setinize ait eksik parça talebiniz hakkında");
  assert.match(message.body, /T123456/);
  assert.match(message.body, /\r\n\r\n/);
  assert.doesNotMatch(message.body, /(?:\r\n){3,}/, "Paragraflarda gereksiz boşluk olmamalı");
  assert.match(message.body, /Örnek Müşteri/);
  assert.match(message.body, /yurt dışından ülkemize ulaşmıştır/);
  assert.match(message.body, /Eksik Bilgi Nedeni: Adres bilgileri eksik/);
  assert.match(message.body, /Sistemde Kayıtlı Adres: Atatürk Caddesi 12, Daire 3, İstanbul, 34000, TR/);
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
  assert.equal(url.search.includes("+"), false, "Outlook bağlantısında ham + bulunmamalı");
  assert.match(url.search, /%20/, "Boşluklar %20 olarak kodlanmalı");
  assert.match(url.search, /%0D%0A/, "Paragraf satır sonları korunmalı");
});

test("isimsiz müşteri için doğal hitap kullanılır", () => {
  const draft = buildMissingPartEmail({ customer_name: null, sd_document: "T123", note: null });
  assert.match(draft.body, /^Değerli Müşterimiz,/);
  assert.doesNotMatch(draft.body, /Sayın Değerli/);
});

test("Kargo panelindeki eksik bilgi nedeni ve ek açıklama müşteriye görünür", () => {
  const issue = getMissingPartIssue("EKSİK MAHALLE — mahalle adı bulunamadı");
  assert.deepEqual(issue, { title: "Mahalle bilgisi eksik", detail: "Mahalle adı bulunamadı" });

  const draft = buildMissingPartEmail({
    customer_name: "Ayşe Örnek",
    sd_document: "T76543",
    note: "EKSİK MAHALLE — mahalle adı bulunamadı",
    address: "Papatya Sokak No: 3, Kadıköy, İstanbul",
  });
  assert.match(draft.body, /Eksik Bilgi Nedeni: Mahalle bilgisi eksik/);
  assert.match(draft.body, /Ek Açıklama: Mahalle adı bulunamadı/);
  assert.match(draft.body, /Sistemde Kayıtlı Adres: Papatya Sokak No: 3, Kadıköy, İstanbul/);
});

test("Gerekçe kayıtta yoksa neden uydurulmaz", () => {
  const draft = buildMissingPartEmail({
    customer_name: "Örnek",
    sd_document: "T9000",
    note: null,
    address: null,
  });
  assert.match(draft.body, /Eksik bilgi gerekçesi kayıtta belirtilmemiş/);
  assert.match(draft.body, /Adres bilgisi kayıtta bulunmuyor/);
  assert.equal(getMissingPartIssue("POSTA KODU HATALI").title, "Posta kodu hatalı");
  assert.equal(getMissingPartIssue("DİĞER EKSİK BİLGİ — kapı kodu eksik").detail, "Kapı kodu eksik");
});

test("1Posta bağlantısı alıcı, konu ve mesajı Roundcube parametreleriyle açar", () => {
  const draft = buildMissingPartEmail({
    customer_name: "Çağla Örnek",
    sd_document: "T12345",
    note: "EKSİK MAHALLE — Mahalle belirtilmemiş",
    address: "Mimar Sinan Sokak No: 12, Kadıköy, İstanbul",
  });
  const url = new URL(onePostaComposeUrl("musteri+destek@example.com", draft.subject, draft.body));
  assert.equal(url.origin, "https://1posta.com");
  assert.equal(url.searchParams.get("_task"), "mail");
  assert.equal(url.searchParams.get("_action"), "compose");
  assert.equal(url.searchParams.get("_to"), "musteri+destek@example.com");
  assert.equal(url.searchParams.get("_subject"), draft.subject);
  assert.equal(url.searchParams.get("_body"), draft.body);
  assert.equal(url.search.includes("+"), false, "Boşluklar '+' ile kodlanmamalı");
  assert.match(url.search, /%20/, "Boşluklar %20 olmalı");
  assert.match(url.search, /%0D%0A/, "Mesajın satır sonları korunmalı");
});
