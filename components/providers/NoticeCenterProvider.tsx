"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type FormEvent, type ReactNode,
} from "react";
import {
  Bell, BellRing, ClipboardCheck, Clock3, Headset, ImagePlus,
  Loader2, Megaphone, Plus, RefreshCw, Send, ShieldCheck, X,
} from "lucide-react";
import { useWms } from "@/components/providers/WmsSessionProvider";
import {
  acknowledgeWmsAnnouncement,
  getNoticeCenterSnapshot,
  getSupportTickets,
  publishWmsAnnouncement,
  setSupportTicketStatus,
  setWmsAnnouncementActive,
  submitSupportTicket,
  type SupportCategory,
  type SupportStatus,
  type SupportTicket,
  type WmsAnnouncement,
} from "@/app/actions/notice-center";

type Panel = "support" | "announcements" | null;
type NoticeCtx = {
  isDeveloper: boolean;
  ticketCount: number;
  unreadCount: number;
  openSupport: () => void;
  openAnnouncements: () => void;
};
const Context = createContext<NoticeCtx | null>(null);
const CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: "GENERAL", label: "Genel destek" },
  { value: "TECHNICAL", label: "Teknik sorun" },
  { value: "ORDERS", label: "Ürün / sarf siparişi" },
  { value: "STOCK", label: "Stok / raf" },
  { value: "TRANSFER", label: "Transfer / sayım" },
  { value: "ATTENDANCE", label: "Puantaj / mesai" },
  { value: "CARGO", label: "Kargo" },
];
const LABELS: Record<SupportStatus, string> = {
  OPEN: "Açık", IN_PROGRESS: "İnceleniyor", COMPLETED: "Tamamlandı",
};
const STATUS_COLORS: Record<SupportStatus, string> = {
  OPEN: "bg-red-50 text-red-700 border-red-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
function dateText(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function useNoticeCenter() {
  const value = useContext(Context);
  if (!value) throw new Error("Destek ve duyuru merkezi başlatılmadı.");
  return value;
}

/** One snapshot on app mount and at most one refresh per hour in an active tab.
 * There is intentionally NO Realtime subscription or 15s/30s polling. */
export function NoticeCenterProvider({ children }: { children: ReactNode }) {
  const { userId } = useWms();
  const [developer, setDeveloper] = useState(false);
  const [announcements, setAnnouncements] = useState<WmsAnnouncement[]>([]);
  const [branches, setBranches] = useState<{id:string;name:string}[]>([]);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [unreadIds, setUnreadIds] = useState<string[]>([]);
  const [ticketCount, setTicketCount] = useState(0);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [popup, setPopup] = useState<WmsAnnouncement | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [status, setStatus] = useState<SupportStatus>("IN_PROGRESS");
  const [developerNote, setDeveloperNote] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("GENERAL");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lastFetchRef = useRef(0);
  const dismissedRef = useRef(new Set<string>());
  const aliveRef = useRef(true);
  const panelRef = useRef<Panel>(null);
  const popupRef = useRef<WmsAnnouncement | null>(null);
  const inflightRef = useRef(false);

  useEffect(() => {
    panelRef.current = panel;
    popupRef.current = popup;
  }, [panel, popup]);

  const load = useCallback(async (force = false) => {
    if (!userId || inflightRef.current) return;
    if (!force && Date.now() - lastFetchRef.current < 60 * 60 * 1000) return;
    lastFetchRef.current = Date.now();
    inflightRef.current = true;
    try {
      const result = await getNoticeCenterSnapshot();
      if (!aliveRef.current) return;
      if (!result.ok) return; // Other WMS features keep running if notices are unavailable.
      const data = result.data;
      setDeveloper(data.developer);
      setAnnouncements(data.announcements);
      setBranches(data.branches);
      setUnreadIds(data.unreadIds);
      setTicketCount(data.openTicketCount);
      // Don't interrupt an already open dialog or another announcement.
      if (!popupRef.current && !panelRef.current) {
        const next = data.announcements.find(
          (a) => data.unreadIds.includes(a.id) && !dismissedRef.current.has(a.id),
        );
        if (next) { popupRef.current = next; setPopup(next); }
      }
    } finally { inflightRef.current = false; }
  }, [userId]);

  useEffect(() => {
    aliveRef.current = true;
    lastFetchRef.current = 0;
    dismissedRef.current.clear();
    if (userId) void load();
    return () => { aliveRef.current = false; };
  }, [userId, load]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [userId, load]);

  const loadTickets = useCallback(async () => {
    setTicketLoading(true);
    try {
      const response = await getSupportTickets();
      if (!response.ok) { setError(response.error); return; }
      setTickets(response.data);
      setSelectedTicket((old) => old
        ? response.data.find(t => t.id === old.id) ?? null
        : null);
    } finally { setTicketLoading(false); }
  }, []);

  const openSupport = useCallback(() => {
    setPanel("support");
    setError("");
    setNotice("");
    setShowComposer(false);
    setSelectedTicket(null);
    void loadTickets();
  }, [loadTickets]);

  const openAnnouncements = useCallback(() => {
    setPanel("announcements");
    setError("");
    setNotice("");
    setShowComposer(false);
    void load(true);
  }, [load]);

  const closeDialog = () => {
    setPanel(null);
    setSelectedTicket(null);
    setShowComposer(false);
    setError("");
    setNotice("");
  };

  const nextUnread = (excluding: string) =>
    announcements.find(a =>
      a.id !== excluding && unreadIds.includes(a.id) && !dismissedRef.current.has(a.id),
    ) ?? null;

  const dismissPopup = (markAsRead: boolean) => {
    if (!popup) return;
    const id = popup.id;
    dismissedRef.current.add(id);
    const next = nextUnread(id);
    popupRef.current = next;
    setPopup(next);
    if (markAsRead) {
      setUnreadIds(ids => ids.filter(x => x !== id));
      void acknowledgeWmsAnnouncement(id).then(res => {
        if (!res.ok) {
          // Keep the unread badge if storage fails so the user can retry.
          setUnreadIds(ids => ids.includes(id) ? ids : [...ids, id]);
        }
      });
    }
  };

  const submitTicket = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const result = await submitSupportTicket({ category, subject, description });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setSubject("");
    setDescription("");
    setCategory("GENERAL");
    setNotice("Destek talebiniz oluşturuldu.");
    await loadTickets();
  };

  const changeStatus = async (next: SupportStatus) => {
    if (!selectedTicket || busy) return;
    setBusy(true);
    setError("");
    const result = await setSupportTicketStatus(selectedTicket.id, next, developerNote);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setNotice("Destek talebi güncellendi.");
    await Promise.all([loadTickets(), load(true)]);
  };

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setStatus(ticket.status);
    setDeveloperNote(ticket.developer_note || "");
    setError("");
    setNotice("");
  };

  const publish = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const form = e.currentTarget;
    const payload = new FormData(form);
    payload.set("target_branch_id", targetBranchId);
    const response = await publishWmsAnnouncement(payload);
    setBusy(false);
    if (!response.ok) { setError(response.error); return; }
    setShowComposer(false);
    setTargetBranchId("");
    setNotice("Duyuru yayınlandı. Açık oturumlar en geç sonraki saatlik kontrolde görecek.");
    await load(true);
  };

  const archive = async (announcement: WmsAnnouncement) => {
    if (busy) return;
    setBusy(true);
    const response = await setWmsAnnouncementActive(announcement.id, !announcement.is_active);
    setBusy(false);
    if (!response.ok) { setError(response.error); return; }
    setNotice(announcement.is_active ? "Duyuru yayından kaldırıldı." : "Duyuru yeniden yayınlandı.");
    await load(true);
  };

  const currentUnread = unreadIds.filter(id =>
    announcements.some(a => a.id === id && a.is_active),
  );
  return (
    <Context.Provider value={{
      isDeveloper: developer,
      ticketCount,
      unreadCount: currentUnread.length,
      openSupport,
      openAnnouncements,
    }}>
      {children}

      {popup && !panel && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-[3px]" role="presentation">
          <section role="dialog" aria-modal="true" aria-label="Yeni duyuru" className="w-full max-w-xl overflow-hidden rounded-[5px] border border-slate-700 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-700 bg-[#101b2f] px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="rounded-[5px] bg-red-600 p-2"><Megaphone size={19}/></span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-red-300">LogiStock • Duyuru</p>
                  <h2 className="mt-0.5 text-[17px] font-black">Yeni operasyon duyurusu</h2>
                </div>
              </div>
              <button type="button" onClick={() => dismissPopup(false)} className="rounded-[5px] p-2 text-slate-300 hover:bg-white/10" title="Şimdilik kapat"><X size={19}/></button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">
              {popup.image_url && (
                // External image domains are not configurable at runtime via next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={popup.image_url} alt="Duyuru görseli" className="mb-5 max-h-64 w-full rounded-[5px] border border-slate-200 object-contain" />
              )}
              <h3 className="text-xl font-black leading-snug text-slate-900">{popup.title}</h3>
              <p className="mt-2 text-[11px] font-bold text-slate-500">{dateText(popup.published_at)}</p>
              <p className="mt-5 whitespace-pre-wrap break-words text-[14px] leading-7 text-slate-700">{popup.body}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <span className="text-[11px] text-slate-500">{currentUnread.length} okunmamış duyuru</span>
              <button type="button" onClick={() => dismissPopup(true)}
                className="rounded-[5px] bg-[#dc3545] px-5 py-2.5 text-xs font-black text-white hover:bg-[#bf2b3d]">
                Okudum, devam et
              </button>
            </div>
          </section>
        </div>
      )}

      {panel && (
        <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-slate-950/75 p-2 sm:p-5 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label={panel === "support" ? "Destek merkezi" : "Duyuru merkezi"}
            className="flex max-h-[94vh] min-h-[440px] w-full max-w-5xl flex-col overflow-hidden rounded-[5px] border border-slate-700 bg-white shadow-2xl">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#0f1b2e] px-4 py-4 text-white sm:px-6">
              <div className="flex items-center gap-3">
                <span className="rounded-[5px] bg-[#dc3545] p-2">{panel === "support" ? <Headset size={21}/> : <Megaphone size={21}/>}</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">LogiStock / Operasyon Merkezi</p>
                  <h2 className="text-lg font-black">{panel === "support" ? (developer ? "Destek Talepleri" : "Destek Merkezi") : "Duyurular"}</h2>
                </div>
              </div>
              <button type="button" onClick={closeDialog} className="rounded-[5px] border border-white/10 p-2 text-white hover:bg-white/10"><X size={19}/></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
              {error && <div role="alert" className="mb-4 rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div>}
              {notice && <div role="status" className="mb-4 rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{notice}</div>}

              {panel === "support" && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900">{developer ? "Gelen talepler" : "Taleplerim"}</h3>
                      <button type="button" onClick={() => void loadTickets()} aria-label="Talepleri yenile" className="rounded border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900"><RefreshCw size={15}/></button>
                    </div>
                    <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                      {ticketLoading && <div className="flex items-center gap-2 p-3 text-xs text-slate-500"><Loader2 size={14} className="animate-spin"/> Yükleniyor...</div>}
                      {!ticketLoading && tickets.length === 0 && <p className="rounded-[5px] border border-dashed border-slate-300 bg-white p-5 text-xs text-slate-500">Henüz destek talebi bulunmuyor.</p>}
                      {tickets.map(ticket => (
                        <button type="button" key={ticket.id} onClick={() => openTicket(ticket)}
                          className={`w-full rounded-[5px] border bg-white p-3 text-left transition hover:border-[#dc3545] ${selectedTicket?.id === ticket.id ? "border-[#dc3545] shadow-sm" : "border-slate-200"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate text-[12px] font-black text-slate-900">{ticket.subject}</span>
                            <span className={`shrink-0 rounded border px-1.5 py-1 text-[9px] font-extrabold ${STATUS_COLORS[ticket.status]}`}>{LABELS[ticket.status]}</span>
                          </div>
                          {developer && <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{ticket.requester_name}</p>}
                          <p className="mt-2 text-[10px] text-slate-400">{dateText(ticket.created_at)}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    {selectedTicket ? (
                      <div className="rounded-[5px] border border-slate-200 bg-white p-4 sm:p-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <h3 className="text-[16px] font-black text-slate-900">{selectedTicket.subject}</h3>
                          <button onClick={() => setSelectedTicket(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Detaydan çık"><X size={16}/></button>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500">{selectedTicket.requester_name} · {dateText(selectedTicket.created_at)}</p>
                        <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{selectedTicket.description}</p>
                        {selectedTicket.developer_note && !developer && (
                          <div className="mt-5 rounded-[5px] border border-blue-200 bg-blue-50 p-3 text-xs leading-6 text-blue-900"><b>Destek yanıtı:</b> {selectedTicket.developer_note}</div>
                        )}
                        {developer && (
                          <div className="mt-6 space-y-3 border-t border-slate-200 pt-4">
                            <label className="block text-[11px] font-extrabold text-slate-600">Durum</label>
                            <select value={status} onChange={e => setStatus(e.target.value as SupportStatus)} className="w-full rounded-[5px] border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800">
                              {Object.entries(LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <label className="block text-[11px] font-extrabold text-slate-600">Yanıt / Çözüm notu</label>
                            <textarea rows={4} maxLength={3000} value={developerNote} onChange={e => setDeveloperNote(e.target.value)}
                              className="w-full resize-y rounded-[5px] border border-slate-300 px-3 py-2.5 text-xs text-slate-800" placeholder="Talebe açıklama ekleyin..."/>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" disabled={busy} onClick={() => void changeStatus(status)} className="rounded-[5px] border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">Değişiklikleri kaydet</button>
                              <button type="button" disabled={busy} onClick={() => void changeStatus("COMPLETED")} className="inline-flex items-center gap-1.5 rounded-[5px] bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"><ClipboardCheck size={14}/> Tamamlandı işaretle</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : developer ? (
                      <div className="flex min-h-64 flex-col items-center justify-center rounded-[5px] border border-dashed border-slate-300 bg-white px-5 text-center">
                        <ShieldCheck size={29} className="text-slate-400"/>
                        <h3 className="mt-3 text-sm font-extrabold text-slate-800">İncelemek için talep seçin</h3>
                        <p className="mt-2 max-w-sm text-xs leading-6 text-slate-500">Talebi inceleyebilir, yanıt yazabilir ve tamamlandı olarak işaretleyebilirsiniz.</p>
                      </div>
                    ) : (
                      <form onSubmit={submitTicket} className="space-y-4 rounded-[5px] border border-slate-200 bg-white p-4 sm:p-5">
                        <div className="mb-4">
                          <h3 className="text-sm font-black text-slate-900">Yeni destek talebi</h3>
                          <p className="mt-1 text-xs text-slate-500">Sorununuz operasyon destek ekibine iletilir.</p>
                        </div>
                        <label className="block text-[11px] font-extrabold text-slate-700">Kategori</label>
                        <select value={category} onChange={e => setCategory(e.target.value as SupportCategory)}
                          className="w-full rounded-[5px] border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-800">
                          {CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                        <label className="block text-[11px] font-extrabold text-slate-700">Konu başlığı</label>
                        <input required minLength={5} maxLength={140} value={subject} onChange={e => setSubject(e.target.value)}
                          className="w-full rounded-[5px] border border-slate-300 px-3 py-2.5 text-xs text-slate-900" placeholder="Örn. Transfer barkod okutma sorunu"/>
                        <label className="block text-[11px] font-extrabold text-slate-700">Açıklama</label>
                        <textarea required minLength={10} maxLength={5000} rows={5} value={description} onChange={e => setDescription(e.target.value)}
                          className="w-full rounded-[5px] border border-slate-300 px-3 py-2.5 text-xs text-slate-900" placeholder="Sorunu ve yaptığınız işlemi açıklayın..."/>
                        <button disabled={busy} type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-[5px] bg-[#dc3545] px-4 py-3 text-xs font-black text-white hover:bg-[#bd2c3d] disabled:opacity-50">
                          {busy ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>} Destek talebini gönder
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {panel === "announcements" && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900">Operasyon duyuruları</h3>
                      <p className="mt-1 text-xs text-slate-500">Yayınlanan duyurular kullanıcı girişinde ve saatlik düşük trafikli kontrolde görüntülenir.</p>
                    </div>
                    {developer && (
                      <button onClick={() => setShowComposer(v => !v)} className="inline-flex items-center gap-2 rounded-[5px] bg-[#dc3545] px-4 py-2.5 text-xs font-black text-white">
                        <Plus size={15}/> {showComposer ? "Duyurulara dön" : "Yeni duyuru"}
                      </button>
                    )}
                  </div>
                  {developer && showComposer && (
                    <form onSubmit={publish} className="space-y-4 rounded-[5px] border border-slate-300 bg-white p-4 shadow-sm sm:p-6">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-sm font-black text-slate-900"><Megaphone size={17} className="text-[#dc3545]"/> Duyuru oluştur</div>
                      <div className="rounded-[5px] border border-slate-200 bg-slate-50 p-4">
                        <label htmlFor="announcement-target" className="mb-2 block text-[11px] font-extrabold uppercase tracking-wide text-slate-700">Hedef kitle</label>
                        <select id="announcement-target" value={targetBranchId} onChange={e => setTargetBranchId(e.target.value)} className="w-full rounded-[5px] border border-slate-300 bg-white px-3 py-3 text-xs font-semibold text-slate-800">
                          <option value="">Tüm şubeler • Genel duyuru</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <p className="mt-2 text-[11px] leading-5 text-slate-500">{targetBranchId ? "Duyuru yalnızca seçilen şubeye bağlı kullanıcılara gösterilir." : "Duyuru bütün şubelerdeki kullanıcılara gösterilir."}</p>
                      </div>
                      <label className="block text-[11px] font-extrabold text-slate-700">Başlık</label>
                      <input name="title" required minLength={5} maxLength={150} className="w-full rounded-[5px] border border-slate-300 p-3 text-xs text-slate-900" placeholder="Duyuru başlığı"/>
                      <label className="block text-[11px] font-extrabold text-slate-700">Metin</label>
                      <textarea name="body" required minLength={5} maxLength={6000} rows={5} className="w-full rounded-[5px] border border-slate-300 p-3 text-xs text-slate-900" placeholder="Duyuru metnini yazın..."/>
                      <label className="flex items-center gap-2 text-[11px] font-extrabold text-slate-700"><ImagePlus size={16}/> Görsel (isteğe bağlı; JPG / PNG / WEBP, en fazla 3 MB)</label>
                      <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full rounded-[5px] border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"/>
                      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-[5px] bg-[#dc3545] px-5 py-3 text-xs font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Duyuruyu yayınla</button>
                    </form>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    {announcements.length === 0 && <p className="rounded-[5px] border border-dashed border-slate-300 bg-white p-5 text-xs text-slate-500">Henüz duyuru bulunmuyor.</p>}
                    {announcements.map(a => (
                      <article key={a.id} className="overflow-hidden rounded-[5px] border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                        {a.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image_url} alt="Duyuru" className="h-44 w-full border-b border-slate-100 object-contain"/>
                        )}
                        <div className="space-y-3 p-5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-black text-slate-900">{a.title}</h4>
                            <span className={`shrink-0 rounded border px-2 py-1 text-[9px] font-extrabold ${a.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                              {a.is_active ? "Yayında" : "Arşiv"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500"><span>{dateText(a.published_at)}</span><span className="rounded-[5px] border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">{a.target_branch_id ? (branches.find(b => b.id === a.target_branch_id)?.name ?? "Şubeye özel") : "Tüm şubeler"}</span></div>
                          <p className="whitespace-pre-wrap break-words text-[12px] leading-6 text-slate-600">{a.body}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            {currentUnread.includes(a.id) ? (
                              <button type="button" onClick={() => void acknowledgeWmsAnnouncement(a.id).then(result => {
                                if (result.ok) setUnreadIds(ids => ids.filter(id => id !== a.id));
                              })} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#dc3545]">
                                <BellRing size={13}/> Okundu işaretle
                              </button>
                            ) : <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Clock3 size={13}/> Duyuru</span>}
                            {developer && (
                              <button disabled={busy} onClick={() => void archive(a)} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-700 disabled:opacity-50">{a.is_active ? "Yayından kaldır" : "Yeniden yayınla"}</button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Context.Provider>
  );
}
