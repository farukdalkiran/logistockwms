// "use client";

// import { useState, useEffect, useCallback } from "react";
// import { supabase } from "@/lib/supabase";
// import { 
//   fetchAdminAccounts, 
//   updateSystemUser, 
//   deleteSystemUser, 
//   adminResetPassword 
// } from "@/app/actions/user";
// import {
//   Search, Network, SmartphoneNfc, Building2, Mail, BriefcaseBusiness,
//   CheckCircle2, Copy, RefreshCw, Edit, Trash2, ShieldCheck,
//   AlertTriangle, X, Save, Activity, ChevronRight, ShieldAlert, KeyRound
// } from "lucide-react";
// import { Button } from "@/components/ui/Button";
// import toast from "react-hot-toast";

// type Branch = { id: string; name: string };

// type WebAccount = {
//   id: string;
//   full_name: string | null;
//   email: string | null;
//   role: string | null;
//   temp_password: string | null;
//   last_password_change: string | null;
//   branch_id: string | null;
//   branches?: { name: string } | null;
// };

// type TerminalAccount = {
//   id: string;
//   full_name: string | null;
//   position_title: string | null;
//   is_active: boolean;
//   branch_id: string | null;
//   branches?: { name: string } | null;
// };

// interface AccountsTableProps { refreshTrigger: number; }

// export default function AccountsTable({ refreshTrigger }: AccountsTableProps) {
//   const [activeTab, setActiveTab] = useState<"web" | "terminal">("web");
//   const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  
//   const [webAccounts, setWebAccounts] = useState<WebAccount[]>([]);
//   const [terminalAccounts, setTerminalAccounts] = useState<TerminalAccount[]>([]);
//   const [systemBranches, setSystemBranches] = useState<Branch[]>([]); // Şube değiştirebilmek için
  
//   const [isLoading, setIsLoading] = useState(true);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [copiedId, setCopiedId] = useState<string | null>(null);
//   const [isProcessing, setIsProcessing] = useState<string | null>(null);

//   const [editingWeb, setEditingWeb] = useState<WebAccount | null>(null);
//   const [editingTerminal, setEditingTerminal] = useState<TerminalAccount | null>(null);

//   // SERVER ACTION İLE RLS BYPASS EDİLEREK TÜM VERİLER ÇEKİLİYOR
//   const loadAccounts = useCallback(async () => {
//     setIsLoading(true);
//     try {
//       const result = await fetchAdminAccounts();
//       if (!result.success) throw new Error(result.error);
      
//       setWebAccounts(result.webAccounts);
//       setTerminalAccounts(result.terminalAccounts);
//       setSystemBranches(result.branches);
//     } catch (error: any) {
//       toast.error("Yönetim Verileri Çekilemedi: " + error.message);
//     } finally {
//       setIsLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadAccounts();
//   }, [loadAccounts, refreshTrigger]);

//   const handleCopy = (text: string, id: string) => {
//     navigator.clipboard.writeText(text);
//     setCopiedId(id);
//     setTimeout(() => setCopiedId(null), 2000);
//     toast.success("Panoya kopyalandı.", { duration: 2000 });
//   };

//   // GERÇEK ŞİFRE SIFIRLAMA (AUTH + PROFILES)
//   const handleResetPassword = async (profileId: string, email: string | null) => {
//     if (!window.confirm(`DİKKAT: ${email || "Bu hesap"} için oturum kapatılacak ve yeni geçici şifre üretilecek. Onaylıyor musunuz?`)) return;
//     setIsProcessing(profileId);
//     try {
//       const result = await adminResetPassword(profileId);
//       if (!result.success) throw new Error(result.error);
      
//       setWebAccounts((prev) => prev.map((acc) => acc.id === profileId ? { ...acc, temp_password: result.newPassword, last_password_change: null } : acc));
      
//       toast.success(
//         <div className="flex flex-col gap-1">
//           <span className="font-bold">Şifre Sıfırlandı!</span>
//           <span className="text-xs">Yeni Şifre: <strong className="font-mono text-[#dc3545]">{result.newPassword}</strong></span>
//         </div>
//       );
//     } catch (error: any) {
//       toast.error("Şifre sıfırlama başarısız: " + error.message);
//     } finally { setIsProcessing(null); }
//   };

