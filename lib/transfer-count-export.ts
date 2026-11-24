import { supabase } from "@/lib/supabase";
import { countReportRows, downloadCountWorkbook, type CountReport } from "@/lib/transfer-count-excel";

// The browser can confirm that the download was initiated, not that the user saved the file.
export async function downloadLoggedCountWorkbook(
  report: CountReport,
  actor: { employeeId: string; branchId: string | null },
): Promise<boolean> {
  downloadCountWorkbook(report);
  const rows = countReportRows(report.lines, report.partial);
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  const kind = report.partial ? "Ara sayım" : "Nihai sayım";
  try {
    const { error } = await supabase.from("transaction_logs").insert({
      employee_id: actor.employeeId && actor.employeeId !== "BİLİNMİYOR" ? actor.employeeId : null,
      branch_id: actor.branchId,
      action_type: "TRANSFER_EXCEL_EXPORT",
      description: `${report.code} · ${kind} Excel çıktısı alındı · ${rows.length} kalem / ${total} adet`,
    });
    if (error) {
      console.error("Excel işlem kaydı oluşturulamadı:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Excel işlem kaydı oluşturulamadı:", error);
    return false;
  }
}
