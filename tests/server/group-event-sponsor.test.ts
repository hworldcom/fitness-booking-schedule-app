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
  type Transaction,
} from "@solana/kit";
import type { EventPool } from "../../clients/js/src/generated/accounts/eventPool";
import { EventPoolStatus } from "../../clients/js/src/generated/types/eventPoolStatus";
import { validateAndSponsorGroupEventTransaction } from "../../src/server/solana/group-event-sponsor";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
} from "../../src/solana/coach-pass";
import {
  deriveEventPoolAddress,
  deriveEventVaultAddress,
} from "../../src/solana/group-event";
import {
  decodeGroupEventTransactionBase64,
  prepareGroupEventSettlement,
} from "../../src/solana/group-event-transaction";

async function preparedSettlement() {
  const [authority, coachAuthority, payoutRecipient, platformPayer] =
    await Promise.all([
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
      generateKeyPairSigner(),
    ]);
  const [eventPoolAddress, eventPoolBump] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthority.address,
    nonce: BigInt(4),
  });
  const [vaultAddress, vaultBump] = await deriveEventVaultAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    eventPool: eventPoolAddress,
  });
  const eventPool: EventPool = {
    discriminator: new Uint8Array(8),
    version: 1,
    coachAuthority: coachAuthority.address,
    payoutRecipient: payoutRecipient.address,
    paymentMint: DEVNET_EURC_MINT_ADDRESS,
    vault: vaultAddress,
    nonce: BigInt(4),
    priceEurcBaseUnits: BigInt(10_000_000),
    minimumParticipants: 2,
    maximumParticipants: 5,
    participantCount: 1,
    totalFundedBaseUnits: BigInt(10_000_000),
    totalRefundedBaseUnits: BigInt(0),
    fundingDeadline: BigInt(1_900_000_000),
    eventStartAt: BigInt(1_900_003_600),
    eventEndAt: BigInt(1_900_007_200),
    createdAt: BigInt(1_899_990_000),
    status: EventPoolStatus.Funding,
    settledAt: none(),
    paidAt: none(),
    bump: eventPoolBump,
    vaultBump,
    reserved: Array(64).fill(0),
  };
  const prepared = await prepareGroupEventSettlement({
    eventId: "33333333-3333-4333-8333-333333333333",
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: platformPayer.address,
    lifetimeConstraint: {
      blockhash: blockhash("11111111111111111111111111111111"),
      lastValidBlockHeight: BigInt(1_234),
    },
    settlerWalletAddress: authority.address,
    eventPoolAddress,
    eventPool,
    currentUnixSeconds: eventPool.fundingDeadline,
  });
  return { authority, platformPayer, prepared };
}

function encodeTransaction(transaction: Transaction) {
  return getBase64Decoder().decode(getTransactionEncoder().encode(transaction));
}

test("platform payer countersigns only the exact group-event message", async () => {
  const fixture = await preparedSettlement();
  const unsigned = getTransactionDecoder().decode(
    decodeGroupEventTransactionBase64(fixture.prepared.transactionBase64),
  );
  const walletSigned = await partiallySignTransactionWithSigners(
    [fixture.authority],
    unsigned,
  );
  const sponsored = await validateAndSponsorGroupEventTransaction({
    prepared: fixture.prepared,
    walletSignedTransactionBase64: encodeTransaction(walletSigned),
    sponsor: {
      address: fixture.platformPayer.address,
      signer: fixture.platformPayer,
    },
  });
  const finalTransaction = getTransactionDecoder().decode(
    decodeGroupEventTransactionBase64(sponsored.transactionBase64),
  );
  assert.ok(finalTransaction.signatures[fixture.authority.address]);
  assert.ok(finalTransaction.signatures[fixture.platformPayer.address]);
  assert.ok(sponsored.transactionSignature.length >= 80);
});

test("platform payer rejects unsigned, changed and already-sponsored messages", async () => {
  const fixture = await preparedSettlement();
  const unsigned = getTransactionDecoder().decode(
    decodeGroupEventTransactionBase64(fixture.prepared.transactionBase64),
  );
  const sponsor = {
    address: fixture.platformPayer.address,
    signer: fixture.platformPayer,
  };
  await assert.rejects(
    validateAndSponsorGroupEventTransaction({
      prepared: fixture.prepared,
      walletSignedTransactionBase64: encodeTransaction(unsigned),
      sponsor,
    }),
    /wallet signature is missing/u,
  );

  const walletSigned = await partiallySignTransactionWithSigners(
    [fixture.authority],
    unsigned,
  );
  await assert.rejects(
    validateAndSponsorGroupEventTransaction({
      prepared: {
        ...fixture.prepared,
        messageBase64: Buffer.from([1]).toString("base64"),
      },
      walletSignedTransactionBase64: encodeTransaction(walletSigned),
      sponsor,
    }),
    /does not match/u,
  );

  const fullySigned = await partiallySignTransactionWithSigners(
    [fixture.authority, fixture.platformPayer],
    unsigned,
  );
  await assert.rejects(
    validateAndSponsorGroupEventTransaction({
      prepared: fixture.prepared,
      walletSignedTransactionBase64: encodeTransaction(fullySigned),
      sponsor,
    }),
    /already contains a platform signature/u,
  );
});
