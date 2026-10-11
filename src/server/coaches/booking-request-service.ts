import "server-only";

import type { CoachBookingRequestPageCursor } from "@/domain/coach-booking-requests";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  acceptCoachBookingRequestRecord,
  closeCoachBookingRequestOccurrenceRecord,
  CoachBookingRequestConflictError,
  createCoachBookingRequestRecord,
  currentClientCoachBookingRequestRecords,
  currentOwnedCoachBookingRequestRecords,
  declineCoachBookingRequestRecord,
  withdrawCoachBookingRequestRecord,
} from "@/server/db/coaches/booking-request-repository";

export type BookingRequestMutationResult<T> =
  | Readonly<{ status: "authorized"; outcome: "saved"; value: T }>
  | Readonly<{ status: "authorized"; outcome: "conflict" }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

type RequestPageOptions = Readonly<{
  pageSize?: number;
  cursor?: CoachBookingRequestPageCursor | null;
}>;

async function mutateRequest<T>(
  work: Parameters<typeof withAuthorizedActor<T>>[0],
): Promise<BookingRequestMutationResult<T>> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    try {
      return Object.freeze({
        outcome: "saved" as const,
        value: await work(transaction, actor),
      });
    } catch (error) {
      if (error instanceof CoachBookingRequestConflictError) {
        return Object.freeze({ outcome: "conflict" as const });
      }
      throw error;
    }
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

export async function currentBookingRequestWorkspace(
  options?: RequestPageOptions,
) {
  const result = await withAuthorizedActor(async (transaction) => {
    const clientRequests = await currentClientCoachBookingRequestRecords(
      transaction,
      options,
    );
    const coachRequests = await currentOwnedCoachBookingRequestRecords(
      transaction,
      options,
    );
    return Object.freeze({ clientRequests, coachRequests });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

export async function currentOwnedCoachBookingRequestPage(
  options?: RequestPageOptions,
) {
  const result = await withAuthorizedActor((transaction) =>
    currentOwnedCoachBookingRequestRecords(transaction, options),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({
    status: "authorized" as const,
    page: result.value,
  });
}

export function createCoachBookingRequest(slotId: string) {
  return mutateRequest((transaction) =>
    createCoachBookingRequestRecord(transaction, slotId),
  );
}

export function withdrawCoachBookingRequest(requestId: string) {
  return mutateRequest((transaction) =>
    withdrawCoachBookingRequestRecord(transaction, requestId),
  );
}

export function declineCoachBookingRequest(requestId: string) {
  return mutateRequest((transaction) =>
    declineCoachBookingRequestRecord(transaction, requestId),
  );
}

export function acceptCoachBookingRequest(requestId: string) {
  return mutateRequest((transaction) =>
    acceptCoachBookingRequestRecord(transaction, requestId),
  );
}

export function closeCoachBookingRequestOccurrence(slotId: string) {
  return mutateRequest((transaction) =>
    closeCoachBookingRequestOccurrenceRecord(transaction, slotId),
  );
}
