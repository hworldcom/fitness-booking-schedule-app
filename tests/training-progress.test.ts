import assert from "node:assert/strict";
import test from "node:test";
import {
  difficultyLabel,
  loadProgress,
  progressPeriods,
  summarizeProgress,
  trainingHours,
} from "../src/features/training/progress-model";
import type { TrainingItem, TrainingPage } from "../src/training/contracts";

const now = "2026-11-01T12:00:00Z";
const workout = (overrides: Partial<TrainingItem> = {}): TrainingItem => ({
  key: "personal:one",
  source: "personal",
  title: "Boxing",
  startsAt: "2026-11-01T09:00:00Z",
  endsAt: "2026-11-01T10:00:00Z",
  timezone: "UTC",
  state: "planned",
  attendance: "attended",
  notes: "",
  intensity: null,
  actualMinutes: null,
  revision: 1,
  seriesId: null,
  planRevision: null,
  href: null,
  location: null,
  ...overrides,
});
const page = (
  items: TrainingItem[],
  next: number | null = null,
): TrainingPage => ({
  items,
  next,
  now,
  weekCount: 0,
  monthCount: 0,
  remindersEnabled: false,
});

test("current week/month ranges cross month and timezone boundaries within the42-day read limit", () => {
  assert.deepEqual(progressPeriods(now, "Europe/Berlin"), {
    week: { from: "2026-10-26", through: "2026-11-01" },
    month: { from: "2026-11-01", through: "2026-11-30" },
    from: "2026-10-26",
    through: "2026-11-30",
  });
  const edge = "2026-11-30T23:30:00Z";
  assert.equal(progressPeriods(edge, "Europe/Berlin").month.from, "2026-12-01");
  assert.equal(
    progressPeriods(edge, "America/New_York").month.from,
    "2026-11-01",
  );
  assert.equal(
    progressPeriods("2028-02-29T12:00:00Z", "UTC").month.through,
    "2028-02-29",
  );
});

test("attendance totals use actual duration, fallback elapsed duration and equal-weight recorded difficulty", () => {
  const items = [
    workout({ intensity: "Easy", actualMinutes: 30 }),
    workout({ key: "booking:two", source: "booking", intensity: "Hard" }),
    workout({ key: "group:three", source: "group", actualMinutes: 90 }),
    workout({ key: "skipped", attendance: "skipped", intensity: "Hard" }),
    workout({ key: "planned", attendance: "planned", intensity: "Hard" }),
    workout({ key: "cancelled", attendance: "cancelled", intensity: "Hard" }),
    // Coach completion alone cannot count as the athlete's attendance.
    workout({
      key: "completed",
      source: "booking",
      state: "completed",
      attendance: "planned",
    }),
  ];
  assert.deepEqual(summarizeProgress(items, now, "UTC"), {
    week: { minutes: 180, ratedCount: 2, averageDifficulty: 2 },
    month: { minutes: 180, ratedCount: 2, averageDifficulty: 2 },
  });
  assert.equal(difficultyLabel(1), "Easy");
  assert.equal(difficultyLabel(2), "Moderate");
  assert.equal(difficultyLabel(3), "Hard");
});

test("overnight and repeated items count once by local start date and retain historical self-attendance", () => {
  const overnight = workout({
    startsAt: "2026-10-31T23:30:00Z",
    endsAt: "2026-11-01T01:30:00Z",
    state: "cancelled",
    intensity: "Moderate",
  });
  const utc = summarizeProgress([overnight, overnight], now, "UTC");
  assert.deepEqual(utc.week, {
    minutes: 120,
    ratedCount: 1,
    averageDifficulty: 2,
  });
  assert.deepEqual(utc.month, {
    minutes: 0,
    ratedCount: 0,
    averageDifficulty: null,
  });
  assert.equal(
    summarizeProgress([overnight], now, "Europe/Berlin").month.minutes,
    120,
  );
  assert.deepEqual(summarizeProgress([], now, "UTC").week, {
    minutes: 0,
    ratedCount: 0,
    averageDifficulty: null,
  });
  assert.equal(
    summarizeProgress([workout()], now, "UTC").week.averageDifficulty,
    null,
  );
  assert.equal(trainingHours(1), "<0.1");
  assert.equal(trainingHours(0), "0.0");
  assert.equal(trainingHours(90), "1.5");
});

test("progress reads all pages for current periods rather than the visible calendar", async () => {
  const calls: unknown[] = [];
  const first = Array.from({ length: 100 }, (_, n) =>
    workout({ key: `p:${n}`, attendance: "planned" }),
  );
  const result = await loadProgress(
    async (args) => {
      calls.push(args);
      return args.offset === 0
        ? page(first, 100)
        : page([workout({ intensity: "Hard" })]);
    },
    now,
    "UTC",
  );
  assert.deepEqual(calls, [
    { from: "2026-10-26", through: "2026-11-30", timezone: "UTC", offset: 0 },
    { from: "2026-10-26", through: "2026-11-30", timezone: "UTC", offset: 100 },
  ]);
  assert.deepEqual(result.month, {
    minutes: 60,
    ratedCount: 1,
    averageDifficulty: 3,
  });
});

test("a failed later page or unusable cursor never returns partial or empty progress", async () => {
  await assert.rejects(
    loadProgress(
      async ({ offset }) => {
        if (offset) throw Error("Unavailable");
        return page([workout()], 100);
      },
      now,
      "UTC",
    ),
    /Unavailable/,
  );
  for (const next of [0, 10100])
    await assert.rejects(
      loadProgress(async () => page([workout()], next), now, "UTC"),
      /Incomplete/,
    );
});
