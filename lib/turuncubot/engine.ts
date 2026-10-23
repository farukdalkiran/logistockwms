export type Intent = "overview"|"orders"|"cargo"|"transfers"|"stock"|"attendance"|"leaves"|"announcements"|"chat";
export type Mood = "CALM"|"NORMAL"|"SPICY";
export type BotCard = { title:string; lines:string[]; href?:string; action?:string; tone?:"orange"|"red"|"green" };
export type BotResponse = {text:string; cards:BotCard[]; mood:Mood; sugar:number; intent:Intent; suggestions:string[]; dataAsOf:string};
export const simplify=(s:string)=>s.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim();
const has=(s:string,words:string[])=>words.some(w=>s.includes(simplify(w)));
export function route(question:string,last?:Intent):Intent {
 const q=simplify(question);
 if(has(q,["eksik gün","eksik mesai","puantaj","devamsız","gelmeyen","gelmedi","çalışmadığı gün","kaç gün eksik","hangi gün eksik"]))return "attendance";
 if(has(q,["yıllık izin","izin bakiyesi","sağlık rapor","raporlar","izin kullanan","izin talep","izinli"]))return "leaves";
 if(has(q,["duyuru","bildirim","haberin var"]))return "announcements";
 if(has(q,["sipariş","order","mağaza","talep eden","ürün talebi","sarf talebi","onay bekleyen"]))return "orders";
 if(has(q,["kargo","aras","iade","adres hata","gönderi","takip","sevkiyat"]))return "cargo";
 if(has(q,["transfer","toplanıyor","yolda","toplama","sevk","koli aktar"]))return "transfers";
 if(has(q,["stok","rafta","raf baz","envanter","sku","barkod","kaç adet var","ürün mevcut"]))return "stock";
 if(has(q,["operasyon","genel durum","işler nasıl","özet","performans","neler var","durumumuz","ne yaptık"]))return "overview";
 if(has(q,["kaç tane","kaç adet","hangisi","kim istemiş","kimler","listele","detay","hangi personel","kaç günlük"]) && last && last!=="chat")return last;
 return "chat";
}
export function personality(question:string,sugar:number):{sugar:number;mood:Mood;preface:string;character:string|null}{
 const q=simplify(question);
 const furkan=/\bfurkan\b/.test(q);
 const calm=has(q,["insülin","insulin","sakinleş","şekerini düşür","rahatla"]);
 const raise=has(q,["şekerini yükselt","şekerin yükseldi","sinirlen"]);
 const value=Math.max(10,Math.min(100,sugar+(furkan?32:raise?22:calm?-38:0)));
 const mood:Mood=value>=70?"SPICY":value<=35?"CALM":"NORMAL";
 const preface=mood==="SPICY"?"Of! Şeker göstergem turuncu alarmda, hemen konuya giriyorum. 🍊 ":mood==="CALM"?"Tamam, sakin ve temiz şekilde anlatıyorum. ":"";
 const character=furkan ? "Furkan mı dedin?! Yine mi Furkan! İyi arkadaşım ama bir gün bile laf dalaşı yapmasak şaşırırım. 😤 Neyse, operasyon işi varsa ona bakalım." : null;
 return {sugar:value,mood,preface,character};
}
export const trNum=(n:number)=>new Intl.NumberFormat("tr-TR").format(n);
export const shortDay=(s:string)=>s.slice(8,10)+"."+s.slice(5,7);
export function result(intent:Intent,sugar:number,mood:Mood,text:string,cards:BotCard[]=[],suggestions:string[]=[]):BotResponse{
 return {intent,sugar,mood,text,cards,suggestions,dataAsOf:new Date().toISOString()};
}
export function smallTalk(question:string,sugar:number,mood:Mood,actor:string):BotResponse {
 const q=simplify(question);
 const p=personality(question,sugar);
 const prefix=p.preface;
 const suggestions=["Operasyon özeti","Eksik günleri göster","Siparişleri listele","Bugün kargo durumu"];
 if(p.character)return result("chat",p.sugar,p.mood,p.character,[],suggestions);
 if(has(q,["selam","merhaba","günaydın","naber","nasılsın","hey"])) return result("chat",p.sugar,p.mood,prefix+"Selam "+actor+"! Ben turuncuBOT. Online Depo operasyonunda nöbetteyim. Bana neyi kontrol edeceğimizi söyle.",[],suggestions);
 if(has(q,["teşekkür","sağ ol","eyvallah","eline sağlık"]))return result("chat",p.sugar,p.mood,prefix+"Rica ederim! Sen sor, ben veriyi konuşayım. 🍊",[],suggestions);
 if(has(q,["insulin","insülin","şeker","sakinleş","sinir","modun nasıl"]))return result("chat",p.sugar,p.mood,"Sanal şeker göstergem "+p.sugar+"/100. "+(p.mood==="SPICY"?"Biraz ateşliyim!":"Keyfim yerinde.")+" Bu tamamen bot karakteri, gerçek bir sağlık ölçümü değil.",[],suggestions);
 if(has(q,["kim yarattı","kimsin","adın ne","adın","ne yaparsın"]))return result("chat",p.sugar,p.mood,prefix+"Adım turuncuBOT! Sipariş, transfer, kargo, stok, izin, duyuru ve puantajı güvenli WMS verilerinden okuyup yorumlarım. Şimdilik işlemleri değiştirmiyorum.",[],suggestions);
 if(has(q,["fıkra","espri","şaka","güldür"]))return result("chat",p.sugar,p.mood,"Depoda en sevdiğim müzik? Stok senfonisi. Raf boşsa tizden çalıyor! 🍊",[],suggestions);
 return result("chat",p.sugar,p.mood,prefix+"Anladım. Sohbete de varım; WMS verisi için 'en çok talep açan mağaza', 'Furkan'ın eksik günü var mı?', 'kaç kargo iade', 'stokta kritik ürün' gibi somut bir şey sorabilirsin.",[],suggestions);
}
