import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { sql, type SQL } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { saveOwnedEffectiveAvailabilityRecord } from "@/server/db/coaches/effective-availability-repository";
import {
  sendConnectionRecord,
  decideConnectionRecord,
} from "@/server/db/connections/repository";

import { sessionBookingDetailRecord } from "@/server/db/coaches/typed-session-repository";
import { currentActorProjection } from "@/server/db/authorization/repository";

const url = process.env.DATABASE_TEST_URL;
const allowed =
  url &&
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov251_[a-f0-9]+_(fresh|upgrade)$/.test(
    url,
  );

test(
  "manual client creation bypasses working hours only",
  { skip: !allowed },
  async (t) => {
    const admin = postgres(url!, { max: 6, prepare: false, onnotice() {} });
    assert.ok(process.env.HOURS_RUNTIME_URL);
    process.env.DATABASE_URL = process.env.HOURS_RUNTIME_URL;
    const run = (actor: AuthorizedActor, query: SQL) =>
      withActorDatabaseContext(actor, (tx) => tx.execute(query));
    const command = async (
      actor: AuthorizedActor,
      payload: object,
      id = randomUUID(),
    ) =>
      (
        await run(
          actor,
          sql`select app.coach_session_booking(${id}::uuid,${JSON.stringify(payload)}::jsonb) result`,
        )
      )[0].result as { bookingId: string; revision: number };
    const rejected = async (actor: AuthorizedActor, payload: object) => {
      const [before] =
        await admin`select (select count(*) from app.coach_private_bookings)::int bookings,(select count(*) from app.session_booking_commands)::int commands,(select count(*) from app.coach_availability_slots)::int slots,(select count(*) from app.booking_notification_events)::int events,(select count(*) from app.google_calendar_export_jobs)::int exports`;
      await assert.rejects(command(actor, payload));
      const [after] =
        await admin`select (select count(*) from app.coach_private_bookings)::int bookings,(select count(*) from app.session_booking_commands)::int commands,(select count(*) from app.coach_availability_slots)::int slots,(select count(*) from app.booking_notification_events)::int events,(select count(*) from app.google_calendar_export_jobs)::int exports`;
      assert.deepEqual(
        after,
        before,
        "rejection must roll back all intent, capacity and delivery effects",
      );
    };
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
          sql`select app.upsert_owned_coach_profile(${name},'Disposable manual client booking authority fixture.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
        );
        await admin`select app.review_coach_application(${actor.profileId}::uuid,'pending','approved','Disposable MOV-251 fixture','mov251','movx-identity-application-v1')`;
        await admin`update app.coach_profiles set visibility='visible' where profile_id=${actor.profileId}::uuid`;
      }
      return actor;
    }
    try {
      const coach = await person("Manual booking coach", true);
      const athlete = await person("Manual connected athlete");
      const outsider = await person("Manual unrelated athlete");
      const otherCoach = await person("Manual other coach", true);
      const [venue] =
        await admin`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
      const [type] =
        await admin`select id,revision from app.coach_session_types where coach_profile_id=${coach.profileId}::uuid and format='private'`;
      const [profile] =
        await admin`select public_slug from app.coach_profiles where profile_id=${coach.profileId}::uuid`;
      const [dates] =
        await admin`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text as day_value,((clock_timestamp() at time zone 'Europe/Berlin')::date+4)::text as next_value`;
      const at = async (time: string, day = dates.day_value) =>
        (
          await admin`select ((${day}::date+${time}::time) at time zone 'Europe/Berlin')::text instant`
        )[0].instant as string;
      const payload = (
        startsAt: string,
        client: object,
        durationMinutes = 60,
      ) => ({
        action: "create",
        typeId: type.id,
        typeRevision: type.revision,
        locationId: venue.id,
        startsAt,
        durationMinutes,
        ...client,
      });
      const external = (
        await run(
          coach,
          sql`select app.external_clients('create',${JSON.stringify({ operationId: randomUUID(), name: "Name only manual client", email: null })}::jsonb) result`,
        )
      )[0].result as { client: { id: string } };
      const ext = { externalClientId: external.client.id };
      const connected = { athleteId: athlete.profileId };
      const hours = async () =>
        (
          await admin`select jsonb_build_object('rules',(select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from app.coach_availability_rules x where profile_id=${coach.profileId}::uuid),'overrides',(select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from app.coach_availability_date_overrides x where profile_id=${coach.profileId}::uuid)) result`
        )[0].result;
      const publicTimes = async (day = dates.day_value) =>
        (
          await run(
            athlete,
            sql`select app.public_session_type_times(${profile.public_slug},${type.id}::uuid,${venue.id}::uuid,${day}::date) result`,
          )
        )[0].result;
      const initialHours = await hours();
      let externalBooking!: { bookingId: string; revision: number };
      await t.test(
        "external creation with no hours, exact retry and original participant",
        async () => {
          assert.deepEqual(await publicTimes(), []);
          const p = payload(await at("09:00"), ext, 75),
            id = randomUUID();
          externalBooking = await command(coach, p, id);
          assert.equal(externalBooking.revision, 0);
          assert.deepEqual(await command(coach, p, id), externalBooking);
          const [stored] =
            await admin`select result from app.session_booking_commands where command_id=${id}::uuid and actor_profile_id=${coach.profileId}::uuid`;
          assert.deepEqual(
            stored.result,
            externalBooking,
            "transient creation authority must not survive commit",
          );
          await assert.rejects(
            command(coach, { ...p, durationMinutes: 90 }, id),
          );
          const [b] =
            await admin`select client_profile_id,external_client_id,extract(epoch from scheduled_end_at-scheduled_start_at)::int duration from app.coach_private_bookings where id=${externalBooking.bookingId}::uuid`;
          assert.equal(b.client_profile_id, null);
          assert.equal(b.external_client_id, external.client.id);
          assert.equal(b.duration, 75 * 60);
          assert.deepEqual(await hours(), initialHours);
          assert.deepEqual(await publicTimes(), []);
        },
      );
      // Establish a real booking-qualified, explicitly accepted connection through
      // the existing athlete request and coach decision, then remove those hours.
      await withActorDatabaseContext(coach, (tx) =>
        saveOwnedEffectiveAvailabilityRecord(tx, {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 0,
          dates: [
            {
              date: dates.day_value,
              mode: "custom",
              hours: [
                {
                  localStartTime: "17:00",
                  locationId: venue.id,
                  locationUpdatedAt: venue.stamp,
                },
              ],
            },
          ],
        }),
      );
      const request = (
        await run(
          athlete,
          sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: type.id, typeRevision: type.revision, locationId: venue.id, startsAt: await at("17:00") })}::jsonb) result`,
        )
      )[0].result as { requestId: string };
      const accepted = (
        await run(
          coach,
          sql`select * from app.accept_coach_booking_request(${request.requestId}::uuid)`,
        )
      )[0];
      const sent = await withActorDatabaseContext(coach, (tx) =>
        sendConnectionRecord(
          tx,
          String(accepted.booking_id),
          randomUUID(),
          null,
        ),
      );
      await withActorDatabaseContext(athlete, (tx) =>
        decideConnectionRecord(tx, sent.id, "accept"),
      );
      await withActorDatabaseContext(coach, (tx) =>
        saveOwnedEffectiveAvailabilityRecord(tx, {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 1,
          dates: [{ date: dates.day_value, mode: "unavailable", hours: [] }],
        }),
      );
      const dayOffHours = await hours();
      let connectedBooking!: { bookingId: string; revision: number };
      await t.test(
        "connected creation on a day off and external creation on an empty date need no acknowledgement",
        async () => {
          connectedBooking = await command(
            coach,
            payload(await at("12:30"), connected),
          );
          await command(
            coach,
            payload(await at("11:00", dates.next_value), ext, 90),
          );
          await command(
            coach,
            payload(await at("09:00", dates.next_value), connected),
          );
          const [b] =
            await admin`select client_profile_id,external_client_id,status from app.coach_private_bookings where id=${connectedBooking.bookingId}::uuid`;
          assert.equal(b.client_profile_id, athlete.profileId);
          assert.equal(b.external_client_id, null);
          assert.equal(b.status, "confirmed");
          assert.deepEqual(await hours(), dayOffHours);
          assert.deepEqual(await publicTimes(), []);
          assert.deepEqual(await publicTimes(dates.next_value), []);
          const [events] =
            await admin`select count(*)::int n from app.booking_notification_events where source_id=${connectedBooking.bookingId}::uuid and kind='confirmed'`;
          assert.equal(events.n, 1);
        },
      );
      await t.test(
        "failed creates roll back intent, slots and notifications and retain non-hour checks",
        async () => {
          const free = payload(await at("14:00"), connected);
          for (const bad of [
            payload(await at("12:45"), ext),
            { ...free, typeRevision: type.revision + 1 },
            { ...free, typeId: randomUUID() },
            { ...free, locationId: randomUUID() },
            { ...free, startsAt: "2000-01-01T10:00:00Z" },
            { ...free, startsAt: "2099-01-01T10:00:00Z" },
            { ...free, startsAt: await at("14:10") },
            { ...free, startsAt: await at("23:30"), durationMinutes: 90 },
            { ...free, durationMinutes: 45 },
            { ...free, athleteId: outsider.profileId },
            {
              ...payload(await at("14:00"), ext),
              externalClientId: randomUUID(),
            },
            { ...free, outsideHoursConfirmed: true },
          ])
            await rejected(coach, bad);
          for (const actor of [
            athlete,
            outsider,
            otherCoach,
            { ...coach, authUserId: outsider.authUserId },
            { ...coach, runId: randomUUID() },
          ])
            await rejected(actor, free);
          await assert.rejects(
            run(
              coach,
              sql`insert into app.session_booking_commands values(${coach.runId}::uuid,${coach.profileId}::uuid,${randomUUID()}::uuid,'{}','{}')`,
            ),
          );
          await assert.rejects(
            run(
              coach,
              sql`select app.typed_session_fit_checks(null,null,null,null,null,null,null,null,false)`,
            ),
          );
        },
      );
      await t.test(
        "public athlete requests and existing reschedule consent stay strict",
        async () => {
          const p = payload(await at("14:00"), connected);
          const { typeId, typeRevision, locationId, startsAt } = p;
          await assert.rejects(
            run(
              athlete,
              sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId, typeRevision, locationId, startsAt })}::jsonb)`,
            ),
          );
          await assert.rejects(
            command(coach, {
              action: "override",
              bookingId: connectedBooking.bookingId,
              expectedRevision: 0,
              typeId,
              typeRevision,
              locationId,
              startsAt,
              durationMinutes: 60,
            }),
            /./,
          );
        },
      );
      await t.test(
        "concurrent identical retries create one booking and different overlapping commands have one winner",
        async () => {
          const p = payload(await at("14:00"), connected),
            id = randomUUID();
          const results = await Promise.all([
            command(coach, p, id),
            command(coach, p, id),
          ]);
          assert.deepEqual(results[0], results[1]);
          const [n] =
            await admin`select count(*)::int n from app.booking_notification_events where source_id=${results[0].bookingId}::uuid and kind='confirmed'`;
          assert.equal(n.n, 1);
          const race = await Promise.allSettled([
            command(coach, payload(await at("15:00"), ext)),
            command(coach, payload(await at("15:30"), connected)),
          ]);
          assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
        },
      );
      await t.test(
        "group reservations and manual closures still block manual creation",
        async () => {
          const groupId = randomUUID(),
            startsAt = await at("18:00");
          await admin`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,created_at,published_at)
        select ${groupId}::uuid,${coach.runId}::uuid,${coach.profileId}::uuid,${"group-" + groupId.replaceAll("-", "")},'Manual conflict fixture','Disposable reserved group','Boxing','All levels',l.id,jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),${startsAt}::timestamptz,${startsAt}::timestamptz+interval '1 hour',clock_timestamp()+interval '1 day',1,4,0,'open',clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute' from app.coach_training_locations l where l.id=${venue.id}::uuid`;
          await rejected(coach, payload(startsAt, ext));
          const closed = await command(coach, payload(await at("20:00"), ext));
          await run(
            coach,
            sql`select * from app.cancel_direct_private_booking(${closed.bookingId}::uuid)`,
          );
          await admin`update app.coach_availability_slots set closure_reason='manual',closed_policy_revision=null where id=(select slot_id from app.coach_private_bookings where id=${closed.bookingId}::uuid)`;
          await rejected(coach, payload(await at("20:00"), connected));
        },
      );
      await t.test(
        "cancellation in the same transaction cannot reuse creation authority to publish capacity",
        async () => {
          const p = payload(await at("21:00"), ext);
          await withActorDatabaseContext(coach, async (tx) => {
            const [r] = await tx.execute(
              sql`select app.coach_session_booking(${randomUUID()}::uuid,${JSON.stringify(p)}::jsonb) result`,
            );
            const b = r.result as { bookingId: string };
            await tx.execute(
              sql`select * from app.cancel_direct_private_booking(${b.bookingId}::uuid)`,
            );
          });
          await run(
            coach,
            sql`select * from app.cancel_direct_private_booking(${externalBooking.bookingId}::uuid)`,
          );
          const slots =
            await admin`select s.status from app.coach_availability_slots s join app.coach_private_bookings b on b.slot_id=s.id where b.coach_profile_id=${coach.profileId}::uuid and b.status='cancelled'`;
          assert.ok(slots.length >= 3);
          assert.ok(slots.every((s) => s.status === "withdrawn"));
          assert.deepEqual(await publicTimes(), []);
          assert.deepEqual(await hours(), dayOffHours);
        },
      );
      await t.test(
        "partial hours do not limit duration and a held interval still rejects creation",
        async () => {
          await withActorDatabaseContext(coach, (tx) =>
            saveOwnedEffectiveAvailabilityRecord(tx, {
              kind: "dates",
              operationId: randomUUID(),
              expectedRevision: 2,
              dates: [
                {
                  date: dates.next_value,
                  mode: "custom",
                  hours: ["08:00", "13:00"].map((localStartTime) => ({
                    localStartTime,
                    locationId: venue.id,
                    locationUpdatedAt: venue.stamp,
                  })),
                },
              ],
            }),
          );
          const startsAt = await at("08:00", dates.next_value);
          const held =
            await admin`update app.coach_availability_slots set status='held' where profile_id=${coach.profileId}::uuid and starts_at=${startsAt}::timestamptz and status='open' returning id`;
          assert.equal(held.length, 1);
          await rejected(coach, payload(startsAt, ext));
          const before = await hours();
          await command(
            coach,
            payload(await at("13:30", dates.next_value), ext, 90),
          );
          assert.deepEqual(await hours(), before);
        },
      );
      await t.test(
        "booking detail and owner projection preserve coach, participant and dataset boundaries",
        async () => {
          const detail = (actor: AuthorizedActor, id: string) =>
            withActorDatabaseContext(actor, (tx) =>
              sessionBookingDetailRecord(tx, id),
            );
          const externalDetail = await detail(coach, externalBooking.bookingId);
          assert.equal(externalDetail.viewerIsCoach, true);
          assert.equal(
            externalDetail.status,
            "cancelled",
            "Owner history remains readable",
          );
          assert.equal(externalDetail.externalClient?.id, external.client.id);
          for (const denied of [
            athlete,
            outsider,
            otherCoach,
            { ...coach, runId: randomUUID() },
            { ...coach, authUserId: athlete.authUserId },
          ])
            await assert.rejects(detail(denied, externalBooking.bookingId));
          const [connectedBooking] =
            await admin`select id from app.coach_private_bookings where coach_profile_id=${coach.profileId}::uuid and client_profile_id=${athlete.profileId}::uuid limit 1`;
          assert.ok(connectedBooking);
          const participant = await detail(athlete, connectedBooking.id);
          assert.equal(
            participant.viewerIsCoach,
            false,
            "Participant detail cannot authorize the coach page",
          );
          assert.equal(participant.externalClient, null);
          const owner = await withActorDatabaseContext(coach, (tx) =>
            currentActorProjection(tx, coach),
          );
          assert.ok(owner.profileSlug && owner.runSlug);
          assert.equal(owner.role, coach.runRole);
        },
      );
    } finally {
      await admin.end({ timeout: 2 });
    }
  },
);
