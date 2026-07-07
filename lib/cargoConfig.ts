// lib/cargoConfig.ts

export const CARRIERS = [
  { 
    id: "kolay_gelsin", 
    name: "Kolay Gelsin", 
    borderColor: "border-[#41ab34]", 
    activeBg: "bg-[#41ab34]", 
    textColor: "text-[#41ab34]",
    bgTint: "bg-[#41ab34]/10",
    logo: "/kg.svg"
  },
  { 
    id: "trendyol", 
    name: "Trendyol Express", 
    borderColor: "border-[#f16623]", 
    activeBg: "bg-[#f16623]", 
    textColor: "text-[#f16623]",
    bgTint: "bg-[#f16623]/10",
    logo: "/trendyol.png"
  },
  { 
    id: "ups", 
    name: "UPS Kargo", 
    borderColor: "border-[#351c15]", 
    activeBg: "bg-[#351c15]", 
    textColor: "text-[#351c15]",
    bgTint: "bg-[#351c15]/10",
    logo: "/ups.webp"
  },
  { 
    id: "hepsijet", 
    name: "Hepsijet", 
    borderColor: "border-[#db1522]", 
    activeBg: "bg-[#db1522]", 
    textColor: "text-[#db1522]",
    bgTint: "bg-[#db1522]/10",
    logo: "/jet.png"
  },
  { 
    id: "aras", 
    name: "Aras Kargo", 
    borderColor: "border-[#00529b]", 
    activeBg: "bg-[#00529b]", 
    textColor: "text-[#00529b]",
    bgTint: "bg-[#00529b]/10",
    logo: "/aras.png"
  },
];

// Akıllı Barkod Doğrulama Motoru
export const validateCargoBarcode = (carrierName: string, barcode: string): { isValid: boolean; errorMsg?: string } => {
  const upperBarcode = barcode.trim().toUpperCase();

  // 1. GLOBAL BLOKAJ KURALI (Ürün Kolilerini Engelleme)
  if (upperBarcode.startsWith("57020") || upperBarcode.startsWith("057020")) {
    return { isValid: false, errorMsg: "ÜRÜN KOLİSİ OKUTULDU! Lütfen kargo etiketi okutun." };
  }

  // 2. FİRMA BAZLI KURALLAR
  switch (carrierName) {
    case "Kolay Gelsin":
      // PRJTS ile başlayanlar veya 0 ile başlayanlar
      if (upperBarcode.startsWith("PRJTS") || upperBarcode.startsWith("0")) {
        return { isValid: true };
      }
      return { isValid: false, errorMsg: "Kolay Gelsin barkodları 'PRJTS' veya '0' ile başlamalıdır!" };

    case "Trendyol Express":
      // 733 ile başlayanlar
      if (upperBarcode.startsWith("733")) {
        return { isValid: true };
      }
      return { isValid: false, errorMsg: "Trendyol barkodları '733' ile başlamalıdır!" };

    case "UPS Kargo":
      // 1Z74VR42 ile başlayanlar
      if (upperBarcode.startsWith("1Z74VR42")) {
        return { isValid: true };
      }
      return { isValid: false, errorMsg: "UPS barkodları '1Z74VR42' ile başlamalıdır!" };

    case "Hepsijet":
      // TS ile başlayanlar
      if (upperBarcode.startsWith("TS")) {
        return { isValid: true };
      }
      return { isValid: false, errorMsg: "Hepsijet barkodları 'TS' ile başlamalıdır!" };

    case "Aras Kargo":
      // Aras için özel kural belirtilmediği için geçici olarak 12-13 haneli rakam kuralı bırakıldı
      if (/^\d{12,14}$/.test(upperBarcode)) {
        return { isValid: true };
      }
      return { isValid: false, errorMsg: "Aras kargo barkodu 12-14 haneli numaralardan oluşmalıdır!" };

    default:
      // Tanımsız firma gelirse güvenlik gereği reddet
      return { isValid: false, errorMsg: "Bilinmeyen kargo firması seçimi!" };
  }
};