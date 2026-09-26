import { membershipPlanIds, type MembershipPlanId } from "./catalogue";
import { REQUIRED_CORE_GYMS } from "./membership-draft";
export const MEMBERSHIP_PAYMENT_CLUSTER = "solana:devnet" as const;

export type MembershipPaymentQuote = Readonly<{
  cluster: typeof MEMBERSHIP_PAYMENT_CLUSTER;
  currency: "EURC";
  amountBaseUnits: string;
  walletAddress: string;
  destinationOwnerAddress: string;
  destinationTokenAddress: string;
  mintAddress: string;
  tokenProgramAddress: string;
  tokenDecimals: number;
  referenceAddress: string;
  memo: string;
}>;

export type MembershipActivationOperationStatus =
  "pending" | "submitted" | "confirmed" | "failed";

export type MembershipActivationFailureReason =
  | "wallet-cancelled"
  | "transaction-rejected"
  | "verification-failed"
  | "superseded";

export type MembershipPeriodStatus = "active" | "expired";

export type MembershipGymSnapshot = Readonly<{
  id: string;
  name: string;
}>;

export type MembershipActivationSnapshot = Readonly<{
  id: string;
  status: MembershipActivationOperationStatus;
  failureReason: MembershipActivationFailureReason | null;
  plan: Readonly<{
    id: MembershipPlanId;
    version: string;
    name: string;
    price: Readonly<{ baseUnits: string; currency: "EURC" }>;
    access:
      | Readonly<{ model: "limited"; includedCheckins: number }>
      | Readonly<{ model: "daily-uncapped" }>;
    maxIncludedCheckinsPerDay: number;
    nonCoreVisitPriceBaseUnits: string;
  }>;
  gyms: readonly MembershipGymSnapshot[];
  payment:
    | (MembershipPaymentQuote &
        Readonly<{
          transactionSignature: string | null;
          submittedAt: string | null;
          confirmedAt: string | null;
          confirmedSlot: string | null;
        }>)
    | null;
  failedAt: string | null;
  createdAt: string;
}>;

export type ConfirmedMembershipPayment = NonNullable<
  MembershipActivationSnapshot["payment"]
> &
  Readonly<{
    transactionSignature: string;
    submittedAt: string;
    confirmedAt: string;
    confirmedSlot: string;
  }>;

export type MembershipPeriodSnapshot = Readonly<{
  id: string;
  activationOperationId: string;
  status: MembershipPeriodStatus;
  paymentStatus: "confirmed";
  plan: MembershipActivationSnapshot["plan"];
  gyms: readonly MembershipGymSnapshot[];
  startsAt: string;
  endsAt: string;
  includedCheckinsUsed: number;
  lastIncludedServiceDate: string | null;
  payment: ConfirmedMembershipPayment;
}>;

export type MemberMembershipState = Readonly<{
  pending: MembershipActivationSnapshot | null;
  activePeriod: MembershipPeriodSnapshot | null;
  history: readonly MembershipActivationSnapshot[];
}>;

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;
const maximumU64 = BigInt("18446744073709551615");

function isPlanId(value: unknown): value is MembershipPlanId {
  return membershipPlanIds.includes(value as MembershipPlanId);
}

export function normalizeMembershipActivationId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return uuidV4Pattern.test(normalized) ? normalized : null;
}

export function normalizeMembershipActivationSelection(input: {
  planId: unknown;
  gymIds: unknown;
}): Readonly<{
  planId: MembershipPlanId;
  gymIds: readonly string[];
}> | null {
  if (!isPlanId(input.planId) || !Array.isArray(input.gymIds)) return null;
  if (
    input.gymIds.length !== REQUIRED_CORE_GYMS ||
    !input.gymIds.every(
      (gymId): gymId is string =>
        typeof gymId === "string" &&
        gymId.length <= 80 &&
        slugPattern.test(gymId),
    ) ||
    new Set(input.gymIds).size !== REQUIRED_CORE_GYMS
  ) {
    return null;
  }
  return Object.freeze({
    planId: input.planId,
    gymIds: Object.freeze([...input.gymIds]),
  });
}

export function normalizeMembershipPaymentAddress(value: unknown) {
  return typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 44 &&
    base58Pattern.test(value)
    ? value
    : null;
}

export function normalizeMembershipTransactionSignature(value: unknown) {
  return typeof value === "string" &&
    value.length >= 64 &&
    value.length <= 88 &&
    base58Pattern.test(value)
    ? value
    : null;
}

export function normalizeMembershipPaymentBaseUnits(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
  try {
    const amount = BigInt(value);
    return amount <= maximumU64 ? amount.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeMembershipPaymentSlot(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
  try {
    const slot = BigInt(value);
    return slot <= maximumU64 ? slot.toString() : null;
  } catch {
    return null;
  }
}

export function isMembershipActivationFailureReason(
  value: unknown,
): value is MembershipActivationFailureReason {
  return (
    value === "wallet-cancelled" ||
    value === "transaction-rejected" ||
    value === "verification-failed" ||
    value === "superseded"
  );
}
