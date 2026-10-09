
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ChartNoAxesCombined,
  CircleCheck,
  Globe2,
  LayoutDashboard,
  Package,
  PackageCheck,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

const desktopHero =
  "https://www.lego.com/cdn/cs/set/assets/blt6ceea75b9f7c6c36/bltab94aec1822ad43e-Home_EX-SKU-2025XX-Home-LS-Hero-Standard-Large.png?format=webply&fit=crop&quality=75&width=1600&height=500&dpr=1";

const mobileHero =
  "https://www.lego.com/cdn/cs/set/assets/blte79d136d272c0710/bltab94aec1822ad43e-Home_EX-SKU-2025XX-Home-LS-Hero-Standard-Large.png?format=webply&fit=crop&quality=75&width=600&height=600&dpr=1";

const funnyGif =
  "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnh2bGFvcmMxMG9rdGxwN2RncGR4ZnBleDhkajM0ZGhyamc1Y2l4eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l4q87BzdPfCSEOvKM/giphy.gif";

const borderStyle = (
  primary: string,
  secondary: string
): CSSProperties =>
  ({
    "--border-primary": primary,
    "--border-secondary": secondary,
  }) as CSSProperties;

const quickLinks = [
  {
    title: "Dashboard",
    description:
      "Kargo kayıtlarını, işlem durumlarını ve genel istatistikleri tek ekranda görüntüleyin.",
    href: "eksik-parca/dashboard",
    icon: LayoutDashboard,
    number: "01",
    category: "GENEL BAKIŞ",
    primary: "#2563eb",
    secondary: "#06b6d4",
    iconBg: "bg-blue-600",
    surface: "bg-blue-50/60",
    labelColor: "text-blue-700",
    numberColor: "text-blue-100",
  },
  {
    title: "Kargo Gönderim",
    description:
      "Eksik parça taleplerine ait gönderim kayıtlarını hazırlayın ve kargo operasyonlarını yönetin.",
    href: "eksik-parca/cargo-panel",
    icon: Send,
    number: "02",
    category: "OPERASYON",
    primary: "#10b981",
    secondary: "#03DF95",
    iconBg: "bg-emerald-500",
    surface: "bg-emerald-50/60",
    labelColor: "text-emerald-700",
    numberColor: "text-emerald-100",
  },
  {
    title: "Kargo Sorgulama",
    description:
      "Takip numaralarını, gönderim kayıtlarını ve ilgili kargo bilgilerini hızlıca sorgulayın.",
    href: "eksik-parca/search",
    icon: Search,
    number: "03",
    category: "KAYIT SORGULAMA",
    primary: "#f97316",
    secondary: "#facc15",
    iconBg: "bg-orange-500",
    surface: "bg-orange-50/60",
    labelColor: "text-orange-700",
    numberColor: "text-orange-100",
  },
  {
    title: "Gönderim Performansı",
    description:
      "İşlem yoğunluğunu, gönderim istatistiklerini ve operasyon performansını analiz edin.",
    href: "eksik-parca/performance",
    icon: BarChart3,
    number: "04",
    category: "VERİ ANALİZİ",
    primary: "#8b5cf6",
    secondary: "#ec4899",
    iconBg: "bg-violet-600",
    surface: "bg-violet-50/60",
    labelColor: "text-violet-700",
    numberColor: "text-violet-100",
  },
];

const features = [
  {
    title: "Uluslararası Talepler",
    description:
      "Yurt dışından iletilen LEGO eksik parça taleplerinin operasyon süreçlerinin yönetimi.",
    icon: Globe2,
    primary: "#FFE722",
    secondary: "#f59e0b",
    iconBg: "bg-[#FFE722]",
    iconColor: "text-slate-900",
  },
  {
    title: "Kargo Yönetimi",
    description:
      "Gönderim kayıtları, kargo işlemleri ve sorgulama operasyonlarının merkezi takibi.",
    icon: PackageCheck,
    primary: "#10b981",
    secondary: "#06b6d4",
    iconBg: "bg-emerald-500",
    iconColor: "text-white",
  },
  {
    title: "Veri ve Kontrol",
    description:
      "İşlem kayıtlarının istatistiksel değerlendirilmesi ve operasyon performansının analiz edilmesi.",
    icon: ShieldCheck,
    primary: "#8b5cf6",
    secondary: "#ec4899",
    iconBg: "bg-violet-600",
    iconColor: "text-white",
  },
];

