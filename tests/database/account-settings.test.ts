import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { isAccountResult } from "@/account/contracts";

const url = process.env.DATABASE_TEST_URL;
if (!url) throw new Error("DATABASE_TEST_URL is required.");
const migration = readFileSync(
  "supabase/migrations/20261017000600_account_names_and_usernames.sql",
  "utf8",
);
type Actor = { auth: string; id: string; run: string };
type Sql = postgres.TransactionSql;
async function act(tx: Sql, actor: Actor) {
  await tx.unsafe("reset role");
  await tx.unsafe("set local role app_runtime");
  await tx`select set_config('app.current_auth_user_id',${actor.auth},true),set_config('app.current_profile_id',${actor.id},true),set_config('app.current_run_id',${actor.run},true),set_config('app.current_run_role','member',true)`;
}
async function read(tx: Sql, actor: Actor) {
  await act(tx, actor);
  const [row] = await tx`select app.current_account_settings() details`;
  assert.ok(isAccountResult({ status: "ready", details: row.details }));
  return row.details;
}
async function save(
  tx: Sql,
  actor: Actor,
  section: string,
  values: Record<string, unknown>,
  revision: number,
) {
  await act(tx, actor);
  return (
    await tx`select app.update_current_account_settings(${section},${tx.json(values as postgres.JSONValue)},${revision}) result`
  )[0].result;
}
async function message(
  tx: Sql,
  actor: Actor,
  action: string,
  args: Record<string, unknown>,
) {
  await act(tx, actor);
  return (
    await tx`select app.message_command(${action},${tx.json(args as postgres.JSONValue)}) result`
  )[0].result;
}
const personal = {
  legalName: "Morgan Private Legal",
  preferredFirstName: null,
  birthdate: null,
  gender: null,
};
class RollbackOnly extends Error {}

