import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { coachAvailabilitySlots, coachProfiles } from "./coaches";
import { app, demoRunParticipants } from "./foundation";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
};

export const coachClientCreditProjections = app.table(
  "coach_client_credit_projections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    clientProfileId: uuid("client_profile_id").notNull(),
    programAddress: text("program_address").notNull(),
    coachAuthorityAddress: text("coach_authority_address").notNull(),
    clientWalletAddress: text("client_wallet_address").notNull(),
    coachClientCreditsAddress: text("coach_client_credits_address").notNull(),
    availableCredits: bigint("available_credits", { mode: "bigint" }).notNull(),
    reservedCredits: bigint("reserved_credits", { mode: "bigint" }).notNull(),
    totalPurchased: bigint("total_purchased", { mode: "bigint" }).notNull(),
    purchaseCount: bigint("purchase_count", { mode: "bigint" }).notNull(),
    nextPurchaseNonce: bigint("next_purchase_nonce", {
      mode: "bigint",
    }).notNull(),
    lastOfferAddress: text("last_offer_address").notNull(),
    lastPurchaseAt: timestamp("last_purchase_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    transactionSignature: text("transaction_signature").notNull(),
    observedSlot: bigint("observed_slot", { mode: "bigint" }).notNull(),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "coach_client_credit_projections_coach_fkey",
      columns: [table.runId, table.coachProfileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_client_credit_projections_client_fkey",
      columns: [table.runId, table.clientProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    unique("coach_client_credit_projections_run_id_id_key").on(
      table.runId,
      table.id,
    ),
    unique("coach_client_credit_projections_pair_wallet_key").on(
      table.runId,
      table.coachProfileId,
      table.clientWalletAddress,
    ),
    unique("coach_client_credit_projections_ledger_key").on(
      table.programAddress,
      table.coachClientCreditsAddress,
    ),
    check(
      "coach_client_credit_projections_balance_check",
      sql`${table.availableCredits} >= 0 and ${table.reservedCredits} >= 0 and ${table.totalPurchased} >= 0 and ${table.availableCredits} + ${table.reservedCredits} <= ${table.totalPurchased}`,
    ),
    check(
      "coach_client_credit_projections_purchase_check",
      sql`${table.purchaseCount} >= 1 and ${table.nextPurchaseNonce} >= 1 and ${table.observedSlot} >= 0`,
    ),
    index("coach_client_credit_projections_coach_idx").on(
      table.runId,
      table.coachProfileId,
      table.clientProfileId,
    ),
    index("coach_client_credit_projections_client_idx").on(
      table.runId,
      table.clientProfileId,
      table.coachProfileId,
    ),
  ],
);

export const coachPrivateBookings = app.table(
  "coach_private_bookings",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    slotId: uuid("slot_id").notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    clientProfileId: uuid("client_profile_id").notNull(),
    creditProjectionId: uuid("credit_projection_id").notNull(),
    status: text("status").notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    scheduledEndAt: timestamp("scheduled_end_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    earlyReturnUntil: timestamp("early_return_until", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    holdExpiresAt: timestamp("hold_expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    cancellationRequestedAt: timestamp("cancellation_requested_at", {
      withTimezone: true,
      mode: "string",
    }),
    cancellationDecision: text("cancellation_decision"),
    cancellationDecidedAt: timestamp("cancellation_decided_at", {
      withTimezone: true,
      mode: "string",
    }),
    cancellationDecidedByProfileId: uuid("cancellation_decided_by_profile_id"),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "string",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    expiredAt: timestamp("expired_at", {
      withTimezone: true,
      mode: "string",
    }),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "coach_private_bookings_slot_fkey",
      columns: [table.runId, table.slotId],
      foreignColumns: [coachAvailabilitySlots.runId, coachAvailabilitySlots.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_private_bookings_coach_fkey",
      columns: [table.runId, table.coachProfileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_private_bookings_client_fkey",
      columns: [table.runId, table.clientProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_private_bookings_credit_projection_fkey",
      columns: [table.runId, table.creditProjectionId],
      foreignColumns: [
        coachClientCreditProjections.runId,
        coachClientCreditProjections.id,
      ],
    }).onDelete("restrict"),
    check(
      "coach_private_bookings_status_check",
      sql`${table.status} in ('pending', 'confirmed', 'cancellation-requested', 'cancelled', 'completed', 'denied', 'expired')`,
    ),
    check(
      "coach_private_bookings_time_check",
      sql`${table.scheduledEndAt} - ${table.scheduledStartAt} = interval '1 hour' and ${table.earlyReturnUntil} <= ${table.scheduledStartAt} and ${table.holdExpiresAt} > ${table.createdAt}`,
    ),
    check(
      "coach_private_bookings_decision_check",
      sql`${table.cancellationDecision} is null or ${table.cancellationDecision} in ('approved', 'denied')`,
    ),
    uniqueIndex("coach_private_bookings_active_slot_key")
      .on(table.slotId)
      .where(
        sql`${table.status} in ('pending', 'confirmed', 'cancellation-requested', 'denied')`,
      ),
    index("coach_private_bookings_client_idx").on(
      table.runId,
      table.clientProfileId,
      table.scheduledStartAt,
    ),
    index("coach_private_bookings_coach_idx").on(
      table.runId,
      table.coachProfileId,
      table.scheduledStartAt,
    ),
    index("coach_private_bookings_projection_idx").on(
      table.creditProjectionId,
      table.status,
      table.holdExpiresAt,
    ),
  ],
);

export const coachPassPurchaseOperations = app.table(
  "coach_pass_purchase_operations",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    clientProfileId: uuid("client_profile_id").notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    status: text("status").notNull(),
    operationKind: text("operation_kind").notNull(),
    programAddress: text("program_address").notNull(),
    authorityAddress: text("authority_address").notNull(),
    coachAuthorityAddress: text("coach_authority_address").notNull(),
    offerAddress: text("offer_address").notNull(),
    clientWalletAddress: text("client_wallet_address").notNull(),
    coachClientCreditsAddress: text("coach_client_credits_address").notNull(),
    priceEurcBaseUnits: bigint("price_eurc_base_units", {
      mode: "bigint",
    }).notNull(),
    creditsPurchased: smallint("credits_purchased").notNull(),
    expectedPurchaseNonce: bigint("expected_purchase_nonce", {
      mode: "bigint",
    }).notNull(),
    baselineLedgerExists: boolean("baseline_ledger_exists").notNull(),
    baselineAvailableCredits: bigint("baseline_available_credits", {
      mode: "bigint",
    }).notNull(),
    baselineReservedCredits: bigint("baseline_reserved_credits", {
      mode: "bigint",
    }).notNull(),
    baselineTotalPurchased: bigint("baseline_total_purchased", {
      mode: "bigint",
    }).notNull(),
    baselinePurchaseCount: bigint("baseline_purchase_count", {
      mode: "bigint",
    }).notNull(),
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
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "string",
    }),
    observedAvailableCredits: bigint("observed_available_credits", {
      mode: "bigint",
    }),
    observedReservedCredits: bigint("observed_reserved_credits", {
      mode: "bigint",
    }),
    observedTotalPurchased: bigint("observed_total_purchased", {
      mode: "bigint",
    }),
    observedPurchaseCount: bigint("observed_purchase_count", {
      mode: "bigint",
    }),
    observedNextPurchaseNonce: bigint("observed_next_purchase_nonce", {
      mode: "bigint",
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
      name: "coach_pass_purchase_operations_client_fkey",
      columns: [table.runId, table.clientProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_pass_purchase_operations_coach_fkey",
      columns: [table.runId, table.coachProfileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    unique("coach_pass_purchase_operations_attempt_key").on(
      table.runId,
      table.clientProfileId,
      table.coachProfileId,
      table.offerAddress,
      table.expectedPurchaseNonce,
      table.recentBlockhash,
    ),
    uniqueIndex("coach_pass_purchase_operations_signature_key")
      .on(table.transactionSignature)
      .where(sql`${table.transactionSignature} is not null`),
    index("coach_pass_purchase_operations_actor_status_idx").on(
      table.runId,
      table.clientProfileId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const coachBookingCreditOperations = app.table(
  "coach_booking_credit_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    creditProjectionId: uuid("credit_projection_id").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    programAddress: text("program_address").notNull(),
    coachAuthorityAddress: text("coach_authority_address").notNull(),
    clientWalletAddress: text("client_wallet_address").notNull(),
    coachClientCreditsAddress: text("coach_client_credits_address").notNull(),
    creditReservationAddress: text("credit_reservation_address").notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    earlyReturnUntil: timestamp("early_return_until", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    authorityAddress: text("authority_address"),
    preparedSummary: jsonb("prepared_summary"),
    preparedTransactionBase64: text("prepared_transaction_base64"),
    preparedMessageBase64: text("prepared_message_base64"),
    recentBlockhash: text("recent_blockhash"),
    lastValidBlockHeight: bigint("last_valid_block_height", {
      mode: "bigint",
    }),
    preparedAt: timestamp("prepared_at", {
      withTimezone: true,
      mode: "string",
    }),
    simulationSlot: bigint("simulation_slot", { mode: "bigint" }),
    simulationUnitsConsumed: bigint("simulation_units_consumed", {
      mode: "bigint",
    }),
    priorTransactionSignatures: text("prior_transaction_signatures")
      .array()
      .default([])
      .notNull(),
    transactionSignature: text("transaction_signature"),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "string",
    }),
    observedReservationStatus: text("observed_reservation_status"),
    observedAvailableCredits: bigint("observed_available_credits", {
      mode: "bigint",
    }),
    observedReservedCredits: bigint("observed_reserved_credits", {
      mode: "bigint",
    }),
    observedTotalPurchased: bigint("observed_total_purchased", {
      mode: "bigint",
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
      name: "coach_booking_credit_operations_booking_fkey",
      columns: [table.bookingId],
      foreignColumns: [coachPrivateBookings.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_booking_credit_operations_projection_fkey",
      columns: [table.runId, table.creditProjectionId],
      foreignColumns: [
        coachClientCreditProjections.runId,
        coachClientCreditProjections.id,
      ],
    }).onDelete("restrict"),
    unique("coach_booking_credit_operations_booking_kind_key").on(
      table.bookingId,
      table.kind,
    ),
    uniqueIndex("coach_booking_credit_operations_terminal_key")
      .on(table.bookingId)
      .where(sql`${table.kind} in ('return', 'consume')`),
    uniqueIndex("coach_booking_credit_operations_signature_key")
      .on(table.transactionSignature)
      .where(sql`${table.transactionSignature} is not null`),
    check(
      "coach_booking_credit_operations_kind_check",
      sql`${table.kind} in ('reserve', 'return', 'consume')`,
    ),
    check(
      "coach_booking_credit_operations_status_check",
      sql`${table.status} in ('prepared', 'submitted', 'finalized', 'failed', 'expired')`,
    ),
    check(
      "coach_booking_credit_operations_reservation_status_check",
      sql`${table.observedReservationStatus} is null or ${table.observedReservationStatus} in ('reserved', 'returned', 'consumed')`,
    ),
    index("coach_booking_credit_operations_status_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
  ],
);

export type CoachClientCreditProjectionRow =
  typeof coachClientCreditProjections.$inferSelect;
export type CoachPrivateBookingRow = typeof coachPrivateBookings.$inferSelect;
export type CoachBookingCreditOperationRow =
  typeof coachBookingCreditOperations.$inferSelect;
export type CoachPassPurchaseOperationRow =
  typeof coachPassPurchaseOperations.$inferSelect;
