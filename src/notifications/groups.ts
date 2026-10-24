import { isCanonicalUuid } from "@/domain/coach-bookings";

export const GROUP_EVENTS = {
  requested: "Group participation requested",
  approved: "Group participation approved",
  declined: "Group participation declined",
  withdrawn: "Group participation withdrawn",
  confirmed: "Group event confirmed",
  cancelled: "Group event cancelled",
  "not-confirmed": "Group event not confirmed",
  "approval-expired": "Group approval deadline passed",
} as const;
const participationStates = [
  "pending",
  "active",
  "withdrawn",
  "declined",
  "approval-expired",
  "session-cancelled",
  "session-not-confirmed",
] as const;
export type GroupNotification = Readonly<{
  kind: "group";
  event: keyof typeof GROUP_EVENTS;
  sessionId: string;
  recipientRole: "coach" | "athlete";
  title: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  eventStatus: "open" | "confirmed" | "cancelled" | "not-confirmed";
  participationStatus: (typeof participationStates)[number] | null;
  affectedCount: number | null;
}>;
export function parseGroupNotification(value: unknown): GroupNotification {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid group notice.");
  const v = value as Record<string, unknown>;
  const text = (x: unknown, max: number) =>
    typeof x === "string" &&
    x.trim().length > 0 &&
    x.length <= max &&
    !/[\u0000-\u001f\u007f]/u.test(x);
  const stamp = (x: unknown) =>
    typeof x === "string" &&
    x.length <= 40 &&
    /^\d{4}-\d\d-\d\dT/.test(x) &&
    Number.isFinite(Date.parse(x));
  if (
    v.kind !== "group" ||
    typeof v.event !== "string" ||
    !Object.hasOwn(GROUP_EVENTS, v.event) ||
    typeof v.sessionId !== "string" ||
    !isCanonicalUuid(v.sessionId) ||
    !["coach", "athlete"].includes(String(v.recipientRole)) ||
    !text(v.title, 120) ||
    !text(v.venueName, 240) ||
    !stamp(v.startsAt) ||
    !stamp(v.endsAt) ||
    Date.parse(String(v.endsAt)) <= Date.parse(String(v.startsAt)) ||
    !["open", "confirmed", "cancelled", "not-confirmed"].includes(
      String(v.eventStatus),
    )
  )
    throw Error("Invalid group notice.");
  if (
    v.recipientRole === "coach"
      ? v.participationStatus !== null ||
        !Number.isSafeInteger(v.affectedCount) ||
        Number(v.affectedCount) < 0 ||
        Number(v.affectedCount) > 100
      : v.affectedCount !== null ||
        !participationStates.includes(
          v.participationStatus as (typeof participationStates)[number],
        )
  )
    throw Error("Invalid group recipient.");
  const expected: Record<string, string> = {
    confirmed: "confirmed",
    cancelled: "cancelled",
    "not-confirmed": "not-confirmed",
    "approval-expired": "confirmed",
  };
  const participant: Record<string, string> = {
    requested: "pending",
    approved: "active",
    declined: "declined",
    withdrawn: "withdrawn",
    cancelled: "session-cancelled",
    "not-confirmed": "session-not-confirmed",
    "approval-expired": "approval-expired",
  };
  if (
    (expected[v.event] && v.eventStatus !== expected[v.event]) ||
    (v.recipientRole === "athlete" &&
      participant[v.event] &&
      v.participationStatus !== participant[v.event]) ||
    (v.event === "confirmed" &&
      v.recipientRole === "athlete" &&
      !["pending", "active"].includes(String(v.participationStatus)))
  )
    throw Error("Invalid group event state.");
  return {
    kind: "group",
    event: v.event as GroupNotification["event"],
    sessionId: v.sessionId,
    recipientRole: v.recipientRole as GroupNotification["recipientRole"],
    title: v.title as string,
    startsAt: v.startsAt as string,
    endsAt: v.endsAt as string,
    venueName: v.venueName as string,
    eventStatus: v.eventStatus as GroupNotification["eventStatus"],
    participationStatus:
      v.participationStatus as GroupNotification["participationStatus"],
    affectedCount: v.affectedCount as number | null,
  };
}
export function groupNotificationHref(value: GroupNotification) {
  const v = parseGroupNotification(value);
  return v.recipientRole === "coach"
    ? `/coach/events/${v.sessionId}`
    : `/events/group-${v.sessionId.replaceAll("-", "")}`;
}
export function groupNotificationSummary(v: GroupNotification) {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${v.title} · ${date.format(new Date(v.startsAt))} Berlin · ${v.venueName}`;
}
export function groupNotificationExplanation(v: GroupNotification) {
  const participation =
    v.recipientRole === "coach"
      ? `${v.affectedCount} athlete${v.affectedCount === 1 ? "" : "s"} affected. Open the private event roster for details.`
      : v.participationStatus === "pending"
        ? "At the time of this update, your participation was still awaiting coach approval. A reserved seat was not participation approval."
        : v.participationStatus === "active"
          ? "At the time of this update, your participation was approved."
          : "This notice records the outcome of your participation.";
  const event =
    v.eventStatus === "open"
      ? "The event itself had not yet been confirmed."
      : "Participation approval and event confirmation are separate decisions.";
  return `${participation} ${event} This notice records a past event. Open the event for the current status.`;
}
