import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from "@solana-program/token";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64Decoder,
  getBase64Encoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type BlockhashLifetimeConstraint,
  type Instruction,
  type ReadonlyUint8Array,
} from "@solana/kit";
import type { CoachAuthority } from "../../clients/js/src/generated/accounts/coachAuthority";
import type { Contribution } from "../../clients/js/src/generated/accounts/contribution";
import type { EventPool } from "../../clients/js/src/generated/accounts/eventPool";
import { getClaimEventPayoutInstructionAsync } from "../../clients/js/src/generated/instructions/claimEventPayout";
import { getClaimEventRefundInstructionAsync } from "../../clients/js/src/generated/instructions/claimEventRefund";
import { getCreateEventPoolInstructionAsync } from "../../clients/js/src/generated/instructions/createEventPool";
import { getFundEventInstructionAsync } from "../../clients/js/src/generated/instructions/fundEvent";
import { getSettleEventInstruction } from "../../clients/js/src/generated/instructions/settleEvent";
import { ContributionStatus } from "../../clients/js/src/generated/types/contributionStatus";
import { EventPoolStatus } from "../../clients/js/src/generated/types/eventPoolStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveEventAuthorityAddress,
  seedToUuid,
} from "./coach-pass";
import {
  MAX_EVENT_DURATION_SECONDS,
  MAX_EVENT_LEAD_SECONDS,
  MAX_EVENT_PARTICIPANTS,
  MAX_EVENT_PRICE_EURC_BASE_UNITS,
  MIN_EVENT_DURATION_SECONDS,
  MIN_EVENT_PARTICIPANTS,
  deriveContributionAddress,
  deriveEventPoolAddress,
  deriveEventVaultAddress,
  projectContributionSummary,
  projectEventPoolSummary,
} from "./group-event";

export const GROUP_EVENT_CLUSTER = "devnet" as const;

export type GroupEventOperationKind =
  | "create-event-pool"
  | "fund-event-seat"
  | "settle-event-pool"
  | "claim-event-payout"
  | "claim-event-refund";

type GroupEventApprovalSummaryBase = Readonly<{
  cluster: typeof GROUP_EVENT_CLUSTER;
  operation: GroupEventOperationKind;
  eventId: string;
  programAddress: Address;
  authorityAddress: Address;
  platformPayerAddress: Address;
  eventPoolAddress: Address;
  vaultAddress: Address;
  coachAuthorityAddress: Address;
  contributionAddress: Address | null;
  testAsset: "EURC";
  paymentMintAddress: Address;
  userPaysSol: false;
}>;

export type GroupEventCreationApprovalSummary = GroupEventApprovalSummaryBase &
  Readonly<{
    operation: "create-event-pool";
    payoutRecipientAddress: Address;
    nonce: string;
    seatPriceEurcBaseUnits: string;
    minimumParticipants: number;
    maximumParticipants: number;
    fundingDeadlineUnixSeconds: string;
    eventStartUnixSeconds: string;
    eventEndUnixSeconds: string;
  }>;

export type GroupEventFundingApprovalSummary = GroupEventApprovalSummaryBase &
  Readonly<{
    operation: "fund-event-seat";
    participantWalletAddress: Address;
    participantTokenAccountAddress: Address;
    seatPriceEurcBaseUnits: string;
  }>;

export type GroupEventSettlementApprovalSummary =
  GroupEventApprovalSummaryBase &
    Readonly<{
      operation: "settle-event-pool";
      expectedOutcome: "succeeded" | "failed";
      participantCount: number;
      minimumParticipants: number;
    }>;

export type GroupEventPayoutApprovalSummary = GroupEventApprovalSummaryBase &
  Readonly<{
    operation: "claim-event-payout";
    payoutRecipientAddress: Address;
    payoutTokenAccountAddress: Address;
    amountEurcBaseUnits: string;
  }>;

export type GroupEventRefundApprovalSummary = GroupEventApprovalSummaryBase &
  Readonly<{
    operation: "claim-event-refund";
    participantWalletAddress: Address;
    participantTokenAccountAddress: Address;
    amountEurcBaseUnits: string;
  }>;

export type GroupEventApprovalSummary =
  | GroupEventCreationApprovalSummary
  | GroupEventFundingApprovalSummary
  | GroupEventSettlementApprovalSummary
  | GroupEventPayoutApprovalSummary
  | GroupEventRefundApprovalSummary;

