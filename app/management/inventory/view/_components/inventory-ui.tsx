"use client";

import { Check, Copy, AlertTriangle, Layers, PackageOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { InventoryProduct } from "@/lib/inventory-types";
export type AggregatedProduct = InventoryProduct;

export const number = (value: number) =>
  new Intl.NumberFormat("tr-TR").format(value);
export const fold = (value: string) => value.toLocaleLowerCase("tr-TR");
export const control =
  "min-h-10 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dc3545] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

export function CopyCode({
  value,
  label = "Barkodu kopyala",
}: {
  value: string | null;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  if (!value) return <span className="text-sm text-slate-400">Barkod yok</span>;
  return (
    <button
      type="button"
      title={status === "copied" ? "Kopyalandı" : label}
      aria-label={`${label}: ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setStatus("copied");
        } catch {
          setStatus("error");
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus("idle"), 2000);
      }}
      className="relative inline-flex min-h-8 max-w-full items-center gap-2 rounded-sm px-1.5 text-left font-mono text-xs font-medium text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <span className="break-all">{value}</span>
      {status === "copied" ? (
        <Check size={13} className="shrink-0 text-emerald-600" />
      ) : (
        <Copy size={13} className="shrink-0 opacity-50" />
      )}
      <span
        role="status"
        className={
          status === "error" ? "font-sans text-xs text-red-600" : "sr-only"
        }
      >
        {status === "copied"
          ? "Kopyalandı"
          : status === "error"
            ? "Kopyalanamadı"
            : ""}
      </span>
    </button>
  );
}

export function StockBadge({ item }: { item: AggregatedProduct }) {
  if (item.total_quantity <= 0)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">
        <PackageOpen size={13} /> Stok yok
      </span>
    );
  if (item.has_damaged_shelf)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
        <AlertTriangle size={13} /> Hasarlı rafta
      </span>
    );
  if (item.shelf_count > 0)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
        <Layers size={13} /> Aktif rafta
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
      <Layers size={13} /> Raf bilgisi yok
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 rounded-sm border border-slate-200 bg-slate-50 p-4">
        <PackageOpen size={28} className="text-slate-400" />
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export function LoadingRows() {
  return (
    <div
      role="status"
      aria-label="Stoklar yükleniyor"
      className="space-y-0 divide-y divide-slate-100 motion-safe:animate-pulse"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-slate-100" />
            <div className="h-2.5 w-1/3 rounded bg-slate-100" />
          </div>
          <div className="h-7 w-16 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function ProductImage({
  src,
  name,
  className = "",
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const valid = src && /^(https?:\/\/|data:image\/)/i.test(src);
  return (
    <div
      className={`flex items-center justify-center overflow-hidden border border-slate-200 bg-white ${className}`}
    >
      {valid && !failed ? (
        <img
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-4"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 p-4 text-center text-xs text-slate-400">
          <PackageOpen size={32} strokeWidth={1.3} />
          <span>Ürün görseli bulunamadı</span>
        </div>
      )}
    </div>
  );
}
