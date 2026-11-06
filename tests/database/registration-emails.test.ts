import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { withNotificationWorker } from "@/server/db/notifications/worker";

const target = new URL(process.env.DATABASE_TEST_URL ?? "http://invalid");
if (
  !/^\/mov175_[a-f0-9]+_(fresh|upgrade)$/.test(target.pathname) ||
  target.hostname !== "127.0.0.1" ||
  target.port !== "55322"
)
  throw Error("Use the isolated MOV-175 database rehearsal.");

test("new registration capture, private authority and durable worker lifecycle", async (t) => {
  const admin = postgres(target.href, {
    max: 4,
    prepare: false,
    onnotice() {},
  });
  const worker = postgres(process.env.NOTIFICATION_TEST_DATABASE_URL!, {
    max: 4,
    prepare: false,
    onnotice() {},
  });
  const fixture = async (provider = "email", verified = false) => {
    const id = randomUUID(),
      email = `mov175-${id}@example.test`;
    await admin`insert into auth.users(id,email,created_at,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,is_sso_user)
      values(${id}::uuid,${email},statement_timestamp(),${verified ? new Date() : null},${admin.json({ provider })},'{"name":"PRIVATE","password":"PRIVATE"}',false,false)`;
    const [job] =
      await admin`select * from app.registration_emails where auth_user_id=${id}::uuid`;
    assert.ok(job);
    return { id, email, job };
  };
  const isolate = () =>
    admin`update app.registration_emails set state='suppressed',lease_id=null,lease_until=null where state in ('queued','claimed','sending')`;
  const claim = async (n = 1) =>
    (await worker`select app.claim_registration_emails(${n}) result`)[0]
      .result as { id: string; leaseId: string }[];
  const state = async (id: string) =>
    (
      await admin`select * from app.registration_emails where id=${id}::uuid`
    )[0];
  const prepare = async (c: { id: string; leaseId: string }) =>
    (
      await worker`select app.prepare_registration_email(${c.id}::uuid,${c.leaseId}::uuid) result`
    )[0].result;
  const finish = async (c: { id: string; leaseId: string }, outcome: string) =>
    (
      await worker`select app.finish_registration_email(${c.id}::uuid,${c.leaseId}::uuid,${outcome},null) result`
    )[0].result;
  try {
    await t.test(
      "capture is immediate without email verification, enrollment or profile, and stores no user metadata",
      async () => {
        const a = await fixture();
        assert.equal(a.job.state, "queued");
        assert.equal(a.job.verified_at_signup, false);
        assert.equal(a.job.signup_email, a.email);
        assert.equal(a.job.provider, "email");
        assert.ok(new Date(a.job.due_at).getTime() <= Date.now());
        assert.equal(
          Number(
            (
              await admin`select count(*) n from app.profiles where auth_user_id=${a.id}::uuid`
            )[0].n,
          ),
          0,
        );
        assert.doesNotMatch(JSON.stringify(a.job), /PRIVATE/);
        await admin`update auth.users set email_confirmed_at=statement_timestamp(),last_sign_in_at=statement_timestamp(),email=${`changed-${a.email}`} where id=${a.id}::uuid`;
        await admin`insert into auth.users(id,email) values(${a.id}::uuid,${a.email}) on conflict(id) do nothing`;
        const [current] =
          await admin`select * from app.registration_emails where auth_user_id=${a.id}::uuid`;
        assert.deepEqual(current, a.job);
        await isolate();
        const google = await fixture("google", true);
        assert.equal(google.job.provider, "google");
        assert.equal(google.job.verified_at_signup, true);
      },
    );
    await t.test(
      "rolled-back and concurrent duplicate creation produce zero or one alert, and anonymous accounts do not alert",
      async () => {
        const rollbackId = randomUUID();
        await assert.rejects(
          admin.begin(async (tx) => {
            await tx`insert into auth.users(id,email,is_anonymous) values(${rollbackId}::uuid,${`rollback-${rollbackId}@example.test`},false)`;
            throw Error("fixture rollback");
          }),
          /fixture rollback/,
        );
        assert.equal(
          Number(
            (
              await admin`select count(*) n from app.registration_emails where auth_user_id=${rollbackId}::uuid`
            )[0].n,
          ),
          0,
        );
        const id = randomUUID(),
          email = `concurrent-${id}@example.test`;
        await Promise.all(
          [1, 2].map(
            () =>
              admin`insert into auth.users(id,email,is_anonymous) values(${id}::uuid,${email},false) on conflict(id) do nothing`,
          ),
        );
        assert.equal(
          Number(
            (
              await admin`select count(*) n from app.registration_emails where auth_user_id=${id}::uuid`
            )[0].n,
          ),
          1,
        );
        const anonymous = randomUUID();
        await admin`insert into auth.users(id,email,is_anonymous) values(${anonymous}::uuid,${`anon-${anonymous}@example.test`},true)`;
        assert.equal(
          Number(
            (
              await admin`select count(*) n from app.registration_emails where auth_user_id=${anonymous}::uuid`
            )[0].n,
          ),
          0,
        );
      },
    );
    await t.test(
      "browser, service and ordinary runtime roles have no staff-table/helper/delivery access; worker has only bounded functions",
      async () => {
        const functions = [
          "app.capture_registration_email()",
          "app.registration_email_account_eligible(uuid)",
          "app.claim_registration_emails(integer)",
          "app.prepare_registration_email(uuid,uuid)",
          "app.finish_registration_email(uuid,uuid,text,text)",
          "app.claim_notification_emails_v6(integer)",
        ];
        for (const role of [
          "anon",
          "authenticated",
          "service_role",
          "app_runtime",
        ]) {
          const [acl] =
            await admin`select has_table_privilege(${role},'app.registration_emails','SELECT,INSERT,UPDATE,DELETE') allowed`;
          assert.equal(acl.allowed, false, role);
          for (const fn of functions)
            assert.equal(
              (
                await admin`select has_function_privilege(${role},${fn},'EXECUTE') allowed`
              )[0].allowed,
              false,
              role + fn,
            );
        }
        await assert.rejects(
          worker`select * from app.registration_emails`,
          (e: unknown) =>
            e instanceof postgres.PostgresError && e.code === "42501",
        );
        await assert.rejects(
          worker`select * from auth.users`,
          (e: unknown) =>
            e instanceof postgres.PostgresError && e.code === "42501",
        );
        await assert.rejects(
          worker`select app.registration_email_account_eligible(${randomUUID()}::uuid)`,
          (e: unknown) =>
            e instanceof postgres.PostgresError && e.code === "42501",
        );
        for (const n of [0, 21]) await assert.rejects(claim(n));
        for (const n of [5, 21])
          await assert.rejects(
            worker`select app.claim_notification_emails_v6(${n})`,
          );
      },
    );
    await t.test(
      "old worker contracts leave registration jobs queued; new repository accepts six bounded registration claims",
      async () => {
        await isolate();
        const a = await fixture();
        await withNotificationWorker(
          process.env.NOTIFICATION_TEST_DATABASE_URL,
          async (repo) => {
            assert.ok(
              (await repo.claim()).every((c) => c.kind !== "registration"),
            );
          },
          5,
        );
        assert.equal((await state(a.job.id)).state, "queued");
        for (let i = 0; i < 5; i++) await fixture();
        await withNotificationWorker(
          process.env.NOTIFICATION_TEST_DATABASE_URL,
          async (repo) => {
            const jobs = await repo.claim();
            assert.equal(jobs.length, 6);
            assert.ok(jobs.every((c) => c.kind === "registration"));
            const payload = await repo.prepare(jobs[0]);
            assert.ok(
              payload && "kind" in payload && payload.kind === "registration",
            );
            assert.equal(payload.email, "hello@movx.club");
            assert.equal(
              await repo.finish(jobs[0], {
                status: "accepted",
                providerId: "scratch-provider",
              }),
              true,
            );
          },
          6,
        );
      },
    );
    await t.test(
      "mixed backlogs reserve capacity for both existing booking mail and new registration mail",
      async () => {
        const [pair] =
          await admin`select a.run_id,a.profile_id coach,b.profile_id athlete from app.demo_run_participants a join app.demo_run_participants b on b.run_id=a.run_id and b.profile_id<>a.profile_id limit 1`;
        assert.ok(pair);
        const events: string[] = [];
        const bookingJob = async () => {
          const id = randomUUID();
          events.push(id);
          // Valid event/receipt fixtures isolate claim fairness from canonical booking
          // mutations, which the separate real booking integration exercises.
          await admin`insert into app.booking_notification_events(id,run_id,coach_profile_id,athlete_profile_id,event_key,kind,source_kind,source_id,slot_id,starts_at,ends_at,venue_name)
          values(${id}::uuid,${pair.run_id}::uuid,${pair.coach}::uuid,${pair.athlete}::uuid,${"mov175-" + id},'requested','request',${randomUUID()}::uuid,${randomUUID()}::uuid,statement_timestamp()+interval '1 day',statement_timestamp()+interval '25 hours','Scratch venue')`;
          await admin`insert into app.booking_notification_receipts(event_id,recipient_profile_id,notify_in_app) values(${id}::uuid,${pair.athlete}::uuid,false)`;
        };
        try {
          await isolate();
          for (let i = 0; i < 7; i++) await fixture();
          await bookingJob();
          const [first] =
            await worker`select app.claim_notification_emails_v6(6) result`;
          assert.equal(first.result.length, 6);
          assert.equal(first.result[0].kind, "registration");
          assert.equal(
            first.result.filter((c: { kind: string }) => c.kind === "booking")
              .length,
            1,
          );
          assert.equal(
            first.result.filter(
              (c: { kind: string }) => c.kind === "registration",
            ).length,
            5,
          );
          await isolate();
          for (let i = 0; i < 7; i++) await bookingJob();
          await fixture();
          const [second] =
            await worker`select app.claim_notification_emails_v6(6) result`;
          assert.equal(second.result.length, 6);
          assert.equal(second.result[0].kind, "registration");
          assert.equal(
            second.result.filter((c: { kind: string }) => c.kind === "booking")
              .length,
            5,
          );
          assert.equal(
            second.result.filter(
              (c: { kind: string }) => c.kind === "registration",
            ).length,
            1,
          );
        } finally {
          await admin`update app.booking_notification_receipts set state='suppressed',lease_id=null,lease_until=null where event_id=any(${events}::uuid[])`;
        }
      },
    );
    await t.test(
      "concurrent workers never claim a job twice and stale/expired leases cannot prepare or finish",
      async () => {
        await isolate();
        for (let i = 0; i < 4; i++) await fixture();
        const [a, b] = await Promise.all([claim(2), claim(2)]);
        assert.equal(a.length + b.length, 4);
        assert.equal(new Set([...a, ...b].map((c) => c.id)).size, 4);
        const c = a[0];
        assert.equal(await prepare({ ...c, leaseId: randomUUID() }), null);
        const p = await prepare(c);
        assert.equal(p.email, "hello@movx.club");
        assert.equal(p.verifiedAtSignup, false);
        assert.equal(
          await finish({ ...c, leaseId: randomUUID() }, "accepted"),
          false,
        );
        assert.equal(await finish(c, "accepted"), true);
        assert.equal(await finish(c, "accepted"), false);
        await admin`update app.registration_emails set lease_until=statement_timestamp()-interval '1 second' where id=${b[0].id}::uuid`;
        assert.equal(await prepare(b[0]), null);
        const reclaimed = await claim();
        assert.equal(reclaimed[0].id, b[0].id);
        assert.notEqual(reclaimed[0].leaseId, b[0].leaseId);
      },
    );
    await t.test(
      "definite throttling retries with backoff, ambiguous sending is quarantined, exhausted pre-send claims terminate",
      async () => {
        await isolate();
        const a = await fixture();
        const [c] = await claim();
        await prepare(c);
        assert.equal(await finish(c, "retry"), true);
        const retried = await state(a.job.id);
        assert.equal(retried.state, "queued");
        assert.ok(new Date(retried.due_at).getTime() > Date.now());
        assert.deepEqual(await claim(), []);
        await admin`update app.registration_emails set due_at=statement_timestamp()-interval '1 second' where id=${c.id}::uuid`;
        const [again] = await claim();
        await prepare(again);
        assert.equal(await finish(c, "accepted"), false);
        await admin`update app.registration_emails set lease_until=statement_timestamp()-interval '1 second' where id=${c.id}::uuid`;
        assert.deepEqual(await claim(), []);
        assert.equal((await state(c.id)).state, "unknown");
        assert.equal(await finish(again, "retry"), false);
        await fixture();
        const [exhausted] = await claim();
        await admin`update app.registration_emails set attempts=5,lease_until=statement_timestamp()-interval '1 second' where id=${exhausted.id}::uuid`;
        assert.deepEqual(await claim(), []);
        assert.equal((await state(exhausted.id)).state, "failed");
      },
    );
    await t.test(
      "deleted accounts and a concurrent committed ban suppress unsent staff mail",
      async () => {
        await isolate();
        const removed = await fixture();
        const [c] = await claim();
        await admin`delete from auth.users where id=${removed.id}::uuid`;
        assert.equal(await prepare(c), null);
        assert.equal((await state(c.id)).state, "suppressed");
        const banned = await fixture();
        const [b] = await claim();
        let release!: () => void, ready!: () => void;
        const gate = new Promise<void>((r) => (release = r)),
          locked = new Promise<void>((r) => (ready = r));
        const banning = admin.begin(async (tx) => {
          await tx`update auth.users set banned_until=statement_timestamp()+interval '1 day' where id=${banned.id}::uuid`;
          ready();
          await gate;
        });
        await locked;
        let settled = false;
        const pending = prepare(b).then((r) => {
          settled = true;
          return r;
        });
        try {
          await new Promise((r) => setTimeout(r, 50));
          assert.equal(settled, false);
        } finally {
          release();
        }
        await banning;
        assert.equal(await pending, null);
        assert.equal((await state(b.id)).state, "suppressed");
      },
    );
    await t.test(
      "deleting and registering the same address again creates a new event for the new account",
      async () => {
        await isolate();
        const first = await fixture();
        await admin`delete from auth.users where id=${first.id}::uuid`;
        const second = randomUUID();
        await admin`insert into auth.users(id,email,is_anonymous) values(${second}::uuid,${first.email},false)`;
        const rows =
          await admin`select id from app.registration_emails where signup_email=${first.email}`;
        assert.equal(rows.length, 2);
        assert.notEqual(rows[0].id, rows[1].id);
      },
    );
  } finally {
    await worker.end({ timeout: 1 });
    await admin.end({ timeout: 1 });
  }
});
