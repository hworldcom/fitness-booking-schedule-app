import "server-only";

import { sql } from "drizzle-orm";
import { isAccountResult, type AccountInput } from "@/account/contracts";
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
  details: AccountInput,
) {
  const { section, revision, ...values } = details;
  const rows = await transaction.execute<{ result: unknown }>(sql`
    select app.update_current_account_settings(${section}::text,
      ${JSON.stringify(values)}::jsonb, ${revision}::integer) as result
  `);
  const value = rows[0]?.result;
  if (!isAccountResult(value)) throw new Error("Account settings unavailable.");
  return value;
}
