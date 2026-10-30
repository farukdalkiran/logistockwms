import { redirect } from "next/navigation";
import { fetchAdminAccounts } from "@/app/actions/user";
import PasswordAccountsClient from "./_components/PasswordAccountsClient";

export default async function PasswordAccessPage() {
  const result = await fetchAdminAccounts();
  if (!result.success) {
    if (result.error === "İşlem için oturum açmalısınız.") redirect("/login");
    redirect("/management/unauthorized");
  }
  return <PasswordAccountsClient initial={result} />;
}
