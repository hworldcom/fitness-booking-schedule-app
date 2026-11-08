import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const target = process.env.DATABASE_TEST_URL;
test(
  "Pending aggregate is exact across pages, isolated by owner/dataset and read-only under runtime authority",
  {
    skip:
      !target ||
      !/^\/mov208_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(target).pathname),
  },
  async () => {
    const url = new URL(target!);
    assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
    assert.equal(url.port, "55322");
    const db = postgres(url.toString(), {
      max: 4,
      prepare: false,
      onnotice: () => {},
    });
    type Actor = { auth: string; id: string; run: string };
    async function actor(name: string, coach = false): Promise<Actor> {
      const auth = randomUUID();
      await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${auth}::uuid,${`mov208-${auth}@example.test`},statement_timestamp(),false,false)`;
      const [p] =
        await db`select * from app.enroll_application_identity(${auth}::uuid,${name})`;
      const a = { auth, id: p.identity_profile_id, run: p.identity_run_id };
      if (coach) {
        await as(a, async (tx) => {
          await tx`select app.submit_owned_coach_application()`;
          await tx`select app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":null,"facebookUrl":null,"linkedinUrl":null}'::jsonb)`;
          await tx`select app.upsert_owned_coach_profile(${name},'Isolated canonical pending request validation coach for disposable tests only.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
        });
        await db`select app.review_coach_application(${a.id}::uuid,'pending','approved','Disposable count fixture.','mov208','movx-identity-application-v1')`;
      }
      if (coach)
        await db`update app.coach_profiles set visibility='visible' where profile_id=${a.id}::uuid`;
      return a;
    }
    async function as<T>(
      a: Actor,
      fn: (tx: postgres.TransactionSql) => Promise<T>,
      readOnly = false,
    ) {
      return db.begin(async (tx) => {
        if (readOnly) await tx`set transaction read only`;
        await tx`select set_config('app.current_auth_user_id',${a.auth},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
        await tx`set local role app_runtime`;
        return fn(tx);
      });
    }
    const count = (a: Actor) =>
      as(
        a,
        async (tx) =>
          Number(
            (
              await tx`select app.current_owned_pending_coach_booking_request_count() n`
            )[0].n,
          ),
        true,
      );
    const fingerprint = async () =>
      JSON.stringify(
        await db`select (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from app.coach_booking_requests r) requests,(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'[]')) from app.booking_notification_events e) events,(select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]')) from app.booking_notification_receipts r) receipts`,
      );
    try {
      const owner = await actor("Count Owner", true),
        other = await actor("Count Other", true),
        client = await actor("Count Athlete");
      // Fixture writes are only in the harness-owned scratch DB, with all normal triggers enabled.
      async function fixture(a: Actor) {
        const [venue] =
          await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${a.id}::uuid and is_primary`;
        const [day] =
          await db`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text date`;
        await as(
          a,
          (tx) =>
            tx`select app.save_owned_effective_coach_availability(${tx.json({ kind: "dates", operationId: randomUUID(), expectedRevision: 0, dates: [{ date: day.date, mode: "custom", hours: [{ localStartTime: "10:00", locationId: venue.id, locationUpdatedAt: venue.stamp }] }] })})`,
        );
        const [slot] =
          await db`select id from app.coach_availability_slots where run_id=${a.run}::uuid and profile_id=${a.id}::uuid and status='open'`;
        return as(
          client,
          async (tx) =>
            (
              await tx`select * from app.create_coach_booking_request(${slot.id}::uuid)`
            )[0].request_id as string,
        );
      }
      // Avoid overlapping slot constraints with one future occurrence and many candidates.
      const first = await fixture(owner);
      await db.begin(async (tx) => {
        await tx`select app.mail_flags(true)`;
        for (let n = 1; n < 55; n++) {
          const candidate = await actor(`Candidate ${n}`);
          await tx`insert into app.coach_booking_requests(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,coach_timezone,coach_training_location_id,training_location_name,location_kind,gym_name,public_location_label,decision_deadline_at,created_at,updated_at)
          select ${randomUUID()}::uuid,run_id,slot_id,coach_profile_id,${candidate.id}::uuid,status,scheduled_start_at,scheduled_end_at,coach_timezone,coach_training_location_id,training_location_name,location_kind,gym_name,public_location_label,decision_deadline_at,created_at,updated_at from app.coach_booking_requests where id=${first}::uuid`;
        }
      });
      await fixture(other);
      // A new client can make another attempt on the existing slot; statuses/deadlines must not inflate the badge.
      await db.begin(async (tx) => {
        await tx`select app.mail_flags(true)`;
        for (const status of [
          "pending",
          "declined",
          "withdrawn",
          "expired",
          "occurrence-closed",
          "not-selected",
        ]) {
          const candidate = await actor(`History ${status}`);
          await tx`insert into app.coach_booking_requests(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,coach_timezone,coach_training_location_id,training_location_name,location_kind,gym_name,public_location_label,decision_deadline_at,created_at,updated_at,decided_by_profile_id,decided_at)
          select ${randomUUID()}::uuid,run_id,slot_id,coach_profile_id,${candidate.id}::uuid,${status},scheduled_start_at,scheduled_end_at,coach_timezone,coach_training_location_id,training_location_name,location_kind,gym_name,public_location_label,statement_timestamp()-interval '1 minute',statement_timestamp()-interval '2 hours',updated_at,${["declined", "not-selected", "occurrence-closed"].includes(status) ? owner.id : status === "withdrawn" ? candidate.id : null}::uuid,${status === "pending" ? null : new Date()} from app.coach_booking_requests where id=${first}::uuid`;
        }
      });
      const otherRun = randomUUID();
      await db`insert into app.demo_runs(id,slug,name,status,catalogue_visibility,schedule_anchor_date,starts_at,ends_at) values(${otherRun}::uuid,${`mov208-${otherRun}`},'Isolated second count dataset','active','private',current_date,statement_timestamp()-interval '1 day',statement_timestamp()+interval '30 days')`;
      await db`insert into app.demo_run_participants(run_id,profile_id,role,status,joined_at) values(${otherRun}::uuid,${owner.id}::uuid,'member','active',statement_timestamp())`;
      // Only one public dataset may be active. Switch it using owner fixture authority.
      await db.begin(async (tx) => {
        await tx`update app.demo_runs set catalogue_visibility='private' where id=${owner.run}::uuid`;
        await tx`update app.demo_runs set catalogue_visibility='public' where id=${otherRun}::uuid`;
      });
      await assert.rejects(count(owner), /invalid/);
      assert.equal(
        await count({ ...owner, run: otherRun }),
        0,
        "dataset switch cannot expose original owner requests",
      );
      await db.begin(async (tx) => {
        await tx`update app.demo_runs set catalogue_visibility='private' where id=${otherRun}::uuid`;
        await tx`update app.demo_runs set catalogue_visibility='public' where id=${owner.run}::uuid`;
      });
      const before = await fingerprint();
      assert.equal(await count(owner), 55);
      assert.equal(await count(other), 1);
      assert.equal(await count(client), 0);
      assert.equal(
        await fingerprint(),
        before,
        "count must not expire records or emit events/receipts",
      );
      for (const forged of [
        { ...owner, auth: other.auth },
        { ...owner, run: randomUUID() },
        { ...owner, id: other.id },
      ])
        await assert.rejects(count(forged), /invalid/);
      await as(owner, async (tx) => {
        for (const verb of ["select * from", "delete from"])
          await assert.rejects(
            tx.savepoint((n) => n.unsafe(`${verb} app.coach_booking_requests`)),
            /permission denied/,
          );
        await assert.rejects(
          tx.savepoint(
            (n) =>
              n`select app.current_owned_coach_booking_requests(51,null,null)`,
          ),
          /invalid/,
        );
        const [flag] =
          await tx`select current_setting('app.coach_booking_request_management',true) flag`;
        await tx`select app.current_owned_pending_coach_booking_request_count()`;
        const [after] =
          await tx`select current_setting('app.coach_booking_request_management',true) flag`;
        assert.equal(after.flag, flag.flag ?? "off");
      });
      for (const role of ["anon", "authenticated", "service_role"]) {
        const [p] =
          await db`select has_function_privilege(${role},'app.current_owned_pending_coach_booking_request_count()','EXECUTE') ok`;
        assert.equal(p.ok, false);
      }
      const page = await as(
        owner,
        (tx) =>
          tx`select * from app.current_owned_coach_booking_requests(20,null,null)`,
      );
      assert.equal(page.length, 20);
      assert.equal(await count(owner), 55);
      // Real decline command changes the exact badge; no email worker is started.
      await as(
        owner,
        (tx) => tx`select app.decline_coach_booking_request(${first}::uuid)`,
      );
      assert.equal(await count(owner), 54);
      const [pending] =
        await db`select id from app.coach_booking_requests where coach_profile_id=${owner.id}::uuid and run_id=${owner.run}::uuid and status='pending' and decision_deadline_at>statement_timestamp() limit 1`;
      await as(
        owner,
        (tx) =>
          tx`select app.accept_coach_booking_request(${pending.id}::uuid)`,
      );
      assert.equal(
        await count(owner),
        0,
        "accepted and competing terminal requests disappear from pending count",
      );
      const [otherSlot] =
        await db`select slot_id from app.coach_booking_requests where coach_profile_id=${other.id}::uuid and status='pending' limit 1`;
      await as(
        other,
        (tx) =>
          tx`select app.close_coach_booking_request_occurrence(${otherSlot.slot_id}::uuid)`,
      );
      assert.equal(await count(other), 0);
    } finally {
      await db.end();
    }
  },
);
