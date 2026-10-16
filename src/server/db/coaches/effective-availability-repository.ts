import "server-only";

import { sql } from "drizzle-orm";
import {
  isAvailabilityDate,
  type EffectiveAvailabilityCommand,
  type EffectiveAvailabilityPolicy,
  type EffectiveAvailabilityResult,
} from "@/domain/effective-availability";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { CoachAvailabilityConflictError } from "./availability-repository";

// JSON is produced only by the owner functions; malformed/missing results are
// infrastructure failures, never an invented successful save or empty policy.
function resultValue<T>(rows: readonly { result: unknown }[]): T {
  const result = rows[0]?.result;
  if (
    rows.length !== 1 ||
    !result ||
    typeof result !== "object" ||
    !("revision" in result) ||
    !Number.isSafeInteger(result.revision) ||
    Number(result.revision) < 0
  )
    throw new Error("Effective availability response is unavailable.");
  return Object.freeze(result) as T;
}

export async function ownedEffectiveAvailabilityRecord(
  transaction: ActorDatabaseTransaction,
  fromDate: string,
  throughDate: string,
): Promise<EffectiveAvailabilityPolicy> {
  if (!isAvailabilityDate(fromDate) || !isAvailabilityDate(throughDate))
    throw new CoachAvailabilityConflictError(
      "The availability date is invalid.",
    );
  const rows = await transaction.execute<{ result: unknown }>(sql`
    select app.owned_effective_coach_availability(
      ${fromDate}::date, ${throughDate}::date
    ) result
  `);
  return resultValue<EffectiveAvailabilityPolicy>(rows);
}

export async function saveOwnedEffectiveAvailabilityRecord(
  transaction: ActorDatabaseTransaction,
  command: EffectiveAvailabilityCommand,
  preview = false,
): Promise<EffectiveAvailabilityResult> {
  try {
    const operation = preview
      ? sql`app.preview_owned_effective_coach_availability`
      : sql`app.save_owned_effective_coach_availability`;
    const rows = await transaction.execute<{ result: unknown }>(sql`
      select ${operation}(
        ${JSON.stringify(command)}::jsonb
      ) result
    `);
    return resultValue<EffectiveAvailabilityResult>(rows);
  } catch (error) {
    let current: unknown = error;
    for (
      let depth = 0;
      depth < 8 && current && typeof current === "object";
      depth++
    ) {
      if (
        "code" in current &&
        (current.code === "22P02" ||
          current.code === "22007" ||
          current.code === "22008" ||
          (current.code === "P0001" &&
            "message" in current &&
            typeof current.message === "string" &&
            current.message.startsWith("coach availability")))
      )
        throw new CoachAvailabilityConflictError(undefined, { cause: error });
      current = "cause" in current ? current.cause : undefined;
    }
    throw error;
  }
}
