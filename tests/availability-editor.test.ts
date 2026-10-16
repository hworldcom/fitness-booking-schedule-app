import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAvailabilityCommand,
  availabilityActorAccess,
  availabilityMonth,
  berlinAvailabilityDate,
  copyAvailabilityDay,
  parseAvailabilityCommand,
  rangesFromHours,
  weeklyHours,
  weeklyRanges,
} from "@/features/coaches/availability-editor-model";
import type { EffectiveAvailabilityPolicy } from "@/domain/effective-availability";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";

test("private drafts are scoped to the signed-in account, run and approved coach access", () => {
  const session: AuthSessionSnapshot = {
    status: "signed-in",
    subject: "coach-user",
    email: "coach@example.test",
    expiresAt: 123,
  };
  const actor: ActorSnapshot = {
    status: "authorized",
    profile: {
      slug: "coach",
      displayName: "Coach",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: { slug: "run", name: "Run" },
    role: "member",
    coachAccessStatus: "approved",
  };
  const data = {
    scope: "coach-user:profile:run:member",
    actorIdentity: "coach:run:member",
  };
  assert.equal(availabilityActorAccess(session, actor, data), "allowed");
  assert.equal(
    availabilityActorAccess({ ...session, expiresAt: 456 }, actor, data),
    "allowed",
  );
  assert.equal(
    availabilityActorAccess({ status: "signed-out" }, actor, data),
    "denied",
  );
  assert.equal(
    availabilityActorAccess(
      { ...session, subject: "another-user" },
      actor,
      data,
    ),
    "denied",
  );
  assert.equal(
    availabilityActorAccess(
      session,
      { ...actor, coachAccessStatus: "suspended" },
      data,
    ),
    "denied",
  );
  assert.equal(
    availabilityActorAccess(
      session,
      { ...actor, demoRun: { slug: "other-run", name: "Other" } },
      data,
    ),
    "denied",
  );
  assert.equal(
    availabilityActorAccess(session, { status: "unavailable" }, data),
    "pending",
  );
});

const venue = {
  locationId: "60000000-0000-4000-8000-000000000001",
  locationUpdatedAt: "2026-10-16T10:00:00.123456+00:00",
};
const second = { ...venue, locationId: "60000000-0000-4000-8000-000000000002" };
const operationId = "10000000-0000-4000-8000-000000000001";
const hours = [
  { ...venue, isoWeekday: 1 as const, localStartTime: "09:00" },
  { ...venue, isoWeekday: 1 as const, localStartTime: "10:00" },
  { ...second, isoWeekday: 1 as const, localStartTime: "11:00" },
  { ...second, isoWeekday: 2 as const, localStartTime: "15:00" },
];

test("range editing round-trips adjacent hours without merging different venues or versions", () => {
  const draft = weeklyRanges(hours);
  assert.deepEqual(
    draft[0].map((r) => [r.startTime, r.endTime, r.locationId]),
    [
      ["09:00", "11:00", venue.locationId],
      ["11:00", "12:00", second.locationId],
    ],
  );
  assert.deepEqual(weeklyHours(draft), hours);
  assert.equal(
    rangesFromHours([
      { ...venue, localStartTime: "09:00" },
      {
        ...venue,
        locationUpdatedAt: "2026-10-17T10:00:00Z",
        localStartTime: "10:00",
      },
    ]).length,
    2,
  );
});
test("copy replaces only selected days and does not mutate the source or unselected days", () => {
  const draft = weeklyRanges(hours);
  const before = JSON.stringify(draft);
  const copied = copyAvailabilityDay(draft, 0, [1, 4]);
  assert.equal(JSON.stringify(draft), before);
  assert.deepEqual(
    weeklyHours(copied)
      .filter((h) => h.isoWeekday === 2)
      .map((h) => h.localStartTime),
    ["09:00", "10:00", "11:00"],
  );
  assert.equal(copied[3], draft[3]);
  assert.notEqual(copied[1][0], draft[0][0]);
  const off = copyAvailabilityDay(draft, 6, [0]);
  assert.equal(off[0].length, 0);
});
test("date restoration removes only selected overrides and weekly saves preserve exceptions", () => {
  const policy: EffectiveAvailabilityPolicy = {
    revision: 4,
    weeklyHours: hours,
    dates: [
      { date: "2026-10-20", mode: "unavailable", hours: [] },
      {
        date: "2026-10-21",
        mode: "custom",
        hours: [{ ...second, localStartTime: "14:00" }],
      },
    ],
  };
  const restored = applyAvailabilityCommand(
    policy,
    {
      kind: "dates",
      operationId,
      expectedRevision: 4,
      dates: [{ date: "2026-10-20", mode: "weekly", hours: [] }],
    },
    5,
  );
  assert.equal(policy.dates.length, 2);
  assert.deepEqual(restored.dates, [policy.dates[1]]);
  assert.equal(restored.revision, 5);
  const changed = applyAvailabilityCommand(
    restored,
    { kind: "weekly", operationId, expectedRevision: 5, hours: [] },
    6,
  );
  assert.deepEqual(changed.dates, restored.dates);
  assert.deepEqual(changed.weeklyHours, []);
});
test("untrusted action payloads reject cross-venue duplicate hours, forged scope and oversized batches", () => {
  const weekly = { kind: "weekly", operationId, expectedRevision: 0, hours };
  assert.ok(parseAvailabilityCommand(weekly));
  for (const value of [
    null,
    [],
    { ...weekly, ownerId: "forged" },
    { ...weekly, expectedRevision: -1 },
    { ...weekly, hours: [hours[0], { ...hours[0], ...second }] },
    { ...weekly, hours: [{ ...hours[0], localStartTime: "23:00" }] },
    { ...weekly, hours: [{ ...hours[0], locationUpdatedAt: "invalid" }] },
  ])
    assert.equal(parseAvailabilityCommand(value), null);
  const dates = {
    kind: "dates",
    operationId,
    expectedRevision: 0,
    dates: [{ date: "2026-10-20", mode: "unavailable", hours: [] }],
  };
  assert.ok(parseAvailabilityCommand(dates));
  for (const entries of [
    [...dates.dates, ...dates.dates],
    [],
    Array.from({ length: 32 }, () => dates.dates[0]),
    [{ date: "2027-02-29", mode: "unavailable", hours: [] }],
    [{ date: "2026-10-20", mode: "custom", hours: [] }],
    [
      {
        date: "2026-10-20",
        mode: "weekly",
        hours: [{ ...venue, localStartTime: "09:00" }],
      },
    ],
  ])
    assert.equal(parseAvailabilityCommand({ ...dates, dates: entries }), null);
});
test("editor date navigation uses Berlin dates and leap-safe calendar months", () => {
  assert.equal(
    berlinAvailabilityDate(new Date("2026-10-16T22:30:00Z")),
    "2026-10-17",
  );
  assert.deepEqual(availabilityMonth("2028-02-29"), {
    from: "2028-02-01",
    through: "2028-02-29",
    previous: "2028-01-01",
    next: "2028-03-01",
    label: "February 2028",
  });
});
