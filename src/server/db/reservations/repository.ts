import "server-only";

import { sql } from "drizzle-orm";
import {
  isMemberClassBookingStatus,
  type ClassReservationStatus,
  type MemberClassBookingStatus,
} from "@/domain/class-reservations";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

export type MemberClassScheduleRecord = Readonly<{
  classSessionId: string;
  classSessionSlug: string;
  classTitle: string;
  classDescription: string;
  discipline: string;
  timezone: string;
  startsAt: string | Date;
  endsAt: string | Date;
  capacity: number;
  venueId: string;
  venueSlug: string;
  venueName: string;
  trainerName: string;
  trainerTitle: string;
  reservedCount: number;
  remainingCapacity: number;
  bookingStatus: MemberClassBookingStatus;
  reservationId: string | null;
  reservationStatus: ClassReservationStatus | null;
  cancellationReason: "member" | "session" | null;
  serviceDate: string;
  holdsBasicUse: boolean;
}>;

type MemberClassScheduleRow = Readonly<{
  class_session_id: string;
  class_session_slug: string;
  class_title: string;
  class_description: string;
  discipline: string;
  timezone: string;
  starts_at: string | Date;
  ends_at: string | Date;
  capacity: number;
  venue_id: string;
  venue_slug: string;
  venue_name: string;
  trainer_name: string;
  trainer_title: string;
  reserved_count: number;
  remaining_capacity: number;
  booking_status: string;
  reservation_id: string | null;
  reservation_status: string | null;
  cancellation_reason: string | null;
  service_date: string;
  holds_basic_use: boolean;
}>;

export type ReserveClassResult = Readonly<{
  result:
    | "reserved"
    | "existing"
    | "invalid-request"
    | "no-active-membership"
    | "class-unavailable"
    | "daily-conflict"
    | "allowance-exhausted"
    | "full"
    | "state-conflict"
    | "operation-conflict";
  reservationId: string | null;
}>;

export type CancelClassReservationResult =
  | "cancelled"
  | "existing"
  | "invalid-request"
  | "not-found"
  | "state-conflict"
  | "too-late";

export class ClassReservationRecordError extends Error {
  constructor() {
    super("Class reservation persistence returned inconsistent state.");
    this.name = "ClassReservationRecordError";
  }
}

const reservationStatuses = new Set<ClassReservationStatus>([
  "reserved",
  "cancelled",
  "checked_in",
  "no_show",
]);

const reserveResults = new Set<ReserveClassResult["result"]>([
  "reserved",
  "existing",
  "invalid-request",
  "no-active-membership",
  "class-unavailable",
  "daily-conflict",
  "allowance-exhausted",
  "full",
  "state-conflict",
  "operation-conflict",
]);

const cancelResults = new Set<CancelClassReservationResult>([
  "cancelled",
  "existing",
  "invalid-request",
  "not-found",
  "state-conflict",
  "too-late",
]);

function iso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function scheduleRecord(
  row: MemberClassScheduleRow,
): MemberClassScheduleRecord {
  const reservationStatus = row.reservation_status;
  if (
    !isMemberClassBookingStatus(row.booking_status) ||
    (reservationStatus !== null &&
      !reservationStatuses.has(reservationStatus as ClassReservationStatus)) ||
    !(
      row.cancellation_reason === null ||
      row.cancellation_reason === "member" ||
      row.cancellation_reason === "session"
    ) ||
    (row.reservation_id === null) !== (reservationStatus === null) ||
    row.capacity < 1 ||
    row.reserved_count < 0 ||
    row.remaining_capacity < 0 ||
    row.remaining_capacity > row.capacity
  ) {
    throw new ClassReservationRecordError();
  }
  return Object.freeze({
    classSessionId: row.class_session_id,
    classSessionSlug: row.class_session_slug,
    classTitle: row.class_title,
    classDescription: row.class_description,
    discipline: row.discipline,
    timezone: row.timezone,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    capacity: row.capacity,
    venueId: row.venue_id,
    venueSlug: row.venue_slug,
    venueName: row.venue_name,
    trainerName: row.trainer_name,
    trainerTitle: row.trainer_title,
    reservedCount: row.reserved_count,
    remainingCapacity: row.remaining_capacity,
    bookingStatus: row.booking_status,
    reservationId: row.reservation_id,
    reservationStatus: reservationStatus as ClassReservationStatus | null,
    cancellationReason: row.cancellation_reason,
    serviceDate: row.service_date,
    holdsBasicUse: row.holds_basic_use,
  });
}

export async function currentMemberClassScheduleRecords(
  transaction: ActorDatabaseTransaction,
) {
  const rows = await transaction.execute<MemberClassScheduleRow>(sql`
    select * from app.current_member_class_schedule()
  `);
  return Object.freeze(rows.map(scheduleRecord));
}

export async function reserveMemberClassRecord(
  transaction: ActorDatabaseTransaction,
  input: { operationId: string; classSessionId: string },
): Promise<ReserveClassResult> {
  const rows = await transaction.execute<{
    reservation_result: string;
    reservation_id: string | null;
  }>(sql`
    select *
    from app.reserve_member_class(
      ${input.operationId}::uuid,
      ${input.classSessionId}::uuid
    )
  `);
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    !reserveResults.has(
      row.reservation_result as ReserveClassResult["result"],
    ) ||
    ["reserved", "existing"].includes(row.reservation_result) !==
      Boolean(row.reservation_id)
  ) {
    throw new ClassReservationRecordError();
  }
  return Object.freeze({
    result: row.reservation_result as ReserveClassResult["result"],
    reservationId: row.reservation_id,
  });
}

export async function cancelMemberClassReservationRecord(
  transaction: ActorDatabaseTransaction,
  reservationId: string,
) {
  const rows = await transaction.execute<{ result: string }>(sql`
    select app.cancel_member_class_reservation(
      ${reservationId}::uuid
    ) as result
  `);
  const result = rows[0]?.result;
  if (!result || !cancelResults.has(result as CancelClassReservationResult)) {
    throw new ClassReservationRecordError();
  }
  return result as CancelClassReservationResult;
}
