import test, { after } from "node:test";
import assert from "node:assert/strict";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  membershipProductGymEligibility,
  membershipProducts,
  membershipProductVersions,
  participatingGyms,
} from "@/server/db/schema";
import {
  catalogueResultFromRows,
  currentPublicCatalogue,
} from "@/server/catalogue/service";
import { readPublishedCatalogueRows } from "@/server/db/catalogue/repository";
import { closeDatabaseConnection } from "@/server/db/client";

const connectionString = process.env.DATABASE_TEST_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_TEST_URL is required for database integration tests.",
  );
}

const runtimeConnectionString =
  "postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres";
process.env.DATABASE_URL = runtimeConnectionString;

const queryClient = postgres(connectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});
const db = drizzle(queryClient);

after(async () => {
  await closeDatabaseConnection();
  await queryClient.end();
});

function hasDatabaseCode(code: string) {
  return (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code;
}

test("Drizzle mappings expose the published Basic and Classic catalogue", async () => {
  const products = await db
    .select({
      slug: membershipProducts.slug,
      scope: membershipProducts.scope,
      organizationId: membershipProducts.organizationId,
    })
    .from(membershipProducts)
    .orderBy(asc(membershipProducts.slug));

  assert.deepEqual(products, [
    { slug: "basic", scope: "platform", organizationId: null },
    { slug: "classic", scope: "platform", organizationId: null },
  ]);

  const versions = await db
    .select({
      planCode: membershipProductVersions.planCode,
      priceBaseUnits: membershipProductVersions.priceBaseUnits,
      periodPolicy: membershipProductVersions.periodPolicy,
      durationSeconds: membershipProductVersions.durationSeconds,
      accessModel: membershipProductVersions.accessModel,
      includedCheckins: membershipProductVersions.includedCheckins,
      maxIncludedCheckinsPerDay:
        membershipProductVersions.maxIncludedCheckinsPerDay,
      requiredCoreGymCount: membershipProductVersions.requiredCoreGymCount,
      nonCoreVisitPriceBaseUnits:
        membershipProductVersions.nonCoreVisitPriceBaseUnits,
      transferable: membershipProductVersions.transferable,
      status: membershipProductVersions.status,
    })
    .from(membershipProductVersions)
    .orderBy(asc(membershipProductVersions.planCode));

  assert.deepEqual(versions, [
    {
      planCode: "basic",
      priceBaseUnits: "80000000",
      periodPolicy: "calendar_month",
      durationSeconds: null,
      accessModel: "limited",
      includedCheckins: 10,
      maxIncludedCheckinsPerDay: 1,
      requiredCoreGymCount: 4,
      nonCoreVisitPriceBaseUnits: "15000000",
      transferable: false,
      status: "published",
    },
    {
      planCode: "classic",
      priceBaseUnits: "150000000",
      periodPolicy: "calendar_month",
      durationSeconds: null,
      accessModel: "daily_uncapped",
      includedCheckins: null,
      maxIncludedCheckinsPerDay: 1,
      requiredCoreGymCount: 4,
      nonCoreVisitPriceBaseUnits: "15000000",
      transferable: false,
      status: "published",
    },
  ]);
});

test("seven fictional participating gyms and plan eligibility are seeded", async () => {
  const gymMetadata = await db
    .select({
      artworkKey: participatingGyms.artworkKey,
      coachNames: participatingGyms.coachNames,
      mapAddress: participatingGyms.mapAddress,
      supportsNonCoreVisit: participatingGyms.supportsNonCoreVisit,
    })
    .from(participatingGyms);
  assert.equal(gymMetadata.length, 7);
  assert.ok(
    gymMetadata.every(
      (gym) =>
        gym.artworkKey.length > 0 &&
        gym.coachNames.length > 0 &&
        gym.mapAddress.includes("Berlin"),
    ),
  );

  const fixtureGyms = await queryClient<
    { name: string; supports_non_core_visit: boolean }[]
  >`
    select v.name, g.supports_non_core_visit
    from app.participating_gyms g
    join app.venues v on v.run_id = g.run_id and v.id = g.venue_id
    order by v.name
  `;
  assert.deepEqual(
    fixtureGyms.map(({ name }) => name),
    [
      "Fabrik Training",
      "Groundline MMA",
      "Kiezstrike Club",
      "Nightshift Athletic Club",
      "Northside Combat",
      "Quiet Current Recovery",
      "Studio Vela",
    ],
  );
  assert.deepEqual(
    fixtureGyms
      .filter(({ supports_non_core_visit }) => !supports_non_core_visit)
      .map(({ name }) => name),
    ["Nightshift Athletic Club"],
  );

  const eligibility = await db
    .select({
      productId: membershipProductGymEligibility.productId,
      status: membershipProductGymEligibility.status,
    })
    .from(membershipProductGymEligibility);
  assert.equal(eligibility.length, 12);

  const eligibilityCounts = await queryClient<
    { plan_code: string; gym_count: number }[]
  >`
    select v.plan_code, count(*)::integer as gym_count
    from app.membership_product_gym_eligibility e
    join app.membership_product_versions v
      on v.run_id = e.run_id and v.product_id = e.product_id
    where e.status = 'active' and v.status = 'published'
    group by v.plan_code
    order by v.plan_code
  `;
  assert.deepEqual(Array.from(eligibilityCounts), [
    { plan_code: "basic", gym_count: 5 },
    { plan_code: "classic", gym_count: 7 },
  ]);
});

test("current plan constraints reject prices and allowances outside the contract", async () => {
  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.membership_product_versions (
          id, run_id, product_id, version_number, plan_code, name,
          description, currency_code, price_base_units, period_policy,
          duration_seconds, access_model, included_checkins,
          max_included_checkins_per_day, required_core_gym_count,
          non_core_visit_price_base_units, transferable,
          transfer_fee_base_units, minimum_hold_seconds,
          minimum_remaining_transfer_seconds, status
        ) values (
          '62000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000101',
          2, 'basic', 'Bad Basic price', 'Must fail', 'EURC', 81000000,
          'calendar_month', null, 'limited', 10, 1, 4, 15000000,
          false, 0, 0, 0, 'draft'
        )
      `);
    }),
    hasDatabaseCode("23514"),
  );

  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.membership_product_versions (
          id, run_id, product_id, version_number, plan_code, name,
          description, currency_code, price_base_units, period_policy,
          duration_seconds, access_model, included_checkins,
          max_included_checkins_per_day, required_core_gym_count,
          non_core_visit_price_base_units, transferable,
          transfer_fee_base_units, minimum_hold_seconds,
          minimum_remaining_transfer_seconds, status
        ) values (
          '62000000-0000-4000-8000-000000000002',
          '20000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000102',
          2, 'classic', 'Bad Classic allowance', 'Must fail', 'EURC',
          150000000, 'calendar_month', null, 'daily_uncapped', 99, 1, 4,
          15000000, false, 0, 0, 0, 'draft'
        )
      `);
    }),
    hasDatabaseCode("23514"),
  );

  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.membership_product_versions (
          id, run_id, product_id, version_number, plan_code, name,
          description, currency_code, price_base_units, period_policy,
          duration_seconds, access_model, included_checkins,
          max_included_checkins_per_day, required_core_gym_count,
          non_core_visit_price_base_units, transferable,
          transfer_fee_base_units, minimum_hold_seconds,
          minimum_remaining_transfer_seconds, status
        ) values (
          '62000000-0000-4000-8000-000000000003',
          '20000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000101',
          2, 'basic', 'Bad currency', 'Must fail', 'EUR', 80000000,
          'calendar_month', null, 'limited', 10, 1, 4, 15000000,
          false, 0, 0, 0, 'draft'
        )
      `);
    }),
    hasDatabaseCode("23514"),
  );

  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.membership_product_versions (
          id, run_id, product_id, version_number, plan_code, name,
          description, currency_code, price_base_units, period_policy,
          duration_seconds, access_model, included_checkins,
          max_included_checkins_per_day, required_core_gym_count,
          non_core_visit_price_base_units, transferable,
          transfer_fee_base_units, minimum_hold_seconds,
          minimum_remaining_transfer_seconds, status
        ) values (
          '62000000-0000-4000-8000-000000000004',
          '20000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000101',
          2, 'basic', 'Bad limits', 'Must fail', 'EURC', 80000000,
          'calendar_month', null, 'limited', 10, 2, 3, 15000000,
          false, 0, 0, 0, 'draft'
        )
      `);
    }),
    hasDatabaseCode("23514"),
  );
});