//   // WEB HESABI GÜNCELLEME (ŞUBE DAHİL)
//   const handleSaveWebEdit = async () => {
//     if (!editingWeb) return;
//     setIsProcessing("web_save");
//     try {
//       const result = await updateSystemUser({
//         id: editingWeb.id,
//         fullName: editingWeb.full_name || "",
//         email: editingWeb.email || "",
//         role: editingWeb.role || "",
//         branchId: editingWeb.branch_id
//       });
//       if (!result.success) throw new Error(result.error);
      
//       // Local state update (Şube ismini manuel eşle)
//       const updatedBranchName = systemBranches.find(b => b.id === editingWeb.branch_id)?.name || "Merkez";
//       const updatedAccount = { ...editingWeb, branches: { name: updatedBranchName } };
      
//       setWebAccounts((prev) => prev.map((a) => (a.id === editingWeb.id ? updatedAccount : a)));
//       setEditingWeb(null);
//       toast.success("Web hesabı başarıyla güncellendi.");
//     } catch (error: any) { toast.error("Güncelleme Hatası: " + error.message); } finally { setIsProcessing(null); }
//   };

//   // WEB HESABI TAM SİLME (AUTH CASCADE)
//   const handleDeleteWeb = async (id: string, name: string | null) => {
//     if (!window.confirm(`SİSTEM UYARISI: ${name || 'Seçili'} web hesabını SİSTEMDEN TAMAMEN silmek üzeresiniz. Bu işlem geri alınamaz! Devam edilsin mi?`)) return;
//     setIsProcessing(id);
//     try {
//       const result = await deleteSystemUser(id);
//       if (!result.success) throw new Error(result.error);

//       setWebAccounts((prev) => prev.filter((a) => a.id !== id));
//       toast.success("Hesap veritabanından kalıcı olarak silindi.");
//     } catch (error: any) { toast.error("Silme hatası: " + error.message); } finally { setIsProcessing(null); }
//   };

//   const handleSaveTerminalEdit = async () => {
//     if (!editingTerminal) return;
//     setIsProcessing("term_save");
//     try {
//       const { error } = await supabase.from("employees").update({ 
//         full_name: editingTerminal.full_name, 
//         position_title: editingTerminal.position_title, 
//         is_active: editingTerminal.is_active,
//         branch_id: editingTerminal.branch_id
//       }).eq("id", editingTerminal.id);
      
//       if (error) throw error;
      
//       const updatedBranchName = systemBranches.find(b => b.id === editingTerminal.branch_id)?.name || "Atanmamış";
//       const updatedAccount = { ...editingTerminal, branches: { name: updatedBranchName } };

//       setTerminalAccounts((prev) => prev.map((a) => (a.id === editingTerminal.id ? updatedAccount : a)));
//       setEditingTerminal(null);
//       toast.success("Saha terminal kaydı güncellendi.");
//     } catch (error: any) { toast.error("Hata: " + error.message); } finally { setIsProcessing(null); }
//   };

//   const handleDeleteTerminal = async (id: string, name: string | null) => {
//     if (!window.confirm(`DİKKAT: ${name || 'Seçili'} saha personelini silmek istediğinize emin misiniz?`)) return;
//     try {
//       const { error } = await supabase.from("employees").delete().eq("id", id);
//       if (error) throw error;
//       setTerminalAccounts((prev) => prev.filter((a) => a.id !== id));
//       toast.success("Saha terminal kimliği silindi.");
//     } catch (error: any) { toast.error("Silme hatası: " + error.message); }
//   };

//   const getBranchName = (acc: any) => {
//     if (Array.isArray(acc.branches)) return acc.branches[0]?.name || "Merkez / Atanmamış";
//     return acc.branches?.name || "Merkez / Atanmamış";
//   };

