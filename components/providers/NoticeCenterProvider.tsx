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
import CommunicationCenter from "@/components/providers/CommunicationCenter";
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
  }, []);

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

      {panel && <CommunicationCenter
        initialTab={panel}
        onClose={closeDialog}
        onChanged={() => { void load(true); }}
      />}
    </Context.Provider>
  );
}
