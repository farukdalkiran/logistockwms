"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, BellOff, ClipboardList, Volume2, X } from "lucide-react";
import { useWms } from "@/components/providers/WmsSessionProvider";
import { getApprovalOrders } from "@/app/actions/order-approvals";
import { supabase } from "@/lib/supabase";
import type { Filters, OrderRow } from "@/lib/order-approvals/types";

const QUERY: Filters = {
  search: "", status: "ALL", kind: "ALL", branch: "",
  from: "", to: "", sort: "newest", page: 1, pageSize: 50,
};
const SOUND_KEY = "wms:orders:sound:v1";
const SEEN_KEY = "wms:orders:seen:v1:";
const POLL_MS = 15000;
const MAX_SEEN = 500;

type OrderAlert = { order: OrderRow; count: number };
type Metrics = { pending: number; preparing: number; ready_to_ship: number };
type State = {
  orders: OrderRow[];
  metrics: Metrics;
  loading: boolean;
  refreshing: boolean;
  canRead: boolean;
  error: string | null;
  lastUpdated: string | null;
  soundEnabled: boolean;
  audioUnlocked: boolean;
  refresh: () => void;
  toggleSound: () => void;
  unlockSound: () => void;
  testSound: () => void;
};
const Context = createContext<State | null>(null);

export function useOrderNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error("Sipariş bildirim sağlayıcısı bulunamadı.");
  return value;
}

function readSeen(user: string): { exists: boolean; ids: string[] } {
  try {
    const stored = localStorage.getItem(SEEN_KEY + user);
    if (stored === null) return { exists: false, ids: [] };
    const parsed: unknown = JSON.parse(stored);
    return {
      exists: true,
      ids: Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string").slice(-MAX_SEEN)
        : [],
    };
  } catch {
    return { exists: false, ids: [] };
  }
}
function writeSeen(user: string, ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY + user, JSON.stringify(ids.slice(-MAX_SEEN)));
  } catch {
    // Storage disabled; the live panel still works.
  }
}

