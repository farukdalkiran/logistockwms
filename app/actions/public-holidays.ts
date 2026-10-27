"use server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { HolidayPeriod, PublicHoliday } from "@/lib/attendance/day-coverage";
type Result<T> = {success:true;data:T;message?:string}|{success:false;message:string};
const PERIODS = ["FULL","MORNING","AFTERNOON"];
const isDate = (s:string)=> /^\\d{4}-\\d{2}-\\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T12:00:00Z"));
function db() {
 return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {auth:{autoRefreshToken:false,persistSession:false}});
}
async function auth(developerOnly=false) {
 const session=await createSessionClient();
 const {data,error}=await session.auth.getClaims();
 if(error || !data?.claims?.sub) throw new Error("Oturum açmanız gerekiyor.");
 const admin=db();
 const {data:profile,error:profileError}=await admin.from("profiles").select("id,role").eq("id",data.claims.sub).single();
 if(profileError || !profile) throw new Error("Kullanıcı profili bulunamadı.");
 if(developerOnly && profile.role!=="Developer") throw new Error("Resmî tatil yönetimi yalnızca Developer hesabına açıktır.");
 return {admin,userId:data.claims.sub};
}
const select="id,holiday_date,title,period,start_time,end_time,credited_hours";
export async function getPublicHolidays(from:string,to:string):Promise<Result<PublicHoliday[]>> {
 try{
  if(!isDate(from)||!isDate(to)||from>to) throw new Error("Tarih aralığı geçersiz.");
  const {admin}=await auth();
  const {data,error}=await admin.from("wms_public_holidays").select(select).gte("holiday_date",from)
   .lte("holiday_date",to).order("holiday_date",{ascending:true}).limit(400);
  if(error) throw error;
  return {success:true,data:(data??[]) as PublicHoliday[]};
 }catch(e){return {success:false,message:e instanceof Error?e.message:"Tatiller getirilemedi."};}
}
export async function savePublicHoliday(input:{
 holiday_date:string;title:string;period:HolidayPeriod
}):Promise<Result<PublicHoliday>>{
 try{
  const {admin,userId}=await auth(true);
  const title=input.title.trim();
  if(!isDate(input.holiday_date) || title.length<3 || title.length>160 || !PERIODS.includes(input.period))
   throw new Error("Tarih, tatil türü veya başlık geçersiz.");
  const {data,error}=await admin.from("wms_public_holidays").upsert({
   holiday_date:input.holiday_date,title,period:input.period,created_by:userId,updated_at:new Date().toISOString()
  },{onConflict:"holiday_date"}).select(select).single();
  if(error||!data)throw error??new Error("Kayıt oluşturulamadı.");
  revalidatePath("/management/hr/attendance-editor");
  revalidatePath("/management/hr");
  return {success:true,data:data as PublicHoliday,message:"Resmî tatil kaydedildi. Var olan giriş/çıkış kayıtları değiştirilmedi."};
 }catch(e){return {success:false,message:e instanceof Error?e.message:"Tatil kaydedilemedi."};}
}
export async function removePublicHoliday(id:string):Promise<Result<true>>{
 try{
  const {admin}=await auth(true);
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Geçersiz tatil ID.");
  const {error}=await admin.from("wms_public_holidays").delete().eq("id",id);
  if(error)throw error;
  revalidatePath("/management/hr/attendance-editor");
  revalidatePath("/management/hr");
  return {success:true,data:true,message:"Tatil kaldırıldı. Mesai kayıtlarına dokunulmadı."};
 }catch(e){return {success:false,message:e instanceof Error?e.message:"Tatil silinemedi."};}
}
