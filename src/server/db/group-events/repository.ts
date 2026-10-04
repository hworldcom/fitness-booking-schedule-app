import "server-only";

import { sql } from "drizzle-orm";
import {
  isGroupEventSolanaAddress,
  isGroupEventUuid,
  parseGroupEventDraftInput,
  validateVerifiedGroupEventContributionProjection,
  validateVerifiedGroupEventPoolProjection,
  type GroupEventContributionLifecycle,
  type GroupEventDraftInput,
  type GroupEventPoolLifecycle,
  type GroupEventProjection,
  type GroupEventProjectionAvailability,
  type GroupEventPublicationStatus,
  type VerifiedGroupEventContributionProjection,
  type VerifiedGroupEventPoolProjection,
} from "@/domain/group-events";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";

type GroupEventRow = Readonly<{
  id: string;
  public_slug: string;
  coach_profile_id: string;
  title: string;
  discipline: string;
  description: string;
  coach_slug_snapshot: string;
  coach_display_name_snapshot: string;
  location_kind_snapshot: string;
  location_label_snapshot: string;
  location_timezone_snapshot: string;
  latitude_snapshot: string;
  longitude_snapshot: string;
  starts_at: string | Date;
  ends_at: string | Date;
  media_url: string | null;
  source_proposal_id: string | null;
  publication_status: string;
  projection_availability: string;
  projection_status_updated_at: string | Date | null;
  program_address: string | null;
  event_pool_address: string | null;
  vault_address: string | null;
  coach_authority_address: string | null;
  payout_recipient_address: string | null;
  mint_address: string | null;
  token_program_address: string | null;
  seat_price_base_units: string | number | bigint | null;
  minimum_participants: number | null;
  maximum_participants: number | null;
  participant_count: number | null;
  funding_deadline: string | Date | null;
  lifecycle_status: string | null;
  transaction_signature: string | null;
  observed_slot: string | number | bigint | null;
  finalized_at: string | Date | null;
}>;

export class GroupEventConflictError extends Error {
  constructor(
    message = "The group event conflicts with current state.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GroupEventConflictError";
  }
}

function isPublicationStatus(
  value: string,
): value is GroupEventPublicationStatus {
  return value === "draft" || value === "published" || value === "withdrawn";
}

function isProjectionAvailability(
  value: string,
): value is GroupEventProjectionAvailability {
  return (
    value === "unbound" ||
    value === "pending" ||
    value === "current" ||
    value === "unavailable"
  );
}

function isPoolLifecycle(value: string): value is GroupEventPoolLifecycle {
  return (
    value === "funding" ||
    value === "succeeded" ||
    value === "paid" ||
    value === "failed"
  );
}

