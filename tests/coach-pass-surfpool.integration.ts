import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  address,
  createClient,
  createNoopSigner,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getUtf8Encoder,
  isNone,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  getMintEncoder,
} from "@solana-program/token";
import { surfpool } from "@solana/surfpool/kit";
import {
  fetchCoachAuthority,
  fetchMaybeCoachAuthority,
} from "../clients/js/src/generated/accounts/coachAuthority";
import {
  fetchCoachClientCredits,
  fetchMaybeCoachClientCredits,
} from "../clients/js/src/generated/accounts/coachClientCredits";
import { fetchCreditReservation } from "../clients/js/src/generated/accounts/creditReservation";
import { getConsumeBookingCreditInstruction } from "../clients/js/src/generated/instructions/consumeBookingCredit";
import { getCreateOfferInstruction } from "../clients/js/src/generated/instructions/createOffer";
import { getDeactivateOfferInstruction } from "../clients/js/src/generated/instructions/deactivateOffer";
import { getInitializeCoachAuthorityInstructionAsync } from "../clients/js/src/generated/instructions/initializeCoachAuthority";
import { getPurchaseFirstOfferInstructionAsync } from "../clients/js/src/generated/instructions/purchaseFirstOffer";
import { getPurchaseOfferInstructionAsync } from "../clients/js/src/generated/instructions/purchaseOffer";
import { getReserveBookingCreditInstructionAsync } from "../clients/js/src/generated/instructions/reserveBookingCredit";
import { getReturnBookingCreditInstruction } from "../clients/js/src/generated/instructions/returnBookingCredit";
import { getRotateCoachAuthorityInstruction } from "../clients/js/src/generated/instructions/rotateCoachAuthority";
import { MOVX_COACH_PASS_PROGRAM_ADDRESS } from "../clients/js/src/generated/programs/movxCoachPass";
import { CreditReservationStatus } from "../clients/js/src/generated/types/creditReservationStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveCoachClientCreditsAddress,
  deriveCreditReservationAddress,
  deriveOfferAddress,
  uuidToSeed,
} from "../src/solana/coach-pass";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const OFFER_PRICE = BigInt(80_000_000);
const SEEDED_PURCHASES = BigInt(3);
const SESSION_COUNT = 10;
const MINT_RENT_LAMPORTS = 1_461_600;
const BASE_TIMESTAMP = 1_900_000_000;
const EARLY_RETURN_BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const COACH_RETURN_BOOKING_ID = "44444444-4444-4444-8444-444444444444";
const CONSUMED_BOOKING_ID = "55555555-5555-4555-8555-555555555555";
const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");
const DEVNET_USDC_MINT_ADDRESS = address(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

test("Surfpool executes atomic first and later coach-pass purchases", async (t) => {
  const client = await createClient().use(
    surfpool({ surfnet: { offline: true } }),
  );
  t.after(() => client.surfnet.stop());

  assert.equal(
    MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    MOVX_COACH_PASS_PROGRAM_ADDRESS,
  );
  const deploymentSignature = client.surfnet.deploy({
    programId: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    soPath: resolve("target/deploy/movx_coach_pass.so"),
    idlPath: resolve("idl/movx_coach_pass.json"),
  });
  assert.ok(deploymentSignature.length > 0);
  await client.cheatcodes
    .timeTravel({ absoluteTimestamp: BASE_TIMESTAMP * 1_000 })
    .send();

  const coachWallet = await generateKeyPairSigner();
  const recoveryAuthority = await generateKeyPairSigner();
  const clientWallet = await generateKeyPairSigner();
  const restrictedClient = await generateKeyPairSigner();
  const otherClient = await generateKeyPairSigner();
  const wrongRecipient = await generateKeyPairSigner();
  const platformPayer = client.payer;

  assert.notEqual(platformPayer.address, coachWallet.address);
  assert.notEqual(platformPayer.address, recoveryAuthority.address);
  assert.notEqual(platformPayer.address, clientWallet.address);

  const getLamports = async (accountAddress: Parameters<typeof address>[0]) =>
    (await client.rpc.getBalance(address(accountAddress)).send()).value;
  const userWallets = [
    coachWallet.address,
    recoveryAuthority.address,
    clientWallet.address,
    restrictedClient.address,
    otherClient.address,
    wrongRecipient.address,
  ];
  const assertUsersNeedNoSol = async () => {
    const balances = await Promise.all(userWallets.map(getLamports));
    assert.deepEqual(
      balances,
      userWallets.map(() => BigInt(0)),
    );
  };
  const fundingEvidence: Array<{
    account: string;
    accountRentLamports: string;
    platformDebitLamports: string;
  }> = [];
  const assertPlatformFundedAccount = async (
    account: string,
    platformBalanceBefore: bigint,
    createdAccount: Parameters<typeof address>[0],
  ) => {
    const [platformBalanceAfter, accountRent] = await Promise.all([
      getLamports(platformPayer.address),
      getLamports(createdAccount),
    ]);
    assert.ok(accountRent > BigInt(0));
    assert.ok(platformBalanceBefore - platformBalanceAfter >= accountRent);
    fundingEvidence.push({
      account,
      accountRentLamports: accountRent.toString(),
      platformDebitLamports: (
        platformBalanceBefore - platformBalanceAfter
      ).toString(),
    });
    await assertUsersNeedNoSol();
    return platformBalanceAfter;
  };

  const mintData = getMintEncoder().encode({
    decimals: 6,
    freezeAuthority: null,
    isInitialized: true,
    mintAuthority: null,
    supply: OFFER_PRICE * SEEDED_PURCHASES,
  });
  client.surfnet.setAccount(
    DEVNET_EURC_MINT_ADDRESS,
    MINT_RENT_LAMPORTS,
    Uint8Array.from(mintData),
    TOKEN_PROGRAM_ADDRESS,
  );
  client.surfnet.setAccount(
    DEVNET_USDC_MINT_ADDRESS,
    MINT_RENT_LAMPORTS,
    Uint8Array.from(mintData),
    TOKEN_PROGRAM_ADDRESS,
  );
  client.surfnet.setTokenAccount(
    clientWallet.address,
    DEVNET_EURC_MINT_ADDRESS,
    {
      amount: Number(OFFER_PRICE * BigInt(2)),
      state: "initialized",
    },
  );
  client.surfnet.setTokenAccount(
    coachWallet.address,
    DEVNET_EURC_MINT_ADDRESS,
    {
      amount: 0,
      state: "initialized",
    },
  );
  client.surfnet.setTokenAccount(
    otherClient.address,
    DEVNET_EURC_MINT_ADDRESS,
    {
      amount: Number(OFFER_PRICE),
      state: "initialized",
    },
  );
  client.surfnet.setTokenAccount(
    wrongRecipient.address,
    DEVNET_EURC_MINT_ADDRESS,
    {
      amount: 0,
      state: "initialized",
    },
  );
  client.surfnet.setTokenAccount(
    clientWallet.address,
    DEVNET_USDC_MINT_ADDRESS,
    {
      amount: Number(OFFER_PRICE),
      state: "initialized",
    },
  );
  client.surfnet.setTokenAccount(
    coachWallet.address,
    DEVNET_USDC_MINT_ADDRESS,
    {
      amount: 0,
      state: "initialized",
    },
  );

  const clientTokenAccount = address(
    client.surfnet.getAta(clientWallet.address, DEVNET_EURC_MINT_ADDRESS),
  );
  const coachTokenAccount = address(
    client.surfnet.getAta(coachWallet.address, DEVNET_EURC_MINT_ADDRESS),
  );
  const wrongRecipientTokenAccount = address(
    client.surfnet.getAta(wrongRecipient.address, DEVNET_EURC_MINT_ADDRESS),
  );
  const otherClientTokenAccount = address(
    client.surfnet.getAta(otherClient.address, DEVNET_EURC_MINT_ADDRESS),
  );
  const alternateClientTokenAccount = address(
    client.surfnet.getAta(clientWallet.address, DEVNET_USDC_MINT_ADDRESS),
  );
  const alternateCoachTokenAccount = address(
    client.surfnet.getAta(coachWallet.address, DEVNET_USDC_MINT_ADDRESS),
  );
  const [eventAuthority] = await getProgramDerivedAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    seeds: [getUtf8Encoder().encode("__event_authority")],
  });
  const [coachAuthority] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: coachWallet.address,
  });
  const [offer] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(0),
  });
  const [restrictedOffer] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(1),
  });
  const [sponsorRejectedOffer] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(99),
  });
  const [coachClientCredits] = await deriveCoachClientCreditsAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    clientWallet: clientWallet.address,
  });
  const [otherClientCredits] = await deriveCoachClientCreditsAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    clientWallet: otherClient.address,
  });
  const [earlyReturnReservation] = await deriveCreditReservationAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachClientCredits,
    bookingId: EARLY_RETURN_BOOKING_ID,
  });
  const [coachReturnReservation] = await deriveCreditReservationAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachClientCredits,
    bookingId: COACH_RETURN_BOOKING_ID,
  });
  const [consumedReservation] = await deriveCreditReservationAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachClientCredits,
    bookingId: CONSUMED_BOOKING_ID,
  });

  await assertUsersNeedNoSol();
  await assert.rejects(async () =>
    client.sendTransaction([
      await getInitializeCoachAuthorityInstructionAsync({
        coachWallet: createNoopSigner(coachWallet.address),
        recoveryAuthority: createNoopSigner(recoveryAuthority.address),
        platformPayer,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
        runId: [...uuidToSeed(RUN_ID)],
        profileId: [...uuidToSeed(PROFILE_ID)],
      }),
    ]),
  );
  assert.equal(
    (await fetchMaybeCoachAuthority(client.rpc, coachAuthority)).exists,
    false,
  );

  const platformBeforeAuthority = await getLamports(platformPayer.address);
  await client.sendTransaction([
    await getInitializeCoachAuthorityInstructionAsync({
      coachWallet,
      recoveryAuthority,
      platformPayer,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      runId: [...uuidToSeed(RUN_ID)],
      profileId: [...uuidToSeed(PROFILE_ID)],
    }),
  ]);
  await assertPlatformFundedAccount(
    "CoachAuthority",
    platformBeforeAuthority,
    coachAuthority,
  );

  const authorityBeforeSponsorRotation = await fetchCoachAuthority(
    client.rpc,
    coachAuthority,
  );
  await assert.rejects(() =>
    client.sendTransaction([
      getRotateCoachAuthorityInstruction({
        coachAuthority,
        recoveryAuthority: platformPayer,
        replacementWallet: platformPayer,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  const authorityAfterSponsorRotation = await fetchCoachAuthority(
    client.rpc,
    coachAuthority,
  );
  assert.equal(
    authorityAfterSponsorRotation.data.currentWallet,
    authorityBeforeSponsorRotation.data.currentWallet,
  );
  assert.equal(
    authorityAfterSponsorRotation.data.authorityEpoch,
    authorityBeforeSponsorRotation.data.authorityEpoch,
  );

  await assert.rejects(() =>
    client.sendTransaction([
      getCreateOfferInstruction({
        coachWallet: createNoopSigner(coachWallet.address),
        platformPayer,
        coachAuthority,
        offer: sponsorRejectedOffer,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
        args: {
          nonce: BigInt(99),
          priceEurcBaseUnits: OFFER_PRICE,
          sessionCount: SESSION_COUNT,
          validitySeconds: 0,
          restrictedClient: null,
        },
      }),
    ]),
  );
  assert.equal(await getLamports(sponsorRejectedOffer), BigInt(0));

  const platformBeforeOffer = await getLamports(platformPayer.address);
  await client.sendTransaction([
    getCreateOfferInstruction({
      coachWallet,
      platformPayer,
      coachAuthority,
      offer,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      args: {
        nonce: BigInt(0),
        priceEurcBaseUnits: OFFER_PRICE,
        sessionCount: SESSION_COUNT,
        validitySeconds: 0,
        restrictedClient: null,
      },
    }),
  ]);
  await assertPlatformFundedAccount("Offer", platformBeforeOffer, offer);

  await assert.rejects(() =>
    client.sendTransaction([
      getDeactivateOfferInstruction({
        coachWallet: platformPayer,
        coachAuthority,
        offer,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );

  const creditsBeforePurchase = await fetchMaybeCoachClientCredits(
    client.rpc,
    coachClientCredits,
  );
  assert.equal(creditsBeforePurchase.exists, false);

  const [clientTokensBeforeSponsorPurchase, coachTokensBeforeSponsorPurchase] =
    await Promise.all([
      fetchToken(client.rpc, clientTokenAccount),
      fetchToken(client.rpc, coachTokenAccount),
    ]);
  await assert.rejects(async () =>
    client.sendTransaction([
      await getPurchaseFirstOfferInstructionAsync({
        clientWallet: createNoopSigner(clientWallet.address),
        platformPayer,
        coachAuthority,
        offer,
        coachClientCredits,
        clientTokenAccount,
        coachTokenAccount,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  const [
    creditsAfterSponsorPurchase,
    clientTokensAfterSponsorPurchase,
    coachTokensAfterSponsorPurchase,
  ] = await Promise.all([
    fetchMaybeCoachClientCredits(client.rpc, coachClientCredits),
    fetchToken(client.rpc, clientTokenAccount),
    fetchToken(client.rpc, coachTokenAccount),
  ]);
  assert.equal(creditsAfterSponsorPurchase.exists, false);
  assert.equal(
    clientTokensAfterSponsorPurchase.data.amount,
    clientTokensBeforeSponsorPurchase.data.amount,
  );
  assert.equal(
    coachTokensAfterSponsorPurchase.data.amount,
    coachTokensBeforeSponsorPurchase.data.amount,
  );

  const readState = async () => {
    const [credits, clientTokens, coachTokens] = await Promise.all([
      fetchCoachClientCredits(client.rpc, coachClientCredits),
      fetchToken(client.rpc, clientTokenAccount),
      fetchToken(client.rpc, coachTokenAccount),
    ]);
    return {
      availableCredits: credits.data.availableCredits,
      reservedCredits: credits.data.reservedCredits,
      clientBalance: clientTokens.data.amount,
      coachBalance: coachTokens.data.amount,
      nextPurchaseNonce: credits.data.nextPurchaseNonce,
      purchaseCount: credits.data.purchaseCount,
      totalPurchased: credits.data.totalPurchased,
    };
  };

  const platformBeforeFirstPurchase = await getLamports(platformPayer.address);
  await client.sendTransaction([
    await getPurchaseFirstOfferInstructionAsync({
      clientWallet,
      platformPayer,
      coachAuthority,
      offer,
      coachClientCredits,
      clientTokenAccount,
      coachTokenAccount,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    }),
  ]);
  await assertPlatformFundedAccount(
    "CoachClientCredits",
    platformBeforeFirstPurchase,
    coachClientCredits,
  );
  const afterFirstPurchase = {
    availableCredits: BigInt(10),
    reservedCredits: BigInt(0),
    clientBalance: OFFER_PRICE,
    coachBalance: OFFER_PRICE,
    nextPurchaseNonce: BigInt(1),
    purchaseCount: BigInt(1),
    totalPurchased: BigInt(10),
  };
  assert.deepEqual(await readState(), afterFirstPurchase);

  const wrongDestinationPurchase = await getPurchaseOfferInstructionAsync({
    clientWallet,
    coachAuthority,
    offer,
    coachClientCredits,
    clientTokenAccount,
    coachTokenAccount: wrongRecipientTokenAccount,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    expectedPurchaseNonce: BigInt(1),
  });
  await assert.rejects(() =>
    client.sendTransaction([wrongDestinationPurchase]),
  );
  assert.deepEqual(await readState(), afterFirstPurchase);

  const wrongSourceOwnerPurchase = await getPurchaseOfferInstructionAsync({
    clientWallet,
    coachAuthority,
    offer,
    coachClientCredits,
    clientTokenAccount: otherClientTokenAccount,
    coachTokenAccount,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    expectedPurchaseNonce: BigInt(1),
  });
  await assert.rejects(() =>
    client.sendTransaction([wrongSourceOwnerPurchase]),
  );
  assert.deepEqual(await readState(), afterFirstPurchase);

  const wrongTokenProgramPurchase = await getPurchaseOfferInstructionAsync({
    clientWallet,
    coachAuthority,
    offer,
    coachClientCredits,
    clientTokenAccount,
    coachTokenAccount,
    tokenProgram: SYSTEM_PROGRAM_ADDRESS,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    expectedPurchaseNonce: BigInt(1),
  });
  await assert.rejects(() =>
    client.sendTransaction([wrongTokenProgramPurchase]),
  );
  assert.deepEqual(await readState(), afterFirstPurchase);

  const wrongMintPurchase = await getPurchaseOfferInstructionAsync({
    clientWallet,
    coachAuthority,
    offer,
    coachClientCredits,
    paymentMint: DEVNET_USDC_MINT_ADDRESS,
    clientTokenAccount: alternateClientTokenAccount,
    coachTokenAccount: alternateCoachTokenAccount,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    expectedPurchaseNonce: BigInt(1),
  });
  await assert.rejects(() => client.sendTransaction([wrongMintPurchase]));
  assert.deepEqual(await readState(), afterFirstPurchase);

  const invalidDecimalsMintData = getMintEncoder().encode({
    decimals: 5,
    freezeAuthority: null,
    isInitialized: true,
    mintAuthority: null,
    supply: OFFER_PRICE * SEEDED_PURCHASES,
  });
  client.surfnet.setAccount(
    DEVNET_EURC_MINT_ADDRESS,
    MINT_RENT_LAMPORTS,
    Uint8Array.from(invalidDecimalsMintData),
    TOKEN_PROGRAM_ADDRESS,
  );
  const invalidDecimalsPurchase = await getPurchaseOfferInstructionAsync({
    clientWallet,
    coachAuthority,
    offer,
    coachClientCredits,
    clientTokenAccount,
    coachTokenAccount,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    expectedPurchaseNonce: BigInt(1),
  });
  await assert.rejects(() => client.sendTransaction([invalidDecimalsPurchase]));
  assert.deepEqual(await readState(), afterFirstPurchase);
  client.surfnet.setAccount(
    DEVNET_EURC_MINT_ADDRESS,
    MINT_RENT_LAMPORTS,
    Uint8Array.from(mintData),
    TOKEN_PROGRAM_ADDRESS,
  );

  await client.sendTransaction([
    await getPurchaseOfferInstructionAsync({
      clientWallet,
      coachAuthority,
      offer,
      coachClientCredits,
      clientTokenAccount,
      coachTokenAccount,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      expectedPurchaseNonce: BigInt(1),
    }),
  ]);
  const afterSecondPurchase = {
    availableCredits: BigInt(20),
    reservedCredits: BigInt(0),
    clientBalance: BigInt(0),
    coachBalance: OFFER_PRICE * BigInt(2),
    nextPurchaseNonce: BigInt(2),
    purchaseCount: BigInt(2),
    totalPurchased: BigInt(20),
  };
  assert.deepEqual(await readState(), afterSecondPurchase);

  const replayedPurchase = await getPurchaseOfferInstructionAsync({
    clientWallet,
    coachAuthority,
    offer,
    coachClientCredits,
    clientTokenAccount,
    coachTokenAccount,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    expectedPurchaseNonce: BigInt(1),
  });
  await assert.rejects(() => client.sendTransaction([replayedPurchase]));
  assert.deepEqual(await readState(), afterSecondPurchase);

  const insufficientFundsPurchase = await getPurchaseOfferInstructionAsync({
    clientWallet,
    coachAuthority,
    offer,
    coachClientCredits,
    clientTokenAccount,
    coachTokenAccount,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    expectedPurchaseNonce: BigInt(2),
  });
  await assert.rejects(() =>
    client.sendTransaction([insufficientFundsPurchase]),
  );
  assert.deepEqual(await readState(), afterSecondPurchase);

  const sponsorOnlyReserve = await getReserveBookingCreditInstructionAsync({
    clientWallet: createNoopSigner(clientWallet.address),
    platformPayer,
    coachAuthority,
    coachClientCredits,
    creditReservation: earlyReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    bookingId: [...uuidToSeed(EARLY_RETURN_BOOKING_ID)],
    scheduledStartAt: BigInt(BASE_TIMESTAMP + 10_000),
    earlyReturnUntil: BigInt(BASE_TIMESTAMP + 5_000),
  });
  await assert.rejects(() => client.sendTransaction([sponsorOnlyReserve]));
  assert.equal(await getLamports(earlyReturnReservation), BigInt(0));

  const reserveEarlyReturn = await getReserveBookingCreditInstructionAsync({
    clientWallet,
    platformPayer,
    coachAuthority,
    coachClientCredits,
    creditReservation: earlyReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    bookingId: [...uuidToSeed(EARLY_RETURN_BOOKING_ID)],
    scheduledStartAt: BigInt(BASE_TIMESTAMP + 10_000),
    earlyReturnUntil: BigInt(BASE_TIMESTAMP + 5_000),
  });
  const platformBeforeEarlyReservation = await getLamports(
    platformPayer.address,
  );
  await client.sendTransaction([reserveEarlyReturn]);
  await assertPlatformFundedAccount(
    "CreditReservation:early-return",
    platformBeforeEarlyReservation,
    earlyReturnReservation,
  );
  assert.deepEqual(await readState(), {
    ...afterSecondPurchase,
    availableCredits: BigInt(19),
    reservedCredits: BigInt(1),
  });
  const earlyReceipt = await fetchCreditReservation(
    client.rpc,
    earlyReturnReservation,
  );
  assert.equal(earlyReceipt.data.status, CreditReservationStatus.Reserved);
  assert.equal(earlyReceipt.data.coachClientCredits, coachClientCredits);
  assert.equal(earlyReceipt.data.coachAuthority, coachAuthority);
  assert.equal(earlyReceipt.data.clientWallet, clientWallet.address);
  assert.equal(isNone(earlyReceipt.data.resolvedAt), true);

  await assert.rejects(() => client.sendTransaction([reserveEarlyReturn]));
  assert.deepEqual(await readState(), {
    ...afterSecondPurchase,
    availableCredits: BigInt(19),
    reservedCredits: BigInt(1),
  });

  const consumeEarlyReturn = getConsumeBookingCreditInstruction({
    coachWallet,
    coachAuthority,
    coachClientCredits,
    creditReservation: earlyReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await assert.rejects(() => client.sendTransaction([consumeEarlyReturn]));
  assert.deepEqual(await readState(), {
    ...afterSecondPurchase,
    availableCredits: BigInt(19),
    reservedCredits: BigInt(1),
  });

  const sponsorReturn = getReturnBookingCreditInstruction({
    resolutionAuthority: platformPayer,
    coachAuthority,
    coachClientCredits,
    creditReservation: earlyReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await assert.rejects(() => client.sendTransaction([sponsorReturn]));

  const clientReturn = getReturnBookingCreditInstruction({
    resolutionAuthority: clientWallet,
    coachAuthority,
    coachClientCredits,
    creditReservation: earlyReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await client.sendTransaction([clientReturn]);
  assert.deepEqual(await readState(), afterSecondPurchase);
  const returnedEarlyReceipt = await fetchCreditReservation(
    client.rpc,
    earlyReturnReservation,
  );
  assert.equal(
    returnedEarlyReceipt.data.status,
    CreditReservationStatus.Returned,
  );
  assert.equal(isNone(returnedEarlyReceipt.data.resolvedAt), false);
  await assert.rejects(() => client.sendTransaction([clientReturn]));
  assert.deepEqual(await readState(), afterSecondPurchase);

  const reserveCoachReturn = await getReserveBookingCreditInstructionAsync({
    clientWallet,
    platformPayer,
    coachAuthority,
    coachClientCredits,
    creditReservation: coachReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    bookingId: [...uuidToSeed(COACH_RETURN_BOOKING_ID)],
    scheduledStartAt: BigInt(BASE_TIMESTAMP + 20_000),
    earlyReturnUntil: BigInt(BASE_TIMESTAMP + 100),
  });
  const reserveConsumed = await getReserveBookingCreditInstructionAsync({
    clientWallet,
    platformPayer,
    coachAuthority,
    coachClientCredits,
    creditReservation: consumedReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    bookingId: [...uuidToSeed(CONSUMED_BOOKING_ID)],
    scheduledStartAt: BigInt(BASE_TIMESTAMP + 1_000),
    earlyReturnUntil: BigInt(BASE_TIMESTAMP + 500),
  });
  const platformBeforeCoachReturnReservation = await getLamports(
    platformPayer.address,
  );
  await client.sendTransaction([reserveCoachReturn]);
  await assertPlatformFundedAccount(
    "CreditReservation:coach-return",
    platformBeforeCoachReturnReservation,
    coachReturnReservation,
  );
  const platformBeforeConsumedReservation = await getLamports(
    platformPayer.address,
  );
  await client.sendTransaction([reserveConsumed]);
  await assertPlatformFundedAccount(
    "CreditReservation:consume",
    platformBeforeConsumedReservation,
    consumedReservation,
  );
  assert.deepEqual(await readState(), {
    ...afterSecondPurchase,
    availableCredits: BigInt(18),
    reservedCredits: BigInt(2),
  });

  await client.cheatcodes
    .timeTravel({ absoluteTimestamp: (BASE_TIMESTAMP + 200) * 1_000 })
    .send();
  const lateClientReturn = getReturnBookingCreditInstruction({
    resolutionAuthority: clientWallet,
    coachAuthority,
    coachClientCredits,
    creditReservation: coachReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await assert.rejects(() => client.sendTransaction([lateClientReturn]));
  assert.deepEqual(await readState(), {
    ...afterSecondPurchase,
    availableCredits: BigInt(18),
    reservedCredits: BigInt(2),
  });

  const substitutedLedgerReturn = getReturnBookingCreditInstruction({
    resolutionAuthority: coachWallet,
    coachAuthority,
    coachClientCredits: otherClientCredits,
    creditReservation: coachReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await assert.rejects(() => client.sendTransaction([substitutedLedgerReturn]));

  const coachReturn = getReturnBookingCreditInstruction({
    resolutionAuthority: coachWallet,
    coachAuthority,
    coachClientCredits,
    creditReservation: coachReturnReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await client.sendTransaction([coachReturn]);
  assert.deepEqual(await readState(), {
    ...afterSecondPurchase,
    availableCredits: BigInt(19),
    reservedCredits: BigInt(1),
  });
  const returnedCoachReceipt = await fetchCreditReservation(
    client.rpc,
    coachReturnReservation,
  );
  assert.equal(
    returnedCoachReceipt.data.status,
    CreditReservationStatus.Returned,
  );

  const prematureConsume = getConsumeBookingCreditInstruction({
    coachWallet,
    coachAuthority,
    coachClientCredits,
    creditReservation: consumedReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await assert.rejects(() => client.sendTransaction([prematureConsume]));
  const sponsorConsume = getConsumeBookingCreditInstruction({
    coachWallet: platformPayer,
    coachAuthority,
    coachClientCredits,
    creditReservation: consumedReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await client.cheatcodes
    .timeTravel({ absoluteTimestamp: (BASE_TIMESTAMP + 1_001) * 1_000 })
    .send();
  await assert.rejects(() => client.sendTransaction([sponsorConsume]));

  const coachConsume = getConsumeBookingCreditInstruction({
    coachWallet,
    coachAuthority,
    coachClientCredits,
    creditReservation: consumedReservation,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await client.sendTransaction([coachConsume]);
  assert.deepEqual(await readState(), {
    ...afterSecondPurchase,
    availableCredits: BigInt(19),
    reservedCredits: BigInt(0),
  });
  const consumedReceipt = await fetchCreditReservation(
    client.rpc,
    consumedReservation,
  );
  assert.equal(consumedReceipt.data.status, CreditReservationStatus.Consumed);
  assert.equal(isNone(consumedReceipt.data.resolvedAt), false);
  await assert.rejects(() => client.sendTransaction([coachConsume]));
  await assert.rejects(() =>
    client.sendTransaction([
      getReturnBookingCreditInstruction({
        resolutionAuthority: coachWallet,
        coachAuthority,
        coachClientCredits,
        creditReservation: consumedReservation,
        eventAuthority,
        program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      }),
    ]),
  );
  assert.deepEqual(await readState(), {
    ...afterSecondPurchase,
    availableCredits: BigInt(19),
    reservedCredits: BigInt(0),
  });

  await client.sendTransaction([
    getCreateOfferInstruction({
      coachWallet,
      platformPayer,
      coachAuthority,
      offer: restrictedOffer,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      args: {
        nonce: BigInt(1),
        priceEurcBaseUnits: OFFER_PRICE,
        sessionCount: 1,
        validitySeconds: 0,
        restrictedClient: restrictedClient.address,
      },
    }),
  ]);
  const [otherTokensBefore, coachTokensBefore, otherCreditsBefore] =
    await Promise.all([
      fetchToken(client.rpc, otherClientTokenAccount),
      fetchToken(client.rpc, coachTokenAccount),
      fetchMaybeCoachClientCredits(client.rpc, otherClientCredits),
    ]);
  assert.equal(otherCreditsBefore.exists, false);

  const wrongClientPurchase = await getPurchaseFirstOfferInstructionAsync({
    clientWallet: otherClient,
    platformPayer,
    coachAuthority,
    offer: restrictedOffer,
    coachClientCredits: otherClientCredits,
    clientTokenAccount: otherClientTokenAccount,
    coachTokenAccount,
    eventAuthority,
    program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
  });
  await assert.rejects(() => client.sendTransaction([wrongClientPurchase]));

  const [otherTokensAfter, coachTokensAfter, otherCreditsAfter] =
    await Promise.all([
      fetchToken(client.rpc, otherClientTokenAccount),
      fetchToken(client.rpc, coachTokenAccount),
      fetchMaybeCoachClientCredits(client.rpc, otherClientCredits),
    ]);
  assert.equal(otherTokensAfter.data.amount, otherTokensBefore.data.amount);
  assert.equal(coachTokensAfter.data.amount, coachTokensBefore.data.amount);
  assert.equal(otherCreditsAfter.exists, false);
  await assertUsersNeedNoSol();
  t.diagnostic(`platform funding evidence ${JSON.stringify(fundingEvidence)}`);
});
