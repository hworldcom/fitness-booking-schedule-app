export type CoachBookingStatus = "confirmed" | "cancelled" | "completed";
export type BookingCancellationActor = "client" | "coach";

export type BookingLocationSnapshot = Readonly<{
  kind: "gym" | "independent";
  gymName: string | null;
  publicLabel: string;
}>;

export type PrivateBookingProjection = Readonly<{
  id: string;
  slotId: string;
  coachProfileId: string;
  coachDisplayName: string;
  coachSlug: string;
  clientProfileId: string;
  clientDisplayName: string;
  status: CoachBookingStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  coachTimezone: string;
  location: BookingLocationSnapshot;
  cancelledBy: BookingCancellationActor | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isCanonicalUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function isCoachBookingStatus(
  value: string,
): value is CoachBookingStatus {
  return (
    value === "confirmed" || value === "cancelled" || value === "completed"
  );
}

export function isFutureConfirmedBooking(
  booking: PrivateBookingProjection,
  referenceTime: string,
) {
  return (
    booking.status === "confirmed" &&
    new Date(booking.scheduledStartAt).getTime() >
      new Date(referenceTime).getTime()
  );
}

export function confirmedBookingForSlot(
  bookings: readonly PrivateBookingProjection[],
  slotId: string,
) {
  return (
    bookings.find(
      (booking) => booking.slotId === slotId && booking.status === "confirmed",
    ) ?? null
  );
}

export function clientBookingTimeline(
  bookings: readonly PrivateBookingProjection[],
  referenceTime: string,
) {
  const upcoming = bookings
    .filter((booking) => isFutureConfirmedBooking(booking, referenceTime))
    .toSorted(
      (left, right) =>
        new Date(left.scheduledStartAt).getTime() -
        new Date(right.scheduledStartAt).getTime(),
    );
  const upcomingIds = new Set(upcoming.map((booking) => booking.id));
  const history = bookings
    .filter((booking) => !upcomingIds.has(booking.id))
    .toSorted(
      (left, right) =>
        new Date(right.scheduledStartAt).getTime() -
        new Date(left.scheduledStartAt).getTime(),
    );

  return Object.freeze({
    upcoming: Object.freeze(upcoming),
    history: Object.freeze(history),
  });
}
