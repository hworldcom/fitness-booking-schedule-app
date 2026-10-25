import { isCanonicalUuid } from "@/domain/coach-bookings";

export const BOOKING_EVENTS = {
  requested: "Booking request submitted",
  confirmed: "Booking confirmed",
  declined: "Booking request declined",
  withdrawn: "Booking request withdrawn",
  expired: "Booking request expired",
  "not-selected": "Booking request not selected",
  unavailable: "Requested time became unavailable",
  cancelled: "Booking cancelled",
  changed: "Booking details changed",
} as const;
export type BookingEvent = keyof typeof BOOKING_EVENTS;
export type BookingNotification = Readonly<{
  kind: "booking";
  event: BookingEvent;
  sourceKind: "request" | "booking";
  sourceId: string;
  slotId: string;
  recipientRole: "coach" | "athlete";
  startsAt: string;
  endsAt: string;
  venueName: string;
}>;
export function parseBookingNotification(value: unknown): BookingNotification {
  if (!value || typeof value !== "object")
    throw Error("Invalid booking notice.");
  const v = value as Record<string, unknown>;
  const timestamp = (s: unknown): s is string =>
    typeof s === "string" &&
    s.length <= 40 &&
    /^\d{4}-\d\d-\d\dT/.test(s) &&
    Number.isFinite(Date.parse(s));
  if (
    v.kind !== "booking" ||
    typeof v.event !== "string" ||
    !Object.hasOwn(BOOKING_EVENTS, v.event) ||
    !["request", "booking"].includes(String(v.sourceKind)) ||
    typeof v.sourceId !== "string" ||
    !isCanonicalUuid(v.sourceId) ||
    typeof v.slotId !== "string" ||
    !isCanonicalUuid(v.slotId) ||
    !["coach", "athlete"].includes(String(v.recipientRole)) ||
    !timestamp(v.startsAt) ||
    !timestamp(v.endsAt) ||
    Date.parse(v.endsAt) <= Date.parse(v.startsAt) ||
    typeof v.venueName !== "string" ||
    !v.venueName.trim() ||
    v.venueName.length > 240 ||
    /[\u0000-\u001f\u007f]/u.test(v.venueName)
  )
    throw Error("Invalid booking notice.");
  const request = [
    "requested",
    "declined",
    "withdrawn",
    "expired",
    "not-selected",
    "unavailable",
  ].includes(v.event);
  if (request !== (v.sourceKind === "request"))
    throw Error("Invalid booking event source.");
  return {
    kind: "booking",
    event: v.event as BookingEvent,
    sourceKind: v.sourceKind as "request" | "booking",
    sourceId: v.sourceId,
    slotId: v.slotId,
    recipientRole: v.recipientRole as "coach" | "athlete",
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    venueName: v.venueName,
  };
}
export function bookingNotificationHref(value: BookingNotification) {
  const v = parseBookingNotification(value);
  if (v.sourceKind === "request")
    return v.recipientRole === "coach"
      ? `/coach?view=bookings&occurrence=${v.slotId}#coach-occurrence-${v.slotId}`
      : "/sessions#booking-requests";
  return `${v.recipientRole === "coach" ? "/coach?view=bookings" : "/sessions"}#${v.recipientRole}-booking-${v.sourceId}`;
}
export function bookingNotificationSummary(v: BookingNotification) {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const minutes = (Date.parse(v.endsAt) - Date.parse(v.startsAt)) / 60000;
  return `${date.format(new Date(v.startsAt))} Berlin · ${minutes} min · ${v.venueName}`;
}
