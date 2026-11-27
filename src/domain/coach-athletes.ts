import { isCanonicalUuid } from "./coach-bookings";
import type { ConnectionProjection } from "./coach-athlete-connections";

export const COACH_ATHLETE_FILTERS = [
  "all",
  "connected",
  "unconnected",
  "external",
] as const;
export type CoachAthleteFilter = (typeof COACH_ATHLETE_FILTERS)[number];
export type CoachAthleteStatus = Exclude<CoachAthleteFilter, "all"> | "pending";
export type CoachAthleteCursor = Readonly<{ at: string; key: string }>;
export type CoachAthlete = Readonly<{
  key: string;
  profileId: string | null;
  externalClientId: string | null;
  name: string;
  status: CoachAthleteStatus;
  lastSessionAt: string | null;
  nextSessionAt: string | null;
  sortAt: string;
  bookingId: string | null;
  connection: ConnectionProjection | null;
  canSend: boolean;
}>;
export type CoachAthletePage = Readonly<{
  items: readonly CoachAthlete[];
  nextCursor: CoachAthleteCursor | null;
}>;
export function isCoachAthleteFilter(
  value: unknown,
): value is CoachAthleteFilter {
  return COACH_ATHLETE_FILTERS.some((filter) => filter === value);
}
export function isCoachAthleteKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[pe]:/.test(value) &&
    isCanonicalUuid(value.slice(2))
  );
}
export function isCoachAthleteCursor(
  value: unknown,
): value is CoachAthleteCursor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const cursor = value as Record<string, unknown>;
  return (
    Object.keys(cursor).length === 2 &&
    typeof cursor.at === "string" &&
    cursor.at.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T/.test(cursor.at) &&
    Number.isFinite(Date.parse(cursor.at)) &&
    isCoachAthleteKey(cursor.key)
  );
}
export function coachAthleteHref(athlete: CoachAthlete) {
  if (athlete.status === "external" && athlete.externalClientId)
    return `/coach/athletes/external/${athlete.externalClientId}`;
  if (athlete.connection?.status === "accepted")
    return `/coach/athletes/${athlete.connection.pairId}`;
  return athlete.profileId
    ? `/members/${athlete.profileId}`
    : "/coach/athletes";
}
export function coachAthleteStatusLabel(athlete: CoachAthlete) {
  if (athlete.status === "connected") return "Connected";
  if (athlete.status === "external") return "External athlete";
  if (athlete.status === "pending")
    return athlete.connection?.recipientProfileId ===
      athlete.connection?.coachProfileId
      ? "Request received"
      : "Request sent";
  return "Not connected";
}
export function mergeCoachAthletes(
  current: readonly CoachAthlete[],
  next: readonly CoachAthlete[],
) {
  const rows = new Map(current.map((athlete) => [athlete.key, athlete]));
  for (const athlete of next) rows.set(athlete.key, athlete);
  // An invitation may be accepted between page reads. Only a server-projected
  // explicit link can replace the earlier external row; names never identify it.
  const linked = new Set(
    [...rows.values()]
      .filter((athlete) => athlete.profileId && athlete.externalClientId)
      .map((athlete) => athlete.externalClientId),
  );
  return [...rows.values()].filter(
    (athlete) =>
      athlete.status !== "external" || !linked.has(athlete.externalClientId),
  );
}
