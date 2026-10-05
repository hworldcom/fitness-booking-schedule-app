import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import type { GroupEventDraftInput } from "@/domain/group-events";
import type { CoachProfileInput } from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { activateOwnedCoachingRecord } from "@/server/db/coaches/activation-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  GroupEventConflictError,
  bindOwnedGroupEventPoolRecord,
  createOwnedGroupEventDraftRecord,
  currentOwnedGroupEventRecords,
  markGroupEventProjectionAvailabilityRecord,
  publicGroupEventCatalogueRecords,
  publicGroupEventDetailRecord,
  publishOwnedGroupEventRecord,
  recordVerifiedGroupEventContributionProjectionRecord,
  recordVerifiedGroupEventPoolProjectionRecord,
  updateOwnedGroupEventDraftRecord,
} from "@/server/db/group-events/repository";
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

const coachAuthUserId = "99000000-0000-4000-8000-000000000001";
const participantAuthUserId = "99000000-0000-4000-8000-000000000002";
const otherCoachAuthUserId = "99000000-0000-4000-8000-000000000003";
const fixtureGymId = "40000000-0000-4000-8000-000000000001";
const coachWallet = "7EcXv8cRWYEbaYjvcXn37Bq6STqS2QwRkX8EBXjKn5Ge";
const coachAuthority = "6qaz3bzwxXPgxgRpox1FyvPPKGMdYfpGTFqPSf4r4rcH";
const participantWallet = "3idZ8hddpfAZ1JWW3gmH7YD6yokUuFDb1Txem2H6kPFe";
const otherCoachWallet = "HULis5PpFFL5ajU9k8WzPjtJ8wZKXg4HHbKVvSEhFCfR";
const programAddress = "GEUMk7SoYEsAvTgbFxohHTPbDfdX1citFT6Xxr6E4ULr";
const poolAddress = "GU3Ty9KXYFJ1m5g8t7EJC5H7h4n6Zx8JqQz7b9WmVQDA";
const vaultAddress = "AjrQdXjR9y7B4oniU5TT7PTuiqubySQuvEDJaabkJP8C";
const mintAddress = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const tokenProgramAddress = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const contributionAddress = "9xQeWvG816bUx9EPf3fD2U7X1cmZ5Qw8YJ4nN6hKTpLs";

const admin = postgres(adminConnectionString, {
  max: 1,
  prepare: false,
  ssl: false,
});

let coachActor: AuthorizedActor;
let participantActor: AuthorizedActor;
let otherCoachActor: AuthorizedActor;
let eventId: string;
let eventInput: GroupEventDraftInput;

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

function signature(character: string) {
  return character.repeat(88);
}

function hasErrorMessage(error: unknown, expected: RegExp) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "message" in current &&
      typeof current.message === "string" &&
      expected.test(current.message)
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

