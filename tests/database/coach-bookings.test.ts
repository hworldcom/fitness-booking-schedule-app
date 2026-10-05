import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { address } from "@solana/kit";
import postgres from "postgres";
import {
  localDateTimeValue,
  type CoachAvailabilityInput,
  type CoachProfileInput,
} from "@/domain/coaches";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { activateOwnedCoachingRecord } from "@/server/db/coaches/activation-repository";
import { createOwnedCoachAvailabilityRecord } from "@/server/db/coaches/availability-repository";
import {
  CoachBookingConflictError,
  currentClientPrivateBookingRecords,
  currentCoachClientCardRecords,
  decideOwnedLateBookingCancellationRecord,
  finalizeVerifiedBookingCreditOperationRecord,
  markBookingCreditOperationSubmittedRecord,
  prepareCreditBackedPrivateBookingRecord,
  prepareOwnedPrivateBookingConsumptionRecord,
  recordVerifiedCoachCreditProjectionRecord,
  releaseOwnedPrivateBookingHoldRecord,
  requestOwnedPrivateBookingCancellationRecord,
  updateOwnedCoachCancellationPolicyRecord,
} from "@/server/db/coaches/booking-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  CoachPassOperationConflictError,
  coachPassOperationRecord,
  failCoachPassOperationRecord,
  finalizeCoachPassPurchaseRecord,
  markCoachPassOperationSubmittedRecord,
  saveCoachPassBookingPreparationRecord,
  saveCoachPassPurchasePreparationRecord,
} from "@/server/db/solana/coach-pass-repository";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveCoachClientCreditsAddress,
  deriveOfferAddress,
} from "@/solana/coach-pass";

const adminConnectionString = process.env.DATABASE_TEST_URL;
if (!adminConnectionString) {
  throw new Error(
    "DATABASE_TEST_URL is required for database integration tests.",
  );
}

const runtimeUrl = new URL(adminConnectionString);
runtimeUrl.username = "repx_runtime_login";
runtimeUrl.password = "postgres";
process.env.DATABASE_URL = runtimeUrl.toString();

const coachAuthUserId = "98000000-0000-4000-8000-000000000001";
const firstClientAuthUserId = "98000000-0000-4000-8000-000000000002";
const secondClientAuthUserId = "98000000-0000-4000-8000-000000000003";
const fixtureGymId = "40000000-0000-4000-8000-000000000001";
const coachWallet = address("7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge");
const firstClientWallet = address(
  "3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe",
);
const secondClientWallet = address(
  "HULis5PpFFL5ajU9k8WzPjtJ8wZKXg4HHbKVvSEhFCfR",
);

const admin = postgres(adminConnectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});

let coachActor: AuthorizedActor;
let firstClientActor: AuthorizedActor;
let secondClientActor: AuthorizedActor;
let coachAuthorityAddress: string;
let firstCreditsAddress: string;
let secondCreditsAddress: string;
let offerAddress: string;
let firstProjectionId: string;
let secondProjectionId: string;

const coachProfile: CoachProfileInput = Object.freeze({
  displayName: "Booking Coach",
  bio: "Private boxing sessions with careful technical progress, clear pacing and practical feedback for every client.",
  disciplines: Object.freeze(["Boxing"] as const),
  timezone: "Europe/Berlin",
  visibility: "visible",
  selectedGymId: fixtureGymId,
  independentLocation: null,
});

function actorFromRecord(
  authUserId: string,
  record: NonNullable<Awaited<ReturnType<typeof enrollApplicationProfile>>>,
): AuthorizedActor {
  assert.equal(record.role, "member");
  return Object.freeze({
    authUserId,
    profileId: record.profileId,
    runId: record.runId,
    runRole: "member",
  });
}

function signature(character: string) {
  return character.repeat(88);
}

function futureLocalStart(hoursFromNow: number) {
  const target = Date.now() + hoursFromNow * 60 * 60 * 1000;
  const rounded = Math.ceil(target / (15 * 60 * 1000)) * 15 * 60 * 1000;
  return localDateTimeValue(new Date(rounded), "Europe/Berlin");
}

