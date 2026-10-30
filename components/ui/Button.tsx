import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  variant = "primary", size = "md", isLoading = false,
  className, children, disabled, type = "button", ...props
}: ButtonProps) {
  const variants = {
    primary: "border-transparent bg-[#dc3545] text-white hover:bg-[#bd2635] focus-visible:ring-red-200",
    secondary: "border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200",
    outline: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
    danger: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  };
  const sizes = {
    sm: "min-h-9 px-3 py-1.5 text-xs",
    md: "min-h-10 px-4 py-2 text-sm",
    lg: "min-h-11 px-5 py-2.5 text-sm",
  };
  return (
    <button
      {...props}
      type={type}
      className={twMerge(clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-[5px] border font-semibold",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant], sizes[size],
      ), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
