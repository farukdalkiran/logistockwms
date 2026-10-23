"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  Box,
  Check,
  CheckCheck,
  ClipboardList,
  Clock3,
  History,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  User,
  Warehouse,
  X,
} from "lucide-react";
import {
  decideApproval,
  getApprovalDetail,
} from "@/app/actions/order-approvals";
import {
  dateLabel,
  kindLabel,
  numberLabel,
  statusLabel,
  type Context,
  type OrderDetail,
  type OrderItem,
} from "@/lib/order-approvals/types";
import s from "../approvals.module.css";
import PrintDeliveryReceiptButton from "./PrintDeliveryReceiptButton";

type Revision = { qty: string; reason: string; custom: string };
const REASONS = [
  "Yetersiz stok",
  "Hasarlı ürün",
  "Talep limiti",
  "Alternatif ürün planlandı",
  "Diğer",
];
const reasonText = (r: Revision) =>
  r.reason === "Diğer" ? r.custom.trim() : r.reason;
const valueOf = (r: Revision | undefined) =>
  r && /^\d+$/.test(r.qty) ? Number(r.qty) : 0;

function ProductImage({ item }: { item: OrderItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={s.productImage}>
      {item.product?.image_url && !failed ? (
        <img
          src={item.product.image_url}
          alt={item.product.name}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <Box size={20} />
      )}
    </div>
  );
}

