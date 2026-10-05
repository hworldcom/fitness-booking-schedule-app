import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getMintEncoder,
  getTokenEncoder,
} from "@solana-program/token";
import { address, generateKeyPairSigner, type Address } from "@solana/kit";
import { getCoachAuthorityEncoder } from "../../clients/js/src/generated/accounts/coachAuthority";
import { getContributionEncoder } from "../../clients/js/src/generated/accounts/contribution";
import { getEventPoolEncoder } from "../../clients/js/src/generated/accounts/eventPool";
import { ContributionStatus } from "../../clients/js/src/generated/types/contributionStatus";
import { EventPoolStatus } from "../../clients/js/src/generated/types/eventPoolStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveEventAuthorityAddress,
  uuidToSeed,
} from "../../src/solana/coach-pass";
import {
  deriveContributionAddress,
  deriveEventPoolAddress,
  deriveEventVaultAddress,
} from "../../src/solana/group-event";
import {
  CoachPassRpcError,
  type CoachPassRawAccount,
  type CoachPassRpcGateway,
} from "../../src/server/solana/coach-pass-rpc";
import {
  decodeVerifiedContribution,
  decodeVerifiedEventPool,
  readGroupEventCreationState,
  readGroupEventFundingState,
  readGroupEventRefundState,
} from "../../src/server/solana/group-event-rpc";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const LOADER = address("BPFLoaderUpgradeab1e11111111111111111111111");

function rawAccount(input: {
  address: Address;
  owner: Address;
  data?: Uint8Array;
  executable?: boolean;
}): CoachPassRawAccount {
  return Object.freeze({
    address: input.address,
    owner: input.owner,
    executable: input.executable ?? false,
    data: input.data ?? new Uint8Array(),
  });
}

function padAccountData(data: Uint8Array, size: number) {
  const padded = new Uint8Array(size);
  padded.set(data);
  return padded;
}

async function chainFixture() {
  const [coach, participant, recovery] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const [coachAuthorityAddress, coachAuthorityBump] =
    await deriveCoachAuthorityAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      runId: RUN_ID,
      profileId: PROFILE_ID,
      originalWallet: coach.address,
    });
  const [eventPoolAddress, eventPoolBump] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(4),
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
  const [participantTokenAccountAddress] = await findAssociatedTokenPda({
    owner: participant.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: DEVNET_EURC_MINT_ADDRESS,
  });
  const [eventAuthorityAddress] = await deriveEventAuthorityAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  });
  const coachAuthorityData = new Uint8Array(
    getCoachAuthorityEncoder().encode({
      runId: [...uuidToSeed(RUN_ID)],
      profileId: [...uuidToSeed(PROFILE_ID)],
      originalWallet: coach.address,
      currentWallet: coach.address,
      recoveryAuthority: recovery.address,
      authorityEpoch: BigInt(0),
      eventSequence: BigInt(0),
      bump: coachAuthorityBump,
      reserved: Array(47).fill(0),
    }),
  );
  const eventPoolData = padAccountData(
    new Uint8Array(
      getEventPoolEncoder().encode({
        version: 1,
        coachAuthority: coachAuthorityAddress,
        payoutRecipient: coach.address,
        paymentMint: DEVNET_EURC_MINT_ADDRESS,
        vault: vaultAddress,
        nonce: BigInt(4),
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
        settledAt: null,
        paidAt: null,
        bump: eventPoolBump,
        vaultBump,
        reserved: Array(64).fill(0),
      }),
    ),
    292,
  );
  const contributionData = padAccountData(
    new Uint8Array(
      getContributionEncoder().encode({
        version: 1,
        eventPool: eventPoolAddress,
        participantWallet: participant.address,
        amountEurcBaseUnits: BigInt(25_000_000),
        status: ContributionStatus.Funded,
        fundedAt: BigInt(1_900_000_100),
        refundedAt: null,
        bump: contributionBump,
        reserved: Array(36).fill(0),
      }),
    ),
    136,
  );
  const mintData = new Uint8Array(
    getMintEncoder().encode({
      decimals: 6,
      freezeAuthority: null,
      isInitialized: true,
      mintAuthority: null,
      supply: BigInt(500_000_000),
    }),
  );
  const vaultData = new Uint8Array(
    getTokenEncoder().encode({
      mint: DEVNET_EURC_MINT_ADDRESS,
      owner: eventPoolAddress,
      amount: BigInt(25_000_000),
      delegate: null,
      state: AccountState.Initialized,
      isNative: null,
      delegatedAmount: BigInt(0),
      closeAuthority: null,
    }),
  );
  const participantTokenData = new Uint8Array(
    getTokenEncoder().encode({
      mint: DEVNET_EURC_MINT_ADDRESS,
      owner: participant.address,
      amount: BigInt(50_000_000),
      delegate: null,
      state: AccountState.Initialized,
      isNative: null,
      delegatedAmount: BigInt(0),
      closeAuthority: null,
    }),
  );
  const accounts = new Map<Address, CoachPassRawAccount>([
    [
      MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      rawAccount({
        address: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        owner: LOADER,
        executable: true,
      }),
    ],
    [
      DEVNET_EURC_MINT_ADDRESS,
      rawAccount({
        address: DEVNET_EURC_MINT_ADDRESS,
        owner: TOKEN_PROGRAM_ADDRESS,
        data: mintData,
      }),
    ],
    [
      coachAuthorityAddress,
      rawAccount({
        address: coachAuthorityAddress,
        owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        data: coachAuthorityData,
      }),
    ],
    [
      eventPoolAddress,
      rawAccount({
        address: eventPoolAddress,
        owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        data: eventPoolData,
      }),
    ],
    [
      vaultAddress,
      rawAccount({
        address: vaultAddress,
        owner: TOKEN_PROGRAM_ADDRESS,
        data: vaultData,
      }),
    ],
    [
      participantTokenAccountAddress,
      rawAccount({
        address: participantTokenAccountAddress,
        owner: TOKEN_PROGRAM_ADDRESS,
        data: participantTokenData,
      }),
    ],
  ]);
  const rpc = {
    async accounts(addresses: readonly Address[]) {
      return {
        slot: BigInt(99),
        values: addresses.map((current) => accounts.get(current) ?? null),
      };
    },
  } as unknown as CoachPassRpcGateway;
  return {
    coach,
    participant,
    coachAuthorityAddress,
    eventPoolAddress,
    vaultAddress,
    contributionAddress,
    participantTokenAccountAddress,
    eventAuthorityAddress,
    eventPoolData,
    contributionData,
    accounts,
    rpc,
  };
}

