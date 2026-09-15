import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BarcodeScanner from "@/app/management/hr/_components/BarcodeScanner";
import AttendanceTable from "@/app/management/hr/_components/AttendanceTable";
import { AlertCircle, Clock, ShieldAlert, QrCode } from "lucide-react";

export const metadata = {
  title: "Mesai Yönetimi | LogiStock WMS",
};

export default async function HRManagementPage() {
  const supabase = await createClient();

  // 1. Oturum Kontrolü
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // 2. Kullanıcı Profili ve Şube Bilgisini Çek
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      role, 
      branch_id, 
      branches ( name )
    `,
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="p-8 text-center bg-red-50 text-[#dc3545] font-bold border-2 border-[#dc3545] rounded-sm m-6">
        PROFİL BİLGİNİZ BULUNAMADI. LÜTFEN SİSTEM YÖNETİCİSİYLE İLETİŞİME GEÇİN.
      </div>
    );
  }

  const branchId = profile.branch_id;
  
  // TS Hatasını Çözen Kısım: Supabase veri tipini dizi veya obje olarak güvenli okuma
  const branchData = profile.branches as unknown as { name: string } | { name: string }[];
  const branchName = Array.isArray(branchData)
    ? branchData[0]?.name
    : branchData?.name || "GLOBAL / MERKEZ";

  const isDeveloper = profile.role === "Developer";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* 1. ENDÜSTRİYEL DARK HEADING */}
      <div className="bg-[#0F172B] border-l-4 border-[#dc3545] p-5 rounded-sm shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
            İNSAN KAYNAKLARI & OPERASYON
          </span>
          <h1 className="text-xl font-black text-white tracking-widest uppercase">
            MESAİ YÖNETİM MERKEZİ
          </h1>
        </div>

        {/* Aktif Şube Göstergesi */}
        <div className="flex flex-col md:items-end bg-[#1E293B] px-4 py-2 rounded-sm border border-slate-700 shadow-inner">
          <span className="block text-[9px] text-slate-400 uppercase tracking-widest mb-1 font-bold">
            AKTİF TERMİNAL
          </span>
          <span className="inline-flex items-center gap-2 text-[#dc3545] font-black text-sm tracking-widest uppercase">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-sm bg-[#dc3545] opacity-75"></span>
              <span className="relative inline-flex rounded-sm h-2.5 w-2.5 bg-[#dc3545]"></span>
            </span>
            {branchName}
          </span>
        </div>
      </div>

      {/* 2. DEVELOPER UYARISI */}
      {!branchId && isDeveloper && (
        <div className="bg-amber-50 border-2 border-amber-500 text-amber-800 px-5 py-3 rounded-sm flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-amber-600" strokeWidth={2.5} />
          <span className="text-xs font-bold uppercase tracking-wider">
            <strong className="text-amber-900 mr-1">DEVELOPER MODU:</strong>
            Global yetkiyle bağlısınız. Terminal girişleri tüm şubeleri etkiler.
          </span>
        </div>
      )}

      {/* 3. İK BİLGİ VE KURAL KARTI (Yeni Dinamik QR Konsepti) */}
      <div className="bg-white border border-slate-300 rounded-sm shadow-sm relative overflow-hidden flex flex-col md:flex-row min-h-[280px]">
        {/* Arka Plan Görseli (Kare formata uygun, sağ tarafa hizalı ve degrade maskeli) */}
        <div className="absolute top-0 py-2 right-0 w-full md:w-[450px] lg:w-[500px] h-full z-0 flex items-center justify-end pointer-events-none">
          <img
            src="https://img.magnific.com/free-vector/qr-code-inside-smartphone-computer-laptop-woman-man-vector-design_24877-62885.jpg?t=st=1789457421~exp=1789461021~hmac=8fa5c3f25ca73ad541ea673edfb297057e458c33da7df16db82303a273e81f5a&w=1480"
            alt="Dynamic QR Vector"
            className="w-full h-full object-contain md:object-cover md:object-center mix-blend-multiply opacity-15 md:opacity-100 z-0"
          />
        </div>

        {/* Sol İçerik (Hoşgeldiniz ve Kurallar) */}
        <div className="p-6 md:p-8 z-20 flex-1 max-w-3xl flex flex-col justify-center">
          <h2 className="text-2xl font-black text-[#0F172B] tracking-widest uppercase mb-2">
            YENİ DİNAMİK QR MESAİ SİSTEMİ
          </h2>
          <p className="text-sm font-bold text-slate-500 mb-6 tracking-wide leading-relaxed">
            Sistem güvenliğini artırmak amacıyla personel giriş/çıkışları artık kişisel mobil cihazlardan, <strong className="text-[#dc3545]">10 saniyede bir yenilenen Dinamik QR kod</strong> ile yapılmaktadır. Cihaz zimmetleme aktif edilmiştir.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kural 1 */}
            <div className="bg-slate-50/95 backdrop-blur-sm border border-slate-200 p-4 rounded-sm shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <QrCode className="w-4 h-4 text-[#dc3545]" strokeWidth={2.5} />
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                  Cihaz Zimmeti & Ekran Görüntüsü
                </h3>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                Her personel yalnızca kendi eşleştirilmiş mobil cihazından işlem yapabilir. Ekran görüntüsü ile giriş denemeleri <strong className="text-[#0F172B]">zaman damgası uyuşmazlığı</strong> nedeniyle reddedilir.
              </p>
            </div>

            {/* Kural 2 */}
            <div className="bg-slate-50/95 backdrop-blur-sm border border-slate-200 p-4 rounded-sm shadow-sm border-l-2 border-l-amber-500">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert
                  className="w-4 h-4 text-amber-600"
                  strokeWidth={2.5}
                />
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                  Sistem Hataları & Raporlama
                </h3>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                QR sisteminin senkronizasyonunda nadiren gecikme veya hatalı okutmalar yaşanabilir. Bu tarz durumlarda panik yapmadan <strong className="text-amber-700">Geliştiriciye</strong> anında bilgi verilmelidir.
              </p>
            </div>

            {/* Kural 3 */}
            <div className="bg-slate-50/95 backdrop-blur-sm border border-slate-200 p-4 rounded-sm shadow-sm md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Clock
                  className="w-4 h-4 text-[#dc3545]"
                  strokeWidth={2.5}
                />
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                  15 Dakika Kuralı & Manuel İşlemler
                </h3>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                Vardiya başlama saatinden <strong className="text-[#dc3545]">15 dakika sonrasına</strong> kadar QR okutmayan personel geç kalmış sayılır. Olası şarj/cihaz problemlerinde manuel giriş düzeltmeleri sadece Yönetici yetkisi ile kalıcı log bırakılarak yapılabilir.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. OPERASYONEL IZGARA (Terminal ve Tablo) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* SOL: Barkod Terminali (Sticky) - 4 sütunun 1'ini alır (%25) */}
        <div className="xl:col-span-1 xl:sticky xl:top-6">
          <BarcodeScanner branchId={branchId || null} branchName={branchName} />
        </div>

        {/* SAĞ: Canlı Mesai Tablosu - 4 sütunun 3'ünü alır (%75) */}
        <div className="xl:col-span-3">
          <AttendanceTable branchId={branchId} isDeveloper={isDeveloper} />
        </div>
      </div>
    </div>
  );
}