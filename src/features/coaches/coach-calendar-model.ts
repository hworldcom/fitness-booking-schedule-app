import type { CoachTrainingLocation } from "@/domain/coaches";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { coachEventHref } from "@/features/coach-events/contract";
import type {
  CalendarItem,
  CalendarPage,
  CalendarQuery,
} from "@/domain/coach-calendar";
export type CoachCalendarData = Readonly<{
  scope: string;
  actorIdentity: string;
  locations: readonly CoachTrainingLocation[];
  mayEditAvailability: boolean;
  page: CalendarPage;
  query: CalendarQuery;
}>;
export type CoachCalendarResult =
  | Readonly<{ status: "ready"; data: CoachCalendarData }>
  | Readonly<{ status: "unavailable" | "denied" | "invalid"; message: string }>;
export type CoachCalendarLoader = (
  query: CalendarQuery,
  scope: string,
) => Promise<CoachCalendarResult>;
export function calendarActorAccess(
  session: AuthSessionSnapshot,
  actor: ActorSnapshot,
  data: Pick<CoachCalendarData, "scope" | "actorIdentity"> &
    Partial<Pick<CoachCalendarData, "mayEditAvailability">>,
) {
  if (session.status === "unavailable") return "pending";
  if (
    session.status !== "signed-in" ||
    session.subject !== data.scope.split(":")[0]
  )
    return "denied";
  if (actor.status === "unavailable") return "pending";
  if (
    actor.status === "authorized" &&
    actor.coachAccessStatus === "suspended" &&
    data.mayEditAvailability
  )
    return "denied";
  return actor.status === "authorized" &&
    [actor.profile.slug, actor.demoRun.slug, actor.role].join(":") ===
      data.actorIdentity &&
    ["approved", "demo", "suspended"].includes(actor.coachAccessStatus)
    ? "allowed"
    : "denied";
}
export function calendarDetailHref(item: CalendarItem) {
  return item.source === "booking"
    ? `/coach?view=bookings#coach-booking-${item.id}`
    : item.source === "availability"
      ? `/coach?view=bookings&occurrence=${item.id}#coach-occurrence-${item.id}`
      : coachEventHref(item.id);
}
export function calendarItemRange(
  item: Pick<CalendarItem, "startsAt" | "endsAt">,
  date?: string,
) {
  const time = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value));
  const local = (value: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  const label = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      day: "numeric",
      month: "short",
    }).format(new Date(value));
  if (date)
    return `${local(item.startsAt) < date ? "00:00" : time(item.startsAt)}–${local(item.endsAt) > date ? "24:00" : time(item.endsAt)}`;
  return local(item.startsAt) === local(item.endsAt)
    ? `${time(item.startsAt)}–${time(item.endsAt)}`
    : `${label(item.startsAt)}, ${time(item.startsAt)} – ${label(item.endsAt)}, ${time(item.endsAt)}`;
}
export function calendarMinutes(time: string, date: string) {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
  if (localDate < date) return 0;
  if (localDate > date) return 1440;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(time))
    .split(":")
    .map(Number);
  return Math.max(0, Math.min(1440, parts[0] * 60 + parts[1]));
}
/** Lay out overlapping history alongside current commitments without hiding either. */
export function calendarLanes(items: readonly CalendarItem[], date: string) {
  const sorted = items
    .map((item) => ({
      item,
      start: calendarMinutes(item.startsAt, date),
      end: calendarMinutes(item.endsAt, date),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const groups: (typeof sorted)[] = [];
  let group: typeof sorted = [];
  let until = -1;
  for (const entry of sorted) {
    if (entry.start >= until && group.length) {
      groups.push(group);
      group = [];
      until = -1;
    }
    group.push(entry);
    until = Math.max(until, entry.end);
  }
  if (group.length) groups.push(group);
  return groups.flatMap((group) => {
    const lanes: number[] = [];
    const positioned = group.map((entry) => {
      let lane = lanes.findIndex((end) => end <= entry.start);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = entry.end;
      return { ...entry, lane };
    });
    return positioned.map((entry) => ({ ...entry, lanes: lanes.length }));
  });
}
