import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { currentPersonalWalletBinding } from "@/server/db/wallet/repository";
import {
  isPreparedGroupEventTransaction,
  type GroupEventPersistedOperationStatus,
  type GroupEventSimulationSummary,
} from "@/solana/group-event-operation";
import type {
  GroupEventOperationKind,
  PreparedGroupEventTransaction,
} from "@/solana/group-event-transaction";

type Numeric = string | number | bigint;

type OperationRow = Readonly<{
  id: string;
  event_id: string;
  actor_profile_id: string;
  operation_kind: string;
  status: string;
  program_address: string;
  authority_address: string;
  coach_authority_address: string;
  event_pool_address: string;
  vault_address: string;
  contribution_address: string | null;
  prepared_summary: unknown;
  prepared_transaction_base64: string;
  prepared_message_base64: string;
  recent_blockhash: string;
  last_valid_block_height: Numeric;
  simulation_slot: Numeric;
  simulation_units_consumed: Numeric | null;
  transaction_signature: string | null;
  failure_code: string | null;
  observed_slot: Numeric | null;
}>;

type ContextRow = Readonly<{
  id: string;
  coach_profile_id: string;
  starts_at: string | Date;
  ends_at: string | Date;
  publication_status: string;
  projection_availability: string;
  program_address: string | null;
  event_pool_address: string | null;
  coach_wallet_address_snapshot: string | null;
  coach_authority_address: string | null;
}>;

export type GroupEventOperationRecord = Readonly<{
  operationId: string;
  eventId: string;
  actorProfileId: string;
  operation: GroupEventOperationKind;
  status: GroupEventPersistedOperationStatus;
  programAddress: string;
  authorityAddress: string;
  coachAuthorityAddress: string;
  eventPoolAddress: string;
  vaultAddress: string;
  contributionAddress: string | null;
  prepared: PreparedGroupEventTransaction;
  simulation: GroupEventSimulationSummary;
  transactionSignature: string | null;
  failureCode: string | null;
  finalizedSlot: bigint | null;
}>;

export type GroupEventOperationContext = Readonly<{
  eventId: string;
  coachProfileId: string;
  startsAt: string;
  endsAt: string;
  publicationStatus: "draft" | "published" | "withdrawn";
  projectionAvailability: "unbound" | "pending" | "current" | "unavailable";
  programAddress: string | null;
  eventPoolAddress: string | null;
  coachWalletAddressSnapshot: string | null;
  coachAuthorityAddress: string | null;
  walletAddress: string;
}>;

export class GroupEventOperationConflictError extends Error {
  constructor(
    message = "The group-event operation conflicts with current state.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GroupEventOperationConflictError";
  }
}

function isStatus(value: string): value is GroupEventPersistedOperationStatus {
  return ["prepared", "submitted", "finalized", "failed", "expired"].includes(
    value,
  );
}

function isOperation(value: string): value is GroupEventOperationKind {
  return [
    "create-event-pool",
    "fund-event-seat",
    "settle-event-pool",
    "claim-event-payout",
    "claim-event-refund",
  ].includes(value);
}

function isPublicationStatus(
  value: string,
): value is GroupEventOperationContext["publicationStatus"] {
  return value === "draft" || value === "published" || value === "withdrawn";
}

function isProjectionAvailability(
  value: string,
): value is GroupEventOperationContext["projectionAvailability"] {
  return (
    value === "unbound" ||
    value === "pending" ||
    value === "current" ||
    value === "unavailable"
  );
}

function isoTimestamp(value: string | Date) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new GroupEventOperationConflictError();
  }
  return timestamp.toISOString();
}

