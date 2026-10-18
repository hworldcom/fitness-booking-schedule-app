import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import {
  DEMO_COACH_FIXTURES,
  demoCoachDefaultsStatements,
  fitnessDemoCoachSeedSql,
} from "../../scripts/lib/demo-coach-fixtures";
import { assertDemoLocalTarget } from "../../scripts/lib/demo-coach-target";

test("demo defaults initialize exact fixture accounts and preserve later edits, cleared portraits and history", async () => {
  const url = process.env.DATABASE_TEST_URL;
  assert.ok(url);
  assertDemoLocalTarget({
    apiUrl: "http://127.0.0.1:55321",
    databaseUrl: url,
    serviceRoleKey: "unused",
    publishableKey: "unused",
  });
  const db = postgres(url, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  const rollback = new Error("Roll back synthetic demo fixture edits.");
  try {
    await db
      .begin(async (tx) => {
        await tx.unsafe(
          fitnessDemoCoachSeedSql(readFileSync("supabase/seed.sql", "utf8")),
        );
        const ids = DEMO_COACH_FIXTURES.map((coach) => coach.profileId);
        // All changes in this test are rolled back, including synthetic edits.
        const before =
          await tx`select md5(jsonb_agg(to_jsonb(b) order by b.id)::text) hash from app.coach_private_bookings b`;
        for (const coach of DEMO_COACH_FIXTURES) {
          await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${coach.authUserId}::uuid,false,false) on conflict do nothing`;
          await tx`update app.profiles set auth_user_id=null,record_source='fixture',claimed_at=null where id=${coach.profileId}::uuid`;
          await tx`update app.demo_run_participants set role=${coach.seedParticipantRole} where profile_id=${coach.profileId}::uuid`;
          await tx`update app.coach_profiles set record_source='fixture',bio=${coach.previousBio},portrait_source=null,portrait_path=null,portrait_updated_at=null where profile_id=${coach.profileId}::uuid`;
        }
        await tx.unsafe(demoCoachDefaultsStatements(ids, [], []));
        const initial =
          await tx`select c.profile_id,c.bio,c.portrait_path,p.auth_user_id,d.role from app.coach_profiles c join app.profiles p on p.id=c.profile_id join app.demo_run_participants d on d.profile_id=p.id and d.run_id=c.run_id where p.id in ${tx(ids)} order by p.id`;
        assert.equal(initial.length, DEMO_COACH_FIXTURES.length);
        for (const coach of DEMO_COACH_FIXTURES) {
          const row = initial.find(
            (row) => row.profile_id === coach.profileId,
          )!;
          assert.equal(row.auth_user_id, coach.authUserId);
          assert.equal(row.bio, coach.bio);
          assert.equal(row.portrait_path, coach.portraitPath);
          assert.equal(row.role, "member");
        }
        const coach = DEMO_COACH_FIXTURES[1];
        await tx`update app.coach_profiles set bio='Tester-created biography with enough detail for the real coaching profile.',visibility='hidden',portrait_source=null,portrait_path=null,portrait_updated_at=null where profile_id=${coach.profileId}::uuid`;
        await tx`update app.profiles set display_name='Tester display name' where id=${coach.profileId}::uuid`;
        const snapshot =
          await tx`select to_jsonb(c) value from app.coach_profiles c where c.profile_id in ${tx(ids)} order by c.profile_id`;
        await tx.unsafe(demoCoachDefaultsStatements([], [], []));
        assert.deepEqual(
          await tx`select to_jsonb(c) value from app.coach_profiles c where c.profile_id in ${tx(ids)} order by c.profile_id`,
          snapshot,
        );
        assert.equal(
          (
            await tx`select display_name from app.profiles where id=${coach.profileId}::uuid`
          )[0].display_name,
          "Tester display name",
        );
        // The normal seed must also preserve all claimed profiles after this setup.
        await tx.unsafe(readFileSync("supabase/seed.sql", "utf8"));
        assert.deepEqual(
          await tx`select to_jsonb(c) value from app.coach_profiles c where c.profile_id in ${tx(ids)} order by c.profile_id`,
          snapshot,
        );
        assert.deepEqual(
          await tx`select md5(jsonb_agg(to_jsonb(b) order by b.id)::text) hash from app.coach_private_bookings b`,
          before,
        );
        throw rollback;
      })
      .catch((error) => {
        if (error !== rollback) throw error;
      });
  } finally {
    await db.end({ timeout: 5 });
  }
});
