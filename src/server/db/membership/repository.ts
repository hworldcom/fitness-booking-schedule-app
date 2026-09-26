import "server-only";

import { sql } from "drizzle-orm";
import type { MembershipActivationFailureReason } from "@/domain/membership-activation";
import type { MembershipPlanId } from "@/domain/catalogue";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

export type MembershipActivationCommandResult =
  | "prepared"
  | "submitted"
  | "failed"
  | "existing"
  | "invalid-request"
  | "invalid-selection"
  | "operation-conflict"
  | "state-conflict"
  | "wallet-conflict"
  | "payment-conflict";

export type MembershipActivationCompletionResult = Readonly<{
  result:
    | "confirmed"
    | "existing"
    | "invalid-request"
    | "operation-conflict"
    | "state-conflict";
  membershipPeriodId: string | null;
}>;

export type MembershipStateRecord = Readonly<{
  activationOperationId: string;
  operationStatus: "pending" | "submitted" | "confirmed" | "failed";
  failureReason: MembershipActivationFailureReason | null;
  planCode: MembershipPlanId;
  planVersionNumber: number;
  planName: string;
  currencyCode: "EURC";
  priceBaseUnits: string;
  accessModel: "limited" | "daily_uncapped";
  includedCheckins: number | null;
  maxIncludedCheckinsPerDay: number;
  nonCoreVisitPriceBaseUnits: string;
  paymentCluster: "solana:devnet";
  paymentWalletAddress: string | null;
  paymentDestinationAddress: string | null;
  paymentMintAddress: string | null;
  paymentTokenProgramAddress: string | null;
  paymentTokenDecimals: number | null;
  paymentReferenceAddress: string | null;
  transactionSignature: string | null;
  submittedAt: string | Date | null;
  confirmedAt: string | Date | null;
  confirmedSlot: string | null;
  failedAt: string | Date | null;
  operationCreatedAt: string | Date;
  membershipPeriodId: string | null;
  periodStatus: "active" | "expired" | null;
  paymentStatus: "confirmed" | null;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  includedCheckinsUsed: number | null;
  lastIncludedServiceDate: string | null;
  selectedGymSlugs: readonly string[];
  selectedGymNames: readonly string[];
}>;

type MembershipStateRow = Readonly<{
  activation_operation_id: string;
  operation_status: string;
  failure_reason: string | null;
  plan_code: string;
  plan_version_number: number;
  plan_name: string;
  currency_code: string;
  price_base_units: string;
  access_model: string;
  included_checkins: number | null;
  max_included_checkins_per_day: number;
  non_core_visit_price_base_units: string;
  payment_cluster: string;
  payment_wallet_address: string | null;
  payment_destination_address: string | null;
  payment_mint_address: string | null;
  payment_token_program_address: string | null;
  payment_token_decimals: number | null;
  payment_reference_address: string | null;
  transaction_signature: string | null;
  submitted_at: string | Date | null;
  confirmed_at: string | Date | null;
  confirmed_slot: string | null;
  failed_at: string | Date | null;
  operation_created_at: string | Date;
  membership_period_id: string | null;
  period_status: string | null;
  payment_status: string | null;
  starts_at: string | Date | null;
  ends_at: string | Date | null;
  included_checkins_used: number | null;
  last_included_service_date: string | null;
  selected_gym_slugs: string[];
  selected_gym_names: string[];
}>;

export class MembershipActivationRecordError extends Error {
  constructor() {
    super("Membership activation persistence returned inconsistent state.");
    this.name = "MembershipActivationRecordError";
  }
}

const commandResults = new Set<MembershipActivationCommandResult>([
  "prepared",
  "submitted",
  "failed",
  "existing",
  "invalid-request",
  "invalid-selection",
  "operation-conflict",
  "state-conflict",
  "wallet-conflict",
  "payment-conflict",
]);

function commandResult(value: string | undefined) {
  if (
    !value ||
    !commandResults.has(value as MembershipActivationCommandResult)
  ) {
    throw new MembershipActivationRecordError();
  }
  return value as MembershipActivationCommandResult;
}

function isFailureReason(
  value: string | null,
): value is MembershipActivationFailureReason | null {
  return (
    value === null ||
    value === "wallet-cancelled" ||
    value === "transaction-rejected" ||
    value === "verification-failed" ||
    value === "superseded"
  );
}

