import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { app, demoRunParticipants, organizations, venues } from "./foundation";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
};

export const membershipProducts = app.table(
  "membership_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    organizationId: uuid("organization_id"),
    slug: text("slug").notNull(),
    scope: text("scope").default("organization").notNull(),
    status: text("status").notNull(),
    recordSource: text("record_source").notNull(),
    createdByProfileId: uuid("created_by_profile_id"),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "membership_products_run_organization_fkey",
      columns: [table.runId, table.organizationId],
      foreignColumns: [organizations.runId, organizations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "membership_products_creator_fkey",
      columns: [table.runId, table.createdByProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    unique("membership_products_run_id_id_key").on(table.runId, table.id),
    unique("membership_products_run_id_scope_key").on(
      table.runId,
      table.id,
      table.scope,
    ),
    unique("membership_products_run_slug_key").on(table.runId, table.slug),
    unique("membership_products_run_organization_slug_key").on(
      table.runId,
      table.organizationId,
      table.slug,
    ),
    check(
      "membership_products_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "membership_products_status_check",
      sql`${table.status} in ('active', 'retired')`,
    ),
    check(
      "membership_products_scope_check",
      sql`${table.scope} in ('platform', 'organization')`,
    ),
    check(
      "membership_products_scope_organization_check",
      sql`(${table.scope} = 'platform' and ${table.organizationId} is null) or (${table.scope} = 'organization' and ${table.organizationId} is not null)`,
    ),
    check(
      "membership_products_record_source_check",
      sql`${table.recordSource} in ('fixture', 'user')`,
    ),
    check(
      "membership_products_creator_source_check",
      sql`(${table.recordSource} = 'fixture' and ${table.createdByProfileId} is null) or (${table.recordSource} = 'user' and ${table.createdByProfileId} is not null)`,
    ),
    index("membership_products_run_organization_status_idx").on(
      table.runId,
      table.organizationId,
      table.status,
    ),
  ],
);

export const membershipProductVersions = app.table(
  "membership_product_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    productId: uuid("product_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    planCode: text("plan_code"),
    name: text("name").notNull(),
    description: text("description").notNull(),
    currencyCode: text("currency_code").notNull(),
    priceBaseUnits: numeric("price_base_units", {
      precision: 20,
      scale: 0,
      mode: "string",
    }),
    periodPolicy: text("period_policy").default("fixed_seconds").notNull(),
    durationSeconds: integer("duration_seconds"),
    accessModel: text("access_model").notNull(),
    includedCheckins: integer("included_checkins"),
    maxIncludedCheckinsPerDay: integer("max_included_checkins_per_day"),
    requiredCoreGymCount: integer("required_core_gym_count"),
    nonCoreVisitPriceBaseUnits: numeric("non_core_visit_price_base_units", {
      precision: 20,
      scale: 0,
      mode: "string",
    }),
    transferable: boolean("transferable").notNull(),
    transferFeeBaseUnits: numeric("transfer_fee_base_units", {
      precision: 20,
      scale: 0,
      mode: "string",
    }).notNull(),
    minimumHoldSeconds: integer("minimum_hold_seconds").notNull(),
    minimumRemainingTransferSeconds: integer(
      "minimum_remaining_transfer_seconds",
    ).notNull(),
    status: text("status").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    retiredAt: timestamp("retired_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdByProfileId: uuid("created_by_profile_id"),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      name: "membership_product_versions_product_fkey",
      columns: [table.runId, table.productId],
      foreignColumns: [membershipProducts.runId, membershipProducts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "membership_product_versions_creator_fkey",
      columns: [table.runId, table.createdByProfileId],
      foreignColumns: [
        demoRunParticipants.runId,
        demoRunParticipants.profileId,
      ],
    }).onDelete("restrict"),
    unique("membership_product_versions_run_id_id_key").on(
      table.runId,
      table.id,
    ),
    unique("membership_product_versions_product_version_key").on(
      table.runId,
      table.productId,
      table.versionNumber,
    ),
    check(
      "membership_product_versions_version_check",
      sql`${table.versionNumber} > 0`,
    ),
    check(
      "membership_product_versions_name_length_check",
      sql`char_length(${table.name}) between 2 and 120`,
    ),
    check(
      "membership_product_versions_description_length_check",
      sql`char_length(${table.description}) between 1 and 2000`,
    ),
    check(
      "membership_product_versions_currency_check",
      sql`${table.currencyCode} = 'EURC'`,
    ),
    check(
      "membership_product_versions_price_check",
      sql`${table.priceBaseUnits} is null or (${table.priceBaseUnits} >= 0 and ${table.priceBaseUnits} <= 18446744073709551615)`,
    ),
    check(
      "membership_product_versions_plan_code_check",
      sql`${table.planCode} is null or ${table.planCode} in ('basic', 'classic')`,
    ),
    check(
      "membership_product_versions_period_policy_check",
      sql`${table.periodPolicy} in ('fixed_seconds', 'calendar_month')`,
    ),
    check(
      "membership_product_versions_access_model_check",
      sql`${table.accessModel} in ('unlimited', 'entry_limited', 'limited', 'daily_uncapped')`,
    ),
    check(
      "membership_product_versions_current_price_check",
      sql`${table.planCode} is null or (${table.planCode} = 'basic' and ${table.priceBaseUnits} = 80000000) or (${table.planCode} = 'classic' and ${table.priceBaseUnits} = 150000000)`,
    ),
    check(
      "membership_product_versions_access_terms_check",
      sql`(${table.planCode} is null and ${table.periodPolicy} = 'fixed_seconds' and ${table.maxIncludedCheckinsPerDay} is null and ${table.requiredCoreGymCount} is null and ${table.nonCoreVisitPriceBaseUnits} is null and ((${table.accessModel} = 'unlimited' and ${table.durationSeconds} = 31536000 and ${table.includedCheckins} is null) or (${table.accessModel} = 'entry_limited' and ${table.durationSeconds} = 15811200 and ${table.includedCheckins} = 12))) or (${table.planCode} = 'basic' and ${table.periodPolicy} = 'calendar_month' and ${table.durationSeconds} is null and ${table.accessModel} = 'limited' and ${table.includedCheckins} = 10 and ${table.maxIncludedCheckinsPerDay} = 1 and ${table.requiredCoreGymCount} = 4 and ${table.nonCoreVisitPriceBaseUnits} = 15000000 and not ${table.transferable} and ${table.transferFeeBaseUnits} = 0 and ${table.minimumHoldSeconds} = 0 and ${table.minimumRemainingTransferSeconds} = 0) or (${table.planCode} = 'classic' and ${table.periodPolicy} = 'calendar_month' and ${table.durationSeconds} is null and ${table.accessModel} = 'daily_uncapped' and ${table.includedCheckins} is null and ${table.maxIncludedCheckinsPerDay} = 1 and ${table.requiredCoreGymCount} = 4 and ${table.nonCoreVisitPriceBaseUnits} = 15000000 and not ${table.transferable} and ${table.transferFeeBaseUnits} = 0 and ${table.minimumHoldSeconds} = 0 and ${table.minimumRemainingTransferSeconds} = 0)`,
    ),
    check(
      "membership_product_versions_transfer_terms_check",
      sql`(${table.transferable} and ${table.transferFeeBaseUnits} = 10000000 and ${table.minimumHoldSeconds} = 2592000 and ${table.minimumRemainingTransferSeconds} = 2592000) or (not ${table.transferable} and ${table.transferFeeBaseUnits} = 0 and ${table.minimumHoldSeconds} = 0 and ${table.minimumRemainingTransferSeconds} = 0)`,
    ),
    check(
      "membership_product_versions_status_check",
      sql`${table.status} in ('draft', 'published', 'retired')`,
    ),
    check(
      "membership_product_versions_lifecycle_check",
      sql`(${table.status} = 'draft' and ${table.publishedAt} is null and ${table.retiredAt} is null) or (${table.status} = 'published' and ${table.priceBaseUnits} is not null and ${table.publishedAt} is not null and ${table.retiredAt} is null) or (${table.status} = 'retired' and ${table.priceBaseUnits} is not null and ${table.publishedAt} is not null and ${table.retiredAt} is not null and ${table.retiredAt} >= ${table.publishedAt})`,
    ),
    index("membership_product_versions_run_product_status_idx").on(
      table.runId,
      table.productId,
      table.status,
    ),
    uniqueIndex("membership_product_versions_one_published_idx")
      .on(table.runId, table.productId)
      .where(sql`${table.status} = 'published'`),
    uniqueIndex("membership_product_versions_one_published_plan_code_idx")
      .on(table.runId, table.planCode)
      .where(
        sql`${table.status} = 'published' and ${table.planCode} is not null`,
      ),
  ],
);

