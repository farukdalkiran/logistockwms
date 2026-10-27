"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ClipboardCheck,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import {
  getApprovalContext,
  getApprovalOrders,
} from "@/app/actions/order-approvals";
import {
  DEFAULT_FILTERS,
  dateLabel,
  numberLabel,
  type Context,
  type Filters,
  type ListResult,
} from "@/lib/order-approvals/types";
import OrderApprovalTable from "./_components/OrderApprovalTable";
import ApprovalDetailModal from "./_components/ApprovalDetailModal";
import s from "./approvals.module.css";

const EMPTY: ListResult = {
  rows: [],
  count: 0,
  page: 1,
  metrics: {
    pending: 0,
    preparing: 0,
    ready_to_ship: 0,
    rejected: 0,
    pending_quantity: 0,
  },
  updatedAt: "",
};

export default function OrderApprovalsPage() {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [bootstrap, setBootstrap] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [result, setResult] = useState<ListResult>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getApprovalContext()
      .then((r) => {
        if (!active) return;
        if (r.ok) setContext(r.data);
        else {
          setError(r.error);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError("Bağlantı kurulamadı. Yeniden deneyiniz.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [bootstrap]);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setFilters((f) =>
          f.search === searchInput.trim()
            ? f
            : { ...f, search: searchInput.trim(), page: 1 },
        ),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async (silent = false) => {
      if (!context) return;
      const id = ++request.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const response = await getApprovalOrders(filters);
        if (id !== request.current) return;
        if (!response.ok) throw new Error(response.error);
        setResult(response.data);
        setError(null);
      } catch (e) {
        if (id === request.current)
          setError(e instanceof Error ? e.message : "Liste yenilenemedi.");
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [context, filters],
  );
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  // Approval queue refreshes on entry/filter changes, manual refresh, and actions.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);
  const change = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const reset = () => {
    setSearchInput("");
    setFilters({ ...DEFAULT_FILTERS, pageSize: filters.pageSize });
  };

  return (
    <main className={s.app}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.brand}>
            <div className={s.brandMark}>
              <ClipboardCheck size={23} />
            </div>
            <div>
              <span className={s.eyebrow}>WMS / MAĞAZA OPERASYONLARI</span>
              <h1>Sipariş onay merkezi</h1>
              <p>
                Ürün ve sarf taleplerini inceleyin, revize edin ve gönderime
                aktarın.
              </p>
            </div>
          </div>
          <div className={s.headerActions}>
            <button className={s.headerBack} onClick={() => router.back()}>
              <ArrowLeft size={16} />
              <span>Yönetime dön</span>
            </button>
            <div className={s.warehouse}>
              <Warehouse size={17} />
              <span>
                {context?.warehouseName || "Depo bağlantısı"}
                <small>{context?.actorName || "Oturum denetleniyor…"}</small>
              </span>
              <span className={s.liveDot} />
            </div>
          </div>
        </div>
      </header>
      <div className={s.container}>
        <div className={s.topline}>
          <div>
            <span className={s.sectionCode}>OPERASYON KUYRUĞU</span>
            <h2>Gelen talepler</h2>
          </div>
          <div className={s.sync}>
            <span>
              {refreshing
                ? "Güncelleniyor…"
                : result.updatedAt
                  ? `Son güncelleme ${dateLabel(result.updatedAt, true)}`
                  : "Bağlantı bekleniyor"}
            </span>
            <button
              className={s.button}
              disabled={loading || refreshing}
              onClick={() =>
                context ? void load(true) : setBootstrap((b) => b + 1)
              }
            >
              <RefreshCw
                size={15}
                className={refreshing ? s.spin : undefined}
              />
              Yenile
            </button>
          </div>
        </div>
        {toast && (
          <div className={s.success} role="status">
            <Check size={17} />
            {toast}
          </div>
        )}
        <div className={s.stats} aria-busy={loading}>
          <button
            className={`${s.stat} ${s.statPending}`}
            onClick={() => change({ status: "PENDING" })}
          >
            <span>
              Onay bekleyen
              <ArrowUpRight size={15} />
            </span>
            <strong>
              {context && result.updatedAt
                ? numberLabel(result.metrics.pending)
                : "—"}
            </strong>
            <small>İncelenecek sipariş</small>
          </button>
          <button
            className={s.stat}
            onClick={() => change({ status: "READY_TO_SHIP" })}
          >
            <span>
              Hazırlandı & gönderiliyor
              <ArrowUpRight size={15} />
            </span>
            <strong>
              {context && result.updatedAt
                ? numberLabel(result.metrics.ready_to_ship)
                : "—"}
            </strong>
            <small>Onaylanan ve gönderime hazır sipariş</small>
          </button>
          <div className={s.stat}>
            <span>Bekleyen talep miktarı</span>
            <strong>
              {context && result.updatedAt
                ? numberLabel(result.metrics.pending_quantity)
                : "—"}
              <em>adet</em>
            </strong>
            <small>Bekleyen siparişlerin toplamı</small>
          </div>
          <button
            className={s.stat}
            onClick={() => change({ status: "REJECTED" })}
          >
            <span>
              Reddedilen
              <ArrowUpRight size={15} />
            </span>
            <strong>
              {context && result.updatedAt
                ? numberLabel(result.metrics.rejected)
                : "—"}
            </strong>
            <small>Gerekçesiyle kapatılan sipariş</small>
          </button>
        </div>
        <p className={s.metricNote}>
          Özetler seçili mağaza, tür, arama ve tarih filtrelerine göre tüm
          sonuçlardan hesaplanır.
        </p>
        <OrderApprovalTable
          result={result}
          context={context}
          filters={filters}
          change={change}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          reset={reset}
          loading={loading}
          error={error}
          onOpen={setSelected}
        />
        <div className={s.pageFoot}>
          <span>Varsayılan sıralama: en eski talep önce</span>
          <span>Manuel yenileme ve işlemler sonrası güncelleme.</span>
        </div>
      </div>
      {selected && (
        <ApprovalDetailModal
          orderId={selected}
          context={context}
          close={() => setSelected(null)}
          onSuccess={(status) => {
            if (status === "REJECTED") setSelected(null);
            setToast(
              status === "REJECTED"
                ? "Sipariş gerekçesiyle reddedildi."
                : "Sipariş hazırlandı ve gönderiliyor. A4 teslim tutanağını yazdırabilirsiniz.",
            );
            if (status === "READY_TO_SHIP") change({ status: "READY_TO_SHIP" });
            else void load(true);
          }}
        />
      )}
    </main>
  );
}
