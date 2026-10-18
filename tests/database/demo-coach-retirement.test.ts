import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import {
  DEMO_COACH_FIXTURES,
  demoCoachDefaultsStatements,
} from "../../scripts/lib/demo-coach-fixtures";
import {
  demoCoachRetirementStatements,
  demoRetirementProofStatements,
  demoRetirementSummarySql,
} from "../../scripts/lib/demo-coach-retirement";
import { completeApplicationRegistration } from "@/server/db/identity/repository";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";

const target = process.env.DATABASE_TEST_URL
  ? new URL(process.env.DATABASE_TEST_URL)
  : null;
const isolated = Boolean(
  target &&
  target.hostname === "127.0.0.1" &&
  target.port === "55322" &&
  /^\/dev0349_[a-z0-9_]+$/.test(target.pathname),
);
const empty = process.env.DEMO_RETIREMENT_EMPTY === "1";
let db: postgres.Sql;
let real: { authId: string; profileId: string; runId: string };
before(async () => {
  if (!isolated) return;
  db = postgres(target!.toString(), {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  if (empty) return;
  const runtime = new URL(target!.toString());
  runtime.username = "repx_runtime_login";
  runtime.password = "postgres";
  process.env.DATABASE_URL = runtime.toString();
  const authId = randomUUID();
  await db`insert into auth.users(id,is_sso_user,is_anonymous) values(${authId}::uuid,false,false)`;
  const identity = await completeApplicationRegistration(authId, {
    username: "real_uat_coach",
    fullName: "Private Real Tester",
    displayName: "Real UAT Coach",
  });
  assert.ok(identity);
  real = { authId, profileId: identity.profileId, runId: identity.runId };
  const actor = {
    authUserId: authId,
    profileId: real.profileId,
    runId: real.runId,
    runRole: "member" as const,
  };
  await withActorDatabaseContext(actor, submitOwnedCoachApplicationRecord);
  await withActorDatabaseContext(actor, (tx) =>
    upsertOwnedCoachProfileRecord(tx, {
      displayName: "Real UAT Coach",
      bio: "Real testing profile using normal registration and platform approval, never a fictional fixture.",
      disciplines: ["Boxing"],
      timezone: "Europe/Berlin",
      visibility: "hidden",
      selectedGymId: "40000000-0000-4000-8000-000000000001",
      independentLocation: null,
    }),
  );
  await db`select app.review_coach_application(${real.profileId}::uuid,'pending','approved','Synthetic real-user preservation test.','dev0349-test','movx-identity-application-v1')`;
  await db`update app.coach_profiles set visibility='visible' where profile_id=${real.profileId}::uuid`;
});
after(async () => {
  if (db) await db.end({ timeout: 5 });
});

async function fixture(
  run: (tx: postgres.TransactionSql) => Promise<void>,
  claimed = true,
) {
  const rollback = new Error("Roll back isolated retirement test");
  await db
    .begin(async (tx) => {
      if (claimed) {
        for (const c of DEMO_COACH_FIXTURES)
          await tx`insert into auth.users(id,email,raw_app_meta_data,is_sso_user,is_anonymous) values(${c.authUserId}::uuid,${c.email},${tx.json({ movx_coach_profile_id: c.profileId, movx_coach_slug: c.slug, movx_demo_environment: "dev" })},false,false)`;
        await tx.unsafe(
          demoCoachDefaultsStatements(
            DEMO_COACH_FIXTURES.map((c) => c.profileId),
            [],
            [],
          ),
        );
      }
      await run(tx);
      throw rollback;
    })
    .catch((error) => {
      if (error !== rollback) throw error;
    });
}
async function hashes(tx: postgres.TransactionSql) {
  const result: Record<string, string> = {};
  for (const row of await tx`select schemaname,tablename from pg_tables where schemaname in ('app','auth','storage') order by schemaname,tablename`) {
    const [value] =
      await tx`select md5(coalesce(jsonb_agg(to_jsonb(v) order by to_jsonb(v)::text)::text,'[]')) hash from ${tx(row.schemaname + "." + row.tablename)} v`;
    result[row.schemaname + "." + row.tablename] = value.hash;
  }
  return result;
}

test(
  "claimed hosted fixtures retire without changing a real approved coach, history or credentials; retry and seed replay preserve retirement",
  { skip: !isolated || empty },
  async () =>
    fixture(async (tx) => {
      const [realBefore] =
        await tx`select app.coach_website_is_public(${real.runId}::uuid,${real.profileId}::uuid) visible`;
      assert.equal(realBefore.visible, true);
      await tx.unsafe(demoRetirementProofStatements(true));
      const rows = await tx.unsafe(demoRetirementSummarySql);
      assert.equal(rows.length, 6);
      for (const row of rows) {
        assert.equal(row.visibility, "hidden");
        assert.equal(row.participant_status, "revoked");
        assert.equal(row.application_identities, 0);
        assert.equal(row.group_public, false);
      }
      assert.equal(
        (
          await tx`select * from app.current_application_identity(${real.authId}::uuid)`
        ).length,
        1,
      );
      assert.equal(
        (
          await tx`select app.coach_website_is_public(${real.runId}::uuid,${real.profileId}::uuid) visible`
        )[0].visible,
        true,
      );
      const before = await hashes(tx);
      await tx.unsafe(demoCoachRetirementStatements());
      await tx.unsafe(readFileSync("supabase/seed.sql", "utf8"));
      assert.deepEqual(await hashes(tx), before);
    }),
);

test(
  "check-only validates without changing any row",
  { skip: !isolated || empty },
  async () =>
    fixture(async (tx) => {
      const before = await hashes(tx);
      await tx.unsafe(demoRetirementProofStatements(false));
      assert.deepEqual(await hashes(tx), before);
    }),
);

test(
  "unclaimed fictional fixtures can retire without creating Auth users",
  { skip: !isolated || empty },
  async () =>
    fixture(async (tx) => {
      const before = (await tx`select count(*)::int count from auth.users`)[0]
        .count;
      await tx.unsafe(demoRetirementProofStatements(true));
      assert.equal(
        (await tx`select count(*)::int count from auth.users`)[0].count,
        before,
      );
    }, false),
);

for (const conflict of ["participant-role", "metadata", "wrong-slug"] as const)
  test(
    `retirement aborts atomically on ${conflict} ownership conflict`,
    { skip: !isolated || empty },
    async () =>
      fixture(async (tx) => {
        const c = DEMO_COACH_FIXTURES.at(-1)!;
        if (conflict === "participant-role")
          await tx`update app.demo_run_participants set role='operator' where profile_id=${c.profileId}::uuid`;
        if (conflict === "metadata")
          await tx`update auth.users set raw_app_meta_data='{}'::jsonb where id=${c.authUserId}::uuid`;
        if (conflict === "wrong-slug")
          await tx`update app.coach_profiles set public_slug='different-owner',portrait_source=null,portrait_path=null,portrait_updated_at=null where profile_id=${c.profileId}::uuid`;
        const before = await hashes(tx);
        await assert.rejects(
          tx.savepoint((sp) => sp.unsafe(demoCoachRetirementStatements())),
        );
        assert.deepEqual(await hashes(tx), before);
      }),
  );

test(
  "a fresh hosted schema without fictional profiles is an unchanged no-op",
  { skip: !isolated || !empty },
  async () =>
    fixture(async (tx) => {
      const before = await hashes(tx);
      await tx.unsafe(demoRetirementProofStatements(true));
      assert.deepEqual(await hashes(tx), before);
      assert.equal((await tx.unsafe(demoRetirementSummarySql)).length, 0);
    }, false),
);