export type PreparedGroupEventTransaction = Readonly<{
  summary: GroupEventApprovalSummary;
  transactionBase64: string;
  messageBase64: string;
  recentBlockhash: string;
  lastValidBlockHeight: string;
}>;

type CommonPreparationInput = Readonly<{
  eventId: string;
  programAddress: Address;
  platformPayerAddress: Address;
  lifetimeConstraint: BlockhashLifetimeConstraint;
}>;

export type PrepareGroupEventCreationInput = CommonPreparationInput &
  Readonly<{
    coachWalletAddress: Address;
    coachAuthorityAddress: Address;
    coachAuthority: CoachAuthority;
    nonce: bigint;
    seatPriceEurcBaseUnits: bigint;
    minimumParticipants: number;
    maximumParticipants: number;
    fundingDeadlineUnixSeconds: bigint;
    eventStartUnixSeconds: bigint;
    eventEndUnixSeconds: bigint;
    currentUnixSeconds: bigint;
  }>;

export type PrepareGroupEventFundingInput = CommonPreparationInput &
  Readonly<{
    participantWalletAddress: Address;
    eventPoolAddress: Address;
    eventPool: EventPool;
    currentUnixSeconds: bigint;
  }>;

export type PrepareGroupEventSettlementInput = CommonPreparationInput &
  Readonly<{
    settlerWalletAddress: Address;
    eventPoolAddress: Address;
    eventPool: EventPool;
    currentUnixSeconds: bigint;
  }>;

export type PrepareGroupEventPayoutInput = CommonPreparationInput &
  Readonly<{
    coachWalletAddress: Address;
    coachAuthorityAddress: Address;
    coachAuthority: CoachAuthority;
    eventPoolAddress: Address;
    eventPool: EventPool;
  }>;

export type PrepareGroupEventRefundInput = CommonPreparationInput &
  Readonly<{
    participantWalletAddress: Address;
    eventPoolAddress: Address;
    eventPool: EventPool;
    contributionAddress: Address;
    contribution: Contribution;
  }>;

