import type { PreparedCoachPassTransaction } from "./coach-pass-transaction";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
} from "./coach-pass";

export type CoachPassPersistedOperationKind =
  | "purchase-first-offer"
  | "purchase-offer"
  | "reserve-booking-credit"
  | "return-booking-credit"
  | "consume-booking-credit";

export type CoachPassPersistedOperationStatus =
  "prepared" | "submitted" | "finalized" | "failed" | "expired";

export type PrepareCoachPassOperationRequest =
  | Readonly<{
      kind: "purchase";
      coachProfileId: string;
      coachAuthorityAddress: string;
      offerAddress: string;
    }>
  | Readonly<{
      kind: "booking";
      operationId: string;
    }>;

export type SubmitCoachPassOperationRequest = Readonly<{
  operationId: string;
  walletSignedTransactionBase64: string;
}>;

export type CoachPassOperationIdRequest = Readonly<{
  operationId: string;
}>;

export type CoachPassSimulationSummary = Readonly<{
  slot: string;
  unitsConsumed: string | null;
}>;

export type PreparedCoachPassOperationResult = Readonly<{
  status: "prepared";
  operationId: string;
  prepared: PreparedCoachPassTransaction;
  simulation: CoachPassSimulationSummary;
}>;

export type CoachPassOperationSnapshot = Readonly<{
  status: Exclude<CoachPassPersistedOperationStatus, "prepared">;
  operationId: string;
  operation: CoachPassPersistedOperationKind;
  transactionSignature: string | null;
  failureCode: string | null;
  finalizedSlot: string | null;
}>;

export type CoachPassOperationApiResult =
  | PreparedCoachPassOperationResult
  | CoachPassOperationSnapshot
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

function isBase64(value: unknown, maximumLength: number) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value.length % 4 === 0 &&
    BASE64_PATTERN.test(value)
  );
}

export function isPrepareCoachPassOperationRequest(
  value: unknown,
): value is PrepareCoachPassOperationRequest {
  if (!isRecord(value)) return false;
  if (value.kind === "booking") {
    return (
      typeof value.operationId === "string" &&
      UUID_PATTERN.test(value.operationId)
    );
  }
  return (
    value.kind === "purchase" &&
    typeof value.coachProfileId === "string" &&
    UUID_PATTERN.test(value.coachProfileId) &&
    typeof value.coachAuthorityAddress === "string" &&
    SOLANA_ADDRESS_PATTERN.test(value.coachAuthorityAddress) &&
    typeof value.offerAddress === "string" &&
    SOLANA_ADDRESS_PATTERN.test(value.offerAddress)
  );
}

export function isSubmitCoachPassOperationRequest(
  value: unknown,
): value is SubmitCoachPassOperationRequest {
  return (
    isRecord(value) &&
    typeof value.operationId === "string" &&
    UUID_PATTERN.test(value.operationId) &&
    isBase64(value.walletSignedTransactionBase64, 2_000)
  );
}

export function isCoachPassOperationIdRequest(
  value: unknown,
): value is CoachPassOperationIdRequest {
  return (
    isRecord(value) &&
    typeof value.operationId === "string" &&
    UUID_PATTERN.test(value.operationId)
  );
}

export function isPreparedCoachPassTransaction(
  value: unknown,
): value is PreparedCoachPassTransaction {
  if (!isRecord(value) || !isRecord(value.summary)) return false;
  const summary = value.summary;
  const commonValid =
    summary.cluster === "devnet" &&
    typeof summary.operation === "string" &&
    [
      "purchase-first-offer",
      "purchase-offer",
      "reserve-booking-credit",
      "return-booking-credit",
      "consume-booking-credit",
    ].includes(summary.operation) &&
    typeof summary.programAddress === "string" &&
    summary.programAddress === MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS &&
    typeof summary.authorityAddress === "string" &&
    SOLANA_ADDRESS_PATTERN.test(summary.authorityAddress) &&
    typeof summary.platformPayerAddress === "string" &&
    SOLANA_ADDRESS_PATTERN.test(summary.platformPayerAddress) &&
    typeof summary.coachAuthorityAddress === "string" &&
    SOLANA_ADDRESS_PATTERN.test(summary.coachAuthorityAddress) &&
    typeof summary.coachClientCreditsAddress === "string" &&
    SOLANA_ADDRESS_PATTERN.test(summary.coachClientCreditsAddress) &&
    summary.testAsset === "EURC" &&
    summary.paymentMintAddress === DEVNET_EURC_MINT_ADDRESS &&
    summary.userPaysSol === false &&
    isBase64(value.transactionBase64, 2_000) &&
    isBase64(value.messageBase64, 2_000) &&
    typeof value.recentBlockhash === "string" &&
    SOLANA_ADDRESS_PATTERN.test(value.recentBlockhash) &&
    isDecimalString(value.lastValidBlockHeight);
  if (!commonValid) return false;

  if (
    summary.operation === "purchase-first-offer" ||
    summary.operation === "purchase-offer"
  ) {
    return (
      summary.creditReservationAddress === null &&
      typeof summary.offerAddress === "string" &&
      SOLANA_ADDRESS_PATTERN.test(summary.offerAddress) &&
      typeof summary.paymentRecipientAddress === "string" &&
      SOLANA_ADDRESS_PATTERN.test(summary.paymentRecipientAddress) &&
      isDecimalString(summary.priceEurcBaseUnits) &&
      BigInt(summary.priceEurcBaseUnits) > BigInt(0) &&
      (summary.creditsPurchased === 1 || summary.creditsPurchased === 10) &&
      isDecimalString(summary.expectedPurchaseNonce) &&
      typeof summary.clientTokenAccountAddress === "string" &&
      SOLANA_ADDRESS_PATTERN.test(summary.clientTokenAccountAddress) &&
      typeof summary.coachTokenAccountAddress === "string" &&
      SOLANA_ADDRESS_PATTERN.test(summary.coachTokenAccountAddress)
    );
  }

  if (
    typeof summary.creditReservationAddress !== "string" ||
    !SOLANA_ADDRESS_PATTERN.test(summary.creditReservationAddress) ||
    typeof summary.bookingId !== "string" ||
    !UUID_PATTERN.test(summary.bookingId) ||
    typeof summary.clientWalletAddress !== "string" ||
    !SOLANA_ADDRESS_PATTERN.test(summary.clientWalletAddress) ||
    !isDecimalString(summary.scheduledStartUnixSeconds) ||
    !isDecimalString(summary.earlyReturnUntilUnixSeconds)
  ) {
    return false;
  }
  return (
    BigInt(summary.scheduledStartUnixSeconds) > BigInt(0) &&
    BigInt(summary.earlyReturnUntilUnixSeconds) <=
      BigInt(summary.scheduledStartUnixSeconds)
  );
}

export function isCoachPassOperationApiResult(
  value: unknown,
): value is CoachPassOperationApiResult {
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
  if (
    typeof value.operationId !== "string" ||
    !UUID_PATTERN.test(value.operationId)
  ) {
    return false;
  }
  if (value.status === "prepared") {
    return (
      isPreparedCoachPassTransaction(value.prepared) &&
      isRecord(value.simulation) &&
      isDecimalString(value.simulation.slot) &&
      (value.simulation.unitsConsumed === null ||
        isDecimalString(value.simulation.unitsConsumed))
    );
  }
  return (
    ["submitted", "finalized", "failed", "expired"].includes(value.status) &&
    typeof value.operation === "string" &&
    [
      "purchase-first-offer",
      "purchase-offer",
      "reserve-booking-credit",
      "return-booking-credit",
      "consume-booking-credit",
    ].includes(value.operation) &&
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
