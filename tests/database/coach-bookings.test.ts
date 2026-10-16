import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import {
  localDateTimeValue,
  type CoachAvailabilityInput,
  type CoachProfileInput,
} from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import {
  CoachAvailabilityConflictError,
  createOwnedCoachAvailabilityRecord,
  publicCoachAvailabilityRecords,
} from "@/server/db/coaches/availability-repository";
import {
  cancelDirectPrivateBookingRecord,
  coachBookingRequestEligibilityRecord,
  CoachBookingConflictError,
  completeDirectPrivateBookingRecord,
  currentClientPrivateBookingRecords,
  currentCoachPrivateBookingRecords,
} from "@/server/db/coaches/booking-repository";
import {
  acceptCoachBookingRequestRecord,
  closeCoachBookingRequestOccurrenceRecord,
  CoachBookingRequestConflictError,
  createCoachBookingRequestRecord,
  currentClientCoachBookingRequestRecord,
  currentClientCoachBookingRequestRecords,
  currentClientPendingCoachBookingRequestRecords,
  currentOwnedCoachBookingRequestRecords,
  declineCoachBookingRequestRecord,
  withdrawCoachBookingRequestRecord,
} from "@/server/db/coaches/booking-request-repository";
import {
  publicCoachDirectoryRecords,
  upsertOwnedCoachProfileRecord,
} from "@/server/db/coaches/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  bookingRequestClientAvatarReference,
  confirmedBookingClientAvatarReference,
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

const coachAuthUserId = "98000000-0000-4000-8000-000000000001";
const firstClientAuthUserId = "98000000-0000-4000-8000-000000000002";
const secondClientAuthUserId = "98000000-0000-4000-8000-000000000003";
const additionalClientAuthUserIds = [
  "98000000-0000-4000-8000-000000000004",
  "98000000-0000-4000-8000-000000000005",
  "98000000-0000-4000-8000-000000000006",
  "98000000-0000-4000-8000-000000000007",
] as const;
const fixtureGymId = "40000000-0000-4000-8000-000000000001";
const firstClientAvatarObjectId = "98000000-0000-4000-8000-000000000011";
const coachPortraitObjectId = "98000000-0000-4000-8000-000000000012";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:55321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "database-test-key";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3100";

const admin = postgres(adminConnectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});

let coachActor: AuthorizedActor;
let firstClientActor: AuthorizedActor;
let secondClientActor: AuthorizedActor;
const additionalClientActors: AuthorizedActor[] = [];

const coachProfile: CoachProfileInput = Object.freeze({
  displayName: "Booking Coach",
  bio: "Private boxing sessions with careful technical progress, clear pacing and practical feedback for every client.",
  disciplines: Object.freeze(["Boxing"] as const),
  timezone: "Europe/Berlin",
  visibility: "visible",
  selectedGymId: fixtureGymId,
  independentLocation: null,
});

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

function availabilityInput(hoursFromNow: number): CoachAvailabilityInput {
  const target = Date.now() + hoursFromNow * 60 * 60 * 1000;
  const rounded = Math.ceil(target / (15 * 60 * 1000)) * 15 * 60 * 1000;
  return Object.freeze({
    localStart: localDateTimeValue(new Date(rounded), "Europe/Berlin"),
    durationMinutes: 60,
    refreshLocation: false,
  });
}

async function createSlot(hoursFromNow: number) {
  return withActorDatabaseContext(coachActor, (transaction) =>
    createOwnedCoachAvailabilityRecord(
      transaction,
      availabilityInput(hoursFromNow),
    ),
  );
}

async function createConfirmedBooking(
  slotId: string,
  client: AuthorizedActor = firstClientActor,
) {
  const bookingId = randomUUID();
  await admin.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.coach_availability_management', 'on', true),
        set_config('app.coach_booking_management', 'on', true)
    `;
    const [slot] = await transaction<{ starts_at: Date; ends_at: Date }[]>`
      select starts_at, ends_at
      from app.coach_availability_slots
      where id = ${slotId}::uuid
        and run_id = ${coachActor.runId}::uuid
      for update
    `;
    assert.ok(slot);
    await transaction`
      insert into app.coach_private_bookings (
        id,
        run_id,
        slot_id,
        coach_profile_id,
        client_profile_id,
        credit_projection_id,
        status,
        scheduled_start_at,
        scheduled_end_at,
        early_return_until,
        hold_expires_at
      ) values (
        ${bookingId}::uuid,
        ${coachActor.runId}::uuid,
        ${slotId}::uuid,
        ${coachActor.profileId}::uuid,
        ${client.profileId}::uuid,
        null,
        'confirmed',
        ${slot.starts_at},
        ${slot.ends_at},
        ${slot.starts_at},
        ${slot.starts_at}
      )
    `;
    await transaction`
      update app.coach_availability_slots
      set status = 'booked'
      where id = ${slotId}::uuid
        and run_id = ${coachActor.runId}::uuid
        and status = 'open'
    `;
  });
  return bookingId;
}

function attemptDisabledDirectBooking(actor: AuthorizedActor, slotId: string) {
  return withActorDatabaseContext(actor, (transaction) =>
    transaction.execute(sql`
      select app.book_direct_private_session(${slotId}::uuid)
    `),
  );
}

async function bookingCoachDirectoryEntry() {
  const directory = await publicCoachDirectoryRecords({
    query: coachProfile.displayName,
    discipline: null,
    location: "",
    serviceMode: null,
  });
  assert.equal(directory.length, 1);
  assert.equal(directory[0]?.coach.profileId, coachActor.profileId);
  return directory[0]!;
}

async function removeFixtures() {
  const authIds = [
    coachAuthUserId,
    firstClientAuthUserId,
    secondClientAuthUserId,
    ...additionalClientAuthUserIds,
  ];
  if (
    (await admin`select to_regclass('app.message_conversations') present`)[0]
      .present
  ) {
    await admin`delete from app.message_blocks where low_profile_id in (select id from app.profiles where auth_user_id in ${admin(authIds)}) or high_profile_id in (select id from app.profiles where auth_user_id in ${admin(authIds)})`;
    await admin`delete from app.message_conversations where coach_profile_id in (select id from app.profiles where auth_user_id in ${admin(authIds)}) or athlete_profile_id in (select id from app.profiles where auth_user_id in ${admin(authIds)})`;
  }
  await admin`
    delete from app.coach_booking_requests
    where client_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    ) or coach_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_booking_credit_operations
    where booking_id in (
      select booking.id
      from app.coach_private_bookings as booking
      join app.profiles as profile
        on profile.id in (booking.client_profile_id, booking.coach_profile_id)
      where profile.auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_private_bookings
    where client_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    ) or coach_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_availability_slots
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_availability_rules
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_profile_disciplines
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_profiles
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_application_review_events
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.coach_applications
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`delete from app.profiles where auth_user_id in ${admin(authIds)}`;
  await admin`delete from auth.users where id in ${admin(authIds)}`;
}

