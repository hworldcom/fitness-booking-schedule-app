import { isCanonicalUuid } from "./coach-bookings";

export type CoachBookingsSection = "sessions" | "requests" | "new-booking";

export function coachBookingsSection(
  section: string | string[] | undefined,
  occurrence?: string | string[],
): "sessions" | "requests" {
  if (section === "requests") return "requests";
  if (section === "sessions") return "sessions";
  return typeof occurrence === "string" && isCanonicalUuid(occurrence)
    ? "requests"
    : "sessions";
}

export function coachBookingsHref(section: CoachBookingsSection) {
  return section === "new-booking"
    ? "/coach/bookings/new"
    : section === "requests"
      ? "/coach?view=bookings&section=requests"
      : "/coach?view=bookings";
}
