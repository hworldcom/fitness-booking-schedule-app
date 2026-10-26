import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { parseNotificationPage } from "@/notifications/contracts";
import { runNotificationWorker } from "@/server/notifications/worker";

const url = process.env.DATABASE_TEST_URL;
const isolated =
  !!url &&
  /^\/mov85_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(url).pathname) &&
  ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
test(
  "canonical private booking events, two-party receipts and coach-only bell",
  { skip: !isolated },
  async (t) => {
    for (const name of [
      "NOTIFICATION_TEST_RUNTIME_URL",
      "NOTIFICATION_TEST_WORKER_URL",
    ]) {
      const target = new URL(process.env[name] ?? "");
      const fixture = new URL(url!);
      assert.ok(
        ["127.0.0.1", "localhost"].includes(target.hostname),
        "Fixture credentials must stay on loopback",
      );
      assert.equal(
        target.pathname,
        fixture.pathname,
        "Every role must use this owned scratch database",
      );
      assert.equal(
        target.port,
        fixture.port,
        "Every role must use this owned scratch port",
      );
    }
    const db = postgres(url!, { max: 6, prepare: false, onnotice: () => {} });
    const runtime = postgres(process.env.NOTIFICATION_TEST_RUNTIME_URL!, {
      max: 4,
      prepare: false,
      onnotice: () => {},
    });
    type Actor = { auth: string; id: string; run: string; email: string };
    const captures: string[] = [];
    async function as<T>(
      a: Actor,
      fn: (tx: postgres.TransactionSql) => Promise<T>,
    ) {
      return runtime.begin(async (tx) => {
        await tx`select set_config('app.current_auth_user_id',${a.auth},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
        return fn(tx);
      });
    }
    const command = async (a: Actor, fn: string, args: unknown[] = []) =>
      as(
        a,
        async (tx) =>
          (
            await tx.unsafe(
              `select * from app.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")})`,
              args.map((value) =>
                typeof value === "string" && value.startsWith("{")
                  ? tx.json(JSON.parse(value))
                  : value,
              ) as string[],
            )
          )[0],
      );
    async function actor(name: string, coach = false) {
      const auth = randomUUID(),
        email = `mov85-${auth}@example.test`;
      await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${auth}::uuid,${email},statement_timestamp(),false,false)`;
      const [p] =
        await db`select * from app.enroll_application_identity(${auth}::uuid,${name})`;
      const a: Actor = {
        auth,
        id: p.identity_profile_id,
        run: p.identity_run_id,
        email,
      };
      if (coach) {
        await command(a, "submit_owned_coach_application");
        await command(a, "upsert_owned_coach_profile", [
          name,
          "Isolated canonical booking notification validation coach.",
          ["Boxing"],
          "Europe/Berlin",
          "hidden",
          "40000000-0000-4000-8000-000000000001",
          null,
          null,
          null,
          null,
          null,
        ]);
        await db`select app.review_coach_application(${a.id}::uuid,'pending','approved','Disposable notification fixture.','mov85','movx-identity-application-v1')`;
        await db`update app.coach_profiles set visibility='visible' where profile_id=${a.id}::uuid`;
      }
      return a;
    }
    const list = (a: Actor, args: Record<string, unknown> = {}) =>
      as(a, async (tx) => {
        const [r] =
          await tx`select app.notification_command_v2('list',${tx.json(args as postgres.JSONValue)}) result`;
        return parseNotificationPage(r.result);
      });
    const totals = async () =>
      Number(
        (await db`select count(*) n from app.booking_notification_events`)[0].n,
      );
    const eventRows = (source: string) =>
      db`select e.*,r.id receipt_id,r.recipient_profile_id,r.notify_in_app,r.read_at,r.due_at,r.state,r.attempts,r.lease_id,statement_timestamp() observed_at from app.booking_notification_events e join app.booking_notification_receipts r on r.event_id=e.id where e.source_id=${source}::uuid order by e.created_at,e.event_key,r.recipient_profile_id`;
    const workerEnv = {
      NOTIFICATION_DELIVERY_ENABLED: "true",
      NOTIFICATION_TRANSPORT: "mailpit",
      NOTIFICATION_MAILPIT_URL: "http://127.0.0.1:55324",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      NOTIFICATION_DATABASE_URL: process.env.NOTIFICATION_TEST_WORKER_URL,
    };
    async function drain() {
      let accepted = 0;
      for (let n = 0; n < 30; n++) {
        const r = await runNotificationWorker(workerEnv, 3);
        accepted += r.accepted;
        assert.equal(r.unknown + r.failed + r.retry, 0);
        if (!r.claimed) break;
      }
      const rows =
        await db`select provider_id from app.booking_notification_receipts where state='accepted'`;
      for (const r of rows)
        if (!captures.includes(r.provider_id)) captures.push(r.provider_id);
      return accepted;
    }
    try {
      const coach = await actor("Booking Notify Coach", true),
        athlete = await actor("Booking Notify Athlete"),
        other = await actor("Booking Notify Other");
      const [venue] =
        await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.id}::uuid and is_primary`;
      const [date] =
        await db`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text target_date`;
      await command(coach, "save_owned_effective_coach_availability", [
        JSON.stringify({
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 0,
          dates: [
            {
              date: date.target_date,
              mode: "custom",
              hours: [
                "09:00",
                "10:00",
                "11:00",
                "14:00",
                "15:00",
                "16:00",
                "17:00",
                "18:00",
              ].map((localStartTime) => ({
                localStartTime,
                locationId: venue.id,
                locationUpdatedAt: venue.stamp,
              })),
            },
          ],
        }),
      ]);
      const slots =
        await db`select id,starts_at,ends_at from app.coach_availability_slots where profile_id=${coach.id}::uuid and status='open' and session_type_id is null order by starts_at`;
      assert.ok(slots.length >= 8);
      const request = (a: Actor, slot: string) =>
        command(a, "create_coach_booking_request", [slot]);
      let first: string, competing: string, booking: string;
      await t.test(
        "new requests email each participant once; actor retry emits nothing and athletes get no bell",
        async () => {
          first = (await request(athlete, slots[0].id)).request_id;
          competing = (await request(other, slots[0].id)).request_id;
          assert.equal((await request(athlete, slots[0].id)).request_id, first);
          for (const source of [first, competing]) {
            const rows = await eventRows(source);
            assert.equal(rows.length, 2);
            assert.deepEqual(
              new Set(rows.map((r) => r.recipient_profile_id)),
              new Set([coach.id, source === first ? athlete.id : other.id]),
            );
            assert.equal(rows.filter((r) => r.notify_in_app).length, 1);
            assert.ok(
              rows.every(
                (r) =>
                  r.kind === "requested" &&
                  new Date(r.due_at) <= new Date(r.observed_at),
              ),
            );
          }
          assert.equal((await list(coach)).unreadCount, 2);
          assert.equal((await list(athlete)).items.length, 0);
          assert.equal((await list(other)).items.length, 0);
        },
      );
      await t.test(
        "request acceptance emits one confirmation, competing loser gets private outcome; replay no duplicate",
        async () => {
          const n = await totals();
          booking = (
            await command(coach, "accept_coach_booking_request", [first])
          ).booking_id;
          assert.equal(
            (await command(coach, "accept_coach_booking_request", [first]))
              .booking_id,
            booking,
          );
          assert.equal(await totals(), n + 2);
          assert.equal((await eventRows(booking)).length, 2);
          assert.ok(
            (await eventRows(booking)).every(
              (r) => r.kind === "confirmed" && !r.notify_in_app,
            ),
          );
          assert.equal(
            (await eventRows(competing)).filter(
              (r) => r.kind === "not-selected",
            ).length,
            2,
          );
          assert.equal((await list(coach)).unreadCount, 2);
          assert.equal((await list(athlete)).items.length, 0);
          assert.equal((await list(other)).items.length, 0);
          const loser = await eventRows(competing);
          assert.ok(
            !JSON.stringify(loser).includes(athlete.id),
            "Loser event must not contain chosen athlete",
          );
        },
      );
      await t.test(
        "bell read and chat reads do not suppress immediate booking receipts",
        async () => {
          const snapshot = await list(coach);
          await as(
            coach,
            (tx) =>
              tx`select app.notification_command_v2('read-all',${tx.json({ throughAt: snapshot.snapshotAt })})`,
          );
          assert.equal((await list(coach)).unreadCount, 0);
          assert.ok(
            (await eventRows(first)).every((r) => r.state === "queued"),
          );
          const [c] =
            await db`select id,last_seq from app.message_conversations where coach_profile_id=${coach.id}::uuid and athlete_profile_id=${athlete.id}::uuid`;
          await as(
            athlete,
            (tx) =>
              tx`select app.message_command('read',${tx.json({ conversationId: c.id, through: c.last_seq })})`,
          );
          assert.ok(
            (await eventRows(booking)).every((r) => r.state === "queued"),
          );
        },
      );
      await t.test(
        "real restricted mixed worker captures both receipts with separate addresses and escaped snapshot links",
        async () => {
          assert.equal(await drain(), 8);
          const rows =
            await db`select j.provider_id,j.recipient_profile_id,e.kind from app.booking_notification_receipts j join app.booking_notification_events e on e.id=j.event_id where e.source_id=${booking}::uuid`;
          for (const row of rows) {
            const raw = await (
              await fetch(
                `http://127.0.0.1:55324/api/v1/message/${row.provider_id}/raw`,
              )
            ).text();
            const capture = await (
              await fetch(
                `http://127.0.0.1:55324/api/v1/message/${row.provider_id}`,
              )
            ).json();
            assert.equal(capture.From.Address, "notification@movx.club");
            assert.equal(capture.To.length, 1);
            assert.equal(
              capture.To[0].Address,
              row.recipient_profile_id === coach.id
                ? coach.email
                : athlete.email,
            );
            assert.match(raw, /Reply-To:.*hello@movx\.club/i);
            assert.match(capture.Text, /Booking confirmed/);
            assert.ok(
              capture.Text.includes(
                row.recipient_profile_id === coach.id
                  ? "/coach?view=bookings"
                  : "/sessions",
              ),
            );
            assert.ok(!capture.Text.includes(other.email));
          }
          assert.equal(await drain(), 0);
        },
      );
      await t.test(
        "athlete cancellation alerts coach and emails both, exact cancellation retry emits nothing",
        async () => {
          const before = await totals();
          await command(athlete, "cancel_direct_private_booking", [booking]);
          await command(athlete, "cancel_direct_private_booking", [booking]);
          assert.equal(await totals(), before + 1);
          const rows = (await eventRows(booking)).filter(
            (r) => r.kind === "cancelled",
          );
          assert.equal(rows.length, 2);
          assert.equal(rows.filter((r) => r.notify_in_app).length, 1);
          assert.equal((await list(coach)).unreadCount, 1);
          assert.equal((await list(athlete)).unreadCount, 0);
        },
      );
      await t.test(
        "withdrawal/decline and canonical occurrence closure capture only committed state transitions",
        async () => {
          const withdrawn = (await request(athlete, slots[1].id)).request_id;
          await command(athlete, "withdraw_coach_booking_request", [withdrawn]);
          await command(athlete, "withdraw_coach_booking_request", [withdrawn]);
          assert.equal((await eventRows(withdrawn)).length, 4);
          const declined = (await request(athlete, slots[2].id)).request_id;
          await command(coach, "decline_coach_booking_request", [declined]);
          await command(coach, "decline_coach_booking_request", [declined]);
          assert.equal((await eventRows(declined)).length, 4);
          assert.equal(
            (await eventRows(declined)).filter(
              (r) => r.kind === "declined" && r.notify_in_app,
            ).length,
            0,
          );
          const closed = (await request(athlete, slots[3].id)).request_id;
          await command(coach, "close_coach_booking_request_occurrence", [
            slots[3].id,
          ]);
          assert.equal(
            (await eventRows(closed)).filter((r) => r.kind === "unavailable")
              .length,
            2,
          );
          const before = await totals();
          await assert.rejects(
            as(athlete, async (tx) => {
              await tx`select app.create_coach_booking_request(${slots[4].id}::uuid)`;
              throw Error("ROLLBACK");
            }),
            /ROLLBACK/,
          );
          assert.equal(await totals(), before);
          await assert.rejects(
            command(other, "decline_coach_booking_request", [withdrawn]),
          );
          assert.equal(await totals(), before);
        },
      );
      await t.test(
        "canonical lazy expiry alerts the coach without attributing the reconciliation reader",
        async () => {
          const expired = randomUUID();
          await db.begin(async (tx) => {
            await tx`select app.mail_flags(true)`;
            await tx`insert into app.coach_booking_requests(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,coach_timezone,coach_training_location_id,training_location_name,location_kind,gym_name,public_location_label,decision_deadline_at,created_at,updated_at)
            select ${expired}::uuid,run_id,id,profile_id,${athlete.id}::uuid,'pending',starts_at,ends_at,coach_timezone,coach_training_location_id,training_location_name,location_kind,gym_name,public_location_label,statement_timestamp()-interval '1 minute',statement_timestamp()-interval '2 hours',statement_timestamp()-interval '2 hours' from app.coach_availability_slots where id=${slots[6].id}::uuid`;
          });
          const result = await command(
            athlete,
            "current_client_coach_booking_request",
            [expired],
          );
          assert.equal(result.status, "expired");
          const rows = (await eventRows(expired)).filter(
            (r) => r.kind === "expired",
          );
          assert.equal(rows.length, 2);
          assert.ok(rows.every((r) => r.actor_profile_id === null));
          assert.equal(rows.filter((r) => r.notify_in_app).length, 1);
        },
      );
      let typeId: string;
      await t.test(
        "racing decisions emit one confirmation; typed revisions and coach direct creation keep exactly two receipts",
        async () => {
          const a = (await request(athlete, slots[4].id)).request_id,
            b = (await request(other, slots[4].id)).request_id;
          const decisions = await Promise.allSettled([
            command(coach, "accept_coach_booking_request", [a]),
            command(coach, "accept_coach_booking_request", [b]),
          ]);
          assert.ok(
            decisions.some(
              (r) =>
                r.status === "fulfilled" &&
                r.value.request_status === "accepted",
            ),
          );
          const winners =
            await db`select id,client_profile_id from app.coach_private_bookings where slot_id=${slots[4].id}::uuid and status='confirmed'`;
          assert.equal(winners.length, 1);
          const chosen = winners[0];
          assert.equal((await eventRows(chosen.id)).length, 2);
          typeId = randomUUID();
          await command(coach, "mutate_owned_coach_session_type", [
            randomUUID(),
            JSON.stringify({
              action: "save",
              id: typeId,
              expectedRevision: -1,
              format: "private",
              name: "Notification private",
              description:
                "Disposable notification duration and venue snapshots.",
              color: "#123456",
              durationMinutes: 75,
              defaultLocationId: venue.id,
              bookable: true,
            }),
          ]);
          const startsAt = new Date(
              new Date(slots[0].starts_at).getTime() + 15 * 60000,
            ).toISOString(),
            cmd = randomUUID();
          const payload = {
            action: "override",
            bookingId: chosen.id,
            expectedRevision: 0,
            typeId,
            typeRevision: 1,
            locationId: venue.id,
            startsAt,
            durationMinutes: 75,
          };
          await command(coach, "coach_session_booking", [
            cmd,
            JSON.stringify(payload),
          ]);
          await command(coach, "coach_session_booking", [
            cmd,
            JSON.stringify(payload),
          ]);
          const changes = (await eventRows(chosen.id)).filter(
            (r) => r.kind === "changed",
          );
          assert.equal(changes.length, 2);
          assert.ok(
            changes.every(
              (r) =>
                new Date(r.starts_at).toISOString() === startsAt &&
                !r.notify_in_app,
            ),
          );
          assert.ok(
            changes.every(
              (r) =>
                (new Date(r.ends_at).getTime() -
                  new Date(r.starts_at).getTime()) /
                  60000 ===
                75,
            ),
          );
          const n = await totals();
          await assert.rejects(
            command(coach, "coach_session_booking", [
              cmd,
              JSON.stringify({ ...payload, durationMinutes: 90 }),
            ]),
          );
          assert.equal(await totals(), n);
          const recipient =
            chosen.client_profile_id === athlete.id ? athlete : other;
          const connection = (
            await command(coach, "send_coach_athlete_connection", [
              chosen.id,
              randomUUID(),
              null,
            ])
          ).send_coach_athlete_connection;
          await command(recipient, "decide_coach_athlete_connection", [
            connection.id,
            "accept",
          ]);
          const createId = randomUUID(),
            direct = {
              action: "create",
              athleteId: recipient.id,
              typeId,
              typeRevision: 1,
              locationId: venue.id,
              startsAt: new Date(slots[7].starts_at).toISOString(),
              durationMinutes: 60,
            };
          const directBooking = (
            await command(coach, "coach_session_booking", [
              createId,
              JSON.stringify(direct),
            ])
          ).coach_session_booking.bookingId;
          await command(coach, "coach_session_booking", [
            createId,
            JSON.stringify(direct),
          ]);
          assert.equal((await eventRows(directBooking)).length, 2);
          assert.ok(
            (await eventRows(directBooking)).every(
              (r) => r.kind === "confirmed" && !r.notify_in_app,
            ),
          );
          await command(coach, "cancel_direct_private_booking", [
            directBooking,
          ]);
          assert.equal(
            (await eventRows(directBooking)).filter(
              (r) => r.kind === "cancelled",
            ).length,
            2,
          );
          assert.ok(
            (await eventRows(directBooking)).every((r) => !r.notify_in_app),
          );
        },
      );
      await t.test(
        "source/dataset/recipient authority denies raw queues and forged self reads",
        async () => {
          const [r] =
            await db`select j.id from app.booking_notification_receipts j where j.recipient_profile_id=${coach.id}::uuid limit 1`;
          await assert.rejects(
            as(
              athlete,
              (tx) =>
                tx`select app.notification_command_v2('read',${tx.json({ id: r.id })})`,
            ),
          );
          for (const table of [
            "booking_notification_events",
            "booking_notification_receipts",
          ])
            await assert.rejects(
              runtime.unsafe(`select * from app.${table}`),
              (e) => (e as { code: string }).code === "42501",
            );
          await assert.rejects(
            runtime`select app.booking_notification_recipient_email(${r.id}::uuid)`,
            (e) => (e as { code: string }).code === "42501",
          );
          await assert.rejects(
            runtime`select app.claim_all_notification_emails(5)`,
            (e) => (e as { code: string }).code === "42501",
          );
          await assert.rejects(
            as(
              { ...coach, run: randomUUID() },
              (tx) => tx`select app.notification_command_v2('list','{}')`,
            ),
          );
          const [acl] =
            await db`select has_function_privilege('app_notification_worker','app.booking_notification_recipient_email(uuid)','execute') email,has_table_privilege('app_notification_worker','app.booking_notification_receipts','select') raw,has_function_privilege('app_runtime','app.capture_private_booking_event()','execute') forge`;
          assert.deepEqual(acl, { email: false, raw: false, forge: false });
        },
      );
      await t.test(
        "mixed global cursor/snapshot and bounded claims retain later arrivals; original message delay remains",
        async () => {
          const message = await as(
            athlete,
            async (tx) =>
              (
                await tx`select app.message_command('inquire',${tx.json({ coachId: coach.id, body: "Private message text not in booking emails", submissionId: randomUUID() })}) result`
              )[0].result,
          );
          const snapshot = await list(coach);
          assert.ok(snapshot.items.some((x) => x.kind !== "booking"));
          assert.ok(snapshot.items.some((x) => x.kind === "booking"));
          const fresh = (await request(athlete, slots[5].id)).request_id;
          await as(
            coach,
            (tx) =>
              tx`select app.notification_command_v2('read-all',${tx.json({ throughAt: snapshot.snapshotAt })})`,
          );
          assert.equal(
            (await list(coach, { filter: "unread" })).unreadCount,
            1,
          );
          const rows =
            await db`select extract(epoch from j.due_at-e.created_at)::int seconds from app.notification_emails j join app.message_entries e on e.id=j.first_entry_id where j.conversation_id=${message.conversationId}::uuid`;
          assert.ok(rows.every((r) => r.seconds === 300));
          assert.equal((await eventRows(fresh)).length, 2);
          await assert.rejects(
            as(
              coach,
              (tx) =>
                tx`select app.notification_command_v2('read-all',${tx.json({ throughAt: "2999-01-01T00:00:00Z" })})`,
            ),
          );
          for (let i = 0; i < 11; i++) {
            const r = (await request(other, slots[6].id)).request_id;
            await command(other, "withdraw_coach_booking_request", [r]);
          }
          const page = await list(coach);
          assert.equal(page.items.length, 20);
          assert.equal(page.hasMore, true);
          const last = page.items.at(-1)!;
          const next = await list(coach, {
            beforeAt: last.createdAt,
            beforeId: last.id,
          });
          assert.ok(next.items.length > 0);
          assert.ok(
            next.items.every(
              (item) => !page.items.some((first) => first.id === item.id),
            ),
          );
        },
      );
      await drain();
      await t.test(
        "booking worker fences pre-handoff retries and quarantines ambiguous sending without a resend",
        async () => {
          await command(athlete, "request_session_type", [
            randomUUID(),
            JSON.stringify({
              typeId,
              typeRevision: 1,
              locationId: venue.id,
              startsAt: new Date(slots[6].starts_at).toISOString(),
            }),
          ]);
          const worker = postgres(process.env.NOTIFICATION_TEST_WORKER_URL!, {
            prepare: false,
            onnotice: () => {},
          });
          try {
            const [r] =
              await worker`select app.claim_booking_notification_emails(2) claims`;
            const [sending, pre] = r.claims;
            assert.equal(r.claims.length, 2);
            assert.equal(
              (
                await worker`select app.prepare_booking_notification_email(${sending.id}::uuid,${randomUUID()}::uuid) value`
              )[0].value,
              null,
            );
            const prepared = (
              await worker`select app.prepare_booking_notification_email(${sending.id}::uuid,${sending.leaseId}::uuid) value`
            )[0].value;
            assert.equal(prepared.kind, "booking");
            assert.ok(
              !JSON.stringify(prepared).includes("Private message text"),
            );
            await db`update app.booking_notification_receipts set lease_until=statement_timestamp()-interval '1 second' where id in(${sending.id}::uuid,${pre.id}::uuid)`;
            const again = (
              await worker`select app.claim_booking_notification_emails(2) claims`
            )[0].claims;
            assert.equal(again.length, 1);
            assert.equal(again[0].id, pre.id);
            assert.notEqual(again[0].leaseId, pre.leaseId);
            assert.equal(
              (
                await db`select state from app.booking_notification_receipts where id=${sending.id}::uuid`
              )[0].state,
              "unknown",
            );
            assert.equal(
              (
                await worker`select app.prepare_booking_notification_email(${pre.id}::uuid,${pre.leaseId}::uuid) value`
              )[0].value,
              null,
            );
            await worker`select app.prepare_booking_notification_email(${pre.id}::uuid,${again[0].leaseId}::uuid)`;
            assert.equal(
              (
                await worker`select app.finish_booking_notification_email(${pre.id}::uuid,${pre.leaseId}::uuid,'accepted',null) value`
              )[0].value,
              false,
            );
            assert.equal(
              (
                await worker`select app.finish_booking_notification_email(${pre.id}::uuid,${again[0].leaseId}::uuid,'retry',null) value`
              )[0].value,
              true,
            );
            const [backoff] =
              await db`select state,attempts,extract(epoch from due_at-finished_at)::int delay from app.booking_notification_receipts where id=${pre.id}::uuid`;
            assert.deepEqual(backoff, {
              state: "queued",
              attempts: 2,
              delay: 60,
            });
            await db`update app.booking_notification_receipts set due_at=statement_timestamp() where id=${pre.id}::uuid`;
            assert.equal(await drain(), 1);
            assert.equal(
              (
                await worker`select app.claim_booking_notification_emails(2) value`
              )[0].value.length,
              0,
            );
          } finally {
            await worker.end();
          }
        },
      );
      await t.test(
        "queued booking receipts recheck current verified account and dataset access at handoff",
        async () => {
          const [pending] =
            await db`select r.id from app.coach_booking_requests r join app.coach_availability_slots s on s.id=r.slot_id where r.coach_profile_id=${coach.id}::uuid and r.client_profile_id=${athlete.id}::uuid and r.status='pending' and s.session_type_id=${typeId!}::uuid order by r.created_at desc limit 1`;
          assert.ok(pending);
          await command(athlete, "withdraw_coach_booking_request", [
            pending.id,
          ]);
          await db`update auth.users set email_confirmed_at=null where id=${athlete.auth}::uuid`;
          const unverified = await runNotificationWorker(workerEnv, 3);
          assert.equal(unverified.accepted, 1);
          assert.equal(unverified.suppressed, 1);
          const receipts = (await eventRows(pending.id)).filter(
            (r) => r.kind === "withdrawn",
          );
          assert.equal(
            receipts.find((r) => r.recipient_profile_id === athlete.id)?.state,
            "suppressed",
          );
          assert.equal(
            receipts.find((r) => r.recipient_profile_id === coach.id)?.state,
            "accepted",
          );
          await db`update auth.users set email_confirmed_at=statement_timestamp() where id=${athlete.auth}::uuid`;
          await command(athlete, "request_session_type", [
            randomUUID(),
            JSON.stringify({
              typeId,
              typeRevision: 1,
              locationId: venue.id,
              startsAt: new Date(slots[6].starts_at).toISOString(),
            }),
          ]);
          await db`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where run_id=${athlete.run}::uuid and profile_id=${athlete.id}::uuid`;
          await assert.rejects(list(athlete));
          const revoked = await runNotificationWorker(workerEnv, 3);
          assert.equal(revoked.accepted, 1);
          assert.equal(revoked.suppressed, 1);
          await db`update app.demo_run_participants set status='active',revoked_at=null where run_id=${athlete.run}::uuid and profile_id=${athlete.id}::uuid`;
        },
      );
    } finally {
      const rows =
        await db`select provider_id from app.booking_notification_receipts where provider_id is not null`;
      for (const r of rows)
        if (!captures.includes(r.provider_id)) captures.push(r.provider_id);
      if (captures.length) {
        const r = await fetch("http://127.0.0.1:55324/api/v1/messages", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ IDs: captures }),
        });
        assert.ok(r.ok);
      }
      await runtime.end();
      await db.end();
    }
  },
);
