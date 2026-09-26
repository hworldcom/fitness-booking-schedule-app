import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
};

const auth = pgSchema("auth");
export const app = pgSchema("app");

const authUsers = auth.table("users", {
  id: uuid("id").primaryKey(),
});

export const profiles = app.table(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: uuid("auth_user_id").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    initials: text("initials").notNull(),
    bio: text("bio").default("").notNull(),
    avatarColor: text("avatar_color").notNull(),
    recordSource: text("record_source").notNull(),
    claimedAt: timestamp("claimed_at", {
      withTimezone: true,
      mode: "string",
    }),
    ...auditColumns,
  },
  (table) => [
    unique("profiles_auth_user_id_key").on(table.authUserId),
    unique("profiles_slug_key").on(table.slug),
    check(
      "profiles_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "profiles_display_name_length_check",
      sql`char_length(${table.displayName}) between 2 and 80`,
    ),
    check(
      "profiles_initials_length_check",
      sql`char_length(${table.initials}) between 1 and 4`,
    ),
    check(
      "profiles_record_source_check",
      sql`${table.recordSource} in ('fixture', 'user')`,
    ),
    check(
      "profiles_claim_state_check",
      sql`(${table.authUserId} is null) = (${table.claimedAt} is null)`,
    ),
  ],
);

