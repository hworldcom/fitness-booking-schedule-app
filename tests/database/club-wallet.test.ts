import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after, before } from "node:test";
import postgres from "postgres";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import {
  withActorDatabaseContext,
  type ActorDatabaseTransaction,
} from "@/server/db/authorization/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  ClubWalletStateConflictError,
  clubWalletChallengeClock,
  completeClubWalletChallengeRecord,
  currentClubWalletContextRecord,
  issueClubWalletChallengeRecord,
  revokeClubWalletAuthorityRecord,
  setClubWalletAuthSession,
} from "@/server/db/wallet/club-repository";

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
const firstAuthSessionId = "96000000-0000-4000-8000-000000000101";
const replacementAuthSessionId = "96000000-0000-4000-8000-000000000102";
const secondAuthSessionId = "96000000-0000-4000-8000-000000000103";
const runId = "20000000-0000-4000-8000-000000000001";
const firstOrganizationId = "96000000-0000-4000-8000-000000000011";
const secondOrganizationId = "96000000-0000-4000-8000-000000000012";
const firstWallet = "SysvarRent111111111111111111111111111111111";
const secondWallet = "Config1111111111111111111111111111111111111";

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

function hashHex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sessionIdFor(actor: AuthorizedActor) {
  return actor.authUserId === firstAuthUserId
    ? firstAuthSessionId
    : secondAuthSessionId;
}

function withClubDatabaseContext<T>(
  actor: AuthorizedActor,
  work: (transaction: ActorDatabaseTransaction) => Promise<T>,
  authSessionId = sessionIdFor(actor),
) {
  return withActorDatabaseContext(actor, async (transaction) => {
    await setClubWalletAuthSession(transaction, authSessionId);
    return work(transaction);
  });
}

async function removeFixtures() {
  await admin`
    delete from app.organization_wallet_authorities
    where auth_user_id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
  `;
  await admin`
    delete from app.auth_challenges
    where auth_user_id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
  `;
  await admin`
    delete from app.wallet_bindings
    where organization_id in (
      ${firstOrganizationId}::uuid,
      ${secondOrganizationId}::uuid
    )
  `;
  await admin`
    delete from app.organization_memberships
    where organization_id in (
      ${firstOrganizationId}::uuid,
      ${secondOrganizationId}::uuid
    )
  `;
  await admin`
    delete from app.organizations
    where id in (${firstOrganizationId}::uuid, ${secondOrganizationId}::uuid)
  `;
  await admin`
    delete from app.demo_run_participants
    where profile_id in (
      select id from app.profiles
      where auth_user_id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
    )
  `;
  await admin`
    delete from app.profiles
    where auth_user_id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
  `;
  await admin`
    delete from auth.users
    where id in (${firstAuthUserId}::uuid, ${secondAuthUserId}::uuid)
  `;
}

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
    "Club Admin One",
  );
  const second = await enrollApplicationProfile(
    secondAuthUserId,
    "Club Admin Two",
  );
  assert.ok(first);
  assert.ok(second);
  firstActor = actorFromRecord(firstAuthUserId, first);
  secondActor = actorFromRecord(secondAuthUserId, second);

  await admin`
    insert into app.organizations (
      id, run_id, slug, name, description, kind, status, record_source
    )
    values
      (
        ${firstOrganizationId}::uuid,
        ${runId}::uuid,
        'test-club-one',
        'Test Club One',
        'Prepared club authority test fixture.',
        'gym',
        'active',
        'user'
      ),
      (
        ${secondOrganizationId}::uuid,
        ${runId}::uuid,
        'test-club-two',
        'Test Club Two',
        'Prepared club authority test fixture.',
        'studio',
        'active',
        'user'
      )
  `;
  await admin`
    insert into app.organization_memberships (
      run_id, organization_id, profile_id, role, status
    )
    values
      (
        ${runId}::uuid,
        ${firstOrganizationId}::uuid,
        ${firstActor.profileId}::uuid,
        'primary_admin',
        'active'
      ),
      (
        ${runId}::uuid,
        ${secondOrganizationId}::uuid,
        ${secondActor.profileId}::uuid,
        'primary_admin',
        'active'
      )
  `;
  await admin`
    insert into app.wallet_bindings (
      run_id,
      cluster,
      wallet_address,
      owner_type,
      profile_id,
      organization_id,
      bound_by_auth_user_id,
      provenance,
      status,
      verified_at
    )
    values
      (
        ${runId}::uuid,
        'solana:devnet',
        ${firstWallet},
        'organization',
        null,
        ${firstOrganizationId}::uuid,
        ${firstAuthUserId}::uuid,
        'prepared',
        'active',
        statement_timestamp()
      ),
      (
        ${runId}::uuid,
        'solana:devnet',
        ${secondWallet},
        'organization',
        null,
        ${secondOrganizationId}::uuid,
        ${secondAuthUserId}::uuid,
        'prepared',
        'active',
        statement_timestamp()
      )
  `;
});

