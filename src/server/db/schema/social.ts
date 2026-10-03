import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { coachProfiles } from "./coaches";
import { app, demoRunParticipants } from "./foundation";

export const coachFollows = app.table(
  "coach_follows",
  {
    runId: uuid("run_id").notNull(),
    followerProfileId: uuid("follower_profile_id").notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "coach_follows_pkey",
      columns: [table.runId, table.followerProfileId, table.coachProfileId],
    }),
    foreignKey({
      name: "coach_follows_follower_fkey",
      columns: [table.runId, table.followerProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_follows_coach_fkey",
      columns: [table.runId, table.coachProfileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    check(
      "coach_follows_no_self_follow_check",
      sql`${table.followerProfileId} <> ${table.coachProfileId}`,
    ),
    index("coach_follows_following_lookup_idx").on(
      table.runId,
      table.followerProfileId,
      table.coachProfileId,
    ),
    index("coach_follows_coach_lookup_idx").on(
      table.runId,
      table.coachProfileId,
      table.followerProfileId,
    ),
  ],
);

export const coachPosts = app.table(
  "coach_posts",
  {
    runId: uuid("run_id").notNull(),
    id: uuid("id").defaultRandom().notNull(),
    coachProfileId: uuid("coach_profile_id").notNull(),
    body: text("body").notNull(),
    visibility: text("visibility").default("visible").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    recordSource: text("record_source").default("user").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ name: "coach_posts_pkey", columns: [table.runId, table.id] }),
    foreignKey({
      name: "coach_posts_coach_fkey",
      columns: [table.runId, table.coachProfileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    check(
      "coach_posts_body_length_check",
      sql`char_length(${table.body}) between 1 and 500`,
    ),
    check(
      "coach_posts_body_normalized_check",
      sql`${table.body} = btrim(regexp_replace(${table.body}, '[[:space:]]+', ' ', 'g'))`,
    ),
    check(
      "coach_posts_visibility_check",
      sql`${table.visibility} in ('visible', 'hidden')`,
    ),
    check(
      "coach_posts_record_source_check",
      sql`${table.recordSource} in ('fixture', 'user')`,
    ),
    index("coach_posts_public_feed_idx")
      .on(table.publishedAt, table.id)
      .where(sql`${table.visibility} = 'visible'`),
    index("coach_posts_coach_feed_idx").on(
      table.runId,
      table.coachProfileId,
      table.visibility,
      table.publishedAt,
      table.id,
    ),
  ],
);

export type CoachFollowRow = typeof coachFollows.$inferSelect;
export type CoachPostRow = typeof coachPosts.$inferSelect;
