import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { coachAthletesPageRecord } from "@/server/db/connections/coach-athletes-repository";
import {
  currentCoachPrivateBookingRecords,
  currentClientPrivateBookingRecords,
} from "@/server/db/coaches/booking-repository";
import type {
  CoachAthlete,
  CoachAthleteFilter,
  CoachAthleteCursor,
} from "@/domain/coach-athletes";
const url = process.env.DATABASE_TEST_URL;
const allowed =
  url &&
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov288_[a-f0-9]{12}_(fresh|upgrade)$/.test(
    url,
  );
test(
  "owner roster deduplicates explicit identities before filtering and paging without granting consent",
  { skip: !allowed },
  async (t) => {
    const admin = postgres(url!, { max: 3, prepare: false, onnotice() {} });
    process.env.DATABASE_URL = process.env.CONNECTION_NOTICE_RUNTIME_URL;
    const f = JSON.parse(
      readFileSync(process.env.CONNECTION_NOTICE_MANIFEST!, "utf8"),
    ) as {
      coach: AuthorizedActor;
      athlete: AuthorizedActor;
      outsider: AuthorizedActor;
      bookingId: string;
      oldRequest: string;
    };
    const run = (actor: AuthorizedActor, q: ReturnType<typeof sql>) =>
      withActorDatabaseContext(actor, (tx) => tx.execute(q));
    const page = (
      actor = f.coach,
      filter: CoachAthleteFilter = "all",
      cursor: CoachAthleteCursor | null = null,
    ) =>
      withActorDatabaseContext(actor, (tx) =>
        coachAthletesPageRecord(tx, filter, cursor),
      );
    const all = async (filter: CoachAthleteFilter = "all") => {
      const rows: CoachAthlete[] = [];
      let cursor: CoachAthleteCursor | null = null;
      do {
        const next = await page(f.coach, filter, cursor);
        rows.push(...next.items);
        cursor = next.nextCursor;
        assert.ok(rows.length < 100);
      } while (cursor);
      return rows;
    };
    const create = async (name: string) => {
      const [r] = await run(
        f.coach,
        sql`select app.external_clients('create',${JSON.stringify({ operationId: randomUUID(), name, email: null })}::jsonb) result`,
      );
      return (r.result as { client: { id: string } }).client.id;
    };
    try {
      const external = await create("Notice Athlete");
      const linked = await create("Private contact name"),
        linkedAgain = await create("Another explicitly linked record");
      await admin`update app.coach_external_clients set linked_profile_id=${f.athlete.profileId}::uuid,linked_at=statement_timestamp() where id in(${linked}::uuid,${linkedAgain}::uuid)`;
      for (let i = 0; i < 25; i++) await create(`Roster ${i}`);
      await t.test(
        "linked records collapse into the registered person; identical names stay separate",
        async () => {
          const rows = await all();
          assert.equal(rows.length, 27);
          assert.equal(new Set(rows.map((r) => r.key)).size, 27);
          const person = rows.find((r) => r.profileId === f.athlete.profileId)!;
          assert.equal(person.status, "pending");
          assert.equal(person.canSend, false);
          assert.equal(person.lastSessionAt, null);
          assert.ok(person.nextSessionAt);
          assert.ok([linked, linkedAgain].includes(person.externalClientId!));
          const unlinked = rows.find((r) => r.externalClientId === external)!;
          assert.equal(unlinked.name, person.name);
          assert.equal(unlinked.status, "external");
          assert.equal(unlinked.profileId, null);
          assert.equal(unlinked.connection, null);
          assert.equal(unlinked.canSend, false);
          assert.equal(unlinked.bookingId, null);
          assert.ok(rows.every((r) => !("email" in r)));
          assert.equal(
            rows.some((r) => r.profileId === f.outsider.profileId),
            false,
          );
        },
      );
      await t.test(
        "canonical external booking and owner-only contact destinations agree with the roster",
        async () => {
          const [type] =
            await admin`select id,revision from app.coach_session_types where coach_profile_id=${f.coach.profileId}::uuid and format='private' and not archived limit 1`;
          const [source] =
            await admin`select (select id from app.coach_training_locations where profile_id=${f.coach.profileId}::uuid and is_primary limit 1) location,scheduled_start_at+interval '2 hours' starts from app.coach_private_bookings where id=${f.bookingId}::uuid`;
          const payload = {
            action: "create",
            externalClientId: external,
            typeId: type.id,
            typeRevision: type.revision,
            locationId: source.location,
            startsAt: new Date(source.starts).toISOString(),
            durationMinutes: 60,
          };
          await run(
            f.coach,
            sql`select app.coach_session_booking(${randomUUID()}::uuid,${JSON.stringify(payload)}::jsonb)`,
          );
          const bookings = await withActorDatabaseContext(f.coach, (tx) =>
            currentCoachPrivateBookingRecords(tx, f.coach),
          );
          const owned = bookings.find(
            (row) => row.externalClientId === external,
          )!;
          assert.equal(owned.clientProfileId, null);
          assert.equal(
            owned.athleteProfileHref,
            `/coach/athletes/external/${external}`,
          );
          await assert.rejects(
            run(
              f.athlete,
              sql`select app.current_owned_booking_external_client(${owned.id}::uuid)`,
            ),
          );
          await assert.rejects(
            run(
              f.outsider,
              sql`select app.current_owned_booking_external_client(${owned.id}::uuid)`,
            ),
          );
          assert.equal(
            bookings.find((row) => row.id === f.bookingId)!.athleteProfileHref,
            `/members/${f.athlete.profileId}`,
          );
          const clientRows = await withActorDatabaseContext(f.athlete, (tx) =>
            currentClientPrivateBookingRecords(tx, f.athlete),
          );
          assert.ok(clientRows.every((row) => !("externalClientId" in row)));
          const roster = (await all("external")).find(
            (row) => row.externalClientId === external,
          )!;
          assert.equal(roster.lastSessionAt, null);
          assert.ok(roster.nextSessionAt);
        },
      );
      await t.test(
        "filters apply to all rows before the limit and keyset pages stay complete",
        async () => {
          assert.equal((await all("external")).length, 26);
          assert.equal((await all("unconnected")).length, 1);
          assert.equal((await all("connected")).length, 0);
          const first = await page();
          assert.equal(first.items.length, 20);
          assert.ok(first.nextCursor);
          const second = await page(f.coach, "all", first.nextCursor);
          assert.equal(second.items.length, 7);
          assert.equal(second.nextCursor, null);
          assert.equal(
            new Set([...first.items, ...second.items].map((r) => r.key)).size,
            27,
          );
        },
      );
      await t.test(
        "same existing consent and booking qualification govern accept, disconnect and reconnect",
        async () => {
          await run(
            f.athlete,
            sql`select app.decide_coach_athlete_connection(${f.oldRequest}::uuid,'accept')`,
          );
          let row = (await all("connected"))[0];
          assert.equal(row.profileId, f.athlete.profileId);
          assert.equal(row.connection?.canDisconnect, true);
          assert.equal(row.canSend, false);
          await run(
            f.coach,
            sql`select app.decide_coach_athlete_connection(${f.oldRequest}::uuid,'disconnect')`,
          );
          row = (await all("unconnected"))[0];
          assert.equal(row.connection?.status, "removed");
          assert.equal(row.canSend, true);
          assert.equal(row.bookingId, f.bookingId);
          const op = randomUUID();
          const command = sql`select app.send_coach_athlete_connection(${row.bookingId}::uuid,${op}::uuid,${row.connection!.id}::uuid) result`;
          const first = await run(f.coach, command),
            again = await run(f.coach, command);
          assert.deepEqual(again, first);
          assert.equal((await all("unconnected"))[0].status, "pending");
        },
      );
      await t.test(
        "suspended/hidden owners retain reads while actual eligibility stops new requests",
        async () => {
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${f.coach.profileId}::uuid`;
          assert.equal((await all()).length, 27);
          await admin`select app.review_coach_application(${f.coach.profileId}::uuid,'approved','suspended','MOV-288 disposable roster check','mov288','movx-identity-application-v1')`;
          assert.equal((await all()).length, 27);
          assert.ok((await all()).every((r) => !r.canSend));
        },
      );
      await t.test(
        "outsiders, mismatched actor identity and invalid cursors cannot read the roster",
        async () => {
          await assert.rejects(page(f.outsider));
          await assert.rejects(page(f.athlete));
          await assert.rejects(page({ ...f.coach, runId: randomUUID() }));
          await assert.rejects(
            page({ ...f.coach, profileId: f.outsider.profileId }),
          );
          await assert.rejects(
            run(
              f.coach,
              sql`select * from app.current_coach_athletes('invalid',21,null,null)`,
            ),
          );
          await assert.rejects(
            run(
              f.coach,
              sql`select * from app.current_coach_athletes('all',52,null,null)`,
            ),
          );
          await assert.rejects(
            run(
              f.coach,
              sql`select * from app.current_coach_athletes('all',21,now(),null)`,
            ),
          );
          const [r] =
            await admin`select has_function_privilege('anon','app.current_coach_athletes(text,integer,timestamptz,text)','EXECUTE') anon,has_function_privilege('authenticated','app.current_coach_athletes(text,integer,timestamptz,text)','EXECUTE') authenticated,has_function_privilege('app_runtime','app.current_coach_athletes(text,integer,timestamptz,text)','EXECUTE') runtime`;
          assert.deepEqual(r, {
            anon: false,
            authenticated: false,
            runtime: true,
          });
        },
      );
    } finally {
      await admin.end({ timeout: 1 });
    }
  },
);
