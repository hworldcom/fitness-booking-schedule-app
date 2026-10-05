import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSigner, none } from "@solana/kit";
import type { Contribution } from "../../clients/js/src/generated/accounts/contribution";
import type { EventPool } from "../../clients/js/src/generated/accounts/eventPool";
import { ContributionStatus } from "../../clients/js/src/generated/types/contributionStatus";
import { EventPoolStatus } from "../../clients/js/src/generated/types/eventPoolStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
} from "../../src/solana/coach-pass";
import {
  deriveContributionAddress,
  deriveEventPoolAddress,
  deriveEventVaultAddress,
} from "../../src/solana/group-event";
import type {
  GroupEventApprovalSummary,
  GroupEventOperationKind,
  PreparedGroupEventTransaction,
} from "../../src/solana/group-event-transaction";
import type { GroupEventOperationRecord } from "../../src/server/db/solana/group-event-repository";
import type {
  GroupEventPoolChainState,
  GroupEventRefundChainState,
} from "../../src/server/solana/group-event-rpc";
import { verifiedGroupEventEvidence } from "../../src/server/solana/group-event-service";

const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const SIGNATURE = "6".repeat(88);

async function recoveryFixture() {
  const [coach, participant, payer, coachAuthority] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const [eventPoolAddress, poolBump] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthority.address,
    nonce: BigInt(9),
  });
  const [vaultAddress, vaultBump] = await deriveEventVaultAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    eventPool: eventPoolAddress,
  });
  const [contributionAddress, contributionBump] =
    await deriveContributionAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      eventPool: eventPoolAddress,
      participantWallet: participant.address,
    });
  const eventPool: EventPool = {
    discriminator: new Uint8Array(8),
    version: 1,
    coachAuthority: coachAuthority.address,
    payoutRecipient: coach.address,
    paymentMint: DEVNET_EURC_MINT_ADDRESS,
    vault: vaultAddress,
    nonce: BigInt(9),
    priceEurcBaseUnits: BigInt(25_000_000),
    minimumParticipants: 2,
    maximumParticipants: 8,
    participantCount: 1,
    totalFundedBaseUnits: BigInt(25_000_000),
    totalRefundedBaseUnits: BigInt(0),
    fundingDeadline: BigInt(1_900_003_600),
    eventStartAt: BigInt(1_900_007_200),
    eventEndAt: BigInt(1_900_010_800),
    createdAt: BigInt(1_900_000_000),
    status: EventPoolStatus.Funding,
    settledAt: none(),
    paidAt: none(),
    bump: poolBump,
    vaultBump,
    reserved: Array(64).fill(0),
  };
  const contribution: Contribution = {
    discriminator: new Uint8Array(8),
    version: 1,
    eventPool: eventPoolAddress,
    participantWallet: participant.address,
    amountEurcBaseUnits: BigInt(25_000_000),
    status: ContributionStatus.Funded,
    fundedAt: BigInt(1_900_000_100),
    refundedAt: none(),
    bump: contributionBump,
    reserved: Array(36).fill(0),
  };
  return {
    coach,
    participant,
    payer,
    coachAuthority,
    eventPoolAddress,
    vaultAddress,
    contributionAddress,
    eventPool,
    contribution,
  };
}

function operation(
  fixture: Awaited<ReturnType<typeof recoveryFixture>>,
  operationKind: GroupEventOperationKind,
  summary: GroupEventApprovalSummary,
): GroupEventOperationRecord {
  const prepared: PreparedGroupEventTransaction = {
    summary,
    transactionBase64: "AQID",
    messageBase64: "BAUG",
    recentBlockhash: "11111111111111111111111111111111",
    lastValidBlockHeight: "1234",
  };
  return Object.freeze({
    operationId: OPERATION_ID,
    eventId: EVENT_ID,
    actorProfileId: "44444444-4444-4444-8444-444444444444",
    operation: operationKind,
    status: "submitted",
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    authorityAddress: summary.authorityAddress,
    coachAuthorityAddress: fixture.coachAuthority.address,
    eventPoolAddress: fixture.eventPoolAddress,
    vaultAddress: fixture.vaultAddress,
    contributionAddress: summary.contributionAddress,
    prepared,
    simulation: { slot: "100", unitsConsumed: "50000" },
    transactionSignature: SIGNATURE,
    failureCode: null,
    finalizedSlot: null,
  });
}

