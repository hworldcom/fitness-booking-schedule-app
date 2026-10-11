import type {
  ClientCoachBookingRequestProjection,
  CoachBookingRequestStatus,
} from "@/domain/coach-booking-requests";

function descendingTimestamp(left: string, right: string) {
  return new Date(right).getTime() - new Date(left).getTime();
}

function compareRequests(
  left: ClientCoachBookingRequestProjection,
  right: ClientCoachBookingRequestProjection,
) {
  const pendingDifference =
    Number(right.status === "pending") - Number(left.status === "pending");
  if (pendingDifference !== 0) return pendingDifference;
  const updatedDifference = descendingTimestamp(
    left.updatedAt,
    right.updatedAt,
  );
  return updatedDifference !== 0
    ? updatedDifference
    : right.id.localeCompare(left.id);
}

export function mergeClientBookingRequestPages(
  current: readonly ClientCoachBookingRequestProjection[],
  next: readonly ClientCoachBookingRequestProjection[],
) {
  const requests = new Map(current.map((request) => [request.id, request]));
  for (const request of next) requests.set(request.id, request);
  return Object.freeze([...requests.values()].sort(compareRequests));
}

export function clientBookingRequestGroups(
  requests: readonly ClientCoachBookingRequestProjection[],
) {
  const sorted = [...requests].sort(compareRequests);
  return Object.freeze({
    pending: Object.freeze(
      sorted.filter((request) => request.status === "pending"),
    ),
    history: Object.freeze(
      sorted.filter((request) => request.status !== "pending"),
    ),
  });
}

export function clientBookingRequestStatusLabel(
  status: CoachBookingRequestStatus,
) {
  switch (status) {
    case "pending":
      return "Awaiting coach confirmation";
    case "accepted":
      return "Confirmed";
    case "declined":
    case "not-selected":
      return "Not confirmed";
    case "withdrawn":
      return "Withdrawn";
    case "expired":
      return "Expired";
    case "occurrence-closed":
      return "Request closed";
  }
}

export function clientBookingRequestStatusDescription(
  status: CoachBookingRequestStatus,
) {
  switch (status) {
    case "pending":
      return "This session is not confirmed yet.";
    case "accepted":
      return "The coach confirmed this session. It also appears in Upcoming.";
    case "declined":
    case "not-selected":
      return "This request did not become a confirmed session.";
    case "withdrawn":
      return "You withdrew this request.";
    case "expired":
      return "The request deadline passed without confirmation.";
    case "occurrence-closed":
      return "This training time is no longer available.";
  }
}
