import assert from "node:assert/strict";
import test from "node:test";
import { parseSessionWeek } from "@/domain/session-week";
import { publicScheduleSelection } from "@/domain/public-coach-schedule";
import {
  publicScheduleTimeLabel,
  publicScheduleTimeRange,
} from "@/features/coaches/public-schedule-model";

const now = "2026-10-24T22:30:00.000Z";
function fixture(date = "2026-10-25", referenceTime = now) {
  const selection = publicScheduleSelection(date, referenceTime);
  return {
    referenceTime,
    resetToCurrent: !selection.inHorizon,
    days: selection.dates.map((day) => ({
      date: day,
      times: [{ startsAt: `${day}T09:00:00Z`, endsAt: `${day}T10:00:00Z` }],
    })),
  };
}
test("weekly reads preserve every Berlin date across DST and the final two-date page", () => {
  for (const [referenceTime, date] of [
    [now, "2026-10-25"],
    ["2026-03-28T23:30:00Z", "2026-03-29"],
    ["2026-12-31T23:30:00Z", "2027-01-01"],
    ["2028-02-28T23:30:00Z", "2028-02-29"],
  ]) {
    const first = fixture(date, referenceTime);
    assert.equal(parseSessionWeek(first, date, 60).days.length, 7);
    const lastDate = publicScheduleSelection(undefined, referenceTime).through;
    assert.equal(
      parseSessionWeek(fixture(lastDate, referenceTime), lastDate).days.length,
      2,
    );
  }
  const expired = parseSessionWeek(
    { ...fixture(), resetToCurrent: true },
    "2026-10-24",
  );
  assert.equal(expired.resetToCurrent, true);
  assert.equal(expired.days[0].date, "2026-10-25");
});
test("a missing, reordered, duplicate, oversized or corrupt day fails the whole week", () => {
  const good = fixture();
  for (const days of [
    good.days.slice(1),
    [...good.days].reverse(),
    [...good.days, good.days[0]],
    good.days.map((day, i) =>
      i === 1 ? { ...day, date: good.days[0].date } : day,
    ),
    good.days.map((day, i) => (i === 1 ? { ...day, times: null } : day)),
    good.days.map((day, i) =>
      i === 1 ? { ...day, times: Array(101).fill(day.times[0]) } : day,
    ),
  ]) {
    assert.throws(() => parseSessionWeek({ ...good, days }, "2026-10-25"));
  }
  assert.throws(() =>
    parseSessionWeek({ ...good, resetToCurrent: true }, "2026-10-25"),
  );
  assert.throws(() =>
    parseSessionWeek({ ...good, referenceTime: "not-a-clock" }, "2026-10-25"),
  );
});
test("times reject past starts, wrong days, duplicate instants, broken duration and off-grid starts", () => {
  for (const times of [
    [{ startsAt: now, endsAt: "2026-10-24T23:30:00Z" }],
    [{ startsAt: "2026-10-26T09:00:00Z", endsAt: "2026-10-26T10:00:00Z" }],
    [fixture().days[0].times[0], fixture().days[0].times[0]],
    [{ startsAt: "2026-10-25T09:00:00Z", endsAt: "2026-10-25T09:45:00Z" }],
    [{ startsAt: "2026-10-25T09:01:00Z", endsAt: "2026-10-25T10:01:00Z" }],
    [{ startsAt: "broken", endsAt: "broken" }],
    [null],
  ]) {
    const value = fixture();
    assert.throws(() =>
      parseSessionWeek(
        {
          ...value,
          days: [{ date: value.days[0].date, times }, ...value.days.slice(1)],
        },
        "2026-10-25",
      ),
    );
  }
  assert.throws(() => parseSessionWeek(fixture(), "2026-10-25", 90));
  assert.equal(
    parseSessionWeek(
      {
        ...fixture(),
        days: fixture().days.map((day) => ({ ...day, times: [] })),
      },
      "2026-10-25",
    ).days.length,
    7,
  );
});
test("repeated autumn hours remain distinct instants and offset-changing sessions are readable", () => {
  const value = fixture();
  value.days[0].times = [
    { startsAt: "2026-10-25T00:00:00Z", endsAt: "2026-10-25T01:00:00Z" },
    { startsAt: "2026-10-25T01:00:00Z", endsAt: "2026-10-25T02:00:00Z" },
  ];
  assert.equal(
    parseSessionWeek(value, "2026-10-25", 60).days[0].times.length,
    2,
  );
  assert.notEqual(
    publicScheduleTimeLabel(value.days[0].times[0].startsAt, true),
    publicScheduleTimeLabel(value.days[0].times[1].startsAt, true),
  );
  assert.equal(
    publicScheduleTimeRange("2026-10-25T00:00:00Z", "2026-10-25T01:00:00Z"),
    "02:00 GMT+2–02:00 GMT+1",
  );
  assert.equal(
    publicScheduleTimeRange("2026-10-26T09:00:00Z", "2026-10-26T10:00:00Z"),
    "10:00–11:00",
  );
});
