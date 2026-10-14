import "server-only";

import type { CoachBookingRequestPageCursor } from "@/domain/coach-booking-requests";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  acceptCoachBookingRequestRecord,
  closeCoachBookingRequestOccurrenceRecord,
  CoachBookingRequestConflictError,
  createCoachBookingRequestRecord,
  currentClientCoachBookingRequestRecord,
  currentClientCoachBookingRequestRecords,
  currentClientPendingCoachBookingRequestRecords,
  currentOwnedCoachBookingRequestRecords,
  declineCoachBookingRequestRecord,
  withdrawCoachBookingRequestRecord,
} from "@/server/db/coaches/booking-request-repository";
import { currentClientPrivateBookingRecords } from "@/server/db/coaches/booking-repository";

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

export async function currentClientCoachBookingRequestPage(
  options?: RequestPageOptions,
) {
  const result = await withAuthorizedActor((transaction) =>
    currentClientCoachBookingRequestRecords(transaction, options),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({
    status: "authorized" as const,
    page: result.value,
  });
}

export async function currentClientCoachMarketplaceWorkspace(
  slotIds: readonly string[],
) {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const bookings = await currentClientPrivateBookingRecords(
      transaction,
      actor,
    );
    const pendingRequests =
      slotIds.length === 0
        ? Object.freeze([])
        : await currentClientPendingCoachBookingRequestRecords(
            transaction,
            slotIds,
          );
    return Object.freeze({
      actorProfileId: actor.profileId,
      bookings,
      pendingRequests,
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

export async function currentClientSessionWorkspace(
  options?: RequestPageOptions,
) {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const bookings = await currentClientPrivateBookingRecords(
      transaction,
      actor,
    );
    const requests = await currentClientCoachBookingRequestRecords(
      transaction,
      options,
    );
    return Object.freeze({
      bookings,
      requests,
      actorScope: [
        actor.authUserId,
        actor.profileId,
        actor.runId,
        actor.runRole,
      ].join(":"),
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

export function createCoachBookingRequest(slotId: string) {
  return mutateRequest(async (transaction) => {
    const mutation = await createCoachBookingRequestRecord(transaction, slotId);
    const request = await currentClientCoachBookingRequestRecord(
      transaction,
      mutation.requestId,
    );
    if (!request) throw new CoachBookingRequestConflictError();
    return Object.freeze({ ...mutation, request });
  });
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