before(async () => {
  await removeFixtures();
  await admin`
    insert into auth.users (id, is_sso_user, is_anonymous)
    values
      (${coachAuthUserId}::uuid, false, false),
      (${firstClientAuthUserId}::uuid, false, false),
      (${secondClientAuthUserId}::uuid, false, false)
  `;
  for (const authUserId of additionalClientAuthUserIds) {
    await admin`
      insert into auth.users (id, is_sso_user, is_anonymous)
      values (${authUserId}::uuid, false, false)
    `;
  }
  const coach = await enrollApplicationProfile(
    coachAuthUserId,
    "Booking Coach",
  );
  const firstClient = await enrollApplicationProfile(
    firstClientAuthUserId,
    "Booking Client One",
  );
  const secondClient = await enrollApplicationProfile(
    secondClientAuthUserId,
    "Booking Client Two",
  );
  assert.ok(coach);
  assert.ok(firstClient);
  assert.ok(secondClient);
  coachActor = actorFromRecord(coachAuthUserId, coach);
  firstClientActor = actorFromRecord(firstClientAuthUserId, firstClient);
  secondClientActor = actorFromRecord(secondClientAuthUserId, secondClient);
  for (const [index, authUserId] of additionalClientAuthUserIds.entries()) {
    const client = await enrollApplicationProfile(
      authUserId,
      `Booking Client ${index + 3}`,
    );
    assert.ok(client);
    additionalClientActors.push(actorFromRecord(authUserId, client));
  }
  await withActorDatabaseContext(coachActor, submitOwnedCoachApplicationRecord);
  await withActorDatabaseContext(coachActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, {
      ...coachProfile,
      visibility: "hidden",
    }),
  );
  await admin`
    select app.review_coach_application(
      ${coachActor.profileId}::uuid,
      'pending',
      'approved',
      'Database test reviewed this complete coach profile.',
      'database-test',
      'movx-identity-application-v1'
    )
  `;
  await withActorDatabaseContext(coachActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, coachProfile),
  );
  await withActorDatabaseContext(coachActor, (transaction) =>
    setCurrentCoachPortraitReference(
      transaction,
      `${coachActor.profileId}/${coachPortraitObjectId}.webp`,
      null,
      null,
    ),
  );
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    setCurrentAccountAvatarReference(
      transaction,
      `${firstClientActor.profileId}/${firstClientAvatarObjectId}.webp`,
      null,
    ),
  );
});

after(async () => {
  await removeFixtures();
  await admin.end();
});

test("PostgreSQL keeps open occurrences requestable until their start", async () => {
  const [result] = await admin<
    {
      future: string;
      exact_start: string;
      booked: string;
      withdrawn: string;
      held: string;
      beyond_horizon: string;
    }[]
  >`
    select
      app.coach_booking_request_eligibility(
        'open',
        statement_timestamp() + interval '1 second',
        statement_timestamp() + interval '1 hour 1 second'
      ) as future,
      app.coach_booking_request_eligibility(
        'open',
        statement_timestamp(),
        statement_timestamp() + interval '1 hour'
      ) as exact_start,
      app.coach_booking_request_eligibility(
        'booked',
        statement_timestamp() + interval '48 hours',
        statement_timestamp() + interval '49 hours'
      ) as booked,
      app.coach_booking_request_eligibility(
        'withdrawn',
        statement_timestamp() + interval '48 hours',
        statement_timestamp() + interval '49 hours'
      ) as withdrawn,
      app.coach_booking_request_eligibility(
        'held',
        statement_timestamp() + interval '48 hours',
        statement_timestamp() + interval '49 hours'
      ) as held,
      app.coach_booking_request_eligibility(
        'open',
        ((statement_timestamp() at time zone 'Europe/Berlin')::date + 30 + time '12:00') at time zone 'Europe/Berlin',
        ((statement_timestamp() at time zone 'Europe/Berlin')::date + 30 + time '13:00') at time zone 'Europe/Berlin'
      ) as beyond_horizon
  `;
  assert.deepEqual(result, {
    future: "requestable",
    exact_start: "unavailable",
    booked: "booked",
    withdrawn: "withdrawn",
    held: "unavailable",
    beyond_horizon: "unavailable",
  });
});

