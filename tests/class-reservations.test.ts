import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  isMemberClassBookingStatus,
  normalizeClassReservationId,
} from "@/domain/class-reservations";
import { parseMemberClassSchedule } from "@/features/membership/reservation-client";
import { MemberClassSchedulePanel } from "@/features/membership/class-schedule";

const validSchedule = {
  membershipPeriodId: "99000000-0000-4000-8000-000000000001",
  plan: {
    id: "basic",
    includedCheckins: 10,
    includedCheckinsUsed: 2,
    includedCheckinsHeld: 1,
  },
  sessions: [
    {
      id: "99000000-0000-4000-8000-000000000101",
      slug: "mobility-demo",
      title: "Morning mobility",
      description: "A fictional demo class.",
      discipline: "Wellness",
      timezone: "Europe/Berlin",
      startsAt: "2026-10-01T06:00:00.000Z",
      endsAt: "2026-10-01T07:00:00.000Z",
      serviceDate: "2026-10-01",
      capacity: 12,
      reservedCount: 3,
      remainingCapacity: 9,
      bookingStatus: "reserved",
      venue: {
        id: "99000000-0000-4000-8000-000000000201",
        slug: "fictional-studio",
        name: "Fictional Studio",
      },
      trainer: { name: "Demo Trainer", title: "Mobility coach" },
      reservation: {
        id: "99000000-0000-4000-8000-000000000301",
        status: "reserved",
        cancellationReason: null,
        holdsBasicUse: true,
      },
    },
  ],
};

test("class reservation identifiers accept only normalized v4 UUIDs", () => {
  assert.equal(
    normalizeClassReservationId("99000000-0000-4000-8000-000000000101"),
    "99000000-0000-4000-8000-000000000101",
  );
  assert.equal(normalizeClassReservationId("not-an-id"), null);
  assert.equal(
    normalizeClassReservationId("99000000-0000-3000-8000-000000000101"),
    null,
  );
});

test("booking status accepts the complete bounded member lifecycle", () => {
  for (const status of [
    "available",
    "reserved",
    "full",
    "same-day-conflict",
    "allowance-exhausted",
    "past",
    "member-cancelled",
    "session-cancelled",
    "checked-in",
    "no-show",
  ]) {
    assert.equal(isMemberClassBookingStatus(status), true);
  }
  assert.equal(isMemberClassBookingStatus("paid"), false);
  assert.equal(isMemberClassBookingStatus("attended"), false);
});

test("browser schedule parsing preserves bounded reservation state", () => {
  assert.deepEqual(parseMemberClassSchedule(validSchedule), validSchedule);
  assert.equal(
    parseMemberClassSchedule({
      ...validSchedule,
      sessions: [
        { ...validSchedule.sessions[0], bookingStatus: "untrusted-state" },
      ],
    }),
    null,
  );
  assert.equal(
    parseMemberClassSchedule({
      ...validSchedule,
      sessions: [
        {
          ...validSchedule.sessions[0],
          reservation: {
            ...validSchedule.sessions[0].reservation,
            status: "paid",
          },
        },
      ],
    }),
    null,
  );
  assert.equal(
    parseMemberClassSchedule({
      ...validSchedule,
      plan: { ...validSchedule.plan, includedCheckinsHeld: 9 },
    }),
    null,
  );
});

test("member schedule presentation distinguishes a held reservation from attendance", () => {
  const schedule = parseMemberClassSchedule(validSchedule);
  assert.ok(schedule);
  const markup = renderToStaticMarkup(
    createElement(MemberClassSchedulePanel, { initialSchedule: schedule }),
  );
  assert.match(markup, /Plan your next session/);
  assert.match(markup, /Morning mobility/);
  assert.match(markup, /Fictional Studio/);
  assert.match(markup, /Reserved/);
  assert.match(
    markup,
    /7 available to reserve · 1 held by reservations · 2 confirmed check-ins/,
  );
  assert.match(markup, /Seat \+ one Basic use held\. Not attendance yet\./);
  assert.match(markup, /Cancel reservation/);
  assert.doesNotMatch(markup, /attendance confirmed/i);
});
