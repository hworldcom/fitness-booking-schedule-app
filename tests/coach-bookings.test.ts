import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clientBookingTimeline,
  confirmedBookingForSlot,
  isCanonicalUuid,
  isCoachBookingStatus,
  isFutureConfirmedBooking,
  type PrivateBookingProjection,
} from "@/domain/coach-bookings";
import {
  COACH_BOOKING_REQUEST_STATUSES,
  isCoachBookingRequestStatus,
} from "@/domain/coach-booking-requests";
import { ClientSessionCoachIdentity } from "@/features/profile/client-session-coach-identity";
import {
  ClientSessionDateTile,
  clientSessionDateParts,
} from "@/features/profile/client-session-date-tile";

test("booking identifiers require canonical UUIDs", () => {
  assert.equal(isCanonicalUuid("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isCanonicalUuid("11111111-1111-1111-1111-111111111111"), false);
  assert.equal(isCanonicalUuid("not-a-booking-id"), false);
});

test("booking requests expose only the approved lifecycle states", () => {
  assert.deepEqual(COACH_BOOKING_REQUEST_STATUSES, [
    "pending",
    "accepted",
    "declined",
    "withdrawn",
    "expired",
    "not-selected",
    "occurrence-closed",
  ]);
  for (const status of COACH_BOOKING_REQUEST_STATUSES) {
    assert.equal(isCoachBookingRequestStatus(status), true);
  }
  assert.equal(isCoachBookingRequestStatus("confirmed"), false);
  assert.equal(isCoachBookingRequestStatus("cancellation-requested"), false);
});

test("the scheduling lifecycle exposes only current terminal states", () => {
  for (const status of ["confirmed", "cancelled", "completed"]) {
    assert.equal(isCoachBookingStatus(status), true);
  }
  for (const removedState of [
    "pending",
    "cancellation-requested",
    "denied",
    "expired",
  ]) {
    assert.equal(isCoachBookingStatus(removedState), false);
  }
});

test("booking projections carry schedule state without financial references", () => {
  const booking: PrivateBookingProjection = Object.freeze({
    id: "11111111-1111-4111-8111-111111111111",
    slotId: "22222222-2222-4222-8222-222222222222",
    coachProfileId: "33333333-3333-4333-8333-333333333333",
    coachDisplayName: "Schedule Coach",
    coachSlug: "schedule-coach",
    coachPortraitUrl: "/images/coaches/schedule-coach.webp",
    clientProfileId: "44444444-4444-4444-8444-444444444444",
    clientDisplayName: "Schedule Client",
    clientAvatarUrl:
      "/api/coach/bookings/11111111-1111-4111-8111-111111111111/client-avatar?v=version",
    status: "confirmed",
    scheduledStartAt: "2026-10-08T10:00:00.000Z",
    scheduledEndAt: "2026-10-08T11:00:00.000Z",
    coachTimezone: "Europe/Berlin",
    location: Object.freeze({
      trainingLocationId: "55555555-5555-4555-8555-555555555555",
      name: "Northside Combat",
      kind: "gym",
      gymName: "Northside Combat",
      publicLabel: "Berlin",
    }),
    cancelledBy: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: "2026-10-07T10:00:00.000Z",
  });

  assert.deepEqual(Object.keys(booking).sort(), [
    "cancelledAt",
    "cancelledBy",
    "clientAvatarUrl",
    "clientDisplayName",
    "clientProfileId",
    "coachDisplayName",
    "coachPortraitUrl",
    "coachProfileId",
    "coachSlug",
    "coachTimezone",
    "completedAt",
    "createdAt",
    "id",
    "location",
    "scheduledEndAt",
    "scheduledStartAt",
    "slotId",
    "status",
  ]);
});

test("client booking timeline prioritizes future confirmed sessions", () => {
  const createBooking = (
    id: string,
    scheduledStartAt: string,
    status: PrivateBookingProjection["status"],
  ): PrivateBookingProjection =>
    Object.freeze({
      id,
      slotId: "22222222-2222-4222-8222-222222222222",
      coachProfileId: "33333333-3333-4333-8333-333333333333",
      coachDisplayName: "Schedule Coach",
      coachSlug: "schedule-coach",
      coachPortraitUrl: null,
      clientProfileId: "44444444-4444-4444-8444-444444444444",
      clientDisplayName: "Schedule Client",
      clientAvatarUrl: null,
      status,
      scheduledStartAt,
      scheduledEndAt: new Date(
        new Date(scheduledStartAt).getTime() + 60 * 60 * 1000,
      ).toISOString(),
      coachTimezone: "Europe/Berlin",
      location: Object.freeze({
        trainingLocationId: "55555555-5555-4555-8555-555555555555",
        name: "Northside Combat",
        kind: "gym",
        gymName: "Northside Combat",
        publicLabel: "Berlin",
      }),
      cancelledBy: status === "cancelled" ? "client" : null,
      cancelledAt: status === "cancelled" ? "2026-10-07T11:00:00.000Z" : null,
      completedAt: status === "completed" ? "2026-10-07T09:00:00.000Z" : null,
      createdAt: "2026-10-07T08:00:00.000Z",
    });
  const laterUpcoming = createBooking(
    "50000000-0000-4000-8000-000000000001",
    "2026-10-09T12:00:00.000Z",
    "confirmed",
  );
  const nextUpcoming = createBooking(
    "50000000-0000-4000-8000-000000000002",
    "2026-10-08T12:00:00.000Z",
    "confirmed",
  );
  const cancelledFuture = createBooking(
    "50000000-0000-4000-8000-000000000003",
    "2026-10-10T12:00:00.000Z",
    "cancelled",
  );
  const completedPast = createBooking(
    "50000000-0000-4000-8000-000000000004",
    "2026-10-07T08:00:00.000Z",
    "completed",
  );
  const referenceTime = "2026-10-08T09:00:00.000Z";

  const timeline = clientBookingTimeline(
    [completedPast, laterUpcoming, cancelledFuture, nextUpcoming],
    referenceTime,
  );

  assert.deepEqual(
    timeline.upcoming.map((booking) => booking.id),
    [nextUpcoming.id, laterUpcoming.id],
  );
  assert.deepEqual(
    timeline.history.map((booking) => booking.id),
    [cancelledFuture.id, completedPast.id],
  );
  assert.equal(isFutureConfirmedBooking(nextUpcoming, referenceTime), true);
  assert.equal(isFutureConfirmedBooking(cancelledFuture, referenceTime), false);
  assert.equal(
    confirmedBookingForSlot(
      [cancelledFuture, laterUpcoming, nextUpcoming],
      nextUpcoming.slotId,
    )?.id,
    laterUpcoming.id,
  );
  assert.equal(
    confirmedBookingForSlot([cancelledFuture], cancelledFuture.slotId),
    null,
  );
});

test("client session coach identity links its portrait and name to the public profile", () => {
  const withPortrait = renderToStaticMarkup(
    createElement(ClientSessionCoachIdentity, {
      displayName: "Daniel Park",
      slug: "daniel-park",
      portraitUrl: "/images/coaches/daniel-park.webp",
    }),
  );
  assert.match(withPortrait, /href="\/coaches\/daniel-park"/);
  assert.match(withPortrait, /View Daniel Park&#x27;s coach profile/);
  assert.match(withPortrait, /src="\/images\/coaches\/daniel-park.webp"/);
  assert.match(withPortrait, />Daniel Park<\/strong>/);

  const fallback = renderToStaticMarkup(
    createElement(ClientSessionCoachIdentity, {
      displayName: "Sam Lee",
      slug: "sam-lee",
      portraitUrl: null,
    }),
  );
  assert.match(fallback, /href="\/coaches\/sam-lee"/);
  assert.doesNotMatch(fallback, /<img/);
  assert.match(fallback, />SL<\/span>/);
});

test("client session date tiles use the coach timezone without replacing the full timestamp", () => {
  assert.deepEqual(
    clientSessionDateParts("2026-10-13T22:30:00.000Z", "Europe/Berlin"),
    { day: "14", month: "OCT", weekday: "WED" },
  );

  const tile = renderToStaticMarkup(
    createElement(ClientSessionDateTile, {
      timestamp: "2026-10-13T22:30:00.000Z",
      timeZone: "Europe/Berlin",
    }),
  );
  assert.match(tile, /dateTime="2026-10-13T22:30:00.000Z"/);
  assert.match(tile, />14<\/strong>/);
  assert.match(tile, />OCT<\/span>/);
  assert.match(tile, />WED<\/small>/);
  assert.match(tile, /aria-hidden="true"/);
});