test("published terms, dataset boundaries and read-only runtime access hold", async () => {
  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        update app.membership_product_versions
        set name = 'Changed after publication'
        where id = '61000000-0000-4000-8000-000000000101'
      `);
    }),
    hasDatabaseCode("23514"),
  );

  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.membership_product_gym_eligibility (
          run_id, product_id, product_scope, venue_id, status
        ) values (
          '90000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000101',
          'platform',
          '40000000-0000-4000-8000-000000000001',
          'active'
        )
      `);
    }),
    hasDatabaseCode("23503"),
  );

  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.membership_product_gym_eligibility (
          run_id, product_id, product_scope, venue_id, status
        ) values (
          '20000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000101',
          'organization',
          '40000000-0000-4000-8000-000000000007',
          'active'
        )
      `);
    }),
    hasDatabaseCode("23514"),
  );

  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.membership_product_gym_eligibility (
          run_id, product_id, product_scope, venue_id, status
        ) values (
          '20000000-0000-4000-8000-000000000001',
          '60000000-0000-4000-8000-000000000101',
          'platform',
          '40000000-0000-4000-8000-000000000001',
          'active'
        )
      `);
    }),
    hasDatabaseCode("23505"),
  );

  await queryClient.begin(async (transaction) => {
    await transaction.unsafe("set local role app_runtime");
    const rows = await transaction<{ count: number }[]>`
      select (
        (select count(*) from app.membership_products)
        + (select count(*) from app.membership_product_versions)
        + (select count(*) from app.participating_gyms)
        + (select count(*) from app.membership_product_gym_eligibility)
      )::integer as count
    `;
    assert.equal(rows[0]?.count, 23);
  });

  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe("set local role app_runtime");
      await transaction.unsafe(`
        insert into app.participating_gyms (
          run_id, venue_id, artwork_key, coach_names, map_label, map_address,
          map_latitude, map_longitude, supports_non_core_visit, status
        ) values (
          '20000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000004',
          'recovery', array['Nobody'], 'Hidden', 'Nowhere in Berlin',
          52.5, 13.4, false, 'active'
        )
      `);
    }),
    hasDatabaseCode("42501"),
  );

  const obsolete = await queryClient<{ count: number }[]>`
    select count(*)::integer as count
    from app.membership_products
    where slug in ('annual-unlimited', 'six-month-flex-12')
  `;
  assert.equal(obsolete[0]?.count, 0);
});

