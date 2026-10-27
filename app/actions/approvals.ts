"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { leaveAttendanceRows } from "@/lib/attendance/leave-records";

// ========================================================================
// 🛡️ TİP TANIMLAMALARI (WMS STRICT TYPING)
// ========================================================================
type ApprovalAction = "APPROVE" | "REJECT";
type RequestType = "ATTENDANCE" | "LEAVE";

interface ProcessApprovalParams {
  request_id: string;
  request_type: RequestType;
  action: ApprovalAction;
  manager_id: string;
  manager_note: string;
}

interface ActionResponse {
  success: boolean;
  message: string;
  leaves?: any[];
  attendance?: any[];
  history?: any[];
}

// ========================================================================
// 🛡️ RLS BYPASS (SERVICE ROLE CLIENT)
// Operasyonel tablolara tüm şubeler veya çapraz yetkiler için engelsiz erişim
// ========================================================================
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ⏱️ PDKS 15 DK YUVARLAMA MOTORU (Saf Fonksiyon - Mutasyonsuz)
function roundToNext15Minutes(date: Date): Date {
  const newDate = new Date(date);
  const minutes = newDate.getMinutes();
  const remainder = minutes % 15;
  if (remainder > 0) newDate.setMinutes(minutes + (15 - remainder));
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
}

// ========================================================================
// 1. ONAY PANELİ VERİLERİNİ ÇEKME (GET PENDING APPROVALS)
// ========================================================================
export async function getPendingApprovals(branchId: string | null, isGlobal: boolean): Promise<ActionResponse> {
  try {
    let leavesQuery = supabaseAdmin.from("leave_requests")
      .select("*, employees(full_name, position_title)")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });

    let attendanceQuery = supabaseAdmin.from("attendance_requests")
      .select("*, employees(full_name, position_title), attendance(check_in_time, check_out_time)")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });
    
    let historyLQuery = supabaseAdmin.from("leave_requests")
      .select("*, employees(full_name, position_title)")
      .in("status", ["APPROVED", "REJECTED"])
      .order("created_at", { ascending: false })
      .limit(25);

    let historyAQuery = supabaseAdmin.from("attendance_requests")
      .select("*, employees(full_name, position_title), attendance(check_in_time, check_out_time)")
      .in("status", ["APPROVED", "REJECTED"])
      .order("created_at", { ascending: false })
      .limit(25);

    // WMS Kalkanı: Global yetkili değilse personeli sadece kendi şubesine kilitle
    if (!isGlobal && branchId && branchId !== "GLOBAL") {
      leavesQuery = leavesQuery.eq("branch_id", branchId);
      attendanceQuery = attendanceQuery.eq("branch_id", branchId);
      historyLQuery = historyLQuery.eq("branch_id", branchId);
      historyAQuery = historyAQuery.eq("branch_id", branchId);
    }

    const [resL, resA, hL, hA] = await Promise.all([leavesQuery, attendanceQuery, historyLQuery, historyAQuery]);
    
    if (resL.error) throw resL.error;
    if (resA.error) throw resA.error;

    // Geçmiş verilerini harmanla ve tarihe göre azalan (en yeni en üstte) sırala
    const combinedHistory = [
      ...(hL.data || []).map(x => ({...x, req_type: 'LEAVE'})), 
      ...(hA.data || []).map(x => ({...x, req_type: 'ATTENDANCE'}))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      success: true,
      message: "Veriler başarıyla çekildi",
      leaves: resL.data || [],
      attendance: resA.data || [],
      history: combinedHistory
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[FETCH_APPROVALS_ERROR]", err.message);
    return { success: false, message: `Sistem Hatası: ${err.message}`, leaves: [], attendance: [], history: [] };
  }
}

