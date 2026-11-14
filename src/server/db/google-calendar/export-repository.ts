import "server-only";
import { sql } from "drizzle-orm";
import type { ActorDatabaseTransaction } from "../authorization/repository";
import type { CalendarExportCommand } from "@/calendar/export";
import { calendarStatusRecord } from "./repository";

export async function exportStatusRecord(tx: ActorDatabaseTransaction) {
  const rows = await tx.execute<{ value: unknown }>(
    sql`select app.google_calendar_export_status() value`,
  );
  return { connection: await calendarStatusRecord(tx), export: rows[0]?.value };
}
export async function exportCommandRecord(
  tx: ActorDatabaseTransaction,
  input: CalendarExportCommand,
) {
  const rows = await tx.execute<{
    value: unknown;
  }>(sql`select app.google_calendar_export_command(
    ${input.action}::text,${input.version}::uuid,${input.generation}::uuid,${input.commandId}::uuid,${input.acknowledged === true}::boolean) value`);
  return rows[0]?.value;
}
