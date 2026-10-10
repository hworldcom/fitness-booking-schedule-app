import assert from "node:assert/strict";
import test from "node:test";
import type {
  CoachTrainingLocation,
  OwnedCoachAvailabilityRule,
} from "@/domain/coaches";
import {
  coachScheduleAssignment,
  createCoachScheduleDraft,
  resolveCoachScheduleCell,
  serializeCoachScheduleDraft,
  toggleCoachScheduleCell,
} from "@/features/coaches/coach-schedule-draft";

const PRIMARY_LOCATION: CoachTrainingLocation = Object.freeze({
  id: "60000000-0000-4000-8000-000000000001",
  publicName: "Primary gym",
  timezone: "Europe/Berlin",
  selectedGymId: null,
  gymName: null,
  location: Object.freeze({
    kind: "independent",
    label: "Primary entrance",
    latitude: 52.5,
    longitude: 13.4,
    source: "manual",
    provider: null,
    confirmedAt: "2026-10-10T08:00:00.000Z",
  }),
  status: "active",
  isPrimary: true,
  sortOrder: 1,
  deactivatedAt: null,
  recordSource: "user",
  updatedAt: "2026-10-10T08:00:00.000Z",
});

const SECONDARY_LOCATION: CoachTrainingLocation = Object.freeze({
  ...PRIMARY_LOCATION,
  id: "60000000-0000-4000-8000-000000000002",
  publicName: "Secondary gym",
  isPrimary: false,
  sortOrder: 2,
  updatedAt: "2026-10-10T09:00:00.000Z",
});

const PRIMARY_RULE: OwnedCoachAvailabilityRule = Object.freeze({
  id: "70000000-0000-4000-8000-000000000001",
  ...coachScheduleAssignment(PRIMARY_LOCATION, 3, "10:00"),
  coachTimezone: "Europe/Berlin",
});

test("schedule draft assigns and removes the selected location without mutating its baseline", () => {
  const baseline = createCoachScheduleDraft([]);
  const requested = coachScheduleAssignment(PRIMARY_LOCATION, 3, "10:00");
  const assigned = toggleCoachScheduleCell(baseline, requested);

  assert.equal(assigned.outcome, "assigned");
  assert.equal(baseline.size, 0);
  assert.deepEqual(Array.from(assigned.assignments.values()), [requested]);

  const removed = toggleCoachScheduleCell(assigned.assignments, requested);
  assert.equal(removed.outcome, "removed");
  assert.equal(removed.assignments.size, 0);
  assert.equal(assigned.assignments.size, 1);
});

test("schedule draft requires an explicit decision before changing location", () => {
  const baseline = createCoachScheduleDraft([PRIMARY_RULE]);
  const requested = coachScheduleAssignment(SECONDARY_LOCATION, 3, "10:00");
  const pending = toggleCoachScheduleCell(baseline, requested);

  assert.equal(pending.outcome, "decision-required");
  assert.equal(pending.assignments, baseline);
  assert.equal(pending.existing?.locationId, PRIMARY_LOCATION.id);

  assert.equal(resolveCoachScheduleCell(baseline, requested, "keep"), baseline);
  assert.equal(resolveCoachScheduleCell(baseline, requested, "remove").size, 0);
  assert.equal(
    resolveCoachScheduleCell(baseline, requested, "move").get("3|10:00")
      ?.locationId,
    SECONDARY_LOCATION.id,
  );
  assert.equal(baseline.get("3|10:00")?.locationId, PRIMARY_LOCATION.id);
});

test("schedule serialization is stable across draft insertion order", () => {
  const primary = coachScheduleAssignment(PRIMARY_LOCATION, 5, "11:00");
  const secondary = coachScheduleAssignment(SECONDARY_LOCATION, 2, "09:00");
  const left = new Map([
    ["5|11:00", primary],
    ["2|09:00", secondary],
  ]);
  const right = new Map([
    ["2|09:00", secondary],
    ["5|11:00", primary],
  ]);

  assert.equal(
    serializeCoachScheduleDraft(left),
    serializeCoachScheduleDraft(right),
  );
});
