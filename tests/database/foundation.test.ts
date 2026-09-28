import test, { after } from "node:test";
import assert from "node:assert/strict";
import { asc, countDistinct, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { classSessions, profiles } from "@/server/db/schema";
import { createDatabaseConnection } from "@/server/db/client";

const connectionString = process.env.DATABASE_TEST_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_TEST_URL is required for database integration tests.",
  );
}

const queryClient = postgres(connectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});
const db = drizzle(queryClient);

after(async () => {
  await queryClient.end();
});

test("Drizzle mappings read the deterministic foundation fixtures", async () => {
  const seededProfiles = await db
    .select({ slug: profiles.slug, authUserId: profiles.authUserId })
    .from(profiles)
    .where(eq(profiles.recordSource, "fixture"))
    .orderBy(asc(profiles.slug));
  assert.equal(seededProfiles.length, 11);
  assert.ok(seededProfiles.every((profile) => profile.authUserId === null));

  const seededClasses = await db
    .select({
      slug: classSessions.slug,
      venueId: classSessions.venueId,
      priceBaseUnits: classSessions.priceBaseUnits,
      currencyCode: classSessions.currencyCode,
    })
    .from(classSessions)
    .orderBy(asc(classSessions.slug));
  assert.equal(seededClasses.length, 42);
  assert.ok(seededClasses.every((session) => session.priceBaseUnits === "0"));
  assert.ok(seededClasses.every((session) => session.currencyCode === "EURC"));

  const [venueCount] = await db
    .select({ count: countDistinct(classSessions.venueId) })
    .from(classSessions);
  assert.equal(venueCount?.count, 7);
});

test("forced RLS hides private rows from the runtime role", async () => {
  await queryClient.begin(async (transaction) => {
    await transaction.unsafe("set local role app_runtime");
    const rows = await transaction<{ count: string }[]>`
      select count(*)::text as count from app.profiles
    `;
    assert.equal(rows[0]?.count, "0");
  });
});

test("the runtime role cannot create database objects", async () => {
  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe("set local role app_runtime");
      await transaction.unsafe(
        "create table app.runtime_must_not_create (id int)",
      );
    }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42501",
  );
});

test("database checks reject an out-of-range class price", async () => {
  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.class_sessions (
          id, run_id, venue_id, trainer_profile_id, slug, title, description,
          discipline, timezone, currency_code, starts_at, ends_at, capacity,
          price_base_units, status, record_source
        )
        select
          gen_random_uuid(), run_id, venue_id, trainer_profile_id,
          'invalid-negative-price', title, description, discipline, timezone,
          currency_code, starts_at, ends_at, capacity, -1,
          status, record_source
        from app.class_sessions
        limit 1
      `);
    }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23514",
  );
});

test("database outages reject instead of returning fabricated state", async () => {
  const { queryClient: unavailableClient } = createDatabaseConnection({
    connectionString:
      "postgresql://postgres:postgres@127.0.0.1:1/postgres?connect_timeout=1",
    ssl: false,
  });

  try {
    await assert.rejects(unavailableClient.unsafe("select 1"));
  } finally {
    await unavailableClient.end({ timeout: 1 });
  }
});
