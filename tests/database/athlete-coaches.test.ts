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
const url = process.env.DATABASE_TEST_URL;
const allowed =
  url &&
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov(?:292|293)_[a-f0-9]{12}_(fresh|upgrade)$/.test(
    url,
  );
type Fixture = {
  coach: AuthorizedActor;
  athlete: AuthorizedActor;
  outsider: AuthorizedActor;
  bookingId: string;
  oldRequest: string;
  included: string[];
  excluded: string[];
  past: string;
  groupOnly: string;
  privateOnly: string;
};
test(
  "athlete coach roster includes exact owned private/group contacts without expanding consent",
  { skip: !allowed },
  async (t) => {
    const admin = postgres(url!, { max: 3, prepare: false, onnotice() {} });
    process.env.DATABASE_URL = process.env.CONNECTION_NOTICE_RUNTIME_URL;
    const manifest = process.env.CONNECTION_NOTICE_MANIFEST! + ".coaches";
    const run = (actor: AuthorizedActor, q: ReturnType<typeof sql>) =>
      withActorDatabaseContext(actor, (tx) => tx.execute(q));
    async function coach(name: string): Promise<AuthorizedActor> {
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
      await run(actor, sql`select app.submit_owned_coach_application()`);
      await run(
        actor,
        sql`select app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":null,"facebookUrl":null,"linkedinUrl":null}'::jsonb)`,
      );
      await run(
        actor,
        sql`select app.upsert_owned_coach_profile(${name},'Disposable athlete roster coach with a reviewed training location.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
      );
      await admin`select app.review_coach_application(${actor.profileId}::uuid,'pending','approved','MOV-292 disposable fixture','mov292','movx-identity-application-v1')`;
      return actor;
    }
    // Historical read fixtures only in the runner-owned scratch DB. No runtime
    // grant/guard is altered; valid lifecycle tuples are inserted by its admin.
    async function group(
      owner: AuthorizedActor,
      athlete: AuthorizedActor,
      status = "confirmed",
      registrationStatus = "active",
      offset = 10,
    ) {
      const id = randomUUID();
      await admin.begin(async (tx) => {
        await tx`set local session_replication_role=replica`;
        await tx`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,published_at,confirmed_at,confirmed_by_profile_id,closed_at,closed_by_profile_id)
        select ${id}::uuid,${owner.runId}::uuid,${owner.profileId}::uuid,${"group-" + id.replaceAll("-", "")},'Roster fixture','Disposable historical roster fixture','Boxing','All levels',l.id,
          jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),
          statement_timestamp()+${offset}*interval '1 day',statement_timestamp()+${offset}*interval '1 day'+interval '1 hour',statement_timestamp()+${offset}*interval '1 day'-interval '2 hours',
          1,10,0,${status},statement_timestamp()-interval '20 days',case when ${status}='confirmed' then statement_timestamp()-interval '20 days' end,
          case when ${status}='confirmed' then ${owner.profileId}::uuid end,case when ${status} in ('cancelled','not-confirmed') then statement_timestamp() end,
          case when ${status}='cancelled' then ${owner.profileId}::uuid end
        from app.coach_training_locations l where l.run_id=${owner.runId}::uuid and l.profile_id=${owner.profileId}::uuid and l.is_primary`;
        const approved = !["pending", "declined", "approval-expired"].includes(
          registrationStatus,
        );
        const decision =
          registrationStatus === "declined"
            ? "declined"
            : approved
              ? "approved"
              : null;
        await tx`insert into app.coach_group_registrations(id,run_id,session_id,athlete_profile_id,status,created_at,resolved_at,decision,decided_at,decided_by_profile_id)
        values(${randomUUID()}::uuid,${owner.runId}::uuid,${id}::uuid,${athlete.profileId}::uuid,${registrationStatus},statement_timestamp()-interval '19 days',
          case when ${registrationStatus} not in ('pending','active') then statement_timestamp() end,${decision},
          case when ${decision}::text is not null then statement_timestamp()-interval '18 days' end,
          case when ${decision}::text is not null then ${owner.profileId}::uuid end)`;
      });
    }
    try {
      if (process.env.ATHLETE_COACH_PREPARE === "1") {
        const f = JSON.parse(
          readFileSync(process.env.CONNECTION_NOTICE_MANIFEST!, "utf8"),
        ) as Fixture;
        f.included = [f.coach.profileId];
        f.excluded = [];
        for (let n = 0; n < 24; n++) {
          const c = await coach(n < 2 ? "Same Coach Name" : `Group Coach ${n}`);
          f.included.push(c.profileId);
          await group(
            c,
            f.athlete,
            n === 2 ? "open" : "confirmed",
            "active",
            n === 0 ? -2 : n + 10,
          );
          if (n === 0) f.past = c.profileId;
          if (n === 1) {
            f.groupOnly = c.profileId;
            await group(c, f.athlete, "confirmed", "active", 50);
            await group(c, f.coach, "confirmed", "active", 60);
          }
        }
        for (const accept of [true, false]) {
          const c = await coach(
            accept ? "Private only coach" : "Request only coach",
          );
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${c.profileId}::uuid`;
          const [venue] =
            await admin`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${c.profileId}::uuid and is_primary`;
          const [date] =
            await admin`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+6)::text target_date`;
          await withActorDatabaseContext(c, (tx) =>
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
            await admin`select id,revision from app.coach_session_types where coach_profile_id=${c.profileId}::uuid and format='private'`;
          const [time] =
            await admin`select ((${date.target_date}::date+time '10:00')at time zone'Europe/Berlin')::text starts`;
          const [r] = await run(
            f.athlete,
            sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: type.id, typeRevision: type.revision, locationId: venue.id, startsAt: time.starts })}::jsonb) result`,
          );
          if (accept) {
            await run(
              c,
              sql`select * from app.accept_coach_booking_request(${(r.result as { requestId: string }).requestId}::uuid)`,
            );
            f.included.push(c.profileId);
            f.privateOnly = c.profileId;
          } else f.excluded.push(c.profileId);
        }
        await group(f.coach, f.athlete); // private + group + connection deduplicate
        for (const [status, registrationStatus, offset] of [
          ["confirmed", "pending", 10],
          ["confirmed", "declined", 10],
          ["confirmed", "withdrawn", 10],
          ["cancelled", "session-cancelled", 10],
          ["not-confirmed", "session-not-confirmed", -2],
          ["open", "active", -2],
          ["confirmed", "approval-expired", 10],
        ] as const) {
          const c = await coach("Excluded contact");
          f.excluded.push(c.profileId);
          await group(c, f.athlete, status, registrationStatus, offset);
        }
        const stranger = await coach("Unrelated group coach");
        f.excluded.push(stranger.profileId);
        await group(stranger, f.outsider);
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
      await t.test(
        "complete filtered keysets deduplicate group/private/connection identity and preserve microseconds",
        async () => {
          const first = await page(),
            second = await page(f.athlete, "all", first.nextCursor);
          assert.equal(first.items.length, 20);
          assert.ok(first.nextCursor);
          assert.equal(second.items.length, 6);
          assert.equal(second.nextCursor, null);
          const rows = await all();
          assert.deepEqual(
            rows.map((r) => r.profileId).sort(),
            f.included.slice().sort(),
          );
          assert.equal(new Set(rows.map((r) => r.key)).size, 26);
          assert.equal(
            rows.filter((r) => r.name === "Same Coach Name").length,
            2,
          );
          assert.equal(
            rows.find((r) => r.profileId === f.coach.profileId)!.status,
            "pending",
          );
          assert.ok(rows.find((r) => r.profileId === f.past)!.lastSessionAt);
          const g = rows.find((r) => r.profileId === f.groupOnly)!;
          assert.equal(g.lastSessionAt, null);
          assert.ok(g.nextSessionAt);
          assert.equal(g.canSend, false);
          assert.equal(g.bookingId, null);
          const privateOnly = rows.find((r) => r.profileId === f.privateOnly)!;
          assert.equal(privateOnly.status, "unconnected");
          assert.equal(privateOnly.connection, null);
          assert.equal(privateOnly.canSend, true);
          assert.ok(privateOnly.bookingId);
          assert.equal(g.profileHref, null);
          assert.equal(g.portraitUrl, null);
          assert.ok(
            rows.every((r) => !("externalClientId" in r) && !("email" in r)),
          );
          assert.equal((await all("unconnected")).length, 26);
          assert.equal((await all("connected")).length, 0);
          assert.ok(first.nextCursor.at.includes("."));
        },
      );
      await t.test(
        "accept/disconnect/reconnect retain canonical private-booking qualification and exact retry",
        async () => {
          await run(
            f.athlete,
            sql`select app.decide_coach_athlete_connection(${f.oldRequest}::uuid,'accept')`,
          );
          let c = (await all("connected"))[0];
          assert.equal(c.profileId, f.coach.profileId);
          assert.equal(c.connection?.canDisconnect, true);
          assert.equal(c.canSend, false);
          assert.ok(c.profileHref);
          await run(
            f.athlete,
            sql`select app.decide_coach_athlete_connection(${f.oldRequest}::uuid,'disconnect')`,
          );
          c = (await all("unconnected")).find(
            (r) => r.profileId === f.coach.profileId,
          )!;
          assert.equal(c.canSend, true);
          assert.equal(c.bookingId, f.bookingId);
          const command = sql`select app.send_coach_athlete_connection(${c.bookingId}::uuid,${randomUUID()}::uuid,${c.connection!.id}::uuid) result`;
          assert.deepEqual(
            await run(f.athlete, command),
            await run(f.athlete, command),
          );
          assert.equal(
            (await all()).find((r) => r.profileId === f.coach.profileId)!
              .status,
            "pending",
          );
        },
      );
      await t.test(
        "hidden coach history and athlete capability survive suspension without public links or outreach",
        async () => {
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${f.coach.profileId}::uuid`;
          const c = (await all()).find(
            (r) => r.profileId === f.coach.profileId,
          )!;
          assert.equal(c.profileHref, null);
          assert.equal(c.portraitUrl, null);
          // A coach using athlete view keeps its own group contacts even when suspended.
          await admin`select app.review_coach_application(${f.coach.profileId}::uuid,'approved','suspended','MOV-292 disposable athlete access check','mov292','movx-identity-application-v1')`;
          assert.deepEqual(
            (await page(f.coach)).items.map((r) => r.profileId),
            [f.groupOnly],
          );
          assert.equal((await all()).length, 26);
        },
      );
      await t.test(
        "owner/dataset binding, invalid pages, browser/worker denial and management-flag cleanup",
        async () => {
          assert.equal((await page(f.outsider)).items.length, 1);
          assert.ok(
            (await page(f.outsider)).items.every(
              (r) => !f.included.includes(r.profileId),
            ),
          );
          await assert.rejects(page({ ...f.athlete, runId: randomUUID() }));
          await assert.rejects(
            page({ ...f.athlete, profileId: f.outsider.profileId }),
          );
          for (const q of [
            sql`select * from app.current_athlete_coaches('external',21,null,null)`,
            sql`select * from app.current_athlete_coaches('all',52,null,null)`,
            sql`select * from app.current_athlete_coaches('all',21,now(),null)`,
          ])
            await assert.rejects(run(f.athlete, q));
          for (const role of [
            "anon",
            "authenticated",
            "service_role",
            "app_notification_worker",
            "app_media_worker",
          ]) {
            const [r] =
              await admin`select has_function_privilege(${role},'app.current_athlete_coaches(text,integer,timestamptz,text)','EXECUTE') allowed`;
            assert.equal(r.allowed, false);
          }
          await withActorDatabaseContext(f.athlete, async (tx) => {
            await athleteCoachesPageRecord(tx, "all");
            const [flags] = await tx.execute(
              sql`select current_setting('app.group_session_management',true) group_flag,current_setting('app.coach_connection_management',true) connection_flag`,
            );
            assert.notEqual(flags.group_flag, "on");
            assert.equal(flags.connection_flag, "off");
          });
          await assert.rejects(
            run(f.athlete, sql`select * from app.coach_group_registrations`),
          );
        },
      );
    } finally {
      await admin.end({ timeout: 1 });
    }
  },
);