function availabilityInput(hoursFromNow: number): CoachAvailabilityInput {
  return Object.freeze({
    localStart: futureLocalStart(hoursFromNow),
    durationMinutes: 60,
    refreshLocation: false,
  });
}

function unixSeconds(value: string) {
  return BigInt(Math.floor(new Date(value).getTime() / 1000));
}

async function currentBooking(
  actor: AuthorizedActor,
  bookingId: string,
): Promise<PrivateBookingProjection> {
  const bookings = await withActorDatabaseContext(actor, (transaction) =>
    currentClientPrivateBookingRecords(transaction, actor),
  );
  const booking = bookings.find((candidate) => candidate.id === bookingId);
  assert.ok(booking);
  return booking;
}

function bookingEvidence(input: {
  booking: PrivateBookingProjection;
  operationId: string;
  reservationStatus: "reserved" | "returned" | "consumed";
  availableCredits: number;
  reservedCredits: number;
  signatureCharacter: string;
  observedSlot: number;
}) {
  return Object.freeze({
    operationId: input.operationId,
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthorityAddress,
    clientWalletAddress: input.booking.clientWalletAddress,
    coachClientCreditsAddress: input.booking.coachClientCreditsAddress,
    creditReservationAddress: input.booking.creditReservationAddress,
    bookingId: input.booking.id,
    scheduledStartUnixSeconds: unixSeconds(input.booking.scheduledStartAt),
    earlyReturnUntilUnixSeconds: unixSeconds(input.booking.earlyReturnUntil),
    reservationStatus: input.reservationStatus,
    availableCredits: BigInt(input.availableCredits),
    reservedCredits: BigInt(input.reservedCredits),
    totalPurchased: BigInt(4),
    transactionSignature: signature(input.signatureCharacter),
    observedSlot: BigInt(input.observedSlot),
  });
}

