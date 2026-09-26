import "server-only";

import type { AuthSessionSnapshot } from "@/auth/contracts";
import {
  isMembershipActivationFailureReason,
  MEMBERSHIP_PAYMENT_CLUSTER,
  normalizeMembershipActivationId,
  normalizeMembershipActivationSelection,
  normalizeMembershipPaymentAddress,
  normalizeMembershipPaymentBaseUnits,
  normalizeMembershipPaymentSlot,
  normalizeMembershipTransactionSignature,
  type MemberMembershipState,
  type MembershipActivationSnapshot,
  type MembershipPeriodSnapshot,
} from "@/domain/membership-activation";
import { generateKeyPairSigner } from "@solana/kit";
import {
  MEMBERSHIP_PAYMENT_CURRENCY,
  MEMBERSHIP_PAYMENT_POOL_OWNER_ADDRESS,
  membershipPaymentMemo,
} from "@/solana/membership-payment";
import { membershipPaymentConfig } from "@/server/solana/membership-payment-config";
import { reconcileMembershipPayment } from "@/server/solana/membership-payment-reconciliation";
import { verifiedAuthSession } from "@/server/auth/session";
import {
  withAuthorizedActor,
  withAuthorizedSession,
} from "@/server/authorization/service";
import {
  completeVerifiedMembershipActivationRecord,
  currentMembershipStateRecords,
  failMembershipActivationRecord,
  prepareMembershipActivationRecord,
  recordMembershipActivationSubmission,
  type MembershipStateRecord,
} from "@/server/db/membership/repository";

type MembershipAccessStatus =
  "preview" | "signed-out" | "forbidden" | "unavailable";

export type MemberMembershipStateResult =
  | Readonly<{ status: "ready"; membership: MemberMembershipState }>
  | Readonly<{ status: MembershipAccessStatus }>;

export type MembershipActivationMutationResult = Readonly<{
  status:
    | "prepared"
    | "submitted"
    | "failed"
    | "confirmed"
    | "existing"
    | "invalid-request"
    | "invalid-selection"
    | "operation-conflict"
    | "state-conflict"
    | "wallet-conflict"
    | "payment-conflict"
    | "configuration-unavailable"
    | MembershipAccessStatus;
  membershipPeriodId?: string;
}>;

export type MembershipActivationReconciliationResult = Readonly<{
  status:
    | "confirmed"
    | "existing"
    | "pending"
    | "failed"
    | "invalid-request"
    | "operation-conflict"
    | "state-conflict"
    | "configuration-unavailable"
    | "prepared"
    | "submitted"
    | "invalid-selection"
    | "wallet-conflict"
    | "payment-conflict"
    | MembershipAccessStatus;
  membershipPeriodId?: string;
  reason?: string;
}>;

export type VerifiedMembershipPayment = Readonly<{
  verification: "verified-devnet-eurc-payment";
  operationId: unknown;
  walletAddress: unknown;
  destinationAddress: unknown;
  transactionSignature: unknown;
  amountBaseUnits: unknown;
  mintAddress: unknown;
  tokenProgramAddress: unknown;
  tokenDecimals: unknown;
  referenceAddress: unknown;
  confirmedSlot: unknown;
}>;

function isoTimestamp(value: string | Date) {
  return new Date(value).toISOString();
}

function accessStatus(status: MembershipAccessStatus) {
  return Object.freeze({
    status: status === "preview" ? ("unavailable" as const) : status,
  });
}

function planSnapshot(
  record: MembershipStateRecord,
): MembershipActivationSnapshot["plan"] {
  return Object.freeze({
    id: record.planCode,
    version: String(record.planVersionNumber),
    name: record.planName,
    price: Object.freeze({
      baseUnits: record.priceBaseUnits,
      currency: "EURC" as const,
    }),
    access:
      record.accessModel === "limited" && record.includedCheckins !== null
        ? Object.freeze({
            model: "limited" as const,
            includedCheckins: record.includedCheckins,
          })
        : Object.freeze({ model: "daily-uncapped" as const }),
    maxIncludedCheckinsPerDay: record.maxIncludedCheckinsPerDay,
    nonCoreVisitPriceBaseUnits: record.nonCoreVisitPriceBaseUnits,
  });
}

