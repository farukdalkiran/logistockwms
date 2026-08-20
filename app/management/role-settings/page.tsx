"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  ShieldCheck, Save, Trash2, Key, Users,
  Settings, Activity, ShieldAlert, Search, ChevronRight,
  Copy, CheckSquare, XSquare, Package, ToyBrick, UserCog,
  Fingerprint, LayoutDashboard, Layers, Lock, Check,Newspaper,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

// ====================================================================================
// MERKEZİ NAVİGASYON VE MODÜL KONFİGÜRASYONU
// ====================================================================================
export const SYSTEM_MODULES = [
  { id: "dashboard", name: "Dashboard (Ana Panel)", path: "/management", icon: <LayoutDashboard size={16} /> },
  {
    id: "products", name: "Ürün & Stok", path: "/management/products", icon: <Package size={16} />,
    subItems: [
      { id: "products_catalog", name: "Ürün Listesi & Katalog", path: "/management/products" },
      { id: "inventory_view", name: "Stok Görüntüleme", path: "/management/inventory/view" },
      { id: "shelves", name: "Raf Düzenleme", path: "/management/shelves" },
      { id: "inventory_boxes", name: "Koli Yönetimi", path: "/management/inventory/boxes" },
    ]
  },
  {
    id: "hr", name: "Mesai & İK", path: "/management/hr", icon: <Users size={16} />,
    subItems: [
      { id: "hr_tracking", name: "Canlı Takip", path: "/management/hr" },
      { id: "hr_approvals", name: "Onay Merkezi", path: "/management/hr/approvals" },
      { id: "hr_leaves", name: "İzin Yönetimi", path: "/management/hr/leaves" },
      { id: "hr_personnel", name: "Personel Listesi", path: "/management/hr/personnel" },
      { id: "hr_logs", name: "Manuel Log Düzenleme", path: "/management/hr/logs" },
      { id: "hr_reports", name: "Puantaj & Raporlar", path: "/management/hr/reports" },
    ]
  },
  {
    id: "hr_special", name: "İK Özel", path: "/management/hr/leave-management", icon: <UserCog size={16} />,
    subItems: [
      { id: "hr_leave_management", name: "Yıllık İzin Yönetimi", path: "/management/hr/leave-management" },
    ]
  },
  { id: "cargo", name: "Eksik Parça Yönetimi", path: "/management/cargo", icon: <ToyBrick size={16} /> },
  {
    id: "settings", name: "Erişim & Sistem Ayarları", path: "/management/role-settings", icon: <Settings size={16} />,
    subItems: [
      { id: "role_settings", name: "Erişim & Yetki Ayarları", path: "/management/role-settings" },
      { id: "password_settings", name: "Çalışan & Şifre Yönetimi", path: "/management/password-settings" },
      { id: "system_settings", name: "Sistem Ayarları", path: "/management/settings" },
    ]
  },
  { id: "terminal", name: "Terminal Ekranı (El Cihazı)", path: "/terminal", icon: <Fingerprint size={16} /> },
    { id: "news", name: "LogiStock Bülten", path: "/management/news", icon: <Newspaper size={16} /> },
];

