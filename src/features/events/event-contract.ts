import {
  parseGroupSessionCommand,
  parsePublicGroupQuery,
  type GroupCursor,
  type GroupRegistration,
  type GroupSession,
  type PublicGroupQuery,
} from "@/domain/group-sessions";
import type { CoachDiscipline } from "@/domain/coaches";

export type EventSearch = Record<string, string | string[] | undefined>;
export type EventFilters = Readonly<{
  discipline: CoachDiscipline | null;
  sessionTypeId?: string | null;
  location: string;
  after: GroupCursor | null;
}>;
export function parseEventFilters(search: EventSearch): EventFilters | null {
  if (
    Object.keys(search).some(
      (key) =>
        ![
          "discipline",
          "location",
          "afterAt",
          "afterId",
          "sessionType",
        ].includes(key),
    ) ||
    Object.values(search).some((value) => Array.isArray(value))
  )
    return null;
  const hasCursor =
    search.afterAt !== undefined || search.afterId !== undefined;
  const query = parsePublicGroupQuery({
    action: "list",
    args: {
      ...(search.sessionType ? { sessionTypeId: search.sessionType } : {}),
      discipline: search.discipline || null,
      location: search.location ?? "",
      after: hasCursor ? { at: search.afterAt, id: search.afterId } : null,
    },
  });
  return query?.action === "list"
    ? {
        ...(query.args.sessionTypeId
          ? { sessionTypeId: query.args.sessionTypeId }
          : {}),
        discipline: query.args.discipline ?? null,
        location: query.args.location ?? "",
        after: query.args.after ?? null,
      }
    : null;
}
export function eventListQuery(filters: EventFilters): PublicGroupQuery {
  return { action: "list", args: filters };
}
export function eventPageHref(
  filters: EventFilters,
  after: GroupCursor | null,
) {
  const params = new URLSearchParams();
  if (filters.sessionTypeId) params.set("sessionType", filters.sessionTypeId);
  if (filters.discipline) params.set("discipline", filters.discipline);
  if (filters.location) params.set("location", filters.location);
  if (after) {
    params.set("afterAt", after.at);
    params.set("afterId", after.id);
  }
  return `/events${params.size ? `?${params}` : ""}`;
}
export function groupHistoryCursor(
  search: EventSearch,
): GroupCursor | null | false {
  if (
    Object.keys(search).some((key) => !["afterAt", "afterId"].includes(key)) ||
    Object.values(search).some(Array.isArray)
  )
    return false;
  if (search.afterAt === undefined && search.afterId === undefined) return null;
  const parsed = parseGroupSessionCommand({
    action: "registrations",
    args: { after: { at: search.afterAt, id: search.afterId } },
  });
  return parsed?.action === "registrations"
    ? (parsed.args.after ?? null)
    : false;
}
export function groupHistoryHref(cursor: GroupCursor) {
  return `/sessions/groups?${new URLSearchParams({ afterAt: cursor.at, afterId: cursor.id })}`;
}
export function eventIdFromSlug(slug: string): string | null {
  if (!parsePublicGroupQuery({ action: "detail", args: { slug } })) return null;
  const hex = slug.slice(6);
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return parseGroupSessionCommand({ action: "detail", args: { id } })
    ? id
    : null;
}
export function eventHref(session: Pick<GroupSession, "slug">) {
  return `/events/${session.slug}`;
}
export function eventPrice(priceCents: number) {
  return priceCents === 0
    ? "Free"
    : `${new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(priceCents / 100)} per person`;
}
export function eventDate(at: string, includeTime = true) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(at));
}
export function eventTime(at: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));
}
export function eventStatus(session: Pick<GroupSession, "displayStatus">) {
  switch (session.displayStatus) {
    case "open":
      return "Waiting for coach confirmation";
    case "confirmed":
      return "Confirmed by coach";
    case "cancelled":
      return "Cancelled";
    case "not-confirmed":
      return "Not confirmed";
    case "ended":
      return "Ended";
    case "draft":
      return "Draft";
  }
}
export function registrationStatus(registration: GroupRegistration) {
  switch (registration.status) {
    case "active":
      return "Seat reserved";
    case "withdrawn":
      return "You withdrew";
    case "session-cancelled":
      return "Session cancelled";
    case "session-not-confirmed":
      return "Session not confirmed";
  }
}
export function unavailableJoinReason(session: GroupSession) {
  if (["cancelled", "not-confirmed", "ended"].includes(session.displayStatus))
    return "This session is closed. Your retained registration history stays available.";
  if (session.participantCount >= session.maximumParticipants)
    return "This session is full. There is no waitlist.";
  return "Joining is closed or this account is not eligible. Check the current session details before trying again.";
}
export function eventIssueMessage(issue: unknown): string | null {
  switch (issue) {
    case "actor-changed":
      return "The signed-in account changed. That submission changed no registration. Review the current account and session before continuing.";
    case "conflict":
      return "The session or registration changed, or joining is unavailable. Review the current status before trying again.";
    case "unavailable":
      return "MovX could not verify the outcome. Review the current registration before assuming a seat is reserved or released.";
    case "forbidden":
      return "This account cannot change that registration. Review your current session permissions.";
    case "invalid":
      return "That registration action was invalid. Review the current session before retrying.";
    default:
      return null;
  }
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
