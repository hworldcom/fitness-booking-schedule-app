import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  getMintEncoder,
  getTokenEncoder,
} from "@solana-program/token";
import {
  address,
  generateKeyPairSigner,
  none,
  type Address,
} from "@solana/kit";
import { getCoachAuthorityEncoder } from "../../clients/js/src/generated/accounts/coachAuthority";
import { getOfferEncoder } from "../../clients/js/src/generated/accounts/offer";
import { OfferStatus } from "../../clients/js/src/generated/types/offerStatus";
import {
  DEVNET_EURC_MINT_ADDRESS,
  MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveOfferAddress,
  uuidToSeed,
} from "../../src/solana/coach-pass";
import {
  CoachPassRpcError,
  decodeVerifiedCoachAuthority,
  decodeVerifiedEurcMint,
  decodeVerifiedEurcTokenAccount,
  readCoachPassPurchaseState,
  validateCoachPassProgramAccount,
  type CoachPassRawAccount,
  type CoachPassRpcGateway,
} from "../../src/server/solana/coach-pass-rpc";

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

async function chainFixture() {
  const [coach, client, recovery] = await Promise.all([
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
  const [offerAddress, offerBump] = await deriveOfferAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthority: coachAuthorityAddress,
    nonce: BigInt(2),
  });
  const encodedOffer = getOfferEncoder().encode({
    coachAuthority: coachAuthorityAddress,
    paymentRecipient: coach.address,
    paymentMint: DEVNET_EURC_MINT_ADDRESS,
    nonce: BigInt(2),
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
  });
  const offerData = new Uint8Array(232);
  offerData.set(encodedOffer);
  const mintData = new Uint8Array(
    getMintEncoder().encode({
      decimals: 6,
      freezeAuthority: null,
      isInitialized: true,
      mintAuthority: null,
      supply: BigInt(80_000_000),
    }),
  );
  const clientTokenData = new Uint8Array(
    getTokenEncoder().encode({
      mint: DEVNET_EURC_MINT_ADDRESS,
      owner: client.address,
      amount: BigInt(16_000_000),
      delegate: null,
      state: AccountState.Initialized,
      isNative: null,
      delegatedAmount: BigInt(0),
      closeAuthority: null,
    }),
  );
  return {
    coach,
    client,
    coachAuthorityAddress,
    coachAuthorityData,
    offerAddress,
    offerData,
    mintData,
    clientTokenData,
  };
}

test("program and generated accounts require exact owners, sizes and discriminators", async () => {
  const fixture = await chainFixture();
  const program = rawAccount({
    address: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    owner: LOADER,
    executable: true,
  });
  assert.doesNotThrow(() =>
    validateCoachPassProgramAccount(
      program,
      MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    ),
  );
  assert.throws(
    () =>
      validateCoachPassProgramAccount(
        { ...program, executable: false },
        MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      ),
    (error: unknown) =>
      error instanceof CoachPassRpcError && error.code === "account-invalid",
  );

  const authority = rawAccount({
    address: fixture.coachAuthorityAddress,
    owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    data: fixture.coachAuthorityData,
  });
  assert.equal(
    decodeVerifiedCoachAuthority(
      authority,
      MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    ).currentWallet,
    fixture.coach.address,
  );
  const corrupted = Uint8Array.from(fixture.coachAuthorityData);
  corrupted[0] ^= 1;
  assert.throws(
    () =>
      decodeVerifiedCoachAuthority(
        { ...authority, data: corrupted },
        MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      ),
    /owner, size or discriminator/u,
  );
  assert.throws(
    () =>
      decodeVerifiedCoachAuthority(
        { ...authority, data: corrupted.slice(0, -1) },
        MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      ),
    /owner, size or discriminator/u,
  );
});

