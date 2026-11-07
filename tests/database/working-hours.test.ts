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
import type { SessionType } from "@/domain/session-types";

const url = process.env.DATABASE_TEST_URL;
const selected = url ? new URL(url) : null;
const allowed =
  selected &&
  ["127.0.0.1", "localhost"].includes(selected.hostname) &&
  selected.port === "55322" &&
  /^\/mov181_[a-f0-9]+_(fresh|upgrade)$/.test(selected.pathname);
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
  "working-hour exceptions require exact owner confirmation and preserve scheduling authority",
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
      process.env.HOURS_RUNTIME_URL ?? runtime.toString();
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
      await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${authUserId}::uuid,false,false)`;
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
        await admin`select app.review_coach_application(${actor.profileId}::uuid,'pending','approved','Disposable DEV0388 database regression.','database-test','movx-owner-authorized-uat-v1')`;
        await admin`update app.coach_profiles set visibility='visible' where profile_id=${actor.profileId}::uuid`;
      }
      return actor;
    }
    async function createFixture(): Promise<Fixture> {
      const coach = await person("DEV0388 origin coach", true);
      const athlete = await person("DEV0388 origin athlete");
      const outsider = await person("DEV0388 unrelated athlete");
      const otherCoach = await person("DEV0388 unrelated coach", true);
      const [venue] =
        await admin`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
      const secondVenueId = (
        await run<{ id: string }>(
          coach,
          sql`select app.create_owned_coach_training_location('DEV0388 second venue',null,'Berlin test venue',52.52,13.4,'manual',null) id`,
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
        body: "DEV0388 retained training discussion",
      });
      await message(coach, "session-title", {
        bookingId: accepted.booking_id,
        expectedRevision: 0,
        title: "DEV0388 retained session title",
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
      const manifest = process.env.HOURS_MANIFEST;
      const fixture: Fixture =
        process.env.HOURS_REUSE === "1" && manifest
          ? JSON.parse(readFileSync(manifest, "utf8"))
          : await createFixture();
      if (process.env.HOURS_PREPARE === "1") {
        assert.ok(manifest);
        writeFileSync(manifest, JSON.stringify(fixture), { mode: 0o600 });
        return;
      }
      const {
        coach,
        athlete,
        otherCoach,
        outsider,
        type,
        bookingId,
        venueId,
        day,
        requestId,
      } = fixture;
      const at = async (date: string, time: string) =>
        (
          await admin`select ((${date}::date+${time}::time)at time zone'Europe/Berlin')::text instant`
        )[0].instant as string;
      const next = (await admin`select (${day}::date+1)::text date`)[0]
        .date as string;
      const review = async (
        actor: AuthorizedActor,
        payload: Record<string, unknown>,
      ) =>
        (
          await run<{ result: { outsideWorkingHours: boolean } }>(
            actor,
            sql`select app.review_owned_booking_change(${JSON.stringify(payload)}::jsonb)result`,
          )
        )[0].result;
      const payload = (start: string, revision: number, duration = 75) => ({
        action: "override",
        bookingId,
        expectedRevision: revision,
        typeId: type.id,
        typeRevision: type.revision,
        locationId: venueId,
        startsAt: start,
        durationMinutes: duration,
      });
      const availability = async () =>
        (
          await admin`select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from app.coach_availability_policies x where profile_id=${coach.profileId}::uuid),'dates',(select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from app.coach_availability_date_overrides x where profile_id=${coach.profileId}::uuid))data`
        )[0]?.data;
      const beforeAvailability = await availability();
      const changes = async () =>
        (
          await admin`select count(*)::integer n from app.session_booking_changes where booking_id=${bookingId}::uuid`
        )[0].n;
      const notices = async () =>
        (
          await admin`select count(*)::integer n from app.booking_notification_receipts r join app.booking_notification_events e on e.id=r.event_id where e.source_id=${bookingId}::uuid and e.kind='changed'`
        )[0].n;
      await t.test(
        "first in-hours75-minute change stays compatible",
        async () => {
          const p = payload(await at(day, "18:00"), 0);
          assert.deepEqual(await review(coach, p), {
            outsideWorkingHours: false,
          });
          assert.deepEqual(await command(coach, p), { bookingId, revision: 1 });
          assert.equal(await changes(), 1);
          assert.equal(await notices(), 2);
        },
      );
      const outside = payload(await at(day, "19:00"), 1);
      const before = await detail(coach, bookingId);
      await t.test(
        "review-only and unconfirmed second change reserve nothing and enqueue no email",
        async () => {
          assert.deepEqual(await review(coach, outside), {
            outsideWorkingHours: true,
          });
          for (const p of [
            outside,
            { ...outside, outsideHoursConfirmed: false },
          ])
            await assert.rejects(command(coach, p), (e) =>
              errorHasCode(e, "P0001"),
            );
          assert.deepEqual(await detail(coach, bookingId), before);
          assert.equal(await changes(), 1);
          assert.equal(await notices(), 2);
        },
      );
      await t.test(
        "confirmation cannot be forged by another actor, used for creation or written as a raw intent",
        async () => {
          for (const actor of [athlete, otherCoach, outsider])
            await assert.rejects(
              command(actor, { ...outside, outsideHoursConfirmed: true }),
              (e) => errorHasCode(e, "42501"),
            );
          await assert.rejects(
            command(coach, { ...outside, outsideHoursConfirmed: "true" }),
            (e) => errorHasCode(e, "22023"),
          );
          await assert.rejects(
            command(coach, {
              ...outside,
              action: "create",
              athleteId: athlete.profileId,
              outsideHoursConfirmed: true,
            }),
            (e) => errorHasCode(e, "22023"),
          );
          await assert.rejects(
            run(
              coach,
              sql`insert into app.session_booking_commands values(${coach.runId},${coach.profileId},${randomUUID()},'{}','{}')`,
            ),
            (e) => errorHasCode(e, "42501"),
          );
          await assert.rejects(
            run(
              coach,
              sql`select app.typed_session_fit_checks(null,null,null,null,null,null,null,null,false)`,
            ),
            (e) => errorHasCode(e, "42501"),
          );
          await assert.rejects(
            run(
              athlete,
              sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ ...outside, outsideHoursConfirmed: true })}::jsonb)`,
            ),
            (e) => errorHasCode(e, "22023"),
          );
        },
      );
      await t.test(
        "explicit exact second change bypasses hours only and recovers without duplicate events",
        async () => {
          const id = randomUUID(),
            p = { ...outside, outsideHoursConfirmed: true };
          assert.deepEqual(await command(coach, p, id), {
            bookingId,
            revision: 2,
          });
          assert.deepEqual(await command(coach, p, id), {
            bookingId,
            revision: 2,
          });
          await assert.rejects(
            command(coach, { ...p, outsideHoursConfirmed: false }, id),
            (e) => errorHasCode(e, "P0001"),
          );
          assert.equal(await changes(), 2);
          assert.equal(await notices(), 4);
          assert.deepEqual(await availability(), beforeAvailability);
          const [audit] =
            await admin`select new_terms->'outsideHoursConfirmed'confirmed from app.session_booking_changes where booking_id=${bookingId}::uuid and revision=2`;
          assert.equal(audit.confirmed, true);
          const d = await detail(athlete, bookingId);
          assert.equal(d.revision, 2);
          assert.equal(Date.parse(d.startsAt), Date.parse(outside.startsAt));
          assert.equal(
            Date.parse(d.endsAt) - Date.parse(d.startsAt),
            75 * 60000,
          );
          assert.deepEqual(
            (
              await admin`select to_jsonb(r)data from app.coach_booking_requests r where id=${requestId}::uuid`
            )[0].data,
            fixture.originalRequest,
          );
        },
      );
      await t.test(
        "day-off confirmation is scoped to one booking and proof cannot authorize a later unconfirmed command",
        async () => {
          const p = payload(await at(next, "10:00"), 2);
          assert.deepEqual(await review(coach, p), {
            outsideWorkingHours: true,
          });
          await assert.rejects(command(coach, p), (e) =>
            errorHasCode(e, "P0001"),
          );
          assert.deepEqual(
            await command(coach, { ...p, outsideHoursConfirmed: true }),
            { bookingId, revision: 3 },
          );
          const q = payload(await at(next, "12:00"), 3);
          await assert.rejects(command(coach, q), (e) =>
            errorHasCode(e, "P0001"),
          );
          assert.equal(await changes(), 3);
        },
      );
      await t.test(
        "confirmation does not bypass coach-wide conflicts, stale revisions or invalid horizon",
        async () => {
          const start = await at(day, "17:00");
          const request = (
            await run<{ result: { requestId: string } }>(
              athlete,
              sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: type.id, typeRevision: type.revision, locationId: venueId, startsAt: start })}::jsonb)result`,
            )
          )[0].result;
          await run(
            coach,
            sql`select * from app.accept_coach_booking_request(${request.requestId}::uuid)`,
          );
          for (const p of [
            payload(start, 3),
            payload(await at(next, "10:00"), 0),
            payload("2000-01-01T10:00:00Z", 3),
          ]) {
            await assert.rejects(
              command(coach, { ...p, outsideHoursConfirmed: true }),
              (e) => errorHasCode(e, "P0001"),
            );
          }
          const groupId = randomUUID();
          const groupStart = await at(next, "15:00");
          await admin`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,created_at,published_at)
          select ${groupId}::uuid,${coach.runId}::uuid,${coach.profileId}::uuid,${"group-" + groupId.replaceAll("-", "")},'Hours conflict fixture','Owned disposable group reservation','Boxing','All levels',l.id,jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),${groupStart}::timestamptz,${groupStart}::timestamptz+interval '1 hour',clock_timestamp()+interval '1 day',1,4,0,'open',clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute' from app.coach_training_locations l where l.id=${venueId}::uuid`;
          const groupConflict = payload(groupStart, 3);
          await assert.rejects(review(coach, groupConflict), (e) =>
            errorHasCode(e, "P0001"),
          );
          await assert.rejects(
            command(coach, { ...groupConflict, outsideHoursConfirmed: true }),
            (e) => errorHasCode(e, "P0001"),
          );
          assert.equal(await changes(), 3);
          assert.equal(await notices(), 6);
        },
      );
      await t.test(
        "concurrent exact confirmations recover one revision and two receipts",
        async () => {
          const id = randomUUID(),
            p = {
              ...payload(await at(next, "13:00"), 3),
              outsideHoursConfirmed: true,
            };
          const r = await Promise.all([
            command(coach, p, id),
            command(coach, p, id),
          ]);
          assert.deepEqual(r, [
            { bookingId, revision: 4 },
            { bookingId, revision: 4 },
          ]);
          assert.equal(await changes(), 4);
          assert.equal(await notices(), 8);
          assert.deepEqual(await availability(), beforeAvailability);
        },
      );
      await t.test(
        "confirmation still respects an explicit manual closure",
        async () => {
          const [previous] =
            await admin`select (previous_terms->'occurrence'->>'id')::uuid id from app.session_booking_changes where booking_id=${bookingId}::uuid and revision=2`;
          await admin`update app.coach_availability_slots set closure_reason='manual',closed_policy_revision=null where id=${previous.id}::uuid`;
          await assert.rejects(
            command(coach, {
              ...payload(await at(day, "18:00"), 4),
              outsideHoursConfirmed: true,
            }),
            (e) => errorHasCode(e, "P0001"),
          );
          assert.equal(await changes(), 4);
        },
      );
      await t.test(
        "cancelling an outside-hours booking does not publish those hours",
        async () => {
          const current = await detail(coach, bookingId);
          await run(
            coach,
            sql`select * from app.cancel_direct_private_booking(${bookingId}::uuid)`,
          );
          const [slot] =
            await admin`select s.status from app.coach_availability_slots s join app.coach_private_bookings b on b.slot_id=s.id where b.id=${bookingId}::uuid`;
          assert.equal(slot.status, "withdrawn");
          const [profile] =
            await admin`select public_slug from app.coach_profiles where profile_id=${coach.profileId}::uuid`;
          const [times] =
            await admin`select app.public_session_type_times(${profile.public_slug},${type.id}::uuid,${venueId}::uuid,${next}::date)result`;
          assert.deepEqual(times.result, []);
          assert.deepEqual(await availability(), beforeAvailability);
          assert.ok(current.revision === 4);
        },
      );
    } finally {
      await admin.end({ timeout: 2 });
    }
  },
);
