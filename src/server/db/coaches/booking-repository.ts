import "server-only";

import { address } from "@solana/kit";
import { sql } from "drizzle-orm";
import {
  isCanonicalUuid,
  isSolanaSignature,
  validateEarlyCancellationMinutes,
  validateVerifiedBookingCreditOperation,
  validateVerifiedCoachCreditProjection,
  type BookingCreditOperationKind,
  type BookingCreditOperationProjection,
  type BookingCreditOperationStatus,
  type CoachBookingStatus,
  type CoachClientCardProjection,
  type PrivateBookingProjection,
  type VerifiedBookingCreditOperation,
  type VerifiedCoachCreditProjection,
} from "@/domain/coach-bookings";
import { deriveCreditReservationAddress } from "@/solana/coach-pass";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

type CreditAddressRow = Readonly<{
  program_address: string;
  coach_client_credits_address: string;
}>;

type BookingRow = Readonly<{
  id: string;
  slot_id: string;
  coach_profile_id: string;
  client_profile_id: string;
  client_wallet_address: string;
  coach_client_credits_address: string;
  credit_reservation_address: string;
  status: string;
  scheduled_start_at: string | Date;
  scheduled_end_at: string | Date;
  early_return_until: string | Date;
  hold_expires_at: string | Date;
  cancellation_requested_at: string | Date | null;
  cancellation_decision: string | null;
  cancellation_decided_at: string | Date | null;
  cancelled_at: string | Date | null;
  completed_at: string | Date | null;
  expired_at: string | Date | null;
}>;

type OperationRow = Readonly<{
  id: string;
  booking_id: string;
  kind: string;
  status: string;
  transaction_signature: string | null;
  failure_code: string | null;
}>;

type ClientCardRow = Readonly<{
  credit_projection_id: string;
  client_profile_id: string;
  client_display_name: string;
  client_wallet_address: string;
  coach_client_credits_address: string;
  available_credits: string | number | bigint;
  reserved_credits: string | number | bigint;
  total_purchased: string | number | bigint;
  observed_slot: string | number | bigint;
}>;

type PreparedBookingRow = Readonly<{
  booking_id: string;
  operation_id: string;
  booking_status: string;
}>;

type CancellationRow = Readonly<{
  outcome: string;
  operation_id: string | null;
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

function isBookingStatus(value: string): value is CoachBookingStatus {
  return (
    value === "pending" ||
    value === "confirmed" ||
    value === "cancellation-requested" ||
    value === "cancelled" ||
    value === "completed" ||
    value === "denied" ||
    value === "expired"
  );
}

function isOperationKind(value: string): value is BookingCreditOperationKind {
  return value === "reserve" || value === "return" || value === "consume";
}

function isOperationStatus(
  value: string,
): value is BookingCreditOperationStatus {
  return (
    value === "prepared" ||
    value === "submitted" ||
    value === "finalized" ||
    value === "failed" ||
    value === "expired"
  );
}

function isoTimestamp(value: string | Date | null) {
  if (value === null) return null;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()))
    throw new CoachBookingConflictError();
  return timestamp.toISOString();
}

function mapOperation(row: OperationRow): BookingCreditOperationProjection {
  if (!isOperationKind(row.kind) || !isOperationStatus(row.status)) {
    throw new CoachBookingConflictError();
  }
  return Object.freeze({
    id: row.id,
    kind: row.kind,
    status: row.status,
    transactionSignature: row.transaction_signature,
    failureCode: row.failure_code,
  });
}

