"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { supabase } from "@/lib/supabase";
import {
  Package,
  FileText,
  List,
  ArrowDownToLine,
  FileSpreadsheet,
  ArrowUpFromLine,
  ArchiveRestore,
  LogOut,
  MapPin,
  TerminalSquare,
  ListChecks,
  Route,
  ShieldCheck,
} from "lucide-react";

export default function TerminalMenuPage() {
  const router = useRouter();
  const [session, setSession] = useState({
    empId: "",
    empName: "Yükleniyor...",
    branchName: "Şube Sorgulanıyor...",
    time: "",
  });

  useEffect(() => {
    const empId = localStorage.getItem("terminal_employee_id");
    const empName = localStorage.getItem("terminal_employee_name");

    if (!empId) {
      router.push("/terminal/login");
      return;
    }

    const fetchBranchInfo = async () => {
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("branch_id, branches(name)")
          .eq("id", empId)
          .single();

        if (error) throw error;

        const branchName = (data?.branches as any)?.name || "Bilinmeyen Şube";
        setSession((prev) => ({ ...prev, branchName }));
      } catch (err) {
        console.error("Şube bilgisi çekilemedi:", err);
        setSession((prev) => ({ ...prev, branchName: "Bağlantı Hatası" }));
      }
    };

    fetchBranchInfo();

    const updateClock = () => {
      setSession((prev) => ({
        ...prev,
        empId,
        empName: empName || "Personel",
        time: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      }));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("terminal_employee_id");
    localStorage.removeItem("terminal_employee_name");
    router.push("/");
  };

  const handleNavigate = (path: string) => {
    const url = new URL(path, window.location.origin);
    url.searchParams.append("empId", session.empId);
    url.searchParams.append("empName", session.empName);
    url.searchParams.append("branch", session.branchName);

    router.push(url.pathname + url.search);
  };

  // Modernize Edilmiş, "Pastel" renklerden arındırılmış Endüstriyel Menü Tanımları
  const modules = [
    {
      title: "Mal Kabul & Transfer",
      borderColor: "border-blue-600",
      textColor: "text-blue-600",
      items: [
        {
          label: "Sayım Kodu Oluştur",
          icon: FileSpreadsheet,
          link: "/terminal/transfer/create",
          badge: "EXCEL",
          badgeBg: "bg-[#dc3545]",
        },
                {
          label: "Sayım Listesi",
          icon: List,
          link: "/terminal/transfer/codes",
        },
        {
          label: "LGS-MNS Transfer Sayımı",
          icon: ArrowDownToLine,
          link: "/terminal/transfer/scan",
        },
        {
          label: "Serbest Transfer Sayımı",
          icon: ArrowUpFromLine,
          link: "/terminal/transfer/manual-scan",
        },
      ],
    },
    {
      title: "Kargo İşlemleri",
      borderColor: "border-orange-500",
      textColor: "text-orange-600",
      items: [
        {
          label: "Kargo Teslim Sayımı",
          icon: Package,
          link: "/terminal/cargo/inbound",
        },
        {
          label: "Kargo Sayım Raporu",
          icon: FileText,
          link: "/terminal/cargo/reports",
        },
      ],
    },
    {
      title: "Raf İşlemleri",
      borderColor: "border-purple-600",
      textColor: "text-purple-600",
      items: [
        {
          label: "Ürün Raflama",
          icon: ArchiveRestore,
          link: "/terminal/inventory/shelving",
        },
        {
          label: "Ürün Raftan Kaldır",
          icon: ArchiveRestore,
          link: "/terminal/inventory/removal",
        },
      ],
    },
    {
      title: "Sipariş & Rota Toplama",
      borderColor: "border-emerald-500",
      textColor: "text-emerald-600",
      items: [
        {
          label: "Rota Bazlı Toplama",
          icon: Route,
          link: "/terminal/picking/route",
          badge: "PICK",
          badgeBg: "bg-emerald-600",
        },
        {
          label: "Sipariş Kontrol & Paketleme",
          icon: ListChecks,
          link: "/terminal/picking/order",
          badge: "PACK",
          badgeBg: "bg-emerald-600",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 font-['Quicksand'] select-none flex flex-col">
      {/* 1. ÜST BİLGİ VE ORİJİNAL LOGO */}
      <div className="bg-white border-b border-slate-300 pt-8 pb-4 px-5 shrink-0">
        <div className="flex justify-between items-center mb-2">
          <div className="flex justify-center gap-2">
            <Logo variant="primary" className="text-4xl" />
            <span className="text-[#0f172b] font-black text-[15px] tracking-tight uppercase opacity-90 self-end mb-[2px]">
              WMS
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2.5 bg-white border border-slate-300 text-slate-500 rounded-sm hover:border-[#dc3545] hover:text-[#dc3545] hover:bg-red-50 transition-all active:scale-95 shadow-sm"
            title="Güvenli Çıkış (Yönetim Paneline Dön)"
          >
            <LogOut size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 2. DARK HEADING (ENDÜSTRİYEL KONTROL PANeli) */}
      <div className="bg-[#0f172b] shadow-md flex flex-col relative shrink-0">
        {/* Üst Kırmızı Operasyon Şeridi */}
        <div className="bg-[#dc3545] py-2 px-4 flex items-center justify-center border-b border-[#a12330]">
          <div className="flex items-center gap-2">
            <TerminalSquare size={14} className="text-white" />
            <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">
              Operasyon Terminali
            </span>
          </div>
        </div>

        {/* Bilgi Panelleri */}
        <div className="p-4 grid grid-cols-2 gap-3 relative z-10 max-w-lg mx-auto w-full">
          {/* Sol Panel: Operatör */}
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-3 flex flex-col justify-between shadow-inner">
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <ShieldCheck size={10} className="text-emerald-500" /> Aktif
              Operatör
            </span>
            <span className="text-white font-black text-[13px] uppercase tracking-wide truncate mt-1">
              {session.empName}
            </span>
            <div className="mt-2 inline-flex">
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-black px-2 py-0.5 rounded-sm tracking-widest">
                ID: {session.empId}
              </span>
            </div>
          </div>

          {/* Sağ Panel: Konum ve Saat */}
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-3 flex flex-col justify-between text-right shadow-inner">
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1 flex justify-end items-center gap-1">
              <MapPin size={10} className="text-[#dc3545]" /> Konum Modülü
            </span>
            <span className="text-white font-bold text-[11px] uppercase tracking-wide truncate mt-1">
              {session.branchName}
            </span>
            <div className="mt-1.5">
              <span className="text-white font-mono text-xl font-black tracking-tight">
                {session.time}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KESKİN TASARIMLI MENÜ LİSTESİ */}
      <div className="px-4 pt-5 pb-15 mt-2 max-w-lg mx-auto w-full flex-1 flex flex-col gap-6">
        {modules.map((mod, idx) => (
          <section key={idx} className="flex flex-col gap-2.5">
            <h3
              className={`text-[11px] font-black text-slate-800 uppercase tracking-widest border-l-4 ${mod.borderColor} pl-2 ml-1`}
            >
              {mod.title}
            </h3>

            <div className="flex flex-col gap-2">
              {mod.items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleNavigate(item.link)}
                  className={`w-full flex items-center p-3 bg-white border border-slate-200 border-l-4 ${mod.borderColor} rounded-sm shadow-sm hover:bg-slate-50 transition-all active:scale-[0.98] group relative`}
                >
                  <div
                    className={`w-10 h-10 flex items-center justify-center shrink-0 bg-slate-50 border border-slate-100 rounded-sm mr-4 group-hover:scale-110 transition-transform`}
                  >
                    <item.icon
                      size={20}
                      className={mod.textColor}
                      strokeWidth={2.5}
                    />
                  </div>

                  <div className="flex flex-col items-start flex-1">
                    <span className="font-black text-[13px] text-slate-800 uppercase tracking-wide">
                      {item.label}
                    </span>
                  </div>

                  {item.badge && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <span
                        className={`${item.badgeBg} text-white text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-widest shadow-sm`}
                      >
                        {item.badge}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* 4. ENDÜSTRİYEL FOOTER */}
      <div className="bg-[#0f172b] border-t-4 border-[#dc3545] mt-auto shrink-0 py-5 px-6 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col text-left">
          <span className="text-[11px] font-black text-white uppercase tracking-widest">
            LogiStock WMS
          </span>
          <span className="text-[9px] font-bold text-slate-400 mt-1 tracking-wider">
            Sürüm 2.4.1 • Güvenli Terminal
          </span>
        </div>
        <div className="opacity-30 grayscale pointer-events-none">
          <Logo variant="white" className="text-2xl" />
        </div>
      </div>
    </div>
  );
}
