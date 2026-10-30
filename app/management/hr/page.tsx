import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BarcodeScanner from "@/app/management/hr/_components/BarcodeScanner";
import AttendanceTable from "@/app/management/hr/_components/AttendanceTable";
import { getIstanbulToday, getUpcomingEmployeeEvents, type EmployeeCelebrationSource } from "@/lib/hr/upcoming-events";
import { AlertCircle, ArrowUpRight, Award, Cake, CalendarDays, Clock3, Fingerprint, UsersRound } from "lucide-react";

export const metadata = { title: "Mesai Yönetimi | LogiStock WMS" };

function formatEventDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`));
}

function countdown(days: number) {
  if (days === 0) return "BUGÜN";
  if (days === 1) return "YARIN";
  return `${days} GÜN KALDI`;
}

export default async function HRManagementPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("role, branch_id, branches(name)")
    .eq("id", user.id).single();

  if (!profile) {
    return <div className="m-6 rounded-[5px] border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">Profiliniz bulunamadı. Sistem yöneticisiyle iletişime geçin.</div>;
  }

  const branchId: string | null = profile.branch_id ?? null;
  const isDeveloper = profile.role === "Developer" || profile.role === "Admin";
  if (!branchId && !isDeveloper) redirect("/management/unauthorized");

  const branchData = profile.branches as unknown as { name: string } | { name: string }[] | null;
  const branchName = (Array.isArray(branchData) ? branchData[0]?.name : branchData?.name) || "TÜM ŞUBELER";

  // Aynı terminal kapsamı: şubeli oturum yalnızca kendi deposunu, şubesiz global hesap tümünü görür.
  let employeesQuery = supabase.from("employees")
    .select("id, full_name, birthday, birthday_month_day, employment_date")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (branchId && branchId !== "GLOBAL") employeesQuery = employeesQuery.eq("branch_id", branchId);
  const { data: employees, error: employeesError } = await employeesQuery;

  const today = getIstanbulToday();
  const personnel = (employees || []) as EmployeeCelebrationSource[];
  const events = getUpcomingEmployeeEvents(personnel, today, 90);
  const upcomingBirthdays = events.filter(event => event.kind === "birthday").length;
  const upcomingAnniversaries = events.filter(event => event.kind === "anniversary").length;

  return (
    <main className="space-y-4 pb-12">
      <section className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm">
        <div className="h-1 w-full bg-[#dc3545]" />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
          <div className="flex flex-col justify-between gap-5 p-5 sm:p-6">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#b91c1c]">
                  <Fingerprint size={13} /> İNSAN KAYNAKLARI · CANLI OPERASYON
                </span>
                <span className="rounded-[5px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{branchName}</span>
              </div>
              <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900 sm:text-[28px]">Mesai Yönetim Merkezi</h1>
              <p className="mt-2 max-w-[520px] text-[13px] leading-6 text-slate-600">
                Günlük giriş ve çıkışları, aylık çalışma sürelerini ve personel hareketlerini tek ekrandan takip edin.
                Terminalde <strong className="font-semibold text-slate-800">5 haneli personel ID</strong> ile mesai işlemi yapılır.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"><UsersRound size={14} className="text-[#dc3545]" /> {personnel.length} aktif personel</span>
                <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"><Clock3 size={14} className="text-[#dc3545]" /> Türkiye saati (UTC+3)</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/management/hr/insights" className="inline-flex items-center gap-2 rounded-[5px] bg-[#dc3545] px-3.5 py-2.5 text-[11px] font-bold text-white transition-colors hover:bg-[#b91c1c]">
                Personel 360 & Analiz <ArrowUpRight size={14} />
              </Link>
              <Link href="/management/hr/reports" className="inline-flex items-center gap-2 rounded-[5px] border border-slate-200 px-3.5 py-2.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50">
                Mesai Raporları <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          <section aria-label="Yaklaşan doğum günleri ve iş yıl dönümleri" className="border-t border-slate-200 bg-slate-50/80 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#dc3545]">PERSONEL TAKVİMİ</span>
                <h2 className="mt-1 text-[17px] font-extrabold text-slate-900">Yaklaşan Özel Günler</h2>
                <p className="mt-1 text-[11px] text-slate-500">Önümüzdeki 90 gün · Doğum günleri ve işe giriş yıl dönümleri</p>
              </div>
              <div className="flex gap-2">
                <span title="Yaklaşan doğum günleri" className="inline-flex items-center gap-1 rounded-[5px] border border-red-100 bg-white px-2 py-1.5 text-[11px] font-bold text-[#b91c1c]"><Cake size={14} /> {upcomingBirthdays}</span>
                <span title="Yaklaşan iş yıl dönümleri" className="inline-flex items-center gap-1 rounded-[5px] border border-amber-100 bg-white px-2 py-1.5 text-[11px] font-bold text-amber-700"><Award size={14} /> {upcomingAnniversaries}</span>
              </div>
            </div>
            {employeesError ? (
              <p className="mt-4 rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Personel takvimi şu an getirilemiyor. Mesai terminali kullanılabilir.</p>
            ) : events.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-[5px] border border-dashed border-slate-300 bg-white px-4 py-5 text-xs text-slate-500">
                <CalendarDays size={18} /> Önümüzdeki 90 gün için kayıtlı özel gün bulunmuyor.
              </div>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {events.slice(0, 6).map(event => (
                  <div key={`${event.employeeId}-${event.kind}`} className="flex min-w-0 items-center gap-2.5 rounded-[5px] border border-slate-200 bg-white px-3 py-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] ${event.kind === "birthday" ? "bg-red-50 text-[#dc3545]" : "bg-amber-50 text-amber-700"}`}>
                      {event.kind === "birthday" ? <Cake size={16} /> : <Award size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div title={event.fullName} className="truncate text-[11px] font-bold text-slate-800">{event.fullName}</div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-500">
                        {formatEventDate(event.date)} · {event.kind === "birthday" ? "Doğum günü" : `${event.years}. iş yıl dönümü`}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[9px] font-extrabold tabular-nums ${event.daysUntil <= 7 ? "text-[#dc3545]" : "text-slate-500"}`}>{countdown(event.daysUntil)}</span>
                  </div>
                ))}
              </div>
            )}
            {!employeesError && events.length > 6 && <p className="mt-2 text-right text-[10px] text-slate-500">+{events.length - 6} diğer özel gün</p>}
          </section>
        </div>
      </section>

      {!branchId && isDeveloper && (
        <div className="flex items-start gap-2.5 rounded-[5px] border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Developer / Admin genel görünümündesiniz. Mesai terminalinden işlem yaparken personel ve şube eşleşmesini kontrol edin.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[5px] border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-600">
        <span className="font-bold text-slate-800">Terminal kullanımı</span>
        <span><strong>1.</strong> Giriş veya çıkış seçin</span>
        <span><strong>2.</strong> 5 haneli ID girin</span>
        <span><strong>3.</strong> İşlemi onaylayın</span>
        <span className="ml-auto text-slate-500">Kayıtlar canlı mesai tablosuna yansır.</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <BarcodeScanner branchId={branchId} branchName={branchName} />
        </aside>
        <div className="min-w-0">
          <AttendanceTable branchId={branchId} isDeveloper={isDeveloper} />
        </div>
      </div>
    </main>
  );
}