export default function RoleSettingsPage() {
  const { userProfile, isLoading: isAuthLoading } = useAuth();
  
  // GÜVENLİK DEVLET MAKİNESİ (STATE MACHINE)
  const [accessState, setAccessState] = useState<"VERIFYING" | "DENIED" | "GRANTED">("VERIFYING");
  
  const [roles, setRoles] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // === YETKİ MATRİSİ STATE'LERİ ===
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleName, setNewRoleName] = useState("");

  // ====================================================================================
  // URL GÜVENLİK KALKANI (MUTLAK DOM İZOLASYONU)
  // ====================================================================================
  useEffect(() => {
    if (isAuthLoading) return;

    if (!userProfile) {
      window.location.replace("/login");
      return;
    }

    const verifyAccess = async () => {
      // 1. Mutlak Otorite (Developer) Kalkanı Direkt Aşar.
      if (userProfile.role === "Developer") {
        setAccessState("GRANTED");
        fetchSystemData();
        return;
      }

      // 2. Diğer Roller İçin DB Verifikasyonu
      try {
        const { data, error } = await supabase
          .from("roles")
          .select("permissions")
          .eq("role_code", userProfile.role)
          .single();

        if (error || !data) throw new Error("Yetki Bulunamadı");

        let perms = data.permissions;
        if (typeof perms === "string") {
          perms = perms.replace(/^{|}$/g, "").split(",").map((s: string) => s.trim().replace(/(^"|"$)/g, "")).filter(Boolean);
        }
        if (!Array.isArray(perms)) perms = [];

        // EĞER YETKİ YOKSA, YÖNLENDİRME YAPMA; DOM'U OLDUĞU YERDE KİLİTLE!
        if (!perms.includes("settings") && !perms.includes("role_settings")) {
          setAccessState("DENIED");
        } else {
          setAccessState("GRANTED");
          fetchSystemData();
        }
      } catch (err) {
        setAccessState("DENIED");
      }
    };

    verifyAccess();
  }, [userProfile, isAuthLoading]);

  // YALNIZCA YETKİ GRANTED OLURSA ÇALIŞACAK OLAN VERİ ÇEKİM MOTORU
  const fetchSystemData = async () => {
    try {
      const { data, error } = await supabase.from("roles").select("*").order("id", { ascending: true });
      if (error) throw error;

      const formattedRoles = (data || []).map((role) => {
        let perms = role.permissions || [];
        if (typeof perms === "string") perms = perms.replace(/^{|}$/g, "").split(",").map((s: string) => s.trim().replace(/(^"|"$)/g, "")).filter(Boolean);
        if (!Array.isArray(perms)) perms = [];
        return { ...role, permissions: perms };
      });

      setRoles(formattedRoles);
      if (formattedRoles.length > 0) setSelectedRoleId(formattedRoles[0].id);
    } catch (error: any) {
      toast.error("Yetki verileri çekilirken kritik hata: " + error.message);
    }
  };

  // --- DİNAMİK YETKİ YÖNETİM FONKSİYONLARI ---
  const handleTogglePermission = (moduleId: string, parentId?: string) => {
    if (!selectedRoleId) return;
    setRoles(roles.map((role) => {
      if (role.id === selectedRoleId) {
        // MUTLAK KORUMA: Developer kilitlidir. Admin dahil diğer tüm roller değiştirilebilir.
        if (role.role_code === "Developer") {
          toast.error("Developer yetkileri sistem kalkanı ile korunmaktadır, değiştirilemez.");
          return role;
        }

        let currentPerms = [...role.permissions];
        if (parentId) {
          if (currentPerms.includes(moduleId)) {
            currentPerms = currentPerms.filter((p) => p !== moduleId);
          } else {
            currentPerms.push(moduleId);
            if (!currentPerms.includes(parentId)) currentPerms.push(parentId);
          }
        } else {
          if (currentPerms.includes(moduleId)) {
            const moduleObj = SYSTEM_MODULES.find((m) => m.id === moduleId);
            const subIds = moduleObj?.subItems?.map((s) => s.id) || [];
            currentPerms = currentPerms.filter((p) => p !== moduleId && !subIds.includes(p));
          } else {
            currentPerms.push(moduleId);
          }
        }
        return { ...role, permissions: currentPerms };
      }
      return role;
    }));
  };

  const handleBulkPermission = (action: "selectAll" | "deselectAll") => {
    if (!selectedRoleId) return;
    setRoles(roles.map((role) => {
      if (role.id === selectedRoleId) {
        if (role.role_code === "Developer") return role;
        let newPerms: string[] = [];
        if (action === "selectAll") {
          SYSTEM_MODULES.forEach(m => { newPerms.push(m.id); if (m.subItems) m.subItems.forEach(s => newPerms.push(s.id)); });
        }
        return { ...role, permissions: newPerms };
      }
      return role;
    }));
  };

  const handleCloneRole = async () => {
    const roleToClone = roles.find(r => r.id === selectedRoleId);
    if (!roleToClone) return;
    const newRole = {
      role_code: `${roleToClone.role_code}_Copy_${Math.floor(Math.random() * 1000)}`,
      role_name: `${roleToClone.role_name} (Kopya)`,
      is_system: false,
      permissions: [...roleToClone.permissions],
    };
    try {
      const { data, error } = await supabase.from("roles").insert([newRole]).select().single();
      if (error) throw error;
      setRoles([...roles, { ...data, permissions: newRole.permissions }]);
      setSelectedRoleId(data.id);
      toast.success("Rol başarıyla kopyalandı. Lütfen ismini güncelleyin.");
    } catch (error: any) { toast.error("Kopyalama hatası: " + error.message); }
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    try {
      const updates = roles.map((role) => ({
        id: role.id, role_code: role.role_code, role_name: role.role_name, is_system: role.is_system, permissions: role.permissions,
      }));
      const { error } = await supabase.from("roles").upsert(updates);
      if (error) throw error;
      toast.success("Tüm erişim matrisi başarıyla güncellendi.");
    } catch (error: any) { toast.error("Kaydetme hatası: " + error.message); }
    finally { setIsSaving(false); }
  };

  const handleAddRole = async () => {
    if (!newRoleCode.trim() || !newRoleName.trim()) return toast.error("Kısa kod ve ad zorunludur.");
    const newRole = { role_code: newRoleCode.trim(), role_name: newRoleName.trim(), is_system: false, permissions: [] };
    try {
      const { data, error } = await supabase.from("roles").insert([newRole]).select().single();
      if (error) throw error;
      setRoles([...roles, { ...data, permissions: [] }]);
      setNewRoleCode(""); setNewRoleName("");
      setSelectedRoleId(data.id);
      toast.success("Yeni yetki sınıfı oluşturuldu.");
    } catch (error: any) { toast.error("Hata: " + error.message); }
  };

  const handleDeleteRole = async (roleId: string | number) => {
    try {
      const { error } = await supabase.from("roles").delete().eq("id", roleId);
      if (error) throw error;
      const remainingRoles = roles.filter((r) => r.id !== roleId);
      setRoles(remainingRoles);
      if (selectedRoleId === roleId) setSelectedRoleId(remainingRoles.length > 0 ? remainingRoles[0].id : null);
      toast.success("Yetki sınıfı sistemden kaldırıldı.");
    } catch (error: any) { toast.error("Silme hatası: " + error.message); }
  };

  // ====================================================================================
  // 1. ZIRH DURUMU: DOĞRULANIYOR (Siyah Ekran, Sıfır Veri Sızıntısı)
  // ====================================================================================
  if (accessState === "VERIFYING") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] font-['Quicksand'] bg-slate-900 rounded-lg m-4 border border-slate-800 shadow-2xl">
        <Activity size={48} className="text-[#dc3545] mb-6 animate-pulse" /> 
        <h2 className="text-xl font-black text-white uppercase tracking-widest">Güvenlik Kalkanı Doğrulanıyor</h2>
        <p className="text-slate-400 mt-2 text-sm">Erişim yetkileriniz sunucu üzerinden kontrol ediliyor...</p>
      </div>
    );
  }

  // ====================================================================================
  // 2. ZIRH DURUMU: REDDEDİLDİ (Hard Block - Sayfa Olduğu Yerde Kilitlenir)
  // ====================================================================================
  if (accessState === "DENIED") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] font-['Quicksand'] bg-red-950/20 rounded-lg m-4 border border-red-900/50 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(220,53,69,0.05)_10px,rgba(220,53,69,0.05)_20px)] pointer-events-none"></div>
        <AlertTriangle size={64} className="text-[#dc3545] mb-6 animate-bounce relative z-10" />
        <h1 className="text-3xl font-black text-white uppercase tracking-tight relative z-10">403: Erişim Reddedildi</h1>
        <p className="text-red-400 mt-3 font-semibold text-center max-w-md relative z-10">
          Bu panele giriş yetkiniz bulunmamaktadır. Sisteme yaptığınız bu izinsiz erişim girişimi güvenlik loglarına kaydedilmiştir.
        </p>
        <Button onClick={() => window.location.replace("/management")} className="mt-8 bg-slate-800 hover:bg-slate-700 text-white relative z-10">
          Güvenli Bölgeye Dön
        </Button>
      </div>
    );
  }

  // ====================================================================================
  // 3. ZIRH DURUMU: ONAYLANDI (Main UI Render Edilir)
  // ====================================================================================
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const filteredRoles = roles.filter((r) => r.role_name.toLowerCase().includes(roleSearch.toLowerCase()) || r.role_code.toLowerCase().includes(roleSearch.toLowerCase()));
  
  const isDeveloperMaster = selectedRole?.role_code === "Developer"; 
  const totalSystemPermissions = SYSTEM_MODULES.length + SYSTEM_MODULES.reduce((acc, curr) => acc + (curr.subItems?.length || 0), 0);
  const currentRolePermissionsCount = isDeveloperMaster ? totalSystemPermissions : (selectedRole?.permissions?.length || 0);
  const permissionPercentage = Math.round((currentRolePermissionsCount / totalSystemPermissions) * 100) || 0;

  return (
    <div className="flex flex-col gap-6 pb-20 font-['Quicksand'] max-w-[1400px] mx-auto animate-in fade-in duration-500">
      
      {/* 1. ENDÜSTRİYEL DARK HEADING & GLOBAL KAYDET */}
      <div className="relative w-full flex flex-col justify-center p-6 md:p-8 bg-slate-900 border border-slate-700 rounded-sm shadow-xl overflow-hidden sticky top-0 z-40">
        <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.05)_10px,rgba(255,255,255,0.05)_20px)] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#dc3545]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#dc3545] border border-red-400/30 rounded-sm shadow-[0_0_15px_rgba(220,53,69,0.4)]">
                <ShieldCheck className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Erişim & Yetki Merkezi</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium tracking-wide max-w-2xl">
              LogiStock WMS modülleri için rol bazlı erişim matrisini yapılandırın.
            </p>
          </div>

          <Button onClick={handleSavePermissions} disabled={isSaving} className="bg-[#dc3545] hover:bg-red-700 text-white font-black h-12 px-8 rounded-sm shadow-[0_4px_20px_rgba(220,53,69,0.4)] gap-2 shrink-0 border border-red-500/50 transition-all text-sm uppercase tracking-wider">
            {isSaving ? <span className="animate-spin text-xl">⟳</span> : <Save size={18} strokeWidth={2.5} />}
            {isSaving ? "İşleniyor..." : "Matrisi Kaydet"}
          </Button>
        </div>
      </div>

      {/* 2. KPI KARTLARI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kayıtlı Rol</span>
            <span className="text-2xl font-black text-slate-800">{roles.length} <span className="text-sm font-bold text-slate-400">Grup</span></span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
            <Users size={24} />
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Korumalı Otorite</span>
            <span className="text-2xl font-black text-[#dc3545]">1 <span className="text-sm font-bold text-slate-400">Developer</span></span>
          </div>
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-[#dc3545]">
            <ShieldAlert size={24} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yapılandırılabilir Modül</span>
            <span className="text-2xl font-black text-slate-800">{totalSystemPermissions} <span className="text-sm font-bold text-slate-400">Alt Sekme</span></span>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
            <Layers size={24} />
          </div>
        </div>
      </div>

      {/* 3. DEPARTMAN VE YETKİ MATRİSİ */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* SOL PANEL: Rol Listesi */}
          <div className="xl:col-span-3 flex flex-col gap-4 sticky top-[100px]">
            
            <div className="bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col overflow-hidden max-h-[600px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Rol Ara..." value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} className="w-full pl-9 pr-3 h-10 bg-white border border-slate-300 rounded-sm text-xs font-bold text-slate-800 focus:border-[#dc3545] outline-none transition-colors" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                {filteredRoles.map((role) => {
                  const isSelected = selectedRoleId === role.id;
                  const isDeveloper = role.role_code === "Developer";
                  return (
                    <button
                      key={role.id} onClick={() => setSelectedRoleId(role.id)}
                      className={`text-left p-3 rounded-sm border transition-all flex items-center justify-between ${isSelected ? "bg-red-50 border-[#dc3545] shadow-sm" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-sm font-black flex items-center gap-1.5 ${isSelected ? "text-[#dc3545]" : "text-slate-800"}`}>
                          {role.role_name}
                          {isDeveloper && <Lock size={12} className="text-[#dc3545]" />}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{role.role_code}</span>
                      </div>
                      <ChevronRight size={16} className={isSelected ? "text-[#dc3545]" : "text-slate-300"} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-sm shadow-sm p-5 flex flex-col gap-3">
              <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5"><Key size={12}/> Özel Yetki Sınıfı Yarat</h3>
              <input type="text" placeholder="Kısa Kod (Örn: WAREHOUSE)" value={newRoleCode} onChange={(e) => setNewRoleCode(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} className="w-full px-3 h-10 bg-slate-900 border border-slate-600 text-white rounded-sm text-xs font-bold outline-none focus:border-[#dc3545] transition-colors placeholder:text-slate-500" />
              <input type="text" placeholder="Görüntülenen Ad (Örn: Depo Erişimi)" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="w-full px-3 h-10 bg-slate-900 border border-slate-600 text-white rounded-sm text-xs font-bold outline-none focus:border-[#dc3545] transition-colors placeholder:text-slate-500" />
              <Button onClick={handleAddRole} className="w-full h-10 mt-1 bg-[#dc3545] hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest rounded-sm shadow-md border border-red-500/50">Ekle</Button>
            </div>
          </div>

          {/* SAĞ PANEL: Modül Matrisi */}
          <div className="xl:col-span-9 bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col min-h-[600px]">
            {selectedRole ? (
              <>
                <div className="bg-slate-50 border-b border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      {selectedRole.role_name}
                      {isDeveloperMaster && <span className="text-[9px] bg-red-100 text-[#dc3545] border border-red-200 px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1"><Lock size={10}/> Master Korumalı</span>}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KOD: {selectedRole.role_code}</span>
                      <span className="text-[10px] font-bold text-slate-400">•</span>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{currentRolePermissionsCount} Modül Aktif</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleCloneRole} className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-black uppercase text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-sm transition-colors shadow-sm">
                      <Copy size={12} /> Rolü Kopyala
                    </button>
                    {!isDeveloperMaster && (
                      <button onClick={() => handleDeleteRole(selectedRole.id)} className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-black uppercase text-slate-500 bg-white border border-slate-300 hover:text-white hover:bg-[#dc3545] hover:border-[#dc3545] rounded-sm transition-colors shadow-sm">
                        <Trash2 size={12} /> Sil
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-4 bg-white">
                  <div className="flex-1 w-full max-w-md flex flex-col gap-1.5">
                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <span>Yetki Yoğunluğu</span>
                      <span>%{permissionPercentage}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#dc3545] transition-all duration-500" style={{ width: `${permissionPercentage}%` }}></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-56">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Modül Ara..." value={moduleSearch} onChange={(e) => setModuleSearch(e.target.value)} className="w-full pl-8 pr-3 h-8 bg-slate-50 border border-slate-200 rounded-sm text-xs font-bold text-slate-800 focus:border-[#dc3545] outline-none" />
                    </div>
                    {!isDeveloperMaster && (
                      <div className="flex bg-slate-100 border border-slate-200 rounded-sm p-0.5 shrink-0">
                        <button onClick={() => handleBulkPermission("selectAll")} title="Tümünü Seç" className="p-1 text-slate-500 hover:text-[#dc3545] hover:bg-white rounded transition-colors"><CheckSquare size={14} /></button>
                        <button onClick={() => handleBulkPermission("deselectAll")} title="Tümünü Kaldır" className="p-1 text-slate-500 hover:text-[#dc3545] hover:bg-white rounded transition-colors"><XSquare size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>

                {/* SADELEŞTİRİLMİŞ (CLEAN) MODÜL KARTLARI */}
                <div className="p-5 lg:p-6 flex-1 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    {SYSTEM_MODULES.filter(m => m.name.toLowerCase().includes(moduleSearch.toLowerCase()) || m.subItems?.some(s => s.name.toLowerCase().includes(moduleSearch.toLowerCase()))).map((module) => {
                      const hasMainAccess = isDeveloperMaster || selectedRole.permissions.includes(module.id);

                      return (
                        <div key={module.id} className="flex flex-col bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden transition-all hover:border-slate-300 hover:shadow-md">
                          
                          <div 
                            onClick={() => !isDeveloperMaster && handleTogglePermission(module.id)} 
                            className={`p-3.5 flex items-center justify-between cursor-pointer border-b border-slate-100 transition-colors ${hasMainAccess ? "bg-red-50/20" : "bg-white hover:bg-slate-50"}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-md transition-colors ${hasMainAccess ? "bg-[#dc3545] text-white" : "bg-slate-100 text-slate-400"}`}>
                                {module.icon}
                              </div>
                              <div className="flex flex-col">
                                <h4 className={`text-sm font-bold ${hasMainAccess ? "text-slate-900" : "text-slate-500"}`}>{module.name}</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5 max-w-[150px] truncate" title={module.path}>{module.path}</p>
                              </div>
                            </div>
                            
                            <div className={`w-5 h-5 shrink-0 rounded flex items-center justify-center transition-colors border ${hasMainAccess ? "bg-[#dc3545] border-[#dc3545]" : "bg-slate-50 border-slate-300"}`}>
                              {hasMainAccess && <Check size={14} strokeWidth={3} className="text-white" />}
                            </div>
                          </div>

                          {module.subItems && (
                            <div className="flex flex-col py-1.5 bg-slate-50/50">
                              {module.subItems.map((sub) => {
                                const hasSubAccess = isDeveloperMaster || selectedRole.permissions.includes(sub.id);
                                const isDisabled = isDeveloperMaster || !hasMainAccess;
                                const matchesSearch = moduleSearch === "" || sub.name.toLowerCase().includes(moduleSearch.toLowerCase());

                                if (!matchesSearch && moduleSearch !== "") return null;

                                return (
                                  <div 
                                    key={sub.id} 
                                    onClick={() => !isDisabled && handleTogglePermission(sub.id, module.id)} 
                                    className={`flex items-center justify-between px-4 py-2 transition-colors ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-100"}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1 h-1 rounded-full ${hasSubAccess ? "bg-slate-700" : "bg-slate-300"}`}></div>
                                      <span className={`text-[13px] font-semibold ${hasSubAccess ? "text-slate-800" : "text-slate-400"}`}>{sub.name}</span>
                                    </div>
                                    <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center transition-colors border ${hasSubAccess ? "bg-slate-700 border-slate-700" : "bg-white border-slate-300"}`}>
                                      {hasSubAccess && <Check size={12} strokeWidth={3} className="text-white" />}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[400px]">
                <ShieldAlert size={48} className="mb-4 text-slate-200" />
                <p className="text-sm font-bold uppercase tracking-wider">Lütfen düzenlemek için sol taraftan bir rol seçin.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}