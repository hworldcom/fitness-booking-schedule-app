import assert from "node:assert/strict";
import test from "node:test";
import {
  berlinAvailabilityDate,
  expandAvailabilityRanges,
  isAvailabilityDate,
} from "@/domain/effective-availability";

const venue = {
  locationId: "10000000-0000-4000-8000-000000000001",
  locationUpdatedAt: "2026-10-16T10:00:00.123456+00:00",
};
test("availability ranges preserve reviewed venue versions and expand adjacent whole hours", () => {
  const hours = expandAvailabilityRanges([
    { ...venue, startTime: "09:00", endTime: "12:00" },
    { ...venue, startTime: "22:00", endTime: "23:00" },
  ]);
  assert.deepEqual(
    hours.map((h) => h.localStartTime),
    ["09:00", "10:00", "11:00", "22:00"],
  );
  assert.ok(
    hours.every((h) => h.locationUpdatedAt === venue.locationUpdatedAt),
  );
});
test("ranges reject cross-venue overlaps, overnight and fractional-hour drafts", () => {
  assert.throws(() =>
    expandAvailabilityRanges([
      { ...venue, startTime: "09:00", endTime: "11:00" },
      {
        ...venue,
        locationId: "20000000-0000-4000-8000-000000000002",
        startTime: "10:00",
        endTime: "12:00",
      },
    ]),
  );
  for (const [startTime, endTime] of [
    ["22:00", "01:00"],
    ["09:30", "10:30"],
    ["23:00", "24:00"],
    ["10:00", "10:00"],
  ])
    assert.throws(() =>
      expandAvailabilityRanges([{ ...venue, startTime, endTime }]),
    );
});
test("availability dates reject normalized invalid dates and accept leap days", () => {
  assert.equal(isAvailabilityDate("2028-02-29"), true);
  for (const date of ["2027-02-29", "2026-04-31", "2026-1-01", "invalid"])
    assert.equal(isAvailabilityDate(date), false);
});

test("Berlin calendar dates follow local midnight and both daylight-saving transitions", () => {
  for (const [instant, expected] of [
    ["2026-01-31T22:59:59.999Z", "2026-01-31"],
    ["2026-01-31T23:00:00Z", "2026-02-01"],
    ["2026-07-31T21:59:59.999Z", "2026-07-31"],
    ["2026-07-31T22:00:00Z", "2026-08-01"],
    ["2026-03-29T00:59:59Z", "2026-03-29"],
    ["2026-03-29T01:00:00Z", "2026-03-29"],
    ["2026-03-29T22:00:00Z", "2026-03-30"],
    ["2026-10-25T00:59:59Z", "2026-10-25"],
    ["2026-10-25T01:00:00Z", "2026-10-25"],
    ["2026-10-25T22:00:00Z", "2026-10-25"],
    ["2026-10-25T23:00:00Z", "2026-10-26"],
  ])
    assert.equal(berlinAvailabilityDate(new Date(instant)), expected, instant);
});
