import "server-only";
import { isCalendarResult } from "@/calendar/connection";
import { isCalendarExportState } from "@/calendar/export";
import type {
  CalendarSyncIntent,
  CalendarSyncOutcome,
} from "@/server/google-calendar/setup-intent";
import type { ActorDatabaseTransaction } from "../authorization/repository";
import { exportCommandRecord, exportStatusRecord } from "./export-repository";

export async function prepareCalendarSync(
  tx: ActorDatabaseTransaction,
  generation: string,
): Promise<string | null> {
  const value = await exportStatusRecord(tx);
  const status = {
    status: "ready" as const,
    enabled: true,
    connection: value.connection,
  };
  if (!isCalendarResult(status) || !isCalendarExportState(value.export))
    throw new Error("Calendar setup unavailable.");
  if (
    status.connection.generation !== generation ||
    status.connection.state !== "disconnected"
  )
    return null;
  return value.export.version;
}

export async function enableCalendarSync(
  tx: ActorDatabaseTransaction,
  generation: string,
  intent: CalendarSyncIntent,
): Promise<CalendarSyncOutcome> {
  const result = await exportCommandRecord(tx, {
    action: "enable",
    generation,
    version: intent.version,
    commandId: intent.commandId,
  });
  if (result === "ok") return "enabled";
  if (result === "conflict" || result === "connection-required")
    return "changed";
  throw new Error("Calendar booking sync unavailable.");
}