after(async () => {
  await runtimeA.end();
  await runtimeB.end();
  await removeFixtures();
  await admin.end();
});

async function issueChallenge(
  actor: AuthorizedActor,
  marker: string,
  authSessionId = sessionIdFor(actor),
) {
  return withClubDatabaseContext(
    actor,
    async (transaction) => {
      const context = await currentClubWalletContextRecord(transaction);
      assert.ok(context);
      const clock = await clubWalletChallengeClock(transaction);
      const expiresAt = new Date(
        new Date(clock.issuedAt).getTime() + 5 * 60 * 1_000,
      ).toISOString();
      const messageHashHex = hashHex(`club-message:${marker}`);
      await issueClubWalletChallengeRecord(transaction, {
        id: clock.id,
        address: context.address,
        origin: "http://localhost:3100",
        nonceHashHex: hashHex(`club-nonce:${marker}`),
        messageHashHex,
        issuedAt: clock.issuedAt,
        expiresAt,
      });
      return { id: clock.id, address: context.address, messageHashHex };
    },
    authSessionId,
  );
}

async function completeChallenge(
  actor: AuthorizedActor,
  challenge: { id: string; address: string; messageHashHex: string },
  authSessionId = sessionIdFor(actor),
) {
  return withClubDatabaseContext(
    actor,
    (transaction) => completeClubWalletChallengeRecord(transaction, challenge),
    authSessionId,
  );
}

