import assert from "node:assert/strict";
import test from "node:test";
import { ASSOCIATED_TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  address,
  assertIsInstructionWithAccounts,
  assertIsInstructionWithData,
  blockhash,
  decompileTransactionMessage,
  generateKeyPairSigner,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  none,
} from "@solana/kit";
import type { CoachAuthority } from "../clients/js/src/generated/accounts/coachAuthority";
import type { Contribution } from "../clients/js/src/generated/accounts/contribution";
import type { EventPool } from "../clients/js/src/generated/accounts/eventPool";
import { parseClaimEventPayoutInstruction } from "../clients/js/src/generated/instructions/claimEventPayout";
import { parseClaimEventRefundInstruction } from "../clients/js/src/generated/instructions/claimEventRefund";
import { parseCreateEventPoolInstruction } from "../clients/js/src/generated/instructions/createEventPool";
import { parseFundEventInstruction } from "../clients/js/src/generated/instructions/fundEvent";
import { parseSettleEventInstruction } from "../clients/js/src/generated/instructions/settleEvent";
import { ContributionStatus } from "../clients/js/src/generated/types/contributionStatus";
import { EventPoolStatus } from "../clients/js/src/generated/types/eventPoolStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  uuidToSeed,
} from "../src/solana/coach-pass";
import {
  deriveContributionAddress,
  deriveEventPoolAddress,
  deriveEventVaultAddress,
} from "../src/solana/group-event";
import {
  decodeGroupEventTransactionBase64,
  matchesPreparedGroupEventMessage,
  prepareGroupEventCreation,
  prepareGroupEventFunding,
  prepareGroupEventPayout,
  prepareGroupEventRefund,
  prepareGroupEventSettlement,
  type PreparedGroupEventTransaction,
} from "../src/solana/group-event-transaction";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const LIFETIME = {
  blockhash: blockhash("11111111111111111111111111111111"),
  lastValidBlockHeight: BigInt(4_321),
};
const NOW = BigInt(1_900_000_000);
const DEADLINE = BigInt(1_900_003_600);
const START = BigInt(1_900_007_200);
const END = BigInt(1_900_010_800);

async function groupEventFixture() {
  const [coachWallet, recoveryAuthority, participantWallet, platformPayer] =
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
    eventSequence: BigInt(9),
    bump: coachAuthorityBump,
    reserved: Array(47).fill(0),
  };
  const [eventPoolAddress, eventPoolBump] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(9),
  });
  const [vaultAddress, vaultBump] = await deriveEventVaultAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    eventPool: eventPoolAddress,
  });
  const eventPool: EventPool = {
    discriminator: new Uint8Array(8),
    version: 1,
    coachAuthority: coachAuthorityAddress,
    payoutRecipient: coachWallet.address,
    paymentMint: DEVNET_EURC_MINT_ADDRESS,
    vault: vaultAddress,
    nonce: BigInt(9),
    priceEurcBaseUnits: BigInt(25_000_000),
    minimumParticipants: 2,
    maximumParticipants: 12,
    participantCount: 1,
    totalFundedBaseUnits: BigInt(25_000_000),
    totalRefundedBaseUnits: BigInt(0),
    fundingDeadline: DEADLINE,
    eventStartAt: START,
    eventEndAt: END,
    createdAt: NOW,
    status: EventPoolStatus.Funding,
    settledAt: none(),
    paidAt: none(),
    bump: eventPoolBump,
    vaultBump,
    reserved: Array(64).fill(0),
  };
  const [contributionAddress, contributionBump] =
    await deriveContributionAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      eventPool: eventPoolAddress,
      participantWallet: participantWallet.address,
    });
  const contribution: Contribution = {
    discriminator: new Uint8Array(8),
    version: 1,
    eventPool: eventPoolAddress,
    participantWallet: participantWallet.address,
    amountEurcBaseUnits: BigInt(25_000_000),
    status: ContributionStatus.Funded,
    fundedAt: NOW + BigInt(100),
    refundedAt: none(),
    bump: contributionBump,
    reserved: Array(36).fill(0),
  };
  return {
    coachWallet,
    participantWallet,
    platformPayer,
    coachAuthorityAddress,
    coachAuthority,
    eventPoolAddress,
    vaultAddress,
    eventPool,
    contributionAddress,
    contribution,
  };
}

function common(fixture: Awaited<ReturnType<typeof groupEventFixture>>) {
  return {
    eventId: EVENT_ID,
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    platformPayerAddress: fixture.platformPayer.address,
    lifetimeConstraint: LIFETIME,
  } as const;
}

function decompilePrepared(prepared: PreparedGroupEventTransaction) {
  const transaction = getTransactionDecoder().decode(
    decodeGroupEventTransactionBase64(prepared.transactionBase64),
  );
  return {
    transaction,
    message: decompileTransactionMessage(
      getCompiledTransactionMessageDecoder().decode(transaction.messageBytes),
      { lastValidBlockHeight: BigInt(prepared.lastValidBlockHeight) },
    ),
  };
}

