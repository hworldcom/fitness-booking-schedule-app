import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import postgres from "postgres";
import type { CoachProfileInput } from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import {
  CoachProfileConflictError,
  currentOwnedCoachProfileRecord,
  publicCoachDirectoryRecords,
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

const firstAuthUserId = "95000000-0000-4000-8000-000000000001";
const secondAuthUserId = "95000000-0000-4000-8000-000000000002";
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
      where auth_user_id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    )
  `;
  await admin`
    delete from app.coach_profiles
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    )
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    )
  `;
  await admin`
    delete from app.profiles
    where auth_user_id in (
      ${firstAuthUserId}::uuid,
      ${secondAuthUserId}::uuid
    )
  `;
  await admin`
    delete from auth.users
    where id in (
      ${firstAuthUserId}::uuid,
      ${secondAuthUserId}::uuid
    )
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
  const first = await enrollApplicationProfile(firstAuthUserId, "Coach Owner");
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

const gymProfile: CoachProfileInput = Object.freeze({
  displayName: "Coach Owner",
  bio: "Private boxing and Muay Thai coaching with careful fundamentals, adaptable drills and useful feedback.",
  disciplines: Object.freeze(["Boxing", "Muay Thai"] as const),
  timezone: "Europe/Berlin",
  visibility: "visible",
  selectedGymId: fixtureGymId,
  independentLocation: null,
});

const independentProfile: CoachProfileInput = Object.freeze({
  displayName: "Other Owner",
  bio: "Private wrestling coaching with structured positional practice and a calm pace for developing athletes.",
  disciplines: Object.freeze(["Wrestling"] as const),
  timezone: "Europe/Berlin",
  visibility: "hidden",
  selectedGymId: null,
  independentLocation: Object.freeze({
    label: "Tempelhofer Feld — north entrance",
    latitude: 52.473086,
    longitude: 13.403665,
    source: "manual",
    provider: null,
  }),
});

test("runtime writes only through the verified owner function", async () => {
  await assert.rejects(
    runtime`update app.coach_profiles set visibility = 'hidden'`,
    /permission denied for table coach_profiles/,
  );

  const slug = await withActorDatabaseContext(firstActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, gymProfile),
  );
  assert.match(slug, /^coach-owner-/);

  const ownerRecord = await withActorDatabaseContext(
    firstActor,
    (transaction) => currentOwnedCoachProfileRecord(transaction, firstActor),
  );
  assert.equal(ownerRecord?.selectedGymId, fixtureGymId);
  assert.equal(ownerRecord?.gymName, "Northside Combat");
  assert.equal(
    ownerRecord?.location.label,
    "Near Amerika-Gedenkbibliothek — Blücherplatz 1, 10961 Berlin",
  );
  assert.deepEqual(ownerRecord?.disciplines, ["Boxing", "Muay Thai"]);

  const otherOwnerRecord = await withActorDatabaseContext(
    secondActor,
    (transaction) => currentOwnedCoachProfileRecord(transaction, secondActor),
  );
  assert.equal(otherOwnerRecord, null);
});

test("public discovery filters visible database records without fixture fallback", async () => {
  await withActorDatabaseContext(secondActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, independentProfile),
  );

  const ownerSearch = await publicCoachDirectoryRecords({
    query: "Coach Owner",
    discipline: "Boxing",
    location: "Northside",
    serviceMode: "private-training",
  });
  assert.equal(ownerSearch.length, 1);
  assert.equal(ownerSearch[0]?.displayName, "Coach Owner");

  const hiddenSearch = await publicCoachDirectoryRecords({
    query: "Other Owner",
    discipline: null,
    location: "",
    serviceMode: null,
  });
  assert.deepEqual(hiddenSearch, []);
  assert.equal(
    await publicCoachProfileRecord("other-owner-950000000000"),
    null,
  );
});

test("inactive or unknown gyms fail closed without partial profile changes", async () => {
  await admin`
    update app.gyms set status = 'inactive' where id = ${fixtureGymId}::uuid
  `;
  try {
    await assert.rejects(
      withActorDatabaseContext(firstActor, (transaction) =>
        upsertOwnedCoachProfileRecord(transaction, gymProfile),
      ),
      CoachProfileConflictError,
    );
  } finally {
    await admin`
      update app.gyms set status = 'active' where id = ${fixtureGymId}::uuid
    `;
  }

  const unchanged = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachProfileRecord(transaction, firstActor),
  );
  assert.equal(unchanged?.visibility, "visible");
  assert.equal(unchanged?.selectedGymId, fixtureGymId);
});
