import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_TEST_URL;
if (!url) throw new Error("DATABASE_TEST_URL is required.");
class RolledBack extends Error {}

test("private message database authority, retries, limits and read isolation", async (t) => {
  const db = postgres(url, { max: 1, ssl: false, onnotice: () => {} });
  try {
    await db.begin(async (tx) => {
      if (
        !(await tx`select to_regclass('app.message_conversations') present`)[0]
          .present
      )
        await tx.unsafe(
          readFileSync(
            "supabase/migrations/20261015000100_private_message_authority.sql",
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
            "supabase/migrations/20261015000200_integrate_private_messages.sql",
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
            "supabase/migrations/20261015000300_harden_private_message_integration.sql",
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
            "supabase/migrations/20261015000400_reserve_message_consent_submissions.sql",
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
          assert.equal(thread.conversation.canSendGeneral, false);
          contextId = thread.contexts[0].id;
          assert.equal(thread.contexts[0].canSend, true);
          assert.ok(
            !/authUser|email|avatar|private_note/i.test(JSON.stringify(thread)),
          );
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
        "general consent cannot be bypassed by discovery or crossed service contact",
        async () => {
          await assert.rejects(
            command(athlete, "send", {
              conversationId,
              contextId: null,
              body: "General",
              submissionId: randomUUID(),
            }),
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
        "general message requests require exact recipient acceptance; crossed sends recover pending",
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
            false,
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
            false,
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
        },
      );
      await t.test(
        "accepted connection alone permits general chat after its only booking is cancelled",
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
            false,
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
            false,
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
        "per-conversation text rate limits are database enforced and exact retry still succeeds",
        async () => {
          await tx.unsafe("reset role");
          const [used] =
            await tx`select count(*) n from app.message_entries where conversation_id=${conversationId}::uuid and sender_profile_id=${athlete.id}::uuid and kind='text' and created_at>statement_timestamp()-interval '1 minute'`;
          for (let i = Number(used.n); i < 20; i++)
            await command(athlete, "send", {
              conversationId,
              contextId,
              body: "Practice question " + i,
              submissionId: randomUUID(),
            });
          await assert.rejects(
            command(athlete, "send", {
              conversationId,
              contextId,
              body: "Over limit",
              submissionId: randomUUID(),
            }),
            /rate limited/,
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
          const run = "20000000-0000-4000-8000-000000000001";
          await tx`insert into app.demo_run_participants(run_id,profile_id,role,status,joined_at) values(${run}::uuid,${outsider.id}::uuid,'member','active',statement_timestamp()) on conflict do nothing`;
          const foreign = { ...outsider, run };
          assert.equal((await command(foreign, "inbox")).items.length, 0);
          await assert.rejects(command(foreign, "thread", { conversationId }));
        },
      );
      await t.test(
        "first-contact and aggregate sender caps cannot be bypassed across conversations",
        async () => {
          const targets: { conversationId: string; contextId: string }[] = [];
          for (let i = 0; i < 10; i++) {
            await tx.unsafe("reset role");
            const authId = randomUUID();
            await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${authId}::uuid,false,false)`;
            const [p] =
              await tx`select * from app.enroll_application_identity(${authId}::uuid,${"Rate Coach " + i})`;
            const target = {
              authId,
              id: p.identity_profile_id as string,
              run: p.identity_run_id as string,
            };
            await act(target);
            await tx`select app.submit_owned_coach_application()`;
            await tx`select app.upsert_owned_coach_profile(${"Rate Coach " + i},'A coach fixture for database-enforced first-contact and aggregate sender boundaries.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
            await tx.unsafe("reset role");
            await tx`select app.review_coach_application(${target.id}::uuid,'pending','approved','Isolated rate test reviewed.','database-test','movx-identity-application-v1')`;
            await tx`update app.coach_profiles set visibility='visible' where profile_id=${target.id}::uuid`;
            if (i === 9) {
              await assert.rejects(
                command(athlete, "inquire", {
                  coachId: target.id,
                  body: "Eleventh counterpart",
                  submissionId: randomUUID(),
                }),
                /rate limited/,
              );
              continue;
            }
            const saved = await command(athlete, "inquire", {
              coachId: target.id,
              body: "First contact",
              submissionId: randomUUID(),
            });
            const current = await command(athlete, "thread", {
              conversationId: saved.conversationId,
            });
            targets.push({
              conversationId: saved.conversationId,
              contextId: current.contexts[0].id,
            });
          }
          await tx.unsafe("reset role");
          const [sent] =
            await tx`select count(*) n from app.message_entries where sender_profile_id=${athlete.id}::uuid and kind='text' and created_at>statement_timestamp()-interval '1 minute'`;
          let remaining = 100 - Number(sent.n);
          for (const target of targets)
            for (let n = 1; n < 20 && remaining > 0; n++, remaining--)
              await command(athlete, "send", {
                ...target,
                body: "Within aggregate cap",
                submissionId: randomUUID(),
              });
          assert.equal(remaining, 0);
          await assert.rejects(
            command(athlete, "send", {
              ...targets.at(-1),
              body: "Beyond aggregate cap",
              submissionId: randomUUID(),
            }),
            /rate limited/,
          );
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