function isoTimestamp(value: string | Date | null) {
  if (value === null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new GroupEventConflictError();
  return date.toISOString();
}

function mapEvent(row: GroupEventRow): GroupEventProjection {
  const parsed = parseGroupEventDraftInput(
    {
      title: row.title,
      discipline: row.discipline,
      description: row.description,
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: new Date(row.ends_at).toISOString(),
      mediaUrl: row.media_url,
      sourceProposalId: row.source_proposal_id,
    },
    new Date(0),
  );
  const latitude = Number(row.latitude_snapshot);
  const longitude = Number(row.longitude_snapshot);
  if (
    !parsed.valid ||
    !isPublicationStatus(row.publication_status) ||
    !isProjectionAvailability(row.projection_availability) ||
    (row.location_kind_snapshot !== "gym" &&
      row.location_kind_snapshot !== "independent") ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new GroupEventConflictError();
  }

  const completePool =
    row.projection_availability === "current" &&
    row.program_address !== null &&
    row.event_pool_address !== null &&
    row.vault_address !== null &&
    row.coach_authority_address !== null &&
    row.payout_recipient_address !== null &&
    row.mint_address !== null &&
    row.token_program_address !== null &&
    row.seat_price_base_units !== null &&
    row.minimum_participants !== null &&
    row.maximum_participants !== null &&
    row.participant_count !== null &&
    row.funding_deadline !== null &&
    row.lifecycle_status !== null &&
    row.transaction_signature !== null &&
    row.observed_slot !== null &&
    row.finalized_at !== null &&
    isPoolLifecycle(row.lifecycle_status);

  if (row.projection_availability === "current" && !completePool) {
    throw new GroupEventConflictError();
  }

  return Object.freeze({
    id: row.id,
    slug: row.public_slug,
    coachProfileId: row.coach_profile_id,
    title: parsed.value.title,
    discipline: parsed.value.discipline,
    description: parsed.value.description,
    coach: Object.freeze({
      slug: row.coach_slug_snapshot,
      displayName: row.coach_display_name_snapshot,
    }),
    location: Object.freeze({
      kind: row.location_kind_snapshot,
      label: row.location_label_snapshot,
      timezone: row.location_timezone_snapshot,
      latitude,
      longitude,
    }),
    startsAt: parsed.value.startsAt,
    endsAt: parsed.value.endsAt,
    mediaUrl: parsed.value.mediaUrl,
    sourceProposalId: parsed.value.sourceProposalId,
    publicationStatus: row.publication_status,
    projectionAvailability: row.projection_availability,
    projectionStatusUpdatedAt: isoTimestamp(row.projection_status_updated_at),
    programAddress: row.program_address,
    eventPoolAddress: row.event_pool_address,
    pool: completePool
      ? Object.freeze({
          programAddress: row.program_address,
          eventPoolAddress: row.event_pool_address,
          vaultAddress: row.vault_address,
          coachAuthorityAddress: row.coach_authority_address,
          payoutRecipientAddress: row.payout_recipient_address,
          mintAddress: row.mint_address,
          tokenProgramAddress: row.token_program_address,
          seatPriceBaseUnits: BigInt(row.seat_price_base_units),
          minimumParticipants: row.minimum_participants,
          maximumParticipants: row.maximum_participants,
          participantCount: row.participant_count,
          fundingDeadline: isoTimestamp(row.funding_deadline)!,
          lifecycleStatus: row.lifecycle_status,
          transactionSignature: row.transaction_signature,
          observedSlot: BigInt(row.observed_slot),
          finalizedAt: isoTimestamp(row.finalized_at)!,
        })
      : null,
  });
}

function eventSelect() {
  return sql.raw(`
    event.id,
    event.public_slug,
    event.coach_profile_id,
    event.title,
    event.discipline,
    event.description,
    event.coach_slug_snapshot,
    event.coach_display_name_snapshot,
    event.location_kind_snapshot,
    event.location_label_snapshot,
    event.location_timezone_snapshot,
    event.latitude_snapshot,
    event.longitude_snapshot,
    event.starts_at,
    event.ends_at,
    event.media_url,
    event.source_proposal_id,
    event.publication_status,
    event.projection_availability,
    event.projection_status_updated_at,
    event.program_address,
    event.event_pool_address,
    pool.vault_address,
    pool.coach_authority_address,
    pool.payout_recipient_address,
    pool.mint_address,
    pool.token_program_address,
    pool.seat_price_base_units,
    pool.minimum_participants,
    pool.maximum_participants,
    pool.participant_count,
    pool.funding_deadline,
    pool.lifecycle_status,
    pool.transaction_signature,
    pool.observed_slot,
    pool.finalized_at
  `);
}

function isPostgresGroupEventError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      (current.code === "23505" ||
        current.code === "23514" ||
        current.code === "23503" ||
        current.code === "P0001")
    )
      return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

async function groupEventMutation<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof GroupEventConflictError) throw error;
    if (isPostgresGroupEventError(error))
      throw new GroupEventConflictError(undefined, { cause: error });
    throw error;
  }
}

function inputParameters(input: GroupEventDraftInput) {
  return [
    input.title,
    input.discipline,
    input.description,
    input.startsAt,
    input.endsAt,
    input.mediaUrl,
    input.sourceProposalId,
  ] as const;
}

export async function createOwnedGroupEventDraftRecord(
  transaction: ActorDatabaseTransaction,
  input: GroupEventDraftInput,
) {
  const parsed = parseGroupEventDraftInput(input);
  if (!parsed.valid) throw new GroupEventConflictError();
  const eventId = crypto.randomUUID();
  const [
    title,
    discipline,
    description,
    startsAt,
    endsAt,
    mediaUrl,
    proposalId,
  ] = inputParameters(parsed.value);
  return groupEventMutation(async () => {
    const rows = await transaction.execute<{ event_id: string }>(sql`
      select app.create_owned_group_event_draft(
        ${eventId}::uuid,
        ${title}::text,
        ${discipline}::text,
        ${description}::text,
        ${startsAt}::timestamptz,
        ${endsAt}::timestamptz,
        ${mediaUrl}::text,
        ${proposalId}::uuid
      ) as event_id
    `);
    if (rows[0]?.event_id !== eventId) throw new GroupEventConflictError();
    return eventId;
  });
}

