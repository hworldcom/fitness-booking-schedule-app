import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  AccountRole,
  address,
  assertIsInstructionWithAccounts,
  assertIsInstructionWithData,
  blockhash,
  decompileTransactionMessage,
  generateKeyPairSigner,
  getCompiledTransactionMessageDecoder,
  getTransactionMessageComputeUnitLimit,
  getTransactionMessageComputeUnitPrice,
  getTransactionDecoder,
  none,
} from "@solana/kit";
import type { CoachAuthority } from "../clients/js/src/generated/accounts/coachAuthority";
import type { CoachClientCredits } from "../clients/js/src/generated/accounts/coachClientCredits";
import type { CreditReservation } from "../clients/js/src/generated/accounts/creditReservation";
import type { Offer } from "../clients/js/src/generated/accounts/offer";
import { parseConsumeBookingCreditInstruction } from "../clients/js/src/generated/instructions/consumeBookingCredit";
import { parseCreateOfferInstruction } from "../clients/js/src/generated/instructions/createOffer";
import { parseInitializeCoachAuthorityInstruction } from "../clients/js/src/generated/instructions/initializeCoachAuthority";
import { parsePurchaseFirstOfferInstruction } from "../clients/js/src/generated/instructions/purchaseFirstOffer";
import { parsePurchaseOfferInstruction } from "../clients/js/src/generated/instructions/purchaseOffer";
import { parseReserveBookingCreditInstruction } from "../clients/js/src/generated/instructions/reserveBookingCredit";
import { parseReturnBookingCreditInstruction } from "../clients/js/src/generated/instructions/returnBookingCredit";
import { CreditReservationStatus } from "../clients/js/src/generated/types/creditReservationStatus";
import { OfferStatus } from "../clients/js/src/generated/types/offerStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveCoachClientCreditsAddress,
  deriveCreditReservationAddress,
  deriveOfferAddress,
  uuidToSeed,
} from "../src/solana/coach-pass";
import {
  COACH_PASS_COMPUTE_UNIT_LIMIT,
  COACH_PASS_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
  decodeCoachPassTransactionBase64,
  matchesPreparedCoachPassMessage,
  prepareCoachPassBootstrap,
  prepareCoachPassPurchase,
  prepareCoachPassReservation,
  prepareCoachPassResolution,
  type PreparedCoachPassTransaction,
} from "../src/solana/coach-pass-transaction";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const LIFETIME = {
  blockhash: blockhash("11111111111111111111111111111111"),
  lastValidBlockHeight: BigInt(1_234),
};

