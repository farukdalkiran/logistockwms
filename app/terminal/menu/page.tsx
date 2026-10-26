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
  ChevronRight,
  ScanLine,
  CircleCheck,
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
          link: "/terminal/inventory/putaway",
        },
        {
          label: "Ürün Raftan Kaldır",
          icon: ArchiveRestore,
          link: "/terminal/inventory/removal",
        },
      ],
    },
    // {
    //   title: "Sipariş & Rota Toplama",
    //   borderColor: "border-emerald-500",
    //   textColor: "text-emerald-600",
    //   items: [
    //     {
    //       label: "Rota Bazlı Toplama",
    //       icon: Route,
    //       link: "/terminal/picking/route",
    //       badge: "PICK",
    //       badgeBg: "bg-emerald-600",
    //     },
    //     {
    //       label: "Sipariş Kontrol & Paketleme",
    //       icon: ListChecks,
    //       link: "/terminal/picking/order",
    //       badge: "PACK",
    //       badgeBg: "bg-emerald-600",
    //     },
    //   ],
    // },
  ];

  return (
    <div className="min-h-screen bg-[#f1f4f8] font-['Quicksand'] select-none flex flex-col overflow-x-hidden">
      {/* Orijinal mobil container genişliği ve terminal oturumu korunur */}
      <header className="shrink-0 bg-white border-b border-slate-200">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Logo variant="primary" className="text-3xl" />
            <span className="border-l border-slate-300 pl-2 text-[13px] font-black tracking-[0.08em] text-slate-800">WMS</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Terminal oturumunu kapat"
            title="Güvenli Çıkış"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#dc3545] hover:text-[#dc3545] active:scale-95"
          >
            <LogOut size={17} strokeWidth={2.4}/>
          </button>
        </div>
      </header>

      <section className="relative shrink-0 overflow-hidden bg-[#152238] text-white">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#dc3545]"/>
        <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full border-[30px] border-white/[0.035]"/>
        <div className="pointer-events-none absolute -left-16 -bottom-24 h-48 w-48 rounded-full bg-[#dc3545]/[0.07] blur-2xl"/>
        <div className="relative mx-auto w-full max-w-lg px-4 pb-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/10 px-2.5 py-1.5">
              <TerminalSquare size={14} className="text-red-300"/>
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">OPERASYON TERMİNALİ</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.55)]"/>
              Oturum aktif
            </div>
          </div>
          <h1 className="mt-3 text-[23px] font-black leading-tight tracking-tight">İşlem Merkezi</h1>
          <p className="mt-1 text-[11px] font-medium text-slate-300">
            Barkod, transfer, kargo ve raf operasyonlarını yönetin.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col justify-between gap-2 rounded-md border border-white/10 bg-white/[0.07] p-3">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-300">
                <ShieldCheck size={12} className="text-emerald-400"/> AKTİF PERSONEL
              </span>
              <strong className="block truncate text-[13px] font-black uppercase leading-snug text-white" title={session.empName}>
                {session.empName}
              </strong>
              <span className="self-start rounded bg-slate-950/40 px-2 py-1 font-mono text-[10px] font-bold text-slate-300">#{session.empId || "—"}</span>
            </div>
            <div className="flex min-w-0 flex-col justify-between gap-2 rounded-md border border-white/10 bg-white/[0.07] p-3">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-300">
                <MapPin size={12} className="text-red-300"/> ÇALIŞMA NOKTASI
              </span>
              <strong className="block truncate text-[11px] font-extrabold leading-snug text-white" title={session.branchName}>
                {session.branchName}
              </strong>
              <span className="font-mono text-[17px] font-black tabular-nums tracking-tight text-emerald-300">
                {session.time || "--:--:--"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 pb-8 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-black text-[#142238]">İşlem Modülleri</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
              Çalışmak istediğiniz operasyonu seçin
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-600">
            <ScanLine size={13} className="text-[#dc3545]"/> {modules.reduce((count, mod) => count + mod.items.length, 0)} İŞLEM
          </span>
        </div>

        {modules.map((mod, idx) => (
          <section key={mod.title} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_3px_14px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#f8fafc] px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={"h-7 w-1 shrink-0 rounded-full border-l-[4px] " + mod.borderColor}/>
                <div>
                  <h3 className="text-[12px] font-black uppercase tracking-[0.04em] text-[#142238]">{mod.title}</h3>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {mod.items.length} kullanılabilir işlem
                  </span>
                </div>
              </div>
              <span className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] font-black text-slate-400">
                0{idx + 1}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {mod.items.map((item) => (
                <button
                  key={item.link}
                  type="button"
                  onClick={() => handleNavigate(item.link)}
                  aria-label={item.label}
                  className="group flex min-h-[64px] w-full touch-manipulation items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#dc3545]"
                >
                  <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 " + mod.textColor}>
                    <item.icon size={19} strokeWidth={2.1}/>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-black leading-snug text-slate-800 group-hover:text-slate-950">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                      İşlemi başlat
                    </span>
                  </span>
                  {item.badge && (
                    <span className="shrink-0 rounded bg-[#dc3545] px-2 py-1 text-[9px] font-black tracking-wide text-white">{item.badge}</span>
                  )}
                  <ChevronRight size={17} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#dc3545]"/>
                </button>
              ))}
            </div>
          </section>
        ))}
        <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-3 text-slate-500">
          <CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-600"/>
          <p className="text-[10px] font-semibold leading-relaxed">
            Terminal oturumunuz aktif. İşlemler personel ve şube bilgilerinize bağlı olarak yürütülür.
          </p>
        </div>
      </main>

      <footer className="mt-auto shrink-0 border-t-[3px] border-[#dc3545] bg-[#142238] text-white">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-4">
          <div>
            <span className="block text-[11px] font-black uppercase tracking-widest">LogiStock WMS</span>
            <span className="mt-1 block text-[9px] font-semibold text-slate-400">Terminal 2.4.1 · Güvenli Operasyon</span>
          </div>
          <div className="opacity-50">
            <Logo variant="white" className="text-2xl"/>
          </div>
        </div>
      </footer>
    </div>
  );
}
