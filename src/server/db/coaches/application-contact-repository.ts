import "server-only";
import { sql } from "drizzle-orm";
import {
  parseCoachApplicationContact,
  type CoachApplicationContactDetails,
} from "@/domain/coach-application-contact";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

export class CoachApplicationContactConflictError extends Error {}

export async function currentOwnedCoachApplicationContact(
  transaction: ActorDatabaseTransaction,
) {
  const rows = await transaction.execute<{ contact: unknown }>(sql`
    select app.current_owned_coach_application_contact() as contact
  `);
  if (rows.length !== 1)
    throw Error("Application contact could not be verified.");
  return rows[0].contact === null
    ? null
    : parseCoachApplicationContact(rows[0].contact);
}

export async function saveOwnedCoachApplicationContact(
  transaction: ActorDatabaseTransaction,
  details: CoachApplicationContactDetails,
  expectedRevision: number,
) {
  try {
    const rows = await transaction.execute<{ revision: number }>(sql`
      select app.save_owned_coach_application_contact(
        ${expectedRevision}::integer, ${JSON.stringify(details)}::jsonb
      ) as revision
    `);
    const revision = rows[0]?.revision;
    if (rows.length !== 1 || !Number.isInteger(revision) || revision < 1)
      throw Error("Application contact could not be saved.");
    return revision;
  } catch (error) {
    let cause = error;
    for (let i = 0; i < 4 && cause && typeof cause === "object"; i++) {
      if ("code" in cause && cause.code === "40001")
        throw new CoachApplicationContactConflictError(
          "Application contact changed.",
        );
      cause = "cause" in cause ? cause.cause : null;
    }
    throw error;
  }
}
