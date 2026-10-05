import type {
  CoachClientCardProjection,
  PrivateBookingProjection,
} from "./coach-bookings";
import type { PublicCoachAvailabilitySlot } from "./coaches";

export type PublicCoachPassOffer = Readonly<{
  address: string;
  coachAuthorityAddress: string;
  paymentRecipientAddress: string;
  credits: 1 | 10;
  priceEurcBaseUnits: string;
  priceEurc: string;
  restricted: false;
}>;

export type PublicCoachPassCatalogueState =
  | Readonly<{
      status: "ready";
      cluster: "devnet";
      offers: readonly PublicCoachPassOffer[];
    }>
  | Readonly<{ status: "not-published" | "unavailable" }>;

export type ClientCoachCreditProjection = Readonly<{
  creditProjectionId: string;
  coachProfileId: string;
  coachDisplayName: string;
  coachSlug: string;
  clientWalletAddress: string;
  coachAuthorityAddress: string;
  coachClientCreditsAddress: string;
  availableCredits: bigint;
  reservedCredits: bigint;
  totalPurchased: bigint;
  observedSlot: bigint;
}>;

export type PublicCoachMarketplaceActorState =
  | Readonly<{
      status: "authorized";
      credit: ClientCoachCreditProjection | null;
      bookings: readonly PrivateBookingProjection[];
    }>
  | Readonly<{
      status: "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;

export type PublicCoachMarketplaceProps = Readonly<{
  coachProfileId: string;
  coachDisplayName: string;
  coachSlug: string;
  earlyCancellationMinutes: number;
  slots: readonly PublicCoachAvailabilitySlot[];
  catalogue: PublicCoachPassCatalogueState;
  actor: PublicCoachMarketplaceActorState;
}>;

export type CoachClientCardListProps = Readonly<{
  cards: readonly CoachClientCardProjection[];
  earlyCancellationMinutes: number;
}>;

export function formatEurcBaseUnits(value: string) {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error("EURC base units must be a non-negative integer string.");
  }
  const padded = value.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const fraction = padded.slice(-6).replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function formatCancellationWindow(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error("Cancellation minutes must be a non-negative integer.");
  }
  if (minutes === 0) return "until the session starts";
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} day${days === 1 ? "" : "s"} before the session`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} before the session`;
  }
  return `${minutes} minutes before the session`;
}

export function shortenChainReference(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value;
}
