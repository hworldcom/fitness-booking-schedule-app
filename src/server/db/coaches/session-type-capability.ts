import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
/** No cached absence: a subsequent request can see a newly installed migration. */
export async function sessionTypeProjection(
  tx: ActorDatabaseTransaction,
  source: "booking" | "request",
  id: SQL,
) {
  const [row] = await tx.execute<{ installed: boolean }>(
    sql`select to_regprocedure('app.current_training_session_type(text,uuid)') is not null installed`,
  );
  if (typeof row?.installed !== "boolean")
    throw new Error("Session metadata capability unavailable.");
  return row.installed
    ? sql`app.current_training_session_type(${source}::text,${id})`
    : sql`null::jsonb`;
}
export async function sessionDetailsCapability(tx: ActorDatabaseTransaction) {
  const [row] = await tx.execute<{ installed: boolean }>(
    sql`select to_regprocedure('app.session_booking_detail(uuid,integer)') is not null installed`,
  );
  if (typeof row?.installed !== "boolean")
    throw new Error("Session detail capability unavailable.");
  return row.installed;
}
