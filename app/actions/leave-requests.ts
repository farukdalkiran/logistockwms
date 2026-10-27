"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { datesForLeave, leaveAttendanceRows } from "@/lib/attendance/leave-records";

// ============================================================================
// 1. GÜVENLİK VE VERİTABANI İSTEMCİSİ (SERVICE ROLE BYPASS)
// Sessiz RLS yutmalarını ve Next.js Server Action oturum çakışmalarını önler
// ============================================================================
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// ============================================================================
// 2. YENİ İZİN TALEBİ OLUŞTURMA MOTORU
// ============================================================================
export async function submitLeaveRequest(data: {
  employee_id: string;
  branch_id: string;
  leave_type: string;
  custom_leave_type: string;
  selected_dates: string[];
  is_half_day: boolean;
  half_day_period?: "MORNING" | "AFTERNOON" | null;
  reason: string;
}) {
  const supabase = await createClient();

  try {
    const {data:session,error:authError}=await supabase.auth.getClaims();
    if(authError || !session?.claims?.sub) return {success:false,message:"Oturum doğrulanamadı."};
    const sortedDates=datesForLeave(data.selected_dates);
    const period=data.is_half_day?(data.half_day_period==="AFTERNOON"?"AFTERNOON":"MORNING"):null;
    if(data.is_half_day && period!=="MORNING" && period!=="AFTERNOON") {
      return {success:false,message:"Yarım gün dilimini seçiniz."};
    }
    const {data:profile}=await supabaseAdmin.from("profiles").select("role,branch_id").eq("id",session.claims.sub).single();
    if(!profile) return {success:false,message:"Kullanıcı profili bulunamadı."};
    const globallyAuthorized=profile.role==="Developer"||profile.role==="Admin";
    if(!globallyAuthorized && profile.branch_id!==data.branch_id)
      return {success:false,message:"Farklı şube adına izin oluşturulamaz."};

    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, position_title, leave_balance, branch_id")
      .eq("id", data.employee_id).eq("is_active", true)
      .single();

    if (empError || !employee) return { success: false, message: "PERSONEL BULUNAMADI" };

    if(employee.branch_id!==data.branch_id) return {success:false,message:"Çalışan farklı şubeye bağlı."};
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    const requestedDays = data.is_half_day ? sortedDates.length * 0.5 : sortedDates.length;

// YENİ KOD (Olması Gereken -14 Lojiği):
if (data.leave_type === 'YILLIK_IZIN') {
   if (employee.leave_balance - requestedDays < -14) {
      return { success: false, message: "Yıllık izin bakiyesi -14 gün sınırının altına düşemez." };
   }
}

    const adminTitles = ["YÖNETİCİ", "MÜDÜR", "ŞEF", "ADMIN", "DEVELOPER", "YONETICI", "MUDUR", "SEF", "TAKIM LİDERİ", "TAKIM LIDERI"];
    const empTitle = (employee.position_title || "").toUpperCase();
    
    const isHealthReport = data.leave_type === 'SAGLIK_RAPORU';
    const isAuthorized = adminTitles.some(title => empTitle.includes(title)) || employee.id === "3976";

    let requestStatus = "PENDING";
    let managerNote = null;
    let feedbackMessage = "İZİN TALEBİNİZ YÖNETİCİ ONAYINA GÖNDERİLDİ";

    // An annual-leave half cannot overlap a public-holiday half.
    // For a 13–17 holiday, the user may still request 08–12 annual leave.
    if(data.leave_type==="YILLIK_IZIN"){
      const {data:holidays,error:holidayError}=await supabaseAdmin.from("wms_public_holidays")
        .select("holiday_date,period").in("holiday_date",sortedDates);
      if(holidayError)throw holidayError;
      const conflict=(holidays??[]).find(h=>h.period==="FULL" || !data.is_half_day || h.period===period);
      if(conflict)return {
        success:false,
        message:`${conflict.holiday_date} tarihi için resmî tatil bulunmaktadır. Sadece tatil olmayan yarım güne izin oluşturabilirsiniz.`,
      };
    }

    const {data:existingLeaves,error:overlapError}=await supabaseAdmin.from("leave_requests")
      .select("id,selected_dates,start_date,end_date,is_half_day,half_day_period")
      .eq("employee_id",data.employee_id).in("status",["PENDING","APPROVED"])
      .lte("start_date",endDate).gte("end_date",startDate);
    if(overlapError) throw overlapError;
    const desired=new Set(sortedDates);
    for(const old of existingLeaves??[]){
      const existingDates=datesForLeave(old.selected_dates,old.start_date);
      if(existingDates.some(day=>desired.has(day)) &&
        (!old.is_half_day || !data.is_half_day || (old.half_day_period??"MORNING")===period))
        return {success:false,message:"Seçili gün ve saat dilimi için zaten bekleyen veya onaylanmış izin mevcut."};
    }

    // Create the request BEFORE its attendance credits, linking each leave-only
    // attendance row to this specific request (actual punches are independent).
    const {data:storedRequest,error:reqError}=await supabaseAdmin.from("leave_requests").insert({
      employee_id:data.employee_id,branch_id:data.branch_id,leave_type:data.leave_type,
      custom_leave_type:data.custom_leave_type||null,start_date:startDate,end_date:endDate,
      selected_dates:sortedDates,is_half_day:data.is_half_day,half_day_period:period,
      requested_days:requestedDays,reason:data.reason,status:requestStatus,manager_note:managerNote
    }).select("id").single();
    if(reqError||!storedRequest) throw reqError??new Error("Talep kaydedilemedi.");

    if (isAuthorized || isHealthReport) {
      requestStatus = "APPROVED";
      managerNote = isHealthReport 
        ? "SİSTEM: Sağlık Raporu olduğu için otomatik onaylandı." 
        : `SİSTEM: ${employee.full_name} yetkisi dahilinde doğrudan onayladı.`;
      
      feedbackMessage = isHealthReport 
        ? "SAĞLIK RAPORU: SİSTEM TARAFINDAN OTOMATİK ONAYLANDI" 
        : "YETKİLİ: İZİN OTOMATİK ONAYLANDI VEYA SİSTEME İŞLENDİ";

      try {
        const credits=leaveAttendanceRows({
          id:storedRequest.id,employee_id:data.employee_id,branch_id:data.branch_id,
          leave_type:data.leave_type,is_half_day:data.is_half_day,half_day_period:period,
          selected_dates:sortedDates,
        });
        const {error:creditError}=await supabaseAdmin.from("attendance").insert(credits);
        if(creditError)throw creditError;
        if(data.leave_type==="YILLIK_IZIN"){
          const {error:balanceError}=await supabaseAdmin.from("employees")
            .update({leave_balance:Number(employee.leave_balance)-requestedDays}).eq("id",employee.id);
          if(balanceError)throw balanceError;
        }
      } catch (error) {
        await supabaseAdmin.from("attendance").delete().eq("leave_request_id",storedRequest.id);
        await supabaseAdmin.from("leave_requests").delete().eq("id",storedRequest.id);
        throw error;
      }
      
      const {error:statusErr}=await supabaseAdmin.from("leave_requests")
        .update({status:"APPROVED",manager_note:managerNote,updated_at:new Date().toISOString()})
        .eq("id",storedRequest.id).eq("status","PENDING");
      if(statusErr){
        await supabaseAdmin.from("attendance").delete().eq("leave_request_id",storedRequest.id);
        if(data.leave_type==="YILLIK_IZIN")
          await supabaseAdmin.from("employees").update({leave_balance:employee.leave_balance}).eq("id",employee.id);
        await supabaseAdmin.from("leave_requests").delete().eq("id",storedRequest.id);
        throw statusErr;
      }

      await supabaseAdmin.from("transaction_logs").insert({
        employee_id: data.employee_id,
        action_type: "LEAVE_AUTO_APPROVE",
        description: `OTO-ONAY: Toplam ${requestedDays} gün ${data.leave_type} izni kullanıldı. Neden: ${data.reason}`
      });
    }

    revalidatePath("/management/hr", "layout");

    return { success: true, message: feedbackMessage };

  } catch (error: any) {
    return { success: false, message: `SİSTEM HATASI: ${error.message}` };
  }
}

