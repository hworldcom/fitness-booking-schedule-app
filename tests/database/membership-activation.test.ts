import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after, before } from "node:test";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { closeDatabaseConnection } from "@/server/db/client";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  completeVerifiedMembershipActivationRecord,
  currentMembershipStateRecords,
  failMembershipActivationRecord,
  prepareMembershipActivationRecord,
  recordMembershipActivationSubmission,
} from "@/server/db/membership/repository";
import {
  completePersonalWalletChallengeRecord,
  issuePersonalWalletChallengeRecord,
  personalWalletChallengeClock,
} from "@/server/db/wallet/repository";
import { membershipStateFromRecords } from "@/server/membership/service";

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

const firstAuthUserId = "98000000-0000-4000-8000-000000000001";
const secondAuthUserId = "98000000-0000-4000-8000-000000000002";
const firstOperationId = "98000000-0000-4000-8000-000000000101";
const secondOperationId = "98000000-0000-4000-8000-000000000102";
const secondActorOperationId = "98000000-0000-4000-8000-000000000201";
const overlappingOperationId = "98000000-0000-4000-8000-000000000301";
const invalidOperationId = "98000000-0000-4000-8000-000000000901";
const firstWallet = "So11111111111111111111111111111111111111112";
const secondWallet = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const destinationWallet = "ComputeBudget111111111111111111111111111111";
const firstSignature = "2".repeat(88);
const secondSignature = "3".repeat(88);
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
  return withActorDatabaseContext(actor, async (transaction) => {
    const clock = await personalWalletChallengeClock(transaction);
    const expiresAt = new Date(
      new Date(clock.issuedAt).getTime() + 5 * 60 * 1_000,
    ).toISOString();
    const messageHashHex = hashHex(`message:${marker}`);
    await issuePersonalWalletChallengeRecord(transaction, {
      id: clock.id,
      purpose: "link-personal-wallet",
      address: walletAddress,
      origin: "http://localhost:3100",
      nonceHashHex: hashHex(`nonce:${marker}`),
      messageHashHex,
      issuedAt: clock.issuedAt,
      expiresAt,
    });
    const completed = await completePersonalWalletChallengeRecord(transaction, {
      id: clock.id,
      purpose: "link-personal-wallet",
      address: walletAddress,
      messageHashHex,
      reauthenticatedAt: null,
    });
    assert.equal(completed.result, "linked");
  });
}

