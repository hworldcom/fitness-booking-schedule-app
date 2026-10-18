import {
  sendConnectionRecord,
  decideConnectionRecord,
} from "@/server/db/connections/repository";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { sql, type SQL } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import {
  ownedSessionTypes,
  mutateSessionType,
} from "@/server/db/coaches/session-type-repository";
import { saveOwnedEffectiveAvailabilityRecord } from "@/server/db/coaches/effective-availability-repository";
const url = process.env.DATABASE_TEST_URL;
test(
  "typed private booking full fit, snapshots, archival and overlapping acceptance",
  { skip: !url || !new URL(url).pathname.startsWith("/dev0342_") },
  async (t) => {
    const admin = postgres(url!, {
      max: 6,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    const runtime = new URL(url!);
    runtime.username = "repx_runtime_login";
    runtime.password = "postgres";
    process.env.DATABASE_URL = runtime.toString();
    const run = <T extends Record<string, unknown> = Record<string, unknown>>(
      a: AuthorizedActor,
      q: SQL,
    ) => withActorDatabaseContext(a, (tx) => tx.execute<T>(q));
    async function actor(name: string, coach = false) {
      const authUserId = randomUUID();
      await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${authUserId}::uuid,false,false)`;
      const [p] =
        await admin`select * from app.enroll_application_identity(${authUserId}::uuid,${name})`;
      const a: AuthorizedActor = {
        authUserId,
        profileId: p.identity_profile_id,
        runId: p.identity_run_id,
        runRole: "member",
      };
      if (coach) {
        await run(a, sql`select app.submit_owned_coach_application()`);
        await run(
          a,
          sql`select app.upsert_owned_coach_profile(${name},'Typed booking test coach for deliberate practice and feedback.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
        );
        await admin`select app.review_coach_application(${a.profileId}::uuid,'pending','approved','Isolated type test approval.','database-test','movx-identity-application-v1')`;
        await admin`update app.coach_profiles set visibility='visible' where profile_id=${a.profileId}::uuid`;
      }
      return a;
    }
    try {
      const coach = await actor("Typed booking coach", true),
        athlete = await actor("Typed athlete"),
        second = await actor("Second typed athlete");
      const [c] =
        await admin`select public_slug from app.coach_profiles where profile_id=${coach.profileId}::uuid`;
      const [venue] =
        await admin`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
      const [clock] =
        await admin`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text target`;
      const target = clock.target;
      const hours = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"].map(
        (localStartTime) => ({
          localStartTime,
          locationId: venue.id,
          locationUpdatedAt: venue.stamp,
        }),
      );
      await withActorDatabaseContext(coach, (tx) =>
        saveOwnedEffectiveAvailabilityRecord(tx, {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 0,
          dates: [{ date: target, mode: "custom", hours }],
        }),
      );
      const original = (
        await withActorDatabaseContext(coach, (tx) =>
          ownedSessionTypes(tx, coach),
        )
      ).find((x) => x.format === "private")!;
      const [type] = await withActorDatabaseContext(coach, (tx) =>
        mutateSessionType(tx, {
          commandId: randomUUID(),
          action: "save",
          id: original.id,
          expectedRevision: 0,
          format: "private",
          name: "Private class 75 min",
          description: "Reviewed coaching description",
          color: "#123456",
          durationMinutes: 75,
          defaultLocationId: venue.id,
          bookable: true,
        }),
      );
      const times = async () => {
        const [r] =
          await admin`select app.public_session_type_times(${c.public_slug},${type.id}::uuid,${venue.id}::uuid,${target}::date) as times`;
        return r.times as { startsAt: string; endsAt: string }[];
      };
      const candidates = await times();
      assert.equal(candidates.length, 16);
      assert.ok(
        candidates.every(
          (x) => Date.parse(x.endsAt) - Date.parse(x.startsAt) === 75 * 60000,
        ),
      );
      assert.ok(candidates.every((x) => Date.parse(x.startsAt) % 900000 === 0));
      await assert.rejects(
        admin`select app.public_session_type_times(${c.public_slug},${type.id}::uuid,${venue.id}::uuid,(${target}::date+30))`,
        /invalid date/,
      );
      const [dst] = await admin`select
        app.coach_local_time_is_unambiguous('2026-10-25 02:30'::timestamp,'Europe/Berlin') repeated,
        app.coach_local_time_is_unambiguous('2027-03-28 02:30'::timestamp,'Europe/Berlin') missing,
        app.coach_local_time_is_unambiguous('2026-10-25 04:00'::timestamp,'Europe/Berlin') normal`;
      assert.deepEqual(dst, { repeated: false, missing: false, normal: true });
      const [slot1, slot2] = candidates;
      const command = {
        typeId: type.id,
        typeRevision: type.revision,
        locationId: venue.id,
        startsAt: slot1.startsAt,
      };
      const op = randomUUID();
      const request = async (
        a: AuthorizedActor,
        input = command,
        id = randomUUID(),
      ) =>
        (
          await run<{ r: { requestId: string } }>(
            a,
            sql`select app.request_session_type(${id}::uuid,${JSON.stringify(input)}::jsonb) r`,
          )
        )[0].r;
      const first = await request(athlete, command, op);
      assert.equal(
        (await request(athlete, command, op)).requestId,
        first.requestId,
      );
      const other = await request(second, {
        ...command,
        startsAt: slot2.startsAt,
      });
      assert.equal(
        (await times()).length,
        16,
        "Pending requests do not hold time",
      );
      await assert.rejects(request(athlete, { ...command, typeRevision: 0 }));
      await assert.rejects(
        request(athlete, {
          ...command,
          startsAt: slot1.startsAt.replace(/T\d\d:/, "T23:"),
        }),
      );
      await t.test(
        "overlapping concurrent acceptances have one winner",
        async () => {
          const results = await Promise.allSettled(
            [first, other].map((r) =>
              run(
                coach,
                sql`select * from app.accept_coach_booking_request(${r.requestId}::uuid)`,
              ),
            ),
          );
          assert.equal(
            results.filter(
              (r) =>
                r.status === "fulfilled" &&
                r.value[0]?.request_status === "accepted",
            ).length,
            1,
          );
          const [count] =
            await admin`select count(*)::int count from app.coach_private_bookings where coach_profile_id=${coach.profileId}::uuid and status='confirmed'`;
          assert.equal(count.count, 1);
        },
      );
      const [booking] =
        await admin`select b.id,s.session_type_snapshot from app.coach_private_bookings b join app.coach_availability_slots s on s.id=b.slot_id where b.coach_profile_id=${coach.profileId}::uuid and b.status='confirmed'`;
      assert.equal(booking.session_type_snapshot.name, "Private class 75 min");
      await t.test(
        "coach booking and one-booking override retain identity and template",
        async () => {
          const create = {
            action: "create",
            typeId: type.id,
            typeRevision: type.revision,
            locationId: venue.id,
            startsAt: candidates[8].startsAt,
            durationMinutes: 60,
            athleteId: athlete.profileId,
          };
          const manual = async (payload: unknown, operation = randomUUID()) =>
            (
              await run<{ r: { bookingId: string; revision: number } }>(
                coach,
                sql`select app.coach_session_booking(${operation}::uuid,${JSON.stringify(payload)}::jsonb) r`,
              )
            )[0].r;
          // Connect the actual winner's athlete, since concurrent acceptance may choose either request.
          const [winner] =
            await admin`select client_profile_id from app.coach_private_bookings where id=${booking.id}::uuid`;
          const connected =
            winner.client_profile_id === athlete.profileId ? athlete : second;
          await assert.rejects(
            manual({ ...create, athleteId: connected.profileId }),
          );
          const sent = await withActorDatabaseContext(coach, (tx) =>
            sendConnectionRecord(tx, booking.id, randomUUID(), null),
          );
          await withActorDatabaseContext(connected, (tx) =>
            decideConnectionRecord(tx, sent.id, "accept"),
          );
          const operation = randomUUID();
          const saved = await manual(
            { ...create, athleteId: connected.profileId },
            operation,
          );
          assert.deepEqual(
            await manual(
              { ...create, athleteId: connected.profileId },
              operation,
            ),
            saved,
          );
          const changed = {
            action: "override",
            bookingId: saved.bookingId,
            expectedRevision: 0,
            typeId: type.id,
            typeRevision: type.revision,
            locationId: venue.id,
            startsAt: candidates[9].startsAt,
            durationMinutes: 90,
          };
          const overrideOp = randomUUID();
          const overridden = await manual(changed, overrideOp);
          assert.equal(overridden.bookingId, saved.bookingId);
          assert.equal(overridden.revision, 1);
          assert.deepEqual(await manual(changed, overrideOp), overridden);
          await assert.rejects(manual(changed));
          const [detail] = await run<{
            d: {
              changes: unknown[];
              bookingId: string;
              sessionType: { durationMinutes: number };
            };
          }>(
            coach,
            sql`select app.session_booking_detail(${saved.bookingId}::uuid) d`,
          );
          assert.equal(detail.d.bookingId, saved.bookingId);
          assert.equal(detail.d.changes.length, 1);
          assert.equal(detail.d.sessionType.durationMinutes, 90);
          const [unchanged] =
            await admin`select duration_minutes from app.coach_session_types where id=${type.id}::uuid`;
          assert.equal(unchanged.duration_minutes, 75);
          // Seed retained change rows on this disposable booking to prove paging,
          // rather than sending 24 meaningless reschedule commands.
          await admin`insert into app.session_booking_changes(booking_id,revision,actor_profile_id,previous_terms,new_terms,changed_at)
          select c.booking_id,n,c.actor_profile_id,c.previous_terms,c.new_terms,c.changed_at+make_interval(secs=>n)
          from app.session_booking_changes c cross join generate_series(2,25) n where c.booking_id=${saved.bookingId}::uuid and c.revision=1`;
          await admin`update app.coach_private_bookings set schedule_revision=25 where id=${saved.bookingId}::uuid`;
          const [firstPage] = await run<{
            d: import("@/domain/typed-sessions").SessionBookingDetail;
          }>(
            coach,
            sql`select app.session_booking_detail(${saved.bookingId}::uuid) d`,
          );
          assert.equal(firstPage.d.historyTotal, 25);
          assert.equal(firstPage.d.changes.length, 20);
          assert.equal(firstPage.d.nextHistoryRevision, 6);
          const [lastPage] = await run<{
            d: import("@/domain/typed-sessions").SessionBookingDetail;
          }>(
            coach,
            sql`select app.session_booking_detail(${saved.bookingId}::uuid,${firstPage.d.nextHistoryRevision}::integer) d`,
          );
          assert.equal(lastPage.d.changes.length, 5);
          assert.equal(lastPage.d.nextHistoryRevision, null);
          assert.equal(
            new Set(
              [...firstPage.d.changes, ...lastPage.d.changes].map(
                (c) => c.revision,
              ),
            ).size,
            25,
          );
          const unrelated = connected === athlete ? second : athlete;
          await assert.rejects(
            run(
              unrelated,
              sql`select app.session_booking_detail(${saved.bookingId}::uuid)`,
            ),
          );

          await run(
            coach,
            sql`select app.cancel_direct_private_booking(${saved.bookingId}::uuid)`,
          );
        },
      );

      await withActorDatabaseContext(coach, (tx) =>
        mutateSessionType(tx, {
          commandId: randomUUID(),
          action: "archive",
          id: type.id,
          expectedRevision: 1,
        }),
      );
      assert.equal((await times()).length, 0);
      await assert.rejects(request(athlete));
      const [detail] = await run(
        coach,
        sql`select app.session_booking_detail(${booking.id}::uuid) detail`,
      );
      assert.equal(
        (detail.detail as { sessionType: { name: string } }).sessionType.name,
        "Private class 75 min",
      );
      await run(
        coach,
        sql`select app.cancel_direct_private_booking(${booking.id}::uuid)`,
      );
      const [status] =
        await admin`select status from app.coach_private_bookings where id=${booking.id}::uuid`;
      assert.equal(status.status, "cancelled");
      const restored = (
        await withActorDatabaseContext(coach, (tx) =>
          mutateSessionType(tx, {
            commandId: randomUUID(),
            action: "restore",
            id: type.id,
            expectedRevision: 2,
          }),
        )
      )[0];
      const available = await times();
      assert.ok(available.length);
      const pending = await request(athlete, {
        ...command,
        typeRevision: restored.revision,
        startsAt: available.at(-1)!.startsAt,
      });
      const policy = (
        await admin`select revision from app.coach_availability_policies where profile_id=${coach.profileId}::uuid`
      )[0];
      const closed = await withActorDatabaseContext(coach, (tx) =>
        saveOwnedEffectiveAvailabilityRecord(tx, {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: policy.revision,
          dates: [{ date: target, mode: "unavailable", hours: [] }],
        }),
      );
      assert.equal(closed.outcome, "saved");
      if (closed.outcome === "saved")
        assert.equal(closed.closedRequestCount, 1);
      const [terminal] =
        await admin`select status from app.coach_booking_requests where id=${pending.requestId}::uuid`;
      assert.equal(terminal.status, "occurrence-closed");
    } finally {
      await admin.end();
    }
  },
);
