import {
  calendarUuid,
  CALENDAR_STATES,
  type CalendarState,
} from "./connection";

export type CalendarExportState = Readonly<{
  enabled: boolean;
  version: string;
  backfillPending: boolean;
  pending: number;
  failed: number;
  missing: number;
  issues: readonly string[];
  lastSyncedAt: string | null;
}>;
export type CalendarExportResult =
  | Readonly<{
      status: "ready";
      available: boolean;
      connectionState: CalendarState;
      generation: string;
      export: CalendarExportState;
    }>
  | Readonly<{
      status:
        | "unavailable"
        | "signed-out"
        | "forbidden"
        | "invalid"
        | "conflict"
        | "connection-required";
    }>;
export type CalendarExportCommand = Readonly<{
  action: "enable" | "disable" | "retry" | "repair";
  version: string;
  generation: string;
  commandId: string;
  acknowledged?: true;
}>;
export function calendarExportCommand(
  value: unknown,
): CalendarExportCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as CalendarExportCommand;
  const keys = [
    "action",
    "version",
    "generation",
    "commandId",
    ...(v.action === "repair" ? ["acknowledged"] : []),
  ];
  return ["enable", "disable", "retry", "repair"].includes(v.action) &&
    calendarUuid(v.version) &&
    calendarUuid(v.generation) &&
    calendarUuid(v.commandId) &&
    Object.keys(v).length === keys.length &&
    Object.keys(v).every((k) => keys.includes(k)) &&
    (v.action !== "repair" || v.acknowledged === true)
    ? v
    : null;
}
export function isCalendarExportState(
  value: unknown,
): value is CalendarExportState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as CalendarExportState;
  return (
    Object.keys(v).length === 8 &&
    typeof v.enabled === "boolean" &&
    calendarUuid(v.version) &&
    typeof v.backfillPending === "boolean" &&
    [v.pending, v.failed, v.missing].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) &&
    v.missing <= v.failed &&
    Array.isArray(v.issues) &&
    v.issues.length <= 7 &&
    new Set(v.issues).size === v.issues.length &&
    v.issues.every((x) =>
      [
        "transient",
        "authorization-required",
        "calendar-missing",
        "event-missing",
        "ownership-conflict",
        "outcome-unknown",
        "retry-exhausted",
      ].includes(x),
    ) &&
    (v.lastSyncedAt === null ||
      (typeof v.lastSyncedAt === "string" &&
        Number.isFinite(Date.parse(v.lastSyncedAt))))
  );
}
export function isCalendarExportResult(
  value: unknown,
): value is CalendarExportResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as CalendarExportResult;
  if (v.status !== "ready")
    return (
      Object.keys(v).length === 1 &&
      [
        "unavailable",
        "signed-out",
        "forbidden",
        "invalid",
        "conflict",
        "connection-required",
      ].includes(v.status)
    );
  return (
    Object.keys(v).length === 5 &&
    typeof v.available === "boolean" &&
    CALENDAR_STATES.includes(v.connectionState) &&
    calendarUuid(v.generation) &&
    isCalendarExportState(v.export)
  );
}
