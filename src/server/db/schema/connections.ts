import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { coachProfiles } from "./coaches";
import { app, demoRunParticipants } from "./foundation";

export const coachAthleteConnectionPairs = app.table(
  "coach_athlete_connection_pairs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    athleteProfileId: uuid("athlete_profile_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.runId, t.id),
    unique().on(t.runId, t.coachProfileId, t.athleteProfileId),
    foreignKey({
      columns: [t.runId, t.coachProfileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.runId, t.athleteProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    check(
      "connection_distinct_participants",
      sql`${t.coachProfileId} <> ${t.athleteProfileId}`,
    ),
    index("coach_athlete_connection_pairs_coach").on(t.runId, t.coachProfileId),
    index("coach_athlete_connection_pairs_athlete").on(
      t.runId,
      t.athleteProfileId,
    ),
  ],
);
export const coachAthleteConnectionAttempts = app.table(
  "coach_athlete_connection_attempts",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    pairId: uuid("pair_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    senderProfileId: uuid("sender_profile_id").notNull(),
    recipientProfileId: uuid("recipient_profile_id").notNull(),
    status: text("status").default("pending").notNull(),
    decidedByProfileId: uuid("decided_by_profile_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "string" }),
    removedByProfileId: uuid("removed_by_profile_id"),
    removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique().on(t.pairId, t.attemptNumber),
    foreignKey({
      columns: [t.runId, t.pairId],
      foreignColumns: [
        coachAthleteConnectionPairs.runId,
        coachAthleteConnectionPairs.id,
      ],
    }).onDelete("restrict"),
    ...[
      t.senderProfileId,
      t.recipientProfileId,
      t.decidedByProfileId,
      t.removedByProfileId,
    ].map((field) =>
      foreignKey({
        columns: [t.runId, field],
        foreignColumns: [
          demoRunParticipants.runId,
          demoRunParticipants.profileId,
        ],
      }).onDelete("restrict"),
    ),
    check(
      "connection_attempt_status",
      sql`${t.status} in ('pending','accepted','declined','withdrawn','removed')`,
    ),
    check("connection_attempt_number", sql`${t.attemptNumber} > 0`),
    uniqueIndex("coach_athlete_connections_one_active_pair")
      .on(t.pairId)
      .where(sql`${t.status} in ('pending','accepted')`),
    index("coach_athlete_connection_attempts_page").on(
      t.runId,
      t.createdAt,
      t.id,
    ),
  ],
);