function mapOperation(row: OperationRow): GroupEventOperationRecord {
  if (!isStatus(row.status) || !isOperation(row.operation_kind)) {
    throw new GroupEventOperationConflictError();
  }
  const prepared: unknown = {
    summary: row.prepared_summary,
    transactionBase64: row.prepared_transaction_base64,
    messageBase64: row.prepared_message_base64,
    recentBlockhash: row.recent_blockhash,
    lastValidBlockHeight: String(row.last_valid_block_height),
  };
  if (!isPreparedGroupEventTransaction(prepared)) {
    throw new GroupEventOperationConflictError();
  }
  return Object.freeze({
    operationId: row.id,
    eventId: row.event_id,
    actorProfileId: row.actor_profile_id,
    operation: row.operation_kind,
    status: row.status,
    programAddress: row.program_address,
    authorityAddress: row.authority_address,
    coachAuthorityAddress: row.coach_authority_address,
    eventPoolAddress: row.event_pool_address,
    vaultAddress: row.vault_address,
    contributionAddress: row.contribution_address,
    prepared,
    simulation: Object.freeze({
      slot: String(row.simulation_slot),
      unitsConsumed:
        row.simulation_units_consumed === null
          ? null
          : String(row.simulation_units_consumed),
    }),
    transactionSignature: row.transaction_signature,
    failureCode: row.failure_code,
    finalizedSlot:
      row.observed_slot === null ? null : BigInt(row.observed_slot),
  });
}

function operationSelect() {
  return sql.raw(`
    id,
    event_id,
    actor_profile_id,
    operation_kind,
    status,
    program_address,
    authority_address,
    coach_authority_address,
    event_pool_address,
    vault_address,
    contribution_address,
    prepared_summary,
    prepared_transaction_base64,
    prepared_message_base64,
    recent_blockhash,
    last_valid_block_height,
    simulation_slot,
    simulation_units_consumed,
    transaction_signature,
    failure_code,
    observed_slot
  `);
}

function isPostgresConflict(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      (current.code === "23505" ||
        current.code === "23514" ||
        current.code === "23503" ||
        current.code === "P0001")
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
    if (error instanceof GroupEventOperationConflictError) throw error;
    if (isPostgresConflict(error)) {
      throw new GroupEventOperationConflictError(undefined, { cause: error });
    }
    throw error;
  }
}

export async function groupEventOperationContextRecord(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
  eventId: string,
): Promise<GroupEventOperationContext> {
  const rows = await transaction.execute<ContextRow>(sql`
    select
      event.id,
      event.coach_profile_id,
      event.starts_at,
      event.ends_at,
      event.publication_status,
      event.projection_availability,
      event.program_address,
      event.event_pool_address,
      event.coach_wallet_address_snapshot,
      pool.coach_authority_address
    from app.group_events as event
    left join app.group_event_pool_projections as pool
      on pool.run_id = event.run_id
      and pool.event_id = event.id
    where event.id = ${eventId}::uuid
      and event.run_id = ${actor.runId}::uuid
  `);
  const row = rows[0];
  const wallet = await currentPersonalWalletBinding(transaction);
  if (
    rows.length !== 1 ||
    !row ||
    !wallet ||
    !isPublicationStatus(row.publication_status) ||
    !isProjectionAvailability(row.projection_availability)
  ) {
    throw new GroupEventOperationConflictError();
  }
  return Object.freeze({
    eventId: row.id,
    coachProfileId: row.coach_profile_id,
    startsAt: isoTimestamp(row.starts_at),
    endsAt: isoTimestamp(row.ends_at),
    publicationStatus: row.publication_status,
    projectionAvailability: row.projection_availability,
    programAddress: row.program_address,
    eventPoolAddress: row.event_pool_address,
    coachWalletAddressSnapshot: row.coach_wallet_address_snapshot,
    coachAuthorityAddress: row.coach_authority_address,
    walletAddress: wallet.address,
  });
}

export async function groupEventOperationRecord(
  transaction: ActorDatabaseTransaction,
  operationId: string,
) {
  const rows = await transaction.execute<OperationRow>(sql`
    select ${operationSelect()}
    from app.group_event_chain_operations
    where id = ${operationId}::uuid
  `);
  if (rows.length !== 1 || !rows[0]) {
    throw new GroupEventOperationConflictError();
  }
  return mapOperation(rows[0]);
}