async function completeWithRuntime(
  connection: typeof runtimeA,
  actor: AuthorizedActor,
  challenge: { id: string; address: string; messageHashHex: string },
  authSessionId = sessionIdFor(actor),
) {
  return connection.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.current_auth_user_id', ${actor.authUserId}, true),
        set_config('app.current_auth_session_id', ${authSessionId}, true),
        set_config('app.current_profile_id', ${actor.profileId}, true),
        set_config('app.current_run_id', ${actor.runId}, true),
        set_config('app.current_run_role', ${actor.runRole}, true)
    `;
    const rows = await transaction<Array<{ completion_result: string }>>`
      select completion_result
      from app.complete_club_wallet_challenge(
        ${challenge.id}::uuid,
        ${challenge.address},
        decode(${challenge.messageHashHex}, 'hex')
      )
    `;
    return rows[0]?.completion_result;
  });
}

test("club wallet authority is server-derived, expiring and revocable", async () => {
  await assert.rejects(
    runtimeA`select * from app.organization_wallet_authorities`,
    /permission denied for table organization_wallet_authorities/,
  );

  const initial = await withClubDatabaseContext(
    firstActor,
    currentClubWalletContextRecord,
  );
  assert.equal(initial?.name, "Test Club One");
  assert.equal(initial?.address, firstWallet);
  assert.equal(initial?.authority, null);

  await assert.rejects(
    withClubDatabaseContext(firstActor, async (transaction) => {
      const clock = await clubWalletChallengeClock(transaction);
      await issueClubWalletChallengeRecord(transaction, {
        id: clock.id,
        address: secondWallet,
        origin: "http://localhost:3100",
        nonceHashHex: hashHex("wrong-wallet-nonce"),
        messageHashHex: hashHex("wrong-wallet-message"),
        issuedAt: clock.issuedAt,
        expiresAt: new Date(
          new Date(clock.issuedAt).getTime() + 5 * 60 * 1_000,
        ).toISOString(),
      });
    }),
    ClubWalletStateConflictError,
  );

  const challenge = await issueChallenge(firstActor, "first");
  assert.equal(
    (await completeChallenge(secondActor, challenge)).result,
    "invalid-proof",
  );
  assert.equal(
    (
      await completeChallenge(firstActor, {
        ...challenge,
        messageHashHex: hashHex("tampered"),
      })
    ).result,
    "invalid-proof",
  );
  assert.equal(
    (await completeChallenge(firstActor, challenge, replacementAuthSessionId))
      .result,
    "invalid-proof",
  );

  const authorized = await completeChallenge(firstActor, challenge);
  assert.equal(authorized.result, "authorized");
  if (authorized.result === "authorized") {
    assert.equal(authorized.context.name, "Test Club One");
    assert.equal(authorized.context.address, firstWallet);
    assert.equal(
      new Date(authorized.context.authority!.expiresAt).getTime() -
        new Date(authorized.context.authority!.grantedAt).getTime(),
      10 * 60 * 1_000,
    );
  }
  assert.equal(
    (await completeChallenge(firstActor, challenge)).result,
    "invalid-proof",
  );

  const active = await withClubDatabaseContext(
    firstActor,
    currentClubWalletContextRecord,
  );
  assert.ok(active?.authority);

  const replacedSession = await withClubDatabaseContext(
    firstActor,
    currentClubWalletContextRecord,
    replacementAuthSessionId,
  );
  assert.equal(replacedSession?.authority, null);
  const replacedRevocation = await admin<Array<{ revocation_reason: string }>>`
    select revocation_reason
    from app.organization_wallet_authorities
    where challenge_id = ${challenge.id}::uuid
  `;
  assert.equal(replacedRevocation[0]?.revocation_reason, "context-changed");

  const expiringChallenge = await issueChallenge(
    firstActor,
    "expiry",
    replacementAuthSessionId,
  );
  assert.equal(
    (
      await completeChallenge(
        firstActor,
        expiringChallenge,
        replacementAuthSessionId,
      )
    ).result,
    "authorized",
  );
  await admin`
    update app.organization_wallet_authorities
    set
      granted_at = granted_at - interval '11 minutes',
      expires_at = expires_at - interval '11 minutes'
    where challenge_id = ${expiringChallenge.id}::uuid
  `;
  assert.equal(
    (
      await withClubDatabaseContext(
        firstActor,
        currentClubWalletContextRecord,
        replacementAuthSessionId,
      )
    )?.authority,
    null,
  );
  const expiryRevocation = await admin<Array<{ revocation_reason: string }>>`
    select revocation_reason
    from app.organization_wallet_authorities
    where challenge_id = ${expiringChallenge.id}::uuid
  `;
  assert.equal(expiryRevocation[0]?.revocation_reason, "expired");

  const revocableChallenge = await issueChallenge(
    firstActor,
    "explicit-revocation",
    replacementAuthSessionId,
  );
  assert.equal(
    (
      await completeChallenge(
        firstActor,
        revocableChallenge,
        replacementAuthSessionId,
      )
    ).result,
    "authorized",
  );
  assert.equal(
    await withClubDatabaseContext(
      firstActor,
      revokeClubWalletAuthorityRecord,
      replacementAuthSessionId,
    ),
    "revoked",
  );
  assert.equal(
    (
      await withClubDatabaseContext(
        firstActor,
        currentClubWalletContextRecord,
        replacementAuthSessionId,
      )
    )?.authority,
    null,
  );
});

test("club authority fails closed for role changes and concurrent proof reuse", async () => {
  const challenge = await issueChallenge(firstActor, "concurrent");
  const outcomes = await Promise.all([
    completeWithRuntime(runtimeA, firstActor, challenge),
    completeWithRuntime(runtimeB, firstActor, challenge),
  ]);
  assert.deepEqual(outcomes.sort(), ["authorized", "invalid-proof"]);

  await admin`
    update app.organization_memberships
    set role = 'admin'
    where run_id = ${runId}::uuid
      and organization_id = ${firstOrganizationId}::uuid
      and profile_id = ${firstActor.profileId}::uuid
  `;
  assert.equal(
    await withClubDatabaseContext(firstActor, currentClubWalletContextRecord),
    null,
  );

  const revocation = await admin<Array<{ revocation_reason: string }>>`
    select revocation_reason
    from app.organization_wallet_authorities
    where auth_user_id = ${firstAuthUserId}::uuid
    order by granted_at desc
    limit 1
  `;
  assert.equal(revocation[0]?.revocation_reason, "context-changed");
});

test("one wallet cannot be both a personal and club owner", async () => {
  await assert.rejects(
    admin`
      insert into app.wallet_bindings (
        run_id,
        cluster,
        wallet_address,
        owner_type,
        profile_id,
        organization_id,
        bound_by_auth_user_id,
        provenance,
        status,
        verified_at
      )
      values (
        ${runId}::uuid,
        'solana:devnet',
        ${firstWallet},
        'personal',
        ${secondActor.profileId}::uuid,
        null,
        ${secondAuthUserId}::uuid,
        'prepared',
        'active',
        statement_timestamp()
      )
    `,
    /wallet_bindings_active_wallet_owner_idx/,
  );
});