function sameBytes(left: ReadonlyUint8Array, right: ReadonlyUint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

async function assertCoachAuthority(input: {
  programAddress: Address;
  coachAuthorityAddress: Address;
  coachAuthority: CoachAuthority;
}) {
  const [derivedAddress, derivedBump] = await deriveCoachAuthorityAddress({
    programAddress: input.programAddress,
    runId: seedToUuid(input.coachAuthority.runId),
    profileId: seedToUuid(input.coachAuthority.profileId),
    originalWallet: input.coachAuthority.originalWallet,
  });
  if (
    derivedAddress !== input.coachAuthorityAddress ||
    derivedBump !== input.coachAuthority.bump
  ) {
    throw new Error(
      "Coach authority address does not match its on-chain seeds.",
    );
  }
}

async function assertEventPool(input: {
  programAddress: Address;
  eventPoolAddress: Address;
  eventPool: EventPool;
}) {
  const [expectedEventPoolAddress, eventPoolBump] =
    await deriveEventPoolAddress({
      programAddress: input.programAddress,
      coachAuthority: input.eventPool.coachAuthority,
      nonce: input.eventPool.nonce,
    });
  const [expectedVaultAddress, vaultBump] = await deriveEventVaultAddress({
    programAddress: input.programAddress,
    eventPool: input.eventPoolAddress,
  });
  if (
    expectedEventPoolAddress !== input.eventPoolAddress ||
    eventPoolBump !== input.eventPool.bump ||
    expectedVaultAddress !== input.eventPool.vault ||
    vaultBump !== input.eventPool.vaultBump
  ) {
    throw new Error("Event pool address does not match its on-chain seeds.");
  }
  return projectEventPoolSummary({
    pool: input.eventPool,
    expectedCoachAuthority: input.eventPool.coachAuthority,
    expectedVault: expectedVaultAddress,
  });
}

function compilePreparedTransaction(input: {
  summary: GroupEventApprovalSummary;
  instructions: readonly Instruction[];
  platformPayerAddress: Address;
  lifetimeConstraint: BlockhashLifetimeConstraint;
}): PreparedGroupEventTransaction {
  const message = pipe(
    createTransactionMessage({ version: "legacy" }),
    (current) =>
      setTransactionMessageFeePayer(input.platformPayerAddress, current),
    (current) =>
      setTransactionMessageLifetimeUsingBlockhash(
        input.lifetimeConstraint,
        current,
      ),
    (current) =>
      appendTransactionMessageInstructions(input.instructions, current),
  );
  const transaction = compileTransaction(message);
  const base64Decoder = getBase64Decoder();
  return Object.freeze({
    summary: Object.freeze(input.summary),
    transactionBase64: base64Decoder.decode(
      getTransactionEncoder().encode(transaction),
    ),
    messageBase64: base64Decoder.decode(transaction.messageBytes),
    recentBlockhash: input.lifetimeConstraint.blockhash,
    lastValidBlockHeight:
      input.lifetimeConstraint.lastValidBlockHeight.toString(),
  });
}

export async function prepareGroupEventCreation(
  input: PrepareGroupEventCreationInput,
): Promise<PreparedGroupEventTransaction> {
  await assertCoachAuthority(input);
  if (input.coachAuthority.currentWallet !== input.coachWalletAddress) {
    throw new Error("Linked coach wallet is not the current coach authority.");
  }
  const duration = input.eventEndUnixSeconds - input.eventStartUnixSeconds;
  const lead = input.eventStartUnixSeconds - input.currentUnixSeconds;
  if (
    input.seatPriceEurcBaseUnits < BigInt(1) ||
    input.seatPriceEurcBaseUnits > MAX_EVENT_PRICE_EURC_BASE_UNITS ||
    input.minimumParticipants < MIN_EVENT_PARTICIPANTS ||
    input.maximumParticipants < input.minimumParticipants ||
    input.maximumParticipants > MAX_EVENT_PARTICIPANTS ||
    input.fundingDeadlineUnixSeconds <= input.currentUnixSeconds ||
    input.fundingDeadlineUnixSeconds >= input.eventStartUnixSeconds ||
    lead <= BigInt(0) ||
    lead > MAX_EVENT_LEAD_SECONDS ||
    duration < MIN_EVENT_DURATION_SECONDS ||
    duration > MAX_EVENT_DURATION_SECONDS
  ) {
    throw new Error("Group-event creation terms are invalid.");
  }
  const [eventPoolAddress] = await deriveEventPoolAddress({
    programAddress: input.programAddress,
    coachAuthority: input.coachAuthorityAddress,
    nonce: input.nonce,
  });
  const [vaultAddress] = await deriveEventVaultAddress({
    programAddress: input.programAddress,
    eventPool: eventPoolAddress,
  });
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });
  const instruction = await getCreateEventPoolInstructionAsync(
    {
      coachWallet: createNoopSigner(input.coachWalletAddress),
      platformPayer: createNoopSigner(input.platformPayerAddress),
      coachAuthority: input.coachAuthorityAddress,
      eventPool: eventPoolAddress,
      paymentMint: DEVNET_EURC_MINT_ADDRESS,
      vault: vaultAddress,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      eventAuthority: eventAuthorityAddress,
      program: input.programAddress,
      args: {
        nonce: input.nonce,
        priceEurcBaseUnits: input.seatPriceEurcBaseUnits,
        minimumParticipants: input.minimumParticipants,
        maximumParticipants: input.maximumParticipants,
        fundingDeadline: input.fundingDeadlineUnixSeconds,
        eventStartAt: input.eventStartUnixSeconds,
        eventEndAt: input.eventEndUnixSeconds,
      },
    },
    { programAddress: input.programAddress },
  );
  return compilePreparedTransaction({
    summary: {
      cluster: GROUP_EVENT_CLUSTER,
      operation: "create-event-pool",
      eventId: input.eventId,
      programAddress: input.programAddress,
      authorityAddress: input.coachWalletAddress,
      platformPayerAddress: input.platformPayerAddress,
      eventPoolAddress,
      vaultAddress,
      coachAuthorityAddress: input.coachAuthorityAddress,
      contributionAddress: null,
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      payoutRecipientAddress: input.coachWalletAddress,
      nonce: input.nonce.toString(),
      seatPriceEurcBaseUnits: input.seatPriceEurcBaseUnits.toString(),
      minimumParticipants: input.minimumParticipants,
      maximumParticipants: input.maximumParticipants,
      fundingDeadlineUnixSeconds: input.fundingDeadlineUnixSeconds.toString(),
      eventStartUnixSeconds: input.eventStartUnixSeconds.toString(),
      eventEndUnixSeconds: input.eventEndUnixSeconds.toString(),
    },
    instructions: [instruction],
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

export async function prepareGroupEventFunding(
  input: PrepareGroupEventFundingInput,
): Promise<PreparedGroupEventTransaction> {
  const pool = await assertEventPool(input);
  if (
    pool.status !== EventPoolStatus.Funding ||
    input.currentUnixSeconds >= pool.fundingDeadline ||
    pool.participantCount >= pool.maximumParticipants
  ) {
    throw new Error("Event pool is not accepting another contribution.");
  }
  const [contributionAddress] = await deriveContributionAddress({
    programAddress: input.programAddress,
    eventPool: input.eventPoolAddress,
    participantWallet: input.participantWalletAddress,
  });
  const [participantTokenAccountAddress] = await findAssociatedTokenPda({
    owner: input.participantWalletAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });
  const instruction = await getFundEventInstructionAsync(
    {
      participantWallet: createNoopSigner(input.participantWalletAddress),
      platformPayer: createNoopSigner(input.platformPayerAddress),
      eventPool: input.eventPoolAddress,
      contribution: contributionAddress,
      paymentMint: DEVNET_EURC_MINT_ADDRESS,
      participantTokenAccount: participantTokenAccountAddress,
      vault: pool.vault,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      eventAuthority: eventAuthorityAddress,
      program: input.programAddress,
    },
    { programAddress: input.programAddress },
  );
  return compilePreparedTransaction({
    summary: {
      cluster: GROUP_EVENT_CLUSTER,
      operation: "fund-event-seat",
      eventId: input.eventId,
      programAddress: input.programAddress,
      authorityAddress: input.participantWalletAddress,
      platformPayerAddress: input.platformPayerAddress,
      eventPoolAddress: input.eventPoolAddress,
      vaultAddress: pool.vault,
      coachAuthorityAddress: pool.coachAuthority,
      contributionAddress,
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      participantWalletAddress: input.participantWalletAddress,
      participantTokenAccountAddress,
      seatPriceEurcBaseUnits: pool.priceEurcBaseUnits.toString(),
    },
    instructions: [instruction],
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

export async function prepareGroupEventSettlement(
  input: PrepareGroupEventSettlementInput,
): Promise<PreparedGroupEventTransaction> {
  const pool = await assertEventPool(input);
  if (
    pool.status !== EventPoolStatus.Funding ||
    input.currentUnixSeconds < pool.fundingDeadline
  ) {
    throw new Error("Event pool cannot be settled now.");
  }
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });
  const instruction = getSettleEventInstruction(
    {
      settler: createNoopSigner(input.settlerWalletAddress),
      eventPool: input.eventPoolAddress,
      eventAuthority: eventAuthorityAddress,
      program: input.programAddress,
    },
    { programAddress: input.programAddress },
  );
  return compilePreparedTransaction({
    summary: {
      cluster: GROUP_EVENT_CLUSTER,
      operation: "settle-event-pool",
      eventId: input.eventId,
      programAddress: input.programAddress,
      authorityAddress: input.settlerWalletAddress,
      platformPayerAddress: input.platformPayerAddress,
      eventPoolAddress: input.eventPoolAddress,
      vaultAddress: pool.vault,
      coachAuthorityAddress: pool.coachAuthority,
      contributionAddress: null,
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      expectedOutcome:
        pool.participantCount >= pool.minimumParticipants
          ? "succeeded"
          : "failed",
      participantCount: pool.participantCount,
      minimumParticipants: pool.minimumParticipants,
    },
    instructions: [instruction],
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

export async function prepareGroupEventPayout(
  input: PrepareGroupEventPayoutInput,
): Promise<PreparedGroupEventTransaction> {
  await assertCoachAuthority(input);
  const pool = await assertEventPool(input);
  if (
    input.coachAuthority.currentWallet !== input.coachWalletAddress ||
    pool.coachAuthority !== input.coachAuthorityAddress ||
    pool.status !== EventPoolStatus.Succeeded
  ) {
    throw new Error("Coach wallet cannot claim this event payout.");
  }
  const [payoutTokenAccountAddress] = await findAssociatedTokenPda({
    owner: pool.payoutRecipient,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });
  const platformPayer = createNoopSigner(input.platformPayerAddress);
  const instructions: Instruction[] = [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: platformPayer,
      ata: payoutTokenAccountAddress,
      owner: pool.payoutRecipient,
      mint: DEVNET_EURC_MINT_ADDRESS,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }),
    await getClaimEventPayoutInstructionAsync(
      {
        coachWallet: createNoopSigner(input.coachWalletAddress),
        coachAuthority: input.coachAuthorityAddress,
        eventPool: input.eventPoolAddress,
        paymentMint: DEVNET_EURC_MINT_ADDRESS,
        vault: pool.vault,
        payoutTokenAccount: payoutTokenAccountAddress,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        eventAuthority: eventAuthorityAddress,
        program: input.programAddress,
      },
      { programAddress: input.programAddress },
    ),
  ];
  return compilePreparedTransaction({
    summary: {
      cluster: GROUP_EVENT_CLUSTER,
      operation: "claim-event-payout",
      eventId: input.eventId,
      programAddress: input.programAddress,
      authorityAddress: input.coachWalletAddress,
      platformPayerAddress: input.platformPayerAddress,
      eventPoolAddress: input.eventPoolAddress,
      vaultAddress: pool.vault,
      coachAuthorityAddress: pool.coachAuthority,
      contributionAddress: null,
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      payoutRecipientAddress: pool.payoutRecipient,
      payoutTokenAccountAddress,
      amountEurcBaseUnits: pool.totalFundedBaseUnits.toString(),
    },
    instructions,
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

export async function prepareGroupEventRefund(
  input: PrepareGroupEventRefundInput,
): Promise<PreparedGroupEventTransaction> {
  const pool = await assertEventPool(input);
  if (pool.status !== EventPoolStatus.Failed) {
    throw new Error("Event pool is not refundable.");
  }
  const contribution = projectContributionSummary({
    contribution: input.contribution,
    expectedEventPool: input.eventPoolAddress,
    expectedParticipantWallet: input.participantWalletAddress,
    expectedAmountEurcBaseUnits: pool.priceEurcBaseUnits,
  });
  const [expectedContributionAddress, contributionBump] =
    await deriveContributionAddress({
      programAddress: input.programAddress,
      eventPool: input.eventPoolAddress,
      participantWallet: input.participantWalletAddress,
    });
  if (
    input.contributionAddress !== expectedContributionAddress ||
    input.contribution.bump !== contributionBump ||
    contribution.status !== ContributionStatus.Funded
  ) {
    throw new Error("Contribution cannot be refunded.");
  }
  const [participantTokenAccountAddress] = await findAssociatedTokenPda({
    owner: input.participantWalletAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: input.programAddress,
  });
  const platformPayer = createNoopSigner(input.platformPayerAddress);
  const instructions: Instruction[] = [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: platformPayer,
      ata: participantTokenAccountAddress,
      owner: input.participantWalletAddress,
      mint: DEVNET_EURC_MINT_ADDRESS,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }),
    await getClaimEventRefundInstructionAsync(
      {
        participantWallet: createNoopSigner(input.participantWalletAddress),
        eventPool: input.eventPoolAddress,
        contribution: input.contributionAddress,
        paymentMint: DEVNET_EURC_MINT_ADDRESS,
        vault: pool.vault,
        participantTokenAccount: participantTokenAccountAddress,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        eventAuthority: eventAuthorityAddress,
        program: input.programAddress,
      },
      { programAddress: input.programAddress },
    ),
  ];
  return compilePreparedTransaction({
    summary: {
      cluster: GROUP_EVENT_CLUSTER,
      operation: "claim-event-refund",
      eventId: input.eventId,
      programAddress: input.programAddress,
      authorityAddress: input.participantWalletAddress,
      platformPayerAddress: input.platformPayerAddress,
      eventPoolAddress: input.eventPoolAddress,
      vaultAddress: pool.vault,
      coachAuthorityAddress: pool.coachAuthority,
      contributionAddress: input.contributionAddress,
      testAsset: "EURC",
      paymentMintAddress: DEVNET_EURC_MINT_ADDRESS,
      userPaysSol: false,
      participantWalletAddress: input.participantWalletAddress,
      participantTokenAccountAddress,
      amountEurcBaseUnits: contribution.amountEurcBaseUnits.toString(),
    },
    instructions,
    platformPayerAddress: input.platformPayerAddress,
    lifetimeConstraint: input.lifetimeConstraint,
  });
}

export function decodeGroupEventTransactionBase64(value: string) {
  return new Uint8Array(getBase64Encoder().encode(value));
}

export function matchesPreparedGroupEventMessage(input: {
  signedTransactionMessage: ReadonlyUint8Array;
  preparedMessageBase64: string;
}) {
  return sameBytes(
    input.signedTransactionMessage,
    new Uint8Array(getBase64Encoder().encode(input.preparedMessageBase64)),
  );
}
