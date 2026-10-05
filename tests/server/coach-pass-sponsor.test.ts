import assert from "node:assert/strict";
import test from "node:test";
import {
  blockhash,
  generateKeyPairSigner,
  getBase64Decoder,
  getTransactionDecoder,
  getTransactionEncoder,
  none,
  partiallySignTransactionWithSigners,
  signBytes,
  type Transaction,
} from "@solana/kit";
import type { CoachAuthority } from "../../clients/js/src/generated/accounts/coachAuthority";
import type { Offer } from "../../clients/js/src/generated/accounts/offer";
import { OfferStatus } from "../../clients/js/src/generated/types/offerStatus";
import {
  validateAndSponsorCoachPassBootstrapTransaction,
  validateAndSponsorCoachPassTransaction,
} from "../../src/server/solana/coach-pass-sponsor";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveOfferAddress,
  uuidToSeed,
} from "../../src/solana/coach-pass";
import {
  decodeCoachPassTransactionBase64,
  prepareCoachPassBootstrap,
  prepareCoachPassPurchase,
} from "../../src/solana/coach-pass-transaction";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";

async function preparedPurchase() {
  const [coachWallet, recoveryAuthority, clientWallet, platformPayer] =
    await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
    ]);
  const [coachAuthorityAddress, authorityBump] =
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
    bump: authorityBump,
    reserved: Array(47).fill(0),
  };
  const [offerAddress, offerBump] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(0),
  });
  const offer: Offer = {
    discriminator: new Uint8Array(8),
    coachAuthority: coachAuthorityAddress,
    paymentRecipient: coachWallet.address,
    paymentMint: DEVNET_EURC_MINT_ADDRESS,
    nonce: BigInt(0),
    priceEurcBaseUnits: BigInt(8_000_000),
    authorityEpoch: BigInt(0),
    createdAt: BigInt(1_900_000_000),
    validitySeconds: 0,
    sessionCount: 1,
    status: OfferStatus.Active,
    bump: offerBump,
    reserved: Array(47).fill(0),
    restrictedClient: none(),
    deactivatedAt: none(),
  };
  const prepared = await prepareCoachPassPurchase({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: platformPayer.address,
    lifetimeConstraint: {
      blockhash: blockhash("11111111111111111111111111111111"),
      lastValidBlockHeight: BigInt(1_234),
    },
    clientWalletAddress: clientWallet.address,
    coachAuthorityAddress,
    coachAuthority,
    offerAddress,
    offer,
    coachClientCredits: null,
    currentUnixSeconds: BigInt(1_900_000_010),
  });
  return { clientWallet, platformPayer, prepared };
}

function encodeTransaction(transaction: Transaction) {
  return getBase64Decoder().decode(getTransactionEncoder().encode(transaction));
}

test("platform payer countersigns only the exact wallet-authorized message", async () => {
  const fixture = await preparedPurchase();
  const unsigned = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(fixture.prepared.transactionBase64),
  );
  const walletSigned = await partiallySignTransactionWithSigners(
    [fixture.clientWallet],
    unsigned,
  );
  const walletSignedBase64 = encodeTransaction(walletSigned);
  const sponsored = await validateAndSponsorCoachPassTransaction({
    prepared: fixture.prepared,
    walletSignedTransactionBase64: walletSignedBase64,
    sponsor: {
      address: fixture.platformPayer.address,
      signer: fixture.platformPayer,
    },
  });
  const finalTransaction = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(sponsored.transactionBase64),
  );

  assert.ok(finalTransaction.signatures[fixture.clientWallet.address]);
  assert.ok(finalTransaction.signatures[fixture.platformPayer.address]);
  assert.equal(sponsored.transactionSignature.length >= 80, true);
});

test("platform payer rejects missing authority, message drift and pre-signing", async () => {
  const fixture = await preparedPurchase();
  const unsigned = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(fixture.prepared.transactionBase64),
  );
  const unsignedBase64 = encodeTransaction(unsigned);
  await assert.rejects(
    validateAndSponsorCoachPassTransaction({
      prepared: fixture.prepared,
      walletSignedTransactionBase64: unsignedBase64,
      sponsor: {
        address: fixture.platformPayer.address,
        signer: fixture.platformPayer,
      },
    }),
    /wallet signature is missing/u,
  );

  const walletSigned = await partiallySignTransactionWithSigners(
    [fixture.clientWallet],
    unsigned,
  );
  const driftedMessage = Uint8Array.from(walletSigned.messageBytes);
  driftedMessage[driftedMessage.length - 1] ^= 1;
  const driftedBase64 = encodeTransaction({
    ...walletSigned,
    messageBytes: driftedMessage as unknown as typeof walletSigned.messageBytes,
  });
  await assert.rejects(
    validateAndSponsorCoachPassTransaction({
      prepared: fixture.prepared,
      walletSignedTransactionBase64: driftedBase64,
      sponsor: {
        address: fixture.platformPayer.address,
        signer: fixture.platformPayer,
      },
    }),
    /does not match/u,
  );

  const alreadySponsored = await partiallySignTransactionWithSigners(
    [fixture.clientWallet, fixture.platformPayer],
    unsigned,
  );
  await assert.rejects(
    validateAndSponsorCoachPassTransaction({
      prepared: fixture.prepared,
      walletSignedTransactionBase64: encodeTransaction(alreadySponsored),
      sponsor: {
        address: fixture.platformPayer.address,
        signer: fixture.platformPayer,
      },
    }),
    /already contains a platform signature/u,
  );
});

