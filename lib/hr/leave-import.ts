export type LeaveSheetEmployee = {
  id: string; full_name: string; is_active: boolean;
  leave_balance: number | null; employment_date: string | null;
};

export type LeaveSheetChange<T extends LeaveSheetEmployee> = {
  employee: T; newBalance: number; newDate: string | null;
};

const clean = (v: unknown) => String(v ?? "").trim();

export function parseLeaveAmount(value: unknown): number {
  if (value === null || value === undefined || clean(value) === "") return NaN;
  const text = typeof value === "number" ? String(value) : clean(value).replace(",", ".");
  return Number(text);
}

export function parseLeaveHireDate(value: unknown): string | null {
  if (value === null || value === undefined || clean(value) === "") return null;
  if (typeof value === "number") {
    const d = new Date(Math.round((value - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const str = clean(value);
  const match = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : str;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T12:00:00Z");
  return !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function previewLeaveImport<T extends LeaveSheetEmployee>(
  rows: Record<string, unknown>[], employees: T[],
): { changes: LeaveSheetChange<T>[]; issues: string[] } {
  if (rows.length > 250) throw new Error("Bir şablonda en fazla 250 personel olabilir.");
  const byId = new Map(employees.map(e => [e.id, e]));
  const seen = new Set<string>();
  const changes: LeaveSheetChange<T>[] = [];
  const issues: string[] = [];
  rows.forEach((row, index) => {
    const line = index + 2;
    const rawId = row["PERSONEL ID"];
    // Excel can convert 00005 to number 5. Preserve the existing 5-character employee ID.
    const id = typeof rawId === "number" && Number.isInteger(rawId)
      ? String(rawId).padStart(5, "0") : clean(rawId);
    if (!id && !clean(row["PERSONEL ADI SOYADI"])) return;
    if (!/^\d{5}$/.test(id)) {
      issues.push(`Satır ${line}: PERSONEL ID tam 5 haneli olmalı.`);
      return;
    }
    if (seen.has(id)) {
      issues.push(`Satır ${line}: ${id} birden fazla kez kullanılmış.`);
      return;
    }
    seen.add(id);
    const employee = byId.get(id);
    if (!employee) {
      issues.push(`Satır ${line}: ${id} kayıtlı değil veya şubenizde bulunmuyor.`);
      return;
    }
    if (!employee.is_active) {
      issues.push(`Satır ${line}: ${id} pasif personel.`);
      return;
    }
    if (clean(row["PERSONEL ADI SOYADI"]).toLocaleLowerCase("tr-TR") !==
      employee.full_name.toLocaleLowerCase("tr-TR")) {
      issues.push(`Satır ${line}: ${id} isim eşleşmiyor.`);
      return;
    }
    const amount = parseLeaveAmount(row["KALAN İZİN (DÜZENLE)"]);
    if (!Number.isFinite(amount) || amount < -14 || amount > 999 ||
      Math.round(amount * 100) !== amount * 100) {
      issues.push(`Satır ${line}: İzin bakiyesi -14 ile 999 arasında geçerli sayı olmalı.`);
      return;
    }
    const rawDate = row["İŞE GİRİŞ TARİHİ"];
    const date = parseLeaveHireDate(rawDate);
    if (clean(rawDate) && !date) {
      issues.push(`Satır ${line}: İşe giriş tarihi geçersiz.`);
      return;
    }
    if (employee.leave_balance !== amount || (date && date !== employee.employment_date)) {
      changes.push({ employee, newBalance: amount, newDate: date });
    }
  });
  return { changes, issues };
}
