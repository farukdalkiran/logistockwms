// User-Agent is a browser-reported approximation, not authenticated hardware proof.
export type CheckInDeviceType = "PHONE" | "DESKTOP";
export function detectCheckInDeviceType(userAgent: string): CheckInDeviceType {
  return /iPhone|iPod|Windows Phone|IEMobile|Android.*Mobile|Mobile.*Android|webOS|BlackBerry|BB10|Opera Mini/i.test(userAgent)
    ? "PHONE" : "DESKTOP";
}
export function isCheckInDeviceType(value: unknown): value is CheckInDeviceType {
  return value === "PHONE" || value === "DESKTOP";
}
