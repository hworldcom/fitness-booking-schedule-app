import { COACH_DISCIPLINES, type CoachDiscipline } from "./coaches";

export const GROUP_EVENT_MINIMUM_PARTICIPANTS = 2;
export const GROUP_EVENT_MAXIMUM_PARTICIPANTS = 50;
export const GROUP_EVENT_MAX_BASE_UNITS = BigInt("9000000000000000");
export const GROUP_EVENT_MINIMUM_DURATION_MINUTES = 30;
export const GROUP_EVENT_MAXIMUM_DURATION_MINUTES = 12 * 60;
export const GROUP_EVENT_DEVNET_EURC_MINT_ADDRESS =
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
export const GROUP_EVENT_SPL_TOKEN_PROGRAM_ADDRESS =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export type GroupEventPublicationStatus = "draft" | "published" | "withdrawn";
export type GroupEventProjectionAvailability =
  "unbound" | "pending" | "current" | "unavailable";
export type GroupEventPoolLifecycle =
  "funding" | "succeeded" | "paid" | "failed";
export type GroupEventContributionLifecycle =
  "funded" | "refundable" | "refunded" | "successful";

export type GroupEventDraftInput = Readonly<{
  title: string;
  discipline: CoachDiscipline;
  description: string;
  startsAt: string;
  endsAt: string;
  mediaUrl: string | null;
  sourceProposalId: string | null;
}>;

export type GroupEventDraftInputResult =
  | Readonly<{ valid: true; value: GroupEventDraftInput }>
  | Readonly<{ valid: false; errors: readonly string[] }>;

export type VerifiedGroupEventPoolProjection = Readonly<{
  eventId: string;
  programAddress: string;
  eventPoolAddress: string;
  vaultAddress: string;
  coachAuthorityAddress: string;
  payoutRecipientAddress: string;
  mintAddress: string;
  tokenProgramAddress: string;
  seatPriceBaseUnits: bigint;
  minimumParticipants: number;
  maximumParticipants: number;
  participantCount: number;
  fundingDeadline: string;
  eventStartsAt: string;
  eventEndsAt: string;
  lifecycleStatus: GroupEventPoolLifecycle;
  transactionSignature: string;
  observedSlot: bigint;
  finalizedAt: string;
}>;

export type VerifiedGroupEventContributionProjection = Readonly<{
  eventId: string;
  programAddress: string;
  eventPoolAddress: string;
  contributionAddress: string;
  participantWalletAddress: string;
  amountBaseUnits: bigint;
  lifecycleStatus: GroupEventContributionLifecycle;
  transactionSignature: string;
  observedSlot: bigint;
  finalizedAt: string;
}>;

export type GroupEventPoolProjection = Readonly<{
  programAddress: string;
  eventPoolAddress: string;
  vaultAddress: string;
  coachAuthorityAddress: string;
  payoutRecipientAddress: string;
  mintAddress: string;
  tokenProgramAddress: string;
  seatPriceBaseUnits: bigint;
  minimumParticipants: number;
  maximumParticipants: number;
  participantCount: number;
  fundingDeadline: string;
  lifecycleStatus: GroupEventPoolLifecycle;
  transactionSignature: string;
  observedSlot: bigint;
  finalizedAt: string;
}>;

export type GroupEventProjection = Readonly<{
  id: string;
  slug: string;
  coachProfileId: string;
  title: string;
  discipline: CoachDiscipline;
  description: string;
  coach: Readonly<{
    slug: string;
    displayName: string;
  }>;
  location: Readonly<{
    kind: "gym" | "independent";
    label: string;
    timezone: string;
    latitude: number;
    longitude: number;
  }>;
  startsAt: string;
  endsAt: string;
  mediaUrl: string | null;
  sourceProposalId: string | null;
  publicationStatus: GroupEventPublicationStatus;
  projectionAvailability: GroupEventProjectionAvailability;
  projectionStatusUpdatedAt: string | null;
  programAddress: string | null;
  eventPoolAddress: string | null;
  pool: GroupEventPoolProjection | null;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,100}$/u;

function normalizeSingleLine(value: unknown) {
  return typeof value === "string" ? value.trim().replaceAll(/\s+/gu, " ") : "";
}

function normalizeParagraph(value: unknown) {
  return typeof value === "string" ? value.trim().replaceAll(/\s+/gu, " ") : "";
}

function validTimestamp(value: string) {
  return Number.isFinite(new Date(value).getTime());
}

function validMediaUrl(value: string | null) {
  return (
    value === null ||
    (value.length >= 1 &&
      value.length <= 1024 &&
      !/\s/u.test(value) &&
      (value.startsWith("https://") || value.startsWith("/")))
  );
}

export function isGroupEventUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function isGroupEventSolanaAddress(value: string) {
  return SOLANA_ADDRESS_PATTERN.test(value);
}

export function isGroupEventSolanaSignature(value: string) {
  return SOLANA_SIGNATURE_PATTERN.test(value);
}

