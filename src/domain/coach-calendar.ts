import { isCanonicalUuid } from "./coach-bookings";
import { isAvailabilityDate } from "./effective-availability";

export const CALENDAR_PAGE_SIZE = 50;
export type CalendarView = "day" | "week" | "month";
export type CalendarType = "all" | "private" | "group";
export type CalendarSource = "availability" | "booking" | "group";
export type CalendarStatus =
  | "available"
  | "withdrawn"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "open"
  | "not-confirmed";
export type CalendarCursor = Readonly<{
  at: string;
  source: CalendarSource;
  id: string;
  queryKey: string;
}>;
export type CalendarQuery = Readonly<{
  from: string;
  through: string;
  type: CalendarType;
  venueId: string | null;
  sessionTypeId?: string | null;
  history: boolean;
  after: CalendarCursor | null;
}>;
export type CalendarSelection = Readonly<{
  date: string;
  view: CalendarView;
  type: CalendarType;
  venueId: string | null;
  sessionTypeId?: string | null;
  history: boolean;
}>;
export type CalendarItem = Readonly<{
  source: CalendarSource;
  id: string;
  startsAt: string;
  endsAt: string;
  status: CalendarStatus;
  title: string;
  locationId: string | null;
  venueName: string;
  venueLabel: string;
  venueActive: boolean;
  pendingCount: number;
  sessionTypeId?: string | null;
  sessionTypeName?: string | null;
  sessionTypeColor?: string | null;
}>;
export type CalendarDay = Readonly<{
  date: string;
  total: number;
  previews: readonly CalendarItem[];
}>;
export type CalendarPage = Readonly<{
  items: readonly CalendarItem[];
  nextCursor: CalendarCursor | null;
  total: number;
  days: readonly CalendarDay[];
  now: string;
  version: string;
}>;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const time = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 40 &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
  Number.isFinite(Date.parse(value));
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
export const calendarDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function calendarDates(from: string, through: string) {
  const result: string[] = [];
  for (
    let date = from;
    date <= through && result.length < 42;
    date = addCalendarDays(date, 1)
  )
    result.push(date);
  return result;
}
export function calendarPeriod(
  selection: Pick<CalendarSelection, "date" | "view">,
) {
  const value = new Date(`${selection.date}T12:00:00Z`);
  const weekday = (value.getUTCDay() + 6) % 7;
  if (selection.view === "day")
    return {
      from: selection.date,
      through: selection.date,
      previous: addCalendarDays(selection.date, -1),
      next: addCalendarDays(selection.date, 1),
    };
  if (selection.view === "week") {
    const from = addCalendarDays(selection.date, -weekday);
    return {
      from,
      through: addCalendarDays(from, 6),
      previous: addCalendarDays(selection.date, -7),
      next: addCalendarDays(selection.date, 7),
    };
  }
  value.setUTCDate(1);
  const first = value.toISOString().slice(0, 10);
  const from = addCalendarDays(first, -((value.getUTCDay() + 6) % 7));
  value.setUTCMonth(value.getUTCMonth() - 1);
  const previous = value.toISOString().slice(0, 10);
  value.setUTCMonth(value.getUTCMonth() + 2);
  return {
    from,
    through: addCalendarDays(from, 41),
    previous,
    next: value.toISOString().slice(0, 10),
  };
}
export function calendarQueryKey(
  query: Pick<
    CalendarQuery,
    "from" | "through" | "type" | "venueId" | "history" | "sessionTypeId"
  >,
) {
  return [
    query.from,
    query.through,
    query.type,
    query.venueId ?? "all",
    query.history ? "1" : "0",
    ...(query.sessionTypeId ? [query.sessionTypeId] : []),
  ].join("|");
}
export function parseCalendarQuery(value: unknown): CalendarQuery | null {
  if (
    !record(value) ||
    Object.keys(value).some(
      (k) =>
        ![
          "from",
          "through",
          "type",
          "venueId",
          "history",
          "after",
          "sessionTypeId",
        ].includes(k),
    ) ||
    typeof value.from !== "string" ||
    typeof value.through !== "string" ||
    !isAvailabilityDate(value.from) ||
    !isAvailabilityDate(value.through) ||
    value.through < value.from ||
    (Date.parse(value.through) - Date.parse(value.from)) / 86400000 > 41 ||
    !["all", "private", "group"].includes(String(value.type)) ||
    (value.venueId !== null &&
      (typeof value.venueId !== "string" || !isCanonicalUuid(value.venueId))) ||
    (value.sessionTypeId !== undefined &&
      value.sessionTypeId !== null &&
      (typeof value.sessionTypeId !== "string" ||
        !isCanonicalUuid(value.sessionTypeId))) ||
    typeof value.history !== "boolean"
  )
    return null;
  const query = value as CalendarQuery;
  const after = value.after;
  if (
    after !== null &&
    (!record(after) ||
      Object.keys(after).some(
        (k) => !["at", "source", "id", "queryKey"].includes(k),
      ) ||
      !time(after.at) ||
      !["availability", "booking", "group"].includes(String(after.source)) ||
      typeof after.id !== "string" ||
      !isCanonicalUuid(after.id) ||
      after.queryKey !== calendarQueryKey(query))
  )
    return null;
  return query;
}
export function calendarSelection(
  params: Record<string, string | string[] | undefined>,
  today: string,
): CalendarSelection {
  return {
    date:
      typeof params.date === "string" && isAvailabilityDate(params.date)
        ? params.date
        : today,
    view:
      params.calendarView === "day" || params.calendarView === "month"
        ? params.calendarView
        : "week",
    type:
      params.type === "private" || params.type === "group"
        ? params.type
        : "all",
    venueId:
      typeof params.venue === "string" && isCanonicalUuid(params.venue)
        ? params.venue
        : null,
    history: params.history === "1",
    ...(typeof params.sessionType === "string" &&
    isCanonicalUuid(params.sessionType)
      ? { sessionTypeId: params.sessionType }
      : {}),
  };
}
export function calendarHref(selection: CalendarSelection) {
  const params = new URLSearchParams({
    view: "schedule",
    section: "calendar",
    date: selection.date,
    calendarView: selection.view,
    type: selection.type,
  });
  if (selection.sessionTypeId)
    params.set("sessionType", selection.sessionTypeId);
  if (selection.venueId) params.set("venue", selection.venueId);
  if (selection.history) params.set("history", "1");
  return `/coach?${params}`;
}
export function itemOnCalendarDate(item: CalendarItem, date: string) {
  return (
    calendarDate(item.startsAt) <= date &&
    calendarDate(new Date(Date.parse(item.endsAt) - 1)) >= date
  );
}
export const calendarItemKey = (item: Pick<CalendarItem, "source" | "id">) =>
  `${item.source}:${item.id}`;