function futureTimestamp(days: number, hour: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

const coachProfile: CoachProfileInput = Object.freeze({
  displayName: "Group Event Coach",
  bio: "Technical Muay Thai coaching with structured progressions, clear rounds and supportive feedback for mixed experience levels.",
  disciplines: Object.freeze(["Muay Thai"] as const),
  timezone: "Europe/Berlin",
  visibility: "visible",
  selectedGymId: fixtureGymId,
  independentLocation: null,
});

const otherCoachProfile: CoachProfileInput = Object.freeze({
  displayName: "Other Event Coach",
  bio: "Boxing coaching focused on balanced footwork, calm technical practice and useful feedback for every participant.",
  disciplines: Object.freeze(["Boxing"] as const),
  timezone: "Europe/Berlin",
  visibility: "visible",
  selectedGymId: fixtureGymId,
  independentLocation: null,
});

async function removeFixtures() {
  const authIds = [
    coachAuthUserId,
    participantAuthUserId,
    otherCoachAuthUserId,
  ];
  await admin`
    delete from app.group_event_chain_operations
    where actor_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    ) or event_id in (
      select event.id from app.group_events as event
      join app.profiles as profile on profile.id = event.coach_profile_id
      where profile.auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.group_event_contribution_projections
    where participant_profile_id in (
      select id from app.profiles where auth_user_id in ${admin(authIds)}
    ) or event_id in (
      select event.id from app.group_events as event
      join app.profiles as profile on profile.id = event.coach_profile_id
      where profile.auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.group_event_pool_projections
    where event_id in (
      select event.id from app.group_events as event
      join app.profiles as profile on profile.id = event.coach_profile_id
      where profile.auth_user_id in ${admin(authIds)}
    )
  `;
  await admin`
    delete from app.group_events
    where coach_profile_id in (
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
    delete from app.wallet_bindings
    where bound_by_auth_user_id in ${admin(authIds)}
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
      (${participantAuthUserId}::uuid, false, false),
      (${otherCoachAuthUserId}::uuid, false, false)
  `;
  const coach = await enrollApplicationProfile(
    coachAuthUserId,
    "Group Event Coach",
  );
  const participant = await enrollApplicationProfile(
    participantAuthUserId,
    "Group Event Participant",
  );
  const otherCoach = await enrollApplicationProfile(
    otherCoachAuthUserId,
    "Other Event Coach",
  );
  assert.ok(coach);
  assert.ok(participant);
  assert.ok(otherCoach);
  coachActor = actorFromRecord(coachAuthUserId, coach);
  participantActor = actorFromRecord(participantAuthUserId, participant);
  otherCoachActor = actorFromRecord(otherCoachAuthUserId, otherCoach);
  await withActorDatabaseContext(coachActor, activateOwnedCoachingRecord);
  await withActorDatabaseContext(otherCoachActor, activateOwnedCoachingRecord);
  await withActorDatabaseContext(coachActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, coachProfile),
  );
  await withActorDatabaseContext(otherCoachActor, (transaction) =>
    upsertOwnedCoachProfileRecord(transaction, otherCoachProfile),
  );
  await admin`
    insert into app.wallet_bindings (
      run_id,
      cluster,
      wallet_address,
      profile_id,
      bound_by_auth_user_id,
      provenance,
      status,
      verified_at
    ) values
      (
        ${coachActor.runId}::uuid,
        'solana:devnet',
        ${coachWallet},
        ${coachActor.profileId}::uuid,
        ${coachAuthUserId}::uuid,
        'prepared',
        'active',
        statement_timestamp()
      ),
      (
        ${participantActor.runId}::uuid,
        'solana:devnet',
        ${participantWallet},
        ${participantActor.profileId}::uuid,
        ${participantAuthUserId}::uuid,
        'prepared',
        'active',
        statement_timestamp()
      ),
      (
        ${otherCoachActor.runId}::uuid,
        'solana:devnet',
        ${otherCoachWallet},
        ${otherCoachActor.profileId}::uuid,
        ${otherCoachAuthUserId}::uuid,
        'prepared',
        'active',
        statement_timestamp()
      )
  `;
  eventInput = Object.freeze({
    title: "Community Muay Thai Workshop",
    discipline: "Muay Thai",
    description:
      "A small technical workshop with structured partner rounds and clear progressions for mixed experience levels.",
    startsAt: futureTimestamp(14, 10),
    endsAt: futureTimestamp(14, 12),
    mediaUrl: "/images/group-events/community-muay-thai.jpg",
    sourceProposalId: null,
  });
});

after(async () => {
  await removeFixtures();
  await admin.end();
});

