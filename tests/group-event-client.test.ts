import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountRole,
  address,
  generateKeyPairSigner,
  getProgramDerivedAddress,
  getUtf8Encoder,
} from "@solana/kit";
import {
  getContributionDecoder,
  getContributionEncoder,
} from "../clients/js/src/generated/accounts/contribution";
import {
  getEventPoolDecoder,
  getEventPoolEncoder,
} from "../clients/js/src/generated/accounts/eventPool";
import {
  getCreateEventPoolInstructionAsync,
  parseCreateEventPoolInstruction,
} from "../clients/js/src/generated/instructions/createEventPool";
import { MOVX_COACH_PASS_PROGRAM_ADDRESS } from "../clients/js/src/generated/programs/movxCoachPass";
import { ContributionStatus } from "../clients/js/src/generated/types/contributionStatus";
import { EventPoolStatus } from "../clients/js/src/generated/types/eventPoolStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  deriveCoachAuthorityAddress,
  uuidToSeed,
} from "../src/solana/coach-pass";
import {
  deriveContributionAddress,
  deriveEventPoolAddress,
  deriveEventVaultAddress,
  projectContributionSummary,
  projectEventPoolSummary,
} from "../src/solana/group-event";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";

test("group-event PDA helpers are deterministic and participant scoped", async () => {
  const coachAuthority = address(
    "6qaz3bzwxXPgxgRpox1FyvPPKGMdYfpGTFqPSf4r4rcH",
  );
  const participant = address("3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe");
  const otherParticipant = address(
    "7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge",
  );
  const [pool, poolBump] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(9),
  });
  const [samePool, samePoolBump] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(9),
  });
  const [vault] = await deriveEventVaultAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    eventPool: pool,
  });
  const [contribution] = await deriveContributionAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    eventPool: pool,
    participantWallet: participant,
  });
  const [otherContribution] = await deriveContributionAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    eventPool: pool,
    participantWallet: otherParticipant,
  });

  assert.equal(pool, samePool);
  assert.equal(poolBump, samePoolBump);
  assert.notEqual(pool, vault);
  assert.notEqual(contribution, otherContribution);
  await assert.rejects(
    deriveEventPoolAddress({
      programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      coachAuthority,
      nonce: BigInt(-1),
    }),
    /unsigned 64-bit/u,
  );
});

test("generated pool and contribution codecs support strict projections", () => {
  const coachAuthority = address(
    "6qaz3bzwxXPgxgRpox1FyvPPKGMdYfpGTFqPSf4r4rcH",
  );
  const payoutRecipient = address(
    "7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge",
  );
  const vault = address("BqjoAEFuw8az8LoN4Q6vNNeW1qPQ4LVrbbHcB1BDtJ8");
  const participant = address("3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe");
  const encodedPool = getEventPoolEncoder().encode({
    version: 1,
    coachAuthority,
    payoutRecipient,
    paymentMint: DEVNET_EURC_MINT_ADDRESS,
    vault,
    nonce: BigInt(5),
    priceEurcBaseUnits: BigInt(30_000_000),
    minimumParticipants: 2,
    maximumParticipants: 6,
    participantCount: 2,
    totalFundedBaseUnits: BigInt(60_000_000),
    totalRefundedBaseUnits: BigInt(0),
    fundingDeadline: BigInt(2_000),
    eventStartAt: BigInt(3_000),
    eventEndAt: BigInt(6_600),
    createdAt: BigInt(1_000),
    status: EventPoolStatus.Succeeded,
    settledAt: BigInt(2_000),
    paidAt: null,
    bump: 250,
    vaultBump: 249,
    reserved: Array(64).fill(0),
  });
  const pool = getEventPoolDecoder().decode(encodedPool);
  const poolSummary = projectEventPoolSummary({
    pool,
    expectedCoachAuthority: coachAuthority,
    expectedVault: vault,
  });
  assert.equal(poolSummary.totalFundedBaseUnits, BigInt(60_000_000));
  assert.equal(poolSummary.settledAt, BigInt(2_000));

  const encodedContribution = getContributionEncoder().encode({
    version: 1,
    eventPool: payoutRecipient,
    participantWallet: participant,
    amountEurcBaseUnits: BigInt(30_000_000),
    status: ContributionStatus.Funded,
    fundedAt: BigInt(1_500),
    refundedAt: null,
    bump: 248,
    reserved: Array(36).fill(0),
  });
  const contribution = getContributionDecoder().decode(encodedContribution);
  assert.equal(
    projectContributionSummary({
      contribution,
      expectedEventPool: payoutRecipient,
      expectedParticipantWallet: participant,
      expectedAmountEurcBaseUnits: BigInt(30_000_000),
    }).refundedAt,
    null,
  );
  assert.throws(
    () =>
      projectContributionSummary({
        contribution,
        expectedEventPool: payoutRecipient,
        expectedParticipantWallet: participant,
        expectedAmountEurcBaseUnits: BigInt(1),
      }),
    /seat price/u,
  );
});

test("generated create instruction keeps coach authority separate from platform payer", async () => {
  const [coachWallet, recoveryAuthority, platformPayer] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const [coachAuthority] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: coachWallet.address,
  });
  const [eventPool] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    coachAuthority,
    nonce: BigInt(1),
  });
  const [vault] = await deriveEventVaultAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    eventPool,
  });
  const [eventAuthority] = await getProgramDerivedAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    seeds: [getUtf8Encoder().encode("__event_authority")],
  });
  const created = parseCreateEventPoolInstruction(
    await getCreateEventPoolInstructionAsync({
      coachWallet,
      platformPayer,
      coachAuthority,
      eventPool,
      vault,
      eventAuthority,
      program: MOVX_COACH_PASS_PROGRAM_ADDRESS,
      args: {
        nonce: BigInt(1),
        priceEurcBaseUnits: BigInt(30_000_000),
        minimumParticipants: 3,
        maximumParticipants: 6,
        fundingDeadline: BigInt(2_000),
        eventStartAt: BigInt(3_000),
        eventEndAt: BigInt(6_600),
      },
    }),
  );

  assert.equal(created.accounts.coachWallet.role, AccountRole.READONLY_SIGNER);
  assert.equal(
    created.accounts.platformPayer.role,
    AccountRole.WRITABLE_SIGNER,
  );
  assert.equal(created.accounts.paymentMint.address, DEVNET_EURC_MINT_ADDRESS);
  assert.equal(created.accounts.eventPool.address, eventPool);
  assert.equal(created.accounts.vault.address, vault);
  assert.notEqual(coachWallet.address, recoveryAuthority.address);
});

test("UUID seed helper remains compatible with existing coach authority derivation", async () => {
  const wallet = address("7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge");
  const [derived] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: wallet,
  });
  assert.equal(uuidToSeed(RUN_ID).length, 16);
  assert.ok(derived.length > 0);
});
