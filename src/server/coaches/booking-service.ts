import "server-only";

import { withAuthorizedActor } from "@/server/authorization/service";
import {
  bookDirectPrivateSessionRecord,
  cancelDirectPrivateBookingRecord,
  CoachBookingConflictError,
  completeDirectPrivateBookingRecord,
  currentClientPrivateBookingRecords,
  currentCoachPrivateBookingRecords,
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
    const [bookings, coachBookings] = await Promise.all([
      currentClientPrivateBookingRecords(transaction, actor),
      currentCoachPrivateBookingRecords(transaction, actor),
    ]);
    return Object.freeze({ bookings, coachBookings });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, ...result.value });
}

export function bookDirectPrivateSession(slotId: string) {
  return mutateBooking((transaction) =>
    bookDirectPrivateSessionRecord(transaction, slotId),
  );
}

export function cancelDirectPrivateBooking(bookingId: string) {
  return mutateBooking((transaction) =>
    cancelDirectPrivateBookingRecord(transaction, bookingId),
  );
}

export function completeDirectPrivateBooking(bookingId: string) {
  return mutateBooking((transaction) =>
    completeDirectPrivateBookingRecord(transaction, bookingId),
  );
}