test("owner draft, verified pool and public catalogue preserve authority boundaries", async () => {
  eventId = await withActorDatabaseContext(coachActor, (transaction) =>
    createOwnedGroupEventDraftRecord(transaction, eventInput),
  );
  assert.equal((await publicGroupEventCatalogueRecords()).length, 0);

  const ownerEvents = await withActorDatabaseContext(
    coachActor,
    (transaction) => currentOwnedGroupEventRecords(transaction, coachActor),
  );
  const draft = ownerEvents.find((event) => event.id === eventId);
  assert.ok(draft);
  assert.equal(draft.coach.displayName, "Group Event Coach");
  assert.equal(
    draft.location.label,
    "Near Amerika-Gedenkbibliothek — Blücherplatz 1, 10961 Berlin",
  );

  const unrelatedEvents = await withActorDatabaseContext(
    otherCoachActor,
    (transaction) =>
      currentOwnedGroupEventRecords(transaction, otherCoachActor),
  );
  assert.equal(
    unrelatedEvents.some((event) => event.id === eventId),
    false,
  );
  await assert.rejects(
    withActorDatabaseContext(otherCoachActor, (transaction) =>
      updateOwnedGroupEventDraftRecord(transaction, eventId, {
        ...eventInput,
        title: "Unauthorized edit",
      }),
    ),
    GroupEventConflictError,
  );
  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      publishOwnedGroupEventRecord(transaction, eventId),
    ),
    GroupEventConflictError,
  );

  await withActorDatabaseContext(coachActor, (transaction) =>
    bindOwnedGroupEventPoolRecord(transaction, {
      eventId,
      programAddress,
      eventPoolAddress: poolAddress,
    }),
  );
  await assert.rejects(
    withActorDatabaseContext(coachActor, (transaction) =>
      updateOwnedGroupEventDraftRecord(transaction, eventId, {
        ...eventInput,
        title: "Bound terms cannot change",
      }),
    ),
    GroupEventConflictError,
  );

  const poolEvidence = Object.freeze({
    eventId,
    programAddress,
    eventPoolAddress: poolAddress,
    vaultAddress,
    coachAuthorityAddress: coachAuthority,
    payoutRecipientAddress: coachWallet,
    mintAddress,
    tokenProgramAddress,
    seatPriceBaseUnits: BigInt(25_000_000),
    minimumParticipants: 4,
    maximumParticipants: 12,
    participantCount: 0,
    fundingDeadline: futureTimestamp(10, 18),
    eventStartsAt: eventInput.startsAt,
    eventEndsAt: eventInput.endsAt,
    lifecycleStatus: "funding" as const,
    transactionSignature: signature("2"),
    observedSlot: BigInt(100),
    finalizedAt: futureTimestamp(1, 10),
  });
  await recordVerifiedGroupEventPoolProjectionRecord(poolEvidence);
  await recordVerifiedGroupEventPoolProjectionRecord(poolEvidence);
  await assert.rejects(
    recordVerifiedGroupEventPoolProjectionRecord({
      ...poolEvidence,
      payoutRecipientAddress: participantWallet,
    }),
    GroupEventConflictError,
  );
  await assert.rejects(
    recordVerifiedGroupEventPoolProjectionRecord({
      ...poolEvidence,
      participantCount: 1,
      observedSlot: BigInt(99),
      transactionSignature: signature("3"),
    }),
    GroupEventConflictError,
  );
  await assert.rejects(
    recordVerifiedGroupEventPoolProjectionRecord({
      ...poolEvidence,
      participantCount: 1,
      observedSlot: poolEvidence.observedSlot,
      transactionSignature: signature("3"),
    }),
    GroupEventConflictError,
  );

  await withActorDatabaseContext(coachActor, (transaction) =>
    publishOwnedGroupEventRecord(transaction, eventId),
  );
  const catalogue = await publicGroupEventCatalogueRecords();
  const published = catalogue.find((event) => event.id === eventId);
  assert.ok(published);
  assert.equal(published.projectionAvailability, "current");
  assert.equal(published.pool?.seatPriceBaseUnits, BigInt(25_000_000));
  assert.equal(
    (await publicGroupEventDetailRecord(published.slug))?.id,
    eventId,
  );

  await markGroupEventProjectionAvailabilityRecord({
    eventId,
    programAddress,
    eventPoolAddress: poolAddress,
    availability: "unavailable",
  });
  const unavailable = (await publicGroupEventCatalogueRecords()).find(
    (event) => event.id === eventId,
  );
  assert.equal(unavailable?.projectionAvailability, "unavailable");
  assert.equal(unavailable?.pool, null);

  await recordVerifiedGroupEventPoolProjectionRecord({
    ...poolEvidence,
    participantCount: 1,
    transactionSignature: signature("4"),
    observedSlot: BigInt(101),
    finalizedAt: futureTimestamp(1, 11),
  });
  assert.equal(
    (await publicGroupEventCatalogueRecords()).find(
      (event) => event.id === eventId,
    )?.pool?.participantCount,
    1,
  );
});