async function removeFixtures() {
  const authIds = [
    coachAuthUserId,
    firstClientAuthUserId,
    secondClientAuthUserId,
  ];
  await admin`
    delete from app.coach_pass_purchase_operations
    where run_id in (
      select participant.run_id
      from app.demo_run_participants as participant
      join app.profiles as profile on profile.id = participant.profile_id
      where profile.auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_booking_credit_operations
    where run_id in (
      select participant.run_id
      from app.demo_run_participants as participant
      join app.profiles as profile on profile.id = participant.profile_id
      where profile.auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_private_bookings
    where client_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    ) or coach_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_client_credit_projections
    where client_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    ) or coach_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_availability_slots
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_availability_rules
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_profile_disciplines
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_profiles
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.wallet_bindings
    where bound_by_auth_user_id in ${admin(authIds)}
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`delete from app.profiles where auth_user_id in ${admin(authIds)}`;
  await admin`delete from auth.users where id in ${admin(authIds)}`;
}

before(async () => {
  await removeFixtures();
  await admin`
    insert into auth.users (id, is_sso_user, is_anonymous)
    values
      (${coachAuthUserId}::uuid, false, false),
      (${firstClientAuthUserId}::uuid, false, false),
      (${secondClientAuthUserId}::uuid, false, false)
  `;
  const coach = await enrollApplicationProfile(
    coachAuthUserId,
    "Booking Coach",
  );
  const firstClient = await enrollApplicationProfile(
    firstClientAuthUserId,
    "Booking Client One",
  );
  const secondClient = await enrollApplicationProfile(
    secondClientAuthUserId,
    "Booking Client Two",
  );
  assert.ok(coach);
  assert.ok(firstClient);
  assert.ok(secondClient);
  coachActor = actorFromRecord(coachAuthUserId, coach);
  firstClientActor = actorFromRecord(firstClientAuthUserId, firstClient);
  secondClientActor = actorFromRecord(secondClientAuthUserId, secondClient);

  await admin`
    insert into app.wallet_bindings (
      run_id,
      cluster,
      wallet_address,
      profile_id,
      bound_by_auth_user_id,
      provenance,
      status
    ) values
      (
        ${coachActor.runId}::uuid,
        'solana:devnet',
        ${coachWallet},
        ${coachActor.profileId}::uuid,
        ${coachActor.authUserId}::uuid,
        'prepared',
        'active'
      ),
      (
        ${firstClientActor.runId}::uuid,
        'solana:devnet',
        ${firstClientWallet},
        ${firstClientActor.profileId}::uuid,
        ${firstClientActor.authUserId}::uuid,
        'prepared',
        'active'
      ),
      (
        ${secondClientActor.runId}::uuid,
        'solana:devnet',
        ${secondClientWallet},
        ${secondClientActor.profileId}::uuid,
        ${secondClientActor.authUserId}::uuid,
        'prepared',
        'active'
      )
  `;

  await withActorDatabaseContext(coachActor, activateOwnedCoachingRecord);
  await withActorDatabaseContext(coachActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, coachProfile),
  );

  [coachAuthorityAddress] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    runId: coachActor.runId,
    profileId: coachActor.profileId,
    originalWallet: coachWallet,
  });
  [firstCreditsAddress] = await deriveCoachClientCreditsAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: address(coachAuthorityAddress),
    clientWallet: firstClientWallet,
  });
  [secondCreditsAddress] = await deriveCoachClientCreditsAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: address(coachAuthorityAddress),
    clientWallet: secondClientWallet,
  });
  [offerAddress] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: address(coachAuthorityAddress),
    nonce: BigInt(1),
  });

  firstProjectionId = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      recordVerifiedCoachCreditProjectionRecord(transaction, {
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        coachProfileId: coachActor.profileId,
        coachAuthorityAddress,
        clientWalletAddress: firstClientWallet,
        coachClientCreditsAddress: firstCreditsAddress,
        availableCredits: BigInt(4),
        reservedCredits: BigInt(0),
        totalPurchased: BigInt(4),
        purchaseCount: BigInt(1),
        nextPurchaseNonce: BigInt(1),
        lastOfferAddress: offerAddress,
        lastPurchaseAt: new Date().toISOString(),
        transactionSignature: signature("2"),
        observedSlot: BigInt(100),
      }),
  );
  secondProjectionId = await withActorDatabaseContext(
    secondClientActor,
    (transaction) =>
      recordVerifiedCoachCreditProjectionRecord(transaction, {
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        coachProfileId: coachActor.profileId,
        coachAuthorityAddress,
        clientWalletAddress: secondClientWallet,
        coachClientCreditsAddress: secondCreditsAddress,
        availableCredits: BigInt(1),
        reservedCredits: BigInt(0),
        totalPurchased: BigInt(1),
        purchaseCount: BigInt(1),
        nextPurchaseNonce: BigInt(1),
        lastOfferAddress: offerAddress,
        lastPurchaseAt: new Date().toISOString(),
        transactionSignature: signature("3"),
        observedSlot: BigInt(200),
      }),
  );
});

after(async () => {
  await removeFixtures();
  await admin.end();
});

test("credit-backed booking lifecycle is idempotent, authorized and policy-bound", async () => {
  assert.equal(
    await withActorDatabaseContext(coachActor, (transaction) =>
      updateOwnedCoachCancellationPolicyRecord(transaction, 1440),
    ),
    1440,
  );
  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      updateOwnedCoachCancellationPolicyRecord(transaction, 10081),
    ),
    CoachBookingConflictError,
  );

  const earlySlotId = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      createOwnedCoachAvailabilityRecord(transaction, availabilityInput(50)),
  );
  const earlyPrepared = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      prepareCreditBackedPrivateBookingRecord(transaction, {
        slotId: earlySlotId,
        creditProjectionId: firstProjectionId,
      }),
  );
  const earlyRetry = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      prepareCreditBackedPrivateBookingRecord(transaction, {
        slotId: earlySlotId,
        creditProjectionId: firstProjectionId,
      }),
  );
  assert.deepEqual(earlyRetry, earlyPrepared);

  const earlyPending = await currentBooking(
    firstClientActor,
    earlyPrepared.bookingId,
  );
  assert.equal(earlyPending.status, "pending");
  assert.equal(
    new Date(earlyPending.scheduledStartAt).getTime() -
      new Date(earlyPending.earlyReturnUntil).getTime(),
    24 * 60 * 60 * 1000,
  );
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    markBookingCreditOperationSubmittedRecord(
      transaction,
      earlyPrepared.operationId,
      signature("4"),
    ),
  );
  const earlyReserveEvidence = bookingEvidence({
    booking: earlyPending,
    operationId: earlyPrepared.operationId,
    reservationStatus: "reserved",
    availableCredits: 3,
    reservedCredits: 1,
    signatureCharacter: "4",
    observedSlot: 101,
  });
  await assert.rejects(
    withActorDatabaseContext(secondClientActor, (transaction) =>
      finalizeVerifiedBookingCreditOperationRecord(
        transaction,
        earlyReserveEvidence,
      ),
    ),
    CoachBookingConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      finalizeVerifiedBookingCreditOperationRecord(transaction, {
        ...earlyReserveEvidence,
        bookingId: "99999999-9999-4999-8999-999999999999",
      }),
    ),
    CoachBookingConflictError,
  );
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    finalizeVerifiedBookingCreditOperationRecord(
      transaction,
      earlyReserveEvidence,
    ),
  );
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    finalizeVerifiedBookingCreditOperationRecord(
      transaction,
      earlyReserveEvidence,
    ),
  );
  assert.equal(
    (await currentBooking(firstClientActor, earlyPrepared.bookingId)).status,
    "confirmed",
  );

  const earlyCancellation = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      requestOwnedPrivateBookingCancellationRecord(
        transaction,
        earlyPrepared.bookingId,
      ),
  );
  assert.equal(earlyCancellation.outcome, "return-prepared");
  assert.ok(earlyCancellation.operationId);
  const earlyCancellationRetry = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      requestOwnedPrivateBookingCancellationRecord(
        transaction,
        earlyPrepared.bookingId,
      ),
  );
  assert.deepEqual(earlyCancellationRetry, earlyCancellation);
  const confirmedEarly = await currentBooking(
    firstClientActor,
    earlyPrepared.bookingId,
  );
  const earlyReturnEvidence = bookingEvidence({
    booking: confirmedEarly,
    operationId: earlyCancellation.operationId,
    reservationStatus: "returned",
    availableCredits: 4,
    reservedCredits: 0,
    signatureCharacter: "5",
    observedSlot: 102,
  });
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    finalizeVerifiedBookingCreditOperationRecord(
      transaction,
      earlyReturnEvidence,
    ),
  );
  assert.equal(
    (await currentBooking(firstClientActor, earlyPrepared.bookingId)).status,
    "cancelled",
  );

  const lateApprovalSlotId = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      createOwnedCoachAvailabilityRecord(transaction, availabilityInput(2)),
  );
  const lateApprovalPrepared = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      prepareCreditBackedPrivateBookingRecord(transaction, {
        slotId: lateApprovalSlotId,
        creditProjectionId: firstProjectionId,
      }),
  );
  const lateApprovalPending = await currentBooking(
    firstClientActor,
    lateApprovalPrepared.bookingId,
  );
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    finalizeVerifiedBookingCreditOperationRecord(
      transaction,
      bookingEvidence({
        booking: lateApprovalPending,
        operationId: lateApprovalPrepared.operationId,
        reservationStatus: "reserved",
        availableCredits: 3,
        reservedCredits: 1,
        signatureCharacter: "6",
        observedSlot: 103,
      }),
    ),
  );
  const lateRequest = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      requestOwnedPrivateBookingCancellationRecord(
        transaction,
        lateApprovalPrepared.bookingId,
      ),
  );
  assert.equal(lateRequest.outcome, "coach-decision-required");
  await assert.rejects(
    withActorDatabaseContext(secondClientActor, (transaction) =>
      decideOwnedLateBookingCancellationRecord(
        transaction,
        lateApprovalPrepared.bookingId,
        "approved",
      ),
    ),
    CoachBookingConflictError,
  );
  const approval = await withActorDatabaseContext(coachActor, (transaction) =>
    decideOwnedLateBookingCancellationRecord(
      transaction,
      lateApprovalPrepared.bookingId,
      "approved",
    ),
  );
  assert.equal(approval.outcome, "return-prepared");
  assert.ok(approval.operationId);
  const approvalOperationId = approval.operationId;
  const approvalBooking = await currentBooking(
    firstClientActor,
    lateApprovalPrepared.bookingId,
  );
  await withActorDatabaseContext(coachActor, (transaction) =>
    finalizeVerifiedBookingCreditOperationRecord(
      transaction,
      bookingEvidence({
        booking: approvalBooking,
        operationId: approvalOperationId,
        reservationStatus: "returned",
        availableCredits: 4,
        reservedCredits: 0,
        signatureCharacter: "7",
        observedSlot: 104,
      }),
    ),
  );
  assert.equal(
    (await currentBooking(firstClientActor, lateApprovalPrepared.bookingId))
      .status,
    "cancelled",
  );

  const lateDenialSlotId = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      createOwnedCoachAvailabilityRecord(transaction, availabilityInput(6)),
  );
  const lateDenialPrepared = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      prepareCreditBackedPrivateBookingRecord(transaction, {
        slotId: lateDenialSlotId,
        creditProjectionId: firstProjectionId,
      }),
  );
  const lateDenialPending = await currentBooking(
    firstClientActor,
    lateDenialPrepared.bookingId,
  );
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    finalizeVerifiedBookingCreditOperationRecord(
      transaction,
      bookingEvidence({
        booking: lateDenialPending,
        operationId: lateDenialPrepared.operationId,
        reservationStatus: "reserved",
        availableCredits: 3,
        reservedCredits: 1,
        signatureCharacter: "8",
        observedSlot: 105,
      }),
    ),
  );
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    requestOwnedPrivateBookingCancellationRecord(
      transaction,
      lateDenialPrepared.bookingId,
    ),
  );
  const denial = await withActorDatabaseContext(coachActor, (transaction) =>
    decideOwnedLateBookingCancellationRecord(
      transaction,
      lateDenialPrepared.bookingId,
      "denied",
    ),
  );
  assert.equal(denial.outcome, "denied");
  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      decideOwnedLateBookingCancellationRecord(
        transaction,
        lateDenialPrepared.bookingId,
        "approved",
      ),
    ),
    CoachBookingConflictError,
  );
  assert.equal(
    (await currentBooking(firstClientActor, lateDenialPrepared.bookingId))
      .status,
    "denied",
  );

  const historicalStart = new Date(
    Math.floor((Date.now() - 2 * 60 * 60 * 1000) / (15 * 60 * 1000)) *
      15 *
      60 *
      1000,
  );
  const historicalEnd = new Date(historicalStart.getTime() + 60 * 60 * 1000);
  const historicalCutoff = new Date(
    historicalStart.getTime() - 24 * 60 * 60 * 1000,
  );
  await admin.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.coach_booking_management', 'on', true),
        set_config('app.coach_availability_management', 'on', true)
    `;
    await transaction`
      update app.coach_availability_slots
      set starts_at = ${historicalStart}, ends_at = ${historicalEnd}
      where id = ${lateDenialSlotId}::uuid
    `;
    await transaction`
      update app.coach_private_bookings
      set
        scheduled_start_at = ${historicalStart},
        scheduled_end_at = ${historicalEnd},
        early_return_until = ${historicalCutoff}
      where id = ${lateDenialPrepared.bookingId}::uuid
    `;
    await transaction`
      update app.coach_booking_credit_operations
      set
        scheduled_start_at = ${historicalStart},
        early_return_until = ${historicalCutoff}
      where booking_id = ${lateDenialPrepared.bookingId}::uuid
    `;
  });
  const consumeOperationId = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      prepareOwnedPrivateBookingConsumptionRecord(
        transaction,
        lateDenialPrepared.bookingId,
      ),
  );
  const deniedHistoricalBooking = await currentBooking(
    firstClientActor,
    lateDenialPrepared.bookingId,
  );
  await withActorDatabaseContext(coachActor, (transaction) =>
    finalizeVerifiedBookingCreditOperationRecord(
      transaction,
      bookingEvidence({
        booking: deniedHistoricalBooking,
        operationId: consumeOperationId,
        reservationStatus: "consumed",
        availableCredits: 3,
        reservedCredits: 0,
        signatureCharacter: "9",
        observedSlot: 106,
      }),
    ),
  );
  assert.equal(
    (await currentBooking(firstClientActor, lateDenialPrepared.bookingId))
      .status,
    "denied",
  );

  assert.equal(
    await withActorDatabaseContext(firstClientActor, (transaction) =>
      recordVerifiedCoachCreditProjectionRecord(transaction, {
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        coachProfileId: coachActor.profileId,
        coachAuthorityAddress,
        clientWalletAddress: firstClientWallet,
        coachClientCreditsAddress: firstCreditsAddress,
        availableCredits: BigInt(2),
        reservedCredits: BigInt(2),
        totalPurchased: BigInt(4),
        purchaseCount: BigInt(1),
        nextPurchaseNonce: BigInt(1),
        lastOfferAddress: offerAddress,
        lastPurchaseAt: new Date().toISOString(),
        transactionSignature: signature("B"),
        observedSlot: BigInt(99),
      }),
    ),
    firstProjectionId,
  );

  const cards = await withActorDatabaseContext(coachActor, (transaction) =>
    currentCoachClientCardRecords(transaction, coachActor),
  );
  const firstCard = cards.find(
    (card) => card.clientProfileId === firstClientActor.profileId,
  );
  assert.ok(firstCard);
  assert.equal(firstCard.clientDisplayName, "Booking Client One");
  assert.equal(firstCard.availableCredits, BigInt(3));
  assert.equal(firstCard.reservedCredits, BigInt(0));
  assert.equal(firstCard.bookings.length, 3);
  assert.deepEqual(
    (
      await withActorDatabaseContext(secondClientActor, (transaction) =>
        currentClientPrivateBookingRecords(transaction, secondClientActor),
      )
    ).filter(
      (booking) => booking.clientProfileId === firstClientActor.profileId,
    ),
    [],
  );
});

