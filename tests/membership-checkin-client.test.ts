import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MemberClassSchedule } from "@/domain/class-reservations";
import type { MembershipCheckinSnapshot } from "@/domain/membership-checkins";
import {
  ARRIVAL_PRESENTATION_STORAGE_KEY,
  arrivalCountdown,
  clearStoredArrivalPresentation,
  parseMemberArrivalCancellationResponse,
  parseMemberArrivalResponse,
  parseMemberCheckinSnapshotResponse,
  readStoredArrivalPresentation,
  reservationArrivalWindow,
  storeArrivalPresentation,
  terminalArrivalStatus,
} from "@/features/membership/checkin-client";
import { MemberCheckinPanel } from "@/features/membership/member-checkin";

const periodId = "91111111-1111-4111-8111-111111111111";
const requestId = "92222222-2222-4222-8222-222222222222";
const operationId = "93333333-3333-4333-8333-333333333333";
const venueId = "94444444-4444-4444-8444-444444444444";
const reservationId = "95555555-5555-4555-8555-555555555555";
const classSessionId = "96666666-6666-4666-8666-666666666666";
const checkinId = "97777777-7777-4777-8777-777777777777";
const presentationCode = "A".repeat(43);

const pendingArrival = {
  requestId,
  operationId,
  venueId,
  venueSlug: "fictional-studio",
  venueName: "Fictional Studio",
  reservationId,
  classSessionId,
  classTitle: "Morning mobility",
  serviceDate: "2026-10-01",
  status: "pending" as const,
  createdAt: "2026-10-01T05:30:00.000Z",
  expiresAt: "2026-10-01T05:45:00.000Z",
};

const snapshot: MembershipCheckinSnapshot = {
  activePeriod: {
    membershipPeriodId: periodId,
    planCode: "basic",
    includedCheckins: 10,
    includedCheckinsUsed: 2,
    heldCheckins: 1,
  },
  pendingArrival,
  history: [],
};

const schedule: MemberClassSchedule = {
  membershipPeriodId: periodId,
  plan: {
    id: "basic",
    includedCheckins: 10,
    includedCheckinsUsed: 2,
    includedCheckinsHeld: 1,
  },
  sessions: [
    {
      id: classSessionId,
      slug: "morning-mobility",
      title: "Morning mobility",
      description: "A fictional mobility session.",
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
        id: venueId,
        slug: "fictional-studio",
        name: "Fictional Studio",
      },
      trainer: { name: "Demo Trainer", title: "Mobility coach" },
      reservation: {
        id: reservationId,
        status: "reserved",
        cancellationReason: null,
        holdsBasicUse: true,
      },
    },
  ],
};

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test("member check-in response parsing accepts only the private bounded shape", () => {
  assert.deepEqual(
    parseMemberCheckinSnapshotResponse({ status: "ready", snapshot }),
    {
      status: "ready",
      snapshot,
    },
  );
  assert.deepEqual(
    parseMemberCheckinSnapshotResponse({
      status: "ready",
      snapshot: { ...snapshot, walletAddress: "not-member-safe" },
    }),
    { status: "unavailable" },
  );
  assert.deepEqual(
    parseMemberCheckinSnapshotResponse({ status: "signed-out" }),
    { status: "signed-out" },
  );
});

test("the browser accepts a raw presentation code only on the first created response", () => {
  assert.deepEqual(
    parseMemberArrivalResponse({
      status: "created",
      requestId,
      requestStatus: "pending",
      expiresAt: pendingArrival.expiresAt,
      presentationCode,
    }),
    {
      status: "created",
      requestId,
      requestStatus: "pending",
      expiresAt: pendingArrival.expiresAt,
      presentationCode,
    },
  );
  assert.deepEqual(
    parseMemberArrivalResponse({
      status: "existing",
      requestId,
      requestStatus: "pending",
      expiresAt: pendingArrival.expiresAt,
      presentationCode,
    }),
    { status: "unavailable" },
  );
  assert.deepEqual(
    parseMemberArrivalCancellationResponse({
      status: "cancelled",
      requestId,
    }),
    { status: "cancelled", requestId },
  );
  assert.deepEqual(
    parseMemberArrivalCancellationResponse({ status: "signed-out" }),
    { status: "signed-out" },
  );
  assert.deepEqual(
    parseMemberArrivalCancellationResponse({
      status: "signed-out",
      requestId,
    }),
    { status: "unavailable" },
  );
});

