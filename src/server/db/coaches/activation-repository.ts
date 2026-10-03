import "server-only";

import { sql } from "drizzle-orm";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

export async function activateOwnedCoachingRecord(
  transaction: ActorDatabaseTransaction,
) {
  const rows = await transaction.execute<{ activated_at: string }>(sql`
    select app.activate_owned_coaching() as activated_at
  `);
  const activatedAt = rows[0]?.activated_at;
  if (!activatedAt || rows.length !== 1) {
    throw new Error("Coaching activation returned no authoritative state.");
  }
  return activatedAt;
}
