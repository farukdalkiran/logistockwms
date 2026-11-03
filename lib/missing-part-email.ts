/**
 * Eksik parça müşteri bilgilendirme metni.
 * Bu yardımcı yalnızca taslak üretir; e-posta göndermez.
 */
export type MissingPartMessageInput = {
  customer_name: string | null;
  email?: string | null;
  sd_document: string | null;
  note?: string | null;
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
  const name = (input.customer_name || "").trim() || "Değerli Müşterimiz";
  const orderNumber = (input.sd_document || "").trim();
  const reason = missingPartReason(input.note);
  const subject = "LEGO Eksik Parça Talebi - " + orderNumber;
  const body = [
    "Sayın " + name + ",",
    "",
    orderNumber + " numaralı eksik parça siparişiniz hakkında bilgilendirme:",
    "",
    "Setinize ait eksik parça talebiniz yurt dışından ülkemize ulaşmıştır. Ancak " +
      reason + " sebebiyle adresinize gönderim sağlanamamıştır.",
    "",
    "Güncel ve eksiksiz adres bilgilerinizi aşağıdaki kanallardan bize iletebilirsiniz:",
    "",
    "E-posta: destek@LEGO.tr",
    "WhatsApp: +90 530 958 04 76 (Yalnızca WhatsApp üzerinden mesaj kabul edilmektedir.)",
    "",
    "LEGO Müşteri Hizmetleri",
  ].join("\n");
  return { subject, body };
}

export function outlookComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ to, subject, body });
  return "https://outlook.office.com/mail/deeplink/compose?" + params.toString();
}