export async function activeGroupEventOperationRecord(
  transaction: ActorDatabaseTransaction,
  input: Readonly<{
    eventId: string;
    operation: GroupEventOperationKind;
  }>,
) {
  const rows = await transaction.execute<OperationRow>(sql`
    select ${operationSelect()}
    from app.group_event_chain_operations
    where event_id = ${input.eventId}::uuid
      and operation_kind = ${input.operation}::text
      and status in ('prepared', 'submitted')
    order by created_at desc, id desc
    limit 1
  `);
  return rows[0] ? mapOperation(rows[0]) : null;
}

export async function saveGroupEventPreparationRecord(
  transaction: ActorDatabaseTransaction,
  input: Readonly<{
    operationId: string;
    eventId: string;
    prepared: PreparedGroupEventTransaction;
    simulationSlot: bigint;
    simulationUnitsConsumed: bigint | null;
  }>,
) {
  if (!isPreparedGroupEventTransaction(input.prepared)) {
    throw new GroupEventOperationConflictError();
  }
  const summary = input.prepared.summary;
  return operationMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select app.record_group_event_operation_preparation(
        ${input.operationId}::uuid,
        ${input.eventId}::uuid,
        ${summary.operation}::text,
        ${summary.programAddress}::text,
        ${summary.authorityAddress}::text,
        ${summary.coachAuthorityAddress}::text,
        ${summary.eventPoolAddress}::text,
        ${summary.vaultAddress}::text,
        ${summary.contributionAddress}::text,
        ${JSON.stringify(summary)}::jsonb,
        ${input.prepared.transactionBase64}::text,
        ${input.prepared.messageBase64}::text,
        ${input.prepared.recentBlockhash}::text,
        ${input.prepared.lastValidBlockHeight}::bigint,
        ${input.simulationSlot}::bigint,
        ${input.simulationUnitsConsumed}::bigint
      ) as operation_id
    `);
    if (rows[0]?.operation_id !== input.operationId) {
      throw new GroupEventOperationConflictError();
    }
    return input.operationId;
  });
}

export async function markGroupEventOperationSubmittedRecord(
  transaction: ActorDatabaseTransaction,
  operation: GroupEventOperationRecord,
  transactionSignature: string,
) {
  return operationMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select app.mark_group_event_operation_submitted(
        ${operation.operationId}::uuid,
        ${transactionSignature}::text
      ) as operation_id
    `);
    if (rows[0]?.operation_id !== operation.operationId) {
      throw new GroupEventOperationConflictError();
    }
    return operation.operationId;
  });
}

export async function failGroupEventOperationRecord(
  transaction: ActorDatabaseTransaction,
  operation: GroupEventOperationRecord,
  status: "failed" | "expired",
  failureCode:
    | "wallet-rejected"
    | "simulation-failed"
    | "blockhash-expired"
    | "transaction-failed"
    | "state-not-observed",
) {
  return operationMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select app.fail_group_event_operation(
        ${operation.operationId}::uuid,
        ${status}::text,
        ${failureCode}::text
      ) as operation_id
    `);
    if (rows[0]?.operation_id !== operation.operationId) {
      throw new GroupEventOperationConflictError();
    }
    return operation.operationId;
  });
}

export async function finalizeGroupEventOperationRecord(
  transaction: ActorDatabaseTransaction,
  operation: GroupEventOperationRecord,
  observedSlot: bigint,
) {
  return operationMutation(async () => {
    const rows = await transaction.execute<{ operation_id: string }>(sql`
      select app.finalize_group_event_operation(
        ${operation.operationId}::uuid,
        ${observedSlot}::bigint
      ) as operation_id
    `);
    if (rows[0]?.operation_id !== operation.operationId) {
      throw new GroupEventOperationConflictError();
    }
    return operation.operationId;
  });
}
