import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { sql, type SQL } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type {
  AvailabilityDate,
  EffectiveAvailabilityCommand,
} from "@/domain/effective-availability";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { publicCoachAvailabilityRecords } from "@/server/db/coaches/availability-repository";
import {
  ownedEffectiveAvailabilityRecord,
  saveOwnedEffectiveAvailabilityRecord,
} from "@/server/db/coaches/effective-availability-repository";
import { groupSessionCommandRecord } from "@/server/db/group-sessions/repository";

const url = process.env.DATABASE_TEST_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("Explicit loopback DATABASE_TEST_URL required.");
const runtime = new URL(url);
runtime.username = "repx_runtime_login";
runtime.password = "postgres";
process.env.DATABASE_URL = runtime.toString();

test("effective availability policy, history, retries and scheduling races", async (t) => {
  const db = postgres(url, {
    max: 10,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  const actors: AuthorizedActor[] = [];
  const run = <T extends Record<string, unknown> = Record<string, unknown>>(
    a: AuthorizedActor,
    query: SQL,
  ) => withActorDatabaseContext(a, (tx) => tx.execute<T>(query));
  async function actor(name: string, coach = false) {
    const authUserId = randomUUID();
    await db`insert into auth.users(id,is_sso_user,is_anonymous) values(${authUserId}::uuid,false,false)`;
    const [identity] =
      await db`select * from app.enroll_application_identity(${authUserId}::uuid,${name})`;
    const a: AuthorizedActor = {
      authUserId,
      profileId: identity.identity_profile_id,
      runId: identity.identity_run_id,
      runRole: "member",
    };
    actors.push(a);
    if (coach) {
      await run(a, sql`select app.submit_owned_coach_application()`);
      await run(
        a,
        sql`select app.upsert_owned_coach_profile(${name},'Effective availability fixture coach with a reviewed location.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
      );
      await db`select app.review_coach_application(${a.profileId}::uuid,'pending','approved','Isolated fixture approved.','database-test','movx-identity-application-v1')`;
      await db`update app.coach_profiles set visibility='visible' where profile_id=${a.profileId}::uuid`;
    }
    return a;
  }
  let coach: AuthorizedActor;
  try {
    coach = await actor("Effective calendar coach", true);
    const athlete = await actor("Effective calendar athlete");
    const other = await actor("Effective other coach", true);
    const [venue] =
      await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
    const locationId: string = venue.id;
    const hour = (time: string) => ({
      locationId,
      locationUpdatedAt: venue.stamp as string,
      localStartTime: time,
    });
    const [clock] =
      await db`select (clock_timestamp() at time zone 'Europe/Berlin')::date::text today,
      ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text target,
      ((clock_timestamp() at time zone 'Europe/Berlin')::date+40)::text later`;
    const target: string = clock.target;
    const read = () =>
      withActorDatabaseContext(coach, (tx) =>
        ownedEffectiveAvailabilityRecord(tx, target, target),
      );
    const save = (command: EffectiveAvailabilityCommand, a = coach) =>
      withActorDatabaseContext(a, (tx) =>
        saveOwnedEffectiveAvailabilityRecord(tx, command),
      );
    const replaceDate = async (date: AvailabilityDate) => {
      const p = await read();
      return save({
        operationId: randomUUID(),
        expectedRevision: p.revision,
        kind: "dates",
        dates: [date],
      });
    };
    const slots =
      () => db`select *, (starts_at at time zone 'Europe/Berlin')::date::text as local_date,to_char(starts_at at time zone 'Europe/Berlin','HH24:MI') as local_hour
      from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and (starts_at at time zone 'Europe/Berlin')::date=${target}::date order by starts_at,id`;
    const request = async (id: string) =>
      (
        await run<{ request_id: string }>(
          athlete,
          sql`select * from app.create_coach_booking_request(${id}::uuid)`,
        )
      )[0].request_id;

    await t.test(
      "30 Berlin dates, DST edges and public materialization without a coach read",
      async () => {
        const weekly = Array.from({ length: 7 }, (_, i) => ({
          ...hour("10:00"),
          isoWeekday: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        }));
        const command: EffectiveAvailabilityCommand = {
          kind: "weekly",
          operationId: randomUUID(),
          expectedRevision: 0,
          hours: weekly,
        };
        const saved = await save(command);
        assert.equal(saved.outcome, "saved");
        // Simulate dates entering inventory; no owner visit is required.
        await db`delete from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and starts_at>clock_timestamp()`;
        const visible = await publicCoachAvailabilityRecords(coach.profileId);
        assert.ok(visible.length >= 29 && visible.length <= 30);
        const [bounds] =
          await db`select min((starts_at at time zone 'Europe/Berlin')::date)::text first,max((starts_at at time zone 'Europe/Berlin')::date)::text last,
        ((clock_timestamp() at time zone 'Europe/Berlin')::date+29)::text expected from app.coach_availability_slots where profile_id=${coach.profileId}::uuid`;
        assert.equal(bounds.last, bounds.expected);
        const [edge] = await db`select
        app.availability_in_horizon('2026-11-23 22:00+01','2026-11-23 23:00+01','2026-10-25 00:00+02') allowed_29,
        app.availability_in_horizon('2026-11-24 00:00+01','2026-11-24 01:00+01','2026-10-25 00:00+02') denied_30,
        app.availability_in_horizon('2026-04-26 22:00+02','2026-04-26 23:00+02','2026-03-28 00:00+01') spring_29,
        app.availability_in_horizon('2026-04-27 00:00+02','2026-04-27 01:00+02','2026-03-28 00:00+01') spring_30`;
        assert.deepEqual(
          { ...edge },
          {
            allowed_29: true,
            denied_30: false,
            spring_29: true,
            spring_30: false,
          },
        );
        assert.deepEqual(await save(command), saved);
        assert.equal(
          (await save({ ...command, hours: [] })).outcome,
          "conflict",
        );
        assert.equal(
          (await save({ ...command, operationId: randomUUID() })).outcome,
          "conflict",
        );
      },
    );

    await t.test(
      "atomic batches, ownership, raw-write denial and invalid DST dates",
      async () => {
        const before = await read();
        const base = {
          kind: "dates" as const,
          operationId: randomUUID(),
          expectedRevision: before.revision,
        };
        await assert.rejects(
          save({
            ...base,
            dates: [
              { date: target, mode: "unavailable", hours: [] },
              { date: clock.today, mode: "custom", hours: [hour("25:00")] },
            ],
          }),
        );
        assert.deepEqual(await read(), before);
        await assert.rejects(
          save({
            ...base,
            dates: [
              {
                date: target,
                mode: "custom",
                hours: [hour("10:00"), hour("10:00")],
              },
            ],
          }),
        );
        await assert.rejects(
          save({
            ...base,
            dates: [{ date: target, mode: "custom", hours: [] }],
          }),
        );
        await assert.rejects(
          save({
            ...base,
            dates: [
              { date: "2099-03-29", mode: "custom", hours: [hour("02:00")] },
            ],
          }),
        );
        await assert.rejects(
          save(
            {
              ...base,
              expectedRevision: 0,
              dates: [{ date: target, mode: "custom", hours: [hour("11:00")] }],
            },
            other,
          ),
        );
        await assert.rejects(
          save(
            {
              ...base,
              dates: [{ date: target, mode: "unavailable", hours: [] }],
            },
            athlete,
          ),
        );
        await assert.rejects(
          run(coach, sql`select * from app.coach_availability_date_overrides`),
        );
        await assert.rejects(run(coach, sql`select app.availability_enter()`));
        const [otherVenue] =
          await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${other.profileId}::uuid and is_primary`;
        const otherPolicy = await withActorDatabaseContext(
          other,
          async (tx) => {
            await tx.execute(
              sql`select set_config('app.availability_batch','on',true)`,
            );
            await tx.execute(
              sql`select app.create_owned_coach_availability_rule(${otherVenue.id}::uuid,${otherVenue.stamp}::timestamptz,1::smallint,'20:00'::time)`,
            );
            return ownedEffectiveAvailabilityRecord(tx, target, target);
          },
        );
        assert.equal(
          otherPolicy.revision,
          1,
          "caller-set flags cannot suppress revision tracking",
        );
        const future = await replaceDate({
          date: clock.later,
          mode: "custom",
          hours: [hour("12:00")],
        });
        assert.equal(future.outcome, "saved");
        const [count] =
          await db`select count(*)::integer n from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and (starts_at at time zone 'Europe/Berlin')::date=${clock.later}::date`;
        assert.equal(count.n, 0);
      },
    );

    await t.test(
      "day off closes requests/cards; explicit restoration creates fresh IDs and retries once",
      async () => {
        const original = (await slots()).find(
          (s) => s.status === "open" && s.local_hour === "10:00",
        );
        assert.ok(original);
        const requestId = await request(original.id);
        const p = await read();
        const off: EffectiveAvailabilityCommand = {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: p.revision,
          dates: [{ date: target, mode: "unavailable", hours: [] }],
        };
        const result = await save(off);
        assert.equal(result.outcome, "saved");
        if (result.outcome === "saved")
          assert.equal(result.closedRequestCount, 1);
        const [closed] =
          await db`select status from app.coach_booking_requests where id=${requestId}::uuid`;
        assert.equal(closed.status, "occurrence-closed");
        const [card] =
          await db`select count(*)::integer n from app.message_entries where event_key=${"request:" + requestId + ":occurrence-closed"}`;
        assert.equal(card.n, 1);
        assert.deepEqual(await save(off), result);
        await publicCoachAvailabilityRecords(coach.profileId);
        assert.equal(
          (await slots()).filter((s) => s.status === "open").length,
          0,
        );
        assert.equal(
          (await replaceDate({ date: target, mode: "weekly", hours: [] }))
            .outcome,
          "saved",
        );
        const successor = (await slots()).find(
          (s) => s.status === "open" && s.local_hour === "10:00",
        );
        assert.ok(successor);
        assert.notEqual(successor.id, original.id);
        const publicCurrent = (
          await publicCoachAvailabilityRecords(coach.profileId)
        ).filter(
          (s) => s.startsAt === new Date(successor.starts_at).toISOString(),
        );
        assert.deepEqual(
          publicCurrent.map((s) => s.id),
          [successor.id],
        );
        await assert.rejects(request(original.id));
        const newRequest = await request(successor.id);
        assert.notEqual(newRequest, requestId);
        const accepted = await run<{ booking_id: string }>(
          coach,
          sql`select * from app.accept_coach_booking_request(${newRequest}::uuid)`,
        );
        const bookingId = accepted[0].booking_id;
        const warning = await replaceDate({
          date: target,
          mode: "unavailable",
          hours: [],
        });
        assert.equal(warning.outcome, "saved");
        if (warning.outcome === "saved")
          assert.ok(
            warning.retainedSessions.some(
              (s) => s.id === bookingId && s.kind === "private",
            ),
          );
        const [booking] =
          await db`select status from app.coach_private_bookings where id=${bookingId}::uuid`;
        assert.equal(booking.status, "confirmed");
        await run(
          athlete,
          sql`select app.cancel_direct_private_booking(${bookingId}::uuid)`,
        );
        assert.equal(
          (await slots()).filter((s) => s.status === "open").length,
          0,
        );
        await replaceDate({ date: target, mode: "weekly", hours: [] });
        const manual = (await slots()).find((s) => s.status === "open");
        assert.ok(manual);
        await run(
          coach,
          sql`select app.close_coach_booking_request_occurrence(${manual.id}::uuid)`,
        );
        // Historical individual-slot entry points cannot bypass a manual
        // closure by inserting a second identity at its original time.
        await assert.rejects(
          run(
            coach,
            sql`select app.create_owned_coach_availability((${target}::date + time '10:00'),60)`,
          ),
        );
        await replaceDate({
          date: target,
          mode: "custom",
          hours: [hour("10:00"), hour("11:00")],
        });
        assert.equal(
          (await slots()).filter(
            (s) => s.status === "open" && s.local_hour === "10:00",
          ).length,
          0,
        );
        assert.equal(
          (await slots()).filter(
            (s) => s.status === "open" && s.local_hour === "11:00",
          ).length,
          1,
        );
      },
    );

    await t.test(
      "venue replacement retains booked snapshots; preview rolls back; cancellation creates current-venue capacity",
      async () => {
        const [day] = await db`select (${target}::date+1)::text value`;
        const replacementDate: string = day.value;
        const [original] =
          await db`select id from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and (starts_at at time zone 'Europe/Berlin')::date=${replacementDate}::date and status='open'`;
        const requestId = await request(original.id);
        const [accepted] = await run<{ booking_id: string }>(
          coach,
          sql`select * from app.accept_coach_booking_request(${requestId}::uuid)`,
        );
        const [created] = await run<{ id: string }>(
          coach,
          sql`select app.create_owned_coach_training_location('Calendar second venue',null,'Berlin second venue',52.5,13.4,'manual',null) id`,
        );
        const [replacement] =
          await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where id=${created.id}::uuid`;
        const replacementHour = (time: string) => ({
          ...hour(time),
          locationId: replacement.id as string,
          locationUpdatedAt: replacement.stamp as string,
        });
        const p = await read();
        const command: EffectiveAvailabilityCommand = {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: p.revision,
          dates: [
            {
              date: replacementDate,
              mode: "custom",
              hours: ["09:00", "10:00", "11:00"].map(replacementHour),
            },
          ],
        };
        const preview = await withActorDatabaseContext(coach, (tx) =>
          saveOwnedEffectiveAvailabilityRecord(tx, command, true),
        );
        assert.equal(preview.outcome, "saved");
        assert.equal((await read()).revision, p.revision);
        const [receipt] =
          await db`select count(*)::integer n from app.coach_availability_operations where operation_id=${command.operationId}::uuid`;
        assert.equal(receipt.n, 0);
        const saved = await save(command);
        assert.deepEqual(saved, preview);
        if (saved.outcome === "saved")
          assert.ok(
            saved.retainedSessions.some((s) => s.id === accepted.booking_id),
          );
        const beforeCancel =
          await db`select id,status,coach_training_location_id from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and (starts_at at time zone 'Europe/Berlin')::date=${replacementDate}::date and status<>'withdrawn' order by starts_at`;
        assert.deepEqual(
          beforeCancel.map((s) => [s.status, s.coach_training_location_id]),
          [
            ["open", replacement.id],
            ["booked", locationId],
            ["open", replacement.id],
          ],
        );
        await run(
          athlete,
          sql`select app.cancel_direct_private_booking(${accepted.booking_id}::uuid)`,
        );
        const afterCancel =
          await db`select id,coach_training_location_id from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and (starts_at at time zone 'Europe/Berlin')::date=${replacementDate}::date and status='open'`;
        assert.equal(afterCancel.length, 3);
        assert.ok(
          afterCancel.every(
            (s) =>
              s.coach_training_location_id === replacement.id &&
              s.id !== original.id,
          ),
        );
        const pending = await request(afterCancel[0].id);
        await run(
          coach,
          sql`select app.deactivate_owned_coach_training_location(${replacement.id}::uuid,${replacement.stamp}::timestamptz,null,null)`,
        );
        const [closed] =
          await db`select status from app.coach_booking_requests where id=${pending}::uuid`;
        assert.equal(closed.status, "occurrence-closed");
        const [remaining] =
          await db`select count(*)::integer n from app.coach_availability_slots where coach_training_location_id=${replacement.id}::uuid and status='open'`;
        assert.equal(remaining.n, 0);
      },
    );

    await t.test(
      "group reservations survive override saves and release only uncreated capacity",
      async () => {
        const id = randomUUID();
        const [time] =
          await db`select (${target}::date+time '16:00') at time zone 'Europe/Berlin' starts`;
        const starts = new Date(time.starts);
        const ends = new Date(starts.getTime() + 3600000);
        await withActorDatabaseContext(coach, (tx) =>
          groupSessionCommandRecord(tx, {
            action: "save-draft",
            args: {
              id,
              expectedRevision: null,
              title: "Retained group",
              description: "Isolated effective calendar group fixture.",
              discipline: "Boxing",
              intendedLevel: "All levels",
              locationId,
              startsAt: starts.toISOString(),
              endsAt: ends.toISOString(),
              decisionDeadlineAt: new Date(
                starts.getTime() - 3600000,
              ).toISOString(),
              minimumParticipants: 1,
              maximumParticipants: 5,
              priceCents: 0,
            },
          }),
        );
        await withActorDatabaseContext(coach, (tx) =>
          groupSessionCommandRecord(tx, {
            action: "publish",
            args: { id, expectedRevision: 1 },
          }),
        );
        const result = await replaceDate({
          date: target,
          mode: "custom",
          hours: [hour("16:00")],
        });
        assert.equal(result.outcome, "saved");
        if (result.outcome === "saved")
          assert.ok(
            result.retainedSessions.some(
              (s) => s.id === id && s.kind === "group",
            ),
          );
        assert.equal(
          (await slots()).filter(
            (s) => s.status === "open" && s.local_hour === "16:00",
          ).length,
          0,
        );
        await withActorDatabaseContext(coach, (tx) =>
          groupSessionCommandRecord(tx, { action: "cancel", args: { id } }),
        );
        await publicCoachAvailabilityRecords(coach.profileId);
        assert.equal(
          (await slots()).filter(
            (s) => s.status === "open" && s.local_hour === "16:00",
          ).length,
          1,
        );
      },
    );

    await t.test(
      "concurrent complete drafts cannot both consume one revision",
      async () => {
        const p = await read();
        const commands = ["17:00", "18:00"].map((time) => ({
          kind: "dates" as const,
          operationId: randomUUID(),
          expectedRevision: p.revision,
          dates: [
            { date: target, mode: "custom" as const, hours: [hour(time)] },
          ],
        }));
        const results = await Promise.all(commands.map((c) => save(c)));
        assert.equal(results.filter((r) => r.outcome === "saved").length, 1);
        assert.equal(results.filter((r) => r.outcome === "conflict").length, 1);
        assert.equal((await read()).revision, p.revision + 1);
        assert.equal(
          (await slots()).filter((s) => s.status === "open").length,
          1,
        );
      },
    );

    await t.test(
      "acceptance racing a day off retains a winner or closes the original request atomically",
      async () => {
        const [day] = await db`select (${target}::date+2)::text value`;
        const [original] =
          await db`select id from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and (starts_at at time zone 'Europe/Berlin')::date=${day.value}::date and status='open'`;
        const requestId = await request(original.id);
        const p = await read();
        const off: EffectiveAvailabilityCommand = {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: p.revision,
          dates: [
            { date: day.value as string, mode: "unavailable", hours: [] },
          ],
        };
        const results = await Promise.allSettled([
          save(off),
          run(
            coach,
            sql`select * from app.accept_coach_booking_request(${requestId}::uuid)`,
          ),
        ]);
        assert.equal(results[0].status, "fulfilled");
        const [state] =
          await db`select r.status, b.status booking_status,s.status slot_status from app.coach_booking_requests r left join app.coach_private_bookings b on b.id=r.accepted_booking_id join app.coach_availability_slots s on s.id=r.slot_id where r.id=${requestId}::uuid`;
        assert.ok(
          state.status === "accepted" || state.status === "occurrence-closed",
        );
        if (state.status === "accepted") {
          assert.equal(state.booking_status, "confirmed");
          assert.equal(state.slot_status, "booked");
          const [b] =
            await db`select accepted_booking_id id from app.coach_booking_requests where id=${requestId}::uuid`;
          await run(
            athlete,
            sql`select app.cancel_direct_private_booking(${b.id}::uuid)`,
          );
        } else assert.equal(state.slot_status, "withdrawn");
        const [open] =
          await db`select count(*)::integer n from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and (starts_at at time zone 'Europe/Berlin')::date=${day.value}::date and status='open'`;
        assert.equal(open.n, 0);
      },
    );

    await t.test(
      "31 future dates commit together; removing an override uses the current week",
      async () => {
        const days =
          await db`select (${clock.later}::date+n)::text value from generate_series(0,30) n`;
        const dates = days.map((d) => ({
          date: d.value as string,
          mode: "unavailable" as const,
          hours: [],
        }));
        const p = await read();
        await assert.rejects(
          save({
            kind: "dates",
            operationId: randomUUID(),
            expectedRevision: p.revision,
            dates: [...dates, { date: target, mode: "unavailable", hours: [] }],
          }),
        );
        assert.equal((await read()).revision, p.revision);
        assert.equal(
          (
            await save({
              kind: "dates",
              operationId: randomUUID(),
              expectedRevision: p.revision,
              dates,
            })
          ).outcome,
          "saved",
        );
        const future = await withActorDatabaseContext(coach, (tx) =>
          ownedEffectiveAvailabilityRecord(tx, dates[0].date, dates[30].date),
        );
        assert.equal(future.dates.length, 31);
        const before = await read();
        const weekly = Array.from({ length: 7 }, (_, i) => ({
          ...hour("12:00"),
          isoWeekday: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        }));
        assert.equal(
          (
            await save({
              kind: "weekly",
              operationId: randomUUID(),
              expectedRevision: before.revision,
              hours: weekly,
            })
          ).outcome,
          "saved",
        );
        await replaceDate({ date: target, mode: "weekly", hours: [] });
        const current = (await slots()).filter((s) => s.status === "open");
        assert.deepEqual(
          current.map((s) => s.local_hour),
          ["12:00"],
        );
      },
    );
  } finally {
    const ids = actors.map((a) => a.profileId);
    try {
      if (ids.length) {
        await db`delete from app.message_conversations where coach_profile_id in ${db(ids)} or athlete_profile_id in ${db(ids)}`;
        await db`delete from app.coach_group_sessions where coach_profile_id in ${db(ids)}`;
        await db`delete from app.coach_booking_requests where coach_profile_id in ${db(ids)}`;
        await db`delete from app.coach_private_bookings where coach_profile_id in ${db(ids)}`;
        await db`delete from app.coach_availability_slots where profile_id in ${db(ids)}`;
        await db`delete from app.coach_availability_rules where profile_id in ${db(ids)}`;
        await db`update app.coach_profiles set visibility='hidden' where profile_id in ${db(ids)}`;
        await db`delete from app.coach_training_locations where profile_id in ${db(ids)}`;
        await db`delete from app.coach_profile_disciplines where profile_id in ${db(ids)}`;
        await db`delete from app.coach_profiles where profile_id in ${db(ids)}`;
        await db`delete from app.coach_application_review_events where profile_id in ${db(ids)}`;
        await db`delete from app.coach_applications where profile_id in ${db(ids)}`;
        await db`delete from app.demo_run_participants where profile_id in ${db(ids)}`;
        await db`delete from app.profiles where id in ${db(ids)}`;
        await db`delete from auth.users where id in ${db(actors.map((a) => a.authUserId))}`;
      }
    } finally {
      await db.end();
    }
  }
});
