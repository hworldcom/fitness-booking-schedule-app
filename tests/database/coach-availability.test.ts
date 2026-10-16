import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import postgres from "postgres";
import {
  localDateTimeValue,
  type CoachAvailabilityInput,
  type CoachAvailabilityRuleInput,
  type CoachProfileInput,
} from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import {
  CoachAvailabilityConflictError,
  createOwnedCoachAvailabilityRecord,
  createOwnedCoachAvailabilityRuleRecord,
  currentOwnedCoachAvailabilityRecords,
  currentOwnedCoachAvailabilityRuleRecords,
  publicCoachAvailabilityRecords,
  removeOwnedCoachAvailabilityRuleRecord,
  replaceOwnedCoachAvailabilityRuleRecords,
  updateOwnedCoachAvailabilityRecord,
  withdrawOwnedCoachAvailabilityRecord,
} from "@/server/db/coaches/availability-repository";
import {
  createOwnedCoachTrainingLocationRecord,
  currentOwnedCoachProfileRecord,
  deactivateOwnedCoachTrainingLocationRecord,
  publicCoachDirectoryRecords,
  setOwnedCoachPrimaryLocationRecord,
  updateOwnedCoachTrainingLocationRecord,
  upsertOwnedCoachProfileRecord,
} from "@/server/db/coaches/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
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
let secondPrimaryLocationId: string;
let secondPrimaryLocationUpdatedAt: string;

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
    delete from app.coach_availability_rules
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
    delete from app.coach_application_review_events
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    )
  `;
  await admin`
    delete from app.coach_applications
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

function recurringRuleInput(daysFromNow: number, localStartTime: string) {
  const localDate = localDateTimeValue(
    new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000),
    "Europe/Berlin",
  ).slice(0, 10);
  const [year, month, day] = localDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return Object.freeze({
    locationId: secondPrimaryLocationId,
    locationUpdatedAt: secondPrimaryLocationUpdatedAt,
    isoWeekday: (weekday === 0 ? 7 : weekday) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    localStartTime,
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
  await withActorDatabaseContext(firstActor, submitOwnedCoachApplicationRecord);
  await withActorDatabaseContext(
    secondActor,
    submitOwnedCoachApplicationRecord,
  );
  await withActorDatabaseContext(firstActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, {
      ...firstProfile,
      visibility: "hidden",
    }),
  );
  await withActorDatabaseContext(secondActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, {
      ...secondProfile,
      visibility: "hidden",
    }),
  );
  await admin`
    select app.review_coach_application(
      ${firstActor.profileId}::uuid,
      'pending',
      'approved',
      'Database test reviewed this complete coach profile.',
      'database-test',
      'movx-identity-application-v1'
    )
  `;
  await admin`
    select app.review_coach_application(
      ${secondActor.profileId}::uuid,
      'pending',
      'approved',
      'Database test reviewed this complete coach profile.',
      'database-test',
      'movx-identity-application-v1'
    )
  `;
  await withActorDatabaseContext(firstActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, firstProfile),
  );
  await withActorDatabaseContext(secondActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, secondProfile),
  );
  const [secondPrimaryLocation] = await admin<
    { id: string; updated_at: string }[]
  >`
    select
      id::text,
      pg_catalog.to_jsonb(updated_at) #>> '{}' as updated_at
    from app.coach_training_locations
    where run_id = ${secondActor.runId}::uuid
      and profile_id = ${secondActor.profileId}::uuid
      and status = 'active'
      and is_primary
  `;
  assert.ok(secondPrimaryLocation);
  secondPrimaryLocationId = secondPrimaryLocation.id;
  secondPrimaryLocationUpdatedAt = secondPrimaryLocation.updated_at;
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
  assert.equal(owned[0]?.recurrenceRuleId, null);
  assert.equal(owned[0]?.recurrenceLocalDate, null);
  assert.equal(owned[0]?.location.gymName, "Northside Combat");

  const visible = await publicCoachAvailabilityRecords(firstActor.profileId);
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, slotId);
  assert.equal("status" in (visible[0] ?? {}), false);
  assert.equal(visible[0]?.requestEligibility, "requestable");

  const beforeDirectoryRead = new Date();
  const directory = await publicCoachDirectoryRecords({
    query: "Availability Owner",
    discipline: null,
    location: "",
    serviceMode: null,
  });
  const afterDirectoryRead = new Date();
  assert.equal(directory.length, 1);
  assert.equal(
    directory[0]?.primaryLocation.id,
    directory[0]?.coach.primaryLocationId,
  );
  const slot = visible[0];
  assert.ok(slot);
  const startLocalDate = localDateTimeValue(
    slot.startsAt,
    slot.coachTimezone,
  ).slice(0, 10);
  const beforeLocalDate = localDateTimeValue(
    beforeDirectoryRead,
    slot.coachTimezone,
  ).slice(0, 10);
  const afterLocalDate = localDateTimeValue(
    afterDirectoryRead,
    slot.coachTimezone,
  ).slice(0, 10);
  if (beforeLocalDate === afterLocalDate) {
    assert.equal(
      directory[0]?.todaySlots.some((candidate) => candidate.id === slot.id),
      startLocalDate === beforeLocalDate,
    );
  }

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