function commonSummary(
  fixture: Awaited<ReturnType<typeof recoveryFixture>>,
  operationKind: GroupEventOperationKind,
  authorityAddress: string,
) {
  return {
    cluster: "devnet" as const,
    operation: operationKind,
    eventId: EVENT_ID,
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    authorityAddress: authorityAddress as typeof fixture.coach.address,
    platformPayerAddress: fixture.payer.address,
    eventPoolAddress: fixture.eventPoolAddress,
    vaultAddress: fixture.vaultAddress,
    coachAuthorityAddress: fixture.coachAuthority.address,
    contributionAddress: null,
    testAsset: "EURC" as const,
    paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
    userPaysSol: false as const,
  };
}

function poolState(
  fixture: Awaited<ReturnType<typeof recoveryFixture>>,
  eventPool: EventPool = fixture.eventPool,
): GroupEventPoolChainState {
  return {
    slot: BigInt(500),
    eventPool,
    vault: {} as GroupEventPoolChainState["vault"],
    vaultAddress: fixture.vaultAddress,
  };
}

function contributionState(
  fixture: Awaited<ReturnType<typeof recoveryFixture>>,
  eventPool: EventPool = fixture.eventPool,
  contribution: Contribution = fixture.contribution,
): GroupEventRefundChainState {
  return {
    ...poolState(fixture, eventPool),
    contributionAddress: fixture.contributionAddress,
    contribution,
    participantTokenAccountAddress: fixture.participant.address,
    participantEurcAccount: null,
  };
}

test("creation recovery preserves distinct coach PDA and payout wallet", async () => {
  const fixture = await recoveryFixture();
  const createdPool: EventPool = {
    ...fixture.eventPool,
    participantCount: 0,
    totalFundedBaseUnits: BigInt(0),
  };
  const summary = {
    ...commonSummary(fixture, "create-event-pool", fixture.coach.address),
    operation: "create-event-pool" as const,
    payoutRecipientAddress: fixture.coach.address,
    nonce: "9",
    seatPriceEurcBaseUnits: "25000000",
    minimumParticipants: 2,
    maximumParticipants: 8,
    fundingDeadlineUnixSeconds: "1900003600",
    eventStartUnixSeconds: "1900007200",
    eventEndUnixSeconds: "1900010800",
  };
  const evidence = verifiedGroupEventEvidence({
    operation: operation(fixture, "create-event-pool", summary),
    finalized: { kind: "pool", state: poolState(fixture, createdPool) },
    signature: SIGNATURE,
  });
  assert.ok(evidence);
  assert.equal(
    evidence.pool.coachAuthorityAddress,
    fixture.coachAuthority.address,
  );
  assert.equal(evidence.pool.payoutRecipientAddress, fixture.coach.address);
  assert.notEqual(
    evidence.pool.coachAuthorityAddress,
    evidence.pool.payoutRecipientAddress,
  );

  assert.equal(
    verifiedGroupEventEvidence({
      operation: operation(fixture, "create-event-pool", {
        ...summary,
        payoutRecipientAddress: fixture.participant.address,
      }),
      finalized: { kind: "pool", state: poolState(fixture, createdPool) },
      signature: SIGNATURE,
    }),
    null,
  );
});

