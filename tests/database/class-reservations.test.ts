import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after, before } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import postgres from "postgres";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { closeDatabaseConnection } from "@/server/db/client";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  completeVerifiedMembershipActivationRecord,
  prepareMembershipActivationRecord,
  recordMembershipActivationSubmission,
} from "@/server/db/membership/repository";
import {
  cancelMemberClassReservationRecord,
  currentMemberClassScheduleRecords,
  reserveMemberClassRecord,
} from "@/server/db/reservations/repository";
import {
  completePersonalWalletChallengeRecord,
  issuePersonalWalletChallengeRecord,
  personalWalletChallengeClock,
} from "@/server/db/wallet/repository";

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
const firstActivationId = "99000000-0000-4000-8000-000000000101";
const secondActivationId = "99000000-0000-4000-8000-000000000102";
const firstReserveId = "99000000-0000-4000-8000-000000000201";
const conflictingReserveId = "99000000-0000-4000-8000-000000000202";
const replacementReserveId = "99000000-0000-4000-8000-000000000203";
const nonCoreReserveId = "99000000-0000-4000-8000-000000000204";
const firstAllowanceReserveId = "99000000-0000-4000-8000-000000000205";
const secondAllowanceReserveId = "99000000-0000-4000-8000-000000000206";
const sessionCancelledReserveId = "99000000-0000-4000-8000-000000000207";
const noShowReserveId = "99000000-0000-4000-8000-000000000208";
const firstCapacityReserveId = "99000000-0000-4000-8000-000000000301";
const secondCapacityReserveId = "99000000-0000-4000-8000-000000000302";
const firstWallet = (await generateKeyPairSigner()).address;
const secondWallet = (await generateKeyPairSigner()).address;
const destinationWallet = "ComputeBudget111111111111111111111111111111";
const mintAddress = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const tokenProgramAddress = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const basicGyms = [
  "northside-combat",
  "fabrik",
  "vela",
  "groundline-mma",
] as const;

