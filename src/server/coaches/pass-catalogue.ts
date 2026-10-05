import "server-only";

import {
  createSolanaRpc,
  devnet,
  getAddressEncoder,
  getBase64Decoder,
  getBase64Encoder,
  isNone,
  type Address,
  type Base64EncodedBytes,
  type ReadonlyUint8Array,
} from "@solana/kit";
import { COACH_AUTHORITY_DISCRIMINATOR } from "../../../clients/js/src/generated/accounts/coachAuthority";
import {
  OFFER_DISCRIMINATOR,
  type Offer,
} from "../../../clients/js/src/generated/accounts/offer";
import { OfferStatus } from "../../../clients/js/src/generated/types/offerStatus";
import {
  type PublicCoachPassCatalogueState,
  type PublicCoachPassOffer,
  formatEurcBaseUnits,
} from "@/domain/coach-marketplace";
import {
  DEVNET_EURC_MINT_ADDRESS,
  deriveCoachAuthorityAddress,
  deriveOfferAddress,
  seedToUuid,
  uuidToSeed,
} from "@/solana/coach-pass";
import { publicCoachChainIdentityRecord } from "@/server/db/coaches/repository";
import { coachPassReadConfig } from "@/server/solana/coach-pass-read-config";
import {
  decodeVerifiedCoachAuthority,
  decodeVerifiedOffer,
  type CoachPassRawAccount,
} from "@/server/solana/coach-pass-rpc";

const COACH_AUTHORITY_ACCOUNT_SIZE = BigInt(200);
const OFFER_ACCOUNT_SIZE = BigInt(232);

type PublicCoachChainIdentity = Readonly<{
  runId: string;
  profileId: string;
}>;

export interface CoachPassCatalogueGateway {
  coachAuthorities(
    input: PublicCoachChainIdentity,
  ): Promise<readonly CoachPassRawAccount[]>;
  offers(
    coachAuthorityAddress: Address,
  ): Promise<readonly CoachPassRawAccount[]>;
}

function base64Bytes(value: ReadonlyUint8Array): Base64EncodedBytes {
  return getBase64Decoder().decode(value) as Base64EncodedBytes;
}

function rawProgramAccount(value: {
  pubkey: Address;
  account: {
    owner: Address;
    executable: boolean;
    data: readonly [string, string];
  };
}): CoachPassRawAccount {
  return Object.freeze({
    address: value.pubkey,
    owner: value.account.owner,
    executable: value.account.executable,
    data: new Uint8Array(getBase64Encoder().encode(value.account.data[0])),
  });
}

export function createCoachPassCatalogueGateway(input: {
  rpcUrl: string;
  programAddress: Address;
}): CoachPassCatalogueGateway {
  const rpc = createSolanaRpc(devnet(input.rpcUrl));
  async function programAccounts(
    size: bigint,
    filters: readonly Readonly<{
      offset: bigint;
      bytes: Base64EncodedBytes;
    }>[],
  ) {
    const values = await rpc
      .getProgramAccounts(input.programAddress, {
        encoding: "base64",
        commitment: "finalized",
        filters: [
          { dataSize: size },
          ...filters.map((filter) => ({
            memcmp: { ...filter, encoding: "base64" as const },
          })),
        ],
      })
      .send();
    return Object.freeze(values.map(rawProgramAccount));
  }

  return Object.freeze({
    coachAuthorities(identity: PublicCoachChainIdentity) {
      return programAccounts(COACH_AUTHORITY_ACCOUNT_SIZE, [
        {
          offset: BigInt(0),
          bytes: base64Bytes(COACH_AUTHORITY_DISCRIMINATOR),
        },
        { offset: BigInt(8), bytes: base64Bytes(uuidToSeed(identity.runId)) },
        {
          offset: BigInt(24),
          bytes: base64Bytes(uuidToSeed(identity.profileId)),
        },
      ]);
    },
    offers(coachAuthorityAddress: Address) {
      return programAccounts(OFFER_ACCOUNT_SIZE, [
        { offset: BigInt(0), bytes: base64Bytes(OFFER_DISCRIMINATOR) },
        {
          offset: BigInt(8),
          bytes: base64Bytes(getAddressEncoder().encode(coachAuthorityAddress)),
        },
      ]);
    },
  });
}

