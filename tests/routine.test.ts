import assert from "node:assert/strict";
import test from "node:test";
import {
  nextRoutineDate,
  routineDays,
  routineHref,
} from "../src/features/training/routine-model";
import type { TrainingItem } from "../src/training/contracts";

const item = (patch: Partial<TrainingItem>): TrainingItem => ({
  key: "manual:fixture",
  source: "personal",
  title: "Run",
  startsAt: "2026-10-26T23:30:00Z",
  endsAt: "2026-10-27T00:30:00Z",
  timezone: "UTC",
  state: "planned",
  attendance: "planned",
  notes: "",
  intensity: null,
  actualMinutes: null,
  revision: 0,
  seriesId: null,
  planRevision: null,
  href: null,
  location: null,
  ...patch,
});

test("routine week shows only planned personal starts in the display timezone", () => {
  const days = routineDays(
    "2026-10-29",
    [
      item({}),
      item({ key: "booking:fixture", source: "booking" }),
      item({ key: "attended", attendance: "attended" }),
      item({ key: "cancelled", attendance: "cancelled" }),
      item({ key: "skipped", attendance: "skipped" }),
      item({ key: "outside", startsAt: "2026-11-02T13:00:00Z" }),
    ],
    "Europe/Berlin",
  );
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2026-10-26");
  assert.equal(days[6].date, "2026-11-01");
  assert.deepEqual(
    days.map((d) => d.items.length),
    [0, 1, 0, 0, 0, 0, 0],
  );
});
test("adding a routine never backdates a past weekday or a late-night default", () => {
  assert.equal(
    nextRoutineDate("2026-10-26", "2026-10-28T12:00:00Z", "UTC"),
    "2026-11-02",
  );
  assert.equal(
    nextRoutineDate("2026-10-28", "2026-10-28T12:00:00Z", "UTC"),
    "2026-10-28",
  );
  assert.equal(
    nextRoutineDate("2026-10-28", "2026-10-28T22:30:00Z", "Europe/Berlin"),
    "2026-11-04",
  );
  assert.equal(
    nextRoutineDate("2026-11-13", "2026-10-28T12:00:00Z", "UTC"),
    "2026-11-13",
  );
});
test("routine defaults use local dates across daylight-saving changes", () => {
  assert.equal(
    nextRoutineDate("2026-10-24", "2026-10-24T22:30:00Z", "Europe/Berlin"),
    "2026-10-31",
  );
  assert.equal(
    nextRoutineDate("2026-10-25", "2026-10-24T22:30:00Z", "Europe/Berlin"),
    "2026-10-25",
  );
  assert.equal(
    routineHref("2026-10-26", "America/New_York"),
    "/sessions/routine?date=2026-10-26&timezone=America%2FNew_York",
  );
});