//   const currentData = activeTab === "web" ? webAccounts : terminalAccounts;
//   const allBranches = Array.from(new Set(currentData.map(getBranchName))).sort();

//   const filteredData = currentData.filter((acc) => {
//     const fName = (acc.full_name || "Düzenleme Bekleniyor").toLowerCase();
//     const idStr = (acc.id || "").toLowerCase();
//     const email = activeTab === "web" ? ((acc as WebAccount).email || "").toLowerCase() : "";
//     const search = searchTerm.toLowerCase();

//     const matchesSearch = fName.includes(search) || email.includes(search) || idStr.includes(search);
//     const matchesBranch = selectedBranch ? getBranchName(acc) === selectedBranch : true;
    
//     return matchesSearch && matchesBranch;
//   });

//   return (
//     <section className="flex flex-col gap-6 animate-in fade-in duration-300 min-h-[600px]">
//       <div className="flex items-center gap-4 border-b border-slate-200 pb-2">
//         <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-black">3</div>
//         <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Master Yetki Yönetimi</h2>
//       </div>

//       <div className="flex flex-col lg:flex-row gap-6 items-start">
//         {/* SOL DASHBOARD SIDEBAR */}
//         <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0 sticky top-[90px] z-20">
//           <div className="bg-slate-100 p-1 rounded-sm flex border border-slate-200">
//             <button onClick={() => { setActiveTab("web"); setSelectedBranch(null); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm text-xs font-black uppercase tracking-wider transition-all ${activeTab === "web" ? "bg-white text-[#dc3545] shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
//               <Network size={16} /> Web Paneli
//             </button>
//             <button onClick={() => { setActiveTab("terminal"); setSelectedBranch(null); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm text-xs font-black uppercase tracking-wider transition-all ${activeTab === "terminal" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
//               <SmartphoneNfc size={16} /> Terminal ID
//             </button>
//           </div>

//           <div className="bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col overflow-hidden max-h-[500px]">
//             <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-slate-600">
//               <Building2 size={16} />
//               <span className="text-xs font-black uppercase tracking-widest">Şubeye Göre Yönet</span>
//             </div>
//             <div className="flex flex-col overflow-y-auto custom-scrollbar">
//               <button onClick={() => setSelectedBranch(null)} className={`text-left p-3 border-b border-slate-100 transition-all flex items-center justify-between text-sm font-bold ${selectedBranch === null ? "bg-red-50 text-[#dc3545] border-l-4 border-l-[#dc3545]" : "text-slate-700 hover:bg-slate-50 border-l-4 border-l-transparent"}`}>
//                 <span>Tüm Hesaplar</span>
//                 <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{currentData.length}</span>
//               </button>
//               {allBranches.map((branch) => {
//                 const count = currentData.filter((a) => getBranchName(a) === branch).length;
//                 return (
//                   <button key={branch} onClick={() => setSelectedBranch(branch)} className={`text-left p-3 border-b border-slate-100 transition-all flex items-center justify-between text-sm font-bold ${selectedBranch === branch ? "bg-red-50 text-[#dc3545] border-l-4 border-l-[#dc3545]" : "text-slate-700 hover:bg-slate-50 border-l-4 border-l-transparent"}`}>
//                     <span className="truncate pr-2">{branch}</span>
//                     <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedBranch === branch ? "bg-[#dc3545] text-white" : "bg-slate-200 text-slate-600"}`}>{count}</span>
//                   </button>
//                 );
//               })}
//             </div>
//           </div>
//         </div>

//         {/* SAĞ PANEL TABLO */}
//         <div className="flex-1 flex flex-col gap-4 w-full overflow-hidden">
//           <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-sm shadow-sm">
//             <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
//               {activeTab === "web" ? "Sistem Web Hesapları" : "Saha Terminal Yetkileri"}
//               <ChevronRight size={16} className="text-slate-400" />
//               <span className="text-[#dc3545]">{selectedBranch || "Tümü"}</span>
//             </h3>
//             <div className="relative w-full sm:w-72 shrink-0">
//               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
//               <input type="text" placeholder="İsim, Mail veya ID Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 h-10 bg-slate-50 border border-slate-200 rounded-sm text-sm font-bold text-slate-800 focus:border-[#dc3545] focus:bg-white outline-none transition-colors" />
//             </div>
//           </div>

