import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { app, profiles } from "./foundation";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
};

export const coachApplications = app.table(
  "coach_applications",
  {
    profileId: uuid("profile_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "restrict" }),
    status: text("status").default("pending").notNull(),
    revision: integer("revision").default(1).notNull(),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    decidedAt: timestamp("decided_at", {
      withTimezone: true,
      mode: "string",
    }),
    decisionReason: text("decision_reason"),
    reviewerReference: text("reviewer_reference"),
    reviewSource: text("review_source"),
    verificationPolicyVersion: text("verification_policy_version"),
    ...auditColumns,
  },
  (table) => [
    check(
      "coach_applications_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected', 'suspended')`,
    ),
    check(
      "coach_applications_revision_check",
      sql`${table.revision} between 1 and 1000000`,
    ),
    index("coach_applications_status_submitted_idx").on(
      table.status,
      table.submittedAt,
      table.profileId,
    ),
  ],
);

export const coachApplicationReviewEvents = app.table(
  "coach_application_review_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => coachApplications.profileId, { onDelete: "restrict" }),
    applicationRevision: integer("application_revision").notNull(),
    previousStatus: text("previous_status").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    reviewerReference: text("reviewer_reference").notNull(),
    reviewSource: text("review_source").notNull(),
    verificationPolicyVersion: text("verification_policy_version").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "coach_application_review_events_revision_check",
      sql`${table.applicationRevision} between 1 and 1000000`,
    ),
    check(
      "coach_application_review_events_transition_check",
      sql`(${table.previousStatus} = 'pending' and ${table.decision} in ('approved', 'rejected')) or (${table.previousStatus} = 'approved' and ${table.decision} = 'suspended')`,
    ),
    index("coach_application_review_events_profile_created_idx").on(
      table.profileId,
      table.createdAt,
      table.id,
    ),
  ],
);
