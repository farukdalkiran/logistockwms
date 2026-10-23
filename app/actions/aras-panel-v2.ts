"use server";

/**
 * B2C Aras Kargo - durum odakli kayit islemi.
 * Mevcut aras-integration.ts dosyasini degistirmez.
 * Yeni kayitlarda takip numarasi / eksik adres aciklamasi ayri tutulur.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export type CargoProcessType = "success" | "missing" | "returned";

 const MISSING_REASONS = {
  address: "EKSİK ADRES",
  neighborhood: "EKSİK MAHALLE",
  phone: "TELEFON NUMARASI EKSİK",
  phone_invalid: "TELEFON NUMARASI HATALI",
  building: "APARTMAN / KAPI NUMARASI EKSİK",
  district: "İL / İLÇE UYUŞMAZLIĞI",
  street: "SOKAK BİLGİSİ EKSİK",
  postcode: "POSTA KODU HATALI",
  other: "DİĞER EKSİK BİLGİ",
} as const;

 const RETURN_REASONS = {
  undelivered: "TESLİMAT YAPILAMADI",
  refused: "ALICI KABUL ETMEDİ",
  cancelled: "GÖNDERİ İPTAL EDİLDİ",
  returned: "İADE EDİLDİ",
  other: "DİĞER İADE SEBEBİ",
} as const;

export type SaveCargoPanelInput = {
  deliveryNumber: string;
  fileId: string;
  status: CargoProcessType;
  trackingNumber?: string;
  reason?: string;
  extraNote?: string;
};

export type SaveCargoPanelResult =
  | { success: true; recordId: string; updated: boolean; itemCount: number }
  | { success: false; error: string };

const TR_NUM = /^[0-9]{7,20}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_TRACKING = /^[A-Z0-9]{10,32}$/;
const INVALID_TRACKING_TEXT =
  /(EKS[Iİ]K|ADRES|MAHALLE|TELEFON|NUMARA|[Iİ]ADE|HATALI|YANLI[SŞ]|[Iİ]PTAL)/i;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu ayarları eksik.");
  // Bu anahtar asla NEXT_PUBLIC_ ile tanimlanmamali.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertAuthorized() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase Auth yapılandırması eksik.");

  const cookieStore = await cookies();
  const userClient = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Salt okunur Server Component disinda da kullanilabilmesi icin.
        }
      },
    },
  });

  // Cookie icerigine degil, Auth servisinin dogruladigi kullaniciya guven.
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user)
    throw new Error("Oturum bulunamadı. Lütfen yeniden giriş yapın.");

  const admin = getAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile)
    throw new Error("Bu işlem için kullanıcı profili bulunamadı.");

  // Mevcut WMS role degerleri: Developer, Admin, ADMNWH, WAREHOUSE, StoreMng.
  // Kargo operasyonunu yalnizca yetkili depo rollerine aciyoruz.
  const role = String(profile.role ?? "").toUpperCase();
  if (!["DEVELOPER", "ADMIN", "ADMNWH", "WAREHOUSE"].includes(role)) {
    throw new Error("Bu işlem için kargo operasyon yetkiniz yok.");
  }
  return admin;
}

export async function saveCargoPanelRecord(
  input: SaveCargoPanelInput,
): Promise<SaveCargoPanelResult> {
  try {
    const deliveryNumber = clean(input.deliveryNumber);
    const fileId = clean(input.fileId);
    const status = input.status;
    const trackingNumber = clean(input.trackingNumber)
      .toUpperCase()
      .replace(/\s+/g, "");
    const extraNote = clean(input.extraNote).slice(0, 500);

    if (!TR_NUM.test(deliveryNumber))
      throw new Error("Delivery Number 7-20 haneli sayısal değer olmalı.");
    if (!UUID.test(fileId))
      throw new Error("Geçerli bir dosya profili seçilmeli.");
    if (!["success", "missing", "returned"].includes(status))
      throw new Error("Geçersiz işlem türü.");

    let note: string | null = null;
    if (status === "success") {
      if (
        !VALID_TRACKING.test(trackingNumber) ||
        INVALID_TRACKING_TEXT.test(trackingNumber)
      ) {
        throw new Error(
          "Geçerli Aras takip numarası girin (10-32 karakter, harf/rakam). 5-6 haneli kod veya hata açıklaması kabul edilmez.",
        );
      }
      note = extraNote || null;
    } else {
      const options: Record<string, string> =
        status === "missing" ? MISSING_REASONS : RETURN_REASONS;
      const label = options[clean(input.reason)];
      if (!label) throw new Error("Eksik bilgi / iade gerekçesi seçin.");
      if (input.reason === "other" && extraNote.length < 3) {
        throw new Error("Diğer seçeneğinde açıklama yazın.");
      }
      note = [label, extraNote].filter(Boolean).join(" — ");
    }

    const supabase = await assertAuthorized();
    // Seçilen dosyanin kayitlarini kullan: global sorgu sonrasi panel dosyayi otomatik seçer.
    const { data: shipments, error: readError } = await supabase
      .from("erp_raw_shipments")
      .select(
        "id,file_id,delivery_number,sd_document,customer_name,mobile_number,is_processed_aras",
      )
      .eq("file_id", fileId)
      .eq("delivery_number", deliveryNumber)
      .order("created_at", { ascending: true });
    if (readError) throw readError;
    if (!shipments?.length)
      throw new Error("Bu profilde Delivery Number bulunamadı.");

    const sdDocuments = Array.from(
      new Set(shipments.map((row) => clean(row.sd_document)).filter(Boolean)),
    );
    // Ayni teslimata ait birden fazla satir varsa tum satirlar ayni statuye getirilir.
    if (!sdDocuments.length)
      throw new Error(
        "Bu teslimatta SD Document bulunmuyor, kayıt oluşturulamaz.",
      );
    const primary = shipments[0];
    const { data: fileData, error: fileError } = await supabase
      .from("aras_files")
      .select("filename")
      .eq("id", fileId)
      .maybeSingle();
    if (fileError) throw fileError;

    // Once kaydin mevcut olup olmadigini kontrol et. Eski kayitlarda file_name bos olabilir.
    // Bu nedenle Delivery Number + SD Document eslesmesi tercih edilir.
    let existingId: string | null = null;
    let previousRecord: Record<string, unknown> | null = null;
    if (sdDocuments.length) {
      const { data: existing, error: existingError } = await supabase
        .from("cargo_records")
        .select(
          "id,sd_document,customer_name,mobile_number,delivery_number,aras_shipment_number,aras_tracking_number,missing_address,is_returned,note,item_count,file_name",
        )
        .eq("delivery_number", deliveryNumber)
        .in("sd_document", sdDocuments)
        .order("created_at", { ascending: false })
        .limit(20);
      if (existingError) throw existingError;
      existingId = existing?.[0]?.id ?? null;
      previousRecord = existing?.[0] ?? null;
    }

    const recordFields = {
      customer_name: primary.customer_name ?? null,
      mobile_number: primary.mobile_number ?? null,
      delivery_number: deliveryNumber,
      sd_document: clean(primary.sd_document) || sdDocuments[0],
      // 5 haneli dahili referansi Aras sevkiyat/takip kodu gibi yazma.
      aras_shipment_number: null,
      aras_tracking_number: status === "success" ? trackingNumber : null,
      missing_address: status === "missing",
      is_returned: status === "returned",
      note,
      item_count: shipments.length,
      file_name: fileData?.filename ?? null,
    };

    let recordId = existingId;
    const updated = Boolean(existingId);
    if (existingId) {
      const { error } = await supabase
        .from("cargo_records")
        .update(recordFields)
        .eq("id", existingId);
      if (error) throw error;
    } else {
      const { data: newRecord, error } = await supabase
        .from("cargo_records")
        .insert(recordFields)
        .select("id")
        .single();
      if (error || !newRecord)
        throw error ?? new Error("Kargo kaydı oluşturulamadı.");
      recordId = newRecord.id;
    }

    // ERP satirlarinda hata metnini asla takip no alanina kaydetme.
    const { error: updateError } = await supabase
      .from("erp_raw_shipments")
      .update({
        aras_tracking_number: status === "success" ? trackingNumber : null,
        is_processed_aras: true,
        processed_at: new Date().toISOString(),
      })
      .eq("file_id", fileId)
      .eq("delivery_number", deliveryNumber);
    if (updateError) {
      // Yeni eklenen tek satiri geri al. Mevcut kayit guncellemesinde eski degerleri
      // geri almak icin veritabani transaction/RPC gereklidir (README).
      if (!updated && recordId) {
        await supabase.from("cargo_records").delete().eq("id", recordId);
      } else if (updated && recordId && previousRecord) {
        const { id: _id, ...backup } = previousRecord;
        await supabase.from("cargo_records").update(backup).eq("id", recordId);
      }
      throw new Error(`ERP güncellemesi başarısız: ${updateError.message}`);
    }

    return {
      success: true,
      recordId: recordId!,
      updated,
      itemCount: shipments.length,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Beklenmeyen kayıt hatası.",
    };
  }
}

export async function getCargoPanelExistingRecord(
  deliveryNumberRaw: string,
  fileIdRaw: string,
) {
  try {
    const deliveryNumber = clean(deliveryNumberRaw);
    const fileId = clean(fileIdRaw);
    if (!TR_NUM.test(deliveryNumber) || !UUID.test(fileId))
      return { success: false as const, error: "Geçersiz sorgu bilgisi." };
    const supabase = await assertAuthorized();
    const { data: rawRows, error: rawErr } = await supabase
      .from("erp_raw_shipments")
      .select("sd_document")
      .eq("file_id", fileId)
      .eq("delivery_number", deliveryNumber);
    if (rawErr) throw rawErr;
    const sdDocuments = Array.from(
      new Set((rawRows ?? []).map((r) => clean(r.sd_document)).filter(Boolean)),
    );
    if (!sdDocuments.length) return { success: true as const, data: null };

    const { data, error } = await supabase
      .from("cargo_records")
      .select(
        "id,missing_address,is_returned,aras_tracking_number,note,created_at",
      )
      .eq("delivery_number", deliveryNumber)
      .in("sd_document", sdDocuments)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { success: true as const, data: data ?? null };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Kayıt durumu okunamadı.",
    };
  }
}