// ========================================================================
// 2. ONAY VEYA RED KARARINI İŞLEME (PROCESS APPROVAL)
// ========================================================================
export async function processApproval(params: ProcessApprovalParams): Promise<ActionResponse> {
  try {
    const isApprove = params.action === "APPROVE";
    const finalStatus = isApprove ? "APPROVED" : "REJECTED";

    // ----------------------------------------------------------------------
    // SENARYO A: İZİN TALEBİ ONAY/RED MOTORU
    // ----------------------------------------------------------------------
    if (params.request_type === "LEAVE") {
      const { data: req, error: reqError } = await supabaseAdmin
        .from("leave_requests")
        .select("*, employees(id, full_name, leave_balance)")
        .eq("id", params.request_id)
        .single();

      if (reqError || !req) return { success: false, message: "HATA: İlgili talep veritabanında bulunamadı!" };
      if (req.status !== "PENDING") return { success: false, message: "UYARI: Bu talep zaten karara bağlanmış." };

      const employee = req.employees;

      if (isApprove) {
        // Leave-only rows carry the exact selected clock window and a source
        // request ID. Actual worked shifts for the same date remain intact.
        const rows=leaveAttendanceRows({
          id:req.id,employee_id:employee.id,branch_id:req.branch_id,
          leave_type:req.leave_type,is_half_day:!!req.is_half_day,
          half_day_period:req.half_day_period,selected_dates:req.selected_dates,
          start_date:req.start_date,
        });
        if(req.leave_type==="YILLIK_IZIN"){
          // Holidays can be registered after a request was filed but before
          // manager approval. Never deduct annual leave for the holiday half.
          const dateStrings=rows.map(r=>{
            const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",
              year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(r.check_in_time));
            const value=(type:string)=>p.find(x=>x.type===type)?.value;
            return `${value("year")}-${value("month")}-${value("day")}`;
          });
          const {data:holidays,error:holidayError}=await supabaseAdmin
            .from("wms_public_holidays").select("holiday_date,period").in("holiday_date",dateStrings);
          if(holidayError)throw holidayError;
          const period=req.is_half_day?(req.half_day_period==="AFTERNOON"?"AFTERNOON":"MORNING"):null;
          if((holidays??[]).some(h=>h.period==="FULL" || !req.is_half_day || h.period===period))
            return {success:false,message:"Talep edilen yıllık izin resmî tatil ile çakışıyor. İzin saatlerini düzeltiniz."};
        }
        const {error:insertError}=await supabaseAdmin.from("attendance").insert(rows);
        if(insertError) throw insertError;
        if(req.leave_type==="YILLIK_IZIN"){
          const {error:balanceError}=await supabaseAdmin.from("employees")
            .update({leave_balance:Number(employee.leave_balance)-Number(req.requested_days)})
            .eq("id",employee.id);
          if(balanceError){
            await supabaseAdmin.from("attendance").delete().eq("leave_request_id",req.id);
            throw balanceError;
          }
        }
      }

      // 5. Talebi Güncelle ve Log Bırak
      const {error:requestUpdateError}=await supabaseAdmin.from("leave_requests").update({
        status: finalStatus,
        manager_id: params.manager_id,
        manager_note: params.manager_note,
        updated_at: new Date().toISOString()
      }).eq("id", params.request_id).eq("status","PENDING");
      if(requestUpdateError)throw requestUpdateError;

      await supabaseAdmin.from("transaction_logs").insert({
        employee_id: employee.id,
        action_type: isApprove ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        description: `İzin Kararı: [${finalStatus}]. Süre: ${req.requested_days} Gün (${req.leave_type}). Not: ${params.manager_note}`
      });

      revalidatePath("/management/hr", "layout");
      return { success: true, message: `İŞLEM BAŞARILI: İzin Talebi ${finalStatus}` };
    }

    // ----------------------------------------------------------------------
    // SENARYO B: MESAİ DÜZELTME TALEBİ ONAY/RED MOTORU
    // ----------------------------------------------------------------------
    if (params.request_type === "ATTENDANCE") {
      const { data: req, error: reqError } = await supabaseAdmin
        .from("attendance_requests")
        .select("*, employees(id, full_name)")
        .eq("id", params.request_id)
        .single();

      if (reqError || !req) return { success: false, message: "HATA: İlgili talep veritabanında bulunamadı!" };
      if (req.status !== "PENDING") return { success: false, message: "UYARI: Bu talep zaten karara bağlanmış." };

      const employee = req.employees;

      if (isApprove) {
        if (req.request_type === "DELETE_LOG") {
          // Talebin amacı bir puantajı iptal etmek/silmek ise
          await supabaseAdmin.from("attendance").delete().eq("id", req.attendance_id);
        } else {
          // 1970 HATASI İZOLASYONU: Değerler güvenli şekilde kontrol ediliyor
          const hasCheckIn = !!req.req_check_in;
          const hasCheckOut = !!req.req_check_out;

          const dIn = hasCheckIn ? new Date(req.req_check_in) : null;
          const dOut = hasCheckOut ? new Date(req.req_check_out) : null;
          
          // Gece Vardiyası Koruması: Çıkış saati, giriş saatinden küçükse (örn 01:00) 1 gün ileri at.
          if (dIn && dOut && dOut < dIn) {
             dOut.setDate(dOut.getDate() + 1);
          }

          const rIn = dIn ? roundToNext15Minutes(dIn) : null;
          const rOut = dOut ? roundToNext15Minutes(dOut) : null;

          let breakH = 0;
          let netW = 0;

          // Mesai ve mola süresi hesabı sadece hem giriş hem çıkış doluysa hesaplanabilir
          if (rIn && rOut) {
            const diffHours = (rOut.getTime() - rIn.getTime()) / 3600000;
            breakH = diffHours > 5 ? 1 : 0; // 5 Saatten uzunsa 1 saat mola düşülür
            netW = Math.max(0, diffHours - breakH);
          }

          const payload = {
            check_in_time: dIn ? dIn.toISOString() : null,
            check_out_time: dOut ? dOut.toISOString() : null,
            rounded_check_in: rIn ? rIn.toISOString() : null,
            rounded_check_out: rOut ? rOut.toISOString() : null,
            break_hours: breakH,
            working_hours: parseFloat(netW.toFixed(2)),
            status: "MANUAL_EDIT_APPROVED"
          };

          if (req.attendance_id) {
            // Var olan mesai kaydını güncelle
            await supabaseAdmin.from("attendance").update(payload).eq("id", req.attendance_id);
          } else {
            // Unutulmuş mesaiyi sıfırdan oluştur
            await supabaseAdmin.from("attendance").insert({
              ...payload,
              employee_id: req.employee_id,
              branch_id: req.branch_id
            });
          }
        }
      }

      // Talebi Güncelle ve Log Bırak
      await supabaseAdmin.from("attendance_requests").update({
        status: finalStatus,
        manager_id: params.manager_id,
        manager_note: params.manager_note,
        updated_at: new Date().toISOString()
      }).eq("id", params.request_id);

      await supabaseAdmin.from("transaction_logs").insert({
        employee_id: employee.id,
        action_type: isApprove ? "ATTENDANCE_APPROVED" : "ATTENDANCE_REJECTED",
        description: `Mesai Kararı: [${finalStatus}]. Tip: ${req.request_type}. Not: ${params.manager_note}`
      });

      revalidatePath("/management/hr", "layout");
      return { success: true, message: `İŞLEM BAŞARILI: Mesai Talebi ${finalStatus}` };
    }

    return { success: false, message: "GEÇERSİZ TALEP TİPİ" };
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[PROCESS_APPROVAL_ERROR]", err.message);
    return { success: false, message: `SİSTEM HATASI: ${err.message}` };
  }
}