export async function updateOwnedGroupEventDraftRecord(
  transaction: ActorDatabaseTransaction,
  eventId: string,
  input: GroupEventDraftInput,
) {
  const parsed = parseGroupEventDraftInput(input);
  if (!isGroupEventUuid(eventId) || !parsed.valid)
    throw new GroupEventConflictError();
  const [
    title,
    discipline,
    description,
    startsAt,
    endsAt,
    mediaUrl,
    proposalId,
  ] = inputParameters(parsed.value);
  return groupEventMutation(async () => {
    const rows = await transaction.execute<{ event_id: string }>(sql`
      select app.update_owned_group_event_draft(
        ${eventId}::uuid,
        ${title}::text,
        ${discipline}::text,
        ${description}::text,
        ${startsAt}::timestamptz,
        ${endsAt}::timestamptz,
        ${mediaUrl}::text,
        ${proposalId}::uuid
      ) as event_id
    `);
    if (rows[0]?.event_id !== eventId) throw new GroupEventConflictError();
    return eventId;
  });
}

export async function bindOwnedGroupEventPoolRecord(
  transaction: ActorDatabaseTransaction,
  input: Readonly<{
    eventId: string;
    programAddress: string;
    eventPoolAddress: string;
  }>,
) {
  if (
    !isGroupEventUuid(input.eventId) ||
    !isGroupEventSolanaAddress(input.programAddress) ||
    !isGroupEventSolanaAddress(input.eventPoolAddress)
  )
    throw new GroupEventConflictError();
  return groupEventMutation(async () => {
    const rows = await transaction.execute<{ event_id: string }>(sql`
      select app.bind_owned_group_event_pool(
        ${input.eventId}::uuid,
        ${input.programAddress}::text,
        ${input.eventPoolAddress}::text
      ) as event_id
    `);
    if (rows[0]?.event_id !== input.eventId)
      throw new GroupEventConflictError();
    return input.eventId;
  });
}

async function ownedEventTransition(
  transaction: ActorDatabaseTransaction,
  eventId: string,
  functionName:
    "publish_owned_group_event" | "withdraw_owned_group_event_draft",
) {
  if (!isGroupEventUuid(eventId)) throw new GroupEventConflictError();
  return groupEventMutation(async () => {
    const rows = await transaction.execute<{ event_id: string }>(
      functionName === "publish_owned_group_event"
        ? sql`select app.publish_owned_group_event(${eventId}::uuid) as event_id`
        : sql`select app.withdraw_owned_group_event_draft(${eventId}::uuid) as event_id`,
    );
    if (rows[0]?.event_id !== eventId) throw new GroupEventConflictError();
    return eventId;
  });
}

export function publishOwnedGroupEventRecord(
  transaction: ActorDatabaseTransaction,
  eventId: string,
) {
  return ownedEventTransition(
    transaction,
    eventId,
    "publish_owned_group_event",
  );
}

export function withdrawOwnedGroupEventDraftRecord(
  transaction: ActorDatabaseTransaction,
  eventId: string,
) {
  return ownedEventTransition(
    transaction,
    eventId,
    "withdraw_owned_group_event_draft",
  );
}

export async function currentOwnedGroupEventRecords(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  const rows = await transaction.execute<GroupEventRow>(sql`
    select ${eventSelect()}
    from app.group_events as event
    left join app.group_event_pool_projections as pool
      on pool.event_id = event.id
      and pool.run_id = event.run_id
    where event.run_id = ${actor.runId}::uuid
      and event.coach_profile_id = ${actor.profileId}::uuid
    order by event.starts_at, event.id
  `);
  return Object.freeze(rows.map(mapEvent));
}

export async function publicGroupEventCatalogueRecords() {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<GroupEventRow>(sql`
      select ${eventSelect()}
      from app.group_events as event
      left join app.group_event_pool_projections as pool
        on pool.event_id = event.id
        and pool.run_id = event.run_id
      where event.publication_status = 'published'
        and event.starts_at > pg_catalog.statement_timestamp()
      order by event.starts_at, event.id
    `);
    return Object.freeze(rows.map(mapEvent));
  });
}

