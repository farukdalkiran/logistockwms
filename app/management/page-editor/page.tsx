"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import * as Icons from "lucide-react";
import {
  Layout,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  ShieldAlert,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  CheckSquare,
  Square
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
}

interface RoleDefinition {
  role_code: string;
  permissions: string[];
}

export default function PageEditor() {
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [formData, setFormData] = useState<SystemModule>({
    id: "",
    name: "",
    path: "",
    icon: "",
    parent_id: null,
    sort_order: 1,
    is_active: true,
  });

  // Modülleri ve Rolleri Çekme
  const fetchData = async () => {
    setIsLoading(true);
    
    // 1. Rolleri Çek
    const { data: rolesData } = await supabase.from("roles").select("role_code, permissions");
    if (rolesData) setRoles(rolesData as RoleDefinition[]);

    // 2. Modülleri Çek
    const { data: modsData, error } = await supabase
      .from("system_modules")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Modüller çekilirken hata:", error);
    } else if (modsData) {
      const parents = modsData.filter((m) => !m.parent_id).sort((a, b) => a.sort_order - b.sort_order);
      const sortedList: SystemModule[] = [];
      
      parents.forEach((parent) => {
        sortedList.push(parent);
        const children = modsData
          .filter((m) => m.parent_id === parent.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        sortedList.push(...children);
      });
      setModules(sortedList);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form İşlemleri
  const handleOpenDrawer = (module?: SystemModule) => {
    if (module) {
      setIsEditing(true);
      setFormData(module);
      // Bu modüle erişimi olan rolleri bul ve tickle
      const activeRoles = roles
        .filter(r => (r.permissions || []).includes(module.id))
        .map(r => r.role_code);
      setSelectedRoles(activeRoles);
    } else {
      setIsEditing(false);
      setFormData({
        id: "",
        name: "",
        path: "/management/",
        icon: "",
        parent_id: null,
        sort_order: modules.length > 0 ? modules.length + 1 : 1,
        is_active: true,
      });
      setSelectedRoles(["Developer"]); // Default olarak sadece developera açık gelsin
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setIsEditing(false), 300);
  };

  const toggleRoleSelection = (roleCode: string) => {
    if (roleCode === "Developer") return; // Developer kilitli kalsın, ondan yetki alınamaz.
    setSelectedRoles(prev => 
      prev.includes(roleCode) 
        ? prev.filter(r => r !== roleCode) 
        : [...prev, roleCode]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name || !formData.path) return alert("Lütfen zorunlu alanları doldurun.");
    
    setIsSubmitting(true);
    
    const payload = {
      id: formData.id,
      name: formData.name,
      path: formData.path,
      icon: formData.icon || null,
      parent_id: formData.parent_id || null,
      sort_order: Number(formData.sort_order),
      is_active: formData.is_active,
    };

    // 1. Modülü Kaydet veya Güncelle
    if (isEditing) {
      const { error } = await supabase.from("system_modules").update(payload).eq("id", formData.id);
      if (error) {
        alert("Güncelleme hatası (RLS veya Veritabanı): " + error.message);
        setIsSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase.from("system_modules").insert([payload]);
      if (error) {
        alert("Ekleme hatası (ID benzersiz olmalı veya RLS izni yok): " + error.message);
        setIsSubmitting(false);
        return;
      }
    }

    // 2. Rol Yetkilerini (Permissions Array) Güncelle
    for (const role of roles) {
      let currentPerms = role.permissions || [];
      const shouldHaveAccess = selectedRoles.includes(role.role_code);
      const hasAccess = currentPerms.includes(formData.id);

      if (shouldHaveAccess && !hasAccess) {
        currentPerms.push(formData.id); // Yetki Ekle
      } else if (!shouldHaveAccess && hasAccess) {
        currentPerms = currentPerms.filter(p => p !== formData.id); // Yetki Çıkar
      }

      // Eğer değişiklik olduysa Supabase'e yaz
      if (shouldHaveAccess !== hasAccess) {
        await supabase.from("roles").update({ permissions: currentPerms }).eq("role_code", role.role_code);
      }
    }

    await fetchData();
    setIsSubmitting(false);
    handleCloseDrawer();
  };

  const handleDelete = async (id: string, name: string) => {
    const isConfirmed = window.confirm(`DİKKAT: "${name}" modülünü silmek istediğinize emin misiniz?`);
    if (!isConfirmed) return;

    const { error } = await supabase.from("system_modules").delete().eq("id", id);
    if (error) alert("Silme işlemi başarısız: " + error.message);
    else fetchData();
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from("system_modules").update({ is_active: !currentStatus }).eq("id", id);
    if (!error) fetchData();
  };

  const parentOptions = modules.filter(m => !m.parent_id && m.id !== formData.id);

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 font-['Quicksand'] relative">
      
      {/* 1. DARK-INDUSTRIAL HEADER */}
      <div className="bg-[#0b1120] px-6 py-5 border-b border-slate-800 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-white tracking-widest uppercase flex items-center gap-2">
              <Layout className="text-[#dc3545]" size={20} />
              MODÜL & SAYFA YÖNETİMİ
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Sistem menülerini, sayfaları ve hiyerarşik yetki rotalarını buradan düzenleyin.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchData}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Yenile"
            >
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </button>
            <Button
              onClick={() => handleOpenDrawer()}
              className="h-9 px-4 text-xs font-black uppercase tracking-wider bg-[#dc3545] hover:bg-red-700 text-white rounded shadow-md transition-colors flex items-center gap-2"
            >
              <Plus size={16} strokeWidth={2.5} /> YENİ MODÜL
            </Button>
          </div>
        </div>
      </div>

      {/* 2. ANA İÇERİK: MODÜL TABLOSU */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-4 py-3 w-12 text-center">Durum</th>
                <th className="px-4 py-3">Modül Adı & İkon</th>
                <th className="px-4 py-3">Sistem ID (Yetki Kodu)</th>
                <th className="px-4 py-3 hidden md:table-cell">URL Yolu</th>
                <th className="px-4 py-3 text-center w-16">Sıra</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="text-xs font-bold text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">Veriler Yükleniyor...</td>
                </tr>
              ) : modules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">Henüz modül eklenmemiş.</td>
                </tr>
              ) : (
                modules.map((mod) => {
                  const isChild = mod.parent_id !== null;
                  return (
                    <tr 
                      key={mod.id} 
                      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${isChild ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleToggleActive(mod.id, mod.is_active)}
                          className={`transition-colors ${mod.is_active ? "text-emerald-500 hover:text-emerald-600" : "text-slate-300 hover:text-slate-400"}`}
                        >
                          {mod.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-2.5 ${isChild ? "pl-6 text-slate-600" : "text-slate-900"}`}>
                          {isChild && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
                          <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${isChild ? "bg-slate-100 text-slate-500" : "bg-[#0b1120] text-white"}`}>
                            <DynamicIcon name={mod.icon} size={14} />
                          </div>
                          <span className={isChild ? "font-bold" : "font-black"}>{mod.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-black tracking-wider">
                          {mod.id}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-500 font-semibold truncate max-w-[200px]">
                        {mod.path}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="w-6 h-6 inline-flex items-center justify-center bg-slate-100 rounded text-[10px] font-black text-slate-600">
                          {mod.sort_order}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenDrawer(mod)}
                            className="p-1.5 text-slate-400 hover:text-[#dc3545] hover:bg-red-50 rounded transition-colors"
                            title="Düzenle"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(mod.id, mod.name)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#dc3545] rounded transition-colors"
                            title="Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. YAN ÇEKMECE (DRAWER) - MODÜL & ROL EKLE/DÜZENLE */}
      <div 
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isDrawerOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        onClick={handleCloseDrawer}
      ></div>

      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] transform transition-transform duration-300 ease-out flex flex-col ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
              {isEditing ? "Modülü Düzenle" : "Yeni Modül Ekle"}
            </h2>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">Navigasyon ve Yetki Yapılandırması</p>
          </div>
          <button onClick={handleCloseDrawer} className="p-2 text-slate-400 hover:text-[#dc3545] hover:bg-red-50 rounded-lg transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="moduleForm" onSubmit={handleSave} className="space-y-5">
            
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                Modül ID (Yetki Kodu) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="Örn: hr_reports, cargo, inventory"
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                Modül / Kategori Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Örn: İnsan Kaynakları"
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                URL Yolu (Path) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="Örn: /management/hr"
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                  Lucide İkon <span className="text-slate-400 font-normal">(Ops)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.icon || ""}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="Örn: Users"
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 pl-9 transition-colors"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <DynamicIcon name={formData.icon} size={16} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                  Sıralama (Order) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1.5">
                Üst Klasör / Ana Modül <span className="text-slate-400 font-normal">(Opsiyonel)</span>
              </label>
              <select
                value={formData.parent_id || ""}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value === "" ? null : e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-400 transition-colors cursor-pointer"
              >
                <option value="">-- Ana Klasör (Kök Modül) --</option>
                {parentOptions.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name} ({parent.id})
                  </option>
                ))}
              </select>
            </div>

            {/* DİNAMİK ROL SEÇİM ALANI (YENİ EKLENDİ) */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-black text-slate-900 uppercase tracking-widest mb-2">
                Hangi Roller Erişebilsin? (Yetki Ataması)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => {
                  const isChecked = selectedRoles.includes(r.role_code);
                  const isDeveloper = r.role_code === "Developer";
                  
                  return (
                    <div 
                      key={r.role_code}
                      onClick={() => toggleRoleSelection(r.role_code)}
                      className={`flex items-center gap-2 p-2 rounded border transition-colors cursor-pointer ${
                        isChecked 
                          ? "bg-red-50 border-red-200 text-[#dc3545]" 
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      } ${isDeveloper ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      <span className="text-[11px] font-bold tracking-wide truncate">{r.role_code}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-500 font-semibold mt-2">
                * Seçtiğiniz rollerin <b>permissions</b> dizisine bu modülün yetkisi anında işlenir. Developer yetkisi kaldırılamaz.
              </p>
            </div>

          </form>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white shrink-0">
          <Button
            type="submit"
            form="moduleForm"
            disabled={isSubmitting}
            className="w-full justify-center h-10 text-xs font-black uppercase tracking-wider bg-[#dc3545] hover:bg-red-700 text-white rounded shadow-md transition-colors"
          >
            {isSubmitting ? "KAYDEDİLİYOR..." : (
              <span className="flex items-center gap-2">
                <Save size={16} /> {isEditing ? "DEĞİŞİKLİKLERİ KAYDET" : "YENİ MODÜLÜ OLUŞTUR"}
              </span>
            )}
          </Button>
        </div>

      </div>

    </div>
  );
}