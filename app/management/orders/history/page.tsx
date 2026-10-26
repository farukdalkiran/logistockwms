"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Clock3,
  RefreshCw,
} from "lucide-react";
import {
  getApprovalContext,
  getApprovalOrders,
} from "@/app/actions/order-approvals";
import {
  DEFAULT_FILTERS,
  dateLabel,
  numberLabel,
  statusLabel,
  type ListResult,
} from "@/lib/order-approvals/types";

type HistoryStatus = "PREPARING" | "READY_TO_SHIP" | "REJECTED";
const PAGE_SIZE = 20;

export default function OrderHistoryPage() {
  const [status, setStatus] = useState<HistoryStatus>("PREPARING");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ListResult | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void getApprovalContext()
      .then((response) => {
        if (!active) return;
        if (!response.ok) {
          setError(response.error);
          setLoading(false);
          return;
        }
        setAuthorized(true);
      })
      .catch(() => {
        if (active) {
          setError("Oturum doğrulanamadı.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => setReload((r) => r + 1), []);
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    setLoading(true);
    setError("");
    void getApprovalOrders({
      ...DEFAULT_FILTERS,
      status,
      page,
      pageSize: PAGE_SIZE,
      sort: "newest",
      search: search.trim(),
    })
      .then((response) => {
        if (!active) return;
        if (response.ok) setRows(response.data);
        else setError(response.error);
      })
      .catch(() => {
        if (active) setError("Sipariş geçmişi yüklenemedi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authorized, status, page, search, reload]);

  const pages = Math.max(1, Math.ceil((rows?.count ?? 0) / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-b-4 border-[#dc3545] bg-slate-900 p-6 text-white">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-300">
              <Clock3 size={15} /> WMS / Sipariş Arşivi
            </div>
            <h1 className="text-2xl font-black">Sipariş İşlem Geçmişi</h1>
            <p className="mt-1 text-sm text-slate-300">
              Hazırlanan, gönderime hazır ve reddedilen sipariş kararları
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/management/orders/approvals" className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-800">
              <ArrowLeft size={16} className="mr-1 inline" /> Onay Merkezi
            </Link>
            <button onClick={refresh} className="rounded-lg bg-[#dc3545] px-3 py-2 text-sm font-bold hover:bg-red-700">
              <RefreshCw size={15} className="mr-1 inline" /> Yenile
            </button>
          </div>
        </header>

        <section className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="text-xs font-bold text-slate-600">
            İşlem Durumu
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as HistoryStatus);
                setPage(1);
              }}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="PREPARING">Hazırlanıyor</option>
              <option value="READY_TO_SHIP">Gönderime hazır</option>
              <option value="REJECTED">Reddedildi</option>
            </select>
          </label>
          <label className="min-w-52 flex-1 text-xs font-bold text-slate-600">
            Sipariş Kodu
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ORD-..."
              maxLength={120}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </section>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <span>Kayıtlar</span>
            <span>{numberLabel(rows?.count ?? 0)} sipariş</span>
          </div>
          {loading ? (
            <p className="p-10 text-center text-sm text-slate-500">Sipariş geçmişi yükleniyor…</p>
          ) : !rows?.rows.length ? (
            <div className="p-12 text-center text-slate-500">
              <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
              Bu filtre için işlem kaydı bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.rows.map((order) => (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{order.order_code}</span>
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{order.branch_name} · {order.requester_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dateLabel(order.created_at)} · {numberLabel(order.item_count)} kalem · {numberLabel(order.approved_total)} onaylı adet
                    </p>
                  </div>
                  <Link href="/management/orders/approvals" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                    Onay Merkezinde İncele <ArrowRight size={15} />
                  </Link>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 p-4">
            <span className="text-sm text-slate-500">Sayfa {page} / {pages}</span>
            <div className="flex gap-2">
              <button disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40">
                Önceki
              </button>
              <button disabled={loading || page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40">
                Sonraki
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
