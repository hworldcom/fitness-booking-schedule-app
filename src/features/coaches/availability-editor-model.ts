import type {
  CoachAvailabilityIsoWeekday,
  CoachAvailabilityRuleInput,
  CoachTrainingLocation,
} from "@/domain/coaches";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import {
  expandAvailabilityRanges,
  isAvailabilityDate,
  type AvailabilityHour,
  type EffectiveAvailabilityCommand,
  type EffectiveAvailabilityPolicy,
  type EffectiveAvailabilityResult,
} from "@/domain/effective-availability";

export const AVAILABILITY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type AvailabilityRange = Readonly<{
  id: string;
  startTime: string;
  endTime: string;
  locationId: string;
  locationUpdatedAt: string;
}>;
export type WeeklyRangeDraft = readonly (readonly AvailabilityRange[])[];
export type AvailabilityEditorData = Readonly<{
  scope: string;
  actorIdentity: string;
  policy: EffectiveAvailabilityPolicy;
  locations: readonly CoachTrainingLocation[];
  today: string;
}>;
export function availabilityActorAccess(
  session: AuthSessionSnapshot,
  actor: ActorSnapshot,
  data: Pick<AvailabilityEditorData, "scope" | "actorIdentity">,
): "allowed" | "pending" | "denied" {
  if (session.status === "unavailable") return "pending";
  if (
    session.status !== "signed-in" ||
    session.subject !== data.scope.split(":")[0]
  )
    return "denied";
  if (actor.status === "unavailable") return "pending";
  return actor.status === "authorized" &&
    [actor.profile.slug, actor.demoRun.slug, actor.role].join(":") ===
      data.actorIdentity &&
    ["approved", "demo"].includes(actor.coachAccessStatus)
    ? "allowed"
    : "denied";
}
export type AvailabilityLoadResult =
  | Readonly<{ status: "ready"; data: AvailabilityEditorData }>
  | Readonly<{ status: "unavailable" | "denied"; message: string }>;
export type AvailabilityActionResult =
  | Readonly<{ status: "ready"; result: EffectiveAvailabilityResult }>
  | Readonly<{ status: "invalid"; message: string }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "denied"; message: string }>;
export type AvailabilityEditorActions = Readonly<{
  load: (
    from: string,
    through: string,
    scope: string,
  ) => Promise<AvailabilityLoadResult>;
  change: (
    command: EffectiveAvailabilityCommand,
    scope: string,
    preview: boolean,
  ) => Promise<AvailabilityActionResult>;
}>;

