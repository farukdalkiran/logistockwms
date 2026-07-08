"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import {
  LogOut,
  Menu,
  X,
  MapPin,
  ShieldAlert,
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
  Lock,
  MessageCircleQuestionMark,
  UserCog,
} from "lucide-react";

type SearchItem = {
  name: string;
  path: string;
  parent: string | null;
  moduleCode: string;
  allowedRoles?: string[];
};

export const Navbar = () => {
  const { userProfile, isLoading } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // KİLİT SORUNUNU ÇÖZEN DİNAMİK YETKİ STATE'İ
  const [dbPermissions, setDbPermissions] = useState<string[]>([]);
  const [dbRoleName, setDbRoleName] = useState("");

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // VERİTABANINDAN GERÇEK ZAMANLI YETKİ ÇEKİCİ
  useEffect(() => {
    const fetchRealPermissions = async () => {
      if (
        userProfile?.role &&
        userProfile.role !== "Developer" &&
        userProfile.role !== "Admin"
      ) {
        const { data } = await supabase
          .from("roles")
          .select("role_code, role_name, permissions");
        if (data) {
          const matchedRole = data.find(
            (r) =>
              r.role_code === userProfile.role ||
              r.role_name === userProfile.role,
          );
          if (matchedRole) {
            setDbRoleName(matchedRole.role_name);
            let perms = matchedRole.permissions || [];
            if (typeof perms === "string") {
              perms = perms
                .replace(/^{|}$/g, "")
                .split(",")
                .map((s: string) => s.trim().replace(/(^"|"$)/g, ""))
                .filter(Boolean);
            }
            setDbPermissions(perms);
          }
        }
      }
    };
    fetchRealPermissions();
  }, [userProfile]);

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

  // 1. ZIRHLI YETKİ KONTROL FONKSİYONU
  const checkAccess = (moduleCode?: string, allowedRoles?: string[]) => {
    if (!userProfile) return false;

    // Master Yetkiler
    if (
      userProfile.role === "Developer" ||
      userProfile.role === "Admin" ||
      userProfile.isGlobalAdmin
    ) {
      return true;
    }

    // A. DB'den Çekilen Kesin İzinler
    if (moduleCode && dbPermissions.length > 0) {
      if (dbPermissions.includes(moduleCode)) return true;
    }

    // B. Hardcoded İzinler
    if (allowedRoles) {
      if (allowedRoles.includes(userProfile.role)) return true;
      if (dbRoleName && allowedRoles.includes(dbRoleName)) return true;
    }

    return false;
  };

  // 2. ANA MENÜ VE ROL İZİNLERİ (Kullanılmayanlar Temizlendi)
  const rawNavLinks = [
    {
      name: "Ürün & Stok",
      path: "/management/products",
      icon: <Package size={18} />,
      moduleCode: "products",
      allowedRoles: [
        "Developer",
        "Admin",
        "Depo Müdürü",
        "Ürün Müdürü",
        "Ürün Müdür Yardımcısı",
        "Ekip Lideri",
      ],
      subItems: [
        {
          name: "Ürün Listesi & Katalog",
          path: "/management/products",
          moduleCode: "products",
          allowedRoles: [
            "Developer",
            "Admin",
            "Ürün Müdürü",
            "Ürün Müdür Yardımcısı",
          ],
        },
        {
          name: "Stok Görüntüleme",
          path: "/management/inventory/view",
          moduleCode: "products",
          allowedRoles: [
            "Developer",
            "Admin",
            "Depo Müdürü",
            "Ekip Lideri",
            "Ürün Müdürü",
          ],
        },
        {
          name: "Raf Düzenleme",
          path: "/management/shelves",
          moduleCode: "shelves",
          allowedRoles: ["Developer", "Admin", "Depo Müdürü"],
        },
        {
          name: "Koli Yönetimi",
          path: "/management/inventory/boxes",
          moduleCode: "products",
          allowedRoles: ["Developer", "Admin", "Depo Müdürü", "Ekip Lideri"],
        },
      ],
    },
    {
      name: "Mesai & İK",
      path: "/management/hr",
      icon: <Users size={18} />,
      moduleCode: "hr",
      allowedRoles: [
        "Developer",
        "Admin",
        "İK Bölge Müdürü",
        "Mağaza Müdürü",
        "Depo Müdürü",
      ],
      subItems: [
        {
          name: "Canlı Takip",
          path: "/management/hr",
          moduleCode: "hr",
          allowedRoles: [
            "Developer",
            "Admin",
            "İK Bölge Müdürü",
            "Mağaza Müdürü",
            "Depo Müdürü",
          ],
        },
        {
          name: "Onay Merkezi",
          path: "/management/hr/approvals",
          moduleCode: "hr",
          allowedRoles: [
            "Developer",
            "Admin",
            "İK Bölge Müdürü",
            "Mağaza Müdürü",
            "Depo Müdürü",
          ],
        },
        {
          name: "İzin Yönetimi",
          path: "/management/hr/leaves",
          moduleCode: "hr",
          allowedRoles: [
            "Developer",
            "Admin",
            "İK Bölge Müdürü",
            "Mağaza Müdürü",
            "Depo Müdürü",
          ],
        },
        {
          name: "Personel Listesi",
          path: "/management/hr/personnel",
          moduleCode: "hr",
          allowedRoles: ["Developer", "Admin", "İK Bölge Müdürü"],
        },
        {
          name: "Manuel Log Düzenleme",
          path: "/management/hr/logs",
          moduleCode: "hr",
          allowedRoles: ["Developer", "Admin", "İK Bölge Müdürü"],
        },
        {
          name: "Puantaj & Raporlar",
          path: "/management/hr/reports",
          moduleCode: "hr",
          allowedRoles: [
            "Developer",
            "Admin",
            "İK Bölge Müdürü",
            "Mağaza Müdürü",
            "Depo Müdürü",
          ],
        },
      ],
    },
    {
      name: "Sarf Sipariş",
      path: "/management/b2b",
      icon: <ShoppingCart size={18} />,
      moduleCode: "b2b",
      allowedRoles: [
        "Developer",
        "Admin",
        "Mağaza Müdürü",
        "Mağaza Personeli",
        "Depo Personeli",
      ],
    },
    {
      name: "Raporlar & Çıktı",
      path: "/management/print",
      icon: <FileText size={18} />,
      moduleCode: "print",
      allowedRoles: [
        "Developer",
        "Admin",
        "Finans & Muhasebe Personeli",
        "Depo Müdürü",
        "Mağaza Müdürü",
      ],
      subItems: [
        {
          name: "Detaylı Stok Raporu",
          path: "/management/print/stock",
          moduleCode: "print",
          allowedRoles: [
            "Developer",
            "Admin",
            "Finans & Muhasebe Personeli",
            "Depo Müdürü",
          ],
        },
        {
          name: "Kritik Stok Uyarısı (B2B)",
          path: "/management/print/critical",
          moduleCode: "print",
          allowedRoles: [
            "Developer",
            "Admin",
            "Finans & Muhasebe Personeli",
            "Mağaza Müdürü",
          ],
        },
        {
          name: "Şube Performans Özeti",
          path: "/management/print/performance",
          moduleCode: "print",
          allowedRoles: ["Developer", "Admin", "Finans & Muhasebe Personeli"],
        },
        {
          name: "Termal Etiket (Zebra)",
          path: "/management/print/labels",
          moduleCode: "print",
          allowedRoles: ["Developer", "Admin", "Depo Müdürü"],
        },
        {
          name: "Teslim Tutanakları",
          path: "/management/print/documents",
          moduleCode: "print",
          allowedRoles: ["Developer", "Admin", "Depo Müdürü", "Mağaza Müdürü"],
        },
      ],
    },
  ];

  // Arama motorundaki Type Error kalıcı olarak çözüldü
  const searchableLinks: SearchItem[] = rawNavLinks.flatMap((link) => {
    const items: SearchItem[] = [
      {
        name: link.name,
        path: link.path,
        parent: null,
        moduleCode: link.moduleCode,
        allowedRoles: link.allowedRoles,
      },
    ];
    if (link.subItems) {
      link.subItems.forEach((sub) => {
        items.push({
          name: sub.name,
          path: sub.path,
          parent: link.name,
          moduleCode: sub.moduleCode,
          allowedRoles: sub.allowedRoles,
        });
      });
    }
    return items;
  });

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
    <div className="sticky top-0 z-50 flex flex-col w-full shadow-md font-['Quicksand']">
      {/* 1. KAT: TOP BAR (Sadeleştirilmiş ve Terminal Sol Üste Alındı) */}
      <div className="bg-[#0f172b] text-slate-300 h-14 border-b border-slate-800/50 relative z-50">
        <div className="container mx-auto 2xl:max-w-[1400px] h-full flex items-center justify-between px-4 sm:px-6">
          {/* Sol Kısım: Terminal & Arama */}
          <div className="flex items-center gap-4 lg:gap-6">
            <Button
              onClick={() => router.push("/terminal/login")}
              className="h-9 px-3 text-[12px] font-black uppercase tracking-wide gap-2 bg-[#dc3545] hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              <ScanLine size={16} strokeWidth={3} /> Terminal
            </Button>

            <div className="relative hidden lg:block w-64">
              <div className="flex items-center bg-slate-800/80 rounded-md px-3 py-1.5 border border-slate-700/50 focus-within:border-[#dc3545] focus-within:ring-1 focus-within:ring-[#dc3545] transition-all">
                <Search size={14} className="text-slate-400 mr-2 shrink-0" />
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

              {searchQuery && (
                <div className="absolute top-full left-0 mt-1.5 w-full bg-white rounded-md shadow-xl border border-slate-200 overflow-hidden z-[60]">
                  {searchResults.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto py-1">
                      {searchResults.map((res, idx) => {
                        const isResAuthorized = checkAccess(
                          res.moduleCode,
                          res.allowedRoles,
                        );
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              router.push(
                                isResAuthorized
                                  ? res.path
                                  : "/management/unauthorized",
                              );
                              setSearchQuery("");
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex justify-between items-center transition-colors border-b border-slate-50 last:border-0
                              ${isResAuthorized ? "text-slate-700 hover:bg-red-50 hover:text-[#dc3545]" : "text-slate-400 bg-slate-50 opacity-70"}`}
                          >
                            <div>
                              <div className="font-bold">{res.name}</div>
                              {res.parent && (
                                <div className="text-[10px] mt-0.5 font-medium">
                                  {res.parent} &gt; {res.name}
                                </div>
                              )}
                            </div>
                            {!isResAuthorized && (
                              <Lock size={12} className="text-slate-300" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-slate-500 font-bold">
                      "{searchQuery}" için sonuç bulunamadı.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sağ Kısım: Destek, Saat, Profil */}
          <div className="flex items-center gap-4 lg:gap-5 justify-end h-full relative">
            <div className="hidden lg:flex items-center gap-2 text-slate-400 justify-center text-xs font-semibold shrink-0">
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

            <div className="w-px h-6 bg-slate-700 hidden lg:block mx-1"></div>

            <div className="flex items-center gap-3">
              <Link
                href="/management/help"
                className="flex items-center gap-2 hover:bg-slate-800/80 px-2.5 py-1.5 rounded-lg transition-colors group"
                title="Sistem Desteği"
              >
                <div className="relative">
                  <MessageCircleQuestionMark
                    size={18}
                    className="text-slate-400 group-hover:text-white transition-colors"
                  />
                  <span className="absolute top-0 right-0 w-2 h-2 bg-[#dc3545] rounded-full border-[1.5px] border-[#0f172b]"></span>
                </div>
                <span className="text-xs font-bold text-slate-400 group-hover:text-white uppercase tracking-wider hidden sm:inline-block">
                  Destek
                </span>
              </Link>

              <button
                onClick={toggleFullScreen}
                className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800/80 rounded-lg"
                title="Tam Ekran Modu"
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>

            <div className="w-px h-6 bg-slate-700 hidden lg:block mx-1"></div>

            <div className="relative group h-full flex items-center cursor-pointer">
              <div className="flex items-center gap-2 hover:bg-slate-800/50 p-1.5 rounded-md transition-colors">
                <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-inner">
                  {isLoading ? "..." : getInitials(userProfile?.fullName)}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-none ml-1">
                  <span className="text-white text-[13px] font-bold">
                    {isLoading ? "..." : userProfile?.fullName}
                  </span>
                  <span className="text-[10px] text-[#dc3545] font-extrabold uppercase tracking-widest mt-1">
                    {isLoading ? "..." : userProfile?.role}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className="text-slate-400 group-hover:text-white transition-colors ml-1"
                />
              </div>

              <div className="absolute top-full right-0 pt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden transform origin-top-right scale-95 group-hover:scale-100 transition-transform">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                    <div
                      className={`p-2 rounded-md ${userProfile?.isGlobalAdmin ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-[#dc3545]"}`}
                    >
                      {userProfile?.isGlobalAdmin ? (
                        <ShieldAlert size={16} />
                      ) : (
                        <MapPin size={16} />
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                        Konum
                      </span>
                      <span className="text-sm font-black text-slate-800 truncate">
                        {locationName}
                      </span>
                    </div>
                  </div>
                  <div className="py-1">
                    {(userProfile?.role === "Developer" ||
                      userProfile?.role === "Admin" ||
                      userProfile?.isGlobalAdmin) && (
                      <>
                        <button
                          onClick={() =>
                            router.push("/management/role-settings")
                          }
                          className="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-red-50 hover:text-[#dc3545] transition-colors font-bold"
                        >
                          <UserCog size={16} className="mr-3 text-slate-400" />{" "}
                          Erişim Ayarları
                        </button>
                        <button
                          onClick={() =>
                            router.push("/management/password-settings")
                          }
                          className="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-red-50 hover:text-[#dc3545] transition-colors font-bold"
                        >
                          <Lock size={16} className="mr-3 text-slate-400" />{" "}
                          Çalışan Yönetimi
                        </button>
                        <button
                          onClick={() => router.push("/management/settings")}
                          className="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-red-50 hover:text-[#dc3545] transition-colors font-bold border-b border-slate-100"
                        >
                          <Settings size={16} className="mr-3 text-slate-400" />{" "}
                          Sistem Ayarları
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-black transition-colors"
                    >
                      <LogOut size={16} className="mr-3 text-red-400" /> Güvenli
                      Çıkış
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
        <div className="container mx-auto 2xl:max-w-[1400px] h-full flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6 lg:gap-8 h-full">
            <Link
              href="/management"
              className="flex-shrink-0 flex items-center justify-center cursor-pointer gap-2"
            >
              <Logo variant="primary" className="text-3xl" />
              <span className="text-[#0f172b] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
                WMS
              </span>
            </Link>

            <div className="hidden lg:flex h-full gap-2">
              {userProfile &&
                rawNavLinks.map((link) => {
                  const isAuthorized = checkAccess(
                    link.moduleCode,
                    link.allowedRoles,
                  );
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
                        href={
                          isAuthorized ? link.path : "/management/unauthorized"
                        }
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-[14px] font-bold transition-all relative
                        ${
                          !isAuthorized
                            ? "text-slate-400 opacity-60 hover:bg-slate-50 cursor-not-allowed"
                            : isActive
                              ? "bg-red-50 text-[#dc3545]"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }
                      `}
                      >
                        <span
                          className={`${!isAuthorized ? "text-slate-300" : isActive ? "text-[#dc3545]" : "text-slate-400 group-hover:text-slate-600"} transition-colors`}
                        >
                          {link.icon}
                        </span>
                        {link.name}

                        {!isAuthorized ? (
                          <Lock size={14} className="ml-1 text-slate-300" />
                        ) : link.subItems ? (
                          <ChevronDown
                            size={14}
                            className={`ml-1 transition-transform group-hover:rotate-180 ${isActive ? "text-[#dc3545]" : "text-slate-400"}`}
                          />
                        ) : null}
                      </Link>

                      {isAuthorized && link.subItems && (
                        <div className="absolute top-full left-0 pt-0 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                          <div className="bg-white rounded-b-lg shadow-lg border border-slate-200 border-t-0 overflow-hidden">
                            <div className="py-2">
                              {link.subItems.map((subItem) => {
                                const isSubAuthorized = checkAccess(
                                  subItem.moduleCode,
                                  subItem.allowedRoles,
                                );
                                return (
                                  <Link
                                    key={subItem.name}
                                    href={
                                      isSubAuthorized
                                        ? subItem.path
                                        : "/management/unauthorized"
                                    }
                                    className={`flex items-center justify-between px-5 py-3 text-sm transition-colors font-semibold
                                    ${
                                      !isSubAuthorized
                                        ? "text-slate-400 opacity-60 bg-slate-50/50 hover:bg-slate-100 cursor-not-allowed"
                                        : "text-slate-600 hover:bg-red-50 hover:text-[#dc3545] hover:font-bold"
                                    }
                                  `}
                                  >
                                    {subItem.name}
                                    {!isSubAuthorized && (
                                      <Lock
                                        size={12}
                                        className="text-slate-300"
                                      />
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Kırmızı Aktif Çizgisi */}
                      {isActive && isAuthorized && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#dc3545] rounded-t-full shadow-[0_0_8px_rgba(220,53,69,0.5)]"></span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 hover:text-[#dc3545] rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </nav>

      {/* MOBİL & TABLET MENÜ ÇEKMECESİ */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 shadow-2xl absolute top-[136px] left-0 w-full z-40 max-h-[calc(100vh-136px)] overflow-y-auto">
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl mb-4 border border-slate-100">
              <div className="w-12 h-12 rounded bg-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-inner">
                {isLoading ? "..." : getInitials(userProfile?.fullName)}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isLoading ? "..." : userProfile?.fullName}
                </p>
                <p className="text-xs text-slate-500 font-semibold">
                  {locationName}
                </p>
              </div>
            </div>

            {userProfile &&
              rawNavLinks.map((link) => {
                const isAuthorized = checkAccess(
                  link.moduleCode,
                  link.allowedRoles,
                );
                const isActive =
                  link.path === "/management"
                    ? pathname === "/management"
                    : pathname.startsWith(link.path) ||
                      link.subItems?.some((sub) =>
                        pathname.startsWith(sub.path),
                      );

                return (
                  <div key={link.name}>
                    <Link
                      href={
                        isAuthorized ? link.path : "/management/unauthorized"
                      }
                      onClick={() =>
                        !link.subItems && setIsMobileMenuOpen(false)
                      }
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-colors relative
                      ${!isAuthorized ? "text-slate-400 opacity-60 bg-slate-50/50 border border-transparent" : isActive ? "bg-red-50 text-[#dc3545] border border-red-100" : "text-slate-600 hover:bg-slate-50 border border-transparent"}
                    `}
                    >
                      <span
                        className={`${!isAuthorized ? "text-slate-300" : isActive ? "text-[#dc3545]" : "text-slate-400"} transition-colors`}
                      >
                        {link.icon}
                      </span>
                      {link.name}
                      {!isAuthorized && (
                        <Lock size={16} className="ml-auto text-slate-300" />
                      )}
                    </Link>

                    {link.subItems && isActive && isAuthorized && (
                      <div className="pl-11 pr-4 py-2 space-y-1 bg-slate-50/50 rounded-b-xl border-x border-b border-slate-100 -mt-2 pt-4">
                        {link.subItems.map((sub) => {
                          const isSubAuthorized = checkAccess(
                            sub.moduleCode,
                            sub.allowedRoles,
                          );
                          return (
                            <Link
                              key={sub.name}
                              href={
                                isSubAuthorized
                                  ? sub.path
                                  : "/management/unauthorized"
                              }
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={`flex items-center justify-between py-2.5 text-sm font-semibold ${!isSubAuthorized ? "text-slate-400 opacity-60" : pathname === sub.path ? "text-[#dc3545] font-bold" : "text-slate-600 hover:text-slate-900"}`}
                            >
                              <span>- {sub.name}</span>
                              {!isSubAuthorized && (
                                <Lock size={14} className="text-slate-300" />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

            <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
              {(userProfile?.role === "Developer" ||
                userProfile?.role === "Admin" ||
                userProfile?.isGlobalAdmin) && (
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push("/management/role-settings");
                  }}
                  className="w-full justify-center py-6 text-sm font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl"
                >
                  <UserCog size={18} className="mr-2" /> Çalışan Yönetimi
                </Button>
              )}
              {(userProfile?.role === "Developer" ||
                userProfile?.role === "Admin" ||
                userProfile?.isGlobalAdmin) && (
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push("/management/password-settings");
                  }}
                  className="w-full justify-center py-6 text-sm font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl"
                >
                  <UserCog size={18} className="mr-2" /> Şifre Yönetimi
                </Button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-full px-4 py-4 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-bold transition-colors"
              >
                <LogOut size={18} className="mr-2" /> Sistemden Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};