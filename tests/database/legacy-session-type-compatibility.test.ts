import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { sql, type SQL } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { ownedSessionTypes } from "@/server/db/coaches/session-type-repository";
import {
  createCoachBookingRequestRecord,
  acceptCoachBookingRequestRecord,
  currentClientCoachBookingRequestRecords,
  currentOwnedCoachBookingRequestRecords,
} from "@/server/db/coaches/booking-request-repository";
import {
  currentClientPrivateBookingRecords,
  currentCoachPrivateBookingRecords,
} from "@/server/db/coaches/booking-repository";
const url = process.env.DATABASE_TEST_URL;
test(
  "legacy one-hour request and confirmed-booking projections work before and after type installation",
  { skip: !url || !new URL(url).pathname.startsWith("/dev0342_") },
  async () => {
    const db = postgres(url!, {
      max: 1,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    const runtime = new URL(url!);
    runtime.username = "repx_runtime_login";
    runtime.password = "postgres";
    process.env.DATABASE_URL = runtime.toString();
    const run = (actor: AuthorizedActor, query: SQL) =>
      withActorDatabaseContext(actor, (tx) => tx.execute(query));
    async function person(name: string) {
      const id = randomUUID();
      await db`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
      const [p] =
        await db`select * from app.enroll_application_identity(${id}::uuid,${name})`;
      return {
        authUserId: id,
        profileId: p.identity_profile_id,
        runId: p.identity_run_id,
        runRole: "member",
      } satisfies AuthorizedActor;
    }
    try {
      const owner = await person("Legacy type coach"),
        athlete = await person("Legacy type athlete");
      await run(owner, sql`select app.submit_owned_coach_application()`);
      await run(
        owner,
        sql`select app.upsert_owned_coach_profile('Legacy type coach','An isolated legacy hour coach for compatibility verification.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
      );
      await db`select app.review_coach_application(${owner.profileId}::uuid,'pending','approved','Isolated legacy compatibility.','database-test','movx-identity-application-v1')`;
      await db`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
      const [capability] =
        await db`select to_regclass('app.coach_session_types') is not null installed`;
      const catalog = await withActorDatabaseContext(owner, (tx) =>
        ownedSessionTypes(tx, owner, true),
      );
      assert.equal(catalog.length, capability.installed ? 2 : 0);
      const [clock] =
        await db`select (((clock_timestamp() at time zone 'Europe/Berlin')::date+5)+time '09:00')::text local_start`;
      const [slot] = await run(
        owner,
        sql`select app.create_owned_coach_availability(${clock.local_start}::timestamp,60) id`,
      );
      const requested = await withActorDatabaseContext(athlete, (tx) =>
        createCoachBookingRequestRecord(tx, slot.id as string),
      );
      assert.equal(requested.status, "pending");
      const clientPage = await withActorDatabaseContext(athlete, (tx) =>
        currentClientCoachBookingRequestRecords(tx),
      );
      const coachPage = await withActorDatabaseContext(owner, (tx) =>
        currentOwnedCoachBookingRequestRecords(tx),
      );
      assert.equal(clientPage.items[0].id, requested.requestId);
      assert.equal(coachPage.items[0].id, requested.requestId);
      assert.equal(clientPage.items[0].sessionType, undefined);
      const accepted = await withActorDatabaseContext(owner, (tx) =>
        acceptCoachBookingRequestRecord(tx, requested.requestId),
      );
      assert.ok(accepted.bookingId);
      for (const bookings of [
        await withActorDatabaseContext(athlete, (tx) =>
          currentClientPrivateBookingRecords(tx, athlete),
        ),
        await withActorDatabaseContext(owner, (tx) =>
          currentCoachPrivateBookingRecords(tx, owner),
        ),
      ]) {
        assert.equal(bookings[0].id, accepted.bookingId);
        assert.equal(bookings[0].sessionType, undefined);
        assert.equal(
          bookings[0].hasSessionDetails,
          capability.installed ? true : undefined,
        );
      }
    } finally {
      await db.end();
    }
  },
);
