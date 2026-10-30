import { redirect } from "next/navigation";

// Eski bağlantıları kırmadan tüm analiz ekranlarını günlük dashboard üzerinde birleştirir.
export default function PerformanceRedirect() {
  redirect("/management/eksik-parca/dashboard");
}