export function parseGroupEventDraftInput(
  input: Readonly<{
    title: unknown;
    discipline: unknown;
    description: unknown;
    startsAt: unknown;
    endsAt: unknown;
    mediaUrl?: unknown;
    sourceProposalId?: unknown;
  }>,
  now = new Date(),
): GroupEventDraftInputResult {
  const title = normalizeSingleLine(input.title);
  const description = normalizeParagraph(input.description);
  const startsAt = typeof input.startsAt === "string" ? input.startsAt : "";
  const endsAt = typeof input.endsAt === "string" ? input.endsAt : "";
  const mediaUrl =
    input.mediaUrl === null || input.mediaUrl === undefined
      ? null
      : normalizeSingleLine(input.mediaUrl);
  const sourceProposalId =
    input.sourceProposalId === null || input.sourceProposalId === undefined
      ? null
      : normalizeSingleLine(input.sourceProposalId);
  const errors: string[] = [];
  if (title.length < 3 || title.length > 120) errors.push("title");
  if (description.length < 20 || description.length > 2000)
    errors.push("description");
  if (
    typeof input.discipline !== "string" ||
    !COACH_DISCIPLINES.some((discipline) => discipline === input.discipline)
  )
    errors.push("discipline");
  if (!validTimestamp(startsAt) || !validTimestamp(endsAt)) {
    errors.push("schedule");
  } else {
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    const durationMinutes = (end - start) / 60000;
    if (
      start <= now.getTime() ||
      durationMinutes < GROUP_EVENT_MINIMUM_DURATION_MINUTES ||
      durationMinutes > GROUP_EVENT_MAXIMUM_DURATION_MINUTES
    )
      errors.push("schedule");
  }
  if (!validMediaUrl(mediaUrl)) errors.push("mediaUrl");
  if (sourceProposalId !== null && !isGroupEventUuid(sourceProposalId))
    errors.push("sourceProposalId");
  if (errors.length > 0)
    return Object.freeze({
      valid: false as const,
      errors: Object.freeze(errors),
    });
  return Object.freeze({
    valid: true as const,
    value: Object.freeze({
      title,
      discipline: input.discipline as CoachDiscipline,
      description,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      mediaUrl,
      sourceProposalId,
    }),
  });
}

export function validateVerifiedGroupEventPoolProjection(
  evidence: VerifiedGroupEventPoolProjection,
) {
  const deadline = new Date(evidence.fundingDeadline).getTime();
  const startsAt = new Date(evidence.eventStartsAt).getTime();
  const endsAt = new Date(evidence.eventEndsAt).getTime();
  const finalizedAt = new Date(evidence.finalizedAt).getTime();
  const durationMinutes = (endsAt - startsAt) / 60000;
  return (
    isGroupEventUuid(evidence.eventId) &&
    [
      evidence.programAddress,
      evidence.eventPoolAddress,
      evidence.vaultAddress,
      evidence.coachAuthorityAddress,
      evidence.payoutRecipientAddress,
      evidence.mintAddress,
      evidence.tokenProgramAddress,
    ].every(isGroupEventSolanaAddress) &&
    evidence.mintAddress === GROUP_EVENT_DEVNET_EURC_MINT_ADDRESS &&
    evidence.tokenProgramAddress === GROUP_EVENT_SPL_TOKEN_PROGRAM_ADDRESS &&
    isGroupEventSolanaSignature(evidence.transactionSignature) &&
    evidence.seatPriceBaseUnits >= BigInt(1) &&
    evidence.seatPriceBaseUnits <= GROUP_EVENT_MAX_BASE_UNITS &&
    Number.isInteger(evidence.minimumParticipants) &&
    evidence.minimumParticipants >= GROUP_EVENT_MINIMUM_PARTICIPANTS &&
    Number.isInteger(evidence.maximumParticipants) &&
    evidence.maximumParticipants >= evidence.minimumParticipants &&
    evidence.maximumParticipants <= GROUP_EVENT_MAXIMUM_PARTICIPANTS &&
    Number.isInteger(evidence.participantCount) &&
    evidence.participantCount >= 0 &&
    evidence.participantCount <= evidence.maximumParticipants &&
    Number.isFinite(deadline) &&
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    Number.isFinite(finalizedAt) &&
    deadline < startsAt &&
    durationMinutes >= GROUP_EVENT_MINIMUM_DURATION_MINUTES &&
    durationMinutes <= GROUP_EVENT_MAXIMUM_DURATION_MINUTES &&
    (evidence.lifecycleStatus === "funding" ||
      evidence.lifecycleStatus === "succeeded" ||
      evidence.lifecycleStatus === "paid" ||
      evidence.lifecycleStatus === "failed") &&
    (evidence.lifecycleStatus === "funding" ||
      (evidence.lifecycleStatus === "failed"
        ? evidence.participantCount < evidence.minimumParticipants
        : evidence.participantCount >= evidence.minimumParticipants)) &&
    evidence.observedSlot >= BigInt(0)
  );
}

export function validateVerifiedGroupEventContributionProjection(
  evidence: VerifiedGroupEventContributionProjection,
) {
  return (
    isGroupEventUuid(evidence.eventId) &&
    [
      evidence.programAddress,
      evidence.eventPoolAddress,
      evidence.contributionAddress,
      evidence.participantWalletAddress,
    ].every(isGroupEventSolanaAddress) &&
    evidence.amountBaseUnits >= BigInt(1) &&
    evidence.amountBaseUnits <= GROUP_EVENT_MAX_BASE_UNITS &&
    (evidence.lifecycleStatus === "funded" ||
      evidence.lifecycleStatus === "refundable" ||
      evidence.lifecycleStatus === "refunded" ||
      evidence.lifecycleStatus === "successful") &&
    isGroupEventSolanaSignature(evidence.transactionSignature) &&
    evidence.observedSlot >= BigInt(0) &&
    validTimestamp(evidence.finalizedAt)
  );
}
