import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  address,
  createClient,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getUtf8Encoder,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  getMintEncoder,
} from "@solana-program/token";
import { surfpool } from "@solana/surfpool/kit";
import {
  fetchCoachClientCredits,
  fetchMaybeCoachClientCredits,
} from "../clients/js/src/generated/accounts/coachClientCredits";
import { getCreateOfferInstruction } from "../clients/js/src/generated/instructions/createOffer";
import { getInitializeCoachAuthorityInstructionAsync } from "../clients/js/src/generated/instructions/initializeCoachAuthority";
import { getPurchaseFirstOfferInstructionAsync } from "../clients/js/src/generated/instructions/purchaseFirstOffer";
import { getPurchaseOfferInstructionAsync } from "../clients/js/src/generated/instructions/purchaseOffer";
import { MOVX_COACH_PASS_PROGRAM_ADDRESS } from "../clients/js/src/generated/programs/movxCoachPass";
import {
  DEVNET_USDC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveCoachClientCreditsAddress,
  deriveOfferAddress,
  uuidToSeed,
} from "../src/solana/coach-pass";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const OFFER_PRICE = BigInt(80_000_000);
const SEEDED_PURCHASES = BigInt(3);
const SESSION_COUNT = 10;
const TEST_SOL_BALANCE = 10_000_000_000;
const MINT_RENT_LAMPORTS = 1_461_600;
const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");

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

  const coachWallet = await generateKeyPairSigner();
  const recoveryAuthority = await generateKeyPairSigner();
  const clientWallet = await generateKeyPairSigner();
  const restrictedClient = await generateKeyPairSigner();
  const otherClient = await generateKeyPairSigner();
  const wrongRecipient = await generateKeyPairSigner();
  const alternateMint = await generateKeyPairSigner();
  client.surfnet.fundSolMany([
    { address: coachWallet.address, lamports: TEST_SOL_BALANCE },
    { address: clientWallet.address, lamports: TEST_SOL_BALANCE },
    { address: otherClient.address, lamports: TEST_SOL_BALANCE },
  ]);

  const mintData = getMintEncoder().encode({
    decimals: 6,
    freezeAuthority: null,
    isInitialized: true,
    mintAuthority: null,
    supply: OFFER_PRICE * SEEDED_PURCHASES,
  });
  client.surfnet.setAccount(
    DEVNET_USDC_MINT_ADDRESS,
    MINT_RENT_LAMPORTS,
    Uint8Array.from(mintData),
    TOKEN_PROGRAM_ADDRESS,
  );
  client.surfnet.setAccount(
    alternateMint.address,
    MINT_RENT_LAMPORTS,
    Uint8Array.from(mintData),
    TOKEN_PROGRAM_ADDRESS,
  );
  client.surfnet.setTokenAccount(
    clientWallet.address,
    DEVNET_USDC_MINT_ADDRESS,
    {
      amount: Number(OFFER_PRICE * BigInt(2)),
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
  client.surfnet.setTokenAccount(
    otherClient.address,
    DEVNET_USDC_MINT_ADDRESS,
    {
      amount: Number(OFFER_PRICE),
      state: "initialized",
    },
  );
  client.surfnet.setTokenAccount(
    wrongRecipient.address,
    DEVNET_USDC_MINT_ADDRESS,
    {
      amount: 0,
      state: "initialized",
    },
  );
  client.surfnet.setTokenAccount(clientWallet.address, alternateMint.address, {
    amount: Number(OFFER_PRICE),
    state: "initialized",
  });
  client.surfnet.setTokenAccount(coachWallet.address, alternateMint.address, {
    amount: 0,
    state: "initialized",
  });

  const clientTokenAccount = address(
    client.surfnet.getAta(clientWallet.address, DEVNET_USDC_MINT_ADDRESS),
  );
  const coachTokenAccount = address(
    client.surfnet.getAta(coachWallet.address, DEVNET_USDC_MINT_ADDRESS),
  );
  const wrongRecipientTokenAccount = address(
    client.surfnet.getAta(wrongRecipient.address, DEVNET_USDC_MINT_ADDRESS),
  );
  const otherClientTokenAccount = address(
    client.surfnet.getAta(otherClient.address, DEVNET_USDC_MINT_ADDRESS),
  );
  const alternateClientTokenAccount = address(
    client.surfnet.getAta(clientWallet.address, alternateMint.address),
  );
  const alternateCoachTokenAccount = address(
    client.surfnet.getAta(coachWallet.address, alternateMint.address),
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

  await client.sendTransaction([
    await getInitializeCoachAuthorityInstructionAsync({
      coachWallet,
      recoveryAuthority,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      runId: [...uuidToSeed(RUN_ID)],
      profileId: [...uuidToSeed(PROFILE_ID)],
    }),
  ]);
  await client.sendTransaction([
    getCreateOfferInstruction({
      coachWallet,
      coachAuthority,
      offer,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      args: {
        nonce: BigInt(0),
        priceUsdcBaseUnits: OFFER_PRICE,
        sessionCount: SESSION_COUNT,
        validitySeconds: 0,
        restrictedClient: null,
      },
    }),
  ]);

  const creditsBeforePurchase = await fetchMaybeCoachClientCredits(
    client.rpc,
    coachClientCredits,
  );
  assert.equal(creditsBeforePurchase.exists, false);

  const readState = async () => {
    const [credits, clientTokens, coachTokens] = await Promise.all([
      fetchCoachClientCredits(client.rpc, coachClientCredits),
      fetchToken(client.rpc, clientTokenAccount),
      fetchToken(client.rpc, coachTokenAccount),
    ]);
    return {
      availableCredits: credits.data.availableCredits,
      clientBalance: clientTokens.data.amount,
      coachBalance: coachTokens.data.amount,
      nextPurchaseNonce: credits.data.nextPurchaseNonce,
      purchaseCount: credits.data.purchaseCount,
      totalPurchased: credits.data.totalPurchased,
    };
  };

  await client.sendTransaction([
    await getPurchaseFirstOfferInstructionAsync({
      clientWallet,
      coachAuthority,
      offer,
      coachClientCredits,
      clientTokenAccount,
      coachTokenAccount,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    }),
  ]);
  const afterFirstPurchase = {
    availableCredits: BigInt(10),
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
    paymentMint: alternateMint.address,
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
    DEVNET_USDC_MINT_ADDRESS,
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
    DEVNET_USDC_MINT_ADDRESS,
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

  await client.sendTransaction([
    getCreateOfferInstruction({
      coachWallet,
      coachAuthority,
      offer: restrictedOffer,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      args: {
        nonce: BigInt(1),
        priceUsdcBaseUnits: OFFER_PRICE,
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
});
