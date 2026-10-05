import "server-only";

import { sql } from "drizzle-orm";
import type {
  BookingCreditOperationKind,
  BookingCreditOperationStatus,
  VerifiedBookingCreditOperation,
  VerifiedCoachCreditProjection,
} from "@/domain/coach-bookings";
import {
  isPreparedCoachPassTransaction,
  type CoachPassPersistedOperationKind,
  type CoachPassSimulationSummary,
} from "@/solana/coach-pass-operation";
import type { PreparedCoachPassTransaction } from "@/solana/coach-pass-transaction";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import {
  finalizeVerifiedBookingCreditOperationRecord,
  recordVerifiedCoachCreditProjectionRecord,
} from "@/server/db/coaches/booking-repository";
import { currentPersonalWalletBinding } from "@/server/db/wallet/repository";

type Numeric = string | number | bigint;

type CommonOperationRow = Readonly<{
  id: string;
  status: string;
  operation_kind: string;
  program_address: string;
  authority_address: string | null;
  coach_authority_address: string;
  client_wallet_address: string;
  coach_client_credits_address: string;
  prepared_summary: unknown;
  prepared_transaction_base64: string | null;
  prepared_message_base64: string | null;
  recent_blockhash: string | null;
  last_valid_block_height: Numeric | null;
  simulation_slot: Numeric | null;
  simulation_units_consumed: Numeric | null;
  transaction_signature: string | null;
  failure_code: string | null;
  observed_slot: Numeric | null;
}>;

type PurchaseOperationRow = CommonOperationRow &
  Readonly<{
    record_type: "purchase";
    client_profile_id: string;
    coach_profile_id: string;
    offer_address: string;
    price_eurc_base_units: Numeric;
    credits_purchased: number;
    expected_purchase_nonce: Numeric;
    baseline_ledger_exists: boolean;
    baseline_available_credits: Numeric;
    baseline_reserved_credits: Numeric;
    baseline_total_purchased: Numeric;
    baseline_purchase_count: Numeric;
    booking_id: null;
    credit_reservation_address: null;
    scheduled_start_at: null;
    early_return_until: null;
  }>;

type BookingOperationRow = CommonOperationRow &
  Readonly<{
    record_type: "booking";
    client_profile_id: string;
    coach_profile_id: string;
    offer_address: null;
    price_eurc_base_units: null;
    credits_purchased: null;
    expected_purchase_nonce: null;
    baseline_ledger_exists: null;
    baseline_available_credits: null;
    baseline_reserved_credits: null;
    baseline_total_purchased: null;
    baseline_purchase_count: null;
    booking_id: string;
    credit_reservation_address: string;
    scheduled_start_at: string | Date;
    early_return_until: string | Date;
  }>;

export type CoachPassOperationRecord = Readonly<{
  recordType: "purchase" | "booking";
  operationId: string;
  status: BookingCreditOperationStatus;
  operation: CoachPassPersistedOperationKind;
  clientProfileId: string;
  coachProfileId: string;
  programAddress: string;
  authorityAddress: string | null;
  coachAuthorityAddress: string;
  clientWalletAddress: string;
  coachClientCreditsAddress: string;
  prepared: PreparedCoachPassTransaction | null;
  simulation: CoachPassSimulationSummary | null;
  transactionSignature: string | null;
  failureCode: string | null;
  finalizedSlot: bigint | null;
  purchase: null | Readonly<{
    offerAddress: string;
    priceEurcBaseUnits: bigint;
    creditsPurchased: 1 | 10;
    expectedPurchaseNonce: bigint;
    baselineLedgerExists: boolean;
    baselineAvailableCredits: bigint;
    baselineReservedCredits: bigint;
    baselineTotalPurchased: bigint;
    baselinePurchaseCount: bigint;
  }>;
  booking: null | Readonly<{
    bookingId: string;
    kind: BookingCreditOperationKind;
    creditReservationAddress: string;
    scheduledStartAt: string;
    earlyReturnUntil: string;
  }>;
}>;

export class CoachPassOperationConflictError extends Error {
  constructor(
    message = "The coach-pass operation conflicts with current state.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CoachPassOperationConflictError";
  }
}