export function berlinAvailabilityDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function availabilityMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, 1, 12));
  return {
    from: `${date.slice(0, 7)}-01`,
    through: new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10),
    previous: new Date(Date.UTC(year, month - 2, 1, 12))
      .toISOString()
      .slice(0, 10),
    next: new Date(Date.UTC(year, month, 1, 12)).toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(at),
  };
}
export function availabilityHref(date: string) {
  return `/coach?view=schedule&section=availability&date=${date}`;
}
export function rangesFromHours(
  hours: readonly AvailabilityHour[],
): readonly AvailabilityRange[] {
  const ranges: AvailabilityRange[] = [];
  for (const hour of [...hours].sort((a, b) =>
    a.localStartTime.localeCompare(b.localStartTime),
  )) {
    const endTime = `${String(Number(hour.localStartTime.slice(0, 2)) + 1).padStart(2, "0")}:00`;
    const last = ranges.at(-1);
    if (
      last &&
      last.endTime === hour.localStartTime &&
      last.locationId === hour.locationId &&
      last.locationUpdatedAt === hour.locationUpdatedAt
    )
      ranges[ranges.length - 1] = { ...last, endTime };
    else
      ranges.push({
        ...hour,
        id: `${hour.localStartTime}:${hour.locationId}`,
        startTime: hour.localStartTime,
        endTime,
      });
  }
  return ranges;
}
export function weeklyRanges(
  hours: readonly CoachAvailabilityRuleInput[],
): WeeklyRangeDraft {
  return AVAILABILITY_DAYS.map((_, i) =>
    rangesFromHours(hours.filter((h) => h.isoWeekday === i + 1)),
  );
}
export function weeklyHours(
  draft: WeeklyRangeDraft,
): readonly CoachAvailabilityRuleInput[] {
  return draft.flatMap((ranges, i) =>
    expandAvailabilityRanges(ranges).map((h) => ({
      ...h,
      isoWeekday: (i + 1) as CoachAvailabilityIsoWeekday,
    })),
  );
}
export function copyAvailabilityDay(
  draft: WeeklyRangeDraft,
  source: number,
  targets: readonly number[],
): WeeklyRangeDraft {
  return draft.map((day, i) =>
    targets.includes(i) && i !== source
      ? draft[source].map((r) => ({ ...r, id: `${i}:${r.id}` }))
      : day,
  );
}
export function applyAvailabilityCommand(
  policy: EffectiveAvailabilityPolicy,
  command: EffectiveAvailabilityCommand,
  revision: number,
): EffectiveAvailabilityPolicy {
  if (command.kind === "weekly")
    return { ...policy, revision, weeklyHours: command.hours };
  const dates = new Map(policy.dates.map((d) => [d.date, d]));
  for (const date of command.dates) {
    if (date.mode === "weekly") dates.delete(date.date);
    else dates.set(date.date, date);
  }
  return {
    ...policy,
    revision,
    dates: [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function hoursValid(value: unknown, weekly: boolean): boolean {
  if (!Array.isArray(value) || value.length > (weekly ? 161 : 23)) return false;
  const seen = new Set<string>();
  return value.every((h) => {
    if (
      !object(h) ||
      Object.keys(h).some(
        (k) =>
          ![
            "locationId",
            "locationUpdatedAt",
            "localStartTime",
            ...(weekly ? ["isoWeekday"] : []),
          ].includes(k),
      ) ||
      !uuid(h.locationId) ||
      typeof h.locationUpdatedAt !== "string" ||
      h.locationUpdatedAt.length > 40 ||
      !Number.isFinite(Date.parse(h.locationUpdatedAt)) ||
      typeof h.localStartTime !== "string" ||
      !/^(?:[01]\d|2[0-2]):00$/.test(h.localStartTime) ||
      (weekly &&
        (!Number.isInteger(h.isoWeekday) ||
          Number(h.isoWeekday) < 1 ||
          Number(h.isoWeekday) > 7))
    )
      return false;
    const key = `${weekly ? h.isoWeekday : ""}|${h.localStartTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/** Treat Server Action arguments as untrusted; SQL rechecks current authority. */
export function parseAvailabilityCommand(
  value: unknown,
): EffectiveAvailabilityCommand | null {
  if (
    !object(value) ||
    !uuid(value.operationId) ||
    !Number.isInteger(value.expectedRevision) ||
    Number(value.expectedRevision) < 0 ||
    Number(value.expectedRevision) > 999999999
  )
    return null;
  if (
    value.kind === "weekly" &&
    Object.keys(value).every((k) =>
      ["kind", "operationId", "expectedRevision", "hours"].includes(k),
    ) &&
    hoursValid(value.hours, true)
  )
    return value as EffectiveAvailabilityCommand;
  if (
    value.kind !== "dates" ||
    Object.keys(value).some(
      (k) => !["kind", "operationId", "expectedRevision", "dates"].includes(k),
    ) ||
    !Array.isArray(value.dates) ||
    value.dates.length < 1 ||
    value.dates.length > 31
  )
    return null;
  const dates = new Set<string>();
  for (const d of value.dates) {
    if (
      !object(d) ||
      Object.keys(d).some((k) => !["date", "mode", "hours"].includes(k)) ||
      typeof d.date !== "string" ||
      !isAvailabilityDate(d.date) ||
      dates.has(d.date) ||
      !["custom", "unavailable", "weekly"].includes(String(d.mode)) ||
      !hoursValid(d.hours, false) ||
      !Array.isArray(d.hours) ||
      (d.mode === "custom" ? d.hours.length === 0 : d.hours.length !== 0)
    )
      return null;
    dates.add(d.date);
  }
  return value as EffectiveAvailabilityCommand;
}
