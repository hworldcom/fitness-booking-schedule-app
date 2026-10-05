import "server-only";

import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  type Token,
} from "@solana-program/token";
import { type Address, type ReadonlyUint8Array } from "@solana/kit";
import {
  CONTRIBUTION_DISCRIMINATOR,
  getContributionDecoder,
  type Contribution,
} from "../../../clients/js/src/generated/accounts/contribution";
import {
  EVENT_POOL_DISCRIMINATOR,
  getEventPoolDecoder,
  type EventPool,
} from "../../../clients/js/src/generated/accounts/eventPool";
import { EventPoolStatus } from "../../../clients/js/src/generated/types/eventPoolStatus";
import { DEVNET_EURC_MINT_ADDRESS } from "@/solana/coach-pass";
import type { PreparedGroupEventTransaction } from "@/solana/group-event-transaction";
import {
  deriveContributionAddress,
  deriveEventVaultAddress,
  projectEventPoolSummary,
} from "@/solana/group-event";
import {
  CoachPassRpcError,
  decodeVerifiedCoachAuthority,
  decodeVerifiedEurcMint,
  decodeVerifiedEurcTokenAccount,
  validateCoachPassProgramAccount,
  type CoachPassRawAccount,
  type CoachPassRpcCommitment,
  type CoachPassRpcGateway,
} from "./coach-pass-rpc";

const EVENT_POOL_ACCOUNT_SIZE = 292;
const CONTRIBUTION_ACCOUNT_SIZE = 136;

