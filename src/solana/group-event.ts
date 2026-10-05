import {
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  getUtf8Encoder,
  isNone,
  type Address,
} from "@solana/kit";
import type { Contribution } from "../../clients/js/src/generated/accounts/contribution";
import type { EventPool } from "../../clients/js/src/generated/accounts/eventPool";
import type { ContributionStatus } from "../../clients/js/src/generated/types/contributionStatus";
import type { EventPoolStatus } from "../../clients/js/src/generated/types/eventPoolStatus";
import { DEVNET_EURC_MINT_ADDRESS } from "./coach-pass";

export const MIN_EVENT_PARTICIPANTS = 2;
export const MAX_EVENT_PARTICIPANTS = 50;
export const MAX_EVENT_PRICE_EURC_BASE_UNITS = BigInt("9000000000000000");
export const MIN_EVENT_DURATION_SECONDS = BigInt(30 * 60);
export const MAX_EVENT_DURATION_SECONDS = BigInt(12 * 60 * 60);
export const MAX_EVENT_LEAD_SECONDS = BigInt(365 * 24 * 60 * 60);

const EVENT_POOL_SEED = getUtf8Encoder().encode("event-pool");
const EVENT_VAULT_SEED = getUtf8Encoder().encode("event-vault");
const CONTRIBUTION_SEED = getUtf8Encoder().encode("contribution");
const MAX_U64 = BigInt("18446744073709551615");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type EventPoolSummary = Readonly<{
  coachAuthority: Address;
  payoutRecipient: Address;
  paymentMint: Address;
  vault: Address;
  nonce: bigint;
  priceEurcBaseUnits: bigint;
  minimumParticipants: number;
  maximumParticipants: number;
  participantCount: number;
  totalFundedBaseUnits: bigint;
  totalRefundedBaseUnits: bigint;
  fundingDeadline: bigint;
  eventStartAt: bigint;
  eventEndAt: bigint;
  createdAt: bigint;
  status: EventPoolStatus;
  settledAt: bigint | null;
  paidAt: bigint | null;
}>;

export type ContributionSummary = Readonly<{
  eventPool: Address;
  participantWallet: Address;
  amountEurcBaseUnits: bigint;
  status: ContributionStatus;
  fundedAt: bigint;
  refundedAt: bigint | null;
}>;

function assertU64(value: bigint, label: string): void {
  if (value < BigInt(0) || value > MAX_U64) {
    throw new Error(`${label} must fit an unsigned 64-bit integer.`);
  }
}

export function groupEventNonceFromId(eventId: string) {
  if (!UUID_PATTERN.test(eventId)) {
    throw new Error("Group-event ID must be a UUID.");
  }
  return BigInt(`0x${eventId.replaceAll("-", "").slice(0, 16)}`);
}

export async function deriveEventPoolAddress(input: {
  programAddress: Address;
  coachAuthority: Address;
  nonce: bigint;
}): Promise<readonly [Address, number]> {
  assertU64(input.nonce, "Event pool nonce");
  return getProgramDerivedAddress({
    programAddress: input.programAddress,
    seeds: [
      EVENT_POOL_SEED,
      getAddressEncoder().encode(input.coachAuthority),
      getU64Encoder().encode(input.nonce),
    ],
  });
}

export async function deriveEventVaultAddress(input: {
  programAddress: Address;
  eventPool: Address;
}): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: input.programAddress,
    seeds: [EVENT_VAULT_SEED, getAddressEncoder().encode(input.eventPool)],
  });
}

export async function deriveContributionAddress(input: {
  programAddress: Address;
  eventPool: Address;
  participantWallet: Address;
}): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: input.programAddress,
    seeds: [
      CONTRIBUTION_SEED,
      getAddressEncoder().encode(input.eventPool),
      getAddressEncoder().encode(input.participantWallet),
    ],
  });
}

