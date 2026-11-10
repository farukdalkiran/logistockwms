// Fiziksel giriş yapılan terminal konumları: personelin kayıtlı şubesi değildir.
export const CHECK_IN_LOCATIONS = [
  { code: "MD", label: "Maltepe" },
  { code: "AD", label: "Anatolium Depo" },
  { code: "OO", label: "Online Ofis" },
] as const;

export type CheckInLocationCode = (typeof CHECK_IN_LOCATIONS)[number]["code"];
export const CHECK_IN_LOCATION_STORAGE_KEY = "logistock:hr:check-in-location:v1";

export function isCheckInLocationCode(value: unknown): value is CheckInLocationCode {
  return typeof value === "string" && CHECK_IN_LOCATIONS.some((location) => location.code === value);
}

export function getCheckInLocationName(value: unknown): string | null {
  return CHECK_IN_LOCATIONS.find((location) => location.code === value)?.label ?? null;
}
