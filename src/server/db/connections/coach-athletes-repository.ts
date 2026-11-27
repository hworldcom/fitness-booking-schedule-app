import "server-only";
import { sql } from "drizzle-orm";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  isCoachAthleteFilter,
  isCoachAthleteKey,
  isCoachAthleteCursor,
  type CoachAthlete,
  type CoachAthleteFilter,
  type CoachAthleteCursor,
  type CoachAthletePage,
} from "@/domain/coach-athletes";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { parseBookingConnectionContext } from "./repository";

const fields = [
  "key",
  "profileId",
  "externalClientId",
  "name",
  "status",
  "lastSessionAt",
  "nextSessionAt",
  "sortAt",
  "bookingId",
  "connection",
  "canSend",
];
export function parseCoachAthlete(value: unknown): CoachAthlete {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid athlete roster");
  const r = value as Record<string, unknown>;
  const stamp = (v: unknown) =>
    typeof v === "string" &&
    v.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T/.test(v) &&
    Number.isFinite(Date.parse(v));
  const id = (v: unknown) =>
    v === null || (typeof v === "string" && isCanonicalUuid(v));
  if (
    Object.keys(r).length !== fields.length ||
    Object.keys(r).some((key) => !fields.includes(key)) ||
    !isCoachAthleteKey(r.key) ||
    !id(r.profileId) ||
    !id(r.externalClientId) ||
    !id(r.bookingId) ||
    typeof r.name !== "string" ||
    !r.name.trim() ||
    [...r.name].length > 120 ||
    /[\p{Cc}\p{Zl}\p{Zp}]/u.test(r.name) ||
    (r.lastSessionAt !== null && !stamp(r.lastSessionAt)) ||
    (r.nextSessionAt !== null && !stamp(r.nextSessionAt)) ||
    !stamp(r.sortAt) ||
    !["connected", "unconnected", "external", "pending"].includes(
      String(r.status),
    )
  )
    throw Error("Invalid athlete roster");
  const context = parseBookingConnectionContext({
    connection: r.connection,
    canSend: r.canSend,
  });
  const external = r.status === "external";
  if (
    external
      ? r.profileId !== null ||
        r.key !== `e:${r.externalClientId}` ||
        !r.externalClientId ||
        context.connection ||
        context.canSend ||
        r.bookingId !== null
      : !r.profileId ||
        r.key !== `p:${r.profileId}` ||
        (context.connection &&
          context.connection.athleteProfileId !== r.profileId) ||
        (r.status === "connected") !==
          (context.connection?.status === "accepted") ||
        (r.status === "pending") !==
          (context.connection?.status === "pending") ||
        (context.canSend && (!r.bookingId || r.status !== "unconnected"))
  )
    throw Error("Invalid athlete identity");
  return Object.freeze({
    ...r,
    connection: context.connection,
    canSend: context.canSend,
  }) as CoachAthlete;
}
export async function coachAthletesPageRecord(
  tx: ActorDatabaseTransaction,
  filter: CoachAthleteFilter,
  cursor: CoachAthleteCursor | null = null,
): Promise<CoachAthletePage> {
  if (
    !isCoachAthleteFilter(filter) ||
    (cursor !== null && !isCoachAthleteCursor(cursor))
  )
    throw Error("Invalid athlete page");
  const rows = await tx.execute<{ projection: unknown }>(
    sql`select projection from app.current_coach_athletes(${filter},21,${cursor?.at ?? null}::timestamptz,${cursor?.key ?? null}::text)`,
  );
  const parsed = rows.map((row) => parseCoachAthlete(row.projection));
  if (
    parsed.length > 21 ||
    new Set(parsed.map((row) => row.key)).size !== parsed.length
  )
    throw Error("Invalid athlete page");
  const items = parsed.slice(0, 20),
    last = items.at(-1);
  return {
    items,
    nextCursor:
      parsed.length > 20 && last ? { at: last.sortAt, key: last.key } : null,
  };
}
