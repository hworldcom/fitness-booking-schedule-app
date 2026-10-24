import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { parseNotificationPage } from "@/notifications/contracts";
import { runNotificationWorker } from "@/server/notifications/worker";
const url = process.env.DATABASE_TEST_URL;
const isolated =
  !!url &&
  /^\/mov86_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(url).pathname) &&
  ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
test(
  "canonical group recipients, bulk summaries, history and restricted delivery",
  { skip: !isolated },
  async (t) => {
    for (const key of [
      "NOTIFICATION_TEST_RUNTIME_URL",
      "NOTIFICATION_TEST_WORKER_URL",
    ]) {
      const role = new URL(process.env[key]!);
      assert.equal(role.hostname, new URL(url!).hostname);
      assert.equal(role.pathname, new URL(url!).pathname);
      assert.equal(role.port, new URL(url!).port);
    }
    const db = postgres(url!, { max: 6, prepare: false, onnotice: () => {} }),
      runtime = postgres(process.env.NOTIFICATION_TEST_RUNTIME_URL!, {
        max: 4,
        prepare: false,
        onnotice: () => {},
      });
    const captures: string[] = [],
      auths: string[] = [],
      sessions: string[] = [];
    type Actor = { auth: string; id: string; run: string; email: string };
    const as = <T>(a: Actor, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
      runtime.begin(async (tx) => {
        await tx`select set_config('app.current_auth_user_id',${a.auth},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
        return fn(tx);
      });
    const command = (a: Actor, action: string, args: Record<string, unknown>) =>
      as(
        a,
        async (tx) =>
          (
            await tx`select app.group_session_command(${action},${tx.json(args as postgres.JSONValue)}) result`
          )[0].result,
      );
    async function actor(name: string, coach = false) {
      const auth = randomUUID(),
        email = `mov86-${auth}@example.test`;
      auths.push(auth);
      await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${auth}::uuid,${email},statement_timestamp(),false,false)`;
      const [p] =
        await db`select * from app.enroll_application_identity(${auth}::uuid,${name})`;
      const a: Actor = {
        auth,
        email,
        id: p.identity_profile_id,
        run: p.identity_run_id,
      };
      if (coach) {
        await as(a, async (tx) => {
          await tx`select app.submit_owned_coach_application()`;
          await tx`select app.upsert_owned_coach_profile(${name},'A uniquely tagged disposable coach for canonical group notification and privacy validation.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
        });
        await db`select app.review_coach_application(${a.id}::uuid,'pending','approved','Exact group fixture','mov86','movx-identity-application-v1')`;
        await db`update app.coach_profiles set visibility='visible' where profile_id=${a.id}::uuid`;
      }
      return a;
    }
    let coach: Actor, a: Actor, b: Actor, other: Actor;
    async function group(confirmed = false, deadlineSeconds = 86400) {
      const id = randomUUID();
      sessions.push(id);
      await db`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,created_at,published_at,confirmed_at,confirmed_by_profile_id)
 select ${id}::uuid,${coach.run}::uuid,${coach.id}::uuid,${"group-" + id.replaceAll("-", "")},'<Group> & QA','Exact temporary group fixture','Boxing','All levels',l.id,jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),clock_timestamp()+interval '4 days',clock_timestamp()+interval '4 days 1 hour',clock_timestamp()+make_interval(secs=>${deadlineSeconds}),1,4,0,${confirmed ? "confirmed" : "open"},clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute',${confirmed ? new Date() : null},${confirmed ? coach.id : null}::uuid from app.coach_training_locations l where l.profile_id=${coach.id}::uuid and l.is_primary`;
      return id;
    }
    const join = (who: Actor, id: string, registrationId = randomUUID()) =>
      command(who, "join", { id, registrationId });
    const rows = (id: string, kind?: string) =>
      db`select e.*,r.id receipt_id,r.recipient_profile_id,r.registration_id attempt,r.participation_status,r.notify_in_app,r.state,r.read_at from app.group_notification_events e join app.group_notification_receipts r on r.event_id=e.id where e.session_id=${id}::uuid and (${kind ?? null}::text is null or e.kind=${kind ?? null}) order by e.event_key,r.recipient_profile_id`;
    const list = (who: Actor, version = 3) =>
      as(who, async (tx) =>
        parseNotificationPage(
          (
            await tx.unsafe(
              `select app.notification_command${version === 1 ? "" : "_v" + version}('list','{}') result`,
            )
          )[0].result,
        ),
      );
    const workerEnv = {
      NOTIFICATION_DELIVERY_ENABLED: "true",
      NOTIFICATION_TRANSPORT: "mailpit",
      NOTIFICATION_MAILPIT_URL: "http://127.0.0.1:55324",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      NOTIFICATION_DATABASE_URL: process.env.NOTIFICATION_TEST_WORKER_URL,
    };
    try {
      coach = await actor("Group Coach", true);
      a = await actor("Group Athlete");
      b = await actor("Pending Athlete");
      other = await actor("Unrelated Athlete");
      const id = await group(),
        first = randomUUID(),
        second = randomUUID();
      await t.test(
        "new pending requests email both once, expose coach-only bell and respect old versions",
        async () => {
          await join(a, id, first);
          await join(a, id, first);
          await join(b, id, second);
          const r = await rows(id, "requested");
          assert.equal(r.length, 4);
          assert.equal(r.filter((x) => x.notify_in_app).length, 2);
          assert.ok(
            r
              .filter((x) => x.notify_in_app)
              .every((x) => x.recipient_profile_id === coach.id),
          );
          assert.equal((await list(coach)).unreadCount, 2);
          assert.equal((await list(a)).unreadCount, 0);
          assert.equal((await list(other)).unreadCount, 0);
          for (const version of [1, 2]) {
            assert.equal((await list(coach, version)).unreadCount, 0);
            await as(coach, async (tx) => {
              await tx.unsafe(
                `select app.notification_command${version === 1 ? "" : "_v2"}('read-all',$1::jsonb)`,
                [
                  tx.json({
                    throughAt: new Date().toISOString(),
                  }),
                ],
              );
            });
          }
          assert.equal((await list(coach)).unreadCount, 2);
          await assert.rejects(
            as(
              a,
              async (tx) =>
                tx`select app.notification_command_v3('read',${tx.json({ id: r.find((x) => x.notify_in_app)!.receipt_id })})`,
            ),
          );
        },
      );
      await t.test(
        "approval and event confirmation are independent with immutable exact retries and pending wording",
        async () => {
          const before = (await rows(id)).length;
          await assert.rejects(command(coach, "confirm", { id }));
          assert.equal((await rows(id)).length, before);
          await assert.rejects(
            command(a, "approve-registration", { id, registrationId: first }),
          );
          await command(coach, "approve-registration", {
            id,
            registrationId: first,
          });
          await command(coach, "approve-registration", {
            id,
            registrationId: first,
          });
          assert.equal((await rows(id, "approved")).length, 2);
          assert.ok(
            (await rows(id, "approved")).every((x) => !x.notify_in_app),
          );
          await command(coach, "confirm", { id });
          await command(coach, "confirm", { id });
          const r = await rows(id, "confirmed");
          assert.equal(r.length, 3);
          assert.equal(
            r.filter((x) => x.recipient_profile_id === coach.id).length,
            1,
          );
          assert.ok(r.every((x) => x.affected_count === 2 && !x.notify_in_app));
          assert.equal(
            r.find((x) => x.recipient_profile_id === a.id)!
              .participation_status,
            "active",
          );
          assert.equal(
            r.find((x) => x.recipient_profile_id === b.id)!
              .participation_status,
            "pending",
          );
        },
      );
      await t.test(
        "withdraw/rejoin, final decline and whole-group cancellation exclude terminal attempts and duplicate outcomes",
        async () => {
          await command(a, "withdraw", { id, registrationId: first });
          const fresh = randomUUID();
          await join(a, id, fresh);
          await command(coach, "approve-registration", {
            id,
            registrationId: first,
          });
          assert.equal((await rows(id, "approved")).length, 2);
          await command(coach, "decline-registration", {
            id,
            registrationId: second,
          });
          await command(coach, "decline-registration", {
            id,
            registrationId: second,
          });
          assert.equal((await rows(id, "declined")).length, 2);
          await command(coach, "cancel", { id });
          await command(coach, "cancel", { id });
          const r = await rows(id, "cancelled");
          assert.equal(r.length, 2);
          assert.equal(
            r.find((x) => x.recipient_profile_id === a.id)!.attempt,
            fresh,
          );
          assert.ok(r.every((x) => !x.notify_in_app));
          assert.equal(
            r.find((x) => x.recipient_profile_id === a.id)!
              .participation_status,
            "session-cancelled",
          );
        },
      );
      await t.test(
        "rolled-back lifecycle writes produce no event or receipt",
        async () => {
          const count = (await rows(id)).length;
          await assert.rejects(
            as(coach, async (tx) => {
              await tx`select app.group_session_command('detail',${tx.json({ id })})`;
              throw Error("rollback");
            }),
          );
          assert.equal((await rows(id)).length, count);
          const rollback = await group();
          await assert.rejects(
            as(a, async (tx) => {
              await tx`select app.group_session_command('join',${tx.json({ id: rollback, registrationId: randomUUID() })})`;
              throw Error("rollback");
            }),
          );
          assert.equal((await rows(rollback)).length, 0);
        },
      );
      await t.test(
        "system Not confirmed and approval expiry create one coach summary, not self-action alerts",
        async () => {
          const open = await group(false, 1),
            confirmed = await group(true, 1);
          await join(a, open);
          await join(b, open);
          await join(a, confirmed);
          await join(b, confirmed);
          await new Promise((resolve) => setTimeout(resolve, 1100));
          await command(coach, "detail", { id: open });
          await command(coach, "detail", { id: confirmed });
          await command(coach, "detail", { id: confirmed });
          for (const [session, kind, status] of [
            [open, "not-confirmed", "session-not-confirmed"],
            [confirmed, "approval-expired", "approval-expired"],
          ]) {
            const r = await rows(session, kind);
            assert.equal(r.length, 3);
            assert.ok(
              r.every(
                (x) => x.actor_profile_id === null && x.affected_count === 2,
              ),
            );
            assert.equal(r.filter((x) => x.notify_in_app).length, 1);
            assert.equal(
              r.find((x) => x.notify_in_app)!.recipient_profile_id,
              coach.id,
            );
            assert.ok(
              r
                .filter((x) => x.recipient_profile_id !== coach.id)
                .every((x) => x.participation_status === status),
            );
          }
        },
      );
      await t.test(
        "concurrent exact joins and decisions keep one canonical event per winning transition",
        async () => {
          const target = await group(),
            attempt = randomUUID();
          await Promise.all([
            join(a, target, attempt),
            join(a, target, attempt),
            join(a, target, attempt),
          ]);
          assert.equal((await rows(target, "requested")).length, 2);
          await Promise.allSettled([
            command(coach, "approve-registration", {
              id: target,
              registrationId: attempt,
            }),
            command(a, "withdraw", { id: target, registrationId: attempt }),
          ]);
          const state = (
            await db`select status from app.coach_group_registrations where id=${attempt}::uuid`
          )[0];
          assert.equal(state.status, "withdrawn");
          assert.equal((await rows(target, "withdrawn")).length, 2);
          assert.ok((await rows(target, "approved")).length <= 2);
        },
      );
      await t.test(
        "bounded mixed history and snapshot mark-all retain later group alerts without suppressing email",
        async () => {
          const target = await group();
          for (let n = 0; n < 11; n++) {
            const attempt = randomUUID();
            await join(a, target, attempt);
            await command(a, "withdraw", {
              id: target,
              registrationId: attempt,
            });
          }
          const page = await list(coach);
          assert.equal(page.items.length, 20);
          assert.equal(page.hasMore, true);
          const last = page.items.at(-1)!;
          const older = await as(coach, async (tx) =>
            parseNotificationPage(
              (
                await tx`select app.notification_command_v3('list',${tx.json({ beforeAt: last.createdAt, beforeId: last.id })}) result`
              )[0].result,
            ),
          );
          assert.ok(older.items.length > 0);
          assert.ok(
            older.items.every((x) => !page.items.some((y) => y.id === x.id)),
          );
          await new Promise((resolve) => setTimeout(resolve, 5));
          await join(b, target);
          await as(
            coach,
            async (tx) =>
              tx`select app.notification_command_v3('read-all',${tx.json({ throughAt: page.snapshotAt })})`,
          );
          assert.equal((await list(coach)).unreadCount, 1);
          assert.ok((await rows(target)).every((x) => x.state === "queued"));
        },
      );
      await t.test(
        "raw tables/Auth/private helper are denied and group/mail scopes are restored",
        async () => {
          for (const table of [
            "group_notification_events",
            "group_notification_receipts",
          ])
            await assert.rejects(runtime.unsafe(`select * from app.${table}`));
          const [acl] =
            await db`select has_function_privilege('app_notification_worker','app.group_notification_recipient_email(uuid)','execute') helper,has_function_privilege('app_runtime','app.claim_notification_emails_v3(integer)','execute') claim`;
          assert.deepEqual(acl, { helper: false, claim: false });
          await as(coach, async (tx) => {
            await tx`select app.notification_command_v3('list','{}')`;
            const [scope] =
              await tx`select coalesce(current_setting('app.group_session_management',true),'') flag`;
            assert.ok(scope.flag !== "on");
          });
        },
      );
      await t.test(
        "real restricted worker delivers individual/bulk receipts to Mailpit with truthful private links",
        async () => {
          let remaining = true;
          while (remaining) {
            const result = await runNotificationWorker(workerEnv);
            assert.equal(result.unknown, 0);
            assert.equal(result.failed, 0);
            remaining = result.claimed > 0;
          }
          const accepted =
            await db`select r.provider_id,r.recipient_profile_id,e.kind,e.title from app.group_notification_receipts r join app.group_notification_events e on e.id=r.event_id where e.session_id=any(${sessions}::uuid[]) and r.state='accepted'`;
          assert.ok(accepted.length > 20);
          for (const r of accepted) {
            captures.push(r.provider_id);
            const mail = await (
              await fetch(
                `http://127.0.0.1:55324/api/v1/message/${r.provider_id}`,
              )
            ).json();
            assert.equal(mail.From.Address, "notification@movx.club");
            assert.equal(mail.To.length, 1);
            const recipient = [coach, a, b, other].find(
              (p) => p.id === r.recipient_profile_id,
            )!;
            assert.equal(mail.To[0].Address, recipient.email);
            assert.ok(mail.HTML.includes("&lt;Group&gt;"));
            assert.ok(!mail.HTML.includes("<Group>"));
            assert.ok(
              mail.Text.includes(
                recipient === coach ? "/coach/events/" : "/events/group-",
              ),
            );
            if (r.kind === "confirmed" && recipient === b)
              assert.match(mail.Text, /still awaiting coach approval/);
          }
        },
      );
      await t.test(
        "revoked recipient membership suppresses the exact group receipt before handoff",
        async () => {
          const target = await group();
          await join(other, target);
          const receipt = (await rows(target)).find(
            (x) => x.recipient_profile_id === other.id,
          )!;
          await db`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where run_id=${other.run}::uuid and profile_id=${other.id}::uuid`;
          const worker = postgres(process.env.NOTIFICATION_TEST_WORKER_URL!, {
            prepare: false,
            max: 1,
            onnotice: () => {},
          });
          try {
            const claims = (
              await worker`select app.claim_group_notification_emails(20) result`
            )[0].result;
            const claim = claims.find(
              (x: { id: string }) => x.id === receipt.receipt_id,
            );
            assert.ok(claim);
            assert.equal(
              (
                await worker`select app.prepare_group_notification_email(${claim.id}::uuid,${claim.leaseId}::uuid) result`
              )[0].result,
              null,
            );
            assert.equal(
              (
                await db`select state from app.group_notification_receipts where id=${receipt.receipt_id}::uuid`
              )[0].state,
              "suppressed",
            );
            for (const c of claims.filter(
              (x: { id: string }) => x.id !== claim.id,
            ))
              await db`update app.group_notification_receipts set lease_until=statement_timestamp()-interval '1 second' where id=${c.id}::uuid`;
          } finally {
            await worker.end();
            await db`update app.demo_run_participants set status='active',revoked_at=null where run_id=${other.run}::uuid and profile_id=${other.id}::uuid`;
          }
        },
      );
      await t.test(
        "group leases fence stale attempts, back off rejection and quarantine possible handoff",
        async () => {
          const target = await group();
          await join(a, target);
          const worker = postgres(process.env.NOTIFICATION_TEST_WORKER_URL!, {
            prepare: false,
            max: 1,
            onnotice: () => {},
          });
          try {
            const claims = (
              await worker`select app.claim_group_notification_emails(1) result`
            )[0].result;
            assert.equal(claims.length, 1);
            const first = claims[0];
            assert.equal(
              (
                await worker`select app.prepare_group_notification_email(${first.id}::uuid,${randomUUID()}::uuid) result`
              )[0].result,
              null,
            );
            assert.ok(
              (
                await worker`select app.prepare_group_notification_email(${first.id}::uuid,${first.leaseId}::uuid) result`
              )[0].result,
            );
            assert.equal(
              (
                await worker`select app.finish_group_notification_email(${first.id}::uuid,${first.leaseId}::uuid,'retry',null) result`
              )[0].result,
              true,
            );
            const retried = (
              await db`select state,due_at>statement_timestamp() backed_off from app.group_notification_receipts where id=${first.id}::uuid`
            )[0];
            assert.deepEqual(retried, { state: "queued", backed_off: true });
            await db`update app.group_notification_receipts set due_at=statement_timestamp()-interval '1 day' where id=${first.id}::uuid`;
            const again = (
              await worker`select app.claim_group_notification_emails(1) result`
            )[0].result[0];
            assert.equal(again.id, first.id);
            assert.notEqual(again.leaseId, first.leaseId);
            assert.equal(
              (
                await worker`select app.finish_group_notification_email(${first.id}::uuid,${first.leaseId}::uuid,'accepted','stale') result`
              )[0].result,
              false,
            );
            await worker`select app.prepare_group_notification_email(${again.id}::uuid,${again.leaseId}::uuid)`;
            await db`update app.group_notification_receipts set lease_until=statement_timestamp()-interval '1 second' where id=${again.id}::uuid`;
            const next = (
              await worker`select app.claim_group_notification_emails(1) result`
            )[0].result;
            assert.ok(next.every((x: { id: string }) => x.id !== again.id));
            assert.equal(
              (
                await db`select state from app.group_notification_receipts where id=${again.id}::uuid`
              )[0].state,
              "unknown",
            );
            for (const claim of next)
              await db`update app.group_notification_receipts set lease_until=statement_timestamp()-interval '1 second' where id=${claim.id}::uuid`;
          } finally {
            await worker.end();
          }
        },
      );
      await t.test(
        "legacy workers leave group jobs alone and version3 reserves capacity for all three kinds",
        async () => {
          const worker = postgres(process.env.NOTIFICATION_TEST_WORKER_URL!, {
            prepare: false,
            max: 1,
            onnotice: () => {},
          });
          try {
            const legacy = (
              await worker`select app.claim_all_notification_emails(5) result`
            )[0].result;
            assert.ok(
              legacy.every((x: { kind: string }) => x.kind !== "group"),
            );
            const venue = (
              await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.id}::uuid and is_primary`
            )[0];
            const date = (
              await db`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text d`
            )[0].d;
            await as(
              coach,
              async (tx) =>
                tx`select app.save_owned_effective_coach_availability(${tx.json({ kind: "dates", operationId: randomUUID(), expectedRevision: 0, dates: [{ date, mode: "custom", hours: [{ localStartTime: "09:00", locationId: venue.id, locationUpdatedAt: venue.stamp }] }] })})`,
            );
            const slot = (
              await db`select id from app.coach_availability_slots where profile_id=${coach.id}::uuid and status='open' and session_type_id is null limit 1`
            )[0].id;
            await as(
              a,
              async (tx) =>
                tx`select app.create_coach_booking_request(${slot}::uuid)`,
            );
            await as(
              a,
              async (tx) =>
                tx`select app.message_command('inquire',${tx.json({ coachId: coach.id, body: "Private content must not enter a group notice.", submissionId: randomUUID() })})`,
            );
            await db`update app.notification_emails set due_at=statement_timestamp()-interval '1 second' where recipient_profile_id=${coach.id}::uuid`;
            const mixed = (
              await worker`select app.claim_notification_emails_v3(3) result`
            )[0].result;
            assert.deepEqual(
              mixed.map((x: { kind: string }) => x.kind).sort(),
              ["booking", "group", "message"],
            );
          } finally {
            await worker.end();
          }
        },
      );
    } finally {
      // Mailpit IDs and all records belong to this disposable scratch target only.
      const jobs =
        await db`select provider_id from app.group_notification_receipts where provider_id is not null`;
      for (const r of jobs)
        if (!captures.includes(r.provider_id)) captures.push(r.provider_id);
      if (captures.length)
        await fetch("http://127.0.0.1:55324/api/v1/messages", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ IDs: captures }),
        });
      await runtime.end();
      await db.end();
    }
  },
);
