import {
  addCalendarDays,
  calendarDate,
  calendarDates,
  calendarQueryKey,
  itemOnCalendarDate,
  parseCalendarPage,
  type CalendarItem,
  type CalendarQuery,
} from "@/domain/coach-calendar";
import type { CoachCalendarData } from "@/calendar/contracts";
import { AVAILABILITY_COACH } from "./availability-editor-data";
export const CALENDAR_FIXTURE_NOW = "2026-10-16T08:30:00Z";
export const CALENDAR_FIXTURE_LOCATIONS = [
  ...AVAILABILITY_COACH.locations,
  {
    ...AVAILABILITY_COACH.locations[1],
    id: "60000000-0000-4000-8000-000000000003",
    publicName: "Former neighborhood dojo — archived training venue",
    status: "inactive" as const,
    deactivatedAt: "2026-10-10T10:00:00Z",
  },
];
const uuid = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function item(
  n: number,
  date: string,
  hour: number,
  source: CalendarItem["source"],
  status: CalendarItem["status"],
  venue = 0,
  title = source === "group" ? "Boxing fundamentals" : "Private training",
): CalendarItem {
  return {
    source,
    id: uuid(n),
    startsAt: `${date}T${String(hour).padStart(2, "0")}:00:00Z`,
    endsAt: `${date}T${String(hour + 1).padStart(2, "0")}:00:00Z`,
    status,
    title,
    locationId: CALENDAR_FIXTURE_LOCATIONS[venue].id,
    venueName: CALENDAR_FIXTURE_LOCATIONS[venue].publicName,
    venueLabel: CALENDAR_FIXTURE_LOCATIONS[venue].location.label,
    venueActive: venue !== 2,
    pendingCount:
      source === "availability" && status === "available" ? n % 3 : 0,
  };
}
export const CALENDAR_FIXTURE_ITEMS: readonly CalendarItem[] = [
  ...Array.from({ length: 30 }, (_, d) =>
    [9, 10, 11, 12, 13]
      .filter((h) => d > 0 || h >= 9)
      .map((h, i) =>
        item(
          1 + d * 5 + i,
          addCalendarDays("2026-10-16", d),
          h,
          "availability",
          "available",
          d % 3 === 1 ? 1 : 0,
        ),
      ),
  ).flat(),
  item(201, "2026-10-14", 9, "booking", "confirmed", 2),
  item(202, "2026-10-13", 10, "booking", "completed"),
  item(203, "2026-10-15", 12, "booking", "cancelled", 2),
  item(204, "2026-10-20", 14, "availability", "withdrawn"),
  item(205, "2026-10-16", 16, "group", "open", 1, "Small-group padwork"),
  item(206, "2026-10-17", 16, "group", "confirmed", 1),
  item(
    207,
    "2026-10-13",
    16,
    "group",
    "confirmed",
    2,
    "Historical confirmed group",
  ),
  item(208, "2026-10-14", 17, "group", "not-confirmed"),
  item(209, "2026-12-03", 17, "group", "open", 1, "Winter technical workshop"),
  item(210, "2026-11-01", 16, "group", "cancelled"),
  {
    ...item(
      211,
      "2026-10-17",
      20,
      "group",
      "confirmed",
      1,
      "Evening training camp",
    ),
    endsAt: "2026-10-17T22:30:00Z",
  },
];
function version(items: readonly CalendarItem[], epoch: number) {
  let hash = 2166136261;
  for (const char of JSON.stringify(items))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${(hash >>> 0).toString(16).padStart(8, "0")}${epoch.toString(16).padStart(8, "0")}`.repeat(
    2,
  );
}
export function calendarFixture(
  query: CalendarQuery,
  epoch = 0,
  pausedReason: CoachCalendarData["availabilityPausedReason"] = null,
): CoachCalendarData {
  const items = CALENDAR_FIXTURE_ITEMS.filter(
    (i) =>
      calendarDate(i.startsAt) <= query.through &&
      calendarDate(new Date(Date.parse(i.endsAt) - 1)) >= query.from &&
      (query.type === "all" ||
        (query.type === "group") === (i.source === "group")) &&
      (!query.venueId || i.locationId === query.venueId) &&
      (query.history || !["cancelled", "withdrawn"].includes(i.status)) &&
      (!pausedReason || i.status !== "available"),
  ).sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      a.source.localeCompare(b.source) ||
      a.id.localeCompare(b.id),
  );
  const after = query.after;
  const remaining = items.filter(
    (i) =>
      !after ||
      i.startsAt > after.at ||
      (i.startsAt === after.at &&
        (i.source > after.source ||
          (i.source === after.source && i.id > after.id))),
  );
  const page = remaining.slice(0, 50);
  const last = page.at(-1);
  const days = calendarDates(query.from, query.through)
    .map((date) => {
      const onDate = items.filter((i) => itemOnCalendarDate(i, date));
      return { date, total: onDate.length, previews: onDate.slice(0, 3) };
    })
    .filter((d) => d.total);
  return {
    scope: "fixture-user:fixture-profile:fixture-run:member",
    actorIdentity: "schedule-coach:fixture-run:member",
    locations: CALENDAR_FIXTURE_LOCATIONS,
    mayEditAvailability: !pausedReason,
    availabilityPausedReason: pausedReason,
    query,
    page: parseCalendarPage(
      {
        items: page,
        total: items.length,
        days,
        now: CALENDAR_FIXTURE_NOW,
        version: version(items, epoch),
        nextCursor:
          remaining.length > 50 && last
            ? {
                at: last.startsAt,
                source: last.source,
                id: last.id,
                queryKey: calendarQueryKey(query),
              }
            : null,
      },
      query,
    ),
  };
}