test("actor-safe eligibility and public projections use database time", async () => {
  const requestableSlotId = await createSlot(25);
  const lateRequestSlotId = await createSlot(1);
  const requestable = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      coachBookingRequestEligibilityRecord(transaction, requestableSlotId),
  );
  const lateRequest = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      coachBookingRequestEligibilityRecord(transaction, lateRequestSlotId),
  );
  assert.equal(requestable.eligibility, "requestable");
  assert.equal(lateRequest.eligibility, "requestable");
  assert.ok(Number.isFinite(new Date(requestable.databaseTime).getTime()));
  const publicSlots = await publicCoachAvailabilityRecords(
    coachActor.profileId,
  );
  const publicRequestable = publicSlots.find(
    (slot) => slot.id === requestableSlotId,
  );
  assert.equal(publicRequestable?.requestEligibility, "requestable");
  assert.equal(
    publicSlots.find((slot) => slot.id === lateRequestSlotId)
      ?.requestEligibility,
    "requestable",
  );
});

test("more than five clients can request one occurrence without holding it", async () => {
  const slotId = await createSlot(30);
  const clients = [
    firstClientActor,
    secondClientActor,
    ...additionalClientActors,
  ];
  const requests = await Promise.all(
    clients.map((actor) =>
      withActorDatabaseContext(actor, (transaction) =>
        createCoachBookingRequestRecord(transaction, slotId),
      ),
    ),
  );
  assert.equal(new Set(requests.map((request) => request.requestId)).size, 6);
  assert.ok(requests.every((request) => request.status === "pending"));

  const retry = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, slotId),
  );
  assert.equal(retry.requestId, requests[0]?.requestId);

  const [slot] = await admin<{ status: string }[]>`
    select status
    from app.coach_availability_slots
    where id = ${slotId}::uuid
  `;
  assert.equal(slot?.status, "open");

  const firstCoachPage = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      currentOwnedCoachBookingRequestRecords(transaction, { pageSize: 5 }),
  );
  assert.equal(firstCoachPage.items.length, 5);
  assert.ok(firstCoachPage.nextCursor);
  const secondCoachPage = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      currentOwnedCoachBookingRequestRecords(transaction, {
        pageSize: 5,
        cursor: firstCoachPage.nextCursor,
      }),
  );
  assert.equal(secondCoachPage.items.length, 1);
  assert.equal(secondCoachPage.nextCursor, null);
  const coachRequests = [...firstCoachPage.items, ...secondCoachPage.items];
  const firstClientRequest = coachRequests.find(
    (request) => request.id === requests[0]?.requestId,
  );
  assert.match(
    firstClientRequest?.clientAvatarUrl ?? "",
    new RegExp(
      `^/api/coach/requests/${requests[0]?.requestId}/client-avatar[?]v=`,
    ),
  );
  assert.ok(
    coachRequests
      .filter((request) => request.id !== requests[0]?.requestId)
      .every((request) => request.clientAvatarUrl === null),
  );

  const avatarReference = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      bookingRequestClientAvatarReference(transaction, requests[0]!.requestId),
  );
  const accountPath = `${firstClientActor.profileId}/${firstClientAvatarObjectId}.webp`;
  assert.equal(avatarReference?.path, accountPath);
  assert.ok(avatarReference?.updatedAt);
  assert.equal(
    await withActorDatabaseContext(firstClientActor, (transaction) =>
      bookingRequestClientAvatarReference(transaction, requests[0]!.requestId),
    ),
    null,
  );
  assert.equal(
    await withActorDatabaseContext(secondClientActor, (transaction) =>
      bookingRequestClientAvatarReference(transaction, requests[0]!.requestId),
    ),
    null,
  );

  let coachAvatarCount = -1;
  let unrelatedAvatarCount = -1;
  await assert.rejects(
    admin.begin(async (transaction) => {
      await transaction`set local role authenticated`;
      await transaction`
        select set_config(
          'request.jwt.claim.sub',
          ${firstClientAuthUserId},
          true
        )
      `;
      await transaction`
        insert into storage.objects (bucket_id, name)
        values ('account-avatars', ${accountPath})
      `;
      await transaction`
        select set_config('request.jwt.claim.sub', ${coachAuthUserId}, true)
      `;
      const [coachResult] = await transaction<{ count: number }[]>`
        select count(*)::integer as count
        from storage.objects
        where bucket_id = 'account-avatars'
          and name = ${accountPath}
      `;
      coachAvatarCount = coachResult?.count ?? 0;
      await transaction`
        select set_config(
          'request.jwt.claim.sub',
          ${secondClientAuthUserId},
          true
        )
      `;
      const [unrelatedResult] = await transaction<{ count: number }[]>`
        select count(*)::integer as count
        from storage.objects
        where bucket_id = 'account-avatars'
          and name = ${accountPath}
      `;
      unrelatedAvatarCount = unrelatedResult?.count ?? 0;
      throw new Error("roll back request avatar policy fixture");
    }),
    /roll back request avatar policy fixture/,
  );
  assert.deepEqual(
    { coachAvatarCount, unrelatedAvatarCount },
    { coachAvatarCount: 1, unrelatedAvatarCount: 0 },
  );

  await withActorDatabaseContext(coachActor, (transaction) =>
    declineCoachBookingRequestRecord(transaction, requests[0]!.requestId),
  );
  const terminalCoachPage = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      currentOwnedCoachBookingRequestRecords(transaction, { pageSize: 50 }),
  );
  const terminalRequest = terminalCoachPage.items.find(
    (request) => request.id === requests[0]!.requestId,
  );
  assert.equal(terminalRequest?.status, "declined");
  assert.match(
    terminalRequest?.clientAvatarUrl ?? "",
    new RegExp(
      `^/api/coach/requests/${requests[0]?.requestId}/client-avatar[?]v=`,
    ),
  );

  for (const actor of clients) {
    const clientPage = await withActorDatabaseContext(actor, (transaction) =>
      currentClientCoachBookingRequestRecords(transaction),
    );
    const ownRequests = clientPage.items.filter(
      (request) => request.slotId === slotId,
    );
    assert.equal(ownRequests.length, 1);
    assert.match(
      ownRequests[0]!.coachPortraitUrl ?? "",
      new RegExp(
        `/storage/v1/object/public/coach-portraits/${coachActor.profileId}/${coachPortraitObjectId}[.]webp[?]v=`,
      ),
    );
    assert.equal("clientDisplayName" in ownRequests[0]!, false);
    assert.equal("clientProfileId" in ownRequests[0]!, false);
    if (actor.profileId === firstClientActor.profileId) {
      assert.equal(
        new Date(ownRequests[0]!.decisionDeadlineAt).getTime() -
          new Date(ownRequests[0]!.createdAt).getTime(),
        12 * 60 * 60 * 1000,
      );
    }
  }
  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      currentOwnedCoachBookingRequestRecords(transaction, { pageSize: 51 }),
    ),
    CoachBookingRequestConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      transaction.execute(sql`
        select id
        from app.coach_booking_requests
        where slot_id = ${slotId}::uuid
      `),
    ),
  );
});

