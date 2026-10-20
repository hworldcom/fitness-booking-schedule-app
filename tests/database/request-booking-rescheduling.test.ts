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
  /^\/dev0342_[a-f0-9]+_dev(?:0388|0396)_(fresh|upgrade)$/.test(
    selected.pathname,
  );
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
  "accepted requests preserve origin while their booking is rescheduled",
  { skip: !allowed },
  async (t) => {
    const admin = postgres(url!, {
      max: 4,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    const runtime = new URL(url!);
    runtime.username = "repx_runtime_login";
    runtime.password = "postgres";
    process.env.DATABASE_URL = runtime.toString();
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
                ...["09:00", "10:00", "11:00"].map((localStartTime) => ({
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
        await admin`select to_jsonb((${day}::date+time '09:00') at time zone 'Europe/Berlin')#>>'{}' starts`;
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
      const manifest = process.env.DEV0388_FIXTURE_MANIFEST;
      const fixture: Fixture =
        manifest && process.env.DEV0388_REUSE_FIXTURE === "1"
          ? JSON.parse(readFileSync(manifest, "utf8"))
          : await createFixture();
      assert.equal(fixture.database, selected!.pathname);
      const {
        coach,
        athlete,
        outsider,
        otherCoach,
        bookingId,
        requestId,
        type,
      } = fixture;
      const initial = await detail(coach, bookingId);
      const override = {
        action: "override",
        bookingId,
        expectedRevision: 0,
        typeId: type.id,
        typeRevision: type.revision,
        locationId: fixture.venueId,
        startsAt: initial.startsAt,
        durationMinutes: 75,
      };
      if (process.env.DEV0388_EXPECT_BROKEN === "1") {
        assert.ok(manifest);
        await assert.rejects(command(coach, override), (e) =>
          errorHasCode(e, "23503"),
        );
        assert.deepEqual(await detail(coach, bookingId), initial);
        writeFileSync(manifest, JSON.stringify(fixture), { mode: 0o600 });
        return;
      }
      await t.test(
        "accepted request can change from 60 to 75 minutes without rewriting its origin",
        async () => {
          const id = randomUUID();
          assert.deepEqual(await command(coach, override, id), {
            bookingId,
            revision: 1,
          });
          assert.deepEqual(await command(coach, override, id), {
            bookingId,
            revision: 1,
          });
          await assert.rejects(
            command(coach, { ...override, durationMinutes: 90 }, id),
          );
          await assert.rejects(command(coach, override));
          const current = await detail(athlete, bookingId);
          assert.equal(
            (Date.parse(current.endsAt) - Date.parse(current.startsAt)) / 60000,
            75,
          );
          assert.equal(current.historyTotal, 1);
          assert.equal(current.bookingId, bookingId);
          const [rows] =
            await admin`select to_jsonb(r) request,s.status original_slot_status from app.coach_booking_requests r join app.coach_availability_slots s on s.id=r.slot_id where r.id=${requestId}::uuid`;
          assert.deepEqual(rows.request, fixture.originalRequest);
          assert.equal(rows.original_slot_status, "withdrawn");
          const [history] =
            await admin`select previous_terms from app.session_booking_changes where booking_id=${bookingId}::uuid and revision=1`;
          assert.deepEqual(
            history.previous_terms.occurrence,
            fixture.originalSlot,
          );
          assert.equal(
            history.previous_terms.booking.slot_id,
            fixture.originalRequest.slot_id,
          );
          const [unchanged] =
            await admin`select duration_minutes from app.coach_session_types where id=${type.id}::uuid`;
          assert.equal(unchanged.duration_minutes, 60);
        },
      );
      await t.test(
        "a second move changes venue/time and preserves participant messages and title",
        async () => {
          const [instant] =
            await admin`select to_jsonb((${fixture.day}::date+time '14:00') at time zone 'Europe/Berlin')#>>'{}' starts`;
          await command(coach, {
            ...override,
            expectedRevision: 1,
            locationId: fixture.secondVenueId,
            startsAt: instant.starts,
            durationMinutes: 90,
          });
          const current = await detail(athlete, bookingId);
          assert.equal(current.revision, 2);
          assert.equal(current.locationId, fixture.secondVenueId);
          assert.equal(current.historyTotal, 2);
          const thread = await message(athlete, "thread", {
            conversationId: fixture.conversationId,
          });
          const contexts = thread.contexts as {
            id: string;
            bookingId: string;
            startsAt: string;
            endsAt: string;
            title: string;
          }[];
          const context = contexts.find((c) => c.id === fixture.contextId)!;
          assert.equal(context.bookingId, bookingId);
          assert.equal(context.startsAt, current.startsAt);
          assert.equal(context.endsAt, current.endsAt);
          assert.equal(context.title, "DEV0388 retained session title");
          assert.ok(
            JSON.stringify(thread.entries).includes(
              "DEV0388 retained training discussion",
            ),
          );
          await assert.rejects(detail(outsider, bookingId));
          await assert.rejects(
            command(otherCoach, { ...override, expectedRevision: 2 }),
          );
          await assert.rejects(
            command(athlete, { ...override, expectedRevision: 2 }),
          );
        },
      );
      await t.test(
        "origin and stable participant constraints reject forged links and accepted-history edits",
        async () => {
          await assert.rejects(
            admin`update app.coach_booking_requests set accepted_booking_id=null where id=${requestId}::uuid`,
            (e) => errorHasCode(e, "23514"),
          );
          await assert.rejects(
            admin`update app.coach_booking_requests set slot_id=(select slot_id from app.coach_private_bookings where id=${bookingId}::uuid) where id=${requestId}::uuid`,
            (e) => errorHasCode(e, "23514"),
          );
          await assert.rejects(
            admin`update app.coach_private_bookings set client_profile_id=${outsider.profileId}::uuid where id=${bookingId}::uuid`,
            (e) => errorHasCode(e, "23503"),
          );
          const req = (
            await run<{ result: { requestId: string } }>(
              athlete,
              sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: type.id, typeRevision: type.revision, locationId: fixture.venueId, startsAt: initial.startsAt })}::jsonb) result`,
            )
          )[0].result;
          await assert.rejects(
            admin`update app.coach_booking_requests set status='accepted',decided_by_profile_id=coach_profile_id,decided_at=clock_timestamp(),accepted_booking_id=${bookingId}::uuid where id=${req.requestId}::uuid`,
            (e) => errorHasCode(e, "23503"),
          );
          const [authority] =
            await admin`select has_function_privilege('app_runtime','app.guard_accepted_booking_request()','execute') exposed`;
          assert.equal(authority.exposed, false);
        },
      );
      await t.test(
        "overlap fails atomically, then cancellation restores bookable capacity at the current venue",
        async () => {
          const req = (
            await run<{ result: { requestId: string } }>(
              outsider,
              sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: type.id, typeRevision: type.revision, locationId: fixture.venueId, startsAt: initial.startsAt })}::jsonb) result`,
            )
          )[0].result;
          await run(
            coach,
            sql`select * from app.accept_coach_booking_request(${req.requestId}::uuid)`,
          );
          const before = await detail(athlete, bookingId);
          await assert.rejects(
            command(coach, { ...override, expectedRevision: 2 }),
          );
          assert.deepEqual(await detail(athlete, bookingId), before);
          const [currentSlot] =
            await admin`select slot_id from app.coach_private_bookings where id=${bookingId}::uuid`;
          await run(
            athlete,
            sql`select app.cancel_direct_private_booking(${bookingId}::uuid)`,
          );
          assert.equal((await detail(athlete, bookingId)).status, "cancelled");
          const [slot] =
            await admin`select status from app.coach_availability_slots where id=${currentSlot.slot_id}::uuid`;
          assert.notEqual(slot.status, "booked");
          // The individual 90-minute override does not change the offered
          // 60-minute template. Recovery must offer that template at the new
          // venue/time, whether it reuses inventory or creates a new candidate.
          const [coachRow] =
            await admin`select public_slug from app.coach_profiles where profile_id=${coach.profileId}::uuid`;
          const [available] =
            await admin`select app.public_session_type_times(${coachRow.public_slug},${type.id}::uuid,${fixture.secondVenueId}::uuid,${fixture.day}::date) times`;
          assert.ok(
            available.times.some(
              (value: { startsAt: string }) =>
                Date.parse(value.startsAt) === Date.parse(before.startsAt),
            ),
          );
          const recovered = (
            await run<{ result: { requestId: string } }>(
              athlete,
              sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: type.id, typeRevision: type.revision, locationId: fixture.secondVenueId, startsAt: before.startsAt })}::jsonb) result`,
            )
          )[0].result;
          assert.notEqual(recovered.requestId, requestId);
          const [original] =
            await admin`select to_jsonb(r) request from app.coach_booking_requests r where id=${requestId}::uuid`;
          assert.deepEqual(original.request, fixture.originalRequest);
          assert.equal((await detail(athlete, bookingId)).historyTotal, 2);
          await assert.rejects(
            command(coach, { ...override, expectedRevision: 2 }),
          );
        },
      );
    } finally {
      await admin.end();
    }
  },
);
