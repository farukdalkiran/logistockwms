"use client";

import {
  Check,
  CheckCheck,
  ClipboardCheck,
  Package,
  Truck,
} from "lucide-react";
import { dateLabel, statusOf, type Order } from "@/lib/my-orders/types";
import s from "../myorders.module.css";

const STEPS = [
  { label: "Talep alındı", icon: ClipboardCheck },
  { label: "Merkez onayı", icon: Check },
  { label: "Hazırlık", icon: Package },
  { label: "Gönderim", icon: Truck },
  { label: "Teslimat", icon: CheckCheck },
];
export default function OrderJourney({
  order,
  compact = false,
}: {
  order: Order;
  compact?: boolean;
}) {
  const info = statusOf(order.status);
  if (info.closed || info.stage < 0) return null;
  const times = [
    order.created_at,
    order.approved_at,
    order.preparing_at,
    order.shipped_at,
    order.delivered_at,
  ];
  return (
    <ol
      className={`${s.journey} ${compact ? s.journeyCompact : ""}`}
      aria-label="Sipariş süreci"
    >
      {STEPS.map(({ label, icon: Icon }, index) => {
        const complete = index < info.stage || (info.delivered && index === 4),
          current = !info.delivered && index === info.stage;
        return (
          <li
            key={label}
            className={
              complete ? s.stepDone : current ? s.stepCurrent : s.stepWaiting
            }
            aria-current={current ? "step" : undefined}
          >
            <span className={s.stepIcon}>
              {complete ? <Check size={12} /> : <Icon size={13} />}
            </span>
            <div>
              <strong>{label}</strong>
              {!compact && (
                <small>
                  {times[index]
                    ? dateLabel(times[index])
                    : current
                      ? "Devam ediyor"
                      : "—"}
                </small>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
