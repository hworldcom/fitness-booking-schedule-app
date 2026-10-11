import type { BookingLocationSnapshot } from "./coach-bookings";

export const COACH_BOOKING_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
  "not-selected",
  "occurrence-closed",
] as const;

export type CoachBookingRequestStatus =
  (typeof COACH_BOOKING_REQUEST_STATUSES)[number];

export type CoachBookingRequestPageCursor = Readonly<{
  createdAt: string;
  id: string;
}>;

type BookingRequestProjection = Readonly<{
  id: string;
  slotId: string;
  status: CoachBookingRequestStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  coachTimezone: string;
  location: BookingLocationSnapshot;
  decisionDeadlineAt: string;
  decidedAt: string | null;
  acceptedBookingId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type ClientCoachBookingRequestProjection = BookingRequestProjection &
  Readonly<{
    coachProfileId: string;
    coachDisplayName: string;
    coachSlug: string;
  }>;

export type OwnedCoachBookingRequestProjection = BookingRequestProjection &
  Readonly<{
    clientProfileId: string;
    clientDisplayName: string;
  }>;

export type CoachBookingRequestMutationProjection = Readonly<{
  requestId: string;
  status: CoachBookingRequestStatus;
  bookingId: string | null;
}>;

export type CoachBookingRequestPage<T> = Readonly<{
  items: readonly T[];
  nextCursor: CoachBookingRequestPageCursor | null;
}>;

export function isCoachBookingRequestStatus(
  value: string,
): value is CoachBookingRequestStatus {
  return COACH_BOOKING_REQUEST_STATUSES.some((status) => status === value);
}

export function isPendingCoachBookingRequest(
  request:
    ClientCoachBookingRequestProjection | OwnedCoachBookingRequestProjection,
) {
  return request.status === "pending";
}