function isStatus(value: string): value is BookingCreditOperationStatus {
  return ["prepared", "submitted", "finalized", "failed", "expired"].includes(
    value,
  );
}

function bookingKind(value: string): BookingCreditOperationKind | null {
  return value === "reserve" || value === "return" || value === "consume"
    ? value
    : null;
}

function operationKind(value: string): CoachPassPersistedOperationKind | null {
  if (
    value === "purchase-first-offer" ||
    value === "purchase-offer" ||
    value === "reserve-booking-credit" ||
    value === "return-booking-credit" ||
    value === "consume-booking-credit"
  ) {
    return value;
  }
  const kind = bookingKind(value);
  return kind ? `${kind}-booking-credit` : null;
}

function asBigInt(value: Numeric | null) {
  return value === null ? null : BigInt(value);
}

function isoTimestamp(value: string | Date) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new CoachPassOperationConflictError();
  }
  return timestamp.toISOString();
}

function preparedTransaction(
  row: CommonOperationRow,
): PreparedCoachPassTransaction | null {
  if (
    row.prepared_summary === null ||
    row.prepared_transaction_base64 === null ||
    row.prepared_message_base64 === null ||
    row.recent_blockhash === null ||
    row.last_valid_block_height === null
  ) {
    return null;
  }
  const prepared: unknown = {
    summary: row.prepared_summary,
    transactionBase64: row.prepared_transaction_base64,
    messageBase64: row.prepared_message_base64,
    recentBlockhash: row.recent_blockhash,
    lastValidBlockHeight: String(row.last_valid_block_height),
  };
  if (!isPreparedCoachPassTransaction(prepared)) {
    throw new CoachPassOperationConflictError();
  }
  return prepared;
}

function mapOperation(
  row: PurchaseOperationRow | BookingOperationRow,
): CoachPassOperationRecord {
  const status = isStatus(row.status) ? row.status : null;
  const operation = operationKind(row.operation_kind);
  if (!status || !operation) throw new CoachPassOperationConflictError();
  const prepared = preparedTransaction(row);
  const simulationSlot = asBigInt(row.simulation_slot);
  const simulationUnits = asBigInt(row.simulation_units_consumed);
  const simulation =
    simulationSlot === null
      ? null
      : Object.freeze({
          slot: simulationSlot.toString(),
          unitsConsumed: simulationUnits?.toString() ?? null,
        });

  if (row.record_type === "purchase") {
    if (row.credits_purchased !== 1 && row.credits_purchased !== 10) {
      throw new CoachPassOperationConflictError();
    }
    return Object.freeze({
      recordType: row.record_type,
      operationId: row.id,
      status,
      operation,
      clientProfileId: row.client_profile_id,
      coachProfileId: row.coach_profile_id,
      programAddress: row.program_address,
      authorityAddress: row.authority_address,
      coachAuthorityAddress: row.coach_authority_address,
      clientWalletAddress: row.client_wallet_address,
      coachClientCreditsAddress: row.coach_client_credits_address,
      prepared,
      simulation,
      transactionSignature: row.transaction_signature,
      failureCode: row.failure_code,
      finalizedSlot: asBigInt(row.observed_slot),
      purchase: Object.freeze({
        offerAddress: row.offer_address,
        priceEurcBaseUnits: BigInt(row.price_eurc_base_units),
        creditsPurchased: row.credits_purchased,
        expectedPurchaseNonce: BigInt(row.expected_purchase_nonce),
        baselineLedgerExists: row.baseline_ledger_exists,
        baselineAvailableCredits: BigInt(row.baseline_available_credits),
        baselineReservedCredits: BigInt(row.baseline_reserved_credits),
        baselineTotalPurchased: BigInt(row.baseline_total_purchased),
        baselinePurchaseCount: BigInt(row.baseline_purchase_count),
      }),
      booking: null,
    });
  }

  const kind = bookingKind(row.operation_kind);
  if (!kind) throw new CoachPassOperationConflictError();
  return Object.freeze({
    recordType: row.record_type,
    operationId: row.id,
    status,
    operation,
    clientProfileId: row.client_profile_id,
    coachProfileId: row.coach_profile_id,
    programAddress: row.program_address,
    authorityAddress: row.authority_address,
    coachAuthorityAddress: row.coach_authority_address,
    clientWalletAddress: row.client_wallet_address,
    coachClientCreditsAddress: row.coach_client_credits_address,
    prepared,
    simulation,
    transactionSignature: row.transaction_signature,
    failureCode: row.failure_code,
    finalizedSlot: asBigInt(row.observed_slot),
    purchase: null,
    booking: Object.freeze({
      bookingId: row.booking_id,
      kind,
      creditReservationAddress: row.credit_reservation_address,
      scheduledStartAt: isoTimestamp(row.scheduled_start_at),
      earlyReturnUntil: isoTimestamp(row.early_return_until),
    }),
  });
}