test("pool creation freezes exact EURC terms and distinct coach identities", async () => {
  const fixture = await groupEventFixture();
  const prepared = await prepareGroupEventCreation({
    ...common(fixture),
    coachWalletAddress: fixture.coachWallet.address,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    nonce: BigInt(9),
    seatPriceEurcBaseUnits: BigInt(25_000_000),
    minimumParticipants: 2,
    maximumParticipants: 12,
    fundingDeadlineUnixSeconds: DEADLINE,
    eventStartUnixSeconds: START,
    eventEndUnixSeconds: END,
    currentUnixSeconds: NOW,
  });

  assert.equal(prepared.summary.operation, "create-event-pool");
  assert.equal(prepared.summary.eventPoolAddress, fixture.eventPoolAddress);
  assert.equal(prepared.summary.vaultAddress, fixture.vaultAddress);
  assert.equal(
    prepared.summary.coachAuthorityAddress,
    fixture.coachAuthorityAddress,
  );
  assert.equal(
    prepared.summary.payoutRecipientAddress,
    fixture.coachWallet.address,
  );
  assert.notEqual(
    prepared.summary.coachAuthorityAddress,
    prepared.summary.payoutRecipientAddress,
  );
  assert.equal(prepared.summary.userPaysSol, false);
  assert.doesNotThrow(() => JSON.stringify(prepared));

  const decoded = decompilePrepared(prepared);
  assert.deepEqual(
    Object.keys(decoded.transaction.signatures).sort(),
    [fixture.coachWallet.address, fixture.platformPayer.address].sort(),
  );
  assert.equal(decoded.message.instructions.length, 1);
  const instruction = decoded.message.instructions[0]!;
  assertIsInstructionWithAccounts(instruction);
  assertIsInstructionWithData(instruction);
  const parsed = parseCreateEventPoolInstruction(instruction);
  assert.equal(
    parsed.accounts.coachAuthority.address,
    fixture.coachAuthorityAddress,
  );
  assert.equal(
    parsed.accounts.coachWallet.address,
    fixture.coachWallet.address,
  );
  assert.equal(parsed.data.args.priceEurcBaseUnits, BigInt(25_000_000));
});

test("funding and settlement prepare only the exact eligible pool transition", async () => {
  const fixture = await groupEventFixture();
  const funding = await prepareGroupEventFunding({
    ...common(fixture),
    participantWalletAddress: fixture.participantWallet.address,
    eventPoolAddress: fixture.eventPoolAddress,
    eventPool: fixture.eventPool,
    currentUnixSeconds: NOW + BigInt(500),
  });
  const settlement = await prepareGroupEventSettlement({
    ...common(fixture),
    settlerWalletAddress: fixture.participantWallet.address,
    eventPoolAddress: fixture.eventPoolAddress,
    eventPool: fixture.eventPool,
    currentUnixSeconds: DEADLINE,
  });

  assert.equal(funding.summary.operation, "fund-event-seat");
  assert.equal(
    funding.summary.contributionAddress,
    fixture.contributionAddress,
  );
  assert.equal(funding.summary.seatPriceEurcBaseUnits, "25000000");
  const fundInstruction = decompilePrepared(funding).message.instructions[0]!;
  assertIsInstructionWithAccounts(fundInstruction);
  assertIsInstructionWithData(fundInstruction);
  const parsedFund = parseFundEventInstruction(fundInstruction);
  assert.equal(
    parsedFund.accounts.participantWallet.address,
    fixture.participantWallet.address,
  );
  assert.equal(parsedFund.accounts.eventPool.address, fixture.eventPoolAddress);

  assert.equal(settlement.summary.operation, "settle-event-pool");
  assert.equal(settlement.summary.expectedOutcome, "failed");
  const settleInstruction =
    decompilePrepared(settlement).message.instructions[0]!;
  assertIsInstructionWithAccounts(settleInstruction);
  assertIsInstructionWithData(settleInstruction);
  assert.equal(
    parseSettleEventInstruction(settleInstruction).accounts.settler.address,
    fixture.participantWallet.address,
  );
});

