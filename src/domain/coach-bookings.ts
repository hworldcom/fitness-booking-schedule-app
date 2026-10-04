export const DEFAULT_EARLY_CANCELLATION_MINUTES = 24 * 60;
export const MAX_EARLY_CANCELLATION_MINUTES = 7 * 24 * 60;
export const BOOKING_HOLD_MINUTES = 10;

export type CoachBookingStatus =
  | "pending"
  | "confirmed"
  | "cancellation-requested"
  | "cancelled"
  | "completed"
  | "denied"
  | "expired";

export type BookingCreditOperationKind = "reserve" | "return" | "consume";
export type BookingCreditOperationStatus =
  "prepared" | "submitted" | "finalized" | "failed" | "expired";
export type BookingCreditReservationStatus =
  "reserved" | "returned" | "consumed";

export type VerifiedCoachCreditProjection = Readonly<{
  programAddress: string;
  coachProfileId: string;
  coachAuthorityAddress: string;
  clientWalletAddress: string;
  coachClientCreditsAddress: string;
  availableCredits: bigint;
  reservedCredits: bigint;
  totalPurchased: bigint;
  purchaseCount: bigint;
  nextPurchaseNonce: bigint;
  lastOfferAddress: string;
  lastPurchaseAt: string;
  transactionSignature: string;
  observedSlot: bigint;
}>;

export type VerifiedBookingCreditOperation = Readonly<{
  operationId: string;
  programAddress: string;
  coachAuthorityAddress: string;
  clientWalletAddress: string;
  coachClientCreditsAddress: string;
  creditReservationAddress: string;
  bookingId: string;
  scheduledStartUnixSeconds: bigint;
  earlyReturnUntilUnixSeconds: bigint;
  reservationStatus: BookingCreditReservationStatus;
  availableCredits: bigint;
  reservedCredits: bigint;
  totalPurchased: bigint;
  transactionSignature: string;
  observedSlot: bigint;
}>;

export type BookingCreditOperationProjection = Readonly<{
  id: string;
  kind: BookingCreditOperationKind;
  status: BookingCreditOperationStatus;
  transactionSignature: string | null;
  failureCode: string | null;
}>;

export type PrivateBookingProjection = Readonly<{
  id: string;
  slotId: string;
  coachProfileId: string;
  clientProfileId: string;
  clientWalletAddress: string;
  coachClientCreditsAddress: string;
  creditReservationAddress: string;
  status: CoachBookingStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  earlyReturnUntil: string;
  holdExpiresAt: string;
  cancellationRequestedAt: string | null;
  cancellationDecision: "approved" | "denied" | null;
  cancellationDecidedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  operations: readonly BookingCreditOperationProjection[];
}>;

export type CoachClientCardProjection = Readonly<{
  creditProjectionId: string;
  clientProfileId: string;
  clientDisplayName: string;
  clientWalletAddress: string;
  coachClientCreditsAddress: string;
  availableCredits: bigint;
  reservedCredits: bigint;
  totalPurchased: bigint;
  observedSlot: bigint;
  bookings: readonly PrivateBookingProjection[];
}>;

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,100}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_PROJECTED_CREDITS = BigInt("9000000000000000");

export function isCanonicalUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function isSolanaAddress(value: string) {
  return SOLANA_ADDRESS_PATTERN.test(value);
}

export function isSolanaSignature(value: string) {
  return SOLANA_SIGNATURE_PATTERN.test(value);
}

export function isProjectedCreditQuantity(value: bigint) {
  return value >= BigInt(0) && value <= MAX_PROJECTED_CREDITS;
}

export function validateEarlyCancellationMinutes(value: number) {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_EARLY_CANCELLATION_MINUTES
  );
}

export function validateVerifiedCoachCreditProjection(
  evidence: VerifiedCoachCreditProjection,
) {
  const lastPurchaseAt = new Date(evidence.lastPurchaseAt);
  return (
    isCanonicalUuid(evidence.coachProfileId) &&
    isSolanaAddress(evidence.programAddress) &&
    isSolanaAddress(evidence.coachAuthorityAddress) &&
    isSolanaAddress(evidence.clientWalletAddress) &&
    isSolanaAddress(evidence.coachClientCreditsAddress) &&
    isSolanaAddress(evidence.lastOfferAddress) &&
    isSolanaSignature(evidence.transactionSignature) &&
    isProjectedCreditQuantity(evidence.availableCredits) &&
    isProjectedCreditQuantity(evidence.reservedCredits) &&
    isProjectedCreditQuantity(evidence.totalPurchased) &&
    evidence.availableCredits + evidence.reservedCredits <=
      evidence.totalPurchased &&
    evidence.purchaseCount >= BigInt(1) &&
    evidence.nextPurchaseNonce >= BigInt(1) &&
    evidence.observedSlot >= BigInt(0) &&
    Number.isFinite(lastPurchaseAt.getTime())
  );
}

export function validateVerifiedBookingCreditOperation(
  evidence: VerifiedBookingCreditOperation,
) {
  return (
    isCanonicalUuid(evidence.operationId) &&
    isCanonicalUuid(evidence.bookingId) &&
    isSolanaAddress(evidence.programAddress) &&
    isSolanaAddress(evidence.coachAuthorityAddress) &&
    isSolanaAddress(evidence.clientWalletAddress) &&
    isSolanaAddress(evidence.coachClientCreditsAddress) &&
    isSolanaAddress(evidence.creditReservationAddress) &&
    isSolanaSignature(evidence.transactionSignature) &&
    evidence.scheduledStartUnixSeconds > BigInt(0) &&
    evidence.earlyReturnUntilUnixSeconds <=
      evidence.scheduledStartUnixSeconds &&
    isProjectedCreditQuantity(evidence.availableCredits) &&
    isProjectedCreditQuantity(evidence.reservedCredits) &&
    isProjectedCreditQuantity(evidence.totalPurchased) &&
    evidence.availableCredits + evidence.reservedCredits <=
      evidence.totalPurchased &&
    evidence.observedSlot >= BigInt(0)
  );
}
