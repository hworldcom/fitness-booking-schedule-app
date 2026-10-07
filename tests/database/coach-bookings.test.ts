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
import { activateOwnedCoachingRecord } from "@/server/db/coaches/activation-repository";
import { createOwnedCoachAvailabilityRecord } from "@/server/db/coaches/availability-repository";
import {
  bookDirectPrivateSessionRecord,
  cancelDirectPrivateBookingRecord,
  CoachBookingConflictError,
  completeDirectPrivateBookingRecord,
  currentClientPrivateBookingRecords,
  currentCoachPrivateBookingRecords,
} from "@/server/db/coaches/booking-repository";
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

const coachAuthUserId = "98000000-0000-4000-8000-000000000001";
const firstClientAuthUserId = "98000000-0000-4000-8000-000000000002";
const secondClientAuthUserId = "98000000-0000-4000-8000-000000000003";
const fixtureGymId = "40000000-0000-4000-8000-000000000001";

const admin = postgres(adminConnectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});

let coachActor: AuthorizedActor;
let firstClientActor: AuthorizedActor;
let secondClientActor: AuthorizedActor;

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

async function removeFixtures() {
  const authIds = [
    coachAuthUserId,
    firstClientAuthUserId,
    secondClientAuthUserId,
  ];
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
  await withActorDatabaseContext(coachActor, activateOwnedCoachingRecord);
  await withActorDatabaseContext(coachActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, coachProfile),
  );
});

after(async () => {
  await removeFixtures();
  await admin.end();
});

test("direct booking is idempotent for one client and capacity one", async () => {
  const slotId = await createSlot(2);
  const bookingId = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => bookDirectPrivateSessionRecord(transaction, slotId),
  );
  const repeatedId = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => bookDirectPrivateSessionRecord(transaction, slotId),
  );
  assert.equal(repeatedId, bookingId);
  await assert.rejects(
    withActorDatabaseContext(secondClientActor, (transaction) =>
      bookDirectPrivateSessionRecord(transaction, slotId),
    ),
    CoachBookingConflictError,
  );
  const bookings = await withActorDatabaseContext(
    firstClientActor,
    (transaction) =>
      currentClientPrivateBookingRecords(transaction, firstClientActor),
  );
  const booking = bookings.find((candidate) => candidate.id === bookingId);
  assert.ok(booking);
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.cancelledBy, null);
  assert.equal("creditProjectionId" in booking, false);
  const [slot] = await admin<{ status: string }[]>`
    select status from app.coach_availability_slots where id = ${slotId}::uuid
  `;
  assert.equal(slot?.status, "booked");
});

test("invalid actors and hidden coaches cannot create bookings", async () => {
  const selfSlotId = await createSlot(4);
  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      bookDirectPrivateSessionRecord(transaction, selfSlotId),
    ),
    CoachBookingConflictError,
  );
  const hiddenSlotId = await createSlot(6);
  await admin`
    update app.coach_profiles set visibility = 'hidden'
    where run_id = ${coachActor.runId}::uuid and profile_id = ${coachActor.profileId}::uuid
  `;
  try {
    await assert.rejects(
      withActorDatabaseContext(firstClientActor, (transaction) =>
        bookDirectPrivateSessionRecord(transaction, hiddenSlotId),
      ),
      CoachBookingConflictError,
    );
  } finally {
    await admin`
      update app.coach_profiles set visibility = 'visible'
      where run_id = ${coachActor.runId}::uuid and profile_id = ${coachActor.profileId}::uuid
    `;
  }
});

test("concurrent clients produce exactly one confirmed booking", async () => {
  const slotId = await createSlot(8);
  const attempts = await Promise.allSettled([
    withActorDatabaseContext(firstClientActor, (transaction) =>
      bookDirectPrivateSessionRecord(transaction, slotId),
    ),
    withActorDatabaseContext(secondClientActor, (transaction) =>
      bookDirectPrivateSessionRecord(transaction, slotId),
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
  assert.ok(rejected && rejected.reason instanceof CoachBookingConflictError);
});

test("client and coach cancellation are authorized, terminal and reopen the slot", async () => {
  const clientSlotId = await createSlot(10);
  const clientBookingId = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => bookDirectPrivateSessionRecord(transaction, clientSlotId),
  );
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
  const coachBookingId = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => bookDirectPrivateSessionRecord(transaction, coachSlotId),
  );
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
  const bookingId = await withActorDatabaseContext(
    firstClientActor,
    (transaction) => bookDirectPrivateSessionRecord(transaction, slotId),
  );
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
