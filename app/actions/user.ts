"use server";

import { randomBytes, randomInt } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AccountBranch = { id: string; name: string };
export type AccountRole = { id: number; role_code: string; role_name: string };
export type WebAccount = {
  id: string; full_name: string | null; email: string | null; role: string;
  branch_id: string | null; employee_id: string | null;
  last_password_change: string | null; created_at: string | null;
};
export type TerminalAccount = {
  id: string; full_name: string; position_title: string | null;
  is_active: boolean; branch_id: string | null; created_at: string | null;
};
export type PasswordDashboard = {
  isDeveloper: boolean; ownBranchId: string | null; ownBranchName: string;
  currentUserId: string; webAccounts: WebAccount[]; terminalAccounts: TerminalAccount[];
  branches: AccountBranch[]; roles: AccountRole[];
};
type ErrorResult = { success: false; error: string };
type Success<T> = { success: true } & T;
type Result<T> = Success<T> | ErrorResult;
type NewWeb = {
  fullName: string; email: string; branchId: string;
  roleCode: string; tempPassword?: string; linkedEmployeeId?: string | null;
  positionTitle?: string;
};
type EditWeb = { id: string; fullName: string; email: string; role: string;
  branchId: string | null; linkedEmployeeId?: string | null };
type EditTerminal = { id: string; fullName: string; positionTitle: string;
  branchId: string | null; isActive: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TERMINAL_ID = /^[1-9][0-9]{4}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANAGEMENT_ROLES = new Set(["Developer","Admin","ADMNWH","StoreMng","HR"]);
const PROTECTED_ROLES = new Set(["Developer","Admin"]);
const LOCAL_ASSIGNABLE_ROLES: Record<string, Set<string>> = {
  Admin: new Set(["ADMNWH","StoreMng","HR","WAREHOUSE","Store","Limited"]),
  ADMNWH: new Set(["WAREHOUSE","Limited"]),
  StoreMng: new Set(["Store","Limited"]),
  HR: new Set(["Limited"]),
};

function adminDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Supabase sunucu bağlantısı tanımlı değil.");
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
    auth:{autoRefreshToken:false,persistSession:false},
  });
}
type Db = ReturnType<typeof adminDb>;
const fail = (e: unknown): ErrorResult => ({
  success:false,error:e instanceof Error ? e.message : "İşlem tamamlanamadı.",
});
function validId(id:string) { if (!UUID.test(id)) throw new Error("Geçersiz hesap kimliği."); }
function cleanName(s:string) {
  const name = String(s||"").trim().replace(/\s+/g," ");
  if(name.length<3||name.length>120)throw new Error("Ad / hesap adı 3-120 karakter olmalı.");
  return name;
}
function cleanEmail(s:string){
  const mail=String(s||"").trim().toLowerCase();
  if(mail.length>254||!EMAIL.test(mail))throw new Error("Geçerli bir e-posta adresi girin.");
  return mail;
}
function cleanBranchId(id:string|null) {
  if(!id||!UUID.test(id))throw new Error("Hesap için geçerli şube seçin.");
  return id;
}
function createPassword() {
  // Geçici parolayı kriptografik olarak üretir. Login ekranının Lgs prefix kuralını korur.
  return `Lgs${randomBytes(12).toString("base64url")}aA9!`;
}
async function actor() {
  const session=await createSessionClient();
  const {data,error}=await session.auth.getUser();
  if(error||!data.user)throw new Error("İşlem için oturum açmalısınız.");
  const db=adminDb();
  const {data:profile,error:profileError}=await db.from("profiles")
    .select("id,role,branch_id").eq("id",data.user.id).single();
  if(profileError||!profile)throw new Error("Yetkili kullanıcı profili bulunamadı.");
  const role=String(profile.role||"");
  if(!MANAGEMENT_ROLES.has(role))throw new Error("Hesap yönetimi için yetkiniz yok.");
  const developer=role==="Developer";
  const branchId=profile.branch_id as string|null;
  if(!developer&&!branchId)throw new Error("Hesap yönetimi için şubeniz tanımlanmalı.");
  return {db,id:data.user.id,role,developer,branchId};
}
type Actor=Awaited<ReturnType<typeof actor>>;
function checkBranch(ctx:Actor,branchId:string|null){
  const id=cleanBranchId(branchId);
  if(!ctx.developer&&id!==ctx.branchId)throw new Error("Yalnızca kendi şubenizde işlem yapabilirsiniz.");
  return id;
}
function checkRole(ctx:Actor,roleCode:string){
  if(!roleCode||roleCode.length>40)throw new Error("Yetki sınıfı geçersiz.");
  if(!ctx.developer&&!LOCAL_ASSIGNABLE_ROLES[ctx.role]?.has(roleCode))
    throw new Error("Bu yetki sınıfını atama izniniz bulunmuyor.");
}
async function ensureRole(ctx:Actor,roleCode:string) {
  checkRole(ctx,roleCode);
  const {data,error}=await ctx.db.from("roles").select("role_code").eq("role_code",roleCode).maybeSingle();
  if(error||!data)throw new Error("Tanımlı bir rol seçin.");
}
async function getProfile(ctx:Actor,id:string) {
  validId(id);
  const {data,error}=await ctx.db.from("profiles")
    .select("id,role,full_name,email,branch_id,employee_id").eq("id",id).maybeSingle();
  if(error||!data)throw new Error("Web hesabı bulunamadı.");
  if(!ctx.developer) {
    if(data.branch_id!==ctx.branchId)throw new Error("Başka şubeye ait hesap düzenlenemez.");
    if(PROTECTED_ROLES.has(String(data.role)))throw new Error("Yüksek yetkili hesapları yalnızca Developer yönetebilir.");
  }
  return data;
}
async function getEmployee(ctx:Actor,id:string){
  if(!TERMINAL_ID.test(id))throw new Error("Personel ID tam 5 haneli olmalı.");
  const {data,error}=await ctx.db.from("employees")
    .select("id,branch_id,full_name,is_active").eq("id",id).maybeSingle();
  if(error||!data)throw new Error("Personel kaydı bulunamadı.");
  checkBranch(ctx,data.branch_id);
  return data;
}
async function ensureLinkAvailable(ctx:Actor,id:string,branchId:string,excludingId?:string){
  const emp=await getEmployee(ctx,id);
  if(emp.branch_id!==branchId)throw new Error("Bağlanacak personelin şubesi hesap ile aynı olmalı.");
  if(!emp.is_active)throw new Error("Pasif personel web hesabına bağlanamaz.");
  let linked=ctx.db.from("profiles").select("id").eq("employee_id",id);
  if(excludingId)linked=linked.neq("id",excludingId);
  const {data,error}=await linked.limit(1);
  if(error)throw error;
  if(data?.length)throw new Error("Bu personel ID başka bir web hesabına bağlı.");
}
async function generateEmployee(ctx:Actor,branchId:string|null,fullName:string,positionTitle:string) {
  for(let attempt=0;attempt<25;attempt++){
    const id=String(randomInt(10000,100000));
    const {error}=await ctx.db.from("employees").insert({
      id,full_name:fullName,position_title:positionTitle,branch_id:branchId,is_active:true,
    });
    if(!error)return id;
    if(error.code!=="23505")throw new Error("Personel ID oluşturulamadı: "+error.message);
  }
  throw new Error("Benzersiz 5 haneli personel ID oluşturulamadı. Tekrar deneyin.");
}
function invalidate(){revalidatePath("/management/password-settings");revalidatePath("/management/hr/personnel");}

