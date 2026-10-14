import type { OwnedCoachBookingRequestProjection } from "@/domain/coach-booking-requests";

export type CoachBookingRequestOccurrenceGroup = Readonly<{
  slotId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  coachTimezone: string;
  location: OwnedCoachBookingRequestProjection["location"];
  requests: readonly OwnedCoachBookingRequestProjection[];
  pendingCount: number;
}>;

function descendingTimestamp(left: string, right: string) {
  return new Date(right).getTime() - new Date(left).getTime();
}

function compareRequests(
  left: OwnedCoachBookingRequestProjection,
  right: OwnedCoachBookingRequestProjection,
) {
  const pendingDifference =
    Number(right.status === "pending") - Number(left.status === "pending");
  if (pendingDifference !== 0) return pendingDifference;
  const createdDifference = descendingTimestamp(
    left.createdAt,
    right.createdAt,
  );
  return createdDifference !== 0
    ? createdDifference
    : right.id.localeCompare(left.id);
}

export function mergeCoachBookingRequestPages(
  current: readonly OwnedCoachBookingRequestProjection[],
  next: readonly OwnedCoachBookingRequestProjection[],
) {
  const requests = new Map(current.map((request) => [request.id, request]));
  for (const request of next) requests.set(request.id, request);
  return Object.freeze([...requests.values()].sort(compareRequests));
}

export function groupCoachBookingRequestsByOccurrence(
  requests: readonly OwnedCoachBookingRequestProjection[],
) {
  const grouped = new Map<string, OwnedCoachBookingRequestProjection[]>();
  for (const request of requests) {
    const group = grouped.get(request.slotId) ?? [];
    group.push(request);
    grouped.set(request.slotId, group);
  }

  return Object.freeze(
    [...grouped.entries()]
      .map(([slotId, groupRequests]) => {
        const sortedRequests = Object.freeze(
          groupRequests.sort(compareRequests),
        );
        const first = sortedRequests[0]!;
        return Object.freeze({
          slotId,
          scheduledStartAt: first.scheduledStartAt,
          scheduledEndAt: first.scheduledEndAt,
          coachTimezone: first.coachTimezone,
          location: first.location,
          requests: sortedRequests,
          pendingCount: sortedRequests.filter(
            (request) => request.status === "pending",
          ).length,
        });
      })
      .sort((left, right) => {
        const pendingDifference =
          Number(right.pendingCount > 0) - Number(left.pendingCount > 0);
        if (pendingDifference !== 0) return pendingDifference;
        if (left.pendingCount > 0) {
          return (
            new Date(left.scheduledStartAt).getTime() -
            new Date(right.scheduledStartAt).getTime()
          );
        }
        return descendingTimestamp(
          left.requests[0]!.updatedAt,
          right.requests[0]!.updatedAt,
        );
      }),
  );
}

export function coachBookingRequestStatusLabel(
  status: OwnedCoachBookingRequestProjection["status"],
) {
  switch (status) {
    case "pending":
      return "Awaiting decision";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "withdrawn":
      return "Withdrawn by athlete";
    case "expired":
      return "Expired";
    case "not-selected":
      return "Not selected";
    case "occurrence-closed":
      return "Occurrence closed";
  }
}
