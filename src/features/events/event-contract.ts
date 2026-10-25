import {
  parseGroupSessionCommand,
  type GroupCursor,
  type GroupRegistration,
  type GroupSession,
} from "@/domain/group-sessions";
import type { EventSearch } from "@/events/contracts";

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

export function registrationStatus(
  registration: Pick<GroupRegistration, "status"> & Partial<GroupRegistration>,
) {
  switch (registration.status) {
    case "pending":
      return "Pending coach approval · seat reserved";
    case "active":
      return "Participation approved";
    case "declined":
      return "Participation declined";
    case "approval-expired":
      return "Approval deadline passed";
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
