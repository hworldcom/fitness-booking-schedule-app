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
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
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

  let rules = await withActorDatabaseContext(secondActor, (transaction) =>
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
  assert.equal(generated.length, 3);
  assert.equal(secondRead.length, 3);
  assert.equal(
    new Set(generated.map((slot) => slot.recurrenceLocalDate)).size,
    1,
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
  assert.ok(occurrenceCounts.every((row) => row.occurrence_count === 1));

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
  rules = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
  );
  assert.ok(rules.every((rule) => rule.coachTimezone === "Europe/Berlin"));
  const stable = await withActorDatabaseContext(secondActor, (transaction) =>
    currentOwnedCoachAvailabilityRecords(transaction, secondActor),
  );
  assert.ok(
    stable
      .filter((slot) => slot.recurrenceRuleId !== null)
      .every(
        (slot) => slot.location.label === "Tempelhofer Feld — north entrance",
      ),
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
  await withActorDatabaseContext(secondActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, secondProfile),
  );
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

  await assert.rejects(
    withActorDatabaseContext(secondActor, (transaction) =>
      createOwnedCoachAvailabilityRuleRecord(transaction, ruleInput),
    ),
    CoachAvailabilityConflictError,
  );
  assert.deepEqual(
    await withActorDatabaseContext(secondActor, (transaction) =>
      currentOwnedCoachAvailabilityRuleRecords(transaction, secondActor),
    ),
    [],
  );
  await withActorDatabaseContext(secondActor, (transaction) =>
    withdrawOwnedCoachAvailabilityRecord(transaction, explicitSlotId),
  );
});
