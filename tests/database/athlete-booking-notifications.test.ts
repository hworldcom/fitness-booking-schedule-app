import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { sql, type SQL } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { saveOwnedEffectiveAvailabilityRecord } from "@/server/db/coaches/effective-availability-repository";
import type { SessionBookingDetail } from "@/domain/typed-sessions";
import {
  parseNotificationPage,
  type NotificationPage,
} from "@/notifications/contracts";
import type { SessionType } from "@/domain/session-types";

const url = process.env.DATABASE_TEST_URL;
const selected = url ? new URL(url) : null;
const allowed =
  selected &&
  ["127.0.0.1", "localhost"].includes(selected.hostname) &&
  selected.port === "55322" &&
  /^\/mov185_[a-f0-9]+_(fresh|upgrade)$/.test(selected.pathname);
type Fixture = {
  database: string;
  coach: AuthorizedActor;
  athlete: AuthorizedActor;
  outsider: AuthorizedActor;
  otherCoach: AuthorizedActor;
  venueId: string;
  secondVenueId: string;
  type: SessionType;
  day: string;
  bookingId: string;
  requestId: string;
  originalRequest: Record<string, unknown>;
  originalSlot: Record<string, unknown>;
  conversationId: string;
  contextId: string;
};
function errorHasCode(error: unknown, code: string): boolean {
  let current = error;
  for (let i = 0; i < 8 && current && typeof current === "object"; i++) {
    const value = current as { code?: string; cause?: unknown };
    if (value.code === code) return true;
    current = value.cause;
  }
  return false;
}

