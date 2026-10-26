import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { runNotificationWorker } from "@/server/notifications/worker";
import { withNotificationWorker } from "@/server/db/notifications/worker";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { notificationCommandRecord } from "@/server/db/notifications/repository";
import { parseNotificationPage } from "@/notifications/contracts";

const url = process.env.DATABASE_TEST_URL;
const isolated =
  !!url &&
  /^\/mov79_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(url).pathname) &&
  ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
test(
  "notification recipient authority, unread periods and durable worker recovery",
  { skip: !isolated },
  async (t) => {
    const db = postgres(url!, { max: 4, ssl: false, onnotice: () => {} });
    try {
      const actors = [];
      for (let i = 0; i < 3; i++) {
        const authId = randomUUID();
        await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${authId}::uuid,${`mov79-${authId}@example.test`},statement_timestamp(),false,false)`;
        const [p] =
          await db`select * from app.enroll_application_identity(${authId}::uuid,${`Notification Test ${i}`})`;
        actors.push({
          authId,
          id: p.identity_profile_id as string,
          run: p.identity_run_id as string,
        });
      }
      const [coach, athlete, other] = actors;
      async function actorCommand(
        a: typeof coach,
        fn: string,
        action: string,
        args: Record<string, unknown> = {},
      ) {
        return db.begin(async (tx) => {
          await tx.unsafe("set local role app_runtime");
          await tx`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
          const [context] =
            await tx`select app.authorized_actor_context_valid(null,null,null) valid`;
          assert.equal(
            context.valid,
            true,
            `Fixture actor rejected before ${fn}/${action}: ${JSON.stringify(a)}`,
          );
          const input = tx.json(args as postgres.JSONValue);
          const [r] =
            fn === "message_command"
              ? await tx`select app.message_command(${action},${input}) result`
              : await tx`select app.notification_command(${action},${input}) result`;
          return r.result;
        });
      }
      await db.begin(async (tx) => {
        await tx`select set_config('app.current_auth_user_id',${coach.authId},true),set_config('app.current_profile_id',${coach.id},true),set_config('app.current_run_id',${coach.run},true),set_config('app.current_run_role','member',true)`;
        await tx`select app.submit_owned_coach_application()`;
        await tx`select app.upsert_owned_coach_profile('Notification Coach','Focused private boxing practice with clear session preparation for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
        await tx`select app.review_coach_application(${coach.id}::uuid,'pending','approved','Notification fixture reviewed.','mov79-test','movx-identity-application-v1')`;
        await tx`update app.coach_profiles set visibility='visible' where profile_id=${coach.id}::uuid`;
      });
      const submissionId = randomUUID();
      const saved = await actorCommand(athlete, "message_command", "inquire", {
        coachId: coach.id,
        body: "Private content stays in Messages",
        submissionId,
      });
      const conversationId = saved.conversationId as string;
      const list = (a = coach, args = {}) =>
        actorCommand(a, "notification_command", "list", args);
      const read = (through: number) =>
        actorCommand(coach, "message_command", "read", {
          conversationId,
          through,
        });
      const send = () =>
        actorCommand(athlete, "message_command", "send", {
          conversationId,
          contextId: null,
          body: "Another private text",
          submissionId: randomUUID(),
        });
      async function worker(fn: string, args: unknown[] = []) {
        return db.begin(async (tx) => {
          await tx.unsafe("set local role app_notification_worker");
          const [r] = await tx.unsafe(
            `select app.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) result`,
            args as string[],
          );
          return r.result;
        });
      }
      const claim = () => worker("claim_notification_emails", [10]);
      async function due() {
        await db`update app.notification_emails set due_at=statement_timestamp()-interval '1 second' where conversation_id=${conversationId}::uuid`;
      }
      await t.test(
        "atomic capture, exact retry, no sender alert, no body/address disclosure",
        async () => {
          assert.deepEqual(
            await actorCommand(athlete, "message_command", "inquire", {
              coachId: coach.id,
              body: "Private content stays in Messages",
              submissionId,
            }),
            saved,
          );
          const page = await list();
          assert.equal(page.unreadCount, 1);
          assert.equal(page.items.length, 1);
          assert.equal((await list(athlete)).unreadCount, 0);
          assert.doesNotMatch(
            JSON.stringify(page),
            /Private content|@example|authId|email/,
          );
          assert.equal(
            (
              await db`select count(*)::int n from app.notification_emails where conversation_id=${conversationId}::uuid`
            )[0].n,
            1,
          );
          assert.deepEqual(await claim(), []);
          await assert.rejects(
            actorCommand(other, "notification_command", "read", {
              id: page.items[0].id,
            }),
          );
          assert.equal((await list(other)).items.length, 0);
        },
      );
      await t.test(
        "later text preserves deadline; bell read does not suppress email",
        async () => {
          const [before] =
            await db`select due_at from app.notification_emails where conversation_id=${conversationId}::uuid`;
          await send();
          const [after] =
            await db`select due_at from app.notification_emails where conversation_id=${conversationId}::uuid`;
          assert.equal(String(before.due_at), String(after.due_at));
          const page = await list();
          await actorCommand(coach, "notification_command", "read-all", {
            throughAt: page.snapshotAt,
          });
          assert.equal((await list()).unreadCount, 0);
          assert.equal(
            (
              await actorCommand(coach, "message_command", "thread", {
                conversationId,
              })
            ).readThrough,
            0,
          );
          await due();
          const [a, b] = await Promise.all([claim(), claim()]);
          assert.equal(
            a.length + b.length,
            1,
            "Concurrent worker claimed one job twice",
          );
          const job = [...a, ...b][0];
          const payload = await worker("prepare_notification_email", [
            job.id,
            job.leaseId,
          ]);
          assert.equal(payload.conversationId, conversationId);
          assert.match(payload.email, /@example.test$/);
          assert.doesNotMatch(
            JSON.stringify(payload),
            /Private content|Another private/,
          );
          assert.equal(
            await worker("finish_notification_email", [
              job.id,
              randomUUID(),
              "accepted",
              "wrong",
            ]),
            false,
          );
          assert.equal(
            await worker("finish_notification_email", [
              job.id,
              job.leaseId,
              "accepted",
              "test-accepted",
            ]),
            true,
          );
          await send();
          await due();
          assert.deepEqual(await claim(), []);
        },
      );
      await t.test(
        "partial read does not rearm; complete read creates a new unread period",
        async () => {
          await read(1);
          await send();
          assert.equal(
            (
              await db`select count(*)::int n from app.notification_emails where conversation_id=${conversationId}::uuid`
            )[0].n,
            1,
          );
          await read(4);
          await send();
          await due();
          const [job] = await claim();
          assert.ok(job);
          await read(5);
          assert.equal(
            await worker("prepare_notification_email", [job.id, job.leaseId]),
            null,
          );
          await send();
          await due();
          const [next] = await claim();
          assert.ok(next);
          await worker("prepare_notification_email", [next.id, next.leaseId]);
          await db`update app.notification_emails set lease_until=statement_timestamp()-interval '1 second' where id=${next.id}::uuid`;
          assert.deepEqual(await claim(), []);
          assert.equal(
            (
              await db`select state from app.notification_emails where id=${next.id}::uuid`
            )[0].state,
            "unknown",
          );
          assert.equal(
            await worker("finish_notification_email", [
              next.id,
              next.leaseId,
              "accepted",
              "late",
            ]),
            false,
          );
        },
      );
      await t.test(
        "current block and verified recipient access suppress delayed mail",
        async () => {
          await read(6);
          await send();
          await due();
          const [job] = await claim();
          await actorCommand(coach, "message_command", "block", {
            conversationId,
          });
          assert.equal(
            await worker("prepare_notification_email", [job.id, job.leaseId]),
            null,
          );
          assert.equal((await list()).items.length, 0);
          await actorCommand(coach, "message_command", "unblock", {
            conversationId,
          });
          await read(7);
          await send();
          await due();
          const [next] = await claim();
          await db`update auth.users set banned_until=statement_timestamp()+interval '1 hour' where id=${coach.authId}::uuid`;
          assert.equal(
            await worker("prepare_notification_email", [next.id, next.leaseId]),
            null,
          );
          await db`update auth.users set banned_until=null where id=${coach.authId}::uuid`;
        },
      );
      await t.test(
        "runtime and browser roles cannot read outbox/Auth or use worker entry points",
        async () => {
          for (const role of [
            "app_runtime",
            "anon",
            "authenticated",
            "app_notification_worker",
          ]) {
            await assert.rejects(
              db.begin(async (tx) => {
                await tx.unsafe(`set local role ${role}`);
                await tx`select * from app.notification_emails`;
              }),
            );
            await assert.rejects(
              db.begin(async (tx) => {
                await tx.unsafe(`set local role ${role}`);
                await tx`select email from auth.users`;
              }),
            );
          }
          await assert.rejects(
            db.begin(async (tx) => {
              await tx.unsafe("set local role app_runtime");
              await tx`select app.claim_notification_emails(10)`;
            }),
          );
          await assert.rejects(
            db.begin(async (tx) => {
              await tx.unsafe("set local role app_notification_worker");
              await tx`select app.notification_recipient_email(${randomUUID()}::uuid)`;
            }),
          );
          assert.equal(
            (
              await db`select rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname='app_notification_worker'`
            )[0].rolcanlogin,
            false,
          );
        },
      );
      async function clearConversation() {
        const [row] =
          await db`select last_seq from app.message_conversations where id=${conversationId}::uuid`;
        await read(row.last_seq);
      }
      await t.test(
        "mark-all preserves later arrivals; history pages and rollback are bounded and stable",
        async () => {
          const snapshot = await list();
          await send();
          await actorCommand(coach, "notification_command", "read-all", {
            throughAt: snapshot.snapshotAt,
          });
          assert.equal(
            (await list(coach, { filter: "unread" })).items.length,
            1,
          );
          for (let i = 0; i < 22; i++) await send();
          const first = await list();
          assert.equal(first.items.length, 20);
          assert.equal(first.hasMore, true);
          const last = first.items.at(-1);
          const next = await list(coach, {
            beforeAt: last.createdAt,
            beforeId: last.id,
          });
          assert.ok(next.items.length > 0);
          assert.ok(
            !next.items.some((x: { id: string }) =>
              first.items.some((y: { id: string }) => y.id === x.id),
            ),
          );
          const [before] =
            await db`select count(*)::int n from app.notifications`;
          const rollback = new Error("deliberate rollback");
          await assert.rejects(
            db.begin(async (tx) => {
              await tx.unsafe("set local role app_runtime");
              await tx`select set_config('app.current_auth_user_id',${athlete.authId},true),set_config('app.current_profile_id',${athlete.id},true),set_config('app.current_run_id',${athlete.run},true),set_config('app.current_run_role','member',true)`;
              await tx`select app.message_command('send',${tx.json({ conversationId, contextId: null, body: "Rolled back", submissionId: randomUUID() })})`;
              throw rollback;
            }),
            (error) => error === rollback,
          );
          assert.equal(
            (await db`select count(*)::int n from app.notifications`)[0].n,
            before.n,
          );
        },
      );
      await t.test(
        "expired pre-handoff claims fence old workers and transient retries are bounded",
        async () => {
          await clearConversation();
          await send();
          await due();
          const [old] = await claim();
          await db`update app.notification_emails set lease_until=statement_timestamp()-interval '1 second' where id=${old.id}::uuid`;
          const [current] = await claim();
          assert.equal(current.id, old.id);
          assert.notEqual(current.leaseId, old.leaseId);
          assert.equal(
            await worker("prepare_notification_email", [old.id, old.leaseId]),
            null,
          );
          let job = current;
          for (let attempt = 2; attempt <= 5; attempt++) {
            assert.ok(
              await worker("prepare_notification_email", [job.id, job.leaseId]),
            );
            assert.equal(
              await worker("finish_notification_email", [
                job.id,
                job.leaseId,
                "retry",
                null,
              ]),
              true,
            );
            const [row] =
              await db`select state,due_at>statement_timestamp() backed_off from app.notification_emails where id=${job.id}::uuid`;
            assert.equal(row.state, attempt === 5 ? "failed" : "queued");
            assert.equal(row.backed_off, true);
            await due();
            if (attempt < 5) [job] = await claim();
          }
          assert.deepEqual(await claim(), []);
        },
      );
      await t.test(
        "actual recipient repository uses a restricted app login and rejects a forged identity",
        { skip: !process.env.NOTIFICATION_TEST_RUNTIME_URL },
        async () => {
          const previous = process.env.DATABASE_URL;
          process.env.DATABASE_URL = process.env.NOTIFICATION_TEST_RUNTIME_URL;
          const actor = {
            authUserId: coach.authId,
            profileId: coach.id,
            runId: coach.run,
            runRole: "member" as const,
          };
          try {
            const page = await withActorDatabaseContext(actor, (tx) =>
              notificationCommandRecord(tx, { action: "list", args: {} }),
            );
            const parsed = parseNotificationPage(page);
            const direct = await list();
            assert.deepEqual(parsed.items, direct.items);
            assert.equal(parsed.unreadCount, direct.unreadCount);
            await assert.rejects(
              withActorDatabaseContext(
                { ...actor, authUserId: other.authId },
                (tx) =>
                  notificationCommandRecord(tx, { action: "list", args: {} }),
              ),
              /no longer authorized/,
            );
          } finally {
            if (previous === undefined) delete process.env.DATABASE_URL;
            else process.env.DATABASE_URL = previous;
          }
        },
      );
      await t.test(
        "real restricted worker captures one minimal email in loopback Mailpit",
        { skip: !process.env.NOTIFICATION_TEST_WORKER_URL },
        async () => {
          await clearConversation();
          await send();
          await due();
          const environment = {
            NOTIFICATION_DELIVERY_ENABLED: "true",
            NOTIFICATION_DATABASE_URL: process.env.NOTIFICATION_TEST_WORKER_URL,
            NOTIFICATION_TRANSPORT: "mailpit",
            NOTIFICATION_MAILPIT_URL: "http://127.0.0.1:55324",
            NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
          };
          await assert.rejects(
            withNotificationWorker(url, async () => {}),
            /restricted worker/,
          );
          let captureId: string | undefined;
          try {
            const result = await runNotificationWorker(environment, 3);
            assert.equal(result.accepted, 1);
            const [job] =
              await db`select id,provider_id from app.notification_emails where conversation_id=${conversationId}::uuid and closed_at is null`;
            assert.ok(job.provider_id);
            captureId = job.provider_id;
            const response = await fetch(
              `http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(captureId!)}/raw`,
            );
            assert.equal(response.status, 200);
            const raw = await response.text();
            assert.match(raw, /From: "?MovX Club"? <notification@movx.club>/i);
            assert.match(raw, /Reply-To:.*hello@movx.club/i);
            assert.match(
              raw,
              new RegExp(`X-MovX-Notification: ${job.id}`, "i"),
            );
            assert.match(raw, new RegExp(conversationId));
            assert.doesNotMatch(
              raw,
              /Another private text|Private content stays/,
            );
            assert.equal(
              (await runNotificationWorker(environment, 3)).claimed,
              0,
            );
          } finally {
            if (captureId) {
              const response = await fetch(
                "http://127.0.0.1:55324/api/v1/messages",
                {
                  method: "DELETE",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ IDs: [captureId] }),
                },
              );
              assert.equal(
                response.ok,
                true,
                "Exact owned Mailpit capture cleanup failed",
              );
            }
          }
        },
      );
    } finally {
      await db.end();
    }
  },
);
