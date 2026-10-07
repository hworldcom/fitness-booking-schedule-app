import "server-only";

import { sql } from "drizzle-orm";
import {
  isCanonicalUuid,
  isCoachBookingStatus,
  type BookingCancellationActor,
  type PrivateBookingProjection,
} from "@/domain/coach-bookings";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

type BookingRow = Readonly<{
  id: string;
  slot_id: string;
  coach_profile_id: string;
  coach_display_name: string;
  coach_slug: string;
  client_profile_id: string;
  client_display_name: string;
  status: string;
  scheduled_start_at: string | Date;
  scheduled_end_at: string | Date;
  coach_timezone: string;
  location_kind: string;
  gym_name: string | null;
  public_location_label: string;
  cancelled_by_profile_id: string | null;
  cancelled_at: string | Date | null;
  completed_at: string | Date | null;
  created_at: string | Date;
}>;

export class CoachBookingConflictError extends Error {
  constructor(
    message = "The private booking conflicts with current state.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CoachBookingConflictError";
  }
}

function isoTimestamp(value: string | Date | null) {
  if (value === null) return null;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new CoachBookingConflictError();
  }
  return timestamp.toISOString();
}

function cancellationActor(row: BookingRow): BookingCancellationActor | null {
  if (row.cancelled_by_profile_id === null) return null;
  if (row.cancelled_by_profile_id === row.client_profile_id) return "client";
  if (row.cancelled_by_profile_id === row.coach_profile_id) return "coach";
  throw new CoachBookingConflictError();
}

function mapBooking(row: BookingRow): PrivateBookingProjection {
  if (
    !isCoachBookingStatus(row.status) ||
    (row.location_kind !== "gym" && row.location_kind !== "independent")
  ) {
    throw new CoachBookingConflictError();
  }
  const scheduledStartAt = isoTimestamp(row.scheduled_start_at);
  const scheduledEndAt = isoTimestamp(row.scheduled_end_at);
  const createdAt = isoTimestamp(row.created_at);
  if (!scheduledStartAt || !scheduledEndAt || !createdAt) {
    throw new CoachBookingConflictError();
  }
  const cancelledBy = cancellationActor(row);
  const cancelledAt = isoTimestamp(row.cancelled_at);
  const completedAt = isoTimestamp(row.completed_at);
  if (
    (row.status === "cancelled") !==
      (cancelledBy !== null && cancelledAt !== null) ||
    (row.status === "completed") !== (completedAt !== null)
  ) {
    throw new CoachBookingConflictError();
  }
  return Object.freeze({
    id: row.id,
    slotId: row.slot_id,
    coachProfileId: row.coach_profile_id,
    coachDisplayName: row.coach_display_name,
    coachSlug: row.coach_slug,
    clientProfileId: row.client_profile_id,
    clientDisplayName: row.client_display_name,
    status: row.status,
    scheduledStartAt,
    scheduledEndAt,
    coachTimezone: row.coach_timezone,
    location: Object.freeze({
      kind: row.location_kind,
      gymName: row.gym_name,
      publicLabel: row.public_location_label,
    }),
    cancelledBy,
    cancelledAt,
    completedAt,
    createdAt,
  });
}

function isPostgresBookingError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      (current.code === "23505" ||
        current.code === "23514" ||
        current.code === "23503" ||
        (current.code === "P0001" &&
          "message" in current &&
          typeof current.message === "string" &&
          current.message.includes("direct coach booking")))
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

async function bookingMutation<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CoachBookingConflictError) throw error;
    if (isPostgresBookingError(error)) {
      throw new CoachBookingConflictError(undefined, { cause: error });
    }
    throw error;
  }
}

async function bookingRecords(
  transaction: ActorDatabaseTransaction,
  whereClause: ReturnType<typeof sql>,
) {
  const rows = await transaction.execute<BookingRow>(sql`
    select
      booking.id,
      booking.slot_id,
      booking.coach_profile_id,
      booking.coach_display_name,
      booking.coach_slug,
      booking.client_profile_id,
      booking.client_display_name,
      booking.status,
      booking.scheduled_start_at,
      booking.scheduled_end_at,
      booking.coach_timezone,
      booking.location_kind,
      booking.gym_name,
      booking.public_location_label,
      booking.cancelled_by_profile_id,
      booking.cancelled_at,
      booking.completed_at,
      booking.created_at
    from app.current_direct_private_bookings() as booking
    where ${whereClause}
    order by booking.scheduled_start_at desc, booking.id
  `);
  return Object.freeze(rows.map(mapBooking));
}

export async function bookDirectPrivateSessionRecord(
  transaction: ActorDatabaseTransaction,
  slotId: string,
) {
  if (!isCanonicalUuid(slotId)) throw new CoachBookingConflictError();
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ booking_id: string }>(sql`
      select app.book_direct_private_session(${slotId}::uuid) as booking_id
    `);
    const bookingId = rows[0]?.booking_id;
    if (rows.length !== 1 || !bookingId || !isCanonicalUuid(bookingId)) {
      throw new CoachBookingConflictError();
    }
    return bookingId;
  });
}

export async function cancelDirectPrivateBookingRecord(
  transaction: ActorDatabaseTransaction,
  bookingId: string,
) {
  if (!isCanonicalUuid(bookingId)) throw new CoachBookingConflictError();
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ booking_id: string }>(sql`
      select app.cancel_direct_private_booking(
        ${bookingId}::uuid
      ) as booking_id
    `);
    if (rows.length !== 1 || rows[0]?.booking_id !== bookingId) {
      throw new CoachBookingConflictError();
    }
    return bookingId;
  });
}

export async function completeDirectPrivateBookingRecord(
  transaction: ActorDatabaseTransaction,
  bookingId: string,
) {
  if (!isCanonicalUuid(bookingId)) throw new CoachBookingConflictError();
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ booking_id: string }>(sql`
      select app.complete_direct_private_booking(
        ${bookingId}::uuid
      ) as booking_id
    `);
    if (rows.length !== 1 || rows[0]?.booking_id !== bookingId) {
      throw new CoachBookingConflictError();
    }
    return bookingId;
  });
}

export function currentClientPrivateBookingRecords(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  return bookingRecords(
    transaction,
    sql`booking.run_id = ${actor.runId}::uuid and booking.client_profile_id = ${actor.profileId}::uuid`,
  );
}

export function currentCoachPrivateBookingRecords(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  return bookingRecords(
    transaction,
    sql`booking.run_id = ${actor.runId}::uuid and booking.coach_profile_id = ${actor.profileId}::uuid`,
  );
}