test("late requests use the occurrence start as their decision deadline", async () => {
  const slotId = await createSlot(8);
  const request = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, slotId),
  );
  const page = await withActorDatabaseContext(firstClientActor, (transaction) =>
    currentClientCoachBookingRequestRecords(transaction),
  );
  const projection = page.items.find(
    (candidate) => candidate.id === request.requestId,
  );
  assert.ok(projection);
  assert.equal(projection.decisionDeadlineAt, projection.scheduledStartAt);
});

test("exact and displayed-slot client projections remain actor-owned", async () => {
  const firstSlotId = await createSlot(31);
  const secondSlotId = await createSlot(33);
  const [firstRequest, secondRequest] = await Promise.all([
    withActorDatabaseContext(firstClientActor, (transaction) =>
      createCoachBookingRequestRecord(transaction, firstSlotId),
    ),
    withActorDatabaseContext(firstClientActor, (transaction) =>
      createCoachBookingRequestRecord(transaction, secondSlotId),
    ),
    withActorDatabaseContext(secondClientActor, (transaction) =>
      createCoachBookingRequestRecord(transaction, firstSlotId),
    ),
  ]);

  const selected = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      currentClientPendingCoachBookingRequestRecords(transaction, [
        firstSlotId,
        secondSlotId,
      ]),
  );
  assert.deepEqual(
    new Set(selected.map((request) => request.id)),
    new Set([firstRequest.requestId, secondRequest.requestId]),
  );
  assert.ok(
    selected.every(
      (request) =>
        !("clientProfileId" in request) &&
        !("clientDisplayName" in request) &&
        new RegExp(
          `/storage/v1/object/public/coach-portraits/${coachActor.profileId}/${coachPortraitObjectId}[.]webp[?]v=`,
        ).test(request.coachPortraitUrl ?? ""),
    ),
  );

  const exact = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      currentClientCoachBookingRequestRecord(
        transaction,
        firstRequest.requestId,
      ),
  );
  assert.equal(exact?.id, firstRequest.requestId);
  assert.match(
    exact?.coachPortraitUrl ?? "",
    new RegExp(
      `/storage/v1/object/public/coach-portraits/${coachActor.profileId}/${coachPortraitObjectId}[.]webp[?]v=`,
    ),
  );
  assert.equal(
    await withActorDatabaseContext(secondClientActor, (transaction) =>
      currentClientCoachBookingRequestRecord(
        transaction,
        firstRequest.requestId,
      ),
    ),
    null,
  );

  await admin`
    update app.coach_booking_requests
    set
      created_at = statement_timestamp() - interval '13 hours',
      decision_deadline_at = statement_timestamp() - interval '1 minute'
    where id = ${firstRequest.requestId}::uuid
  `;
  const expired = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      currentClientCoachBookingRequestRecord(
        transaction,
        firstRequest.requestId,
      ),
  );
  assert.equal(expired?.status, "expired");
  const remaining = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      currentClientPendingCoachBookingRequestRecords(transaction, [
        firstSlotId,
        secondSlotId,
      ]),
  );
  assert.deepEqual(
    remaining.map((request) => request.id),
    [secondRequest.requestId],
  );

  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      currentClientPendingCoachBookingRequestRecords(transaction, []),
    ),
    CoachBookingRequestConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      currentClientPendingCoachBookingRequestRecords(transaction, [
        firstSlotId,
        firstSlotId,
      ]),
    ),
    CoachBookingRequestConflictError,
  );
});