async function coachPassFixture() {
  const [coachWallet, recoveryAuthority, clientWallet, platformPayer] =
    await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
    ]);
  const [coachAuthorityAddress, coachAuthorityBump] =
    await deriveCoachAuthorityAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      runId: RUN_ID,
      profileId: PROFILE_ID,
      originalWallet: coachWallet.address,
    });
  const coachAuthority: CoachAuthority = {
    discriminator: new Uint8Array(8),
    runId: [...uuidToSeed(RUN_ID)],
    profileId: [...uuidToSeed(PROFILE_ID)],
    originalWallet: coachWallet.address,
    currentWallet: coachWallet.address,
    recoveryAuthority: recoveryAuthority.address,
    authorityEpoch: BigInt(0),
    eventSequence: BigInt(0),
    bump: coachAuthorityBump,
    reserved: Array(47).fill(0),
  };
  const [offerAddress, offerBump] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(7),
  });
  const offer: Offer = {
    discriminator: new Uint8Array(8),
    coachAuthority: coachAuthorityAddress,
    paymentRecipient: coachWallet.address,
    paymentMint: DEVNET_EURC_MINT_ADDRESS,
    nonce: BigInt(7),
    priceEurcBaseUnits: BigInt(80_000_000),
    authorityEpoch: BigInt(0),
    createdAt: BigInt(1_900_000_000),
    validitySeconds: 0,
    sessionCount: 10,
    status: OfferStatus.Active,
    bump: offerBump,
    reserved: Array(47).fill(0),
    restrictedClient: none(),
    deactivatedAt: none(),
  };
  const [coachClientCreditsAddress, creditsBump] =
    await deriveCoachClientCreditsAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      coachAuthority: coachAuthorityAddress,
      clientWallet: clientWallet.address,
    });
  const coachClientCredits: CoachClientCredits = {
    discriminator: new Uint8Array(8),
    version: 1,
    coachAuthority: coachAuthorityAddress,
    clientWallet: clientWallet.address,
    availableCredits: BigInt(9),
    reservedCredits: BigInt(1),
    totalPurchased: BigInt(10),
    purchaseCount: BigInt(1),
    nextPurchaseNonce: BigInt(1),
    lastOffer: offerAddress,
    lastPurchaseAt: BigInt(1_900_000_001),
    bump: creditsBump,
    reserved: Array(46).fill(0),
  };
  const [creditReservationAddress, reservationBump] =
    await deriveCreditReservationAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      coachClientCredits: coachClientCreditsAddress,
      bookingId: BOOKING_ID,
    });
  const creditReservation: CreditReservation = {
    discriminator: new Uint8Array(8),
    version: 1,
    coachClientCredits: coachClientCreditsAddress,
    coachAuthority: coachAuthorityAddress,
    clientWallet: clientWallet.address,
    bookingId: [...uuidToSeed(BOOKING_ID)],
    scheduledStartAt: BigInt(1_900_010_000),
    earlyReturnUntil: BigInt(1_900_005_000),
    status: CreditReservationStatus.Reserved,
    reservedAt: BigInt(1_900_000_100),
    resolvedAt: none(),
    bump: reservationBump,
    reserved: Array(44).fill(0),
  };

  return {
    coachWallet,
    recoveryAuthority,
    clientWallet,
    platformPayer,
    coachAuthorityAddress,
    coachAuthority,
    offerAddress,
    offer,
    coachClientCreditsAddress,
    coachClientCredits,
    creditReservationAddress,
    creditReservation,
  };
}

function purchaseInput(fixture: Awaited<ReturnType<typeof coachPassFixture>>) {
  return {
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    clientWalletAddress: fixture.clientWallet.address,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    offerAddress: fixture.offerAddress,
    offer: fixture.offer,
    currentUnixSeconds: BigInt(1_900_000_010),
  } as const;
}

function resolutionInput(
  fixture: Awaited<ReturnType<typeof coachPassFixture>>,
) {
  return {
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    coachClientCreditsAddress: fixture.coachClientCreditsAddress,
    coachClientCredits: fixture.coachClientCredits,
    creditReservationAddress: fixture.creditReservationAddress,
    creditReservation: fixture.creditReservation,
  } as const;
}

function decompilePrepared(
  prepared: Pick<
    PreparedCoachPassTransaction,
    "transactionBase64" | "lastValidBlockHeight"
  >,
) {
  const transaction = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(prepared.transactionBase64),
  );
  const compiledMessage = getCompiledTransactionMessageDecoder().decode(
    transaction.messageBytes,
  );
  return {
    transaction,
    message: decompileTransactionMessage(compiledMessage, {
      lastValidBlockHeight: BigInt(prepared.lastValidBlockHeight),
    }),
  };
}