//           <div className="bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col flex-1 overflow-hidden">
//             {isLoading ? (
//               <div className="flex flex-col items-center justify-center p-16 text-slate-400 font-bold">
//                 <Activity size={32} className="animate-spin text-[#dc3545] mb-3" /> Veriler Eşitleniyor...
//               </div>
//             ) : filteredData.length === 0 ? (
//               <div className="flex flex-col items-center justify-center p-16 text-slate-400 font-bold">
//                 <ShieldAlert size={48} className="mb-3 text-slate-200" />
//                 <p>Aradığınız kriterlere uygun WMS hesabı bulunamadı.</p>
//               </div>
//             ) : (
//               <div className="overflow-x-auto">
//                 <table className="w-full text-left text-sm whitespace-nowrap">
//                   <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black tracking-widest text-slate-500">
//                     <tr>
//                       <th className="px-5 py-4">{activeTab === "web" ? "Kullanıcı & İletişim" : "Terminal Kimliği (ID)"}</th>
//                       <th className="px-5 py-4">{activeTab === "web" ? "Yetki & Lokasyon" : "Personel Adı & Şube"}</th>
//                       {activeTab === "web" && <th className="px-5 py-4">Şifre / Güvenlik Durumu</th>}
//                       <th className="px-5 py-4 text-right">Yönetici Aksiyonları</th>
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y divide-slate-100 font-medium">
                    
//                     {/* WEB TABLO */}
//                     {activeTab === "web" && (filteredData as WebAccount[]).map((acc) => {
//                       const isPasswordGizli = !!acc.last_password_change || !acc.temp_password;
//                       return (
//                         <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors group">
//                           <td className="px-5 py-3">
//                             <div className="flex flex-col gap-0.5">
//                               <span className="font-black text-slate-800 text-sm">{acc.full_name || "Tanımsız"}</span>
//                               <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
//                                 <Mail size={10} /> {acc.email || "email_yok"}
//                               </span>
//                             </div>
//                           </td>
//                           <td className="px-5 py-3">
//                             <div className="flex flex-col gap-1 items-start">
//                               <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-sm">{acc.role || "ATANMAMIŞ"}</span>
//                               <span className="text-[10px] text-slate-400 font-bold">{getBranchName(acc)}</span>
//                             </div>
//                           </td>
//                           <td className="px-5 py-3">
//                             {!isPasswordGizli ? (
//                               <div className="flex flex-col gap-1">
//                                 <span className="text-[9px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-sm inline-flex items-center w-max gap-1">
//                                   <AlertTriangle size={10} /> Değiştirilmesi Zorunlu
//                                 </span>
//                                 <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200 w-max select-all">{acc.temp_password}</span>
//                               </div>
//                             ) : (
//                               <div className="flex flex-col gap-0.5">
//                                 <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm inline-flex items-center gap-1 w-max">
//                                   <ShieldCheck size={12} /> Özel Şifre (Gizli)
//                                 </span>
//                                 <span className="text-[10px] text-slate-400 font-mono tracking-widest pl-1">••••••••</span>
//                               </div>
//                             )}
//                           </td>
//                           <td className="px-5 py-3 text-right">
//                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
//                               {!isPasswordGizli && (
//                                 <button onClick={() => handleCopy(`E-Posta: ${acc.email}\nŞifre: ${acc.temp_password}`, acc.id)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-sm border border-slate-300 transition-colors" title="Kopyala">
//                                   {copiedId === acc.id ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
//                                 </button>
//                               )}
//                               <button onClick={() => handleResetPassword(acc.id, acc.email)} disabled={isProcessing === acc.id} className="p-2 bg-red-50 hover:bg-[#dc3545] hover:text-white text-[#dc3545] rounded-sm border border-red-200 transition-colors" title="Şifreyi Zorla Sıfırla">
//                                 {isProcessing === acc.id ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
//                               </button>
//                               <button onClick={() => setEditingWeb(acc)} className="p-2 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-sm border border-blue-200 transition-colors" title="Düzenle / Şube Değiştir">
//                                 <Edit size={14} />
//                               </button>
//                               <button onClick={() => handleDeleteWeb(acc.id, acc.full_name)} disabled={isProcessing === acc.id} className="p-2 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-500 rounded-sm border border-slate-200 transition-colors" title="Hesabı Kalıcı Sil">
//                                 <Trash2 size={14} />
//                               </button>
//                             </div>
//                           </td>
//                         </tr>
//                       );
//                     })}