test("withdrawal and decline permit a new eligible attempt", async () => {
  const slotId = await createSlot(32);
  const first = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, slotId),
  );
  await assert.rejects(
    withActorDatabaseContext(secondClientActor, (transaction) =>
      withdrawCoachBookingRequestRecord(transaction, first.requestId),
    ),
    CoachBookingRequestConflictError,
  );
  const withdrawn = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      withdrawCoachBookingRequestRecord(transaction, first.requestId),
  );
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(
    (
      await withActorDatabaseContext(firstClientActor, (transaction) =>
        withdrawCoachBookingRequestRecord(transaction, first.requestId),
      )
    ).status,
    "withdrawn",
  );

  const second = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, slotId),
  );
  assert.notEqual(second.requestId, first.requestId);
  await assert.rejects(
    withActorDatabaseContext(secondClientActor, (transaction) =>
      declineCoachBookingRequestRecord(transaction, second.requestId),
    ),
    CoachBookingRequestConflictError,
  );
  const declined = await withActorDatabaseContext(coachActor, (transaction) =>
    declineCoachBookingRequestRecord(transaction, second.requestId),
  );
  assert.equal(declined.status, "declined");

  const third = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, slotId),
  );
  assert.notEqual(third.requestId, second.requestId);
  assert.equal(third.status, "pending");
});

test("concurrent acceptance creates one booking and closes other requests", async () => {
  const slotId = await createSlot(34);
  const requestActors = [
    firstClientActor,
    secondClientActor,
    additionalClientActors[0]!,
  ];
  const requests = await Promise.all(
    requestActors.map((actor) =>
      withActorDatabaseContext(actor, (transaction) =>
        createCoachBookingRequestRecord(transaction, slotId),
      ),
    ),
  );
  const results = await Promise.all([
    withActorDatabaseContext(coachActor, (transaction) =>
      acceptCoachBookingRequestRecord(transaction, requests[0]!.requestId),
    ),
    withActorDatabaseContext(coachActor, (transaction) =>
      acceptCoachBookingRequestRecord(transaction, requests[1]!.requestId),
    ),
  ]);
  assert.equal(
    results.filter((result) => result.status === "accepted").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "not-selected").length,
    1,
  );

  const [bookingCount] = await admin<{ count: number }[]>`
    select count(*)::integer as count
    from app.coach_private_bookings
    where slot_id = ${slotId}::uuid
      and status = 'confirmed'
  `;
  assert.equal(bookingCount?.count, 1);
  const requestRows = await admin<
    { id: string; status: string; accepted_booking_id: string | null }[]
  >`
    select id, status, accepted_booking_id
    from app.coach_booking_requests
    where slot_id = ${slotId}::uuid
    order by id
  `;
  assert.equal(
    requestRows.filter((request) => request.status === "accepted").length,
    1,
  );
  assert.equal(
    requestRows.filter((request) => request.status === "not-selected").length,
    2,
  );
  const accepted = requestRows.find((request) => request.status === "accepted");
  assert.ok(accepted?.accepted_booking_id);

  const acceptedIndex = requests.findIndex(
    (request) => request.requestId === accepted.id,
  );
  assert.notEqual(acceptedIndex, -1);
  await withActorDatabaseContext(requestActors[acceptedIndex]!, (transaction) =>
    cancelDirectPrivateBookingRecord(
      transaction,
      accepted.accepted_booking_id!,
    ),
  );
  const [reopened] = await admin<{ status: string }[]>`
    select status from app.coach_availability_slots where id = ${slotId}::uuid
  `;
  assert.equal(reopened?.status, "open");
  const retryActor = requestActors.find(
    (_actor, index) => index !== acceptedIndex,
  )!;
  const retried = await withActorDatabaseContext(retryActor, (transaction) =>
    createCoachBookingRequestRecord(transaction, slotId),
  );
  assert.equal(retried.status, "pending");
});

test("participant reads reconcile elapsed request deadlines", async () => {
  const slotId = await createSlot(36);
  const request = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, slotId),
  );
  await admin`
    update app.coach_booking_requests
    set
      created_at = statement_timestamp() - interval '13 hours',
      decision_deadline_at = statement_timestamp() - interval '1 minute'
    where id = ${request.requestId}::uuid
  `;
  const page = await withActorDatabaseContext(firstClientActor, (transaction) =>
    currentClientCoachBookingRequestRecords(transaction),
  );
  assert.equal(
    page.items.find((candidate) => candidate.id === request.requestId)?.status,
    "expired",
  );
  const retried = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, slotId),
  );
  assert.notEqual(retried.requestId, request.requestId);
});