function isOperationDatabaseError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      (current.code === "23505" ||
        current.code === "23514" ||
        (current.code === "P0001" &&
          "message" in current &&
          typeof current.message === "string" &&
          (current.message.includes("coach pass") ||
            current.message.includes("coach booking operation"))))
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

async function operationMutation<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CoachPassOperationConflictError) throw error;
    if (isOperationDatabaseError(error)) {
      throw new CoachPassOperationConflictError(undefined, { cause: error });
    }
    throw error;
  }
}

export async function coachPassPurchaseContextRecord(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
  coachProfileId: string,
) {
  const binding = await currentPersonalWalletBinding(transaction);
  const coaches = await transaction.execute<{ profile_id: string }>(sql`
    select coach.profile_id
    from app.coach_profiles as coach
    where coach.run_id = ${actor.runId}::uuid
      and coach.profile_id = ${coachProfileId}::uuid
      and coach.profile_id <> ${actor.profileId}::uuid
      and coach.visibility = 'visible'
  `);
  if (
    !binding ||
    coaches.length !== 1 ||
    coaches[0]?.profile_id !== coachProfileId
  ) {
    throw new CoachPassOperationConflictError();
  }
  return Object.freeze({ walletAddress: binding.address });
}

export async function coachPassOperationRecord(
  transaction: ActorDatabaseTransaction,
  operationId: string,
): Promise<CoachPassOperationRecord> {
  const purchases = await transaction.execute<PurchaseOperationRow>(sql`
    select
      'purchase'::text as record_type,
      operation.id,
      operation.status,
      operation.operation_kind,
      operation.client_profile_id,
      operation.coach_profile_id,
      operation.program_address,
      operation.authority_address,
      operation.coach_authority_address,
      operation.offer_address,
      operation.client_wallet_address,
      operation.coach_client_credits_address,
      operation.price_eurc_base_units,
      operation.credits_purchased,
      operation.expected_purchase_nonce,
      operation.baseline_ledger_exists,
      operation.baseline_available_credits,
      operation.baseline_reserved_credits,
      operation.baseline_total_purchased,
      operation.baseline_purchase_count,
      operation.prepared_summary,
      operation.prepared_transaction_base64,
      operation.prepared_message_base64,
      operation.recent_blockhash,
      operation.last_valid_block_height,
      operation.simulation_slot,
      operation.simulation_units_consumed,
      operation.transaction_signature,
      operation.failure_code,
      operation.observed_slot,
      null::uuid as booking_id,
      null::text as credit_reservation_address,
      null::timestamptz as scheduled_start_at,
      null::timestamptz as early_return_until
    from app.coach_pass_purchase_operations as operation
    where operation.id = ${operationId}::uuid
  `);
  if (purchases.length === 1 && purchases[0]) return mapOperation(purchases[0]);

  const bookings = await transaction.execute<BookingOperationRow>(sql`
    select
      'booking'::text as record_type,
      operation.id,
      operation.status,
      operation.kind as operation_kind,
      booking.client_profile_id,
      booking.coach_profile_id,
      operation.program_address,
      operation.authority_address,
      operation.coach_authority_address,
      null::text as offer_address,
      operation.client_wallet_address,
      operation.coach_client_credits_address,
      null::bigint as price_eurc_base_units,
      null::smallint as credits_purchased,
      null::bigint as expected_purchase_nonce,
      null::boolean as baseline_ledger_exists,
      null::bigint as baseline_available_credits,
      null::bigint as baseline_reserved_credits,
      null::bigint as baseline_total_purchased,
      null::bigint as baseline_purchase_count,
      operation.prepared_summary,
      operation.prepared_transaction_base64,
      operation.prepared_message_base64,
      operation.recent_blockhash,
      operation.last_valid_block_height,
      operation.simulation_slot,
      operation.simulation_units_consumed,
      operation.transaction_signature,
      operation.failure_code,
      operation.observed_slot,
      operation.booking_id,
      operation.credit_reservation_address,
      operation.scheduled_start_at,
      operation.early_return_until
    from app.coach_booking_credit_operations as operation
    join app.coach_private_bookings as booking
      on booking.id = operation.booking_id
      and booking.run_id = operation.run_id
    where operation.id = ${operationId}::uuid
  `);
  if (bookings.length === 1 && bookings[0]) return mapOperation(bookings[0]);
  throw new CoachPassOperationConflictError();
}