//                     {/* TERMINAL TABLO */}
//                     {activeTab === "terminal" && (filteredData as TerminalAccount[]).map((acc) => (
//                       <tr key={acc.id} className={`hover:bg-slate-50/80 transition-colors group ${!acc.is_active ? "opacity-50 bg-slate-50" : ""}`}>
//                         <td className="px-5 py-3">
//                           <div className="flex items-center gap-3">
//                             <span className="font-mono text-lg font-black text-[#dc3545] tracking-[0.2em]">{acc.id}</span>
//                             {!acc.is_active && <span className="text-[9px] font-black uppercase bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Pasif</span>}
//                           </div>
//                         </td>
//                         <td className="px-5 py-3">
//                           <div className="flex flex-col gap-0.5">
//                             <span className="font-black text-slate-800 text-sm">{acc.full_name || "Saha Personeli"}</span>
//                             <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
//                               <BriefcaseBusiness size={10} /> {acc.position_title || "Unvan Belirtilmemiş"} • {getBranchName(acc)}
//                             </span>
//                           </div>
//                         </td>
//                         <td className="px-5 py-3 text-right">
//                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
//                             <button onClick={() => handleCopy(`Terminal ID: ${acc.id}\nPersonel: ${acc.full_name}`, acc.id)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-sm border border-slate-300 transition-colors">
//                               {copiedId === acc.id ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
//                             </button>
//                             <button onClick={() => setEditingTerminal(acc)} className="p-2 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-sm border border-blue-200 transition-colors" title="Düzenle / Şube Değiştir">
//                               <Edit size={14} />
//                             </button>
//                             <button onClick={() => handleDeleteTerminal(acc.id, acc.full_name)} className="p-2 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-500 rounded-sm border border-slate-200 transition-colors" title="Kalıcı Sil">
//                               <Trash2 size={14} />
//                             </button>
//                           </div>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* ======================= WEB EDIT MODAL ======================= */}
//       {editingWeb && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
//           <div className="bg-white rounded-sm shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
//             <div className="bg-slate-800 p-4 flex items-center justify-between">
//               <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2"><Edit size={16} className="text-[#dc3545]" /> Web Hesabı Düzenle</h3>
//               <button onClick={() => setEditingWeb(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
//             </div>
//             <div className="p-6 flex flex-col gap-4 font-bold">
//               <div>
//                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Ad Soyad / Kurum Adı</label>
//                 <input type="text" value={editingWeb.full_name || ""} onChange={(e) => setEditingWeb({ ...editingWeb, full_name: e.target.value })} className="w-full px-3 h-10 border border-slate-300 rounded-sm text-sm font-bold focus:border-[#dc3545] outline-none" />
//               </div>
//               <div>
//                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Sisteme Giriş E-Posta</label>
//                 <input type="email" value={editingWeb.email || ""} onChange={(e) => setEditingWeb({ ...editingWeb, email: e.target.value })} className="w-full px-3 h-10 border border-slate-300 rounded-sm text-sm font-bold focus:border-[#dc3545] outline-none" />
//               </div>
//               <div className="grid grid-cols-2 gap-3">
//                 <div>
//                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Bağlı Şube</label>
//                   <select value={editingWeb.branch_id || ""} onChange={(e) => setEditingWeb({ ...editingWeb, branch_id: e.target.value || null })} className="w-full px-3 h-10 border border-slate-300 rounded-sm text-sm font-bold focus:border-[#dc3545] outline-none">
//                     <option value="">Merkez / Atanmamış</option>
//                     {systemBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
//                   </select>
//                 </div>
//                 <div>
//                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Yetki Sınıfı Kodu</label>
//                   <input type="text" value={editingWeb.role || ""} onChange={(e) => setEditingWeb({ ...editingWeb, role: e.target.value })} className="w-full px-3 h-10 border border-slate-300 rounded-sm text-sm font-bold focus:border-[#dc3545] outline-none" />
//                 </div>
//               </div>
//             </div>
//             <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
//               <Button onClick={() => setEditingWeb(null)} className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-sm h-10 px-4 text-xs font-black uppercase">İptal</Button>
//               <Button onClick={handleSaveWebEdit} disabled={isProcessing === "web_save"} className="bg-[#dc3545] hover:bg-red-700 text-white rounded-sm h-10 px-6 text-xs font-black uppercase flex items-center gap-2">
//                 {isProcessing === "web_save" ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Kaydet
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ======================= TERMINAL EDIT MODAL ======================= */}
//       {editingTerminal && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
//           <div className="bg-white rounded-sm shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
//             <div className="bg-slate-800 p-4 flex items-center justify-between">
//               <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2"><Edit size={16} className="text-[#dc3545]" /> Terminal ID Düzenle</h3>
//               <button onClick={() => setEditingTerminal(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
//             </div>
//             <div className="p-6 flex flex-col gap-4 font-bold">
//               <div className="bg-red-50 border border-red-100 p-3 rounded-sm flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <SmartphoneNfc className="text-[#dc3545]" size={20} />
//                   <span className="font-mono text-xl font-black text-[#dc3545] tracking-[0.2em]">{editingTerminal.id}</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <input type="checkbox" id="isActive" checked={editingTerminal.is_active} onChange={(e) => setEditingTerminal({ ...editingTerminal, is_active: e.target.checked })} className="w-4 h-4 accent-[#dc3545] cursor-pointer" />
//                   <label htmlFor="isActive" className="text-xs font-black text-slate-700 cursor-pointer select-none">AKTİF (GİRİŞ İZNİ)</label>
//                 </div>
//               </div>
//               <div>
//                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Gerçek Ad Soyad</label>
//                 <input type="text" value={editingTerminal.full_name || ""} onChange={(e) => setEditingTerminal({ ...editingTerminal, full_name: e.target.value })} className="w-full px-3 h-10 border border-slate-300 rounded-sm text-sm font-bold focus:border-[#dc3545] outline-none" />
//               </div>
//               <div className="grid grid-cols-2 gap-3">
//                 <div>
//                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Görev Şubesi</label>
//                   <select value={editingTerminal.branch_id || ""} onChange={(e) => setEditingTerminal({ ...editingTerminal, branch_id: e.target.value || null })} className="w-full px-3 h-10 border border-slate-300 rounded-sm text-sm font-bold focus:border-[#dc3545] outline-none">
//                     <option value="">Atanmamış</option>
//                     {systemBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
//                   </select>
//                 </div>
//                 <div>
//                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Unvan / Görev</label>
//                   <input type="text" value={editingTerminal.position_title || ""} onChange={(e) => setEditingTerminal({ ...editingTerminal, position_title: e.target.value })} className="w-full px-3 h-10 border border-slate-300 rounded-sm text-sm font-bold focus:border-[#dc3545] outline-none" />
//                 </div>
//               </div>
//             </div>
//             <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
//               <Button onClick={() => setEditingTerminal(null)} className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-sm h-10 px-4 text-xs font-black uppercase">İptal</Button>
//               <Button onClick={handleSaveTerminalEdit} disabled={isProcessing === "term_save"} className="bg-[#dc3545] hover:bg-red-700 text-white rounded-sm h-10 px-6 text-xs font-black uppercase flex items-center gap-2">
//                  {isProcessing === "term_save" ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Kaydet
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </section>
//   );
// }

import React from 'react'

const AccountsTable = () => {
  return (
    <div>AccountsTable</div>
  )
}

export default AccountsTable