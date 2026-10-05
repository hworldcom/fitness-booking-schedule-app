import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
} from "./coach-pass";
import type {
  GroupEventOperationKind,
  PreparedGroupEventTransaction,
} from "./group-event-transaction";

export type GroupEventPersistedOperationStatus =
  "prepared" | "submitted" | "finalized" | "failed" | "expired";

export type PrepareGroupEventOperationRequest =
  | Readonly<{
      kind: "create";
      eventId: string;
      coachAuthorityAddress: string;
      seatPriceEurcBaseUnits: string;
      minimumParticipants: number;
      maximumParticipants: number;
      fundingDeadline: string;
    }>
  | Readonly<{
      kind: "fund" | "settle" | "payout" | "refund";
      eventId: string;
    }>;

export type SubmitGroupEventOperationRequest = Readonly<{
  operationId: string;
  walletSignedTransactionBase64: string;
}>;

export type GroupEventOperationIdRequest = Readonly<{
  operationId: string;
}>;

export type GroupEventSimulationSummary = Readonly<{
  slot: string;
  unitsConsumed: string | null;
}>;

export type PreparedGroupEventOperationResult = Readonly<{
  status: "prepared";
  operationId: string;
  prepared: PreparedGroupEventTransaction;
  simulation: GroupEventSimulationSummary;
}>;

export type GroupEventOperationSnapshot = Readonly<{
  status: Exclude<GroupEventPersistedOperationStatus, "prepared">;
  operationId: string;
  operation: GroupEventOperationKind;
  transactionSignature: string | null;
  failureCode: string | null;
  finalizedSlot: string | null;
}>;

export type GroupEventOperationApiResult =
  | PreparedGroupEventOperationResult
  | GroupEventOperationSnapshot
  | Readonly<{
      status:
        | "preview"
        | "signed-out"
        | "forbidden"
        | "invalid-request"
        | "conflict"
        | "unavailable";
    }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,100}$/u;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9][0-9]*)$/u.test(value);
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && SOLANA_ADDRESS_PATTERN.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isBase64(value: unknown, maximumLength: number) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value.length % 4 === 0 &&
    BASE64_PATTERN.test(value)
  );
}

function isIsoTimestamp(value: unknown) {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    Number.isFinite(new Date(value).getTime())
  );
}

export function isPrepareGroupEventOperationRequest(
  value: unknown,
): value is PrepareGroupEventOperationRequest {
  if (!isRecord(value) || !isUuid(value.eventId)) return false;
  if (value.kind !== "create") {
    return ["fund", "settle", "payout", "refund"].includes(String(value.kind));
  }
  return (
    isAddress(value.coachAuthorityAddress) &&
    isDecimalString(value.seatPriceEurcBaseUnits) &&
    BigInt(value.seatPriceEurcBaseUnits) > BigInt(0) &&
    Number.isInteger(value.minimumParticipants) &&
    Number.isInteger(value.maximumParticipants) &&
    Number(value.minimumParticipants) >= 2 &&
    Number(value.maximumParticipants) >= Number(value.minimumParticipants) &&
    Number(value.maximumParticipants) <= 50 &&
    isIsoTimestamp(value.fundingDeadline)
  );
}

export function isSubmitGroupEventOperationRequest(
  value: unknown,
): value is SubmitGroupEventOperationRequest {
  return (
    isRecord(value) &&
    isUuid(value.operationId) &&
    isBase64(value.walletSignedTransactionBase64, 2_000)
  );
}

export function isGroupEventOperationIdRequest(
  value: unknown,
): value is GroupEventOperationIdRequest {
  return isRecord(value) && isUuid(value.operationId);
}

function isCommonSummary(summary: Record<string, unknown>) {
  return (
    summary.cluster === "devnet" &&
    [
      "create-event-pool",
      "fund-event-seat",
      "settle-event-pool",
      "claim-event-payout",
      "claim-event-refund",
    ].includes(String(summary.operation)) &&
    isUuid(summary.eventId) &&
    summary.programAddress === MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS &&
    isAddress(summary.authorityAddress) &&
    isAddress(summary.platformPayerAddress) &&
    isAddress(summary.eventPoolAddress) &&
    isAddress(summary.vaultAddress) &&
    isAddress(summary.coachAuthorityAddress) &&
    (summary.contributionAddress === null ||
      isAddress(summary.contributionAddress)) &&
    summary.testAsset === "EURC" &&
    summary.paymentMintAddress === DEVNET_EURC_MINT_ADDRESS &&
    summary.userPaysSol === false
  );
}