function gymSnapshots(record: MembershipStateRecord) {
  return Object.freeze(
    record.selectedGymSlugs.map((id, index) =>
      Object.freeze({ id, name: record.selectedGymNames[index]! }),
    ),
  );
}

function paymentSnapshot(
  record: MembershipStateRecord,
): MembershipActivationSnapshot["payment"] {
  if (
    !record.paymentWalletAddress ||
    !record.paymentDestinationAddress ||
    !record.paymentMintAddress ||
    !record.paymentTokenProgramAddress ||
    record.paymentTokenDecimals === null ||
    !record.paymentReferenceAddress
  ) {
    return null;
  }
  return Object.freeze({
    cluster: MEMBERSHIP_PAYMENT_CLUSTER,
    currency: MEMBERSHIP_PAYMENT_CURRENCY,
    amountBaseUnits: record.priceBaseUnits,
    walletAddress: record.paymentWalletAddress,
    destinationOwnerAddress: MEMBERSHIP_PAYMENT_POOL_OWNER_ADDRESS,
    destinationTokenAddress: record.paymentDestinationAddress,
    mintAddress: record.paymentMintAddress,
    tokenProgramAddress: record.paymentTokenProgramAddress,
    tokenDecimals: record.paymentTokenDecimals,
    referenceAddress: record.paymentReferenceAddress,
    memo: membershipPaymentMemo(record.activationOperationId),
    transactionSignature: record.transactionSignature,
    submittedAt: record.submittedAt ? isoTimestamp(record.submittedAt) : null,
    confirmedAt: record.confirmedAt ? isoTimestamp(record.confirmedAt) : null,
    confirmedSlot: record.confirmedSlot,
  });
}

function activationSnapshot(
  record: MembershipStateRecord,
): MembershipActivationSnapshot {
  return Object.freeze({
    id: record.activationOperationId,
    status: record.operationStatus,
    failureReason: record.failureReason,
    plan: planSnapshot(record),
    gyms: gymSnapshots(record),
    payment: paymentSnapshot(record),
    failedAt: record.failedAt ? isoTimestamp(record.failedAt) : null,
    createdAt: isoTimestamp(record.operationCreatedAt),
  });
}

function periodSnapshot(record: MembershipStateRecord) {
  const payment = paymentSnapshot(record);
  if (
    !record.membershipPeriodId ||
    !record.periodStatus ||
    record.paymentStatus !== "confirmed" ||
    !record.startsAt ||
    !record.endsAt ||
    record.includedCheckinsUsed === null ||
    !payment ||
    !payment.confirmedAt ||
    !payment.confirmedSlot ||
    !payment.transactionSignature ||
    !payment.submittedAt
  ) {
    return null;
  }
  const confirmedPayment = Object.freeze({
    ...payment,
    confirmedAt: payment.confirmedAt,
    confirmedSlot: payment.confirmedSlot,
    transactionSignature: payment.transactionSignature,
    submittedAt: payment.submittedAt,
  });
  return Object.freeze({
    id: record.membershipPeriodId,
    activationOperationId: record.activationOperationId,
    status: record.periodStatus,
    paymentStatus: "confirmed" as const,
    plan: planSnapshot(record),
    gyms: gymSnapshots(record),
    startsAt: isoTimestamp(record.startsAt),
    endsAt: isoTimestamp(record.endsAt),
    includedCheckinsUsed: record.includedCheckinsUsed,
    lastIncludedServiceDate: record.lastIncludedServiceDate,
    payment: confirmedPayment,
  }) satisfies MembershipPeriodSnapshot;
}

export function membershipStateFromRecords(
  records: readonly MembershipStateRecord[],
): MemberMembershipState {
  const history = records.map(activationSnapshot);
  const pendingOperations = history.filter(
    (operation) =>
      operation.status === "pending" || operation.status === "submitted",
  );
  const activePeriods = records
    .map(periodSnapshot)
    .filter(
      (period): period is MembershipPeriodSnapshot =>
        period?.status === "active",
    );
  if (pendingOperations.length > 1 || activePeriods.length > 1) {
    throw new Error(
      "Membership state violates the single-current-state contract.",
    );
  }
  return Object.freeze({
    pending: pendingOperations[0] ?? null,
    activePeriod: activePeriods[0] ?? null,
    history: Object.freeze(history),
  });
}