test("EURC mint and accounts reject wrong decimals, mint and owner", async () => {
  const fixture = await chainFixture();
  const mint = rawAccount({
    address: DEVNET_EURC_MINT_ADDRESS,
    owner: TOKEN_PROGRAM_ADDRESS,
    data: fixture.mintData,
  });
  assert.equal(decodeVerifiedEurcMint(mint).decimals, 6);
  const invalidMint = new Uint8Array(
    getMintEncoder().encode({
      decimals: 9,
      freezeAuthority: null,
      isInitialized: true,
      mintAuthority: null,
      supply: BigInt(1),
    }),
  );
  assert.throws(
    () => decodeVerifiedEurcMint({ ...mint, data: invalidMint }),
    /unsupported/u,
  );

  const token = rawAccount({
    address: fixture.client.address,
    owner: TOKEN_PROGRAM_ADDRESS,
    data: fixture.clientTokenData,
  });
  assert.equal(
    decodeVerifiedEurcTokenAccount(token, fixture.client.address).amount,
    BigInt(16_000_000),
  );
  assert.throws(
    () => decodeVerifiedEurcTokenAccount(token, fixture.coach.address),
    /unexpected owner or mint/u,
  );
});

test("purchase reads pin the second account read and accept missing coach ATA", async () => {
  const fixture = await chainFixture();
  const observedOptions: unknown[] = [];
  const rpc: CoachPassRpcGateway = {
    async accounts(addresses, options) {
      observedOptions.push(options);
      if (addresses.length === 1) {
        return { slot: BigInt(78), values: [null] };
      }
      return {
        slot: BigInt(77),
        values: [
          rawAccount({
            address: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
            owner: LOADER,
            executable: true,
          }),
          rawAccount({
            address: DEVNET_EURC_MINT_ADDRESS,
            owner: TOKEN_PROGRAM_ADDRESS,
            data: fixture.mintData,
          }),
          rawAccount({
            address: fixture.coachAuthorityAddress,
            owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
            data: fixture.coachAuthorityData,
          }),
          rawAccount({
            address: fixture.offerAddress,
            owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
            data: fixture.offerData,
          }),
          null,
          rawAccount({
            address: addresses[5]!,
            owner: TOKEN_PROGRAM_ADDRESS,
            data: fixture.clientTokenData,
          }),
        ],
      };
    },
    async latestBlockhash() {
      throw new Error("not used");
    },
    async blockHeight() {
      throw new Error("not used");
    },
    async simulate() {
      throw new Error("not used");
    },
    async send() {
      throw new Error("not used");
    },
    async signatureStatus() {
      throw new Error("not used");
    },
  };
  const state = await readCoachPassPurchaseState({
    rpc,
    commitment: "confirmed",
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    coachAuthorityAddress: fixture.coachAuthorityAddress,
    offerAddress: fixture.offerAddress,
    clientWalletAddress: fixture.client.address,
  });
  assert.equal(state.slot, BigInt(78));
  assert.equal(state.coachClientCredits, null);
  assert.deepEqual(observedOptions, [
    { commitment: "confirmed" },
    { commitment: "confirmed", minContextSlot: BigInt(77) },
  ]);
});

test("purchase reads fail closed on insufficient client EURC", async () => {
  const fixture = await chainFixture();
  const insufficient = new Uint8Array(
    getTokenEncoder().encode({
      mint: DEVNET_EURC_MINT_ADDRESS,
      owner: fixture.client.address,
      amount: BigInt(1),
      delegate: null,
      state: AccountState.Initialized,
      isNative: null,
      delegatedAmount: BigInt(0),
      closeAuthority: null,
    }),
  );
  const rpc = {
    async accounts(addresses: readonly Address[]) {
      return {
        slot: BigInt(1),
        values: [
          rawAccount({
            address: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
            owner: LOADER,
            executable: true,
          }),
          rawAccount({
            address: DEVNET_EURC_MINT_ADDRESS,
            owner: TOKEN_PROGRAM_ADDRESS,
            data: fixture.mintData,
          }),
          rawAccount({
            address: fixture.coachAuthorityAddress,
            owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
            data: fixture.coachAuthorityData,
          }),
          rawAccount({
            address: fixture.offerAddress,
            owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
            data: fixture.offerData,
          }),
          null,
          rawAccount({
            address: addresses[5]!,
            owner: TOKEN_PROGRAM_ADDRESS,
            data: insufficient,
          }),
        ],
      };
    },
  } as unknown as CoachPassRpcGateway;
  await assert.rejects(
    readCoachPassPurchaseState({
      rpc,
      commitment: "confirmed",
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      coachAuthorityAddress: fixture.coachAuthorityAddress,
      offerAddress: fixture.offerAddress,
      clientWalletAddress: fixture.client.address,
    }),
    (error: unknown) =>
      error instanceof CoachPassRpcError && error.code === "insufficient-eurc",
  );
});