function isOperationSummary(summary: Record<string, unknown>) {
  if (!isCommonSummary(summary)) return false;
  switch (summary.operation) {
    case "create-event-pool":
      return (
        summary.contributionAddress === null &&
        isAddress(summary.payoutRecipientAddress) &&
        isDecimalString(summary.nonce) &&
        isDecimalString(summary.seatPriceEurcBaseUnits) &&
        BigInt(summary.seatPriceEurcBaseUnits) > BigInt(0) &&
        Number.isInteger(summary.minimumParticipants) &&
        Number.isInteger(summary.maximumParticipants) &&
        Number(summary.minimumParticipants) >= 2 &&
        Number(summary.maximumParticipants) >=
          Number(summary.minimumParticipants) &&
        Number(summary.maximumParticipants) <= 50 &&
        isDecimalString(summary.fundingDeadlineUnixSeconds) &&
        isDecimalString(summary.eventStartUnixSeconds) &&
        isDecimalString(summary.eventEndUnixSeconds) &&
        BigInt(summary.fundingDeadlineUnixSeconds) <
          BigInt(summary.eventStartUnixSeconds) &&
        BigInt(summary.eventStartUnixSeconds) <
          BigInt(summary.eventEndUnixSeconds)
      );
    case "fund-event-seat":
      return (
        isAddress(summary.contributionAddress) &&
        isAddress(summary.participantWalletAddress) &&
        summary.authorityAddress === summary.participantWalletAddress &&
        isAddress(summary.participantTokenAccountAddress) &&
        isDecimalString(summary.seatPriceEurcBaseUnits) &&
        BigInt(summary.seatPriceEurcBaseUnits) > BigInt(0)
      );
    case "settle-event-pool":
      return (
        summary.contributionAddress === null &&
        (summary.expectedOutcome === "succeeded" ||
          summary.expectedOutcome === "failed") &&
        Number.isInteger(summary.participantCount) &&
        Number.isInteger(summary.minimumParticipants) &&
        Number(summary.participantCount) >= 0 &&
        Number(summary.minimumParticipants) >= 2 &&
        (summary.expectedOutcome === "succeeded") ===
          Number(summary.participantCount) >=
            Number(summary.minimumParticipants)
      );
    case "claim-event-payout":
      return (
        summary.contributionAddress === null &&
        isAddress(summary.payoutRecipientAddress) &&
        isAddress(summary.payoutTokenAccountAddress) &&
        isDecimalString(summary.amountEurcBaseUnits) &&
        BigInt(summary.amountEurcBaseUnits) > BigInt(0)
      );
    case "claim-event-refund":
      return (
        isAddress(summary.contributionAddress) &&
        isAddress(summary.participantWalletAddress) &&
        summary.authorityAddress === summary.participantWalletAddress &&
        isAddress(summary.participantTokenAccountAddress) &&
        isDecimalString(summary.amountEurcBaseUnits) &&
        BigInt(summary.amountEurcBaseUnits) > BigInt(0)
      );
    default:
      return false;
  }
}

export function isPreparedGroupEventTransaction(
  value: unknown,
): value is PreparedGroupEventTransaction {
  return (
    isRecord(value) &&
    isRecord(value.summary) &&
    isOperationSummary(value.summary) &&
    isBase64(value.transactionBase64, 2_000) &&
    isBase64(value.messageBase64, 2_000) &&
    isAddress(value.recentBlockhash) &&
    isDecimalString(value.lastValidBlockHeight)
  );
}

export function isGroupEventOperationApiResult(
  value: unknown,
): value is GroupEventOperationApiResult {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (
    [
      "preview",
      "signed-out",
      "forbidden",
      "invalid-request",
      "conflict",
      "unavailable",
    ].includes(value.status)
  ) {
    return true;
  }
  if (!isUuid(value.operationId)) return false;
  if (value.status === "prepared") {
    return (
      isPreparedGroupEventTransaction(value.prepared) &&
      isRecord(value.simulation) &&
      isDecimalString(value.simulation.slot) &&
      (value.simulation.unitsConsumed === null ||
        isDecimalString(value.simulation.unitsConsumed))
    );
  }
  return (
    ["submitted", "finalized", "failed", "expired"].includes(value.status) &&
    [
      "create-event-pool",
      "fund-event-seat",
      "settle-event-pool",
      "claim-event-payout",
      "claim-event-refund",
    ].includes(String(value.operation)) &&
    (value.transactionSignature === null ||
      (typeof value.transactionSignature === "string" &&
        SOLANA_SIGNATURE_PATTERN.test(value.transactionSignature))) &&
    (value.failureCode === null ||
      [
        "wallet-rejected",
        "simulation-failed",
        "blockhash-expired",
        "transaction-failed",
        "state-not-observed",
      ].includes(String(value.failureCode))) &&
    (value.finalizedSlot === null || isDecimalString(value.finalizedSlot))
  );
}
