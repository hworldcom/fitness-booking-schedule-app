import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import postgres from "postgres";
import type { CoachProfileInput } from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import {
  currentActorProjection,
  withActorDatabaseContext,
} from "@/server/db/authorization/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import {
  CoachProfileConflictError,
  publicCoachProfileRecord,
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
const policyVersion = "movx-identity-application-v1";

const admin = postgres(adminConnectionString, {
  max: 4,
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
let firstCoachSlug: string;

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
  const authUserIds = [firstAuthUserId, secondAuthUserId];
  await admin`
    delete from app.coach_profile_disciplines
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authUserIds)}
    )
  `;
  await admin`
    delete from app.coach_profiles
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authUserIds)}
    )
  `;
  await admin`
    delete from app.coach_application_review_events
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authUserIds)}
    )
  `;
  await admin`
    delete from app.coach_applications
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authUserIds)}
    )
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authUserIds)}
    )
  `;
  await admin`delete from app.profiles where auth_user_id in ${admin(authUserIds)}`;
  await admin`delete from auth.users where id in ${admin(authUserIds)}`;
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
    "Application Owner",
  );
  const second = await enrollApplicationProfile(
    secondAuthUserId,
    "Other Owner",
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

const hiddenCoachProfile: CoachProfileInput = Object.freeze({
  displayName: "Application Owner",
  bio: "Private boxing coaching with calm fundamentals, structured practice and clear feedback for every developing athlete.",
  disciplines: Object.freeze(["Boxing"] as const),
  timezone: "Europe/Berlin",
  visibility: "hidden",
  selectedGymId: fixtureGymId,
  independentLocation: null,
});

test("new accounts remain clients and cannot create coach profiles before applying", async () => {
  const first = await withActorDatabaseContext(firstActor, (transaction) =>
    currentActorProjection(transaction, firstActor),
  );
  assert.deepEqual(first.coachAccess, {
    status: "not-applied",
    submittedAt: null,
    decisionReason: null,
    verificationPolicyVersion: null,
  });

  await assert.rejects(
    withActorDatabaseContext(firstActor, (transaction) =>
      upsertOwnedCoachProfileRecord(transaction, hiddenCoachProfile),
    ),
    CoachProfileConflictError,
  );
  await assert.rejects(
    runtime`select app.activate_owned_coaching()`,
    /permission denied for function activate_owned_coaching/,
  );
});

test("submission is pending and isolated until an owner approves a complete draft", async () => {
  const submitted = await withActorDatabaseContext(
    firstActor,
    submitOwnedCoachApplicationRecord,
  );
  const repeated = await withActorDatabaseContext(
    firstActor,
    submitOwnedCoachApplicationRecord,
  );
  assert.equal(submitted, "pending");
  assert.equal(repeated, "pending");

  firstCoachSlug = await withActorDatabaseContext(firstActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, hiddenCoachProfile),
  );
  await assert.rejects(
    withActorDatabaseContext(firstActor, (transaction) =>
      upsertOwnedCoachProfileRecord(transaction, {
        ...hiddenCoachProfile,
        visibility: "visible",
      }),
    ),
    CoachProfileConflictError,
  );
  await assert.rejects(
    runtime`
      select app.review_coach_application(
        ${firstActor.profileId}::uuid,
        'pending',
        'approved',
        'Reviewed identity and completed application.',
        'database-test',
        ${policyVersion}
      )
    `,
    /permission denied for function review_coach_application/,
  );

  const [approved] = await admin<{ status: string }[]>`
    select app.review_coach_application(
      ${firstActor.profileId}::uuid,
      'pending',
      'approved',
      'Reviewed identity and completed application.',
      'database-test',
      ${policyVersion}
    ) as status
  `;
  assert.equal(approved?.status, "approved");
  const [replayed] = await admin<{ status: string }[]>`
    select app.review_coach_application(
      ${firstActor.profileId}::uuid,
      'pending',
      'approved',
      'Reviewed identity and completed application.',
      'database-test',
      ${policyVersion}
    ) as status
  `;
  assert.equal(replayed?.status, "approved");

  await withActorDatabaseContext(firstActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, {
      ...hiddenCoachProfile,
      visibility: "visible",
    }),
  );
  const [first, second, eventCount, publicCoach] = await Promise.all([
    withActorDatabaseContext(firstActor, (transaction) =>
      currentActorProjection(transaction, firstActor),
    ),
    withActorDatabaseContext(secondActor, (transaction) =>
      currentActorProjection(transaction, secondActor),
    ),
    admin<{ count: string }[]>`
      select count(*)::text as count
      from app.coach_application_review_events
      where profile_id = ${firstActor.profileId}::uuid
    `,
    publicCoachProfileRecord(firstCoachSlug),
  ]);
  assert.equal(first.coachAccess.status, "approved");
  assert.equal(first.coachAccess.verificationPolicyVersion, policyVersion);
  assert.equal(second.coachAccess.status, "not-applied");
  assert.equal(eventCount[0]?.count, "1");
  assert.equal(publicCoach?.trustKind, "verified");

  await assert.rejects(
    admin`
      select app.review_coach_application(
        ${firstActor.profileId}::uuid,
        'pending',
        'rejected',
        'A stale and conflicting reviewer decision.',
        'database-test',
        ${policyVersion}
      )
    `,
    /conflicts with current state/,
  );
});

test("rejection can be resubmitted and suspension removes public coach authority", async () => {
  assert.equal(
    await withActorDatabaseContext(
      secondActor,
      submitOwnedCoachApplicationRecord,
    ),
    "pending",
  );
  const [rejected] = await admin<{ status: string }[]>`
    select app.review_coach_application(
      ${secondActor.profileId}::uuid,
      'pending',
      'rejected',
      'Application evidence needs a clearer identity match.',
      'database-test',
      ${policyVersion}
    ) as status
  `;
  assert.equal(rejected?.status, "rejected");
  assert.equal(
    await withActorDatabaseContext(
      secondActor,
      submitOwnedCoachApplicationRecord,
    ),
    "pending",
  );
  const competingDecisions = await Promise.allSettled([
    admin`
      select app.review_coach_application(
        ${secondActor.profileId}::uuid,
        'pending',
        'rejected',
        'Concurrent review found the identity evidence incomplete.',
        'database-test-a',
        ${policyVersion}
      )
    `,
    admin`
      select app.review_coach_application(
        ${secondActor.profileId}::uuid,
        'pending',
        'rejected',
        'Concurrent review found the application evidence incomplete.',
        'database-test-b',
        ${policyVersion}
      )
    `,
  ]);
  assert.equal(
    competingDecisions.filter((decision) => decision.status === "fulfilled")
      .length,
    1,
  );
  assert.equal(
    competingDecisions.filter((decision) => decision.status === "rejected")
      .length,
    1,
  );

  const [suspended] = await admin<{ status: string }[]>`
    select app.review_coach_application(
      ${firstActor.profileId}::uuid,
      'approved',
      'suspended',
      'Coach access paused during a platform review.',
      'database-test',
      ${policyVersion}
    ) as status
  `;
  assert.equal(suspended?.status, "suspended");
  const projection = await withActorDatabaseContext(firstActor, (transaction) =>
    currentActorProjection(transaction, firstActor),
  );
  assert.equal(projection.coachAccess.status, "suspended");
  assert.equal(
    await withActorDatabaseContext(
      firstActor,
      submitOwnedCoachApplicationRecord,
    ),
    "suspended",
  );
  assert.equal(await publicCoachProfileRecord(firstCoachSlug), null);
});
