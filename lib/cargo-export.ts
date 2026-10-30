/**
 * Kargo çıktılarındaki takip numarası ile eksik bilgi gerekçesini ayırır.
 * Pure function: hem sunucu action'ında hem regresyon testlerinde kullanılır.
 */
export type CargoExportRecord = {
  delivery_number: string;
  sd_document: string | null;
  aras_tracking_number: string | null;
  missing_address: boolean | null;
  is_returned: boolean | null;
  note: string | null;
  file_name: string | null;
  created_at: string;
};

const TRACKING = /^[A-Z0-9]{10,32}$/;
const REASON_TEXT = /(EKS[Iİ]K|ADRES|MAHALLE|TELEFON|[Iİ]ADE|İPTAL|HATALI|YANLI[SŞ]|[Iİ]LET[Iİ][SŞ][Iİ]M|G[OÖ]NDER[Iİ]LEMED[Iİ])/i;

export function isValidCargoTracking(value: string | null | undefined): boolean {
  const valueNormalized = String(value || "").trim().toUpperCase();
  return TRACKING.test(valueNormalized) && !REASON_TEXT.test(valueNormalized);
}

export function selectCargoExportRecord(
  records: CargoExportRecord[],
  sdDocuments: string[],
  fileName: string | null,
): CargoExportRecord | null {
  const sdSet = new Set(sdDocuments.map((s) => s.trim()).filter(Boolean));
  const normalizedFile = fileName?.trim().toLocaleUpperCase("tr-TR") || "";
  const candidates = records
    .filter((record) => sdSet.has(String(record.sd_document || "").trim()))
    .map((record) => {
      const recordFile = String(record.file_name || "").trim().toLocaleUpperCase("tr-TR");
      const priority = recordFile && normalizedFile && recordFile === normalizedFile
        ? 2 : !recordFile ? 1 : 0;
      return { record, priority };
    })
    .filter(({ priority }) => priority > 0)
    .sort((a, b) => b.priority - a.priority || Date.parse(b.record.created_at) - Date.parse(a.record.created_at));
  return candidates[0]?.record || null;
}

export function cargoExportValue(record: CargoExportRecord | null, erpTracking: string | null): string {
  const storedNumber = record?.aras_tracking_number?.trim() || "";
  const fallbackNumber = erpTracking?.trim() || "";
  const note = record?.note?.trim() || "";
  const legacyReason = [storedNumber, fallbackNumber].find((value) => REASON_TEXT.test(value)) || "";

  // Statü öncelikli: eski ERP takip numarası, sonraki eksik bilgi kaydını ezemez.
  if (record?.missing_address) return note || legacyReason || "EKSİK ADRES - SEBEP BELİRTİLMEMİŞ";
  if (record?.is_returned) return note || legacyReason || "İADE / GÖNDERİLEMEDİ";
  if (isValidCargoTracking(storedNumber)) return storedNumber;
  if (isValidCargoTracking(fallbackNumber)) return fallbackNumber;
  if (note && REASON_TEXT.test(note)) return note;
  return legacyReason || "TAKİP NUMARASI BULUNAMADI";
}
