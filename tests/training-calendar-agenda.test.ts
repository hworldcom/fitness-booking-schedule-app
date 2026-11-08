import assert from "node:assert/strict";
import test from "node:test";
import {
  trainingItemDateRange,
  weeklyTrainingAgenda,
} from "../src/features/training/calendar-agenda-model";
import type { TrainingItem } from "../src/training/contracts";

const item = (
  key: string,
  startsAt: string,
  endsAt: string,
  extra: Partial<TrainingItem> = {},
): TrainingItem => ({
  key,
  startsAt,
  endsAt,
  source: "personal",
  title: key,
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
  ...extra,
});

test("a midweek date includes the whole Monday–Sunday week in chronological groups", () => {
  const items = [
    item("sunday", "2026-11-01T11:00:00Z", "2026-11-01T12:00:00Z", {
      source: "group",
    }),
    item("z", "2026-10-26T10:00:00Z", "2026-10-26T11:00:00Z", {
      attendance: "attended",
    }),
    item("cancelled", "2026-10-27T10:00:00Z", "2026-10-27T11:00:00Z", {
      source: "booking",
      state: "cancelled",
    }),
    item("a", "2026-10-26T10:00:00Z", "2026-10-26T11:00:00Z", {
      source: "request",
    }),
  ];
  const result = weeklyTrainingAgenda(items, "2026-10-28", "UTC");
  assert.equal(result.from, "2026-10-26");
  assert.equal(result.through, "2026-11-01");
  assert.equal(result.days.length, 7);
  assert.deepEqual(
    result.days[0].items.map((i) => i.key),
    ["a", "z"],
  );
  assert.equal(result.days[1].items[0].state, "cancelled");
  assert.equal(result.days[6].items[0].key, "sunday");
  assert.deepEqual(result, weeklyTrainingAgenda(items, "2026-11-01", "UTC"));
});

test("month-loaded neighboring weeks stay out of the selected week", () => {
  const items = [
    item("previous", "2026-10-25T10:00:00Z", "2026-10-25T11:00:00Z"),
    item("inside", "2026-10-26T10:00:00Z", "2026-10-26T11:00:00Z"),
    item("next", "2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"),
  ];
  assert.deepEqual(
    weeklyTrainingAgenda(items, "2026-10-28", "UTC").days.flatMap((d) =>
      d.items.map((i) => i.key),
    ),
    ["inside"],
  );
  assert.deepEqual(
    weeklyTrainingAgenda(items, "2026-11-02", "UTC").days.flatMap((d) =>
      d.items.map((i) => i.key),
    ),
    ["next"],
  );
});

test("overnight history appears on intersected days including a carry-in, with exclusive end dates", () => {
  const overnight = item(
    "overnight",
    "2026-10-26T23:00:00Z",
    "2026-10-27T01:00:00Z",
  );
  const carry = item("carry", "2026-10-25T23:30:00Z", "2026-10-26T00:30:00Z");
  const midnight = item(
    "midnight",
    "2026-10-27T23:00:00Z",
    "2026-10-28T00:00:00Z",
  );
  const result = weeklyTrainingAgenda(
    [overnight, carry, midnight],
    "2026-10-28",
    "UTC",
  );
  assert.deepEqual(
    result.days[0].items.map((i) => i.key),
    ["carry", "overnight"],
  );
  assert.deepEqual(
    result.days[1].items.map((i) => i.key),
    ["overnight", "midnight"],
  );
  assert.equal(result.days[2].items.length, 0);
  assert.deepEqual(trainingItemDateRange(midnight, "UTC"), {
    from: "2026-10-27",
    through: "2026-10-27",
  });
});

test("date grouping uses display timezone across DST transitions", () => {
  const spring = item("spring", "2026-03-28T23:30:00Z", "2026-03-29T01:30:00Z");
  assert.deepEqual(trainingItemDateRange(spring, "Europe/Berlin"), {
    from: "2026-03-29",
    through: "2026-03-29",
  });
  const fall = [
    item("later", "2026-10-25T01:30:00Z", "2026-10-25T02:00:00Z"),
    item("earlier", "2026-10-25T00:30:00Z", "2026-10-25T01:00:00Z"),
  ];
  const result = weeklyTrainingAgenda(fall, "2026-10-25", "Europe/Berlin");
  assert.deepEqual(
    result.days[6].items.map((i) => i.key),
    ["earlier", "later"],
  );
  const localMonday = item(
    "local-monday",
    "2026-10-25T23:30:00Z",
    "2026-10-26T00:30:00Z",
  );
  assert.equal(
    weeklyTrainingAgenda([localMonday], "2026-10-26", "Europe/Berlin").days[0]
      .items.length,
    1,
  );
});

test("grouping keeps loaded records and their annotations immutable", () => {
  const a = Object.freeze(
    item("z", "2026-10-27T10:00:00Z", "2026-10-27T11:00:00Z", {
      notes: "Retained private log",
      attendance: "attended",
    }),
  );
  const b = Object.freeze(
    item("a", "2026-10-26T10:00:00Z", "2026-10-26T11:00:00Z", {
      state: "cancelled",
      source: "booking",
    }),
  );
  const items = Object.freeze([a, b]);
  const result = weeklyTrainingAgenda(items, "2026-10-28", "UTC");
  assert.equal(result.days[0].items[0], b);
  assert.equal(result.days[1].items[0], a);
  assert.deepEqual(
    items.map((i) => i.key),
    ["z", "a"],
  );
  assert.equal(a.notes, "Retained private log");
});

test("an empty loaded week has seven empty date groups without invented records", () => {
  const result = weeklyTrainingAgenda([], "2026-12-31", "Europe/Berlin");
  assert.equal(result.from, "2026-12-28");
  assert.equal(result.through, "2027-01-03");
  assert.ok(result.days.every((d) => d.items.length === 0));
});
