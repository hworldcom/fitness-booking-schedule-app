import { isCanonicalUuid } from "./coach-bookings";
import type { ConnectionProjection } from "./coach-athlete-connections";

export const ATHLETE_COACH_FILTERS = [
  "all",
  "connected",
  "unconnected",
] as const;
export type AthleteCoachFilter = (typeof ATHLETE_COACH_FILTERS)[number];
export type AthleteCoachCursor = Readonly<{ at: string; key: string }>;
export type AthleteCoach = Readonly<{
  key: string;
  profileId: string;
  name: string;
  status: "connected" | "unconnected" | "pending";
  lastSessionAt: string | null;
  nextSessionAt: string | null;
  sortAt: string;
  bookingId: string | null;
  connection: ConnectionProjection | null;
  canSend: boolean;
  profileHref: string | null;
  portraitUrl: string | null;
}>;
export type AthleteCoachPage = Readonly<{
  items: readonly AthleteCoach[];
  nextCursor: AthleteCoachCursor | null;
}>;
export function isAthleteCoachFilter(
  value: unknown,
): value is AthleteCoachFilter {
  return ATHLETE_COACH_FILTERS.some((filter) => filter === value);
}
export function isAthleteCoachKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("p:") &&
    isCanonicalUuid(value.slice(2))
  );
}
export function isAthleteCoachCursor(
  value: unknown,
): value is AthleteCoachCursor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const cursor = value as Record<string, unknown>;
  return (
    Object.keys(cursor).length === 2 &&
    typeof cursor.at === "string" &&
    cursor.at.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T/.test(cursor.at) &&
    Number.isFinite(Date.parse(cursor.at)) &&
    isAthleteCoachKey(cursor.key)
  );
}
export function athleteCoachStatusLabel(coach: AthleteCoach) {
  if (coach.status === "connected") return "Connected";
  if (coach.status === "pending")
    return coach.connection?.recipientProfileId ===
      coach.connection?.athleteProfileId
      ? "Request received"
      : "Request sent";
  return "Not connected";
}
export function mergeAthleteCoaches(
  current: readonly AthleteCoach[],
  next: readonly AthleteCoach[],
) {
  const rows = new Map(current.map((coach) => [coach.key, coach]));
  for (const coach of next) rows.set(coach.key, coach);
  return [...rows.values()];
}
