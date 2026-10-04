import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountRole,
  address,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getUtf8Encoder,
  isNone,
} from "@solana/kit";
import { getCoachAuthorityEncoder } from "../clients/js/src/generated/accounts/coachAuthority";
import {
  getCoachClientCreditsDecoder,
  getCoachClientCreditsEncoder,
} from "../clients/js/src/generated/accounts/coachClientCredits";
import {
  getCreditReservationDecoder,
  getCreditReservationEncoder,
} from "../clients/js/src/generated/accounts/creditReservation";
import {
  getOfferDecoder,
  getOfferEncoder,
} from "../clients/js/src/generated/accounts/offer";
import {
  CONSUME_BOOKING_CREDIT_DISCRIMINATOR,
  getConsumeBookingCreditInstructionDataEncoder,
} from "../clients/js/src/generated/instructions/consumeBookingCredit";
import {
  CREATE_OFFER_DISCRIMINATOR,
  getCreateOfferInstruction,
  getCreateOfferInstructionDataDecoder,
  getCreateOfferInstructionDataEncoder,
  parseCreateOfferInstruction,
} from "../clients/js/src/generated/instructions/createOffer";
import {
  getInitializeCoachAuthorityInstructionAsync,
  parseInitializeCoachAuthorityInstruction,
} from "../clients/js/src/generated/instructions/initializeCoachAuthority";
import {
  PURCHASE_FIRST_OFFER_DISCRIMINATOR,
  getPurchaseFirstOfferInstructionAsync,
  getPurchaseFirstOfferInstructionDataEncoder,
  parsePurchaseFirstOfferInstruction,
} from "../clients/js/src/generated/instructions/purchaseFirstOffer";
import {
  PURCHASE_OFFER_DISCRIMINATOR,
  getPurchaseOfferInstructionDataDecoder,
  getPurchaseOfferInstructionDataEncoder,
} from "../clients/js/src/generated/instructions/purchaseOffer";
import {
  RESERVE_BOOKING_CREDIT_DISCRIMINATOR,
  getReserveBookingCreditInstructionAsync,
  getReserveBookingCreditInstructionDataDecoder,
  getReserveBookingCreditInstructionDataEncoder,
  parseReserveBookingCreditInstruction,
} from "../clients/js/src/generated/instructions/reserveBookingCredit";
import {
  RETURN_BOOKING_CREDIT_DISCRIMINATOR,
  getReturnBookingCreditInstructionDataEncoder,
} from "../clients/js/src/generated/instructions/returnBookingCredit";
import {
  identifyMovxCoachPassInstruction,
  MovxCoachPassInstruction,
} from "../clients/js/src/generated/programs/movxCoachPass";
import { CreditReservationStatus } from "../clients/js/src/generated/types/creditReservationStatus";
import { OfferStatus } from "../clients/js/src/generated/types/offerStatus";
import {
  DEVNET_USDC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveCoachClientCreditsAddress,
  deriveCreditReservationAddress,
  deriveOfferAddress,
  isOfferPurchaseEligible,
  parseCoachOfferMetadata,
  projectCoachClientCreditSummary,
  projectCreditReservationSummary,
  seedToUuid,
  uuidToSeed,
} from "../src/solana/coach-pass";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_WALLET = address("7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge");
const RECOVERY_AUTHORITY = address(
  "HULis5PpFFL5ajU9k8WzPjtJ8wZKXg4HHbKVvSEhFCfR",
);
const CLIENT_WALLET = address("3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe");
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_BOOKING_ID = "44444444-4444-4444-8444-444444444444";

