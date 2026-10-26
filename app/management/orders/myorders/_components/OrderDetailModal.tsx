"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CalendarDays,
  FileText,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Truck,
  UserRound,
  Warehouse,
  CheckCircle2,
  X,
} from "lucide-react";
import { confirmMyOrderReceived, getMyOrderDetail } from "@/app/actions/my-orders";
import {
  dateLabel,
  hasDecision,
  isPending,
  quantity,
  type Order,
} from "@/lib/my-orders/types";
import {
  ItemDecision,
  OrderKind,
  OrderStatus,
} from "./OrderCard";
import OrderJourney from "./OrderJourney";
import s from "../myorders.module.css";

export default function OrderDetailModal({
  orderId,
  close,
}: {
  orderId: string;
  close: () => void;
}) {
  const [mounted, setMounted] = useState(false),
    [order, setOrder] = useState<Order | null>(null),
    [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [receiptFeedback, setReceiptFeedback] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const dialog = useRef<HTMLDivElement>(null),
    sequence = useRef(0),
    closeRef = useRef(close);
  closeRef.current = close;
  const load = useCallback(
    async (silent = false) => {
      const id = ++sequence.current;
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const r = await getMyOrderDetail(orderId);
        if (id !== sequence.current) return;
        if (!r.ok) throw new Error(r.error);
        setOrder(r.data.order);
        setBranch(r.data.branchName);
        setError("");
      } catch (e) {
        if (id === sequence.current)
          setError(
            e instanceof Error ? e.message : "Sipariş detayı alınamadı.",
          );
      } finally {
        if (id === sequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [orderId],
  );
  const receive = async () => {
    if (!order || order.status !== "READY_TO_SHIP" || receiving) return;
    setReceiving(true);
    setReceiptError("");
    try {
      const result = await confirmMyOrderReceived(order.id);
      if (!result.ok) throw new Error(result.error);
      setConfirmOpen(false);
      setReceiptFeedback("Sipariş tamamlandı olarak güncellendi.");
      await load(true);
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : "Sipariş tamamlanamadı.");
    } finally {
      setReceiving(false);
    }
  };
  useEffect(() => {
    setMounted(true);
    setConfirmOpen(false);
    setReceiptFeedback("");
    setReceiptError("");
    void load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!mounted) return;
    const old = document.body.style.overflow,
      previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const nodes = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
          ) ?? [],
        ).filter((n) => n.getClientRects().length > 0),
        first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [mounted]);
  if (!mounted) return null;
  const decided = order ? hasDecision(order) : false;
  return createPortal(
    <div
      className={s.overlay}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) close();
      }}
    >
      <div
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-order-title"
        tabIndex={-1}
        ref={dialog}
      >
        <header className={s.dialogHeader}>
          <div>
            <span>SİPARİŞ DETAYI</span>
            <h2 id="my-order-title">
              {order?.order_code || "Sipariş bilgileri"}
            </h2>
          </div>
          <div className={s.dialogHeaderActions}>
            {order && <OrderKind order={order} />}
            <button
              onClick={close}
              aria-label="Sipariş detayını kapat"
              className={s.closeButton}
            >
              <X size={21} />
            </button>
          </div>
        </header>
        <div className={s.dialogScroll}>
          {error && (
            <div className={s.error} role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => void load()}>Tekrar dene</button>
            </div>
          )}
          {loading ? (
            <div className={s.empty} role="status">
              <Loader2 className={s.spin} size={29} />
              <strong>Sipariş detayları getiriliyor</strong>
            </div>
          ) : order ? (
            <>
              <div className={s.detailStatus}>
                <div>
                  <OrderStatus order={order} large />
                  <p>
                    Güncel sipariş durumunuz ve merkez depo tarafından
                    kaydedilen miktarlar.
                  </p>
                </div>
                <button
                  className={s.button}
                  disabled={refreshing}
                  onClick={() => void load(true)}
                >
                  <RefreshCw
                    size={14}
                    className={refreshing ? s.spin : undefined}
                  />
                  Durumu yenile
                </button>
              </div>
              {order.status === "READY_TO_SHIP" && (
                <section className={s.receiptPanel} aria-label="Teslimat onayı">
                  <div className={s.receiptInfo}>
                    <CheckCircle2 size={25} />
                    <div>
                      <strong>Ürünler mağazanıza ulaştı mı?</strong>
                      <p>Ürünleri ve adetleri kontrol ettiyseniz siparişi tamamlandı olarak işaretleyebilirsiniz.</p>
                    </div>
                  </div>
                  {receiptError && <p role="alert" className={s.receiptError}>{receiptError}</p>}
                  {confirmOpen ? (
                    <div className={s.receiptConfirm}>
                      <p><strong>{order.order_code}</strong> siparişinin tamamını teslim aldığınızı onaylıyor musunuz? İşlem geri alınamaz.</p>
                      <div>
                        <button type="button" className={s.receiptCancel} disabled={receiving} onClick={() => setConfirmOpen(false)}>Vazgeç</button>
                        <button type="button" className={s.receiptButton} disabled={receiving} onClick={() => void receive()}>
                          {receiving ? <Loader2 size={16} className={s.spin} /> : <CheckCircle2 size={16} />}
                          {receiving ? "Kaydediliyor…" : "Evet, siparişi tamamla"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={s.receiptButton} onClick={() => setConfirmOpen(true)}>
                      <CheckCircle2 size={17} /> Siparişi teslim aldım
                    </button>
                  )}
                </section>
              )}
              {receiptFeedback && <p className={s.receiptSuccess} role="status"><CheckCircle2 size={16} />{receiptFeedback}</p>}
              <OrderJourney order={order} />
              <section className={s.detailSummary}>
                <div>
                  <span>Talep edilen</span>
                  <strong>
                    {quantity(order.requested_total)}
                    <small>adet</small>
                  </strong>
                </div>
                <div>
                  <span>Onaylanan</span>
                  <strong>
                    {decided && order.approved_total !== null
                      ? quantity(order.approved_total)
                      : "Bekleniyor"}
                    {decided && order.approved_total !== null && (
                      <small>adet</small>
                    )}
                  </strong>
                </div>
                <div>
                  <span>Revize edilen</span>
                  <strong>
                    {decided ? quantity(order.revised_count) : "—"}
                    <small>kalem</small>
                  </strong>
                </div>
                <div>
                  <span>Sipariş içeriği</span>
                  <strong>
                    {quantity(order.item_count)}
                    <small>kalem</small>
                  </strong>
                </div>
              </section>
              {order.decision_note && (
                <div className={s.detailNote}>
                  <FileText size={17} />
                  <div>
                    <strong>Merkez depo açıklaması</strong>
                    <p>{order.decision_note}</p>
                  </div>
                </div>
              )}
              <section className={s.detailProducts}>
                <header>
                  <h3>
                    <Package size={17} />
                    Ürünler ve revizyonlar
                  </h3>
                  <span>{order.items.length} kalem</span>
                </header>
                <div className={s.detailTableWrap} role="region" aria-label="Sipariş kalemleri tablosu" tabIndex={0}>
                  <table className={s.detailTable}>
                    <thead>
                      <tr>
                        <th scope="col">Ürün adı / Kod</th>
                        <th scope="col">Tür</th>
                        <th scope="col">Talep</th>
                        <th scope="col">Onay</th>
                        <th scope="col">Eksik</th>
                        <th scope="col">Durum / Revizyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => {
                        const hasApproved = decided && item.approved_qty !== null;
                        const missing = hasApproved
                          ? Math.max(0, item.requested_qty - (item.approved_qty ?? 0))
                          : null;
                        return (
                          <tr
                            key={item.id}
                            className={missing !== null && missing > 0 ? s.revisedRow : undefined}
                          >
                            <td>
                              <div className={s.compactProduct}>
                                <strong title={item.product?.name || "Ürün bilgisi bulunamadı"}>
                                  {item.product?.name || "Ürün bilgisi bulunamadı"}
                                </strong>
                                <span>
                                  {item.product?.sku || "SKU yok"}
                                  {item.product?.barcode ? " · " + item.product.barcode : ""}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={item.product?.is_consumable ? s.compactSupply : s.compactType}>
                                {item.product?.is_consumable ? "Sarf" : "Ürün"}
                              </span>
                            </td>
                            <td className={s.compactNumber}>{quantity(item.requested_qty)}</td>
                            <td className={s.compactNumber}>
                              {hasApproved ? quantity(item.approved_qty ?? 0) : "—"}
                            </td>
                            <td className={s.compactNumber}>
                              {missing === null ? "—" : quantity(missing)}
                            </td>
                            <td>
                              <div className={s.compactDecision}>
                                <ItemDecision order={order} item={item} />
                                {hasApproved && item.revision_reason && (
                                  <span className={s.compactReason} title={item.revision_reason}>
                                    {item.revision_reason}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!order.items.length && (
                  <div className={s.empty}>
                    <Package size={26} />
                    <p>Siparişte ürün kalemi bulunamadı.</p>
                  </div>
                )}
              </section>
              <div className={s.operationDetails}>
                <section>
                  <h3>Talep ve operasyon bilgileri</h3>
                  <dl>
                    <div>
                      <dt>
                        <MapPin size={14} />
                        Talep eden şube
                      </dt>
                      <dd>{branch}</dd>
                    </div>
                    <div>
                      <dt>
                        <UserRound size={14} />
                        Talep eden kişi
                      </dt>
                      <dd>{order.requester_name}</dd>
                    </div>
                    <div>
                      <dt>
                        <CalendarDays size={14} />
                        Talep tarihi
                      </dt>
                      <dd>{dateLabel(order.created_at)}</dd>
                    </div>
                    <div>
                      <dt>
                        <Warehouse size={14} />
                        İşlem deposu
                      </dt>
                      <dd>{order.warehouse_name || "Henüz atanmadı"}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h3>Merkez depo ve gönderim</h3>
                  <dl>
                    <div>
                      <dt>
                        <UserRound size={14} />
                        Merkez işlemini yapan
                      </dt>
                      <dd>{order.prepared_by_name || "İşlem bekleniyor"}</dd>
                    </div>
                    <div>
                      <dt>
                        <CalendarDays size={14} />
                        {order.status === "REJECTED"
                          ? "Ret tarihi"
                          : "Onay tarihi"}
                      </dt>
                      <dd>
                        {!isPending(order)
                          ? dateLabel(order.approved_at)
                          : "Bekleniyor"}
                      </dd>
                    </div>
                    {order.shipped_at && (
                      <div>
                        <dt>
                          <Truck size={14} />
                          Sevk tarihi
                        </dt>
                        <dd>{dateLabel(order.shipped_at)}</dd>
                      </div>
                    )}
                    {order.delivered_at && (
                      <div>
                        <dt>
                          <Package size={14} />
                          Teslim tarihi
                        </dt>
                        <dd>{dateLabel(order.delivered_at)}</dd>
                      </div>
                    )}
                    {order.carrier_name && (
                      <div>
                        <dt>
                          <Truck size={14} />
                          Taşıyıcı
                        </dt>
                        <dd>{order.carrier_name}</dd>
                      </div>
                    )}
                    {order.tracking_number && (
                      <div>
                        <dt>Takip / Belge numarası</dt>
                        <dd>{order.tracking_number}</dd>
                      </div>
                    )}
                  </dl>
                  {!order.shipped_at && !order.delivered_at && order.status !== "COMPLETED" && (
                    <p className={s.operationHint}>
                      Sevk ve teslim tarihleri kaydedildiğinde burada görünür.
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </div>
        <footer className={s.dialogFooter}>
          <span>
            Bu ekranda siparişlerinizin güncel kayıtlarını görüntülüyorsunuz.
          </span>
          <button className={s.button} onClick={close}>
            Kapat
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
