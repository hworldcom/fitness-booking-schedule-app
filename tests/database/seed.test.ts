import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_TEST_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error(
    "Seed checks require an explicit loopback DATABASE_TEST_URL.",
  );

class RollbackFixture extends Error {}

test("complete repeated seed preserves claimed coaches, ordinary accounts and retained rows", async () => {
  const db = postgres(url, { max: 1, prepare: false, ssl: false });
  const seed = readFileSync("supabase/seed.sql", "utf8");
  try {
    await assert.rejects(
      db.begin(async (tx) => {
        await tx.unsafe(seed);
        const ordinaryAuth = randomUUID();
        await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${ordinaryAuth}::uuid,false,false)`;
        await tx`select * from app.enroll_application_identity(${ordinaryAuth}::uuid,'Preserved ordinary seed account')`;
        const claimedAuth = "90000000-0000-4000-8000-000000000002";
        await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${claimedAuth}::uuid,false,false) on conflict do nothing`;
        await tx`update app.profiles set auth_user_id=${claimedAuth}::uuid,record_source='user',claimed_at=clock_timestamp(),display_name='Preserved claimed coach' where id='10000000-0000-4000-8000-000000000002'`;
        await tx`update app.coach_profiles set record_source='user',bio='A claimed coach keeps their own biography and removed portrait.',portrait_source=null,portrait_path=null,portrait_updated_at=null where profile_id='10000000-0000-4000-8000-000000000002'`;
        await tx`delete from app.coach_profile_disciplines where profile_id='10000000-0000-4000-8000-000000000002'`;
        await tx`insert into app.coach_profile_disciplines(run_id,profile_id,discipline,sort_order) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Muay Thai',3)`;
        const relations = await tx<{ name: string }[]>`
          select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='app' and c.relkind='r' order by c.relname`;
        async function hashes() {
          const result: Record<string, string | null> = {};
          for (const { name } of relations) {
            const [row] = await tx<{ hash: string | null }[]>`
              select md5(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text) hash from ${tx(`app.${name}`)} t`;
            result[name] = row.hash;
          }
          return result;
        }
        const before = await hashes();
        await tx.unsafe(seed);
        await tx.unsafe(seed);
        const after = await hashes();
        for (const { name } of relations)
          assert.equal(
            after[name],
            before[name],
            `Repeated seed changed ${name}`,
          );
        const [coach] =
          await tx`select portrait_source from app.coach_profiles where profile_id='10000000-0000-4000-8000-000000000002'`;
        assert.equal(coach.portrait_source, null);
        const disciplines =
          await tx`select discipline,sort_order from app.coach_profile_disciplines where profile_id='10000000-0000-4000-8000-000000000002'`;
        assert.deepEqual(
          [...disciplines],
          [{ discipline: "Muay Thai", sort_order: 3 }],
        );
        throw new RollbackFixture();
      }),
      RollbackFixture,
    );
  } finally {
    await db.end();
  }
});
