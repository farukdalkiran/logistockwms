"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { Logo } from "@/components/ui/Logo";
import * as Icons from "lucide-react";
import {
  LogOut,
  Menu,
  X,
  MapPin,
  ShieldAlert,
  Search,
  Maximize,
  Minimize,
  ChevronDown,
  ScanLine,
  MessageCircleQuestionMark,
  UserCog,
  Lock,
  Settings,
} from "lucide-react";

// VERCEL TİP HATASI VE FORMAT ÇÖZÜMÜ
const DynamicIcon = ({ name, size = 16, className = "" }: { name?: string | null, size?: number, className?: string }) => {
  if (!name) return null;
  
  // Olası boşlukları temizle ve ilk harfi her zaman BÜYÜK yap (Lucide PascalCase kuralı)
  const cleanName = name.trim();
  const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  
  const IconComponent = (Icons as unknown as Record<string, React.ElementType>)[formattedName];
  
  // İkon bulunamazsa Circle (Yuvarlak) döner
  return IconComponent ? <IconComponent size={size} className={className} /> : <Icons.Circle size={size} className={className} />;
};

interface SystemModule {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string; // Yeni modül tespiti için eklendi
  subItems?: SystemModule[];
}

export const Navbar = () => {
  const { userProfile, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [dbPermissions, setDbPermissions] = useState<string[]>([]);
  const [navLinks, setNavLinks] = useState<SystemModule[]>([]);

  useEffect(() => {
    if (isMobileMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const fetchNavbarData = async () => {
      if (!userProfile) return;

      if (userProfile.role !== "Developer") {
        const { data } = await supabase
          .from("roles")
          .select("permissions")
          .eq("role_code", userProfile.role)
          .single();

        if (data && Array.isArray(data.permissions)) {
          setDbPermissions(data.permissions);
        }
      }

      // Yıldız (*) seçimi created_at bilgisini de getirecektir
      const { data: mods } = await supabase
        .from("system_modules")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (mods) {
        const parents = mods.filter((m: any) => !m.parent_id);
        const tree = parents.map((p: any) => ({
          ...p,
          subItems: mods.filter((m: any) => m.parent_id === p.id).sort((a: any, b: any) => a.sort_order - b.sort_order),
        }));
        setNavLinks(tree as SystemModule[]);
      }
    };

    if (!isLoading) fetchNavbarData();
  }, [userProfile, isLoading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const hasDirectAccess = (moduleId: string) => {
    if (!userProfile) return false;
    if (userProfile.role === "Developer") return true;
    return dbPermissions.includes(moduleId);
  };

  const canViewFolder = (module: SystemModule) => {
    if (!userProfile) return false;
    if (userProfile.role === "Developer") return true;
    if (dbPermissions.includes(module.id)) return true;
    if (module.subItems && module.subItems.some(sub => dbPermissions.includes(sub.id))) return true;
    return false;
  };

  // Son 30 gün içinde eklenmişse TRUE döndürür
  const isModuleNew = (createdAt?: string) => {
    if (!createdAt) return false;
    const diffTime = Math.abs(new Date().getTime() - new Date(createdAt).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  };

  // KESİN EŞLEŞME (Exact Match) - Çakışmaları ve alt modüllerin gereksiz yanmasını önler
  const isPathActive = (targetPath: string) => pathname === targetPath;

  const searchableLinks = useMemo(() => {
    const items: { name: string; path: string; parent: string | null; moduleId: string }[] = [];
    navLinks.forEach((link) => {
      if (hasDirectAccess(link.id)) items.push({ name: link.name, path: link.path, parent: null, moduleId: link.id });
      if (link.subItems) {
        link.subItems.forEach((sub) => {
          if (hasDirectAccess(sub.id)) items.push({ name: sub.name, path: sub.path, parent: link.name, moduleId: sub.id });
        });
      }
    });
    return items;
  }, [navLinks, dbPermissions, userProfile]);

  const searchResults = searchQuery.trim() === "" ? [] : searchableLinks.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.parent && item.parent.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const locationName = isLoading ? "Yükleniyor..." : (userProfile as any)?.branchName || "Merkez Sistem";
  const getInitials = (name?: string | null) => name ? name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() : "WM";
  const canSeeSettingsFolder = hasDirectAccess("settings") || hasDirectAccess("role_settings") || hasDirectAccess("password_settings") || hasDirectAccess("system_settings");

  return (
    <div className="sticky top-0 z-50 flex flex-col w-full shadow-md font-['Quicksand'] select-none">
      
      {/* ==================== 1. KAT: ERP TOP BAR (Karanlık Tema) ==================== */}
      <div className="bg-[#0b1120] text-slate-300 h-[46px] border-b border-slate-800/80 relative z-50">
        <div className="w-full px-4 md:px-6 h-full flex items-center justify-between">
          
          {/* SOL: Terminal ve Modül Arama */}
          <div className="flex items-center gap-4 shrink-0 z-10 bg-[#0b1120] pr-4">
            <button
              onClick={() => router.push("/terminal/login")}
              className="flex items-center justify-center h-7 px-3 text-[10px] font-black uppercase tracking-widest gap-1.5 bg-[#dc3545] hover:bg-red-700 text-white shadow-sm transition-colors rounded"
            >
              <ScanLine size={14} strokeWidth={2.5} /> TERMINAL
            </button>

            <div className="relative hidden lg:block w-48 xl:w-64">
              <div className="flex items-center bg-slate-800/50 rounded px-2.5 py-1 border border-slate-700/50 transition-colors">
                <Search size={13} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Modül veya İşlem Ara..."
                  className="bg-transparent border-none outline-none text-white w-full placeholder:text-slate-500 text-[11px] font-semibold"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>

              {searchQuery && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white rounded shadow-xl border border-slate-200 overflow-hidden z-[60]">
                  {searchResults.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                      {searchResults.map((res, idx) => (
                        <button
                          key={idx}
                          onClick={() => { router.push(res.path); setSearchQuery(""); }}
                          className="w-full text-left px-3 py-2 text-[11px] flex justify-between items-center transition-colors border-b border-slate-50 last:border-0 text-slate-700 hover:bg-red-50 hover:text-[#dc3545]"
                        >
                          <div>
                            <div className="font-bold">{res.name}</div>
                            {res.parent && <div className="text-[9px] mt-0.5 text-slate-400 font-semibold">{res.parent} &gt; {res.name}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-[11px] text-slate-500 font-bold bg-slate-50">Sonuç bulunamadı.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SAĞ: Destek & Profil */}
          <div className="flex items-center gap-3 md:gap-4 h-full shrink-0 z-10 bg-[#0b1120] pl-4 justify-end">
            <div className="flex items-center gap-1">
              <Link href="/management/help" className="flex items-center gap-1.5 hover:bg-slate-800/80 px-2 py-1 rounded transition-colors group">
                <MessageCircleQuestionMark size={14} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-white uppercase hidden md:inline-block tracking-wider transition-colors">Destek</span>
              </Link>
              <button onClick={toggleFullScreen} className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800/80 rounded">
                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
            </div>

            <div className="w-px h-4 bg-slate-700 hidden sm:block"></div>

            <div className="relative group h-full flex items-center cursor-pointer">
              <div className="flex items-center gap-2.5 hover:bg-slate-800/50 px-2 py-1 rounded transition-colors">
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-white text-[11px] font-bold max-w-[120px] truncate">{isLoading ? "Yükleniyor..." : ((userProfile as any)?.fullName || (userProfile as any)?.full_name)}</span>
                  <span className="text-[9px] text-[#dc3545] font-black uppercase tracking-widest">{isLoading ? "..." : userProfile?.role}</span>
                </div>
                <div className={`w-7 h-7 rounded flex items-center justify-center text-white text-[11px] font-black shadow-inner shrink-0 ${userProfile?.role === 'Developer' ? 'bg-[#dc3545]' : 'bg-slate-700'}`}>
                  {isLoading ? ".." : getInitials((userProfile as any)?.fullName || (userProfile as any)?.full_name)}
                </div>
                <ChevronDown size={12} className="text-slate-500 group-hover:text-white transition-colors" />
              </div>

              <div className="absolute top-full right-0 mt-0 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-[100]">
                <div className="absolute -top-2 left-0 w-full h-2 bg-transparent"></div>
                <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                    <div className={`p-2 rounded ${userProfile?.role === 'Developer' ? "bg-red-100 text-[#dc3545]" : "bg-emerald-100 text-emerald-600"}`}>
                      {userProfile?.role === 'Developer' ? <ShieldAlert size={16} /> : <MapPin size={16} />}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Bağlantı Noktası</span>
                      <span className="text-xs font-black text-slate-800 truncate">{locationName}</span>
                    </div>
                  </div>
                  
                  <div className="py-1">
                    {canSeeSettingsFolder && (
                      <>
                        {hasDirectAccess("role_settings") && (
                          <button onClick={() => router.push("/management/role-settings")} className="flex items-center w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-red-50 hover:text-[#dc3545] font-bold transition-colors">
                            <UserCog size={14} className="mr-3 text-slate-400" /> Erişim Ayarları
                          </button>
                        )}
                        {hasDirectAccess("password_settings") && (
                          <button onClick={() => router.push("/management/password-settings")} className="flex items-center w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-red-50 hover:text-[#dc3545] font-bold transition-colors">
                            <Lock size={14} className="mr-3 text-slate-400" /> Çalışan Yönetimi
                          </button>
                        )}
                        {hasDirectAccess("system_settings") && (
                          <button onClick={() => router.push("/management/settings")} className="flex items-center w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-red-50 hover:text-[#dc3545] font-bold border-b border-slate-100 transition-colors">
                            <Settings size={14} className="mr-3 text-slate-400" /> Sistem Ayarları
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={handleLogout} className="flex items-center w-full px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 font-black transition-colors">
                      <LogOut size={14} className="mr-3 text-red-400" /> Güvenli Çıkış
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 2. KAT: MAIN BAR (Aydınlık Tema & Kesintisiz Dropdown) ==================== */}
      <nav className="bg-white h-[52px] border-b border-slate-200 relative z-40">
        <div className="w-full px-4 md:px-6 h-full flex items-center justify-between">
          
          <div className="flex items-center h-full w-full min-w-0">
            <Link href="/" className="flex-shrink-0 flex items-center gap-2 cursor-pointer mr-6 hover:opacity-90 transition-colors">
              <Logo variant="primary" className="text-2xl" />
              <span className="text-slate-900 font-black text-sm tracking-tighter uppercase hidden sm:block">WMS</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 hidden lg:block mr-4"></div>

            <div className="hidden lg:flex h-full items-center gap-1.5 min-w-0">
              {userProfile && navLinks.map((link) => {
                if (!canViewFolder(link)) return null;

                const isClickable = hasDirectAccess(link.id);
                const authSubItems = link.subItems?.filter((sub) => hasDirectAccess(sub.id)) || [];
                const hasSubItems = authSubItems.length > 0;

                // Exact Match Kontrolü (Klasör ise kendisi veya altındaki açık sayfa kontrol edilir)
                const isActive = isPathActive(link.path) || authSubItems.some((sub) => isPathActive(sub.path));

                return (
                  <div key={link.id} className="relative group h-full flex items-center flex-shrink-0">
                    <Link
                      href={isClickable ? link.path : "#"}
                      onClick={(e) => { if (!isClickable && hasSubItems) e.preventDefault(); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors whitespace-nowrap relative ${
                        isActive ? "bg-red-50 text-[#dc3545]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      } ${!isClickable && !hasSubItems ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <DynamicIcon name={link.icon} size={15} className={isActive ? "text-[#dc3545]" : "text-slate-400 group-hover:text-slate-600 transition-colors"} />
<span className="flex items-center gap-1.5">
  {link.name}
  {isModuleNew(link.created_at) && (
    <span className="flex items-center gap-1 px-1.5 py-[2px] text-[9px] font-black bg-red-50 text-[#dc3545] border border-[#dc3545]/20 rounded shadow-sm tracking-wider ml-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#dc3545] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#dc3545]"></span>
      </span>
      YENİ
    </span>
  )}
</span>
                      {hasSubItems && <ChevronDown size={11} className={`transition-colors duration-200 group-hover:rotate-180 ${isActive ? "text-[#dc3545]" : "text-slate-400"}`} />}
                    </Link>

                    {hasSubItems && (
                      <div className="absolute top-full left-0 pt-1 min-w-[220px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-[100]">
                        <div className="absolute -top-1 left-0 w-full h-2 bg-transparent"></div>
                        <div className="bg-white rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden py-1.5 relative">
                          {isActive && <div className="absolute top-0 left-0 w-1 h-full bg-[#dc3545]"></div>}
                          {authSubItems.map((subItem) => {
                            const isSubActive = isPathActive(subItem.path);
                            return (
                              <Link
                                key={subItem.id}
                                href={subItem.path}
                                className={`flex items-center px-4 py-2.5 text-xs transition-colors font-bold ${
                                  isSubActive ? "text-[#dc3545] bg-red-50/50" : "text-slate-600 hover:bg-slate-50 hover:text-[#dc3545]"
                                }`}
                              >
                                <span className="truncate">{subItem.name}</span>
                                {isModuleNew(subItem.created_at) && (
                                  <span className="ml-2 px-1.5 py-[2px] text-[8px] font-black bg-[#dc3545] text-white rounded shadow-sm animate-pulse tracking-wider shrink-0">YENİ</span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 hover:text-[#dc3545] rounded-lg transition-colors flex-shrink-0">
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* ==================== MOBİL & TABLET MENÜ ÇEKMECESİ ==================== */}
      <div 
        className={`fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <div 
          className={`absolute top-0 right-0 w-[85%] max-w-sm h-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <Logo variant="primary" className="text-xl" />
              <span className="font-black text-sm uppercase tracking-tighter text-slate-900">MENÜ</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-[#dc3545] hover:bg-red-50 rounded-lg transition-colors">
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-black shadow-inner shrink-0 ${userProfile?.role === 'Developer' ? 'bg-[#dc3545]' : 'bg-slate-700'}`}>
                {isLoading ? "..." : getInitials((userProfile as any)?.fullName || (userProfile as any)?.full_name)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{isLoading ? "Yükleniyor..." : ((userProfile as any)?.fullName || (userProfile as any)?.full_name)}</p>
                <p className="text-[10px] font-black text-[#dc3545] uppercase tracking-widest mt-0.5 truncate">{userProfile?.role}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
            {userProfile && navLinks.map((link) => {
              if (!canViewFolder(link)) return null;

              const isClickable = hasDirectAccess(link.id);
              const authSubItems = link.subItems?.filter((sub) => hasDirectAccess(sub.id)) || [];
              const hasSubItems = authSubItems.length > 0;
              const isExpanded = mobileExpanded === link.id;
              
              const isActive = isPathActive(link.path) || authSubItems.some((sub) => isPathActive(sub.path));

              return (
                <div key={link.id} className="flex flex-col px-3">
                  <button
                    onClick={() => {
                      if (hasSubItems) {
                        setMobileExpanded(isExpanded ? null : link.id);
                      } else if (isClickable) {
                        router.push(link.path);
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-3 my-0.5 rounded-lg text-xs font-bold transition-colors relative ${
                      isActive && !hasSubItems ? "bg-red-50 text-[#dc3545]" : "text-slate-700 hover:bg-slate-50"
                    } ${!isClickable && !hasSubItems ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <DynamicIcon name={link.icon} size={18} className={isActive ? "text-[#dc3545]" : "text-slate-400"} />
                    <span className="truncate tracking-wide flex items-center gap-1.5">
                      {link.name}
                      {isModuleNew(link.created_at) && (
                        <span className="px-1.5 py-[2px] text-[8px] font-black bg-[#dc3545] text-white rounded shadow-sm animate-pulse tracking-wider">YENİ</span>
                      )}
                    </span>
                    {hasSubItems && (
                      <ChevronDown size={16} className={`ml-auto transition-transform duration-300 ${isExpanded ? "rotate-180 text-[#dc3545]" : "text-slate-400"}`} />
                    )}
                  </button>

                  {hasSubItems && (
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[500px] opacity-100 mb-2" : "max-h-0 opacity-0"}`}>
                      <div className="ml-5 pl-4 border-l-2 border-slate-100 flex flex-col gap-1 py-1">
                        {authSubItems.map((sub) => {
                          const isSubActive = isPathActive(sub.path);
                          return (
                            <Link
                              key={sub.id}
                              href={sub.path}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={`flex items-center py-2.5 px-3 text-[11px] font-bold rounded-lg transition-colors ${
                                isSubActive ? "text-[#dc3545] bg-red-50/50" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                              }`}
                            >
                              <span className="truncate">{sub.name}</span>
                              {isModuleNew(sub.created_at) && (
                                <span className="ml-2 px-1.5 py-[2px] text-[8px] font-black bg-[#dc3545] text-white rounded shadow-sm animate-pulse tracking-wider shrink-0">YENİ</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-full h-[44px] text-xs text-white bg-[#dc3545] hover:bg-red-700 shadow-md rounded-xl font-black transition-colors"
            >
              <LogOut size={16} className="mr-2" /> SİSTEMDEN ÇIKIŞ YAP
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};