const admin = postgres(adminConnectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});
const runtimeA = postgres(runtimeUrl.toString(), {
  max: 1,
  prepare: false,
  ssl: false,
});
const runtimeB = postgres(runtimeUrl.toString(), {
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

function hashHex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function removeFixtures() {
  await admin.begin(async (transaction) => {
    await transaction`
      delete from app.class_reservations
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (
          ${firstAuthUserId}::uuid,
          ${secondAuthUserId}::uuid
        )
      )
    `;
    await transaction`
      delete from app.membership_daily_access_claims
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (
          ${firstAuthUserId}::uuid,
          ${secondAuthUserId}::uuid
        )
      )
    `;
    await transaction`
      delete from app.membership_period_core_gyms
      where membership_period_id in (
        select period.id
        from app.membership_periods period
        join app.profiles profile on profile.id = period.profile_id
        where profile.auth_user_id in (
          ${firstAuthUserId}::uuid,
          ${secondAuthUserId}::uuid
        )
      )
    `;
    await transaction`
      delete from app.membership_periods
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (
          ${firstAuthUserId}::uuid,
          ${secondAuthUserId}::uuid
        )
      )
    `;
    await transaction`
      delete from app.membership_activation_operation_gyms
      where operation_id in (
        select operation.id
        from app.membership_activation_operations operation
        join app.profiles profile on profile.id = operation.profile_id
        where profile.auth_user_id in (
          ${firstAuthUserId}::uuid,
          ${secondAuthUserId}::uuid
        )
      )
    `;
    await transaction`
      delete from app.membership_activation_operations
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (
          ${firstAuthUserId}::uuid,
          ${secondAuthUserId}::uuid
        )
      )
    `;
    await transaction`
      delete from app.wallet_bindings
      where bound_by_auth_user_id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    `;
    await transaction`
      delete from app.auth_challenges
      where auth_user_id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    `;
    await transaction`
      delete from app.demo_run_participants
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (
          ${firstAuthUserId}::uuid,
          ${secondAuthUserId}::uuid
        )
      )
    `;
    await transaction`
      delete from app.profiles
      where auth_user_id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    `;
    await transaction`
      delete from auth.users
      where id in (
        ${firstAuthUserId}::uuid,
        ${secondAuthUserId}::uuid
      )
    `;
  });
}

async function linkWallet(
  actor: AuthorizedActor,
  walletAddress: string,
  marker: string,
) {
  await withActorDatabaseContext(actor, async (transaction) => {
    const clock = await personalWalletChallengeClock(transaction);
    const messageHashHex = hashHex(`reservation-message:${marker}`);
    await issuePersonalWalletChallengeRecord(transaction, {
      id: clock.id,
      purpose: "link-personal-wallet",
      address: walletAddress,
      origin: "http://localhost:3100",
      nonceHashHex: hashHex(`reservation-nonce:${marker}`),
      messageHashHex,
      issuedAt: clock.issuedAt,
      expiresAt: new Date(
        new Date(clock.issuedAt).getTime() + 5 * 60 * 1_000,
      ).toISOString(),
    });
    const result = await completePersonalWalletChallengeRecord(transaction, {
      id: clock.id,
      purpose: "link-personal-wallet",
      address: walletAddress,
      messageHashHex,
      reauthenticatedAt: null,
    });
    assert.equal(result.result, "linked");
  });
}

async function activateMembership(
  actor: AuthorizedActor,
  operationId: string,
  walletAddress: string,
  marker: string,
  signatureMarker: string,
) {
  await withActorDatabaseContext(actor, async (transaction) => {
    assert.equal(
      await prepareMembershipActivationRecord(transaction, {
        operationId,
        planId: "basic",
        gymIds: basicGyms,
        referenceAddress: marker.repeat(44),
        destinationAddress: destinationWallet,
        mintAddress,
        tokenProgramAddress,
        tokenDecimals: 6,
      }),
      "prepared",
    );
    assert.equal(
      await recordMembershipActivationSubmission(transaction, {
        operationId,
        transactionSignature: signatureMarker.repeat(88),
      }),
      "submitted",
    );
    const completed = await completeVerifiedMembershipActivationRecord(
      transaction,
      {
        operationId,
        walletAddress,
        destinationAddress: destinationWallet,
        mintAddress,
        tokenProgramAddress,
        tokenDecimals: 6,
        referenceAddress: marker.repeat(44),
        transactionSignature: signatureMarker.repeat(88),
        confirmedSlot: "700000001",
        amountBaseUnits: "80000000",
      },
    );
    assert.equal(completed.result, "confirmed");
    assert.ok(completed.membershipPeriodId);
  });
}

async function directReserve(
  connection: typeof runtimeA,
  actor: AuthorizedActor,
  operationId: string,
  classSessionId: string,
) {
  return connection.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.current_auth_user_id', ${actor.authUserId}, true),
        set_config('app.current_profile_id', ${actor.profileId}, true),
        set_config('app.current_run_id', ${actor.runId}, true),
        set_config('app.current_run_role', ${actor.runRole}, true)
    `;
    const rows = await transaction<
      Array<{ reservation_result: string; reservation_id: string | null }>
    >`
      select * from app.reserve_member_class(
        ${operationId}::uuid,
        ${classSessionId}::uuid
      )
    `;
    return rows[0]!;
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
    "Reservation One",
  );
  const second = await enrollApplicationProfile(
    secondAuthUserId,
    "Reservation Two",
  );
  assert.ok(first);
  assert.ok(second);
  firstActor = actorFromRecord(firstAuthUserId, first);
  secondActor = actorFromRecord(secondAuthUserId, second);
  await linkWallet(firstActor, firstWallet, "first");
  await linkWallet(secondActor, secondWallet, "second");
  await activateMembership(
    firstActor,
    firstActivationId,
    firstWallet,
    "A",
    "7",
  );
  await activateMembership(
    secondActor,
    secondActivationId,
    secondWallet,
    "B",
    "9",
  );
});

after(async () => {
  await closeDatabaseConnection();
  await runtimeA.end();
  await runtimeB.end();
  await removeFixtures();
  await admin.end();
});

test("reservation tables are private and schedules expose only frozen core gyms", async () => {
  for (const table of [
    "membership_daily_access_claims",
    "class_reservations",
  ]) {
    await assert.rejects(
      runtimeA.unsafe(`select * from app.${table}`),
      /permission denied for table/,
    );
  }

  const schedule = await withActorDatabaseContext(
    firstActor,
    currentMemberClassScheduleRecords,
  );
  assert.ok(schedule.length > 0);
  assert.deepEqual(
    new Set(schedule.map((session) => session.venueSlug)),
    new Set(basicGyms),
  );
  assert.ok(schedule.every((session) => session.bookingStatus === "available"));
});

test("reservation retries, daily conflicts and cancellation preserve one held use", async () => {
  const initial = await withActorDatabaseContext(
    firstActor,
    currentMemberClassScheduleRecords,
  );
  const sameDay = Map.groupBy(initial, (session) => session.serviceDate);
  const pair = [...sameDay.values()].find(
    (sessions) =>
      sessions.length > 1 &&
      sessions.every((session) => session.bookingStatus === "available"),
  );
  assert.ok(pair && pair.length > 1);
  const firstSession = pair[0]!;
  const secondSession = pair[1]!;

  const reserved = await withActorDatabaseContext(firstActor, (transaction) =>
    reserveMemberClassRecord(transaction, {
      operationId: firstReserveId,
      classSessionId: firstSession.classSessionId,
    }),
  );
  assert.equal(reserved.result, "reserved");
  assert.ok(reserved.reservationId);
  assert.deepEqual(
    await withActorDatabaseContext(firstActor, (transaction) =>
      reserveMemberClassRecord(transaction, {
        operationId: firstReserveId,
        classSessionId: firstSession.classSessionId,
      }),
    ),
    { result: "existing", reservationId: reserved.reservationId },
  );
  assert.equal(
    (
      await withActorDatabaseContext(firstActor, (transaction) =>
        reserveMemberClassRecord(transaction, {
          operationId: conflictingReserveId,
          classSessionId: secondSession.classSessionId,
        }),
      )
    ).result,
    "daily-conflict",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      cancelMemberClassReservationRecord(transaction, reserved.reservationId!),
    ),
    "not-found",
  );
  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      cancelMemberClassReservationRecord(transaction, reserved.reservationId!),
    ),
    "cancelled",
  );
  assert.equal(
    (
      await withActorDatabaseContext(firstActor, (transaction) =>
        reserveMemberClassRecord(transaction, {
          operationId: replacementReserveId,
          classSessionId: secondSession.classSessionId,
        }),
      )
    ).result,
    "reserved",
  );

  const claims = await admin<Array<{ claim_status: string; count: number }>>`
    select claim_status, count(*)::integer as count
    from app.membership_daily_access_claims
    where profile_id = ${firstActor.profileId}::uuid
      and service_date = ${firstSession.serviceDate}::date
    group by claim_status
    order by claim_status
  `;
  assert.deepEqual(
    claims.map((claim) => ({ ...claim })),
    [
      { claim_status: "held", count: 1 },
      { claim_status: "released", count: 1 },
    ],
  );
});

test("non-core sessions fail and concurrent final Basic-use attempts create one hold", async () => {
  const nonCore = await admin<Array<{ id: string }>>`
    select session.id::text
    from app.class_sessions as session
    join app.venues as venue
      on venue.run_id = session.run_id
      and venue.id = session.venue_id
    where session.run_id = ${firstActor.runId}::uuid
      and venue.slug not in (
        'northside-combat',
        'fabrik',
        'vela',
        'groundline-mma'
      )
      and session.status = 'scheduled'
      and session.starts_at > statement_timestamp()
    order by session.starts_at
    limit 1
  `;
  assert.ok(nonCore[0]);
  assert.equal(
    (await directReserve(runtimeA, firstActor, nonCoreReserveId, nonCore[0].id))
      .reservation_result,
    "class-unavailable",
  );

  const schedule = await withActorDatabaseContext(
    secondActor,
    currentMemberClassScheduleRecords,
  );
  const candidates = schedule.filter(
    (session, index, sessions) =>
      session.bookingStatus === "available" &&
      sessions.findIndex(
        (candidate) => candidate.serviceDate === session.serviceDate,
      ) === index,
  );
  assert.ok(candidates.length >= 2);

  await admin`
    update app.membership_periods
    set included_checkins_used = 9
    where run_id = ${secondActor.runId}::uuid
      and profile_id = ${secondActor.profileId}::uuid
      and membership_status = 'active'
  `;
  try {
    const results = await Promise.all([
      directReserve(
        runtimeA,
        secondActor,
        firstAllowanceReserveId,
        candidates[0]!.classSessionId,
      ),
      directReserve(
        runtimeB,
        secondActor,
        secondAllowanceReserveId,
        candidates[1]!.classSessionId,
      ),
    ]);
    assert.deepEqual(
      new Set(results.map((result) => result.reservation_result)),
      new Set(["reserved", "allowance-exhausted"]),
    );
    const successful = results.find(
      (result) => result.reservation_result === "reserved",
    );
    assert.ok(successful?.reservation_id);
    assert.equal(
      await withActorDatabaseContext(secondActor, (transaction) =>
        cancelMemberClassReservationRecord(
          transaction,
          successful.reservation_id!,
        ),
      ),
      "cancelled",
    );
  } finally {
    await admin`
      update app.membership_periods
      set included_checkins_used = 0,
          last_included_service_date = null
      where run_id = ${secondActor.runId}::uuid
        and profile_id = ${secondActor.profileId}::uuid
        and membership_status = 'active'
    `;
  }
});

test("session cancellation and class end reconcile terminal reservations without attendance", async () => {
  const schedule = await withActorDatabaseContext(
    secondActor,
    currentMemberClassScheduleRecords,
  );
  const candidates = schedule.filter(
    (session) => session.bookingStatus === "available",
  );
  assert.ok(candidates.length >= 2);
  const cancelledSession = candidates[0]!;
  const noShowSession = candidates.find(
    (candidate) => candidate.serviceDate !== cancelledSession.serviceDate,
  );
  assert.ok(noShowSession);

  const sessionCancelled = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      reserveMemberClassRecord(transaction, {
        operationId: sessionCancelledReserveId,
        classSessionId: cancelledSession.classSessionId,
      }),
  );
  assert.equal(sessionCancelled.result, "reserved");
  await admin`
    update app.class_sessions
    set status = 'cancelled'
    where id = ${cancelledSession.classSessionId}::uuid
  `;
  try {
    const reconciled = await withActorDatabaseContext(
      secondActor,
      currentMemberClassScheduleRecords,
    );
    assert.equal(
      reconciled.find(
        (session) => session.classSessionId === cancelledSession.classSessionId,
      )?.bookingStatus,
      "session-cancelled",
    );
  } finally {
    await admin`
      update app.class_sessions
      set status = 'scheduled'
      where id = ${cancelledSession.classSessionId}::uuid
    `;
  }

  const noShow = await withActorDatabaseContext(secondActor, (transaction) =>
    reserveMemberClassRecord(transaction, {
      operationId: noShowReserveId,
      classSessionId: noShowSession.classSessionId,
    }),
  );
  assert.equal(noShow.result, "reserved");
  assert.ok(noShow.reservationId);
  const originalTime = await admin<
    Array<{ starts_at: string; ends_at: string }>
  >`
    select starts_at::text, ends_at::text
    from app.class_sessions
    where id = ${noShowSession.classSessionId}::uuid
  `;
  assert.ok(originalTime[0]);
  await admin`
    update app.class_sessions as session
    set
      starts_at = period.starts_at + interval '1 millisecond',
      ends_at = period.starts_at + interval '2 milliseconds'
    from app.membership_periods as period
    where session.id = ${noShowSession.classSessionId}::uuid
      and period.run_id = ${secondActor.runId}::uuid
      and period.profile_id = ${secondActor.profileId}::uuid
      and period.membership_status = 'active'
  `;
  try {
    const reconciled = await withActorDatabaseContext(
      secondActor,
      currentMemberClassScheduleRecords,
    );
    assert.equal(
      reconciled.find(
        (session) => session.classSessionId === noShowSession.classSessionId,
      )?.bookingStatus,
      "no-show",
    );
    const terminal = await admin<
      Array<{
        access_claim_id: string;
        reservation_status: string;
        claim_status: string;
      }>
    >`
      select
        reservation.access_claim_id::text,
        reservation.reservation_status,
        claim.claim_status
      from app.class_reservations as reservation
      join app.membership_daily_access_claims as claim
        on claim.id = reservation.access_claim_id
      where reservation.id = ${noShow.reservationId}::uuid
    `;
    assert.deepEqual(
      { ...terminal[0] },
      {
        access_claim_id: terminal[0]!.access_claim_id,
        reservation_status: "no_show",
        claim_status: "released",
      },
    );
    await assert.rejects(
      admin`
        update app.class_reservations
        set reservation_status = 'reserved',
            no_show_at = null
        where id = ${noShow.reservationId}::uuid
      `,
      /class reservation transition is invalid/,
    );
    await assert.rejects(
      admin`
        update app.membership_daily_access_claims
        set claim_status = 'held',
            released_at = null
        where id = ${terminal[0]!.access_claim_id}::uuid
      `,
      /daily access claim transition is invalid/,
    );
  } finally {
    await admin`
      update app.class_sessions
      set starts_at = ${originalTime[0].starts_at}::timestamptz,
          ends_at = ${originalTime[0].ends_at}::timestamptz
      where id = ${noShowSession.classSessionId}::uuid
    `;
  }
});

test("concurrent final-seat attempts create one reservation and one claim", async () => {
  const firstSchedule = await withActorDatabaseContext(
    firstActor,
    currentMemberClassScheduleRecords,
  );
  const secondSchedule = await withActorDatabaseContext(
    secondActor,
    currentMemberClassScheduleRecords,
  );
  const firstHeldDates = new Set(
    firstSchedule
      .filter((session) => session.bookingStatus === "reserved")
      .map((session) => session.serviceDate),
  );
  const target = firstSchedule.find(
    (session) =>
      session.bookingStatus === "available" &&
      !firstHeldDates.has(session.serviceDate) &&
      secondSchedule.some(
        (candidate) =>
          candidate.classSessionId === session.classSessionId &&
          candidate.bookingStatus === "available",
      ),
  );
  assert.ok(target);

  const original = await admin<Array<{ capacity: number }>>`
    select capacity
    from app.class_sessions
    where id = ${target.classSessionId}::uuid
  `;
  assert.ok(original[0]);
  await admin`
    update app.class_sessions
    set capacity = 1
    where id = ${target.classSessionId}::uuid
  `;

  const results = await Promise.all([
    directReserve(
      runtimeA,
      firstActor,
      firstCapacityReserveId,
      target.classSessionId,
    ),
    directReserve(
      runtimeB,
      secondActor,
      secondCapacityReserveId,
      target.classSessionId,
    ),
  ]);
  assert.deepEqual(
    new Set(results.map((result) => result.reservation_result)),
    new Set(["reserved", "full"]),
  );

  const persisted = await admin<
    Array<{ reservation_count: number; claim_count: number }>
  >`
    select
      count(distinct reservation.id)::integer as reservation_count,
      count(distinct claim.id)::integer as claim_count
    from app.class_reservations as reservation
    join app.membership_daily_access_claims as claim
      on claim.id = reservation.access_claim_id
    where reservation.class_session_id = ${target.classSessionId}::uuid
      and reservation.reservation_status = 'reserved'
  `;
  assert.deepEqual(
    { ...persisted[0] },
    {
      reservation_count: 1,
      claim_count: 1,
    },
  );

  await admin`
    update app.class_sessions
    set capacity = ${original[0].capacity}
    where id = ${target.classSessionId}::uuid
  `;
});
