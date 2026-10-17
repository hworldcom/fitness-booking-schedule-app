import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_TEST_URL;
if (!url) throw new Error("DATABASE_TEST_URL is required.");
class RolledBack extends Error {}

test("private message database authority, unlimited sends, retries and read isolation", async (t) => {
  const db = postgres(url, { max: 1, ssl: false, onnotice: () => {} });
  try {
    await db.begin(async (tx) => {
      if (
        !(await tx`select to_regclass('app.message_conversations') present`)[0]
          .present
      )
        await tx.unsafe(
          readFileSync(
            "supabase/migration-history/20261016000100/20261015000100_private_message_authority.sql",
            "utf8",
          ),
        );
      if (
        !(
          await tx`select to_regprocedure('app.mail_change_block(app.message_conversations,uuid,boolean)') present`
        )[0].present
      )
        await tx.unsafe(
          readFileSync(
            "supabase/migration-history/20261016000100/20261015000200_integrate_private_messages.sql",
            "utf8",
          ),
        );
      if (
        !(
          await tx`select 1 from pg_policies where schemaname='app' and tablename='demo_run_participants' and policyname='message_membership_select'`
        ).length
      )
        await tx.unsafe(
          readFileSync(
            "supabase/migration-history/20261016000100/20261015000300_harden_private_message_integration.sql",
            "utf8",
          ),
        );
      if (
        !(
          await tx`select to_regprocedure('app.mail_guard_consent_submission()') present`
        )[0].present
      )
        await tx.unsafe(
          readFileSync(
            "supabase/migration-history/20261016000100/20261015000400_reserve_message_consent_submissions.sql",
            "utf8",
          ),
        );
      await tx.unsafe(
        readFileSync(
          "supabase/migrations/20261017000100_normal_coach_conversations.sql",
          "utf8",
        ),
      );
      await tx.unsafe(
        readFileSync(
          "supabase/migrations/20261017000200_unlimited_coach_messages.sql",
          "utf8",
        ),
      );
      await tx.unsafe(
        readFileSync(
          "supabase/migrations/20261017000300_retire_message_requests.sql",
          "utf8",
        ),
      );
      await tx.unsafe(
        readFileSync(
          "supabase/migrations/20261017000400_message_counterpart_media.sql",
          "utf8",
        ),
      );
      await tx.unsafe(
        readFileSync(
          "supabase/migrations/20261017000400_message_counterpart_media.sql",
          "utf8",
        ),
      );
      const actors = [];
      for (let i = 0; i < 4; i++) {
        const authId = randomUUID();
        await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${authId}::uuid,false,false)`;
        const [p] =
          await tx`select * from app.enroll_application_identity(${authId}::uuid,${"Mailbox Test " + i})`;
        actors.push({
          authId,
          id: p.identity_profile_id as string,
          run: p.identity_run_id as string,
        });
      }
      const [coach, athlete, other, outsider] = actors;
      async function act(a: typeof coach) {
        await tx.unsafe("set local role app_runtime");
        await tx`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
      }
      async function command(
        a: typeof coach,
        action: string,
        args: Record<string, unknown> = {},
      ) {
        return tx.savepoint(async (s) => {
          await act(a);
          const [r] =
            await s`select app.message_command(${action},${s.json(args as postgres.JSONValue)}) result`;
          return r.result;
        });
      }
      await act(coach);
      await tx`select app.submit_owned_coach_application()`;
      await tx`select app.upsert_owned_coach_profile('Mailbox Coach','Focused private boxing practice with clear session preparation for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
      await tx.unsafe("reset role");
      await tx`select app.review_coach_application(${coach.id}::uuid,'pending','approved','Mailbox test full profile reviewed.','database-test','movx-identity-application-v1')`;
      await tx`update app.coach_profiles set visibility='visible' where profile_id=${coach.id}::uuid`;
      const submissionId = randomUUID();
      let conversationId: string;
      let contextId: string;
      await t.test(
        "pre-request inquiry saves once and exposes no emails or private images",
        async () => {
          const saved = await command(athlete, "inquire", {
            coachId: coach.id,
            body: "Can we practise footwork?",
            submissionId,
          });
          conversationId = saved.conversationId;
          assert.deepEqual(
            await command(athlete, "inquire", {
              coachId: coach.id,
              body: "Can we practise footwork?",
              submissionId,
            }),
            saved,
          );
          const thread = await command(coach, "thread", { conversationId });
          assert.equal(thread.entries.length, 1);
          assert.equal(thread.entries[0].body, "Can we practise footwork?");
          assert.equal(thread.conversation.unread, true);
          assert.equal(thread.conversation.canSendGeneral, true);
          contextId = thread.contexts[0].id;
          assert.equal(thread.contexts[0].canSend, true);
          assert.ok(
            !/authUser|email|avatar|private_note/i.test(JSON.stringify(thread)),
          );
        },
      );
      await t.test(
        "message pictures reuse independent grants and never expose private paths",
        async () => {
          try {
            await tx.savepoint(async (sp) => {
              await sp.unsafe("reset role");
              const avatarPath = `${athlete.id}/${randomUUID()}.webp`;
              const portraitPath = `${coach.id}/${randomUUID()}.webp`;
              await sp`update app.profiles set avatar_storage_path=${avatarPath}, avatar_updated_at=statement_timestamp() where id=${athlete.id}::uuid`;
              await sp`update app.coach_profiles set portrait_source='storage',portrait_path=${portraitPath},portrait_updated_at=statement_timestamp() where profile_id=${coach.id}::uuid`;
              assert.equal(
                (await command(coach, "thread", { conversationId }))
                  .conversation.counterpartMedia,
                null,
              );
              const portrait = (
                await command(athlete, "thread", { conversationId })
              ).conversation.counterpartMedia;
              assert.equal(portrait.kind, "coach-portrait");
              assert.equal(portrait.path, portraitPath);
              assert.ok(!JSON.stringify(portrait).includes(avatarPath));
              await assert.rejects(
                command(outsider, "thread", { conversationId }),
              );
              const slot = await source(
                coach,
                "select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '4 days 14 hours') at time zone 'Europe/Berlin',60) id",
                [],
              );
              const [request] = await source(
                athlete,
                "select * from app.create_coach_booking_request($1::uuid)",
                [slot[0].id],
              );
              const requestMedia = (
                await command(coach, "thread", { conversationId })
              ).conversation.counterpartMedia;
              assert.equal(requestMedia.kind, "request-avatar");
              assert.equal(requestMedia.id, request.request_id);
              assert.ok(!JSON.stringify(requestMedia).includes(avatarPath));
              const [accepted] = await source(
                coach,
                "select * from app.accept_coach_booking_request($1::uuid)",
                [request.request_id],
              );
              const connectionId = randomUUID();
              await source(
                coach,
                "select app.send_coach_athlete_connection($1::uuid,$2::uuid,null)",
                [accepted.booking_id, connectionId],
              );
              assert.equal(
                (await command(coach, "thread", { conversationId }))
                  .conversation.counterpartMedia.kind,
                "request-avatar",
              );
              await source(
                athlete,
                "select app.decide_coach_athlete_connection($1::uuid,'accept')",
                [connectionId],
              );
              const connected = (
                await command(coach, "thread", { conversationId })
              ).conversation.counterpartMedia;
              assert.equal(connected.kind, "connection-avatar");
              assert.equal(connected.id, connectionId);
              const inbox = await command(coach, "inbox", { filter: "all" });
              assert.deepEqual(
                inbox.items.find(
                  (item: { id: string }) => item.id === conversationId,
                ).counterpartMedia,
                connected,
              );
              await source(
                athlete,
                "select app.decide_coach_athlete_connection($1::uuid,'disconnect')",
                [connectionId],
              );
              assert.equal(
                (await command(coach, "thread", { conversationId }))
                  .conversation.counterpartMedia.kind,
                "request-avatar",
              );
              await sp.unsafe("reset role");
              await sp`update app.profiles set avatar_storage_path=null,avatar_updated_at=null where id=${athlete.id}::uuid`;
              assert.equal(
                (await command(coach, "thread", { conversationId }))
                  .conversation.counterpartMedia,
                null,
              );
              await act(coach);
              await sp`select set_config('app.current_run_id',${randomUUID()},true)`;
              await assert.rejects(
                sp.savepoint(async (nested) => {
                  await nested`select app.message_command('thread',jsonb_build_object('conversationId',${conversationId}::text))`;
                }),
              );
              throw new RolledBack();
            });
          } catch (e) {
            if (!(e instanceof RolledBack)) throw e;
          }
        },
      );
      await t.test(
        "forward upgrade opens normal chat without rewriting history or granting empty-conversation outreach",
        async () => {
          try {
            await tx.savepoint(async () => {
              await tx.unsafe("reset role");
              const frozen = readFileSync(
                "supabase/migration-history/20261016000100/20261015000100_private_message_authority.sql",
                "utf8",
              );
              const oldPermission = frozen.slice(
                frozen.indexOf("create function app.mail_general_allowed("),
                frozen.indexOf("create function app.mail_general_eligible("),
              );
              assert.ok(oldPermission.includes("message_consents"));
              await tx.unsafe(
                oldPermission.replace(
                  "create function",
                  "create or replace function",
                ),
              );
              const original = await command(athlete, "thread", {
                conversationId,
              });
              assert.equal(original.conversation.canSendGeneral, false);
              await assert.rejects(
                command(athlete, "send", {
                  conversationId,
                  contextId: null,
                  body: "Before upgrade",
                  submissionId: randomUUID(),
                }),
                /consent required/,
              );
              await tx.unsafe("reset role");
              const [privileges] =
                await tx`select proowner,proacl,prosecdef,proconfig from pg_proc where oid='app.mail_general_allowed(app.message_conversations)'::regprocedure`;
              await tx.unsafe(
                readFileSync(
                  "supabase/migrations/20261017000100_normal_coach_conversations.sql",
                  "utf8",
                ),
              );
              assert.deepEqual(
                (
                  await tx`select proowner,proacl,prosecdef,proconfig from pg_proc where oid='app.mail_general_allowed(app.message_conversations)'::regprocedure`
                )[0],
                privileges,
              );
              const upgraded = await command(athlete, "thread", {
                conversationId,
              });
              assert.equal(upgraded.conversation.canSendGeneral, true);
              assert.deepEqual(upgraded.entries, original.entries);
              assert.deepEqual(upgraded.contexts, original.contexts);
              assert.equal(upgraded.readThrough, original.readThrough);
              assert.equal(
                upgraded.conversation.consent,
                original.conversation.consent,
              );
              assert.equal(upgraded.lastSeq, original.lastSeq);
              const first = {
                conversationId,
                contextId: null,
                body: "Normal athlete message",
                submissionId: randomUUID(),
              };
              const sent = await command(athlete, "send", first);
              assert.deepEqual(await command(athlete, "send", first), sent);
              await assert.rejects(
                command(athlete, "send", { ...first, body: "Changed retry" }),
                /submission conflicts/,
              );
              await command(coach, "send", {
                conversationId,
                contextId: null,
                body: "Normal coach reply",
                submissionId: randomUUID(),
              });
              const current = await command(athlete, "thread", {
                conversationId,
              });
              assert.equal(current.lastSeq, original.lastSeq + 2);
              assert.equal(current.conversation.consent, null);
              assert.ok(
                current.entries
                  .slice(-2)
                  .every(
                    (entry: { contextId: string | null }) =>
                      entry.contextId === null,
                  ),
              );
              await tx.unsafe("reset role");
              const [empty] =
                await tx`select (app.mail_ensure_conversation(${coach.run}::uuid,${coach.id}::uuid,${other.id}::uuid)).id`;
              const emptyThread = await command(other, "thread", {
                conversationId: empty.id,
              });
              assert.equal(emptyThread.conversation.canSendGeneral, false);
              await assert.rejects(
                command(other, "send", {
                  conversationId: empty.id,
                  contextId: null,
                  body: "No established contact",
                  submissionId: randomUUID(),
                }),
                /consent required/,
              );
              await assert.rejects(
                command(outsider, "send", {
                  conversationId,
                  contextId: null,
                  body: "Intrusion",
                  submissionId: randomUUID(),
                }),
              );
              throw new RolledBack();
            });
          } catch (error) {
            if (!(error instanceof RolledBack)) throw error;
          }
        },
      );
      await t.test(
        "retiring approvals preserves historical-only contact and clears pending-only unread without widening access",
        async () => {
          try {
            await tx.savepoint(async () => {
              await tx.unsafe("reset role");
              const frozen = readFileSync(
                "supabase/migration-history/20261016000100/20261015000100_private_message_authority.sql",
                "utf8",
              );
              const oldProjection = frozen.slice(
                frozen.indexOf(
                  "create function app.mail_conversation_projection(",
                ),
                frozen.indexOf("create function app.mail_dispatch("),
              );
              await tx.unsafe(
                oldProjection.replace(
                  "create function",
                  "create or replace function",
                ),
              );
              await tx.unsafe(
                readFileSync(
                  "supabase/migrations/20261017000100_normal_coach_conversations.sql",
                  "utf8",
                ),
              );
              const [legacy] =
                await tx`select (app.mail_ensure_conversation(${coach.run}::uuid,${coach.id}::uuid,${other.id}::uuid)).id`;
              const consentId = randomUUID();
              await tx`insert into app.message_consents(id,conversation_id,sender_profile_id,recipient_profile_id,first_body) values(${consentId}::uuid,${legacy.id}::uuid,${other.id}::uuid,${coach.id}::uuid,'An earlier opening remains readable')`;
              const original = await command(coach, "thread", {
                conversationId: legacy.id,
              });
              assert.equal(original.conversation.unread, true);
              assert.equal(original.conversation.canSendGeneral, false);
              const originalInbox = await command(coach, "inbox", {
                filter: "unread",
              });
              await tx.unsafe("reset role");
              const audit =
                await tx`select * from app.message_consents where id=${consentId}::uuid`;
              const functionMetadata = async () =>
                tx`select proname,proowner,proacl,prosecdef,proconfig from pg_proc where oid in ('app.mail_general_allowed(app.message_conversations)'::regprocedure,'app.mail_conversation_projection(app.message_conversations,uuid)'::regprocedure) order by proname`;
              const privileges = await functionMetadata();
              const migration = readFileSync(
                "supabase/migrations/20261017000300_retire_message_requests.sql",
                "utf8",
              );
              await tx.unsafe(migration);
              await tx.unsafe(migration);
              assert.deepEqual(await functionMetadata(), privileges);
              assert.deepEqual(
                await tx`select * from app.message_consents where id=${consentId}::uuid`,
                audit,
              );
              const upgraded = await command(coach, "thread", {
                conversationId: legacy.id,
              });
              assert.equal(upgraded.conversation.canSendGeneral, true);
              assert.equal(upgraded.conversation.canRequestGeneral, false);
              assert.equal(upgraded.conversation.unread, false);
              const unreadInbox = await command(coach, "inbox", {
                filter: "unread",
              });
              assert.equal(
                unreadInbox.unreadCount,
                originalInbox.unreadCount - 1,
              );
              assert.ok(
                !unreadInbox.items.some(
                  (item: { id: string }) => item.id === legacy.id,
                ),
              );
              assert.ok(
                (await command(coach, "inbox", { filter: "all" })).items.some(
                  (item: { id: string }) => item.id === legacy.id,
                ),
              );
              assert.deepEqual(upgraded.entries, original.entries);
              assert.deepEqual(upgraded.contexts, original.contexts);
              assert.equal(upgraded.readThrough, original.readThrough);
              assert.deepEqual(
                upgraded.conversation.consent,
                original.conversation.consent,
              );
              const args = {
                conversationId: legacy.id,
                contextId: null,
                submissionId: randomUUID(),
                body: "Normal reply without approval",
              };
              const sent = await command(other, "send", args);
              assert.deepEqual(await command(other, "send", args), sent);
              await assert.rejects(
                command(other, "send", { ...args, body: "Changed retry" }),
                /submission conflicts/,
              );
              const incoming = await command(coach, "thread", {
                conversationId: legacy.id,
              });
              assert.equal(incoming.conversation.unread, true);
              await command(coach, "read", {
                conversationId: legacy.id,
                through: incoming.lastSeq,
              });
              assert.equal(
                (await command(coach, "thread", { conversationId: legacy.id }))
                  .conversation.unread,
                false,
              );
              await command(coach, "send", {
                ...args,
                submissionId: randomUUID(),
                body: "Coach reply without approval",
              });
              await tx.unsafe("reset role");
              assert.deepEqual(
                await tx`select * from app.message_consents where id=${consentId}::uuid`,
                audit,
              );
              await assert.rejects(
                command(outsider, "thread", { conversationId: legacy.id }),
              );
              try {
                await tx.savepoint(async () => {
                  await tx.unsafe("reset role");
                  await tx`select app.review_coach_application(${coach.id}::uuid,'approved','suspended','Historical-contact suspension boundary test.','database-test','movx-identity-application-v1')`;
                  assert.equal(
                    (
                      await command(other, "thread", {
                        conversationId: legacy.id,
                      })
                    ).conversation.canSendGeneral,
                    false,
                  );
                  await assert.rejects(
                    command(other, "send", {
                      ...args,
                      submissionId: randomUUID(),
                    }),
                  );
                  throw new RolledBack();
                });
              } catch (e) {
                if (!(e instanceof RolledBack)) throw e;
              }
              await command(coach, "block", { conversationId: legacy.id });
              assert.equal(
                (await command(other, "thread", { conversationId: legacy.id }))
                  .conversation.canSendGeneral,
                false,
              );
              await assert.rejects(
                command(other, "send", { ...args, submissionId: randomUUID() }),
              );
              await tx.unsafe("reset role");
              const [empty] =
                await tx`select (app.mail_ensure_conversation(${coach.run}::uuid,${coach.id}::uuid,${outsider.id}::uuid)).id`;
              assert.equal(
                (
                  await command(outsider, "thread", {
                    conversationId: empty.id,
                  })
                ).conversation.canSendGeneral,
                false,
              );
              throw new RolledBack();
            });
          } catch (e) {
            if (!(e instanceof RolledBack)) throw e;
          }
        },
      );
      await t.test(
        "exact context reply and unrelated participant isolation",
        async () => {
          await command(coach, "send", {
            conversationId,
            contextId,
            body: "Yes, happy to help.",
            submissionId: randomUUID(),
          });
          await assert.rejects(command(other, "thread", { conversationId }));
          await assert.rejects(
            command(other, "send", {
              conversationId,
              contextId,
              body: "Intrusion",
              submissionId: randomUUID(),
            }),
          );
          await assert.rejects(
            command(athlete, "send", {
              conversationId,
              contextId: randomUUID(),
              body: "Wrong context",
              submissionId: randomUUID(),
            }),
          );
          assert.equal((await command(other, "inbox")).items.length, 0);
        },
      );
      await t.test(
        "raw reads, helper execution and forged actor are denied",
        async () => {
          await assert.rejects(
            tx.savepoint(async (s) => {
              await act(athlete);
              await s`select * from app.message_entries`;
            }),
            /permission denied/,
          );
          await assert.rejects(
            tx.savepoint(async (s) => {
              await act(athlete);
              await s`select app.mail_flags(true)`;
            }),
            /permission denied/,
          );
          await assert.rejects(
            tx.savepoint(async (s) => {
              await act({ ...athlete, authId: outsider.authId });
              await s`select app.message_command('inbox','{}')`;
            }),
          );
        },
      );
      await t.test(
        "read marker cannot swallow a later incoming entry or advance into the future",
        async () => {
          const viewed = await command(athlete, "thread", { conversationId });
          await command(coach, "send", {
            conversationId,
            contextId,
            body: "A new message after your read.",
            submissionId: randomUUID(),
          });
          await command(athlete, "read", {
            conversationId,
            through: viewed.lastSeq,
          });
          assert.equal(
            (await command(athlete, "thread", { conversationId })).conversation
              .unread,
            true,
          );
          await assert.rejects(
            command(athlete, "read", { conversationId, through: 999999 }),
          );
        },
      );
      await t.test(
        "changed replay, empty and oversized bodies fail without partial writes",
        async () => {
          const before = (await command(athlete, "thread", { conversationId }))
            .lastSeq;
          await assert.rejects(
            command(athlete, "inquire", {
              coachId: coach.id,
              body: "Changed replay",
              submissionId,
            }),
          );
          for (const body of ["   ", "\u00a0", "x".repeat(4001)])
            await assert.rejects(
              command(athlete, "send", {
                conversationId,
                contextId,
                body,
                submissionId: randomUUID(),
              }),
            );
          assert.equal(
            (await command(athlete, "thread", { conversationId })).lastSeq,
            before,
          );
        },
      );
      await t.test(
        "established chat does not require a second request; legacy request eligibility stays bounded",
        async () => {
          assert.equal(
            (await command(athlete, "thread", { conversationId })).conversation
              .canSendGeneral,
            true,
          );
          await assert.rejects(
            command(athlete, "request-consent", {
              conversationId,
              body: "General",
              submissionId: randomUUID(),
            }),
          );
        },
      );
      async function source(a: typeof coach, query: string, params: string[]) {
        return tx.savepoint(async (sp) => {
          await act(a);
          return sp.unsafe(query, params);
        });
      }
      const slots: string[] = [];
      const requests: string[] = [];
      const bookings: string[] = [];
      await t.test(
        "saved requests and acceptance retain one original card; other candidates stay private",
        async () => {
          for (let i = 0; i < 3; i++) {
            const rows = await source(
              coach,
              "select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '2 days'+$1::integer*interval '2 hours') at time zone 'Europe/Berlin',60) id",
              [String(i + 5)],
            );
            slots.push(rows[0].id);
            const rows2 = await source(
              athlete,
              "select * from app.create_coach_booking_request($1::uuid)",
              [slots[i]],
            );
            requests.push(rows2[0].request_id);
          }
          const repeated = await source(
            athlete,
            "select * from app.create_coach_booking_request($1::uuid)",
            [slots[0]],
          );
          assert.equal(repeated[0].request_id, requests[0]);
          await source(
            other,
            "select * from app.create_coach_booking_request($1::uuid)",
            [slots[0]],
          );
          const pendingThread = await command(athlete, "thread", {
            conversationId,
          });
          const pendingContext = pendingThread.contexts.find(
            (v: { requestId: string }) => v.requestId === requests[0],
          );
          await command(athlete, "send", {
            conversationId,
            contextId: pendingContext.id,
            body: "Question before acceptance",
            submissionId: randomUUID(),
          });
          for (const request of requests) {
            const accepted = await source(
              coach,
              "select * from app.accept_coach_booking_request($1::uuid)",
              [request],
            );
            bookings.push(accepted[0].booking_id);
          }
          const thread = await command(athlete, "thread", { conversationId });
          assert.equal(
            thread.entries.filter((e: { kind: string }) => e.kind === "request")
              .length,
            3,
          );
          assert.equal(
            thread.contexts.filter((c: { requestId: string }) =>
              requests.includes(c.requestId),
            ).length,
            3,
          );
          assert.ok(!JSON.stringify(thread).includes(other.id));
          assert.equal(
            thread.contexts.find(
              (c: { requestId: string }) => c.requestId === requests[0],
            ).bookingId,
            bookings[0],
          );
        },
      );
      await t.test(
        "shared session titles are private, revision checked and independent of booking state",
        async () => {
          try {
            await tx.savepoint(async () => {
              const titleArgs = {
                bookingId: bookings[0],
                title: "Footwork and defence",
                expectedRevision: 0,
              };
              const first = await command(athlete, "session-title", titleArgs);
              assert.deepEqual(first, {
                title: titleArgs.title,
                titleRevision: 1,
                canEditTitle: true,
              });
              assert.deepEqual(
                await command(athlete, "session-title", titleArgs),
                first,
              );
              await assert.rejects(
                command(coach, "session-title", {
                  ...titleArgs,
                  title: "Stale change",
                }),
              );
              await assert.rejects(
                command(other, "session-title", {
                  ...titleArgs,
                  expectedRevision: 1,
                }),
              );
              await assert.rejects(
                command(outsider, "thread", { conversationId, contextId }),
              );
              await assert.rejects(
                source(
                  other,
                  "select app.current_session_title_details($1::uuid)",
                  [bookings[0]],
                ),
              );
              await assert.rejects(
                tx.savepoint(async () => {
                  await act(athlete);
                  await tx`update app.private_session_titles set title='Raw overwrite'`;
                }),
              );
              for (const title of [
                "x".repeat(101),
                "🥊".repeat(101),
                "Line\nTwo",
                "Bad\ttext",
              ]) {
                await assert.rejects(
                  command(coach, "session-title", {
                    ...titleArgs,
                    title,
                    expectedRevision: 1,
                  }),
                );
              }
              const second = await command(coach, "session-title", {
                ...titleArgs,
                title: "Defence practice",
                expectedRevision: 1,
              });
              assert.equal(second.titleRevision, 2);
              const thread = await command(athlete, "thread", {
                conversationId,
              });
              assert.equal(
                thread.contexts.find(
                  (v: { bookingId: string }) => v.bookingId === bookings[0],
                ).title,
                second.title,
              );
              const details = await source(
                athlete,
                "select app.current_session_title_details($1::uuid) details",
                [bookings[0]],
              );
              assert.deepEqual(details[0].details, second);
              await command(athlete, "session-title", {
                ...titleArgs,
                title: "",
                expectedRevision: 2,
              });
              await source(
                athlete,
                "select app.cancel_direct_private_booking($1::uuid)",
                [bookings[0]],
              );
              await assert.rejects(
                command(coach, "session-title", {
                  ...titleArgs,
                  expectedRevision: 3,
                }),
              );
              throw new RolledBack();
            });
          } catch (e) {
            if (!(e instanceof RolledBack)) throw e;
          }
        },
      );
      await t.test(
        "session filtering pages full history, includes original request and never consumes unrelated unread",
        async () => {
          try {
            await tx.savepoint(async () => {
              const initial = await command(athlete, "thread", {
                conversationId,
              });
              const selected = initial.contexts.find(
                (v: { bookingId: string }) => v.bookingId === bookings[0],
              );
              const unrelated = initial.contexts.find(
                (v: { bookingId: string }) => v.bookingId === bookings[1],
              );
              await tx.unsafe("reset role");
              await tx`select app.mail_flags(true)`;
              for (let i = 0; i < 61; i++) {
                await tx`select app.mail_append(c,${selected.id}::uuid,${coach.id}::uuid,'text',${"Session text " + i},${randomUUID()}::uuid,null,null,statement_timestamp()-interval '3 days') from app.message_conversations c where c.id=${conversationId}::uuid`;
                await tx`select app.mail_append(c,${unrelated.id}::uuid,${coach.id}::uuid,'text','Other session',${randomUUID()}::uuid,null,null,statement_timestamp()-interval '3 days') from app.message_conversations c where c.id=${conversationId}::uuid`;
              }
              const first = await command(athlete, "thread", {
                conversationId,
                contextId: selected.id,
              });
              assert.equal(first.entries.length, 50);
              assert.equal(first.hasOlder, false);
              assert.equal(first.hasNewer, true);
              assert.ok(
                first.entries.some(
                  (e: { kind: string }) => e.kind === "request",
                ),
              );
              assert.ok(
                first.entries.every(
                  (e: { contextId: string }) => e.contextId === selected.id,
                ),
              );
              const next = await command(athlete, "thread", {
                conversationId,
                contextId: selected.id,
                after: first.entries.at(-1).seq,
              });
              assert.equal(first.entries.length + next.entries.length, 64);
              assert.ok(
                first.entries.some(
                  (e: { body: string }) =>
                    e.body === "Question before acceptance",
                ),
              );
              assert.equal(next.hasNewer, false);
              assert.equal(next.hasOlder, true);
              assert.equal(first.readThrough, next.readThrough);
              assert.equal(next.conversation.unread, true);
              const previous = await command(athlete, "thread", {
                conversationId,
                contextId: selected.id,
                before: next.entries[0].seq,
              });
              assert.deepEqual(previous.entries, first.entries);
              await assert.rejects(
                command(other, "thread", {
                  conversationId,
                  contextId: selected.id,
                }),
              );
              await assert.rejects(
                command(athlete, "thread", {
                  conversationId,
                  contextId: randomUUID(),
                }),
              );
              throw new RolledBack();
            });
          } catch (e) {
            if (!(e instanceof RolledBack)) throw e;
          }
        },
      );
      await t.test(
        "a message-card failure rolls back the original request and all inbox changes",
        async () => {
          const slot = await source(
            coach,
            "select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '3 days 10 hours') at time zone 'Europe/Berlin',60) id",
            [],
          );
          await tx.unsafe("reset role");
          const [before] =
            await tx`select count(*) requests,(select last_seq from app.message_conversations where id=${conversationId}::uuid) seq from app.coach_booking_requests where coach_profile_id=${coach.id}::uuid`;
          try {
            await tx.savepoint(async (sp) => {
              await sp.unsafe(
                "create function pg_temp.fail_message_card() returns trigger language plpgsql as $$ begin raise exception 'forced card failure' using errcode='P0001'; end $$; create trigger dev0247_fail_card after insert on app.message_entries for each row execute function pg_temp.fail_message_card();",
              );
              await assert.rejects(
                source(
                  athlete,
                  "select * from app.create_coach_booking_request($1::uuid)",
                  [slot[0].id],
                ),
                /forced card failure/,
              );
              await tx.unsafe("reset role");
              const [after] =
                await tx`select count(*) requests,(select last_seq from app.message_conversations where id=${conversationId}::uuid) seq from app.coach_booking_requests where coach_profile_id=${coach.id}::uuid`;
              assert.deepEqual(after, before);
              throw new RolledBack();
            });
          } catch (error) {
            if (!(error instanceof RolledBack)) throw error;
          }
        },
      );
      await t.test(
        "legacy message requests retain exact recipient decisions without pausing established chat",
        async () => {
          const consentId = randomUUID();
          await command(coach, "request-consent", {
            conversationId,
            body: "May I send training ideas?",
            submissionId: consentId,
          });
          await assert.rejects(
            command(coach, "send", {
              conversationId,
              contextId,
              body: "Steal the consent submission identity",
              submissionId: consentId,
            }),
            /submission conflicts/,
          );
          const crossed = await command(athlete, "request-consent", {
            conversationId,
            body: "A crossed opening",
            submissionId: randomUUID(),
          });
          assert.equal(crossed.consentId, consentId);
          await assert.rejects(
            command(coach, "consent", {
              conversationId,
              consentId,
              decision: "accept",
            }),
          );
          assert.equal(
            (await command(coach, "thread", { conversationId })).conversation
              .canSendGeneral,
            true,
          );
          await command(athlete, "consent", {
            conversationId,
            consentId,
            decision: "accept",
          });
          await command(athlete, "consent", {
            conversationId,
            consentId,
            decision: "accept",
          });
          await command(coach, "send", {
            conversationId,
            contextId: null,
            body: "General training idea",
            submissionId: randomUUID(),
          });
          assert.equal(
            (
              await command(athlete, "thread", { conversationId })
            ).entries.filter(
              (e: { body: string }) => e.body === "May I send training ideas?",
            ).length,
            1,
          );
          const attemptId = randomUUID();
          await source(
            coach,
            "select app.send_coach_athlete_connection($1::uuid,$2::uuid,null)",
            [bookings[0], attemptId],
          );
          await source(
            athlete,
            "select app.decide_coach_athlete_connection($1::uuid,'accept')",
            [attemptId],
          );
          await source(
            coach,
            "select app.decide_coach_athlete_connection($1::uuid,'disconnect')",
            [attemptId],
          );
          assert.equal(
            (await command(coach, "thread", { conversationId })).conversation
              .canSendGeneral,
            true,
          );
          assert.equal(
            (await command(coach, "thread", { conversationId })).contexts.find(
              (c: { id: string }) => c.id === contextId,
            ).canSend,
            true,
          );
          const declinedId = randomUUID();
          await command(coach, "request-consent", {
            conversationId,
            body: "Fresh request",
            submissionId: declinedId,
          });
          await command(athlete, "consent", {
            conversationId,
            consentId: declinedId,
            decision: "decline",
          });
          await assert.rejects(
            command(coach, "request-consent", {
              conversationId,
              body: "Too soon",
              submissionId: randomUUID(),
            }),
            /rate limited/,
          );
          await assert.rejects(
            command(athlete, "consent", {
              conversationId,
              consentId: declinedId,
              decision: "accept",
            }),
          );
          const beforeReplies = await command(athlete, "thread", {
            conversationId,
          });
          for (const actor of [coach, athlete])
            await command(actor, "send", {
              conversationId,
              contextId: null,
              body: "Normal chat does not need legacy message approval",
              submissionId: randomUUID(),
            });
          const afterReplies = await command(athlete, "thread", {
            conversationId,
          });
          assert.equal(afterReplies.lastSeq, beforeReplies.lastSeq + 2);
          assert.equal(afterReplies.conversation.consent.status, "declined");
        },
      );
      await t.test(
        "established conversation survives booking cancellation and disconnection",
        async () => {
          const slot = await source(
            coach,
            "select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '4 days 10 hours') at time zone 'Europe/Berlin',60) id",
            [],
          );
          const [request] = await source(
            other,
            "select * from app.create_coach_booking_request($1::uuid)",
            [slot[0].id],
          );
          const [accepted] = await source(
            coach,
            "select * from app.accept_coach_booking_request($1::uuid)",
            [request.request_id],
          );
          const connectionId = randomUUID();
          await source(
            coach,
            "select app.send_coach_athlete_connection($1::uuid,$2::uuid,null)",
            [accepted.booking_id, connectionId],
          );
          await source(
            other,
            "select app.decide_coach_athlete_connection($1::uuid,'accept')",
            [connectionId],
          );
          await source(
            other,
            "select app.cancel_direct_private_booking($1::uuid)",
            [accepted.booking_id],
          );
          const opened = await command(other, "open", { coachId: coach.id });
          const current = await command(other, "thread", {
            conversationId: opened.conversationId,
          });
          assert.equal(current.conversation.canSendGeneral, true);
          assert.equal(current.conversation.canRequestGeneral, false);
          await command(other, "send", {
            conversationId: opened.conversationId,
            contextId: null,
            body: "Connected without any current qualifying booking",
            submissionId: randomUUID(),
          });
          await source(
            other,
            "select app.decide_coach_athlete_connection($1::uuid,'disconnect')",
            [connectionId],
          );
          assert.equal(
            (
              await command(other, "thread", {
                conversationId: opened.conversationId,
              })
            ).conversation.canSendGeneral,
            true,
          );
          await assert.rejects(
            command(other, "request-consent", {
              conversationId: opened.conversationId,
              body: "Cancelled-only history cannot create new consent",
              submissionId: randomUUID(),
            }),
          );
        },
      );
      await t.test(
        "block snapshots only confirmed future bookings; cancellation, multiple blocks and replay enforce exact channels",
        async () => {
          await tx.unsafe("reset role");
          await tx`update app.coach_private_bookings set created_at=statement_timestamp()-interval '3 hours',scheduled_start_at=statement_timestamp()-interval '2 hours',scheduled_end_at=statement_timestamp()-interval '1 hour',early_return_until=statement_timestamp()-interval '2 hours',hold_expires_at=statement_timestamp()-interval '119 minutes' where id=${bookings[2]}::uuid`;
          await command(athlete, "block", { conversationId });
          const blocked = await command(coach, "thread", { conversationId });
          assert.equal(blocked.conversation.blocked, true);
          assert.equal(blocked.conversation.canSendGeneral, false);
          assert.equal(
            blocked.contexts.find((c: { id: string }) => c.id === contextId)
              .canSend,
            false,
          );
          assert.equal(
            blocked.contexts.find(
              (context: { bookingId: string }) =>
                context.bookingId === bookings[2],
            ).canSend,
            false,
          );
          const bookingContext = blocked.contexts.find(
            (c: { bookingId: string }) => c.bookingId === bookings[0],
          );
          assert.equal(bookingContext.canEditTitle, true);
          await command(coach, "session-title", {
            bookingId: bookings[0],
            title: "Existing booking coordination",
            expectedRevision: 0,
          });
          await assert.rejects(
            command(coach, "session-title", {
              bookingId: bookings[2],
              title: "Expired block exception",
              expectedRevision: 0,
            }),
          );
          await command(coach, "send", {
            conversationId,
            contextId: bookingContext.id,
            body: "Booking coordination still allowed",
            submissionId: randomUUID(),
          });
          await assert.rejects(
            command(athlete, "inquire", {
              coachId: coach.id,
              body: "New blocked inquiry",
              submissionId: randomUUID(),
            }),
          );
          await assert.rejects(
            source(
              coach,
              "select app.send_coach_athlete_connection($1::uuid,$2::uuid,null)",
              [bookings[0], randomUUID()],
            ),
          );
          await command(coach, "block", { conversationId });
          await command(athlete, "unblock", { conversationId });
          assert.equal(
            (await command(athlete, "thread", { conversationId })).conversation
              .blocked,
            true,
          );
          await source(
            athlete,
            "select app.cancel_direct_private_booking($1::uuid)",
            [bookings[0]],
          );
          const after = await command(coach, "thread", { conversationId });
          await assert.rejects(
            command(coach, "session-title", {
              bookingId: bookings[0],
              title: "Cancelled exception",
              expectedRevision: 1,
            }),
          );
          assert.equal(
            after.contexts.find(
              (c: { bookingId: string }) => c.bookingId === bookings[0],
            ).canSend,
            false,
          );
          assert.equal(
            after.contexts.find(
              (c: { bookingId: string }) => c.bookingId === bookings[1],
            ).canSend,
            true,
          );
          await tx.unsafe("reset role");
          const snapshots =
            await tx`select b.booking_id,b.until_at,booking.scheduled_end_at+interval '336 hours' expected from app.message_block_bookings b join app.coach_private_bookings booking on booking.id=b.booking_id where booking.id=${bookings[1]}::uuid`;
          assert.equal(
            snapshots[0].until_at.toISOString(),
            snapshots[0].expected.toISOString(),
          );
          // One outer DO statement supplies the identical database clock instant
          // to both snapshot writes and authority reads: +1µs passes, equality fails.
          await tx.unsafe(`do $$ declare c app.message_conversations;ctx app.message_contexts;begin
            select * into c from app.message_conversations where id='${conversationId}'::uuid;
            select * into ctx from app.message_contexts where conversation_id=c.id and source_id='${requests[1]}'::uuid;
            update app.message_block_bookings set until_at=statement_timestamp()+interval '1 microsecond' where booking_id='${bookings[1]}'::uuid;
            if not app.mail_context_allowed(c,ctx) then raise exception 'pre-boundary must allow';end if;
            update app.message_block_bookings set until_at=statement_timestamp() where booking_id='${bookings[1]}'::uuid;
            if app.mail_context_allowed(c,ctx) then raise exception 'boundary must deny';end if;
          end $$`);
          await command(coach, "block", { conversationId });
          assert.equal(
            (await command(coach, "thread", { conversationId })).contexts.find(
              (c: { bookingId: string }) => c.bookingId === bookings[1],
            ).canSend,
            false,
          );
          await command(coach, "unblock", { conversationId });
          assert.equal(
            (await command(coach, "thread", { conversationId })).conversation
              .canSendGeneral,
            true,
          );
        },
      );
      await t.test(
        "suspension preserves only live booking coordination and retained reads",
        async () => {
          try {
            await tx.savepoint(async () => {
              await tx.unsafe("reset role");
              await tx`select app.review_coach_application(${coach.id}::uuid,'approved','suspended','Temporary isolated suspension for channel verification.','database-test','movx-identity-application-v1')`;
              const paused = await command(coach, "thread", { conversationId });
              assert.equal(paused.conversation.canSendGeneral, false);
              assert.equal(
                paused.contexts.find((c: { id: string }) => c.id === contextId)
                  .canSend,
                false,
              );
              assert.equal(
                paused.contexts.find(
                  (c: { bookingId: string }) => c.bookingId === bookings[1],
                ).canSend,
                true,
              );
              assert.equal(
                paused.contexts.find(
                  (c: { bookingId: string }) => c.bookingId === bookings[0],
                ).canSend,
                false,
              );
              await assert.rejects(
                command(athlete, "inquire", {
                  coachId: coach.id,
                  body: "Suspended new contact",
                  submissionId: randomUUID(),
                }),
              );
              throw new RolledBack();
            });
          } catch (error) {
            if (!(error instanceof RolledBack)) throw error;
          }
        },
      );
      await t.test(
        "history pages retain deterministic sequence cursors beyond fifty entries",
        async () => {
          await tx.unsafe("reset role");
          await tx`select app.mail_flags(true)`;
          for (let i = 0; i < 60; i++)
            await tx`select app.mail_source_event(${coach.run}::uuid,${coach.id}::uuid,${athlete.id}::uuid,'request',${requests[0]}::uuid,${"test:" + i},'cancelled',null,statement_timestamp(),'status')`;
          await tx`select app.mail_flags(false)`;
          const first = await command(athlete, "thread", {
            conversationId,
            after: 0,
          });
          assert.equal(first.entries.length, 50);
          const second = await command(athlete, "thread", {
            conversationId,
            after: first.entries.at(-1).seq,
          });
          assert.ok(second.entries.length > 0);
          assert.equal(second.entries[0].seq, first.entries.at(-1).seq + 1);
          assert.ok(
            first.contexts.some(
              (c: { id: string }) => c.id === first.entries[0].contextId,
            ),
          );
        },
      );
      await t.test(
        "quota upgrade preserves history and privileges while both participants send beyond twenty messages",
        async () => {
          await tx.unsafe("reset role");
          const frozen = readFileSync(
            "supabase/migration-history/20261016000100/20261015000100_private_message_authority.sql",
            "utf8",
          );
          const oldRate = frozen.slice(
            frozen.indexOf("create function app.mail_rate("),
            frozen.indexOf("create function app.mail_context_projection("),
          );
          assert.ok(oldRate.includes("per_pair>=20"));
          await tx.unsafe(
            oldRate.replace("create function", "create or replace function"),
          );
          const [used] =
            await tx`select count(*) n from app.message_entries where conversation_id=${conversationId}::uuid and sender_profile_id=${athlete.id}::uuid and kind='text' and created_at>statement_timestamp()-interval '1 minute'`;
          for (let i = Number(used.n); i < 20; i++)
            await command(athlete, "send", {
              conversationId,
              contextId: null,
              body: "Practice question " + i,
              submissionId: randomUUID(),
            });
          await assert.rejects(
            command(athlete, "send", {
              conversationId,
              contextId: null,
              body: "Over limit",
              submissionId: randomUUID(),
            }),
            /rate limited/,
          );
          const original = await command(athlete, "thread", { conversationId });
          await tx.unsafe("reset role");
          const [privileges] =
            await tx`select proowner,proacl,prosecdef,proconfig from pg_proc where oid='app.mail_rate(app.message_conversations,uuid,boolean)'::regprocedure`;
          await tx.unsafe(
            readFileSync(
              "supabase/migrations/20261017000200_unlimited_coach_messages.sql",
              "utf8",
            ),
          );
          assert.deepEqual(
            (
              await tx`select proowner,proacl,prosecdef,proconfig from pg_proc where oid='app.mail_rate(app.message_conversations,uuid,boolean)'::regprocedure`
            )[0],
            privileges,
          );
          assert.deepEqual(
            await command(athlete, "thread", { conversationId }),
            original,
          );
          const sentIds = new Set<string>();
          for (const actor of [athlete, coach])
            for (let i = 0; i < 25; i++) {
              const args = {
                conversationId,
                contextId: null,
                body: "Unlimited normal message " + i,
                submissionId: randomUUID(),
              };
              const saved = await command(actor, "send", args);
              sentIds.add(saved.entryId);
              assert.deepEqual(await command(actor, "send", args), saved);
              await assert.rejects(
                command(actor, "send", { ...args, body: "Changed retry" }),
                /submission conflicts/,
              );
            }
          assert.equal(sentIds.size, 50);
          const afterReplies = await command(athlete, "thread", {
            conversationId,
          });
          assert.equal(afterReplies.lastSeq, original.lastSeq + 50);
          assert.deepEqual(
            afterReplies.conversation.consent,
            original.conversation.consent,
          );
          assert.equal(
            (
              await command(athlete, "inquire", {
                coachId: coach.id,
                body: "Can we practise footwork?",
                submissionId,
              })
            ).conversationId,
            conversationId,
          );
        },
      );
      await t.test(
        "an authorized other-dataset actor cannot discover or read the conversation",
        async () => {
          await tx.unsafe("reset role");
          const run = randomUUID();
          await tx`insert into app.demo_runs(id,slug,name,status,catalogue_visibility,schedule_anchor_date,starts_at,ends_at) select ${run}::uuid,${"dev0248-dataset-" + run},'Private scope test','active','private',schedule_anchor_date,starts_at,ends_at from app.demo_runs where id=${athlete.run}::uuid`;
          assert.notEqual(run, athlete.run);
          await tx`insert into app.demo_run_participants(run_id,profile_id,role,status,joined_at) values(${run}::uuid,${outsider.id}::uuid,'member','active',statement_timestamp()) on conflict do nothing`;
          const foreign = { ...outsider, run };
          await assert.rejects(command(foreign, "inbox"));
          await assert.rejects(command(foreign, "thread", { conversationId }));
          await tx.unsafe("reset role");
          await tx`insert into app.demo_run_participants(run_id,profile_id,role,status,joined_at) values(${run}::uuid,${athlete.id}::uuid,'member','active',statement_timestamp()) on conflict do nothing`;
          await assert.rejects(
            command({ ...athlete, run }, "session-title", {
              bookingId: bookings[1],
              title: "Cross-dataset title",
              expectedRevision: 0,
            }),
          );
        },
      );
      await t.test(
        "more than ten first contacts and one hundred actor sends succeed without recipient approval",
        async () => {
          const targets: { conversationId: string; contextId: null }[] = [];
          for (let i = 0; i < 11; i++) {
            await tx.unsafe("reset role");
            const authId = randomUUID();
            await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${authId}::uuid,false,false)`;
            const [p] =
              await tx`select * from app.enroll_application_identity(${authId}::uuid,${"Contact Coach " + i})`;
            const target = {
              authId,
              id: p.identity_profile_id as string,
              run: p.identity_run_id as string,
            };
            await act(target);
            await tx`select app.submit_owned_coach_application()`;
            await tx`select app.upsert_owned_coach_profile(${"Contact Coach " + i},'An isolated coach fixture for unlimited first contact and normal conversation replies.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
            await tx.unsafe("reset role");
            await tx`select app.review_coach_application(${target.id}::uuid,'pending','approved','Isolated contact test reviewed.','database-test','movx-identity-application-v1')`;
            await tx`update app.coach_profiles set visibility='visible' where profile_id=${target.id}::uuid`;
            const saved = await command(athlete, "inquire", {
              coachId: target.id,
              body: "First contact",
              submissionId: randomUUID(),
            });
            const current = await command(athlete, "thread", {
              conversationId: saved.conversationId,
            });
            assert.equal(current.conversation.canSendGeneral, true);
            assert.equal(current.conversation.consent, null);
            const normal = {
              conversationId: saved.conversationId,
              contextId: null,
            };
            await command(target, "send", {
              ...normal,
              body: "Coach reply without approval",
              submissionId: randomUUID(),
            });
            await command(athlete, "send", {
              ...normal,
              body: "Athlete follow-up without approval",
              submissionId: randomUUID(),
            });
            targets.push(normal);
          }
          assert.equal(targets.length, 11);
          await tx.unsafe("reset role");
          const [sent] =
            await tx`select count(*) n from app.message_entries where sender_profile_id=${athlete.id}::uuid and kind='text' and created_at>statement_timestamp()-interval '1 minute'`;
          let remaining = Math.max(101 - Number(sent.n), 1);
          for (const target of targets)
            for (let n = 0; n < 10 && remaining > 0; n++, remaining--)
              await command(athlete, "send", {
                ...target,
                body: "Beyond the former aggregate quota",
                submissionId: randomUUID(),
              });
          assert.equal(remaining, 0);
          await tx.unsafe("reset role");
          const [total] =
            await tx`select count(*) n from app.message_entries where sender_profile_id=${athlete.id}::uuid and kind='text' and created_at>statement_timestamp()-interval '1 minute'`;
          assert.ok(Number(total.n) >= 101);
        },
      );
      await tx.unsafe("reset role");
      throw new RolledBack();
    });
  } catch (e) {
    if (!(e instanceof RolledBack)) throw e;
  } finally {
    await db.end();
  }
});
