import type { PrivateBookingProjection } from "../../src/domain/coach-bookings";
import type { ClientCoachBookingRequestProjection } from "../../src/domain/coach-booking-requests";
export const historyReferenceTime = "2026-11-01T12:00:00Z";
export function historyBooking(
  index: number,
  startsAt: string,
  status: PrivateBookingProjection["status"] = "confirmed",
): PrivateBookingProjection {
  return {
    id: `15000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    slotId: "25000000-0000-4000-8000-000000000001",
    coachProfileId: "35000000-0000-4000-8000-000000000001",
    clientProfileId: "45000000-0000-4000-8000-000000000001",
    coachDisplayName: "Fictional Coach",
    coachSlug: "fictional-coach",
    coachPortraitUrl: null,
    clientDisplayName: "Fictional Athlete",
    clientAvatarUrl: null,
    athleteProfileHref: null,
    title: `Practice ${index}`,
    titleRevision: 1,
    canEditTitle: false,
    hasSessionDetails: true,
    status,
    scheduledStartAt: startsAt,
    scheduledEndAt: new Date(Date.parse(startsAt) + 3600000).toISOString(),
    coachTimezone: "Europe/Berlin",
    location: {
      trainingLocationId: null,
      name: "Training hall",
      kind: "independent",
      gymName: null,
      publicLabel: "Berlin",
    },
    cancelledBy: status === "cancelled" ? "coach" : null,
    cancelledAt: status === "cancelled" ? historyReferenceTime : null,
    completedAt: status === "completed" ? historyReferenceTime : null,
    createdAt: "2026-10-01T12:00:00Z",
  };
}
export const historyBookings = [
  historyBooking(2, "2026-10-10T10:00:00Z", "completed"),
  historyBooking(3, "2026-11-10T10:00:00Z"),
  historyBooking(1, "2026-10-31T10:00:00Z"),
  historyBooking(4, "2026-11-12T10:00:00Z", "cancelled"),
  historyBooking(5, "2026-11-05T10:00:00Z"),
];
const first = historyBookings[0];
export const historyRequest: ClientCoachBookingRequestProjection = {
  ...first,
  id: "55000000-0000-4000-8000-000000000001",
  coachDisplayName: "Request-only Coach",
  status: "pending",
  acceptedBookingId: null,
  decisionDeadlineAt: "2026-11-01T20:00:00Z",
  decidedAt: null,
  updatedAt: historyReferenceTime,
};
