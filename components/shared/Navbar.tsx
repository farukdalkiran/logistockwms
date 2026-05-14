"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import {
  LogOut,
  Menu,
  X,
  MapPin,
  ShieldAlert,
  LayoutDashboard,
  Users,
  ShoppingCart,
  Settings,
  Clock,
  Search,
  Maximize,
  Minimize,
  ChevronDown,
  FileText,
  ScanLine,
  Package,
} from "lucide-react";

export const Navbar = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, branch_id, branches(name)")
            .eq("id", user.id)
            .single();

          setUserProfile({
            id: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name || "Faruk Dalkıran",
            role: profile?.role || "Developer",
            branchName: profile?.branches?.name || "Şube Tanımsız",
            isGlobalAdmin:
              profile?.role === "Developer" || profile?.role === "Admin",
          });
        }
      } catch (error) {
        console.error("Kullanıcı verisi çekilemedi:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();

    const handleFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .catch((err) => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const navLinks = [
    {
      name: "Dashboard",
      path: "/management",
      icon: <LayoutDashboard size={18} />,
    },
    {
      name: "Ürün & Stok",
      path: "/management/products",
      icon: <Package size={18} />,
      subItems: [
        { name: "Ürün Listesi & Katalog", path: "/management/products" },
        { name: "Stok Görüntüleme", path: "/management/inventory/view" },
        { name: "Raf Düzenleme", path: "/management/inventory/shelves" },
        { name: "Koli Yönetimi", path: "/management/inventory/boxes" },
      ],
    },
    {
      name: "Mesai & İK",
      path: "/management/hr",
      icon: <Users size={18} />,
      subItems: [
        { name: "Personel Listesi", path: "/management/hr/personnel" },
        { name: "İzin Talepleri", path: "/management/hr/leaves" },
        { name: "Manuel Log Düzenleme", path: "/management/hr/logs" },
      ],
    },
    {
      name: "Sarf Sipariş",
      path: "/management/b2b",
      icon: <ShoppingCart size={18} />,
    },
    {
      name: "Raporlar & Çıktı",
      path: "/management/print",
      icon: <FileText size={18} />,
      subItems: [
        { name: "Detaylı Stok Raporu", path: "/management/print/stock" },
        {
          name: "Kritik Stok Uyarısı (B2B)",
          path: "/management/print/critical",
        },
        {
          name: "Şube Performans Özeti",
          path: "/management/print/performance",
        },
        { name: "Termal Etiket (Zebra)", path: "/management/print/labels" },
        { name: "Teslim Tutanakları", path: "/management/print/documents" },
      ],
    },
  ];

  // ARAMA MOTORU LOJİĞİ (Tüm menü ve alt menüleri düz bir listeye çevirir)
  const searchableLinks = navLinks.flatMap((link) => {
    const items = [{ name: link.name, path: link.path, parent: null }];
    if (link.subItems) {
      link.subItems.forEach((sub) => {
        items.push({ name: sub.name, path: sub.path, parent: link.name });
      });
    }
    return items;
  });

  // Kullanıcının yazdığı kelimeye göre eşleşenleri filtrele
  const searchResults =
    searchQuery.trim() === ""
      ? []
      : searchableLinks.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.parent &&
              item.parent.toLowerCase().includes(searchQuery.toLowerCase())),
        );

  const locationName = isLoading
    ? "Yükleniyor..."
    : userProfile?.isGlobalAdmin
      ? "Merkez Ofis"
      : userProfile?.branchName;

  const getInitials = (name: string) => {
    if (!name) return "WM";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="sticky top-0 z-50 flex flex-col w-full shadow-md">
      {/* 1. KAT: TOP BAR */}
      <div className="bg-[#0f172b] text-slate-300 h-12 border-b border-slate-800/50 relative z-50">
        <div className="container mx-auto 2xl:max-w-[1400px] h-full flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4 lg:gap-6 w-auto lg:w-1/3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/50 border border-slate-700/50 text-xs font-semibold"
              title="Veritabanı Realtime Bağlantısı Aktif"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 tracking-wide hidden sm:inline-block">
                WMS Çevrimiçi
              </span>
            </div>

            {/* ARAMA ÇUBUĞU VE SONUÇLAR BAŞLANGIÇ */}
            <div className="relative hidden lg:block w-64">
              <div className="flex items-center bg-slate-800/80 rounded-md px-3 py-1.5 border border-slate-700/50 focus-within:border-[#dc3545] focus-within:ring-1 focus-within:ring-[#dc3545] transition-all">
                <Search size={14} className="text-slate-400 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Modül veya sayfa ara..."
                  className="bg-transparent border-none outline-none text-white w-full placeholder:text-slate-500 text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Arama Sonuçları Dropdown */}
              {searchQuery && (
                <div className="absolute top-full left-0 mt-1.5 w-full bg-white rounded-md shadow-xl border border-slate-200 overflow-hidden z-[60]">
                  {searchResults.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto py-1">
                      {searchResults.map((res, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            router.push(res.path);
                            setSearchQuery(""); // Tıklandıktan sonra aramayı temizle
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-red-50 hover:text-[#dc3545] transition-colors border-b border-slate-50 last:border-0"
                        >
                          <div className="font-bold">{res.name}</div>
                          {res.parent && (
                            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              {res.parent} &gt; {res.name}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-slate-500">
                      "{searchQuery}" için sonuç bulunamadı.
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* ARAMA ÇUBUĞU BİTİŞ */}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-slate-400 justify-center w-1/3 text-xs font-semibold">
            <Clock size={14} />
            <span className="tracking-wide">
              {new Date().toLocaleDateString("tr-TR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center gap-4 lg:gap-5 w-auto lg:w-1/3 justify-end h-full relative">
            <div className="flex items-center border-r border-slate-700 pr-4 lg:pr-5 h-full">
              <button
                onClick={toggleFullScreen}
                className="text-slate-400 hover:text-white transition-colors"
                title="Tam Ekran Modu"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </div>

            {/* Kullanıcı Dropdown */}
            <div className="relative group h-full flex items-center cursor-pointer">
              <div className="flex items-center gap-2 hover:bg-slate-800/50 p-1.5 rounded-md transition-colors">
                <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white text-[11px] font-bold border border-indigo-500 shadow-inner">
                  {isLoading ? "..." : getInitials(userProfile?.fullName)}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-none ml-1">
                  <span className="text-white text-xs font-bold">
                    {isLoading ? "..." : userProfile?.fullName}
                  </span>
                  <span className="text-[10px] text-[#dc3545] font-extrabold uppercase tracking-widest mt-0.5">
                    {isLoading ? "..." : userProfile?.role}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className="text-slate-400 group-hover:text-white transition-colors ml-1"
                />
              </div>

              <div className="absolute top-full right-0 pt-2 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden transform origin-top-right scale-95 group-hover:scale-100 transition-transform">
                  <div className="p-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-slate-800 text-sm font-bold truncate">
                      {userProfile?.fullName}
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5 uppercase tracking-wide">
                      ID: {userProfile?.id?.substring(0, 8) || "..."}
                    </p>
                  </div>
                  <div className="py-1">
                    <button className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 hover:text-[#dc3545] transition-colors font-medium">
                      <Settings size={15} className="mr-2.5" /> Sistem Ayarları
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-bold transition-colors"
                    >
                      <LogOut size={15} className="mr-2.5" /> Güvenli Çıkış
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KAT: MAIN BAR */}
      <nav className="bg-white/95 backdrop-blur-md h-20 border-b border-slate-200 relative z-40">
        <div className="container mx-auto 2xl:max-w-[1400px] h-full flex items-center justify-between">
          <div className="flex items-center gap-6 lg:gap-8 h-full">
            <Link
              href="/management"
              className="flex-shrink-0 flex items-center justify-center cursor-pointer gap-2"
            >
              {/* 1. Hayalet Eleman: Yazının genişliği kadar yer kaplar ama görünmez. 
         Bu, logonun tam merkezde kalmasını sağlar. */}
              <span className="text-[15px] font-black opacity-0 select-none uppercase tracking-tight">
                WMS
              </span>

              {/* 2. Merkezdeki Logo */}
              <Logo variant="primary" className="text-3xl" />

              {/* 3. Gerçek Yazı: Alta hizalı (self-end) */}
              <span className="text-[#0f172b] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </Link>

            {/* Navigasyon Linkleri (lg kırılımında çıkar) */}
            <div className="hidden lg:flex h-full gap-1">
              {navLinks.map((link) => {
                const isActive =
                  link.path === "/management"
                    ? pathname === "/management"
                    : pathname.startsWith(link.path) ||
                      link.subItems?.some((sub) =>
                        pathname.startsWith(sub.path),
                      );

                return (
                  <div
                    key={link.name}
                    className="relative group h-full flex items-center"
                  >
                    <Link
                      href={link.path}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-bold transition-all
                        ${isActive ? "bg-red-50 text-[#dc3545]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}
                      `}
                    >
                      <span
                        className={`${isActive ? "text-[#dc3545]" : "text-slate-400 group-hover:text-slate-600"} transition-colors`}
                      >
                        {link.icon}
                      </span>
                      {link.name}
                      {link.subItems && (
                        <ChevronDown
                          size={14}
                          className={`ml-0.5 transition-transform group-hover:rotate-180 ${isActive ? "text-[#dc3545]" : "text-slate-400"}`}
                        />
                      )}
                    </Link>

                    {link.subItems && (
                      <div className="absolute top-full left-0 pt-0 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="bg-white rounded-b-lg shadow-lg border border-slate-200 border-t-0 overflow-hidden">
                          <div className="py-2">
                            {link.subItems.map((subItem) => (
                              <Link
                                key={subItem.name}
                                href={subItem.path}
                                className="block px-4 py-2.5 text-sm text-slate-600 hover:bg-red-50 hover:text-[#dc3545] hover:font-bold transition-colors"
                              >
                                {subItem.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-[#dc3545] rounded-t-full"></span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-4 lg:gap-5">
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg group hover:border-slate-300 transition-colors">
              <div
                className={`w-8 h-8 rounded bg-white shadow-sm flex items-center justify-center border ${userProfile?.isGlobalAdmin ? "border-emerald-200 text-emerald-600" : "border-red-200 text-[#dc3545]"}`}
              >
                {userProfile?.isGlobalAdmin ? (
                  <ShieldAlert size={16} />
                ) : (
                  <MapPin size={16} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">
                  {userProfile?.isGlobalAdmin
                    ? "Yetki Seviyesi"
                    : "Aktif Konum"}
                </span>
                <span className="text-[13px] font-extrabold text-slate-800 leading-tight">
                  {locationName}
                </span>
              </div>
            </div>

            <div className="w-px h-8 bg-slate-200"></div>

            <Button
              onClick={() => router.push("/terminal/login")}
              className="h-10 px-6 text-[14px] font-bold uppercase tracking-wide gap-2 bg-[#dc3545] hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              <ScanLine size={18} strokeWidth={2.5} /> Terminal
            </Button>
          </div>

          {/* Mobil Menü Açma Butonu */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 hover:text-[#dc3545] rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* MOBİL & TABLET MENÜ ÇEKMECESİ */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 shadow-2xl absolute top-[112px] left-0 w-full z-40 max-h-[calc(100vh-112px)] overflow-y-auto">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4 border border-slate-100">
              <div className="w-10 h-10 rounded bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-inner">
                {isLoading ? "..." : getInitials(userProfile?.fullName)}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isLoading ? "..." : userProfile?.fullName}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  {locationName}
                </p>
              </div>
            </div>

            {navLinks.map((link) => {
              const isActive =
                link.path === "/management"
                  ? pathname === "/management"
                  : pathname.startsWith(link.path) ||
                    link.subItems?.some((sub) => pathname.startsWith(sub.path));

              return (
                <div key={link.name}>
                  <Link
                    href={link.path}
                    onClick={() => !link.subItems && setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors
                      ${isActive ? "bg-red-50 text-[#dc3545] border border-red-100" : "text-slate-600 hover:bg-slate-50 border border-transparent"}
                    `}
                  >
                    <span
                      className={`${isActive ? "text-[#dc3545]" : "text-slate-400"} transition-colors`}
                    >
                      {link.icon}
                    </span>
                    {link.name}
                  </Link>

                  {/* Mobil Alt Menü */}
                  {link.subItems && isActive && (
                    <div className="pl-11 pr-4 py-2 space-y-1 bg-slate-50/50 rounded-b-xl border-x border-b border-slate-100 -mt-2 pt-4">
                      {link.subItems.map((sub) => (
                        <Link
                          key={sub.name}
                          href={sub.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`block py-2 text-sm ${pathname === sub.path ? "text-[#dc3545] font-bold" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          - {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
              <Button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  router.push("/terminal/login");
                }}
                className="w-full justify-center py-6 text-base shadow-md font-bold"
              >
                <ScanLine size={20} className="mr-2" /> Terminal'e Geç
              </Button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-full px-4 py-3 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold transition-colors"
              >
                <LogOut size={16} className="mr-2" /> Sistemden Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