test("concurrent clients cannot hold the same slot and a failed wallet flow releases it", async () => {
  const slotId = await withActorDatabaseContext(coachActor, (transaction) =>
    createOwnedCoachAvailabilityRecord(transaction, availabilityInput(74)),
  );
  const attempts = await Promise.allSettled([
    withActorDatabaseContext(firstClientActor, (transaction) =>
      prepareCreditBackedPrivateBookingRecord(transaction, {
        slotId,
        creditProjectionId: firstProjectionId,
      }),
    ),
    withActorDatabaseContext(secondClientActor, (transaction) =>
      prepareCreditBackedPrivateBookingRecord(transaction, {
        slotId,
        creditProjectionId: secondProjectionId,
      }),
    ),
  ]);
  const successes = attempts.filter(
    (
      result,
    ): result is PromiseFulfilledResult<{
      bookingId: string;
      operationId: string;
      status: "pending";
    }> => result.status === "fulfilled",
  );
  const failures = attempts.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.ok(failures[0]?.reason instanceof CoachBookingConflictError);

  const winnerActor =
    attempts[0]?.status === "fulfilled" ? firstClientActor : secondClientActor;
  const winner = successes[0]?.value;
  assert.ok(winner);
  await withActorDatabaseContext(winnerActor, (transaction) =>
    releaseOwnedPrivateBookingHoldRecord(
      transaction,
      winner.bookingId,
      "wallet-rejected",
    ),
  );
  const [slot] = await admin<{ status: string }[]>`
    select status from app.coach_availability_slots
    where id = ${slotId}::uuid
  `;
  assert.equal(slot?.status, "open");

  const expiringSlotId = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      createOwnedCoachAvailabilityRecord(transaction, availabilityInput(90)),
  );
  const expiring = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      prepareCreditBackedPrivateBookingRecord(transaction, {
        slotId: expiringSlotId,
        creditProjectionId: firstProjectionId,
      }),
  );
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    markBookingCreditOperationSubmittedRecord(
      transaction,
      expiring.operationId,
      signature("A"),
    ),
  );
  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      releaseOwnedPrivateBookingHoldRecord(
        transaction,
        expiring.bookingId,
        "reservation-absent",
      ),
    ),
    CoachBookingConflictError,
  );
  await admin.begin(async (transaction) => {
    await transaction`
      select set_config('app.coach_booking_management', 'on', true)
    `;
    await transaction`
      update app.coach_private_bookings
      set
        created_at = statement_timestamp() - interval '20 minutes',
        hold_expires_at = statement_timestamp() - interval '10 minutes'
      where id = ${expiring.bookingId}::uuid
    `;
  });
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    releaseOwnedPrivateBookingHoldRecord(
      transaction,
      expiring.bookingId,
      "reservation-absent",
    ),
  );
  const expired = await currentBooking(firstClientActor, expiring.bookingId);
  assert.equal(expired.status, "expired");
  assert.equal(
    expired.operations.find(
      (operation) => operation.id === expiring.operationId,
    )?.status,
    "expired",
  );
  const [expiredSlot] = await admin<{ status: string }[]>`
    select status from app.coach_availability_slots
    where id = ${expiringSlotId}::uuid
  `;
  assert.equal(expiredSlot?.status, "open");
});