test("private account names, reserved usernames and current chat presentation", async (t) => {
  const db = postgres(url, {
    max: 1,
    ssl: false,
    prepare: false,
    onnotice: () => {},
  });
  try {
    await db.begin(async (tx) => {
      if (
        !(
          await tx`select 1 from information_schema.columns where table_schema='app' and table_name='profiles' and column_name='chat_first_name'`
        ).length
      )
        await tx.unsafe(migration).simple();
      const actors: Actor[] = [];
      for (const name of ["Legacy Member", "Other Person", "Coach Person"]) {
        const auth = randomUUID();
        await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${auth}::uuid,false,false)`;
        const [identity] =
          await tx`select * from app.enroll_application_identity(${auth}::uuid,${name})`;
        actors.push({
          auth,
          id: identity.identity_profile_id,
          run: identity.identity_run_id,
        });
      }
      const [owner, other, coach] = actors;
      await t.test(
        "new private fields remain absent for retained identities",
        async () => {
          const details = await read(tx, owner);
          assert.equal(details.displayName, "Legacy Member");
          assert.equal(details.legalName, null);
          assert.equal(details.preferredFirstName, null);
          assert.equal(details.username, null);
          assert.equal(details.revision, 0);
        },
      );
      await t.test(
        "owner saves legal name privately and derives only the first name for chat",
        async () => {
          const result = await save(tx, owner, "personal-details", personal, 0);
          assert.equal(result.status, "ready");
          assert.equal(result.details.legalName, personal.legalName);
          assert.equal(result.details.displayName, "Legacy Member");
          await tx.unsafe("reset role");
          assert.deepEqual(
            (
              await tx`select display_name,chat_first_name from app.profiles where id=${owner.id}::uuid`
            )[0],
            { display_name: "Legacy Member", chat_first_name: "Morgan" },
          );
        },
      );
      await t.test(
        "exact retry is idempotent and changed stale input conflicts",
        async () => {
          assert.equal(
            (await save(tx, owner, "personal-details", personal, 0)).status,
            "ready",
          );
          assert.equal((await read(tx, owner)).revision, 1);
          assert.equal(
            (
              await save(
                tx,
                owner,
                "personal-details",
                { ...personal, preferredFirstName: "Changed" },
                0,
              )
            ).status,
            "conflict",
          );
        },
      );
      await t.test(
        "database rejects malformed, cross-section and future private values",
        async () => {
          for (const values of [
            { ...personal, legalName: "A" },
            { ...personal, preferredFirstName: "x\nY" },
            { ...personal, birthdate: "2025-02-29" },
            { ...personal, birthdate: "3000-01-01" },
            { ...personal, username: "hidden_write" },
          ])
            assert.equal(
              (await save(tx, owner, "personal-details", values, 1)).status,
              "invalid",
            );
          assert.equal((await read(tx, owner)).revision, 1);
        },
      );
      await t.test(
        "reserved login username normalizes without changing personal/chat names",
        async () => {
          const result = await save(
            tx,
            owner,
            "login-security",
            { username: " Reserve_This " },
            1,
          );
          assert.equal(result.status, "ready");
          assert.equal(result.details.username, "reserve_this");
          assert.equal(result.details.legalName, personal.legalName);
          assert.equal(result.details.revision, 2);
          assert.equal(
            (
              await save(
                tx,
                other,
                "login-security",
                { username: "RESERVE_THIS" },
                0,
              )
            ).status,
            "username-taken",
          );
          assert.equal((await read(tx, other)).revision, 0);
        },
      );
      await t.test(
        "private legal/username rows and mutation entry points remain owner-only",
        async () => {
          await act(tx, other);
          assert.equal(
            (
              await tx`select count(*)::int n from app.account_personal_details where profile_id=${owner.id}::uuid`
            )[0].n,
            0,
          );
          assert.equal(
            (
              await tx`select has_table_privilege('app_runtime','app.account_personal_details','update') allowed`
            )[0].allowed,
            false,
          );
          assert.equal(
            (
              await tx`select has_function_privilege('anon','app.update_current_account_settings(text,jsonb,integer)','execute') allowed`
            )[0].allowed,
            false,
          );
          await assert.rejects(
            tx.savepoint(async (s) => {
              await act(s, { ...owner, auth: other.auth });
              await s`select app.current_account_settings()`;
            }),
            /account settings actor unavailable/,
          );
        },
      );
      await act(tx, coach);
      await tx`select app.submit_owned_coach_application()`;
      await tx`select app.upsert_owned_coach_profile('Public Coaching Name','Focused private boxing practice with clear session preparation for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
      await tx.unsafe("reset role");
      await tx`select app.review_coach_application(${coach.id}::uuid,'pending','approved','DEV0295 fixture reviewed.','database-test','movx-identity-application-v1')`;
      await tx`update app.coach_profiles set visibility='visible' where profile_id=${coach.id}::uuid`;
      await t.test(
        "contact defaults to the coach personal first name without changing public coach name",
        async () => {
          const contact = await message(tx, owner, "contact", {
            coachId: coach.id,
          });
          assert.equal(contact.name, "Coach");
        },
      );
      const saved = await message(tx, owner, "inquire", {
        coachId: coach.id,
        submissionId: randomUUID(),
        body: "Account name fixture message.",
      });
      const conversationId = saved.conversationId;
      await t.test(
        "both chat roles show default or explicit preferred names without private account fields",
        async () => {
          assert.equal(
            (
              await save(
                tx,
                coach,
                "personal-details",
                {
                  ...personal,
                  legalName: "Coach Private Legal",
                  preferredFirstName: "Casey",
                },
                0,
              )
            ).status,
            "ready",
          );
          const coachThread = await message(tx, coach, "thread", {
            conversationId,
          });
          const athleteThread = await message(tx, owner, "thread", {
            conversationId,
          });
          assert.equal(coachThread.conversation.counterpartName, "Morgan");
          assert.equal(athleteThread.conversation.counterpartName, "Casey");
          assert.equal(
            (await message(tx, owner, "contact", { coachId: coach.id })).name,
            "Casey",
          );
          for (const value of [
            coachThread,
            athleteThread,
            await message(tx, coach, "inbox", {}),
          ])
            assert.doesNotMatch(
              JSON.stringify(value),
              /Morgan Private Legal|Coach Private Legal|reserve_this|legalName|username|preferredFirstName/,
            );
          await tx.unsafe("reset role");
          assert.equal(
            (
              await tx`select display_name from app.coach_profiles where profile_id=${coach.id}::uuid`
            )[0].display_name,
            "Public Coaching Name",
          );
        },
      );
      await t.test(
        "clearing preferred first name follows legal first name, and clearing legal name uses retained name",
        async () => {
          assert.equal(
            (
              await save(
                tx,
                owner,
                "personal-details",
                { ...personal, preferredFirstName: "M" },
                2,
              )
            ).status,
            "ready",
          );
          assert.equal(
            (await message(tx, coach, "thread", { conversationId }))
              .conversation.counterpartName,
            "M",
          );
          assert.equal(
            (await save(tx, owner, "personal-details", personal, 3)).status,
            "ready",
          );
          assert.equal(
            (await message(tx, coach, "thread", { conversationId }))
              .conversation.counterpartName,
            "Morgan",
          );
          assert.equal(
            (
              await save(
                tx,
                owner,
                "personal-details",
                { ...personal, legalName: null },
                4,
              )
            ).status,
            "ready",
          );
          assert.equal(
            (await message(tx, coach, "thread", { conversationId }))
              .conversation.counterpartName,
            "Legacy",
          );
        },
      );
      throw new RollbackOnly();
    });
  } catch (error) {
    if (!(error instanceof RollbackOnly)) throw error;
  } finally {
    await db.end();
  }
});

test("concurrent reserved username claims have exactly one winner and leave no fixtures", async () => {
  const db = postgres(url, {
    max: 4,
    ssl: false,
    prepare: false,
    onnotice: () => {},
  });
  const actors: Actor[] = [];
  try {
    // Concurrency runs only after the additive migration is installed locally.
    assert.ok(
      (
        await db`select 1 from information_schema.columns where table_schema='app' and table_name='account_personal_details' and column_name='username'`
      ).length,
      "Install the validated DEV0295 migration before the race check.",
    );
    for (const name of ["Concurrent Account One", "Concurrent Account Two"]) {
      const auth = randomUUID();
      await db.begin(async (tx) => {
        await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${auth}::uuid,false,false)`;
        const [identity] =
          await tx`select * from app.enroll_application_identity(${auth}::uuid,${name})`;
        actors.push({
          auth,
          id: identity.identity_profile_id,
          run: identity.identity_run_id,
        });
      });
    }
    const username = `dev0295_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const results = await Promise.all(
      actors.map((actor) =>
        db.begin((tx) => save(tx, actor, "login-security", { username }, 0)),
      ),
    );
    assert.deepEqual(results.map((result) => result.status).sort(), [
      "ready",
      "username-taken",
    ]);
    assert.equal(
      (
        await db`select count(*)::int n from app.account_personal_details where username=${username}`
      )[0].n,
      1,
    );
    const winnerIndex = results.findIndex(
      (result) => result.status === "ready",
    );
    const winner = actors[winnerIndex];
    const loser = actors[1 - winnerIndex];
    assert.equal((await db.begin((tx) => read(tx, loser))).revision, 0);
    assert.equal(
      (
        await db.begin((tx) =>
          save(tx, winner, "login-security", { username }, 0),
        )
      ).details.revision,
      1,
    );
    assert.equal(
      (
        await db.begin((tx) =>
          save(tx, winner, "login-security", { username: "altered_name" }, 0),
        )
      ).status,
      "conflict",
    );
    const values = {
      legalName: "Concurrency Private Name",
      preferredFirstName: null,
      birthdate: null,
      gender: null,
    };
    const personalRace = await Promise.all(
      ["Jordan", "Taylor"].map((preferredFirstName) =>
        db.begin((tx) =>
          save(
            tx,
            winner,
            "personal-details",
            { ...values, preferredFirstName },
            1,
          ),
        ),
      ),
    );
    assert.deepEqual(personalRace.map((result) => result.status).sort(), [
      "conflict",
      "ready",
    ]);
    assert.equal((await db.begin((tx) => read(tx, winner))).revision, 2);
  } finally {
    for (const actor of actors)
      await db.begin(async (tx) => {
        await tx`delete from app.account_personal_details where profile_id=${actor.id}::uuid`;
        await tx`delete from app.demo_run_participants where profile_id=${actor.id}::uuid`;
        await tx`delete from app.profiles where id=${actor.id}::uuid and auth_user_id=${actor.auth}::uuid`;
        await tx`delete from auth.users where id=${actor.auth}::uuid`;
      });
    for (const actor of actors)
      assert.equal(
        (
          await db`select count(*)::int n from auth.users where id=${actor.auth}::uuid`
        )[0].n,
        0,
      );
    await db.end();
  }
});
