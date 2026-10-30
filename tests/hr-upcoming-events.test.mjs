import test from "node:test";
import assert from "node:assert/strict";
import { getIstanbulToday, getUpcomingEmployeeEvents } from "../lib/hr/upcoming-events.ts";

function person(id, birthday = null, birthday_month_day = null, employment_date = null) {
  return { id, full_name: `Personel ${id}`, birthday, birthday_month_day, employment_date };
}

test("Istanbul date accounts for UTC+3 midnight", () => {
  assert.equal(getIstanbulToday(new Date("2026-10-29T22:00:00Z")), "2026-10-30");
});

test("birthday reminders sort by next calendar occurrence", () => {
  const events = getUpcomingEmployeeEvents([
    person("10001", "1998-11-17"),
    person("10002", "1993-11-21"),
    person("10003", "1994-11-26"),
  ], "2026-10-30");
  assert.deepEqual(events.map(e => e.daysUntil), [18, 22, 27]);
  assert.ok(events.every(e => e.kind === "birthday"));
});

test("unknown birth year remains absent and still gets annual reminders", () => {
  const [event] = getUpcomingEmployeeEvents([person("10001", null, "01-01")], "2026-12-31");
  assert.equal(event.daysUntil, 1);
  assert.equal(event.kind, "birthday");
  assert.equal("years" in event, false);
});

test("work anniversary shows completed years, not employee age", () => {
  const [event] = getUpcomingEmployeeEvents([person("10001", null, null, "2020-11-02")], "2026-10-30");
  assert.equal(event.years, 6);
  assert.equal(event.daysUntil, 3);
  assert.equal(event.kind, "anniversary");
});

test("future hires are not shown as work anniversaries", () => {
  assert.deepEqual(getUpcomingEmployeeEvents([person("10001", null, null, "2026-11-03")], "2026-10-30"), []);
});

test("year crossover, today labels and invalid month days", () => {
  const list = getUpcomingEmployeeEvents([
    person("10001", "2000-01-01"),
    person("10002", null, "02-31"),
    person("10003", "2000-12-30"),
  ], "2026-12-30");
  assert.deepEqual(list.map(e => e.daysUntil), [0, 2]);
});

test("90-day lookahead prevents distant events from filling the panel", () => {
  assert.equal(getUpcomingEmployeeEvents([person("10001", "1990-08-03")], "2026-10-30", 90).length, 0);
});

test("leap-day dates are only shown on real calendar dates", () => {
  const e = getUpcomingEmployeeEvents([person("10001", "2000-02-29")], "2027-12-31", 120);
  assert.equal(e.length, 1);
  assert.equal(e[0].date, "2028-02-29");
});
