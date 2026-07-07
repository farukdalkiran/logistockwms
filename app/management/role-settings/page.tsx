"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ShieldCheck, Save, Trash2, Key, Users, CheckCircle2,
  Settings, Activity, ShieldAlert, Search, ChevronRight,
  Copy, CheckSquare, XSquare, Building2, Send,
  Fingerprint, LayoutDashboard, Layers
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

// ====================================================================================
// MERKEZİ NAVİGASYON VE MODÜL KONFİGÜRASYONU
// ====================================================================================
export const SYSTEM_MODULES = [
  { id: "dashboard", name: "Dashboard (Ana Panel)", path: "/management", icon: <LayoutDashboard size={18} /> },
  {
    id: "products", name: "Ürün & Stok Yönetimi", path: "/management/products", icon: <Building2 size={18} />,
    subItems: [
      { id: "products_catalog", name: "Katalog & Ürün Listesi", path: "/management/products/catalog" },
      { id: "inventory_view", name: "Depo Stok Görüntüleme", path: "/management/products/inventory" },
      { id: "inventory_boxes", name: "Koli & Barkod Yönetimi", path: "/management/products/boxes" },
    ]
  },
  {
    id: "shelves", name: "Raf & Lokasyon Yönetimi", path: "/management/shelves", icon: <Key size={18} />,
    subItems: [
      { id: "shelves_map", name: "Fiziksel Raf Haritası", path: "/management/shelves/map" },
      { id: "shelves_transfer", name: "Raf Arası Transfer", path: "/management/shelves/transfer" },
    ]
  },
  {
    id: "hr", name: "Mesai & İnsan Kaynakları", path: "/management/hr", icon: <Users size={18} />,
    subItems: [
      { id: "hr_personnel", name: "Personel & Özlük Dosyaları", path: "/management/hr/personnel" },
      { id: "hr_leaves", name: "İzin Talepleri Onayı", path: "/management/hr/leaves" },
      { id: "hr_logs", name: "Giriş/Çıkış Log Düzeltme", path: "/management/hr/logs" },
    ]
  },
  { id: "b2b", name: "Sarf Malzeme Siparişi", path: "/management/b2b", icon: <Send size={18} /> },
  {
    id: "print", name: "Raporlar & Çıktı Merkezi", path: "/management/print", icon: <Settings size={18} />,
    subItems: [
      { id: "print_labels", name: "Zebra Termal Etiket Basımı", path: "/management/print/labels" },
      { id: "print_documents", name: "Sevk Tutanakları & İrsaliye", path: "/management/print/documents" },
      { id: "print_reports", name: "Kritik Stok & Performans Raporları", path: "/management/print/reports" },
    ]
  },
  { id: "terminal", name: "Terminal Ekranı (El Cihazı)", path: "/terminal", icon: <Fingerprint size={18} /> },
];