export const demoRuns = app.table(
  "demo_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    catalogueVisibility: text("catalogue_visibility").notNull(),
    scheduleAnchorDate: date("schedule_anchor_date", {
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
    retiredAt: timestamp("retired_at", {
      withTimezone: true,
      mode: "string",
    }),
    ...auditColumns,
  },
  (table) => [
    unique("demo_runs_slug_key").on(table.slug),
    check(
      "demo_runs_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "demo_runs_status_check",
      sql`${table.status} in ('prepared', 'active', 'retired')`,
    ),
    check(
      "demo_runs_catalogue_visibility_check",
      sql`${table.catalogueVisibility} in ('private', 'public')`,
    ),
    check(
      "demo_runs_time_order_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
    check(
      "demo_runs_retired_state_check",
      sql`(${table.status} = 'retired') = (${table.retiredAt} is not null)`,
    ),
    uniqueIndex("demo_runs_one_active_public_idx")
      .on(table.status, table.catalogueVisibility)
      .where(
        sql`${table.status} = 'active' and ${table.catalogueVisibility} = 'public'`,
      ),
    index("demo_runs_status_visibility_idx").on(
      table.status,
      table.catalogueVisibility,
    ),
  ],
);

export const demoRunParticipants = app.table(
  "demo_run_participants",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => demoRuns.id, { onDelete: "restrict" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    status: text("status").notNull(),
    joinedAt: timestamp("joined_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "string",
    }),
    ...auditColumns,
  },
  (table) => [
    primaryKey({
      name: "demo_run_participants_pkey",
      columns: [table.runId, table.profileId],
    }),
    check(
      "demo_run_participants_role_check",
      sql`${table.role} in ('member', 'operator')`,
    ),
    check(
      "demo_run_participants_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
    check(
      "demo_run_participants_revoked_state_check",
      sql`(${table.status} = 'revoked') = (${table.revokedAt} is not null)`,
    ),
    index("demo_run_participants_profile_status_run_idx").on(
      table.profileId,
      table.status,
      table.runId,
    ),
  ],
);

export const organizations = app.table(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => demoRuns.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    recordSource: text("record_source").notNull(),
    ...auditColumns,
  },
  (table) => [
    unique("organizations_run_id_id_key").on(table.runId, table.id),
    unique("organizations_run_id_slug_key").on(table.runId, table.slug),
    check(
      "organizations_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "organizations_kind_check",
      sql`${table.kind} in ('gym', 'cafe', 'studio', 'community', 'sponsor')`,
    ),
    check(
      "organizations_status_check",
      sql`${table.status} in ('active', 'inactive')`,
    ),
    check(
      "organizations_record_source_check",
      sql`${table.recordSource} in ('fixture', 'user')`,
    ),
    index("organizations_run_kind_status_idx").on(
      table.runId,
      table.kind,
      table.status,
    ),
  ],
);

export const organizationMemberships = app.table(
  "organization_memberships",
  {
    runId: uuid("run_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    ...auditColumns,
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    primaryKey({
      name: "organization_memberships_pkey",
      columns: [table.runId, table.organizationId, table.profileId],
    }),
    foreignKey({
      name: "organization_memberships_organization_fkey",
      columns: [table.runId, table.organizationId],
      foreignColumns: [organizations.runId, organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "organization_memberships_run_profile_fkey",
      columns: [table.runId, table.profileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    check(
      "organization_memberships_role_check",
      sql`${table.role} in ('primary_admin', 'admin', 'member')`,
    ),
    check(
      "organization_memberships_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
    check(
      "organization_memberships_revoked_state_check",
      sql`(${table.status} = 'revoked') = (${table.revokedAt} is not null)`,
    ),
    index("organization_memberships_run_profile_status_idx").on(
      table.runId,
      table.profileId,
      table.status,
    ),
    uniqueIndex("organization_memberships_one_active_primary_admin_idx")
      .on(table.runId, table.organizationId)
      .where(
        sql`${table.status} = 'active' and ${table.role} = 'primary_admin'`,
      ),
  ],
);

export const venues = app.table(
  "venues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    organizationId: uuid("organization_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    area: text("area").notNull(),
    city: text("city").notNull(),
    countryCode: text("country_code").notNull(),
    timezone: text("timezone").notNull(),
    description: text("description").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    recordSource: text("record_source").notNull(),
    activityTags: text("activity_tags").array().notNull(),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "venues_run_organization_fkey",
      columns: [table.runId, table.organizationId],
      foreignColumns: [organizations.runId, organizations.id],
    }).onDelete("restrict"),
    unique("venues_run_id_id_key").on(table.runId, table.id),
    unique("venues_run_id_slug_key").on(table.runId, table.slug),
    check(
      "venues_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "venues_country_code_check",
      sql`${table.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "venues_kind_check",
      sql`${table.kind} in ('gym', 'studio', 'cafe', 'outdoor', 'other')`,
    ),
    check(
      "venues_status_check",
      sql`${table.status} in ('active', 'inactive')`,
    ),
    check(
      "venues_record_source_check",
      sql`${table.recordSource} in ('fixture', 'user')`,
    ),
    check(
      "venues_activity_tags_check",
      sql`cardinality(${table.activityTags}) > 0 and ${table.activityTags} <@ array['Grappling', 'Kickboxing', 'Massage', 'MMA', 'Muay Thai', 'Running', 'Strength', 'Wellness', 'Yoga']::text[]`,
    ),
    index("venues_run_kind_status_idx").on(
      table.runId,
      table.kind,
      table.status,
    ),
    index("venues_activity_tags_idx").using("gin", table.activityTags),
  ],
);

export const venueStaff = app.table(
  "venue_staff",
  {
    runId: uuid("run_id").notNull(),
    venueId: uuid("venue_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    ...auditColumns,
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    primaryKey({
      name: "venue_staff_pkey",
      columns: [table.runId, table.venueId, table.profileId],
    }),
    foreignKey({
      name: "venue_staff_run_venue_fkey",
      columns: [table.runId, table.venueId],
      foreignColumns: [venues.runId, venues.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "venue_staff_run_profile_fkey",
      columns: [table.runId, table.profileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    check(
      "venue_staff_role_check",
      sql`${table.role} in ('manager', 'check_in_staff')`,
    ),
    check(
      "venue_staff_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
    check(
      "venue_staff_revoked_state_check",
      sql`(${table.status} = 'revoked') = (${table.revokedAt} is not null)`,
    ),
    index("venue_staff_run_profile_status_idx").on(
      table.runId,
      table.profileId,
      table.status,
    ),
  ],
);

export const trainerAffiliations = app.table(
  "trainer_affiliations",
  {
    runId: uuid("run_id").notNull(),
    venueId: uuid("venue_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    title: text("title").notNull(),
    activityTags: text("activity_tags").array().notNull(),
    status: text("status").notNull(),
    ...auditColumns,
  },
  (table) => [
    primaryKey({
      name: "trainer_affiliations_pkey",
      columns: [table.runId, table.venueId, table.profileId],
    }),
    foreignKey({
      name: "trainer_affiliations_run_venue_fkey",
      columns: [table.runId, table.venueId],
      foreignColumns: [venues.runId, venues.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "trainer_affiliations_run_profile_fkey",
      columns: [table.runId, table.profileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    check(
      "trainer_affiliations_activity_tags_check",
      sql`cardinality(${table.activityTags}) > 0 and ${table.activityTags} <@ array['Running', 'Strength', 'Muay Thai', 'Yoga']::text[]`,
    ),
    check(
      "trainer_affiliations_status_check",
      sql`${table.status} in ('active', 'inactive')`,
    ),
    index("trainer_affiliations_run_profile_status_idx").on(
      table.runId,
      table.profileId,
      table.status,
    ),
    index("trainer_affiliations_activity_tags_idx").using(
      "gin",
      table.activityTags,
    ),
  ],
);

export const classSessions = app.table(
  "class_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    venueId: uuid("venue_id").notNull(),
    trainerProfileId: uuid("trainer_profile_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    discipline: text("discipline").notNull(),
    timezone: text("timezone").notNull(),
    currencyCode: text("currency_code").notNull(),
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    capacity: integer("capacity").notNull(),
    priceBaseUnits: numeric("price_base_units", {
      precision: 20,
      scale: 0,
      mode: "string",
    }).notNull(),
    status: text("status").notNull(),
    recordSource: text("record_source").notNull(),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "class_sessions_run_venue_fkey",
      columns: [table.runId, table.venueId],
      foreignColumns: [venues.runId, venues.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "class_sessions_trainer_affiliation_fkey",
      columns: [table.runId, table.venueId, table.trainerProfileId],
      foreignColumns: [
        trainerAffiliations.runId,
        trainerAffiliations.venueId,
        trainerAffiliations.profileId,
      ],
    }).onDelete("restrict"),
    unique("class_sessions_run_id_id_key").on(table.runId, table.id),
    unique("class_sessions_run_id_slug_key").on(table.runId, table.slug),
    check(
      "class_sessions_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "class_sessions_discipline_check",
      sql`${table.discipline} in ('Running', 'Strength', 'Muay Thai', 'Yoga')`,
    ),
    check(
      "class_sessions_time_order_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
    check("class_sessions_capacity_check", sql`${table.capacity} > 0`),
    check(
      "class_sessions_price_check",
      sql`${table.priceBaseUnits} >= 0 and ${table.priceBaseUnits} <= 18446744073709551615`,
    ),
    check(
      "class_sessions_currency_code_check",
      sql`${table.currencyCode} = 'EURC'`,
    ),
    check(
      "class_sessions_status_check",
      sql`${table.status} in ('scheduled', 'cancelled')`,
    ),
    check(
      "class_sessions_record_source_check",
      sql`${table.recordSource} in ('fixture', 'user')`,
    ),
    index("class_sessions_run_starts_at_idx").on(table.runId, table.startsAt),
    index("class_sessions_run_venue_starts_at_idx").on(
      table.runId,
      table.venueId,
      table.startsAt,
    ),
    index("class_sessions_run_discipline_starts_at_idx").on(
      table.runId,
      table.discipline,
      table.startsAt,
    ),
  ],
);

export type ProfileRow = typeof profiles.$inferSelect;
export type ClassSessionRow = typeof classSessions.$inferSelect;