export async function coachPassBookingContextRecord(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
  operationId: string,
) {
  const [operation, binding] = await Promise.all([
    coachPassOperationRecord(transaction, operationId),
    currentPersonalWalletBinding(transaction),
  ]);
  if (!binding || operation.recordType !== "booking" || !operation.booking) {
    throw new CoachPassOperationConflictError();
  }
  const isClient = operation.clientProfileId === actor.profileId;
  const isCoach = operation.coachProfileId === actor.profileId;
  if (
    (operation.booking.kind === "reserve" && !isClient) ||
    (operation.booking.kind === "consume" && !isCoach) ||
    (operation.booking.kind === "return" && !isClient && !isCoach)
  ) {
    throw new CoachPassOperationConflictError();
  }
  return Object.freeze({ operation, walletAddress: binding.address });
}

export function saveCoachPassPurchasePreparationRecord(
  transaction: ActorDatabaseTransaction,
  input: Readonly<{
    operationId: string;
    coachProfileId: string;
    prepared: PreparedCoachPassTransaction;
    simulationSlot: bigint;
    simulationUnitsConsumed: bigint | null;
    baselineLedgerExists: boolean;
    baselineAvailableCredits: bigint;
    baselineReservedCredits: bigint;
    baselineTotalPurchased: bigint;
    baselinePurchaseCount: bigint;
  }>,
) {
  const summary = input.prepared.summary;
  if (
    summary.operation !== "purchase-first-offer" &&
    summary.operation !== "purchase-offer"
  ) {
    throw new CoachPassOperationConflictError();
  }
  return operationMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select app.record_coach_pass_purchase_preparation(
        ${input.operationId}::uuid,
        ${input.coachProfileId}::uuid,
        ${summary.operation}::text,
        ${summary.programAddress}::text,
        ${summary.authorityAddress}::text,
        ${summary.coachAuthorityAddress}::text,
        ${summary.offerAddress}::text,
        ${summary.coachClientCreditsAddress}::text,
        ${BigInt(summary.priceEurcBaseUnits)}::bigint,
        ${summary.creditsPurchased}::smallint,
        ${BigInt(summary.expectedPurchaseNonce)}::bigint,
        ${input.baselineLedgerExists}::boolean,
        ${input.baselineAvailableCredits}::bigint,
        ${input.baselineReservedCredits}::bigint,
        ${input.baselineTotalPurchased}::bigint,
        ${input.baselinePurchaseCount}::bigint,
        ${JSON.stringify(summary)}::jsonb,
        ${input.prepared.transactionBase64}::text,
        ${input.prepared.messageBase64}::text,
        ${input.prepared.recentBlockhash}::text,
        ${BigInt(input.prepared.lastValidBlockHeight)}::bigint,
        ${input.simulationSlot}::bigint,
        ${input.simulationUnitsConsumed}::bigint
      ) as operation_id
    `);
    const operationId = rows[0]?.operation_id;
    if (!operationId || rows.length !== 1) {
      throw new CoachPassOperationConflictError();
    }
    return operationId;
  });
}

export function saveCoachPassBookingPreparationRecord(
  transaction: ActorDatabaseTransaction,
  input: Readonly<{
    operationId: string;
    prepared: PreparedCoachPassTransaction;
    simulationSlot: bigint;
    simulationUnitsConsumed: bigint | null;
  }>,
) {
  return operationMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select app.record_booking_credit_operation_preparation(
        ${input.operationId}::uuid,
        ${input.prepared.summary.authorityAddress}::text,
        ${JSON.stringify(input.prepared.summary)}::jsonb,
        ${input.prepared.transactionBase64}::text,
        ${input.prepared.messageBase64}::text,
        ${input.prepared.recentBlockhash}::text,
        ${BigInt(input.prepared.lastValidBlockHeight)}::bigint,
        ${input.simulationSlot}::bigint,
        ${input.simulationUnitsConsumed}::bigint
      ) as operation_id
    `);
    if (rows.length !== 1 || rows[0]?.operation_id !== input.operationId) {
      throw new CoachPassOperationConflictError();
    }
    return input.operationId;
  });
}

