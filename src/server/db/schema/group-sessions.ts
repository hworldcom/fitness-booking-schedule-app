import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  GroupRegistrationStatus,
  GroupSessionStatus,
  GroupVenue,
} from "@/domain/group-sessions";
import { app, demoRunParticipants } from "./foundation";
import { coachProfiles, coachTrainingLocations } from "./coaches";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });
export const coachGroupSessions = app.table(
  "coach_group_sessions",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    discipline: text("discipline").notNull(),
    intendedLevel: text("intended_level").notNull(),
    trainingLocationId: uuid("training_location_id").notNull(),
    venueSnapshot: jsonb("venue_snapshot").$type<GroupVenue>().notNull(),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    decisionDeadlineAt: instant("decision_deadline_at").notNull(),
    minimumParticipants: smallint("minimum_participants").notNull(),
    maximumParticipants: smallint("maximum_participants").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").default("EUR").notNull(),
    status: text("status")
      .$type<GroupSessionStatus>()
      .default("draft")
      .notNull(),
    revision: integer("revision").default(1).notNull(),
    createdAt: instant("created_at")
      .default(sql`clock_timestamp()`)
      .notNull(),
    updatedAt: instant("updated_at")
      .default(sql`clock_timestamp()`)
      .notNull(),
    publishedAt: instant("published_at"),
    confirmedAt: instant("confirmed_at"),
    confirmedByProfileId: uuid("confirmed_by_profile_id"),
    closedAt: instant("closed_at"),
    closedByProfileId: uuid("closed_by_profile_id"),
  },
  (table) => [
    unique("coach_group_sessions_run_id_id_key").on(table.runId, table.id),
    foreignKey({
      columns: [table.runId, table.coachProfileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }),
    foreignKey({
      columns: [table.runId, table.coachProfileId, table.trainingLocationId],
      foreignColumns: [
        coachTrainingLocations.runId,
        coachTrainingLocations.profileId,
        coachTrainingLocations.id,
      ],
    }),
    check(
      "group_capacity",
      sql`1 <= ${table.minimumParticipants} and ${table.minimumParticipants} <= ${table.maximumParticipants} and ${table.maximumParticipants} <= 100`,
    ),
    check(
      "group_time_order",
      sql`${table.decisionDeadlineAt} < ${table.startsAt} and ${table.startsAt} < ${table.endsAt}`,
    ),
    check(
      "group_price",
      sql`${table.priceCents} >= 0 and ${table.currency} = 'EUR'`,
    ),
    index("coach_group_public_upcoming")
      .on(table.runId, table.startsAt, table.id)
      .where(sql`${table.status} in ('open','confirmed')`),
    index("coach_group_owner_page").on(
      table.runId,
      table.coachProfileId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);
export const coachGroupRegistrations = app.table(
  "coach_group_registrations",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    athleteProfileId: uuid("athlete_profile_id").notNull(),
    status: text("status")
      .$type<GroupRegistrationStatus>()
      .default("active")
      .notNull(),
    createdAt: instant("created_at")
      .default(sql`clock_timestamp()`)
      .notNull(),
    resolvedAt: instant("resolved_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.runId, table.sessionId],
      foreignColumns: [coachGroupSessions.runId, coachGroupSessions.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.runId, table.athleteProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }),
    uniqueIndex("coach_group_one_active_registration")
      .on(table.sessionId, table.athleteProfileId)
      .where(sql`${table.status} = 'active'`),
    index("coach_group_roster").on(table.sessionId, table.createdAt, table.id),
    index("coach_group_athlete_page").on(
      table.runId,
      table.athleteProfileId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);