test("UUID and PDA helpers produce stable coach and offer addresses", async () => {
  assert.equal(uuidToSeed(RUN_ID).length, 16);
  assert.throws(() => uuidToSeed("not-a-uuid"), /canonical UUID/u);

  const [coachAuthority, coachBump] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: ORIGINAL_WALLET,
  });
  const [sameCoachAuthority, sameCoachBump] = await deriveCoachAuthorityAddress(
    {
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      runId: RUN_ID,
      profileId: PROFILE_ID,
      originalWallet: ORIGINAL_WALLET,
    },
  );
  const [firstOffer] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(1),
  });
  const [secondOffer] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(2),
  });

  assert.equal(coachAuthority, sameCoachAuthority);
  assert.equal(coachBump, sameCoachBump);
  assert.notEqual(firstOffer, secondOffer);

  const [creditsAddress, creditsBump] = await deriveCoachClientCreditsAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority,
    clientWallet: CLIENT_WALLET,
  });
  const [sameCreditsAddress, sameCreditsBump] =
    await deriveCoachClientCreditsAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      coachAuthority,
      clientWallet: CLIENT_WALLET,
    });
  const [otherClientCreditsAddress] = await deriveCoachClientCreditsAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority,
    clientWallet: RECOVERY_AUTHORITY,
  });
  assert.equal(creditsAddress, sameCreditsAddress);
  assert.equal(creditsBump, sameCreditsBump);
  assert.notEqual(creditsAddress, otherClientCreditsAddress);

  const [reservationAddress, reservationBump] =
    await deriveCreditReservationAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      coachClientCredits: creditsAddress,
      bookingId: BOOKING_ID,
    });
  const [sameReservationAddress, sameReservationBump] =
    await deriveCreditReservationAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      coachClientCredits: creditsAddress,
      bookingId: BOOKING_ID,
    });
  const [otherReservationAddress] = await deriveCreditReservationAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachClientCredits: creditsAddress,
    bookingId: OTHER_BOOKING_ID,
  });
  assert.equal(reservationAddress, sameReservationAddress);
  assert.equal(reservationBump, sameReservationBump);
  assert.notEqual(reservationAddress, otherReservationAddress);
  assert.equal(seedToUuid([...uuidToSeed(BOOKING_ID)]), BOOKING_ID);
  assert.throws(() => seedToUuid([1, 2, 3]), /16-byte UUID seed/u);
  await assert.rejects(
    deriveOfferAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      coachAuthority,
      nonce: BigInt(-1),
    }),
    /unsigned 64-bit/u,
  );
});

test("generated account-creation instructions separate platform payer and business authority", async () => {
  const [coachWallet, recoveryAuthority, clientWallet, platformPayer] =
    await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
    ]);
  const [eventAuthority] = await getProgramDerivedAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    seeds: [getUtf8Encoder().encode("__event_authority")],
  });
  const [coachAuthority] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: coachWallet.address,
  });
  const [offer] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(0),
  });
  const [coachClientCredits] = await deriveCoachClientCreditsAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority,
    clientWallet: clientWallet.address,
  });
  const [creditReservation] = await deriveCreditReservationAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachClientCredits,
    bookingId: BOOKING_ID,
  });

  const initialized = parseInitializeCoachAuthorityInstruction(
    await getInitializeCoachAuthorityInstructionAsync({
      coachWallet,
      recoveryAuthority,
      platformPayer,
      coachAuthority,
      eventAuthority,
      program: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      runId: [...uuidToSeed(RUN_ID)],
      profileId: [...uuidToSeed(PROFILE_ID)],
    }),
  );
  const createdOffer = parseCreateOfferInstruction(
    getCreateOfferInstruction({
      coachWallet,
      platformPayer,
      coachAuthority,
      offer,
      eventAuthority,
      program: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      args: {
        nonce: BigInt(0),
        priceUsdcBaseUnits: BigInt(10_000_000),
        sessionCount: 1,
        validitySeconds: 0,
        restrictedClient: null,
      },
    }),
  );
  const firstPurchase = parsePurchaseFirstOfferInstruction(
    await getPurchaseFirstOfferInstructionAsync({
      clientWallet,
      platformPayer,
      coachAuthority,
      offer,
      coachClientCredits,
      clientTokenAccount: CLIENT_WALLET,
      coachTokenAccount: ORIGINAL_WALLET,
      eventAuthority,
      program: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    }),
  );
  const reserved = parseReserveBookingCreditInstruction(
    await getReserveBookingCreditInstructionAsync({
      clientWallet,
      platformPayer,
      coachAuthority,
      coachClientCredits,
      creditReservation,
      eventAuthority,
      program: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      bookingId: [...uuidToSeed(BOOKING_ID)],
      scheduledStartAt: BigInt(1_900_003_600),
      earlyReturnUntil: BigInt(1_900_001_800),
    }),
  );

  for (const [businessAuthority, payer] of [
    [initialized.accounts.coachWallet, initialized.accounts.platformPayer],
    [createdOffer.accounts.coachWallet, createdOffer.accounts.platformPayer],
    [firstPurchase.accounts.clientWallet, firstPurchase.accounts.platformPayer],
    [reserved.accounts.clientWallet, reserved.accounts.platformPayer],
  ]) {
    assert.equal(businessAuthority.role, AccountRole.READONLY_SIGNER);
    assert.equal(payer.address, platformPayer.address);
    assert.equal(payer.role, AccountRole.WRITABLE_SIGNER);
    assert.notEqual(businessAuthority.address, payer.address);
  }
});