export const participatingGyms = app.table(
  "participating_gyms",
  {
    runId: uuid("run_id").notNull(),
    venueId: uuid("venue_id").notNull(),
    artworkKey: text("artwork_key").notNull(),
    coachNames: text("coach_names").array().notNull(),
    mapLabel: text("map_label").notNull(),
    mapAddress: text("map_address").notNull(),
    mapLatitude: numeric("map_latitude", {
      precision: 10,
      scale: 7,
      mode: "string",
    }).notNull(),
    mapLongitude: numeric("map_longitude", {
      precision: 10,
      scale: 7,
      mode: "string",
    }).notNull(),
    supportsNonCoreVisit: boolean("supports_non_core_visit").notNull(),
    status: text("status").notNull(),
    ...auditColumns,
  },
  (table) => [
    primaryKey({
      name: "participating_gyms_pkey",
      columns: [table.runId, table.venueId],
    }),
    foreignKey({
      name: "participating_gyms_venue_fkey",
      columns: [table.runId, table.venueId],
      foreignColumns: [venues.runId, venues.id],
    }).onDelete("restrict"),
    check(
      "participating_gyms_artwork_key_check",
      sql`${table.artworkKey} in ('fight', 'flow', 'ground', 'night', 'recovery', 'strength')`,
    ),
    check(
      "participating_gyms_coach_names_check",
      sql`cardinality(${table.coachNames}) > 0 and array_position(${table.coachNames}, null) is null`,
    ),
    check(
      "participating_gyms_map_label_length_check",
      sql`char_length(${table.mapLabel}) between 2 and 160`,
    ),
    check(
      "participating_gyms_map_address_length_check",
      sql`char_length(${table.mapAddress}) between 5 and 240`,
    ),
    check(
      "participating_gyms_map_latitude_check",
      sql`${table.mapLatitude} between -90 and 90`,
    ),
    check(
      "participating_gyms_map_longitude_check",
      sql`${table.mapLongitude} between -180 and 180`,
    ),
    check(
      "participating_gyms_status_check",
      sql`${table.status} in ('active', 'inactive')`,
    ),
    index("participating_gyms_run_status_idx").on(table.runId, table.status),
  ],
);

