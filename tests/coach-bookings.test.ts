import assert from "node:assert/strict";
import test from "node:test";
import {
  validateEarlyCancellationMinutes,
  validateVerifiedBookingCreditOperation,
  validateVerifiedCoachCreditProjection,
} from "@/domain/coach-bookings";

const PROGRAM = "GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU";
const COACH = "7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge";
const CLIENT = "3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe";
const CREDITS = "HULis5PpFFL5ajU9k8WzPjtJ8wZKXg4HHbKVvSEhFCfR";
const RESERVATION = "GEUMk7SoYEsAvTgbFxohHTPbDfdX1citFT6Xxr6E4ULr";
const OFFER = "77HtrAoMVcZEafdTQxVqNee7VQ8fdRyMNeyHMHN3UXqU";
const SIGNATURE = "2".repeat(88);

test("coach cancellation policy accepts a bounded minute value", () => {
  assert.equal(validateEarlyCancellationMinutes(0), true);
  assert.equal(validateEarlyCancellationMinutes(1440), true);
  assert.equal(validateEarlyCancellationMinutes(10080), true);
  assert.equal(validateEarlyCancellationMinutes(-1), false);
  assert.equal(validateEarlyCancellationMinutes(10081), false);
  assert.equal(validateEarlyCancellationMinutes(1.5), false);
});

test("credit projection evidence must conserve purchased credits", () => {
  const evidence = Object.freeze({
    programAddress: PROGRAM,
    coachProfileId: "11111111-1111-4111-8111-111111111111",
    coachAuthorityAddress: COACH,
    clientWalletAddress: CLIENT,
    coachClientCreditsAddress: CREDITS,
    availableCredits: BigInt(8),
    reservedCredits: BigInt(2),
    totalPurchased: BigInt(10),
    purchaseCount: BigInt(1),
    nextPurchaseNonce: BigInt(1),
    lastOfferAddress: OFFER,
    lastPurchaseAt: "2026-10-04T10:00:00.000Z",
    transactionSignature: SIGNATURE,
    observedSlot: BigInt(100),
  });
  assert.equal(validateVerifiedCoachCreditProjection(evidence), true);
  assert.equal(
    validateVerifiedCoachCreditProjection({
      ...evidence,
      availableCredits: BigInt(9),
      reservedCredits: BigInt(2),
    }),
    false,
  );
});

test("booking evidence binds the immutable booking and chain snapshot", () => {
  const evidence = Object.freeze({
    operationId: "22222222-2222-4222-8222-222222222222",
    programAddress: PROGRAM,
    coachAuthorityAddress: COACH,
    clientWalletAddress: CLIENT,
    coachClientCreditsAddress: CREDITS,
    creditReservationAddress: RESERVATION,
    bookingId: "33333333-3333-4333-8333-333333333333",
    scheduledStartUnixSeconds: BigInt(1_800_000_000),
    earlyReturnUntilUnixSeconds: BigInt(1_799_913_600),
    reservationStatus: "reserved" as const,
    availableCredits: BigInt(9),
    reservedCredits: BigInt(1),
    totalPurchased: BigInt(10),
    transactionSignature: SIGNATURE,
    observedSlot: BigInt(101),
  });
  assert.equal(validateVerifiedBookingCreditOperation(evidence), true);
  assert.equal(
    validateVerifiedBookingCreditOperation({
      ...evidence,
      earlyReturnUntilUnixSeconds:
        evidence.scheduledStartUnixSeconds + BigInt(1),
    }),
    false,
  );
  assert.equal(
    validateVerifiedBookingCreditOperation({
      ...evidence,
      creditReservationAddress: "not-an-address",
    }),
    false,
  );
});