function sameBytes(left: ReadonlyUint8Array, right: ReadonlyUint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function requireExpectedAddress(
  account: CoachPassRawAccount | null,
  expectedAddress: Address,
  label: string,
) {
  if (account === null) {
    throw new CoachPassRpcError(
      "account-missing",
      `${label} is not available on Solana.`,
    );
  }
  if (account.address !== expectedAddress) {
    throw new CoachPassRpcError(
      "account-invalid",
      `${label} was returned for an unexpected address.`,
    );
  }
  return account;
}

function assertAccountAbsent(
  account: CoachPassRawAccount | null,
  expectedAddress: Address,
  label: string,
) {
  if (account !== null) {
    if (account.address !== expectedAddress) {
      throw new CoachPassRpcError(
        "account-invalid",
        `${label} was returned for an unexpected address.`,
      );
    }
    throw new CoachPassRpcError(
      "account-invalid",
      `${label} already exists on Solana.`,
    );
  }
}

function decodeProgramAccount<T>(input: {
  account: CoachPassRawAccount | null;
  expectedAddress: Address;
  label: string;
  programAddress: Address;
  size: number;
  discriminator: ReadonlyUint8Array;
  decode: (data: Uint8Array) => T;
}) {
  const account = requireExpectedAddress(
    input.account,
    input.expectedAddress,
    input.label,
  );
  if (
    account.owner !== input.programAddress ||
    account.executable ||
    account.data.byteLength !== input.size ||
    !sameBytes(account.data.subarray(0, 8), input.discriminator)
  ) {
    throw new CoachPassRpcError(
      "account-invalid",
      `${input.label} failed address, owner, size or discriminator validation.`,
    );
  }
  try {
    return input.decode(account.data);
  } catch (error) {
    throw new CoachPassRpcError(
      "account-invalid",
      `${input.label} could not be decoded.`,
      { cause: error },
    );
  }
}

export function decodeVerifiedEventPool(input: {
  account: CoachPassRawAccount | null;
  expectedAddress: Address;
  programAddress: Address;
}): EventPool {
  return decodeProgramAccount({
    ...input,
    label: "Event pool",
    size: EVENT_POOL_ACCOUNT_SIZE,
    discriminator: EVENT_POOL_DISCRIMINATOR,
    decode: (data) => getEventPoolDecoder().decode(data),
  });
}

export function decodeVerifiedContribution(input: {
  account: CoachPassRawAccount | null;
  expectedAddress: Address;
  programAddress: Address;
}): Contribution {
  return decodeProgramAccount({
    ...input,
    label: "Event contribution",
    size: CONTRIBUTION_ACCOUNT_SIZE,
    discriminator: CONTRIBUTION_DISCRIMINATOR,
    decode: (data) => getContributionDecoder().decode(data),
  });
}

function decodeExpectedEurcAccount(input: {
  account: CoachPassRawAccount | null;
  expectedAddress: Address;
  expectedOwner: Address;
  label: string;
}) {
  const account = requireExpectedAddress(
    input.account,
    input.expectedAddress,
    input.label,
  );
  const token = decodeVerifiedEurcTokenAccount(account, input.expectedOwner);
  if (token.state !== AccountState.Initialized) {
    throw new CoachPassRpcError(
      "account-invalid",
      `${input.label} is not initialized.`,
    );
  }
  return token;
}

function assertBaseAccounts(input: {
  values: readonly (CoachPassRawAccount | null)[];
  programAddress: Address;
}) {
  validateCoachPassProgramAccount(input.values[0]!, input.programAddress);
  requireExpectedAddress(
    input.values[1]!,
    DEVNET_EURC_MINT_ADDRESS,
    "Devnet EURC mint",
  );
  decodeVerifiedEurcMint(input.values[1]!);
}

async function decodePoolAndVault(input: {
  values: readonly (CoachPassRawAccount | null)[];
  poolIndex: number;
  vaultIndex: number;
  programAddress: Address;
  eventPoolAddress: Address;
}) {
  const [vaultAddress] = await deriveEventVaultAddress({
    programAddress: input.programAddress,
    eventPool: input.eventPoolAddress,
  });
  const eventPool = decodeVerifiedEventPool({
    account: input.values[input.poolIndex]!,
    expectedAddress: input.eventPoolAddress,
    programAddress: input.programAddress,
  });
  const pool = projectEventPoolSummary({
    pool: eventPool,
    expectedCoachAuthority: eventPool.coachAuthority,
    expectedVault: vaultAddress,
  });
  const vault = decodeExpectedEurcAccount({
    account: input.values[input.vaultIndex]!,
    expectedAddress: vaultAddress,
    expectedOwner: input.eventPoolAddress,
    label: "Event EURC vault",
  });
  const expectedVaultAmount =
    pool.status === EventPoolStatus.Paid
      ? BigInt(0)
      : pool.totalFundedBaseUnits - pool.totalRefundedBaseUnits;
  if (vault.amount < expectedVaultAmount) {
    throw new CoachPassRpcError(
      "account-invalid",
      "Event EURC vault balance is below the recorded event liability.",
    );
  }
  return Object.freeze({ eventPool, vault, vaultAddress });
}

export type GroupEventCreationChainState = Readonly<{
  slot: bigint;
  coachAuthority: ReturnType<typeof decodeVerifiedCoachAuthority>;
  eventPoolAddress: Address;
  vaultAddress: Address;
}>;

export async function readGroupEventCreationState(input: {
  rpc: CoachPassRpcGateway;
  commitment: CoachPassRpcCommitment;
  programAddress: Address;
  coachAuthorityAddress: Address;
  eventPoolAddress: Address;
  vaultAddress: Address;
  minContextSlot?: bigint;
}): Promise<GroupEventCreationChainState> {
  const read = await input.rpc.accounts(
    [
      input.programAddress,
      DEVNET_EURC_MINT_ADDRESS,
      input.coachAuthorityAddress,
      input.eventPoolAddress,
      input.vaultAddress,
    ],
    {
      commitment: input.commitment,
      ...(input.minContextSlot === undefined
        ? {}
        : { minContextSlot: input.minContextSlot }),
    },
  );
  assertBaseAccounts({
    values: read.values,
    programAddress: input.programAddress,
  });
  const coachAuthorityAccount = requireExpectedAddress(
    read.values[2]!,
    input.coachAuthorityAddress,
    "Coach authority",
  );
  const coachAuthority = decodeVerifiedCoachAuthority(
    coachAuthorityAccount,
    input.programAddress,
  );
  assertAccountAbsent(read.values[3]!, input.eventPoolAddress, "Event pool");
  assertAccountAbsent(read.values[4]!, input.vaultAddress, "Event EURC vault");
  return Object.freeze({
    slot: read.slot,
    coachAuthority,
    eventPoolAddress: input.eventPoolAddress,
    vaultAddress: input.vaultAddress,
  });
}

export type GroupEventPoolChainState = Readonly<{
  slot: bigint;
  eventPool: EventPool;
  vault: Token;
  vaultAddress: Address;
}>;

export async function readGroupEventPoolState(input: {
  rpc: CoachPassRpcGateway;
  commitment: CoachPassRpcCommitment;
  programAddress: Address;
  eventPoolAddress: Address;
  minContextSlot?: bigint;
}): Promise<GroupEventPoolChainState> {
  const [vaultAddress] = await deriveEventVaultAddress({
    programAddress: input.programAddress,
    eventPool: input.eventPoolAddress,
  });
  const read = await input.rpc.accounts(
    [
      input.programAddress,
      DEVNET_EURC_MINT_ADDRESS,
      input.eventPoolAddress,
      vaultAddress,
    ],
    {
      commitment: input.commitment,
      ...(input.minContextSlot === undefined
        ? {}
        : { minContextSlot: input.minContextSlot }),
    },
  );
  assertBaseAccounts({
    values: read.values,
    programAddress: input.programAddress,
  });
  const state = await decodePoolAndVault({
    values: read.values,
    poolIndex: 2,
    vaultIndex: 3,
    programAddress: input.programAddress,
    eventPoolAddress: input.eventPoolAddress,
  });
  return Object.freeze({ slot: read.slot, ...state });
}

export type GroupEventFundingChainState = GroupEventPoolChainState &
  Readonly<{
    contributionAddress: Address;
    participantTokenAccountAddress: Address;
    participantEurcAccount: Token;
  }>;

export async function readGroupEventFundingState(input: {
  rpc: CoachPassRpcGateway;
  commitment: CoachPassRpcCommitment;
  programAddress: Address;
  eventPoolAddress: Address;
  participantWalletAddress: Address;
  minContextSlot?: bigint;
}): Promise<GroupEventFundingChainState> {
  const [vaultAddress] = await deriveEventVaultAddress({
    programAddress: input.programAddress,
    eventPool: input.eventPoolAddress,
  });
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
  const read = await input.rpc.accounts(
    [
      input.programAddress,
      DEVNET_EURC_MINT_ADDRESS,
      input.eventPoolAddress,
      vaultAddress,
      contributionAddress,
      participantTokenAccountAddress,
    ],
    {
      commitment: input.commitment,
      ...(input.minContextSlot === undefined
        ? {}
        : { minContextSlot: input.minContextSlot }),
    },
  );
  assertBaseAccounts({
    values: read.values,
    programAddress: input.programAddress,
  });
  const state = await decodePoolAndVault({
    values: read.values,
    poolIndex: 2,
    vaultIndex: 3,
    programAddress: input.programAddress,
    eventPoolAddress: input.eventPoolAddress,
  });
  assertAccountAbsent(
    read.values[4]!,
    contributionAddress,
    "Event contribution",
  );
  const participantEurcAccount = decodeExpectedEurcAccount({
    account: read.values[5]!,
    expectedAddress: participantTokenAccountAddress,
    expectedOwner: input.participantWalletAddress,
    label: "Participant EURC account",
  });
  if (participantEurcAccount.amount < state.eventPool.priceEurcBaseUnits) {
    throw new CoachPassRpcError(
      "insufficient-eurc",
      "The linked participant wallet has insufficient test EURC.",
    );
  }
  return Object.freeze({
    slot: read.slot,
    ...state,
    contributionAddress,
    participantTokenAccountAddress,
    participantEurcAccount,
  });
}

export type GroupEventPayoutChainState = GroupEventPoolChainState &
  Readonly<{
    coachAuthority: ReturnType<typeof decodeVerifiedCoachAuthority>;
    payoutTokenAccountAddress: Address;
    payoutEurcAccount: Token | null;
  }>;

export async function readGroupEventPayoutState(input: {
  rpc: CoachPassRpcGateway;
  commitment: CoachPassRpcCommitment;
  programAddress: Address;
  coachAuthorityAddress: Address;
  eventPoolAddress: Address;
  payoutRecipientAddress: Address;
  minContextSlot?: bigint;
}): Promise<GroupEventPayoutChainState> {
  const [vaultAddress] = await deriveEventVaultAddress({
    programAddress: input.programAddress,
    eventPool: input.eventPoolAddress,
  });
  const [payoutTokenAccountAddress] = await findAssociatedTokenPda({
    owner: input.payoutRecipientAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const read = await input.rpc.accounts(
    [
      input.programAddress,
      DEVNET_EURC_MINT_ADDRESS,
      input.coachAuthorityAddress,
      input.eventPoolAddress,
      vaultAddress,
      payoutTokenAccountAddress,
    ],
    {
      commitment: input.commitment,
      ...(input.minContextSlot === undefined
        ? {}
        : { minContextSlot: input.minContextSlot }),
    },
  );
  assertBaseAccounts({
    values: read.values,
    programAddress: input.programAddress,
  });
  const coachAuthorityAccount = requireExpectedAddress(
    read.values[2]!,
    input.coachAuthorityAddress,
    "Coach authority",
  );
  const coachAuthority = decodeVerifiedCoachAuthority(
    coachAuthorityAccount,
    input.programAddress,
  );
  const state = await decodePoolAndVault({
    values: read.values,
    poolIndex: 3,
    vaultIndex: 4,
    programAddress: input.programAddress,
    eventPoolAddress: input.eventPoolAddress,
  });
  const payoutEurcAccount = read.values[5]
    ? decodeExpectedEurcAccount({
        account: read.values[5],
        expectedAddress: payoutTokenAccountAddress,
        expectedOwner: input.payoutRecipientAddress,
        label: "Payout EURC account",
      })
    : null;
  return Object.freeze({
    slot: read.slot,
    ...state,
    coachAuthority,
    payoutTokenAccountAddress,
    payoutEurcAccount,
  });
}

export type GroupEventRefundChainState = GroupEventPoolChainState &
  Readonly<{
    contributionAddress: Address;
    contribution: Contribution;
    participantTokenAccountAddress: Address;
    participantEurcAccount: Token | null;
  }>;

export async function readGroupEventRefundState(input: {
  rpc: CoachPassRpcGateway;
  commitment: CoachPassRpcCommitment;
  programAddress: Address;
  eventPoolAddress: Address;
  participantWalletAddress: Address;
  minContextSlot?: bigint;
}): Promise<GroupEventRefundChainState> {
  const [vaultAddress] = await deriveEventVaultAddress({
    programAddress: input.programAddress,
    eventPool: input.eventPoolAddress,
  });
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
  const read = await input.rpc.accounts(
    [
      input.programAddress,
      DEVNET_EURC_MINT_ADDRESS,
      input.eventPoolAddress,
      vaultAddress,
      contributionAddress,
      participantTokenAccountAddress,
    ],
    {
      commitment: input.commitment,
      ...(input.minContextSlot === undefined
        ? {}
        : { minContextSlot: input.minContextSlot }),
    },
  );
  assertBaseAccounts({
    values: read.values,
    programAddress: input.programAddress,
  });
  const state = await decodePoolAndVault({
    values: read.values,
    poolIndex: 2,
    vaultIndex: 3,
    programAddress: input.programAddress,
    eventPoolAddress: input.eventPoolAddress,
  });
  const contribution = decodeVerifiedContribution({
    account: read.values[4]!,
    expectedAddress: contributionAddress,
    programAddress: input.programAddress,
  });
  const participantEurcAccount = read.values[5]
    ? decodeExpectedEurcAccount({
        account: read.values[5],
        expectedAddress: participantTokenAccountAddress,
        expectedOwner: input.participantWalletAddress,
        label: "Participant EURC account",
      })
    : null;
  return Object.freeze({
    slot: read.slot,
    ...state,
    contributionAddress,
    contribution,
    participantTokenAccountAddress,
    participantEurcAccount,
  });
}

export async function simulatePreparedGroupEventTransaction(input: {
  rpc: CoachPassRpcGateway;
  prepared: PreparedGroupEventTransaction;
  minContextSlot?: bigint;
}) {
  return input.rpc.simulate(
    input.prepared.transactionBase64,
    input.minContextSlot,
  );
}