export const membershipProductGymEligibility = app.table(
  "membership_product_gym_eligibility",
  {
    runId: uuid("run_id").notNull(),
    productId: uuid("product_id").notNull(),
    productScope: text("product_scope").default("platform").notNull(),
    venueId: uuid("venue_id").notNull(),
    status: text("status").notNull(),
    ...auditColumns,
  },
  (table) => [
    primaryKey({
      name: "membership_product_gym_eligibility_pkey",
      columns: [table.runId, table.productId, table.venueId],
    }),
    foreignKey({
      name: "membership_product_gym_eligibility_product_fkey",
      columns: [table.runId, table.productId, table.productScope],
      foreignColumns: [
        membershipProducts.runId,
        membershipProducts.id,
        membershipProducts.scope,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "membership_product_gym_eligibility_venue_fkey",
      columns: [table.runId, table.venueId],
      foreignColumns: [participatingGyms.runId, participatingGyms.venueId],
    }).onDelete("restrict"),
    check(
      "membership_product_gym_eligibility_scope_check",
      sql`${table.productScope} = 'platform'`,
    ),
    check(
      "membership_product_gym_eligibility_status_check",
      sql`${table.status} in ('active', 'inactive')`,
    ),
    index("membership_product_gym_eligibility_run_venue_status_idx").on(
      table.runId,
      table.venueId,
      table.status,
    ),
  ],
);

export type MembershipProductRow = typeof membershipProducts.$inferSelect;
export type MembershipProductVersionRow =
  typeof membershipProductVersions.$inferSelect;
export type ParticipatingGymRow = typeof participatingGyms.$inferSelect;
export type MembershipProductGymEligibilityRow =
  typeof membershipProductGymEligibility.$inferSelect;