test("funding recovery requires the exact funded contribution", async () => {
  const fixture = await recoveryFixture();
  const summary = {
    ...commonSummary(fixture, "fund-event-seat", fixture.participant.address),
    operation: "fund-event-seat" as const,
    contributionAddress: fixture.contributionAddress,
    participantWalletAddress: fixture.participant.address,
    participantTokenAccountAddress: fixture.participant.address,
    seatPriceEurcBaseUnits: "25000000",
  };
  const evidence = verifiedGroupEventEvidence({
    operation: operation(fixture, "fund-event-seat", summary),
    finalized: {
      kind: "contribution",
      state: contributionState(fixture),
    },
    signature: SIGNATURE,
  });
  assert.ok(evidence?.contribution);
  assert.equal(evidence.contribution.lifecycleStatus, "funded");

  assert.equal(
    verifiedGroupEventEvidence({
      operation: operation(fixture, "fund-event-seat", summary),
      finalized: {
        kind: "contribution",
        state: contributionState(fixture, fixture.eventPool, {
          ...fixture.contribution,
          status: ContributionStatus.Refunded,
          refundedAt: { __option: "Some", value: BigInt(1_900_004_000) },
        }),
      },
      signature: SIGNATURE,
    }),
    null,
  );
});

test("settlement, payout and refund recovery accept only their terminal state", async () => {
  const fixture = await recoveryFixture();
  const settlementSummary = {
    ...commonSummary(fixture, "settle-event-pool", fixture.participant.address),
    operation: "settle-event-pool" as const,
    expectedOutcome: "failed" as const,
    participantCount: 1,
    minimumParticipants: 2,
  };
  const failedPool: EventPool = {
    ...fixture.eventPool,
    status: EventPoolStatus.Failed,
    settledAt: { __option: "Some", value: BigInt(1_900_003_600) },
  };
  assert.ok(
    verifiedGroupEventEvidence({
      operation: operation(fixture, "settle-event-pool", settlementSummary),
      finalized: { kind: "pool", state: poolState(fixture, failedPool) },
      signature: SIGNATURE,
    }),
  );
  assert.equal(
    verifiedGroupEventEvidence({
      operation: operation(fixture, "settle-event-pool", {
        ...settlementSummary,
        expectedOutcome: "succeeded",
      }),
      finalized: { kind: "pool", state: poolState(fixture, failedPool) },
      signature: SIGNATURE,
    }),
    null,
  );

  const paidPool: EventPool = {
    ...fixture.eventPool,
    status: EventPoolStatus.Paid,
    settledAt: { __option: "Some", value: BigInt(1_900_003_600) },
    paidAt: { __option: "Some", value: BigInt(1_900_003_700) },
  };
  const payoutSummary = {
    ...commonSummary(fixture, "claim-event-payout", fixture.coach.address),
    operation: "claim-event-payout" as const,
    payoutRecipientAddress: fixture.coach.address,
    payoutTokenAccountAddress: fixture.coach.address,
    amountEurcBaseUnits: "25000000",
  };
  assert.ok(
    verifiedGroupEventEvidence({
      operation: operation(fixture, "claim-event-payout", payoutSummary),
      finalized: { kind: "pool", state: poolState(fixture, paidPool) },
      signature: SIGNATURE,
    }),
  );
  assert.equal(
    verifiedGroupEventEvidence({
      operation: operation(fixture, "claim-event-payout", payoutSummary),
      finalized: { kind: "pool", state: poolState(fixture) },
      signature: SIGNATURE,
    }),
    null,
  );

  const refundedContribution: Contribution = {
    ...fixture.contribution,
    status: ContributionStatus.Refunded,
    refundedAt: { __option: "Some", value: BigInt(1_900_004_000) },
  };
  const refundedPool: EventPool = {
    ...failedPool,
    totalRefundedBaseUnits: BigInt(25_000_000),
  };
  const refundSummary = {
    ...commonSummary(
      fixture,
      "claim-event-refund",
      fixture.participant.address,
    ),
    operation: "claim-event-refund" as const,
    contributionAddress: fixture.contributionAddress,
    participantWalletAddress: fixture.participant.address,
    participantTokenAccountAddress: fixture.participant.address,
    amountEurcBaseUnits: "25000000",
  };
  const refundEvidence = verifiedGroupEventEvidence({
    operation: operation(fixture, "claim-event-refund", refundSummary),
    finalized: {
      kind: "contribution",
      state: contributionState(fixture, refundedPool, refundedContribution),
    },
    signature: SIGNATURE,
  });
  assert.equal(refundEvidence?.contribution?.lifecycleStatus, "refunded");
});