test("purchase attempts persist exact messages, isolate actors and finalize atomically", async () => {
  const operationId = crypto.randomUUID();
  const prepared = Object.freeze({
    summary: Object.freeze({
      cluster: "devnet" as const,
      operation: "purchase-offer" as const,
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      authorityAddress: firstClientWallet,
      platformPayerAddress: coachWallet,
      coachAuthorityAddress: address(coachAuthorityAddress),
      coachClientCreditsAddress: address(firstCreditsAddress),
      creditReservationAddress: null,
      testAsset: "EURC" as const,
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false as const,
      offerAddress: address(offerAddress),
      paymentRecipientAddress: coachWallet,
      priceEurcBaseUnits: "8000000",
      creditsPurchased: 1 as const,
      expectedPurchaseNonce: "1",
      clientTokenAccountAddress: firstClientWallet,
      coachTokenAccountAddress: coachWallet,
    }),
    transactionBase64: "AQID",
    messageBase64: "BAUG",
    recentBlockhash: "11111111111111111111111111111111",
    lastValidBlockHeight: "1234",
  });

  await withActorDatabaseContext(firstClientActor, (transaction) =>
    saveCoachPassPurchasePreparationRecord(transaction, {
      operationId,
      coachProfileId: coachActor.profileId,
      prepared,
      simulationSlot: BigInt(300),
      simulationUnitsConsumed: BigInt(45_000),
      baselineLedgerExists: true,
      baselineAvailableCredits: BigInt(3),
      baselineReservedCredits: BigInt(0),
      baselineTotalPurchased: BigInt(4),
      baselinePurchaseCount: BigInt(1),
    }),
  );
  const stored = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => coachPassOperationRecord(transaction, operationId),
  );
  assert.equal(stored.status, "prepared");
  assert.deepEqual(stored.prepared, prepared);
  assert.deepEqual(stored.simulation, {
    slot: "300",
    unitsConsumed: "45000",
  });
  await assert.rejects(
    withActorDatabaseContext(secondClientActor, (transaction) =>
      coachPassOperationRecord(transaction, operationId),
    ),
    CoachPassOperationConflictError,
  );

  const transactionSignature = signature("B");
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    markCoachPassOperationSubmittedRecord(
      transaction,
      stored,
      transactionSignature,
    ),
  );
  const submitted = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => coachPassOperationRecord(transaction, operationId),
  );
  assert.equal(submitted.status, "submitted");
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    finalizeCoachPassPurchaseRecord(transaction, {
      operation: submitted,
      projection: {
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        coachProfileId: coachActor.profileId,
        coachAuthorityAddress,
        clientWalletAddress: firstClientWallet,
        coachClientCreditsAddress: firstCreditsAddress,
        availableCredits: BigInt(4),
        reservedCredits: BigInt(0),
        totalPurchased: BigInt(5),
        purchaseCount: BigInt(2),
        nextPurchaseNonce: BigInt(2),
        lastOfferAddress: offerAddress,
        lastPurchaseAt: new Date().toISOString(),
        transactionSignature,
        observedSlot: BigInt(301),
      },
    }),
  );
  const finalized = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => coachPassOperationRecord(transaction, operationId),
  );
  assert.equal(finalized.status, "finalized");
  assert.equal(finalized.finalizedSlot, BigInt(301));
});

