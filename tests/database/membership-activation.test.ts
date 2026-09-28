import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after, before } from "node:test";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
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
const recoveryOperationId = "98000000-0000-4000-8000-000000000202";
const rejectedOperationId = "98000000-0000-4000-8000-000000000203";
const overlappingOperationId = "98000000-0000-4000-8000-000000000301";
const invalidOperationId = "98000000-0000-4000-8000-000000000901";
const firstWallet = "So11111111111111111111111111111111111111112";
const secondWallet = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const destinationWallet = "ComputeBudget111111111111111111111111111111";
const firstSignature = "2".repeat(88);
const secondSignature = "3".repeat(88);
const thirdSignature = "4".repeat(88);
const mintAddress = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const tokenProgramAddress = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const basicGyms = [
  "northside-combat",
  "fabrik",
  "vela",
  "groundline-mma",
] as const;

function paymentPreparation(referenceMarker: string) {
  return {
    referenceAddress: referenceMarker.repeat(44),
    destinationAddress: destinationWallet,
    mintAddress,
    tokenProgramAddress,
    tokenDecimals: 6,
  } as const;
}

function verifiedEvidence(
  referenceMarker: string,
  confirmedSlot = "500000001",
) {
  return {
    mintAddress,
    tokenProgramAddress,
    tokenDecimals: 6,
    referenceAddress: referenceMarker.repeat(44),
    confirmedSlot,
  } as const;
}

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
  input: {
    operationId: string;
    walletAddress: string;
    referenceMarker: string;
    transactionSignature: string;
    amountBaseUnits: string;
  },
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
      from app.complete_verified_membership_payment(
        ${input.operationId}::uuid,
        ${input.walletAddress},
        ${destinationWallet},
        ${mintAddress},
        ${tokenProgramAddress},
        ${input.referenceMarker.repeat(44)},
        6::integer,
        ${input.transactionSignature},
        500000001::bigint,
        ${input.amountBaseUnits}::numeric
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
          select app.prepare_membership_payment_activation(
            ${invalidOperationId}::uuid,
            'basic'::text,
            array['northside-combat', 'fabrik', 'vela']::text[],
            ${"8".repeat(44)}::text,
            ${destinationWallet}::text,
            ${mintAddress}::text,
            ${tokenProgramAddress}::text,
            6::integer
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
        ...paymentPreparation("8"),
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
        ...paymentPreparation("4"),
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
        ...paymentPreparation("4"),
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
        ...paymentPreparation("4"),
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
        ...paymentPreparation("5"),
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

test("submission uses the prepared linked wallet and concurrent confirmation creates one period", async () => {
  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: secondOperationId,
        transactionSignature: firstSignature,
      }),
    ),
    "submitted",
  );
  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: secondOperationId,
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
        ...verifiedEvidence("5"),
      }),
  );
  assert.deepEqual(wrongAmount, {
    result: "state-conflict",
    membershipPeriodId: null,
  });

  const [firstCompletion, secondCompletion] = await Promise.all([
    directCompletion(runtimeA, firstActor, {
      operationId: secondOperationId,
      walletAddress: firstWallet,
      referenceMarker: "5",
      transactionSignature: firstSignature,
      amountBaseUnits: "80000000",
    }),
    directCompletion(runtimeB, firstActor, {
      operationId: secondOperationId,
      walletAddress: firstWallet,
      referenceMarker: "5",
      transactionSignature: firstSignature,
      amountBaseUnits: "80000000",
    }),
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
        ...paymentPreparation("7"),
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
        ...paymentPreparation("6"),
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

  assert.deepEqual(
    await directCompletion(runtimeA, secondActor, {
      operationId: secondActorOperationId,
      walletAddress: secondWallet,
      referenceMarker: "6",
      transactionSignature: secondSignature,
      amountBaseUnits: "150000000",
    }),
    { completion_result: "state-conflict", membership_period_id: null },
  );

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

test("transaction rejection remains terminal to verified completion", async () => {
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: rejectedOperationId,
        planId: "classic",
        gymIds: basicGyms,
        ...paymentPreparation("7"),
      }),
    ),
    "prepared",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: rejectedOperationId,
        transactionSignature: thirdSignature,
      }),
    ),
    "submitted",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      failMembershipActivationRecord(transaction, {
        operationId: rejectedOperationId,
        reason: "transaction-rejected",
      }),
    ),
    "failed",
  );
  assert.deepEqual(
    await directCompletion(runtimeA, secondActor, {
      operationId: rejectedOperationId,
      walletAddress: secondWallet,
      referenceMarker: "7",
      transactionSignature: thirdSignature,
      amountBaseUnits: "150000000",
    }),
    { completion_result: "state-conflict", membership_period_id: null },
  );
});

test("one chain transaction cannot be reused and a verification failure recovers once", async () => {
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      prepareMembershipActivationRecord(transaction, {
        operationId: recoveryOperationId,
        planId: "classic",
        gymIds: basicGyms,
        ...paymentPreparation("9"),
      }),
    ),
    "prepared",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: recoveryOperationId,
        transactionSignature: firstSignature,
      }),
    ),
    "payment-conflict",
  );
  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      recordMembershipActivationSubmission(transaction, {
        operationId: recoveryOperationId,
        transactionSignature: secondSignature,
      }),
    ),
    "submitted",
  );

  assert.equal(
    await withActorDatabaseContext(secondActor, (transaction) =>
      failMembershipActivationRecord(transaction, {
        operationId: recoveryOperationId,
        reason: "verification-failed",
      }),
    ),
    "failed",
  );
  assert.deepEqual(
    await directCompletion(runtimeA, secondActor, {
      operationId: recoveryOperationId,
      walletAddress: secondWallet,
      referenceMarker: "9",
      transactionSignature: secondSignature,
      amountBaseUnits: "149999999",
    }),
    { completion_result: "state-conflict", membership_period_id: null },
  );

  const [firstRecovery, secondRecovery] = await Promise.all([
    directCompletion(runtimeA, secondActor, {
      operationId: recoveryOperationId,
      walletAddress: secondWallet,
      referenceMarker: "9",
      transactionSignature: secondSignature,
      amountBaseUnits: "150000000",
    }),
    directCompletion(runtimeB, secondActor, {
      operationId: recoveryOperationId,
      walletAddress: secondWallet,
      referenceMarker: "9",
      transactionSignature: secondSignature,
      amountBaseUnits: "150000000",
    }),
  ]);
  assert.deepEqual(
    new Set([
      firstRecovery.completion_result,
      secondRecovery.completion_result,
    ]),
    new Set(["confirmed", "existing"]),
  );
  assert.ok(firstRecovery.membership_period_id);
  assert.equal(
    firstRecovery.membership_period_id,
    secondRecovery.membership_period_id,
  );

  const recovered = await admin<
    Array<{
      operation_status: string;
      failure_reason: string | null;
      failed_at: Date | null;
      period_count: number;
    }>
  >`
    select
      operation.operation_status,
      operation.failure_reason,
      operation.failed_at,
      count(period.id)::integer as period_count
    from app.membership_activation_operations operation
    left join app.membership_periods period
      on period.activation_operation_id = operation.id
    where operation.id = ${recoveryOperationId}::uuid
    group by operation.id
  `;
  assert.deepEqual(
    {
      operationStatus: recovered[0]?.operation_status,
      failureReason: recovered[0]?.failure_reason,
      failedAt: recovered[0]?.failed_at,
      periodCount: recovered[0]?.period_count,
    },
    {
      operationStatus: "confirmed",
      failureReason: null,
      failedAt: null,
      periodCount: 1,
    },
  );
});
