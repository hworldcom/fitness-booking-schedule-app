import "server-only";

import { sql } from "drizzle-orm";
import type { CoachApplicationStatus } from "@/domain/coaches";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

function isCoachApplicationStatus(
  value: string | undefined,
): value is CoachApplicationStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "suspended"
  );
}

export async function submitOwnedCoachApplicationRecord(
  transaction: ActorDatabaseTransaction,
) {
  const rows = await transaction.execute<{ application_status: string }>(sql`
    select app.submit_owned_coach_application() as application_status
  `);
  const status = rows[0]?.application_status;
  if (rows.length !== 1 || !isCoachApplicationStatus(status)) {
    throw new Error("Coach application returned no authoritative state.");
  }
  return status;
}
