import "server-only";
import { isCalendarResult } from "@/calendar/connection";
import {
  isCalendarExportState,
  type CalendarExportResult,
  type CalendarExportCommand,
} from "@/calendar/export";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  exportCommandRecord,
  exportStatusRecord,
} from "@/server/db/google-calendar/export-repository";
import { calendarExportAvailable } from "./export-worker";
import { calendarSiteUrl } from "./config";

export function exportAvailableAt(origin: string) {
  return calendarExportAvailable() && origin === calendarSiteUrl();
}
export async function currentCalendarExport(
  origin: string,
): Promise<CalendarExportResult> {
  const result = await withAuthorizedActor(exportStatusRecord);
  if (result.status !== "authorized")
    return {
      status: result.status === "preview" ? "forbidden" : result.status,
    };
  const connection = {
    status: "ready" as const,
    enabled: false,
    connection: result.value.connection,
  };
  if (
    !isCalendarResult(connection) ||
    connection.status !== "ready" ||
    !isCalendarExportState(result.value.export)
  )
    return { status: "unavailable" };
  return {
    status: "ready",
    available: exportAvailableAt(origin),
    generation: connection.connection.generation,
    connectionState: connection.connection.state,
    export: result.value.export,
  };
}
export async function changeCalendarExport(
  input: CalendarExportCommand,
  origin: string,
): Promise<CalendarExportResult> {
  if (input.action !== "disable" && !exportAvailableAt(origin))
    return { status: "unavailable" };
  const result = await withAuthorizedActor((tx) =>
    exportCommandRecord(tx, input),
  );
  if (result.status !== "authorized")
    return {
      status: result.status === "preview" ? "forbidden" : result.status,
    };
  if (result.value !== "ok")
    return {
      status:
        result.value === "conflict" ||
        result.value === "connection-required" ||
        result.value === "invalid"
          ? result.value
          : "unavailable",
    };
  return currentCalendarExport(origin);
}
