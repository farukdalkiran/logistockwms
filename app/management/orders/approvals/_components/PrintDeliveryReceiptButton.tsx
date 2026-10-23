"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import type { OrderDetail } from "@/lib/order-approvals/types";
import {
  buildDeliveryReceipt,
  canPrintDeliveryReceipt,
} from "@/lib/order-approvals/delivery-receipt";
import s from "../approvals.module.css";

export default function PrintDeliveryReceiptButton({
  order,
  warehouseName,
}: {
  order: OrderDetail;
  warehouseName: string;
}) {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      cleanup.current?.();
    },
    [],
  );
  if (!canPrintDeliveryReceipt(order)) return null;
  const print = () => {
    if (cleanup.current) return;
    setPrinting(true);
    setError("");
    const frame = document.createElement("iframe");
    frame.title = `${order.order_code} A4 teslim tutanağı`;
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    frame.style.cssText =
      "position:fixed;left:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    let timeout: number | undefined;
    const finish = () => {
      if (timeout) window.clearTimeout(timeout);
      frame.remove();
      cleanup.current = null;
      setPrinting(false);
    };
    cleanup.current = finish;
    frame.onload = () => {
      try {
        const target = frame.contentWindow;
        if (!target) throw new Error("Yazdırma penceresi hazırlanamadı.");
        target.addEventListener(
          "afterprint",
          () => window.setTimeout(finish, 0),
          { once: true },
        );
        // Retain the frame while the browser print dialog is open.
        timeout = window.setTimeout(finish, 300000);
        target.focus();
        target.print();
      } catch {
        finish();
        setError("Yazdırma penceresi açılamadı. Yeniden deneyiniz.");
      }
    };
    try {
      frame.srcdoc = buildDeliveryReceipt(order, warehouseName);
      document.body.appendChild(frame);
    } catch {
      finish();
      setError("Teslim tutanağı hazırlanamadı.");
    }
  };
  return (
    <div className={s.receiptAction}>
      <button className={s.primaryButton} onClick={print} disabled={printing}>
        {printing ? (
          <Loader2 size={17} className={s.spin} />
        ) : (
          <Printer size={17} />
        )}
        <span>
          {printing ? "Yazdırma hazırlanıyor…" : "A4 teslim tutanağı yazdır"}
        </span>
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
