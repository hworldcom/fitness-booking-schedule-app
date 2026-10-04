import assert from "node:assert/strict";
import test from "node:test";
import {
  SEEDED_COACH_ACCOUNTS,
  assertLoopbackSupabaseTargets,
  assertReusableCoachAuthUser,
  assertSeededCoachDatabaseState,
  parseLocalSupabaseStatus,
  type SeededCoachDatabaseState,
} from "../scripts/lib/local-coach-accounts";

function databaseRows(state: "fixture" | "user") {
  return SEEDED_COACH_ACCOUNTS.map((coach): SeededCoachDatabaseState => ({
    profile_id: coach.profileId,
    profile_slug: coach.slug,
    profile_display_name: coach.displayName,
    profile_record_source: state,
    auth_user_id: state === "user" ? coach.authUserId : null,
    claimed_at: state === "user" ? "2026-10-04T12:00:00Z" : null,
    coaching_activated_at: "2026-10-03T00:00:00Z",
    run_id: "20000000-0000-4000-8000-000000000001",
    run_slug: "local-foundation-2030",
    run_status: "active",
    run_catalogue_visibility: "public",
    participant_role: state === "user" ? "member" : coach.seedParticipantRole,
    participant_status: "active",
    public_slug: coach.slug,
    coach_visibility: "visible",
    coach_record_source: state,
    discipline_count: "1",
  }));
}

test("seeded coach account allowlist is exact and collision-free", () => {
  assert.equal(SEEDED_COACH_ACCOUNTS.length, 5);
  assert.equal(
    new Set(SEEDED_COACH_ACCOUNTS.map((coach) => coach.authUserId)).size,
    5,
  );
  assert.equal(
    new Set(SEEDED_COACH_ACCOUNTS.map((coach) => coach.profileId)).size,
    5,
  );
  assert.equal(
    new Set(SEEDED_COACH_ACCOUNTS.map((coach) => coach.email)).size,
    5,
  );
  for (const coach of SEEDED_COACH_ACCOUNTS) {
    assert.match(coach.email, /^[a-z.]+@coaches\.movx\.test$/);
  }
});

test("local Supabase status parsing keeps required values internal", () => {
  assert.deepEqual(
    parseLocalSupabaseStatus(`
API_URL="http://127.0.0.1:55321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"
SERVICE_ROLE_KEY=local-secret
ANON_KEY=public-value
`),
    {
      apiUrl: "http://127.0.0.1:55321",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
      serviceRoleKey: "local-secret",
    },
  );
  assert.throws(
    () => parseLocalSupabaseStatus('API_URL="http://127.0.0.1:55321"'),
    /missing API_URL, DB_URL or SERVICE_ROLE_KEY/,
  );
});

test("provisioning accepts only explicit loopback Auth and database URLs", () => {
  assert.doesNotThrow(() =>
    assertLoopbackSupabaseTargets({
      apiUrl: "http://localhost:55321",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
    }),
  );
  assert.throws(
    () =>
      assertLoopbackSupabaseTargets({
        apiUrl: "https://project.supabase.co",
        databaseUrl:
          "postgresql://postgres:secret@db.project.supabase.co:5432/postgres",
      }),
    /only against loopback/,
  );
  assert.throws(
    () =>
      assertLoopbackSupabaseTargets({
        apiUrl: "http://127.0.0.1:55321",
        databaseUrl:
          "postgresql://postgres:secret@db.project.supabase.co:5432/postgres",
      }),
    /only against loopback/,
  );
});

test("only a correctly tagged deterministic Auth user can be reused", () => {
  const coach = SEEDED_COACH_ACCOUNTS[0];
  const user = {
    id: coach.authUserId,
    email: coach.email,
    email_confirmed_at: "2026-10-04T12:00:00Z",
    app_metadata: {
      movx_local_demo: true,
      movx_coach_profile_id: coach.profileId,
      movx_coach_slug: coach.slug,
    },
  };
  assert.doesNotThrow(() => assertReusableCoachAuthUser(coach, user));
  assert.throws(
    () =>
      assertReusableCoachAuthUser(coach, {
        ...user,
        app_metadata: {},
      }),
    /conflicts with existing state/,
  );
  assert.throws(
    () =>
      assertReusableCoachAuthUser(coach, {
        ...user,
        email_confirmed_at: undefined,
      }),
    /conflicts with existing state/,
  );
});

test("database validation accepts only complete fixture or provisioned states", () => {
  assert.doesNotThrow(() =>
    assertSeededCoachDatabaseState(
      databaseRows("fixture"),
      "seeded-or-provisioned",
    ),
  );
  assert.doesNotThrow(() =>
    assertSeededCoachDatabaseState(databaseRows("user"), "provisioned"),
  );
  assert.throws(
    () =>
      assertSeededCoachDatabaseState(databaseRows("fixture"), "provisioned"),
    /neither an untouched fixture nor its expected local account/,
  );

  const hybrid = databaseRows("fixture");
  hybrid[0] = {
    ...hybrid[0],
    auth_user_id: SEEDED_COACH_ACCOUNTS[0].authUserId,
    claimed_at: "2026-10-04T12:00:00Z",
  };
  assert.throws(
    () => assertSeededCoachDatabaseState(hybrid, "seeded-or-provisioned"),
    /neither an untouched fixture nor its expected local account/,
  );
});
