"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  Briefcase,
  Activity,
  HeartPulse,
  MapPin,
  Flame,
  ChevronDown,
  ChevronUp,
  Radio,
  Megaphone,
  Gamepad2,
  FileText,
  Search,
  Calendar,
  User,
  Hash,
  ShieldAlert,
  MessageSquare,
  ThumbsUp,
  Send,
  Info
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";

// ============================================================================
// 1. TİP TANIMLAMALARI VE WMS HABER VERİ TABANI
// ============================================================================

type NewsCategory = "TÜMÜ" | "SPOR & TRANSFER" | "SON DAKİKA" | "GÜVENLİK" | "FİNANS" | "OPERASYON" | "SAĞLIK" | "YATIRIM" | "KAYIP";

interface Comment {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  text: string;
  time: string;
}

interface NewsItem {
  id: number;
  title: string;
  date: string;
  category: NewsCategory;
  icon: any;
  image: string;
  excerpt: string;
  content: string;
  author: string;
  tags: string[];
  comments: Comment[];
  likes: number;
}

// Tamamen LogiStock personeline uygun gerçekçi/makara haber veritabanı
const newsData: NewsItem[] = [
  {
    id: 1,
    title: "Transfer Çıkmazı: Furkan Karataş Dönüşe Sıcak Bakmıyor",
    date: "18.08.2026",
    category: "SPOR & TRANSFER",
    icon: Gamepad2,
    image: "https://resmim.net/cdn/2026/08/18/ER682F.md.jpg",
    excerpt: "Sportif direktörlerin yetersiz kaldığı kritik görüşmelerde masadaki tek pürüz: 101 oynamayı öğrenme şartı havada kalıyor.",
    content: "Furkan Karataş'ın depoya geri dönüş süreci adeta yılan hikayesine döndü. Sportif direktörlerin yetersiz kaldığı kritik transfer görüşmelerinde masadaki tek pürüzün '101 oynamayı öğrenmesi şartı' olduğu IK birimleri tarafından raporlandı.\n\nAncak depo mesailerinde 101 masasında ortalığı adeta kan gölüne çeviren ekibin yarattığı sinir krizleri ve toksik rekabet ortamı, Furkan Karataş'ı bu şarta sıcak bakmaktan alıkoyuyor. Masaya oturmanın psikolojik bir test haline geldiği belirtiliyor. Transfer görüşmeleri şimdilik havada kalmış durumda, gözler üst yönetimin vereceği esneklik kararlarında.",
    author: "LogiStock İstihbarat",
    tags: ["Transfer", "101", "Kriz Yönetimi"],
    likes: 42,
    comments: [
      { id: 101, userId: 23232, userName: "Mehmet Dirican", userRole: "Depo Müdürü", text: "101 masası bir deponun vizyonunu ve kriz yönetimini belirler. Bu şart esnetilemez, ya öğrenecek ya öğrenecek.", time: "3 saat önce" },
      { id: 102, userId: 81035, userName: "Sadık Haste", userRole: "Depo Personeli", text: "Çift açmamayı öğrense gerisi benim için yine problem olmayacak.", time: "2 saat önce" },
      { id: 103, userId: 39760, userName: "Faruk Dalkıran", userRole: "Developer", text: "Ben masaya oturmuyorum, sistemi kim yazacak sonra? Furkan'a hak veriyorum.", time: "1 saat önce" }
    ]
  },
  {
    id: 2,
    title: "Tarihi Savunma Düştü: Enes Okumuş Maltepe'ye Uğurlandı",
    date: "18.08.2026",
    category: "SON DAKİKA",
    icon: Flame,
    image: "https://resmim.net/cdn/2026/08/18/ER6ow1.md.jpg",
    excerpt: "18 Ağustos tüm dünyada resmi tatil ilan edildi! Enes Okumuş'un efsanevi kale savunması Buğra Amir'in müdahalesiyle yıkıldı.",
    content: "18.08.2026 tarihi tüm dünyada resmi tatil ilan edildi! Enes Okumuş'un eşine ender rastlanan yoğun kale savunmasına, Buğra Amir'den adeta bir Osmanlı topu edasında müdahale geldi.\n\nYapılan stratejik hamleler sonucu savunma hattı tamamen çöken Enes Bey, gözyaşları eşliğinde Maltepe depoya uğurlandı. Karar sonrası depo koridorlarında dramatik anlar yaşanırken, sevkiyatların bu durumdan etkilenmeyeceği ve operasyonların planlandığı gibi devam edeceği İnsan Kaynakları tarafından tüm birimlere e-posta ile bildirildi.",
    author: "Operasyon Merkezi",
    tags: ["Maltepe", "Sürgün", "Operasyon"],
    likes: 128,
    comments: [
      { id: 201, userId: 77242, userName: "Buğra Erkul", userRole: "Online Takım Lideri", text: "Duygusallığa yer yok, operasyonel gereklilikler rotasyon şart koşar. Maltepe'nin de güçlü savunmalara ihtiyacı var.", time: "5 saat önce" },
      { id: 202, userId: 58204, userName: "Özgür Kurt", userRole: "Depo Personeli", text: "Maltepe o kadar da kötü değil Enes, alışırsın kardeşim. Sadece paletler biraz ağır.", time: "4 saat önce" },
      { id: 203, userId: 10365, userName: "Enes Okumuş", userRole: "Depo Personeli", text: "Ben bitti demeden bitmez... O Maltepe'den geri döneceğim.", time: "1 saat önce" }
    ]
  },
  {
    id: 3,
    title: "Balayı Dönüşü Kabusu: Sadık Bey'e Tuvalet Baskını",
    date: "17.08.2026",
    category: "GÜVENLİK",
    icon: AlertTriangle,
    image: "https://resmim.net/cdn/2026/08/18/ER6Y7C.md.jpg",
    excerpt: "Depoyu bıraktığı gibi bulan Halil Bey cinnet getirdi. Olay tuvalet kapısında gergin anlara sahne oldu.",
    content: "Halil Bey balayı izninden sahalara geri döndü, ancak depoyu tam da bıraktığı gibi bulması bardağı taşıran son damla oldu. Gördüğü operasyonel eksiklikler karşısında cinnet geçiren Halil Bey, faturayı doğrudan Sadık Bey'e kesti ve onu tuvaletteyken bastı.\n\nGörgü tanıklarının tutanaklarına göre Halil Bey'in, 'Ben yokken hiç mi bir şey yapmadınız?!' diyerek kapıya dayandığı ve Sadık Bey'in üzerine yürüdüğü öğrenildi. İnsan Kaynakları duruma el koyarak taraflardan savunma talep etti.",
    author: "Güvenlik Birimi",
    tags: ["Tutanak", "Güvenlik", "Disiplin"],
    likes: 85,
    comments: [
      { id: 301, userId: 81035, userName: "Sadık Haste", userRole: "Depo Personeli", text: "Müsait bir zamanda detaylı ve uzun bir açıklama yapacağım. Olaylar çarpıtılıyor.", time: "1 gün önce" },
      { id: 302, userId: 42873, userName: "Halil Balta", userRole: "Depo Personeli", text: "Sadece 1 hafta yoktum... 1 HAFTA! Bütün raflar aynı duruyordu çıldırmamak elde değil.", time: "1 gün önce" },
      { id: 303, userId: 65761, userName: "Ali Pıtır", userRole: "Depo Personeli", text: "Abi adam balayından gelmiş, elinde termal rulo ile tuvalet kapısı tekmeliyor. Zor ayırdık.", time: "12 saat önce" }
    ]
  },
  {
    id: 4,
    title: "Primler Faizde mi? Oğuz Yılmaz ve Ufuk Bey Mercek Altında",
    date: "16.08.2026",
    category: "FİNANS",
    icon: Briefcase,
    image: "https://resmim.net/cdn/2026/08/18/ER63Yx.md.jpg",
    excerpt: "Geciken primler sonrası ikilinin mesai saatleri içinde elde edilen faiz geliriyle VIP bilardo oynadığı iddia ediliyor.",
    content: "Depoda primlerin bu ay da gecikmesi personel arasında ciddi infial yarattı. İç denetim birimlerine ulaşan iddialara göre Oğuz Yılmaz, prim bütçesini yüksek faizde bekleterek kurum içi gayri resmi bir finansal döngü yarattı.\n\nElde edilen bu yüksek gelirle Ufuk Bey ile mesai saatleri içinde VIP bilardo oynadıkları yönündeki ihbarlar üzerine, İnsan Kaynakları ve Finans departmanı tarafından derinlemesine bir disiplin araştırması başlatıldı. Süreç sonuçlanana kadar yetkililer açıklama yapmaktan kaçınıyor.",
    author: "Finans Denetim",
    tags: ["Finans", "Soruşturma", "Prim"],
    likes: 210,
    comments: [
      { id: 401, userId: 10300, userName: "Oğuz Yılmaz", userRole: "Finans & Muhasebe Uzmanı", text: "Faiz falan yok, tamamen vizyon meselesi. Istakaları kendimiz aldık, yalan haber yapmayalım.", time: "2 gün önce" },
      { id: 402, userId: 79501, userName: "Ufuk Çetin", userRole: "Depo Personeli", text: "Biz o sırada stres atarak vizyon geliştiriyoruz. Bilardo stratejidir.", time: "2 gün önce" },
      { id: 403, userId: 18904, userName: "Semih Uçdu", userRole: "Depo Personeli", text: "Primler yatana kadar o bilardo masasından kalkmayın beyler.", time: "1 gün önce" }
    ]
  },
  {
    id: 5,
    title: "Koltuk Sevdası Sevkiyatı Vurdu: Buğra Amir'den Yeni Rekor",
    date: "15.08.2026",
    category: "OPERASYON",
    icon: Clock,
    image: "https://resmim.net/cdn/2026/08/18/ER6g6k.md.jpg",
    excerpt: "Transfer ürünlerini 2 gün boyunca büyüteçle bekletip raflara aktararak kendi gecikme rekorunu kırdı.",
    content: "Buğra Amir'deki koltuk sevdası ve detaycılık herkesi şaşkına çevirmeye devam ediyor. Bu hafta gelen kritik transfer ürünlerini tam 2 gün boyunca büyüteçle mikroskobik incelemeye tabi tutup ardından raflara aktaran ünlü depo amiri, siparişleri bir kez daha geciktirmeyi başararak kendi operasyonel rekorunu kırdı.\n\nLojistik birimi, bu inceleme süreçleri nedeniyle teslimat sürelerini (SLA) revize etmek zorunda kaldı. Merkez depo yönetimi konuyla ilgili performans iyileştirme raporu talep etti.",
    author: "Lojistik & Süreç Yönetimi",
    tags: ["SLA", "Gecikme", "Lojistik"],
    likes: 64,
    comments: [
      { id: 501, userId: 77242, userName: "Buğra Erkul", userRole: "Online Takım Lideri", text: "Kontrol edilmeyen mal, iade maldır. Süreçleri ben belirliyorum, kalite tesadüf değildir.", time: "3 gün önce" },
      { id: 502, userId: 65761, userName: "Ali Pıtır", userRole: "Depo Personeli", text: "Sisteme girişini yapsaydın bari beklerken abi, stok sıfır görünüyor 2 gündür.", time: "2 gün önce" },
      { id: 503, userId: 39760, userName: "Faruk Dalkıran", userRole: "Developer", text: "Veritabanında transfer tarihi ile kabul tarihi arasında 48 saat fark var, sistemi bozuyorsunuz abi.", time: "1 gün önce" }
    ]
  },
  {
    id: 6,
    title: "Vizyon Yükseltme Operasyonu: Emre Bey'den 1.5M TL'lik Bütçe",
    date: "14.08.2026",
    category: "SAĞLIK",
    icon: HeartPulse,
    image: "https://resmim.net/cdn/2026/08/18/ER6yLL.jpg",
    excerpt: "Görüş kapasitesini %5'ten %14'e çıkarmak için devasa bütçe ayıran Emre Bey ameliyat masasına yatıyor.",
    content: "Deponun turuncu saçlı, kara kaşlı sevilen ismi Emre Bey nihayet ameliyat masasına yatıyor! Mevcut %5 olan görüş kapasitesini %14 seviyesine çıkarmak için kesenin ağzını açan Emre Bey, bu spesifik göz operasyonu için tam 1.5 Milyon TL bütçe ayırdı.\n\nBaşarılı geçmesi beklenen operasyon sonrası, kendisinin el terminalleriyle barkod okuma hızında ve genel toplama (picking) performansında ciddi bir artış bekleniyor. Ekip arkadaşları ve yönetim kendisine acil şifalar diliyor.",
    author: "İnsan Kaynakları Sağlık Masası",
    tags: ["Sağlık", "Ameliyat", "Vizyon"],
    likes: 310,
    comments: [
      { id: 601, userId: 10294, userName: "Emre Yorulmaz", userRole: "Depo Personeli", text: "Ameliyattan sonra o barkodları terminalsiz direkt gözümle okuyacağım. Bekleyin beni.", time: "4 gün önce" },
      { id: 602, userId: 71036, userName: "Emre Alan", userRole: "Depo Personeli", text: "Geçmiş olsun adaş. Çabuk dön, raflar seni bekler.", time: "3 gün önce" },
      { id: 603, userId: 23232, userName: "Mehmet Dirican", userRole: "Depo Müdürü", text: "Barkod okuma hızında %200 artış bekliyorum Emre, geçmiş olsun.", time: "2 gün önce" }
    ]
  },
  {
    id: 7,
    title: "Antalya Dağlarında Sır Oldu: Semih Bey Nerede?",
    date: "13.08.2026",
    category: "KAYIP",
    icon: MapPin,
    image: "https://www.ultratdk.com//public/uploads/rotalar/dscf6633.jpg",
    excerpt: "3 gün zannedilen yıllık iznin IK kayıtlarında 8 gün olduğu ortaya çıktı, saha ile iletişim tamamen koptu.",
    content: "Semih Bey yıllık izinde adeta sırra kadem bastı! Ekip tarafından operasyonel planlamada 3 gün zannedilen yıllık izni, doldurduğu IK formunda 8 gün olarak ortaya çıkınca vardiya planlaması alt üst oldu.\n\nAntalya'nın sarp dağlarında kamp yaptığı bilinen ve GSM iletişimi tamamen kopan Semih Bey'den şu ana kadar hiçbir haber alınamıyor. Depo yönetimi sağ salim dönüp dönmeyeceğini merakla beklerken, yedek vardiya personeli devreye alındı.",
    author: "Vardiya Planlama",
    tags: ["Kayıp", "İzin", "Rotasyon"],
    likes: 92,
    comments: [
      { id: 702, userId: 58204, userName: "Özgür Kurt", userRole: "Depo Personeli", text: "Antalya sıcaktır şimdi, iyi tatiller kardeşim dönme boşver.", time: "3 gün önce" },
      { id: 703, userId: 18904, userName: "Semih Uçdu", userRole: "Depo Personeli", text: "...", time: "(Sistem Notu: Personel kapsama alanı dışında)" }
    ]
  },
  {
    id: 8,
    title: "Ali Pıtır'dan WMS'ye Tam Destek: %15 Hisse İddiası",
    date: "12.08.2026",
    category: "YATIRIM",
    icon: Activity,
    image: "https://www.talentcards.com/blog/wp-content/uploads/people_development.jpg",
    excerpt: "Sistemi istikrarla kullanan ve açık bulmada usta olan Ali Pıtır'a yönetimden büyük jest hazırlığı.",
    content: "Ali Pıtır'dan LogiStock sistemlerine muazzam destek geldi. Bütün fonksiyonları yüksek istikrarla kullanan, sistemdeki log açıklarını bulup test eden Ali Bey, geliştirici ekibimize sürekli kritik dönütler vererek WMS evrimine doğrudan katkı sağlıyor.\n\nYönetim kurulunda, bu özverili çalışmaları ve QA (Kalite Güvence) süreçlerine gönüllü desteği karşılığında kendisine WMS operasyonlarından %15 hisse verilmesi ciddi şekilde tartışılıyor. Yazılım ekibi kendisine teşekkürlerini iletti.",
    author: "Sistem ve Geliştirme",
    tags: ["WMS", "Test & QA", "Hisse"],
    likes: 155,
    comments: [
      { id: 801, userId: 39760, userName: "Faruk Dalkıran", userRole: "Developer", text: "Adam QA test mühendisi gibi çalışıyor helal olsun, logları okumaktan gözlerim kanadı ama Ali abi buluyor açığı.", time: "5 gün önce" },
      { id: 802, userId: 65761, userName: "Ali Pıtır", userRole: "Depo Personeli", text: "Teşekkürler Faruk hocam. Hisse devir sözleşmesi nerede imzalanıyor? Kalemi hazırladım.", time: "5 gün önce" },
      { id: 803, userId: 10300, userName: "Oğuz Yılmaz", userRole: "Finans & Muhasebe Uzmanı", text: "Şirket değerlemesi yapmadan hisse falan dağıtmıyoruz, önce primleri halledelim.", time: "4 gün önce" }
    ]
  }
];

