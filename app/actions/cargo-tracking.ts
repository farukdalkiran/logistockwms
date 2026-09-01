"use server";

import * as cheerio from "cheerio";

export async function getPublicArasTracking(trackingNo: string) {
  try {
    if (!trackingNo || trackingNo.trim() === "") {
      throw new Error("Geçerli bir takip numarası girilmedi.");
    }

    // 1. Aras Kargo sunucularına tarayıcı gibi istek atıyoruz
    const response = await fetch(`https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${trackingNo}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Aras Kargo sunucusu şu an yanıt vermiyor.");
    }

    const htmlContent = await response.text();
    const $ = cheerio.load(htmlContent);

    // 2. Aras Kargo'nun hata mesajını kontrol et (Yanlış numara girildiyse)
    const errorMessage = $(".error-message").text(); // Not: Aras'ın güncel DOM class'ına göre revize edilebilir
    if (errorMessage && errorMessage.includes("bulunamadı")) {
      throw new Error("Girdiğiniz takip numarasına ait kargo bulunamadı.");
    }

    // 3. Kargo hareketlerini (Timeline) tablodan çekiyoruz
    // Aras'ın takip sayfasındaki hareket tablosunu kazıyoruz (Genellikle 'table.kargo-hareketleri' veya 'div.timeline' benzeri bir yapıdadır)
    const timeline: any[] = [];
    
    // NOT: Aşağıdaki seçiciler (.table-row, .date vb.) Aras'ın DOM yapısına göre tasarlanmış genel scraping seçicileridir. 
    // Aras arayüzünü güncelledikçe bu kısımdaki class isimlerinin (inspect edilerek) güncellenmesi gerekir.
    $("table tr").each((index, element) => {
      // Başlık satırını atla
      if (index === 0) return; 

      const cols = $(element).find("td");
      if (cols.length >= 3) {
        timeline.push({
          id: index.toString(),
          date: $(cols[0]).text().trim(),
          branch: $(cols[1]).text().trim(),
          status: $(cols[2]).text().trim(),
          isCurrent: index === 1 // En üstteki (ilk) kayıt güncel kayıttır
        });
      }
    });

    // Sayfadan genel durumu çek (Örn: "Teslim Edildi", "Dağıtımda")
    let currentStatus = "DURUM BİLİNMİYOR";
    if (timeline.length > 0) {
        currentStatus = timeline[0].status;
    }

    if (timeline.length === 0) {
       throw new Error("Kargo kaydı bulundu ancak hareket detayı okunamadı. Aras altyapısı yanıt vermiyor olabilir.");
    }

    return {
      success: true,
      data: {
        trackingNo: trackingNo,
        currentStatus: currentStatus,
        timeline: timeline
      }
    };

  } catch (error: any) {
    console.error("Aras Public Tracking Hatası:", error);
    return { 
      success: false, 
      error: error.message || "Sorgulama başarısız oldu." 
    };
  }
}