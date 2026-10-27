import { isCanonicalUuid } from "@/domain/coach-bookings";

export type TrainingItem = Readonly<{
  key: string;
  source: "personal" | "booking" | "group" | "request";
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  state: string;
  attendance: "planned" | "attended" | "skipped" | "cancelled";
  notes: string;
  intensity: string | null;
  actualMinutes: number | null;
  revision: number;
  seriesId: string | null;
  planRevision: number | null;
  href: string | null;
  location: string | null;
}>;
export type TrainingPage = Readonly<{
  items: readonly TrainingItem[];
  next: number | null;
  now: string;
  weekCount: number;
  monthCount: number;
  remindersEnabled: boolean;
}>;
export type TrainingCommand = Readonly<{
  action: "list" | "save" | "series" | "stop" | "attendance" | "preference";
  args: Record<string, unknown>;
}>;
export type TrainingResult =
  | { status: "ready"; value: TrainingPage | { saved: true }; scope: string }
  | {
      status:
        | "invalid"
        | "conflict"
        | "signed-out"
        | "forbidden"
        | "preview"
        | "unavailable"
        | "actor-changed";
    };

export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^20\d\d-\d\d-\d\d$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function localDate(value: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function calendarPeriod(date: string, view: "week" | "month") {
  const start = view === "month" ? date.slice(0, 8) + "01" : date;
  const weekday = (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7;
  const from = addDays(start, -weekday);
  const through = addDays(from, view === "month" ? 41 : 6);
  const shift = (direction: number) =>
    view === "week"
      ? addDays(date, direction * 7)
      : new Date(
          Date.UTC(
            Number(date.slice(0, 4)),
            Number(date.slice(5, 7)) - 1 + direction,
            1,
            12,
          ),
        )
          .toISOString()
          .slice(0, 10);
  return { from, through, previous: shift(-1), next: shift(1) };
}
export function spontaneousDefaults(now: string, timezone: string) {
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(now));
  const elapsed = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
  const minutes = Math.max(1, Math.min(60, elapsed));
  return {
    startsAt: new Date(Date.parse(now) - minutes * 60000).toISOString(),
    minutes,
  };
}
export function validTrainingCommand(input: unknown): input is TrainingCommand {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input))
      return false;
    const { action, args, ...extra } = input as Record<string, unknown>;
    if (
      Object.keys(extra).length ||
      !args ||
      typeof args !== "object" ||
      Array.isArray(args)
    )
      return false;
    const a = args as Record<string, unknown>;
    const keys =
      action === "list"
        ? ["from", "through", "timezone", "offset"]
        : action === "preference"
          ? ["commandId", "enabled"]
          : action === "stop"
            ? ["commandId", "seriesId", "planRevision"]
            : action === "attendance"
              ? [
                  "commandId",
                  "key",
                  "revision",
                  "attendance",
                  "notes",
                  "intensity",
                  "actualMinutes",
                ]
              : action === "save" || action === "series"
                ? [
                    "commandId",
                    "key",
                    "revision",
                    "seriesId",
                    "planRevision",
                    "title",
                    "date",
                    "time",
                    "timezone",
                    "minutes",
                    "weekly",
                    "completed",
                    "notes",
                    "intensity",
                    "actualMinutes",
                  ]
                : [];
    if (!keys.length || Object.keys(a).some((k) => !keys.includes(k)))
      return false;
    if (action === "list")
      return (
        validDate(a.from) &&
        validDate(a.through) &&
        a.through >= a.from &&
        Date.parse(a.through) - Date.parse(a.from) <= 41 * 86400000 &&
        validTimezone(a.timezone) &&
        (a.offset === undefined ||
          (Number.isInteger(a.offset) &&
            Number(a.offset) >= 0 &&
            Number(a.offset) <= 10000))
      );
    if (!isCanonicalUuid(String(a.commandId))) return false;
    if (action === "preference") return typeof a.enabled === "boolean";
    if (action === "stop")
      return (
        isCanonicalUuid(String(a.seriesId)) &&
        Number.isInteger(a.planRevision) &&
        Number(a.planRevision) > 0
      );
    if (
      a.key !== undefined &&
      (typeof a.key !== "string" || a.key.length > 100)
    )
      return false;
    if (
      a.notes !== undefined &&
      (typeof a.notes !== "string" || a.notes.length > 2000)
    )
      return false;
    if (
      a.intensity !== undefined &&
      a.intensity !== null &&
      !["Easy", "Moderate", "Hard"].includes(String(a.intensity))
    )
      return false;
    if (
      a.actualMinutes !== undefined &&
      a.actualMinutes !== null &&
      (!Number.isInteger(a.actualMinutes) ||
        Number(a.actualMinutes) < 1 ||
        Number(a.actualMinutes) > 1440)
    )
      return false;
    if (
      a.revision !== undefined &&
      (!Number.isInteger(a.revision) || Number(a.revision) < 0)
    )
      return false;
    if (action === "attendance")
      return (
        typeof a.key === "string" &&
        Number.isInteger(a.revision) &&
        ["planned", "attended", "skipped", "cancelled"].includes(
          String(a.attendance),
        )
      );
    return (
      typeof a.title === "string" &&
      a.title.trim().length > 0 &&
      a.title.length <= 80 &&
      validDate(a.date) &&
      typeof a.time === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time) &&
      validTimezone(a.timezone) &&
      (a.minutes === undefined ||
        (Number.isInteger(a.minutes) &&
          Number(a.minutes) >= 1 &&
          Number(a.minutes) <= 1440)) &&
      (a.weekly === undefined || typeof a.weekly === "boolean") &&
      (a.completed === undefined || typeof a.completed === "boolean") &&
      (a.seriesId === undefined || isCanonicalUuid(String(a.seriesId))) &&
      (action !== "series" ||
        (isCanonicalUuid(String(a.seriesId)) &&
          Number.isInteger(a.planRevision)))
    );
  } catch {
    return false;
  }
}

export function parseTrainingPage(value: unknown): TrainingPage {
  const p = value as TrainingPage;
  if (
    !p ||
    !Array.isArray(p.items) ||
    p.items.length > 100 ||
    !Number.isInteger(p.weekCount) ||
    !Number.isInteger(p.monthCount) ||
    typeof p.remindersEnabled !== "boolean" ||
    !Number.isFinite(Date.parse(p.now)) ||
    (p.next !== null && (!Number.isInteger(p.next) || p.next < 0))
  )
    throw Error("Invalid training page");
  for (const item of p.items) {
    if (
      !item ||
      typeof item.key !== "string" ||
      item.key.length > 100 ||
      typeof item.title !== "string" ||
      item.title.length > 80 ||
      !["personal", "booking", "group", "request"].includes(item.source) ||
      !Number.isFinite(Date.parse(item.startsAt)) ||
      !Number.isFinite(Date.parse(item.endsAt)) ||
      typeof item.notes !== "string" ||
      item.notes.length > 2000 ||
      !["planned", "attended", "skipped", "cancelled"].includes(
        item.attendance,
      ) ||
      (item.href !== null &&
        !/^\/(sessions(\/[0-9a-f-]{36}|#booking-requests)|events\/group-[0-9a-f]{32})$/.test(
          item.href,
        ))
    )
      throw Error("Invalid training item");
  }
  return p;
}
