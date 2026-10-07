import assert from "node:assert/strict";
import test from "node:test";
import {
  clientBookingTimeline,
  confirmedBookingForSlot,
  isCanonicalUuid,
  isCoachBookingStatus,
  isFutureConfirmedBooking,
  type PrivateBookingProjection,
} from "@/domain/coach-bookings";

test("booking identifiers require canonical UUIDs", () => {
  assert.equal(isCanonicalUuid("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isCanonicalUuid("11111111-1111-1111-1111-111111111111"), false);
  assert.equal(isCanonicalUuid("not-a-booking-id"), false);
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
    clientProfileId: "44444444-4444-4444-8444-444444444444",
    clientDisplayName: "Schedule Client",
    status: "confirmed",
    scheduledStartAt: "2026-10-08T10:00:00.000Z",
    scheduledEndAt: "2026-10-08T11:00:00.000Z",
    coachTimezone: "Europe/Berlin",
    location: Object.freeze({
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
    "clientDisplayName",
    "clientProfileId",
    "coachDisplayName",
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
      clientProfileId: "44444444-4444-4444-8444-444444444444",
      clientDisplayName: "Schedule Client",
      status,
      scheduledStartAt,
      scheduledEndAt: new Date(
        new Date(scheduledStartAt).getTime() + 60 * 60 * 1000,
      ).toISOString(),
      coachTimezone: "Europe/Berlin",
      location: Object.freeze({
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
