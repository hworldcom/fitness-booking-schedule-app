import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  DEMO_COACH_FIXTURES,
  demoCoachDefaultsStatements,
  demoCoachPublicUrlStatements,
} from "../../scripts/lib/demo-coach-fixtures";

const target = process.env.DATABASE_TEST_URL
  ? new URL(process.env.DATABASE_TEST_URL)
  : null;
const disposable = Boolean(
  target &&
  ["localhost", "127.0.0.1"].includes(target.hostname) &&
  target.port === "55322" &&
  /^\/dev0347_[a-z0-9_]+$/.test(target.pathname),
);
const ids = DEMO_COACH_FIXTURES.map((c) => c.profileId);

async function fixture(run: (tx: postgres.TransactionSql) => Promise<void>) {
  const db = postgres(target!.toString(), {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  const rollback = new Error("Roll back isolated URL test");
  try {
    await db
      .begin(async (tx) => {
        for (const coach of DEMO_COACH_FIXTURES)
          await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${coach.authUserId}::uuid,false,false)`;
        await tx.unsafe(demoCoachDefaultsStatements(ids, [], []));
        await run(tx);
        throw rollback;
      })
      .catch((error) => {
        if (error !== rollback) throw error;
      });
  } finally {
    await db.end({ timeout: 5 });
  }
}

async function fingerprints(tx: postgres.TransactionSql, excludeUrls = false) {
  const result: Record<string, string> = {};
  const tables =
    await tx`select schemaname,tablename from pg_tables where schemaname in ('app','auth','storage') order by schemaname,tablename`;
  for (const { schemaname, tablename } of tables) {
    if (
      excludeUrls &&
      schemaname === "app" &&
      ["coach_public_handles", "account_personal_details"].includes(tablename)
    )
      continue;
    const rows =
      await tx`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) hash from ${tx(schemaname + "." + tablename)} t`;
    result[`${schemaname}.${tablename}`] = rows[0].hash;
  }
  return result;
}

test(
  "fresh URLs, repeat publication and later owner renames preserve all other data",
  { skip: !disposable },
  async () =>
    fixture(async (tx) => {
      const coach = DEMO_COACH_FIXTURES[0];
      await tx`insert into app.account_personal_details(profile_id,legal_name,birthdate,gender,revision) values(${coach.profileId}::uuid,'Private legal name','1990-01-01','Self described',7)`;
      const before = await fingerprints(tx, true);
      await tx.unsafe(demoCoachPublicUrlStatements(ids));
      assert.deepEqual(await fingerprints(tx, true), before);
      const [personal] =
        await tx`select legal_name,birthdate::text,gender,revision from app.account_personal_details where profile_id=${coach.profileId}::uuid`;
      assert.deepEqual(
        { ...personal },
        {
          legal_name: "Private legal name",
          birthdate: "1990-01-01",
          gender: "Self described",
          revision: 8,
        },
      );
      for (const c of DEMO_COACH_FIXTURES) {
        const rows =
          await tx`select * from app.public_coach_handle(${c.username},false)`;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].public_slug, c.slug);
        assert.equal(rows[0].username, c.username);
      }
      const published = await fingerprints(tx);
      await tx.unsafe(demoCoachPublicUrlStatements(ids));
      assert.deepEqual(await fingerprints(tx), published);
      await tx`update app.account_personal_details set username='daniel_owner_changed',revision=revision+1 where profile_id=${coach.profileId}::uuid`;
      const renamed = await fingerprints(tx);
      await tx.unsafe(demoCoachPublicUrlStatements(ids));
      assert.deepEqual(await fingerprints(tx), renamed);
      const [alias] =
        await tx`select * from app.public_coach_handle(${coach.username},false)`;
      assert.equal(alias.username, "daniel_owner_changed");
      await tx`update app.coach_profiles set visibility='hidden' where profile_id=${coach.profileId}::uuid`;
      const hidden = await fingerprints(tx);
      await tx.unsafe(demoCoachPublicUrlStatements(ids));
      assert.deepEqual(await fingerprints(tx), hidden);
      assert.equal(
        (
          await tx`select * from app.public_coach_handle(${coach.username},false)`
        ).length,
        0,
      );
    }),
);

for (const conflict of [
  "current-claim",
  "foreign-alias",
  "tombstone",
  "private-custom",
  "wrong-identity",
] as const)
  test(
    `URL batch rolls back earlier entries on ${conflict}`,
    { skip: !disposable },
    async () =>
      fixture(async (tx) => {
        const last = DEMO_COACH_FIXTURES.at(-1)!;
        const [other] =
          await tx`select id from app.profiles where not(id=any(${ids}::uuid[])) order by id limit 1`;
        assert.ok(other);
        if (conflict === "current-claim")
          await tx`insert into app.account_personal_details(profile_id,username) values(${other.id}::uuid,${last.username})`;
        if (conflict === "foreign-alias" || conflict === "tombstone")
          await tx`insert into app.coach_public_handles(username,profile_id) values(${last.username},${conflict === "tombstone" ? null : other.id}::uuid)`;
        if (conflict === "private-custom")
          await tx`insert into app.account_personal_details(profile_id,username) values(${last.profileId}::uuid,'private_owner_choice')`;
        if (conflict === "wrong-identity")
          await tx`update app.coach_profiles set public_slug='different-demo-identity',portrait_source=null,portrait_path=null,portrait_updated_at=null where profile_id=${last.profileId}::uuid`;
        const before = await fingerprints(tx);
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp.unsafe(demoCoachPublicUrlStatements(ids));
          }),
        );
        assert.deepEqual(await fingerprints(tx), before);
      }),
  );
