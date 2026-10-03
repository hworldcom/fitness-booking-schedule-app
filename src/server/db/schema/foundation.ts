import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
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
    coachingActivatedAt: timestamp("coaching_activated_at", {
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

export const gyms = app.table(
  "gyms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => demoRuns.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    publicLocationLabel: text("public_location_label").notNull(),
    area: text("area").notNull(),
    city: text("city").notNull(),
    countryCode: text("country_code").notNull(),
    timezone: text("timezone").notNull(),
    latitude: numeric("latitude", {
      precision: 9,
      scale: 6,
      mode: "string",
    }).notNull(),
    longitude: numeric("longitude", {
      precision: 9,
      scale: 6,
      mode: "string",
    }).notNull(),
    locationSource: text("location_source").notNull(),
    locationProvider: text("location_provider"),
    locationConfirmedAt: timestamp("location_confirmed_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    status: text("status").notNull(),
    recordSource: text("record_source").notNull(),
    ...auditColumns,
  },
  (table) => [
    unique("gyms_run_id_id_key").on(table.runId, table.id),
    unique("gyms_run_id_slug_key").on(table.runId, table.slug),
    check(
      "gyms_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "gyms_name_length_check",
      sql`char_length(${table.name}) between 2 and 160`,
    ),
    check(
      "gyms_description_length_check",
      sql`char_length(${table.description}) between 1 and 2000`,
    ),
    check(
      "gyms_public_location_label_length_check",
      sql`char_length(${table.publicLocationLabel}) between 2 and 240`,
    ),
    check(
      "gyms_area_length_check",
      sql`char_length(${table.area}) between 1 and 120`,
    ),
    check(
      "gyms_city_length_check",
      sql`char_length(${table.city}) between 1 and 120`,
    ),
    check("gyms_country_code_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      "gyms_timezone_format_check",
      sql`${table.timezone} = 'UTC' or ${table.timezone} ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'`,
    ),
    check("gyms_latitude_check", sql`${table.latitude} between -90 and 90`),
    check("gyms_longitude_check", sql`${table.longitude} between -180 and 180`),
    check(
      "gyms_location_source_check",
      sql`${table.locationSource} in ('fixture', 'manual', 'permanent-geocoding')`,
    ),
    check(
      "gyms_location_provider_check",
      sql`${table.locationProvider} is null or (char_length(${table.locationProvider}) between 2 and 40 and ${table.locationProvider} ~ '^[a-z0-9-]+$')`,
    ),
    check(
      "gyms_location_provenance_check",
      sql`(${table.locationSource} in ('fixture', 'manual') and ${table.locationProvider} is null) or (${table.locationSource} = 'permanent-geocoding' and ${table.locationProvider} is not null)`,
    ),
    check("gyms_status_check", sql`${table.status} in ('active', 'inactive')`),
    check(
      "gyms_record_source_check",
      sql`${table.recordSource} in ('fixture', 'user')`,
    ),
    index("gyms_run_status_name_idx").on(table.runId, table.status, table.name),
    index("gyms_run_city_area_idx").on(table.runId, table.city, table.area),
  ],
);

export type ProfileRow = typeof profiles.$inferSelect;
export type GymRow = typeof gyms.$inferSelect;
