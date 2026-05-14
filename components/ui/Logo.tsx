import { clsx } from "clsx";

export const Logo = ({ variant = "primary", className }: { variant?: "primary" | "secondary", className?: string }) => {
  return (
    <span className={clsx("logistock-logo", variant, className)}>
      LogiStock
    </span>
  );
};