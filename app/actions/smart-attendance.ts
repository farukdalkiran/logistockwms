"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function analyzeAttendanceGaps(
  employeeIds: string[], 
  year: number, 
  month: number,
  excludedDates: string[] = [] // 🛡️ İstenmeyen veya hariç tutulan günler (YYYY-MM-DD)
) {
  try {
    if (employeeIds.length === 0) return { success: false, message: "Personel seçilmedi." };

    const daysInMonth = new Date(year, month, 0).getDate();
    const weekdays: string[] = [];
    
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month - 1, i, 12, 0, 0);
      const dateStr = d.toISOString().split("T")[0];

      // Hafta sonları ve kullanıcı tarafından hariç tutulan günleri atla
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (!isWeekend && !excludedDates.includes(dateStr)) {
        weekdays.push(dateStr);
      }
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}T23:59:59Z`;

    const { data: attendanceData } = await supabaseAdmin
      .from("attendance")
      .select("employee_id, check_in_time")
      .in("employee_id", employeeIds)
      .gte("check_in_time", startDate)
      .lte("check_in_time", endDate);

    const { data: leaveData } = await supabaseAdmin
      .from("leave_requests")
      .select("employee_id, selected_dates, start_date, end_date")
      .in("employee_id", employeeIds)
      .in("status", ["APPROVED", "MANUAL_EDIT_AUTO_APPROVED"]);

    const existingLogs = new Set<string>();

    attendanceData?.forEach(record => {
      const date = record.check_in_time.split("T")[0];
      existingLogs.add(`${record.employee_id}_${date}`);
    });

    leaveData?.forEach(leave => {
      let dates: string[] = [];
      if (typeof leave.selected_dates === 'string') dates = JSON.parse(leave.selected_dates);
      else if (Array.isArray(leave.selected_dates)) dates = leave.selected_dates;
      else if (leave.start_date) dates = [leave.start_date.split("T")[0]];
      
      dates.forEach(d => {
        const dStr = new Date(d).toISOString().split("T")[0];
        existingLogs.add(`${leave.employee_id}_${dStr}`);
      });
    });

    const gapsByDate: Record<string, string[]> = {};

    weekdays.forEach(dateStr => {
      const missingEmps = employeeIds.filter(empId => !existingLogs.has(`${empId}_${dateStr}`));
      if (missingEmps.length > 0) {
        gapsByDate[dateStr] = missingEmps;
      }
    });

    return { success: true, data: Object.entries(gapsByDate).map(([date, emps]) => ({ date, employeeIds: emps })) };
  } catch (error: any) {
    console.error("[GAP_ANALYSIS_ERROR]", error);
    return { success: false, message: error.message };
  }
}

interface BulkGapPayload {
  date: string;
  isHoliday: boolean;
  checkIn: string;
  checkOut: string;
  breakMinutes: number;
  employeeIds: string[];
}

export async function processBulkMissingAttendance(payloads: BulkGapPayload[], managerId: string) {
  try {
    let successCount = 0;
    const allInserts = [];
    const allLogs = [];

    const allEmpIds = [...new Set(payloads.flatMap(p => p.employeeIds))];
    const { data: empData } = await supabaseAdmin.from("employees").select("id, branch_id").in("id", allEmpIds);
    const branchMap = new Map(empData?.map(e => [e.id, e.branch_id]));

    for (const group of payloads) {
      if (group.employeeIds.length === 0) continue;

      const breakHours = group.isHoliday ? 0 : Number((group.breakMinutes / 60).toFixed(2));
      
      const checkInDate = new Date(`${group.date}T${group.checkIn}:00+03:00`);
      let checkOutDate = new Date(`${group.date}T${group.checkOut}:00+03:00`);
      if (checkOutDate < checkInDate) checkOutDate.setDate(checkOutDate.getDate() + 1);

      const checkInISO = checkInDate.toISOString();
      const checkOutISO = checkOutDate.toISOString();

      const totalDiffMs = checkOutDate.getTime() - checkInDate.getTime();
      const totalDiffHours = totalDiffMs / (1000 * 60 * 60);
      const workingHours = group.isHoliday ? 0 : Number((totalDiffHours - breakHours).toFixed(2));

      for (const empId of group.employeeIds) {
        const bId = branchMap.get(empId);
        if (!bId) continue;

        allInserts.push({
          employee_id: empId,
          branch_id: bId,
          check_in_time: checkInISO,
          check_out_time: checkOutISO,
          rounded_check_in: checkInISO,
          rounded_check_out: checkOutISO,
          break_hours: breakHours,
          working_hours: workingHours > 0 ? workingHours : 0,
          status: "PRESENT", // 🎯 Akıllı taramadan gelen eksikler "Normal Mesai" statüsüyle işlenir
          manager_id: managerId,
          created_at: new Date().toISOString()
        });

        allLogs.push({
          employee_id: managerId,
          action_type: "BULK_ATTENDANCE_NORMAL",
          description: `Akıllı Tarama Eksik Tamamlama: ${empId} ID'li personele ${group.date} tarihi için NORMAL MESAİ işlendi.`
        });
        
        successCount++;
      }
    }

    if (allInserts.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from("attendance").insert(allInserts);
      if (insertErr) throw insertErr;
      await supabaseAdmin.from("transaction_logs").insert(allLogs);
    }

    return { success: true, message: `${successCount} adet eksik gün kaydı NORMAL MESAİ olarak sisteme işlendi.` };
  } catch (error: any) {
    console.error("[BULK_INSERT_ERROR]", error);
    return { success: false, message: error.message || "Toplu kayıt sırasında bir hata oluştu." };
  }
}