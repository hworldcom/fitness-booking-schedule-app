import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { normalizeCoachDirectoryFilters } from "@/domain/coaches";
import { publicCoachDirectoryRecords } from "@/server/db/coaches/repository";

const target = process.env.DATABASE_TEST_URL;
test(
  "Wellness persists through restricted profile/group commands and public discovery",
  {
    skip:
      !target ||
      !/^\/mov189_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(target).pathname),
  },
  async () => {
    const url = new URL(target!);
    assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
    assert.equal(url.port, "55322");
    assert.match(url.pathname, /^\/mov189_[a-f0-9]+_(fresh|upgrade)$/);
    const db = postgres(url.toString(), { max: 1, prepare: false, ssl: false });
    const profile = "10000000-0000-4000-8000-000000000013";
    const auth = "91890000-0000-4000-8000-000000000001";
    const run = "20000000-0000-4000-8000-000000000001";
    try {
      await db.begin(async (tx) => {
        await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${auth}::uuid,false,false)`;
        await tx`update app.profiles set auth_user_id=${auth}::uuid,record_source='user',claimed_at=statement_timestamp() where id=${profile}::uuid`;
        await tx`update app.coach_profiles set record_source='user' where profile_id=${profile}::uuid`;
        await tx`select set_config('app.current_auth_user_id',${auth},true),set_config('app.current_profile_id',${profile},true),set_config('app.current_run_id',${run},true),set_config('app.current_run_role','member',true)`;
        await tx`set local role app_runtime`;
        const save = (discipline: string) =>
          tx`select app.upsert_owned_coach_profile('Wellness fixture','Private recovery and wellness sessions with an adaptable pace.',array[${discipline}],'Europe/Berlin','visible','40000000-0000-4000-8000-000000000002'::uuid,null,null,null,null,null) slug`;
        for (const discipline of [
          "Boxing",
          "Muay Thai",
          "Kickboxing",
          "Brazilian Jiu-Jitsu",
          "MMA",
          "Wrestling",
          "Fitness",
          "Wellness",
        ])
          assert.equal((await save(discipline))[0].slug, "jake-miller");
        const [venue] =
          await tx`select id from app.coach_training_locations where profile_id=${profile}::uuid and is_primary and status='active'`;
        const args = {
          id: "91890000-0000-4000-8000-000000000002",
          expectedRevision: null,
          title: "Recovery session",
          description: "A guided wellness and recovery session.",
          discipline: "Wellness",
          intendedLevel: "All levels",
          locationId: venue.id,
          startsAt: "2031-07-20T16:00:00Z",
          endsAt: "2031-07-20T17:00:00Z",
          decisionDeadlineAt: "2031-07-19T16:00:00Z",
          minimumParticipants: 2,
          maximumParticipants: 8,
          priceCents: 0,
        };
        const [group] =
          await tx`select app.group_session_command('save-draft',${tx.json(args)}) result`;
        assert.equal(group.result.session.discipline, "Wellness");
        for (const discipline of ["Yoga", "Massage", "Sauna", "Recovery"]) {
          await assert.rejects(
            tx.savepoint(async (nested) => {
              await nested`select app.upsert_owned_coach_profile('Wellness fixture','Private recovery and wellness sessions with an adaptable pace.',array[${discipline}],'Europe/Berlin','visible','40000000-0000-4000-8000-000000000002'::uuid,null,null,null,null,null)`;
            }),
            /details are invalid/,
          );
          await assert.rejects(
            tx.savepoint(async (nested) => {
              await nested`select app.group_session_command('save-draft',${nested.json({ ...args, id: "91890000-0000-4000-8000-000000000003", discipline })})`;
            }),
            /discipline is unavailable/,
          );
        }
        const event = "91890000-0000-4000-8000-000000000004";
        await tx`select app.create_owned_group_event_draft(${event}::uuid,'Wellness workshop','Wellness','Guided recovery practice in the existing event flow.',statement_timestamp()+interval '30 days',statement_timestamp()+interval '30 days 1 hour',null,null)`;
        await tx`select app.update_owned_group_event_draft(${event}::uuid,'Wellness workshop','Wellness','Guided recovery practice in the existing event flow.',statement_timestamp()+interval '30 days',statement_timestamp()+interval '30 days 1 hour',null,null)`;
        await assert.rejects(
          tx.savepoint(async (nested) => {
            await nested`update app.coach_profile_disciplines set discipline='Boxing' where profile_id=${profile}::uuid`;
          }),
          /permission denied/,
        );
        await tx`reset role`;
        for (const constraint of [
          "coach_profile_disciplines_value_check",
          "coach_group_sessions_discipline_check",
          "group_events_discipline_check",
        ]) {
          const [row] =
            await tx`select pg_get_constraintdef(oid) definition from pg_constraint where conname=${constraint}`;
          assert.match(row.definition, /'Wellness'/);
          assert.doesNotMatch(
            row.definition,
            /'Massage'|'Sauna'|'Recovery'|'Yoga'/,
          );
        }
      });
      const runtime = new URL(url);
      runtime.username = "repx_runtime_login";
      runtime.password = "postgres";
      process.env.DATABASE_URL = runtime.toString();
      const entries = await publicCoachDirectoryRecords(
        normalizeCoachDirectoryFilters({ discipline: "Wellness" }),
      );
      assert.equal(entries.length, 1);
      assert.equal(entries[0].coach.slug, "jake-miller");
      assert.deepEqual(entries[0].coach.disciplines, ["Wellness"]);
      assert.equal(entries[0].coach.trustKind, "demo");
      assert.equal(
        (
          await publicCoachDirectoryRecords(
            normalizeCoachDirectoryFilters({ discipline: "Boxing" }),
          )
        ).some((entry) => entry.coach.slug === "jake-miller"),
        false,
      );
    } finally {
      await db.end({ timeout: 5 });
    }
  },
);
