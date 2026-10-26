import type { ReactNode } from "react";
import OrdersNavigation from "./_components/OrdersNavigation";
import "./orders-theme.css";

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="orders-suite">
      <OrdersNavigation />
      {children}
    </div>
  );
}
