/**
 * Eksik parça müşteri bilgilendirme metni.
 * Bu yardımcı yalnızca taslak üretir; e-posta göndermez.
 */
export type MissingPartMessageInput = {
  customer_name: string | null;
  email?: string | null;
  sd_document: string | null;
  note?: string | null;
  address?: string | null;
};

const REASONS: Record<string, string> = {
  "EKSİK ADRES": "adres bilgilerinizin eksik olması",
  "EKSİK MAHALLE": "mahalle bilginizin eksik olması",
  "TELEFON NUMARASI EKSİK": "telefon numaranızın eksik olması",
  "TELEFON NUMARASI HATALI": "telefon numaranızın hatalı olması",
  "APARTMAN / KAPI NUMARASI EKSİK": "apartman veya kapı numaranızın eksik olması",
  "İL / İLÇE UYUŞMAZLIĞI": "il ve ilçe bilgilerinizin uyuşmaması",
  "SOKAK BİLGİSİ EKSİK": "sokak bilginizin eksik olması",
  "POSTA KODU HATALI": "posta kodunuzun hatalı olması",
};

const REASON_TITLES: Record<string, string> = {
  "EKSİK ADRES": "Adres bilgileri eksik",
  "EKSİK MAHALLE": "Mahalle bilgisi eksik",
  "TELEFON NUMARASI EKSİK": "Telefon numarası eksik",
  "TELEFON NUMARASI HATALI": "Telefon numarası hatalı",
  "APARTMAN / KAPI NUMARASI EKSİK": "Apartman veya kapı numarası eksik",
  "İL / İLÇE UYUŞMAZLIĞI": "İl ve ilçe bilgileri uyuşmuyor",
  "SOKAK BİLGİSİ EKSİK": "Sokak bilgisi eksik",
  "POSTA KODU HATALI": "Posta kodu hatalı",
  "DİĞER EKSİK BİLGİ": "Diğer eksik bilgi",
};

function initialUppercase(value: string): string {
  return value ? value[0].toLocaleUpperCase("tr-TR") + value.slice(1) : value;
}

/** Kargo panelindeki SEBEP — ek açıklama formatından gerekçeyi okur. Eksik veriyi tahmin etmez. */
export function getMissingPartIssue(note?: string | null): { title: string; detail: string | null } {
  const raw = (note || "").trim();
  if (!raw) return { title: "Eksik bilgi gerekçesi kayıtta belirtilmemiş", detail: null };
  const [reason, ...extra] = raw.split(/\s+—\s+/);
  const normalized = reason.trim().toLocaleUpperCase("tr-TR");
  const detail = extra.join(" — ").trim() || null;
  if (REASON_TITLES[normalized]) {
    return { title: REASON_TITLES[normalized], detail: detail ? initialUppercase(detail) : null };
  }
  return { title: initialUppercase(raw), detail: null };
}

export function missingPartReason(note?: string | null): string {
  const raw = (note || "").trim();
  const [reason, ...detailParts] = raw.split(/\s+—\s+/);
  const normalized = (reason || "").trim().toLocaleUpperCase("tr-TR");
  if (REASONS[normalized]) return REASONS[normalized];
  const detail = detailParts.join(" — ").trim();
  if (normalized === "DİĞER EKSİK BİLGİ" && detail) return detail;
  return "adres veya iletişim bilgilerinizin eksik ya da hatalı olması";
}

export function hasValidMissingPartOrderNumber(value?: string | null): boolean {
  return /^T[A-Z0-9-]+$/i.test((value || "").trim());
}

export function hasValidRecipientEmail(value?: string | null): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}

export function buildMissingPartEmail(input: MissingPartMessageInput) {
  const customerName = (input.customer_name || "").trim();
  const orderNumber = (input.sd_document || "").trim();
  const issue = getMissingPartIssue(input.note);
  const storedAddress = (input.address || "").trim();
  const subject = "Lego setinize ait eksik parça talebiniz hakkında";
  const body = [
    customerName ? "Sayın " + customerName + "," : "Değerli Müşterimiz,",
    "",
    "LEGO setinize ait " + orderNumber + " numaralı eksik parça talebinizle ilgili bilgi vermek istiyoruz.",
    "Talep ettiğiniz parça yurt dışından ülkemize ulaşmıştır. Ancak adres veya iletişim bilgilerinizdeki eksiklik nedeniyle henüz gönderim sağlanamamıştır.",
    "",
    "Eksik Bilgi Nedeni: " + issue.title,
    ...(issue.detail ? ["Ek Açıklama: " + issue.detail] : []),
    "Sistemde Kayıtlı Adres: " + (storedAddress || "Adres bilgisi kayıtta bulunmuyor."),
    "",
    "Lütfen yukarıdaki bilgileri kontrol ederek eksik veya hatalı alanları içeren güncel ve tam adresinizi bize iletin. Böylece gönderim sürecine devam edebiliriz.",
    "E-posta: destek@LEGO.tr",
    "WhatsApp: +90 530 958 04 76 (Yalnızca WhatsApp üzerinden mesaj kabul edilmektedir.)",
    "",
    "Teşekkür eder, iyi günler dileriz.",
    "LEGO Müşteri Hizmetleri",
  ].join("\r\n");
  return { subject, body };
}

export function outlookComposeUrl(to: string, subject: string, body: string): string {
  // Boşlukları + yerine %20, paragraf sonlarını %0D%0A kodlayarak Outlook'a aktar.
  const query = [
    "to=" + encodeURIComponent(to.trim()),
    "subject=" + encodeURIComponent(subject),
    "body=" + encodeURIComponent(body.replace(/\r?\n/g, "\r\n")),
  ].join("&");
  return "https://outlook.office.com/mail/deeplink/compose?" + query;
}

/**
 * 1Posta (T-Soft Webmail) için Roundcube uyumlu yeni ileti bağlantısı.
 * Bağlantı yalnızca taslak açar; hiçbir e-posta otomatik gönderilmez.
 * Oturum / sunucu özelleştirmeleri parametreleri yok sayabilir; arayüzde
 * alıcı, konu ve metni ayrı ayrı kopyalamak için yedek alanlar bulunur.
 */
export function onePostaComposeUrl(to: string, subject: string, body: string): string {
  const query = [
    "_task=mail",
    "_action=compose",
    "_to=" + encodeURIComponent(to.trim()),
    "_subject=" + encodeURIComponent(subject),
    "_body=" + encodeURIComponent(body.replace(/\r?\n/g, "\r\n")),
  ].join("&");
  return "https://1posta.com/?" + query;
}
