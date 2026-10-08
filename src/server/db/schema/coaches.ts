import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { app, demoRunParticipants, gyms } from "./foundation";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
};

export const coachProfiles = app.table(
  "coach_profiles",
  {
    runId: uuid("run_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    publicSlug: text("public_slug").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull(),
    serviceMode: text("service_mode").default("private-training").notNull(),
    timezone: text("timezone").notNull(),
    selectedGymId: uuid("selected_gym_id"),
    locationKind: text("location_kind").notNull(),
    publicLocationLabel: text("public_location_label").notNull(),
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
    visibility: text("visibility").default("hidden").notNull(),
    recordSource: text("record_source").notNull(),
    isDemo: boolean("is_demo").default(false).notNull(),
    portraitSource: text("portrait_source"),
    portraitPath: text("portrait_path"),
    portraitUpdatedAt: timestamp("portrait_updated_at", {
      withTimezone: true,
      mode: "string",
    }),
    earlyCancellationMinutes: integer("early_cancellation_minutes")
      .default(1440)
      .notNull(),
    ...auditColumns,
  },
  (table) => [
    primaryKey({
      name: "coach_profiles_pkey",
      columns: [table.runId, table.profileId],
    }),
    foreignKey({
      name: "coach_profiles_run_profile_fkey",
      columns: [table.runId, table.profileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_profiles_run_gym_fkey",
      columns: [table.runId, table.selectedGymId],
      foreignColumns: [gyms.runId, gyms.id],
    }).onDelete("restrict"),
    unique("coach_profiles_run_slug_key").on(table.runId, table.publicSlug),
    check(
      "coach_profiles_slug_format_check",
      sql`${table.publicSlug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "coach_profiles_display_name_length_check",
      sql`char_length(${table.displayName}) between 2 and 80`,
    ),
    check(
      "coach_profiles_bio_length_check",
      sql`char_length(${table.bio}) between 40 and 1200`,
    ),
    check(
      "coach_profiles_service_mode_check",
      sql`${table.serviceMode} = 'private-training'`,
    ),
    check(
      "coach_profiles_timezone_format_check",
      sql`${table.timezone} = 'UTC' or ${table.timezone} ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'`,
    ),
    check(
      "coach_profiles_location_kind_check",
      sql`${table.locationKind} in ('gym', 'independent')`,
    ),
    check(
      "coach_profiles_gym_location_check",
      sql`(${table.locationKind} = 'gym' and ${table.selectedGymId} is not null) or (${table.locationKind} = 'independent' and ${table.selectedGymId} is null)`,
    ),
    check(
      "coach_profiles_location_label_length_check",
      sql`char_length(${table.publicLocationLabel}) between 2 and 240`,
    ),
    check(
      "coach_profiles_latitude_check",
      sql`${table.latitude} between -90 and 90`,
    ),
    check(
      "coach_profiles_longitude_check",
      sql`${table.longitude} between -180 and 180`,
    ),
    check(
      "coach_profiles_location_source_check",
      sql`${table.locationSource} in ('fixture', 'manual', 'permanent-geocoding')`,
    ),
    check(
      "coach_profiles_location_provider_check",
      sql`${table.locationProvider} is null or (char_length(${table.locationProvider}) between 2 and 40 and ${table.locationProvider} ~ '^[a-z0-9-]+$')`,
    ),
    check(
      "coach_profiles_location_provenance_check",
      sql`(${table.locationSource} in ('fixture', 'manual') and ${table.locationProvider} is null) or (${table.locationSource} = 'permanent-geocoding' and ${table.locationProvider} is not null)`,
    ),
    check(
      "coach_profiles_visibility_check",
      sql`${table.visibility} in ('visible', 'hidden')`,
    ),
    check(
      "coach_profiles_record_source_check",
      sql`${table.recordSource} in ('fixture', 'user')`,
    ),
    check(
      "coach_profiles_early_cancellation_check",
      sql`${table.earlyCancellationMinutes} between 0 and 10080`,
    ),
    index("coach_profiles_run_visibility_name_idx").on(
      table.runId,
      table.visibility,
      table.displayName,
      table.profileId,
    ),
    index("coach_profiles_run_gym_visibility_idx").on(
      table.runId,
      table.selectedGymId,
      table.visibility,
    ),
    index("coach_profiles_location_idx")
      .on(table.latitude, table.longitude)
      .where(sql`${table.visibility} = 'visible'`),
  ],
);

export const coachProfileDisciplines = app.table(
  "coach_profile_disciplines",
  {
    runId: uuid("run_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    discipline: text("discipline").notNull(),
    sortOrder: smallint("sort_order").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "coach_profile_disciplines_pkey",
      columns: [table.runId, table.profileId, table.discipline],
    }),
    foreignKey({
      name: "coach_profile_disciplines_coach_fkey",
      columns: [table.runId, table.profileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    unique("coach_profile_disciplines_sort_key").on(
      table.runId,
      table.profileId,
      table.sortOrder,
    ),
    check(
      "coach_profile_disciplines_value_check",
      sql`${table.discipline} in ('Boxing', 'Muay Thai', 'Kickboxing', 'Brazilian Jiu-Jitsu', 'MMA', 'Wrestling')`,
    ),
    check(
      "coach_profile_disciplines_sort_order_check",
      sql`${table.sortOrder} between 1 and 4`,
    ),
    index("coach_profile_disciplines_lookup_idx").on(
      table.runId,
      table.discipline,
      table.profileId,
    ),
  ],
);

export const coachAvailabilityRules = app.table(
  "coach_availability_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    isoWeekday: smallint("iso_weekday").notNull(),
    localStartTime: time("local_start_time").notNull(),
    coachTimezone: text("coach_timezone").notNull(),
    status: text("status").default("active").notNull(),
    removedAt: timestamp("removed_at", {
      withTimezone: true,
      mode: "string",
    }),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "coach_availability_rules_coach_fkey",
      columns: [table.runId, table.profileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    unique("coach_availability_rules_run_profile_id_key").on(
      table.runId,
      table.profileId,
      table.id,
    ),
    check(
      "coach_availability_rules_weekday_check",
      sql`${table.isoWeekday} between 1 and 7`,
    ),
    check(
      "coach_availability_rules_start_check",
      sql`extract(minute from ${table.localStartTime}) = 0 and extract(second from ${table.localStartTime}) = 0 and ${table.localStartTime} < time '23:00:00'`,
    ),
    check(
      "coach_availability_rules_timezone_format_check",
      sql`${table.coachTimezone} = 'UTC' or ${table.coachTimezone} ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'`,
    ),
    check(
      "coach_availability_rules_status_check",
      sql`${table.status} in ('active', 'removed')`,
    ),
    check(
      "coach_availability_rules_removed_state_check",
      sql`(${table.status} = 'removed') = (${table.removedAt} is not null)`,
    ),
    uniqueIndex("coach_availability_rules_active_time_key")
      .on(table.runId, table.profileId, table.isoWeekday, table.localStartTime)
      .where(sql`${table.status} = 'active'`),
    index("coach_availability_rules_owner_lookup_idx").on(
      table.runId,
      table.profileId,
      table.status,
      table.isoWeekday,
      table.localStartTime,
      table.id,
    ),
  ],
);

export const coachAvailabilitySlots = app.table(
  "coach_availability_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    recurrenceRuleId: uuid("recurrence_rule_id"),
    recurrenceLocalDate: date("recurrence_local_date", {
      mode: "string",
    }),
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    coachTimezone: text("coach_timezone").notNull(),
    status: text("status").default("open").notNull(),
    locationKind: text("location_kind").notNull(),
    selectedGymId: uuid("selected_gym_id"),
    gymName: text("gym_name"),
    publicLocationLabel: text("public_location_label").notNull(),
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
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "coach_availability_slots_coach_fkey",
      columns: [table.runId, table.profileId],
      foreignColumns: [coachProfiles.runId, coachProfiles.profileId],
    }).onDelete("restrict"),
    foreignKey({
      name: "coach_availability_slots_rule_fkey",
      columns: [table.runId, table.profileId, table.recurrenceRuleId],
      foreignColumns: [
        coachAvailabilityRules.runId,
        coachAvailabilityRules.profileId,
        coachAvailabilityRules.id,
      ],
    }).onDelete("restrict"),
    check(
      "coach_availability_slots_recurrence_pair_check",
      sql`(${table.recurrenceRuleId} is null) = (${table.recurrenceLocalDate} is null)`,
    ),
    check(
      "coach_availability_slots_recurring_duration_check",
      sql`${table.recurrenceRuleId} is null or ${table.endsAt} - ${table.startsAt} = interval '1 hour'`,
    ),
    check(
      "coach_availability_slots_time_order_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
    check(
      "coach_availability_slots_duration_check",
      sql`${table.endsAt} - ${table.startsAt} between interval '30 minutes' and interval '180 minutes' and extract(epoch from (${table.endsAt} - ${table.startsAt}))::bigint % 900 = 0`,
    ),
    check(
      "coach_availability_slots_start_boundary_check",
      sql`extract(epoch from ${table.startsAt})::bigint % 900 = 0`,
    ),
    check(
      "coach_availability_slots_timezone_format_check",
      sql`${table.coachTimezone} = 'UTC' or ${table.coachTimezone} ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'`,
    ),
    check(
      "coach_availability_slots_status_check",
      sql`${table.status} in ('open', 'held', 'booked', 'withdrawn')`,
    ),
    check(
      "coach_availability_slots_location_kind_check",
      sql`${table.locationKind} in ('gym', 'independent')`,
    ),
    check(
      "coach_availability_slots_gym_location_check",
      sql`(${table.locationKind} = 'gym' and ${table.selectedGymId} is not null and ${table.gymName} is not null and char_length(${table.gymName}) between 2 and 120) or (${table.locationKind} = 'independent' and ${table.selectedGymId} is null and ${table.gymName} is null)`,
    ),
    check(
      "coach_availability_slots_location_label_length_check",
      sql`char_length(${table.publicLocationLabel}) between 2 and 240`,
    ),
    check(
      "coach_availability_slots_latitude_check",
      sql`${table.latitude} between -90 and 90`,
    ),
    check(
      "coach_availability_slots_longitude_check",
      sql`${table.longitude} between -180 and 180`,
    ),
    check(
      "coach_availability_slots_location_source_check",
      sql`${table.locationSource} in ('fixture', 'manual', 'permanent-geocoding')`,
    ),
    check(
      "coach_availability_slots_location_provider_check",
      sql`${table.locationProvider} is null or (char_length(${table.locationProvider}) between 2 and 40 and ${table.locationProvider} ~ '^[a-z0-9-]+$')`,
    ),
    check(
      "coach_availability_slots_location_provenance_check",
      sql`(${table.locationSource} in ('fixture', 'manual') and ${table.locationProvider} is null) or (${table.locationSource} = 'permanent-geocoding' and ${table.locationProvider} is not null)`,
    ),
    index("coach_availability_slots_public_lookup_idx")
      .on(table.runId, table.profileId, table.startsAt, table.id)
      .where(sql`${table.status} = 'open'`),
    index("coach_availability_slots_owner_lookup_idx").on(
      table.runId,
      table.profileId,
      table.status,
      table.startsAt,
      table.id,
    ),
    uniqueIndex("coach_availability_slots_rule_occurrence_key")
      .on(table.recurrenceRuleId, table.recurrenceLocalDate)
      .where(sql`${table.recurrenceRuleId} is not null`),
    unique("coach_availability_slots_run_id_id_key").on(table.runId, table.id),
    index("coach_availability_slots_rule_status_idx")
      .on(table.recurrenceRuleId, table.status, table.startsAt, table.id)
      .where(sql`${table.recurrenceRuleId} is not null`),
  ],
);

export type CoachProfileRow = typeof coachProfiles.$inferSelect;
export type CoachProfileDisciplineRow =
  typeof coachProfileDisciplines.$inferSelect;
export type CoachAvailabilitySlotRow =
  typeof coachAvailabilitySlots.$inferSelect;
export type CoachAvailabilityRuleRow =
  typeof coachAvailabilityRules.$inferSelect;
