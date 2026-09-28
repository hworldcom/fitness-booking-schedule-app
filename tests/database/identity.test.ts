import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import {
  ActorContextRejectedError,
  currentActorProjection,
  withActorDatabaseContext,
} from "@/server/db/authorization/repository";
import {
  ApplicationIdentityConflictError,
  currentApplicationProfile,
  enrollApplicationProfile,
} from "@/server/db/identity/repository";
import { createDatabaseConnection } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

const adminConnectionString = process.env.DATABASE_TEST_URL;
if (!adminConnectionString) {
  throw new Error(
    "DATABASE_TEST_URL is required for database integration tests.",
  );
}

const runtimeUrl = new URL(adminConnectionString);
runtimeUrl.username = "repx_runtime_login";
runtimeUrl.password = "postgres";
process.env.DATABASE_URL = runtimeUrl.toString();

const authUserId = "92000000-0000-4000-8000-000000000001";
const secondAuthUserId = "92000000-0000-4000-8000-000000000002";
const conflictingAuthUserId = "92000000-0000-4000-8000-000000000003";
const fixtureProfileId = "92000000-0000-4000-8000-000000000010";
const runId = "20000000-0000-4000-8000-000000000001";

type IdentityFunctionRow = {
  identity_profile_id: string;
  identity_profile_slug: string;
};

const admin = postgres(adminConnectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});
const runtimeA = postgres(runtimeUrl.toString(), {
  max: 1,
  prepare: false,
  ssl: false,
});
const runtimeB = postgres(runtimeUrl.toString(), {
  max: 1,
  prepare: false,
  ssl: false,
});

async function removeFixture() {
  await admin`
    delete from app.wallet_bindings
    where bound_by_auth_user_id in (
      ${authUserId}::uuid,
      ${secondAuthUserId}::uuid,
      ${conflictingAuthUserId}::uuid
    )
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (
        ${authUserId}::uuid,
        ${secondAuthUserId}::uuid,
        ${conflictingAuthUserId}::uuid
      ) or id = ${fixtureProfileId}::uuid
    )
  `;
  await admin`
    delete from app.profiles
    where auth_user_id in (
      ${authUserId}::uuid,
      ${secondAuthUserId}::uuid,
      ${conflictingAuthUserId}::uuid
    ) or id = ${fixtureProfileId}::uuid
  `;
  await admin`
    delete from auth.users
    where id in (
      ${authUserId}::uuid,
      ${secondAuthUserId}::uuid,
      ${conflictingAuthUserId}::uuid
    )
  `;
}

before(async () => {
  await removeFixture();
  await admin`
    insert into auth.users (id, is_sso_user, is_anonymous)
    values
      (${authUserId}::uuid, false, false),
      (${secondAuthUserId}::uuid, false, false),
      (${conflictingAuthUserId}::uuid, false, false)
  `;
  await admin`
    insert into app.profiles (
      id, auth_user_id, slug, display_name, initials, bio, avatar_color,
      record_source, claimed_at
    )
    values (
      ${fixtureProfileId}::uuid,
      ${conflictingAuthUserId}::uuid,
      'old-prepared-fixture',
      'Old Prepared Fixture',
      'OP',
      '',
      'blue',
      'fixture',
      statement_timestamp()
    )
  `;
});

after(async () => {
  await runtimeA.end();
  await runtimeB.end();
  await removeFixture();
  await admin.end();
});

test("the runtime login cannot write identity tables directly", async () => {
  await assert.rejects(
    runtimeA`insert into app.profiles (slug) values ('forbidden')`,
    /permission denied for table profiles/,
  );
  await assert.rejects(
    runtimeA`insert into app.demo_run_participants (run_id) values (${runId}::uuid)`,
    /permission denied for table demo_run_participants/,
  );
});

test("simultaneous enrollment and retries converge on one ordinary profile", async () => {
  const [first, second] = await Promise.all([
    runtimeA<IdentityFunctionRow[]>`
      select identity_profile_id, identity_profile_slug
      from app.enroll_application_identity(
        ${authUserId}::uuid,
        'Anna Integration'
      )
    `,
    runtimeB<IdentityFunctionRow[]>`
      select identity_profile_id, identity_profile_slug
      from app.enroll_application_identity(
        ${authUserId}::uuid,
        'Anna Integration'
      )
    `,
  ]);

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0]?.identity_profile_id, second[0]?.identity_profile_id);
  assert.match(
    first[0]?.identity_profile_slug ?? "",
    /^anna-integration-920000000000$/,
  );

  const retried = await enrollApplicationProfile(
    authUserId,
    "A different retry name",
  );
  const current = await currentApplicationProfile(authUserId);
  assert.equal(retried?.displayName, "Anna Integration");
  assert.deepEqual(current, retried);

  const state = await admin<
    Array<{
      profile_count: string;
      participation_count: string;
      wallet_count: string;
      roles: string[];
    }>
  >`
    select
      count(distinct profile.id)::text as profile_count,
      count(distinct participant.profile_id)::text as participation_count,
      count(distinct binding.id)::text as wallet_count,
      array_agg(distinct participant.role) as roles
    from app.profiles as profile
    join app.demo_run_participants as participant
      on participant.profile_id = profile.id
    left join app.wallet_bindings as binding
      on binding.profile_id = profile.id
    where profile.auth_user_id = ${authUserId}::uuid
  `;
  assert.deepEqual(
    { ...state[0] },
    {
      profile_count: "1",
      participation_count: "1",
      wallet_count: "0",
      roles: ["member"],
    },
  );
});