test("non-open slots expose bounded public request state and remain immutable", async () => {
  const slots = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, firstActor),
  );
  const slot = slots.find((candidate) => candidate.status === "open");
  assert.ok(slot);

  for (const status of ["held", "booked", "withdrawn"] as const) {
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
      publicSlots.find((candidate) => candidate.id === slot.id)
        ?.requestEligibility,
      status === "booked"
        ? "booked"
        : status === "withdrawn"
          ? "withdrawn"
          : "unavailable",
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

test("weekly rules materialize once, preserve snapshots and remove only open occurrences", async () => {
  const earlyRuleInput = recurringRuleInput(2, "06:00");
  const adjacentRuleInput = recurringRuleInput(2, "07:00");
  const openRuleInput = recurringRuleInput(2, "08:00");
  const earlyRuleId = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      createOwnedCoachAvailabilityRuleRecord(transaction, earlyRuleInput),
  );

  const duplicateAttempts = await Promise.allSettled([
    withActorDatabaseContext(secondActor, (transaction) =>
      createOwnedCoachAvailabilityRuleRecord(transaction, adjacentRuleInput),
    ),
    withActorDatabaseContext(secondActor, (transaction) =>
      createOwnedCoachAvailabilityRuleRecord(transaction, adjacentRuleInput),
    ),
  ]);
  assert.equal(
    duplicateAttempts.filter((attempt) => attempt.status === "fulfilled")
      .length,
    1,
  );
  const rejected = duplicateAttempts.find(
    (attempt) => attempt.status === "rejected",
  );
  assert.ok(
    rejected && rejected.reason instanceof CoachAvailabilityConflictError,
  );
  const adjacentRuleId = duplicateAttempts.find(
    (attempt) => attempt.status === "fulfilled",
  )?.value;
  assert.ok(adjacentRuleId);
  const openRuleId = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      createOwnedCoachAvailabilityRuleRecord(transaction, openRuleInput),
  );

  const rules = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  assert.deepEqual(
    rules.map((rule) => [rule.localStartTime, rule.coachTimezone]),
    [
      ["06:00", "Europe/Berlin"],
      ["07:00", "Europe/Berlin"],
      ["08:00", "Europe/Berlin"],
    ],
  );

  const firstRead = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, secondActor),
  );
  const secondRead = await publicCoachAvailabilityRecords(
    secondActor.profileId,
  );
  await publicCoachAvailabilityRecords(secondActor.profileId);
  const generated = firstRead.filter((slot) => slot.recurrenceRuleId !== null);
  assert.ok(generated.length >= 12 && generated.length <= 15);
  assert.equal(secondRead.length, generated.length);
  assert.equal(
    new Set(generated.map((slot) => slot.recurrenceLocalDate)).size,
    generated.length / 3,
  );
  assert.ok(
    generated.every(
      (slot) =>
        new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime() ===
        60 * 60 * 1000,
    ),
  );

  const occurrenceCounts = await admin<
    { recurrence_rule_id: string; occurrence_count: number }[]
  >`
    select recurrence_rule_id::text, count(*)::integer as occurrence_count
    from app.coach_availability_slots
    where recurrence_rule_id in (
      ${earlyRuleId}::uuid,
      ${adjacentRuleId}::uuid,
      ${openRuleId}::uuid
    )
    group by recurrence_rule_id
    order by recurrence_rule_id
  `;
  assert.equal(occurrenceCounts.length, 3);
  assert.ok(
    occurrenceCounts.every(
      (row) => row.occurrence_count >= 4 && row.occurrence_count <= 5,
    ),
  );
  assert.equal(
    occurrenceCounts.reduce((sum, row) => sum + row.occurrence_count, 0),
    generated.length,
  );

  await assert.rejects(
    withActorDatabaseContext(firstActor, (transaction) =>
      removeOwnedCoachAvailabilityRuleRecord(transaction, earlyRuleId),
    ),
    CoachAvailabilityConflictError,
  );

  const earlyOccurrence = generated.find(
    (slot) => slot.recurrenceRuleId === earlyRuleId,
  );
  const adjacentOccurrence = generated.find(
    (slot) => slot.recurrenceRuleId === adjacentRuleId,
  );
  const openOccurrence = generated.find(
    (slot) => slot.recurrenceRuleId === openRuleId,
  );
  assert.ok(earlyOccurrence);
  assert.ok(adjacentOccurrence);
  assert.ok(openOccurrence);
  await assert.rejects(
    withActorDatabaseContext(secondActor, (transaction) =>
      updateOwnedCoachAvailabilityRecord(
        transaction,
        earlyOccurrence.id,
        availabilityInput(5),
      ),
    ),
    CoachAvailabilityConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(secondActor, (transaction) =>
      withdrawOwnedCoachAvailabilityRecord(transaction, openOccurrence.id),
    ),
    CoachAvailabilityConflictError,
  );
  await admin.begin(async (transaction) => {
    await transaction`
      select set_config('app.coach_booking_management', 'on', true)
    `;
    await transaction`
      update app.coach_availability_slots
      set status = case
        when id = ${earlyOccurrence.id}::uuid then 'booked'
        when id = ${adjacentOccurrence.id}::uuid then 'held'
        else status
      end
      where id in (
        ${earlyOccurrence.id}::uuid,
        ${adjacentOccurrence.id}::uuid
      )
    `;
  });

  await withActorDatabaseContext(secondActor, (transaction) =>
    removeOwnedCoachAvailabilityRuleRecord(transaction, earlyRuleId),
  );
  await withActorDatabaseContext(secondActor, (transaction) =>
    removeOwnedCoachAvailabilityRuleRecord(transaction, adjacentRuleId),
  );
  await withActorDatabaseContext(secondActor, (transaction) =>
    removeOwnedCoachAvailabilityRuleRecord(transaction, openRuleId),
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      removeOwnedCoachAvailabilityRuleRecord(transaction, openRuleId),
    ),
    openRuleId,
  );

  const lifecycle = await admin<
    { id: string; status: string; starts_at: Date; ends_at: Date }[]
  >`
    select id::text, status, starts_at, ends_at
    from app.coach_availability_slots
    where id in (
      ${earlyOccurrence.id}::uuid,
      ${adjacentOccurrence.id}::uuid,
      ${openOccurrence.id}::uuid
    )
    order by id
  `;
  assert.equal(
    lifecycle.find((slot) => slot.id === earlyOccurrence.id)?.status,
    "booked",
  );
  assert.equal(
    lifecycle.find((slot) => slot.id === adjacentOccurrence.id)?.status,
    "held",
  );
  assert.equal(
    lifecycle.find((slot) => slot.id === openOccurrence.id)?.status,
    "withdrawn",
  );
  assert.equal(
    lifecycle
      .find((slot) => slot.id === earlyOccurrence.id)
      ?.starts_at.getTime(),
    new Date(earlyOccurrence.startsAt).getTime(),
  );
  assert.equal(
    lifecycle.find((slot) => slot.id === earlyOccurrence.id)?.ends_at.getTime(),
    new Date(earlyOccurrence.endsAt).getTime(),
  );

  assert.deepEqual(
    await withActorDatabaseContext(secondActor, (transaction) =>
      currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
    ),
    [],
  );
});

