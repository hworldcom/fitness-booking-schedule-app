import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import postgres from "postgres";
import type { CoachProfileInput } from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import {
  currentActorProjection,
  withActorDatabaseContext,
} from "@/server/db/authorization/repository";
import { activateOwnedCoachingRecord } from "@/server/db/coaches/activation-repository";
import {
  CoachProfileConflictError,
  upsertOwnedCoachProfileRecord,
} from "@/server/db/coaches/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";

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

const firstAuthUserId = "99000000-0000-4000-8000-000000000001";
const secondAuthUserId = "99000000-0000-4000-8000-000000000002";
const fixtureGymId = "40000000-0000-4000-8000-000000000001";

const admin = postgres(adminConnectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});
const runtime = postgres(runtimeUrl.toString(), {
  max: 1,
  prepare: false,
  ssl: false,
});

let firstActor: AuthorizedActor;
let secondActor: AuthorizedActor;

function actorFromRecord(
  authUserId: string,
  record: NonNullable<Awaited<ReturnType<typeof enrollApplicationProfile>>>,
): AuthorizedActor {
  assert.equal(record.role, "member");
  return Object.freeze({
    authUserId,
    profileId: record.profileId,
    runId: record.runId,
    runRole: "member",
  });
}

async function removeFixtures() {
  await admin`
    delete from app.coach_profile_disciplines
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.coach_profiles
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.profiles
    where auth_user_id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
  `;
  await admin`
    delete from auth.users
    where id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
  `;
}

before(async () => {
  await removeFixtures();
  await admin`
    insert into auth.users (id, is_sso_user, is_anonymous)
    values
      (${firstAuthUserId}::uuid, false, false),
      (${secondAuthUserId}::uuid, false, false)
  `;
  const first = await enrollApplicationProfile(
    firstAuthUserId,
    "Activation Owner",
  );
  const second = await enrollApplicationProfile(
    secondAuthUserId,
    "Unactivated Owner",
  );
  assert.ok(first);
  assert.ok(second);
  firstActor = actorFromRecord(firstAuthUserId, first);
  secondActor = actorFromRecord(secondAuthUserId, second);
});

after(async () => {
  await removeFixtures();
  await runtime.end();
  await admin.end();
});

const coachProfile: CoachProfileInput = Object.freeze({
  displayName: "Activation Owner",
  bio: "Private boxing coaching with calm fundamentals, structured practice and clear feedback for every developing athlete.",
  disciplines: Object.freeze(["Boxing"] as const),
  timezone: "Europe/Berlin",
  visibility: "hidden",
  selectedGymId: fixtureGymId,
  independentLocation: null,
});

test("new accounts default to unactivated and cannot create coach profiles", async () => {
  const first = await withActorDatabaseContext(firstActor, (transaction) =>
    currentActorProjection(transaction, firstActor),
  );
  assert.equal(first.coachingActivated, false);

  await assert.rejects(
    withActorDatabaseContext(firstActor, (transaction) =>
      upsertOwnedCoachProfileRecord(transaction, coachProfile),
    ),
    CoachProfileConflictError,
  );

  await assert.rejects(
    runtime`update app.profiles set coaching_activated_at = statement_timestamp()`,
    /permission denied for table profiles/,
  );
});

test("owner activation is immediate, idempotent and isolated", async () => {
  const firstActivation = await withActorDatabaseContext(
    firstActor,
    activateOwnedCoachingRecord,
  );
  const retryActivation = await withActorDatabaseContext(
    firstActor,
    activateOwnedCoachingRecord,
  );
  assert.equal(retryActivation, firstActivation);

  const [first, second] = await Promise.all([
    withActorDatabaseContext(firstActor, (transaction) =>
      currentActorProjection(transaction, firstActor),
    ),
    withActorDatabaseContext(secondActor, (transaction) =>
      currentActorProjection(transaction, secondActor),
    ),
  ]);
  assert.equal(first.coachingActivated, true);
  assert.equal(second.coachingActivated, false);

  const slug = await withActorDatabaseContext(firstActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, coachProfile),
  );
  assert.match(slug, /^activation-owner-/);
});
