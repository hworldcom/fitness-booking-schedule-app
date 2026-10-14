import type {
  ConnectionHistoryReference,
  ConnectionPage,
  ConnectionProjection,
  ConnectionSection,
} from "@/domain/coach-athlete-connections";
import { coachBookingRequestStatusLabel } from "./coach-booking-request-queue-model";

export const COACH_CONNECTION_SECTIONS = [
  "accepted",
  "incoming",
  "outgoing",
  "history",
] as const;
export type CoachConnectionPages = Readonly<
  Record<ConnectionSection, ConnectionPage<ConnectionProjection> | null>
>;
export const UNAVAILABLE_CONNECTION_PAGES: CoachConnectionPages = Object.freeze(
  {
    accepted: null,
    incoming: null,
    outgoing: null,
    history: null,
  },
);

// Keep the server's ordering and full-precision cursor. An overlapping read
// replaces the same record in place rather than duplicating an older thread.
export function mergeConnectionRows<T extends { id: string }>(
  current: readonly T[],
  next: readonly T[],
): readonly T[] {
  const rows = new Map(current.map((item) => [item.id, item]));
  for (const item of next) rows.set(item.id, item);
  return Object.freeze([...rows.values()]);
}

export function coachConnectionSection(
  row: ConnectionProjection,
): ConnectionSection {
  if (row.status === "accepted") return "accepted";
  if (row.status !== "pending") return "history";
  return row.recipientProfileId === row.coachProfileId
    ? "incoming"
    : "outgoing";
}

export function applyConnectionResult(
  pages: CoachConnectionPages,
  row: ConnectionProjection,
): CoachConnectionPages {
  const target = coachConnectionSection(row);
  return Object.freeze(
    Object.fromEntries(
      COACH_CONNECTION_SECTIONS.map((section) => {
        const page = pages[section];
        if (!page) return [section, null];
        const remaining = page.items.filter(
          (item) =>
            item.id !== row.id &&
            !(
              section !== "history" &&
              item.pairId === row.pairId &&
              item.attemptNumber <= row.attemptNumber
            ),
        );
        return [
          section,
          Object.freeze({
            ...page,
            items: Object.freeze(
              section === target ? [row, ...remaining] : remaining,
            ),
          }),
        ];
      }),
    ) as Record<ConnectionSection, ConnectionPage<ConnectionProjection> | null>,
  );
}

export function connectionStatusLabel(status: ConnectionProjection["status"]) {
  return {
    pending: "Awaiting acceptance",
    accepted: "Connected",
    declined: "Declined",
    withdrawn: "Withdrawn",
    removed: "Disconnected",
  }[status];
}

export function connectionHistoryStatus(row: ConnectionHistoryReference) {
  const request = row.requestStatus
    ? row.requestStatus === "withdrawn"
      ? "Request withdrawn by athlete"
      : row.requestStatus === "not-selected"
        ? "Request not selected"
        : row.requestStatus === "occurrence-closed"
          ? "Request closed with occurrence"
          : row.requestStatus === "pending"
            ? "Request awaiting coach confirmation"
            : `${coachBookingRequestStatusLabel(row.requestStatus)} request`
    : null;
  const booking = row.bookingStatus
    ? `${row.bookingStatus[0].toUpperCase()}${row.bookingStatus.slice(1)} session`
    : null;
  return [request, booking].filter(Boolean).join(" · ");
}

export function connectionHistoryTime(row: ConnectionHistoryReference) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: row.coachTimezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(new Date(row.scheduledStartAt));
}

export function connectionReadMessage(status: string) {
  if (status === "signed-out") return "Sign in again to view your connections.";
  if (status === "conflict" || status === "forbidden")
    return "This connection changed or is no longer available. Refresh its current status.";
  return "Your connections could not be verified right now. Try again.";
}