export function calendarStatusLabel(item: CalendarItem, now: string) {
  if (
    item.source === "group" &&
    item.status === "confirmed" &&
    Date.parse(item.endsAt) <= Date.parse(now)
  )
    return "Ended";
  return {
    available: "Available",
    withdrawn: "Withdrawn",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    open: "Awaiting confirmation",
    "not-confirmed": "Not confirmed",
  }[item.status];
}
export function mergeCalendarItems(
  previous: readonly CalendarItem[],
  next: readonly CalendarItem[],
) {
  const byId = new Map(previous.map((item) => [calendarItemKey(item), item]));
  for (const item of next) byId.set(calendarItemKey(item), item);
  return [...byId.values()].sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      a.startsAt.localeCompare(b.startsAt) ||
      a.source.localeCompare(b.source) ||
      a.id.localeCompare(b.id),
  );
}
function parseItem(value: unknown): CalendarItem {
  if (
    record(value) &&
    value.sessionTypeId !== undefined &&
    ((value.sessionTypeId !== null &&
      (typeof value.sessionTypeId !== "string" ||
        !isCanonicalUuid(value.sessionTypeId))) ||
      (value.sessionTypeName !== null && !text(value.sessionTypeName, 80)) ||
      (value.sessionTypeColor !== null &&
        (typeof value.sessionTypeColor !== "string" ||
          !/^#[0-9a-f]{6}$/.test(value.sessionTypeColor))))
  )
    throw new Error("Calendar type unavailable.");
  if (
    !record(value) ||
    !["availability", "booking", "group"].includes(String(value.source)) ||
    typeof value.id !== "string" ||
    !isCanonicalUuid(value.id) ||
    !time(value.startsAt) ||
    !time(value.endsAt) ||
    Date.parse(value.startsAt) >= Date.parse(value.endsAt) ||
    !text(value.title, 240) ||
    (value.locationId !== null &&
      (typeof value.locationId !== "string" ||
        !isCanonicalUuid(value.locationId))) ||
    !text(value.venueName, 240) ||
    !text(value.venueLabel, 240) ||
    typeof value.venueActive !== "boolean" ||
    !count(value.pendingCount)
  )
    throw new Error("Calendar item is unavailable.");
  const allowed =
    value.source === "availability"
      ? ["available", "withdrawn"]
      : value.source === "booking"
        ? ["confirmed", "completed", "cancelled"]
        : ["open", "confirmed", "cancelled", "not-confirmed"];
  if (
    !allowed.includes(String(value.status)) ||
    (value.source !== "availability" && value.pendingCount !== 0) ||
    (value.status !== "available" && value.pendingCount !== 0)
  )
    throw new Error("Calendar state is unavailable.");
  return {
    source: value.source as CalendarSource,
    id: value.id,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    status: value.status as CalendarStatus,
    title: value.title,
    locationId: value.locationId as string | null,
    venueName: value.venueName,
    venueLabel: value.venueLabel,
    venueActive: value.venueActive,
    pendingCount: value.pendingCount,
    ...(value.sessionTypeId !== undefined
      ? {
          sessionTypeId: value.sessionTypeId as string | null,
          sessionTypeName: value.sessionTypeName as string | null,
          sessionTypeColor: value.sessionTypeColor as string | null,
        }
      : {}),
  };
}
export function parseCalendarPage(
  value: unknown,
  query: CalendarQuery,
): CalendarPage {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    value.items.length > CALENDAR_PAGE_SIZE ||
    !count(value.total) ||
    !time(value.now) ||
    !Array.isArray(value.days) ||
    value.days.length > 42 ||
    typeof value.version !== "string" ||
    !/^[a-f0-9]{32}$/.test(value.version)
  )
    throw new Error("Calendar page is unavailable.");
  const items = value.items.map(parseItem);
  if (
    new Set(items.map(calendarItemKey)).size !== items.length ||
    items.length > value.total
  )
    throw new Error("Calendar page is inconsistent.");
  const days = value.days.map((d) => {
    if (
      !record(d) ||
      typeof d.date !== "string" ||
      !isAvailabilityDate(d.date) ||
      d.date < query.from ||
      d.date > query.through ||
      !count(d.total) ||
      !Array.isArray(d.previews) ||
      d.previews.length > 3 ||
      d.previews.length > d.total
    )
      throw new Error("Calendar summaries are unavailable.");
    return {
      date: d.date,
      total: d.total,
      previews: d.previews.map(parseItem),
    };
  });
  if (
    new Set(days.map((d) => d.date)).size !== days.length ||
    !parseCalendarQuery({ ...query, after: value.nextCursor })
  )
    throw new Error("Calendar cursor is unavailable.");
  for (const item of [...items, ...days.flatMap((d) => d.previews)]) {
    if (
      calendarDate(item.startsAt) > query.through ||
      calendarDate(new Date(Date.parse(item.endsAt) - 1)) < query.from ||
      (query.type !== "all" &&
        (query.type === "group") !== (item.source === "group")) ||
      (query.venueId && item.locationId !== query.venueId) ||
      (!query.history && ["cancelled", "withdrawn"].includes(item.status))
    )
      throw new Error("Calendar filters are inconsistent.");
  }
  return {
    items,
    nextCursor: value.nextCursor as CalendarCursor | null,
    total: value.total,
    days,
    now: value.now,
    version: value.version,
  };
}