test("payout and refund preserve immutable destinations and platform-paid ATA rent", async () => {
  const fixture = await groupEventFixture();
  const payout = await prepareGroupEventPayout({
    ...common(fixture),
    coachWalletAddress: fixture.coachWallet.address,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    coachAuthority: fixture.coachAuthority,
    eventPoolAddress: fixture.eventPoolAddress,
    eventPool: {
      ...fixture.eventPool,
      participantCount: 2,
      totalFundedBaseUnits: BigInt(50_000_000),
      status: EventPoolStatus.Succeeded,
    },
  });
  const refund = await prepareGroupEventRefund({
    ...common(fixture),
    participantWalletAddress: fixture.participantWallet.address,
    eventPoolAddress: fixture.eventPoolAddress,
    eventPool: {
      ...fixture.eventPool,
      status: EventPoolStatus.Failed,
    },
    contributionAddress: fixture.contributionAddress,
    contribution: fixture.contribution,
  });

  if (
    payout.summary.operation !== "claim-event-payout" ||
    refund.summary.operation !== "claim-event-refund"
  ) {
    assert.fail("Expected payout and refund approval summaries.");
  }

  assert.equal(
    payout.summary.payoutRecipientAddress,
    fixture.coachWallet.address,
  );
  assert.equal(payout.summary.amountEurcBaseUnits, "50000000");
  assert.equal(refund.summary.amountEurcBaseUnits, "25000000");
  for (const prepared of [payout, refund]) {
    const decoded = decompilePrepared(prepared);
    assert.equal(
      decoded.message.instructions[0]!.programAddress,
      ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    );
    assert.deepEqual(
      Object.keys(decoded.transaction.signatures).sort(),
      [prepared.summary.authorityAddress, fixture.platformPayer.address].sort(),
    );
  }

  const payoutInstruction = decompilePrepared(payout).message.instructions[1]!;
  assertIsInstructionWithAccounts(payoutInstruction);
  assertIsInstructionWithData(payoutInstruction);
  const parsedPayout = parseClaimEventPayoutInstruction(payoutInstruction);
  assert.equal(
    parsedPayout.accounts.payoutTokenAccount.address,
    payout.summary.payoutTokenAccountAddress,
  );
  const refundInstruction = decompilePrepared(refund).message.instructions[1]!;
  assertIsInstructionWithAccounts(refundInstruction);
  assertIsInstructionWithData(refundInstruction);
  const parsedRefund = parseClaimEventRefundInstruction(refundInstruction);
  assert.equal(
    parsedRefund.accounts.participantTokenAccount.address,
    refund.summary.participantTokenAccountAddress,
  );
});

test("preparation rejects early, terminal, wrong-authority and seed-drift operations", async () => {
  const fixture = await groupEventFixture();
  await assert.rejects(
    prepareGroupEventFunding({
      ...common(fixture),
      participantWalletAddress: fixture.participantWallet.address,
      eventPoolAddress: fixture.eventPoolAddress,
      eventPool: fixture.eventPool,
      currentUnixSeconds: DEADLINE,
    }),
    /not accepting/u,
  );
  await assert.rejects(
    prepareGroupEventSettlement({
      ...common(fixture),
      settlerWalletAddress: fixture.participantWallet.address,
      eventPoolAddress: fixture.eventPoolAddress,
      eventPool: fixture.eventPool,
      currentUnixSeconds: DEADLINE - BigInt(1),
    }),
    /cannot be settled/u,
  );
  await assert.rejects(
    prepareGroupEventPayout({
      ...common(fixture),
      coachWalletAddress: fixture.participantWallet.address,
      coachAuthorityAddress: fixture.coachAuthorityAddress,
      coachAuthority: fixture.coachAuthority,
      eventPoolAddress: fixture.eventPoolAddress,
      eventPool: {
        ...fixture.eventPool,
        participantCount: 2,
        totalFundedBaseUnits: BigInt(50_000_000),
        status: EventPoolStatus.Succeeded,
      },
    }),
    /cannot claim/u,
  );
  await assert.rejects(
    prepareGroupEventRefund({
      ...common(fixture),
      participantWalletAddress: fixture.participantWallet.address,
      eventPoolAddress: fixture.eventPoolAddress,
      eventPool: { ...fixture.eventPool, status: EventPoolStatus.Failed },
      contributionAddress: address("11111111111111111111111111111111"),
      contribution: fixture.contribution,
    }),
    /cannot be refunded/u,
  );
});

test("prepared-message comparison rejects changed and truncated bytes", async () => {
  const fixture = await groupEventFixture();
  const prepared = await prepareGroupEventSettlement({
    ...common(fixture),
    settlerWalletAddress: fixture.participantWallet.address,
    eventPoolAddress: fixture.eventPoolAddress,
    eventPool: fixture.eventPool,
    currentUnixSeconds: DEADLINE,
  });
  const transaction = getTransactionDecoder().decode(
    decodeGroupEventTransactionBase64(prepared.transactionBase64),
  );
  assert.equal(
    matchesPreparedGroupEventMessage({
      signedTransactionMessage: transaction.messageBytes,
      preparedMessageBase64: prepared.messageBase64,
    }),
    true,
  );
  const changed = Uint8Array.from(transaction.messageBytes);
  changed[changed.length - 1] ^= 1;
  assert.equal(
    matchesPreparedGroupEventMessage({
      signedTransactionMessage: changed,
      preparedMessageBase64: prepared.messageBase64,
    }),
    false,
  );
  assert.equal(
    matchesPreparedGroupEventMessage({
      signedTransactionMessage: new Uint8Array([1]),
      preparedMessageBase64: prepared.messageBase64,
    }),
    false,
  );
});
