import "server-only";
import { sql } from "drizzle-orm";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  isAthleteCoachFilter,
  isAthleteCoachKey,
  isAthleteCoachCursor,
  type AthleteCoach,
  type AthleteCoachFilter,
  type AthleteCoachCursor,
  type AthleteCoachPage,
} from "@/domain/athlete-coaches";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import {
  parseBookingConnectionContext,
  parseConnectionCoachPortrait,
} from "./repository";

const fields = [
  "key",
  "profileId",
  "name",
  "status",
  "lastSessionAt",
  "nextSessionAt",
  "sortAt",
  "bookingId",
  "connection",
  "canSend",
  "coachPublic",
  "coachSlug",
  "coachPortrait",
];
export function parseAthleteCoach(value: unknown): AthleteCoach {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid coach roster");
  const r = value as Record<string, unknown>;
  const stamp = (v: unknown) =>
    typeof v === "string" &&
    v.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T/.test(v) &&
    Number.isFinite(Date.parse(v));
  if (
    Object.keys(r).length !== fields.length ||
    Object.keys(r).some((key) => !fields.includes(key)) ||
    !isAthleteCoachKey(r.key) ||
    typeof r.profileId !== "string" ||
    !isCanonicalUuid(r.profileId) ||
    r.key !== `p:${r.profileId}` ||
    (r.bookingId !== null &&
      (typeof r.bookingId !== "string" || !isCanonicalUuid(r.bookingId))) ||
    typeof r.name !== "string" ||
    !r.name.trim() ||
    [...r.name].length > 120 ||
    /[\p{Cc}\p{Zl}\p{Zp}]/u.test(r.name) ||
    (r.lastSessionAt !== null && !stamp(r.lastSessionAt)) ||
    (r.nextSessionAt !== null && !stamp(r.nextSessionAt)) ||
    !stamp(r.sortAt) ||
    !["connected", "unconnected", "pending"].includes(String(r.status)) ||
    typeof r.coachPublic !== "boolean" ||
    (r.coachPublic
      ? typeof r.coachSlug !== "string" ||
        !/^[a-z0-9][a-z0-9-]{0,99}$/.test(r.coachSlug)
      : r.coachSlug !== null || r.coachPortrait !== null)
  )
    throw Error("Invalid coach roster");
  const context = parseBookingConnectionContext({
    connection: r.connection,
    canSend: r.canSend,
  });
  if (
    (context.connection && context.connection.coachProfileId !== r.profileId) ||
    (r.status === "connected") !==
      (context.connection?.status === "accepted") ||
    (r.status === "pending") !== (context.connection?.status === "pending") ||
    (context.canSend && (!r.bookingId || r.status !== "unconnected"))
  )
    throw Error("Invalid coach identity");
  return Object.freeze({
    key: r.key,
    profileId: r.profileId,
    name: r.name,
    status: r.status as AthleteCoach["status"],
    lastSessionAt: r.lastSessionAt as string | null,
    nextSessionAt: r.nextSessionAt as string | null,
    sortAt: r.sortAt as string,
    bookingId: r.bookingId as string | null,
    ...context,
    profileHref: r.coachPublic ? `/coaches/${r.coachSlug}` : null,
    portraitUrl: parseConnectionCoachPortrait(r.coachPortrait, r.profileId),
  });
}
export async function athleteCoachesPageRecord(
  tx: ActorDatabaseTransaction,
  filter: AthleteCoachFilter,
  cursor: AthleteCoachCursor | null = null,
): Promise<AthleteCoachPage> {
  if (
    !isAthleteCoachFilter(filter) ||
    (cursor !== null && !isAthleteCoachCursor(cursor))
  )
    throw Error("Invalid coach page");
  const rows = await tx.execute<{ projection: unknown }>(
    sql`select projection from app.current_athlete_coaches(${filter},21,${cursor?.at ?? null}::timestamptz,${cursor?.key ?? null}::text)`,
  );
  const parsed = rows.map((row) => parseAthleteCoach(row.projection));
  if (
    parsed.length > 21 ||
    new Set(parsed.map((row) => row.key)).size !== parsed.length
  )
    throw Error("Invalid coach page");
  const items = parsed.slice(0, 20),
    last = items.at(-1);
  return {
    items,
    nextCursor:
      parsed.length > 20 && last ? { at: last.sortAt, key: last.key } : null,
  };
}