test("timezone changes regenerate open occurrences without rewriting their snapshots", async () => {
  const input = recurringRuleInput(4, "15:00");
  const ruleId = await withActorDatabaseContext(secondActor, (transaction) =>
    createOwnedCoachAvailabilityRuleRecord(transaction, input),
  );
  const beforeChange = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      currentOwnedCoachAvailabilityRecords(transaction, secondActor),
  );
  const originalOccurrence = beforeChange.find(
    (slot) => slot.recurrenceRuleId === ruleId,
  );
  assert.ok(originalOccurrence);

  const movedProfile: CoachProfileInput = Object.freeze({
    ...secondProfile,
    timezone: "UTC",
    independentLocation: Object.freeze({
      label: "Mauerpark — west entrance",
      latitude: 52.543308,
      longitude: 13.402481,
      source: "manual",
      provider: null,
    }),
  });
  await withActorDatabaseContext(secondActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, movedProfile),
  );

  const [historicalOccurrence] = await admin<
    {
      status: string;
      coach_timezone: string;
      public_location_label: string;
    }[]
  >`
    select status, coach_timezone, public_location_label
    from app.coach_availability_slots
    where id = ${originalOccurrence.id}::uuid
  `;
  assert.deepEqual(historicalOccurrence, {
    status: "withdrawn",
    coach_timezone: "Europe/Berlin",
    public_location_label: "Tempelhofer Feld — north entrance",
  });

  const rules = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0]?.coachTimezone, "UTC");
  const afterChange = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      currentOwnedCoachAvailabilityRecords(transaction, secondActor),
  );
  const replacementOccurrence = afterChange.find(
    (slot) => slot.recurrenceRuleId === rules[0]?.id,
  );
  assert.ok(replacementOccurrence);
  assert.notEqual(replacementOccurrence.id, originalOccurrence.id);
  assert.notEqual(replacementOccurrence.recurrenceRuleId, ruleId);
  assert.equal(replacementOccurrence.coachTimezone, "UTC");
  assert.equal(
    replacementOccurrence.location.label,
    "Mauerpark — west entrance",
  );

  await withActorDatabaseContext(secondActor, (transaction) =>
    removeOwnedCoachAvailabilityRuleRecord(transaction, rules[0]!.id),
  );
  await withActorDatabaseContext(secondActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, secondProfile),
  );
  const [restoredPrimary] = await withActorDatabaseContext(
    secondActor,
    async (transaction) => {
      const coach = await currentOwnedCoachProfileRecord(
        transaction,
        secondActor,
      );
      return coach?.locations.filter((location) => location.isPrimary) ?? [];
    },
  );
  assert.ok(restoredPrimary);
  secondPrimaryLocationUpdatedAt = restoredPrimary.updatedAt;
});

