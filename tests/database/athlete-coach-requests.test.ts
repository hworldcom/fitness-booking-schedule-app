import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { saveOwnedEffectiveAvailabilityRecord } from "@/server/db/coaches/effective-availability-repository";
import { athleteCoachesPageRecord } from "@/server/db/connections/athlete-coaches-repository";
import type {
  AthleteCoach,
  AthleteCoachCursor,
  AthleteCoachFilter,
} from "@/domain/athlete-coaches";
import { COACH_BOOKING_REQUEST_STATUSES } from "@/domain/coach-booking-requests";

const url = process.env.DATABASE_TEST_URL;
const allowed =
  url &&
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov293_[a-f0-9]{12}_(fresh|upgrade)$/.test(
    url,
  );
type RequestContact = {
  coach: AuthorizedActor;
  requestId: string;
  bookingId: string | null;
  payload: {
    typeId: string;
    typeRevision: number;
    locationId: string;
    startsAt: string;
  };
};
type Fixture = {
  coach: AuthorizedActor;
  athlete: AuthorizedActor;
  outsider: AuthorizedActor;
  included: string[];
  excluded: string[];
  oldRequest: string;
  requests: Record<string, RequestContact>;
  requestOnly: string;
};
test(
  "all private request states add only the owning athlete's coach without granting sessions or consent",
  { skip: !allowed },
  async (t) => {
    const admin = postgres(url!, { max: 3, prepare: false, onnotice() {} });
    process.env.DATABASE_URL = process.env.CONNECTION_NOTICE_RUNTIME_URL;
    const manifest =
      process.env.CONNECTION_NOTICE_MANIFEST! + ".request-coaches";
    const run = (actor: AuthorizedActor, q: ReturnType<typeof sql>) =>
      withActorDatabaseContext(actor, (tx) => tx.execute(q));
    try {
      if (process.env.ATHLETE_COACH_REQUEST_PREPARE === "1") {
        const f = JSON.parse(
          readFileSync(
            process.env.CONNECTION_NOTICE_MANIFEST! + ".coaches",
            "utf8",
          ),
        ) as Fixture;
        const [requestOnly] =
          await admin`select coach_profile_id from app.coach_booking_requests where run_id=${f.athlete.runId}::uuid and client_profile_id=${f.athlete.profileId}::uuid and status='pending'`;
        f.requestOnly = requestOnly.coach_profile_id;
        const coaches =
          await admin`select p.id,p.auth_user_id from app.profiles p where p.id in ${admin(f.excluded)} and not exists(select 1 from app.coach_booking_requests r where r.coach_profile_id=p.id and r.client_profile_id=${f.athlete.profileId}::uuid) order by p.created_at,p.id limit 7`;
        assert.equal(coaches.length, 7);
        f.requests = {};
        for (const [
          index,
          status,
        ] of COACH_BOOKING_REQUEST_STATUSES.entries()) {
          const owner: AuthorizedActor = {
            authUserId: coaches[index].auth_user_id,
            profileId: coaches[index].id,
            runId: f.athlete.runId,
            runRole: "member",
          };
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
          const [venue] =
            await admin`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${owner.profileId}::uuid and is_primary`;
          const [date] =
            await admin`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+7)::text target_date`;
          await withActorDatabaseContext(owner, (tx) =>
            saveOwnedEffectiveAvailabilityRecord(tx, {
              kind: "dates",
              operationId: randomUUID(),
              expectedRevision: 0,
              dates: [
                {
                  date: date.target_date,
                  mode: "custom",
                  hours: [
                    {
                      localStartTime: "10:00",
                      locationId: venue.id,
                      locationUpdatedAt: venue.stamp,
                    },
                  ],
                },
              ],
            }),
          );
          const [type] =
            await admin`select id,revision from app.coach_session_types where coach_profile_id=${owner.profileId}::uuid and format='private'`;
          const [time] =
            await admin`select ((${date.target_date}::date+time '10:00')at time zone'Europe/Berlin')::text starts`;
          const payload = {
            typeId: type.id,
            typeRevision: type.revision,
            locationId: venue.id,
            startsAt: time.starts,
          };
          const [r] = await run(
            f.athlete,
            sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify(payload)}::jsonb) result`,
          );
          const requestId = (r.result as { requestId: string }).requestId;
          let bookingId: string | null = null;
          if (status === "accepted") {
            const [b] = await run(
              owner,
              sql`select * from app.accept_coach_booking_request(${requestId}::uuid)`,
            );
            bookingId = String(b.booking_id);
            await run(
              f.athlete,
              sql`select app.cancel_direct_private_booking(${bookingId}::uuid)`,
            );
          } else if (status === "declined")
            await run(
              owner,
              sql`select * from app.decline_coach_booking_request(${requestId}::uuid)`,
            );
          else if (status === "withdrawn")
            await run(
              f.athlete,
              sql`select * from app.withdraw_coach_booking_request(${requestId}::uuid)`,
            );
          else if (status === "not-selected") {
            const [other] = await run(
              f.outsider,
              sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify(payload)}::jsonb) result`,
            );
            await run(
              owner,
              sql`select * from app.accept_coach_booking_request(${(other.result as { requestId: string }).requestId}::uuid)`,
            );
          } else if (status === "occurrence-closed") {
            const [request] =
              await admin`select slot_id from app.coach_booking_requests where id=${requestId}::uuid`;
            await run(
              owner,
              sql`select app.close_coach_booking_request_occurrence(${request.slot_id}::uuid)`,
            );
          } else if (status === "expired") {
            // Historical timestamps only in the exact owned scratch target;
            // the normal restricted request reader performs the expiry transition.
            await admin.begin(async (tx) => {
              await tx`set local session_replication_role=replica`;
              await tx`update app.coach_booking_requests set created_at=statement_timestamp()-interval '2 days',updated_at=statement_timestamp()-interval '2 days',decision_deadline_at=statement_timestamp()-interval '36 hours' where id=${requestId}::uuid`;
            });
            await run(
              f.athlete,
              sql`select * from app.current_client_coach_booking_requests(21,null,null)`,
            );
          }
          const [saved] =
            await admin`select status from app.coach_booking_requests where id=${requestId}::uuid`;
          assert.equal(saved.status, status);
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${owner.profileId}::uuid`;
          f.requests[status] = { coach: owner, requestId, bookingId, payload };
        }
        writeFileSync(manifest, JSON.stringify(f));
        return;
      }
      const f = JSON.parse(readFileSync(manifest, "utf8")) as Fixture;
      const page = (
        actor = f.athlete,
        filter: AthleteCoachFilter = "all",
        cursor: AthleteCoachCursor | null = null,
      ) =>
        withActorDatabaseContext(actor, (tx) =>
          athleteCoachesPageRecord(tx, filter, cursor),
        );
      const all = async (filter: AthleteCoachFilter = "all") => {
        const rows: AthleteCoach[] = [];
        let cursor: AthleteCoachCursor | null = null;
        do {
          const next = await page(f.athlete, filter, cursor);
          rows.push(...next.items);
          cursor = next.nextCursor;
          assert.ok(rows.length < 100);
        } while (cursor);
        return rows;
      };
      const requestCoaches = Object.values(f.requests).map(
        (r) => r.coach.profileId,
      );
      const expected = [
        ...new Set([...f.included, f.requestOnly, ...requestCoaches]),
      ].sort();
      await t.test(
        "every request status, overlap dedup and keyset filters cover the entire roster",
        async () => {
          const rows = await all();
          assert.deepEqual(rows.map((r) => r.profileId).sort(), expected);
          assert.equal(rows.length, 34);
          assert.equal(new Set(rows.map((r) => r.key)).size, 34);
          assert.equal(
            rows.filter((r) => r.name === "Excluded contact").length,
            7,
          );
          const first = await page();
          assert.equal(first.items.length, 20);
          assert.ok(first.nextCursor);
          const second = await page(f.athlete, "all", first.nextCursor);
          assert.equal(second.items.length, 14);
          assert.equal(second.nextCursor, null);
          assert.equal((await all("connected")).length, 0);
          assert.equal((await all("unconnected")).length, 34);
          assert.equal(
            rows.filter((r) => r.profileId === f.coach.profileId).length,
            1,
          );
          for (const r of Object.values(f.requests)) {
            const [status] =
              await admin`select status from app.coach_booking_requests where id=${r.requestId}::uuid`;
            assert.ok(COACH_BOOKING_REQUEST_STATUSES.includes(status.status));
          }
        },
      );
      await t.test(
        "request-only coaches have no session dates, public private-media shortcut or Connect authority",
        async () => {
          const rows = await all();
          for (const id of [f.requestOnly, ...requestCoaches]) {
            const row = rows.find((r) => r.profileId === id)!;
            assert.equal(row.status, "unconnected");
            assert.equal(row.connection, null);
            assert.equal(row.canSend, false);
            assert.equal(row.bookingId, null);
            assert.equal(row.lastSessionAt, null);
            assert.equal(row.nextSessionAt, null);
            if (id !== f.requestOnly) {
              assert.equal(row.profileHref, null);
              assert.equal(row.portraitUrl, null);
            }
            assert.ok(
              !("requestId" in row) &&
                !("email" in row) &&
                !("externalClientId" in row),
            );
          }
          const cancelled = f.requests.accepted;
          await assert.rejects(
            run(
              f.athlete,
              sql`select app.send_coach_athlete_connection(${cancelled.bookingId}::uuid,${randomUUID()}::uuid,null)`,
            ),
          );
        },
      );
      await t.test(
        "contact recency uses request creation and a repeated request still gives one coach row",
        async () => {
          const p = f.requests.pending;
          const [request] =
            await admin`select to_jsonb(created_at)#>>'{}' stamp from app.coach_booking_requests where id=${p.requestId}::uuid`;
          assert.equal(
            (await all()).find((r) => r.profileId === p.coach.profileId)!
              .sortAt,
            request.stamp,
          );
          const r = f.requests.declined;
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${r.coach.profileId}::uuid`;
          const [created] = await run(
            f.athlete,
            sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify(r.payload)}::jsonb) result`,
          );
          const [latest] =
            await admin`select to_jsonb(created_at)#>>'{}' stamp from app.coach_booking_requests where id=${(created.result as { requestId: string }).requestId}::uuid`;
          const rows = await all();
          assert.equal(rows.length, 34);
          assert.equal(
            rows.filter((c) => c.profileId === r.coach.profileId).length,
            1,
          );
          assert.equal(
            rows.find((c) => c.profileId === r.coach.profileId)!.sortAt,
            latest.stamp,
          );
          assert.equal(
            rows.find((c) => c.profileId === r.coach.profileId)!.canSend,
            false,
          );
        },
      );
      await t.test(
        "current connection state and canonical private-booking consent remain independent",
        async () => {
          await run(
            f.athlete,
            sql`select app.decide_coach_athlete_connection(${f.oldRequest}::uuid,'accept')`,
          );
          const connected = await all("connected");
          assert.equal(connected.length, 1);
          assert.equal(connected[0].profileId, f.coach.profileId);
          assert.equal(connected[0].canSend, false);
          assert.equal((await all("unconnected")).length, 33);
          await run(
            f.athlete,
            sql`select app.decide_coach_athlete_connection(${f.oldRequest}::uuid,'disconnect')`,
          );
          const own = (await all()).find(
            (r) => r.profileId === f.coach.profileId,
          )!;
          assert.equal(own.canSend, true);
          assert.equal(own.connection?.status, "removed");
        },
      );
      await t.test(
        "unrelated athletes and mismatched datasets cannot obtain another athlete's request contacts",
        async () => {
          const outsider = (await page(f.outsider)).items;
          assert.ok(
            outsider.some(
              (r) => r.profileId === f.requests["not-selected"].coach.profileId,
            ),
          );
          assert.ok(
            requestCoaches
              .filter((id) => id !== f.requests["not-selected"].coach.profileId)
              .every((id) => !outsider.some((r) => r.profileId === id)),
          );
          assert.ok(!outsider.some((r) => r.profileId === f.requestOnly));
          await assert.rejects(page({ ...f.athlete, runId: randomUUID() }));
          await assert.rejects(
            page({ ...f.athlete, profileId: f.outsider.profileId }),
          );
          await assert.rejects(
            run(f.athlete, sql`select * from app.coach_booking_requests`),
          );
        },
      );
    } finally {
      await admin.end({ timeout: 1 });
    }
  },
);
