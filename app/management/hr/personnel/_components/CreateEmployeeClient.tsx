"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { createEmployee, deleteEmployee } from "@/app/actions/employee";
import { Logo } from "@/components/ui/Logo";

interface Branch {
  id: string;
  name: string;
  type: string;
}

interface Employee {
  id: string;
  full_name: string;
  position_title: string;
  branch_id: string;
  branches?: { name: string };
  is_active: boolean;
}

export default function CreateEmployeeClient({
  branches = [],
  initialEmployees = [],
  isDeveloper = false,
}: {
  branches: Branch[];
  initialEmployees: Employee[];
  isDeveloper?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [activeCard, setActiveCard] = useState<Employee | null>(null);

  const [positionSelect, setPositionSelect] = useState("Depo Personeli");
  const [customPosition, setCustomPosition] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    branch_id: branches?.length > 0 ? branches[0].id : "",
    custom_id: "",
  });

  const capitalizeWords = (str: string) => {
    return str
      .toLocaleLowerCase("tr-TR")
      .split(" ")
      .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1))
      .join(" ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isDeveloper && formData.custom_id.trim() !== "") {
      const isIdExists = employees.some((emp) => emp.id === formData.custom_id.trim());
      if (isIdExists) {
        alert("HATA: Bu Terminal ID sistemde zaten kullanımda! Lütfen benzersiz bir ID girin veya boş bırakarak sistemin üretmesine izin verin.");
        return;
      }
    }

    setLoading(true);

    const finalPosition =
      positionSelect === "Diğer" ? customPosition : positionSelect;

    if (!finalPosition.trim()) {
      alert("Lütfen geçerli bir ünvan girin.");
      setLoading(false);
      return;
    }

    try {
      const payload: any = {
        full_name: capitalizeWords(formData.full_name),
        position_title: capitalizeWords(finalPosition),
        branch_id: formData.branch_id,
      };

      if (isDeveloper && formData.custom_id.trim() !== "") {
        payload.id = formData.custom_id.trim();
      }

      const newEmp = await createEmployee(payload);

      const empWithBranch = {
        ...newEmp,
        branches: {
          name: branches.find((b) => b.id === newEmp.branch_id)?.name || "",
        },
      };

      setEmployees([empWithBranch, ...employees]);
      setActiveCard(empWithBranch);

      setFormData({
        full_name: "",
        branch_id: branches?.length > 0 ? branches[0].id : "",
        custom_id: "",
      });
      setPositionSelect("Depo Personeli");
      setCustomPosition("");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`ID: ${id} numaralı personeli silmek istediğinize emin misiniz?`)) return;

    try {
      await deleteEmployee(id);
      setEmployees(employees.filter((e) => e.id !== id));
      if (activeCard?.id === id) setActiveCard(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const downloadCardAsPNG = async () => {
    const cardElement = document.getElementById("employee-id-card");
    if (!cardElement || !activeCard) return;

    try {
      const dataUrl = await toPng(cardElement, {
        quality: 1,
        pixelRatio: 3, // Yüksek kalite için scale benzeri özellik
        backgroundColor: "#ffffff",
        style: {
          margin: '0',
          transform: 'none'
        }
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `LogiStock_YakaKarti_${activeCard.full_name.replace(/\s+/g, "_")}_${activeCard.id}.png`;
      link.click();
    } catch (err) {
      console.error("Kart oluşturulurken hata:", err);
      alert("Kart çıktısı alınırken bir hata oluştu.");
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full bg-gray-50/50 min-h-screen pb-10">
      {/* ÜST BÖLÜM: FORM VE KART ÖNİZLEME */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* SOL: OLUŞTURMA FORMU VE BİLGİ KARTLARI */}
        <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Form Alanı */}
          <div className="bg-white p-6 md:p-8 border border-gray-200  shadow-sm md:col-span-2">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-3 border-b border-gray-100 pb-4 mb-6 tracking-wide uppercase">
              <span className="w-1.5 h-5 bg-red-600 rounded-full inline-block"></span>
              Yeni Personel ve Terminal Kaydı
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Ahmet Yılmaz"
                    className="w-full px-4 py-3 border border-gray-300  focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none font-bold text-slate-900 bg-gray-50/50 transition-all text-sm"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Şube / Lokasyon
                  </label>
                  <select
                    className="w-full px-4 py-3 border border-gray-300  focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none font-bold text-slate-900 bg-gray-50/50 disabled:bg-gray-200 transition-all text-sm appearance-none"
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    disabled={branches.length === 0}
                  >
                    {branches.length === 0 ? (
                      <option value="">YÜKLENİYOR...</option>
                    ) : (
                      branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Ünvan Seçimi
                  </label>
                  <select
                    className="w-full px-4 py-3 border border-gray-300  focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none font-bold text-slate-900 bg-gray-50/50 transition-all text-sm appearance-none"
                    value={positionSelect}
                    onChange={(e) => setPositionSelect(e.target.value)}
                  >
                    <option value="Depo Personeli">Depo Personeli</option>
                    <option value="Mağaza Personeli">Mağaza Personeli</option>
                    <option value="Mağaza Supervisor">Mağaza Supervisor</option>
                    <option value="Diğer">Diğer (Elle Giriş)</option>
                  </select>
                </div>

                {isDeveloper && (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <label className="block text-xs font-black text-indigo-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      ÖZEL TERMİNAL ID <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] rounded-sm">OPSİYONEL</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Sistem Üretsin (Boş Bırakın)"
                      className="w-full px-4 py-3 border border-indigo-300  focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-indigo-900 bg-indigo-50/30 transition-all text-sm placeholder:text-indigo-300 placeholder:font-medium"
                      value={formData.custom_id}
                      onChange={(e) => setFormData({ ...formData, custom_id: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {positionSelect === "Diğer" && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-black text-red-600 uppercase tracking-widest mb-1.5">
                    Özel Ünvan Girişi
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Forklift Operatörü"
                    className="w-full px-4 py-3 border border-red-300  focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none font-bold text-slate-900 bg-red-50/30 transition-all text-sm"
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                  />
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading || branches.length === 0}
                  className=" bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-black py-3.5 px-4  transition-all uppercase tracking-widest text-sm disabled:opacity-50 disabled:active:scale-100 shadow-md shadow-red-600/20"
                >
                  {loading ? "SİSTEME İŞLENİYOR..." : "KAYDET VE KART OLUŞTUR"}
                </button>
              </div>
            </form>
          </div>

          {/* Bilgi Kartları Grubu */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 p-5  shadow-sm border border-slate-800">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Sistem Protokolü
              </h4>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Terminal ID kodları PostgreSQL çekirdeğinde benzersiz (Unique) olarak üretilir. Barkod hareketleri bu ID üzerinden loglanır.
              </p>
            </div>
            
            <div className="bg-white p-5  shadow-sm border border-gray-200">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Güvenlik Politikası
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Kart üzerindeki QR kodlar Level-H hata düzeltme seviyesine sahiptir. Cihaz ekranlarından dahi %100 doğrulukla okunabilir.
              </p>
            </div>

            <div className="bg-white p-5  shadow-sm border border-gray-200">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Baskı Standartları
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Çıktılar, endüstriyel kart yazıcılar için optimize edilmiş yüksek çözünürlüklü .PNG formatında, kayıpsız olarak indirilir.
              </p>
            </div>
          </div>
        </div>

        {/* SAĞ: ÖNİZLEME VE KART ÇIKTISI */}
        <div className="xl:col-span-4 bg-white p-6 border border-gray-200  shadow-sm flex flex-col items-center justify-center min-h-[550px]">
          <h3 className="w-full text-center text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Canlı Kart Önizlemesi</h3>
          
          {activeCard ? (
            <div className="flex flex-col items-center gap-6 w-full animate-in zoom-in duration-300">
              
              {/* KART ALANI - html-to-image için Katı Blok Düzeni */}
              <div
                id="employee-id-card"
                style={{
                  width: "320px",
                  height: "500px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  // Flex veya absolute kullanmıyoruz. Blok seviyesinde ilerliyoruz.
                }}
              >
                {/* Header (Top) */}
                <div
                  style={{
                    width: "100%",
                    height: "80px",
                    backgroundColor: "#0f172a",
                    borderBottom: "4px solid #dc3545",
                    boxSizing: "border-box",
                    textAlign: "center",
                    paddingTop: "24px" // Logoyu dikey hizalamak için padding
                  }}
                >
                  <div style={{ display: "inline-block", verticalAlign: "bottom" }}>
                    <div style={{ color: "#ffffff", display: "inline-block" }}>
                      <Logo variant="white" className="text-[28px] leading-none" />
                    </div>
                    <span
                      style={{
                        color: "#fff",
                        fontWeight: 900,
                        fontSize: "14px",
                        letterSpacing: "0px",
                        marginLeft: "6px",
                        display: "inline-block",
                        verticalAlign: "bottom",
                        paddingBottom: "4px",
                      }}
                    >
                      WMS
                    </span>
                  </div>
                </div>

                {/* Body (Middle) */}
                <div
                  style={{
                    width: "100%",
                    height: "300px",
                    backgroundColor: "#ffffff",
                    boxSizing: "border-box",
                    paddingTop: "20px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      padding: "10px",
                      border: "2px solid #e2e8f0",
                      borderRadius: "12px",
                      backgroundColor: "#ffffff",
                      marginBottom: "20px",
                    }}
                  >
                    <QRCodeSVG value={activeCard.id} size={140} level="H" fgColor="#0f172a" bgColor="#ffffff" />
                  </div>

                  <h2
                    style={{
                      margin: "0 0 8px 0",
                      color: "#0f172a",
                      fontSize: "22px",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      lineHeight: "24px",
                      wordBreak: "break-word",
                      padding: "0 20px",
                    }}
                  >
                    {activeCard.full_name}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      color: "#dc3545",
                      fontSize: "13px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      lineHeight: "14px"
                    }}
                  >
                    {activeCard.position_title}
                  </p>
                </div>

                {/* Footer (Bottom) */}
                <div
                  style={{
                    width: "100%",
                    height: "120px",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Lokasyon */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderTop: "2px solid #e2e8f0",
                      height: "60px",
                      boxSizing: "border-box",
                      textAlign: "center",
                      paddingTop: "12px"
                    }}
                  >
                    <div
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "10px",
                        color: "#64748b",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        lineHeight: "10px"
                      }}
                    >
                      LOKASYON
                    </div>
                    <div
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        color: "#0f172a",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        wordBreak: "break-word",
                        padding: "0 12px",
                        lineHeight: "16px"
                      }}
                    >
                      {activeCard.branches?.name}
                    </div>
                  </div>

                  {/* ID */}
                  <div
                    style={{
                      backgroundColor: "#DC3545",
                      height: "60px",
                      width: "100%",
                      boxSizing: "border-box",
                      textAlign: "center",
                      paddingTop: "16px" // Metinleri görsel olarak ortalamak için padding
                    }}
                  >
                    <span
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontSize: "12px",
                        fontWeight: 800,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        marginRight: "8px",
                        verticalAlign: "middle"
                      }}
                    >
                      ID:
                    </span>
                    <span
                      style={{
                        color: "#ffffff",
                        fontSize: "26px",
                        fontWeight: 900,
                        letterSpacing: "2px",
                        fontFamily: "monospace",
                        verticalAlign: "middle",
                        lineHeight: "26px"
                      }}
                    >
                      {activeCard.id}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={downloadCardAsPNG}
                className="w-[320px] bg-slate-900 flex items-center justify-center gap-2 text-white font-black py-3.5  hover:bg-black transition-all text-xs uppercase tracking-widest shadow-lg shadow-slate-900/20 active:scale-[0.98]"
              >
                YÜKSEK KALİTE (.PNG) İNDİR
              </button>
            </div>
          ) : (
            <div className="text-center flex flex-col items-center justify-center h-[400px]">
              <div className="w-20 h-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl opacity-40">🪪</span>
              </div>
              <p className="font-black text-slate-700 text-sm uppercase tracking-widest">KART SEÇİLMEDİ</p>
              <p className="text-[11px] font-medium mt-2 text-slate-400 max-w-[200px] leading-relaxed">
                Önizleme oluşturmak için sol taraftan kayıt yapın veya tablodan seçim yapın.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ALT BÖLÜM: GELİŞMİŞ TABLO */}
      <div className="bg-white border border-gray-200  shadow-sm overflow-hidden w-full">
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900  flex items-center justify-center text-white font-black shadow-sm">
              <span className="text-sm">🗃️</span>
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">
                Aktif Terminal Personelleri
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Sistemde yetkilendirilmiş güncel çalışan listesi</p>
            </div>
          </div>
          <span className="bg-indigo-50 text-indigo-700 text-[10px] px-3 py-1.5 rounded-full font-black tracking-widest border border-indigo-100">
            {employees.length} AKTİF KAYIT
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-900 whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200 text-[10px] text-slate-500 uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">TERMİNAL ID</th>
                <th className="px-6 py-4">AD SOYAD</th>
                <th className="px-6 py-4">ÜNVAN BİLGİSİ</th>
                <th className="px-6 py-4">LOKASYON</th>
                <th className="px-6 py-4 text-right">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="inline-flex flex-col items-center justify-center text-slate-400">
                      <span className="text-2xl mb-2">🔍</span>
                      <span className="text-xs font-bold uppercase tracking-widest">Kayıt Bulunamadı</span>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-3">
                      <span className="font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-gray-200 text-[11px] tracking-widest shadow-sm">
                        {emp.id}
                      </span>
                    </td>

                    <td className="px-6 py-3 font-bold text-slate-900 text-sm">
                      {emp.full_name}
                    </td>

                    <td className="px-6 py-3">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                        emp.position_title.includes("Supervisor") || emp.position_title.includes("Yönetici")
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : emp.position_title.includes("Depo")
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}>
                        {emp.position_title}
                      </span>
                    </td>

                    <td className="px-6 py-3 font-bold text-slate-500 uppercase text-[11px]">
                      {emp.branches?.name}
                    </td>

                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setActiveCard(emp)}
                          className="text-[10px] font-black px-4 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors uppercase tracking-widest shadow-sm"
                        >
                          YAZDIR
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="text-[10px] font-black px-4 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-md hover:bg-red-600 hover:text-white transition-colors uppercase tracking-widest"
                        >
                          SİL
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}