test("bootstrap preparation freezes exact coach, recovery and public offer terms", async () => {
  const fixture = await coachPassFixture();
  const prepared = await prepareCoachPassBootstrap({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    coachWalletAddress: fixture.coachWallet.address,
    recoveryAuthorityAddress: fixture.recoveryAuthority.address,
    oneCreditPriceEurcBaseUnits: BigInt(10_000_000),
    tenCreditPriceEurcBaseUnits: BigInt(100_000_000),
  });
  const decoded = decompilePrepared(prepared);

  assert.equal(prepared.summary.operation, "initialize-coach-and-offers");
  assert.equal(
    prepared.summary.coachAuthorityAddress,
    fixture.coachAuthorityAddress,
  );
  assert.equal(prepared.summary.oneCreditPriceEurcBaseUnits, "10000000");
  assert.equal(prepared.summary.tenCreditPriceEurcBaseUnits, "100000000");
  assert.equal(prepared.summary.eurcMovedBaseUnits, "0");
  assert.equal(prepared.summary.userPaysSol, false);
  assert.equal(decoded.message.version, "legacy");
  assert.equal(decoded.message.feePayer.address, fixture.platformPayer.address);
  assert.deepEqual(
    Object.keys(decoded.transaction.signatures).sort(),
    [fixture.coachWallet.address, fixture.platformPayer.address].sort(),
  );
  assert.deepEqual(Object.values(decoded.transaction.signatures), [null, null]);
  assert.equal(
    getTransactionMessageComputeUnitLimit(decoded.message),
    COACH_PASS_COMPUTE_UNIT_LIMIT,
  );
  assert.equal(
    getTransactionMessageComputeUnitPrice(decoded.message),
    COACH_PASS_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
  );
  assert.equal(decoded.message.instructions.length, 5);

  const initializeInstruction = decoded.message.instructions[2]!;
  assertIsInstructionWithAccounts(initializeInstruction);
  assertIsInstructionWithData(initializeInstruction);
  const initialize = parseInitializeCoachAuthorityInstruction(
    initializeInstruction,
  );
  assert.equal(
    initialize.accounts.recoveryAuthority.address,
    fixture.recoveryAuthority.address,
  );
  assert.equal(
    initialize.accounts.recoveryAuthority.role,
    AccountRole.READONLY,
  );
  assert.deepEqual(initialize.data.runId, [...uuidToSeed(RUN_ID)]);
  assert.deepEqual(initialize.data.profileId, [...uuidToSeed(PROFILE_ID)]);

  const offers = decoded.message.instructions.slice(3).map((instruction) => {
    assertIsInstructionWithAccounts(instruction);
    assertIsInstructionWithData(instruction);
    return parseCreateOfferInstruction(instruction);
  });
  assert.deepEqual(
    offers.map(({ data }) => ({
      nonce: data.args.nonce,
      price: data.args.priceEurcBaseUnits,
      sessions: data.args.sessionCount,
      validity: data.args.validitySeconds,
    })),
    [
      {
        nonce: BigInt(0),
        price: BigInt(10_000_000),
        sessions: 1,
        validity: 0,
      },
      {
        nonce: BigInt(1),
        price: BigInt(100_000_000),
        sessions: 10,
        validity: 0,
      },
    ],
  );
});

test("bootstrap preparation rejects shared authorities and inconsistent pricing", async () => {
  const fixture = await coachPassFixture();
  const input = {
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    coachWalletAddress: fixture.coachWallet.address,
    recoveryAuthorityAddress: fixture.recoveryAuthority.address,
    oneCreditPriceEurcBaseUnits: BigInt(10_000_000),
    tenCreditPriceEurcBaseUnits: BigInt(100_000_000),
  } as const;

  await assert.rejects(
    prepareCoachPassBootstrap({
      ...input,
      recoveryAuthorityAddress: fixture.coachWallet.address,
    }),
    /must be distinct/u,
  );
  await assert.rejects(
    prepareCoachPassBootstrap({
      ...input,
      tenCreditPriceEurcBaseUnits: BigInt(99_000_000),
    }),
    /price one and ten credits consistently/u,
  );
});

test("purchase preparation freezes exact first and later Devnet terms", async () => {
  const fixture = await coachPassFixture();
  const common = purchaseInput(fixture);
  const first = await prepareCoachPassPurchase({
    ...common,
    coachClientCredits: null,
  });
  const later = await prepareCoachPassPurchase({
    ...common,
    coachClientCredits: fixture.coachClientCredits,
  });

  assert.equal(first.summary.operation, "purchase-first-offer");
  assert.equal(later.summary.operation, "purchase-offer");
  assert.equal(first.summary.authorityAddress, fixture.clientWallet.address);
  assert.equal(
    first.summary.platformPayerAddress,
    fixture.platformPayer.address,
  );
  assert.equal(first.summary.userPaysSol, false);
  assert.equal(first.summary.paymentMintAddress, DEVNET_EURC_MINT_ADDRESS);
  assert.equal(first.summary.priceEurcBaseUnits, "80000000");
  assert.equal(first.summary.creditsPurchased, 10);
  assert.equal(first.summary.expectedPurchaseNonce, "0");
  assert.equal(later.summary.expectedPurchaseNonce, "1");
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.ok(decodeCoachPassTransactionBase64(first.transactionBase64).length);
  assert.notEqual(first.messageBase64, later.messageBase64);
});

