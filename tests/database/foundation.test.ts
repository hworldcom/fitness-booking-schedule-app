import test, { after } from "node:test";
import assert from "node:assert/strict";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { gyms, profiles } from "@/server/db/schema";
import {
  createDatabaseConnection,
  withDatabaseConnection,
  type DatabaseConnection,
} from "@/server/db/client";

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

  const seededGyms = await db
    .select({
      slug: gyms.slug,
      latitude: gyms.latitude,
      longitude: gyms.longitude,
      locationSource: gyms.locationSource,
      locationProvider: gyms.locationProvider,
    })
    .from(gyms)
    .orderBy(asc(gyms.slug));
  assert.equal(seededGyms.length, 7);
  assert.ok(seededGyms.every((gym) => gym.locationSource === "fixture"));
  assert.ok(seededGyms.every((gym) => gym.locationProvider === null));
  assert.ok(
    seededGyms.every(
      (gym) => Number(gym.latitude) >= -90 && Number(gym.latitude) <= 90,
    ),
  );
  assert.ok(
    seededGyms.every(
      (gym) => Number(gym.longitude) >= -180 && Number(gym.longitude) <= 180,
    ),
  );
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

test("database checks reject out-of-range gym coordinates", async () => {
  await assert.rejects(
    queryClient.begin(async (transaction) => {
      await transaction.unsafe(`
        insert into app.gyms (
          id, run_id, slug, name, description, public_location_label,
          area, city, country_code, timezone, latitude, longitude,
          location_source, location_provider, location_confirmed_at,
          status, record_source
        )
        select
          gen_random_uuid(), run_id, 'invalid-latitude', name, description,
          public_location_label, area, city, country_code, timezone,
          91, longitude, location_source, location_provider,
          location_confirmed_at, status, record_source
        from app.gyms
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

test("request-owned database connections close after success and failure", async () => {
  const closeTimeouts: number[] = [];
  const connection = {
    queryClient: {
      end: async ({ timeout }: { timeout?: number } = {}) => {
        closeTimeouts.push(timeout ?? -1);
      },
    },
  } as unknown as DatabaseConnection;

  const result = await withDatabaseConnection(async (ownedConnection) => {
    assert.equal(ownedConnection, connection);
    return "completed";
  }, connection);
  assert.equal(result, "completed");
  assert.deepEqual(closeTimeouts, [1]);

  await assert.rejects(
    withDatabaseConnection(async () => {
      throw new Error("request failed");
    }, connection),
    /request failed/,
  );
  assert.deepEqual(closeTimeouts, [1, 1]);
});
