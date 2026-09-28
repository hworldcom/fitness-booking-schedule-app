import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { after, before } from "node:test";
import postgres from "postgres";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import {
  PersonalWalletStateConflictError,
  completePersonalWalletChallengeRecord,
  currentPersonalWalletBinding,
  issuePersonalWalletChallengeRecord,
  personalWalletChallengeClock,
  unlinkPersonalWalletRecord,
} from "@/server/db/wallet/repository";
import type { PersonalWalletPurpose } from "@/solana/personal-wallet";

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

const firstAuthUserId = "94000000-0000-4000-8000-000000000001";
const secondAuthUserId = "94000000-0000-4000-8000-000000000002";
const firstWallet = "11111111111111111111111111111111";
const secondWallet = "Vote111111111111111111111111111111111111111";
const contestedWallet = "Stake11111111111111111111111111111111111111";

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

function errorChainIncludes(error: unknown, message: string) {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "message" in current &&
      typeof current.message === "string" &&
      current.message.includes(message)
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

async function removeFixtures() {
  await admin`
    delete from app.wallet_bindings
    where bound_by_auth_user_id in (
      ${firstAuthUserId}::uuid,
      ${secondAuthUserId}::uuid
    )
  `;
  await admin`
    delete from app.auth_challenges
    where auth_user_id in (
      ${firstAuthUserId}::uuid,
      ${secondAuthUserId}::uuid
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
  const first = await enrollApplicationProfile(firstAuthUserId, "Wallet One");
  const second = await enrollApplicationProfile(secondAuthUserId, "Wallet Two");
  assert.ok(first);
  assert.ok(second);
  firstActor = actorFromRecord(firstAuthUserId, first);
  secondActor = actorFromRecord(secondAuthUserId, second);
});

after(async () => {
  await runtimeA.end();
  await runtimeB.end();
  await removeFixtures();
  await admin.end();
});

async function issueChallenge(
  actor: AuthorizedActor,
  purpose: PersonalWalletPurpose,
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
      purpose,
      address: walletAddress,
      origin: "http://localhost:3100",
      nonceHashHex: hashHex(`nonce:${marker}`),
      messageHashHex,
      issuedAt: clock.issuedAt,
      expiresAt,
    });
    return { id: clock.id, messageHashHex };
  });
}

async function completeChallenge(
  actor: AuthorizedActor,
  challenge: { id: string; messageHashHex: string },
  purpose: PersonalWalletPurpose,
  walletAddress: string,
  reauthenticatedAt: string | null = null,
) {
  return withActorDatabaseContext(actor, (transaction) =>
    completePersonalWalletChallengeRecord(transaction, {
      id: challenge.id,
      purpose,
      address: walletAddress,
      messageHashHex: challenge.messageHashHex,
      reauthenticatedAt,
    }),
  );
}

async function assertInvalidProof(
  result: ReturnType<typeof completeChallenge>,
) {
  assert.equal((await result).result, "invalid-proof");
}

async function completeWithRuntime(
  connection: typeof runtimeA,
  actor: AuthorizedActor,
  challenge: { id: string; messageHashHex: string },
) {
  return connection.begin(async (transaction) => {
    await transaction`
      select
        set_config('app.current_auth_user_id', ${actor.authUserId}, true),
        set_config('app.current_profile_id', ${actor.profileId}, true),
        set_config('app.current_run_id', ${actor.runId}, true),
        set_config('app.current_run_role', ${actor.runRole}, true)
    `;
    const rows = await transaction<Array<{ completion_result: string }>>`
      select completion_result
      from app.complete_personal_wallet_challenge(
        ${challenge.id}::uuid,
        'link-personal-wallet',
        ${contestedWallet},
        decode(${challenge.messageHashHex}, 'hex'),
        null
      )
    `;
    return rows[0]?.completion_result;
  });
}

test("wallet challenge lifecycle is atomic, exclusive and auditable", async () => {
  await assert.rejects(
    runtimeA`insert into app.auth_challenges (id) values (gen_random_uuid())`,
    /permission denied for table auth_challenges/,
  );
  await assert.rejects(
    runtimeA`insert into app.wallet_bindings (wallet_address) values (${firstWallet})`,
    /permission denied for table wallet_bindings/,
  );

  const firstLink = await issueChallenge(
    firstActor,
    "link-personal-wallet",
    firstWallet,
    "first-link",
  );
  await assertInvalidProof(
    completeChallenge(
      secondActor,
      firstLink,
      "link-personal-wallet",
      firstWallet,
    ),
  );
  await assertInvalidProof(
    completeChallenge(
      firstActor,
      firstLink,
      "link-personal-wallet",
      secondWallet,
    ),
  );
  await assertInvalidProof(
    completeChallenge(
      firstActor,
      { ...firstLink, messageHashHex: hashHex("changed-message") },
      "link-personal-wallet",
      firstWallet,
    ),
  );
  await assertInvalidProof(
    completeChallenge(
      firstActor,
      firstLink,
      "replace-personal-wallet",
      firstWallet,
      new Date().toISOString(),
    ),
  );
  const linked = await completeChallenge(
    firstActor,
    firstLink,
    "link-personal-wallet",
    firstWallet,
  );
  assert.equal(linked.result, "linked");

  await assert.rejects(
    issueChallenge(
      firstActor,
      "link-personal-wallet",
      secondWallet,
      "second-link",
    ),
    PersonalWalletStateConflictError,
  );
  await assert.rejects(
    issueChallenge(
      firstActor,
      "replace-personal-wallet",
      firstWallet,
      "same-wallet-replacement",
    ),
    PersonalWalletStateConflictError,
  );

  await assertInvalidProof(
    completeChallenge(
      firstActor,
      firstLink,
      "link-personal-wallet",
      firstWallet,
    ),
  );

  const expired = await issueChallenge(
    secondActor,
    "link-personal-wallet",
    secondWallet,
    "expired",
  );
  await admin`
    update app.auth_challenges
    set
      issued_at = issued_at - interval '6 minutes',
      expires_at = expires_at - interval '6 minutes'
    where id = ${expired.id}::uuid
  `;
  await assertInvalidProof(
    completeChallenge(
      secondActor,
      expired,
      "link-personal-wallet",
      secondWallet,
    ),
  );

  const collision = await issueChallenge(
    secondActor,
    "link-personal-wallet",
    firstWallet,
    "collision",
  );
  assert.equal(
    (
      await completeChallenge(
        secondActor,
        collision,
        "link-personal-wallet",
        firstWallet,
      )
    ).result,
    "wallet-conflict",
  );

  const replacement = await issueChallenge(
    firstActor,
    "replace-personal-wallet",
    secondWallet,
    "replace",
  );
  await assert.rejects(
    completeChallenge(
      firstActor,
      replacement,
      "replace-personal-wallet",
      secondWallet,
      new Date(Date.now() - 11 * 60 * 1_000).toISOString(),
    ),
    (error) => errorChainIncludes(error, "wallet proof request is invalid"),
  );
  const replaced = await completeChallenge(
    firstActor,
    replacement,
    "replace-personal-wallet",
    secondWallet,
    new Date().toISOString(),
  );
  assert.equal(replaced.result, "replaced");
  assert.equal(replaced.binding.address, secondWallet);

  const replacementHistory = await admin<
    Array<{
      old_status: string;
      revocation_reason: string;
      replacement_binding_id: string;
      new_id: string;
    }>
  >`
    select
      old.status as old_status,
      old.revocation_reason,
      old.replacement_binding_id,
      replacement.id as new_id
    from app.wallet_bindings as old
    join app.wallet_bindings as replacement
      on replacement.id = old.replacement_binding_id
    where old.bound_by_auth_user_id = ${firstAuthUserId}::uuid
      and old.wallet_address = ${firstWallet}
  `;
  assert.deepEqual(
    { ...replacementHistory[0] },
    {
      old_status: "revoked",
      revocation_reason: "replaced",
      replacement_binding_id: replaced.binding.id,
      new_id: replaced.binding.id,
    },
  );

  await assert.rejects(
    withActorDatabaseContext(firstActor, (transaction) =>
      unlinkPersonalWalletRecord(
        transaction,
        new Date(Date.now() - 11 * 60 * 1_000).toISOString(),
      ),
    ),
    (error) =>
      errorChainIncludes(error, "recent email authentication is required"),
  );
  assert.equal(
    await withActorDatabaseContext(firstActor, (transaction) =>
      unlinkPersonalWalletRecord(transaction, new Date().toISOString()),
    ),
    "unlinked",
  );
  assert.equal(
    await withActorDatabaseContext(firstActor, currentPersonalWalletBinding),
    null,
  );

  const firstClaim = await issueChallenge(
    firstActor,
    "link-personal-wallet",
    contestedWallet,
    "contested-first",
  );
  const secondClaim = await issueChallenge(
    secondActor,
    "link-personal-wallet",
    contestedWallet,
    "contested-second",
  );
  const outcomes = await Promise.all([
    completeWithRuntime(runtimeA, firstActor, firstClaim),
    completeWithRuntime(runtimeB, secondActor, secondClaim),
  ]);
  assert.deepEqual(outcomes.sort(), ["linked", "wallet-conflict"]);

  const activeClaims = await admin<{ count: string }[]>`
    select count(*)::text as count
    from app.wallet_bindings
    where wallet_address = ${contestedWallet}
      and status = 'active'
  `;
  assert.equal(activeClaims[0]?.count, "1");
});