export async function fetchAdminAccounts():Promise<Result<PasswordDashboard>>{
  try {
    const ctx=await actor();
    // Güvenlik: service_role her şeyi okuyabilir ama sorgular sunucuda şubeye daraltılır.
    let profiles=ctx.db.from("profiles")
      .select("id,full_name,email,role,branch_id,employee_id,last_password_change,created_at")
      .order("created_at",{ascending:false}).limit(500);
    let employees=ctx.db.from("employees")
      .select("id,full_name,position_title,is_active,branch_id,created_at")
      .order("created_at",{ascending:false}).limit(1000);
    let branches=ctx.db.from("branches").select("id,name").order("name");
    if(!ctx.developer){
      profiles=profiles.eq("branch_id",ctx.branchId!);
      employees=employees.eq("branch_id",ctx.branchId!);
      branches=branches.eq("id",ctx.branchId!);
    }
    const [a,b,c,roles]=await Promise.all([
      profiles,employees,branches,
      ctx.db.from("roles").select("id,role_code,role_name").order("role_name"),
    ]);
    if(a.error||b.error||c.error||roles.error)
      throw new Error("Hesap listeleri yüklenemedi.");
    // Şube yöneticileri ayrıcalıklı hesapları listelemez. Yetki kontrolü ayrıca mutasyonlarda yapılır.
    const webAccounts=(a.data||[]).filter(row=>ctx.developer||!PROTECTED_ROLES.has(row.role)) as WebAccount[];
    const branchList=(c.data||[]) as AccountBranch[];
    return {success:true,
      isDeveloper:ctx.developer,ownBranchId:ctx.branchId,
      ownBranchName:branchList.find(b=>b.id===ctx.branchId)?.name||(ctx.developer?"Tüm şubeler":"Şubem"),
      currentUserId:ctx.id,webAccounts,terminalAccounts:(b.data||[]) as TerminalAccount[],
      branches:branchList,
      roles:((roles.data||[]) as AccountRole[]).filter(r=>ctx.developer||LOCAL_ASSIGNABLE_ROLES[ctx.role]?.has(r.role_code)),
    };
  }catch(e){return fail(e);}
}
export async function createSystemUser(input:NewWeb):Promise<Result<{userId:string;employeeId:string;temporaryPassword:string}>>{
  let createdEmployeeId:string|null=null;
  let createdAuthId:string|null=null;
  try{
    const ctx=await actor();
    const fullName=cleanName(input.fullName);
    const email=cleanEmail(input.email);
    const branchId=checkBranch(ctx,input.branchId);
    await ensureRole(ctx,input.roleCode);
    const linked=String(input.linkedEmployeeId||"").trim();
    if(linked)await ensureLinkAvailable(ctx,linked,branchId);
    else createdEmployeeId=await generateEmployee(ctx,branchId,fullName,String(input.positionTitle||"Personel").trim().slice(0,90));
    const employeeId=linked||createdEmployeeId!;
    const temporaryPassword=createPassword();
    const {data:created,error:createError}=await ctx.db.auth.admin.createUser({
      email,password:temporaryPassword,email_confirm:true,
      user_metadata:{full_name:fullName},
    });
    if(createError||!created.user)throw new Error("Oturum hesabı oluşturulamadı: "+(createError?.message||"Bilinmeyen hata"));
    createdAuthId=created.user.id;
    const {error:profileError}=await ctx.db.from("profiles").upsert({
      id:createdAuthId,full_name:fullName,email,role:input.roleCode,branch_id:branchId,
      employee_id:employeeId,last_password_change:null,temp_password:null,
    },{onConflict:"id"});
    if(profileError)throw new Error("Web hesabı personel ID'sine bağlanamadı: "+profileError.message);
    invalidate();
    return {success:true,userId:createdAuthId,employeeId,temporaryPassword};
  }catch(e){
    // Yarım kaydı bırakma: yalnızca bu işlemde oluşturulan kimlikler geri alınır.
    if(createdAuthId){try{await adminDb().auth.admin.deleteUser(createdAuthId);}catch{}}
    if(createdEmployeeId){try{await adminDb().from("employees").delete().eq("id",createdEmployeeId);}catch{}}
    return fail(e);
  }
}
export async function createTerminalEmployee(input:{
  fullName:string;positionTitle:string;branchId:string;preferredId?:string;
}):Promise<Result<{employeeId:string}>>{
  try{
    const ctx=await actor();
    const fullName=cleanName(input.fullName);
    const branchId=checkBranch(ctx,input.branchId);
    const position=String(input.positionTitle||"Saha Personeli").trim().slice(0,90);
    let employeeId:string;
    const requested=String(input.preferredId||"").trim();
    if(requested){
      if(!TERMINAL_ID.test(requested))throw new Error("Terminal ID 10000-99999 aralığında 5 hane olmalı.");
      const {error}=await ctx.db.from("employees").insert({
        id:requested,full_name:fullName,position_title:position,branch_id:branchId,is_active:true,
      });
      if(error?.code==="23505")throw new Error("Bu ID başka bir personelde kullanılıyor.");
      if(error)throw error;
      employeeId=requested;
    }else employeeId=await generateEmployee(ctx,branchId,fullName,position);
    invalidate();return {success:true,employeeId};
  }catch(e){return fail(e);}
}
export async function assignWebEmployeeIdentity(userId:string):Promise<Result<{employeeId:string}>>{
  let createdId:string|null=null;
  try{
    const ctx=await actor();
    const profile=await getProfile(ctx,userId);
    if(profile.employee_id)throw new Error("Bu hesaba zaten bir personel ID bağlı.");
    // Global Developer profillerinin branch_id alanı mevcut şemada null olabilir.
    const branchId=profile.branch_id===null&&ctx.developer ? null : checkBranch(ctx,profile.branch_id);
    createdId=await generateEmployee(ctx,branchId,cleanName(profile.full_name||"Web Kullanıcısı"),"Web Hesabı");
    const {data,error}=await ctx.db.from("profiles")
      .update({employee_id:createdId}).eq("id",userId).is("employee_id",null)
      .select("id").maybeSingle();
    if(error||!data)throw new Error("ID bağlanamadı. Hesap başka oturumdan güncellenmiş olabilir.");
    invalidate();return {success:true,employeeId:createdId};
  }catch(e){
    if(createdId){try{await adminDb().from("employees").delete().eq("id",createdId);}catch{}}
    return fail(e);
  }
}
export async function updateSystemUser(input:EditWeb):Promise<Result<{}>>{
  try{
    const ctx=await actor();
    const old=await getProfile(ctx,input.id);
    const fullName=cleanName(input.fullName),email=cleanEmail(input.email);
    const branchId=checkBranch(ctx,input.branchId);
    await ensureRole(ctx,input.role);
    const employeeId=input.linkedEmployeeId===undefined?old.employee_id:(input.linkedEmployeeId||null);
    if(employeeId)await ensureLinkAvailable(ctx,employeeId,branchId,input.id);
    if(!employeeId&&old.employee_id)throw new Error("Mevcut personel bağlantısı silinemez. Önce uygun ID seçin.");
    const {error:authError}=await ctx.db.auth.admin.updateUserById(input.id,{
      email,user_metadata:{full_name:fullName},
    });
    if(authError)throw new Error("Auth hesap bilgisi güncellenemedi: "+authError.message);
    const {error}=await ctx.db.from("profiles").update({
      full_name:fullName,email,role:input.role,branch_id:branchId,employee_id:employeeId,
    }).eq("id",input.id);
    if(error){
      // Auth ile profil tablosu arasında ayrışma olmaması için eski bilgiyi geri yüklemeyi dene.
      await ctx.db.auth.admin.updateUserById(input.id,{
        email:old.email||email,user_metadata:{full_name:old.full_name||fullName},
      });
      throw new Error("Profil güncellemesi yapılamadı: "+error.message);
    }
    invalidate();return {success:true};
  }catch(e){return fail(e);}
}
export async function updateTerminalEmployee(input:EditTerminal):Promise<Result<{}>>{
  try{
    const ctx=await actor();
    const current=await getEmployee(ctx,input.id);
    const branchId=checkBranch(ctx,input.branchId);
    const {data:linked,error:linkedError}=await ctx.db.from("profiles")
      .select("id").eq("employee_id",input.id).limit(1);
    if(linkedError)throw linkedError;
    if(linked?.length&&branchId!==current.branch_id)
      throw new Error("Web hesabına bağlı personelin şubesi önce web hesabından düzenlenmeli.");
    const {error}=await ctx.db.from("employees").update({
      full_name:cleanName(input.fullName),
      position_title:String(input.positionTitle||"Saha Personeli").trim().slice(0,90),
      branch_id:branchId,is_active:Boolean(input.isActive),
    }).eq("id",input.id);
    if(error)throw error;
    invalidate();return {success:true};
  }catch(e){return fail(e);}
}
export async function adminResetPassword(userId:string):Promise<Result<{newPassword:string}>>{
  try{
    const ctx=await actor();await getProfile(ctx,userId);
    if(ctx.id===userId)throw new Error("Kendi parolanızı oturum hesabı sayfasından değiştirin.");
    const newPassword=createPassword();
    const {error}=await ctx.db.auth.admin.updateUserById(userId,{password:newPassword});
    if(error)throw new Error("Şifre değiştirilemedi: "+error.message);
    const {error:profileError}=await ctx.db.from("profiles")
      .update({last_password_change:null,temp_password:null}).eq("id",userId);
    if(profileError)throw new Error("Parola değişti ancak parola durumu güncellenemedi. Lütfen tekrar kontrol edin.");
    invalidate();return {success:true,newPassword};
  }catch(e){return fail(e);}
}
export async function deleteSystemUser(userId:string):Promise<Result<{}>>{
  try{
    const ctx=await actor();await getProfile(ctx,userId);
    if(ctx.id===userId)throw new Error("Kendi hesabınızı silemezsiniz.");
    // Auth silinince profiles FK cascade çalışır. Personel kaydını ve geçmiş hareketlerini silmeyiz.
    const {error}=await ctx.db.auth.admin.deleteUser(userId);
    if(error)throw new Error("Web hesabı silinemedi: "+error.message);
    invalidate();return {success:true};
  }catch(e){return fail(e);}
}
