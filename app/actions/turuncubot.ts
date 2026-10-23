"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { personality, route, result, shortDay, simplify, smallTalk, trNum, type BotCard, type BotResponse, type Intent } from "@/lib/turuncubot/engine";

type OrderInfo={id:string;code:string;branch:string;requester:string;quantity:number;lines:number;createdAt:string};
type NewsInfo={id:string;title:string;body:string;category:string;starts_at:string;action_href:string|null;action_label:string|null;read:boolean;show_missing_attendance:boolean};
const HR_ROLES=new Set(["Developer","Admin","ADMNWH","HR"]);
const DELIVERY_URL="/management/orders/approvals";
const DEPOT_LABEL="Online Depo";
const fmtDay=(d:Date)=>{
 const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const part=(s:string)=>p.find(x=>x.type===s)?.value||"";
 return part("year")+"-"+part("month")+"-"+part("day");
};
const isoForDay=(d:string)=>d+"T00:00:00+03:00";
function nextDay(d:string){const t=Date.parse(d+"T12:00:00Z")+86400000;return new Date(t).toISOString().slice(0,10);}
function period(){
 const today=fmtDay(new Date()), first=today.slice(0,7)+"-01";
 const yesterday=fmtDay(new Date(Date.now()-86400000));
 return {today,first,yesterday,through:yesterday<first?null:yesterday};
}
function adminClient(){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("WMS sunucu bağlantı anahtarı eksik.");
 return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
}
async function ctx(){
 const client=await createClient();
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)throw new Error("Oturumunuzu yenileyin.");
 const db=adminClient();
 const {data:profile,error:profileError}=await db.from("profiles").select("id,branch_id,full_name,role").eq("id",user.id).single();
 if(profileError||!profile?.branch_id)throw new Error("WMS şube yetkiniz bulunamadı.");
 const {data:branch,error:branchError}=await db.from("branches").select("name,type").eq("id",profile.branch_id).single();
 if(branchError||!branch||simplify(branch.name)!=="online depo"||simplify(branch.type)!=="depo")throw new Error("turuncuBOT yalnızca ONLINE DEPO'ya bağlı hesaplara açıktır.");
 return {db,actor:user.id,branchId:String(profile.branch_id),role:String(profile.role||""),name:String(profile.full_name||"Depo ekibi"),canHr:HR_ROLES.has(profile.role)};
}
async function orderDigest(db:ReturnType<typeof adminClient>){
 const {data:orders,error}=await db.from("orders").select("id,order_code,branch_id,requested_by,status,created_at,branches!orders_branch_id_fkey(name)")
   .eq("status","PENDING").order("created_at",{ascending:false}).limit(80);
 if(error)throw new Error("Sipariş kayıtları okunamadı: "+error.message);
 const list=orders||[];
 if(!list.length)return [] as OrderInfo[];
 const ids=list.map(x=>x.id);
 const peopleIds=[...new Set(list.map(x=>x.requested_by).filter((x):x is string=>!!x))];
 const [rItems,rNames]=await Promise.all([
   db.from("order_items").select("order_id,requested_qty").in("order_id",ids).limit(1000),
   peopleIds.length?db.from("profiles").select("id,full_name").in("id",peopleIds):Promise.resolve({data:[],error:null})
 ]);
 if(rItems.error||rNames.error)throw new Error("Sipariş detayı alınamadı.");
 const qty=new Map<string,{lines:number;quantity:number}>();
 for(const item of rItems.data||[]){const r=qty.get(item.order_id)||{lines:0,quantity:0};r.lines++;r.quantity+=Number(item.requested_qty||0);qty.set(item.order_id,r);}
 const names=new Map((rNames.data||[]).map(x=>[x.id,x.full_name]));
 return list.filter(o=>qty.has(o.id)).map(o=>{
   const b=Array.isArray(o.branches)?o.branches[0]:(o.branches as {name?:string}|null);
   return {id:o.id,code:o.order_code,branch:b?.name||"Mağaza",requester:names.get(o.requested_by)||"Mağaza yetkilisi",quantity:qty.get(o.id)?.quantity||0,lines:qty.get(o.id)?.lines||0,createdAt:o.created_at};
 });
}
async function announcements(db:ReturnType<typeof adminClient>,actor:string){
 const time=new Date().toISOString();
 const [{data:list,error},{data:reads}]=await Promise.all([
   db.from("bot_announcements").select("id,title,body,category,starts_at,action_href,action_label,show_missing_attendance").eq("is_active",true).lte("starts_at",time).gt("ends_at",time).order("priority",{ascending:false}).limit(25),
   db.from("bot_announcement_reads").select("announcement_id").eq("user_id",actor)
 ]);
 if(error)throw new Error("Duyuru servisine ulaşılamadı.");
 const seen=new Set((reads||[]).map(r=>r.announcement_id));
 return (list||[]).map(a=>({...a,read:seen.has(a.id)})) as NewsInfo[];
}
type EmployeeGap={id:string;name:string;days:string[];pending:string[];halfDays:string[]};
async function missingAttendance(db:ReturnType<typeof adminClient>,branchId:string){
 const {first,through,today}=period(),ym=first.slice(0,7);
 if(!through)return {month:ym,through:today,rows:[] as EmployeeGap[],note:"Bu ay henüz tamamlanmış gün yok."};
 const next=nextDay(through);
 const [{data:staff,error:staffError},{data:att,error:attError},{data:leaves,error:leaveError},{data:requests,error:requestsError},{data:rosters,error:rostersError},{data:exceptions,error:exceptionsError}]=await Promise.all([
   db.from("employees").select("id,full_name,employment_date").eq("is_active",true).eq("branch_id",branchId).limit(500),
   db.from("attendance").select("employee_id,check_in_time,status,check_out_time").eq("branch_id",branchId).gte("check_in_time",isoForDay(first)).lt("check_in_time",isoForDay(next)).limit(5000),
   db.from("leave_requests").select("employee_id,start_date,end_date,selected_dates,is_half_day,status,leave_type").eq("branch_id",branchId).eq("status","APPROVED").lte("start_date",through).gte("end_date",first).limit(3000),
   db.from("attendance_requests").select("employee_id,request_date,status").eq("branch_id",branchId).in("status",["APPROVED","PENDING"]).gte("request_date",first).lte("request_date",through).limit(3000),
   db.from("employee_shifts").select("employee_id,shift_date,is_off_day").gte("shift_date",first).lte("shift_date",through).limit(3000),
   db.from("bot_calendar_exceptions").select("day,branch_id,is_workday").gte("day",first).lte("day",through).limit(500)
 ]);
 if(staffError||attError||leaveError||requestsError||rostersError||exceptionsError)throw new Error("Puantaj, izin ve vardiya kayıtları birlikte okunamadı.");
 const present=new Set((att||[]).filter(x=>x.check_in_time).map(x=>x.employee_id+"|"+fmtDay(new Date(x.check_in_time))));
 const approved=new Set<string>(),pending=new Set<string>(),half=new Set<string>();
 for(const row of leaves||[]){
   const selected=Array.isArray(row.selected_dates)?row.selected_dates.filter((x):x is string=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)):[];
   let days=selected;
   if(!days.length){
     days=[];let cur=row.start_date;
     for(let k=0;k<40&&cur<=row.end_date;k++,cur=nextDay(cur))days.push(cur);
   }
   for(const day of days){
     const key=row.employee_id+"|"+day;
     if(row.is_half_day)half.add(key);else approved.add(key);
   }
 }
 for(const x of requests||[]){const key=x.employee_id+"|"+x.request_date;if(x.status==="APPROVED")approved.add(key);else pending.add(key);}
 const roster=new Map((rosters||[]).map(x=>[x.employee_id+"|"+x.shift_date,!!x.is_off_day]));
 const calendar=new Map((exceptions||[]).map(x=>[(x.branch_id||"global")+"|"+x.day,x.is_workday]));
 const rows:EmployeeGap[]=[];
 for(const e of staff||[]){
   const missing:string[]=[],review:string[]=[],partTime:string[]=[];
   let date=first;
   while(date<=through){
     if(e.employment_date&&e.employment_date>date){date=nextDay(date);continue;}
     const day=new Date(date+"T12:00:00Z").getUTCDay(),key=e.id+"|"+date;
     const shift=roster.get(key),special=calendar.get(branchId+"|"+date)??calendar.get("global|"+date);
     const expected=special!==undefined?special:shift!==undefined?!shift:day>0&&day<6;
     if(expected&&!present.has(key)&&!approved.has(key)){
       if(pending.has(key))review.push(date);
       else if(half.has(key))partTime.push(date);
       else missing.push(date);
     }
     date=nextDay(date);
   }
   if(missing.length||review.length||partTime.length)rows.push({id:e.id,name:e.full_name,days:missing,pending:review,halfDays:partTime});
 }
 rows.sort((a,b)=>b.days.length-a.days.length||a.name.localeCompare(b.name,"tr"));
 return {month:ym,through,rows,note:"Tamamlanmış günler incelendi. Hafta içi çalışma varsayıldı; kayıtlı vardiyalar, resmî tatiller, onaylı izinler ve talepler hesaba katıldı. Yarım günler ve istisnai vardiyalar İK tarafından doğrulanmalı."};
}
async function cargoStats(db:ReturnType<typeof adminClient>){
 const day=fmtDay(new Date()),after=nextDay(day);
 const {data,error}=await db.from("cargo_records").select("id,is_returned,missing_address,item_count,created_at")
 .gte("created_at",isoForDay(day)).lt("created_at",isoForDay(after)).limit(10000);
 if(error)throw new Error("Kargo istatistiği alınamadı.");
 const stats={count:0,ok:0,returned:0,errors:0,items:0};
 for(const x of data||[]){stats.count++;stats.items+=Number(x.item_count||0);if(x.missing_address)stats.errors++;else if(x.is_returned)stats.returned++;else stats.ok++;}
 return stats;
}
async function transferStats(db:ReturnType<typeof adminClient>){
 const {data,error}=await db.from("transfers").select("transfer_code,status,created_at").order("created_at",{ascending:false}).limit(500);
 if(error)throw new Error("Transfer kayıtları alınamadı.");
 const counts={waiting:0,picking:0,road:0,completed:0,other:0};
 for(const x of data||[]){
 const s=simplify(String(x.status||""));
 if(s.includes("bekli"))counts.waiting++;
 else if(s.includes("toplan"))counts.picking++;
 else if(s.includes("yolda"))counts.road++;
 else if(s.includes("tamam"))counts.completed++;
 else counts.other++;
 }
 return {counts,recent:(data||[]).slice(0,5)};
}
async function stockStats(db:ReturnType<typeof adminClient>,branchId:string,search:string){
 const {data,error}=await db.from("stocks").select("product_id,quantity").eq("branch_id",branchId).limit(4000);
 if(error)throw new Error("Depo stokları alınamadı.");
 const totals=new Map<string,number>();
 for(const s of data||[])if(s.product_id)totals.set(s.product_id,(totals.get(s.product_id)||0)+Number(s.quantity||0));
 const minimum=[...totals.entries()].sort((a,b)=>a[1]-b[1]).slice(0,25);
 const target=simplify(search);
 const isSpecific=/(sku|barkod|stokta|ürün|urunun|lego|adet var)/.test(target)&&!/kritik|azalan|dusuk|risk/.test(target);
 // Query only a short candidate list for critical products; specific SKU/name matching is performed separately.
 const ids=minimum.map(x=>x[0]);
 let matches: {id:string;name:string;sku:string|null;barcode:string|null}[]=[];
 if(isSpecific){
   const cleaned=search.replace(/(stokta|kaç|adet|var|kaldı|ürün|sku|barkod|nedir|durumu|ne|bu|için)/gi," ").trim().slice(0,60);
   if(cleaned.length>=3){
     const escaped=cleaned.replace(/[%_]/g,"");
     const {data:p}=await db.from("products").select("id,name,sku,barcode").or("name.ilike.%"+escaped+"%,sku.ilike.%"+escaped+"%,barcode.ilike.%"+escaped+"%").limit(12);
     matches=p||[];
   }
 }
 const requiredIds=[...new Set([...ids,...matches.map(x=>x.id)])];
 const {data:products,error:prodErr}=requiredIds.length?await db.from("products").select("id,name,sku,barcode").in("id",requiredIds):{data:[],error:null};
 if(prodErr)throw new Error("Ürün isimleri alınamadı.");
 const details=new Map((products||[]).map(x=>[x.id,x]));
 const low=minimum.slice(0,10).map(([id,quantity])=>({id,name:details.get(id)?.name||"Ürün",sku:details.get(id)?.sku||"",quantity}));
 const specific=matches.map(x=>({id:x.id,name:x.name,sku:x.sku||"",quantity:totals.get(x.id)||0}));
 return {totals:{sku:totals.size,units:[...totals.values()].reduce((a,b)=>a+b,0)},low,specific};
}
async function leaveStats(db:ReturnType<typeof adminClient>,branchId:string){
 const {data,error}=await db.from("leave_requests").select("employee_id,leave_type,status,start_date,end_date,requested_days").eq("branch_id",branchId).order("created_at",{ascending:false}).limit(300);
 if(error)throw new Error("İzin talepleri okunamadı.");
 const today=fmtDay(new Date());
 const active=(data||[]).filter(x=>x.status==="APPROVED"&&x.start_date<=today&&x.end_date>=today);
 const byType=new Map<string,number>();
 for(const x of active)byType.set(x.leave_type,(byType.get(x.leave_type)||0)+1);
 return {pending:(data||[]).filter(x=>x.status==="PENDING").length,active:active.length,types:[...byType]};
}
export async function getTuruncuFeed(){
 const s=await ctx();
 const [orders,news,state]=await Promise.all([
  orderDigest(s.db),announcements(s.db,s.actor),s.db.from("bot_user_states").select("sugar_level,last_intent").eq("user_id",s.actor).maybeSingle()
 ]);
 return {orders,announcements:news,canAttendance:s.canHr,canOrders:true,sugar:state.data?.sugar_level??42,lastIntent:state.data?.last_intent||"chat"};
}
export async function acknowledgeTuruncuAnnouncement(id:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error("Duyuru kimliği geçersiz");
 const s=await ctx();
 const {data:announcement}=await s.db.from("bot_announcements").select("id").eq("id",id).eq("is_active",true).maybeSingle();
 if(!announcement)throw new Error("Duyuru bulunamadı.");
 const {error}=await s.db.from("bot_announcement_reads").upsert({announcement_id:id,user_id:s.actor,read_at:new Date().toISOString()},{onConflict:"announcement_id,user_id"});
 if(error)throw error;
 return {ok:true};
}
export async function getTuruncuAttendance(){
 const s=await ctx();if(!s.canHr)throw new Error("Puantaj ayrıntıları yalnızca yetkili depo yöneticilerince görüntülenebilir.");
 return missingAttendance(s.db,s.branchId);
}
async function freeConversation(question:string,sugar:number,name:string){
 const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_GENERATIVE_AI_API_KEY;
 if(!key)return null;
 try{
   const client=new GoogleGenerativeAI(key);
   const model=client.getGenerativeModel({model:process.env.TURUNCUBOT_GEMINI_MODEL||"gemini-2.5-flash",systemInstruction:"Sen turuncuBOT isimli Türkçe konuşan, arkadaş canlısı ve esprili kurmaca depo asistanısın. Ara sıra şeker göstergesi yükselince hafif huysuz olursun, Furkan iyi arkadaşın ama tatlı atışırsınız. Kimseye hakaret etme. Gerçek şeker seviyesi ya da insülin kullanımı iddia etme. Veritabanına ve özel operasyon bilgilerine erişimin yok; sayı, kişi, veri ve stok hakkında tahmin uydurma. Kullanıcı operasyon sorduysa mevcut yetkili WMS ekranlarından istemesini söyle. Kısa ve doğal Türkçe cevap ver."});
   const answer=await model.generateContent(question.slice(0,500));
   return answer.response.text().slice(0,1100);
 }catch{return null;}
}
export async function askTuruncuBot(question:string,lastIntent?:Intent):Promise<BotResponse>{
 const s=await ctx();
 if(typeof question!=="string"||!question.trim()||question.length>500)throw new Error("Mesajınız 1–500 karakter olmalıdır.");
 const msg=question.trim();
 const {data:state}=await s.db.from("bot_user_states").select("sugar_level,last_intent").eq("user_id",s.actor).maybeSingle();
 const sugar=state?.sugar_level??42;
 const detected=route(msg,lastIntent&&lastIntent!=="chat"?lastIntent:(state?.last_intent as Intent|undefined));
 const p=personality(msg,sugar),q=simplify(msg);
 let answer:BotResponse;
 const suggestions=["Gelen siparişler","Eksik günleri söyle","Kargo özeti","Transferleri göster","Kritik stoklar"];
 const pref=p.preface;
 if(detected==="attendance"){
  if(!s.canHr)answer=result(detected,p.sugar,p.mood,"Puantaj ve personel eksik günleri yönetici yetkisi gerektiriyor. Bu hesapla kişisel devamsızlık verilerini gösteremem.",[],suggestions);
  else{
   const report=await missingAttendance(s.db,s.branchId);
   const words=q.split(" ");
   const rows=report.rows.filter(r=>{
     if(!/(personel|isim|ad|kim|furkan|goster|bul)/.test(q))return true;
     const name=simplify(r.name);
     const individual=report.rows.some(x=>q.includes(simplify(x.name))||q.split(" ").some(w=>w.length>=4&&simplify(x.name).split(" ").includes(w)));
     return !individual||q.includes(name)||words.some(w=>w.length>=4&&name.split(" ").includes(w));
   });
   const cards=rows.slice(0,20).map(r=>({title:r.name,lines:[
     r.days.length+" eksik gün"+(r.days.length?": "+r.days.map(shortDay).join(", "):""),
     ...(r.pending.length?["Onay bekleyen: "+r.pending.map(shortDay).join(", ")]:[]),
     ...(r.halfDays.length?["Yarım gün inceleme: "+r.halfDays.map(shortDay).join(", ")]:[])
   ],href:"/management/hr/reports",action:"Puantajı Aç",tone:r.days.length?"red":"orange"})) as BotCard[];
   const missingTotal=rows.reduce((n,r)=>n+r.days.length,0);
   answer=result(detected,p.sugar,p.mood,pref+report.month+" dönemi için "+report.through+" gününe kadar "+rows.length+" personelde toplam "+missingTotal+" şüpheli eksik gün tespit ettim. "+(rows.length?"Tarihleri aşağıda tek tek yazdım. ":"Eksik gün kaydı görünmüyor. ")+report.note,cards,["Furkan'ın eksik günleri","İzin durumları","Duyuruları göster"]);
  }
 }else if(detected==="orders"){
   const orders=await orderDigest(s.db);
   const qty=orders.reduce((n,o)=>n+o.quantity,0);
   const totals=new Map<string,{orders:number;units:number}>();
   orders.forEach(x=>{const v=totals.get(x.branch)||{orders:0,units:0};v.orders++;v.units+=x.quantity;totals.set(x.branch,v);});
   const top=[...totals].sort((a,b)=>b[1].units-a[1].units);
   const cards=orders.slice(0,12).map(x=>({title:x.code+" · "+x.branch,lines:["Talep eden: "+x.requester,"Ürün adedi: "+x.quantity+" | Kalem: "+x.lines],href:DELIVERY_URL,action:"Talebi İncele",tone:"orange"})) as BotCard[];
   const focus=/(en cok|hangi magaza|magazalar)/.test(q);
   answer=result(detected,p.sugar,p.mood,pref+orders.length+" onay bekleyen mağaza siparişi ve toplam "+trNum(qty)+" ürün talebi var. "+(top.length?"En çok adet isteyen mağaza: "+top[0][0]+" ("+top[0][1].units+" adet). ":"")+(focus?"Mağaza dağılımı: "+top.slice(0,5).map(x=>x[0]+" "+x[1].units+" adet").join("; ")+".":""),cards,["Hangi mağaza en çok sipariş verdi?","Bugün kargo","Transfer özeti"]);
 }else if(detected==="cargo"){
   const v=await cargoStats(s.db);
   answer=result(detected,p.sugar,p.mood,pref+"Bugün "+trNum(v.count)+" kargo kaydı var: "+trNum(v.ok)+" başarılı, "+trNum(v.returned)+" iade, "+trNum(v.errors)+" hatalı/eksik adres. İşlenen ürün toplamı "+trNum(v.items)+".",[{title:"Bugünkü Kargo",lines:["Toplam: "+v.count,"Başarılı: "+v.ok,"İade: "+v.returned,"Eksik adres: "+v.errors,"Ürün: "+v.items],tone:"green"}],["İadeler kaç tane?","Siparişleri göster","Transferler ne durumda?"]);
 }else if(detected==="transfers"){
   const d=await transferStats(s.db),v=d.counts;
   answer=result(detected,p.sugar,p.mood,pref+"Transfer havuzunda "+v.waiting+" bekliyor, "+v.picking+" toplanıyor, "+v.road+" yolda, "+v.completed+" tamamlandı.",d.recent.map(x=>({title:x.transfer_code,lines:["Durum: "+x.status],tone:"orange"})),["Yolda kaç transfer var?","Siparişler","Stok durumu"]);
 }else if(detected==="stock"){
   const d=await stockStats(s.db,s.branchId,msg);
   const source=d.specific.length?d.specific:d.low;
   answer=result(detected,p.sugar,p.mood,pref+"ONLINE DEPO raf stokları toplandı: "+trNum(d.totals.sku)+" farklı ürün, toplam "+trNum(d.totals.units)+" adet. "+(d.specific.length?"Aradığın ürünleri ayrıca eşleştirdim.":"En düşük stoklu ürünler aşağıda."),source.map(x=>({title:x.name,lines:["SKU: "+(x.sku||"—"),"Toplam raf stoğu: "+trNum(x.quantity)],href:"/management/inventory/view",action:"Stok Panelini Aç",tone:x.quantity<=3?"red":"orange"})),["En az stoklu ürünler","Sipariş özeti","Genel operasyon"]);
 }else if(detected==="leaves"){
   if(!s.canHr)answer=result(detected,p.sugar,p.mood,"Personel izin ayrıntıları yönetici yetkisi gerektiriyor.",[],suggestions);
   else{
    const d=await leaveStats(s.db,s.branchId);
    answer=result(detected,p.sugar,p.mood,pref+"ONLINE DEPO'da "+d.pending+" izin talebi onay bekliyor. Bugün "+d.active+" onaylı aktif izin/rapor kaydı var.",d.types.map(([type,n])=>({title:type,lines:[n+" aktif kişi"]})),["Eksik günleri kontrol et","Mesai raporları","Duyurular"]);
   }
 }else if(detected==="announcements"){
   const d=await announcements(s.db,s.actor);
   answer=result(detected,p.sugar,p.mood,pref+(d.length?d.length+" aktif duyuru var.":"Şu anda yayında aktif duyuru yok."),d.map(x=>({title:x.title,lines:[x.body],href:x.action_href||undefined,action:x.action_label||"Duyuruyu Aç"})),["Mesai eksikleri","Gelen siparişler"]);
 }else if(detected==="overview"){
   const [o,c,t,st,n]=await Promise.all([orderDigest(s.db),cargoStats(s.db),transferStats(s.db),stockStats(s.db,s.branchId,""),announcements(s.db,s.actor)]);
   const v=t.counts;
   const summary="Şu an "+o.length+" onay bekleyen sipariş, bugün "+c.count+" kargo ("+c.returned+" iade, "+c.errors+" eksik adres), "+(v.waiting+v.picking+v.road)+" açık transfer, "+st.totals.sku+" stoklu SKU ve "+n.length+" aktif duyuru var.";
   answer=result(detected,p.sugar,p.mood,pref+summary,[
    {title:"Sipariş",lines:[o.length+" bekleyen"],href:DELIVERY_URL,action:"Siparişleri Aç"},
    {title:"Kargo",lines:[c.count+" günlük kayıt",c.returned+" iade, "+c.errors+" hata"]},
    {title:"Transferler",lines:[v.waiting+" bekliyor",v.picking+" toplanıyor",v.road+" yolda"]},
    {title:"Stok",lines:[trNum(st.totals.units)+" adet",trNum(st.totals.sku)+" SKU"],href:"/management/inventory/view",action:"Stokları Aç"}
   ],suggestions);
 }else{
   answer=smallTalk(msg,p.sugar,p.mood,s.name);
   if(answer.text.includes("Anladım. Sohbete de varım")){
     const ai=await freeConversation(msg,p.sugar,s.name);
     if(ai)answer={...answer,text:ai};
   }
 }
 // State is fictional and per user; never read or modify employee medical records.
 const {error:stateError}=await s.db.from("bot_user_states").upsert({user_id:s.actor,sugar_level:answer.sugar,last_intent:answer.intent,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(stateError)throw new Error("Bot oturum durumu kaydedilemedi.");
 return answer;
}