test("purchase messages allowlist ATA setup and the exact coach-pass instruction", async () => {
  const fixture = await coachPassFixture();
  const common = purchaseInput(fixture);
  const first = await prepareCoachPassPurchase({
    ...common,
    coachClientCredits: null,
  });
  const later = await prepareCoachPassPurchase({
    ...common,
    coachClientCredits: fixture.coachClientCredits,
  });
  const firstDecoded = decompilePrepared(first);
  const laterDecoded = decompilePrepared(later);
  if (
    first.summary.operation !== "purchase-first-offer" ||
    later.summary.operation !== "purchase-offer"
  ) {
    assert.fail("Expected purchase approval summaries.");
  }

  assert.equal(firstDecoded.message.version, "legacy");
  assert.equal(
    firstDecoded.message.feePayer.address,
    fixture.platformPayer.address,
  );
  assert.deepEqual(
    Object.keys(firstDecoded.transaction.signatures).sort(),
    [fixture.clientWallet.address, fixture.platformPayer.address].sort(),
  );
  assert.deepEqual(Object.values(firstDecoded.transaction.signatures), [
    null,
    null,
  ]);
  assert.equal(firstDecoded.message.instructions.length, 4);
  const ataInstruction = firstDecoded.message.instructions[2]!;
  assert.equal(ataInstruction.programAddress, ASSOCIATED_TOKEN_PROGRAM_ADDRESS);
  assertIsInstructionWithAccounts(ataInstruction);
  assert.deepEqual(
    ataInstruction.accounts.map((account) => account.address),
    [
      fixture.platformPayer.address,
      first.summary.coachTokenAccountAddress,
      fixture.coachWallet.address,
      DEVNET_EURC_MINT_ADDRESS,
      address("11111111111111111111111111111111"),
      TOKEN_PROGRAM_ADDRESS,
    ],
  );
  assert.equal(ataInstruction.accounts[0]!.role, AccountRole.WRITABLE_SIGNER);

  const firstPurchaseInstruction = firstDecoded.message.instructions[3]!;
  assert.equal(
    firstPurchaseInstruction.programAddress,
    MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  );
  assertIsInstructionWithAccounts(firstPurchaseInstruction);
  assertIsInstructionWithData(firstPurchaseInstruction);
  const parsedFirst = parsePurchaseFirstOfferInstruction(
    firstPurchaseInstruction,
  );
  assert.equal(
    parsedFirst.accounts.clientWallet.address,
    fixture.clientWallet.address,
  );
  assert.equal(
    parsedFirst.accounts.clientWallet.role,
    AccountRole.READONLY_SIGNER,
  );
  assert.equal(
    parsedFirst.accounts.platformPayer.address,
    fixture.platformPayer.address,
  );
  assert.equal(
    parsedFirst.accounts.platformPayer.role,
    AccountRole.WRITABLE_SIGNER,
  );

  assert.equal(laterDecoded.message.instructions.length, 4);
  const laterPurchaseInstruction = laterDecoded.message.instructions[3]!;
  assertIsInstructionWithAccounts(laterPurchaseInstruction);
  assertIsInstructionWithData(laterPurchaseInstruction);
  const parsedLater = parsePurchaseOfferInstruction(laterPurchaseInstruction);
  assert.equal(parsedLater.data.expectedPurchaseNonce, BigInt(1));
  assert.equal(
    parsedLater.accounts.coachClientCredits.address,
    fixture.coachClientCreditsAddress,
  );
});