test("generated booking-credit codecs preserve lifecycle identifiers and snapshots", () => {
  const reserve = getReserveBookingCreditInstructionDataEncoder().encode({
    bookingId: [...uuidToSeed(BOOKING_ID)],
    scheduledStartAt: BigInt(1_900_003_600),
    earlyReturnUntil: BigInt(1_900_001_800),
  });
  const decodedReserve =
    getReserveBookingCreditInstructionDataDecoder().decode(reserve);
  const returned = getReturnBookingCreditInstructionDataEncoder().encode({});
  const consumed = getConsumeBookingCreditInstructionDataEncoder().encode({});

  assert.deepEqual(
    Array.from(reserve.slice(0, 8)),
    Array.from(RESERVE_BOOKING_CREDIT_DISCRIMINATOR),
  );
  assert.deepEqual(
    Array.from(returned),
    Array.from(RETURN_BOOKING_CREDIT_DISCRIMINATOR),
  );
  assert.deepEqual(
    Array.from(consumed),
    Array.from(CONSUME_BOOKING_CREDIT_DISCRIMINATOR),
  );
  assert.equal(
    identifyMovxCoachPassInstruction(reserve),
    MovxCoachPassInstruction.ReserveBookingCredit,
  );
  assert.equal(
    identifyMovxCoachPassInstruction(returned),
    MovxCoachPassInstruction.ReturnBookingCredit,
  );
  assert.equal(
    identifyMovxCoachPassInstruction(consumed),
    MovxCoachPassInstruction.ConsumeBookingCredit,
  );
  assert.equal(seedToUuid(decodedReserve.bookingId), BOOKING_ID);
  assert.equal(decodedReserve.scheduledStartAt, BigInt(1_900_003_600));
  assert.equal(decodedReserve.earlyReturnUntil, BigInt(1_900_001_800));
});

test("generated create-offer codec preserves exact commercial terms", () => {
  const encoded = getCreateOfferInstructionDataEncoder().encode({
    args: {
      nonce: BigInt(9),
      priceUsdcBaseUnits: BigInt(10_000_000),
      sessionCount: 10,
      validitySeconds: 90 * 24 * 60 * 60,
      restrictedClient: null,
    },
  });
  const decoded = getCreateOfferInstructionDataDecoder().decode(encoded);

  assert.deepEqual(
    Array.from(encoded.slice(0, 8)),
    Array.from(CREATE_OFFER_DISCRIMINATOR),
  );
  assert.equal(
    identifyMovxCoachPassInstruction(encoded),
    MovxCoachPassInstruction.CreateOffer,
  );
  assert.equal(decoded.args.nonce, BigInt(9));
  assert.equal(decoded.args.priceUsdcBaseUnits, BigInt(10_000_000));
  assert.equal(decoded.args.sessionCount, 10);
  assert.equal(decoded.args.validitySeconds, 7_776_000);
  assert.equal(isNone(decoded.args.restrictedClient), true);
});

test("generated purchase codecs preserve first and monotonic later operations", () => {
  const first = getPurchaseFirstOfferInstructionDataEncoder().encode({});
  const later = getPurchaseOfferInstructionDataEncoder().encode({
    expectedPurchaseNonce: BigInt(7),
  });
  const decodedLater = getPurchaseOfferInstructionDataDecoder().decode(later);

  assert.deepEqual(
    Array.from(first),
    Array.from(PURCHASE_FIRST_OFFER_DISCRIMINATOR),
  );
  assert.deepEqual(
    Array.from(later.slice(0, 8)),
    Array.from(PURCHASE_OFFER_DISCRIMINATOR),
  );
  assert.equal(
    identifyMovxCoachPassInstruction(first),
    MovxCoachPassInstruction.PurchaseFirstOffer,
  );
  assert.equal(
    identifyMovxCoachPassInstruction(later),
    MovxCoachPassInstruction.PurchaseOffer,
  );
  assert.equal(decodedLater.expectedPurchaseNonce, BigInt(7));
});

