import "server-only";

import type {
  VerifiedBookingCreditOperation,
  VerifiedCoachCreditProjection,
} from "@/domain/coach-bookings";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  CoachBookingConflictError,
  currentClientPrivateBookingRecords,
  currentCoachClientCardRecords,
  decideOwnedLateBookingCancellationRecord,
  finalizeVerifiedBookingCreditOperationRecord,
  markBookingCreditOperationSubmittedRecord,
  prepareCreditBackedPrivateBookingRecord,
  prepareOwnedPrivateBookingConsumptionRecord,
  recordVerifiedCoachCreditProjectionRecord,
  releaseOwnedPrivateBookingHoldRecord,
  requestOwnedPrivateBookingCancellationRecord,
  updateOwnedCoachCancellationPolicyRecord,
} from "@/server/db/coaches/booking-repository";

type BookingMutationResult<T> =
  | Readonly<{ status: "authorized"; outcome: "saved"; value: T }>
  | Readonly<{ status: "authorized"; outcome: "conflict" }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

async function mutateBooking<T>(
  work: Parameters<typeof withAuthorizedActor<T>>[0],
): Promise<BookingMutationResult<T>> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    try {
      return Object.freeze({
        outcome: "saved" as const,
        value: await work(transaction, actor),
      });
    } catch (error) {
      if (error instanceof CoachBookingConflictError) {
        return Object.freeze({ outcome: "conflict" as const });
      }
      throw error;
    }
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

export async function currentPrivateBookingWorkspace() {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    return Object.freeze({
      bookings: await currentClientPrivateBookingRecords(transaction, actor),
      clientCards: owner.coachingActivated
        ? await currentCoachClientCardRecords(transaction, actor)
        : Object.freeze([]),
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

export function updateOwnedCoachCancellationPolicy(minutes: number) {
  return mutateBooking((transaction) =>
    updateOwnedCoachCancellationPolicyRecord(transaction, minutes),
  );
}

export function recordVerifiedCoachCreditProjection(
  evidence: VerifiedCoachCreditProjection,
) {
  return mutateBooking((transaction) =>
    recordVerifiedCoachCreditProjectionRecord(transaction, evidence),
  );
}

export function prepareCreditBackedPrivateBooking(
  input: Readonly<{
    slotId: string;
    creditProjectionId: string;
  }>,
) {
  return mutateBooking((transaction) =>
    prepareCreditBackedPrivateBookingRecord(transaction, input),
  );
}

export function requestOwnedPrivateBookingCancellation(bookingId: string) {
  return mutateBooking((transaction) =>
    requestOwnedPrivateBookingCancellationRecord(transaction, bookingId),
  );
}

export function decideOwnedLateBookingCancellation(
  bookingId: string,
  decision: "approved" | "denied",
) {
  return mutateBooking((transaction) =>
    decideOwnedLateBookingCancellationRecord(transaction, bookingId, decision),
  );
}

export function prepareOwnedPrivateBookingConsumption(bookingId: string) {
  return mutateBooking((transaction) =>
    prepareOwnedPrivateBookingConsumptionRecord(transaction, bookingId),
  );
}

export function markBookingCreditOperationSubmitted(
  operationId: string,
  transactionSignature: string,
) {
  return mutateBooking((transaction) =>
    markBookingCreditOperationSubmittedRecord(
      transaction,
      operationId,
      transactionSignature,
    ),
  );
}

export function releaseOwnedPrivateBookingHold(
  bookingId: string,
  reason: "wallet-rejected" | "simulation-failed" | "reservation-absent",
) {
  return mutateBooking((transaction) =>
    releaseOwnedPrivateBookingHoldRecord(transaction, bookingId, reason),
  );
}

export function finalizeVerifiedBookingCreditOperation(
  evidence: VerifiedBookingCreditOperation,
) {
  return mutateBooking((transaction) =>
    finalizeVerifiedBookingCreditOperationRecord(transaction, evidence),
  );
}
