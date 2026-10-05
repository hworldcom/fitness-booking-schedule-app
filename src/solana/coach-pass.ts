import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  getUtf8Encoder,
  isNone,
  type Address,
} from "@solana/kit";
import type { CoachAuthority } from "../../clients/js/src/generated/accounts/coachAuthority";
import type { CoachClientCredits } from "../../clients/js/src/generated/accounts/coachClientCredits";
import type { CreditReservation } from "../../clients/js/src/generated/accounts/creditReservation";
import type { Offer } from "../../clients/js/src/generated/accounts/offer";
import type { CreditReservationStatus } from "../../clients/js/src/generated/types/creditReservationStatus";
import { OfferStatus } from "../../clients/js/src/generated/types/offerStatus";

export const MOVX_COACH_PASS_LOCAL_PROGRAM_ADDRESS = address(
  "GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU",
);
export const DEVNET_EURC_MINT_ADDRESS = address(
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
);
export const MIN_OFFER_VALIDITY_SECONDS = 24 * 60 * 60;
export const MAX_OFFER_VALIDITY_SECONDS = 365 * 24 * 60 * 60;

const COACH_AUTHORITY_SEED = getUtf8Encoder().encode("coach-authority");
const COACH_CLIENT_CREDITS_SEED = getUtf8Encoder().encode(
  "coach-client-credits",
);
const CREDIT_RESERVATION_SEED = getUtf8Encoder().encode("credit-reservation");
const OFFER_SEED = getUtf8Encoder().encode("offer");
const EVENT_AUTHORITY_SEED = getUtf8Encoder().encode("__event_authority");
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

export type CoachClientCreditSummary = Readonly<{
  coachAuthority: Address;
  clientWallet: Address;
  availableCredits: bigint;
  reservedCredits: bigint;
  totalPurchased: bigint;
  purchaseCount: bigint;
  nextPurchaseNonce: bigint;
  lastOffer: Address;
  lastPurchaseAt: bigint;
}>;

export type CreditReservationSummary = Readonly<{
  coachClientCredits: Address;
  coachAuthority: Address;
  clientWallet: Address;
  bookingId: string;
  scheduledStartAt: bigint;
  earlyReturnUntil: bigint;
  status: CreditReservationStatus;
  reservedAt: bigint;
  resolvedAt: bigint | null;
}>;

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

export function seedToUuid(value: readonly number[]): string {
  if (value.length !== 16) {
    throw new Error("Expected a 16-byte UUID seed.");
  }

  const hex = value
    .map((byte) => {
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        throw new Error("UUID seed bytes must be unsigned 8-bit integers.");
      }
      return byte.toString(16).padStart(2, "0");
    })
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

export async function deriveCoachClientCreditsAddress(input: {
  programAddress: Address;
  coachAuthority: Address;
  clientWallet: Address;
}): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: input.programAddress,
    seeds: [
      COACH_CLIENT_CREDITS_SEED,
      getAddressEncoder().encode(input.coachAuthority),
      getAddressEncoder().encode(input.clientWallet),
    ],
  });
}

export async function deriveCreditReservationAddress(input: {
  programAddress: Address;
  coachClientCredits: Address;
  bookingId: string;
}): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: input.programAddress,
    seeds: [
      CREDIT_RESERVATION_SEED,
      getAddressEncoder().encode(input.coachClientCredits),
      uuidToSeed(input.bookingId),
    ],
  });
}

export async function deriveEventAuthorityAddress(input: {
  programAddress: Address;
}): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: input.programAddress,
    seeds: [EVENT_AUTHORITY_SEED],
  });
}

export function isOfferPurchaseEligible(input: {
  offer: Offer;
  offerCoachAuthorityAddress: Address;
  authority: CoachAuthority;
  clientWallet: Address;
  purchasedAtUnixSeconds: bigint;
}): boolean {
  const expiresAt =
    input.offer.validitySeconds === 0
      ? null
      : input.offer.createdAt + BigInt(input.offer.validitySeconds);

  return (
    input.offer.status === OfferStatus.Active &&
    input.offer.coachAuthority === input.offerCoachAuthorityAddress &&
    input.offer.authorityEpoch === input.authority.authorityEpoch &&
    input.offer.paymentRecipient === input.authority.currentWallet &&
    input.offer.paymentMint === DEVNET_EURC_MINT_ADDRESS &&
    input.clientWallet !== input.authority.currentWallet &&
    (isNone(input.offer.restrictedClient) ||
      input.offer.restrictedClient.value === input.clientWallet) &&
    (expiresAt === null || input.purchasedAtUnixSeconds < expiresAt)
  );
}

export function projectCoachClientCreditSummary(input: {
  credits: CoachClientCredits;
  expectedCoachAuthority: Address;
  expectedClientWallet: Address;
}): CoachClientCreditSummary {
  if (input.credits.version !== 1) {
    throw new Error("Unsupported coach-client credit ledger version.");
  }
  if (input.credits.coachAuthority !== input.expectedCoachAuthority) {
    throw new Error("Credit ledger belongs to a different coach authority.");
  }
  if (input.credits.clientWallet !== input.expectedClientWallet) {
    throw new Error("Credit ledger belongs to a different client wallet.");
  }

  return {
    coachAuthority: input.credits.coachAuthority,
    clientWallet: input.credits.clientWallet,
    availableCredits: input.credits.availableCredits,
    reservedCredits: input.credits.reservedCredits,
    totalPurchased: input.credits.totalPurchased,
    purchaseCount: input.credits.purchaseCount,
    nextPurchaseNonce: input.credits.nextPurchaseNonce,
    lastOffer: input.credits.lastOffer,
    lastPurchaseAt: input.credits.lastPurchaseAt,
  };
}

export function projectCreditReservationSummary(input: {
  reservation: CreditReservation;
  expectedCoachClientCredits: Address;
  expectedCoachAuthority: Address;
  expectedClientWallet: Address;
  expectedBookingId: string;
}): CreditReservationSummary {
  if (input.reservation.version !== 1) {
    throw new Error("Unsupported credit reservation version.");
  }
  if (
    input.reservation.coachClientCredits !== input.expectedCoachClientCredits
  ) {
    throw new Error("Reservation belongs to a different credit ledger.");
  }
  if (input.reservation.coachAuthority !== input.expectedCoachAuthority) {
    throw new Error("Reservation belongs to a different coach authority.");
  }
  if (input.reservation.clientWallet !== input.expectedClientWallet) {
    throw new Error("Reservation belongs to a different client wallet.");
  }

  const bookingId = seedToUuid(input.reservation.bookingId);
  const expectedBookingId = seedToUuid([
    ...uuidToSeed(input.expectedBookingId),
  ]);
  if (bookingId !== expectedBookingId) {
    throw new Error("Reservation belongs to a different booking.");
  }

  return {
    coachClientCredits: input.reservation.coachClientCredits,
    coachAuthority: input.reservation.coachAuthority,
    clientWallet: input.reservation.clientWallet,
    bookingId,
    scheduledStartAt: input.reservation.scheduledStartAt,
    earlyReturnUntil: input.reservation.earlyReturnUntil,
    status: input.reservation.status,
    reservedAt: input.reservation.reservedAt,
    resolvedAt: isNone(input.reservation.resolvedAt)
      ? null
      : input.reservation.resolvedAt.value,
  };
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