test("prepared-message comparison rejects both byte and length changes", async () => {
  const fixture = await coachPassFixture();
  const prepared = await prepareCoachPassPurchase({
    ...purchaseInput(fixture),
    coachClientCredits: null,
  });
  const transaction = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(prepared.transactionBase64),
  );
  assert.equal(
    matchesPreparedCoachPassMessage({
      signedTransactionMessage: transaction.messageBytes,
      preparedMessageBase64: prepared.messageBase64,
    }),
    true,
  );

  const changed = Uint8Array.from(transaction.messageBytes);
  changed[changed.length - 1] ^= 1;
  assert.equal(
    matchesPreparedCoachPassMessage({
      signedTransactionMessage: changed,
      preparedMessageBase64: prepared.messageBase64,
    }),
    false,
  );
  assert.equal(
    matchesPreparedCoachPassMessage({
      signedTransactionMessage: new Uint8Array([1]),
      preparedMessageBase64: prepared.messageBase64,
    }),
    false,
  );
});

test("purchase preparation rejects derived-address, asset and eligibility drift", async () => {
  const fixture = await coachPassFixture();
  const input = {
    ...purchaseInput(fixture),
    coachClientCredits: null,
  };

  await assert.rejects(
    prepareCoachPassPurchase({
      ...input,
      offerAddress: address("11111111111111111111111111111111"),
    }),
    /Offer address does not match/u,
  );
  await assert.rejects(
    prepareCoachPassPurchase({
      ...input,
      offer: {
        ...fixture.offer,
        paymentMint: address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
      },
    }),
    /not eligible/u,
  );
  await assert.rejects(
    prepareCoachPassPurchase({
      ...input,
      clientWalletAddress: fixture.coachWallet.address,
    }),
    /not eligible/u,
  );
});

test("purchase preparation rejects non-canonical bumps and unsupported terms", async () => {
  const fixture = await coachPassFixture();
  const input = purchaseInput(fixture);

  await assert.rejects(
    prepareCoachPassPurchase({
      ...input,
      coachAuthority: {
        ...fixture.coachAuthority,
        bump: (fixture.coachAuthority.bump + 1) % 256,
      },
      coachClientCredits: null,
    }),
    /Coach authority address does not match/u,
  );
  await assert.rejects(
    prepareCoachPassPurchase({
      ...input,
      offer: {
        ...fixture.offer,
        bump: (fixture.offer.bump + 1) % 256,
      },
      coachClientCredits: null,
    }),
    /Offer address does not match/u,
  );
  for (const offer of [
    { ...fixture.offer, priceEurcBaseUnits: BigInt(0) },
    { ...fixture.offer, sessionCount: 2 },
  ]) {
    await assert.rejects(
      prepareCoachPassPurchase({
        ...input,
        offer,
        coachClientCredits: null,
      }),
      /unsupported purchase terms/u,
    );
  }
  await assert.rejects(
    prepareCoachPassPurchase({
      ...input,
      coachClientCredits: {
        ...fixture.coachClientCredits,
        bump: (fixture.coachClientCredits.bump + 1) % 256,
      },
    }),
    /Credit ledger address does not match/u,
  );
});

test("booking preparation binds reservation identity, authority and timing", async () => {
  const fixture = await coachPassFixture();
  const reservation = await prepareCoachPassReservation({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    clientWalletAddress: fixture.clientWallet.address,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    coachClientCreditsAddress: fixture.coachClientCreditsAddress,
    coachClientCredits: fixture.coachClientCredits,
    bookingId: BOOKING_ID,
    scheduledStartUnixSeconds: BigInt(1_900_010_000),
    earlyReturnUntilUnixSeconds: BigInt(1_900_005_000),
  });
  const clientReturn = await prepareCoachPassResolution({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    resolution: "return",
    authorityAddress: fixture.clientWallet.address,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    coachClientCreditsAddress: fixture.coachClientCreditsAddress,
    coachClientCredits: fixture.coachClientCredits,
    creditReservationAddress: fixture.creditReservationAddress,
    creditReservation: fixture.creditReservation,
    currentUnixSeconds: BigInt(1_900_004_000),
  });
  const consume = await prepareCoachPassResolution({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    resolution: "consume",
    authorityAddress: fixture.coachWallet.address,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    coachClientCreditsAddress: fixture.coachClientCreditsAddress,
    coachClientCredits: fixture.coachClientCredits,
    creditReservationAddress: fixture.creditReservationAddress,
    creditReservation: fixture.creditReservation,
    currentUnixSeconds: BigInt(1_900_010_000),
  });

  assert.equal(reservation.summary.operation, "reserve-booking-credit");
  assert.equal(
    reservation.summary.creditReservationAddress,
    fixture.creditReservationAddress,
  );
  assert.equal(clientReturn.summary.operation, "return-booking-credit");
  assert.equal(consume.summary.operation, "consume-booking-credit");
  assert.equal(consume.summary.authorityAddress, fixture.coachWallet.address);

  await assert.rejects(
    prepareCoachPassResolution({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      platformPayerAddress: fixture.platformPayer.address,
      lifetimeConstraint: LIFETIME,
      resolution: "return",
      authorityAddress: fixture.clientWallet.address,
      coachAuthorityAddress: fixture.coachAuthorityAddress,
      coachAuthority: fixture.coachAuthority,
      coachClientCreditsAddress: fixture.coachClientCreditsAddress,
      coachClientCredits: fixture.coachClientCredits,
      creditReservationAddress: fixture.creditReservationAddress,
      creditReservation: fixture.creditReservation,
      currentUnixSeconds: BigInt(1_900_006_000),
    }),
    /not authorized/u,
  );
});

