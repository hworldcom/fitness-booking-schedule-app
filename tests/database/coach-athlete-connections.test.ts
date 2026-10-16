import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { before, after } from "node:test";
import postgres from "postgres";
import { localDateTimeValue } from "@/domain/coaches";
import type {
  ConnectionCursor,
  ConnectionHistoryReference,
} from "@/domain/coach-athlete-connections";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import {
  ActorContextRejectedError,
  withActorDatabaseContext,
} from "@/server/db/authorization/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import { createOwnedCoachAvailabilityRecord } from "@/server/db/coaches/availability-repository";
import {
  cancelDirectPrivateBookingRecord,
  completeDirectPrivateBookingRecord,
  currentCoachPrivateBookingRecords,
  currentClientPrivateBookingRecords,
} from "@/server/db/coaches/booking-repository";
import {
  acceptCoachBookingRequestRecord,
  createCoachBookingRequestRecord,
  declineCoachBookingRequestRecord,
  closeCoachBookingRequestOccurrenceRecord,
  withdrawCoachBookingRequestRecord,
} from "@/server/db/coaches/booking-request-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  bookingConnectionContextRecord,
  ConnectionConflictError,
  connectionAvatarReference,
  connectionHistoryRecord,
  connectionPageRecord,
  decideConnectionRecord,
  sendConnectionRecord,
} from "@/server/db/connections/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  bookingRequestClientAvatarReference,
  confirmedBookingClientAvatarReference,
  setCurrentAccountAvatarReference,
} from "@/server/db/profile-images/repository";

const url = process.env.DATABASE_TEST_URL;
if (!url)
  throw new Error(
    "DATABASE_TEST_URL is required for database integration tests.",
  );
