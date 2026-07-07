"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Trash2, ShieldAlert, AlertTriangle, GripVertical, MapPin, Route, CheckCircle2, Info } from "lucide-react";
import toast from "react-hot-toast";

const statusConfig: Record<string, { color: string, label: string }> = {
  normal: { color: "bg-green-100 text-green-700 border-green-200", label: "Normal" },
  bloke: { color: "bg-orange-100 text-orange-700 border-orange-200", label: "Bloke" },
  hasarli: { color: "bg-red-100 text-red-700 border-red-200", label: "Hasarlı" },
  sarf: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Sarf" }
};

export default function ShelvesDragList({ branchId, onModified }: { branchId: string, onModified: () => void }) {
  const [shelves, setShelves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Drag & Drop Referansları
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // SUPABASE LOCK HATASI ÇÖZÜMÜ: getSession ve isMounted kullanıldı
  useEffect(() => {
    let isMounted = true;

    const fetchUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && isMounted) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
            
          if (profile && isMounted) {
            setUserRole(profile.role);
          }
        }
      } catch (error) {
        console.error("Rol bilgisi çekilirken hata oluştu:", error);
      }
    };

    fetchUserRole();

    return () => {
      isMounted = false; // Bileşen unmount olduğunda fetch işlemini durdur
    };
  }, []);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    fetchShelves();
  }, [branchId]);

  const fetchShelves = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shelves")
      .select("*")
      .eq("branch_id", branchId)
      .order("sort_order", { ascending: true });
    
    if (error) {
      toast.error("Raflar yüklenirken bir hata oluştu.");
    } else if (data) {
      setShelves(data);
    }
    
    setLoading(false);
    setHasUnsavedChanges(false);
  };

  const handleSort = () => {
    if (userRole !== 'Developer' && userRole !== 'Admin') {
      toast.error("Sıralamayı değiştirmek için yetkiniz yok.");
      return;
    }

    if (dragItem.current !== null && dragOverItem.current !== null) {
      let _shelves = [...shelves];
      const draggedItemContent = _shelves.splice(dragItem.current, 1)[0];
      _shelves.splice(dragOverItem.current, 0, draggedItemContent);
      
      dragItem.current = null;
      dragOverItem.current = null;
      
      setShelves(_shelves);
      setHasUnsavedChanges(true);
    }
  };

  const saveOrder = async () => {
    if (userRole !== 'Developer' && userRole !== 'Admin') {
      toast.error("Yetkiniz bulunmamaktadır.");
      return;
    }

    const updates = shelves.map((shelf, index) => ({
      id: shelf.id,
      branch_id: shelf.branch_id,
      name: shelf.name,
      status: shelf.status,
      sort_order: index
    }));

    const { error } = await supabase.from("shelves").upsert(updates);
    
    if (error) {
      toast.error("Sıralama kaydedilemedi: " + error.message);
    } else {
      toast.success("Rota sırası başarıyla kaydedildi!");
      setHasUnsavedChanges(false);
      onModified(); // Üst bileşene haber ver (Opsiyonel ama best-practice)
    }
  };

  if (loading) return <div className="text-center p-8 text-slate-500 font-medium animate-pulse font-['Quicksand']">Rota haritası çiziliyor...</div>;
  if (!branchId) return <div className="text-center p-8 text-slate-500 font-medium font-['Quicksand']">Lütfen depo seçin.</div>;
  if (shelves.length === 0) return <div className="text-center p-8 text-slate-500 font-medium font-['Quicksand']">Bu depoda henüz tanımlı bir raf rotası yok.</div>;

  return (
    <div className="font-['Quicksand'] flex flex-col gap-6">
      
      {/* 1. ENDÜSTRİYEL ROTA PANELİ (Keskin Hatlar ve Detaylı Bilgi) */}
      <div className="relative w-full min-h-[200px] flex flex-col justify-center p-6 md:p-8 bg-slate-900 border border-slate-300 rounded-sm overflow-hidden mb-6">
        
        {/* Arka Plan Görseli ve Endüstriyel Karartma */}
        <img 
          src="https://img.magnific.com/free-psd/route-illustration-with-markers-flag_23-2151975774.jpg?t=st=1779107238~exp=1779110838~hmac=8a415402058e3e864593fdec282d097dd2bb92afc0d3ae072badfd2d3b67ea2b&w=1480"
          alt="Route Navigation"
          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
        
        {/* İçerik: Başlık ve Sistem Bilgi Kartı */}
        <div className="relative z-10 flex flex-col gap-6 w-full lg:max-w-3xl">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-[#dc3545] border border-red-400/50 rounded-sm shadow-[0_0_20px_rgba(220,53,69,0.3)]">
              <Route className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Akıllı Toplama Sıralaması</h2>
              <p className="text-[#dc3545] text-xs font-bold uppercase tracking-widest mt-1">Depo İçi Yürüyüş Rotasını Optimize Edin</p>
            </div>
          </div>

          {/* Endüstriyel Info Kartı */}
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 border-l-4 border-l-[#dc3545] p-4 md:p-5 rounded-sm flex gap-4 items-start shadow-inner">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1.5">
              <h4 className="text-slate-200 text-xs font-bold uppercase tracking-widest">Rota Bilgilendirmesi</h4>
              <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                Bu liste, personelin el terminalinde göreceği <strong className="text-slate-200">Smart Picking</strong> (Akıllı Toplama) rotasını belirler. Adresleri sürükleyip bırakarak fiziksel depo mimarisine en uygun dizilimi yapın. Personelin zikzak çizmesini engelleyerek toplama hızını maksimuma çıkarabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KAYDETME UYARISI */}
      {hasUnsavedChanges && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#dc3545]/10 p-4 rounded-xl border-2 border-[#dc3545]/30 animate-in fade-in slide-in-from-top-4">
          <span className="text-[#dc3545] text-sm font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5"/> 
            Rota sırası değiştirildi! Değişikliklerin el terminallerine yansıması için onaylamalısınız.
          </span>
          <button 
            onClick={saveOrder}
            className="bg-[#dc3545] text-white text-sm font-bold px-6 py-2.5 rounded-lg hover:bg-red-700 transition shadow-md w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Rotayı Onayla ve Kaydet
          </button>
        </div>
      )}

      {/* YATAY DİKDÖRTGEN TIMELINE LİSTESİ (BAĞLANTILI ROTA) */}
      <div className="relative ml-2 sm:ml-8 mt-4 pb-8">
        {/* Arkadaki Kesik Çizgili Rota Bağlantısı */}
        <div className="absolute left-[19px] top-6 bottom-4 w-0.5 bg-slate-200 border-l-2 border-dashed border-slate-300 z-0"></div>

        <div className="flex flex-col gap-4">
          {shelves.map((shelf, index) => (
            <div
              key={shelf.id}
              draggable={userRole === 'Developer' || userRole === 'Admin'}
              onDragStart={() => (dragItem.current = index)}
              onDragEnter={() => (dragOverItem.current = index)}
              onDragEnd={handleSort}
              onDragOver={(e) => e.preventDefault()}
              className="relative z-10 flex items-center pl-12 group"
            >
              {/* Rota Durak Noktası (Numara) */}
              <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center border-4 border-slate-50 shadow-sm z-20 font-black text-sm transition-colors ${
                userRole === 'Developer' || userRole === 'Admin' ? 'bg-[#dc3545] text-white group-hover:bg-red-700 group-hover:scale-110' : 'bg-slate-300 text-slate-600'
              }`}>
                {index + 1}
              </div>

              {/* Yatay Dikdörtgen Kart */}
              <div className={`w-full flex flex-col sm:flex-row items-center justify-between bg-white border-2 border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm transition-all duration-200 gap-4 ${
                userRole === 'Developer' || userRole === 'Admin' ? 'cursor-move hover:border-[#dc3545] hover:shadow-md hover:bg-slate-50/50' : 'cursor-not-allowed opacity-90'
              }`}>
                
                {/* Sol Kısım: İkon ve İsim */}
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="p-2 text-slate-300 group-hover:text-[#dc3545] transition-colors cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="hidden sm:flex p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:text-[#dc3545] transition-colors">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-extrabold text-slate-800 text-lg tracking-tight">{shelf.name}</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">LogiStock ID: {shelf.id}</p>
                  </div>
                </div>

                {/* Sağ Kısım: Statü ve İşlemler */}
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <span className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg border bg-white ${statusConfig[shelf.status]?.color || statusConfig['normal'].color}`}>
                    {statusConfig[shelf.status]?.label || "Bilinmiyor"}
                  </span>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}