test("the server catalogue projection exposes only stable public fields", async () => {
  const result = await currentPublicCatalogue();
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.catalogue.source, "persistent-catalogue");
  assert.deepEqual(
    result.catalogue.plans.map((plan) => ({
      id: plan.id,
      price: plan.price.amount,
      access: plan.access,
      nonCorePrice: plan.nonCoreVisitPrice.amount,
    })),
    [
      {
        id: "basic",
        price: 80,
        access: { model: "limited", includedCheckins: 10 },
        nonCorePrice: 15,
      },
      {
        id: "classic",
        price: 150,
        access: { model: "daily-uncapped" },
        nonCorePrice: 15,
      },
    ],
  );
  assert.equal(result.catalogue.gyms.length, 7);
  assert.equal(
    result.catalogue.gyms.filter((gym) => gym.eligiblePlans.includes("basic"))
      .length,
    5,
  );
  assert.equal(
    result.catalogue.gyms.filter((gym) => gym.eligiblePlans.includes("classic"))
      .length,
    7,
  );

  const publicPayload = JSON.stringify(result.catalogue);
  assert.doesNotMatch(
    publicPayload,
    /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
  assert.doesNotMatch(
    publicPayload,
    /organization|created_at|updated_at|product_id|venue_id/i,
  );
});

test("empty, inconsistent and unavailable catalogues never use fixture fallback", async () => {
  assert.deepEqual(catalogueResultFromRows([]), { status: "empty" });

  const rows = await readPublishedCatalogueRows();
  assert.ok(rows.length > 0);
  const inconsistent = rows.map((row, index) =>
    index === 0 ? { ...row, price_base_units: "81000000" } : row,
  );
  assert.deepEqual(catalogueResultFromRows(inconsistent), {
    status: "error",
    message: "The gym catalogue is inconsistent.",
  });

  await closeDatabaseConnection();
  delete process.env.DATABASE_URL;
  assert.deepEqual(await currentPublicCatalogue(), {
    status: "error",
    message: "The gym catalogue is temporarily unavailable. Please try again.",
  });
  process.env.DATABASE_URL = runtimeConnectionString;
});