export async function publicGroupEventDetailRecord(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) return null;
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<GroupEventRow>(sql`
      select ${eventSelect()}
      from app.group_events as event
      left join app.group_event_pool_projections as pool
        on pool.event_id = event.id
        and pool.run_id = event.run_id
      where event.publication_status = 'published'
        and event.public_slug = ${slug}
    `);
    if (rows.length > 1) throw new GroupEventConflictError();
    return rows[0] ? mapEvent(rows[0]) : null;
  });
}

export async function recordVerifiedGroupEventPoolProjectionRecord(
  evidence: VerifiedGroupEventPoolProjection,
) {
  if (!validateVerifiedGroupEventPoolProjection(evidence))
    throw new GroupEventConflictError();
  return groupEventMutation(() =>
    withDatabaseConnection(async ({ db }) => {
      const rows = await db.execute<{ event_id: string }>(sql`
        select app.record_verified_group_event_pool_projection(
          ${evidence.eventId}::uuid,
          ${evidence.programAddress}::text,
          ${evidence.eventPoolAddress}::text,
          ${evidence.vaultAddress}::text,
          ${evidence.coachAuthorityAddress}::text,
          ${evidence.payoutRecipientAddress}::text,
          ${evidence.mintAddress}::text,
          ${evidence.tokenProgramAddress}::text,
          ${evidence.seatPriceBaseUnits}::bigint,
          ${evidence.minimumParticipants}::smallint,
          ${evidence.maximumParticipants}::smallint,
          ${evidence.participantCount}::smallint,
          ${evidence.fundingDeadline}::timestamptz,
          ${evidence.eventStartsAt}::timestamptz,
          ${evidence.eventEndsAt}::timestamptz,
          ${evidence.lifecycleStatus}::text,
          ${evidence.transactionSignature}::text,
          ${evidence.observedSlot}::bigint,
          ${evidence.finalizedAt}::timestamptz
        ) as event_id
      `);
      if (rows[0]?.event_id !== evidence.eventId)
        throw new GroupEventConflictError();
      return evidence.eventId;
    }),
  );
}

export async function markGroupEventProjectionAvailabilityRecord(
  input: Readonly<{
    eventId: string;
    programAddress: string;
    eventPoolAddress: string;
    availability: "pending" | "unavailable";
  }>,
) {
  if (
    !isGroupEventUuid(input.eventId) ||
    !isGroupEventSolanaAddress(input.programAddress) ||
    !isGroupEventSolanaAddress(input.eventPoolAddress)
  )
    throw new GroupEventConflictError();
  return groupEventMutation(() =>
    withDatabaseConnection(async ({ db }) => {
      const rows = await db.execute<{ event_id: string }>(sql`
        select app.mark_group_event_projection_availability(
          ${input.eventId}::uuid,
          ${input.programAddress}::text,
          ${input.eventPoolAddress}::text,
          ${input.availability}::text
        ) as event_id
      `);
      if (rows[0]?.event_id !== input.eventId)
        throw new GroupEventConflictError();
      return input.eventId;
    }),
  );
}

export async function recordVerifiedGroupEventContributionProjectionRecord(
  evidence: VerifiedGroupEventContributionProjection,
) {
  if (!validateVerifiedGroupEventContributionProjection(evidence))
    throw new GroupEventConflictError();
  return groupEventMutation(() =>
    withDatabaseConnection(async ({ db }) => {
      const rows = await db.execute<{ projection_id: string }>(sql`
        select app.record_verified_group_event_contribution_projection(
          ${evidence.eventId}::uuid,
          ${evidence.programAddress}::text,
          ${evidence.eventPoolAddress}::text,
          ${evidence.contributionAddress}::text,
          ${evidence.participantWalletAddress}::text,
          ${evidence.amountBaseUnits}::bigint,
          ${evidence.lifecycleStatus}::text,
          ${evidence.transactionSignature}::text,
          ${evidence.observedSlot}::bigint,
          ${evidence.finalizedAt}::timestamptz
        ) as projection_id
      `);
      const projectionId = rows[0]?.projection_id;
      if (!projectionId || !isGroupEventUuid(projectionId))
        throw new GroupEventConflictError();
      return projectionId;
    }),
  );
}

export function isGroupEventContributionLifecycle(
  value: string,
): value is GroupEventContributionLifecycle {
  return (
    value === "funded" ||
    value === "refundable" ||
    value === "refunded" ||
    value === "successful"
  );
}
