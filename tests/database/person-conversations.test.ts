import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import {
  personActor,
  personCommand,
  type PersonActor,
} from "./person-conversation-fixture";

const url = new URL(process.env.DATABASE_TEST_URL!);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55322");
assert.match(url.pathname, /^\/mov177_[a-f0-9]{12}_(fresh|upgrade)$/);
test("person conversation identity, preserved history, sends, reads and block authority", async (t) => {
  const db = postgres(url.toString(), {
    max: 5,
    ssl: false,
    onnotice: () => {},
  });
  const command = (
    a: PersonActor,
    action: string,
    args: Record<string, unknown> = {},
    version = 3,
  ) => personCommand(db, a, action, args, version);
  async function source(a: PersonActor, sql: string, params: string[] = []) {
    return db.begin(async (tx) => {
      await tx`set local role app_runtime`;
      await tx`select set_config('app.current_auth_user_id',${a.auth},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
      return tx.unsafe(sql, params);
    });
  }
  const send = (
    a: PersonActor,
    conversationId: string,
    body: string,
    submissionId: string = randomUUID(),
    version = 3,
    contextId: string | null = null,
  ) =>
    command(
      a,
      "send",
      { conversationId, body, submissionId, contextId },
      version,
    );
  try {
    if (process.env.PERSON_UPGRADE_IDS)
      await t.test(
        "upgrade preserves both aliases, original entry identities and asymmetric read state",
        async () => {
          const f = JSON.parse(process.env.PERSON_UPGRADE_IDS!);
          const [before] =
            await db`select jsonb_agg(to_jsonb(r) order by conversation_id,profile_id) value from app.message_reads r`;
          const forward = await command(f.a, "thread", {
              conversationId: f.forward,
              after: 0,
            }),
            reverse = await command(f.a, "thread", {
              conversationId: f.reverse,
              after: 0,
            });
          assert.deepEqual(forward, reverse);
          assert.equal(forward.conversation.id, f.forward);
          assert.deepEqual(
            forward.entries.map((e: { body: string }) => e.body),
            [
              "Original A conversation",
              "Original reverse conversation",
              "Original unscoped reply",
            ],
          );
          assert.equal(forward.conversation.unread, true);
          const inbox = await command(f.a, "inbox");
          assert.equal(inbox.items.length, 1);
          assert.deepEqual(
            (
              await db`select jsonb_agg(to_jsonb(r) order by conversation_id,profile_id) value from app.message_reads r`
            )[0].value,
            before.value,
          );
          const original =
            await db`select id from app.message_entries where conversation_id in(${f.forward}::uuid,${f.reverse}::uuid)`;
          assert.deepEqual(
            new Set(forward.entries.map((e: { id: string }) => e.id)),
            new Set(original.map((e) => e.id)),
          );
        },
      );
    const a = await personActor(db, "Person coach A", true),
      b = await personActor(db, "Person coach B", true),
      stranger = await personActor(db, "Unrelated person");
    let id: string, reverseId: string;
    await t.test(
      "simultaneous reverse first contacts create one person inbox item and resolve old aliases",
      async () => {
        const results = await Promise.all([
          command(b, "inquire", {
            coachId: a.id,
            body: "From B to A",
            submissionId: randomUUID(),
          }),
          command(a, "inquire", {
            coachId: b.id,
            body: "From A to B",
            submissionId: randomUUID(),
          }),
        ]);
        id = results[0].conversationId;
        assert.equal(results[1].conversationId, id);
        const originals =
          await db`select id from app.message_conversations where run_id=${a.run}::uuid and least(coach_profile_id,athlete_profile_id)=least(${a.id}::uuid,${b.id}::uuid) and greatest(coach_profile_id,athlete_profile_id)=greatest(${a.id}::uuid,${b.id}::uuid)`;
        assert.equal(originals.length, 2);
        reverseId = originals.find((c) => c.id !== id)!.id;
        for (const actor of [a, b]) {
          const inbox = await command(actor, "inbox");
          assert.equal(inbox.items.length, 1);
          assert.equal(inbox.unreadCount, 1);
          const thread = await command(actor, "thread", {
            conversationId: reverseId,
            after: 0,
          });
          assert.equal(thread.conversation.id, id);
          assert.equal(thread.entries.length, 2);
          assert.deepEqual(
            new Set(
              thread.contexts.map((c: { actorRole: string }) => c.actorRole),
            ),
            new Set(["coach", "athlete"]),
          );
          assert.doesNotMatch(
            JSON.stringify(thread),
            /auth_user|email|legalName|private_note|storage_path/i,
          );
        }
      },
    );
    await t.test(
      "restricted app login reproduces and fixes the approved-coach projection flag regression for all clients",
      async () => {
        const runtimeUrl = new URL(process.env.PERSON_RUNTIME_URL!);
        assert.equal(runtimeUrl.hostname, "127.0.0.1");
        assert.equal(runtimeUrl.pathname, url.pathname);
        assert.match(runtimeUrl.username, /^mov177_runtime_[a-f0-9]{12}$/);
        const runtime = postgres(runtimeUrl.toString(), {
          max: 1,
          prepare: false,
          ssl: false,
          onnotice: () => {},
        });
        try {
          const [role] =
            await runtime`select pg_has_role(current_user,'app_runtime','MEMBER') app,pg_has_role(current_user,'app_owner','MEMBER') owner,rolsuper,rolbypassrls from pg_roles where rolname=current_user`;
          assert.equal(role.app, true);
          assert.equal(role.owner, false);
          assert.equal(role.rolsuper, false);
          assert.equal(role.rolbypassrls, false);
          const baseline = readFileSync(
            "supabase/migrations/20261016000100_baseline.sql",
            "utf8",
          );
          const start = baseline.indexOf(
            "CREATE FUNCTION app.mail_coach_enabled(c app.message_conversations)",
          );
          const end = baseline.indexOf(
            "ALTER FUNCTION app.mail_coach_enabled",
            start,
          );
          assert.ok(start > 0 && end > start);
          const [fixed] =
            await db`select pg_get_functiondef('app.mail_coach_enabled(app.message_conversations)'::regprocedure) body`;
          try {
            await db.unsafe(
              baseline
                .slice(start, end)
                .replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"),
            );
            assert.equal(
              (
                await personCommand(
                  runtime,
                  a,
                  "thread",
                  { conversationId: id },
                  2,
                )
              ).conversation.canSendGeneral,
              false,
            );
          } finally {
            await db.unsafe(fixed.body);
          }
          for (const version of [1, 2, 3]) {
            assert.equal(
              (
                await personCommand(
                  runtime,
                  a,
                  "thread",
                  { conversationId: id },
                  version,
                )
              ).conversation.canSendGeneral,
              true,
            );
            await personCommand(
              runtime,
              a,
              "send",
              {
                conversationId: id,
                contextId: null,
                body: "Restricted ordinary send " + version,
                submissionId: randomUUID(),
              },
              version,
            );
          }
        } finally {
          await runtime.end({ timeout: 1 });
        }
      },
    );
    await t.test(
      "connection-only chat reproduces old permission loss after disconnect and ordinary text now preserves contact",
      async () => {
        const client = await personActor(db, "Connection only person");
        const pair = randomUUID(),
          attempt = randomUUID();
        await db.begin(async (tx) => {
          await tx`select app.mail_flags(true)`;
          await tx`insert into app.coach_athlete_connection_pairs(id,run_id,coach_profile_id,athlete_profile_id) values(${pair}::uuid,${a.run}::uuid,${a.id}::uuid,${client.id}::uuid)`;
          await tx`insert into app.coach_athlete_connection_attempts(id,run_id,pair_id,attempt_number,sender_profile_id,recipient_profile_id,status,decided_by_profile_id,decided_at) values(${attempt}::uuid,${a.run}::uuid,${pair}::uuid,1,${client.id}::uuid,${a.id}::uuid,'accepted',${a.id}::uuid,statement_timestamp())`;
        });
        const opened = await command(a, "open", { pairId: pair });
        await send(
          client,
          opened.conversationId,
          "An ordinary connection chat",
        );
        await source(
          a,
          "select app.decide_coach_athlete_connection($1::uuid,'disconnect')",
          [attempt],
        );
        const [prior] =
          await db`select pg_get_functiondef('app.mail_general_allowed(app.message_conversations)'::regprocedure) body`;
        const old = readFileSync(
          "supabase/migrations/20261017000300_retire_message_requests.sql",
          "utf8",
        ).split("-- Keep the projection")[0];
        try {
          await db.unsafe(old);
          assert.equal(
            (
              await command(
                a,
                "thread",
                { conversationId: opened.conversationId },
                2,
              )
            ).conversation.canSendGeneral,
            false,
          );
        } finally {
          await db.unsafe(prior.body);
        }
        assert.equal(
          (
            await command(a, "thread", {
              conversationId: opened.conversationId,
            })
          ).conversation.canSendGeneral,
          true,
        );
        await send(
          a,
          opened.conversationId,
          "Reply after disconnect without a session",
        );
        assert.equal(
          (
            await db`select count(*) from app.message_contexts where conversation_id=${opened.conversationId}::uuid`
          )[0].count,
          "0",
        );
      },
    );
    await t.test(
      "concurrent sends and exact retries share a durable combined sequence and submission identity",
      async () => {
        const submission = randomUUID();
        const results = await Promise.all(
          Array.from({ length: 6 }, (_, i) =>
            send(a, i % 2 ? id : reverseId, "One logical send", submission),
          ),
        );
        assert.equal(new Set(results.map((r) => r.entryId)).size, 1);
        assert.ok(results.every((r) => r.conversationId === id));
        assert.equal(
          (await command(a, "contact", { coachId: b.id })).conversationId,
          id,
        );
        assert.equal(
          (await command(b, "contact", { coachId: a.id })).conversationId,
          id,
        );
        await assert.rejects(send(a, reverseId, "Altered retry", submission));
        await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            send(i % 2 ? a : b, i % 3 ? id : reverseId, "Parallel " + i),
          ),
        );
        const rows =
          await db`select seq from app.message_person_entries where person_id=${id}::uuid order by seq`;
        assert.deepEqual(
          rows.map((r) => r.seq),
          Array.from({ length: rows.length }, (_, i) => i + 1),
        );
        const [legacy] =
          await db`select count(*) from app.message_entries where submission_id=${submission}::uuid`;
        assert.equal(legacy.count, "1");
      },
    );
    await t.test(
      "both original histories page without loss and combined reads preserve later and opposite-source unread entries",
      async () => {
        for (let i = 0; i < 61; i++)
          await send(
            i % 2 ? a : b,
            i % 2 ? reverseId : id,
            "Paged history " + i,
            randomUUID(),
            2,
          );
        const first = await command(a, "thread", {
          conversationId: reverseId,
          after: 0,
        });
        assert.equal(first.entries.length, 50);
        assert.equal(first.hasNewer, true);
        const rest = await command(a, "thread", {
          conversationId: id,
          after: first.entries.at(-1).seq,
        });
        const all = [...first.entries, ...rest.entries];
        assert.equal(new Set(all.map((e) => e.id)).size, first.lastSeq);
        const older = await command(a, "thread", {
          conversationId: id,
          before: rest.entries[0].seq,
        });
        assert.deepEqual(older.entries, first.entries);
        await command(a, "read", {
          conversationId: reverseId,
          through: first.entries.at(-1).seq,
        });
        assert.equal(
          (await command(a, "thread", { conversationId: id })).conversation
            .unread,
          true,
        );
        const counts =
          await db`select e.conversation_id,count(*) from app.message_entries e left join app.message_reads r on r.conversation_id=e.conversation_id and r.profile_id=${a.id}::uuid where e.conversation_id in(${id}::uuid,${reverseId}::uuid) and e.sender_profile_id is distinct from ${a.id}::uuid and e.seq>coalesce(r.last_seq,0) group by e.conversation_id`;
        assert.ok(counts.length > 0);
        await command(a, "read", { conversationId: id, through: rest.lastSeq });
        assert.equal(
          (await command(a, "thread", { conversationId: reverseId }))
            .conversation.unread,
          false,
        );
        assert.equal(
          (await command(b, "thread", { conversationId: id })).conversation
            .unread,
          true,
        );
        await assert.rejects(
          command(a, "thread", {
            conversationId: id,
            contextId: first.contexts[0].id,
          }),
        );
      },
    );
    let booking: string,
      context: string,
      savedId: string,
      savedSubmission: string;
    await t.test(
      "booking activities retain their original direction and independent title permissions",
      async () => {
        const [slot] = await source(
          a,
          "select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '3 days 10 hours') at time zone 'Europe/Berlin',60) id",
        );
        const [request] = await source(
          b,
          "select * from app.create_coach_booking_request($1::uuid)",
          [slot.id],
        );
        const [accepted] = await source(
          a,
          "select * from app.accept_coach_booking_request($1::uuid)",
          [request.request_id],
        );
        booking = accepted.booking_id ?? accepted.accepted_booking_id;
        assert.ok(booking);
        const thread = await command(b, "thread", {
          conversationId: id,
          after: 0,
        });
        const ctx = thread.contexts.find(
          (c: { bookingId: string }) => c.bookingId === booking,
        );
        assert.ok(ctx);
        context = ctx.id;
        assert.equal(ctx.actorRole, "athlete");
        savedSubmission = randomUUID();
        savedId = (await send(a, id, "Saved before block", savedSubmission))
          .entryId;
      },
    );
    await t.test(
      "blocking fences ALL new v1/v2/v3 text and pending email, while exact recovery and booking title access remain",
      async () => {
        await command(b, "block", { conversationId: reverseId });
        for (const version of [1, 2, 3]) {
          await assert.rejects(
            send(a, id, "Blocked ordinary " + version, randomUUID(), version),
          );
          await assert.rejects(
            send(
              a,
              reverseId,
              "Blocked attached " + version,
              randomUUID(),
              version,
              context,
            ),
          );
        }
        assert.equal(
          (await send(a, id, "Saved before block", savedSubmission)).entryId,
          savedId,
        );
        const paused = await command(a, "thread", { conversationId: id });
        assert.equal(paused.conversation.canSendGeneral, false);
        assert.equal(paused.conversation.blocked, true);
        const ctx = paused.contexts.find(
          (c: { bookingId: string }) => c.bookingId === booking,
        );
        assert.equal(ctx.canEditTitle, true);
        await command(a, "session-title", {
          bookingId: booking,
          title: "Independent booking title",
          expectedRevision: ctx.titleRevision,
        });
        const [job] =
          await db`select id from app.notification_emails where conversation_id=${id}::uuid and recipient_profile_id=${b.id}::uuid and closed_at is null order by due_at limit 1`;
        assert.ok(job);
        const lease = randomUUID();
        await db`update app.notification_emails set state='claimed',lease_id=${lease}::uuid,lease_until=statement_timestamp()+interval '1 minute',attempts=1,due_at=statement_timestamp()-interval '1 second' where id=${job.id}::uuid`;
        assert.equal(
          (
            await db`select app.prepare_notification_email(${job.id}::uuid,${lease}::uuid) value`
          )[0].value,
          null,
        );
        assert.equal(
          (
            await db`select state from app.notification_emails where id=${job.id}::uuid`
          )[0].state,
          "suppressed",
        );
        await command(b, "unblock", { conversationId: id });
        await send(a, id, "Ordinary chat resumes without reconnecting");
      },
    );
    await t.test(
      "block wins an actual overlapping send transaction without a new text or sequence hole",
      async () => {
        let acquired!: () => void, release!: () => void;
        const ready = new Promise<void>((r) => {
            acquired = r;
          }),
          gate = new Promise<void>((r) => {
            release = r;
          });
        const block = db.begin(async (tx) => {
          await tx`set local role app_runtime`;
          await tx`select set_config('app.current_auth_user_id',${b.auth},true),set_config('app.current_profile_id',${b.id},true),set_config('app.current_run_id',${b.run},true),set_config('app.current_run_role','member',true)`;
          await tx`select app.message_command_v3('block',jsonb_build_object('conversationId',${id}::text))`;
          acquired();
          await gate;
        });
        await ready;
        const pending = send(a, id, "Must not race past block");
        release();
        await block;
        await assert.rejects(pending);
        await command(b, "unblock", { conversationId: id });
        const rows =
          await db`select seq from app.message_person_entries where person_id=${id}::uuid order by seq`;
        assert.deepEqual(
          rows.map((r) => r.seq),
          Array.from({ length: rows.length }, (_, i) => i + 1),
        );
      },
    );
    await t.test(
      "empty, nonparticipant, forged, revoked and cross-dataset contexts cannot acquire outreach or private history",
      async () => {
        await assert.rejects(
          command(stranger, "thread", { conversationId: reverseId }),
        );
        await assert.rejects(
          command({ ...a, auth: stranger.auth }, "thread", {
            conversationId: id,
          }),
        );
        await assert.rejects(
          command({ ...a, run: randomUUID() }, "thread", {
            conversationId: id,
          }),
        );
        const [empty] = await db.begin(async (tx) => {
          await tx`select app.mail_flags(true)`;
          return tx`select (app.mail_ensure_conversation(${a.run}::uuid,${a.id}::uuid,${stranger.id}::uuid)).id`;
        });
        assert.equal(
          (await command(stranger, "thread", { conversationId: empty.id }))
            .conversation.canSendGeneral,
          false,
        );
        await assert.rejects(
          send(a, empty.id, "Empty conversation is not contact"),
        );
        await db`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where run_id=${stranger.run}::uuid and profile_id=${stranger.id}::uuid`;
        await assert.rejects(
          command(stranger, "thread", { conversationId: empty.id }),
        );
        for (const role of [
          "anon",
          "authenticated",
          "service_role",
          "app_runtime",
          "app_notification_worker",
          "app_media_worker",
        ]) {
          const [r] =
            await db`select has_table_privilege(${role},'app.message_people','select') people,has_table_privilege(${role},'app.message_person_entries','select') entries,has_function_privilege(${role},'app.mail_person_allowed(uuid,uuid,uuid)','execute') helper,has_function_privilege(${role},'app.message_command_v3(text,jsonb)','execute') rpc`;
          assert.equal(r.people, false);
          assert.equal(r.entries, false);
          assert.equal(r.helper, false);
          assert.equal(r.rpc, role === "app_runtime");
        }
      },
    );
    await t.test(
      "person inbox pages tied timestamps after deduplication without losing or repeating people",
      async () => {
        for (let i = 0; i < 23; i++) {
          const client = await personActor(db, "Paged person " + i);
          await command(client, "inquire", {
            coachId: a.id,
            body: "Paging contact " + i,
            submissionId: randomUUID(),
          });
        }
        await db`update app.message_conversations set activity_at='2026-11-07T00:00:00Z' where coach_profile_id=${a.id}::uuid or athlete_profile_id=${a.id}::uuid`;
        const first = await command(a, "inbox"),
          last = first.items.at(-1);
        assert.equal(first.items.length, 20);
        const rest = await command(a, "inbox", {
          beforeAt: last.activityAt,
          beforeId: last.id,
        });
        const rows = [...first.items, ...rest.items];
        assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
        assert.equal(rows.length, 25);
        assert.equal(rows.filter((r) => r.id === id).length, 1);
      },
    );
  } finally {
    await db.end({ timeout: 2 });
  }
});
