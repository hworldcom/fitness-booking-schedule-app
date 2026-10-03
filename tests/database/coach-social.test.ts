import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { parseCoachPostCursor } from "@/domain/coach-social";
import type { CoachProfileInput } from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  CoachSocialConflictError,
  createOwnedCoachPostRecord,
  currentCoachFollowRecord,
  followingCoachPostRecords,
  publicCoachPostRecords,
  setOwnedCoachFollowRecord,
  setOwnedCoachPostVisibilityRecord,
} from "@/server/db/coaches/social-repository";
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

const followerAuthUserId = "96000000-0000-4000-8000-000000000001";
const coachAuthUserId = "96000000-0000-4000-8000-000000000002";
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

let followerActor: AuthorizedActor;
let coachActor: AuthorizedActor;

function actorFromRecord(
  authUserId: string,
  record: NonNullable<Awaited<ReturnType<typeof enrollApplicationProfile>>>,
): AuthorizedActor {
  assert.equal(record.role, "member");
  return Object.freeze({
    authUserId,
    profileId: record.profileId,
    runId: record.runId,
    runRole: "member" as const,
  });
}

async function removeFixtures() {
  await admin`
    delete from app.coach_follows
    where follower_profile_id in (
      select id from app.profiles
      where auth_user_id in (${followerAuthUserId}::uuid, ${coachAuthUserId}::uuid)
    ) or coach_profile_id in (
      select id from app.profiles
      where auth_user_id in (${followerAuthUserId}::uuid, ${coachAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.coach_posts
    where coach_profile_id in (
      select id from app.profiles
      where auth_user_id in (${followerAuthUserId}::uuid, ${coachAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.coach_profile_disciplines
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (${followerAuthUserId}::uuid, ${coachAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.coach_profiles
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (${followerAuthUserId}::uuid, ${coachAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (${followerAuthUserId}::uuid, ${coachAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.profiles
    where auth_user_id in (${followerAuthUserId}::uuid, ${coachAuthUserId}::uuid)
  `;
  await admin`
    delete from auth.users
    where id in (${followerAuthUserId}::uuid, ${coachAuthUserId}::uuid)
  `;
}

before(async () => {
  await removeFixtures();
  await admin`
    insert into auth.users (id, is_sso_user, is_anonymous)
    values
      (${followerAuthUserId}::uuid, false, false),
      (${coachAuthUserId}::uuid, false, false)
  `;
  const follower = await enrollApplicationProfile(
    followerAuthUserId,
    "Feed Reader",
  );
  const coach = await enrollApplicationProfile(coachAuthUserId, "Social Coach");
  assert.ok(follower);
  assert.ok(coach);
  followerActor = actorFromRecord(followerAuthUserId, follower);
  coachActor = actorFromRecord(coachAuthUserId, coach);

  await withActorDatabaseContext(coachActor, async (transaction) => {
    const support = await transaction.execute<{ available: boolean }>(sql`
      select to_regprocedure('app.activate_owned_coaching()') is not null
        as available
    `);
    if (support[0]?.available) {
      await transaction.execute(sql`select app.activate_owned_coaching()`);
    }
  });

  const profile: CoachProfileInput = Object.freeze({
    displayName: "Social Coach",
    bio: "Private boxing coaching with deliberate footwork practice, useful feedback and a calm learning pace.",
    disciplines: Object.freeze(["Boxing"] as const),
    timezone: "Europe/Berlin",
    visibility: "visible",
    selectedGymId: null,
    independentLocation: Object.freeze({
      label: "Tempelhofer Feld — north entrance",
      latitude: 52.473086,
      longitude: 13.403665,
      source: "manual",
      provider: null,
    }),
  });
  await withActorDatabaseContext(coachActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, profile),
  );
});

after(async () => {
  await removeFixtures();
  await Promise.all([admin.end(), runtime.end()]);
});