test("platform payer rejects malformed payloads and mismatched preparation metadata", async () => {
  const fixture = await preparedPurchase();
  const otherSponsor = await generateKeyPairSigner();
  const unsigned = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(fixture.prepared.transactionBase64),
  );
  const walletSigned = await partiallySignTransactionWithSigners(
    [fixture.clientWallet],
    unsigned,
  );
  const walletSignedBase64 = encodeTransaction(walletSigned);

  await assert.rejects(
    validateAndSponsorCoachPassTransaction({
      prepared: fixture.prepared,
      walletSignedTransactionBase64: walletSignedBase64,
      sponsor: {
        address: otherSponsor.address,
        signer: otherSponsor,
      },
    }),
    /platform payer does not match/u,
  );
  await assert.rejects(
    validateAndSponsorCoachPassTransaction({
      prepared: fixture.prepared,
      walletSignedTransactionBase64: "not-base64!",
      sponsor: {
        address: fixture.platformPayer.address,
        signer: fixture.platformPayer,
      },
    }),
    /invalid Solana transaction/u,
  );
  await assert.rejects(
    validateAndSponsorCoachPassTransaction({
      prepared: {
        ...fixture.prepared,
        messageBase64: Buffer.from([1]).toString("base64"),
      },
      walletSignedTransactionBase64: walletSignedBase64,
      sponsor: {
        address: fixture.platformPayer.address,
        signer: fixture.platformPayer,
      },
    }),
    /does not match/u,
  );

  const otherAuthority = await generateKeyPairSigner();
  await assert.rejects(
    validateAndSponsorCoachPassTransaction({
      prepared: {
        ...fixture.prepared,
        summary: {
          ...fixture.prepared.summary,
          authorityAddress: otherAuthority.address,
        },
      },
      walletSignedTransactionBase64: walletSignedBase64,
      sponsor: {
        address: fixture.platformPayer.address,
        signer: fixture.platformPayer,
      },
    }),
    /unexpected signer set/u,
  );
});

test("platform payer cryptographically rejects an invalid authority signature", async () => {
  const fixture = await preparedPurchase();
  const attacker = await generateKeyPairSigner();
  const unsigned = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(fixture.prepared.transactionBase64),
  );
  const attackerSignature = await signBytes(
    attacker.keyPair.privateKey,
    unsigned.messageBytes,
  );
  const forged = {
    ...unsigned,
    signatures: Object.freeze({
      ...unsigned.signatures,
      [fixture.clientWallet.address]: attackerSignature,
    }),
  };

  await assert.rejects(
    validateAndSponsorCoachPassTransaction({
      prepared: fixture.prepared,
      walletSignedTransactionBase64: encodeTransaction(forged),
      sponsor: {
        address: fixture.platformPayer.address,
        signer: fixture.platformPayer,
      },
    }),
    /wallet signature is invalid/u,
  );
});

test("platform payer adds only its signature after both bootstrap authorities sign", async () => {
  const [coach, recovery, platformPayer] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const prepared = await prepareCoachPassBootstrap({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: platformPayer.address,
    lifetimeConstraint: {
      blockhash: blockhash("11111111111111111111111111111111"),
      lastValidBlockHeight: BigInt(1_234),
    },
    runId: RUN_ID,
    profileId: PROFILE_ID,
    coachWalletAddress: coach.address,
    recoveryAuthorityAddress: recovery.address,
    oneCreditPriceEurcBaseUnits: BigInt(10_000_000),
    tenCreditPriceEurcBaseUnits: BigInt(100_000_000),
  });
  const unsigned = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(prepared.transactionBase64),
  );
  const coachSigned = await partiallySignTransactionWithSigners(
    [coach],
    unsigned,
  );
  await assert.rejects(
    validateAndSponsorCoachPassBootstrapTransaction({
      prepared,
      walletSignedTransactionBase64: encodeTransaction(coachSigned),
      sponsor: { address: platformPayer.address, signer: platformPayer },
    }),
    /bootstrap signature is missing/u,
  );

  const walletSigned = await partiallySignTransactionWithSigners(
    [recovery],
    coachSigned,
  );
  const sponsored = await validateAndSponsorCoachPassBootstrapTransaction({
    prepared,
    walletSignedTransactionBase64: encodeTransaction(walletSigned),
    sponsor: { address: platformPayer.address, signer: platformPayer },
  });
  const finalTransaction = getTransactionDecoder().decode(
    decodeCoachPassTransactionBase64(sponsored.transactionBase64),
  );
  assert.ok(finalTransaction.signatures[coach.address]);
  assert.ok(finalTransaction.signatures[recovery.address]);
  assert.ok(finalTransaction.signatures[platformPayer.address]);
});
