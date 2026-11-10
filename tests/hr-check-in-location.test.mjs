import test from "node:test";
import assert from "node:assert/strict";
import { CHECK_IN_LOCATIONS, getCheckInLocationName, isCheckInLocationCode } from "../lib/attendance/check-in-location.ts";

test("fiziksel giriş noktalarının kodları MD, AD ve OO olarak sabittir", () => {
  assert.deepEqual(CHECK_IN_LOCATIONS.map((location) => location.code), ["MD", "AD", "OO"]);
  assert.equal(getCheckInLocationName("MD"), "Maltepe");
  assert.equal(getCheckInLocationName("AD"), "Anatolium Depo");
  assert.equal(getCheckInLocationName("OO"), "Online Ofis");
});

test("geçersiz veya eski kayıtlardaki boş değerler giriş konumu değildir", () => {
  for (const value of [null, undefined, "", "AB", "md", "Online Depo", 12]) {
    assert.equal(isCheckInLocationCode(value), false);
    assert.equal(getCheckInLocationName(value), null);
  }
  for (const value of ["MD", "AD", "OO"]) assert.equal(isCheckInLocationCode(value), true);
});
