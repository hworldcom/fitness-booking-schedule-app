import "server-only";
import { sql } from "drizzle-orm";
import type { ActorDatabaseTransaction } from "../authorization/repository";

export type CalendarRecord = {
  generation: string;
  state: string;
  previous_state:
    "disconnected" | "connected" | "reconnect-required" | "recovery-required";
  google_sub: string | null;
  google_email: string | null;
  client_hash: string | null;
  credential_ciphertext: string | null;
  operation_id: string | null;
};
export type CalendarDatabaseResult = {
  kind:
    | "ok"
    | "conflict"
    | "account-mismatch"
    | "recovery-required"
    | "reconnect-required";
  record?: CalendarRecord;
  verifier?: string;
  mode?: "create" | "verify" | "recover";
  calendarId?: string | null;
};
export async function calendarStatusRecord(
  tx: ActorDatabaseTransaction,
): Promise<unknown> {
  const rows = await tx.execute<{ value: unknown }>(
    sql`select app.google_calendar_connection_status() as value`,
  );
  return rows[0]?.value;
}
export async function calendarCommandRecord(
  tx: ActorDatabaseTransaction,
  action: string,
  expected: string | null,
  input: Record<string, unknown>,
): Promise<CalendarDatabaseResult> {
  const rows = await tx.execute<{ value: CalendarDatabaseResult }>(
    sql`select app.google_calendar_connection_command(${action}::text,${expected}::uuid,${JSON.stringify(input)}::jsonb) as value`,
  );
  const value = rows[0]?.value;
  if (
    !value ||
    ![
      "ok",
      "conflict",
      "account-mismatch",
      "recovery-required",
      "reconnect-required",
    ].includes(value.kind)
  )
    throw new Error("Calendar connection unavailable.");
  return value;
}
