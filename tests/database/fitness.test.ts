import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { publicCoachDirectoryRecords } from "@/server/db/coaches/repository";
import { normalizeCoachDirectoryFilters } from "@/domain/coaches";
import { fitnessDemoCoachSeedSql } from "../../scripts/lib/demo-coach-fixtures";

test("Fitness migration preserves function security and supports profile/group persistence without resetting claimed fixtures", async () => {
  const url = new URL(process.env.DATABASE_TEST_URL!);
  assert.ok(
    ["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "55322",
  );
  assert.match(url.pathname, /^\/(?:postgres|dev0336_[a-z0-9_]+)$/);
  const db = postgres(url.toString(), {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  const rollback = new Error("Roll back Fitness rehearsal.");
  const migration = readFileSync(
    "supabase/migrations/20261018000500_fitness_discipline.sql",
    "utf8",
  );
  const seed = fitnessDemoCoachSeedSql(
    readFileSync("supabase/seed.sql", "utf8"),
  );
  try {
    await db
      .begin(async (tx) => {
        const metadata = () =>
          tx`select p.oid::regprocedure::text signature,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.provolatile,p.proparallel from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.proname in ('upsert_owned_coach_profile','create_owned_group_event_draft','update_owned_group_event_draft') order by signature`;
        const security = await metadata();
        assert.equal(security.length, 3);
        await tx.unsafe(migration);
        assert.deepEqual(await metadata(), security);
        await tx.unsafe(seed);
        const profile = "10000000-0000-4000-8000-000000000013",
          auth = "90000000-0000-4000-8000-000000000013",
          run = "20000000-0000-4000-8000-000000000001";
        assert.equal(
          (
            await tx`select count(*)::int n from app.coach_training_locations where profile_id=${profile}::uuid and is_primary and status='active' and location_confirmed_at is not null`
          )[0].n,
          1,
        );
        await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${auth}::uuid,false,false) on conflict do nothing`;
        await tx`update app.profiles set auth_user_id=${auth}::uuid,record_source='user',claimed_at=coalesce(claimed_at,statement_timestamp()) where id=${profile}::uuid`;
        await tx`update app.coach_profiles set record_source='user' where profile_id=${profile}::uuid`;
        await tx`select set_config('app.current_auth_user_id',${auth},true),set_config('app.current_profile_id',${profile},true),set_config('app.current_run_id',${run},true),set_config('app.current_run_role','member',true)`;
        await tx`set local role app_runtime`;
        const save = (discipline: string) =>
          tx`select app.upsert_owned_coach_profile('Jake Miller','Tester-edited strength and conditioning profile with enough detail.',array[${discipline}],'Europe/Berlin','visible','40000000-0000-4000-8000-000000000002'::uuid,null,null,null,null,null) slug`;
        assert.equal((await save("Fitness"))[0].slug, "jake-miller");
        const [venue] =
          await tx`select id from app.coach_training_locations where profile_id=${profile}::uuid and is_primary and status='active'`;
        const args = {
          id: "93360000-0000-4000-8000-000000000002",
          expectedRevision: null,
          title: "Strength basics",
          description: "Approachable fitness practice.",
          discipline: "Fitness",
          intendedLevel: "All levels",
          locationId: venue.id,
          startsAt: "2031-07-20T16:00:00Z",
          endsAt: "2031-07-20T17:00:00Z",
          decisionDeadlineAt: "2031-07-19T16:00:00Z",
          minimumParticipants: 2,
          maximumParticipants: 8,
          priceCents: 1500,
        };
        const [group] =
          await tx`select app.group_session_command('save-draft',${tx.json(args)}) result`;
        assert.equal(group.result.session.discipline, "Fitness");
        await assert.rejects(
          tx.savepoint(async (nested) => {
            await nested`select app.group_session_command('save-draft',${nested.json({ ...args, id: "93360000-0000-4000-8000-000000000003", discipline: "Yoga" })})`;
          }),
          /discipline is unavailable/,
        );
        await assert.rejects(
          tx.savepoint(async (nested) => {
            await nested`select app.upsert_owned_coach_profile('Jake Miller','Tester-edited strength and conditioning profile with enough detail.',array['Yoga'],'Europe/Berlin','visible','40000000-0000-4000-8000-000000000002'::uuid,null,null,null,null,null)`;
          }),
          /details are invalid/,
        );
        const event = "93360000-0000-4000-8000-000000000001";
        await tx`select app.create_owned_group_event_draft(${event}::uuid,'Fitness fundamentals','Fitness','Strength practice and conditioning for all experience levels.',statement_timestamp()+interval '30 days',statement_timestamp()+interval '30 days 1 hour',null,null)`;
        await tx`select app.update_owned_group_event_draft(${event}::uuid,'Fitness fundamentals','Fitness','Strength practice and conditioning for all experience levels.',statement_timestamp()+interval '30 days',statement_timestamp()+interval '30 days 1 hour',null,null)`;
        await assert.rejects(
          tx.savepoint(async (nested) => {
            await nested`select app.update_owned_group_event_draft(${event}::uuid,'Fitness fundamentals','Yoga','Strength practice and conditioning for all experience levels.',statement_timestamp()+interval '30 days',statement_timestamp()+interval '30 days 1 hour',null,null)`;
          }),
          /details are invalid/,
        );
        await save("Wrestling"); // Existing disciplines remain supported.
        await tx`reset role`;
        const snapshot =
          await tx`select to_jsonb(c) value from app.coach_profiles c where profile_id=${profile}::uuid`;
        await tx.unsafe(seed);
        assert.deepEqual(
          await tx`select to_jsonb(c) value from app.coach_profiles c where profile_id=${profile}::uuid`,
          snapshot,
        );
        assert.deepEqual(
          (
            await tx`select discipline from app.coach_profile_disciplines where profile_id=${profile}::uuid`
          ).map((r) => r.discipline),
          ["Wrestling"],
        );
        for (const constraint of [
          "coach_profile_disciplines_value_check",
          "coach_group_sessions_discipline_check",
          "group_events_discipline_check",
        ]) {
          const [row] =
            await tx`select pg_get_constraintdef(oid) definition from pg_constraint where conname=${constraint}`;
          assert.match(row.definition, /'Fitness'/);
          assert.doesNotMatch(row.definition, /'Yoga'/);
        }
        throw rollback;
      })
      .catch((error) => {
        if (error !== rollback) throw error;
      });
  } finally {
    await db.end({ timeout: 5 });
  }
  const previous = process.env.DATABASE_URL;
  url.username = "repx_runtime_login";
  url.password = "postgres";
  process.env.DATABASE_URL = url.toString();
  try {
    const entries = await publicCoachDirectoryRecords(
      normalizeCoachDirectoryFilters({ discipline: "Fitness" }),
    );
    const jake = entries.find((entry) => entry.coach.slug === "jake-miller");
    assert.ok(
      jake,
      "The restricted runtime must project the Fitness coach without rejecting the whole directory.",
    );
    assert.deepEqual(jake.coach.disciplines, ["Fitness"]);
    assert.equal(jake.coach.trustKind, "demo");
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
