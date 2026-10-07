import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  text,
  timestamp,
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

export const coachPrivateBookings = app.table(
  "coach_private_bookings",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    slotId: uuid("slot_id").notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    clientProfileId: uuid("client_profile_id").notNull(),
    // Historical credit-backed rows keep this value; direct bookings leave it null.
    creditProjectionId: uuid("credit_projection_id"),
    status: text("status").notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    scheduledEndAt: timestamp("scheduled_end_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    // Retained columns keep the additive migration compatible with historical rows.
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
    cancelledByProfileId: uuid("cancelled_by_profile_id"),
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
      name: "coach_private_bookings_cancelled_by_fkey",
      columns: [table.runId, table.cancelledByProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    check(
      "coach_private_bookings_status_check",
      sql`${table.status} in ('pending', 'confirmed', 'cancellation-requested', 'cancelled', 'completed', 'denied', 'expired')`,
    ),
    check(
      "coach_private_bookings_direct_cancellation_check",
      sql`${table.creditProjectionId} is not null or (${table.status} = 'cancelled') = (${table.cancelledByProfileId} is not null)`,
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
  ],
);

export type CoachPrivateBookingRow = typeof coachPrivateBookings.$inferSelect;