test("booking preparations bind the active authority and release failed reserves", async () => {
  const slotId = await withActorDatabaseContext(coachActor, (transaction) =>
    createOwnedCoachAvailabilityRecord(transaction, availabilityInput(110)),
  );
  const created = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      prepareCreditBackedPrivateBookingRecord(transaction, {
        slotId,
        creditProjectionId: firstProjectionId,
      }),
  );
  const booking = await currentBooking(firstClientActor, created.bookingId);
  const prepared = Object.freeze({
    summary: Object.freeze({
      cluster: "devnet" as const,
      operation: "reserve-booking-credit" as const,
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      authorityAddress: firstClientWallet,
      platformPayerAddress: coachWallet,
      coachAuthorityAddress: address(coachAuthorityAddress),
      coachClientCreditsAddress: address(firstCreditsAddress),
      creditReservationAddress: address(booking.creditReservationAddress),
      testAsset: "EURC" as const,
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false as const,
      bookingId: booking.id,
      clientWalletAddress: firstClientWallet,
      scheduledStartUnixSeconds: unixSeconds(
        booking.scheduledStartAt,
      ).toString(),
      earlyReturnUntilUnixSeconds: unixSeconds(
        booking.earlyReturnUntil,
      ).toString(),
    }),
    transactionBase64: "AQID",
    messageBase64: "BAUG",
    recentBlockhash: "11111111111111111111111111111111",
    lastValidBlockHeight: "2234",
  });
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    saveCoachPassBookingPreparationRecord(transaction, {
      operationId: created.operationId,
      prepared,
      simulationSlot: BigInt(400),
      simulationUnitsConsumed: null,
    }),
  );
  const stored = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => coachPassOperationRecord(transaction, created.operationId),
  );
  assert.equal(stored.authorityAddress, firstClientWallet);
  assert.equal(stored.status, "prepared");
  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      saveCoachPassBookingPreparationRecord(transaction, {
        operationId: created.operationId,
        prepared: {
          ...prepared,
          summary: { ...prepared.summary, authorityAddress: coachWallet },
        },
        simulationSlot: BigInt(401),
        simulationUnitsConsumed: null,
      }),
    ),
    CoachPassOperationConflictError,
  );

  await withActorDatabaseContext(firstClientActor, (transaction) =>
    failCoachPassOperationRecord(
      transaction,
      stored,
      "failed",
      "simulation-failed",
    ),
  );
  const failed = await currentBooking(firstClientActor, created.bookingId);
  assert.equal(failed.status, "expired");
  assert.equal(
    failed.operations.find((operation) => operation.id === created.operationId)
      ?.status,
    "failed",
  );
  const [slot] = await admin<{ status: string }[]>`
    select status from app.coach_availability_slots
    where id = ${slotId}::uuid
  `;
  assert.equal(slot?.status, "open");
});
