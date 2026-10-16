import assert from "node:assert/strict";
import test from "node:test";
import { publicScheduleActorMatches } from "@/features/coaches/public-schedule-model";
import { calendarDate } from "@/domain/coach-calendar";
import {
  publicScheduleHref,
  publicScheduleSelection,
  publicScheduleSlots,
} from "@/domain/public-coach-schedule";
import {
  PUBLIC_SCHEDULE_ACTOR,
  PUBLIC_SCHEDULE_IDENTITY,
  PUBLIC_SCHEDULE_NOW,
  PUBLIC_SCHEDULE_SLOTS,
  PUBLIC_SCHEDULE_SUBJECT,
  publicFixtureSlot,
} from "./fixtures/public-schedule-data";

test("public dates span exactly 30 Berlin dates across DST, month, year and leap boundaries", () => {
  for (const [now, today, through] of [
    ["2026-10-24T22:30:00Z", "2026-10-25", "2026-11-23"],
    ["2026-03-28T23:30:00Z", "2026-03-29", "2026-04-27"],
    ["2026-12-31T23:30:00Z", "2027-01-01", "2027-01-30"],
    ["2028-02-28T23:30:00Z", "2028-02-29", "2028-03-29"],
  ]) {
    const first = publicScheduleSelection(undefined, now);
    assert.equal(first.today, today);
    assert.equal(first.through, through);
    const reached: string[] = [];
    let selected = first;
    while (true) {
      reached.push(...selected.dates);
      if (!selected.next) break;
      selected = publicScheduleSelection(selected.next, now);
    }
    assert.equal(reached.length, 30);
    assert.equal(new Set(reached).size, 30);
    assert.equal(reached.at(-1), through);
    assert.equal(publicScheduleSelection(through, now).inHorizon, true);
  }
});

test("date selection rejects malformed/repeated parameters and explicitly distinguishes outside-window dates", () => {
  for (const value of [
    [],
    ["2026-10-20", "2026-10-21"],
    "2026-02-30",
    "2026-10-16T12:00:00Z",
    "<script>",
    "x".repeat(10000),
  ]) {
    const selection = publicScheduleSelection(value, PUBLIC_SCHEDULE_NOW);
    assert.equal(selection.date, "2026-10-16");
    assert.equal(selection.invalid, true);
  }
  for (const date of ["2026-10-15", "2026-11-15"]) {
    const selection = publicScheduleSelection(date, PUBLIC_SCHEDULE_NOW);
    assert.equal(selection.inHorizon, false);
    assert.equal(selection.date, date);
    assert.equal(selection.invalid, false);
  }
  assert.throws(() => publicScheduleSelection(undefined, "not-a-time"));
  assert.equal(
    publicScheduleHref("schedule-coach", "2026-11-14"),
    "/coaches/schedule-coach?date=2026-11-14#private-schedule",
  );
});

test("public day lists retain current IDs/venues and omit closed, occupied, elapsed and outside-window times", () => {
  const old = {
    ...publicFixtureSlot(4, 12, 700),
    requestEligibility: "withdrawn" as const,
  };
  const successor = publicFixtureSlot(4, 12, 701);
  const slots = publicScheduleSlots(
    [
      ...PUBLIC_SCHEDULE_SLOTS,
      old,
      successor,
      { ...publicFixtureSlot(0, 8, 800), startsAt: PUBLIC_SCHEDULE_NOW },
    ],
    PUBLIC_SCHEDULE_NOW,
  );
  assert.ok(slots.length > 200);
  assert.ok(
    slots.every(
      (slot) =>
        slot.requestEligibility === "requestable" &&
        Date.parse(slot.startsAt) > Date.parse(PUBLIC_SCHEDULE_NOW),
    ),
  );
  assert.ok(
    !slots.some((slot) =>
      [
        old.id,
        publicFixtureSlot(30, 12, 500).id,
        publicFixtureSlot(-1, 12, 501).id,
      ].includes(slot.id),
    ),
  );
  assert.equal(
    slots.find((slot) => slot.id === successor.id),
    successor,
  );
  const selected = slots.filter(
    (slot) => calendarDate(slot.startsAt) === "2026-11-14",
  );
  assert.equal(selected.length, 10);
  assert.equal(selected[0].location.name, "Riverside strength deck");
  assert.equal(
    slots.filter((slot) => calendarDate(slot.startsAt) === "2026-10-18").length,
    0,
  );
});

test("public horizon rolls forward from each database read without a coach visit or browser clock", () => {
  const next = publicScheduleSelection("2026-10-16", "2026-10-16T22:01:00Z");
  assert.equal(next.today, "2026-10-17");
  assert.equal(next.inHorizon, false);
  assert.equal(next.through, "2026-11-15");
  assert.ok(
    publicScheduleSlots(PUBLIC_SCHEDULE_SLOTS, "2026-10-16T22:01:00Z").some(
      (slot) => calendarDate(slot.startsAt) === next.through,
    ),
  );
});

test("public personal request state is scoped to the verified Auth subject and exact actor dataset/role", () => {
  const expected = {
    subject: PUBLIC_SCHEDULE_SUBJECT,
    actorIdentity: PUBLIC_SCHEDULE_IDENTITY,
  };
  const session = {
    status: "signed-in" as const,
    subject: PUBLIC_SCHEDULE_SUBJECT,
    email: "fixture@users.movx.test",
    expiresAt: null,
  };
  assert.equal(
    publicScheduleActorMatches(session, PUBLIC_SCHEDULE_ACTOR, expected),
    true,
  );
  assert.equal(
    publicScheduleActorMatches(
      { ...session, subject: "another" },
      PUBLIC_SCHEDULE_ACTOR,
      expected,
    ),
    false,
  );
  assert.equal(
    publicScheduleActorMatches(
      { status: "unavailable" },
      PUBLIC_SCHEDULE_ACTOR,
      expected,
    ),
    false,
  );
  assert.equal(
    publicScheduleActorMatches(
      { status: "signed-out" },
      PUBLIC_SCHEDULE_ACTOR,
      expected,
    ),
    false,
  );
  assert.equal(
    publicScheduleActorMatches(session, { status: "forbidden" }, expected),
    false,
  );
  assert.equal(
    publicScheduleActorMatches(session, PUBLIC_SCHEDULE_ACTOR, {
      ...expected,
      actorIdentity: "schedule-athlete:another-run:member",
    }),
    false,
  );
  assert.equal(
    publicScheduleActorMatches(session, PUBLIC_SCHEDULE_ACTOR, {
      ...expected,
      actorIdentity: "schedule-athlete:schedule-fixture:operator",
    }),
    false,
  );
});
