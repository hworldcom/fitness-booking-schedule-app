import { saveOwnedEffectiveAvailabilityRecord } from "@/server/db/coaches/effective-availability-repository";
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
import {
  groupSessionCommandRecord,
  publicGroupSessionRecord,
} from "@/server/db/group-sessions/repository";
import { ownedCoachCalendarRecord } from "@/server/db/coaches/calendar-repository";
const url = process.env.DATABASE_TEST_URL;
test(
  "group type snapshots, retained enrollment and calendar filtering",
  { skip: !url || !new URL(url).pathname.startsWith("/dev0342_") },
  async () => {
    const db = postgres(url!, {
      max: 2,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    const runtime = new URL(url!);
    runtime.username = "repx_runtime_login";
    runtime.password = "postgres";
    process.env.DATABASE_URL = runtime.toString();
    const run = (actor: AuthorizedActor, q: SQL) =>
      withActorDatabaseContext(actor, (tx) => tx.execute(q));
    async function person(name: string, coach = false) {
      const id = randomUUID();
      await db`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
      const [p] =
        await db`select * from app.enroll_application_identity(${id}::uuid,${name})`;
      const a: AuthorizedActor = {
        authUserId: id,
        profileId: p.identity_profile_id,
        runId: p.identity_run_id,
        runRole: "member",
      };
      if (coach) {
        await run(a, sql`select app.submit_owned_coach_application()`);
        await run(
          a,
          sql`select app.upsert_owned_coach_profile(${name},'Group type fixture with reviewed private training location.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
        );
        await db`select app.review_coach_application(${a.profileId}::uuid,'pending','approved','Isolated group type test.','database-test','movx-identity-application-v1')`;
        await db`update app.coach_profiles set visibility='visible' where profile_id=${a.profileId}::uuid`;
      }
      return a;
    }
    try {
      const coach = await person("Group type coach", true),
        athlete = await person("Group type athlete"),
        other = await person("Other group type athlete");
      const type = (
        await withActorDatabaseContext(coach, (tx) =>
          ownedSessionTypes(tx, coach),
        )
      ).find((t) => t.format === "group")!;
      const [venue] =
        await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
      const [clock] =
        await db`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+4)::text as target_date,(((clock_timestamp() at time zone 'Europe/Berlin')::date+4)+time '18:00') at time zone 'Europe/Berlin' starts,(((clock_timestamp() at time zone 'Europe/Berlin')::date+4)+time '19:00') at time zone 'Europe/Berlin' ends,clock_timestamp()+interval '1 day' deadline`;
      const id = randomUUID();
      const args = {
        id,
        expectedRevision: null,
        title: "Outdoor pads class",
        description: "A reviewed group class with individual feedback.",
        discipline: "Boxing" as const,
        intendedLevel: "All levels",
        locationId: venue.id,
        startsAt: clock.starts.toISOString(),
        endsAt: clock.ends.toISOString(),
        decisionDeadlineAt: clock.deadline.toISOString(),
        minimumParticipants: 1,
        maximumParticipants: 3,
        priceCents: 0,
        sessionTypeId: type.id,
        sessionTypeRevision: type.revision,
      };
      const saved = await withActorDatabaseContext(coach, (tx) =>
        groupSessionCommandRecord(tx, { action: "save-draft", args }),
      );
      assert.ok(saved.session);
      const savedSession = saved.session;
      assert.equal(saved.session.sessionType?.id, type.id);
      const retry = await withActorDatabaseContext(coach, (tx) =>
        groupSessionCommandRecord(tx, { action: "save-draft", args }),
      );
      assert.ok(retry.session);
      assert.equal(retry.session.revision, saved.session.revision);
      const privateType = (
        await withActorDatabaseContext(coach, (tx) =>
          ownedSessionTypes(tx, coach),
        )
      ).find((t) => t.format === "private")!;
      await withActorDatabaseContext(coach, (tx) =>
        saveOwnedEffectiveAvailabilityRecord(tx, {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 0,
          dates: [
            {
              date: clock.target_date,
              mode: "custom",
              hours: ["18:00", "19:00"].map((localStartTime) => ({
                localStartTime,
                locationId: venue.id,
                locationUpdatedAt: venue.stamp,
              })),
            },
          ],
        }),
      );
      const [pending] = await run(
        athlete,
        sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: privateType.id, typeRevision: privateType.revision, locationId: venue.id, startsAt: clock.starts.toISOString() })}::jsonb) result`,
      );
      const [legacy] =
        await db`select id from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and session_type_id is null and starts_at=${clock.starts}::timestamptz and status='open'`;
      await run(
        coach,
        sql`select app.close_coach_booking_request_occurrence(${legacy.id}::uuid)`,
      );
      const published = await withActorDatabaseContext(coach, (tx) =>
        groupSessionCommandRecord(tx, {
          action: "publish",
          args: { id, expectedRevision: savedSession.revision },
        }),
      );
      assert.equal(published.outcome, "published");
      const requestId = (pending.result as { requestId: string }).requestId;
      const [closed] =
        await db`select status from app.coach_booking_requests where id=${requestId}::uuid`;
      assert.equal(
        closed.status,
        "occurrence-closed",
        "Group publication must resolve unreserved typed attempts without treating them as capacity.",
      );

      const joined = await withActorDatabaseContext(athlete, (tx) =>
        groupSessionCommandRecord(tx, {
          action: "join",
          args: { id, registrationId: randomUUID() },
        }),
      );
      assert.equal(joined.outcome, "joined");
      const page = await withActorDatabaseContext(coach, (tx) =>
        ownedCoachCalendarRecord(tx, {
          from: clock.target_date,
          through: clock.target_date,
          type: "all",
          venueId: null,
          history: false,
          after: null,
          sessionTypeId: type.id,
        }),
      );
      assert.equal(page.total, 1);
      assert.equal(page.items[0].sessionTypeName, "Group session");
      assert.equal(page.items[0].source, "group");
      const listed = await publicGroupSessionRecord({
        action: "list",
        args: { sessionTypeId: type.id },
      });
      assert.ok("items" in listed);
      assert.equal(listed.items.length, 1);
      assert.equal(listed.items[0].id, id);
      await withActorDatabaseContext(coach, (tx) =>
        mutateSessionType(tx, {
          commandId: randomUUID(),
          action: "archive",
          id: type.id,
          expectedRevision: type.revision,
        }),
      );
      const detail = await withActorDatabaseContext(other, (tx) =>
        groupSessionCommandRecord(tx, { action: "detail", args: { id } }),
      );
      assert.equal(detail.session.canJoin, false);
      assert.equal(detail.session.sessionType?.name, "Group session");
      await assert.rejects(
        withActorDatabaseContext(other, (tx) =>
          groupSessionCommandRecord(tx, {
            action: "join",
            args: { id, registrationId: randomUUID() },
          }),
        ),
      );
      const [count] =
        await db`select count(*)::int count from app.coach_group_registrations where session_id=${id}::uuid and status='active'`;
      assert.equal(count.count, 1);
      const confirmed = await withActorDatabaseContext(coach, (tx) =>
        groupSessionCommandRecord(tx, { action: "confirm", args: { id } }),
      );
      assert.equal(confirmed.outcome, "confirmed");
    } finally {
      await db.end();
    }
  },
);
