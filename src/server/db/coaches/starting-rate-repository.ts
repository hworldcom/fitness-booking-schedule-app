import "server-only";
import { sql } from "drizzle-orm";
import {
  isStartingRateAmount,
  parsePublicCoachStartingRate,
  type OwnedCoachStartingRate,
  type PublicCoachStartingRate,
} from "@/domain/coach-starting-rate";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";

type RateRow = {
  amount_cents: number | null;
  show_publicly: boolean;
  revision: number;
};
export class CoachStartingRateError extends Error {
  constructor(public readonly status: "invalid" | "conflict" | "forbidden") {
    super("Coach starting rate operation failed.");
  }
}
function mapOwned(row: RateRow): OwnedCoachStartingRate {
  if (
    (row.amount_cents !== null && !isStartingRateAmount(row.amount_cents)) ||
    typeof row.show_publicly !== "boolean" ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    row.revision > 2_147_483_647
  )
    throw new Error("Invalid owner starting rate.");
  return Object.freeze({
    schemaVersion: 1,
    revision: row.revision,
    amountCents: row.amount_cents,
    currency: "EUR",
    showPublicly: row.show_publicly,
    context: "private-session",
  });
}
export function publicStartingRateFromRow(
  value: unknown,
): PublicCoachStartingRate | undefined {
  if (value === null || value === undefined) return undefined;
  const rate = parsePublicCoachStartingRate(value);
  if (!rate) throw new Error("Invalid public starting rate.");
  return rate;
}
function mutationError(error: unknown): never {
  let current = error;
  for (
    let depth = 0;
    depth < 6 && current && typeof current === "object";
    depth++
  ) {
    const value = current as {
      code?: string;
      message?: string;
      cause?: unknown;
    };
    if (value.code === "42501") throw new CoachStartingRateError("forbidden");
    if (["22023", "22003", "23514"].includes(value.code ?? ""))
      throw new CoachStartingRateError("invalid");
    if (
      value.code === "P0001" &&
      value.message?.startsWith("coach starting rate")
    )
      throw new CoachStartingRateError("conflict");
    current = value.cause;
  }
  throw error;
}
export async function ownedCoachStartingRateRecord(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  const rows = await transaction.execute<RateRow>(sql`
    select r.amount_cents,coalesce(r.show_publicly,false) as show_publicly,coalesce(r.revision,0) as revision
    from app.coach_profiles c left join app.coach_starting_rates r on r.run_id=c.run_id and r.profile_id=c.profile_id
    where c.run_id=${actor.runId}::uuid and c.profile_id=${actor.profileId}::uuid
  `);
  if (rows.length > 1) throw new Error("Invalid starting rate owner.");
  return rows[0] ? mapOwned(rows[0]) : null;
}
export async function saveOwnedCoachStartingRateRecord(
  transaction: ActorDatabaseTransaction,
  expectedRevision: number,
  amountCents: number | null,
  currency: string,
  showPublicly: boolean,
) {
  try {
    const rows = await transaction.execute<RateRow>(sql`
      select * from app.save_owned_coach_starting_rate(${expectedRevision}::integer,${amountCents}::bigint,${currency}::text,${showPublicly}::boolean)
    `);
    if (rows.length !== 1 || !rows[0])
      throw new Error("Missing starting rate save result.");
    return mapOwned(rows[0]);
  } catch (error) {
    return mutationError(error);
  }
}
export async function publicCoachStartingRateRecord(slug: string) {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<{ starting_rate: unknown }>(
      sql`select * from app.public_coach_starting_rate(${slug}::text)`,
    );
    if (rows.length > 1) throw new Error("Invalid public starting rate rows.");
    return rows[0]
      ? { startingRate: publicStartingRateFromRow(rows[0].starting_rate) }
      : null;
  });
}
