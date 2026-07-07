"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Info, Plus, LayoutGrid, Package, ShieldAlert, AlertTriangle, Edit2, Trash2, Building2, Check, X, PackagePlus, Archive } from "lucide-react";
import toast from "react-hot-toast";

const statusConfig: Record<string, { color: string, label: string }> = {
  normal: { color: "bg-green-50 text-green-800 border-green-300", label: "NORMAL" },
  bloke: { color: "bg-orange-50 text-orange-800 border-orange-300", label: "BLOKE" },
  hasarli: { color: "bg-red-50 text-red-800 border-red-300", label: "HASARLI" },
  sarf: { color: "bg-blue-50 text-blue-800 border-blue-300", label: "SARF" }
};

export default function ShelvesDashboard({ selectedBranchId, setSelectedBranchId, onShelfAdded, refreshTrigger }: any) {
  const [branches, setBranches] = useState<any[]>([]);
  const [shelvesList, setShelvesList] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, normal: 0, bloke: 0, hasarli: 0, sarf: 0 });
  const [newShelf, setNewShelf] = useState({ name: "", status: "normal" });
  const [userRole, setUserRole] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: null });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null; name: string }>({ isOpen: false, id: null, name: "" });

  useEffect(() => {
    const initializeData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profile) setUserRole(profile.role);
      }

      const { data: branchesData } = await supabase.from("branches").select("id, name").order("name");
      if (branchesData && branchesData.length > 0) {
        setBranches(branchesData);
        if (!selectedBranchId) setSelectedBranchId(branchesData[0].id);
      }
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchTableData();
    }
  }, [selectedBranchId, refreshTrigger]);

  const fetchTableData = async () => {
    const { data } = await supabase
      .from("shelves")
      .select("*")
      .eq("branch_id", selectedBranchId)
      .order("created_at", { ascending: false });

    if (data) {
      setShelvesList(data);
      setStats({
        total: data.length,
        normal: data.filter(s => s.status === 'normal').length,
        bloke: data.filter(s => s.status === 'bloke').length,
        hasarli: data.filter(s => s.status === 'hasarli').length,
        sarf: data.filter(s => s.status === 'sarf').length,
      });
    }
  };

  const checkAuth = () => {
    if (userRole !== 'Developer' && userRole !== 'Admin') {
      toast.error("Yetki reddedildi: Bu işlem için erişim izniniz yok.");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!checkAuth()) return;
    if (!newShelf.name || !selectedBranchId) {
      toast.error("Geçersiz İşlem: Raf adı gereklidir.");
      return;
    }
    
    const { error } = await supabase.from("shelves").insert({
      name: newShelf.name.toUpperCase(),
      status: newShelf.status,
      branch_id: selectedBranchId,
    });

    if (error) {
      toast.error(error.code === '23505' ? "Sistem Hatası: Mükerrer raf kaydı." : error.message);
    } else {
      toast.success("Sistem: Raf başarıyla kaydedildi.");
      setNewShelf({ ...newShelf, name: "" });
      onShelfAdded();
    }
  };

  const handleUpdate = async () => {
    if (!checkAuth() || !editModal.data) return;

    const { error } = await supabase
      .from("shelves")
      .update({
        name: editModal.data.name.toUpperCase(),
        status: editModal.data.status,
        branch_id: editModal.data.branch_id
      })
      .eq("id", editModal.data.id);

    if (error) {
      toast.error("Sistem Hatası: " + error.message);
    } else {
      toast.success("Sistem: Raf konfigürasyonu güncellendi.");
      setEditModal({ isOpen: false, data: null });
      onShelfAdded();
    }
  };

  const confirmDelete = async () => {
    if (!checkAuth() || !deleteModal.id) return;
    
    const { error } = await supabase.from("shelves").delete().eq("id", deleteModal.id);
    if (error) {
      toast.error("Sistem Hatası: " + error.message);
    } else {
      toast.success(`Sistem: ${deleteModal.name} referanslı raf silindi.`);
      setDeleteModal({ isOpen: false, id: null, name: "" });
      onShelfAdded();
    }
  };

  return (
    <div className="space-y-4 font-['Quicksand'] text-slate-800">
      
      {/* 1. ENDÜSTRİYEL MASTER PANEL (Keskin Hatlar, Kompakt Yapı) */}
      <div className="bg-white border border-slate-300 shadow-sm flex flex-col">
        
{/* A. Depo Seçimi, Görsel Banner ve Detaylı Bilgi Paneli */}
        <div className="relative w-full min-h-[220px] flex flex-col lg:flex-row justify-between p-6 md:p-8 bg-slate-900 border-b-2 border-slate-400 overflow-hidden gap-8 rounded-sm mb-6">
          
          {/* Arka Plan Görseli ve Endüstriyel Karartma */}
          <img 
            src="https://img.magnific.com/free-photo/spacious-warehouse-with-rows-shelves-forklift_84443-74085.jpg?t=st=1779108507~exp=1779112107~hmac=834c43fbd471b0766ff07fba31ef7c5cc6527409831e16ab7112e2dc4f5c9ac6&w=1480"
            alt="Warehouse Operations"
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
          
          {/* Sol Alan: Başlık ve Sistem Bilgi Kartı */}
          <div className="relative z-10 flex flex-col gap-6 w-full lg:max-w-2xl justify-center">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-[#dc3545] border border-red-400/50 rounded-sm shadow-[0_0_20px_rgba(220,53,69,0.3)]">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Raf Yönetimi</h1>
                <p className="text-[#dc3545] text-xs font-bold uppercase tracking-widest mt-1">Fiziksel Lokasyon & Hiyerarşi Yönetimi</p>
              </div>
            </div>

            {/* Endüstriyel Info Kartı */}
            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 border-l-4 border-l-[#dc3545] p-4 md:p-5 rounded-sm flex gap-4 items-start shadow-inner">
              <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1.5">
                <h4 className="text-slate-200 text-xs font-bold uppercase tracking-widest">Sistem Bilgilendirmesi</h4>
                <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                  Bu panel, tesisin fiziksel haritasını (koridor, ünite, raf) dijitalleştirir. Buradaki kayıtlar ve sıralamalar, el terminalindeki <strong className="text-slate-200">Smart Picking (Akıllı Toplama)</strong> rotasını doğrudan belirler. Yanlış adresleme operasyonel hız kaybına yol açar.
                </p>
              </div>
            </div>
          </div>

          {/* Sağ Alan: Vurgulu Tesis Seçim Paneli */}
          <div className="relative z-10 w-full lg:w-80 flex flex-col justify-center">
            <div className="bg-slate-800/90 backdrop-blur-md border border-slate-600 p-5 rounded-sm shadow-2xl">
              <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sistem Bağlantısı</label>
                <span className="flex items-center gap-2 text-[10px] font-black text-green-400 uppercase tracking-widest">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  Aktif
                </span>
              </div>
              
              <label className="text-[11px] font-bold text-white uppercase tracking-widest mb-2 block">İşlem Yapılan Tesis</label>
              <select 
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-500 text-white font-bold text-sm p-3.5 rounded-sm outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] cursor-pointer transition-all shadow-inner"
              >
                {branches.length === 0 ? (
                  <option value="">Tesis Bulunamadı</option>
                ) : (
                  branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                )}
              </select>
            </div>
          </div>
        </div>

        {/* B. Sıkıştırılmış İstatistik Şeridi */}
        <div className="bg-slate-50 border-b border-slate-300 p-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="p-2 bg-white border border-slate-300 rounded-sm">
              <Package className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Toplam Adres</p>
              <p className="text-xl font-bold text-slate-800 leading-none">{stats.total}</p>
            </div>
          </div>
          
          <div className="hidden lg:block w-px h-8 bg-slate-300"></div>
          
          <div className="flex flex-1 gap-2 overflow-x-auto text-xs font-bold">
            <div className="flex-1 min-w-[80px] bg-white border border-slate-200 p-2 rounded-sm flex flex-col items-center">
              <span className="text-slate-400 uppercase text-[9px] mb-0.5 flex items-center gap-1"><LayoutGrid className="w-3 h-3 text-green-600"/> Aktif</span>
              <span className="text-slate-700 text-sm">{stats.normal}</span>
            </div>
            <div className="flex-1 min-w-[80px] bg-white border border-slate-200 p-2 rounded-sm flex flex-col items-center">
              <span className="text-slate-400 uppercase text-[9px] mb-0.5 flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-orange-600"/> Bloke</span>
              <span className="text-slate-700 text-sm">{stats.bloke}</span>
            </div>
            <div className="flex-1 min-w-[80px] bg-white border border-slate-200 p-2 rounded-sm flex flex-col items-center">
              <span className="text-slate-400 uppercase text-[9px] mb-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-600"/> Hasarlı</span>
              <span className="text-slate-700 text-sm">{stats.hasarli}</span>
            </div>
            <div className="flex-1 min-w-[80px] bg-white border border-slate-200 p-2 rounded-sm flex flex-col items-center">
              <span className="text-slate-400 uppercase text-[9px] mb-0.5 flex items-center gap-1"><Archive className="w-3 h-3 text-blue-600"/> Sarf</span>
              <span className="text-slate-700 text-sm">{stats.sarf}</span>
            </div>
          </div>
        </div>

        {/* C. Data-Entry (Kayıt) Paneli */}
        <div className="p-4 bg-white flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <PackagePlus className="w-5 h-5 text-slate-500" />
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-tight">Yeni Lokasyon Tanımla</h3>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="w-full md:w-1/3 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Raf Kodu (Örn: A-01)</label>
              <input 
                type="text" 
                value={newShelf.name}
                onChange={(e) => setNewShelf({...newShelf, name: e.target.value})}
                className="w-full p-2 bg-white border border-slate-300 rounded-sm text-slate-800 text-sm font-semibold outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] transition-all uppercase placeholder:text-slate-400"
              />
            </div>
            
            <div className="w-full md:w-1/3 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Durum Kodu</label>
              <select 
                value={newShelf.status}
                onChange={(e) => setNewShelf({...newShelf, status: e.target.value})}
                className="w-full p-2 bg-white border border-slate-300 rounded-sm text-sm font-semibold outline-none focus:border-[#dc3545] focus:ring-1 focus:ring-[#dc3545] text-slate-700"
              >
                <option value="normal">Normal (Operasyona Açık)</option>
                <option value="bloke">Bloke (Operasyona Kapalı)</option>
                <option value="hasarli">Hasarlı (Bakım)</option>
                <option value="sarf">Sarf Malzeme Rezerve</option>
              </select>
            </div>
            
            <div className="w-full md:w-1/3">
              <button 
                onClick={handleCreate}
                className="w-full bg-[#dc3545] text-white p-2 rounded-sm text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-colors border border-transparent"
              >
                <Plus className="w-4 h-4" /> SİSTEME İŞLE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. VERİ TABLOSU (Sıkı Grid, Klasik WMS Görünümü) */}
      <div className="bg-white border border-slate-300 rounded-sm flex flex-col">
        <div className="bg-slate-100 p-3 border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-tight">Sistem Kayıtları: Adres Listesi</h3>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase border border-slate-300 bg-white px-2 py-0.5 rounded-sm">
            Total: {shelvesList.length}
          </span>
        </div>
        
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b-2 border-slate-300">
              <tr>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200 w-24">SYS_ID</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200">Adres Kodu</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200 w-32">Statü</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center w-24">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {shelvesList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 text-xs font-semibold">
                    Seçili tesiste adres kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                shelvesList.map((shelf) => (
                  <tr key={shelf.id} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50/50 transition-none">
                    <td className="p-3 border-r border-slate-200 font-mono text-slate-500 text-xs">#{shelf.id}</td>
                    <td className="p-3 border-r border-slate-200 font-bold text-slate-800">{shelf.name}</td>
                    <td className="p-3 border-r border-slate-200">
                      <span className={`px-2 py-1 text-[9px] font-bold rounded-sm border ${statusConfig[shelf.status]?.color || statusConfig['normal'].color}`}>
                        {statusConfig[shelf.status]?.label || "BİLİNMİYOR"}
                      </span>
                    </td>
                    <td className="p-2 flex items-center justify-center gap-1">
                      <button 
                        onClick={() => setEditModal({ isOpen: true, data: shelf })}
                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-100 rounded-sm transition-colors border border-transparent"
                        title="Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteModal({ isOpen: true, id: shelf.id, name: shelf.name })}
                        className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-100 rounded-sm transition-colors border border-transparent"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DÜZENLEME MODALI (Keskin Çizgili Form) */}
      {editModal.isOpen && editModal.data && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-300 shadow-xl w-full max-w-sm rounded-sm flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-300 bg-slate-100">
              <h3 className="font-bold text-slate-700 text-sm uppercase">Raf Konfigürasyonu</h3>
              <button onClick={() => setEditModal({ isOpen: false, data: null })} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Raf Kodu</label>
                <input 
                  type="text" 
                  value={editModal.data.name}
                  onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, name: e.target.value } })}
                  className="w-full p-2 border border-slate-300 rounded-sm text-sm font-bold outline-none focus:border-[#dc3545] uppercase"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Durum Kodu</label>
                <select 
                  value={editModal.data.status}
                  onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, status: e.target.value } })}
                  className="w-full p-2 border border-slate-300 rounded-sm text-sm font-semibold outline-none focus:border-[#dc3545]"
                >
                  <option value="normal">Normal</option>
                  <option value="bloke">Bloke</option>
                  <option value="hasarli">Hasarlı</option>
                  <option value="sarf">Sarf</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tesis Bağlantısı</label>
                <select 
                  value={editModal.data.branch_id}
                  onChange={(e) => setEditModal({ ...editModal, data: { ...editModal.data, branch_id: e.target.value } })}
                  className="w-full p-2 border border-slate-300 rounded-sm text-sm font-semibold outline-none focus:border-[#dc3545]"
                >
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              
              <button 
                onClick={handleUpdate}
                className="mt-2 w-full p-2.5 bg-slate-800 text-white text-sm font-bold rounded-sm hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> GÜNCELLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SİLME ONAY MODALI (Sistem Uyarı Görünümü) */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-300 shadow-xl w-full max-w-sm rounded-sm">
            <div className="bg-red-50 p-4 border-b border-red-200 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-[#dc3545]" />
              <div>
                <h2 className="text-sm font-bold text-red-800 uppercase">Kritik İşlem Uyarısı</h2>
                <p className="text-[11px] font-semibold text-red-600">Referans: {deleteModal.name}</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-600 font-semibold mb-4 leading-relaxed">
                Bu rafı silmek üzeresiniz. İşlem geri alınamaz ve bu lokasyona bağlı tüm stok hareketleri silinir. Onaylıyor musunuz?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteModal({ isOpen: false, id: null, name: "" })} className="w-1/2 p-2 border border-slate-300 text-slate-600 text-sm font-bold rounded-sm hover:bg-slate-50 transition-colors">
                  İPTAL
                </button>
                <button onClick={confirmDelete} className="w-1/2 p-2 bg-[#dc3545] text-white text-sm font-bold rounded-sm hover:bg-red-700 transition-colors">
                  SİLİ ONAYLA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}