test("account codecs and eligibility reject stale wallet epochs", async () => {
  const [coachAuthorityAddress, bump] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: ORIGINAL_WALLET,
  });
  const coachAuthorityBytes = getCoachAuthorityEncoder().encode({
    runId: [...uuidToSeed(RUN_ID)],
    profileId: [...uuidToSeed(PROFILE_ID)],
    originalWallet: ORIGINAL_WALLET,
    currentWallet: ORIGINAL_WALLET,
    recoveryAuthority: RECOVERY_AUTHORITY,
    authorityEpoch: BigInt(0),
    eventSequence: BigInt(1),
    bump,
    reserved: Array(47).fill(0),
  });
  assert.equal(coachAuthorityBytes.length, 200);

  const offerBytes = getOfferEncoder().encode({
    coachAuthority: coachAuthorityAddress,
    paymentRecipient: ORIGINAL_WALLET,
    paymentMint: DEVNET_USDC_MINT_ADDRESS,
    nonce: BigInt(1),
    priceUsdcBaseUnits: BigInt(2_000_000),
    authorityEpoch: BigInt(0),
    createdAt: BigInt(1_800_000_000),
    validitySeconds: 90 * 24 * 60 * 60,
    sessionCount: 1,
    status: OfferStatus.Active,
    bump: 250,
    reserved: Array(47).fill(0),
    restrictedClient: null,
    deactivatedAt: null,
  });
  const offer = getOfferDecoder().decode(offerBytes);
  const authority = {
    discriminator: coachAuthorityBytes.slice(0, 8),
    runId: [...uuidToSeed(RUN_ID)],
    profileId: [...uuidToSeed(PROFILE_ID)],
    originalWallet: ORIGINAL_WALLET,
    currentWallet: ORIGINAL_WALLET,
    recoveryAuthority: RECOVERY_AUTHORITY,
    authorityEpoch: BigInt(0),
    eventSequence: BigInt(1),
    bump,
    reserved: Array(47).fill(0),
  };

  assert.equal(
    isOfferPurchaseEligible({
      offer,
      offerCoachAuthorityAddress: coachAuthorityAddress,
      authority,
      clientWallet: CLIENT_WALLET,
      purchasedAtUnixSeconds: BigInt(1_800_000_001),
    }),
    true,
  );
  assert.equal(
    isOfferPurchaseEligible({
      offer,
      offerCoachAuthorityAddress: coachAuthorityAddress,
      authority: {
        ...authority,
        currentWallet: RECOVERY_AUTHORITY,
        authorityEpoch: BigInt(1),
      },
      clientWallet: CLIENT_WALLET,
      purchasedAtUnixSeconds: BigInt(1_800_000_001),
    }),
    false,
  );
});

test("credit ledger codec and projection expose bounded coach client-card data", async () => {
  const [coachAuthorityAddress] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: ORIGINAL_WALLET,
  });
  const [lastOffer] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(4),
  });
  const encoded = getCoachClientCreditsEncoder().encode({
    version: 1,
    coachAuthority: coachAuthorityAddress,
    clientWallet: CLIENT_WALLET,
    availableCredits: BigInt(8),
    reservedCredits: BigInt(1),
    totalPurchased: BigInt(11),
    purchaseCount: BigInt(2),
    nextPurchaseNonce: BigInt(2),
    lastOffer,
    lastPurchaseAt: BigInt(1_800_000_100),
    bump: 249,
    reserved: Array(46).fill(0),
  });
  const credits = getCoachClientCreditsDecoder().decode(encoded);

  assert.equal(encoded.length, 200);
  assert.deepEqual(
    projectCoachClientCreditSummary({
      credits,
      expectedCoachAuthority: coachAuthorityAddress,
      expectedClientWallet: CLIENT_WALLET,
    }),
    {
      coachAuthority: coachAuthorityAddress,
      clientWallet: CLIENT_WALLET,
      availableCredits: BigInt(8),
      reservedCredits: BigInt(1),
      totalPurchased: BigInt(11),
      purchaseCount: BigInt(2),
      nextPurchaseNonce: BigInt(2),
      lastOffer,
      lastPurchaseAt: BigInt(1_800_000_100),
    },
  );
  assert.throws(
    () =>
      projectCoachClientCreditSummary({
        credits,
        expectedCoachAuthority: coachAuthorityAddress,
        expectedClientWallet: RECOVERY_AUTHORITY,
      }),
    /different client wallet/u,
  );
});

