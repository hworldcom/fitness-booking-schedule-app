import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { sql, type SQL } from "drizzle-orm";
import type {
  GroupDraftInput,
  GroupSessionCommand,
  GroupResultMap,
} from "@/domain/group-sessions";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { groupSessionCommandRecord } from "@/server/db/group-sessions/repository";

const url = process.env.DATABASE_TEST_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error(
    "Group scheduling tests require explicit loopback DATABASE_TEST_URL.",
  );
const runtime = new URL(url);
runtime.username = "repx_runtime_login";
runtime.password = "postgres";
process.env.DATABASE_URL = runtime.toString();

test("group/private scheduling authority, publication and lock recovery", async (t) => {
  const db = postgres(url, {
    max: 12,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  const actors: AuthorizedActor[] = [];
  const authIds: string[] = [];
  let coach: AuthorizedActor;
  let athlete: AuthorizedActor;
  let other: AuthorizedActor;
  let locationId: string;
  const run = <T extends Record<string, unknown> = Record<string, unknown>>(
    a: AuthorizedActor,
    query: SQL,
  ) => withActorDatabaseContext(a, (tx) => tx.execute<T>(query));
  const command = <C extends GroupSessionCommand>(
    a: AuthorizedActor,
    c: C,
  ): Promise<GroupResultMap[C["action"]]> =>
    withActorDatabaseContext(a, (tx) => groupSessionCommandRecord(tx, c));
  const publish = (d: GroupDraftInput, expectedRevision = 1, a = coach) =>
    command(a, { action: "publish", args: { id: d.id, expectedRevision } });
  const future = (days = 3, hour = 10) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };
  const draft = (change: Partial<GroupDraftInput> = {}): GroupDraftInput => {
    const starts = future();
    return {
      id: randomUUID(),
      expectedRevision: null,
      title: "Group scheduling fixture",
      description: "Isolated publication and scheduling race fixture.",
      discipline: "Boxing",
      intendedLevel: "All levels",
      locationId,
      startsAt: starts.toISOString(),
      endsAt: new Date(starts.getTime() + 3600000).toISOString(),
      decisionDeadlineAt: new Date(starts.getTime() - 3600000).toISOString(),
      minimumParticipants: 1,
      maximumParticipants: 5,
      priceCents: 0,
      ...change,
    };
  };
  async function save(change: Partial<GroupDraftInput> = {}) {
    const d = draft(change);
    await command(coach, { action: "save-draft", args: d });
    return d;
  }
  async function actor(name: string, asCoach = false) {
    const authUserId = randomUUID();
    authIds.push(authUserId);
    await db`insert into auth.users(id,is_sso_user,is_anonymous) values(${authUserId}::uuid,false,false)`;
    const [identity] =
      await db`select * from app.enroll_application_identity(${authUserId}::uuid,${name})`;
    const a = {
      authUserId,
      profileId: identity.identity_profile_id as string,
      runId: identity.identity_run_id as string,
      runRole: "member" as const,
    };
    actors.push(a);
    if (asCoach) {
      await run(a, sql`select app.submit_owned_coach_application()`);
      await run(
        a,
        sql`select app.upsert_owned_coach_profile(${name},'Group scheduling coach fixture with reviewed venue and authority.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
      );
      await db`select app.review_coach_application(${a.profileId}::uuid,'pending','approved','Isolated schedule fixture approved.','database-test','movx-identity-application-v1')`;
      await db`update app.coach_profiles set visibility='visible' where profile_id=${a.profileId}::uuid`;
    }
    return a;
  }
  const createSlot = (when: string, a = coach) =>
    run<{ id: string }>(
      a,
      sql`select app.create_owned_coach_availability((${when}::timestamptz at time zone 'Europe/Berlin'),60) id`,
    ).then((r) => r[0].id);
  const closeSlot = (id: string) =>
    run(
      coach,
      sql`select app.close_coach_booking_request_occurrence(${id}::uuid)`,
    );
  const cancel = (id: string) =>
    command(coach, { action: "cancel", args: { id } });
  async function resetSchedule() {
    await db`delete from app.coach_group_registrations where session_id in(select id from app.coach_group_sessions where coach_profile_id=${coach.profileId}::uuid)`;
    await db`delete from app.coach_group_sessions where coach_profile_id=${coach.profileId}::uuid`;
    // Delete only these generated actors' fixtures, including notification references.
    await db`delete from app.booking_notification_receipts where event_id in (select id from app.booking_notification_events where coach_profile_id=${coach.profileId}::uuid)`;
    await db`delete from app.booking_notification_events where coach_profile_id=${coach.profileId}::uuid`;
    await db`delete from app.message_conversations where coach_profile_id=${coach.profileId}::uuid`;
    await db`delete from app.coach_booking_requests where coach_profile_id=${coach.profileId}::uuid`;
    await db`delete from app.coach_private_bookings where coach_profile_id=${coach.profileId}::uuid`;
    await db`delete from app.coach_availability_slots where profile_id=${coach.profileId}::uuid`;
    await db`delete from app.coach_availability_rules where profile_id=${coach.profileId}::uuid`;
  }
  async function cleanup() {
    if (coach) await resetSchedule();
    const ids = actors.map((a) => a.profileId);
    if (ids.length) {
      await db`delete from app.message_conversations where coach_profile_id in ${db(ids)} or athlete_profile_id in ${db(ids)}`;
      await db`delete from app.coach_group_sessions where coach_profile_id in ${db(ids)}`;
      await db`update app.coach_profiles set visibility='hidden' where profile_id in ${db(ids)} and visibility<>'hidden'`;
      await db`delete from app.coach_training_locations where profile_id in ${db(ids)}`;
      await db`delete from app.coach_profile_disciplines where profile_id in ${db(ids)}`;
      await db`delete from app.coach_profiles where profile_id in ${db(ids)}`;
      await db`delete from app.coach_application_review_events where profile_id in ${db(ids)}`;
      await db`delete from app.coach_applications where profile_id in ${db(ids)}`;
      await db`delete from app.demo_run_participants where profile_id in ${db(ids)}`;
      await db`delete from app.profiles where id in ${db(ids)}`;
    }
    if (authIds.length)
      await db`delete from auth.users where id in ${db(authIds)}`;
  }
  try {
    coach = await actor("Group scheduling coach", true);
    athlete = await actor("Group scheduling athlete");
    other = await actor("Independent scheduling coach", true);
    locationId = (
      await db`select id from app.coach_training_locations where profile_id=${coach.profileId}::uuid and status='active' limit 1`
    )[0].id;
    await t.test(
      "owner publication is stable, private, revision-aware and guarded against raw flags",
      async () => {
        const d = await save();
        await assert.rejects(publish(d, 1, athlete));
        const first = await publish(d);
        assert.equal(first.outcome, "published");
        assert.equal(first.session.status, "open");
        assert.equal(first.session.participantCount, 0);
        const retry = await publish(d);
        assert.equal(retry.session.publishedAt, first.session.publishedAt);
        assert.equal(retry.session.revision, first.session.revision);
        assert.equal((await publish(d, 2)).outcome, "unavailable");
        await assert.rejects(
          run(
            coach,
            sql`select app.group_schedule_lock(${coach.runId}::uuid,${coach.profileId}::uuid)`,
          ),
        );
        await assert.rejects(
          run(
            coach,
            sql`update app.coach_group_sessions set status='open' where id=${d.id}::uuid`,
          ),
        );
        await cancel(d.id);
        assert.equal((await publish(d)).outcome, "unavailable");
        const stale = await save();
        assert.equal((await publish(stale, 2)).reason, "draft-changed");
        await resetSchedule();
      },
    );
    await t.test(
      "venue drift requires review; new publication obeys current visibility",
      async () => {
        const d = await save();
        const [location] =
          await db`select public_name from app.coach_training_locations where id=${locationId}::uuid`;
        await db`update app.coach_training_locations set public_name='Changed reviewed group venue' where id=${locationId}::uuid`;
        assert.equal((await publish(d)).reason, "venue-changed");
        await command(coach, {
          action: "save-draft",
          args: { ...d, expectedRevision: 1 },
        });
        assert.equal((await publish(d, 2)).outcome, "published");
        const hidden = await save({
          startsAt: future(3, 12).toISOString(),
          endsAt: future(3, 13).toISOString(),
        });
        await db`update app.coach_profiles set visibility='hidden' where profile_id=${coach.profileId}::uuid`;
        await assert.rejects(publish(hidden));
        assert.equal((await publish(d, 2)).outcome, "published");
        await assert.rejects(createSlot(d.startsAt));
        await db`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
        await db`update app.coach_training_locations set public_name=${location.public_name} where id=${locationId}::uuid`;
        await resetSchedule();
      },
    );
    await t.test(
      "existing private inventory must be explicitly closed; cancellation never revives requests",
      async () => {
        const d = await save();
        const slot = await createSlot(d.startsAt);
        const request = (
          await run<{ request_id: string }>(
            athlete,
            sql`select * from app.create_coach_booking_request(${slot}::uuid)`,
          )
        )[0].request_id;
        assert.equal((await publish(d)).outcome, "conflict");
        await closeSlot(slot);
        assert.equal((await publish(d)).outcome, "published");
        await cancel(d.id);
        const [state] =
          await db`select s.status slot_status,r.status request_status from app.coach_availability_slots s join app.coach_booking_requests r on r.slot_id=s.id where r.id=${request}::uuid`;
        assert.equal(state.slot_status, "withdrawn");
        assert.equal(state.request_status, "occurrence-closed");
        await resetSchedule();
      },
    );
    await t.test(
      "overlapping publications across venues have one winner; adjacent intervals and other coaches work",
      async () => {
        const venue = (
          await run<{ id: string }>(
            coach,
            sql`select app.create_owned_coach_training_location('gym','40000000-0000-4000-8000-000000000002'::uuid,null,null,null,null,null) id`,
          )
        )[0].id;
        const a = await save();
        const b = await save({ locationId: venue });
        const results = await Promise.all([publish(a), publish(b)]);
        assert.equal(
          results.filter((r) => r.outcome === "published").length,
          1,
        );
        assert.equal(results.filter((r) => r.outcome === "conflict").length, 1);
        const adjacent = await save({
          startsAt: future(3, 11).toISOString(),
          endsAt: future(3, 12).toISOString(),
        });
        assert.equal((await publish(adjacent)).outcome, "published");
        const otherLocation = (
          await db`select id from app.coach_training_locations where profile_id=${other.profileId}::uuid and status='active' limit 1`
        )[0].id;
        const independent = draft({
          id: randomUUID(),
          locationId: otherLocation,
        });
        await command(other, { action: "save-draft", args: independent });
        assert.equal(
          (await publish(independent, 1, other)).outcome,
          "published",
        );
        await db`delete from app.coach_group_sessions where coach_profile_id=${other.profileId}::uuid`;
        await resetSchedule();
      },
    );
    await t.test(
      "publication versus private create/update is serialized without partial or overlapping inventory",
      async () => {
        const d = await save();
        const results = await Promise.allSettled([
          publish(d),
          createSlot(d.startsAt),
        ]);
        const groups = Number(
          (
            await db`select count(*) n from app.coach_group_sessions where id=${d.id}::uuid and status='open'`
          )[0].n,
        );
        const slots = Number(
          (
            await db`select count(*) n from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and status<>'withdrawn'`
          )[0].n,
        );
        assert.equal(groups + slots, 1);
        assert.ok(results.some((r) => r.status === "fulfilled"));
        await resetSchedule();
        const published = await save();
        await publish(published);
        const slot = await createSlot(future(3, 13).toISOString());
        await assert.rejects(
          run(
            coach,
            sql`select app.update_owned_coach_availability(${slot}::uuid,(${published.startsAt}::timestamptz at time zone 'Europe/Berlin'),60,false)`,
          ),
        );
        assert.equal(
          new Date(
            (
              await db`select starts_at from app.coach_availability_slots where id=${slot}::uuid`
            )[0].starts_at,
          ).toISOString(),
          future(3, 13).toISOString(),
        );
        await resetSchedule();
      },
    );
    await t.test(
      "private acceptance and cancellation keep booking/card authority; groups cannot replace their interval",
      async () => {
        const d = await save();
        const slot = await createSlot(d.startsAt);
        const req = (
          await run<{ request_id: string }>(
            athlete,
            sql`select * from app.create_coach_booking_request(${slot}::uuid)`,
          )
        )[0].request_id;
        const [publication, accepted] = await Promise.all([
          publish(d),
          run<{ booking_id: string }>(
            coach,
            sql`select * from app.accept_coach_booking_request(${req}::uuid)`,
          ),
        ]);
        assert.equal(publication.outcome, "conflict");
        const booking = accepted[0].booking_id;
        assert.ok(booking);
        const [refused] = await Promise.all([
          publish(d),
          run(
            athlete,
            sql`select app.cancel_direct_private_booking(${booking}::uuid)`,
          ),
        ]);
        assert.equal(refused.outcome, "conflict");
        assert.equal(
          (
            await db`select status from app.coach_private_bookings where id=${booking}::uuid`
          )[0].status,
          "cancelled",
        );
        assert.equal(
          (
            await db`select status from app.coach_availability_slots where id=${slot}::uuid`
          )[0].status,
          "open",
        );
        await closeSlot(slot);
        assert.equal((await publish(d)).outcome, "published");
        await run(
          athlete,
          sql`select app.cancel_direct_private_booking(${booking}::uuid)`,
        );
        assert.equal(
          (
            await db`select status from app.coach_availability_slots where id=${slot}::uuid`
          )[0].status,
          "withdrawn",
        );
        assert.ok(
          Number(
            (
              await db`select count(*) n from app.message_entries e join app.message_conversations c on c.id=e.conversation_id where c.coach_profile_id=${coach.profileId}::uuid`
            )[0].n,
          ) >= 3,
        );
        await resetSchedule();
      },
    );
    await t.test(
      "recurrence skips reserved time, retains rules and generates only previously uncreated time after release",
      async () => {
        const d = await save();
        await publish(d);
        const location = (
          await db`select updated_at::text updated_at from app.coach_training_locations where id=${locationId}::uuid`
        )[0];
        const local = (
          await db`select extract(isodow from ${d.startsAt}::timestamptz at time zone 'Europe/Berlin')::integer weekday,(${d.startsAt}::timestamptz at time zone 'Europe/Berlin')::time start_time`
        )[0];
        await run(
          coach,
          sql`select app.create_owned_coach_availability_rule(${locationId}::uuid,${location.updated_at}::timestamptz,${local.weekday}::smallint,${local.start_time}::time)`,
        );
        assert.equal(
          Number(
            (
              await db`select count(*) n from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and starts_at=${d.startsAt}::timestamptz`
            )[0].n,
          ),
          0,
        );
        assert.equal(
          Number(
            (
              await db`select count(*) n from app.coach_availability_rules where profile_id=${coach.profileId}::uuid and status='active'`
            )[0].n,
          ),
          1,
        );
        await cancel(d.id);
        await run(
          coach,
          sql`select app.synchronize_owned_coach_availability()`,
        );
        const [slot] =
          await db`select id from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and starts_at=${d.startsAt}::timestamptz`;
        assert.ok(slot);
        await closeSlot(slot.id);
        await run(
          coach,
          sql`select app.synchronize_owned_coach_availability()`,
        );
        assert.equal(
          (
            await db`select status from app.coach_availability_slots where id=${slot.id}::uuid`
          )[0].status,
          "withdrawn",
        );
        const oldRule = (
          await db`select id from app.coach_availability_rules where profile_id=${coach.profileId}::uuid and status='active'`
        )[0].id;
        await run(
          coach,
          sql`select app.remove_owned_coach_availability_rule(${oldRule}::uuid)`,
        );
        await run(
          coach,
          sql`select app.create_owned_coach_availability_rule(${locationId}::uuid,${location.updated_at}::timestamptz,${local.weekday}::smallint,${local.start_time}::time)`,
        );
        assert.equal(
          Number(
            (
              await db`select count(*) n from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and starts_at=${d.startsAt}::timestamptz`
            )[0].n,
          ),
          1,
        );
        assert.equal(
          (
            await db`select status from app.coach_availability_slots where id=${slot.id}::uuid`
          )[0].status,
          "withdrawn",
        );
        await resetSchedule();
        const distant = await save({
          startsAt: future(15).toISOString(),
          endsAt: future(15, 11).toISOString(),
          decisionDeadlineAt: future(14).toISOString(),
        });
        assert.equal((await publish(distant)).outcome, "published");
        await resetSchedule();
      },
    );
    await t.test(
      "guard contention aborts safely, exact retries recover, unknown errors are not retried",
      async () => {
        const d = await save();
        let release!: () => void;
        let locked!: () => void;
        const ready = new Promise<void>((r) => (locked = r));
        const gate = new Promise<void>((r) => (release = r));
        const holder = db.begin(async (tx) => {
          await tx`select pg_advisory_xact_lock(hashtextextended(concat(${coach.runId}::text,':',${coach.profileId}::text),0))`;
          locked();
          await gate;
        });
        await ready;
        let attempts = 0;
        try {
          const result = await withActorDatabaseContext(coach, async (tx) => {
            attempts++;
            if (attempts === 2) {
              release();
              await holder;
            }
            return groupSessionCommandRecord(tx, {
              action: "publish",
              args: { id: d.id, expectedRevision: 1 },
            });
          });
          assert.equal(result.outcome, "published");
          assert.equal(attempts, 2);
        } finally {
          release();
          await holder;
        }
        let calls = 0;
        await assert.rejects(
          withActorDatabaseContext(coach, async () => {
            calls++;
            throw Object.assign(new Error("unknown outcome"), {
              code: "40001",
            });
          }),
        );
        assert.equal(calls, 1);
        await resetSchedule();
      },
    );
    await t.test(
      "publication versus recurring materialization preserves one occupied interval",
      async () => {
        const d = await save();
        const [location] =
          await db`select updated_at::text version from app.coach_training_locations where id=${locationId}::uuid`;
        const [local] =
          await db`select extract(isodow from ${d.startsAt}::timestamptz at time zone 'Europe/Berlin')::integer weekday,(${d.startsAt}::timestamptz at time zone 'Europe/Berlin')::time starts`;
        const [publication] = await Promise.all([
          publish(d),
          run(
            coach,
            sql`select app.create_owned_coach_availability_rule(${locationId}::uuid,${location.version}::timestamptz,${local.weekday}::smallint,${local.starts}::time)`,
          ),
        ]);
        const slots = Number(
          (
            await db`select count(*) n from app.coach_availability_slots where profile_id=${coach.profileId}::uuid and starts_at=${d.startsAt}::timestamptz and status<>'withdrawn'`
          )[0].n,
        );
        assert.equal((publication.outcome === "published" ? 1 : 0) + slots, 1);
        assert.equal(
          Number(
            (
              await db`select count(*) n from app.coach_availability_rules where profile_id=${coach.profileId}::uuid and status='active'`
            )[0].n,
          ),
          1,
        );
        await resetSchedule();
      },
    );
    await t.test(
      "cancellation racing with a replacement publication releases only the original hold",
      async () => {
        const a = await save();
        await publish(a);
        const b = await save();
        const [released, result] = await Promise.all([
          cancel(a.id),
          publish(b),
        ]);
        assert.equal(released.outcome, "cancelled");
        assert.ok(["published", "conflict"].includes(result.outcome));
        assert.equal((await publish(b)).outcome, "published");
        assert.equal(
          (
            await db`select status from app.coach_group_sessions where id=${a.id}::uuid`
          )[0].status,
          "cancelled",
        );
        assert.equal(
          Number(
            (
              await db`select count(*) n from app.coach_group_sessions where coach_profile_id=${coach.profileId}::uuid and status='open'`
            )[0].n,
          ),
          1,
        );
        await resetSchedule();
      },
    );
    await t.test(
      "publication rechecks deadline after a held draft-row lock",
      async () => {
        const deadline = new Date(Date.now() + 1100);
        const d = await save({ decisionDeadlineAt: deadline.toISOString() });
        let locked!: () => void;
        const ready = new Promise<void>((r) => (locked = r));
        const holder = db.begin(async (tx) => {
          await tx`select id from app.coach_group_sessions where id=${d.id}::uuid for update`;
          locked();
          await new Promise((r) =>
            setTimeout(r, Math.max(0, deadline.getTime() + 80 - Date.now())),
          );
        });
        await ready;
        const pending = publish(d);
        await holder;
        assert.equal((await pending).outcome, "unavailable");
        assert.equal(
          (
            await db`select status from app.coach_group_sessions where id=${d.id}::uuid`
          )[0].status,
          "draft",
        );
        await resetSchedule();
      },
    );
    await t.test(
      "a private write reconciles missed group decisions and preserves registration history",
      async () => {
        const deadline = new Date(Date.now() + 1800);
        const d = await save({ decisionDeadlineAt: deadline.toISOString() });
        await publish(d);
        const joined = await command(athlete, {
          action: "join",
          args: { id: d.id, registrationId: randomUUID() },
        });
        assert.equal(joined.outcome, "joined");
        await new Promise((r) =>
          setTimeout(r, Math.max(0, deadline.getTime() + 60 - Date.now())),
        );
        const slot = await createSlot(d.startsAt);
        assert.ok(slot);
        const [state] =
          await db`select s.status,r.status registration_status from app.coach_group_sessions s join app.coach_group_registrations r on r.session_id=s.id where s.id=${d.id}::uuid`;
        assert.equal(state.status, "not-confirmed");
        assert.equal(state.registration_status, "session-not-confirmed");
        assert.equal((await publish(d)).outcome, "unavailable");
        await resetSchedule();
      },
    );
    await t.test(
      "confirmed reservations survive visibility changes and remain occupied during training",
      async () => {
        const d = await save();
        await publish(d);
        const joined = await command(athlete, {
          action: "join",
          args: { id: d.id, registrationId: randomUUID() },
        });
        await command(coach, {
          action: "approve-registration",
          args: { id: d.id, registrationId: joined.registration!.id },
        });
        await command(coach, { action: "confirm", args: { id: d.id } });
        await db`update app.coach_profiles set visibility='hidden' where profile_id=${coach.profileId}::uuid`;
        assert.equal(
          (
            await db`select app.group_time_reserved(${coach.runId}::uuid,${coach.profileId}::uuid,${d.startsAt}::timestamptz,${d.endsAt}::timestamptz) occupied`
          )[0].occupied,
          true,
        );
        await db`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
        await resetSchedule();
        const source = await save();
        const id = randomUUID();
        const now = new Date();
        const [window] = await db`select
          greatest(clock_timestamp()-interval '1 hour',date_trunc('day',clock_timestamp() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin') starts,
          least(clock_timestamp()+interval '1 hour',(date_trunc('day',clock_timestamp() at time zone 'Europe/Berlin')+interval '1 day') at time zone 'Europe/Berlin'-interval '1 millisecond') ends`;
        const starts = new Date(window.starts);
        const ends = new Date(window.ends);
        // Administrator-only historical fixture represents a confirmed session already underway.
        await db`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,created_at,updated_at,published_at,confirmed_at,confirmed_by_profile_id,published_from_revision)
        select ${id}::uuid,run_id,coach_profile_id,${"group-" + id.replaceAll("-", "")},title,description,discipline,intended_level,training_location_id,venue_snapshot,${starts},${ends},${new Date(starts.getTime() - 3600000)},1,5,0,'confirmed',${new Date(starts.getTime() - 10800000)},${new Date(starts.getTime() - 7200000)},${new Date(starts.getTime() - 10800000)},${new Date(starts.getTime() - 7200000)},coach_profile_id,1 from app.coach_group_sessions where id=${source.id}::uuid`;
        const incoming = new Date(now.getTime() + 300000);
        incoming.setUTCSeconds(0, 0);
        assert.equal(
          (
            await db`select app.group_time_reserved(${coach.runId}::uuid,${coach.profileId}::uuid,clock_timestamp(),${ends}::timestamptz) occupied`
          )[0].occupied,
          true,
        );
        if (incoming < ends)
          await assert.rejects(createSlot(incoming.toISOString()));
        assert.equal(
          (
            await db`select status from app.coach_group_sessions where id=${id}::uuid`
          )[0].status,
          "confirmed",
        );
        await resetSchedule();
      },
    );
    await t.test(
      "profile row edits acquire the shared guard before calling recurrence",
      async () => {
        const d = await save();
        let release!: () => void;
        let locked!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        const ready = new Promise<void>((r) => (locked = r));
        const holder = db.begin(async (tx) => {
          await tx`update app.coach_profiles set display_name=display_name where profile_id=${coach.profileId}::uuid`;
          locked();
          await gate;
        });
        await ready;
        let attempts = 0;
        try {
          const result = await withActorDatabaseContext(coach, async (tx) => {
            attempts++;
            if (attempts === 2) {
              release();
              await holder;
            }
            return groupSessionCommandRecord(tx, {
              action: "publish",
              args: { id: d.id, expectedRevision: 1 },
            });
          });
          assert.equal(result.outcome, "published");
          assert.equal(attempts, 2);
        } finally {
          release();
          await holder;
        }
        await resetSchedule();
      },
    );
    await t.test(
      "suspension blocks publication but retains confirmed time and safe cancellation",
      async () => {
        const d = await save();
        await publish(d);
        const joined = await command(athlete, {
          action: "join",
          args: { id: d.id, registrationId: randomUUID() },
        });
        await command(coach, {
          action: "approve-registration",
          args: { id: d.id, registrationId: joined.registration!.id },
        });
        await command(coach, { action: "confirm", args: { id: d.id } });
        const blocked = await save({
          startsAt: future(3, 14).toISOString(),
          endsAt: future(3, 15).toISOString(),
        });
        await db`select app.review_coach_application(${coach.profileId}::uuid,'approved','suspended','Isolated schedule suspension.','database-test','movx-identity-application-v1')`;
        await assert.rejects(publish(blocked));
        assert.equal(
          (
            await db`select app.group_time_reserved(${coach.runId}::uuid,${coach.profileId}::uuid,${d.startsAt}::timestamptz,${d.endsAt}::timestamptz) occupied`
          )[0].occupied,
          true,
        );
        await cancel(d.id);
        assert.equal(
          (
            await db`select app.group_time_reserved(${coach.runId}::uuid,${coach.profileId}::uuid,${d.startsAt}::timestamptz,${d.endsAt}::timestamptz) occupied`
          )[0].occupied,
          false,
        );
        await resetSchedule();
      },
    );
  } finally {
    try {
      await cleanup();
    } finally {
      await db.end({ timeout: 2 });
    }
  }
});
