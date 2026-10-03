import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  getUtf8Encoder,
  type Address,
} from "@solana/kit";
import type { CoachAuthority } from "../../clients/js/src/generated/accounts/coachAuthority";
import type { Offer } from "../../clients/js/src/generated/accounts/offer";
import { OfferStatus } from "../../clients/js/src/generated/types/offerStatus";

export const MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS = address(
  "DfpqcSwSer4MrPehwFk2Jota3yJVhqobWWD2Aq1crARB",
);
export const DEVNET_USDC_MINT_ADDRESS = address(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
export const MIN_OFFER_VALIDITY_SECONDS = 24 * 60 * 60;
export const MAX_OFFER_VALIDITY_SECONDS = 365 * 24 * 60 * 60;

const COACH_AUTHORITY_SEED = getUtf8Encoder().encode("coach-authority");
const OFFER_SEED = getUtf8Encoder().encode("offer");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type CoachOfferMetadata = Readonly<{
  title: string;
  service: string;
  description: string;
  imagePath: string | null;
}>;

export type CoachOfferMetadataResult =
  | Readonly<{ valid: true; value: CoachOfferMetadata }>
  | Readonly<{ valid: false; errors: readonly string[] }>;

export function uuidToSeed(value: string): Uint8Array {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error("Expected a canonical UUID.");
  }

  return Uint8Array.from(
    normalized
      .replaceAll("-", "")
      .match(/.{2}/gu)!
      .map((byte) => Number.parseInt(byte, 16)),
  );
}

export async function deriveCoachAuthorityAddress(input: {
  programAddress: Address;
  runId: string;
  profileId: string;
  originalWallet: Address;
}): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: input.programAddress,
    seeds: [
      COACH_AUTHORITY_SEED,
      uuidToSeed(input.runId),
      uuidToSeed(input.profileId),
      getAddressEncoder().encode(input.originalWallet),
    ],
  });
}

export async function deriveOfferAddress(input: {
  programAddress: Address;
  coachAuthority: Address;
  nonce: bigint;
}): Promise<readonly [Address, number]> {
  if (input.nonce < BigInt(0) || input.nonce > BigInt("18446744073709551615")) {
    throw new Error("Offer nonce must fit an unsigned 64-bit integer.");
  }

  return getProgramDerivedAddress({
    programAddress: input.programAddress,
    seeds: [
      OFFER_SEED,
      getAddressEncoder().encode(input.coachAuthority),
      getU64Encoder().encode(input.nonce),
    ],
  });
}

export function isOfferPurchaseEligible(input: {
  offer: Offer;
  offerCoachAuthorityAddress: Address;
  authority: CoachAuthority;
}): boolean {
  return (
    input.offer.status === OfferStatus.Active &&
    input.offer.coachAuthority === input.offerCoachAuthorityAddress &&
    input.offer.authorityEpoch === input.authority.authorityEpoch &&
    input.offer.paymentRecipient === input.authority.currentWallet &&
    input.offer.paymentMint === DEVNET_USDC_MINT_ADDRESS
  );
}

export function parseCoachOfferMetadata(
  input: Readonly<Record<string, unknown>>,
): CoachOfferMetadataResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const service = typeof input.service === "string" ? input.service.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const imagePath =
    typeof input.imagePath === "string" && input.imagePath.trim().length > 0
      ? input.imagePath.trim()
      : null;
  const errors: string[] = [];

  if (title.length < 3 || title.length > 80) {
    errors.push("Title must contain between 3 and 80 characters.");
  }
  if (service.length < 2 || service.length > 80) {
    errors.push("Service must contain between 2 and 80 characters.");
  }
  if (description.length < 20 || description.length > 600) {
    errors.push("Description must contain between 20 and 600 characters.");
  }
  if (
    imagePath !== null &&
    (!imagePath.startsWith("/") || imagePath.startsWith("//"))
  ) {
    errors.push("Image path must be an application-relative path.");
  }

  return errors.length > 0
    ? { valid: false, errors }
    : {
        valid: true,
        value: { title, service, description, imagePath },
      };
}