const runtimeUrl = new URL(url);
runtimeUrl.username = "repx_runtime_login";
runtimeUrl.password = "postgres";
process.env.DATABASE_URL = runtimeUrl.toString();
const admin = postgres(url, {
  max: 2,
  prepare: false,
  ssl: false,
  onnotice: () => {},
});
const runtime = postgres(runtimeUrl.toString(), {
  max: 1,
  prepare: false,
  ssl: false,
});
const authIds = Array.from(
  { length: 20 },
  (_, i) => `9a221000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
const isolatedRun = "9a221000-0000-4000-8000-000000000901";
let coach: AuthorizedActor, reverseCoach: AuthorizedActor;
const athletes: AuthorizedActor[] = [];
let hours = 2;
const work = <T>(
  actor: AuthorizedActor,
  fn: Parameters<typeof withActorDatabaseContext<T>>[1],
) => withActorDatabaseContext(actor, fn);
const decide = (
  actor: AuthorizedActor,
  id: string,
  action: "accept" | "decline" | "withdraw" | "disconnect",
) => work(actor, (tx) => decideConnectionRecord(tx, id, action));
const context = (actor: AuthorizedActor, id: string) =>
  work(actor, (tx) => bookingConnectionContextRecord(tx, id));
async function send(
  actor: AuthorizedActor,
  bookingId: string,
  operationId: string = randomUUID(),
  expected?: string | null,
) {
  const prior =
    expected === undefined
      ? ((await context(actor, bookingId)).connection?.id ?? null)
      : expected;
  return work(actor, (tx) =>
    sendConnectionRecord(tx, bookingId, operationId, prior),
  );
}
async function slot(owner = coach) {
  const target = Math.ceil((Date.now() + hours * 3600000) / 900000) * 900000;
  hours += 2;
  return work(owner, (tx) =>
    createOwnedCoachAvailabilityRecord(tx, {
      localStart: localDateTimeValue(new Date(target), "Europe/Berlin"),
      durationMinutes: 60,
      refreshLocation: false,
    }),
  );
}
async function request(athlete: AuthorizedActor, slotId: string) {
  return work(athlete, (tx) => createCoachBookingRequestRecord(tx, slotId));
}
async function booking(
  athlete: AuthorizedActor,
  owner = coach,
  legacy = false,
) {
  const slotId = await slot(owner);
  if (!legacy) {
    const pending = await request(athlete, slotId);
    const accepted = await work(owner, (tx) =>
      acceptCoachBookingRequestRecord(tx, pending.requestId),
    );
    assert.ok(accepted.bookingId);
    return { id: accepted.bookingId, requestId: pending.requestId, slotId };
  }
  const id = randomUUID();
  await admin.begin(async (tx) => {
    const [s] =
      await tx`select * from app.coach_availability_slots where id=${slotId}::uuid for update`;
    await tx`insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,credit_projection_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at)
      values (${id}::uuid,${owner.runId}::uuid,${slotId}::uuid,${owner.profileId}::uuid,${athlete.profileId}::uuid,null,'confirmed',${s.starts_at},${s.ends_at},${s.starts_at},${s.starts_at})`;
    await tx`update app.coach_availability_slots set status='booked' where id=${slotId}::uuid`;
  });
  return { id, requestId: null, slotId };
}
async function elapsed(id: string, owner = coach) {
  await admin`update app.coach_private_bookings set created_at=statement_timestamp()-interval '3 hours',scheduled_start_at=statement_timestamp()-interval '2 hours',scheduled_end_at=statement_timestamp()-interval '1 hour',early_return_until=statement_timestamp()-interval '2 hours',hold_expires_at=statement_timestamp()-interval '119 minutes' where id=${id}::uuid`;
  await work(owner, (tx) => completeDirectPrivateBookingRecord(tx, id));
}
async function collect(actor: AuthorizedActor, pairId: string) {
  const items: ConnectionHistoryReference[] = [];
  let cursor: ConnectionCursor | null = null;
  for (let n = 0; n < 100; n++) {
    const page = await work(actor, (tx) =>
      connectionHistoryRecord(tx, pairId, { pageSize: 5, cursor }),
    );
    items.push(...page.items);
    if (!page.nextCursor) return items;
    cursor = page.nextCursor;
  }
  throw new Error("History cursor failed to terminate.");
}
async function cleanup() {
  const people = await admin<
    { id: string }[]
  >`select id from app.profiles where auth_user_id in ${admin(authIds)}`;
  const ids = people.map((p) => p.id);
  if (ids.length) {
    await admin`update app.coach_profiles set visibility='hidden' where profile_id in ${admin(ids)} and visibility='visible'`;
    if (
      (await admin`select to_regclass('app.message_conversations') present`)[0]
        .present
    ) {
      await admin`delete from app.message_blocks where low_profile_id in ${admin(ids)} or high_profile_id in ${admin(ids)}`;
      await admin`delete from app.message_conversations where coach_profile_id in ${admin(ids)} or athlete_profile_id in ${admin(ids)}`;
    }
    await admin`delete from app.coach_athlete_connection_attempts where pair_id in (select id from app.coach_athlete_connection_pairs where coach_profile_id in ${admin(ids)} or athlete_profile_id in ${admin(ids)})`;
    await admin`delete from app.coach_athlete_connection_pairs where coach_profile_id in ${admin(ids)} or athlete_profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_booking_requests where coach_profile_id in ${admin(ids)} or client_profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_private_bookings where coach_profile_id in ${admin(ids)} or client_profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_availability_slots where profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_availability_rules where profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_training_locations where profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_profile_disciplines where profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_profiles where profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_application_review_events where profile_id in ${admin(ids)}`;
    await admin`delete from app.coach_applications where profile_id in ${admin(ids)}`;
    await admin`delete from app.demo_run_participants where profile_id in ${admin(ids)}`;
    await admin`delete from app.profiles where id in ${admin(ids)}`;
  }
  await admin`delete from app.demo_runs where id=${isolatedRun}::uuid`;
  await admin`delete from auth.users where id in ${admin(authIds)}`;
}
before(async () => {
  await cleanup();
  const actors = [];
  for (const [i, authUserId] of authIds.entries()) {
    await admin`insert into auth.users(id,is_sso_user,is_anonymous) values (${authUserId}::uuid,false,false)`;
    const record = await enrollApplicationProfile(
      authUserId,
      `Connection Person ${i + 1}`,
    );
    assert.ok(record);
    actors.push(
      Object.freeze({
        authUserId,
        profileId: record.profileId,
        runId: record.runId,
        runRole: "member" as const,
      }),
    );
  }
  [coach, reverseCoach] = actors;
  athletes.push(...actors.slice(2));
  for (const owner of [coach, reverseCoach]) {
    await work(owner, submitOwnedCoachApplicationRecord);
    await work(owner, (tx) =>
      upsertOwnedCoachProfileRecord(tx, {
        displayName:
          owner === coach ? "Connection Coach" : "Reverse Connection Coach",
        bio: "Private boxing coaching with deliberate practice and careful session preparation for each athlete.",
        disciplines: ["Boxing"],
        timezone: "Europe/Berlin",
        visibility: "hidden",
        selectedGymId: "40000000-0000-4000-8000-000000000001",
        independentLocation: null,
      }),
    );
    await admin`select app.review_coach_application(${owner.profileId}::uuid,'pending','approved','Connection test reviewed complete coach profile.','database-test','movx-identity-application-v1')`;
    await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
  }
});
after(async () => {
  try {
    await cleanup();
  } finally {
    await runtime.end();
    await admin.end();
  }
});

test("raw tables and internal helper functions cannot bypass consent", async () => {
  await assert.rejects(
    runtime`select * from app.coach_athlete_connection_attempts`,
    /permission denied/,
  );
  await assert.rejects(
    runtime`select app.connection_access_flags(true)`,
    /permission denied/,
  );
  await assert.rejects(
    admin`insert into app.coach_athlete_connection_pairs(run_id,coach_profile_id,athlete_profile_id) values (${coach.runId}::uuid,${coach.profileId}::uuid,${coach.profileId}::uuid)`,
    /check constraint/,
  );
});
test("either direction requires recipient acceptance and exact retries retain the attempt", async () => {
  const b = await booking(athletes[0]);
  await admin`update app.coach_profiles set visibility='hidden' where profile_id=${coach.profileId}::uuid`;
  const pending = await send(coach, b.id);
  assert.equal(pending.coachPublic, false);
  await admin`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
  assert.equal(pending.status, "pending");
  assert.equal(pending.canAccept, false);
  assert.equal(pending.canWithdraw, true);
  await assert.rejects(
    decide(coach, pending.id, "accept"),
    ConnectionConflictError,
  );
  await assert.rejects(
    decide(athletes[1], pending.id, "accept"),
    ConnectionConflictError,
  );
  assert.equal((await context(coach, b.id)).connection?.coachPublic, true);
  const rollback = new Error("Roll back private dataset projection check");
  await assert.rejects(
    admin.begin(async (tx) => {
      await tx`update app.demo_runs set catalogue_visibility='private' where id=${coach.runId}::uuid`;
      await tx`set local role app_runtime`;
      await tx`select set_config('app.current_auth_user_id',${coach.authUserId},true),set_config('app.current_profile_id',${coach.profileId},true),set_config('app.current_run_id',${coach.runId},true),set_config('app.current_run_role',${coach.runRole},true)`;
      await tx`select app.current_booking_connection_context(${b.id}::uuid)`;
      throw rollback;
    }),
    (error) =>
      error instanceof Error &&
      error.message === "connection context is invalid",
  );
  assert.equal((await context(coach, b.id)).connection?.coachPublic, true);
  const incoming = await work(athletes[0], (tx) =>
    connectionPageRecord(tx, "athlete", "incoming"),
  );
  assert.equal(incoming.items[0].id, pending.id);
  assert.equal(incoming.items[0].canAccept, true);
  const accepted = await decide(athletes[0], pending.id, "accept");
  assert.equal(accepted.status, "accepted");
  assert.deepEqual(await decide(athletes[0], pending.id, "accept"), accepted);
  await work(athletes[0], (tx) => cancelDirectPrivateBookingRecord(tx, b.id));
  assert.equal((await context(coach, b.id)).connection?.status, "accepted");
  const other = await booking(athletes[1]);
  const athleteSend = await send(athletes[1], other.id);
  assert.equal(athleteSend.recipientProfileId, coach.profileId);
  assert.equal(
    (await decide(coach, athleteSend.id, "accept")).status,
    "accepted",
  );
});
test("pending-only, cancelled-only, unrelated, spoofed and cross-dataset contexts fail closed", async () => {
  const open = await slot();
  const pending = await request(athletes[2], open);
  await assert.rejects(
    send(athletes[2], pending.requestId),
    ConnectionConflictError,
  );
  const b = await booking(athletes[2]);
  await work(athletes[2], (tx) => cancelDirectPrivateBookingRecord(tx, b.id));
  assert.equal((await context(athletes[2], b.id)).canSend, false);
  await assert.rejects(send(athletes[2], b.id), ConnectionConflictError);
  await assert.rejects(context(athletes[3], b.id), ConnectionConflictError);
  await assert.rejects(
    work({ ...coach, authUserId: athletes[3].authUserId }, (tx) =>
      bookingConnectionContextRecord(tx, b.id),
    ),
    ActorContextRejectedError,
  );
  await admin`insert into app.demo_runs(id,slug,name,status,catalogue_visibility,schedule_anchor_date,starts_at,ends_at) values (${isolatedRun}::uuid,'dev0221-isolated','Connection isolated dataset','active','private',current_date,now(),now()+interval '28 days')`;
  await admin`insert into app.demo_run_participants(run_id,profile_id,role,status,joined_at) values (${isolatedRun}::uuid,${coach.profileId}::uuid,'member','active',now())`;
  await assert.rejects(
    work({ ...coach, runId: isolatedRun }, (tx) =>
      bookingConnectionContextRecord(tx, b.id),
    ),
    ActorContextRejectedError,
  );
});
test("concurrent crossed sends require consent and stale send operations cannot reconnect", async () => {
  const b = await booking(athletes[3]);
  const ids = [randomUUID(), randomUUID()];
  const results = await Promise.all([
    send(coach, b.id, ids[0], null),
    send(athletes[3], b.id, ids[1], null),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(results[0].status, "pending");
  const sender =
    results[0].senderProfileId === coach.profileId ? coach : athletes[3];
  const recipient = sender === coach ? athletes[3] : coach;
  const declined = await decide(recipient, results[0].id, "decline");
  assert.deepEqual(await decide(recipient, results[0].id, "decline"), declined);
  assert.equal(
    (await send(sender, b.id, declined.id, null)).status,
    "declined",
  );
  const unused = ids.find((id) => id !== declined.id)!;
  await assert.rejects(
    send(recipient, b.id, unused, null),
    ConnectionConflictError,
  );
  const next = await send(recipient, b.id, randomUUID(), declined.id);
  assert.notEqual(next.id, declined.id);
  assert.equal(next.attemptNumber, 2);
  assert.equal(next.pairId, declined.pairId);
  await assert.rejects(
    decide(sender, declined.id, "accept"),
    ConnectionConflictError,
  );
  await assert.rejects(
    decide(sender, next.id, "withdraw"),
    ConnectionConflictError,
  );
  assert.equal(
    (await decide(recipient, next.id, "withdraw")).status,
    "withdrawn",
  );
});
test("concurrent duplicate acceptance and conflicting decisions have one authoritative outcome", async () => {
  const b = await booking(athletes[4]);
  const pending = await send(coach, b.id);
  const accepted = await Promise.all([
    decide(athletes[4], pending.id, "accept"),
    decide(athletes[4], pending.id, "accept"),
  ]);
  assert.deepEqual(accepted[0], accepted[1]);
  const other = await booking(athletes[5]);
  const another = await send(coach, other.id);
  const race = await Promise.allSettled([
    decide(athletes[5], another.id, "accept"),
    decide(athletes[5], another.id, "decline"),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(race.filter((r) => r.status === "rejected").length, 1);
});
function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function waitBlocked(name: string) {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    const rows =
      await admin`select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like ${"%" + name + "%"}`;
    if (rows.length) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Expected database lock wait for " + name);
}
test("acceptance first locks eligibility; later cancellation preserves the accepted connection", async () => {
  const b = await booking(athletes[6]);
  const pending = await send(coach, b.id);
  const reached = barrier(),
    release = barrier();
  const accept = work(athletes[6], async (tx) => {
    const r = await decideConnectionRecord(tx, pending.id, "accept");
    reached.release();
    await release.promise;
    return r;
  });
  await reached.promise;
  const cancel = work(athletes[6], (tx) =>
    cancelDirectPrivateBookingRecord(tx, b.id),
  );
  try {
    await waitBlocked("cancel_direct_private_booking");
  } finally {
    release.release();
  }
  assert.equal((await accept).status, "accepted");
  await cancel;
  assert.equal((await context(coach, b.id)).connection?.status, "accepted");
});
test("cancellation first makes pending acceptance ineligible after the lock wait", async () => {
  const b = await booking(athletes[7]);
  const pending = await send(coach, b.id);
  const reached = barrier(),
    release = barrier();
  const cancel = work(athletes[7], async (tx) => {
    await cancelDirectPrivateBookingRecord(tx, b.id);
    reached.release();
    await release.promise;
  });
  await reached.promise;
  const accept = decide(athletes[7], pending.id, "accept");
  const rejected = assert.rejects(accept, ConnectionConflictError);
  try {
    await waitBlocked("decide_coach_athlete_connection");
  } finally {
    release.release();
  }
  await cancel;
  await rejected;
  assert.equal((await context(coach, b.id)).connection?.status, "pending");
  assert.equal((await context(coach, b.id)).connection?.canAccept, false);
  await decide(athletes[7], pending.id, "decline");
});
test("complete retained history survives repeated either-side disconnection and reconnection", async () => {
  const athlete = athletes[8],
    b = await booking(athlete);
  const wanted = new Set([b.requestId!]);
  const historySlot = await slot();
  for (let n = 0; n < 24; n++) {
    const r = await request(athlete, historySlot);
    wanted.add(r.requestId);
    if (n % 2)
      await work(athlete, (tx) =>
        withdrawCoachBookingRequestRecord(tx, r.requestId),
      );
    else
      await work(coach, (tx) =>
        declineCoachBookingRequestRecord(tx, r.requestId),
      );
  }
  const expired = await request(athlete, historySlot);
  wanted.add(expired.requestId);
  await admin`update app.coach_booking_requests set created_at=statement_timestamp()-interval '13 hours',decision_deadline_at=statement_timestamp()-interval '1 hour' where id=${expired.requestId}::uuid`;
  const closedSlot = await slot();
  const closed = await request(athlete, closedSlot);
  wanted.add(closed.requestId);
  await work(coach, (tx) =>
    closeCoachBookingRequestOccurrenceRecord(tx, closedSlot),
  );
  await admin`update app.coach_booking_requests
    set created_at=date_trunc('second',statement_timestamp())-interval '2 minutes'+interval '123456 microseconds',
      decision_deadline_at=least(scheduled_start_at,date_trunc('second',statement_timestamp())-interval '2 minutes'+interval '123456 microseconds'+interval '12 hours')
    where coach_profile_id=${coach.profileId}::uuid and client_profile_id=${athlete.profileId}::uuid and status in ('declined','withdrawn')`;
  const loser = await request(athlete, historySlot);
  wanted.add(loser.requestId);
  const competitor = await request(athletes[9], historySlot);
  const selected = await work(coach, (tx) =>
    acceptCoachBookingRequestRecord(tx, competitor.requestId),
  );
  const cancelled = await booking(athlete);
  wanted.add(cancelled.requestId!);
  await work(athlete, (tx) =>
    cancelDirectPrivateBookingRecord(tx, cancelled.id),
  );
  const legacy = await booking(athlete, coach, true);
  wanted.add(legacy.id);
  await elapsed(legacy.id);
  let attempt = await send(coach, b.id);
  attempt = await decide(athlete, attempt.id, "accept");
  const original = await collect(coach, attempt.pairId);
  assert.equal(original.length, wanted.size);
  assert.deepEqual(new Set(original.map((r) => r.id)), wanted);
  assert.equal(original.filter((r) => r.bookingId === b.id).length, 1);
  assert.equal(
    original.some(
      (r) =>
        r.bookingId === selected.bookingId ||
        r.requestId === competitor.requestId,
    ),
    false,
  );
  assert.ok(original.some((r) => r.requestStatus === "not-selected"));
  assert.ok(original.some((r) => r.requestStatus === "expired"));
  assert.ok(original.some((r) => r.requestStatus === "occurrence-closed"));
  assert.ok(original.some((r) => r.bookingStatus === "cancelled"));
  for (const disconnector of [athlete, coach]) {
    const removed = await decide(disconnector, attempt.id, "disconnect");
    assert.equal(
      (await decide(disconnector, attempt.id, "disconnect")).status,
      "removed",
    );
    await assert.rejects(
      work(athlete, (tx) => connectionHistoryRecord(tx, attempt.pairId)),
      ConnectionConflictError,
    );
    const pending = await send(disconnector, b.id, randomUUID(), removed.id);
    const recipient = disconnector === coach ? athlete : coach;
    attempt = await decide(recipient, pending.id, "accept");
    assert.deepEqual(await collect(athlete, attempt.pairId), original);
  }
  await assert.rejects(
    work(athletes[9], (tx) => connectionHistoryRecord(tx, attempt.pairId)),
    ConnectionConflictError,
  );
});
test("private avatars require accepted coach scope and removal preserves independent permissions", async () => {
  const athlete = athletes[10],
    b = await booking(athlete, coach, true);
  await elapsed(b.id);
  const objectId = randomUUID(),
    path = `${athlete.profileId}/${objectId}.webp`;
  await work(athlete, (tx) => setCurrentAccountAvatarReference(tx, path, null));
  const pending = await send(athlete, b.id);
  assert.equal(
    await work(coach, (tx) => connectionAvatarReference(tx, pending.id)),
    null,
  );
  const accepted = await decide(coach, pending.id, "accept");
  const upcoming = await booking(athlete, coach, true);
  const expectedHref = `/coach/athletes/${accepted.pairId}`;
  const shared = await work(coach, (tx) =>
    currentCoachPrivateBookingRecords(tx, coach, accepted.pairId),
  );
  assert.deepEqual(
    new Set(shared.map((row) => row.id)),
    new Set([b.id, upcoming.id]),
  );
  assert.deepEqual(
    new Set(shared.map((row) => row.status)),
    new Set(["confirmed", "completed"]),
  );
  assert.equal(new Set(shared.map((row) => row.clientAvatarUrl)).size, 1);
  assert.ok(
    shared.every(
      (row) =>
        row.clientAvatarUrl === accepted.athleteAvatarUrl &&
        row.athleteProfileHref === expectedHref,
    ),
  );
  assert.equal(
    (
      await work(athletes[11], (tx) =>
        currentCoachPrivateBookingRecords(tx, athletes[11], accepted.pairId),
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await work(athlete, (tx) =>
        currentCoachPrivateBookingRecords(tx, athlete, accepted.pairId),
      )
    ).length,
    0,
  );
  const ownSessions = await work(athlete, (tx) =>
    currentClientPrivateBookingRecords(tx, athlete),
  );
  assert.ok(
    ownSessions.every(
      (row) => row.athleteProfileHref === null && row.clientAvatarUrl === null,
    ),
  );
  await work(coach, (tx) => cancelDirectPrivateBookingRecord(tx, upcoming.id));
  assert.equal(
    (await work(coach, (tx) => connectionAvatarReference(tx, accepted.id)))
      ?.path,
    path,
  );
  assert.equal(
    await work(athlete, (tx) => connectionAvatarReference(tx, accepted.id)),
    null,
  );
  assert.equal(
    await work(athletes[11], (tx) =>
      connectionAvatarReference(tx, accepted.id),
    ),
    null,
  );
  assert.equal(
    accepted.athleteAvatarUrl?.startsWith(
      `/api/connections/${accepted.id}/athlete-avatar?v=`,
    ),
    true,
  );
  assert.equal(JSON.stringify(accepted).includes(path), false);
  async function storageCount(authId: string) {
    let count = -1;
    await assert.rejects(
      admin.begin(async (tx) => {
        await tx`insert into storage.objects(bucket_id,name) values ('account-avatars',${path})`;
        await tx`set local role authenticated`;
        await tx`select set_config('request.jwt.claim.sub',${authId},true)`;
        const [r] =
          await tx`select count(*)::int as n from storage.objects where bucket_id='account-avatars' and name=${path}`;
        count = r.n;
        throw new Error("rollback connection Storage fixture");
      }),
      /rollback connection Storage fixture/,
    );
    return count;
  }
  assert.equal(await storageCount(coach.authUserId), 1);
  assert.equal(await storageCount(athletes[11].authUserId), 0);
  await decide(athlete, accepted.id, "disconnect");
  assert.equal(
    (
      await work(coach, (tx) =>
        currentCoachPrivateBookingRecords(tx, coach, accepted.pairId),
      )
    ).length,
    0,
  );
  const disconnected = await work(coach, (tx) =>
    currentCoachPrivateBookingRecords(tx, coach),
  );
  assert.ok(
    disconnected
      .filter((row) => [b.id, upcoming.id].includes(row.id))
      .every(
        (row) =>
          row.athleteProfileHref === null && row.clientAvatarUrl === null,
      ),
  );
  assert.equal(
    await work(coach, (tx) => connectionAvatarReference(tx, accepted.id)),
    null,
  );
  assert.equal(await storageCount(coach.authUserId), 0);
  const independent = await booking(athlete, coach, true);
  const independentRows = await work(coach, (tx) =>
    currentCoachPrivateBookingRecords(tx, coach),
  );
  assert.ok(
    independentRows
      .find((row) => row.id === independent.id)
      ?.clientAvatarUrl?.startsWith(
        `/api/coach/bookings/${independent.id}/client-avatar`,
      ),
  );
  assert.equal(
    (
      await work(coach, (tx) =>
        confirmedBookingClientAvatarReference(tx, independent.id),
      )
    )?.path,
    path,
  );
  assert.equal(await storageCount(coach.authUserId), 1);
  const open = await slot();
  const r = await request(athlete, open);
  await work(coach, (tx) => declineCoachBookingRequestRecord(tx, r.requestId));
  assert.equal(
    (
      await work(coach, (tx) =>
        bookingRequestClientAvatarReference(tx, r.requestId),
      )
    )?.path,
    path,
  );
  assert.equal(
    await work(coach, (tx) => connectionAvatarReference(tx, accepted.id)),
    null,
  );
});
test("connection-list cursors traverse all accepted rows without repeats or counterpart leakage", async () => {
  const ids = [];
  let cursor: ConnectionCursor | null = null;
  do {
    const page = await work(coach, (tx) =>
      connectionPageRecord(tx, "coach", "accepted", { pageSize: 2, cursor }),
    );
    assert.ok(
      page.items.every(
        (item) =>
          item.coachProfileId === coach.profileId && item.status === "accepted",
      ),
    );
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor;
  } while (cursor);
  const whole = await work(coach, (tx) =>
    connectionPageRecord(tx, "coach", "accepted", { pageSize: 50 }),
  );
  assert.ok(ids.length > 2);
  assert.deepEqual(
    ids,
    whole.items.map((item) => item.id),
  );
  assert.equal(new Set(ids).size, ids.length);
  const unrelated = await work(athletes[17], (tx) =>
    connectionPageRecord(tx, "athlete", "accepted"),
  );
  assert.deepEqual(unrelated.items, []);
  assert.equal(unrelated.nextCursor, null);
});
test("two coach accounts retain distinct directed teaching pairs and athlete capability", async () => {
  const forward = await booking(reverseCoach),
    reverse = await booking(coach, reverseCoach);
  const first = await send(coach, forward.id);
  const second = await send(reverseCoach, reverse.id);
  await decide(reverseCoach, first.id, "accept");
  await decide(coach, second.id, "accept");
  assert.notEqual(first.pairId, second.pairId);
  const asCoach = await work(coach, (tx) =>
    connectionPageRecord(tx, "coach", "accepted"),
  );
  const asAthlete = await work(coach, (tx) =>
    connectionPageRecord(tx, "athlete", "accepted"),
  );
  assert.equal(
    asCoach.items.some((c) => c.id === first.id),
    true,
  );
  assert.equal(
    asCoach.items.some((c) => c.id === second.id),
    false,
  );
  assert.deepEqual(
    asAthlete.items.map((c) => c.id),
    [second.id],
  );
});
test("suspension blocks new consent while existing reads and safe resolutions survive", async () => {
  const b = await booking(athletes[12], reverseCoach),
    other = await booking(athletes[13], reverseCoach);
  const connected = await send(reverseCoach, b.id);
  await decide(athletes[12], connected.id, "accept");
  const pending = await send(athletes[13], other.id);
  await admin`select app.review_coach_application(${reverseCoach.profileId}::uuid,'approved','suspended','Connection test suspends authority.','database-test','movx-identity-application-v1')`;
  assert.equal(
    (await context(athletes[13], other.id)).connection?.canAccept,
    false,
  );
  await assert.rejects(
    decide(reverseCoach, pending.id, "accept"),
    ConnectionConflictError,
  );
  await decide(reverseCoach, pending.id, "decline");
  await assert.rejects(send(reverseCoach, other.id), ConnectionConflictError);
  assert.ok(
    (
      await work(reverseCoach, (tx) =>
        connectionPageRecord(tx, "coach", "accepted"),
      )
    ).items.some((r) => r.id === connected.id),
  );
  await decide(reverseCoach, connected.id, "disconnect");
});