test("coach occurrence closure is atomic, authorized and idempotent", async () => {
  const slotId = await createSlot(38);
  const requests = await Promise.all(
    [firstClientActor, secondClientActor].map((actor) =>
      withActorDatabaseContext(actor, (transaction) =>
        createCoachBookingRequestRecord(transaction, slotId),
      ),
    ),
  );
  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      closeCoachBookingRequestOccurrenceRecord(transaction, slotId),
    ),
    CoachBookingRequestConflictError,
  );
  assert.equal(
    await withActorDatabaseContext(coachActor, (transaction) =>
      closeCoachBookingRequestOccurrenceRecord(transaction, slotId),
    ),
    "withdrawn",
  );
  assert.equal(
    await withActorDatabaseContext(coachActor, (transaction) =>
      closeCoachBookingRequestOccurrenceRecord(transaction, slotId),
    ),
    "withdrawn",
  );
  const rows = await admin<{ id: string; status: string }[]>`
    select id, status
    from app.coach_booking_requests
    where slot_id = ${slotId}::uuid
  `;
  assert.equal(rows.length, requests.length);
  assert.ok(rows.every((request) => request.status === "occurrence-closed"));
  await assert.rejects(
    withActorDatabaseContext(additionalClientActors[0]!, (transaction) =>
      createCoachBookingRequestRecord(transaction, slotId),
    ),
    CoachBookingRequestConflictError,
  );
});

test("failed acceptance rolls back request and occurrence mutations", async () => {
  const slotId = await createSlot(40);
  const request = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, slotId),
  );
  await admin.begin(async (transaction) => {
    await transaction`
      select set_config('app.coach_booking_management', 'on', true)
    `;
    const [slot] = await transaction<{ starts_at: Date; ends_at: Date }[]>`
      select starts_at, ends_at
      from app.coach_availability_slots
      where id = ${slotId}::uuid
      for update
    `;
    assert.ok(slot);
    await transaction`
      insert into app.coach_private_bookings (
        id,
        run_id,
        slot_id,
        coach_profile_id,
        client_profile_id,
        credit_projection_id,
        status,
        scheduled_start_at,
        scheduled_end_at,
        early_return_until,
        hold_expires_at
      ) values (
        ${randomUUID()}::uuid,
        ${coachActor.runId}::uuid,
        ${slotId}::uuid,
        ${coachActor.profileId}::uuid,
        ${secondClientActor.profileId}::uuid,
        null,
        'confirmed',
        ${slot.starts_at},
        ${slot.ends_at},
        ${slot.starts_at},
        ${slot.starts_at}
      )
    `;
  });
  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      acceptCoachBookingRequestRecord(transaction, request.requestId),
    ),
    CoachBookingRequestConflictError,
  );
  const [state] = await admin<
    { request_status: string; slot_status: string }[]
  >`
    select
      request.status as request_status,
      slot.status as slot_status
    from app.coach_booking_requests as request
    join app.coach_availability_slots as slot on slot.id = request.slot_id
    where request.id = ${request.requestId}::uuid
  `;
  assert.deepEqual(state, {
    request_status: "pending",
    slot_status: "open",
  });
});