export async function memberMembershipStateForSession(
  session: AuthSessionSnapshot,
): Promise<MemberMembershipStateResult> {
  const result = await withAuthorizedSession(
    session,
    currentMembershipStateRecords,
  );
  if (result.status !== "authorized") return accessStatus(result.status);
  return Object.freeze({
    status: "ready",
    membership: membershipStateFromRecords(result.value),
  });
}

export async function memberMembershipState(): Promise<MemberMembershipStateResult> {
  const result = await withAuthorizedActor(currentMembershipStateRecords);
  if (result.status !== "authorized") return accessStatus(result.status);
  return Object.freeze({
    status: "ready",
    membership: membershipStateFromRecords(result.value),
  });
}

export async function prepareMembershipActivation(input: {
  operationId: unknown;
  planId: unknown;
  gymIds: unknown;
}): Promise<MembershipActivationMutationResult> {
  const operationId = normalizeMembershipActivationId(input.operationId);
  const selection = normalizeMembershipActivationSelection(input);
  if (!operationId || !selection) {
    return Object.freeze({ status: "invalid-request" });
  }
  const config = membershipPaymentConfig();
  if (!config) {
    return Object.freeze({ status: "configuration-unavailable" });
  }
  const referenceAddress = (await generateKeyPairSigner()).address;
  const result = await withAuthorizedActor((transaction) =>
    prepareMembershipActivationRecord(transaction, {
      operationId,
      planId: selection.planId,
      gymIds: selection.gymIds,
      referenceAddress,
      destinationAddress: config.poolTokenAddress,
      mintAddress: config.mintAddress,
      tokenProgramAddress: config.tokenProgramAddress,
      tokenDecimals: config.tokenDecimals,
    }),
  );
  return result.status === "authorized"
    ? Object.freeze({ status: result.value })
    : accessStatus(result.status);
}

export async function submitMembershipActivation(input: {
  operationId: unknown;
  transactionSignature: unknown;
}): Promise<MembershipActivationMutationResult> {
  const operationId = normalizeMembershipActivationId(input.operationId);
  const transactionSignature = normalizeMembershipTransactionSignature(
    input.transactionSignature,
  );
  if (!operationId || !transactionSignature) {
    return Object.freeze({ status: "invalid-request" });
  }
  const result = await withAuthorizedActor((transaction) =>
    recordMembershipActivationSubmission(transaction, {
      operationId,
      transactionSignature,
    }),
  );
  return result.status === "authorized"
    ? Object.freeze({ status: result.value })
    : accessStatus(result.status);
}

export async function failMembershipActivation(input: {
  operationId: unknown;
  reason: unknown;
}): Promise<MembershipActivationMutationResult> {
  const operationId = normalizeMembershipActivationId(input.operationId);
  if (!operationId || !isMembershipActivationFailureReason(input.reason)) {
    return Object.freeze({ status: "invalid-request" });
  }
  const reason = input.reason;
  const result = await withAuthorizedActor((transaction) =>
    failMembershipActivationRecord(transaction, {
      operationId,
      reason,
    }),
  );
  return result.status === "authorized"
    ? Object.freeze({ status: result.value })
    : accessStatus(result.status);
}

