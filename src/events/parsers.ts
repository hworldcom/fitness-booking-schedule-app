import {
  parseGroupSessionCommand,
  parseGroupSessionResult,
  parsePublicGroupQuery,
  type GroupCursor,
  type GroupSession,
} from "@/domain/group-sessions";
import type { EventCardPresentation } from "@/domain/event-banners";
import { isPublicCoachPortraitUrl } from "@/domain/profile-images";
import type {
  EventDirectory,
  EventDirectoryPage,
  EventFilters,
  EventSearch,
} from "./contracts";
import { eventQueryKey, parseEventFilters } from "./queries";

export function eventIdFromSlug(slug: string): string | null {
  if (!parsePublicGroupQuery({ action: "detail", args: { slug } })) return null;
  const hex = slug.slice(6);
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return parseGroupSessionCommand({ action: "detail", args: { id } })
    ? id
    : null;
}

export function parseParticipationForm(form: FormData) {
  const keys = ["intent", "sessionId", "registrationId", "actorScope"] as const;
  if (keys.some((key) => form.getAll(key).length !== 1)) return null;
  const intent = form.get("intent"),
    scope = form.get("actorScope");
  if (
    (intent !== "join" && intent !== "withdraw") ||
    typeof scope !== "string" ||
    scope.length > 160 ||
    !/^[a-f0-9:-]+$/i.test(scope) ||
    scope.length < 100
  )
    return null;
  const command = parseGroupSessionCommand({
    action: intent,
    args: {
      id: form.get("sessionId"),
      registrationId: form.get("registrationId"),
    },
  });
  return command?.action === "join" || command?.action === "withdraw"
    ? { command, scope }
    : null;
}

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
