import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after, before } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import postgres from "postgres";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import {
  cancelMemberArrivalRequestRecord,
  confirmMemberArrivalRecord,
  createMemberArrivalRequestRecord,
  currentMemberCheckinSnapshotRecord,
} from "@/server/db/checkins/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  completeVerifiedMembershipActivationRecord,
  prepareMembershipActivationRecord,
  recordMembershipActivationSubmission,
} from "@/server/db/membership/repository";
import {
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

const firstAuthUserId = "99100000-0000-4000-8000-000000000001";
const secondAuthUserId = "99100000-0000-4000-8000-000000000002";
const staffAuthUserId = "99100000-0000-4000-8000-000000000003";
const firstActivationId = "99100000-0000-4000-8000-000000000101";
const secondActivationId = "99100000-0000-4000-8000-000000000102";
const classReserveId = "99100000-0000-4000-8000-000000000201";
const futureReserveId = "99100000-0000-4000-8000-000000000202";
const classArrivalId = "99100000-0000-4000-8000-000000000301";
const classConflictArrivalId = "99100000-0000-4000-8000-000000000302";
const wrongVenueArrivalId = "99100000-0000-4000-8000-000000000303";
const cancelledArrivalId = "99100000-0000-4000-8000-000000000304";
const confirmedOpenGymArrivalId = "99100000-0000-4000-8000-000000000305";
const classicDailyConflictArrivalId = "99100000-0000-4000-8000-000000000306";
const expiredOpenGymArrivalId = "99100000-0000-4000-8000-000000000307";
const expiredOpenGymRequestId = "99100000-0000-4000-8000-000000000402";
const expiredOpenGymClaimId = "99100000-0000-4000-8000-000000000403";
const firstWallet = (await generateKeyPairSigner()).address;
const secondWallet = (await generateKeyPairSigner()).address;
const destinationWallet = "ComputeBudget111111111111111111111111111111";
const mintAddress = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const tokenProgramAddress = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const northsideVenueId = "40000000-0000-4000-8000-000000000001";
const fabrikVenueId = "40000000-0000-4000-8000-000000000002";
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

let firstActor: AuthorizedActor;
let secondActor: AuthorizedActor;
let staffActor: AuthorizedActor;

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
    const authUsers = [firstAuthUserId, secondAuthUserId, staffAuthUserId];
    await transaction`
      delete from app.membership_checkins
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
      )
    `;
    await transaction`
      delete from app.membership_arrival_requests
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
      )
    `;
    await transaction`
      delete from app.class_reservations
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
      )
    `;
    await transaction`
      delete from app.membership_daily_access_claims
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
      )
    `;
    await transaction`
      delete from app.membership_period_core_gyms
      where membership_period_id in (
        select period.id
        from app.membership_periods period
        join app.profiles profile on profile.id = period.profile_id
        where profile.auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
      )
    `;
    await transaction`
      delete from app.membership_periods
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
      )
    `;
    await transaction`
      delete from app.membership_activation_operation_gyms
      where operation_id in (
        select operation.id
        from app.membership_activation_operations operation
        join app.profiles profile on profile.id = operation.profile_id
        where profile.auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
      )
    `;
    await transaction`
      delete from app.membership_activation_operations
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
      )
    `;
    await transaction`
      delete from app.wallet_bindings
      where bound_by_auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
    `;
    await transaction`
      delete from app.auth_challenges
      where auth_user_id in (${authUsers[0]}::uuid, ${authUsers[1]}::uuid)
    `;
    await transaction`
      delete from app.venue_staff
      where profile_id in (
        select id from app.profiles
        where auth_user_id = ${authUsers[2]}::uuid
      )
    `;
    await transaction`
      delete from app.demo_run_participants
      where profile_id in (
        select id from app.profiles
        where auth_user_id in (
          ${authUsers[0]}::uuid,
          ${authUsers[1]}::uuid,
          ${authUsers[2]}::uuid
        )
      )
    `;
    await transaction`
      delete from app.profiles
      where auth_user_id in (
        ${authUsers[0]}::uuid,
        ${authUsers[1]}::uuid,
        ${authUsers[2]}::uuid
      )
    `;
    await transaction`
      delete from auth.users
      where id in (
        ${authUsers[0]}::uuid,
        ${authUsers[1]}::uuid,
        ${authUsers[2]}::uuid
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
    const messageHashHex = hashHex(`checkin-message:${marker}`);
    await issuePersonalWalletChallengeRecord(transaction, {
      id: clock.id,
      purpose: "link-personal-wallet",
      address: walletAddress,
      origin: "http://localhost:3100",
      nonceHashHex: hashHex(`checkin-nonce:${marker}`),
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
  planId: "basic" | "classic",
) {
  await withActorDatabaseContext(actor, async (transaction) => {
    assert.equal(
      await prepareMembershipActivationRecord(transaction, {
        operationId,
        planId,
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
        confirmedSlot: "710000001",
        amountBaseUnits: planId === "basic" ? "80000000" : "150000000",
      },
    );
    assert.equal(completed.result, "confirmed");
    assert.ok(completed.membershipPeriodId);
  });
}

before(async () => {
  await removeFixtures();
  await admin`
    insert into auth.users (id, is_sso_user, is_anonymous)
    values
      (${firstAuthUserId}::uuid, false, false),
      (${secondAuthUserId}::uuid, false, false),
      (${staffAuthUserId}::uuid, false, false)
  `;
  const first = await enrollApplicationProfile(firstAuthUserId, "Checkin One");
  const second = await enrollApplicationProfile(
    secondAuthUserId,
    "Checkin Two",
  );
  const staff = await enrollApplicationProfile(staffAuthUserId, "Gym Staff");
  assert.ok(first);
  assert.ok(second);
  assert.ok(staff);
  firstActor = actorFromRecord(firstAuthUserId, first);
  secondActor = actorFromRecord(secondAuthUserId, second);
  staffActor = actorFromRecord(staffAuthUserId, staff);
  await linkWallet(firstActor, firstWallet, "first");
  await linkWallet(secondActor, secondWallet, "second");
  await activateMembership(
    firstActor,
    firstActivationId,
    firstWallet,
    "C",
    "V",
    "basic",
  );
  await activateMembership(
    secondActor,
    secondActivationId,
    secondWallet,
    "D",
    "W",
    "classic",
  );
  await admin`
    insert into app.venue_staff (
      run_id,
      venue_id,
      profile_id,
      role,
      status
    )
    values (
      ${staffActor.runId}::uuid,
      ${northsideVenueId}::uuid,
      ${staffActor.profileId}::uuid,
      'check_in_staff',
      'active'
    )
  `;
});

after(async () => {
  await removeFixtures();
  await admin.end();
});

test("arrival and attendance tables stay private", async () => {
  const runtime = postgres(runtimeUrl.toString(), {
    max: 1,
    prepare: false,
    ssl: false,
  });
  try {
    for (const table of [
      "membership_arrival_requests",
      "membership_checkins",
    ]) {
      await assert.rejects(
        runtime.unsafe(`select * from app.${table}`),
        /permission denied for table/,
      );
    }
  } finally {
    await runtime.end();
  }
});

test("same-venue staff confirms one class arrival exactly once", async () => {
  const schedule = await withActorDatabaseContext(
    firstActor,
    currentMemberClassScheduleRecords,
  );
  const target = schedule.find(
    (session) =>
      session.venueId === northsideVenueId &&
      session.bookingStatus === "available",
  );
  assert.ok(target);
  const original = await admin<
    Array<{ starts_at: string; ends_at: string; status: string }>
  >`
    select starts_at::text, ends_at::text, status
    from app.class_sessions
    where id = ${target.classSessionId}::uuid
  `;
  assert.ok(original[0]);
  await admin`
    update app.class_sessions
    set
      starts_at = statement_timestamp() + interval '20 minutes',
      ends_at = statement_timestamp() + interval '80 minutes',
      status = 'scheduled'
    where id = ${target.classSessionId}::uuid
  `;

  try {
    const reserved = await withActorDatabaseContext(firstActor, (transaction) =>
      reserveMemberClassRecord(transaction, {
        operationId: classReserveId,
        classSessionId: target.classSessionId,
      }),
    );
    assert.equal(reserved.result, "reserved");
    assert.ok(reserved.reservationId);

    const created = await withActorDatabaseContext(firstActor, (transaction) =>
      createMemberArrivalRequestRecord(transaction, {
        operationId: classArrivalId,
        venueId: northsideVenueId,
        reservationId: reserved.reservationId,
        codeHashHex: hashHex("class-arrival"),
      }),
    );
    assert.equal(created.result, "created");
    assert.equal(created.requestStatus, "pending");
    assert.ok(created.requestId);

    const retry = await withActorDatabaseContext(firstActor, (transaction) =>
      createMemberArrivalRequestRecord(transaction, {
        operationId: classArrivalId,
        venueId: northsideVenueId,
        reservationId: reserved.reservationId,
        codeHashHex: hashHex("ignored-retry-code"),
      }),
    );
    assert.equal(retry.result, "existing");
    assert.equal(retry.requestId, created.requestId);

    const snapshot = await withActorDatabaseContext(
      firstActor,
      currentMemberCheckinSnapshotRecord,
    );
    assert.equal(snapshot.pendingArrival?.requestId, created.requestId);
    assert.equal(snapshot.pendingArrival?.classTitle, target.classTitle);
    assert.equal(snapshot.history.length, 0);

    assert.equal(
      (
        await withActorDatabaseContext(firstActor, (transaction) =>
          confirmMemberArrivalRecord(transaction, hashHex("class-arrival")),
        )
      ).result,
      "forbidden",
    );

    await admin`
      update app.membership_periods
      set included_checkins_used = 9
      where run_id = ${firstActor.runId}::uuid
        and profile_id = ${firstActor.profileId}::uuid
        and membership_status = 'active'
    `;
    const confirmations = await Promise.all([
      withActorDatabaseContext(staffActor, (transaction) =>
        confirmMemberArrivalRecord(transaction, hashHex("class-arrival")),
      ),
      withActorDatabaseContext(staffActor, (transaction) =>
        confirmMemberArrivalRecord(transaction, hashHex("class-arrival")),
      ),
    ]);
    assert.deepEqual(
      new Set(confirmations.map((result) => result.result)),
      new Set(["confirmed", "existing"]),
    );
    assert.equal(confirmations[0].checkinId, confirmations[1].checkinId);

    const persisted = await admin<
      Array<{
        checkin_count: number;
        included_checkins_used: number;
        reservation_status: string;
        claim_status: string;
      }>
    >`
      select
        count(checkin.id)::integer as checkin_count,
        period.included_checkins_used,
        reservation.reservation_status,
        claim.claim_status
      from app.membership_periods as period
      join app.class_reservations as reservation
        on reservation.membership_period_id = period.id
      join app.membership_daily_access_claims as claim
        on claim.id = reservation.access_claim_id
      left join app.membership_checkins as checkin
        on checkin.access_claim_id = claim.id
      where reservation.id = ${reserved.reservationId}::uuid
      group by
        period.included_checkins_used,
        reservation.reservation_status,
        claim.claim_status
    `;
    assert.deepEqual(
      { ...persisted[0] },
      {
        checkin_count: 1,
        included_checkins_used: 10,
        reservation_status: "checked_in",
        claim_status: "consumed",
      },
    );

    const completed = await withActorDatabaseContext(
      firstActor,
      currentMemberCheckinSnapshotRecord,
    );
    assert.equal(completed.pendingArrival, null);
    assert.equal(completed.history.length, 1);
    assert.equal(completed.history[0]?.attendanceKind, "class");
    assert.equal(completed.activePeriod?.includedCheckinsUsed, 10);
    await assert.rejects(
      admin`
        update app.membership_checkins
        set service_date = service_date + 1
        where id = ${completed.history[0]!.checkinId}::uuid
      `,
      /membership check-in evidence is immutable/,
    );

    assert.equal(
      (
        await withActorDatabaseContext(firstActor, (transaction) =>
          createMemberArrivalRequestRecord(transaction, {
            operationId: classConflictArrivalId,
            venueId: northsideVenueId,
            reservationId: null,
            codeHashHex: hashHex("same-day-conflict"),
          }),
        )
      ).result,
      "daily-conflict",
    );

    const originalTimezone = await admin<
      Array<{ timezone: string; alternate_timezone: string }>
    >`
      select
        timezone,
        case
          when (statement_timestamp() at time zone 'Pacific/Kiritimati')::date
            <> (statement_timestamp() at time zone timezone)::date
            then 'Pacific/Kiritimati'
          else 'Pacific/Pago_Pago'
        end as alternate_timezone
      from app.venues
      where id = ${northsideVenueId}::uuid
    `;
    assert.ok(originalTimezone[0]);
    await admin`
      update app.venues
      set timezone = ${originalTimezone[0].alternate_timezone}
      where id = ${northsideVenueId}::uuid
    `;
    try {
      assert.equal(
        (
          await withActorDatabaseContext(firstActor, (transaction) =>
            createMemberArrivalRequestRecord(transaction, {
              operationId: "99100000-0000-4000-8000-000000000308",
              venueId: northsideVenueId,
              reservationId: null,
              codeHashHex: hashHex("eleventh-use"),
            }),
          )
        ).result,
        "allowance-exhausted",
      );
    } finally {
      await admin`
        update app.venues
        set timezone = ${originalTimezone[0].timezone}
        where id = ${northsideVenueId}::uuid
      `;
    }
  } finally {
    await admin`
      update app.class_sessions
      set
        starts_at = ${original[0].starts_at}::timestamptz,
        ends_at = ${original[0].ends_at}::timestamptz,
        status = ${original[0].status}
      where id = ${target.classSessionId}::uuid
    `;
  }
});

test("open-gym cancellation releases its claim and wrong-venue staff cannot confirm", async () => {
  const first = await withActorDatabaseContext(secondActor, (transaction) =>
    createMemberArrivalRequestRecord(transaction, {
      operationId: wrongVenueArrivalId,
      venueId: fabrikVenueId,
      reservationId: null,
      codeHashHex: hashHex("wrong-venue"),
    }),
  );
  assert.equal(first.result, "created");
  assert.ok(first.requestId);
  assert.equal(
    (
      await withActorDatabaseContext(staffActor, (transaction) =>
        confirmMemberArrivalRecord(transaction, hashHex("wrong-venue")),
      )
    ).result,
    "forbidden",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      cancelMemberArrivalRequestRecord(transaction, first.requestId!),
    ),
    "cancelled",
  );

  const released = await admin<Array<{ claim_status: string }>>`
    select claim.claim_status
    from app.membership_arrival_requests as arrival
    join app.membership_daily_access_claims as claim
      on claim.id = arrival.access_claim_id
    where arrival.id = ${first.requestId}::uuid
  `;
  assert.equal(released[0]?.claim_status, "released");

  const activePeriod = await admin<
    Array<{ membership_period_id: string; service_date: string }>
  >`
    select
      period.id::text as membership_period_id,
      (statement_timestamp() at time zone venue.timezone)::date::text
        as service_date
    from app.membership_periods as period
    join app.membership_period_core_gyms as core_gym
      on core_gym.membership_period_id = period.id
      and core_gym.venue_id = ${northsideVenueId}::uuid
    join app.venues as venue on venue.id = core_gym.venue_id
    where period.run_id = ${secondActor.runId}::uuid
      and period.profile_id = ${secondActor.profileId}::uuid
      and period.membership_status = 'active'
  `;
  assert.ok(activePeriod[0]);
  await admin.begin(async (transaction) => {
    await transaction`
      insert into app.membership_daily_access_claims (
        id,
        run_id,
        membership_period_id,
        profile_id,
        service_date,
        claim_kind,
        claim_status,
        held_at,
        created_at,
        updated_at
      )
      values (
        ${expiredOpenGymClaimId}::uuid,
        ${secondActor.runId}::uuid,
        ${activePeriod[0].membership_period_id}::uuid,
        ${secondActor.profileId}::uuid,
        ${activePeriod[0].service_date}::date,
        'open_gym',
        'held',
        statement_timestamp() - interval '20 minutes',
        statement_timestamp() - interval '20 minutes',
        statement_timestamp() - interval '20 minutes'
      )
    `;
    await transaction`
      insert into app.membership_arrival_requests (
        id,
        operation_id,
        run_id,
        membership_period_id,
        profile_id,
        venue_id,
        reservation_id,
        access_claim_id,
        service_date,
        code_hash,
        request_status,
        created_at,
        expires_at,
        updated_at
      )
      values (
        ${expiredOpenGymRequestId}::uuid,
        ${expiredOpenGymArrivalId}::uuid,
        ${secondActor.runId}::uuid,
        ${activePeriod[0].membership_period_id}::uuid,
        ${secondActor.profileId}::uuid,
        ${northsideVenueId}::uuid,
        null,
        ${expiredOpenGymClaimId}::uuid,
        ${activePeriod[0].service_date}::date,
        ${hashHex("expired-open-gym")},
        'pending',
        statement_timestamp() - interval '20 minutes',
        statement_timestamp() - interval '5 minutes',
        statement_timestamp() - interval '20 minutes'
      )
    `;
  });
  assert.equal(
    (
      await withActorDatabaseContext(
        secondActor,
        currentMemberCheckinSnapshotRecord,
      )
    ).pendingArrival,
    null,
  );
  const expiredOpenGym = await admin<
    Array<{ request_status: string; claim_status: string }>
  >`
    select arrival.request_status, claim.claim_status
    from app.membership_arrival_requests as arrival
    join app.membership_daily_access_claims as claim
      on claim.id = arrival.access_claim_id
    where arrival.id = ${expiredOpenGymRequestId}::uuid
  `;
  assert.deepEqual(
    { ...expiredOpenGym[0] },
    {
      request_status: "expired",
      claim_status: "released",
    },
  );

  const replacement = await withActorDatabaseContext(
    secondActor,
    (transaction) =>
      createMemberArrivalRequestRecord(transaction, {
        operationId: confirmedOpenGymArrivalId,
        venueId: northsideVenueId,
        reservationId: null,
        codeHashHex: hashHex("open-gym-confirm"),
      }),
  );
  assert.equal(replacement.result, "created");
  await admin`
    update app.venue_staff
    set status = 'revoked',
        revoked_at = statement_timestamp()
    where run_id = ${staffActor.runId}::uuid
      and venue_id = ${northsideVenueId}::uuid
      and profile_id = ${staffActor.profileId}::uuid
  `;
  assert.equal(
    (
      await withActorDatabaseContext(staffActor, (transaction) =>
        confirmMemberArrivalRecord(transaction, hashHex("open-gym-confirm")),
      )
    ).result,
    "forbidden",
  );
  await admin`
    update app.venue_staff
    set status = 'active',
        revoked_at = null
    where run_id = ${staffActor.runId}::uuid
      and venue_id = ${northsideVenueId}::uuid
      and profile_id = ${staffActor.profileId}::uuid
  `;
  const confirmation = await withActorDatabaseContext(
    staffActor,
    (transaction) =>
      confirmMemberArrivalRecord(transaction, hashHex("open-gym-confirm")),
  );
  assert.equal(confirmation.result, "confirmed");
  assert.ok(confirmation.checkinId);
  assert.deepEqual(
    await withActorDatabaseContext(staffActor, (transaction) =>
      confirmMemberArrivalRecord(transaction, hashHex("open-gym-confirm")),
    ),
    { result: "existing", checkinId: confirmation.checkinId },
  );

  const snapshot = await withActorDatabaseContext(
    secondActor,
    currentMemberCheckinSnapshotRecord,
  );
  assert.equal(snapshot.history[0]?.attendanceKind, "open_gym");
  assert.equal(snapshot.history[0]?.venueId, northsideVenueId);
  assert.equal(snapshot.activePeriod?.planCode, "classic");
  assert.equal(snapshot.activePeriod?.includedCheckins, null);
  assert.equal(snapshot.activePeriod?.includedCheckinsUsed, 0);
  assert.equal(
    (
      await withActorDatabaseContext(secondActor, (transaction) =>
        createMemberArrivalRequestRecord(transaction, {
          operationId: classicDailyConflictArrivalId,
          venueId: fabrikVenueId,
          reservationId: null,
          codeHashHex: hashHex("classic-daily-conflict"),
        }),
      )
    ).result,
    "daily-conflict",
  );
});

test("lazy expiry releases open-gym claims but preserves reservation holds", async () => {
  const schedule = await withActorDatabaseContext(
    secondActor,
    currentMemberClassScheduleRecords,
  );
  const future = schedule.find(
    (session) =>
      session.bookingStatus === "available" &&
      session.serviceDate !==
        new Intl.DateTimeFormat("en-CA", {
          timeZone: session.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
  );
  assert.ok(future);
  const reserved = await withActorDatabaseContext(secondActor, (transaction) =>
    reserveMemberClassRecord(transaction, {
      operationId: futureReserveId,
      classSessionId: future.classSessionId,
    }),
  );
  assert.equal(reserved.result, "reserved");
  assert.ok(reserved.reservationId);
  const context = await admin<
    Array<{
      run_id: string;
      membership_period_id: string;
      profile_id: string;
      venue_id: string;
      access_claim_id: string;
      service_date: string;
    }>
  >`
    select
      reservation.run_id::text,
      reservation.membership_period_id::text,
      reservation.profile_id::text,
      session.venue_id::text,
      reservation.access_claim_id::text,
      reservation.service_date::text
    from app.class_reservations as reservation
    join app.class_sessions as session
      on session.id = reservation.class_session_id
    where reservation.id = ${reserved.reservationId}::uuid
  `;
  assert.ok(context[0]);
  const expiredRequestId = "99100000-0000-4000-8000-000000000401";
  await admin`
    insert into app.membership_arrival_requests (
      id,
      operation_id,
      run_id,
      membership_period_id,
      profile_id,
      venue_id,
      reservation_id,
      access_claim_id,
      service_date,
      code_hash,
      request_status,
      created_at,
      expires_at,
      updated_at
    )
    values (
      ${expiredRequestId}::uuid,
      ${cancelledArrivalId}::uuid,
      ${context[0].run_id}::uuid,
      ${context[0].membership_period_id}::uuid,
      ${context[0].profile_id}::uuid,
      ${context[0].venue_id}::uuid,
      ${reserved.reservationId}::uuid,
      ${context[0].access_claim_id}::uuid,
      ${context[0].service_date}::date,
      ${hashHex("expired-reservation-arrival")},
      'pending',
      statement_timestamp() - interval '20 minutes',
      statement_timestamp() - interval '5 minutes',
      statement_timestamp() - interval '20 minutes'
    )
  `;

  const snapshot = await withActorDatabaseContext(
    secondActor,
    currentMemberCheckinSnapshotRecord,
  );
  assert.equal(snapshot.pendingArrival, null);
  const state = await admin<
    Array<{ request_status: string; claim_status: string }>
  >`
    select arrival.request_status, claim.claim_status
    from app.membership_arrival_requests as arrival
    join app.membership_daily_access_claims as claim
      on claim.id = arrival.access_claim_id
    where arrival.id = ${expiredRequestId}::uuid
  `;
  assert.deepEqual(
    { ...state[0] },
    {
      request_status: "expired",
      claim_status: "held",
    },
  );
});