export function OrderNotificationProvider({ children }: { children: ReactNode }) {
  const { userId, role } = useWms();
  const pathname = usePathname();
  const terminal = pathname === "/terminal" || pathname.startsWith("/terminal/");
  const eligible = Boolean(userId && !terminal && ["ADMIN", "DEVELOPER", "ADMNWH"].includes((role || "").toUpperCase()));
  const [desktop, setDesktop] = useState(false);
  const audioAllowed = eligible && desktop;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ pending: 0, preparing: 0, ready_to_ship: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canRead, setCanRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [alert, setAlert] = useState<OrderAlert | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(true);
  const busyRef = useRef(false);
  const activeUserRef = useRef(userId);
  const initialRef = useRef(true);

  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);

  const unlock = useCallback(async () => {
    if (!audioAllowed) return false;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      if (audioRef.current.state !== "running") await audioRef.current.resume();
      const ok = audioRef.current.state === "running";
      setAudioUnlocked(ok);
      return ok;
    } catch {
      setAudioUnlocked(false);
      return false;
    }
  }, [audioAllowed]);

  const sound = useCallback(async () => {
    // Browser gesture restriction cannot be bypassed.
    if (!await unlock()) return;
    const ctx = audioRef.current;
    if (!ctx) return;
    const start = ctx.currentTime + 0.025;
    [880, 1174, 880, 1318].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + i * 0.22;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.45, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.2);
    });
  }, [unlock, audioAllowed]);

  useEffect(() => {
    try {
      const enabled = localStorage.getItem(SOUND_KEY) !== "false";
      soundRef.current = enabled;
      setSoundEnabled(enabled);
    } catch {}
    return () => { void audioRef.current?.close(); audioRef.current = null; };
  }, []);

  useEffect(() => {
    if (!audioAllowed || !soundEnabled || audioUnlocked) return;
    const action = () => { void unlock(); };
    document.addEventListener("pointerdown", action, { once: true });
    document.addEventListener("keydown", action, { once: true });
    return () => {
      document.removeEventListener("pointerdown", action);
      document.removeEventListener("keydown", action);
    };
  }, [audioAllowed, soundEnabled, audioUnlocked, unlock]);

  useEffect(() => {
    activeUserRef.current = userId;
    initialRef.current = true;
    setOrders([]);
    setMetrics({ pending: 0, preparing: 0, ready_to_ship: 0 });
    setCanRead(false);
    setError(null);
    setLastUpdated(null);
    setAlert(null);
  }, [userId]);

  const load = useCallback(async () => {
    if (!eligible || !userId || busyRef.current) return;
    busyRef.current = true;
    if (initialRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      const result = await getApprovalOrders(QUERY);
      if (activeUserRef.current !== userId) return;
      if (!result.ok) {
        setError(result.error);
        setCanRead(false);
        return;
      }
      const rows = Array.isArray(result.data.rows) ? result.data.rows : [];
      setOrders(rows);
      setMetrics({
        pending: result.data.metrics?.pending ?? rows.filter((x) => x.status === "PENDING").length,
        preparing: result.data.metrics?.preparing ?? rows.filter((x) => x.status === "PREPARING").length,
        ready_to_ship: result.data.metrics?.ready_to_ship ?? rows.filter((x) => x.status === "READY_TO_SHIP").length,
      });
      setCanRead(true);
      setError(null);
      setLastUpdated(result.data.updatedAt || new Date().toISOString());
      const previous = readSeen(userId);
      const known = new Set(previous.ids);
      // Orders are created before order_items; ignore empty headers until items exist.
      const complete = rows.filter((x) => x.item_count > 0);
      const fresh = previous.exists
        ? complete.filter((x) => x.status === "PENDING" && !known.has(x.id))
        : [];
      complete.forEach((x) => known.add(x.id));
      writeSeen(userId, Array.from(known));
      if (fresh.length > 0) {
        if (audioAllowed) {
          setAlert({ order: fresh[0], count: fresh.length });
          if (soundRef.current && audioRef.current?.state === "running") void sound();
        }
      }
      initialRef.current = false;
    } catch (e) {
      if (activeUserRef.current === userId)
        setError(e instanceof Error ? e.message : "Sipariş sorgusu başarısız.");
    } finally {
      busyRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [eligible, userId, audioAllowed, sound]);

  useEffect(() => {
    if (!eligible) { setLoading(false); return; }
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const focused = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", focused);
    document.addEventListener("visibilitychange", focused);
    const channel = supabase
      .channel("wms-order-alerts-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, focused)
      .subscribe();
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focused);
      document.removeEventListener("visibilitychange", focused);
      void supabase.removeChannel(channel);
    };
  }, [eligible, userId, load]);

  const toggleSound = useCallback(() => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSoundEnabled(next);
    try { localStorage.setItem(SOUND_KEY, String(next)); } catch {}
    if (next && audioAllowed) void unlock();
  }, [unlock, audioAllowed]);

  return (
    <Context.Provider value={{
      orders, metrics, loading, refreshing, canRead, error, lastUpdated,
      soundEnabled, audioUnlocked,
      refresh: () => void load(), toggleSound,
      unlockSound: () => {
        if (!soundRef.current) toggleSound();
        else void unlock();
      },
      testSound: () => void sound(),
    }}>
      {children}
      {audioAllowed && canRead && (
        <div className="fixed bottom-4 right-4 z-[9998] flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white shadow-2xl">
          <BellRing size={16} className="text-red-400" />
          <span className="hidden text-[11px] font-bold sm:inline">{metrics.pending} bekleyen sipariş</span>
          <button type="button" onClick={soundEnabled && !audioUnlocked ? () => void unlock() : toggleSound}
            className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[10px] font-bold">
            {soundEnabled ? <Volume2 size={14} /> : <BellOff size={14} />}
            {soundEnabled ? audioUnlocked ? "Ses açık" : "Sesi etkinleştir" : "Ses kapalı"}
          </button>
        </div>
      )}
      {alert && audioAllowed && (
        <div role="alert" className="fixed right-4 top-4 z-[9999] w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-md border border-red-300 bg-white shadow-2xl">
          <div className="flex gap-3 border-l-[5px] border-[#dc3545] p-4">
            <div className="rounded bg-red-50 p-2 text-[#dc3545]"><BellRing size={20} className="animate-pulse" /></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#dc3545]">Yeni mağaza siparişi</h3>
              <p className="mt-1 text-sm font-black text-slate-900">{alert.count > 1 ? alert.count + " yeni sipariş geldi!" : alert.order.order_code + " numaralı sipariş geldi!"}</p>
              <p className="mt-1 text-xs text-slate-600">{alert.order.branch_name} · {alert.order.item_count} kalem · {alert.order.requested_total} adet</p>
              <Link href="/management/orders/approvals" onClick={() => setAlert(null)}
                className="mt-3 inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-2 text-[11px] font-bold text-white">
                <ClipboardList size={14} /> Siparişleri incele
              </Link>
            </div>
            <button type="button" onClick={() => setAlert(null)} aria-label="Bildirimi kapat" className="self-start text-slate-500"><X size={18} /></button>
          </div>
        </div>
      )}
    </Context.Provider>
  );
}
