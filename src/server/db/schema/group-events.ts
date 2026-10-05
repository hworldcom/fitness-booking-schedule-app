import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { coachProfiles } from "./coaches";
import { app, demoRunParticipants } from "./foundation";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
};

export const groupEvents = app.table(
  "group_events",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    publicSlug: text("public_slug").notNull(),
    title: text("title").notNull(),
    discipline: text("discipline").notNull(),
    description: text("description").notNull(),
    coachSlugSnapshot: text("coach_slug_snapshot").notNull(),
    coachDisplayNameSnapshot: text("coach_display_name_snapshot").notNull(),
    locationKindSnapshot: text("location_kind_snapshot").notNull(),
    locationLabelSnapshot: text("location_label_snapshot").notNull(),
    locationTimezoneSnapshot: text("location_timezone_snapshot").notNull(),
    latitudeSnapshot: numeric("latitude_snapshot", {
      precision: 9,
      scale: 6,
      mode: "string",
    }).notNull(),
    longitudeSnapshot: numeric("longitude_snapshot", {
      precision: 9,
      scale: 6,
      mode: "string",
    }).notNull(),
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    mediaUrl: text("media_url"),
    sourceProposalId: uuid("source_proposal_id"),
    publicationStatus: text("publication_status").default("draft").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    withdrawnAt: timestamp("withdrawn_at", {
      withTimezone: true,
      mode: "string",
    }),
    programAddress: text("program_address"),
    eventPoolAddress: text("event_pool_address"),
    coachWalletAddressSnapshot: text("coach_wallet_address_snapshot"),
    projectionAvailability: text("projection_availability")
      .default("unbound")
      .notNull(),
    projectionStatusUpdatedAt: timestamp("projection_status_updated_at", {
      withTimezone: true,
      mode: "string",
    }),
    recordSource: text("record_source").notNull(),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "group_events_coach_fkey",
      columns: [table.runId, table.coachProfileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    unique("group_events_run_id_id_key").on(table.runId, table.id),
    unique("group_events_run_slug_key").on(table.runId, table.publicSlug),
    unique("group_events_pool_key").on(
      table.programAddress,
      table.eventPoolAddress,
    ),
    check(
      "group_events_time_check",
      sql`${table.endsAt} - ${table.startsAt} between interval '30 minutes' and interval '12 hours'`,
    ),
    check(
      "group_events_publication_status_check",
      sql`${table.publicationStatus} in ('draft', 'published', 'withdrawn')`,
    ),
    check(
      "group_events_projection_availability_check",
      sql`${table.projectionAvailability} in ('unbound', 'pending', 'current', 'unavailable')`,
    ),
    index("group_events_public_catalogue_idx").on(
      table.publicationStatus,
      table.startsAt,
      table.id,
    ),
    index("group_events_owner_idx").on(
      table.runId,
      table.coachProfileId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const groupEventPoolProjections = app.table(
  "group_event_pool_projections",
  {
    eventId: uuid("event_id").primaryKey(),
    runId: uuid("run_id").notNull(),
    programAddress: text("program_address").notNull(),
    eventPoolAddress: text("event_pool_address").notNull(),
    vaultAddress: text("vault_address").notNull(),
    coachAuthorityAddress: text("coach_authority_address").notNull(),
    payoutRecipientAddress: text("payout_recipient_address").notNull(),
    mintAddress: text("mint_address").notNull(),
    tokenProgramAddress: text("token_program_address").notNull(),
    seatPriceBaseUnits: bigint("seat_price_base_units", {
      mode: "bigint",
    }).notNull(),
    minimumParticipants: smallint("minimum_participants").notNull(),
    maximumParticipants: smallint("maximum_participants").notNull(),
    participantCount: smallint("participant_count").notNull(),
    fundingDeadline: timestamp("funding_deadline", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    eventStartsAt: timestamp("event_starts_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    eventEndsAt: timestamp("event_ends_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    lifecycleStatus: text("lifecycle_status").notNull(),
    transactionSignature: text("transaction_signature").notNull(),
    observedSlot: bigint("observed_slot", { mode: "bigint" }).notNull(),
    finalizedAt: timestamp("finalized_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "group_event_pool_projections_event_fkey",
      columns: [table.runId, table.eventId],
      foreignColumns: [groupEvents.runId, groupEvents.id],
    }).onDelete("restrict"),
    unique("group_event_pool_projections_pool_key").on(
      table.programAddress,
      table.eventPoolAddress,
    ),
    check(
      "group_event_pool_projections_price_check",
      sql`${table.seatPriceBaseUnits} between 1 and 9000000000000000`,
    ),
    check(
      "group_event_pool_projections_token_check",
      sql`${table.mintAddress} = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr' and ${table.tokenProgramAddress} = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'`,
    ),
    check(
      "group_event_pool_projections_capacity_check",
      sql`${table.minimumParticipants} between 2 and 50 and ${table.maximumParticipants} between ${table.minimumParticipants} and 50 and ${table.participantCount} between 0 and ${table.maximumParticipants}`,
    ),
    index("group_event_pool_projections_lifecycle_idx").on(
      table.lifecycleStatus,
      table.fundingDeadline,
      table.eventId,
    ),
  ],
);

export const groupEventContributionProjections = app.table(
  "group_event_contribution_projections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    eventId: uuid("event_id").notNull(),
    participantProfileId: uuid("participant_profile_id").notNull(),
    programAddress: text("program_address").notNull(),
    eventPoolAddress: text("event_pool_address").notNull(),
    contributionAddress: text("contribution_address").notNull(),
    participantWalletAddress: text("participant_wallet_address").notNull(),
    amountBaseUnits: bigint("amount_base_units", { mode: "bigint" }).notNull(),
    lifecycleStatus: text("lifecycle_status").notNull(),
    transactionSignature: text("transaction_signature").notNull(),
    observedSlot: bigint("observed_slot", { mode: "bigint" }).notNull(),
    finalizedAt: timestamp("finalized_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "group_event_contribution_projections_event_fkey",
      columns: [table.runId, table.eventId],
      foreignColumns: [groupEvents.runId, groupEvents.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "group_event_contribution_projections_participant_fkey",
      columns: [table.runId, table.participantProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    unique("group_event_contribution_projections_event_wallet_key").on(
      table.eventId,
      table.participantWalletAddress,
    ),
    unique("group_event_contribution_projections_address_key").on(
      table.programAddress,
      table.contributionAddress,
    ),
    check(
      "group_event_contribution_projections_amount_check",
      sql`${table.amountBaseUnits} between 1 and 9000000000000000`,
    ),
    check(
      "group_event_contribution_projections_lifecycle_check",
      sql`${table.lifecycleStatus} in ('funded', 'refundable', 'refunded', 'successful')`,
    ),
    index("group_event_contribution_projections_participant_idx").on(
      table.runId,
      table.participantProfileId,
      table.finalizedAt,
      table.id,
    ),
  ],
);

export const groupEventChainOperations = app.table(
  "group_event_chain_operations",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    eventId: uuid("event_id").notNull(),
    actorProfileId: uuid("actor_profile_id").notNull(),
    operationKind: text("operation_kind").notNull(),
    status: text("status").notNull(),
    programAddress: text("program_address").notNull(),
    authorityAddress: text("authority_address").notNull(),
    coachAuthorityAddress: text("coach_authority_address").notNull(),
    eventPoolAddress: text("event_pool_address").notNull(),
    vaultAddress: text("vault_address").notNull(),
    contributionAddress: text("contribution_address"),
    preparedSummary: jsonb("prepared_summary").notNull(),
    preparedTransactionBase64: text("prepared_transaction_base64").notNull(),
    preparedMessageBase64: text("prepared_message_base64").notNull(),
    recentBlockhash: text("recent_blockhash").notNull(),
    lastValidBlockHeight: bigint("last_valid_block_height", {
      mode: "bigint",
    }).notNull(),
    preparedAt: timestamp("prepared_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    simulationSlot: bigint("simulation_slot", { mode: "bigint" }).notNull(),
    simulationUnitsConsumed: bigint("simulation_units_consumed", {
      mode: "bigint",
    }),
    transactionSignature: text("transaction_signature"),
    priorTransactionSignatures: text("prior_transaction_signatures")
      .array()
      .notNull(),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "string",
    }),
    observedSlot: bigint("observed_slot", { mode: "bigint" }),
    finalizedAt: timestamp("finalized_at", {
      withTimezone: true,
      mode: "string",
    }),
    failureCode: text("failure_code"),
    failedAt: timestamp("failed_at", {
      withTimezone: true,
      mode: "string",
    }),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "group_event_chain_operations_event_fkey",
      columns: [table.runId, table.eventId],
      foreignColumns: [groupEvents.runId, groupEvents.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "group_event_chain_operations_actor_fkey",
      columns: [table.runId, table.actorProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    check(
      "group_event_chain_operations_status_check",
      sql`${table.status} in ('prepared', 'submitted', 'finalized', 'failed', 'expired')`,
    ),
    check(
      "group_event_chain_operations_kind_check",
      sql`${table.operationKind} in ('create-event-pool', 'fund-event-seat', 'settle-event-pool', 'claim-event-payout', 'claim-event-refund')`,
    ),
    uniqueIndex("group_event_chain_operations_signature_key")
      .on(table.transactionSignature)
      .where(sql`${table.transactionSignature} is not null`),
    uniqueIndex("group_event_chain_operations_active_actor_key")
      .on(table.runId, table.eventId, table.actorProfileId, table.operationKind)
      .where(sql`${table.status} in ('prepared', 'submitted')`),
    index("group_event_chain_operations_actor_status_idx").on(
      table.runId,
      table.actorProfileId,
      table.status,
      table.createdAt,
    ),
  ],
);
