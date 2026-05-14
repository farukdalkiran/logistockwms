// components/ui/Button.tsx
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  isLoading?: boolean;
}

export const Button = ({ variant = 'primary', isLoading, className, children, ...props }: ButtonProps) => {
  const baseStyles = "h-12 px-6 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100";
  
  const variants = {
    primary: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] shadow-md",
    outline: "border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10",
    ghost: "text-slate-600 hover:bg-slate-100"
  };

  return (
    <button 
      className={twMerge(clsx(baseStyles, variants[variant]), className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : children}
    </button>
  );
};