test(
  "recipient booking bells preserve lifecycle, versions and ownership",
  { skip: !allowed },
  async (t) => {
    const admin = postgres(url!, {
      max: 4,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    const runtime = new URL(url!);
    process.env.DATABASE_URL =
      process.env.BELL_RUNTIME_URL ?? runtime.toString();
    const run = <T extends Record<string, unknown> = Record<string, unknown>>(
      actor: AuthorizedActor,
      query: SQL,
    ) => withActorDatabaseContext(actor, (tx) => tx.execute<T>(query));
    const command = async (
      actor: AuthorizedActor,
      value: Record<string, unknown>,
      id = randomUUID(),
    ) =>
      (
        await run<{ result: { bookingId: string; revision: number } }>(
          actor,
          sql`select app.coach_session_booking(${id}::uuid,${JSON.stringify(value)}::jsonb) result`,
        )
      )[0].result;
    const message = async (
      actor: AuthorizedActor,
      action: string,
      args: Record<string, unknown>,
    ) =>
      (
        await run<{ result: Record<string, unknown> }>(
          actor,
          sql`select app.message_command(${action},${JSON.stringify(args)}::jsonb) result`,
        )
      )[0].result;
    const detail = async (actor: AuthorizedActor, id: string) =>
      (
        await run<{ result: SessionBookingDetail }>(
          actor,
          sql`select app.session_booking_detail(${id}::uuid) result`,
        )
      )[0].result;
    async function person(
      name: string,
      coach = false,
    ): Promise<AuthorizedActor> {
      const authUserId = randomUUID();
      await admin`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${authUserId}::uuid,${authUserId + "@example.test"},statement_timestamp(),false,false)`;
      const [p] =
        await admin`select * from app.enroll_application_identity(${authUserId}::uuid,${name})`;
      const actor: AuthorizedActor = {
        authUserId,
        profileId: p.identity_profile_id,
        runId: p.identity_run_id,
        runRole: "member",
      };
      if (coach) {
        await run(actor, sql`select app.submit_owned_coach_application()`);
        await run(
          actor,
          sql`select app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":null,"facebookUrl":null,"linkedinUrl":null}'::jsonb)`,
        );
        await run(
          actor,
          sql`select app.upsert_owned_coach_profile(${name},'Disposable request-origin rescheduling regression coach profile.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
        );
        await admin`select app.review_coach_application(${actor.profileId}::uuid,'pending','approved','Disposable MOV185 database regression.','database-test','movx-owner-authorized-uat-v1')`;
        await admin`update app.coach_profiles set visibility='visible' where profile_id=${actor.profileId}::uuid`;
      }
      return actor;
    }
    async function createFixture(): Promise<Fixture> {
      const coach = await person("MOV185 origin coach", true);
      const athlete = await person("MOV185 origin athlete");
      const outsider = await person("MOV185 unrelated athlete");
      const otherCoach = await person("MOV185 unrelated coach", true);
      const [venue] =
        await admin`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
      const secondVenueId = (
        await run<{ id: string }>(
          coach,
          sql`select app.create_owned_coach_training_location('MOV185 second venue',null,'Berlin test venue',52.52,13.4,'manual',null) id`,
        )
      )[0].id;
      const [secondVenue] =
        await admin`select to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where id=${secondVenueId}::uuid`;
      const [date] =
        await admin`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text target_date`;
      const day: string = date.target_date;
      await withActorDatabaseContext(coach, (tx) =>
        saveOwnedEffectiveAvailabilityRecord(tx, {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 0,
          dates: [
            {
              date: day,
              mode: "custom",
              hours: [
                ...["17:00", "18:00", "19:00"].map((localStartTime) => ({
                  localStartTime,
                  locationId: venue.id,
                  locationUpdatedAt: venue.stamp,
                })),
                ...["14:00", "15:00", "16:00"].map((localStartTime) => ({
                  localStartTime,
                  locationId: secondVenueId,
                  locationUpdatedAt: secondVenue.stamp,
                })),
              ],
            },
          ],
        }),
      );
      const [typeRow] =
        await admin`select app.session_type_json(t) type from app.coach_session_types t where coach_profile_id=${coach.profileId}::uuid and format='private'`;
      const type = typeRow.type as SessionType;
      const [instant] =
        await admin`select to_jsonb((${day}::date+time '17:00') at time zone 'Europe/Berlin')#>>'{}' starts`;
      const request = (
        await run<{ result: { requestId: string } }>(
          athlete,
          sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: type.id, typeRevision: type.revision, locationId: venue.id, startsAt: instant.starts })}::jsonb) result`,
        )
      )[0].result;
      const accepted = (
        await run<{ booking_id: string; request_status: string }>(
          coach,
          sql`select * from app.accept_coach_booking_request(${request.requestId}::uuid)`,
        )
      )[0];
      assert.equal(accepted.request_status, "accepted");
      const [conversation] =
        await admin`select id from app.message_conversations where coach_profile_id=${coach.profileId}::uuid and athlete_profile_id=${athlete.profileId}::uuid`;
      const [context] =
        await admin`select id from app.message_contexts where conversation_id=${conversation.id}::uuid and kind='request' and source_id=${request.requestId}::uuid`;
      await message(athlete, "send", {
        conversationId: conversation.id,
        submissionId: randomUUID(),
        contextId: context.id,
        body: "MOV185 retained training discussion",
      });
      await message(coach, "session-title", {
        bookingId: accepted.booking_id,
        expectedRevision: 0,
        title: "MOV185 retained session title",
      });
      const [original] =
        await admin`select to_jsonb(r) request,to_jsonb(s) slot from app.coach_booking_requests r join app.coach_availability_slots s on s.id=r.slot_id where r.id=${request.requestId}::uuid`;
      return {
        database: selected!.pathname,
        coach,
        athlete,
        outsider,
        otherCoach,
        venueId: venue.id,
        secondVenueId,
        type,
        day,
        bookingId: accepted.booking_id,
        requestId: request.requestId,
        originalRequest: original.request,
        originalSlot: original.slot,
        conversationId: conversation.id,
        contextId: context.id,
      };
    }

    try {
      const manifest = process.env.BELL_MANIFEST;
      const fixture: Fixture =
        process.env.BELL_REUSE === "1" && manifest
          ? JSON.parse(readFileSync(manifest, "utf8"))
          : await createFixture();
      if (process.env.BELL_PREPARE === "1") {
        assert.ok(manifest);
        writeFileSync(manifest, JSON.stringify(fixture), { mode: 0o600 });
        return;
      }
      const { coach, athlete, outsider, otherCoach, type, venueId, day } =
        fixture;
      const notices = async (
        a: AuthorizedActor,
        version = 5,
        action = "list",
        args: Record<string, unknown> = {},
      ) =>
        (
          await run<{ result: unknown }>(
            a,
            sql`select ${sql.raw(version === 1 ? "app.notification_command" : "app.notification_command_v" + version)}(${action},${JSON.stringify(args)}::jsonb)result`,
          )
        )[0].result;
      const page = async (
        a: AuthorizedActor,
        version = 5,
        args: Record<string, unknown> = {},
      ) => parseNotificationPage(await notices(a, version, "list", args));
      const bookingItems = (p: NotificationPage, id: string) =>
        p.items.filter((x) => x.kind === "booking" && x.sourceId === id);
      const now = async () =>
        (await admin`select to_jsonb(clock_timestamp())#>>'{}'stamp`)[0]
          .stamp as string;
      const at = async (time: string) =>
        (
          await admin`select to_jsonb((${day}::date+${time}::time)at time zone'Europe/Berlin')#>>'{}'stamp`
        )[0].stamp as string;
      const receipts = (id: string) =>
        admin`select e.kind,r.id,r.recipient_profile_id,r.notify_in_app,r.read_at,r.state,r.attempts,r.due_at from app.booking_notification_events e join app.booking_notification_receipts r on r.event_id=e.id where e.source_id=${id}::uuid order by e.created_at,r.id`;
      const createBooking = async (time: string) => {
        const p = {
          typeId: type.id,
          typeRevision: type.revision,
          locationId: venueId,
          startsAt: await at(time),
        };
        const req = (
          await run<{ result: { requestId: string } }>(
            athlete,
            sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify(p)}::jsonb)result`,
          )
        )[0].result;
        const accept = () =>
          run<{ booking_id: string }>(
            coach,
            sql`select * from app.accept_coach_booking_request(${req.requestId}::uuid)`,
          );
        const [a, b] = await Promise.all([accept(), accept()]);
        assert.equal(a[0].booking_id, b[0].booking_id);
        return a[0].booking_id;
      };
      await t.test(
        "upgrade does not backfill historical athlete bells; new private command grants stay bounded",
        async () => {
          const old = await receipts(fixture.bookingId);
          assert.equal(
            old.find(
              (x) =>
                x.kind === "confirmed" &&
                x.recipient_profile_id === athlete.profileId,
            )?.notify_in_app,
            process.env.BELL_REUSE !== "1",
          );
          assert.equal(
            bookingItems(await page(athlete), fixture.bookingId).length,
            process.env.BELL_REUSE === "1" ? 0 : 1,
          );
          for (const role of [
            "anon",
            "authenticated",
            "service_role",
            "app_notification_worker",
            "app_media_worker",
          ]) {
            const [r] =
              await admin`select has_function_privilege(${role},'app.notification_command_v5(text,jsonb)','EXECUTE')ok`;
            assert.equal(r.ok, false);
          }
          await assert.rejects(
            run(athlete, sql`select * from app.booking_notification_receipts`),
            (e) => errorHasCode(e, "42501"),
          );
          await assert.rejects(
            run(athlete, sql`select app.capture_private_booking_event()`),
            (e) => errorHasCode(e, "42501"),
          );
        },
      );
      for (const a of [coach, athlete])
        await notices(a, 5, "read-all", { throughAt: await now() });
      const bookingId = await createBooking("18:00");
      await t.test(
        "canonical acceptance and concurrent exact retry create one athlete bell and two email receipts without a coach self alert",
        async () => {
          const rows = await receipts(bookingId);
          assert.equal(rows.length, 2);
          assert.equal(rows.filter((x) => x.notify_in_app).length, 1);
          assert.equal(
            rows.find((x) => x.notify_in_app)?.recipient_profile_id,
            athlete.profileId,
          );
          assert.equal(bookingItems(await page(athlete), bookingId).length, 1);
          assert.equal(bookingItems(await page(coach), bookingId).length, 0);
          for (const version of [1, 2, 3, 4])
            assert.equal(
              bookingItems(await page(athlete, version), bookingId).length,
              0,
            );
        },
      );
      const athleteReceipt = (await receipts(bookingId)).find(
        (x) => x.recipient_profile_id === athlete.profileId,
      )!;
      await t.test(
        "recipient reads are idempotent, isolated and independent of queued email state",
        async () => {
          for (const a of [coach, outsider, otherCoach])
            await assert.rejects(
              notices(a, 5, "read", { id: athleteReceipt.id }),
            );
          await assert.rejects(
            notices({ ...athlete, runId: randomUUID() }, 5, "list"),
          );
          await notices(athlete, 5, "read", { id: athleteReceipt.id });
          await notices(athlete, 5, "read", { id: athleteReceipt.id });
          const rows = await receipts(bookingId);
          assert.ok(rows.find((x) => x.id === athleteReceipt.id)?.read_at);
          assert.ok(
            rows.every((x) => x.state === "queued" && x.attempts === 0),
          );
          assert.ok(
            rows.find((x) => x.recipient_profile_id === coach.profileId)
              ?.read_at === null,
          );
        },
      );
      const commandId = randomUUID();
      const payload = {
        action: "override",
        bookingId,
        expectedRevision: 0,
        typeId: type.id,
        typeRevision: type.revision,
        locationId: venueId,
        startsAt: await at("19:00"),
        durationMinutes: 60,
      };
      await t.test(
        "concurrent reschedule retries create one affected-athlete item and preserve legacy read-all scope",
        async () => {
          const r = await Promise.all([
            command(coach, payload, commandId),
            command(coach, payload, commandId),
          ]);
          assert.deepEqual(r, [
            { bookingId, revision: 1 },
            { bookingId, revision: 1 },
          ]);
          const rows = await receipts(bookingId);
          assert.equal(rows.filter((x) => x.kind === "changed").length, 2);
          for (const version of [1, 2, 3, 4]) {
            assert.equal(
              bookingItems(await page(athlete, version), bookingId).length,
              0,
            );
            await notices(athlete, version, "read-all", {
              throughAt: await now(),
            });
          }
          const after = await receipts(bookingId);
          assert.ok(
            after.find(
              (x) =>
                x.kind === "changed" &&
                x.recipient_profile_id === athlete.profileId,
            )?.read_at === null,
          );
          assert.equal(
            bookingItems(
              await page(athlete, 5, { filter: "unread" }),
              bookingId,
            ).length,
            1,
          );
        },
      );
      await t.test(
        "coach cancellation alerts only the athlete, no extra revision/event/email on retry",
        async () => {
          for (let i = 0; i < 2; i++)
            await run(
              coach,
              sql`select app.cancel_direct_private_booking(${bookingId}::uuid)`,
            );
          assert.equal((await detail(athlete, bookingId)).revision, 1);
          const r = await receipts(bookingId);
          assert.equal(r.length, 6);
          assert.equal(
            r.filter((x) => x.kind === "cancelled" && x.notify_in_app).length,
            1,
          );
          assert.equal(
            r.find((x) => x.kind === "cancelled" && x.notify_in_app)
              ?.recipient_profile_id,
            athlete.profileId,
          );
          const items = bookingItems(await page(athlete), bookingId);
          assert.equal(items.length, 3);
          assert.equal(bookingItems(await page(coach), bookingId).length, 0);
        },
      );
      const secondId = await createBooking("19:00");
      await t.test(
        "athlete cancellation preserves reciprocal coach alert without an athlete self alert",
        async () => {
          await run(
            athlete,
            sql`select app.cancel_direct_private_booking(${secondId}::uuid)`,
          );
          const r = await receipts(secondId);
          assert.equal(r.length, 4);
          assert.equal(
            r.find((x) => x.kind === "cancelled" && x.notify_in_app)
              ?.recipient_profile_id,
            coach.profileId,
          );
          assert.equal(bookingItems(await page(athlete), secondId).length, 1);
          assert.equal(bookingItems(await page(coach), secondId).length, 1);
        },
      );
      await message(coach, "send", {
        conversationId: fixture.conversationId,
        submissionId: randomUUID(),
        contextId: fixture.contextId,
        body: "Recipient bell mixed history fixture",
      });
      const addItems = async (n: number) => {
        const tag = randomUUID();
        const events =
          await admin`insert into app.booking_notification_events(run_id,coach_profile_id,athlete_profile_id,actor_profile_id,event_key,kind,source_kind,source_id,slot_id,starts_at,ends_at,venue_name)
        select b.run_id,b.coach_profile_id,b.client_profile_id,b.coach_profile_id,${tag}||':'||g.i,'changed','booking',b.id,b.slot_id,b.scheduled_start_at,b.scheduled_end_at,s.training_location_name from app.coach_private_bookings b join app.coach_availability_slots s on s.id=b.slot_id cross join generate_series(1,${n}::int)g(i)where b.id=${bookingId}::uuid returning id`;
        for (const e of events)
          await admin`insert into app.booking_notification_receipts(event_id,recipient_profile_id,notify_in_app)values(${e.id}::uuid,${athlete.profileId}::uuid,true)`;
      };
      await t.test(
        "mixed history paging/counts and snapshot read-all preserve later arrivals and email state",
        async () => {
          await addItems(25);
          let p = await page(athlete);
          assert.equal(p.items.length, 20);
          assert.equal(p.hasMore, true);
          const throughAt = p.snapshotAt;
          const ids: string[] = [];
          let mixed = false;
          for (let i = 0; i < 5; i++) {
            for (const item of p.items) {
              ids.push(item.id);
              if (item.kind !== "booking") mixed = true;
            }
            if (!p.hasMore) break;
            const last = p.items.at(-1)!;
            p = await page(athlete, 5, {
              beforeAt: last.createdAt,
              beforeId: last.id,
            });
          }
          assert.equal(new Set(ids).size, ids.length);
          assert.ok(ids.length >= 29);
          assert.ok(mixed);
          await addItems(1);
          await notices(athlete, 5, "read-all", { throughAt });
          const unread = await page(athlete, 5, { filter: "unread" });
          assert.equal(unread.unreadCount, 1);
          assert.equal(unread.items.length, 1);
          const r = await receipts(bookingId);
          assert.ok(r.every((x) => x.state === "queued" && x.attempts === 0));
        },
      );
      await t.test(
        "revoked membership cannot read the new projection",
        async () => {
          await admin`update app.demo_run_participants set status='revoked',revoked_at=clock_timestamp() where profile_id=${athlete.profileId}::uuid and run_id=${athlete.runId}::uuid`;
          try {
            await assert.rejects(page(athlete));
          } finally {
            await admin`update app.demo_run_participants set status='active',revoked_at=null where profile_id=${athlete.profileId}::uuid and run_id=${athlete.runId}::uuid`;
          }
        },
      );
    } finally {
      await admin.end({ timeout: 2 });
    }
  },
);