export async function projectPublicCoachPassOffers(input: {
  programAddress: Address;
  identity: PublicCoachChainIdentity;
  authorityAccount: CoachPassRawAccount;
  offerAccounts: readonly CoachPassRawAccount[];
  currentUnixSeconds: bigint;
}): Promise<readonly PublicCoachPassOffer[]> {
  const authority = decodeVerifiedCoachAuthority(
    input.authorityAccount,
    input.programAddress,
  );
  if (
    seedToUuid(authority.runId) !== input.identity.runId ||
    seedToUuid(authority.profileId) !== input.identity.profileId
  ) {
    throw new Error("Coach authority does not match the public coach.");
  }

  const [derivedAuthorityAddress, derivedAuthorityBump] =
    await deriveCoachAuthorityAddress({
      programAddress: input.programAddress,
      runId: input.identity.runId,
      profileId: input.identity.profileId,
      originalWallet: authority.originalWallet,
    });
  if (
    derivedAuthorityAddress !== input.authorityAccount.address ||
    derivedAuthorityBump !== authority.bump
  ) {
    throw new Error("Coach authority failed seed verification.");
  }

  const decodedOffers = await Promise.all(
    input.offerAccounts.map(async (account) => {
      const offer = decodeVerifiedOffer(account, input.programAddress);
      const [derivedAddress, derivedBump] = await deriveOfferAddress({
        programAddress: input.programAddress,
        coachAuthority: input.authorityAccount.address,
        nonce: offer.nonce,
      });
      if (derivedAddress !== account.address || derivedBump !== offer.bump) {
        throw new Error("Coach offer failed seed verification.");
      }
      return {
        address: account.address,
        offer,
      };
    }),
  );
  const offers = decodedOffers
    .filter(
      (entry): entry is { address: Address; offer: Offer } =>
        entry.offer.coachAuthority === input.authorityAccount.address &&
        entry.offer.paymentMint === DEVNET_EURC_MINT_ADDRESS &&
        entry.offer.paymentRecipient === authority.currentWallet &&
        entry.offer.authorityEpoch === authority.authorityEpoch &&
        entry.offer.status === OfferStatus.Active &&
        isNone(entry.offer.restrictedClient) &&
        (entry.offer.sessionCount === 1 || entry.offer.sessionCount === 10) &&
        entry.offer.priceEurcBaseUnits > BigInt(0) &&
        (entry.offer.validitySeconds === 0 ||
          input.currentUnixSeconds <
            entry.offer.createdAt + BigInt(entry.offer.validitySeconds)),
    )
    .map((entry) => {
      const credits = entry.offer.sessionCount as 1 | 10;
      const priceEurcBaseUnits = entry.offer.priceEurcBaseUnits.toString();
      return Object.freeze({
        address: entry.address,
        coachAuthorityAddress: input.authorityAccount.address,
        paymentRecipientAddress: entry.offer.paymentRecipient,
        credits,
        priceEurcBaseUnits,
        priceEurc: formatEurcBaseUnits(priceEurcBaseUnits),
        restricted: false as const,
      });
    })
    .sort((left, right) => left.credits - right.credits);

  return Object.freeze(offers);
}

export async function publicCoachPassCatalogue(
  profileId: string,
): Promise<PublicCoachPassCatalogueState> {
  try {
    const identity = await publicCoachChainIdentityRecord(profileId);
    if (!identity) return Object.freeze({ status: "not-published" });
    const config = coachPassReadConfig();
    const gateway = createCoachPassCatalogueGateway({
      rpcUrl: config.serverRpcUrl,
      programAddress: config.programAddress,
    });
    const authorities = await gateway.coachAuthorities(identity);
    if (authorities.length === 0) {
      return Object.freeze({ status: "not-published" });
    }
    if (authorities.length !== 1) {
      return Object.freeze({ status: "unavailable" });
    }
    const offers = await projectPublicCoachPassOffers({
      programAddress: config.programAddress,
      identity,
      authorityAccount: authorities[0]!,
      offerAccounts: await gateway.offers(authorities[0]!.address),
      currentUnixSeconds: BigInt(Math.floor(Date.now() / 1_000)),
    });
    return offers.length === 0
      ? Object.freeze({ status: "not-published" })
      : Object.freeze({ status: "ready", cluster: "devnet", offers });
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}
