import "server-only";

import type { AuthSessionSnapshot } from "@/auth/contracts";
import {
  isMembershipActivationFailureReason,
  MEMBERSHIP_PAYMENT_CLUSTER,
  normalizeMembershipActivationId,
  normalizeMembershipActivationSelection,
  normalizeMembershipPaymentAddress,
  normalizeMembershipPaymentBaseUnits,
  normalizeMembershipTransactionSignature,
  type MemberMembershipState,
  type MembershipActivationSnapshot,
  type MembershipPeriodSnapshot,
} from "@/domain/membership-activation";
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
    | MembershipAccessStatus;
  membershipPeriodId?: string;
}>;

export type VerifiedMembershipPayment = Readonly<{
  verification: "verified-devnet-eurc-payment";
  operationId: unknown;
  walletAddress: unknown;
  destinationAddress: unknown;
  transactionSignature: unknown;
  amountBaseUnits: unknown;
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
    !record.transactionSignature ||
    !record.submittedAt
  ) {
    return null;
  }
  return Object.freeze({
    cluster: MEMBERSHIP_PAYMENT_CLUSTER,
    walletAddress: record.paymentWalletAddress,
    destinationAddress: record.paymentDestinationAddress,
    transactionSignature: record.transactionSignature,
    submittedAt: isoTimestamp(record.submittedAt),
    confirmedAt: record.confirmedAt ? isoTimestamp(record.confirmedAt) : null,
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
    !payment.confirmedAt
  ) {
    return null;
  }
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
    payment,
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
  const result = await withAuthorizedActor((transaction) =>
    prepareMembershipActivationRecord(transaction, {
      operationId,
      planId: selection.planId,
      gymIds: selection.gymIds,
    }),
  );
  return result.status === "authorized"
    ? Object.freeze({ status: result.value })
    : accessStatus(result.status);
}

export async function submitMembershipActivation(input: {
  operationId: unknown;
  walletAddress: unknown;
  destinationAddress: unknown;
  transactionSignature: unknown;
}): Promise<MembershipActivationMutationResult> {
  const operationId = normalizeMembershipActivationId(input.operationId);
  const walletAddress = normalizeMembershipPaymentAddress(input.walletAddress);
  const destinationAddress = normalizeMembershipPaymentAddress(
    input.destinationAddress,
  );
  const transactionSignature = normalizeMembershipTransactionSignature(
    input.transactionSignature,
  );
  if (
    !operationId ||
    !walletAddress ||
    !destinationAddress ||
    !transactionSignature
  ) {
    return Object.freeze({ status: "invalid-request" });
  }
  const result = await withAuthorizedActor((transaction) =>
    recordMembershipActivationSubmission(transaction, {
      operationId,
      walletAddress,
      destinationAddress,
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
  if (
    payment.verification !== "verified-devnet-eurc-payment" ||
    !operationId ||
    !walletAddress ||
    !destinationAddress ||
    !transactionSignature ||
    !amountBaseUnits
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