test("invalid input and an old prepared fixture fail without partial state", async () => {
  await assert.rejects(
    enrollApplicationProfile(secondAuthUserId, "A"),
    ApplicationIdentityConflictError,
  );
  assert.equal(await currentApplicationProfile(secondAuthUserId), null);

  await assert.rejects(
    enrollApplicationProfile(conflictingAuthUserId, "Replacement Name"),
    ApplicationIdentityConflictError,
  );
  const rows = await admin<{ participant_count: string }[]>`
    select count(*)::text as participant_count
    from app.demo_run_participants
    where profile_id = ${fixtureProfileId}::uuid
  `;
  assert.equal(rows[0]?.participant_count, "0");
});

function authorizedActor(
  authUser: string,
  record: NonNullable<Awaited<ReturnType<typeof enrollApplicationProfile>>>,
): AuthorizedActor {
  assert.equal(record.role, "member");
  return Object.freeze({
    authUserId: authUser,
    profileId: record.profileId,
    runId: record.runId,
    runRole: "member",
  });
}

async function assertPooledContextCleared() {
  const { queryClient } = createDatabaseConnection();
  try {
    const rows = await queryClient<
      Array<{
        auth_user_id: string | null;
        profile_id: string | null;
        run_id: string | null;
        run_role: string | null;
      }>
    >`
      select
        nullif(current_setting('app.current_auth_user_id', true), '') as auth_user_id,
        nullif(current_setting('app.current_profile_id', true), '') as profile_id,
        nullif(current_setting('app.current_run_id', true), '') as run_id,
        nullif(current_setting('app.current_run_role', true), '') as run_role
    `;
    assert.deepEqual(
      { ...rows[0] },
      {
        auth_user_id: null,
        profile_id: null,
        run_id: null,
        run_role: null,
      },
    );
  } finally {
    await queryClient.end({ timeout: 1 });
  }
}

test("wallet-independent actor context isolates alternating accounts", async () => {
  const firstRecord = await enrollApplicationProfile(
    authUserId,
    "Anna Integration",
  );
  const secondRecord = await enrollApplicationProfile(
    secondAuthUserId,
    "Daniel Integration",
  );
  assert.ok(firstRecord);
  assert.ok(secondRecord);

  const firstActor = authorizedActor(authUserId, firstRecord);
  const secondActor = authorizedActor(secondAuthUserId, secondRecord);

  const firstProjection = await withActorDatabaseContext(
    firstActor,
    async (transaction) => {
      const settings = await transaction.execute<{
        auth_user_id: string;
        profile_id: string;
        run_id: string;
        run_role: string;
      }>(sql`
        select
          current_setting('app.current_auth_user_id') as auth_user_id,
          current_setting('app.current_profile_id') as profile_id,
          current_setting('app.current_run_id') as run_id,
          current_setting('app.current_run_role') as run_role
      `);
      assert.deepEqual(
        { ...settings[0] },
        {
          auth_user_id: firstActor.authUserId,
          profile_id: firstActor.profileId,
          run_id: firstActor.runId,
          run_role: firstActor.runRole,
        },
      );

      const hiddenProfiles = await transaction
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, secondRecord.profileId));
      assert.deepEqual(hiddenProfiles, []);
      return currentActorProjection(transaction, firstActor);
    },
  );
  assert.equal(firstProjection.profileSlug, firstRecord.profileSlug);
  await assertPooledContextCleared();

  const secondProjection = await withActorDatabaseContext(
    secondActor,
    (transaction) => currentActorProjection(transaction, secondActor),
  );
  assert.equal(secondProjection.profileSlug, secondRecord.profileSlug);
  await assertPooledContextCleared();

  await assert.rejects(
    withActorDatabaseContext(
      { ...firstActor, authUserId: secondActor.authUserId },
      async () => undefined,
    ),
    ActorContextRejectedError,
  );
});