function mapMembershipStateRow(row: MembershipStateRow): MembershipStateRecord {
  if (
    !["pending", "submitted", "confirmed", "failed"].includes(
      row.operation_status,
    ) ||
    !isFailureReason(row.failure_reason) ||
    (row.plan_code !== "basic" && row.plan_code !== "classic") ||
    row.currency_code !== "EURC" ||
    (row.access_model !== "limited" && row.access_model !== "daily_uncapped") ||
    row.payment_cluster !== "solana:devnet" ||
    !(
      (row.payment_wallet_address === null &&
        row.payment_destination_address === null &&
        row.payment_mint_address === null &&
        row.payment_token_program_address === null &&
        row.payment_token_decimals === null &&
        row.payment_reference_address === null) ||
      (row.payment_wallet_address !== null &&
        row.payment_destination_address !== null &&
        row.payment_mint_address !== null &&
        row.payment_token_program_address !== null &&
        row.payment_token_decimals === 6 &&
        row.payment_reference_address !== null)
    ) ||
    !(
      row.period_status === null ||
      row.period_status === "active" ||
      row.period_status === "expired"
    ) ||
    !(row.payment_status === null || row.payment_status === "confirmed") ||
    row.selected_gym_slugs.length !== 4 ||
    row.selected_gym_names.length !== 4
  ) {
    throw new MembershipActivationRecordError();
  }

  return Object.freeze({
    activationOperationId: row.activation_operation_id,
    operationStatus:
      row.operation_status as MembershipStateRecord["operationStatus"],
    failureReason: row.failure_reason,
    planCode: row.plan_code,
    planVersionNumber: row.plan_version_number,
    planName: row.plan_name,
    currencyCode: row.currency_code,
    priceBaseUnits: row.price_base_units,
    accessModel: row.access_model,
    includedCheckins: row.included_checkins,
    maxIncludedCheckinsPerDay: row.max_included_checkins_per_day,
    nonCoreVisitPriceBaseUnits: row.non_core_visit_price_base_units,
    paymentCluster: row.payment_cluster,
    paymentWalletAddress: row.payment_wallet_address,
    paymentDestinationAddress: row.payment_destination_address,
    paymentMintAddress: row.payment_mint_address,
    paymentTokenProgramAddress: row.payment_token_program_address,
    paymentTokenDecimals: row.payment_token_decimals,
    paymentReferenceAddress: row.payment_reference_address,
    transactionSignature: row.transaction_signature,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at,
    confirmedSlot: row.confirmed_slot,
    failedAt: row.failed_at,
    operationCreatedAt: row.operation_created_at,
    membershipPeriodId: row.membership_period_id,
    periodStatus: row.period_status,
    paymentStatus: row.payment_status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    includedCheckinsUsed: row.included_checkins_used,
    lastIncludedServiceDate: row.last_included_service_date,
    selectedGymSlugs: Object.freeze([...row.selected_gym_slugs]),
    selectedGymNames: Object.freeze([...row.selected_gym_names]),
  });
}

export async function prepareMembershipActivationRecord(
  transaction: ActorDatabaseTransaction,
  input: {
    operationId: string;
    planId: MembershipPlanId;
    gymIds: readonly string[];
    referenceAddress: string;
    destinationAddress: string;
    mintAddress: string;
    tokenProgramAddress: string;
    tokenDecimals: number;
  },
) {
  const gymIds = sql.join(
    input.gymIds.map((gymId) => sql`${gymId}::text`),
    sql`, `,
  );
  const rows = await transaction.execute<{ result: string }>(sql`
    select app.prepare_membership_payment_activation(
      ${input.operationId}::uuid,
      ${input.planId}::text,
      array[${gymIds}]::text[],
      ${input.referenceAddress}::text,
      ${input.destinationAddress}::text,
      ${input.mintAddress}::text,
      ${input.tokenProgramAddress}::text,
      ${input.tokenDecimals}::integer
    ) as result
  `);
  return commandResult(rows[0]?.result);
}

export async function recordMembershipActivationSubmission(
  transaction: ActorDatabaseTransaction,
  input: {
    operationId: string;
    transactionSignature: string;
  },
) {
  const rows = await transaction.execute<{ result: string }>(sql`
    select app.record_membership_payment_submission(
      ${input.operationId}::uuid,
      ${input.transactionSignature}::text
    ) as result
  `);
  return commandResult(rows[0]?.result);
}

export async function failMembershipActivationRecord(
  transaction: ActorDatabaseTransaction,
  input: {
    operationId: string;
    reason: MembershipActivationFailureReason;
  },
) {
  const rows = await transaction.execute<{ result: string }>(sql`
    select app.fail_membership_activation(
      ${input.operationId}::uuid,
      ${input.reason}::text
    ) as result
  `);
  return commandResult(rows[0]?.result);
}

export async function completeVerifiedMembershipActivationRecord(
  transaction: ActorDatabaseTransaction,
  input: {
    operationId: string;
    walletAddress: string;
    destinationAddress: string;
    mintAddress: string;
    tokenProgramAddress: string;
    tokenDecimals: number;
    referenceAddress: string;
    transactionSignature: string;
    confirmedSlot: string;
    amountBaseUnits: string;
  },
): Promise<MembershipActivationCompletionResult> {
  const rows = await transaction.execute<{
    completion_result: string;
    membership_period_id: string | null;
  }>(sql`
    select *
    from app.complete_verified_membership_payment(
      ${input.operationId}::uuid,
      ${input.walletAddress}::text,
      ${input.destinationAddress}::text,
      ${input.mintAddress}::text,
      ${input.tokenProgramAddress}::text,
      ${input.referenceAddress}::text,
      ${input.tokenDecimals}::integer,
      ${input.transactionSignature}::text,
      ${input.confirmedSlot}::bigint,
      ${input.amountBaseUnits}::numeric
    )
  `);
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    ![
      "confirmed",
      "existing",
      "invalid-request",
      "operation-conflict",
      "state-conflict",
    ].includes(row.completion_result) ||
    (row.completion_result === "confirmed" ||
      row.completion_result === "existing") !==
      Boolean(row.membership_period_id)
  ) {
    throw new MembershipActivationRecordError();
  }
  return Object.freeze({
    result:
      row.completion_result as MembershipActivationCompletionResult["result"],
    membershipPeriodId: row.membership_period_id,
  });
}

export async function currentMembershipStateRecords(
  transaction: ActorDatabaseTransaction,
) {
  const rows = await transaction.execute<MembershipStateRow>(sql`
    select * from app.current_membership_payment_state()
  `);
  return Object.freeze(rows.map(mapMembershipStateRow));
}
