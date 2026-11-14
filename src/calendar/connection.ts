export const CALENDAR_SETTINGS_PATH = "/account?section=connected-calendars";
export const CALENDAR_STATES = [
  "disconnected",
  "connecting",
  "connected",
  "reconnect-required",
  "recovery-required",
] as const;
export type CalendarState = (typeof CALENDAR_STATES)[number];
export type CalendarConnection = Readonly<{
  state: CalendarState;
  generation: string;
  email: string | null;
  calendarId: string | null;
  checkedAt: string | null;
}>;
export type CalendarResult =
  | Readonly<{
      status: "ready";
      enabled: boolean;
      connection: CalendarConnection;
    }>
  | Readonly<{
      status:
        | "signed-out"
        | "forbidden"
        | "unavailable"
        | "invalid"
        | "conflict"
        | "delete-uncertain";
    }>;
export function calendarUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value)
  );
}
export function calendarId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 1024 &&
    value !== "primary" &&
    /^[A-Za-z0-9_@.-]+$/.test(value)
  );
}
export function isCalendarResult(value: unknown): value is CalendarResult {
  if (!value || typeof value !== "object") return false;
  const r = value as CalendarResult;
  if (r.status !== "ready")
    return (
      Object.keys(value).length === 1 &&
      [
        "signed-out",
        "forbidden",
        "unavailable",
        "invalid",
        "conflict",
        "delete-uncertain",
      ].includes(r.status)
    );
  const c = r.connection;
  return (
    Object.keys(value).length === 3 &&
    typeof r.enabled === "boolean" &&
    !!c &&
    Object.keys(c).length === 5 &&
    CALENDAR_STATES.includes(c.state) &&
    calendarUuid(c.generation) &&
    (c.email === null ||
      (typeof c.email === "string" && c.email.length <= 320)) &&
    (c.calendarId === null || calendarId(c.calendarId)) &&
    (c.checkedAt === null ||
      (typeof c.checkedAt === "string" &&
        Number.isFinite(Date.parse(c.checkedAt))))
  );
}
export type CalendarCommand = Readonly<{
  action: "disconnect" | "delete" | "check" | "recover" | "replace";
  generation: string;
  calendarId?: string;
  commandId?: string;
}>;
export function calendarCommand(value: unknown): CalendarCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as CalendarCommand;
  if (
    !calendarUuid(v.generation) ||
    !["disconnect", "delete", "check", "recover", "replace"].includes(v.action)
  )
    return null;
  const keys =
    v.action === "recover"
      ? ["action", "generation", "calendarId"]
      : v.action === "replace" || v.action === "delete"
        ? ["action", "generation", "commandId"]
        : ["action", "generation"];
  if (
    Object.keys(v).some((k) => !keys.includes(k)) ||
    (v.action === "recover" && !calendarId(v.calendarId))
  )
    return null;
  if (
    (v.action === "replace" || v.action === "delete") &&
    !calendarUuid(v.commandId)
  )
    return null;
  return v;
}
