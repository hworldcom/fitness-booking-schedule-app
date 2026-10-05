import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSigner, none, some, type Address } from "@solana/kit";
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
import { projectPublicCoachPassOffers } from "../../src/server/coaches/pass-catalogue";
import { parseCoachPassReadConfig } from "../../src/server/solana/coach-pass-read-config";
import type { CoachPassRawAccount } from "../../src/server/solana/coach-pass-rpc";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";

test("public catalogue reads reviewed Devnet configuration without sponsor key material", () => {
  const config = parseCoachPassReadConfig({
    cluster: "devnet",
    serverRpcUrl: "https://api.devnet.solana.com",
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
  });
  assert.equal(config.cluster, "devnet");
  assert.equal(config.programAddress, MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS);
  assert.equal("sponsor" in config, false);
});

function rawAccount(input: {
  address: Address;
  data: Uint8Array;
}): CoachPassRawAccount {
  return Object.freeze({
    address: input.address,
    owner: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    executable: false,
    data: input.data,
  });
}

async function fixture() {
  const [coach, recovery, restrictedClient] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  const [authorityAddress, authorityBump] = await deriveCoachAuthorityAddress({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    runId: RUN_ID,
    profileId: PROFILE_ID,
    originalWallet: coach.address,
  });
  const authorityData = new Uint8Array(
    getCoachAuthorityEncoder().encode({
      runId: [...uuidToSeed(RUN_ID)],
      profileId: [...uuidToSeed(PROFILE_ID)],
      originalWallet: coach.address,
      currentWallet: coach.address,
      recoveryAuthority: recovery.address,
      authorityEpoch: BigInt(2),
      eventSequence: BigInt(0),
      bump: authorityBump,
      reserved: Array(47).fill(0),
    }),
  );

  async function offer(input: {
    nonce: bigint;
    credits: number;
    price: bigint;
    status?: OfferStatus;
    authorityEpoch?: bigint;
    restricted?: boolean;
    validitySeconds?: number;
  }) {
    const [offerAddress, bump] = await deriveOfferAddress({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      coachAuthority: authorityAddress,
      nonce: input.nonce,
    });
    const encoded = getOfferEncoder().encode({
      coachAuthority: authorityAddress,
      paymentRecipient: coach.address,
      paymentMint: DEVNET_EURC_MINT_ADDRESS,
      nonce: input.nonce,
      priceEurcBaseUnits: input.price,
      authorityEpoch: input.authorityEpoch ?? BigInt(2),
      createdAt: BigInt(1_900_000_000),
      validitySeconds: input.validitySeconds ?? 0,
      sessionCount: input.credits,
      status: input.status ?? OfferStatus.Active,
      bump,
      reserved: Array(47).fill(0),
      restrictedClient: input.restricted
        ? some(restrictedClient.address)
        : none(),
      deactivatedAt: none(),
    });
    const data = new Uint8Array(232);
    data.set(encoded);
    return rawAccount({ address: offerAddress, data });
  }

  return {
    coachAddress: coach.address,
    authorityAddress,
    authorityAccount: rawAccount({
      address: authorityAddress,
      data: authorityData,
    }),
    one: await offer({
      nonce: BigInt(0),
      credits: 1,
      price: BigInt(10_000_000),
    }),
    ten: await offer({
      nonce: BigInt(1),
      credits: 10,
      price: BigInt(100_000_000),
    }),
    restricted: await offer({
      nonce: BigInt(2),
      credits: 1,
      price: BigInt(7_500_000),
      restricted: true,
    }),
    expired: await offer({
      nonce: BigInt(3),
      credits: 1,
      price: BigInt(9_000_000),
      validitySeconds: 60,
    }),
    rotated: await offer({
      nonce: BigInt(4),
      credits: 10,
      price: BigInt(90_000_000),
      authorityEpoch: BigInt(1),
    }),
    deactivated: await offer({
      nonce: BigInt(5),
      credits: 10,
      price: BigInt(80_000_000),
      status: OfferStatus.Deactivated,
    }),
  };
}

test("public offer catalogue exposes only current unrestricted one/ten-credit terms", async () => {
  const value = await fixture();
  const offers = await projectPublicCoachPassOffers({
    programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
    identity: { runId: RUN_ID, profileId: PROFILE_ID },
    authorityAccount: value.authorityAccount,
    offerAccounts: [
      value.ten,
      value.restricted,
      value.expired,
      value.one,
      value.rotated,
      value.deactivated,
    ],
    currentUnixSeconds: BigInt(1_900_000_061),
  });

  assert.deepEqual(
    offers.map((offer) => ({
      credits: offer.credits,
      price: offer.priceEurc,
      recipient: offer.paymentRecipientAddress,
    })),
    [
      { credits: 1, price: "10", recipient: value.coachAddress },
      { credits: 10, price: "100", recipient: value.coachAddress },
    ],
  );
  assert.equal(offers[0]?.coachAuthorityAddress, value.authorityAddress);
  assert.equal(offers[0]?.restricted, false);
});

test("public offer catalogue rejects a seed-invalid authority address", async () => {
  const value = await fixture();
  const substituted = await generateKeyPairSigner();
  await assert.rejects(
    projectPublicCoachPassOffers({
      programAddress: MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS,
      identity: { runId: RUN_ID, profileId: PROFILE_ID },
      authorityAccount: {
        ...value.authorityAccount,
        address: substituted.address,
      },
      offerAccounts: [value.one],
      currentUnixSeconds: BigInt(1_900_000_000),
    }),
    /seed verification/u,
  );
});
