import {
  normalizeMembershipActivationId,
  normalizeMembershipTransactionSignature,
} from "@/domain/membership-activation";

export const membershipPaymentRecoveryKey =
  "movx-club:membership-payment-recovery:v1";

export type MembershipPaymentRecovery = Readonly<{
  operationId: string;
  transactionSignature: string;
}>;

export function parseMembershipPaymentRecovery(
  value: string | null,
): MembershipPaymentRecovery | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (
      Object.keys(record).length !== 2 ||
      !normalizeMembershipActivationId(record.operationId) ||
      !normalizeMembershipTransactionSignature(record.transactionSignature)
    ) {
      return null;
    }
    return Object.freeze({
      operationId: normalizeMembershipActivationId(record.operationId)!,
      transactionSignature: normalizeMembershipTransactionSignature(
        record.transactionSignature,
      )!,
    });
  } catch {
    return null;
  }
}

export function readMembershipPaymentRecovery(storage: Storage) {
  try {
    return parseMembershipPaymentRecovery(
      storage.getItem(membershipPaymentRecoveryKey),
    );
  } catch {
    return null;
  }
}

export function writeMembershipPaymentRecovery(
  storage: Storage,
  recovery: MembershipPaymentRecovery | null,
) {
  try {
    if (recovery) {
      storage.setItem(membershipPaymentRecoveryKey, JSON.stringify(recovery));
    } else {
      storage.removeItem(membershipPaymentRecoveryKey);
    }
    return true;
  } catch {
    return false;
  }
}
