import type { GroupCursor, GroupSession } from "@/domain/group-sessions";
import { profileInitials } from "@/auth/profile-presentation";
import type {
  EventDirectoryPage,
  EventFilters,
  EventView,
} from "@/events/contracts";
import { eventPageHref } from "@/events/queries";
import { parseEventDirectoryPage } from "@/events/parsers";

export function eventDirectoryHref(
  filters: EventFilters,
  after: GroupCursor | null,
  view?: EventView,
) {
  const href = eventPageHref(filters, after);
  return view ? `${href}${href.includes("?") ? "&" : "?"}view=${view}` : href;
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