test("reservation codec and projection expose one immutable booking receipt", async () => {
  const [coachAuthorityAddress] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: ORIGINAL_WALLET,
  });
  const [creditsAddress] = await deriveCoachClientCreditsAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthorityAddress,
    clientWallet: CLIENT_WALLET,
  });
  const encoded = getCreditReservationEncoder().encode({
    version: 1,
    coachClientCredits: creditsAddress,
    coachAuthority: coachAuthorityAddress,
    clientWallet: CLIENT_WALLET,
    bookingId: [...uuidToSeed(BOOKING_ID)],
    scheduledStartAt: BigInt(1_900_003_600),
    earlyReturnUntil: BigInt(1_900_001_800),
    status: CreditReservationStatus.Reserved,
    reservedAt: BigInt(1_900_000_000),
    resolvedAt: null,
    bump: 248,
    reserved: Array(44).fill(0),
  });
  const reservation = getCreditReservationDecoder().decode(encoded);

  // The generated codec emits the serialized `None` form; Anchor allocates the
  // account's full 200-byte maximum so a later `Some(i64)` fits in place.
  assert.equal(encoded.length, 192);
  assert.deepEqual(
    projectCreditReservationSummary({
      reservation,
      expectedCoachClientCredits: creditsAddress,
      expectedCoachAuthority: coachAuthorityAddress,
      expectedClientWallet: CLIENT_WALLET,
      expectedBookingId: BOOKING_ID,
    }),
    {
      coachClientCredits: creditsAddress,
      coachAuthority: coachAuthorityAddress,
      clientWallet: CLIENT_WALLET,
      bookingId: BOOKING_ID,
      scheduledStartAt: BigInt(1_900_003_600),
      earlyReturnUntil: BigInt(1_900_001_800),
      status: CreditReservationStatus.Reserved,
      reservedAt: BigInt(1_900_000_000),
      resolvedAt: null,
    },
  );
  assert.throws(
    () =>
      projectCreditReservationSummary({
        reservation,
        expectedCoachClientCredits: creditsAddress,
        expectedCoachAuthority: coachAuthorityAddress,
        expectedClientWallet: CLIENT_WALLET,
        expectedBookingId: OTHER_BOOKING_ID,
      }),
    /different booking/u,
  );
  assert.throws(
    () =>
      projectCreditReservationSummary({
        reservation,
        expectedCoachClientCredits: creditsAddress,
        expectedCoachAuthority: coachAuthorityAddress,
        expectedClientWallet: RECOVERY_AUTHORITY,
        expectedBookingId: BOOKING_ID,
      }),
    /different client wallet/u,
  );
});

test("offer display metadata remains bounded and non-authoritative", () => {
  assert.deepEqual(
    parseCoachOfferMetadata({
      title: " 10 Boxing Sessions ",
      service: " Boxing ",
      description:
        "Ten private boxing sessions with a fictional MovX demo coach.",
      imagePath: "/demo/coaches/boxing.webp",
      priceUsdcBaseUnits: 1,
    }),
    {
      valid: true,
      value: {
        title: "10 Boxing Sessions",
        service: "Boxing",
        description:
          "Ten private boxing sessions with a fictional MovX demo coach.",
        imagePath: "/demo/coaches/boxing.webp",
      },
    },
  );
  assert.equal(
    parseCoachOfferMetadata({
      title: "x",
      service: "x",
      description: "short",
      imagePath: "https://untrusted.example/image.png",
    }).valid,
    false,
  );
});