test("complete working-week saves are atomic and reject stale baselines", async () => {
  const mondayMorning = recurringRuleInput(2, "09:00");
  const mondayLateMorning = recurringRuleInput(2, "10:00");
  const mondayMidday = recurringRuleInput(2, "11:00");
  const firstDraft: readonly CoachAvailabilityRuleInput[] = Object.freeze([
    mondayMorning,
    mondayLateMorning,
  ]);

  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(transaction, firstDraft, []),
    ),
    2,
  );
  const originalRules = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  assert.deepEqual(
    originalRules.map((rule) => rule.localStartTime),
    ["09:00", "10:00"],
  );
  const originalSlots = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      currentOwnedCoachAvailabilityRecords(transaction, secondActor),
  );
  const morningSlot = originalSlots.find(
    (slot) =>
      slot.recurrenceRuleId ===
      originalRules.find((rule) => rule.localStartTime === "09:00")?.id,
  );
  const lateMorningSlot = originalSlots.find(
    (slot) =>
      slot.recurrenceRuleId ===
      originalRules.find((rule) => rule.localStartTime === "10:00")?.id,
  );
  assert.ok(morningSlot);
  assert.ok(lateMorningSlot);

  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        firstDraft,
        firstDraft,
      ),
    ),
    2,
  );
  assert.deepEqual(
    (
      await withActorDatabaseContext(secondActor, (transaction) =>
        currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
      )
    ).map((rule) => rule.id),
    originalRules.map((rule) => rule.id),
  );

  await admin.begin(async (transaction) => {
    await transaction`
      select set_config('app.coach_booking_management', 'on', true)
    `;
    await transaction`
      update app.coach_availability_slots
      set status = 'booked'
      where id = ${morningSlot.id}::uuid
    `;
  });

  const replacementDraft: readonly CoachAvailabilityRuleInput[] = Object.freeze(
    [mondayMidday],
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        replacementDraft,
        firstDraft,
      ),
    ),
    1,
  );
  assert.deepEqual(
    (
      await withActorDatabaseContext(secondActor, (transaction) =>
        currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
      )
    ).map((rule) => rule.localStartTime),
    ["11:00"],
  );
  const replacedSlotStates = await admin<{ id: string; status: string }[]>`
    select id::text, status
    from app.coach_availability_slots
    where id in (${morningSlot.id}::uuid, ${lateMorningSlot.id}::uuid)
    order by id
  `;
  assert.equal(
    replacedSlotStates.find((slot) => slot.id === morningSlot.id)?.status,
    "booked",
  );
  assert.equal(
    replacedSlotStates.find((slot) => slot.id === lateMorningSlot.id)?.status,
    "withdrawn",
  );

  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        [mondayLateMorning],
        firstDraft,
      ),
    ),
    -1,
  );
  assert.deepEqual(
    (
      await withActorDatabaseContext(secondActor, (transaction) =>
        currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
      )
    ).map((rule) => rule.localStartTime),
    ["11:00"],
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        [],
        replacementDraft,
      ),
    ),
    0,
  );
});