test("confirmed-booking history and avatar privacy remain intact", async () => {
  const slotId = await createSlot(2);
  const beforeBookingDirectory = await bookingCoachDirectoryEntry();
  const bookingId = await createConfirmedBooking(slotId);
  const bookings = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      currentClientPrivateBookingRecords(transaction, firstClientActor),
  );
  const booking = bookings.find((candidate) => candidate.id === bookingId);
  assert.ok(booking);
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.cancelledBy, null);
  assert.equal(booking.clientAvatarUrl, null);
  assert.match(
    booking.coachPortraitUrl ?? "",
    new RegExp(
      `/storage/v1/object/public/coach-portraits/${coachActor.profileId}/${coachPortraitObjectId}[.]webp[?]v=`,
    ),
  );
  assert.equal("creditProjectionId" in booking, false);
  const coachBookings = await withActorDatabaseContext(
    coachActor,
    (transaction) => currentCoachPrivateBookingRecords(transaction, coachActor),
  );
  const coachBooking = coachBookings.find(
    (candidate) => candidate.id === bookingId,
  );
  assert.match(
    coachBooking?.clientAvatarUrl ?? "",
    new RegExp(`^/api/coach/bookings/${bookingId}/client-avatar[?]v=`),
  );
  const avatarReference = await withActorDatabaseContext(
    coachActor,
    (transaction) =>
      confirmedBookingClientAvatarReference(transaction, bookingId),
  );
  assert.equal(
    avatarReference?.path,
    `${firstClientActor.profileId}/${firstClientAvatarObjectId}.webp`,
  );
  assert.ok(avatarReference?.updatedAt);
  assert.equal(
    await withActorDatabaseContext(firstClientActor, (transaction) =>
      confirmedBookingClientAvatarReference(transaction, bookingId),
    ),
    null,
  );
  assert.equal(
    await withActorDatabaseContext(secondClientActor, (transaction) =>
      confirmedBookingClientAvatarReference(transaction, bookingId),
    ),
    null,
  );
  const [slot] = await admin<{ status: string }[]>`
    select status from app.coach_availability_slots where id = ${slotId}::uuid
  `;
  assert.equal(slot?.status, "booked");
  const bookedDirectory = await bookingCoachDirectoryEntry();
  assert.equal(
    bookedDirectory.todaySlots.some((candidate) => candidate.id === slotId),
    false,
  );

  const accountPath = `${firstClientActor.profileId}/${firstClientAvatarObjectId}.webp`;
  async function storageVisibility() {
    let coachCount = -1;
    let unrelatedCount = -1;
    await assert.rejects(
      admin.begin(async (transaction) => {
        await transaction`set local role authenticated`;
        await transaction`
          select set_config(
            'request.jwt.claim.sub',
            ${firstClientAuthUserId},
            true
          )
        `;
        await transaction`
          insert into storage.objects (bucket_id, name)
          values ('account-avatars', ${accountPath})
        `;
        await transaction`
          select set_config('request.jwt.claim.sub', ${coachAuthUserId}, true)
        `;
        const [coachResult] = await transaction<{ count: number }[]>`
          select count(*)::integer as count
          from storage.objects
          where bucket_id = 'account-avatars'
            and name = ${accountPath}
        `;
        coachCount = coachResult?.count ?? 0;
        await transaction`
          select set_config(
            'request.jwt.claim.sub',
            ${secondClientAuthUserId},
            true
          )
        `;
        const [unrelatedResult] = await transaction<{ count: number }[]>`
          select count(*)::integer as count
          from storage.objects
          where bucket_id = 'account-avatars'
            and name = ${accountPath}
        `;
        unrelatedCount = unrelatedResult?.count ?? 0;
        throw new Error("roll back booking avatar policy fixture");
      }),
      /roll back booking avatar policy fixture/,
    );
    return { coachCount, unrelatedCount };
  }

  assert.deepEqual(await storageVisibility(), {
    coachCount: 1,
    unrelatedCount: 0,
  });
  await withActorDatabaseContext(firstClientActor, (transaction) =>
    cancelDirectPrivateBookingRecord(transaction, bookingId),
  );
  const cancelledDirectory = await bookingCoachDirectoryEntry();
  assert.equal(
    cancelledDirectory.todaySlots.some((candidate) => candidate.id === slotId),
    beforeBookingDirectory.todaySlots.some(
      (candidate) => candidate.id === slotId,
    ),
  );
  assert.equal(
    cancelledDirectory.primaryLocation.id,
    beforeBookingDirectory.primaryLocation.id,
  );
  // The booking-scoped reference is revoked below. This coach still owns a
  // retained booking-request attempt from the same client, so the independent
  // request-history policy continues to authorize the current Storage object.
  assert.deepEqual(await storageVisibility(), {
    coachCount: 1,
    unrelatedCount: 0,
  });
  assert.equal(
    await withActorDatabaseContext(coachActor, (transaction) =>
      confirmedBookingClientAvatarReference(transaction, bookingId),
    ),
    null,
  );
});

test("self, hidden, missing and malformed occurrences fail closed", async () => {
  const selfSlotId = await createSlot(4);
  assert.equal(
    (
      await withActorDatabaseContext(coachActor, (transaction) =>
        coachBookingRequestEligibilityRecord(transaction, selfSlotId),
      )
    ).eligibility,
    "unavailable",
  );
  const hiddenSlotId = await createSlot(6);
  await admin`
    update app.coach_profiles set visibility = 'hidden'
    where run_id = ${coachActor.runId}::uuid and profile_id = ${coachActor.profileId}::uuid
  `;
  try {
    assert.equal(
      (
        await withActorDatabaseContext(firstClientActor, (transaction) =>
          coachBookingRequestEligibilityRecord(transaction, hiddenSlotId),
        )
      ).eligibility,
      "unavailable",
    );
  } finally {
    await admin`
      update app.coach_profiles set visibility = 'visible'
      where run_id = ${coachActor.runId}::uuid and profile_id = ${coachActor.profileId}::uuid
    `;
  }
  assert.equal(
    (
      await withActorDatabaseContext(firstClientActor, (transaction) =>
        coachBookingRequestEligibilityRecord(transaction, randomUUID()),
      )
    ).eligibility,
    "unavailable",
  );
  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      coachBookingRequestEligibilityRecord(transaction, "not-a-slot"),
    ),
    CoachBookingConflictError,
  );
});

test("stale direct-booking calls cannot bypass coach confirmation", async () => {
  const slotId = await createSlot(26);
  const attempts = await Promise.allSettled([
    attemptDisabledDirectBooking(firstClientActor, slotId),
    attemptDisabledDirectBooking(secondClientActor, slotId),
  ]);
  assert.equal(
    attempts.filter((attempt) => attempt.status === "fulfilled").length,
    0,
  );
  assert.equal(
    attempts.filter((attempt) => attempt.status === "rejected").length,
    2,
  );
  for (const attempt of attempts) {
    assert.equal(attempt.status, "rejected");
  }
  const [bookingCount] = await admin<{ count: number }[]>`
    select count(*)::integer as count
    from app.coach_private_bookings
    where slot_id = ${slotId}::uuid
  `;
  assert.equal(bookingCount?.count, 0);
});