test("booking messages contain one exact reserve, return or consume instruction", async () => {
  const fixture = await coachPassFixture();
  const preparedReserve = await prepareCoachPassReservation({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    clientWalletAddress: fixture.clientWallet.address,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    coachClientCreditsAddress: fixture.coachClientCreditsAddress,
    coachClientCredits: fixture.coachClientCredits,
    bookingId: BOOKING_ID,
    scheduledStartUnixSeconds: BigInt(1_900_010_000),
    earlyReturnUntilUnixSeconds: BigInt(1_900_005_000),
  });
  const preparedReturn = await prepareCoachPassResolution({
    ...resolutionInput(fixture),
    resolution: "return",
    authorityAddress: fixture.coachWallet.address,
    currentUnixSeconds: BigInt(1_900_006_000),
  });
  const preparedConsume = await prepareCoachPassResolution({
    ...resolutionInput(fixture),
    resolution: "consume",
    authorityAddress: fixture.coachWallet.address,
    currentUnixSeconds: BigInt(1_900_010_000),
  });

  const reserveInstruction =
    decompilePrepared(preparedReserve).message.instructions[2]!;
  assertIsInstructionWithAccounts(reserveInstruction);
  assertIsInstructionWithData(reserveInstruction);
  const parsedReserve =
    parseReserveBookingCreditInstruction(reserveInstruction);
  assert.deepEqual(parsedReserve.data.bookingId, [...uuidToSeed(BOOKING_ID)]);
  assert.equal(parsedReserve.data.scheduledStartAt, BigInt(1_900_010_000));
  assert.equal(
    parsedReserve.accounts.platformPayer.address,
    fixture.platformPayer.address,
  );

  const returnInstruction =
    decompilePrepared(preparedReturn).message.instructions[2]!;
  assertIsInstructionWithAccounts(returnInstruction);
  assertIsInstructionWithData(returnInstruction);
  const parsedReturn = parseReturnBookingCreditInstruction(returnInstruction);
  assert.equal(
    parsedReturn.accounts.resolutionAuthority.address,
    fixture.coachWallet.address,
  );

  const consumeInstruction =
    decompilePrepared(preparedConsume).message.instructions[2]!;
  assertIsInstructionWithAccounts(consumeInstruction);
  assertIsInstructionWithData(consumeInstruction);
  const parsedConsume =
    parseConsumeBookingCreditInstruction(consumeInstruction);
  assert.equal(
    parsedConsume.accounts.coachWallet.address,
    fixture.coachWallet.address,
  );
  for (const prepared of [preparedReserve, preparedReturn, preparedConsume]) {
    const decoded = decompilePrepared(prepared);
    assert.equal(decoded.message.instructions.length, 3);
    assert.equal(
      decoded.message.instructions[2]!.programAddress,
      MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    );
    assert.deepEqual(
      Object.keys(decoded.transaction.signatures).sort(),
      [prepared.summary.authorityAddress, fixture.platformPayer.address].sort(),
    );
  }
});

