import {
  parseGroupSessionResult,
  type GroupCursor,
  type GroupPage,
  type GroupSession,
} from "@/domain/group-sessions";
import type { EventCardPresentation } from "@/domain/event-banners";
import { isPublicCoachPortraitUrl } from "@/domain/profile-images";
import { profileInitials } from "@/auth/profile-presentation";
import {
  eventPageHref,
  parseEventFilters,
  type EventFilters,
  type EventSearch,
} from "./event-contract";

export type EventView = "list" | "map";
export type EventDirectory = Readonly<{
  filters: EventFilters;
  view: EventView;
  explicitView: boolean;
}>;
export type EventDirectoryPage = Readonly<{
  status: "ready";
  queryKey: string;
  page: GroupPage<GroupSession>;
  presentations: Readonly<Record<string, EventCardPresentation>>;
}>;
export function parseEventDirectory(
  search: EventSearch,
): EventDirectory | null {
  const { view, ...core } = search;
  if (view !== undefined && view !== "list" && view !== "map") return null;
  const filters = parseEventFilters(core);
  return filters
    ? { filters, view: view ?? "list", explicitView: view !== undefined }
    : null;
}
export function eventDirectoryHref(
  filters: EventFilters,
  after: GroupCursor | null,
  view?: EventView,
) {
  const href = eventPageHref(filters, after);
  return view ? `${href}${href.includes("?") ? "&" : "?"}view=${view}` : href;
}
export const eventQueryKey = (filters: EventFilters) =>
  eventPageHref(filters, null);
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function presentation(
  value: unknown,
  session: GroupSession,
): value is EventCardPresentation {
  if (
    !record(value) ||
    Object.keys(value).sort().join() !==
      "coachBanner,coachHref,eventBanner,portraitUrl"
  )
    return false;
  const coachPath = `/coaches/${session.coach.slug}`;
  if (
    value.coachHref !== coachPath &&
    !(
      typeof value.coachHref === "string" &&
      /^\/@[a-z][a-z0-9_]{2,29}$/.test(value.coachHref)
    )
  )
    return false;
  if (
    value.portraitUrl !== null &&
    !isPublicCoachPortraitUrl(value.portraitUrl)
  )
    return false;
  return (["eventBanner", "coachBanner"] as const).every((key) => {
    const image = value[key];
    if (image === null) return true;
    if (
      !record(image) ||
      Object.keys(image).sort().join() !== "height,url,width" ||
      image.width !== 800 ||
      image.height !== 300 ||
      typeof image.url !== "string"
    )
      return false;
    const prefix =
      key === "eventBanner"
        ? `/api/events/${session.slug}/banner/card?v=`
        : `/api/coaches/${session.coach.slug}/website/banner/card?v=`;
    return (
      image.url.startsWith(prefix) &&
      /^(0|[1-9]\d{0,9})$/.test(image.url.slice(prefix.length)) &&
      Number(image.url.slice(prefix.length)) <= 2147483647
    );
  });
}
// Keep database microseconds when comparing cursor positions, including offsets.
function instantMicros(at: string) {
  const fraction = at.match(/\.(\d{1,6})/)?.[1] ?? "";
  return (
    BigInt(Date.parse(at)) * BigInt(1000) +
    BigInt(fraction.padEnd(6, "0").slice(3))
  );
}
export function compareEventCursors(a: GroupCursor, b: GroupCursor) {
  const timeA = instantMicros(a.at),
    timeB = instantMicros(b.at);
  return timeA < timeB ? -1 : timeA > timeB ? 1 : a.id.localeCompare(b.id);
}
export function parseEventDirectoryPage(
  value: unknown,
  filters: EventFilters,
  after: GroupCursor | null,
): EventDirectoryPage | null {
  try {
    if (
      !record(value) ||
      Object.keys(value).sort().join() !==
        "page,presentations,queryKey,status" ||
      value.status !== "ready" ||
      value.queryKey !== eventQueryKey(filters) ||
      !record(value.presentations)
    )
      return null;
    const page = parseGroupSessionResult("public-list", value.page);
    const ids = new Set<string>();
    // GroupSession's established display projection rounds times to milliseconds;
    // the separate authoritative cursor retains all six database fractional digits.
    // Do not invent an ID order within a rounded millisecond.
    let previousAt = after ? Date.parse(after.at) : -Infinity;
    for (const session of page.items) {
      if (
        ids.has(session.id) ||
        Date.parse(session.startsAt) < previousAt ||
        !presentation(value.presentations[session.id], session)
      )
        return null;
      if (session.status !== "open" && session.status !== "confirmed")
        return null;
      ids.add(session.id);
      previousAt = Date.parse(session.startsAt);
    }
    if (Object.keys(value.presentations).some((id) => !ids.has(id)))
      return null;
    if (
      page.nextCursor &&
      (!page.items.length ||
        page.nextCursor.id !== page.items.at(-1)!.id ||
        Date.parse(page.nextCursor.at) !== previousAt ||
        (after && compareEventCursors(page.nextCursor, after) <= 0))
    )
      return null;
    return {
      status: "ready",
      queryKey: value.queryKey,
      page,
      presentations: value.presentations as Record<
        string,
        EventCardPresentation
      >,
    };
  } catch {
    return null;
  }
}
export function appendEventPage(
  current: EventDirectoryPage,
  next: EventDirectoryPage,
): EventDirectoryPage {
  if (current.queryKey !== next.queryKey)
    throw new Error("Different event filters.");
  const items = new Map(
    current.page.items.map((session) => [session.id, session]),
  );
  for (const session of next.page.items) items.set(session.id, session);
  return {
    ...next,
    page: { items: [...items.values()], nextCursor: next.page.nextCursor },
    presentations: { ...current.presentations, ...next.presentations },
  };
}
export function eventMapPoints(
  items: readonly GroupSession[],
  presentations: EventDirectoryPage["presentations"],
) {
  return items.map((session) => ({
    id: session.id,
    name: session.title,
    label: session.venue.label,
    ariaLabel: `${session.title} with ${session.coach.name} at ${session.venue.name}, ${session.venue.label}`,
    latitude: session.venue.latitude,
    longitude: session.venue.longitude,
    initials: profileInitials(session.coach.name),
    imageUrl: presentations[session.id]?.portraitUrl ?? null,
  }));
}
export async function fetchEventPage(
  filters: EventFilters,
  after: GroupCursor,
  fetcher: typeof fetch = fetch,
): Promise<EventDirectoryPage | null> {
  try {
    const response = await fetcher(`/api${eventPageHref(filters, after)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    return response.ok
      ? parseEventDirectoryPage(await response.json(), filters, after)
      : null;
  } catch {
    return null;
  }
}