test("strict group-event decoders reject the wrong address and discriminator", async () => {
  const fixture = await chainFixture();
  const eventPoolAccount = fixture.accounts.get(fixture.eventPoolAddress)!;
  assert.equal(
    decodeVerifiedEventPool({
      account: eventPoolAccount,
      expectedAddress: fixture.eventPoolAddress,
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    }).nonce,
    BigInt(4),
  );
  assert.throws(
    () =>
      decodeVerifiedEventPool({
        account: { ...eventPoolAccount, address: fixture.coach.address },
        expectedAddress: fixture.eventPoolAddress,
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      }),
    /unexpected address/u,
  );

  const corrupted = Uint8Array.from(fixture.contributionData);
  corrupted[0] ^= 1;
  assert.throws(
    () =>
      decodeVerifiedContribution({
        account: rawAccount({
          address: fixture.contributionAddress,
          owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
          data: corrupted,
        }),
        expectedAddress: fixture.contributionAddress,
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      }),
    /owner, size or discriminator/u,
  );
});

test("funding reads verify the program, EURC vault, absent contribution and balance", async () => {
  const fixture = await chainFixture();
  const state = await readGroupEventFundingState({
    rpc: fixture.rpc,
    commitment: "confirmed",
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    eventPoolAddress: fixture.eventPoolAddress,
    participantWalletAddress: fixture.participant.address,
  });
  assert.equal(state.slot, BigInt(99));
  assert.equal(state.contributionAddress, fixture.contributionAddress);
  assert.equal(state.vault.amount, BigInt(25_000_000));
  assert.equal(state.participantEurcAccount.amount, BigInt(50_000_000));

  fixture.accounts.set(
    fixture.vaultAddress,
    rawAccount({
      address: fixture.vaultAddress,
      owner: TOKEN_PROGRAM_ADDRESS,
      data: new Uint8Array(
        getTokenEncoder().encode({
          mint: DEVNET_EURC_MINT_ADDRESS,
          owner: fixture.eventAuthorityAddress,
          amount: BigInt(25_000_000),
          delegate: null,
          state: AccountState.Initialized,
          isNative: null,
          delegatedAmount: BigInt(0),
          closeAuthority: null,
        }),
      ),
    }),
  );
  await assert.rejects(
    readGroupEventFundingState({
      rpc: fixture.rpc,
      commitment: "confirmed",
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      eventPoolAddress: fixture.eventPoolAddress,
      participantWalletAddress: fixture.participant.address,
    }),
    /unexpected owner or mint/u,
  );

  fixture.accounts.set(
    fixture.vaultAddress,
    rawAccount({
      address: fixture.vaultAddress,
      owner: TOKEN_PROGRAM_ADDRESS,
      data: new Uint8Array(
        getTokenEncoder().encode({
          mint: DEVNET_EURC_MINT_ADDRESS,
          owner: fixture.eventPoolAddress,
          amount: BigInt(25_000_001),
          delegate: null,
          state: AccountState.Initialized,
          isNative: null,
          delegatedAmount: BigInt(0),
          closeAuthority: null,
        }),
      ),
    }),
  );
  assert.equal(
    (
      await readGroupEventFundingState({
        rpc: fixture.rpc,
        commitment: "confirmed",
        programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
        eventPoolAddress: fixture.eventPoolAddress,
        participantWalletAddress: fixture.participant.address,
      })
    ).vault.amount,
    BigInt(25_000_001),
  );
  fixture.accounts.set(
    fixture.vaultAddress,
    rawAccount({
      address: fixture.vaultAddress,
      owner: TOKEN_PROGRAM_ADDRESS,
      data: new Uint8Array(
        getTokenEncoder().encode({
          mint: DEVNET_EURC_MINT_ADDRESS,
          owner: fixture.eventPoolAddress,
          amount: BigInt(24_999_999),
          delegate: null,
          state: AccountState.Initialized,
          isNative: null,
          delegatedAmount: BigInt(0),
          closeAuthority: null,
        }),
      ),
    }),
  );
  await assert.rejects(
    readGroupEventFundingState({
      rpc: fixture.rpc,
      commitment: "confirmed",
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      eventPoolAddress: fixture.eventPoolAddress,
      participantWalletAddress: fixture.participant.address,
    }),
    /below the recorded event liability/u,
  );
  fixture.accounts.set(
    fixture.vaultAddress,
    rawAccount({
      address: fixture.vaultAddress,
      owner: TOKEN_PROGRAM_ADDRESS,
      data: new Uint8Array(
        getTokenEncoder().encode({
          mint: DEVNET_EURC_MINT_ADDRESS,
          owner: fixture.eventPoolAddress,
          amount: BigInt(25_000_000),
          delegate: null,
          state: AccountState.Initialized,
          isNative: null,
          delegatedAmount: BigInt(0),
          closeAuthority: null,
        }),
      ),
    }),
  );

  fixture.accounts.set(
    fixture.contributionAddress,
    rawAccount({
      address: fixture.contributionAddress,
      owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      data: fixture.contributionData,
    }),
  );
  await assert.rejects(
    readGroupEventFundingState({
      rpc: fixture.rpc,
      commitment: "confirmed",
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      eventPoolAddress: fixture.eventPoolAddress,
      participantWalletAddress: fixture.participant.address,
    }),
    (error: unknown) =>
      error instanceof CoachPassRpcError && error.code === "account-invalid",
  );
});