test("recurring rules reject invalid hours and omit ambiguous local times", async () => {
  for (const localStartTime of ["06:30", "23:00"]) {
    await assert.rejects(
      withActorDatabaseContext(secondActor, (transaction) =>
        createOwnedCoachAvailabilityRuleRecord(transaction, {
          locationId: secondPrimaryLocationId,
          locationUpdatedAt: secondPrimaryLocationUpdatedAt,
          isoWeekday: 1,
          localStartTime,
        }),
      ),
      CoachAvailabilityConflictError,
    );
  }

  const [times] = await admin<
    { spring_gap: boolean; fall_overlap: boolean; ordinary: boolean }[]
  >`
    select
      app.coach_local_time_is_unambiguous(
        timestamp '2027-03-28 02:00:00',
        'Europe/Berlin'
      ) as spring_gap,
      app.coach_local_time_is_unambiguous(
        timestamp '2026-10-25 02:00:00',
        'Europe/Berlin'
      ) as fall_overlap,
      app.coach_local_time_is_unambiguous(
        timestamp '2026-10-25 04:00:00',
        'Europe/Berlin'
      ) as ordinary
  `;
  assert.deepEqual(times, {
    spring_gap: false,
    fall_overlap: false,
    ordinary: true,
  });
});

test("a recurring occurrence cannot overlap retained explicit inventory", async () => {
  const ruleInput = recurringRuleInput(3, "09:00");
  const localDate = localDateTimeValue(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    "Europe/Berlin",
  ).slice(0, 10);
  const explicitSlotId = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      createOwnedCoachAvailabilityRecord(transaction, {
        localStart: `${localDate}T09:00`,
        durationMinutes: 60,
        refreshLocation: false,
      }),
  );

  const ruleId = await withActorDatabaseContext(secondActor, (transaction) =>
    createOwnedCoachAvailabilityRuleRecord(transaction, ruleInput),
  );
  // Retain the valid template while withholding the occupied date.
  const occurrences = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      currentOwnedCoachAvailabilityRecords(transaction, secondActor),
  );
  const original = occurrences.find((slot) => slot.id === explicitSlotId);
  assert.ok(original);
  assert.equal(
    occurrences.filter((slot) => slot.startsAt === original.startsAt).length,
    1,
  );
  assert.ok(occurrences.some((slot) => slot.recurrenceRuleId === ruleId));
  await withActorDatabaseContext(secondActor, (transaction) =>
    removeOwnedCoachAvailabilityRuleRecord(transaction, ruleId),
  );
  await withActorDatabaseContext(secondActor, (transaction) =>
    withdrawOwnedCoachAvailabilityRecord(transaction, explicitSlotId),
  );
});

