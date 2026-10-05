import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSigner, none } from "@solana/kit";
import type { CoachClientCredits } from "../../clients/js/src/generated/accounts/coachClientCredits";
import type { CreditReservation } from "../../clients/js/src/generated/accounts/creditReservation";
import { CreditReservationStatus } from "../../clients/js/src/generated/types/creditReservationStatus";
import {
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  uuidToSeed,
} from "../../src/solana/coach-pass";
import type { CoachPassOperationRecord } from "../../src/server/db/solana/coach-pass-repository";
import type {
  CoachPassBookingChainState,
  CoachPassPurchaseChainState,
} from "../../src/server/solana/coach-pass-rpc";
import {
  verifiedCoachPassBookingEvidence,
  verifiedCoachPassPurchaseProjection,
} from "../../src/server/solana/coach-pass-service";

const COACH_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";
const BOOKING_ID = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const SIGNATURE = "6".repeat(88);

async function recoveryFixture() {
  const [coachAuthority, client, creditsAddress, offer, reservationAddress] =
    await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
    ]);
  const credits: CoachClientCredits = {
    discriminator: new Uint8Array(8),
    version: 1,
    coachAuthority: coachAuthority.address,
    clientWallet: client.address,
    availableCredits: BigInt(4),
    reservedCredits: BigInt(0),
    totalPurchased: BigInt(4),
    purchaseCount: BigInt(2),
    nextPurchaseNonce: BigInt(2),
    lastOffer: offer.address,
    lastPurchaseAt: BigInt(1_900_000_000),
    bump: 1,
    reserved: Array(46).fill(0),
  };
  const common = {
    operationId: OPERATION_ID,
    status: "submitted" as const,
    clientProfileId: CLIENT_ID,
    coachProfileId: COACH_ID,
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    authorityAddress: client.address,
    coachAuthorityAddress: coachAuthority.address,
    clientWalletAddress: client.address,
    coachClientCreditsAddress: creditsAddress.address,
    prepared: null,
    simulation: null,
    transactionSignature: SIGNATURE,
    failureCode: null,
    finalizedSlot: null,
  };
  const purchaseOperation: CoachPassOperationRecord = Object.freeze({
    ...common,
    recordType: "purchase",
    operation: "purchase-offer",
    purchase: Object.freeze({
      offerAddress: offer.address,
      priceEurcBaseUnits: BigInt(8_000_000),
      creditsPurchased: 1,
      expectedPurchaseNonce: BigInt(1),
      baselineLedgerExists: true,
      baselineAvailableCredits: BigInt(3),
      baselineReservedCredits: BigInt(0),
      baselineTotalPurchased: BigInt(3),
      baselinePurchaseCount: BigInt(1),
    }),
    booking: null,
  });
  const bookingOperation: CoachPassOperationRecord = Object.freeze({
    ...common,
    recordType: "booking",
    operation: "reserve-booking-credit",
    purchase: null,
    booking: Object.freeze({
      bookingId: BOOKING_ID,
      kind: "reserve",
      creditReservationAddress: reservationAddress.address,
      scheduledStartAt: new Date(1_900_010_000_000).toISOString(),
      earlyReturnUntil: new Date(1_900_005_000_000).toISOString(),
    }),
  });
  const reservation: CreditReservation = {
    discriminator: new Uint8Array(8),
    version: 1,
    coachClientCredits: creditsAddress.address,
    coachAuthority: coachAuthority.address,
    clientWallet: client.address,
    bookingId: [...uuidToSeed(BOOKING_ID)],
    scheduledStartAt: BigInt(1_900_010_000),
    earlyReturnUntil: BigInt(1_900_005_000),
    status: CreditReservationStatus.Reserved,
    reservedAt: BigInt(1_900_000_000),
    resolvedAt: none(),
    bump: 1,
    reserved: Array(44).fill(0),
  };
  return {
    credits,
    purchaseOperation,
    bookingOperation,
    reservation,
  };
}

test("purchase recovery accepts only the exact monotonic post-purchase ledger", async () => {
  const fixture = await recoveryFixture();
  const state = {
    slot: BigInt(500),
    coachClientCredits: fixture.credits,
  } as unknown as CoachPassPurchaseChainState;
  const projection = verifiedCoachPassPurchaseProjection({
    operation: fixture.purchaseOperation,
    state,
    signature: SIGNATURE,
  });
  assert.ok(projection);
  assert.equal(projection.availableCredits, BigInt(4));
  assert.equal(projection.nextPurchaseNonce, BigInt(2));
  assert.equal(projection.observedSlot, BigInt(500));

  assert.equal(
    verifiedCoachPassPurchaseProjection({
      operation: fixture.purchaseOperation,
      state: {
        ...state,
        coachClientCredits: {
          ...fixture.credits,
          nextPurchaseNonce: BigInt(3),
        },
      },
      signature: SIGNATURE,
    }),
    null,
  );
  assert.equal(
    verifiedCoachPassPurchaseProjection({
      operation: fixture.purchaseOperation,
      state: { ...state, coachClientCredits: null },
      signature: SIGNATURE,
    }),
    null,
  );
});

test("booking recovery binds the receipt identity, schedule and terminal state", async () => {
  const fixture = await recoveryFixture();
  const state = {
    slot: BigInt(600),
    coachClientCredits: {
      ...fixture.credits,
      availableCredits: BigInt(3),
      reservedCredits: BigInt(1),
    },
    creditReservation: fixture.reservation,
  } as unknown as CoachPassBookingChainState;
  const evidence = verifiedCoachPassBookingEvidence({
    operation: fixture.bookingOperation,
    state,
    signature: SIGNATURE,
  });
  assert.ok(evidence);
  assert.equal(evidence.reservationStatus, "reserved");
  assert.equal(evidence.availableCredits, BigInt(3));
  assert.equal(evidence.reservedCredits, BigInt(1));

  assert.equal(
    verifiedCoachPassBookingEvidence({
      operation: fixture.bookingOperation,
      state: {
        ...state,
        creditReservation: {
          ...fixture.reservation,
          status: CreditReservationStatus.Consumed,
        },
      },
      signature: SIGNATURE,
    }),
    null,
  );
  assert.equal(
    verifiedCoachPassBookingEvidence({
      operation: fixture.bookingOperation,
      state: { ...state, creditReservation: null },
      signature: SIGNATURE,
    }),
    null,
  );
});