function mapBooking(
  row: BookingRow,
  operations: readonly BookingCreditOperationProjection[],
): PrivateBookingProjection {
  if (
    !isBookingStatus(row.status) ||
    (row.cancellation_decision !== null &&
      row.cancellation_decision !== "approved" &&
      row.cancellation_decision !== "denied")
  ) {
    throw new CoachBookingConflictError();
  }
  const scheduledStartAt = isoTimestamp(row.scheduled_start_at);
  const scheduledEndAt = isoTimestamp(row.scheduled_end_at);
  const earlyReturnUntil = isoTimestamp(row.early_return_until);
  const holdExpiresAt = isoTimestamp(row.hold_expires_at);
  if (
    !scheduledStartAt ||
    !scheduledEndAt ||
    !earlyReturnUntil ||
    !holdExpiresAt
  ) {
    throw new CoachBookingConflictError();
  }
  return Object.freeze({
    id: row.id,
    slotId: row.slot_id,
    coachProfileId: row.coach_profile_id,
    clientProfileId: row.client_profile_id,
    clientWalletAddress: row.client_wallet_address,
    coachClientCreditsAddress: row.coach_client_credits_address,
    creditReservationAddress: row.credit_reservation_address,
    status: row.status,
    scheduledStartAt,
    scheduledEndAt,
    earlyReturnUntil,
    holdExpiresAt,
    cancellationRequestedAt: isoTimestamp(row.cancellation_requested_at),
    cancellationDecision: row.cancellation_decision,
    cancellationDecidedAt: isoTimestamp(row.cancellation_decided_at),
    cancelledAt: isoTimestamp(row.cancelled_at),
    completedAt: isoTimestamp(row.completed_at),
    expiredAt: isoTimestamp(row.expired_at),
    operations: Object.freeze([...operations]),
  });
}

function bookingSelect() {
  return sql.raw(`
    booking.id,
    booking.slot_id,
    booking.coach_profile_id,
    booking.client_profile_id,
    projection.client_wallet_address,
    projection.coach_client_credits_address,
    reserve_operation.credit_reservation_address,
    booking.status,
    booking.scheduled_start_at,
    booking.scheduled_end_at,
    booking.early_return_until,
    booking.hold_expires_at,
    booking.cancellation_requested_at,
    booking.cancellation_decision,
    booking.cancellation_decided_at,
    booking.cancelled_at,
    booking.completed_at,
    booking.expired_at
  `);
}

async function bookingRecords(
  transaction: ActorDatabaseTransaction,
  whereClause: ReturnType<typeof sql>,
) {
  const bookings = await transaction.execute<BookingRow>(sql`
    select ${bookingSelect()}
    from app.coach_private_bookings as booking
    join app.coach_client_credit_projections as projection
      on projection.id = booking.credit_projection_id
      and projection.run_id = booking.run_id
    join app.coach_booking_credit_operations as reserve_operation
      on reserve_operation.booking_id = booking.id
      and reserve_operation.kind = 'reserve'
    where ${whereClause}
    order by booking.scheduled_start_at desc, booking.id
  `);
  if (bookings.length === 0) return Object.freeze([]);

  const bookingIds = sql.join(
    bookings.map((booking) => sql`${booking.id}::uuid`),
    sql`, `,
  );
  const operations = await transaction.execute<OperationRow>(sql`
    select
      operation.id,
      operation.booking_id,
      operation.kind,
      operation.status,
      operation.transaction_signature,
      operation.failure_code
    from app.coach_booking_credit_operations as operation
    where operation.booking_id in (${bookingIds})
    order by operation.created_at, operation.id
  `);
  const byBooking = new Map<string, BookingCreditOperationProjection[]>();
  for (const row of operations) {
    const current = byBooking.get(row.booking_id) ?? [];
    current.push(mapOperation(row));
    byBooking.set(row.booking_id, current);
  }
  return Object.freeze(
    bookings.map((booking) =>
      mapBooking(booking, byBooking.get(booking.id) ?? []),
    ),
  );
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
          current.message.includes("coach booking")))
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

export async function updateOwnedCoachCancellationPolicyRecord(
  transaction: ActorDatabaseTransaction,
  minutes: number,
) {
  if (!validateEarlyCancellationMinutes(minutes)) {
    throw new CoachBookingConflictError();
  }
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ minutes: number }>(sql`
      select app.update_owned_coach_cancellation_policy(
        ${minutes}::integer
      ) as minutes
    `);
    if (rows.length !== 1 || rows[0]?.minutes !== minutes) {
      throw new CoachBookingConflictError();
    }
    return minutes;
  });
}

