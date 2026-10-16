import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { ClientCoachBookingRequestProjection } from "@/domain/coach-booking-requests";
import { addCalendarDays } from "@/domain/coach-calendar";
import type { PublicCoachAvailabilitySlot } from "@/domain/coaches";
import { AVAILABILITY_COACH } from "./availability-editor-data";

export const PUBLIC_SCHEDULE_NOW = "2026-10-16T08:30:00.000Z";
export const PUBLIC_SCHEDULE_COACH = {
  ...AVAILABILITY_COACH,
  displayName: "Public Schedule Fixture",
  recordSource: "fixture" as const,
  trustKind: "demo" as const,
};
export const PUBLIC_SCHEDULE_ACTOR: ActorSnapshot = {
  status: "authorized",
  profile: {
    slug: "schedule-athlete",
    displayName: "Fixture Athlete",
    avatarUrl: null,
    coachPortraitUrl: null,
  },
  demoRun: { slug: "schedule-fixture", name: "Isolated fixture" },
  role: "member",
  coachAccessStatus: "not-applied",
};
export const PUBLIC_SCHEDULE_SUBJECT = "a0255000-0000-4000-8000-000000000001";
export const PUBLIC_SCHEDULE_IDENTITY =
  "schedule-athlete:schedule-fixture:member";
export function publicFixtureSlot(
  day: number,
  hour = 12,
  id = day * 10 + hour,
): PublicCoachAvailabilitySlot {
  const date = addCalendarDays("2026-10-16", day);
  const venue = AVAILABILITY_COACH.locations[((day % 2) + 2) % 2];
  return {
    id: `d0255000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    startsAt: `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`,
    endsAt: `${date}T${String(hour + 1).padStart(2, "0")}:00:00.000Z`,
    coachTimezone: "Europe/Berlin",
    requestEligibility: "requestable",
    location: {
      trainingLocationId: venue.id,
      name: venue.publicName,
      kind: venue.location.kind,
      selectedGymId: null,
      gymName: null,
      label:
        day === 29
          ? `${venue.location.label} — meet at the signed entrance beside the riverside training deck; the complete venue address stays visible when choosing a time.`
          : venue.location.label,
      latitude: venue.location.latitude,
      longitude: venue.location.longitude,
      source: "manual",
      provider: null,
      confirmedAt: venue.location.confirmedAt,
    },
  };
}
export const PUBLIC_SCHEDULE_SLOTS: readonly PublicCoachAvailabilitySlot[] = [
  ...Array.from({ length: 30 }, (_, d) =>
    d === 2
      ? []
      : Array.from({ length: 10 }, (_, h) =>
          publicFixtureSlot(d, h + 9, d * 10 + h + 1),
        ),
  ).flat(),
  { ...publicFixtureSlot(4, 20, 401), requestEligibility: "withdrawn" },
  { ...publicFixtureSlot(4, 21, 402), requestEligibility: "booked" },
  { ...publicFixtureSlot(4, 22, 403), requestEligibility: "unavailable" },
  publicFixtureSlot(30, 12, 500),
  publicFixtureSlot(-1, 12, 501),
];
export function publicFixtureRequest(
  slot: PublicCoachAvailabilitySlot,
): ClientCoachBookingRequestProjection {
  return {
    id: "e0255000-0000-4000-8000-000000000001",
    slotId: slot.id,
    coachProfileId: PUBLIC_SCHEDULE_COACH.profileId,
    coachDisplayName: PUBLIC_SCHEDULE_COACH.displayName,
    coachSlug: PUBLIC_SCHEDULE_COACH.slug,
    coachPortraitUrl: null,
    status: "pending",
    scheduledStartAt: slot.startsAt,
    scheduledEndAt: slot.endsAt,
    coachTimezone: slot.coachTimezone,
    location: {
      trainingLocationId: slot.location.trainingLocationId,
      name: slot.location.name,
      kind: slot.location.kind,
      gymName: null,
      publicLabel: slot.location.label,
    },
    decisionDeadlineAt: "2026-10-16T20:30:00.000Z",
    decidedAt: null,
    acceptedBookingId: null,
    createdAt: PUBLIC_SCHEDULE_NOW,
    updatedAt: PUBLIC_SCHEDULE_NOW,
  };
}
