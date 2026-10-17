import "server-only";

import { sql } from "drizzle-orm";
import { isAccountResult, type AccountDetails } from "@/account/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

export async function currentAccountDetailsRecord(
  transaction: ActorDatabaseTransaction,
) {
  const rows = await transaction.execute<{ details: unknown }>(
    sql`select app.current_account_settings() as details`,
  );
  const value = { status: "ready", details: rows[0]?.details };
  if (!isAccountResult(value)) throw new Error("Account settings unavailable.");
  return value;
}

export async function saveAccountDetailsRecord(
  transaction: ActorDatabaseTransaction,
  details: AccountDetails,
) {
  const rows = await transaction.execute<{ result: unknown }>(sql`
    select app.save_current_account_settings(${details.displayName}::text,
      ${details.birthdate}::date, ${details.gender}::text, ${details.revision}::integer) as result
  `);
  const value = rows[0]?.result;
  if (!isAccountResult(value)) throw new Error("Account settings unavailable.");
  return value;
}
