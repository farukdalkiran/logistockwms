/** Immutable customer contact snapshot saved with the processed cargo record. */
export type CargoContactFields = {
  email: string | null;
  street: string | null;
  street_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
};

const CONTACT_FIELDS: (keyof CargoContactFields)[] = [
  "email", "street", "street_2", "city", "region", "postal_code", "country",
];

function textOrNull(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return text || null;
}

/**
 * Takes freshly uploaded source fields, preserving previously captured values
 * whenever the latest source row omits a field.
 */
export function buildCargoContactSnapshot(
  source: Partial<CargoContactFields>,
  previous: Partial<CargoContactFields> = {},
): CargoContactFields {
  const snapshot = {} as CargoContactFields;
  for (const field of CONTACT_FIELDS) {
    snapshot[field] = textOrNull(source[field]) ?? textOrNull(previous[field]);
  }
  return snapshot;
}

/** Formatted from the record itself, independent of the uploaded ERP Excel. */
export function formatCargoRecordAddress(fields: Partial<CargoContactFields>): string {
  return [
    fields.street,
    fields.street_2,
    fields.region,
    fields.city,
    fields.postal_code,
    fields.country,
  ].map(textOrNull).filter(Boolean).join(", ");
}