export async function completeVerifiedMembershipActivation(
  payment: VerifiedMembershipPayment,
): Promise<MembershipActivationMutationResult> {
  const operationId = normalizeMembershipActivationId(payment.operationId);
  const walletAddress = normalizeMembershipPaymentAddress(
    payment.walletAddress,
  );
  const destinationAddress = normalizeMembershipPaymentAddress(
    payment.destinationAddress,
  );
  const transactionSignature = normalizeMembershipTransactionSignature(
    payment.transactionSignature,
  );
  const amountBaseUnits = normalizeMembershipPaymentBaseUnits(
    payment.amountBaseUnits,
  );
  const mintAddress = normalizeMembershipPaymentAddress(payment.mintAddress);
  const tokenProgramAddress = normalizeMembershipPaymentAddress(
    payment.tokenProgramAddress,
  );
  const referenceAddress = normalizeMembershipPaymentAddress(
    payment.referenceAddress,
  );
  const confirmedSlot = normalizeMembershipPaymentSlot(payment.confirmedSlot);
  const tokenDecimals = payment.tokenDecimals;
  if (
    payment.verification !== "verified-devnet-eurc-payment" ||
    !operationId ||
    !walletAddress ||
    !destinationAddress ||
    !transactionSignature ||
    !amountBaseUnits ||
    !mintAddress ||
    !tokenProgramAddress ||
    tokenDecimals !== 6 ||
    !referenceAddress ||
    !confirmedSlot
  ) {
    return Object.freeze({ status: "invalid-request" });
  }
  const result = await withAuthorizedActor((transaction) =>
    completeVerifiedMembershipActivationRecord(transaction, {
      operationId,
      walletAddress,
      destinationAddress,
      transactionSignature,
      amountBaseUnits,
      mintAddress,
      tokenProgramAddress,
      tokenDecimals,
      referenceAddress,
      confirmedSlot,
    }),
  );
  if (result.status !== "authorized") return accessStatus(result.status);
  return result.value.membershipPeriodId
    ? Object.freeze({
        status: result.value.result,
        membershipPeriodId: result.value.membershipPeriodId,
      })
    : Object.freeze({ status: result.value.result });
}

export async function membershipStateForCurrentSession() {
  return memberMembershipStateForSession(await verifiedAuthSession());
}

export async function reconcileMembershipActivation(input: {
  operationId: unknown;
}): Promise<MembershipActivationReconciliationResult> {
  const operationId = normalizeMembershipActivationId(input.operationId);
  if (!operationId) return Object.freeze({ status: "invalid-request" });

  const state = await memberMembershipState();
  if (state.status !== "ready") return accessStatus(state.status);
  const operation = state.membership.history.find(
    (candidate) => candidate.id === operationId,
  );
  if (!operation) return Object.freeze({ status: "operation-conflict" });
  if (
    operation.status === "confirmed" &&
    state.membership.activePeriod?.activationOperationId === operationId
  ) {
    return Object.freeze({
      status: "existing",
      membershipPeriodId: state.membership.activePeriod.id,
    });
  }
  if (operation.status === "failed") {
    return Object.freeze({
      status: "failed",
      reason: operation.failureReason ?? "verification-failed",
    });
  }
  if (!operation.payment) {
    return Object.freeze({ status: "state-conflict" });
  }

  const reconciliation = await reconcileMembershipPayment({
    quote: operation.payment,
    transactionSignature: operation.payment.transactionSignature,
  });
  if (reconciliation.status === "configuration-unavailable") {
    return Object.freeze({ status: "configuration-unavailable" });
  }
  if (reconciliation.status === "pending") {
    return Object.freeze({
      status: "pending",
      reason: reconciliation.reason,
    });
  }
  if (reconciliation.status === "rejected") {
    const failed = await failMembershipActivation({
      operationId,
      reason:
        reconciliation.reason === "execution-failed"
          ? "transaction-rejected"
          : "verification-failed",
    });
    return Object.freeze({
      status: failed.status === "failed" ? "failed" : failed.status,
      reason: reconciliation.reason,
    });
  }

  if (!operation.payment.transactionSignature) {
    const submission = await submitMembershipActivation({
      operationId,
      transactionSignature: reconciliation.evidence.signature,
    });
    if (submission.status !== "submitted" && submission.status !== "existing") {
      return Object.freeze({ status: submission.status });
    }
  }
  const completed = await completeVerifiedMembershipActivation({
    verification: "verified-devnet-eurc-payment",
    operationId,
    walletAddress: operation.payment.walletAddress,
    destinationAddress: operation.payment.destinationTokenAddress,
    mintAddress: operation.payment.mintAddress,
    tokenProgramAddress: operation.payment.tokenProgramAddress,
    tokenDecimals: operation.payment.tokenDecimals,
    referenceAddress: operation.payment.referenceAddress,
    transactionSignature: reconciliation.evidence.signature,
    confirmedSlot: reconciliation.evidence.slot,
    amountBaseUnits: operation.payment.amountBaseUnits,
  });
  return Object.freeze(completed);
}