export default function ApprovalDetailModal({
  orderId,
  context,
  close,
  onSuccess,
}: {
  orderId: string;
  context: Context | null;
  close: () => void;
  onSuccess: (status: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [revisions, setRevisions] = useState<Record<string, Revision>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState("ALL");
  const [employee, setEmployee] = useState("");
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [submitting, setSubmitting] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const closeRef = useRef(close);
  closeRef.current = close;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const requestClose = useCallback(() => {
    if (busy.current) return;
    if (dirtyRef.current) setDiscard(true);
    else closeRef.current();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getApprovalDetail(orderId)
      .then((r) => {
        if (!active) return;
        if (!r.ok) {
          setError(r.error);
          setOrder(null);
          return;
        }
        setOrder(r.data);
        setRevisions(
          Object.fromEntries(
            r.data.items.map((i) => [
              i.id,
              {
                qty: String(
                  r.data.status === "PENDING"
                    ? i.requested_qty
                    : (i.approved_qty ?? 0),
                ),
                reason: i.revision_reason || "",
                custom: "",
              },
            ]),
          ),
        );
        setDirty(false);
      })
      .catch(() => {
        if (active) setError("Sipariş detayı alınamadı.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId, reload]);

  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("keydown", handler);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handler);
      window.removeEventListener("beforeunload", beforeUnload);
      previous?.focus();
    };
  }, [mounted, requestClose]);

  const editable = order?.status === "PENDING";
  const approved =
    order?.items.reduce((sum, i) => sum + valueOf(revisions[i.id]), 0) ?? 0;
  const requested =
    order?.items.reduce((sum, i) => sum + i.requested_qty, 0) ?? 0;
  const revised =
    order?.items.filter((i) => valueOf(revisions[i.id]) < i.requested_qty)
      .length ?? 0;

  const shortage = useMemo(() => {
    const byProduct = new Map<string, { qty: number; stock: number }>();
    order?.items.forEach((i) => {
      if (!i.product_id) return;
      const p = byProduct.get(i.product_id) || {
        qty: 0,
        stock: Math.max(0, i.warehouse_stock),
      };
      p.qty += valueOf(revisions[i.id]);
      byProduct.set(i.product_id, p);
    });
    return [...byProduct.values()].filter((v) => v.qty > v.stock).length;
  }, [order, revisions]);

  const visible =
    order?.items.filter((i) => {
      const matchType =
        itemType === "ALL" ||
        (itemType === "CONSUMABLE"
          ? i.product?.is_consumable
          : !i.product?.is_consumable);
      const text = [i.product?.name, i.product?.sku, i.product?.barcode]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return matchType && text.includes(query.toLocaleLowerCase("tr-TR"));
    }) ?? [];

  const setRevision = (id: string, patch: Partial<Revision>) => {
    setDirty(true);
    setError("");
    setRevisions((old) => ({ ...old, [id]: { ...old[id], ...patch } }));
  };

  const fillAll = () => {
    if (!order) return;
    setDirty(true);
    setError("");
    setRevisions(
      Object.fromEntries(
        order.items.map((i) => [
          i.id,
          { qty: String(i.requested_qty), reason: "", custom: "" },
        ]),
      ),
    );
  };

  const fillStock = () => {
    if (!order) return;
    const stocks = new Map<string, number>();
    const entries = order.items.map((i) => {
      const key = i.product_id || i.id;
      const available = stocks.get(key) ?? Math.max(0, i.warehouse_stock);
      const qty = Math.min(i.requested_qty, available);
      stocks.set(key, available - qty);
      return [
        i.id,
        {
          qty: String(qty),
          reason: qty < i.requested_qty ? "Yetersiz stok" : "",
          custom: "",
        },
      ];
    });
    setRevisions(Object.fromEntries(entries));
    setDirty(true);
    setError("");
  };

  const submit = async () => {
    if (!order || !editable || busy.current) return;
    setError("");
    if (!/^\d{1,5}$/.test(employee.trim())) {
      setError("İşlemi yapan aktif personelin ID bilgisini giriniz.");
      return;
    }
    if (action === "REJECT" && note.trim().length < 5) {
      setError("Siparişi reddetmek için en az 5 karakterlik gerekçe yazınız.");
      return;
    }
    if (action === "APPROVE") {
      for (const i of order.items) {
        const r = revisions[i.id];
        if (
          !r ||
          !/^\d+$/.test(r.qty) ||
          !Number.isSafeInteger(Number(r.qty)) ||
          Number(r.qty) > i.requested_qty
        ) {
          setError(
            `${i.product?.sku || i.product?.name || "Ürün"}: 0 ile ${i.requested_qty} arasında tam sayı giriniz.`,
          );
          return;
        }
        if (Number(r.qty) < i.requested_qty && !reasonText(r)) {
          setError(
            `${i.product?.name || "Ürün"} için revizyon gerekçesi giriniz. Gizlenen satırları da kontrol ediniz.`,
          );
          return;
        }
        if (!i.product) {
          setError(
            "Ürün bağlantısı olmayan kalemler var. Bu sipariş onaylanamaz.",
          );
          return;
        }
      }
      if (approved === 0) {
        setError("Tüm miktarlar sıfır. Siparişi reddet seçeneğini kullanınız.");
        return;
      }
    }
    busy.current = true;
    setSubmitting(true);
    try {
      const r = await decideApproval({
        orderId: order.id,
        employeeId: employee.trim(),
        action,
        note,
        items:
          action === "APPROVE"
            ? order.items.map((i) => ({
                id: i.id,
                qty: valueOf(revisions[i.id]),
                reason: reasonText(revisions[i.id]),
              }))
            : [],
      });
      if (!r.ok) throw new Error(r.error);
      dirtyRef.current = false;
      setDirty(false);
      if (r.data.status === "READY_TO_SHIP") {
        setLoading(true);
        setReload((value) => value + 1);
      }
      onSuccess(r.data.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  const missingCount =
    action === "REJECT" && editable ? requested : requested - approved;
  const fulfillRatio = requested
    ? Math.round(
        ((action === "REJECT" && editable ? 0 : approved) / requested) * 100,
      )
    : 0;

  return createPortal(
    <div
      className={s.modalRoot}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className={s.dialog}
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-dialog-title"
        tabIndex={-1}
      >
        <header className={s.dialogHeader}>
          <div className={s.dialogTitle}>
            <span className={s.dialogIcon}>
              <ClipboardList size={21} />
            </span>
            <div>
              <span className={s.eyebrow}>
                MERKEZ DEPO · SİPARİŞ İNCELEMESİ
              </span>
              <h2 id="approval-dialog-title">
                {order?.order_code || "Sipariş detayı"}
                {order && (
                  <span
                    className={`${s.pill} ${
                      order.has_consumable && order.has_product
                        ? s.pillIndigo
                        : order.has_consumable
                          ? s.pillPurple
                          : s.pillBlue
                    }`}
                  >
                    {kindLabel(order)}
                  </span>
                )}
              </h2>
            </div>
          </div>
          <div className={s.dialogHeaderRight}>
            {order && (
              <span
                className={`${s.pill} ${
                  editable
                    ? s.pillAmber
                    : order.status === "REJECTED"
                      ? s.pillRed
                      : s.pillGreen
                }`}
              >
                <span className={s.statusDot} />
                {statusLabel(order.status)}
              </span>
            )}
            <button
              className={s.closeButton}
              onClick={requestClose}
              disabled={submitting}
              aria-label="Sipariş detayını kapat"
            >
              <X size={19} />
            </button>
          </div>
        </header>

        {discard && (
          <div className={s.discard} role="alert">
            <span>Kaydedilmemiş miktar veya gerekçe değişiklikleri var.</span>
            <button className={s.button} onClick={() => setDiscard(false)}>
              Düzenlemeye dön
            </button>
            <button
              className={s.dangerButton}
              onClick={() => closeRef.current()}
            >
              Değişiklikleri bırak
            </button>
          </div>
        )}

        <div className={s.dialogBody}>
          {loading ? (
            <div className={s.empty}>
              <Loader2 className={s.spin} size={30} />
              <strong>Sipariş ve depo stokları getiriliyor</strong>
            </div>
          ) : !order ? (
            <div className={s.empty}>
              <AlertCircle size={30} />
              <strong>{error || "Sipariş bulunamadı"}</strong>
              <button
                className={s.button}
                onClick={() => setReload((v) => v + 1)}
              >
                Tekrar dene
              </button>
            </div>
          ) : (
            <>
              <div className={s.orderMeta}>
                <div>
                  <span className={`${s.metaIcon} ${s.metaIconBlue}`}>
                    <MapPin size={16} />
                  </span>
                  <span>
                    Talep Eden Şube<strong>{order.branch_name}</strong>
                  </span>
                </div>
                <div>
                  <span className={`${s.metaIcon} ${s.metaIconPurple}`}>
                    <User size={16} />
                  </span>
                  <span>
                    Talep Eden<strong>{order.requester_name}</strong>
                  </span>
                </div>
                <div>
                  <span className={`${s.metaIcon} ${s.metaIconAmber}`}>
                    <Clock3 size={16} />
                  </span>
                  <span>
                    Oluşturulma<strong>{dateLabel(order.created_at)}</strong>
                  </span>
                </div>
                <div>
                  <span className={`${s.metaIcon} ${s.metaIconGreen}`}>
                    <Warehouse size={16} />
                  </span>
                  <span>
                    İşlem Deposu<strong>{context?.warehouseName || "—"}</strong>
                  </span>
                </div>
              </div>

              <div className={s.detailGrid}>
                <section className={s.detailMain}>
                  <div className={s.itemsHeading}>
                    <div>
                      <h3>
                        Sipariş Kalemleri <span>{order.items.length}</span>
                      </h3>
                      <p>
                        {editable
                          ? "Miktarları düzenleyin; eksik karşılanan her kaleme gerekçe seçin."
                          : "Kaydedilmiş onay miktarları ve revizyon gerekçeleri."}
                      </p>
                    </div>
                    {editable && (
                      <div className={s.fillButtons}>
                        <button
                          className={s.fillBtnStock}
                          onClick={fillStock}
                          disabled={submitting}
                        >
                          <Warehouse size={13} />
                          Stoğa göre doldur
                        </button>
                        <button
                          className={s.fillBtnFull}
                          onClick={fillAll}
                          disabled={submitting}
                        >
                          <CheckCheck size={14} />
                          Tam miktara getir
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={s.itemFilters}>
                    <div className={s.search}>
                      <Search size={15} />
                      <input
                        aria-label="Sipariş kalemlerinde ara"
                        placeholder="Ürün adı, SKU veya barkod ara…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          aria-label="Ürün aramasını temizle"
                          onClick={() => setQuery("")}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <select
                      aria-label="Kalem türü"
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value)}
                    >
                      <option value="ALL">Tüm kalemler</option>
                      <option value="PRODUCT">Ticari Ürünler</option>
                      <option value="CONSUMABLE">Sarf Malzemeleri</option>
                    </select>
                  </div>

                  <div className={s.itemColumnHead}>
                    <span>Ürün Bilgisi</span>
                    <span className={s.center}>Depo / Talep</span>
                    <span>Onay Miktarı & Revizyon</span>
                  </div>

                  <div className={s.itemList}>
                    {visible.length === 0 ? (
                      <div className={s.empty}>
                        <Package size={26} />
                        <p>Gösterilecek kalem bulunamadı.</p>
                      </div>
                    ) : (
                      visible.map((i) => {
                        const r = revisions[i.id];
                        if (!r) return null;
                        const qty = valueOf(r);
                        const changed = qty < i.requested_qty;
                        const isZero = qty === 0;

                        const itemStateClass = editable
                          ? isZero
                            ? s.itemZero
                            : changed
                              ? s.itemRevised
                              : s.itemFull
                          : (i.approved_qty ?? 0) === 0
                            ? s.itemZero
                            : (i.approved_qty ?? 0) < i.requested_qty
                              ? s.itemRevised
                              : s.itemFull;

                        return (
                          <article
                            className={`${s.itemRow} ${itemStateClass}`}
                            key={i.id}
                          >
                            <div className={s.itemIdentity}>
                              <ProductImage item={i} />
                              <div>
                                <span className={s.sku}>
                                  <span className={s.skuBadge}>
                                    {i.product?.sku || "SKU yok"}
                                  </span>
                                  <b
                                    className={
                                      i.product?.is_consumable
                                        ? s.typeConsumable
                                        : s.typeProduct
                                    }
                                  >
                                    {i.product?.is_consumable ? "Sarf" : "Ürün"}
                                  </b>
                                </span>
                                <h4>
                                  {i.product?.name ||
                                    "Ürün bağlantısı bulunamadı"}
                                </h4>
                                <small>
                                  {i.product?.barcode || "Barkod yok"}
                                  {i.product?.category
                                    ? ` · ${i.product.category}`
                                    : ""}
                                </small>
                              </div>
                            </div>

                            <div className={s.itemQuantities}>
                              <div
                                className={
                                  i.warehouse_stock < i.requested_qty
                                    ? s.qtyBoxLow
                                    : s.qtyBoxStock
                                }
                              >
                                <span>Depo</span>
                                <strong>
                                  {numberLabel(i.warehouse_stock)}
                                </strong>
                              </div>
                              <div className={s.qtyBoxReq}>
                                <span>Talep</span>
                                <strong>{numberLabel(i.requested_qty)}</strong>
                              </div>
                            </div>

                            <div className={s.itemEditor}>
                              {editable ? (
                                <>
                                  <div className={s.quantityControls}>
                                    <button
                                      aria-label={`${i.product?.name} miktarını azalt`}
                                      disabled={submitting || qty <= 0}
                                      onClick={() =>
                                        setRevision(i.id, {
                                          qty: String(Math.max(0, qty - 1)),
                                        })
                                      }
                                    >
                                      <Minus size={13} />
                                    </button>
                                    <input
                                      aria-label={`${i.product?.name} onay miktarı`}
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={r.qty}
                                      onChange={(e) => {
                                        if (
                                          /^\d*$/.test(e.target.value) &&
                                          e.target.value.length <= 10
                                        )
                                          setRevision(i.id, {
                                            qty: e.target.value,
                                          });
                                      }}
                                      onBlur={() => {
                                        if (
                                          r.qty &&
                                          Number(r.qty) > i.requested_qty
                                        )
                                          setRevision(i.id, {
                                            qty: String(i.requested_qty),
                                          });
                                      }}
                                      disabled={submitting}
                                    />
                                    <button
                                      aria-label={`${i.product?.name} miktarını artır`}
                                      disabled={
                                        submitting || qty >= i.requested_qty
                                      }
                                      onClick={() =>
                                        setRevision(i.id, {
                                          qty: String(
                                            Math.min(i.requested_qty, qty + 1),
                                          ),
                                        })
                                      }
                                    >
                                      <Plus size={13} />
                                    </button>
                                    <span
                                      className={
                                        isZero
                                          ? s.zeroAmount
                                          : changed
                                            ? s.revisionDifference
                                            : s.fullAmount
                                      }
                                    >
                                      {isZero
                                        ? "İptal (0)"
                                        : changed
                                          ? `−${numberLabel(i.requested_qty - qty)} adet`
                                          : "Tam"}
                                    </span>
                                  </div>
                                  {changed && (
                                    <>
                                      <select
                                        aria-label={`${i.product?.name} revizyon gerekçesi`}
                                        value={r.reason}
                                        onChange={(e) =>
                                          setRevision(i.id, {
                                            reason: e.target.value,
                                          })
                                        }
                                        disabled={submitting}
                                        className={
                                          !reasonText(r)
                                            ? s.requiredField
                                            : undefined
                                        }
                                      >
                                        <option value="">
                                          Revizyon gerekçesi seçiniz *
                                        </option>
                                        {REASONS.map((reason) => (
                                          <option key={reason}>{reason}</option>
                                        ))}
                                      </select>
                                      {r.reason === "Diğer" && (
                                        <input
                                          aria-label={`${i.product?.name} diğer gerekçe`}
                                          placeholder="Revizyon gerekçesini yazınız…"
                                          maxLength={500}
                                          value={r.custom}
                                          onChange={(e) =>
                                            setRevision(i.id, {
                                              custom: e.target.value,
                                            })
                                          }
                                          disabled={submitting}
                                          className={
                                            !r.custom.trim()
                                              ? s.requiredField
                                              : undefined
                                          }
                                        />
                                      )}
                                    </>
                                  )}
                                </>
                              ) : (
                                <div className={s.savedQuantity}>
                                  <span
                                    className={
                                      (i.approved_qty ?? 0) === 0
                                        ? s.savedBadgeRed
                                        : (i.approved_qty ?? 0) <
                                            i.requested_qty
                                          ? s.savedBadgeAmber
                                          : s.savedBadgeGreen
                                    }
                                  >
                                    {numberLabel(i.approved_qty ?? 0)} adet
                                    onaylandı
                                  </span>
                                  {i.revision_reason && (
                                    <p>{i.revision_reason}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>

                  <p className={s.stockNote}>
                    Depo stoğu, bu depodaki stok satırlarının toplamıdır. Onay
                    işlemi stok ayırmaz veya stok düşmez; fiziki uygunluk
                    hazırlamada kontrol edilir.
                  </p>

                  {order.events.length > 0 && (
                    <section className={s.history}>
                      <h3>
                        <History size={16} />
                        İşlem Geçmişi
                      </h3>
                      {order.events.map((e) => (
                        <article key={e.id}>
                          <span
                            className={`${s.historyDot} ${
                              e.action === "REJECT" ? s.historyDotRed : ""
                            }`}
                          />
                          <div>
                            <strong>
                              {e.action === "APPROVE"
                                ? "Sipariş onaylandı"
                                : "Sipariş reddedildi"}
                            </strong>
                            <small>{dateLabel(e.created_at)}</small>
                            <p>
                              {e.employee_name} · Yetkili: {e.actor_name}
                            </p>
                            {e.note && <blockquote>{e.note}</blockquote>}
                          </div>
                        </article>
                      ))}
                    </section>
                  )}
                </section>

                <aside className={s.summary}>
                  <div className={s.summaryHead}>
                    <ShieldCheck size={17} />
                    <h3>{editable ? "Onay Özeti" : "İşlem Özeti"}</h3>
                  </div>
                  <div className={s.summaryBody}>
                    <dl className={s.summaryNumbers}>
                      <div className={s.sumBoxBlue}>
                        <dt>Talep Edilen</dt>
                        <dd>
                          {numberLabel(requested)}
                          <small>adet</small>
                        </dd>
                      </div>
                      <div className={s.sumBoxGreen}>
                        <dt>{editable ? "Onaylanacak" : "Onaylanan"}</dt>
                        <dd>
                          {numberLabel(
                            action === "REJECT" && editable ? 0 : approved,
                          )}
                          <small>adet</small>
                        </dd>
                      </div>
                      <div
                        className={
                          missingCount > 0 ? s.sumBoxRed : s.sumBoxNeutral
                        }
                      >
                        <dt>Karşılanmayan</dt>
                        <dd>
                          {numberLabel(missingCount)}
                          <small>adet</small>
                        </dd>
                      </div>
                    </dl>

                    <div className={s.fulfillment}>
                      <span>
                        Karşılama Oranı
                        <strong>%{fulfillRatio}</strong>
                      </span>
                      <div>
                        <i
                          className={
                            fulfillRatio === 100
                              ? s.barFull
                              : fulfillRatio > 0
                                ? s.barPartial
                                : s.barZero
                          }
                          style={{
                            width: `${Math.min(100, Math.max(0, fulfillRatio))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {editable ? (
                      <>
                        {action === "APPROVE" && revised > 0 && (
                          <p className={s.summaryNotice}>
                            {revised} kalemde miktar revizyonu yapıldı.
                          </p>
                        )}
                        {action === "APPROVE" && shortage > 0 && (
                          <p className={s.stockWarning}>
                            <AlertCircle size={15} />
                            <span>
                              {shortage} üründe onay miktarı görünen stoktan
                              fazla. Fiziki stoğu kontrol ediniz.
                            </span>
                          </p>
                        )}
                        <label className={s.fieldLabel}>
                          Karar
                          <select
                            value={action}
                            disabled={submitting}
                            className={
                              action === "REJECT"
                                ? s.selectReject
                                : s.selectApprove
                            }
                            onChange={(e) => {
                              setAction(e.target.value as "APPROVE" | "REJECT");
                              setDirty(true);
                              setError("");
                            }}
                          >
                            <option value="APPROVE">
                              Onayla ve gönderime al
                            </option>
                            <option value="REJECT">Siparişi reddet</option>
                          </select>
                        </label>
                        <label className={s.fieldLabel}>
                          {action === "REJECT"
                            ? "Ret Gerekçesi *"
                            : "Operasyon Notu"}
                          <textarea
                            placeholder={
                              action === "REJECT"
                                ? "Ret gerekçesini açıklayınız…"
                                : "Depoya iletilecek not (isteğe bağlı)"
                            }
                            maxLength={2000}
                            rows={3}
                            value={note}
                            disabled={submitting}
                            onChange={(e) => {
                              setNote(e.target.value);
                              setDirty(true);
                            }}
                          />
                          <small>{note.length} / 2000</small>
                        </label>
                        <label className={s.fieldLabel}>
                          İşlemi Yapan Personel ID (5 Hane)
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={5}
                            value={employee}
                            className={s.empInput}
                            onChange={(e) =>
                              setEmployee(e.target.value.replace(/\D/g, ""))
                            }
                            placeholder="00000"
                            disabled={submitting}
                          />
                        </label>
                        <p className={s.identityNote}>
                          İşlem, oturum sahibi{" "}
                          <b>{context?.actorName || "yetkili"}</b> ve girilen
                          personel adına loglanır.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className={s.savedMeta}>
                          <span>
                            İşlemi Yapan
                            <strong>{order.prepared_by_name || "—"}</strong>
                          </span>
                          <span>
                            İşlem Tarihi
                            <strong>{dateLabel(order.approved_at)}</strong>
                          </span>
                        </div>
                        {order.decision_note && (
                          <blockquote className={s.savedNote}>
                            {order.decision_note}
                          </blockquote>
                        )}
                      </>
                    )}
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>

        <footer className={s.dialogFooter}>
          <div className={s.footerInfo}>
            {error && order ? (
              <div className={s.inlineError} role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            ) : (
              <>
                <span className={s.footerCheck}>
                  <Check size={14} />
                </span>
                <span>
                  {editable
                    ? action === "REJECT"
                      ? `${order?.items.length ?? 0} kalem · sipariş gerekçesiyle reddedilecek`
                      : `${order?.items.length ?? 0} kalem · ${numberLabel(approved)} / ${numberLabel(requested)} adet karşılanacak`
                    : "Sipariş detayları ve kayıt geçmişi"}
                </span>
              </>
            )}
          </div>
          <div className={s.footerActions}>
            <button
              className={s.button}
              disabled={submitting}
              onClick={requestClose}
            >
              {editable ? "Vazgeç" : "Kapat"}
            </button>
            {editable && (
              <button
                className={
                  action === "REJECT" ? s.dangerButton : s.primaryButton
                }
                disabled={
                  loading || submitting || !order?.items.length || !employee
                }
                onClick={() => void submit()}
              >
                {submitting ? (
                  <Loader2 className={s.spin} size={16} />
                ) : action === "REJECT" ? (
                  <X size={16} />
                ) : (
                  <CheckCheck size={17} />
                )}
                <span>
                  {submitting
                    ? "Kaydediliyor…"
                    : action === "REJECT"
                      ? "Gerekçesiyle Reddet"
                      : "Onayla ve Gönderime Al"}
                </span>
                {!submitting && <ArrowRight size={15} />}
              </button>
            )}
            {order && !loading && !editable && (
              <PrintDeliveryReceiptButton
                order={order}
                warehouseName={
                  context?.warehouseName || "LEGO Online Merkez Depo"
                }
              />
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