test("one linked participant receives one private replay-safe contribution projection", async () => {
  const evidence = Object.freeze({
    eventId,
    programAddress,
    eventPoolAddress: poolAddress,
    contributionAddress,
    participantWalletAddress: participantWallet,
    amountBaseUnits: BigInt(25_000_000),
    lifecycleStatus: "funded" as const,
    transactionSignature: signature("5"),
    observedSlot: BigInt(102),
    finalizedAt: futureTimestamp(1, 12),
  });
  const projectionId =
    await recordVerifiedGroupEventContributionProjectionRecord(evidence);
  assert.equal(
    await recordVerifiedGroupEventContributionProjectionRecord(evidence),
    projectionId,
  );
  await assert.rejects(
    recordVerifiedGroupEventContributionProjectionRecord({
      ...evidence,
      contributionAddress: vaultAddress,
      transactionSignature: signature("6"),
      observedSlot: BigInt(103),
    }),
    GroupEventConflictError,
  );

  const participantRows = await withActorDatabaseContext(
    participantActor,
    (transaction) =>
      transaction.execute<{ id: string }>(sql`
        select id
        from app.group_event_contribution_projections
        where event_id = ${eventId}::uuid
      `),
  );
  assert.deepEqual(
    participantRows.map((row) => row.id),
    [projectionId],
  );

  const coachRows = await withActorDatabaseContext(coachActor, (transaction) =>
    transaction.execute<{ id: string }>(sql`
        select id
        from app.group_event_contribution_projections
        where event_id = ${eventId}::uuid
      `),
  );
  assert.deepEqual(
    coachRows.map((row) => row.id),
    [projectionId],
  );

  const unrelatedRows = await withActorDatabaseContext(
    otherCoachActor,
    (transaction) =>
      transaction.execute<{ id: string }>(sql`
        select id
        from app.group_event_contribution_projections
        where event_id = ${eventId}::uuid
      `),
  );
  assert.equal(unrelatedRows.length, 0);
});

test("duplicate pool binding and direct runtime writes fail closed", async () => {
  const otherInput = Object.freeze({
    ...eventInput,
    title: "Other Coach Boxing Workshop",
    discipline: "Boxing" as const,
    startsAt: futureTimestamp(15, 10),
    endsAt: futureTimestamp(15, 12),
  });
  const otherEventId = await withActorDatabaseContext(
    otherCoachActor,
    (transaction) => createOwnedGroupEventDraftRecord(transaction, otherInput),
  );
  await assert.rejects(
    withActorDatabaseContext(otherCoachActor, (transaction) =>
      bindOwnedGroupEventPoolRecord(transaction, {
        eventId: otherEventId,
        programAddress,
        eventPoolAddress: poolAddress,
      }),
    ),
    GroupEventConflictError,
  );

  const runtime = postgres(runtimeUrl.toString(), {
    max: 1,
    prepare: false,
    ssl: false,
  });
  try {
    await assert.rejects(
      runtime`update app.group_events set title = 'Direct runtime edit'`,
      /permission denied for table group_events/,
    );
  } finally {
    await runtime.end();
  }
});

