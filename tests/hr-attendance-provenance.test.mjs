import test from "node:test";
import assert from "node:assert/strict";
import { detectCheckInDeviceType, isCheckInDeviceType } from "../lib/attendance/record-provenance.ts";

test("telefon girişleri: iPhone, Android, Windows Phone", () => {
  for (const ua of [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S921B) Chrome/120.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950)"
  ]) assert.equal(detectCheckInDeviceType(ua), "PHONE");
});
test("PC ve tablet telefon değildir", () => {
  for (const ua of [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 13; Pixel C) AppleWebKit/537.36 Safari/537.36",
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  ]) assert.equal(detectCheckInDeviceType(ua), "DESKTOP");
});
test("yalnızca iki cihaz kodu geçerli", () => {
  for (const v of ["PHONE","DESKTOP"]) assert.equal(isCheckInDeviceType(v), true);
  for (const v of ["tablet","Mobile",null,undefined,1,""]) assert.equal(isCheckInDeviceType(v), false);
});
