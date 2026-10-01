"use server";

import { createClient } from "@/lib/supabase/server";

export interface MultinetRecord {
  employeeId: string;
  fullName: string;
  baseDays: number;
  workedDays: number;
  extraDays: number;
  deductedDays: number;
  netDays: number;
  totalAmount: number;
  part1: number;
  part2: number;
  details: string[];
}

export async function getMultinetCalculations(
  branchId: string | null,
  year: number,
  month: number,
  dailyFee: number
): Promise<MultinetRecord[]> {
  const supabase = await createClient();
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
  
  // GELECEK AY KONTROLÜ (Henüz yaşanmamış aylar için)
  const isFutureMonth = (year > today.getFullYear()) || (year === today.getFullYear() && month > (today.getMonth() + 1));

  // HEDEF AY LOJİĞİ (Bir sonraki ayın hesaplanması)
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  // 1. BİR SONRAKİ ayın (Hedef Ay) toplam hafta içi gün sayısını hesapla
  const daysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();
  let baseDays = 0;
  for (let d = 1; d <= daysInNextMonth; d++) {
    const date = new Date(nextYear, nextMonth - 1, d);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      baseDays++;
    }
  }

  // 2. SEÇİLİ ayın toplam gün sayısı
  const daysInCurrentMonth = new Date(year, month, 0).getDate();

  // 3. Şubedeki aktif personelleri çek (İşe giriş tarihini de alıyoruz ki öncesini kesmeyelim)
  let empQuery = supabase.from("employees").select("id, full_name, employment_date").eq("is_active", true);
  if (branchId && branchId !== "GLOBAL") {
    empQuery = empQuery.eq("branch_id", branchId);
  }
  const { data: employees, error: empError } = await empQuery;

  if (empError || !employees || employees.length === 0) return [];

  const employeeIds = employees.map(emp => emp.id);
  
  // PUANTAJ TARAMASI (Seçili ay için yapılır)
  const startDate = new Date(year, month - 1, 1).toISOString();
  
  // Eğer gelecek aysa puantaj taraması yapmanın anlamı yok ama yine de limiti ayarlıyoruz.
  let endLimitDate = new Date(year, month, 1);
  if (isCurrentMonth) {
    endLimitDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  } else if (isFutureMonth) {
    endLimitDate = new Date(year, month - 1, 1); // Gelecek aysa hiç tarama yapma
  }
  
  const endDate = endLimitDate.toISOString();

  const { data: attendance } = await supabase
    .from("attendance")
    .select("employee_id, check_in_time, check_out_time, status")
    .in("employee_id", employeeIds)
    .gte("check_in_time", startDate)
    .lt("check_in_time", endDate);

  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("employee_id, start_date, end_date, type, status")
    .in("employee_id", employeeIds)
    .eq("status", "APPROVED")
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  const records: MultinetRecord[] = [];

  for (const emp of employees) {
    let workedDays = 0;
    let extraDays = 0;
    let deductedDays = 0;
    const details: string[] = [];
    const processedDates = new Set<string>();

    const empAttendance = attendance?.filter(a => a.employee_id === emp.id) || [];
    
    empAttendance.forEach(record => {
      if (!record.check_in_time) return;
      
      const checkIn = new Date(record.check_in_time);
      const dateKey = checkIn.toISOString().split('T')[0];
      processedDates.add(dateKey);
      
      if (record.status && record.status.startsWith('LEAVE_')) {
        if (checkIn.getDay() !== 0 && checkIn.getDay() !== 6) {
          deductedDays += 1;
          const leaveName = record.status.replace('LEAVE_', '').replace('_', ' ');
          details.push(`${checkIn.toLocaleDateString('tr-TR')} (Kesinti: ${leaveName})`);
        }
        return;
      }

      if (!record.check_out_time) return;
      
      const checkOut = new Date(record.check_out_time);
      const isWeekend = checkIn.getDay() === 0 || checkIn.getDay() === 6;
      
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const grossHours = diffMs / (1000 * 60 * 60);

      const breakHours = grossHours >= 6 ? 1.0 : 0.0;
      const netHours = Math.max(0, grossHours - breakHours);

      if (isWeekend) {
        extraDays += 1;
        details.push(`${checkIn.toLocaleDateString('tr-TR')} (Hafta Sonu Mesaisi: +1)`);
      } else {
        workedDays += 1;
      }

      if (netHours >= 10) {
        extraDays += 1;
        details.push(`${checkIn.toLocaleDateString('tr-TR')} (10+ Saat Aşım: +1)`);
      }
    });

    const empLeaves = leaves?.filter(l => l.employee_id === emp.id) || [];
    empLeaves.forEach(leave => {
      const lStart = new Date(leave.start_date);
      const lEnd = new Date(leave.end_date);
      let tempDate = new Date(lStart);
      
      while (tempDate <= lEnd && tempDate < endLimitDate) {
        const dKey = tempDate.toISOString().split('T')[0];
        if (!processedDates.has(dKey) && tempDate.getMonth() + 1 === month && tempDate.getDay() !== 0 && tempDate.getDay() !== 6) {
          deductedDays += 1;
          details.push(`${tempDate.toLocaleDateString('tr-TR')} (İzin: ${leave.type})`);
          processedDates.add(dKey); // Aynı güne çift kesinti atmaması için
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
    });

    // SEÇİLİ AYA GÖRE Eksik Çalışma Kontrolü (Gelecek aylar için = 0)
    let checkDaysLimit = 0;
    if (isFutureMonth) {
      checkDaysLimit = 0; // Henüz yaşanmamış aylarda eksik gün aranmaz
    } else if (isCurrentMonth) {
      checkDaysLimit = Math.max(0, today.getDate() - 1); // İçinde bulunduğumuz ayda düne kadar bakar
    } else {
      checkDaysLimit = daysInCurrentMonth; // Geçmiş aylarda tüm aya bakar
    }

    let pastBaseDays = 0;
    
    // Personelin işe giriş tarihinden önceki günleri haksızca eksik saymamak için kalkan
    const empStartDate = emp.employment_date ? new Date(emp.employment_date) : new Date(0);

    for (let d = 1; d <= checkDaysLimit; d++) {
      const date = new Date(year, month - 1, d);
      
      // Eğer bu tarih, personelin işe girdiği tarihten önceyse devamsızlık sayma
      if (date < empStartDate) continue;

      if (date.getDay() !== 0 && date.getDay() !== 6) pastBaseDays++;
    }

    if (workedDays + deductedDays < pastBaseDays) {
      const missing = pastBaseDays - (workedDays + deductedDays);
      if (missing > 0) {
        deductedDays += missing;
        details.push(`Geçmiş Günler Eksik/Devamsızlık: -${missing}`);
      }
    }

    const netDays = baseDays + extraDays - deductedDays;
    const totalAmount = netDays * dailyFee;

    records.push({
      employeeId: emp.id,
      fullName: emp.full_name,
      baseDays,
      workedDays,
      extraDays,
      deductedDays,
      netDays,
      totalAmount,
      part1: totalAmount / 2,
      part2: totalAmount / 2,
      details
    });
  }

  return records;
}