export default function RoleSettingsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // === YETKİ MATRİSİ STATE'LERİ ===
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleName, setNewRoleName] = useState("");

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    setIsLoading(true);
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
      toast.error("Yetki verileri çekilirken hata: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- DİNAMİK YETKİ YÖNETİM FONKSİYONLARI ---
  const handleTogglePermission = (moduleId: string, parentId?: string) => {
    if (!selectedRoleId) return;
    setRoles(roles.map((role) => {
      if (role.id === selectedRoleId) {
        if (role.role_code === "Developer" || role.role_code === "Admin") {
          toast.error("Master yetkiler sınırlandırılamaz.");
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
        if (role.role_code === "Developer" || role.role_code === "Admin") return role;
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
      toast.success("Yeni departman/yetki sınıfı oluşturuldu.");
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

  // UI Hesaplamaları
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const filteredRoles = roles.filter((r) => r.role_name.toLowerCase().includes(roleSearch.toLowerCase()) || r.role_code.toLowerCase().includes(roleSearch.toLowerCase()));
  const isMasterRole = selectedRole?.role_code === "Developer" || selectedRole?.role_code === "Admin";
  const totalSystemPermissions = SYSTEM_MODULES.length + SYSTEM_MODULES.reduce((acc, curr) => acc + (curr.subItems?.length || 0), 0);
  const currentRolePermissionsCount = isMasterRole ? totalSystemPermissions : (selectedRole?.permissions?.length || 0);
  const permissionPercentage = Math.round((currentRolePermissionsCount / totalSystemPermissions) * 100) || 0;

  // KPI Hesaplamaları
  const totalRoles = roles.length;
  const masterRolesCount = roles.filter(r => r.is_system).length;

  if (isLoading)
    return (
      <div className="p-8 text-slate-500 font-medium animate-pulse font-['Quicksand'] flex flex-col items-center justify-center min-h-[50vh]">
        <Activity size={40} className="text-[#dc3545] mb-4 animate-bounce" /> LogiStock Yetki Matrisi Sorgulanıyor...
      </div>
    );

  return (
    <div className="flex flex-col gap-6 pb-20 font-['Quicksand'] max-w-[1600px] mx-auto">
      
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
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Erişim & Yetki Komuta Merkezi</h1>
            </div>
            <p className="text-slate-400 text-sm font-medium tracking-wide max-w-2xl">
              Depo, mağaza ve merkez ekipleri için rolleri yapılandırın, dinamik yetki matrisini güncelleyin.
            </p>
          </div>

          <Button onClick={handleSavePermissions} disabled={isSaving} className="bg-[#dc3545] hover:bg-red-700 text-white font-black h-12 px-8 rounded-sm shadow-[0_4px_20px_rgba(220,53,69,0.4)] gap-2 shrink-0 border border-red-500/50 transition-all text-sm uppercase tracking-wider">
            {isSaving ? <span className="animate-spin text-xl">⟳</span> : <Save size={18} strokeWidth={2.5} />}
            {isSaving ? "Veritabanına İşleniyor..." : "Yetki Matrisini Kaydet"}
          </Button>
        </div>
      </div>

      {/* 2. KPI KARTLARI (SAYFAYI ZENGİNLEŞTİREN BÖLÜM) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sistemdeki Tanımlı Rol</span>
            <span className="text-2xl font-black text-slate-800">{totalRoles} <span className="text-sm font-bold text-slate-400">Grup</span></span>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
            <Users size={24} />
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master (Korumalı) Rol</span>
            <span className="text-2xl font-black text-[#dc3545]">{masterRolesCount} <span className="text-sm font-bold text-slate-400">Adet</span></span>
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

      {/* 3. DEPARTMAN VE YETKİ MATRİSİ (MASTER-DETAIL) */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* SOL PANEL: Rol Listesi & Rol Ekleme */}
          <div className="xl:col-span-3 flex flex-col gap-4 sticky top-[200px]">
            
            <div className="bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col overflow-hidden max-h-[600px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Departman Ara..." value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} className="w-full pl-9 pr-3 h-10 bg-white border border-slate-300 rounded-sm text-xs font-bold text-slate-800 focus:border-[#dc3545] outline-none transition-colors" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                {filteredRoles.map((role) => {
                  const isSelected = selectedRoleId === role.id;
                  return (
                    <button
                      key={role.id} onClick={() => setSelectedRoleId(role.id)}
                      className={`text-left p-3 rounded-sm border transition-all flex items-center justify-between ${isSelected ? "bg-red-50 border-[#dc3545] shadow-sm" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-sm font-black flex items-center gap-1.5 ${isSelected ? "text-[#dc3545]" : "text-slate-800"}`}>
                          {role.role_name}
                          {role.is_system && <ShieldCheck size={12} className={isSelected ? "text-[#dc3545]" : "text-emerald-500"} />}
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
              <Button onClick={handleAddRole} className="w-full h-10 mt-1 bg-[#dc3545] hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest rounded-sm shadow-md border border-red-500/50">Sınıfı Ekle</Button>
            </div>

          </div>

          {/* SAĞ PANEL: Modül Matrisi */}
          <div className="xl:col-span-9 bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col min-h-[600px]">
            {selectedRole ? (
              <>
                <div className="bg-slate-50 border-b border-slate-200 p-5 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      {selectedRole.role_name}
                      {selectedRole.is_system && <span className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded uppercase tracking-widest">Master Korumalı</span>}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white border border-slate-200 px-2 py-0.5 rounded-sm">KOD: {selectedRole.role_code}</span>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-sm">
                        {currentRolePermissionsCount} Modül Aktif
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleCloneRole} className="flex items-center gap-1.5 h-9 px-3 text-xs font-black uppercase text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-sm transition-colors shadow-sm">
                      <Copy size={14} /> Rolü Kopyala
                    </button>
                    {!selectedRole.is_system && (
                      <button onClick={() => handleDeleteRole(selectedRole.id)} className="flex items-center gap-1.5 h-9 px-3 text-xs font-black uppercase text-slate-500 bg-white border border-slate-300 hover:text-white hover:bg-[#dc3545] hover:border-[#dc3545] rounded-sm transition-colors shadow-sm">
                        <Trash2 size={14} /> Sil
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 lg:px-8 py-4 border-b border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-4 bg-white">
                  
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
                    <div className="relative flex-1 lg:w-64">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Modüllerde Ara..." value={moduleSearch} onChange={(e) => setModuleSearch(e.target.value)} className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-sm text-xs font-bold text-slate-800 focus:border-[#dc3545] outline-none" />
                    </div>
                    {!isMasterRole && (
                      <div className="flex bg-slate-100 border border-slate-200 rounded-sm p-0.5 shrink-0">
                        <button onClick={() => handleBulkPermission("selectAll")} title="Tümünü Seç" className="p-1.5 text-slate-500 hover:text-[#dc3545] hover:bg-white rounded transition-colors"><CheckSquare size={16} /></button>
                        <button onClick={() => handleBulkPermission("deselectAll")} title="Tümünü Kaldır" className="p-1.5 text-slate-500 hover:text-[#dc3545] hover:bg-white rounded transition-colors"><XSquare size={16} /></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 lg:p-8 bg-slate-50/50 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {SYSTEM_MODULES.filter(m => m.name.toLowerCase().includes(moduleSearch.toLowerCase()) || m.subItems?.some(s => s.name.toLowerCase().includes(moduleSearch.toLowerCase()))).map((module) => {
                      const hasMainAccess = isMasterRole || selectedRole.permissions.includes(module.id);

                      return (
                        <div key={module.id} className={`flex flex-col border-2 rounded-sm bg-white overflow-hidden transition-all duration-200 shadow-sm ${isMasterRole ? "opacity-70 border-[#dc3545]/40" : hasMainAccess ? "border-[#dc3545]" : "border-slate-200 hover:border-slate-300"}`}>
                          
                          <div onClick={() => !isMasterRole && handleTogglePermission(module.id)} className={`p-4 flex items-center justify-between cursor-pointer border-b ${hasMainAccess ? "bg-red-50/40 border-red-100" : "bg-white border-transparent"}`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-sm ${hasMainAccess ? "bg-[#dc3545] text-white shadow-sm" : "bg-slate-100 text-slate-400"}`}>
                                {module.icon}
                              </div>
                              <div className="flex flex-col">
                                <h4 className={`text-sm font-black ${hasMainAccess ? "text-slate-800" : "text-slate-500"}`}>{module.name}</h4>
                                <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5 max-w-[200px] truncate">{module.path}</p>
                              </div>
                            </div>
                            <div className={`w-5 h-5 shrink-0 rounded-sm flex items-center justify-center transition-colors border ${hasMainAccess ? "bg-[#dc3545] border-[#dc3545]" : "bg-white border-slate-300"}`}>
                              {hasMainAccess && <CheckCircle2 size={12} strokeWidth={4} className="text-white" />}
                            </div>
                          </div>

                          {module.subItems && (
                            <div className="flex flex-col divide-y divide-slate-100 bg-slate-50/50">
                              {module.subItems.map((sub) => {
                                const hasSubAccess = isMasterRole || selectedRole.permissions.includes(sub.id);
                                const isDisabled = isMasterRole || !hasMainAccess;
                                const matchesSearch = moduleSearch === "" || sub.name.toLowerCase().includes(moduleSearch.toLowerCase());

                                if (!matchesSearch && moduleSearch !== "") return null;

                                return (
                                  <div key={sub.id} onClick={() => !isDisabled && handleTogglePermission(sub.id, module.id)} className={`flex items-center justify-between px-4 py-3 transition-colors ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-100"}`}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${hasSubAccess ? "bg-slate-800" : "bg-slate-300"}`}></div>
                                      <span className={`text-xs font-bold ${hasSubAccess ? "text-slate-800" : "text-slate-500"}`}>{sub.name}</span>
                                    </div>
                                    <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center transition-colors border ${hasSubAccess ? "bg-slate-800 border-slate-800" : "bg-white border-slate-300"}`}>
                                      {hasSubAccess && <CheckCircle2 size={10} strokeWidth={4} className="text-white" />}
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
                <p className="text-sm font-bold uppercase tracking-wider">Lütfen düzenlemek için sol taraftan bir departman seçin.</p>
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}