test("session recovery stores one exact code and discards malformed state", () => {
  const storage = new MemoryStorage();
  const value = {
    version: 1 as const,
    requestId,
    operationId,
    presentationCode,
    expiresAt: pendingArrival.expiresAt,
  };
  assert.equal(storeArrivalPresentation(value, storage), true);
  assert.deepEqual(readStoredArrivalPresentation(storage), {
    status: "ready",
    value,
  });
  assert.equal(clearStoredArrivalPresentation(requestId, storage), true);
  assert.deepEqual(readStoredArrivalPresentation(storage), {
    status: "ready",
    value: null,
  });

  storage.setItem(
    ARRIVAL_PRESENTATION_STORAGE_KEY,
    JSON.stringify({ ...value, email: "must-not-persist@example.com" }),
  );
  assert.deepEqual(readStoredArrivalPresentation(storage), {
    status: "ready",
    value: null,
  });
  assert.equal(storage.getItem(ARRIVAL_PRESENTATION_STORAGE_KEY), null);
});

test("arrival windows, countdown and terminal reconciliation stay server-bounded", () => {
  const session = schedule.sessions[0]!;
  assert.equal(
    reservationArrivalWindow(session, Date.parse("2026-10-01T05:29:59Z")),
    "too-early",
  );
  assert.equal(
    reservationArrivalWindow(session, Date.parse("2026-10-01T05:30:00Z")),
    "open",
  );
  assert.equal(
    reservationArrivalWindow(session, Date.parse("2026-10-01T07:00:00Z")),
    "closed",
  );
  assert.equal(
    arrivalCountdown(
      pendingArrival.expiresAt,
      Date.parse("2026-10-01T05:34:59.100Z"),
    ),
    "10:01",
  );

  const confirmed: MembershipCheckinSnapshot = {
    ...snapshot,
    activePeriod: {
      ...snapshot.activePeriod!,
      includedCheckinsUsed: 3,
      heldCheckins: 0,
    },
    pendingArrival: null,
    history: [
      {
        checkinId,
        membershipPeriodId: periodId,
        venueId,
        venueSlug: "fictional-studio",
        venueName: "Fictional Studio",
        reservationId,
        classSessionId,
        classTitle: "Morning mobility",
        serviceDate: "2026-10-01",
        attendanceKind: "class",
        confirmedAt: "2026-10-01T05:35:00.000Z",
      },
    ],
  };
  assert.equal(
    terminalArrivalStatus(
      pendingArrival,
      confirmed,
      Date.parse("2026-10-01T05:35:01Z"),
    ),
    "confirmed",
  );
  assert.equal(
    terminalArrivalStatus(
      pendingArrival,
      { ...snapshot, pendingArrival: null },
      Date.parse("2026-10-01T05:45:00Z"),
    ),
    "expired",
  );
});

test("member check-in presentation separates held, confirmed and private state", () => {
  const markup = renderToStaticMarkup(
    createElement(MemberCheckinPanel, {
      initialSnapshot: {
        ...snapshot,
        pendingArrival: null,
        history: [
          {
            checkinId,
            membershipPeriodId: periodId,
            venueId,
            venueSlug: "fictional-studio",
            venueName: "Fictional Studio",
            reservationId,
            classSessionId,
            classTitle: "Morning mobility",
            serviceDate: "2026-09-30",
            attendanceKind: "class",
            confirmedAt: "2026-09-30T07:05:00.000Z",
          },
        ],
      },
      schedule,
      coreGyms: [{ id: "fictional-studio", name: "Fictional Studio" }],
    }),
  );
  assert.match(markup, /Check in when you arrive/);
  assert.match(markup, /7 available · 1 held · 2 confirmed of 10/);
  assert.match(markup, /A hold is not a used visit/);
  assert.match(markup, /Reserved class arrival/);
  assert.match(markup, /Open-gym arrival/);
  assert.match(markup, /Confirmed attendance/);
  assert.match(markup, /Morning mobility/);
  assert.doesNotMatch(markup, /wallet|payment|allocation/i);
});