export function projectEventPoolSummary(input: {
  pool: EventPool;
  expectedCoachAuthority: Address;
  expectedVault: Address;
}): EventPoolSummary {
  if (input.pool.version !== 1) {
    throw new Error("Unsupported event pool version.");
  }
  if (input.pool.coachAuthority !== input.expectedCoachAuthority) {
    throw new Error("Event pool belongs to a different coach authority.");
  }
  if (input.pool.vault !== input.expectedVault) {
    throw new Error("Event pool points to a different token vault.");
  }
  if (input.pool.paymentMint !== DEVNET_EURC_MINT_ADDRESS) {
    throw new Error("Event pool uses an unsupported payment mint.");
  }
  if (
    input.pool.minimumParticipants < MIN_EVENT_PARTICIPANTS ||
    input.pool.maximumParticipants > MAX_EVENT_PARTICIPANTS ||
    input.pool.maximumParticipants < input.pool.minimumParticipants ||
    input.pool.participantCount > input.pool.maximumParticipants
  ) {
    throw new Error("Event pool has invalid participant bounds.");
  }
  if (
    input.pool.priceEurcBaseUnits <= BigInt(0) ||
    input.pool.priceEurcBaseUnits > MAX_EVENT_PRICE_EURC_BASE_UNITS
  ) {
    throw new Error("Event pool has an invalid seat price.");
  }
  if (
    input.pool.totalFundedBaseUnits !==
    input.pool.priceEurcBaseUnits * BigInt(input.pool.participantCount)
  ) {
    throw new Error("Event pool funding total is inconsistent.");
  }
  if (input.pool.totalRefundedBaseUnits > input.pool.totalFundedBaseUnits) {
    throw new Error("Event pool refund total exceeds recorded funding.");
  }

  return {
    coachAuthority: input.pool.coachAuthority,
    payoutRecipient: input.pool.payoutRecipient,
    paymentMint: input.pool.paymentMint,
    vault: input.pool.vault,
    nonce: input.pool.nonce,
    priceEurcBaseUnits: input.pool.priceEurcBaseUnits,
    minimumParticipants: input.pool.minimumParticipants,
    maximumParticipants: input.pool.maximumParticipants,
    participantCount: input.pool.participantCount,
    totalFundedBaseUnits: input.pool.totalFundedBaseUnits,
    totalRefundedBaseUnits: input.pool.totalRefundedBaseUnits,
    fundingDeadline: input.pool.fundingDeadline,
    eventStartAt: input.pool.eventStartAt,
    eventEndAt: input.pool.eventEndAt,
    createdAt: input.pool.createdAt,
    status: input.pool.status,
    settledAt: isNone(input.pool.settledAt) ? null : input.pool.settledAt.value,
    paidAt: isNone(input.pool.paidAt) ? null : input.pool.paidAt.value,
  };
}

export function projectContributionSummary(input: {
  contribution: Contribution;
  expectedEventPool: Address;
  expectedParticipantWallet: Address;
  expectedAmountEurcBaseUnits: bigint;
}): ContributionSummary {
  if (input.contribution.version !== 1) {
    throw new Error("Unsupported contribution version.");
  }
  if (input.contribution.eventPool !== input.expectedEventPool) {
    throw new Error("Contribution belongs to a different event pool.");
  }
  if (
    input.contribution.participantWallet !== input.expectedParticipantWallet
  ) {
    throw new Error("Contribution belongs to a different participant wallet.");
  }
  if (
    input.contribution.amountEurcBaseUnits !== input.expectedAmountEurcBaseUnits
  ) {
    throw new Error(
      "Contribution amount does not match the prepared seat price.",
    );
  }

  return {
    eventPool: input.contribution.eventPool,
    participantWallet: input.contribution.participantWallet,
    amountEurcBaseUnits: input.contribution.amountEurcBaseUnits,
    status: input.contribution.status,
    fundedAt: input.contribution.fundedAt,
    refundedAt: isNone(input.contribution.refundedAt)
      ? null
      : input.contribution.refundedAt.value,
  };
}