test("creation requires unused pool and vault accounts while recovery decodes contributions", async () => {
  const fixture = await chainFixture();
  const [unusedPoolAddress] = await deriveEventPoolAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: fixture.coachAuthorityAddress,
    nonce: BigInt(5),
  });
  const [unusedVaultAddress] = await deriveEventVaultAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    eventPool: unusedPoolAddress,
  });
  const creation = await readGroupEventCreationState({
    rpc: fixture.rpc,
    commitment: "confirmed",
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    eventPoolAddress: unusedPoolAddress,
    vaultAddress: unusedVaultAddress,
  });
  assert.equal(creation.coachAuthority.currentWallet, fixture.coach.address);

  fixture.accounts.set(
    fixture.contributionAddress,
    rawAccount({
      address: fixture.contributionAddress,
      owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      data: fixture.contributionData,
    }),
  );
  const refund = await readGroupEventRefundState({
    rpc: fixture.rpc,
    commitment: "finalized",
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    eventPoolAddress: fixture.eventPoolAddress,
    participantWalletAddress: fixture.participant.address,
  });
  assert.equal(refund.contribution.amountEurcBaseUnits, BigInt(25_000_000));
  assert.equal(
    refund.participantTokenAccountAddress,
    fixture.participantTokenAccountAddress,
  );
});