export async function recordVerifiedCoachCreditProjectionRecord(
  transaction: ActorDatabaseTransaction,
  evidence: VerifiedCoachCreditProjection,
) {
  if (!validateVerifiedCoachCreditProjection(evidence)) {
    throw new CoachBookingConflictError();
  }
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ projection_id: string }>(sql`
      select app.record_verified_coach_credit_projection(
        ${evidence.coachProfileId}::uuid,
        ${evidence.programAddress}::text,
        ${evidence.coachAuthorityAddress}::text,
        ${evidence.clientWalletAddress}::text,
        ${evidence.coachClientCreditsAddress}::text,
        ${evidence.availableCredits}::bigint,
        ${evidence.reservedCredits}::bigint,
        ${evidence.totalPurchased}::bigint,
        ${evidence.purchaseCount}::bigint,
        ${evidence.nextPurchaseNonce}::bigint,
        ${evidence.lastOfferAddress}::text,
        ${evidence.lastPurchaseAt}::timestamptz,
        ${evidence.transactionSignature}::text,
        ${evidence.observedSlot}::bigint
      ) as projection_id
    `);
    const projectionId = rows[0]?.projection_id;
    if (!projectionId || rows.length !== 1)
      throw new CoachBookingConflictError();
    return projectionId;
  });
}

export async function prepareCreditBackedPrivateBookingRecord(
  transaction: ActorDatabaseTransaction,
  input: Readonly<{ slotId: string; creditProjectionId: string }>,
) {
  if (
    !isCanonicalUuid(input.slotId) ||
    !isCanonicalUuid(input.creditProjectionId)
  ) {
    throw new CoachBookingConflictError();
  }
  return bookingMutation(async () => {
    const creditRows = await transaction.execute<CreditAddressRow>(sql`
      select program_address, coach_client_credits_address
      from app.coach_client_credit_projections
      where id = ${input.creditProjectionId}::uuid
    `);
    const credit = creditRows[0];
    if (!credit || creditRows.length !== 1)
      throw new CoachBookingConflictError();
    const bookingId = crypto.randomUUID();
    const [reservationAddress] = await deriveCreditReservationAddress({
      programAddress: address(credit.program_address),
      coachClientCredits: address(credit.coach_client_credits_address),
      bookingId,
    });
    const rows = await transaction.execute<PreparedBookingRow>(sql`
      select *
      from app.prepare_credit_backed_private_booking(
        ${bookingId}::uuid,
        ${input.slotId}::uuid,
        ${input.creditProjectionId}::uuid,
        ${reservationAddress}::text
      )
    `);
    const prepared = rows[0];
    if (
      !prepared ||
      rows.length !== 1 ||
      !isBookingStatus(prepared.booking_status)
    ) {
      throw new CoachBookingConflictError();
    }
    return Object.freeze({
      bookingId: prepared.booking_id,
      operationId: prepared.operation_id,
      status: prepared.booking_status,
    });
  });
}

export async function requestOwnedPrivateBookingCancellationRecord(
  transaction: ActorDatabaseTransaction,
  bookingId: string,
) {
  if (!isCanonicalUuid(bookingId)) throw new CoachBookingConflictError();
  return bookingMutation(async () => {
    const rows = await transaction.execute<CancellationRow>(sql`
      select *
      from app.request_owned_private_booking_cancellation(${bookingId}::uuid)
    `);
    const row = rows[0];
    if (
      !row ||
      rows.length !== 1 ||
      !["cancelled", "coach-decision-required", "return-prepared"].includes(
        row.outcome,
      )
    ) {
      throw new CoachBookingConflictError();
    }
    return Object.freeze({
      outcome: row.outcome,
      operationId: row.operation_id,
    });
  });
}

export async function decideOwnedLateBookingCancellationRecord(
  transaction: ActorDatabaseTransaction,
  bookingId: string,
  decision: "approved" | "denied",
) {
  if (!isCanonicalUuid(bookingId)) throw new CoachBookingConflictError();
  return bookingMutation(async () => {
    const rows = await transaction.execute<CancellationRow>(sql`
      select *
      from app.decide_owned_late_booking_cancellation(
        ${bookingId}::uuid,
        ${decision}::text
      )
    `);
    const row = rows[0];
    if (
      !row ||
      rows.length !== 1 ||
      !["denied", "return-prepared"].includes(row.outcome)
    ) {
      throw new CoachBookingConflictError();
    }
    return Object.freeze({
      outcome: row.outcome,
      operationId: row.operation_id,
    });
  });
}