test("client and coach cancellation are authorized, terminal and reopen the slot", async () => {
  const clientSlotId = await createSlot(10);
  const clientBookingId = await createConfirmedBooking(clientSlotId);
  await assert.rejects(
    withActorDatabaseContext(secondClientActor, (transaction) =>
      cancelDirectPrivateBookingRecord(transaction, clientBookingId),
    ),
    CoachBookingConflictError,
  );
  const cancelledId = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      cancelDirectPrivateBookingRecord(transaction, clientBookingId),
  );
  assert.equal(cancelledId, clientBookingId);
  assert.equal(
    await withActorDatabaseContext(firstClientActor, (transaction) =>
      cancelDirectPrivateBookingRecord(transaction, clientBookingId),
    ),
    clientBookingId,
  );
  const clientBookings = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      currentClientPrivateBookingRecords(transaction, firstClientActor),
  );
  const clientCancelled = clientBookings.find(
    (booking) => booking.id === clientBookingId,
  );
  assert.equal(clientCancelled?.status, "cancelled");
  assert.equal(clientCancelled?.cancelledBy, "client");
  const [reopened] = await admin<{ status: string }[]>`
    select status from app.coach_availability_slots where id = ${clientSlotId}::uuid
  `;
  assert.equal(reopened?.status, "open");

  const coachSlotId = await createSlot(12);
  const coachBookingId = await createConfirmedBooking(coachSlotId);
  await withActorDatabaseContext(coachActor, (transaction) =>
    cancelDirectPrivateBookingRecord(transaction, coachBookingId),
  );
  const coachBookings = await withActorDatabaseContext(
    coachActor,
    (transaction) => currentCoachPrivateBookingRecords(transaction, coachActor),
  );
  const coachCancelled = coachBookings.find(
    (booking) => booking.id === coachBookingId,
  );
  assert.equal(coachCancelled?.status, "cancelled");
  assert.equal(coachCancelled?.cancelledBy, "coach");
});

test("only the owning coach completes an elapsed confirmed booking", async () => {
  const slotId = await createSlot(14);
  const bookingId = await createConfirmedBooking(slotId);
  await assert.rejects(
    withActorDatabaseContext(firstClientActor, (transaction) =>
      completeDirectPrivateBookingRecord(transaction, bookingId),
    ),
    CoachBookingConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      completeDirectPrivateBookingRecord(transaction, bookingId),
    ),
    CoachBookingConflictError,
  );
  await admin`
    update app.coach_private_bookings
    set
      created_at = statement_timestamp() - interval '3 hours',
      scheduled_start_at = statement_timestamp() - interval '2 hours',
      scheduled_end_at = statement_timestamp() - interval '1 hour',
      early_return_until = statement_timestamp() - interval '2 hours',
      hold_expires_at = statement_timestamp() - interval '119 minutes'
    where id = ${bookingId}::uuid
  `;
  assert.equal(
    await withActorDatabaseContext(coachActor, (transaction) =>
      completeDirectPrivateBookingRecord(transaction, bookingId),
    ),
    bookingId,
  );
  assert.equal(
    await withActorDatabaseContext(coachActor, (transaction) =>
      completeDirectPrivateBookingRecord(transaction, bookingId),
    ),
    bookingId,
  );
  const coachBookings = await withActorDatabaseContext(
    coachActor,
    (transaction) => currentCoachPrivateBookingRecords(transaction, coachActor),
  );
  const completed = coachBookings.find((booking) => booking.id === bookingId);
  assert.equal(completed?.status, "completed");
  assert.ok(completed?.completedAt);
});

test("suspension blocks new activity but preserves safe resolution of existing sessions", async () => {
  const bookedSlotId = await createSlot(16);
  const openSlotId = await createSlot(18);
  const bookingId = await createConfirmedBooking(bookedSlotId);
  const pendingRequest = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => createCoachBookingRequestRecord(transaction, openSlotId),
  );

  const [suspended] = await admin<{ status: string }[]>`
    select app.review_coach_application(
      ${coachActor.profileId}::uuid,
      'approved',
      'suspended',
      'Coach access paused during a platform review.',
      'database-test',
      'movx-identity-application-v1'
    ) as status
  `;
  assert.equal(suspended?.status, "suspended");
  const [profile] = await admin<{ visibility: string }[]>`
    select visibility
    from app.coach_profiles
    where profile_id = ${coachActor.profileId}::uuid
  `;
  assert.equal(profile?.visibility, "hidden");
  const [closedRequest] = await admin<{ status: string }[]>`
    select status
    from app.coach_booking_requests
    where id = ${pendingRequest.requestId}::uuid
  `;
  assert.equal(closedRequest?.status, "occurrence-closed");

  await assert.rejects(createSlot(20), CoachAvailabilityConflictError);
  assert.equal(
    (
      await withActorDatabaseContext(secondClientActor, (transaction) =>
        coachBookingRequestEligibilityRecord(transaction, openSlotId),
      )
    ).eligibility,
    "unavailable",
  );
  const coachBookings = await withActorDatabaseContext(
    coachActor,
    (transaction) => currentCoachPrivateBookingRecords(transaction, coachActor),
  );
  assert.ok(coachBookings.some((booking) => booking.id === bookingId));
  assert.equal(
    await withActorDatabaseContext(coachActor, (transaction) =>
      cancelDirectPrivateBookingRecord(transaction, bookingId),
    ),
    bookingId,
  );
  assert.deepEqual(
    await withActorDatabaseContext(coachActor, (transaction) =>
      currentClientPrivateBookingRecords(transaction, coachActor),
    ),
    [],
  );
});
