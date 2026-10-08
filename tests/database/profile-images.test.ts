import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import postgres from "postgres";
import type { CoachProfileInput } from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  ProfileImageReferenceConflictError,
  currentAccountAvatarReference,
  currentCoachPortraitReference,
  setCurrentAccountAvatarReference,
  setCurrentCoachPortraitReference,
} from "@/server/db/profile-images/repository";

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

const ownerAuthUserId = "97000000-0000-4000-8000-000000000001";
const otherAuthUserId = "97000000-0000-4000-8000-000000000002";
const firstObjectId = "97000000-0000-4000-8000-000000000011";
const secondObjectId = "97000000-0000-4000-8000-000000000012";
const fixtureGymId = "40000000-0000-4000-8000-000000000001";
const policyVersion = "movx-identity-application-v1";

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

let owner: AuthorizedActor;
let other: AuthorizedActor;

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
  const authUserIds = [ownerAuthUserId, otherAuthUserId];
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
      (${ownerAuthUserId}::uuid, false, false),
      (${otherAuthUserId}::uuid, false, false)
  `;
  const ownerRecord = await enrollApplicationProfile(
    ownerAuthUserId,
    "Profile Image Owner",
  );
  const otherRecord = await enrollApplicationProfile(
    otherAuthUserId,
    "Other Image Owner",
  );
  assert.ok(ownerRecord);
  assert.ok(otherRecord);
  owner = actorFromRecord(ownerAuthUserId, ownerRecord);
  other = actorFromRecord(otherAuthUserId, otherRecord);

  await withActorDatabaseContext(owner, submitOwnedCoachApplicationRecord);
  const draft: CoachProfileInput = Object.freeze({
    displayName: "Profile Image Owner",
    bio: "Private boxing coaching with deliberate practice and clear feedback for every developing athlete.",
    disciplines: Object.freeze(["Boxing"] as const),
    timezone: "Europe/Berlin",
    visibility: "hidden",
    selectedGymId: fixtureGymId,
    independentLocation: null,
  });
  await withActorDatabaseContext(owner, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, draft),
  );
  await admin`
    select app.review_coach_application(
      ${owner.profileId}::uuid,
      'pending',
      'approved',
      'Profile image database test approval.',
      'database-test',
      ${policyVersion}
    )
  `;
});

after(async () => {
  await removeFixtures();
  await runtime.end();
  await admin.end();
});

test("runtime writes require the compare-and-swap media functions", async () => {
  await assert.rejects(
    runtime`
      update app.profiles
      set avatar_storage_path = ${`${owner.profileId}/${firstObjectId}.webp`}
      where id = ${owner.profileId}::uuid
    `,
    /permission denied|row-level security/,
  );

  const firstPath = `${owner.profileId}/${firstObjectId}.webp`;
  const secondPath = `${owner.profileId}/${secondObjectId}.webp`;
  const attached = await withActorDatabaseContext(
    owner,
    async (transaction) => {
      assert.deepEqual(
        await currentAccountAvatarReference(transaction, owner),
        {
          path: null,
          updatedAt: null,
        },
      );
      return setCurrentAccountAvatarReference(transaction, firstPath, null);
    },
  );
  assert.equal(attached.previousPath, null);
  assert.ok(attached.updatedAt);

  await assert.rejects(
    withActorDatabaseContext(owner, (transaction) =>
      setCurrentAccountAvatarReference(transaction, secondPath, null),
    ),
    ProfileImageReferenceConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(owner, (transaction) =>
      setCurrentAccountAvatarReference(
        transaction,
        `${other.profileId}/${secondObjectId}.webp`,
        firstPath,
      ),
    ),
    ProfileImageReferenceConflictError,
  );

  const removed = await withActorDatabaseContext(owner, (transaction) =>
    setCurrentAccountAvatarReference(transaction, null, firstPath),
  );
  assert.equal(removed.previousPath, firstPath);
  assert.equal(removed.updatedAt, null);
});

test("only an approved coach can attach a public portrait reference", async () => {
  const coachPath = `${owner.profileId}/${firstObjectId}.webp`;
  const attached = await withActorDatabaseContext(owner, (transaction) =>
    setCurrentCoachPortraitReference(transaction, coachPath, null, null),
  );
  assert.equal(attached.previousSource, null);
  assert.equal(attached.previousPath, null);
  assert.ok(attached.updatedAt);

  const current = await withActorDatabaseContext(owner, (transaction) =>
    currentCoachPortraitReference(transaction, owner),
  );
  assert.equal(current?.source, "storage");
  assert.equal(current?.path, coachPath);

  await assert.rejects(
    withActorDatabaseContext(other, (transaction) =>
      setCurrentCoachPortraitReference(
        transaction,
        `${other.profileId}/${secondObjectId}.webp`,
        null,
        null,
      ),
    ),
    ProfileImageReferenceConflictError,
  );
});

test("Storage policies isolate account and coach object namespaces", async () => {
  const accountPath = `${owner.profileId}/${firstObjectId}.webp`;
  const coachPath = `${owner.profileId}/${secondObjectId}.webp`;
  await assert.rejects(
    admin.begin(async (transaction) => {
      await transaction`set local role authenticated`;
      await transaction`
        select set_config('request.jwt.claim.sub', ${owner.authUserId}, true)
      `;
      await transaction`
        insert into storage.objects (bucket_id, name)
        values ('account-avatars', ${accountPath})
      `;
      await transaction`
        insert into storage.objects (bucket_id, name)
        values ('coach-portraits', ${coachPath})
      `;
      throw new Error("roll back successful policy inserts");
    }),
    /roll back successful policy inserts/,
  );

  await assert.rejects(
    admin.begin(async (transaction) => {
      await transaction`set local role authenticated`;
      await transaction`
        select set_config('request.jwt.claim.sub', ${owner.authUserId}, true)
      `;
      await transaction`
        insert into storage.objects (bucket_id, name)
        values (
          'account-avatars',
          ${`${other.profileId}/${secondObjectId}.webp`}
        )
      `;
    }),
    /row-level security/,
  );
});