export default function EksikParcaHomePage() {
  return (
    <main className="min-h-screen bg-slate-50 font-['Quicksand'] text-slate-900">
      <style>{`
        @keyframes homeFade {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes borderSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .home-fade {
          animation: homeFade .55s ease-out both;
        }

        /*
         * RENKLİ DÖNEN BORDER
         * Her kart kendi CSS renk değişkenlerini kullanır.
         */
        .animated-border {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-radius: 4px;
          padding: 2px;
          transition:
            transform .3s ease,
            box-shadow .3s ease;
        }

        .animated-border::before {
          content: "";
          position: absolute;
          inset: -160%;
          z-index: 0;

          background: conic-gradient(
            from 0deg,
            var(--border-primary) 0deg,
            var(--border-secondary) 75deg,
            #ffffff 140deg,
            var(--border-primary) 210deg,
            var(--border-secondary) 290deg,
            var(--border-primary) 360deg
          );

          animation: borderSpin 5s linear infinite;
          will-change: transform;
        }

        .animated-border::after {
          content: "";
          position: absolute;
          inset: 2px;
          background: white;
          border-radius: 2px;
          z-index: 1;
        }

        .animated-border > .card-inner {
          position: relative;
          z-index: 2;
          border-radius: 2px;
        }

        .animated-border:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 25px rgba(15, 23, 42, .09);
        }

        .animated-border:hover::before {
          animation-duration: 1.7s;
        }

        .animated-border:focus-visible {
          outline: 3px solid #0f172a;
          outline-offset: 3px;
        }

        .card-arrow {
          transition: transform .25s ease;
        }

        .animated-border:hover .card-arrow {
          transform: translateX(5px);
        }

        .gif-image {
          transition: transform .5s ease;
        }

        .gif-frame:hover .gif-image {
          transform: scale(1.035);
        }

        @media (prefers-reduced-motion: reduce) {
          .home-fade {
            animation: none;
          }

          .animated-border {
            transition: none;
          }

          .animated-border::before {
            animation: none;
          }

          .animated-border:hover {
            transform: none;
          }

          .gif-image {
            transition: none;
          }

          .gif-frame:hover .gif-image {
            transform: none;
          }
        }
      `}</style>

      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-5 sm:py-7 flex flex-col gap-7">

        {/* SAYFA BAŞLIĞI */}
        <header className="home-fade flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="border-l-4 border-[#FFE722] pl-4">
            <span className="text-[10px] font-black tracking-[.2em] uppercase text-slate-500">
              LEGO / WMS Operasyon Merkezi
            </span>

            <h1 className="mt-1 text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900">
              Eksik Parça Yönetim Sistemi
            </h1>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Kargo operasyonları, gönderim takibi ve performans analizleri
            </p>
          </div>

          <div className="flex items-center gap-2 border border-slate-200 bg-white px-3 py-2 rounded-[4px] w-fit">
            <span className="w-2 h-2 bg-[#FFE722] rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Yönetim Merkezi
            </span>
          </div>
        </header>

        {/* HERO GÖRSELİ */}
        <section className="home-fade">
          <div className="border border-slate-200 bg-white rounded-[4px] overflow-hidden shadow-sm">
            <picture>
              <source
                media="(max-width: 639px)"
                srcSet={mobileHero}
              />
              <img
                src={desktopHero}
                alt="LEGO eksik parça operasyon görseli"
                className="block w-full h-auto"
                fetchPriority="high"
              />
            </picture>
          </div>

          {/* GÖRSEL ALTINDA AÇIKLAMA */}
          <div className="mt-3 bg-slate-900 border border-slate-800 rounded-[4px] p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-[3px] bg-[#FFE722]" />
                  <span className="text-[10px] font-black tracking-[.2em] uppercase text-[#FFE722]">
                    Tek Merkezden Yönetim
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide leading-snug">
                  Her Parça Önemli, Her Gönderim Takip Altında.
                </h2>

                <p className="mt-3 text-sm text-slate-300 font-medium leading-7">
                  LEGO müşterilerinin yurt dışından gelen eksik parça
                  talepleri, kargo gönderim operasyonları ve süreç
                  performansı tek bir yönetim paneli üzerinden takip edilir.
                  Kayıt yönetiminden istatistiksel analizlere kadar tüm
                  işlemler düzenli ve erişilebilir bir yapıda sunulur.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                <Link
                  href="eksik-parca/cargo-panel"
                  className="group flex items-center justify-center gap-3 bg-[#FFE722] hover:bg-yellow-300 text-slate-950 px-5 py-3.5 rounded-[4px] text-xs font-black uppercase tracking-widest transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Kargo Gönderim
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <Link
                  href="eksik-parca/dashboard"
                  className="group flex items-center justify-center gap-3 border border-slate-600 hover:border-[#FFE722] text-white px-5 py-3.5 rounded-[4px] text-xs font-black uppercase tracking-widest transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* RENKLİ ÖZELLİK KARTLARI */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={index}
                className="animated-border shadow-sm"
                style={borderStyle(
                  feature.primary,
                  feature.secondary
                )}
              >
                <div className="card-inner bg-white h-full flex items-start gap-4 p-5">
                  <div
                    className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-[3px] ${feature.iconBg}`}
                  >
                    <Icon
                      className={`w-5 h-5 ${feature.iconColor}`}
                    />
                  </div>

                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
                      {feature.title}
                    </h3>

                    <p className="mt-2 text-xs font-semibold leading-6 text-slate-500">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* YÖNETİM MODÜLLERİ */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-[3px] bg-[#FFE722]" />
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-[.2em]">
                  Hızlı Erişim
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-widest">
                Yönetim Modülleri
              </h2>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                İşlemlerinize devam etmek için ilgili modülü seçin.
              </p>
            </div>

            <span className="hidden sm:block text-[10px] font-black text-slate-400 tracking-widest">
              04 MODÜL
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.number}
                  href={item.href}
                  className="animated-border group shadow-sm block"
                  style={borderStyle(
                    item.primary,
                    item.secondary
                  )}
                >
                  <div
                    className={`card-inner h-full flex flex-col min-h-[245px] ${item.surface}`}
                  >
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start">
                        <div
                          className={`w-12 h-12 flex items-center justify-center rounded-[3px] text-white ${item.iconBg} shadow-sm`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>

                        <span
                          className={`text-4xl font-black font-mono leading-none ${item.numberColor}`}
                        >
                          {item.number}
                        </span>
                      </div>

                      <div className="mt-5">
                        <span
                          className={`text-[9px] font-black uppercase tracking-[.18em] ${item.labelColor}`}
                        >
                          {item.category}
                        </span>

                        <h3 className="mt-1 text-base font-black text-slate-900">
                          {item.title}
                        </h3>

                        <p className="mt-3 text-xs font-semibold text-slate-600 leading-6">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/70 bg-white/80 px-5 py-3.5 flex items-center justify-between">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${item.labelColor}`}
                      >
                        Modüle Git
                      </span>
                      <ArrowRight
                        className={`card-arrow w-4 h-4 ${item.labelColor}`}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* YENİ OPERASYON ARASI / GIF KARTI */}
        <section
          className="animated-border shadow-sm"
          style={borderStyle("#FFE722", "#f59e0b")}
        >
          <div className="card-inner bg-white overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">

              {/* KARE GIF */}
              <div className="bg-slate-100 p-4 sm:p-5 flex justify-center items-center">
                <div className="gif-frame relative w-full max-w-[320px] aspect-square bg-white border border-slate-200 overflow-hidden rounded-[3px]">
                  <img
                    src={funnyGif}
                    alt="LEGO karakterinin komik gizli operasyon yürüyüşü"
                    loading="lazy"
                    className="gif-image w-full h-full object-contain"
                  />

                  <div className="absolute left-2 top-2 bg-[#FFE722] text-slate-900 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-[2px] pointer-events-none">
                    Gizli Görev
                  </div>
                </div>
              </div>

              {/* SAĞ İÇERİK */}
              <div className="p-5 sm:p-7 lg:p-9 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-black tracking-[.2em] uppercase text-amber-600">
                    Operasyon Arası
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-wide leading-tight">
                  Kayıp LEGO Parçası
                  <span className="block text-amber-500">
                    Operasyonu!
                  </span>
                </h2>

                <p className="mt-4 text-sm sm:text-[15px] font-semibold text-slate-600 leading-7 max-w-2xl">
                  Bazı LEGO parçaları ortadan kaybolma konusunda oldukça
                  yetenekli. Özellikle en çok ihtiyaç duyduğunuz anda!
                  Neyse ki eksik parça taleplerini ve kargo gönderimlerini
                  takip etmek artık gizli bir görev kadar karmaşık değil.
                </p>

                <div className="mt-5 flex items-start gap-3 border-l-4 border-[#FFE722] bg-yellow-50 px-4 py-3 rounded-[3px]">
                  <CircleCheck className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                  <p className="text-xs font-bold leading-6 text-slate-700">
                    Görevimiz belli: Parçalar doğru müşteriye,
                    kargo kayıtları doğru sisteme!
                  </p>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
                  <Link
                    href="eksik-parca/search"
                    className="group inline-flex items-center justify-center gap-3 bg-[#FFE722] hover:bg-yellow-300 text-slate-900 rounded-[4px] px-5 py-3.5 text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Kargo Sorgula
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <Link
                    href="eksik-parca/cargo-panel"
                    className="group inline-flex items-center justify-center gap-3 border border-slate-200 hover:border-slate-900 bg-white text-slate-800 rounded-[4px] px-5 py-3.5 text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    <Truck className="w-4 h-4" />
                    Gönderim Paneli
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ALT BİLGİ */}
        <footer className="border-t border-slate-200 py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#FFE722] rounded-[3px] flex items-center justify-center">
              <Package className="w-4 h-4 text-slate-900" />
            </div>

            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Eksik Parça Yönetimi / WMS
            </span>
          </div>

          <span className="text-[10px] font-bold text-slate-400">
            LEGO Eksik Parça Kargo Operasyon Merkezi
          </span>
        </footer>

      </div>
    </main>
  );
}