// ============================================================================
// 3. İPTAL VE TEMİZLİK MOTORU (ÇALIŞAN YAPIYA UYARLANMIŞ KESİN ÇÖZÜM)
// ============================================================================
export async function cancelLeaveRequestServer(
 leaveId:string, employeeId:string, _leaveType:string,
 _requestedDays:number,_selectedDatesRaw:unknown,_status:string,
) {
 try{
  const supabase=await createClient();
  const {data:claims,error:authError}=await supabase.auth.getClaims();
  if(authError||!claims?.claims?.sub)throw new Error("Oturum doğrulanamadı.");
  const {data:profile}=await supabaseAdmin.from("profiles").select("role,branch_id").eq("id",claims.claims.sub).single();
  const {data:req,error:readError}=await supabaseAdmin.from("leave_requests")
   .select("id,employee_id,branch_id,leave_type,requested_days,status,selected_dates,start_date,is_half_day,half_day_period")
   .eq("id",leaveId).eq("employee_id",employeeId).single();
  if(readError||!req||!profile)throw new Error("İzin talebi bulunamadı.");
  if(!["PENDING","APPROVED"].includes(req.status))throw new Error("Bu talep zaten kapatılmış.");
  if(profile.role!=="Developer" && profile.role!=="Admin" && profile.branch_id!==req.branch_id)
   throw new Error("Bu şubeye işlem yetkiniz yok.");
  const {data:updated,error:updError}=await supabaseAdmin.from("leave_requests")
   .update({status:"CANCELLED",manager_note:"Personel tarafından iptal edildi.",updated_at:new Date().toISOString()})
   .eq("id",req.id).eq("status",req.status).select("id").maybeSingle();
  if(updError||!updated)throw new Error("Talep durumu güncellenemedi.");

  if(req.status==="APPROVED"){
    const {error:delError}=await supabaseAdmin.from("attendance")
      .delete().eq("leave_request_id",req.id);
    if(delError)throw delError;

    // Legacy rows have no leave_request_id. Only delete a uniquely matching
    // synthetic absence when no OTHER approved request could own that slot.
    const dates=datesForLeave(req.selected_dates,req.start_date);
    const {data:other}=await supabaseAdmin.from("leave_requests")
      .select("id,selected_dates,start_date,is_half_day,half_day_period")
      .eq("employee_id",employeeId).eq("status","APPROVED").eq("leave_type",req.leave_type);
    const otherDates=new Set((other??[]).flatMap(x=>datesForLeave(x.selected_dates,x.start_date)));
    const {data:legacy}=await supabaseAdmin.from("attendance")
      .select("id,status,check_in_time,leave_request_id")
      .eq("employee_id",employeeId).eq("status",`LEAVE_${req.leave_type}`)
      .is("leave_request_id",null);
    const uniqueLegacyIds=(legacy??[]).filter(r=>
      r.check_in_time && dates.includes(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(r.check_in_time))) &&
      !otherDates.has(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(r.check_in_time)))
    ).map(x=>x.id);
    if(uniqueLegacyIds.length){
      const {error:legacyError}=await supabaseAdmin.from("attendance").delete().in("id",uniqueLegacyIds);
      if(legacyError)throw legacyError;
    }
    if(req.leave_type==="YILLIK_IZIN"){
      const {data:emp,error:empError}=await supabaseAdmin.from("employees").select("leave_balance").eq("id",employeeId).single();
      if(empError||!emp)throw new Error("İzin bakiyesi okunamadı.");
      const {error:refundError}=await supabaseAdmin.from("employees")
        .update({leave_balance:Number(emp.leave_balance)+Number(req.requested_days)}).eq("id",employeeId);
      if(refundError)throw refundError;
    }
  }
  revalidatePath("/management/hr","layout");
  return {success:true};
 }catch(error){return {success:false,message:error instanceof Error?error.message:"İzin iptal edilemedi."};}
}
