import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  (!/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/movnotes_[a-z0-9_]+$/.test(
    url,
  ) &&
    !/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov(?:177|181)_[a-f0-9]{12}_(fresh|upgrade)$/.test(
      url,
    ))
)
  throw Error("Use the owned notes database rehearsal");
type Actor = { authId: string; id: string; run: string };
test("original-booking notes, private projections, boundaries, revisions and video authority", async (t) => {
  const db = postgres(url, { max: 4, onnotice() {} });
  let concurrent!: { coach: Actor; athlete: Actor; bookingId: string };
  try {
    await db.begin(async (tx) => {
      const actors = [];
      for (let i = 0; i < 4; i++) {
        const authId = randomUUID();
        await tx`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${authId}::uuid,${`notes-${authId}@example.test`},now(),false,false)`;
        const [p] =
          await tx`select * from app.enroll_application_identity(${authId}::uuid,${"Note actor " + i})`;
        actors.push({
          authId,
          id: String(p.identity_profile_id),
          run: String(p.identity_run_id),
        });
      }
      const [coach, athlete, other] = actors;
      async function raw(
        a: typeof coach,
        query: string,
        args: postgres.JSONValue[] = [],
      ) {
        return tx.savepoint(async (s) => {
          await s.unsafe("set local role app_runtime");
          await s`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
          const r = await s.unsafe(query, args);
          await s.unsafe("reset role");
          return r;
        });
      }
      async function command(a: typeof coach, action: string, args: object) {
        const [r] = await raw(
          a,
          "select app.session_notes_command($1,$2::jsonb) value",
          [action, args as postgres.JSONValue],
        );
        return r.value;
      }
      await raw(coach, "select app.submit_owned_coach_application()");
      await raw(
        coach,
        "select app.save_owned_coach_application_contact(0,$1::jsonb)",
        [
          {
            phoneNumber: "+4915112345678",
            instagramUrl: null,
            facebookUrl: null,
            linkedinUrl: null,
          },
        ],
      );
      await raw(
        coach,
        "select app.upsert_owned_coach_profile('Notes Coach','Focused private training with clear preparation and useful feedback for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
      );
      await tx`select app.review_coach_application(${coach.id}::uuid,'pending','approved','Isolated session notes fixture','movnotes','movx-identity-application-v1')`;
      await tx`update app.coach_profiles set visibility='visible' where profile_id=${coach.id}::uuid`;
      async function book(n: number) {
        const [slot] = await raw(
          coach,
          `select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '${n} days 14 hours') at time zone 'Europe/Berlin',60) id`,
        );
        const [request] = await raw(
          athlete,
          "select * from app.create_coach_booking_request($1::uuid)",
          [slot.id],
        );
        const [b] = await raw(
          coach,
          "select * from app.accept_coach_booking_request($1::uuid)",
          [request.request_id],
        );
        return String(b.booking_id);
      }
      const bookingId = await book(3),
        replacement = await book(4);
      concurrent = { coach, athlete, bookingId: replacement };
      const video = {
        label: "Footwork reference",
        url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      };
      const read = (a = athlete, kind = "shared", before?: object) =>
        command(a, "read", {
          bookingId,
          kind,
          ...(before ? { before } : {}),
        });
      const save = (
        a: typeof coach,
        kind: string,
        body: string,
        extra: object = {},
      ) =>
        command(a, "save", {
          bookingId,
          kind,
          operationId: randomUUID(),
          revision: 0,
          body,
          videos: [],
          ...extra,
        });
      let sharedId: string, privateId: string;
      await t.test(
        "empty exact-participant reads, no conversation creation, private absence and denied raw grants",
        async () => {
          assert.equal((await read()).plan, null);
          assert.equal((await read()).entries.length, 0);
          await assert.rejects(read(other));
          await assert.rejects(read({ ...athlete, authId: coach.authId }));
          await assert.rejects(read({ ...athlete, run: randomUUID() }));
          await assert.rejects(read(athlete, "private"));
          await assert.rejects(
            command(athlete, "read", {
              bookingId: randomUUID(),
              kind: "shared",
            }),
          );
          assert.equal(
            (
              await tx`select has_table_privilege('app_runtime','app.session_note_entries','select') allowed`
            )[0].allowed,
            false,
          );
          assert.equal(
            (
              await tx`select has_function_privilege('app_runtime','app.session_notes_impl(text,jsonb)','execute') allowed`
            )[0].allowed,
            false,
          );
        },
      );
      await t.test(
        "plan ownership, shared authors, private data exclusion and exact versus altered retry",
        async () => {
          await save(coach, "plan", "Work on distance", { videos: [video] });
          await assert.rejects(save(athlete, "plan", "Wrong coach"));
          const payload = {
            bookingId,
            kind: "shared",
            operationId: randomUUID(),
            revision: 0,
            body: "I felt more balanced.",
            videos: [video],
          };
          const saved = await command(athlete, "save", payload);
          sharedId = saved.id;
          assert.deepEqual(await command(athlete, "save", payload), saved);
          await assert.rejects(
            command(athlete, "save", { ...payload, body: "Changed retry" }),
          );
          const privateSaved = await save(
            coach,
            "private",
            "Private coach preparation",
            {
              videos: [
                {
                  label: "Private reference",
                  url: "https://www.instagram.com/reel/ABC_123/",
                },
              ],
            },
          );
          privateId = privateSaved.id;
          const visible = await read();
          assert.equal(visible.total, 1);
          assert.equal(visible.entries[0].body, payload.body);
          assert.equal(visible.plan.videos[0].url, video.url);
          assert.ok(
            !JSON.stringify(visible).includes("Private coach preparation"),
          );
          assert.ok(!JSON.stringify(visible).includes("Private reference"));
          assert.ok(!JSON.stringify(visible).includes(privateId));
          assert.ok(!Object.keys(visible).some((k) => /private/i.test(k)));
          assert.equal((await read(coach, "private")).total, 1);
          await assert.rejects(
            save(coach, "shared", "Change other's note", {
              entryId: sharedId,
              revision: 1,
            }),
          );
          await assert.rejects(
            save(athlete, "shared", "Retarget private", {
              entryId: privateId,
              revision: 1,
            }),
          );
          const changed = await save(athlete, "shared", "Updated reflection", {
            entryId: sharedId,
            revision: 1,
            videos: [video],
          });
          assert.equal(changed.revision, 2);
          const conflict = await save(athlete, "shared", "Stale draft", {
            entryId: sharedId,
            revision: 1,
          });
          assert.equal(conflict.conflict, true);
          assert.equal(conflict.current.body, "Updated reflection");
          assert.equal(
            (
              await command(athlete, "read", {
                bookingId: replacement,
                kind: "shared",
              })
            ).total,
            0,
          );
        },
      );
      await t.test(
        "a coach participating as the athlete gets athlete-only note authority",
        async () => {
          await raw(other, "select app.submit_owned_coach_application()");
          await raw(
            other,
            "select app.save_owned_coach_application_contact(0,$1::jsonb)",
            [
              {
                phoneNumber: "+4915112345678",
                instagramUrl: null,
                facebookUrl: null,
                linkedinUrl: null,
              },
            ],
          );
          await raw(
            other,
            "select app.upsert_owned_coach_profile('Direction coach','Focused private training with clear preparation and useful feedback for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
          );
          await tx`select app.review_coach_application(${other.id}::uuid,'pending','approved','Isolated direction fixture','movnotes','movx-identity-application-v1')`;
          await tx`update app.coach_profiles set visibility='visible' where profile_id=${other.id}::uuid`;
          const [slot] = await raw(
            other,
            "select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '6 days 14 hours') at time zone 'Europe/Berlin',60) id",
          );
          const [request] = await raw(
            coach,
            "select * from app.create_coach_booking_request($1::uuid)",
            [slot.id],
          );
          const [booked] = await raw(
            other,
            "select * from app.accept_coach_booking_request($1::uuid)",
            [request.request_id],
          );
          const directionId = String(booked.booking_id);
          assert.equal(
            (
              await command(coach, "read", {
                bookingId: directionId,
                kind: "shared",
              })
            ).viewerIsCoach,
            false,
          );
          await assert.rejects(
            command(coach, "read", { bookingId: directionId, kind: "private" }),
          );
          await assert.rejects(
            command(coach, "save", {
              bookingId: directionId,
              kind: "plan",
              operationId: randomUUID(),
              revision: 0,
              body: "Not my coaching session",
              videos: [],
            }),
          );
          await command(coach, "save", {
            bookingId: directionId,
            kind: "shared",
            operationId: randomUUID(),
            revision: 0,
            body: "My athlete reflection",
            videos: [],
          });
          assert.equal(
            (
              await command(other, "read", {
                bookingId: directionId,
                kind: "shared",
              })
            ).entries[0].body,
            "My athlete reflection",
          );
        },
      );
      await t.test(
        "text/video bounds, plan clear revision and independent quotas/paging",
        async () => {
          await assert.rejects(save(athlete, "shared", " "));
          await assert.rejects(save(athlete, "shared", "x".repeat(2001)));
          await assert.rejects(save(athlete, "shared", "\u0001bad"));
          for (const url of [
            "javascript:alert(1)",
            "https://www.youtube.com.evil.test/watch?v=M7lc1UVf-VE",
            "https://www.instagram.com/profile/",
            "https://user@www.youtube.com/watch?v=M7lc1UVf-VE",
          ])
            await assert.rejects(
              save(athlete, "shared", "Video", {
                videos: [{ label: "Unsafe", url }],
              }),
            );
          await assert.rejects(
            save(athlete, "shared", "Video", {
              videos: Array(6).fill(video),
            }),
          );
          await save(coach, "plan", "", { revision: 1 });
          assert.equal((await read()).plan.revision, 2);
          assert.equal((await read()).plan.body, "");
          for (let i = 1; i < 100; i++)
            await save(athlete, "shared", "Entry " + i);
          assert.equal(
            (await save(athlete, "shared", "Over capacity")).limit,
            true,
          );
          await save(coach, "private", "Independent private capacity");
          const ids = new Set<string>();
          let p = await read();
          while (true) {
            for (const e of p.entries) ids.add(e.id);
            if (!p.next) break;
            p = await read(athlete, "shared", p.next);
          }
          assert.equal(ids.size, 100);
          await save(athlete, "shared", "Edits at capacity work", {
            entryId: sharedId,
            revision: 2,
          });
        },
      );
      await t.test(
        "blocked captured-booking windows, disconnect-independent reads and cancellation authority",
        async () => {
          const [thread] =
            await tx`select id from app.message_conversations where coach_profile_id=${coach.id}::uuid and athlete_profile_id=${athlete.id}::uuid`;
          await raw(athlete, "select app.message_command('block',$1::jsonb)", [
            { conversationId: thread.id },
          ]);
          await save(coach, "plan", "Within captured window", {
            revision: 2,
          });
          await tx`update app.message_block_bookings set until_at=statement_timestamp() where booking_id=${bookingId}::uuid`;
          assert.equal((await read()).canWrite, false);
          await assert.rejects(
            save(coach, "plan", "Outside window", { revision: 3 }),
          );
          await save(coach, "private", "Private writes do not contact athlete");
          assert.equal((await read()).total, 100);
          await raw(
            coach,
            "select app.cancel_direct_private_booking($1::uuid)",
            [bookingId],
          );
          assert.equal((await read()).canWrite, false);
          await assert.rejects(save(coach, "private", "Cancelled write"));
        },
      );
      await t.test(
        "dated personal references retain text, reject altered retry and survive older clients",
        async () => {
          const day = new Date(Date.now() - 86400000)
            .toISOString()
            .slice(0, 10);
          const args = {
            commandId: randomUUID(),
            title: "A private workout",
            date: day,
            time: "12:00",
            timezone: "UTC",
            minutes: 30,
            completed: true,
            notes: "Existing personal thoughts",
            videos: [video],
          };
          const call = async (a: object) => {
            const [r] = await raw(
              athlete,
              "select app.athlete_training_command('save',$1::jsonb) value",
              [a as postgres.JSONValue],
            );
            return r.value;
          };
          await call(args);
          await call(args);
          await assert.rejects(call({ ...args, videos: [] }));
          const [listed] = await raw(
            athlete,
            "select app.athlete_training_command('list',$1::jsonb) value",
            [{ from: day, through: day, timezone: "UTC" }],
          );
          const item = listed.value.items.find(
            (i: { title: string }) => i.title === args.title,
          );
          assert.equal(item.notes, args.notes);
          assert.equal(item.videos.length, 1);
          const { videos, ...oldArgs } = args;
          assert.ok(videos.length);
          await call({
            ...oldArgs,
            commandId: randomUUID(),
            key: item.key,
            revision: item.revision,
            title: "Older client edit",
          });
          const [after] = await raw(
            athlete,
            "select app.athlete_training_command('list',$1::jsonb) value",
            [{ from: day, through: day, timezone: "UTC" }],
          );
          assert.equal(
            after.value.items.find((i: { key: string }) => i.key === item.key)
              .videos.length,
            1,
          );
        },
      );
    });
    await t.test(
      "concurrent revisions, exact retries, separate final quota and cancellation serialize",
      async () => {
        const { coach, athlete, bookingId } = concurrent;
        const run = async (a: Actor, action: string, args: object) =>
          db.begin(async (tx) => {
            await tx.unsafe("set local role app_runtime");
            await tx`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
            const [r] =
              await tx`select app.session_notes_command(${action},${tx.json(args as postgres.JSONValue)}) value`;
            return r.value;
          });
        const payload = (kind: string, body: string) => ({
          bookingId,
          kind,
          body,
          videos: [],
          revision: 0,
          operationId: randomUUID(),
        });
        const edits = await Promise.all([
          run(coach, "save", payload("plan", "First plan")),
          run(coach, "save", payload("plan", "Second plan")),
        ]);
        assert.equal(edits.filter((e) => e.conflict).length, 1);
        assert.equal(edits.filter((e) => e.revision === 1).length, 1);
        const same = payload("shared", "A retried reflection");
        const retried = await Promise.all([
          run(athlete, "save", same),
          run(athlete, "save", same),
        ]);
        assert.deepEqual(retried[0], retried[1]);
        await db`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where profile_id=${athlete.id}::uuid and run_id=${athlete.run}::uuid`;
        await assert.rejects(
          run(athlete, "read", { bookingId, kind: "shared" }),
        );
        await assert.rejects(run(athlete, "save", same));
        await db`update app.demo_run_participants set status='active',revoked_at=null where profile_id=${athlete.id}::uuid and run_id=${athlete.run}::uuid`;

        await db`insert into app.session_note_entries(booking_id,kind,author_id,body) select ${bookingId}::uuid,'private',${coach.id}::uuid,'Private fixture '||n from generate_series(1,99) n`;
        const last = await Promise.all([
          run(coach, "save", payload("private", "Final slot A")),
          run(coach, "save", payload("private", "Final slot B")),
        ]);
        assert.equal(last.filter((e) => e.limit).length, 1);
        assert.equal(
          (await run(athlete, "read", { bookingId, kind: "shared" })).total,
          1,
        );
        await db`select app.review_coach_application(${coach.id}::uuid,'approved','suspended','Suspended disposable notes coach','movnotes','movx-identity-application-v1')`;
        assert.equal(
          (await run(athlete, "read", { bookingId, kind: "shared" })).canWrite,
          true,
          "Existing future-booking M8 coordination stays available during suspension",
        );
        const [privateEntry] =
          await db`select id,revision from app.session_note_entries where booking_id=${bookingId}::uuid and kind='private' limit 1`;
        await run(coach, "save", {
          ...payload("private", "Private editing during suspension"),
          entryId: privateEntry.id,
          revision: privateEntry.revision,
        });
        let release!: () => void, held!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const locked = new Promise<void>((resolve) => {
          held = resolve;
        });
        const locker = db.begin(async (tx) => {
          await tx`select app.mail_lock_pair(${athlete.run}::uuid,${coach.id}::uuid,${athlete.id}::uuid)`;
          held();
          await gate;
        });
        await locked;
        try {
          const [deadline] =
            await db`update app.message_block_bookings set until_at=clock_timestamp()+interval '2 seconds' where booking_id=${bookingId}::uuid returning until_at`;
          const queued = run(
            athlete,
            "save",
            payload("shared", "Queued across the captured deadline"),
          ).then(
            (value) => ({ value, error: null }),
            (error) => ({ value: null, error }),
          );
          let waiting = false;
          for (let attempt = 0; attempt < 30 && !waiting; attempt++) {
            const [row] =
              await db`select exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid where l.locktype='advisory' and not l.granted and a.datname=current_database() and a.query_start<${deadline.until_at}::timestamptz) waiting`;
            waiting = row.waiting;
            if (!waiting)
              await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.equal(
            waiting,
            true,
            "The note statement must start and queue before the captured deadline",
          );
          await db`select pg_sleep(greatest(0,extract(epoch from (${deadline.until_at}::timestamptz-clock_timestamp())))::double precision+0.05)`;
          release();
          await locker;
          assert.equal(
            (await queued).error?.code,
            "42501",
            "A queued statement cannot write after the window ends",
          );
        } finally {
          release();
          await locker;
          await db`update app.message_block_bookings s set until_at=b.scheduled_end_at+interval '336 hours' from app.coach_private_bookings b where s.booking_id=b.id and b.id=${bookingId}::uuid`;
        }
        const cancel = () =>
          db.begin(async (tx) => {
            await tx.unsafe("set local role app_runtime");
            await tx`select set_config('app.current_auth_user_id',${athlete.authId},true),set_config('app.current_profile_id',${athlete.id},true),set_config('app.current_run_id',${athlete.run},true),set_config('app.current_run_role','member',true)`;
            await tx`select app.cancel_direct_private_booking(${bookingId}::uuid)`;
          });
        const outcome = await Promise.allSettled([
          run(athlete, "save", payload("shared", "Cancellation race")),
          cancel(),
        ]);
        if (outcome[1].status === "rejected") {
          assert.equal(outcome[1].reason.code, "40001");
          await cancel();
        }
        if (outcome[0].status === "rejected")
          assert.ok(["40001", "42501"].includes(outcome[0].reason.code));
        assert.equal(
          (await run(athlete, "read", { bookingId, kind: "shared" })).canWrite,
          false,
        );
        await assert.rejects(
          run(athlete, "save", payload("shared", "After cancellation")),
        );
      },
    );
  } finally {
    await db.end();
  }
});
