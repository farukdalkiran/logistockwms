import { clsx } from "clsx";

export const Logo = ({ 
  variant = "primary", 
  className 
}: { 
  variant?: "primary" | "secondary" | "white" | "black" | "dark", 
  className?: string 
}) => {
  
  // Variant'ları Tailwind class'larına haritalandırıyoruz (Mapping)
  const variantStyles = {
    primary: "text-[#dc3545]",       // Marka kırmızısı
    secondary: "text-white",     // Pasif/ikincil gri
    white: "text-white",             // Temiz beyaz (Aranan çözüm)
    black: "text-black",             // Saf siyah
    dark: "text-[#0f172b]"           // Endüstriyel WMS dark
  };

  return (
    <span className={clsx("logistock-logo font-black tracking-tight", variantStyles[variant], className)}>
      LogiStock
    </span>
  );
};