test("group-event operation journal is actor-scoped, idempotent and recoverable", async () => {
  const operationId = "99000000-0000-4000-8000-000000000099";
  const summary = {
    cluster: "devnet",
    operation: "fund-event-seat",
    eventId,
    programAddress,
    authorityAddress: participantWallet,
    eventPoolAddress: poolAddress,
    vaultAddress,
    coachAuthorityAddress: coachAuthority,
    contributionAddress,
    testAsset: "EURC",
    paymentMintAddress: mintAddress,
    userPaysSol: false,
    participantWalletAddress: participantWallet,
    participantTokenAccountAddress: participantWallet,
    seatPriceEurcBaseUnits: "25000000",
  };
  await assert.rejects(
    withActorDatabaseContext(participantActor, (transaction) =>
      transaction.execute(sql`
        select app.record_group_event_operation_preparation(
          ${operationId}::uuid,
          ${eventId}::uuid,
          'fund-event-seat'::text,
          ${programAddress}::text,
          ${coachWallet}::text,
          ${coachAuthority}::text,
          ${poolAddress}::text,
          ${vaultAddress}::text,
          ${contributionAddress}::text,
          ${JSON.stringify(summary)}::jsonb,
          'AQID'::text,
          'BAUG'::text,
          '11111111111111111111111111111111'::text,
          200::bigint,
          100::bigint,
          50000::bigint
        )
      `),
    ),
    (error: unknown) => hasErrorMessage(error, /unauthorized/u),
  );

  await withActorDatabaseContext(participantActor, (transaction) =>
    transaction.execute(sql`
      select app.record_group_event_operation_preparation(
        ${operationId}::uuid,
        ${eventId}::uuid,
        'fund-event-seat'::text,
        ${programAddress}::text,
        ${participantWallet}::text,
        ${coachAuthority}::text,
        ${poolAddress}::text,
        ${vaultAddress}::text,
        ${contributionAddress}::text,
        ${JSON.stringify(summary)}::jsonb,
        'AQID'::text,
        'BAUG'::text,
        '11111111111111111111111111111111'::text,
        200::bigint,
        100::bigint,
        50000::bigint
      )
    `),
  );

  const participantRows = await withActorDatabaseContext(
    participantActor,
    (transaction) =>
      transaction.execute<{ id: string; status: string }>(sql`
        select id, status
        from app.group_event_chain_operations
        where id = ${operationId}::uuid
      `),
  );
  assert.equal(participantRows.length, 1);
  assert.equal(participantRows[0]?.id, operationId);
  assert.equal(participantRows[0]?.status, "prepared");
  const coachRows = await withActorDatabaseContext(coachActor, (transaction) =>
    transaction.execute<{ id: string }>(sql`
      select id
      from app.group_event_chain_operations
      where id = ${operationId}::uuid
    `),
  );
  assert.equal(coachRows.length, 0);

  await assert.rejects(
    withActorDatabaseContext(participantActor, (transaction) =>
      transaction.execute(sql`
        select app.record_group_event_operation_preparation(
          gen_random_uuid(),
          ${eventId}::uuid,
          'fund-event-seat'::text,
          ${programAddress}::text,
          ${participantWallet}::text,
          ${coachAuthority}::text,
          ${poolAddress}::text,
          ${vaultAddress}::text,
          ${contributionAddress}::text,
          ${JSON.stringify(summary)}::jsonb,
          'AQID'::text,
          'BAUG'::text,
          '11111111111111111111111111111111'::text,
          200::bigint,
          100::bigint,
          null::bigint
        )
      `),
    ),
    (error: unknown) => hasErrorMessage(error, /duplicate key value/u),
  );

  await withActorDatabaseContext(participantActor, async (transaction) => {
    await transaction.execute(sql`
      select app.mark_group_event_operation_submitted(
        ${operationId}::uuid,
        ${signature("8")}::text
      )
    `);
    await transaction.execute(sql`
      select app.finalize_group_event_operation(
        ${operationId}::uuid,
        123::bigint
      )
    `);
  });
  const finalized = await withActorDatabaseContext(
    participantActor,
    (transaction) =>
      transaction.execute<{ status: string; observed_slot: string }>(sql`
        select status, observed_slot
        from app.group_event_chain_operations
        where id = ${operationId}::uuid
      `),
  );
  assert.equal(finalized[0]?.status, "finalized");
  assert.equal(BigInt(finalized[0]!.observed_slot), BigInt(123));

  await admin`
    update app.group_events
    set
      starts_at = statement_timestamp() - interval '2 hours',
      ends_at = statement_timestamp() - interval '1 hour'
    where id = ${eventId}::uuid
  `;
  const refundOperationId = "99000000-0000-4000-8000-000000000098";
  await withActorDatabaseContext(participantActor, (transaction) =>
    transaction.execute(sql`
      select app.record_group_event_operation_preparation(
        ${refundOperationId}::uuid,
        ${eventId}::uuid,
        'claim-event-refund'::text,
        ${programAddress}::text,
        ${participantWallet}::text,
        ${coachAuthority}::text,
        ${poolAddress}::text,
        ${vaultAddress}::text,
        ${contributionAddress}::text,
        ${JSON.stringify({
          ...summary,
          operation: "claim-event-refund",
          amountEurcBaseUnits: "25000000",
        })}::jsonb,
        'AQID'::text,
        'BAUG'::text,
        '11111111111111111111111111111111'::text,
        300::bigint,
        200::bigint,
        45000::bigint
      )
    `),
  );
  const terminal = await withActorDatabaseContext(
    participantActor,
    (transaction) =>
      transaction.execute<{ status: string }>(sql`
        select status
        from app.group_event_chain_operations
        where id = ${refundOperationId}::uuid
      `),
  );
  assert.equal(terminal[0]?.status, "prepared");
});