test("reservation preparation rejects empty balances, invalid schedules and ledger drift", async () => {
  const fixture = await coachPassFixture();
  const input = {
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
    clientWalletAddress: fixture.clientWallet.address,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    coachClientCreditsAddress: fixture.coachClientCreditsAddress,
    coachClientCredits: fixture.coachClientCredits,
    bookingId: BOOKING_ID,
    scheduledStartUnixSeconds: BigInt(1_900_010_000),
    earlyReturnUntilUnixSeconds: BigInt(1_900_005_000),
  } as const;

  await assert.rejects(
    prepareCoachPassReservation({
      ...input,
      coachClientCredits: {
        ...fixture.coachClientCredits,
        availableCredits: BigInt(0),
      },
    }),
    /No available coach credit/u,
  );
  for (const schedule of [
    {
      scheduledStartUnixSeconds: BigInt(0),
      earlyReturnUntilUnixSeconds: BigInt(0),
    },
    {
      scheduledStartUnixSeconds: BigInt(100),
      earlyReturnUntilUnixSeconds: BigInt(101),
    },
  ]) {
    await assert.rejects(
      prepareCoachPassReservation({ ...input, ...schedule }),
      /schedule or early-return cutoff is invalid/u,
    );
  }
  await assert.rejects(
    prepareCoachPassReservation({
      ...input,
      coachClientCreditsAddress: address("11111111111111111111111111111111"),
    }),
    /Credit ledger address does not match/u,
  );
  await assert.rejects(
    prepareCoachPassReservation({
      ...input,
      bookingId: "not-a-uuid",
    }),
    /canonical UUID/u,
  );
});

test("resolution preparation rejects replay, PDA drift and unauthorized timing", async () => {
  const fixture = await coachPassFixture();
  const outsider = await generateKeyPairSigner();
  const input = resolutionInput(fixture);

  await assert.rejects(
    prepareCoachPassResolution({
      ...input,
      resolution: "return",
      authorityAddress: fixture.clientWallet.address,
      coachClientCredits: {
        ...fixture.coachClientCredits,
        reservedCredits: BigInt(0),
      },
      currentUnixSeconds: BigInt(1_900_004_000),
    }),
    /no reserved credit/u,
  );
  await assert.rejects(
    prepareCoachPassResolution({
      ...input,
      resolution: "return",
      authorityAddress: fixture.clientWallet.address,
      creditReservation: {
        ...fixture.creditReservation,
        status: CreditReservationStatus.Returned,
      },
      currentUnixSeconds: BigInt(1_900_004_000),
    }),
    /already resolved/u,
  );
  await assert.rejects(
    prepareCoachPassResolution({
      ...input,
      resolution: "return",
      authorityAddress: fixture.clientWallet.address,
      coachClientCredits: {
        ...fixture.coachClientCredits,
        bump: (fixture.coachClientCredits.bump + 1) % 256,
      },
      currentUnixSeconds: BigInt(1_900_004_000),
    }),
    /Credit ledger address does not match/u,
  );
  await assert.rejects(
    prepareCoachPassResolution({
      ...input,
      resolution: "return",
      authorityAddress: fixture.clientWallet.address,
      creditReservation: {
        ...fixture.creditReservation,
        bump: (fixture.creditReservation.bump + 1) % 256,
      },
      currentUnixSeconds: BigInt(1_900_004_000),
    }),
    /Reservation address does not match/u,
  );
  await assert.rejects(
    prepareCoachPassResolution({
      ...input,
      resolution: "return",
      authorityAddress: outsider.address,
      currentUnixSeconds: BigInt(1_900_004_000),
    }),
    /not authorized/u,
  );
  for (const attempt of [
    {
      authorityAddress: outsider.address,
      currentUnixSeconds: BigInt(1_900_010_000),
    },
    {
      authorityAddress: fixture.coachWallet.address,
      currentUnixSeconds: BigInt(1_900_009_999),
    },
  ]) {
    await assert.rejects(
      prepareCoachPassResolution({
        ...input,
        resolution: "consume",
        ...attempt,
      }),
      /cannot consume this credit yet/u,
    );
  }
});