async function directCompletion(
  connection: typeof runtimeA,
  actor: AuthorizedActor,
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
      Array<{
        completion_result: string;
        membership_period_id: string | null;
      }>
    >`
      select *
      from app.complete_verified_membership_activation(
        ${secondOperationId}::uuid,
        ${firstWallet},
        ${destinationWallet},
        ${firstSignature},
        80000000::numeric
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
    "Membership One",
  );
  const second = await enrollApplicationProfile(
    secondAuthUserId,
    "Membership Two",
  );
  assert.ok(first);
  assert.ok(second);
  firstActor = actorFromRecord(firstAuthUserId, first);
  secondActor = actorFromRecord(secondAuthUserId, second);
  await linkWallet(firstActor, firstWallet, "membership-first");
  await linkWallet(secondActor, secondWallet, "membership-second");
});

after(async () => {
  await closeDatabaseConnection();
  await runtimeA.end();
  await runtimeB.end();
  await removeFixtures();
  await admin.end();
});

test("activation tables are private and actor preparation validates the catalogue", async () => {
  for (const table of [
    "membership_activation_operations",
    "membership_activation_operation_gyms",
    "membership_periods",
    "membership_period_core_gyms",
  ]) {
    await assert.rejects(
      runtimeA.unsafe(`select * from app.${table}`),
      /permission denied for table/,
    );
  }

  const threeGyms = await withActorDatabaseContext(firstActor, (transaction) =>
    transaction.execute<{ result: string }>(
      sql`
          select app.prepare_membership_activation(
            ${invalidOperationId}::uuid,
            'basic'::text,
            array['northside-combat', 'fabrik', 'vela']::text[]
          ) as result
        `,
    ),
  );
  assert.equal(threeGyms[0]?.result, "invalid-request");

  const invalidSelection = await withActorDatabaseContext(
    firstActor,
    (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: invalidOperationId,
        planId: "basic",
        gymIds: ["northside-combat", "fabrik", "vela", "quiet-current"],
      }),
  );
  assert.equal(invalidSelection, "invalid-selection");

  const operationCount = await admin<{ count: number }[]>`
    select count(*)::integer as count
    from app.membership_activation_operations
    where id = ${invalidOperationId}::uuid
  `;
  assert.equal(operationCount[0]?.count, 0);
});

test("stable preparation retries preserve snapshots and supersede only pending intent", async () => {
  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: firstOperationId,
        planId: "basic",
        gymIds: basicGyms,
      }),
    ),
    "prepared",
  );

  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: firstOperationId,
        planId: "basic",
        gymIds: [...basicGyms].reverse(),
      }),
    ),
    "existing",
  );
  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: firstOperationId,
        planId: "classic",
        gymIds: basicGyms,
      }),
    ),
    "operation-conflict",
  );

  await admin.begin(async (transaction) => {
    await transaction`
      update app.venues
      set name = 'Temporary catalogue name'
      where run_id = ${firstActor.runId}::uuid
        and slug = 'northside-combat'
    `;
    const snapshot = await transaction<{ venue_name: string }[]>`
      select venue_name
      from app.membership_activation_operation_gyms
      where operation_id = ${firstOperationId}::uuid
        and venue_slug = 'northside-combat'
    `;
    assert.equal(snapshot[0]?.venue_name, "Northside Combat");
    await transaction`
      update app.venues
      set name = 'Northside Combat'
      where run_id = ${firstActor.runId}::uuid
        and slug = 'northside-combat'
    `;
  });

  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: secondOperationId,
        planId: "basic",
        gymIds: basicGyms,
      }),
    ),
    "prepared",
  );

  const states = await withActorDatabaseContext(
    firstActor,
    currentMembershipStateRecords,
  );
  assert.equal(states.length, 2);
  assert.equal(states[0]?.activationOperationId, secondOperationId);
  assert.equal(states[0]?.operationStatus, "pending");
  assert.equal(states[1]?.operationStatus, "failed");
  assert.equal(states[1]?.failureReason, "superseded");
  assert.deepEqual(states[0]?.selectedGymSlugs, basicGyms);
});

test("submission binds the linked wallet and concurrent confirmation creates one period", async () => {
  const wrongWallet = await withActorDatabaseContext(
    firstActor,
    (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: secondOperationId,
        walletAddress: secondWallet,
        destinationAddress: destinationWallet,
        transactionSignature: firstSignature,
      }),
  );
  assert.equal(wrongWallet, "wallet-conflict");

  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: secondOperationId,
        walletAddress: firstWallet,
        destinationAddress: destinationWallet,
        transactionSignature: firstSignature,
      }),
    ),
    "submitted",
  );
  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: secondOperationId,
        walletAddress: firstWallet,
        destinationAddress: destinationWallet,
        transactionSignature: firstSignature,
      }),
    ),
    "existing",
  );

  const wrongAmount = await withActorDatabaseContext(
    firstActor,
    (transaction) =>
      completeVerifiedMembershipActivationRecord(transaction, {
        operationId: secondOperationId,
        walletAddress: firstWallet,
        destinationAddress: destinationWallet,
        transactionSignature: firstSignature,
        amountBaseUnits: "79999999",
      }),
  );
  assert.deepEqual(wrongAmount, {
    result: "state-conflict",
    membershipPeriodId: null,
  });

  const [firstCompletion, secondCompletion] = await Promise.all([
    directCompletion(runtimeA, firstActor),
    directCompletion(runtimeB, firstActor),
  ]);
  assert.deepEqual(
    new Set([
      firstCompletion.completion_result,
      secondCompletion.completion_result,
    ]),
    new Set(["confirmed", "existing"]),
  );
  assert.ok(firstCompletion.membership_period_id);
  assert.equal(
    firstCompletion.membership_period_id,
    secondCompletion.membership_period_id,
  );

  const persisted = await admin<
    Array<{ period_count: number; gym_count: number }>
  >`
    select
      count(distinct period.id)::integer as period_count,
      count(gym.venue_id)::integer as gym_count
    from app.membership_periods period
    join app.membership_period_core_gyms gym
      on gym.run_id = period.run_id
      and gym.membership_period_id = period.id
    where period.activation_operation_id = ${secondOperationId}::uuid
  `;
  assert.deepEqual({ ...persisted[0] }, { period_count: 1, gym_count: 4 });

  const records = await withActorDatabaseContext(
    firstActor,
    currentMembershipStateRecords,
  );
  const readModel = membershipStateFromRecords(records);
  assert.equal(readModel.pending, null);
  assert.equal(
    readModel.activePeriod?.activationOperationId,
    secondOperationId,
  );
  assert.equal(readModel.activePeriod?.plan.id, "basic");
  assert.equal(readModel.activePeriod?.plan.price.baseUnits, "80000000");
  assert.equal(readModel.activePeriod?.includedCheckinsUsed, 0);
  assert.equal(readModel.activePeriod?.gyms.length, 4);
  assert.ok(
    Date.parse(readModel.activePeriod!.endsAt) >
      Date.parse(readModel.activePeriod!.startsAt),
  );

  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: overlappingOperationId,
        planId: "classic",
        gymIds: basicGyms,
      }),
    ),
    "state-conflict",
  );
  const overlappingCount = await admin<{ count: number }[]>`
    select count(*)::integer as count
    from app.membership_activation_operations
    where id = ${overlappingOperationId}::uuid
  `;
  assert.equal(overlappingCount[0]?.count, 0);
  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      failMembershipActivationRecord(transaction, {
        operationId: secondOperationId,
        reason: "verification-failed",
      }),
    ),
    "state-conflict",
  );
});

test("another member sees no private state and failed activation creates no period", async () => {
  const initial = await withActorDatabaseContext(
    secondActor,
    currentMembershipStateRecords,
  );
  assert.deepEqual(initial, []);

  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: secondActorOperationId,
        planId: "classic",
        gymIds: basicGyms,
      }),
    ),
    "prepared",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      failMembershipActivationRecord(transaction, {
        operationId: secondActorOperationId,
        reason: "wallet-cancelled",
      }),
    ),
    "failed",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      failMembershipActivationRecord(transaction, {
        operationId: secondActorOperationId,
        reason: "wallet-cancelled",
      }),
    ),
    "existing",
  );

  const periodCount = await admin<{ count: number }[]>`
    select count(*)::integer as count
    from app.membership_periods
    where activation_operation_id = ${secondActorOperationId}::uuid
  `;
  assert.equal(periodCount[0]?.count, 0);

  const secondState = membershipStateFromRecords(
    await withActorDatabaseContext(secondActor, currentMembershipStateRecords),
  );
  assert.equal(secondState.activePeriod, null);
  assert.equal(secondState.pending, null);
  assert.equal(secondState.history[0]?.failureReason, "wallet-cancelled");

  const firstState = await withActorDatabaseContext(
    firstActor,
    currentMembershipStateRecords,
  );
  assert.ok(
    firstState.every(
      (record) => record.activationOperationId !== secondActorOperationId,
    ),
  );
});

test("one chain transaction cannot be reused by another activation", async () => {
  const reuseOperationId = "98000000-0000-4000-8000-000000000202";
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: reuseOperationId,
        planId: "classic",
        gymIds: basicGyms,
      }),
    ),
    "prepared",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: reuseOperationId,
        walletAddress: secondWallet,
        destinationAddress: destinationWallet,
        transactionSignature: firstSignature,
      }),
    ),
    "payment-conflict",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: reuseOperationId,
        walletAddress: secondWallet,
        destinationAddress: destinationWallet,
        transactionSignature: secondSignature,
      }),
    ),
    "submitted",
  );
});
