# LogiStock WMS Tasarım Sistemi (v1)

## Amaç
Yönetim, depo operasyonu, personel, sipariş ve terminal ekranlarında tek bir görünüm/etkileşim dili.
**Mevcut veri sorguları, yetki akışları ve server action'lar tasarım geçişinde değiştirilmez.**

## Temel kurallar
- Marka: #dc3545, hover #bd2635. Nötr: slate 50/100/200/500/800/900.
- Font: Arial -> Helvetica -> system-ui. Google Fonts veya custom font indirilmez.
- Köşe yarıçapı: 5px (yuvarlak avatar/durum noktaları hariç).
- Boyutlar: başlık 20-26px, bölüm 14-16px, metin 13-14px, yardımcı metin >=12px.
- Boşluk: 4/8/12/16/20/24px. Sayfa aralığı 24px, mobilde 16px.
- Odak: klavye ile görünür kırmızı focus ring. Disabled gerçekten disabled olmalıdır.
- Renk tek başına anlam taşımaz: her durumun metin etiketi olmalıdır.
- Form: gerçek label, zorunlu alan, hata mesajı ve loading state.
- Modal/Drawer: ESC ile kapanır, odak içeride kalır, kapandığında odak tetikleyiciye döner.
- Tablo: yatay taşma kontrolü, yükleniyor/boş/hata durumları, karşılaştırılabilir sayısal sütunlar.
- Şube kapsamı ve roller sadece UI'da değil, sunucu katmanında denetlenir.

## Tek kaynaklar
- Token ve uyumluluk katmanı: app/globals.css
- Ortak sunum bileşenleri: components/ui/wms.tsx
- Button: components/ui/Button.tsx
- Dialog: components/ui/WmsDialog.tsx
- Drawer: components/ui/Drawer.tsx
- Sayfa iskeleti: app/management/layout.tsx
- Ortak kabuk: components/shared/Navbar.tsx, components/shared/Footer.tsx

## Örnek kullanım
~~~tsx
import { WmsPageHeader, WmsCard, WmsCardHeader, WmsTable, WmsTableScroll, WmsEmptyState } from "@/components/ui/wms";
import { Button } from "@/components/ui/Button";

export default function Example() {
  return (
    <div className="wms-page">
      <WmsPageHeader eyebrow="Stok Yönetimi" title="Ürünler" description="Ürün listesini yönetin."
        actions={<Button>Yeni ürün</Button>} />
      <WmsCard>
        <WmsCardHeader title="Ürün Listesi" />
        <WmsTableScroll>
          <WmsTable><thead><tr><th>SKU</th><th>Ürün</th></tr></thead><tbody /></WmsTable>
        </WmsTableScroll>
        <WmsEmptyState title="Henüz ürün yok" />
      </WmsCard>
    </div>
  );
}
~~~

## Geçiş stratejisi
1. Tema, tipografi, köşe yuvarlama, form odakları ve buton davranışı global olarak normalize edilir.
2. Yeni sayfalar doğrudan ortak bileşenlerle yazılır.
3. Eski sayfalar risk/boyuta göre parça parça ortak bileşenlere taşınır, iş mantığı korunur.
4. Tek bir ekran "tasarım sistemi tamamlandı" anlamına gelmez: her modül ayrıca görsel ve klavye testi gerektirir.

## Kontrol listesi
- [ ] Desktop 1440px ve mobil 390px ekranlarda test
- [ ] Başlık, kart ve tablo tek stile bağlı
- [ ] Modal ESC ve focus trap
- [ ] Keyboard odakları görünür
- [ ] Boş / hata / yükleniyor durumu
- [ ] Şube ve rol izinlerinde regresyon yok
- [ ] CI (tsc, Next build) başarılı