export function markCoachPassOperationSubmittedRecord(
  transaction: ActorDatabaseTransaction,
  operation: CoachPassOperationRecord,
  transactionSignature: string,
) {
  const functionName =
    operation.recordType === "purchase"
      ? sql.raw("app.mark_coach_pass_purchase_submitted")
      : sql.raw("app.mark_booking_credit_operation_submitted");
  return operationMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select ${functionName}(
        ${operation.operationId}::uuid,
        ${transactionSignature}::text
      ) as operation_id
    `);
    if (rows.length !== 1 || rows[0]?.operation_id !== operation.operationId) {
      throw new CoachPassOperationConflictError();
    }
    return operation.operationId;
  });
}

export function failCoachPassOperationRecord(
  transaction: ActorDatabaseTransaction,
  operation: CoachPassOperationRecord,
  status: "failed" | "expired",
  reason:
    | "wallet-rejected"
    | "simulation-failed"
    | "blockhash-expired"
    | "transaction-failed"
    | "state-not-observed",
) {
  const functionName =
    operation.recordType === "purchase"
      ? sql.raw("app.fail_coach_pass_purchase_operation")
      : sql.raw("app.fail_booking_credit_operation");
  return operationMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select ${functionName}(
        ${operation.operationId}::uuid,
        ${status}::text,
        ${reason}::text
      ) as operation_id
    `);
    if (rows.length !== 1 || rows[0]?.operation_id !== operation.operationId) {
      throw new CoachPassOperationConflictError();
    }
    return operation.operationId;
  });
}

export async function finalizeCoachPassPurchaseRecord(
  transaction: ActorDatabaseTransaction,
  input: Readonly<{
    operation: CoachPassOperationRecord;
    projection: VerifiedCoachCreditProjection;
  }>,
) {
  await recordVerifiedCoachCreditProjectionRecord(
    transaction,
    input.projection,
  );
  const rows = await transaction.execute<{ operation_id: string }>(sql`
    select app.finalize_coach_pass_purchase_operation(
      ${input.operation.operationId}::uuid,
      ${input.projection.transactionSignature}::text,
      ${input.projection.availableCredits}::bigint,
      ${input.projection.reservedCredits}::bigint,
      ${input.projection.totalPurchased}::bigint,
      ${input.projection.purchaseCount}::bigint,
      ${input.projection.nextPurchaseNonce}::bigint,
      ${input.projection.observedSlot}::bigint
    ) as operation_id
  `);
  if (
    rows.length !== 1 ||
    rows[0]?.operation_id !== input.operation.operationId
  ) {
    throw new CoachPassOperationConflictError();
  }
}

export function finalizeCoachPassBookingRecord(
  transaction: ActorDatabaseTransaction,
  evidence: VerifiedBookingCreditOperation,
) {
  return finalizeVerifiedBookingCreditOperationRecord(transaction, evidence);
}