export async function prepareOwnedPrivateBookingConsumptionRecord(
  transaction: ActorDatabaseTransaction,
  bookingId: string,
) {
  if (!isCanonicalUuid(bookingId)) throw new CoachBookingConflictError();
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select app.prepare_owned_private_booking_consumption(
        ${bookingId}::uuid
      ) as operation_id
    `);
    const operationId = rows[0]?.operation_id;
    if (!operationId || rows.length !== 1)
      throw new CoachBookingConflictError();
    return operationId;
  });
}

export async function markBookingCreditOperationSubmittedRecord(
  transaction: ActorDatabaseTransaction,
  operationId: string,
  transactionSignature: string,
) {
  if (
    !isCanonicalUuid(operationId) ||
    !isSolanaSignature(transactionSignature)
  ) {
    throw new CoachBookingConflictError();
  }
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select app.mark_booking_credit_operation_submitted(
        ${operationId}::uuid,
        ${transactionSignature}::text
      ) as operation_id
    `);
    if (rows.length !== 1 || rows[0]?.operation_id !== operationId) {
      throw new CoachBookingConflictError();
    }
    return operationId;
  });
}

export async function releaseOwnedPrivateBookingHoldRecord(
  transaction: ActorDatabaseTransaction,
  bookingId: string,
  reason: "wallet-rejected" | "simulation-failed" | "reservation-absent",
) {
  if (!isCanonicalUuid(bookingId)) throw new CoachBookingConflictError();
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ booking_id: string }>(sql`
      select app.release_owned_private_booking_hold(
        ${bookingId}::uuid,
        ${reason}::text
      ) as booking_id
    `);
    if (rows.length !== 1 || rows[0]?.booking_id !== bookingId) {
      throw new CoachBookingConflictError();
    }
    return bookingId;
  });
}

export async function finalizeVerifiedBookingCreditOperationRecord(
  transaction: ActorDatabaseTransaction,
  evidence: VerifiedBookingCreditOperation,
) {
  if (!validateVerifiedBookingCreditOperation(evidence)) {
    throw new CoachBookingConflictError();
  }
  return bookingMutation(async () => {
    const rows = await transaction.execute<{ booking_id: string }>(sql`
      select app.finalize_verified_booking_credit_operation(
        ${evidence.operationId}::uuid,
        ${evidence.programAddress}::text,
        ${evidence.coachAuthorityAddress}::text,
        ${evidence.clientWalletAddress}::text,
        ${evidence.coachClientCreditsAddress}::text,
        ${evidence.creditReservationAddress}::text,
        ${evidence.bookingId}::uuid,
        ${evidence.scheduledStartUnixSeconds}::bigint,
        ${evidence.earlyReturnUntilUnixSeconds}::bigint,
        ${evidence.reservationStatus}::text,
        ${evidence.availableCredits}::bigint,
        ${evidence.reservedCredits}::bigint,
        ${evidence.totalPurchased}::bigint,
        ${evidence.transactionSignature}::text,
        ${evidence.observedSlot}::bigint
      ) as booking_id
    `);
    const bookingId = rows[0]?.booking_id;
    if (!bookingId || rows.length !== 1 || bookingId !== evidence.bookingId) {
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

export async function currentCoachClientCardRecords(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
): Promise<readonly CoachClientCardProjection[]> {
  const rows = await transaction.execute<ClientCardRow>(sql`
    select
      projection.id as credit_projection_id,
      projection.client_profile_id,
      client.display_name as client_display_name,
      projection.client_wallet_address,
      projection.coach_client_credits_address,
      projection.available_credits,
      projection.reserved_credits,
      projection.total_purchased,
      projection.observed_slot
    from app.coach_client_credit_projections as projection
    join app.profiles as client
      on client.id = projection.client_profile_id
    where projection.run_id = ${actor.runId}::uuid
      and projection.coach_profile_id = ${actor.profileId}::uuid
    order by client.display_name, projection.client_profile_id
  `);
  const bookings = await bookingRecords(
    transaction,
    sql`booking.run_id = ${actor.runId}::uuid and booking.coach_profile_id = ${actor.profileId}::uuid`,
  );
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        creditProjectionId: row.credit_projection_id,
        clientProfileId: row.client_profile_id,
        clientDisplayName: row.client_display_name,
        clientWalletAddress: row.client_wallet_address,
        coachClientCreditsAddress: row.coach_client_credits_address,
        availableCredits: BigInt(row.available_credits),
        reservedCredits: BigInt(row.reserved_credits),
        totalPurchased: BigInt(row.total_purchased),
        observedSlot: BigInt(row.observed_slot),
        bookings: Object.freeze(
          bookings.filter(
            (booking) => booking.clientProfileId === row.client_profile_id,
          ),
        ),
      }),
    ),
  );
}