// ============================================================================
// 2. ANA SAYFA BİLEŞENİ VE RENDER ALANI
// ============================================================================

export default function LogiStockNewsBoard() {
  const [expandedNewsId, setExpandedNewsId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<NewsCategory>("TÜMÜ");
  const [searchQuery, setSearchQuery] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

  const categories: NewsCategory[] = ["TÜMÜ", "SON DAKİKA", "SPOR & TRANSFER", "GÜVENLİK", "FİNANS", "OPERASYON", "SAĞLIK", "KAYIP", "YATIRIM"];

  // Filtreleme Mantığı
  const filteredNews = useMemo(() => {
    return newsData.filter((news) => {
      const matchesCategory = activeCategory === "TÜMÜ" || news.category === activeCategory;
      const matchesSearch = news.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            news.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            news.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Accordion tetikleyici (Aşağı Doğru Açılma)
  const toggleExpand = (id: number) => {
    setExpandedNewsId(expandedNewsId === id ? null : id);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const handleCommentChange = (id: number, val: string) => {
    setCommentInputs(prev => ({ ...prev, [id]: val }));
  };

  const submitComment = (id: number) => {
    if (!commentInputs[id]?.trim()) return;
    alert("Yorumunuz onaya gönderildi. (Geliştirme Ortamı)");
    setCommentInputs(prev => ({ ...prev, [id]: "" }));
  };

  return (
    <div className="w-full bg-slate-50 min-h-screen font-sans text-slate-800 pb-16 selection:bg-[#dc3545] selection:text-white">
      
      {/* --- URGENT TICKER (KAYAN YAZI) --- */}
      <div className="w-full bg-white border-b border-slate-200 h-10 flex items-center shadow-sm relative z-10 overflow-hidden">
        <div className="bg-[#dc3545] h-full px-4 flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest shrink-0 border-r border-red-800 z-10">
          <Megaphone size={16} className="mr-2" /> DUYURULAR
        </div>
        <div className="flex-1 whitespace-nowrap overflow-hidden relative text-slate-700">
          <div className="animate-[marquee_25s_linear_infinite] inline-block text-xs font-semibold tracking-wide">
            <span className="mx-8 text-[#dc3545]">• FURKAN KARATAŞ TRANSFERİNDE 101 KRİZİ SÜRÜYOR</span>
            <span className="mx-8">• 18.08.2026 TARİHİ TÜM DÜNYADA RESMİ TATİL İLAN EDİLDİ</span>
            <span className="mx-8 text-[#dc3545]">• YENİ SİSTEM GÜNCELLEMESİ YAYINLANDI, İZİN TALEPLERİNİ SİSTEMDEN GİRİNİZ</span>
            <span className="mx-8">• SEMİH BEY'İ GÖRENLERİN İK BİRİMİNE BİLDİRMESİ RİCA OLUNUR</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-8 flex flex-col gap-6">
        
        {/* --- HEADER VE ARAMA ALANI --- */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[#dc3545] font-bold text-xs tracking-widest uppercase mb-1">
              <Radio size={16} /> WMS İÇ İLETİŞİM AĞI
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Logo variant="primary" className="text-3xl" />
              <span>Gündem Paneli</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              Departman duyuruları, personel hareketleri ve operasyonel güncellemeler.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Haber veya içerik ara..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 rounded-md pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#dc3545] transition-colors"
              />
            </div>
            <div className="hidden sm:flex flex-col text-right px-4 py-2 bg-slate-50 border border-slate-200 rounded-md shrink-0">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tarih</span>
               <span className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* --- KATEGORİ FİLTRELERİ --- */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors border ${
                activeCategory === cat 
                  ? "bg-[#dc3545] text-white border-[#dc3545]" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* --- ANA YAPI (SOL: HABERLER, SAĞ: SİDEBAR) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* =========================================
              SOL BÖLÜM: HABER LİSTESİ (8 SÜTUN)
              ========================================= */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {filteredNews.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-md p-10 text-center flex flex-col items-center justify-center shadow-sm">
                <FileText size={40} className="text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-700">İçerik Bulunamadı</h3>
                <p className="text-slate-500 text-sm mt-1">Seçilen filtrelere veya arama terimine uygun bir haber yok.</p>
              </div>
            )}

            {filteredNews.map((news) => {
              const isExpanded = expandedNewsId === news.id;

              return (
                <div 
                  key={news.id} 
                  className={`bg-white border transition-colors duration-200 ${isExpanded ? 'border-slate-300 shadow-md' : 'border-slate-200 shadow-sm'} rounded-lg overflow-hidden flex flex-col`}
                >
                  <div className="flex flex-col md:flex-row">
                    
                    {/* Görsel Alanı: Zoom hover YOK. Basit ve net object-cover */}
                    <div className="w-full md:w-64 h-48 md:h-auto shrink-0 bg-slate-100 border-b md:border-b-0 md:border-r border-slate-200 relative">
                      <img 
                        src={news.image} 
                        alt={news.title} 
                        className="w-full h-full object-cover object-center" 
                      />
                      <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-white/90 backdrop-blur-sm text-slate-800 border border-slate-200 rounded shadow-sm">
                        {news.category}
                      </span>
                    </div>
                    
                    {/* Özet ve Başlık Alanı */}
                    <div className="p-5 flex flex-col flex-1">
                      
                      <div className="flex items-center gap-3 mb-2 text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> {news.date}</span>
                        <span className="flex items-center gap-1.5"><User size={14} /> {news.author}</span>
                      </div>
                      
                      <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-snug mb-2">
                        {news.title}
                      </h2>
                      
                      {/* Sadece Özet Görünür */}
                      <p className={`text-slate-600 text-sm font-medium flex-1 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                        {news.excerpt}
                      </p>

                      {/* İstatistikler ve Expand Butonu */}
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                          <span className="flex items-center gap-1"><ThumbsUp size={14} /> {news.likes}</span>
                          <span className="flex items-center gap-1"><MessageSquare size={14} /> {news.comments.length}</span>
                        </div>
                        <button 
                          onClick={() => toggleExpand(news.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-[#dc3545] hover:text-red-700 transition-colors"
                        >
                          {isExpanded ? (
                            <>Daralt <ChevronUp size={16} /></>
                          ) : (
                            <>Haberin Tamamı <ChevronDown size={16} /></>
                          )}
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* ================= AÇILIR (ACCORDION) İÇERİK ================= */}
                  {isExpanded && (
                    <div className="flex flex-col border-t border-slate-200 bg-slate-50">
                      
                      {/* Tam Metin */}
                      <div className="p-6 md:p-8 text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-line border-b border-slate-200">
                        {news.content}
                        
                        {/* Etiketler */}
                        {news.tags.length > 0 && (
                          <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-200">
                            <Hash size={14} className="text-slate-400" />
                            {news.tags.map(tag => (
                              <span key={tag} className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Makara Yorum Alanı */}
                      <div className="p-6 md:p-8 bg-white">
                        <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                          <MessageSquare size={16} className="text-[#dc3545]" /> Yorumlar ve Savunmalar ({news.comments.length})
                        </h3>
                        
                        <div className="flex flex-col gap-4">
                          {news.comments.length > 0 ? (
                            news.comments.map(comment => (
                              <div key={comment.id} className="flex gap-3">
                                <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                                  {getInitials(comment.userName)}
                                </div>
                                <div className="flex flex-col bg-slate-50 border border-slate-200 p-4 rounded-lg flex-1">
                                  <div className="flex justify-between items-start mb-1.5">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-900">{comment.userName}</span>
                                      <span className="text-[10px] font-semibold text-slate-500">{comment.userRole}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold">{comment.time}</span>
                                  </div>
                                  <p className="text-sm text-slate-700 font-medium leading-snug">{comment.text}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 font-medium italic">Bu içeriğe henüz savunma veya yorum eklenmemiş.</p>
                          )}
                        </div>

                        {/* Yorum Yap Input */}
                        <div className="mt-6 pt-6 border-t border-slate-100 flex gap-3 items-start">
                          <div className="w-10 h-10 rounded bg-[#dc3545] text-white flex items-center justify-center text-xs font-bold shrink-0">
                            BEN
                          </div>
                          <div className="flex-1 flex flex-col gap-3">
                            <textarea 
                              placeholder="Olayla ilgili savunmanızı veya görüşünüzü ekleyin..." 
                              rows={2}
                              value={commentInputs[news.id] || ""}
                              onChange={(e) => handleCommentChange(news.id, e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#dc3545] transition-colors resize-none custom-scrollbar" 
                            />
                            <div className="flex justify-end">
                              <button 
                                onClick={() => submitComment(news.id)}
                                className="flex items-center gap-1.5 bg-slate-900 text-white px-5 py-2 rounded-md text-xs font-bold hover:bg-[#dc3545] transition-colors"
                              >
                                <Send size={14} /> Gönder
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* =========================================
              SAĞ BÖLÜM: SİDEBAR (4 SÜTUN)
              ========================================= */}
          <div className="lg:col-span-4 flex flex-col gap-6 w-full sticky top-6">
            
            {/* Operasyonel Takvim */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Calendar className="text-[#dc3545]" size={16} />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Operasyonel Takvim</h3>
              </div>
              
              <ul className="flex flex-col gap-4">
                <li className="flex gap-3">
                  <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 text-slate-700 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold leading-none">AĞU</span>
                    <span className="text-sm font-black leading-none mt-0.5">20</span>
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-sm font-bold text-slate-800">Dinamik Sayım Başlangıcı</span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5">Karantina rafları hariç tüm koridorlar.</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 text-slate-700 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold leading-none">AĞU</span>
                    <span className="text-sm font-black leading-none mt-0.5">25</span>
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-sm font-bold text-slate-800">Prim Mutabakatları</span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5">Finans birimi onayları sisteme düşecek.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Sabit Hatırlatmalar */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Info className="text-slate-500" size={16} />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Sabit Kurallar</h3>
              </div>
              <div className="flex flex-col gap-4 text-xs font-medium text-slate-600">
                <div className="flex gap-2 items-start">
                  <span className="text-[#dc3545] font-bold">•</span>
                  <p>Vardiya başlangıcından 15 dakika sonrasına kadar check-in yapmayan personel sisteme "Geç" olarak işlenecektir.</p>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="text-[#dc3545] font-bold">•</span>
                  <p>Zebra termal yazıcılarda rulo değişimi sonrası kalibrasyon düğmesine basmayı unutmayınız.</p>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="text-[#dc3545] font-bold">•</span>
                  <p>Karantina raflarında bekleyen iade ürünler için Yönetici/İK onayı kesinlikle zorunludur.</p>
                </div>
              </div>
            </div>

            {/* Güvenlik & İş Sağlığı (Kırmızı Uyarı) */}
            <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm p-5 flex items-start gap-3">
              <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-800 mb-1">İSG ve Disiplin Kuralı</h4>
                <p className="text-[11px] font-medium text-red-700 leading-relaxed">
                  Forklift yollarında yürümek, transpalet üzerine çıkmak ve depo içerisinde yetkisiz elektrikli araç kullanmak tutanak sebebidir. Lütfen tüm depolama kurallarına uyun.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 4px;
        }
      `}} />
    </div>
  );
}