"use server";

import { createClient } from "@/lib/supabase/server";

export interface MultinetRecord {
  employeeId: string;
  fullName: string;
  baseDays: number;         // İlgili ayın toplam hafta içi hedef günü (Sabit)
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

  // 1. İlgili ayın toplam hafta içi gün sayısını (Hedef Gün) tam olarak hesapla
  const daysInMonth = new Date(year, month, 0).getDate();
  let baseDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      baseDays++;
    }
  }

  // 2. Şubedeki aktif personelleri çek
  let empQuery = supabase.from("employees").select("id, full_name").eq("is_active", true);
  if (branchId && branchId !== "GLOBAL") {
    empQuery = empQuery.eq("branch_id", branchId);
  }
  const { data: employees, error: empError } = await empQuery;

  if (empError || !employees || employees.length === 0) return [];

  const employeeIds = employees.map(emp => emp.id);
  const startDate = new Date(year, month - 1, 1).toISOString();
  
  const endLimitDate = isCurrentMonth 
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
    : new Date(year, month, 1);
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
      
      // İzin / Rapor statüsü kontrolü
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
      
      // Brüt süre hesabı (milisaniye cinsinden)
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const grossHours = diffMs / (1000 * 60 * 60);

      // Standart Mola Düşüşü: 10 saat ve üzeri çalışmalarda 1 saat mola düşülür
      // (Eğer farklı bir mola kuralı varsa burası dinamikleştirilebilir)
      const breakHours = grossHours >= 6 ? 1.0 : 0.0;
      const netHours = Math.max(0, grossHours - breakHours);

      if (isWeekend) {
        extraDays += 1;
        details.push(`${checkIn.toLocaleDateString('tr-TR')} (Hafta Sonu Mesaisi: +1)`);
      } else {
        workedDays += 1;
      }

      // 10 Saat Net Çalışma Aşımı Kontrolü (Mola düşüldükten sonra)
      if (netHours >= 10) {
        extraDays += 1;
        details.push(`${checkIn.toLocaleDateString('tr-TR')} (10+ Saat Net Aşım, Brüt: ${grossHours.toFixed(1)}s, Mola: ${breakHours}s: +1)`);
      }
    });

    // Onaylı izinlerin işlenmesi
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
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
    });

    // Geçmiş günlerde eksik çalışma tespiti
    const checkDaysLimit = isCurrentMonth ? Math.max(0, today.getDate() - 1) : daysInMonth;
    let pastBaseDays = 0;
    for (let d = 1; d <= checkDaysLimit; d++) {
      const date = new Date(year, month - 1, d);
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