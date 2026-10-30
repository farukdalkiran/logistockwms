import type { HTMLAttributes, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export const wmsStyles = {
  card: "wms-card",
  field: "wms-field",
  label: "wms-field-label",
  table: "wms-table",
  tableScroll: "wms-table-scroll",
  filterBar: "wms-filter-bar",
  page: "wms-page",
} as const;

export function WmsPageHeader({
  title, eyebrow, description, actions, className,
}: {
  title: string; eyebrow?: string; description?: string; actions?: ReactNode; className?: string;
}) {
  return (
    <header className={twMerge("wms-page-header", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <span className="wms-eyebrow">{eyebrow}</span>}
        <h1 className="wms-page-title">{title}</h1>
        {description && <p className="wms-description">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function WmsCard({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={twMerge("wms-card", className)} {...props}>{children}</section>;
}

export function WmsCardHeader({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <div className="wms-card-header">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function WmsFilterBar({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge("wms-filter-bar", className)} {...props}>{children}</div>;
}

export function WmsTableScroll({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={twMerge("wms-table-scroll", className)} {...props}>{children}</div>;
}

export function WmsTable({ children, className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={twMerge("wms-table", className)} {...props}>{children}</table>;
}

export function WmsBadge({ children, tone = "neutral", className }: {
  children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info"; className?: string;
}) {
  return <span className={twMerge(clsx("wms-badge", "wms-badge-" + tone), className)}>{children}</span>;
}

export function WmsMetric({ label, value, caption, className }: {
  label: string; value: ReactNode; caption?: string; className?: string;
}) {
  return (
    <WmsCard className={twMerge("p-4 md:p-5", className)}>
      <p className="wms-metric-label">{label}</p>
      <div className="wms-metric-value">{value}</div>
      {caption && <p className="mt-2 text-xs text-slate-500">{caption}</p>}
    </WmsCard>
  );
}

export function WmsEmptyState({ title = "Henüz kayıt bulunmuyor", description, action, className }: {
  title?: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={twMerge("wms-empty-state", className)} role="status">
      <Inbox size={28} strokeWidth={1.5} aria-hidden="true" />
      <h3>{title}</h3>
      {description && <p className="max-w-md text-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