test("follow and post functions enforce ownership and deterministic projections", async () => {
  await assert.rejects(
    runtime`insert into app.coach_follows (
      run_id, follower_profile_id, coach_profile_id
    ) values (
      ${followerActor.runId}::uuid,
      ${followerActor.profileId}::uuid,
      ${coachActor.profileId}::uuid
    )`,
    /permission denied for table coach_follows/,
  );

  await withActorDatabaseContext(followerActor, (transaction) =>
    setOwnedCoachFollowRecord(transaction, coachActor.profileId, true),
  );
  await withActorDatabaseContext(followerActor, (transaction) =>
    setOwnedCoachFollowRecord(transaction, coachActor.profileId, true),
  );
  assert.equal(
    await withActorDatabaseContext(followerActor, (transaction) =>
      currentCoachFollowRecord(
        transaction,
        followerActor,
        coachActor.profileId,
      ),
    ),
    true,
  );

  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      setOwnedCoachFollowRecord(transaction, coachActor.profileId, true),
    ),
    CoachSocialConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(followerActor, (transaction) =>
      createOwnedCoachPostRecord(transaction, "Clients cannot publish posts."),
    ),
    CoachSocialConflictError,
  );

  const firstPostId = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      createOwnedCoachPostRecord(transaction, "Balance before speed."),
  );
  const secondPostId = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      createOwnedCoachPostRecord(transaction, "Position before pressure."),
  );
  await admin`
    update app.coach_posts
    set published_at = '2026-10-03T12:00:00Z'
    where id in (${firstPostId}::uuid, ${secondPostId}::uuid)
  `;

  const feed = await withActorDatabaseContext(followerActor, (transaction) =>
    followingCoachPostRecords(transaction, followerActor, null),
  );
  assert.deepEqual(
    feed.posts.map((post) => post.id),
    [firstPostId, secondPostId].sort().reverse(),
  );
  assert.equal(
    feed.posts.every((post) => post.coachDisplayName === "Social Coach"),
    true,
  );

  await assert.rejects(
    withActorDatabaseContext(followerActor, (transaction) =>
      setOwnedCoachPostVisibilityRecord(transaction, firstPostId, "hidden"),
    ),
    CoachSocialConflictError,
  );
  await withActorDatabaseContext(coachActor, (transaction) =>
    setOwnedCoachPostVisibilityRecord(transaction, firstPostId, "hidden"),
  );
  const publicPosts = await publicCoachPostRecords(coachActor.profileId, 20);
  assert.deepEqual(
    publicPosts.map((post) => post.id),
    [secondPostId],
  );

  await withActorDatabaseContext(followerActor, (transaction) =>
    setOwnedCoachFollowRecord(transaction, coachActor.profileId, false),
  );
  await withActorDatabaseContext(followerActor, (transaction) =>
    setOwnedCoachFollowRecord(transaction, coachActor.profileId, false),
  );
  const emptyFeed = await withActorDatabaseContext(
    followerActor,
    (transaction) =>
      followingCoachPostRecords(transaction, followerActor, null),
  );
  assert.deepEqual(emptyFeed.posts, []);
});

test("following feed cursor pagination retains deterministic equal-time order", async () => {
  await withActorDatabaseContext(followerActor, (transaction) =>
    setOwnedCoachFollowRecord(transaction, coachActor.profileId, true),
  );
  const paginationPostIds = await admin<{ id: string }[]>`
    insert into app.coach_posts (
      run_id,
      coach_profile_id,
      body,
      visibility,
      published_at,
      record_source
    )
    select
      ${coachActor.runId}::uuid,
      ${coachActor.profileId}::uuid,
      'Pagination post ' || series::text,
      'visible',
      '2026-10-03T13:00:00Z'::timestamptz,
      'user'
    from generate_series(1, 21) as series
    returning id
  `;
  try {
    const firstPage = await withActorDatabaseContext(
      followerActor,
      (transaction) =>
        followingCoachPostRecords(transaction, followerActor, null),
    );
    assert.equal(firstPage.posts.length, 20);
    assert.ok(firstPage.nextCursor);
    const cursor = parseCoachPostCursor(firstPage.nextCursor);
    assert.ok(cursor);

    const secondPage = await withActorDatabaseContext(
      followerActor,
      (transaction) =>
        followingCoachPostRecords(transaction, followerActor, cursor),
    );
    const expectedRows = await admin<{ id: string }[]>`
      select id
      from app.coach_posts
      where run_id = ${coachActor.runId}::uuid
        and coach_profile_id = ${coachActor.profileId}::uuid
        and visibility = 'visible'
      order by published_at desc, id desc
    `;
    assert.deepEqual(
      [...firstPage.posts, ...secondPage.posts].map((post) => post.id),
      expectedRows.map((row) => row.id),
    );
    assert.equal(secondPage.nextCursor, null);
  } finally {
    await admin`
      delete from app.coach_posts
      where id in ${admin(paginationPostIds.map((post) => post.id))}
    `;
    await withActorDatabaseContext(followerActor, (transaction) =>
      setOwnedCoachFollowRecord(transaction, coachActor.profileId, false),
    );
  }
});

test("hidden coaches reject new follows and disappear from public posts", async () => {
  await withActorDatabaseContext(followerActor, (transaction) =>
    setOwnedCoachFollowRecord(transaction, coachActor.profileId, true),
  );
  await admin`
    update app.coach_profiles
    set visibility = 'hidden'
    where run_id = ${coachActor.runId}::uuid
      and profile_id = ${coachActor.profileId}::uuid
  `;
  try {
    await assert.rejects(
      withActorDatabaseContext(followerActor, (transaction) =>
        setOwnedCoachFollowRecord(transaction, coachActor.profileId, true),
      ),
      CoachSocialConflictError,
    );
    assert.deepEqual(
      await publicCoachPostRecords(coachActor.profileId, 20),
      [],
    );
    const hiddenCoachFeed = await withActorDatabaseContext(
      followerActor,
      (transaction) =>
        followingCoachPostRecords(transaction, followerActor, null),
    );
    assert.deepEqual(hiddenCoachFeed.posts, []);
  } finally {
    await admin`
      update app.coach_profiles
      set visibility = 'visible'
      where run_id = ${coachActor.runId}::uuid
        and profile_id = ${coachActor.profileId}::uuid
    `;
    await withActorDatabaseContext(followerActor, (transaction) =>
      setOwnedCoachFollowRecord(transaction, coachActor.profileId, false),
    );
  }
});