test("location-aware rules preserve assignments, snapshots and deactivation history", async () => {
  const initialCoach = await withActorDatabaseContext(
    secondActor,
    (transaction) => currentOwnedCoachProfileRecord(transaction, secondActor),
  );
  assert.ok(initialCoach);
  const initialPrimary = initialCoach.locations.find(
    (location) => location.id === initialCoach.primaryLocationId,
  );
  assert.ok(initialPrimary);

  const secondaryId = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      createOwnedCoachTrainingLocationRecord(transaction, {
        kind: "independent",
        publicName: "Riverside strength deck",
        label: "Maybachufer 1, 12047 Berlin, Germany",
        latitude: 52.49345,
        longitude: 13.42842,
        source: "manual",
        provider: null,
      }),
  );
  let coach = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachProfileRecord(transaction, secondActor),
  );
  assert.ok(coach);
  let primary = coach.locations.find(
    (location) => location.id === initialPrimary.id,
  );
  let secondary = coach.locations.find(
    (location) => location.id === secondaryId,
  );
  assert.ok(primary);
  assert.ok(secondary);
  const primaryId = primary.id;
  const primaryPublicName = primary.publicName;
  const secondaryLocationId = secondary.id;
  const initialSecondaryUpdatedAt = secondary.updatedAt;

  const primaryCell = recurringRuleInput(2, "16:00");
  const secondaryCell: CoachAvailabilityRuleInput = Object.freeze({
    locationId: secondaryLocationId,
    locationUpdatedAt: secondary.updatedAt,
    isoWeekday: recurringRuleInput(3, "17:00").isoWeekday,
    localStartTime: "17:00",
  });
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        [primaryCell, secondaryCell],
        [],
      ),
    ),
    2,
  );

  let rules = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  assert.deepEqual(
    new Set(rules.map((rule) => `${rule.locationId}:${rule.localStartTime}`)),
    new Set([`${primaryId}:16:00`, `${secondaryLocationId}:17:00`]),
  );
  const ruleInputs = rules.map(
    ({ locationId, locationUpdatedAt, isoWeekday, localStartTime }) =>
      Object.freeze({
        locationId,
        locationUpdatedAt,
        isoWeekday,
        localStartTime,
      }),
  );
  const occurrences = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      currentOwnedCoachAvailabilityRecords(transaction, secondActor),
  );
  const primaryRule = rules.find((rule) => rule.locationId === primaryId);
  const secondaryRule = rules.find(
    (rule) => rule.locationId === secondaryLocationId,
  );
  assert.ok(primaryRule);
  assert.ok(secondaryRule);
  const primaryOccurrence = occurrences.find(
    (slot) => slot.recurrenceRuleId === primaryRule.id,
  );
  const secondaryOccurrence = occurrences.find(
    (slot) => slot.recurrenceRuleId === secondaryRule.id,
  );
  assert.ok(primaryOccurrence);
  assert.ok(secondaryOccurrence);
  assert.equal(primaryOccurrence.location.trainingLocationId, primaryId);
  assert.equal(primaryOccurrence.location.name, primaryPublicName);
  assert.equal(
    secondaryOccurrence.location.trainingLocationId,
    secondaryLocationId,
  );
  assert.equal(secondaryOccurrence.location.name, secondary.publicName);
  assert.equal(
    secondaryOccurrence.location.label,
    "Maybachufer 1, 12047 Berlin, Germany",
  );

  const firstCoach = await withActorDatabaseContext(firstActor, (transaction) =>
    currentOwnedCoachProfileRecord(transaction, firstActor),
  );
  assert.ok(firstCoach);
  const crossOwnerLocation = firstCoach.locations.find(
    (location) => location.id === firstCoach.primaryLocationId,
  );
  assert.ok(crossOwnerLocation);
  const unauthorizedDraft = [
    ...ruleInputs,
    Object.freeze({
      locationId: crossOwnerLocation.id,
      locationUpdatedAt: crossOwnerLocation.updatedAt,
      isoWeekday: recurringRuleInput(4, "18:00").isoWeekday,
      localStartTime: "18:00",
    }),
  ];
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        unauthorizedDraft,
        ruleInputs,
      ),
    ),
    -1,
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        [
          primaryCell,
          Object.freeze({
            ...primaryCell,
            locationId: secondaryLocationId,
            locationUpdatedAt: initialSecondaryUpdatedAt,
          }),
        ],
        ruleInputs,
      ),
    ),
    -1,
  );

  const staleSecondaryUpdatedAt = secondary.updatedAt;
  const secondaryUpdatedAt = secondary.updatedAt;
  await withActorDatabaseContext(secondActor, (transaction) =>
    updateOwnedCoachTrainingLocationRecord(
      transaction,
      secondaryLocationId,
      secondaryUpdatedAt,
      {
        kind: "independent",
        publicName: "Updated riverside deck",
        label: "Maybachufer 2, 12047 Berlin, Germany",
        latitude: 52.49355,
        longitude: 13.42852,
        source: "manual",
        provider: null,
      },
    ),
  );
  const [unchangedSecondarySnapshot] = await admin<
    {
      training_location_name: string;
      public_location_label: string;
      latitude: string;
      longitude: string;
    }[]
  >`
    select
      training_location_name,
      public_location_label,
      latitude,
      longitude
    from app.coach_availability_slots
    where id = ${secondaryOccurrence.id}::uuid
  `;
  assert.deepEqual(unchangedSecondarySnapshot, {
    training_location_name: "Riverside strength deck",
    public_location_label: "Maybachufer 1, 12047 Berlin, Germany",
    latitude: "52.493450",
    longitude: "13.428420",
  });

  rules = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  const currentRuleInputs = rules.map(
    ({ locationId, locationUpdatedAt, isoWeekday, localStartTime }) =>
      Object.freeze({
        locationId,
        locationUpdatedAt,
        isoWeekday,
        localStartTime,
      }),
  );
  const staleRequested = currentRuleInputs.map((rule) =>
    rule.locationId === secondaryLocationId
      ? Object.freeze({
          ...rule,
          locationUpdatedAt: staleSecondaryUpdatedAt,
        })
      : rule,
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        staleRequested,
        currentRuleInputs,
      ),
    ),
    -1,
  );

  coach = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachProfileRecord(transaction, secondActor),
  );
  assert.ok(coach);
  primary = coach.locations.find((location) => location.id === primaryId);
  secondary = coach.locations.find(
    (location) => location.id === secondaryLocationId,
  );
  assert.ok(primary);
  assert.ok(secondary);
  const currentPrimaryUpdatedAt = primary.updatedAt;
  const currentSecondaryUpdatedAt = secondary.updatedAt;
  await withActorDatabaseContext(secondActor, (transaction) =>
    setOwnedCoachPrimaryLocationRecord(
      transaction,
      secondaryLocationId,
      currentSecondaryUpdatedAt,
      primaryId,
      currentPrimaryUpdatedAt,
    ),
  );
  rules = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  assert.deepEqual(
    new Set(rules.map((rule) => rule.locationId)),
    new Set([primaryId, secondaryLocationId]),
  );

  await admin.begin(async (transaction) => {
    await transaction`
      select pg_catalog.set_config('app.coach_booking_management', 'on', true)
    `;
    await transaction`
      update app.coach_availability_slots
      set status = 'booked'
      where id = ${primaryOccurrence.id}::uuid
    `;
  });
  coach = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachProfileRecord(transaction, secondActor),
  );
  assert.ok(coach);
  primary = coach.locations.find((location) => location.id === primaryId);
  secondary = coach.locations.find(
    (location) => location.id === secondaryLocationId,
  );
  assert.ok(primary);
  assert.ok(secondary);
  assert.equal(coach.primaryLocationId, secondaryLocationId);
  await withActorDatabaseContext(secondActor, (transaction) =>
    deactivateOwnedCoachTrainingLocationRecord(
      transaction,
      primaryId,
      primary.updatedAt,
    ),
  );

  rules = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0]?.locationId, secondaryLocationId);
  const [preservedBooked, preservedSecondary] = await admin<
    {
      id: string;
      status: string;
      coach_training_location_id: string;
      training_location_name: string;
    }[]
  >`
    select
      id::text,
      status,
      coach_training_location_id::text,
      training_location_name
    from app.coach_availability_slots
    where id in (
      ${primaryOccurrence.id}::uuid,
      ${secondaryOccurrence.id}::uuid
    )
    order by id = ${primaryOccurrence.id}::uuid desc
  `;
  assert.deepEqual(preservedBooked, {
    id: primaryOccurrence.id,
    status: "booked",
    coach_training_location_id: primaryId,
    training_location_name: primaryOccurrence.location.name,
  });
  assert.deepEqual(preservedSecondary, {
    id: secondaryOccurrence.id,
    status: "open",
    coach_training_location_id: secondaryLocationId,
    training_location_name: "Riverside strength deck",
  });

  const remainingRules = rules.map(
    ({ locationId, locationUpdatedAt, isoWeekday, localStartTime }) =>
      Object.freeze({
        locationId,
        locationUpdatedAt,
        isoWeekday,
        localStartTime,
      }),
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(
        transaction,
        [
          ...remainingRules,
          Object.freeze({
            locationId: primaryId,
            locationUpdatedAt: primary.updatedAt,
            isoWeekday: recurringRuleInput(5, "19:00").isoWeekday,
            localStartTime: "19:00",
          }),
        ],
        remainingRules,
      ),
    ),
    -1,
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(transaction, [], remainingRules),
    ),
    0,
  );

  const raceLocationId = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      createOwnedCoachTrainingLocationRecord(transaction, {
        kind: "independent",
        publicName: "Concurrent save venue",
        label: "Görlitzer Park, 10997 Berlin, Germany",
        latitude: 52.49654,
        longitude: 13.43779,
        source: "manual",
        provider: null,
      }),
  );
  coach = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachProfileRecord(transaction, secondActor),
  );
  assert.ok(coach);
  const raceLocation = coach.locations.find(
    (location) => location.id === raceLocationId,
  );
  assert.ok(raceLocation);
  const raceLocationUpdatedAt = raceLocation.updatedAt;
  const raceRule: CoachAvailabilityRuleInput = Object.freeze({
    locationId: raceLocationId,
    locationUpdatedAt: raceLocationUpdatedAt,
    isoWeekday: recurringRuleInput(6, "20:00").isoWeekday,
    localStartTime: "20:00",
  });
  const [saveOutcome, updateOutcome] = await Promise.all([
    withActorDatabaseContext(secondActor, (transaction) =>
      replaceOwnedCoachAvailabilityRuleRecords(transaction, [raceRule], []),
    ),
    withActorDatabaseContext(secondActor, (transaction) =>
      updateOwnedCoachTrainingLocationRecord(
        transaction,
        raceLocationId,
        raceLocationUpdatedAt,
        {
          kind: "independent",
          publicName: "Concurrent save venue updated",
          label: "Görlitzer Park north gate, 10997 Berlin, Germany",
          latitude: 52.49664,
          longitude: 13.43789,
          source: "manual",
          provider: null,
        },
      ),
    ),
  ]);
  assert.ok(saveOutcome === -1 || saveOutcome === 1);
  assert.match(updateOutcome, /^\d{4}-\d{2}-\d{2}/);
  const raceRules = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  assert.equal(raceRules.length, saveOutcome === 1 ? 1 : 0);
  if (saveOutcome === 1) {
    assert.equal(raceRules[0]?.locationId, raceLocationId);
    assert.equal(raceRules[0]?.locationUpdatedAt, updateOutcome);
    const raceOccurrences = await withActorDatabaseContext(
      secondActor,
      (transaction) =>
        currentOwnedCoachAvailabilityRecords(transaction, secondActor),
    );
    const raceOccurrence = raceOccurrences.find(
      (slot) => slot.recurrenceRuleId === raceRules[0]?.id,
    );
    assert.ok(raceOccurrence);
    assert.equal(raceOccurrence.location.name, "Concurrent save venue");
    const expectedRaceRules = raceRules.map(
      ({ locationId, locationUpdatedAt, isoWeekday, localStartTime }) =>
        Object.freeze({
          locationId,
          locationUpdatedAt,
          isoWeekday,
          localStartTime,
        }),
    );
    assert.equal(
      await withActorDatabaseContext(secondActor, (transaction) =>
        replaceOwnedCoachAvailabilityRuleRecords(
          transaction,
          [],
          expectedRaceRules,
        ),
      ),
      0,
    );
  }
});
