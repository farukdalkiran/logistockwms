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
  const customerName = (input.customer_name || "").trim();
  const orderNumber = (input.sd_document || "").trim();
  const reason = missingPartReason(input.note);
  const subject = "Lego setinize ait eksik parça talebiniz hakkında";
  const body = [
    customerName ? "Sayın " + customerName + "," : "Değerli Müşterimiz,",
    "",
    "LEGO setinize ait " + orderNumber + " numaralı eksik parça talebiniz hakkında sizi bilgilendirmek istiyoruz.",
    "",
    "Talep ettiğiniz eksik parça yurt dışından ülkemize ulaşmıştır. Ancak " +
      reason + " nedeniyle gönderinizin adresinize yönlendirilmesi şu anda mümkün değildir.",
    "",
    "Gönderim sürecine devam edebilmemiz için güncel ve eksiksiz adres/iletişim bilgilerinizi bizimle paylaşmanızı rica ederiz.",
    "",
    "Bize aşağıdaki iletişim kanallarından ulaşabilirsiniz:",
    "E-posta: destek@LEGO.tr",
    "WhatsApp: +90 530 958 04 76 (Yalnızca WhatsApp üzerinden mesaj kabul edilmektedir.)",
    "",
    "Bilgilerinizi iletmenizin ardından gerekli kontrolleri yaparak gönderim sürecini sürdüreceğiz.",
    "",
    "İlginiz ve anlayışınız için teşekkür ederiz.",
    "",
    "Saygılarımızla,",
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
