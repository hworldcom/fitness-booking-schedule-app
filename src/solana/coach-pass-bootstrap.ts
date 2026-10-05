import { address, type Address } from "@solana/kit";
import type { PreparedCoachPassBootstrapTransaction } from "./coach-pass-transaction";

const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,100}$/u;
const SOLANA_BLOCKHASH_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;

export type CoachPassBootstrapSimulation = Readonly<{
  slot: string;
  unitsConsumed: string | null;
}>;

export type PreparedCoachPassBootstrapResult = Readonly<{
  status: "prepared";
  prepared: PreparedCoachPassBootstrapTransaction;
  simulation: CoachPassBootstrapSimulation;
}>;

export type CoachPassBootstrapSnapshot = Readonly<{
  status: "submitted" | "finalized" | "failed" | "expired";
  transactionSignature: string | null;
  finalizedSlot: string | null;
}>;

export const COACH_PASS_BOOTSTRAP_INVALID_REASONS = [
  "sponsor-mismatch",
  "wallet-transaction-invalid",
  "wallet-message-mismatch",
  "wallet-signer-set-invalid",
  "wallet-sponsor-pre-signed",
  "wallet-coach-signature-missing",
  "wallet-coach-signature-invalid",
] as const;

export type CoachPassBootstrapInvalidReason =
  (typeof COACH_PASS_BOOTSTRAP_INVALID_REASONS)[number];

export type CoachPassBootstrapApiResult =
  | PreparedCoachPassBootstrapResult
  | CoachPassBootstrapSnapshot
  | Readonly<{
      status:
        "signed-out" | "preview" | "forbidden" | "conflict" | "unavailable";
    }>
  | Readonly<{
      status: "invalid-request";
      reason?: CoachPassBootstrapInvalidReason;
    }>;

export type SubmitCoachPassBootstrapRequest = Readonly<{
  prepared: PreparedCoachPassBootstrapTransaction;
  walletSignedTransactionBase64: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAddress(value: unknown): value is Address {
  if (typeof value !== "string") return false;
  try {
    address(value);
    return true;
  } catch {
    return false;
  }
}

function isUnsignedDecimal(value: unknown, positive = false) {
  return (
    typeof value === "string" &&
    /^(0|[1-9][0-9]*)$/u.test(value) &&
    (!positive || value !== "0")
  );
}

function isBase64(value: unknown) {
  return (
    typeof value === "string" &&
    value.length >= 4 &&
    value.length <= 4096 &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/u.test(value)
  );
}

export function isPreparedCoachPassBootstrapTransaction(
  value: unknown,
): value is PreparedCoachPassBootstrapTransaction {
  if (!isRecord(value) || !isRecord(value.summary)) return false;
  const summary = value.summary;
  return (
    summary.cluster === "devnet" &&
    summary.operation === "initialize-coach-and-offers" &&
    summary.testAsset === "EURC" &&
    summary.userPaysSol === false &&
    summary.eurcMovedBaseUnits === "0" &&
    isAddress(summary.programAddress) &&
    isAddress(summary.coachWalletAddress) &&
    isAddress(summary.recoveryAuthorityAddress) &&
    isAddress(summary.platformPayerAddress) &&
    isAddress(summary.coachAuthorityAddress) &&
    isAddress(summary.oneCreditOfferAddress) &&
    isAddress(summary.tenCreditOfferAddress) &&
    isAddress(summary.paymentMintAddress) &&
    isUnsignedDecimal(summary.oneCreditPriceEurcBaseUnits, true) &&
    isUnsignedDecimal(summary.tenCreditPriceEurcBaseUnits, true) &&
    isBase64(value.transactionBase64) &&
    isBase64(value.messageBase64) &&
    typeof value.recentBlockhash === "string" &&
    SOLANA_BLOCKHASH_PATTERN.test(value.recentBlockhash) &&
    isUnsignedDecimal(value.lastValidBlockHeight)
  );
}

export function isSubmitCoachPassBootstrapRequest(
  value: unknown,
): value is SubmitCoachPassBootstrapRequest {
  return (
    isRecord(value) &&
    isPreparedCoachPassBootstrapTransaction(value.prepared) &&
    isBase64(value.walletSignedTransactionBase64)
  );
}

export function isCoachPassBootstrapApiResult(
  value: unknown,
): value is CoachPassBootstrapApiResult {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (
    value.status === "signed-out" ||
    value.status === "preview" ||
    value.status === "forbidden" ||
    value.status === "conflict" ||
    value.status === "unavailable"
  ) {
    return true;
  }
  if (value.status === "invalid-request") {
    return (
      value.reason === undefined ||
      (typeof value.reason === "string" &&
        COACH_PASS_BOOTSTRAP_INVALID_REASONS.includes(
          value.reason as CoachPassBootstrapInvalidReason,
        ))
    );
  }
  if (value.status === "prepared") {
    return (
      isPreparedCoachPassBootstrapTransaction(value.prepared) &&
      isRecord(value.simulation) &&
      isUnsignedDecimal(value.simulation.slot) &&
      (value.simulation.unitsConsumed === null ||
        isUnsignedDecimal(value.simulation.unitsConsumed))
    );
  }
  if (
    value.status === "submitted" ||
    value.status === "finalized" ||
    value.status === "failed" ||
    value.status === "expired"
  ) {
    return (
      (value.transactionSignature === null ||
        (typeof value.transactionSignature === "string" &&
          SOLANA_SIGNATURE_PATTERN.test(value.transactionSignature))) &&
      (value.finalizedSlot === null || isUnsignedDecimal(value.finalizedSlot))
    );
  }
  return false;
}
