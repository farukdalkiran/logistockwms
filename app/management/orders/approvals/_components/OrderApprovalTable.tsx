"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Inbox,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  dateLabel,
  kindLabel,
  numberLabel,
  statusLabel,
  type Context,
  type Filters,
  type ListResult,
} from "@/lib/order-approvals/types";
import s from "../approvals.module.css";

function csvCell(v: unknown) {
  const t = String(v ?? "");
  return (
    '"' +
    (/^\s*[=+@-]|^[\t\r\n]/.test(t) ? "'" + t : t).replace(/"/g, '""') +
    '"'
  );
}

function exportPage(result: ListResult) {
  const head = [
    "Sipariş",
    "Mağaza",
    "Talep eden",
    "Tür",
    "Durum",
    "Tarih",
    "Kalem",
    "Talep adedi",
    "Onay adedi",
  ];
  const lines = result.rows.map((o) => [
    o.order_code,
    o.branch_name,
    o.requester_name,
    kindLabel(o),
    statusLabel(o.status),
    dateLabel(o.created_at),
    o.item_count,
    o.requested_total,
    o.approved_total,
  ]);
  const blob = new Blob(
    [
      "\uFEFF" +
        [head, ...lines].map((r) => r.map(csvCell).join(";")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `siparisler-sayfa-${result.page}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function waitLabel(value: string) {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  return mins >= 1440
    ? `${Math.floor(mins / 1440)} gündür bekliyor`
    : mins >= 60
      ? `${Math.floor(mins / 60)} saattir bekliyor`
      : "Yeni talep";
}

function pages(current: number, last: number) {
  return Array.from(
    new Set(
      [1, current - 1, current, current + 1, last].filter(
        (n) => n > 0 && n <= last,
      ),
    ),
  ).sort((a, b) => a - b);
}

export default function OrderApprovalTable({
  result,
  context,
  filters,
  change,
  searchInput,
  setSearchInput,
  reset,
  loading,
  error,
  onOpen,
}: {
  result: ListResult;
  context: Context | null;
  filters: Filters;
  change: (p: Partial<Filters>) => void;
  searchInput: string;
  setSearchInput: (s: string) => void;
  reset: () => void;
  loading: boolean;
  error: string | null;
  onOpen: (id: string) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(result.count / filters.pageSize));
  const current = result.page;
  const active = Boolean(
    filters.branch ||
      filters.kind !== "ALL" ||
      filters.from ||
      filters.to ||
      searchInput,
  );
  const numbers = pages(current, totalPages);

  return (
    <section className={s.panel} aria-label="Sipariş listesi">
      <div className={s.tabs} role="group" aria-label="Sipariş durumu">
        {(["PENDING", "READY_TO_SHIP", "REJECTED", "ALL"] as const).map(
          (key) => (
            <button
              key={key}
              aria-pressed={filters.status === key}
              className={filters.status === key ? s.tabActive : s.tab}
              onClick={() => change({ status: key })}
            >
              {key === "ALL" ? "Tüm siparişler" : statusLabel(key)}
              {key === "PENDING" && (
                <span>{numberLabel(result.metrics.pending)}</span>
              )}
            </button>
          ),
        )}
      </div>

      <div className={s.filters}>
        <div className={s.search}>
          <Search size={16} />
          <input
            aria-label="Sipariş, mağaza, talep eden veya ürün ara"
            value={searchInput}
            maxLength={120}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Sipariş, mağaza, talep eden, SKU veya barkod…"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              aria-label="Aramayı temizle"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <label className={s.filterField}>
          <span>Talep türü</span>
          <select
            value={filters.kind}
            onChange={(e) =>
              change({ kind: e.target.value as Filters["kind"] })
            }
          >
            <option value="ALL">Ürün + Sarf</option>
            <option value="PRODUCT">Ürün siparişi</option>
            <option value="CONSUMABLE">Sarf siparişi</option>
            <option value="MIXED">Karma sipariş</option>
          </select>
        </label>
        <label className={s.filterField}>
          <span>Talep eden şube</span>
          <select
            value={filters.branch}
            onChange={(e) => change({ branch: e.target.value })}
          >
            <option value="">Tüm şubeler</option>
            {context?.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className={s.filterField}>
          <span>Başlangıç</span>
          <input
            aria-label="Başlangıç tarihi"
            type="date"
            value={filters.from}
            onChange={(e) => change({ from: e.target.value })}
          />
        </label>
        <label className={s.filterField}>
          <span>Bitiş</span>
          <input
            aria-label="Bitiş tarihi"
            type="date"
            min={filters.from || undefined}
            value={filters.to}
            onChange={(e) => change({ to: e.target.value })}
          />
        </label>
      </div>

      <div className={s.tableToolbar}>
        <div className={s.toolbarInfo}>
          <Filter size={14} />
          <strong>{numberLabel(result.count)}</strong> sipariş listeleniyor
          {active && (
            <button className={s.textButton} onClick={reset}>
              Filtreleri temizle <X size={12} />
            </button>
          )}
        </div>
        <div className={s.toolbarRight}>
          <label className={s.sortLabel}>
            <SlidersHorizontal size={14} />
            <select
              aria-label="Sipariş sıralaması"
              value={filters.sort}
              onChange={(e) =>
                change({ sort: e.target.value as Filters["sort"] })
              }
            >
              <option value="oldest">En eski önce</option>
              <option value="newest">En yeni önce</option>
              <option value="quantity">Talep adedi: azalan</option>
            </select>
          </label>
          <button
            className={s.iconButton}
            title="Bu sayfayı CSV indir"
            aria-label="Bu sayfayı CSV indir"
            disabled={loading || !!error || !result.rows.length}
            onClick={() => exportPage(result)}
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className={s.error} role="alert">
          {error} <span>Liste güncel olarak alınamadı.</span>
        </div>
      )}

      {loading ? (
        <div className={s.empty} role="status">
          <Loader2 size={27} className={s.spin} />
          <strong>Siparişler getiriliyor</strong>
          <p>Talep ve ürün bilgileri hazırlanıyor.</p>
        </div>
      ) : !error && result.rows.length === 0 ? (
        <div className={s.empty}>
          <Inbox size={36} />
          <strong>
            {active
              ? "Bu filtrelerle sipariş bulunamadı"
              : "Bu durumda sipariş bulunmuyor"}
          </strong>
          <p>Diğer durumlara geçebilir veya filtreleri temizleyebilirsiniz.</p>
          {active && (
            <button className={s.button} onClick={reset}>
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : !error ? (
        <>
          <div className={s.tableScroll}>
            <table className={s.ordersTable}>
              <thead>
                <tr>
                  <th>Sipariş / Tarih</th>
                  <th>Talep Eden Şube</th>
                  <th>Tür</th>
                  <th className={s.right}>Kalem</th>
                  <th className={s.right}>Talep Adedi</th>
                  <th>Durum & Süreç</th>
                  <th className={s.right}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((o) => {
                  const rowClass =
                    o.status === "PENDING"
                      ? s.rowPending
                      : ["PREPARING", "READY_TO_SHIP"].includes(o.status)
                        ? s.rowReady
                        : o.status === "REJECTED"
                          ? s.rowRejected
                          : "";

                  const kindPillClass =
                    o.has_consumable && o.has_product
                      ? s.pillIndigo
                      : o.has_consumable
                        ? s.pillPurple
                        : s.pillBlue;

                  return (
                    <tr key={o.id} className={rowClass}>
                      <td>
                        <div className={s.codeCell}>
                          <strong className={s.orderCode}>{o.order_code}</strong>
                          <small>{dateLabel(o.created_at, true)}</small>
                        </div>
                      </td>
                      <td>
                        <strong className={s.branchName}>{o.branch_name}</strong>
                        <small className={s.requesterName}>
                          {o.requester_name}
                        </small>
                      </td>
                      <td>
                        <span className={`${s.pill} ${kindPillClass}`}>
                          {kindLabel(o)}
                        </span>
                      </td>
                      <td className={s.right}>
                        <span className={s.itemBadge}>
                          {numberLabel(o.item_count)}
                        </span>
                      </td>
                      <td className={`${s.right} ${s.quantity}`}>
                        <span className={s.qtyBadge}>
                          {numberLabel(o.requested_total)}
                          <small>adet</small>
                        </span>
                      </td>
                      <td>
                        <div className={s.statusCell}>
                          <span
                            className={`${s.pill} ${
                              o.status === "PENDING"
                                ? s.pillAmber
                                : ["PREPARING", "READY_TO_SHIP"].includes(
                                      o.status,
                                    )
                                  ? s.pillGreen
                                  : o.status === "REJECTED"
                                    ? s.pillRed
                                    : s.pillNeutral
                            }`}
                          >
                            <span className={s.statusDot} />
                            {statusLabel(o.status)}
                          </span>
                          <small className={s.waitMeta}>
                            {o.status === "PENDING"
                              ? waitLabel(o.created_at)
                              : o.prepared_by_name || "—"}
                          </small>
                        </div>
                      </td>
                      <td className={s.right}>
                        <button
                          className={
                            o.status === "PENDING"
                              ? s.reviewButtonPrimary
                              : s.reviewButton
                          }
                          onClick={() => onOpen(o.id)}
                          aria-label={`${o.order_code} ${
                            o.status === "PENDING"
                              ? "incele ve onayla"
                              : "detayını aç"
                          }`}
                        >
                          {o.status === "PENDING" ? "İncele" : "Detay"}
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={s.mobileOrders}>
            {result.rows.map((o) => (
              <article className={s.mobileOrder} key={o.id}>
                <div>
                  <strong className={s.orderCode}>{o.order_code}</strong>
                  <span
                    className={`${s.pill} ${
                      o.status === "PENDING"
                        ? s.pillAmber
                        : o.status === "REJECTED"
                          ? s.pillRed
                          : s.pillGreen
                    }`}
                  >
                    <span className={s.statusDot} />
                    {statusLabel(o.status)}
                  </span>
                </div>
                <h3>{o.branch_name}</h3>
                <p>
                  {o.requester_name} · {dateLabel(o.created_at, true)}
                </p>
                <footer>
                  <span>
                    {kindLabel(o)} · {numberLabel(o.item_count)} kalem ·{" "}
                    <b>{numberLabel(o.requested_total)} adet</b>
                  </span>
                  <button
                    className={
                      o.status === "PENDING"
                        ? s.reviewButtonPrimary
                        : s.reviewButton
                    }
                    onClick={() => onOpen(o.id)}
                  >
                    {o.status === "PENDING" ? "İncele" : "Detay"}
                    <ArrowRight size={13} />
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <footer className={s.pagination}>
        <div>
          <span>
            {result.count
              ? `${(current - 1) * filters.pageSize + 1}–${Math.min(
                  current * filters.pageSize,
                  result.count,
                )}`
              : "0"}{" "}
            / <strong>{numberLabel(result.count)}</strong> sipariş
          </span>
          <label>
            <select
              aria-label="Sayfa başına sipariş"
              value={filters.pageSize}
              onChange={(e) => change({ pageSize: Number(e.target.value) })}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / sayfa
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav aria-label="Sipariş sayfaları">
          <button
            aria-label="Önceki sayfa"
            disabled={loading || !!error || current <= 1}
            onClick={() => change({ page: current - 1 })}
          >
            <ChevronLeft size={15} />
          </button>
          {numbers.map((n, index) => (
            <span className={s.pageNumberGroup} key={n}>
              {index > 0 && n - numbers[index - 1] > 1 && (
                <span className={s.dots}>…</span>
              )}
              <button
                aria-current={current === n ? "page" : undefined}
                disabled={loading || !!error}
                onClick={() => change({ page: n })}
              >
                {n}
              </button>
            </span>
          ))}
          <button
            aria-label="Sonraki sayfa"
            disabled={loading || !!error || current >= totalPages}
            onClick={() => change({ page: current + 1 })}
          >
            <ChevronRight size={15} />
          </button>
        </nav>
      </footer>
    </section>
  );
}