"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, MapPin, PackagePlus, Volume2, VolumeX, X } from "lucide-react";
import { useWms } from "@/components/providers/WmsSessionProvider";
import { getHomeWarehouseOrders } from "@/app/actions/home-warehouse-orders";
import { supabase } from "@/lib/supabase";
import type { OrderRow } from "@/lib/order-approvals/types";

const SOUND_KEY = "wms:orders:sound:v1";
const SEEN_KEY = "wms:orders:seen:v1:";
// Fallback while Realtime is unavailable; 3x fewer server-side reads.
const POLL_MS = 45000;
const MIN_REFRESH_GAP_MS = 12000;
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
  const { userId, branchName, branchType } = useWms();
  const pathname = usePathname();
  const isTerminal = pathname === "/terminal" || pathname.startsWith("/terminal/");
  // Online Depo'ya bağlı bütün oturumlar (WAREHOUSE dahil), yönetici rolü şartı olmadan.
  const eligible = Boolean(userId && !isTerminal && branchType === "Depo" && branchName === "Online Depo");
  const [isDesktop, setIsDesktop] = useState(false);
  const notificationEnabled = eligible && isDesktop;
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
  const lastLoadRef = useRef(0);
  const activeUserRef = useRef(userId);
  const initialRef = useRef(true);

  // Terminal harici tüm sayfalarda; mobil için eski sessiz davranış korunur.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Kalıcı sayaç yerine yalnızca yeni siparişte geçici uyarı.
  useEffect(() => {
    if (!notificationEnabled) setAlert(null);
  }, [notificationEnabled]);

  useEffect(() => {
    if (!alert) return;
    const timeout = window.setTimeout(() => setAlert(null), 9000);
    return () => window.clearTimeout(timeout);
  }, [alert]);

  const unlock = useCallback(async () => {
    if (!notificationEnabled) return false;
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
  }, [notificationEnabled]);

  const sound = useCallback(async () => {
    // Browser gesture restriction cannot be bypassed.
    if (!await unlock()) return;
    const ctx = audioRef.current;
    if (!ctx) return;
    const start = ctx.currentTime + 0.025;
    // Aynı tanıdık dört notalı uyarı iki kez çalar; Web Audio ile zamanlanır.
    for (let repeat = 0; repeat < 2; repeat++) {
      [880, 1174, 880, 1318].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = start + repeat * 1.18 + i * 0.22;
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
    }
  }, [unlock]);

  useEffect(() => {
    try {
      const enabled = localStorage.getItem(SOUND_KEY) !== "false";
      soundRef.current = enabled;
      setSoundEnabled(enabled);
    } catch {}
    return () => { void audioRef.current?.close(); audioRef.current = null; };
  }, []);

  useEffect(() => {
    if (!notificationEnabled || !soundEnabled || audioUnlocked) return;
    const action = () => { void unlock(); };
    document.addEventListener("pointerdown", action, { once: true });
    document.addEventListener("keydown", action, { once: true });
    return () => {
      document.removeEventListener("pointerdown", action);
      document.removeEventListener("keydown", action);
    };
  }, [notificationEnabled, soundEnabled, audioUnlocked, unlock]);

  useEffect(() => {
    activeUserRef.current = userId;
    initialRef.current = true;
    lastLoadRef.current = 0;
    setOrders([]);
    setMetrics({ pending: 0, preparing: 0, ready_to_ship: 0 });
    setCanRead(false);
    setError(null);
    setLastUpdated(null);
    setAlert(null);
  }, [userId]);

  const load = useCallback(async (force = false) => {
    if (!eligible || !userId || busyRef.current) return;
    // Focus + visibilitychange + polling can fire together; de-duplicate them.
    if (!force && Date.now() - lastLoadRef.current < MIN_REFRESH_GAP_MS) return;
    lastLoadRef.current = Date.now();
    busyRef.current = true;
    if (initialRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      const result = await getHomeWarehouseOrders();
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
      if (fresh.length > 0 && notificationEnabled) {
        setAlert({ order: fresh[0], count: fresh.length });
        if (soundRef.current && audioRef.current?.state === "running") void sound();
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
  }, [eligible, userId, notificationEnabled, sound]);

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
    if (next) void unlock();
  }, [unlock]);

  return (
    <Context.Provider value={{
      orders, metrics, loading, refreshing, canRead, error, lastUpdated,
      soundEnabled, audioUnlocked,
      refresh: () => void load(true), toggleSound,
      unlockSound: () => {
        if (!soundRef.current) toggleSound();
        else void unlock();
      },
      testSound: () => void sound(),
    }}>
      {children}
      {alert && notificationEnabled && (
        <aside
          role="alert"
          aria-label="Yeni mağaza siparişi bildirimi"
          className="fixed right-4 top-4 z-[9999] w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_16px_50px_-16px_rgba(15,23,42,0.32)]"
        >
          <div className="flex items-start gap-3 px-4 py-4">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
              <PackagePlus size={21} />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#dc3545]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#dc3545]">
                  Yeni mağaza talebi
                </span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                  Şimdi
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-extrabold leading-snug text-slate-900">
                {alert.count > 1 ? alert.count + " yeni sipariş alındı" : alert.order.order_code}
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                <MapPin size={12} className="shrink-0 text-slate-400" />
                <span className="truncate">{alert.order.branch_name}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-bold text-slate-700">
                  {alert.order.has_consumable && alert.order.has_product
                    ? "Ürün + Sarf"
                    : alert.order.has_consumable ? "Sarf" : "Ürün"}
                </span>
                <span>{alert.order.item_count} kalem</span>
                <span className="font-bold text-slate-800">{alert.order.requested_total} adet</span>
              </div>
            </div>
            <button
              type="button" onClick={() => setAlert(null)}
              title="Bildirimi kapat" aria-label="Bildirimi kapat"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={17} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
            <Link
              href="/management/orders/approvals"
              onClick={() => setAlert(null)}
              className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-slate-900 transition hover:text-[#dc3545]"
            >
              Siparişleri incele <ArrowUpRight size={14} />
            </Link>
            <button
              type="button" onClick={toggleSound}
              title={soundEnabled ? "Sipariş seslerini kapat" : "Sipariş seslerini aç"}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              {soundEnabled ? <VolumeX size={13} /> : <Volume2 size={13} />}
              {soundEnabled ? "Sesi kapat" : "Sesi aç"}
            </button>
          </div>
          <div className="h-[3px] bg-[#dc3545]" />
        </aside>
      )}
    </Context.Provider>
  );
}
