import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import postgres from "postgres";
import {
  localDateTimeValue,
  type CoachAvailabilityInput,
  type CoachProfileInput,
} from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import {
  CoachAvailabilityConflictError,
  createOwnedCoachAvailabilityRecord,
  currentOwnedCoachAvailabilityRecords,
  publicCoachAvailabilityRecords,
  updateOwnedCoachAvailabilityRecord,
  withdrawOwnedCoachAvailabilityRecord,
} from "@/server/db/coaches/availability-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
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

const firstAuthUserId = "96000000-0000-4000-8000-000000000001";
const secondAuthUserId = "96000000-0000-4000-8000-000000000002";
const fixtureGymId = "40000000-0000-4000-8000-000000000001";

const admin = postgres(adminConnectionString, {
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
    delete from app.coach_availability_slots
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    )
  `;
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

const firstProfile: CoachProfileInput = Object.freeze({
  displayName: "Availability Owner",
  bio: "Private boxing sessions with clear pacing, careful technique and practical feedback for developing athletes.",
  disciplines: Object.freeze(["Boxing"] as const),
  timezone: "Europe/Berlin",
  visibility: "visible",
  selectedGymId: fixtureGymId,
  independentLocation: null,
});

const secondProfile: CoachProfileInput = Object.freeze({
  displayName: "Availability Other",
  bio: "Private wrestling sessions with structured positional work and calm feedback for consistent technical progress.",
  disciplines: Object.freeze(["Wrestling"] as const),
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

function futureLocalStart(hoursFromNow: number) {
  const target = Date.now() + hoursFromNow * 60 * 60 * 1000;
  const rounded = Math.ceil(target / (15 * 60 * 1000)) * 15 * 60 * 1000;
  return localDateTimeValue(new Date(rounded), "Europe/Berlin");
}

function availabilityInput(
  hoursFromNow: number,
  refreshLocation = false,
): CoachAvailabilityInput {
  return Object.freeze({
    localStart: futureLocalStart(hoursFromNow),
    durationMinutes: 60,
    refreshLocation,
  });
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
    "Availability Owner",
  );
  const second = await enrollApplicationProfile(
    secondAuthUserId,
    "Availability Other",
  );
  assert.ok(first);
  assert.ok(second);
  firstActor = actorFromRecord(firstAuthUserId, first);
  secondActor = actorFromRecord(secondAuthUserId, second);

  await withActorDatabaseContext(firstActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, firstProfile),
  );
  await withActorDatabaseContext(secondActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, secondProfile),
  );
});

after(async () => {
  await removeFixtures();
  await admin.end();
});

test("owner publishes a public slot with a stable location snapshot", async () => {
  const slotId = await withActorDatabaseContext(firstActor, (transaction) =>
    createOwnedCoachAvailabilityRecord(transaction, availabilityInput(2)),
  );
  const owned = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, firstActor),
  );
  assert.equal(owned.length, 1);
  assert.equal(owned[0]?.id, slotId);
  assert.equal(owned[0]?.status, "open");
  assert.equal(owned[0]?.location.gymName, "Northside Combat");

  const visible = await publicCoachAvailabilityRecords(firstActor.profileId);
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, slotId);
  assert.equal("status" in (visible[0] ?? {}), false);

  const [originalGym] = await admin<
    {
      name: string;
      public_location_label: string;
      latitude: string;
      longitude: string;
    }[]
  >`
    select name, public_location_label, latitude, longitude
    from app.gyms
    where id = ${fixtureGymId}::uuid
  `;
  assert.ok(originalGym);
  try {
    await admin`
      update app.gyms
      set
        name = 'Temporary changed gym',
        public_location_label = 'Temporary changed location',
        latitude = 52.500000,
        longitude = 13.500000
      where id = ${fixtureGymId}::uuid
    `;
    const [stableSnapshot] = await withActorDatabaseContext(
      firstActor,
      (transaction) =>
        currentOwnedCoachAvailabilityRecords(transaction, firstActor),
    );
    assert.equal(stableSnapshot?.location.gymName, "Northside Combat");
    assert.match(
      stableSnapshot?.location.label ?? "",
      /Amerika-Gedenkbibliothek/,
    );
  } finally {
    await admin`
      update app.gyms
      set
        name = ${originalGym.name},
        public_location_label = ${originalGym.public_location_label},
        latitude = ${originalGym.latitude},
        longitude = ${originalGym.longitude}
      where id = ${fixtureGymId}::uuid
    `;
  }

  await assert.rejects(
    withActorDatabaseContext(secondActor, (transaction) =>
      updateOwnedCoachAvailabilityRecord(
        transaction,
        slotId,
        availabilityInput(3),
      ),
    ),
    CoachAvailabilityConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(secondActor, (transaction) =>
      withdrawOwnedCoachAvailabilityRecord(transaction, slotId),
    ),
    CoachAvailabilityConflictError,
  );
});

test("profile edits never move a slot unless the owner explicitly refreshes it", async () => {
  const [existing] = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, firstActor),
  );
  assert.ok(existing);

  const movedProfile: CoachProfileInput = Object.freeze({
    ...firstProfile,
    selectedGymId: null,
    independentLocation: Object.freeze({
      label: "Hasenheide — north gate",
      latitude: 52.488208,
      longitude: 13.411632,
      source: "manual",
      provider: null,
    }),
  });
  await withActorDatabaseContext(firstActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, movedProfile),
  );

  const unchanged = await withActorDatabaseContext(firstActor, (transaction) =>
    updateOwnedCoachAvailabilityRecord(
      transaction,
      existing.id,
      availabilityInput(2.5),
    ),
  );
  assert.equal(unchanged, existing.id);
  let [slot] = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, firstActor),
  );
  assert.equal(slot?.location.gymName, "Northside Combat");
  assert.match(slot?.location.label ?? "", /Amerika-Gedenkbibliothek/);

  await withActorDatabaseContext(firstActor, (transaction) =>
    updateOwnedCoachAvailabilityRecord(
      transaction,
      existing.id,
      availabilityInput(2.5, true),
    ),
  );
  [slot] = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, firstActor),
  );
  assert.equal(slot?.location.kind, "independent");
  assert.equal(slot?.location.gymName, null);
  assert.equal(slot?.location.label, "Hasenheide — north gate");
});

test("concurrent overlapping publication produces exactly one slot", async () => {
  const input = availabilityInput(4);
  const attempts = await Promise.allSettled([
    withActorDatabaseContext(firstActor, (transaction) =>
      createOwnedCoachAvailabilityRecord(transaction, input),
    ),
    withActorDatabaseContext(firstActor, (transaction) =>
      createOwnedCoachAvailabilityRecord(transaction, input),
    ),
  ]);
  assert.equal(
    attempts.filter((attempt) => attempt.status === "fulfilled").length,
    1,
  );
  assert.equal(
    attempts.filter((attempt) => attempt.status === "rejected").length,
    1,
  );
  const rejected = attempts.find((attempt) => attempt.status === "rejected");
  assert.ok(
    rejected && rejected.reason instanceof CoachAvailabilityConflictError,
  );

  const owned = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, firstActor),
  );
  assert.equal(
    owned.filter((slot) => slot.startsAt === owned.at(-1)?.startsAt).length,
    1,
  );
});

test("held and booked slots are hidden publicly and immutable to availability controls", async () => {
  const slots = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, firstActor),
  );
  const slot = slots.at(-1);
  assert.ok(slot);

  for (const status of ["held", "booked"] as const) {
    await admin`
      update app.coach_availability_slots
      set status = ${status}
      where id = ${slot.id}::uuid
    `;
    await assert.rejects(
      withActorDatabaseContext(firstActor, (transaction) =>
        updateOwnedCoachAvailabilityRecord(
          transaction,
          slot.id,
          availabilityInput(5),
        ),
      ),
      CoachAvailabilityConflictError,
    );
    await assert.rejects(
      withActorDatabaseContext(firstActor, (transaction) =>
        withdrawOwnedCoachAvailabilityRecord(transaction, slot.id),
      ),
      CoachAvailabilityConflictError,
    );
    const publicSlots = await publicCoachAvailabilityRecords(
      firstActor.profileId,
    );
    assert.equal(
      publicSlots.some((candidate) => candidate.id === slot.id),
      false,
    );
  }
});

test("database rejects unsupported local times and publication horizons", async () => {
  for (const localStart of ["2027-03-28T02:30", "2026-10-25T02:30"]) {
    await assert.rejects(
      withActorDatabaseContext(firstActor, (transaction) =>
        createOwnedCoachAvailabilityRecord(
          transaction,
          Object.freeze({
            localStart,
            durationMinutes: 60,
            refreshLocation: false,
          }),
        ),
      ),
      CoachAvailabilityConflictError,
    );
  }
  await assert.rejects(
    withActorDatabaseContext(firstActor, (transaction) =>
      createOwnedCoachAvailabilityRecord(
        transaction,
        availabilityInput(8 * 24),
      ),
    ),
    CoachAvailabilityConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(firstActor, (transaction) =>
      createOwnedCoachAvailabilityRecord(transaction, availabilityInput(-2)),
    ),
    CoachAvailabilityConflictError,
  );
});
