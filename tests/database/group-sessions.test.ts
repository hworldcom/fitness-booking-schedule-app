import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import {
  parseGroupSessionResult,
  type GroupDraftInput,
  type GroupCursor,
  type GroupPage,
  type GroupSession,
} from "@/domain/group-sessions";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { groupSessionCommandRecord } from "@/server/db/group-sessions/repository";

const url = process.env.DATABASE_TEST_URL;
if (!url)
  throw new Error("DATABASE_TEST_URL is required for group-session tests.");
const target = new URL(url);
if (!["localhost", "127.0.0.1"].includes(target.hostname))
  throw new Error("Group-session fixtures require loopback PostgreSQL.");
const runtimeUrl = new URL(url);
runtimeUrl.username = "repx_runtime_login";
runtimeUrl.password = "postgres";
process.env.DATABASE_URL = runtimeUrl.toString();
type Actor = AuthorizedActor;

test("group session data, registration, privacy and concurrent lifecycle authority", async (t) => {
  const db = postgres(url, {
    max: 10,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  const actors: Actor[] = [];
  const privateRun = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const authIds: string[] = [];
  async function actor(name: string): Promise<Actor> {
    const authUserId = randomUUID();
    authIds.push(authUserId);
    await db`insert into auth.users(id,is_sso_user,is_anonymous) values(${authUserId}::uuid,false,false)`;
    const [p] =
      await db`select * from app.enroll_application_identity(${authUserId}::uuid,${name})`;
    const a = {
      authUserId,
      profileId: p.identity_profile_id as string,
      runId: p.identity_run_id as string,
      runRole: "member" as const,
    };
    actors.push(a);
    return a;
  }
  async function asActor<T>(
    a: Actor,
    work: (tx: postgres.TransactionSql) => Promise<T>,
  ) {
    return db.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      await tx`select set_config('app.current_auth_user_id',${a.authUserId},true),set_config('app.current_profile_id',${a.profileId},true),set_config('app.current_run_id',${a.runId},true),set_config('app.current_run_role','member',true)`;
      return work(tx);
    }) as Promise<T>;
  }
  const command = async (
    a: Actor,
    action: string,
    args: Record<string, unknown>,
  ) =>
    asActor(
      a,
      async (tx) =>
        (
          await tx`select app.group_session_command(${action},${tx.json(args as postgres.JSONValue)}) result`
        )[0].result,
    );
  const publicly = async (action: string, args: Record<string, unknown> = {}) =>
    db.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      return (
        await tx`select app.public_group_sessions(${action},${tx.json(args as postgres.JSONValue)}) result`
      )[0].result;
    });
  let coach: Actor;
  let athletes: Actor[];
  let locationId: string;
  const future = (days = 4, hour = 10) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(hour, 0, 0, 0);
    return date;
  };
  function draft(change: Partial<GroupDraftInput> = {}): GroupDraftInput {
    const starts = future();
    const ends = new Date(starts.getTime() + 90 * 60000);
    return {
      id: randomUUID(),
      expectedRevision: null,
      title: "Group footwork " + suffix,
      description:
        "Small group boxing practice at the coach's chosen training location.",
      discipline: "Boxing",
      intendedLevel: "All levels",
      locationId,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      decisionDeadlineAt: new Date(starts.getTime() - 3600000).toISOString(),
      minimumParticipants: 2,
      maximumParticipants: 4,
      priceCents: 1500,
      ...change,
    };
  }
  async function fixture(
    change: Partial<GroupDraftInput> = {},
    owner = coach,
    selectedLocation = locationId,
    confirmed = false,
  ): Promise<GroupSession> {
    const d = draft({ ...change, locationId: selectedLocation });
    const deadline = new Date(d.decisionDeadlineAt);
    const published = new Date(
      Math.min(Date.now() - 1000, deadline.getTime() - 60000),
    );
    // Database-administrator fixtures only. No application publication function,
    // executable flag or runtime grant is created for these records.
    await db`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,created_at,published_at,confirmed_at,confirmed_by_profile_id)
      select ${d.id}::uuid,${owner.runId}::uuid,${owner.profileId}::uuid,${"group-" + d.id.replaceAll("-", "")},${d.title},${d.description},${d.discipline},${d.intendedLevel},l.id,
        jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),
        ${d.startsAt}::timestamptz,${d.endsAt}::timestamptz,${d.decisionDeadlineAt}::timestamptz,${d.minimumParticipants},${d.maximumParticipants},${d.priceCents},${confirmed ? "confirmed" : "open"},${new Date(published.getTime() - 1000)},${published},${confirmed ? published : null},${confirmed ? owner.profileId : null}::uuid
      from app.coach_training_locations l where l.id=${selectedLocation}::uuid and l.run_id=${owner.runId}::uuid and l.profile_id=${owner.profileId}::uuid`;
    return parseGroupSessionResult(
      "detail",
      await command(owner, "detail", { id: d.id }),
    ).session;
  }
  async function join(
    a: Actor,
    session: GroupSession,
    registrationId: string = randomUUID(),
  ) {
    return parseGroupSessionResult(
      "join",
      await command(a, "join", { id: session.id, registrationId }),
    );
  }
  async function detail(a: Actor, id: string) {
    return parseGroupSessionResult(
      "detail",
      await command(a, "detail", { id }),
    );
  }
  async function cleanup() {
    const ids = actors.map((a) => a.profileId);
    if (ids.length) {
      await db`delete from app.coach_group_registrations where athlete_profile_id in ${db(ids)} or session_id in (select id from app.coach_group_sessions where coach_profile_id in ${db(ids)})`;
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
    await db`delete from app.demo_runs where id=${privateRun}::uuid`;
    if (authIds.length)
      await db`delete from auth.users where id in ${db(authIds)}`;
  }
  try {
    assert.ok(
      (await db`select to_regclass('app.coach_group_sessions') present`)[0]
        .present,
      "Apply the DEV0237 migration before integration tests.",
    );
    coach = await actor("Group Coach " + suffix);
    athletes = await Promise.all(
      [0, 1, 2, 3].map((n) => actor("Group Athlete " + suffix + n)),
    );
    await asActor(coach, async (tx) => {
      await tx`select app.submit_owned_coach_application()`;
      await tx`select app.upsert_owned_coach_profile(${"Group Coach " + suffix},'Small group coaching fixture for exact authority and real database race validation.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
    });
    await db`select app.review_coach_application(${coach.profileId}::uuid,'pending','approved','Group fixture reviewed for isolated tests.','database-test','movx-identity-application-v1')`;
    await db`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
    locationId = (
      await db`select id from app.coach_training_locations where run_id=${coach.runId}::uuid and profile_id=${coach.profileId}::uuid and status='active' order by is_primary desc limit 1`
    )[0].id;

    await t.test(
      "approved owner drafts use stable identity, EUR terms, owned venues and optimistic revisions",
      async () => {
        const input = draft({ priceCents: 0 });
        const saved = await withActorDatabaseContext(coach, (tx) =>
          groupSessionCommandRecord(tx, { action: "save-draft", args: input }),
        );
        assert.equal(saved.outcome, "saved");
        assert.equal(saved.session?.status, "draft");
        assert.equal(saved.session?.currency, "EUR");
        assert.equal(saved.session?.priceCents, 0);
        assert.equal(
          (await command(coach, "save-draft", input)).session.id,
          input.id,
        );
        const changed = await command(coach, "save-draft", {
          ...input,
          expectedRevision: 1,
          title: "Updated group footwork",
        });
        assert.equal(changed.session.revision, 2);
        await assert.rejects(
          command(coach, "save-draft", {
            ...input,
            expectedRevision: 1,
            priceCents: 1800,
          }),
        );
        await assert.rejects(command(athletes[0], "save-draft", draft()));
        await assert.rejects(command(athletes[0], "detail", { id: input.id }));
        assert.equal(
          (await publicly("detail", { slug: changed.session.slug })).session,
          null,
        );
        await command(coach, "delete-draft", {
          id: input.id,
          expectedRevision: 2,
        });
        assert.equal(
          (
            await db`select count(*) n from app.coach_group_sessions where id=${input.id}::uuid`
          )[0].n,
          "0",
        );
      },
    );
    await t.test(
      "database rejects unowned/unsupported/invalid draft terms including Berlin DST gaps and overlaps",
      async () => {
        const otherLocation = (
          await db`select id from app.coach_training_locations where profile_id<>${coach.profileId}::uuid limit 1`
        )[0].id;
        for (const change of [
          { locationId: otherLocation },
          { discipline: "MMA" },
          { minimumParticipants: 0 },
          { maximumParticipants: 101 },
          { priceCents: -1 },
          { priceCents: 0.5 },
          { endsAt: new Date(future().getTime() + 86400000).toISOString() },
          {
            startsAt: "2030-10-27T01:30:00Z",
            endsAt: "2030-10-27T02:30:00Z",
            decisionDeadlineAt: "2030-10-26T10:00:00Z",
          },
        ])
          await assert.rejects(
            command(coach, "save-draft", { ...draft(), ...change }),
          );
        // A nonexistent local spring time must not be silently normalized by the UI.
        assert.equal(
          (
            await db`select app.coach_local_time_is_unambiguous('2030-03-31 02:30'::timestamp,'Europe/Berlin') valid`
          )[0].valid,
          false,
        );
      },
    );
    await t.test(
      "raw runtime reads/writes, forged flags, helper calls and publication remain denied",
      async () => {
        const input = draft();
        await command(coach, "save-draft", input);
        await assert.rejects(
          asActor(coach, (tx) => tx`select * from app.coach_group_sessions`),
        );
        await assert.rejects(
          asActor(coach, async (tx) => {
            await tx`select set_config('app.group_session_management','on',true)`;
            return tx`select * from app.coach_group_registrations`;
          }),
        );
        await assert.rejects(
          asActor(
            coach,
            (tx) =>
              tx`select app.group_session_projection(${input.id}::uuid,${coach.profileId}::uuid)`,
          ),
        );
        await assert.rejects(command(coach, "publish", { id: input.id }));
        await assert.rejects(
          db.begin(async (tx) => {
            await tx.unsafe("set local role app_owner");
            await tx`select set_config('app.group_session_management','on',true)`;
            await tx`update app.coach_group_sessions set status='open',published_at=clock_timestamp() where id=${input.id}::uuid`;
          }),
        );
      },
    );
    await t.test(
      "joins reserve seats without confirming; public counts and private rosters remain separate",
      async () => {
        const s = await fixture();
        await join(athletes[0], s);
        await join(athletes[1], s);
        assert.equal((await detail(coach, s.id)).session.status, "open");
        const publicDetail = parseGroupSessionResult(
          "public-detail",
          await publicly("detail", { slug: s.slug }),
        );
        assert.equal(publicDetail.session?.participantCount, 2);
        assert.equal(publicDetail.session?.canConfirm, false);
        const serialized = JSON.stringify(publicDetail);
        for (const a of athletes)
          assert.equal(serialized.includes(a.profileId), false);
        const roster = parseGroupSessionResult(
          "roster",
          await command(coach, "roster", { id: s.id }),
        );
        assert.equal(roster.items.length, 2);
        assert.ok(roster.items.every((r) => r.initials && r.name));
        assert.equal(JSON.stringify(roster).includes("authUser"), false);
        await assert.rejects(command(athletes[0], "roster", { id: s.id }));
        await assert.rejects(join(coach, s));
        await assert.rejects(command(athletes[0], "confirm", { id: s.id }));
      },
    );
    await t.test(
      "last-seat joins, exact and duplicate retries never exceed capacity",
      async () => {
        const s = await fixture({
          minimumParticipants: 1,
          maximumParticipants: 1,
        });
        const results = await Promise.allSettled([
          join(athletes[0], s),
          join(athletes[1], s),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const winner =
          results[0].status === "fulfilled" ? athletes[0] : athletes[1];
        const first = (
          results.find(
            (r) => r.status === "fulfilled",
          ) as PromiseFulfilledResult<Awaited<ReturnType<typeof join>>>
        ).value;
        const operation = first.registration!.id;
        assert.equal(
          (await join(winner, s, operation)).registration?.id,
          operation,
        );
        assert.equal((await join(winner, s)).registration?.id, operation);
        assert.equal((await detail(coach, s.id)).session.participantCount, 1);
        await assert.rejects(
          join(
            winner === athletes[0] ? athletes[1] : athletes[0],
            s,
            operation,
          ),
        );
      },
    );
    await t.test(
      "withdraw/rejoin keeps attempts and stale withdrawal never removes a replacement",
      async () => {
        const s = await fixture();
        const first = await join(athletes[0], s);
        const old = first.registration!.id;
        await command(athletes[0], "withdraw", {
          id: s.id,
          registrationId: old,
        });
        const retry = await join(athletes[0], s, old);
        assert.equal(retry.outcome, "unavailable");
        assert.equal(retry.registration?.status, "withdrawn");
        const replacement = await join(athletes[0], s);
        assert.notEqual(replacement.registration!.id, old);
        await command(athletes[0], "withdraw", {
          id: s.id,
          registrationId: old,
        });
        assert.equal(
          (await detail(athletes[0], s.id)).registration?.id,
          replacement.registration!.id,
        );
        assert.equal((await detail(coach, s.id)).session.participantCount, 1);
        const all = parseGroupSessionResult(
          "registrations",
          await command(athletes[0], "registrations", {}),
        );
        assert.equal(all.items.filter((i) => i.session.id === s.id).length, 2);
      },
    );
    await t.test(
      "only explicit minimum-qualified confirmation wins and later withdrawal never reverses it",
      async () => {
        const s = await fixture();
        const r = await join(athletes[0], s);
        await assert.rejects(command(coach, "confirm", { id: s.id }));
        await join(athletes[1], s);
        const results = await Promise.all([
          command(coach, "confirm", { id: s.id }),
          command(coach, "confirm", { id: s.id }),
        ]);
        assert.ok(results.every((r) => r.outcome === "confirmed"));
        const stamp = results[0].session.confirmedAt;
        assert.equal(results[1].session.confirmedAt, stamp);
        await command(athletes[0], "withdraw", {
          id: s.id,
          registrationId: r.registration!.id,
        });
        const after = (await detail(coach, s.id)).session;
        assert.equal(after.status, "confirmed");
        assert.equal(after.participantCount, 1);
        assert.equal(after.confirmedAt, new Date(stamp).toISOString());
      },
    );
    await t.test(
      "confirm versus withdrawal is atomic at the minimum",
      async () => {
        const s = await fixture();
        const r = await join(athletes[0], s);
        await join(athletes[1], s);
        const [confirmed] = await Promise.allSettled([
          command(coach, "confirm", { id: s.id }),
          command(athletes[0], "withdraw", {
            id: s.id,
            registrationId: r.registration!.id,
          }),
        ]);
        const after = (await detail(coach, s.id)).session;
        assert.equal(after.participantCount, 1);
        assert.equal(
          after.status,
          confirmed.status === "fulfilled" ? "confirmed" : "open",
        );
      },
    );
    await t.test(
      "an expired undecided session is not confirmed even when minimum was met",
      async () => {
        const s = await fixture({
          minimumParticipants: 1,
          decisionDeadlineAt: new Date(Date.now() - 1000).toISOString(),
        });
        assert.equal(s.status, "not-confirmed");
        const result = await command(coach, "confirm", { id: s.id });
        assert.equal(result.outcome, "unavailable");
        assert.equal(result.session.status, "not-confirmed");
        assert.equal((await join(athletes[0], s)).outcome, "unavailable");
      },
    );
    await t.test(
      "a confirmation waiting on the row lock rechecks time after the deadline",
      async () => {
        const deadline = new Date(Date.now() + 1000);
        const s = await fixture({
          minimumParticipants: 1,
          decisionDeadlineAt: deadline.toISOString(),
        });
        const r = await join(athletes[0], s);
        let locked!: () => void;
        const ready = new Promise<void>((resolve) => {
          locked = resolve;
        });
        const holder = db.begin(async (tx) => {
          await tx`select id from app.coach_group_sessions where id=${s.id}::uuid for update`;
          locked();
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.max(0, deadline.getTime() - Date.now() + 80),
            ),
          );
        });
        await ready;
        const confirmation = command(coach, "confirm", { id: s.id });
        await holder;
        const result = await confirmation;
        assert.equal(result.outcome, "unavailable");
        assert.equal(result.session.status, "not-confirmed");
        assert.equal(
          (await detail(athletes[0], s.id)).registration?.status,
          "session-not-confirmed",
        );
        const withdraw = await command(athletes[0], "withdraw", {
          id: s.id,
          registrationId: r.registration!.id,
        });
        assert.equal(withdraw.outcome, "unavailable");
      },
    );
    await t.test(
      "cancellation races release all active attempts and exact retries retain history",
      async () => {
        const s = await fixture();
        await join(athletes[0], s);
        await join(athletes[1], s);
        const results = await Promise.all([
          command(coach, "cancel", { id: s.id }),
          command(coach, "cancel", { id: s.id }),
        ]);
        assert.ok(results.every((r) => r.session.status === "cancelled"));
        assert.equal(results[0].session.closedAt, results[1].session.closedAt);
        assert.equal((await detail(coach, s.id)).session.participantCount, 0);
        assert.equal(
          (await detail(athletes[1], s.id)).registration?.status,
          "session-cancelled",
        );
        assert.equal((await join(athletes[2], s)).outcome, "unavailable");
        await assert.rejects(
          db`update app.coach_group_sessions set status='open',closed_at=null,closed_by_profile_id=null where id=${s.id}::uuid`,
        );
      },
    );
    await t.test(
      "published terms and venue stay frozen when profile locations change",
      async () => {
        const s = await fixture();
        await assert.rejects(
          db`update app.coach_group_sessions set price_cents=price_cents+1 where id=${s.id}::uuid`,
        );
        await assert.rejects(
          db`update app.coach_group_sessions set starts_at=starts_at+interval '1 hour' where id=${s.id}::uuid`,
        );
        const [before] =
          await db`select public_name from app.coach_training_locations where id=${locationId}::uuid`;
        await db`update app.coach_training_locations set public_name='Renamed group fixture place' where id=${locationId}::uuid`;
        assert.equal(
          (await detail(coach, s.id)).session.venue.name,
          s.venue.name,
        );
        await db`update app.coach_training_locations set public_name=${before.public_name} where id=${locationId}::uuid`;
      },
    );
    await t.test(
      "hidden coaches lose new joins and confirmation but retain participant history",
      async () => {
        const s = await fixture();
        const r = await join(athletes[0], s);
        await db`update app.coach_profiles set visibility='hidden' where profile_id=${coach.profileId}::uuid`;
        assert.equal(
          (await publicly("detail", { slug: s.slug })).session,
          null,
        );
        await assert.rejects(join(athletes[1], s));
        await assert.rejects(command(coach, "confirm", { id: s.id }));
        assert.equal(
          (await detail(athletes[0], s.id)).registration?.id,
          r.registration!.id,
        );
        assert.equal(
          (await join(athletes[0], s, r.registration!.id)).registration?.id,
          r.registration!.id,
        );
        await db`update app.coach_profiles set visibility='visible' where profile_id=${coach.profileId}::uuid`;
      },
    );
    await t.test(
      "public sessions use frozen-venue filters and stable pages; own lists preserve every record",
      async () => {
        for (let n = 0; n < 23; n++)
          await fixture({
            title: "Pagination group " + n,
            priceCents: n % 2 ? 1500 : 0,
          });
        let after: GroupCursor | null = null;
        const seen: string[] = [];
        do {
          const page: GroupPage<GroupSession> = parseGroupSessionResult(
            "public-list",
            await publicly("list", {
              discipline: "Boxing",
              location: "",
              after,
            }),
          );
          seen.push(...page.items.map((s) => s.id));
          after = page.nextCursor;
        } while (after);
        assert.equal(new Set(seen).size, seen.length);
        assert.ok(seen.length >= 23);
        assert.equal(
          parseGroupSessionResult(
            "public-list",
            await publicly("list", {
              location: "A place that is absent " + suffix,
            }),
          ).items.length,
          0,
        );
        const owner = parseGroupSessionResult(
          "owner-list",
          await command(coach, "owner-list", {}),
        );
        assert.equal(owner.items.length, 20);
        assert.ok(owner.nextCursor);
        const next = parseGroupSessionResult(
          "owner-list",
          await command(coach, "owner-list", { after: owner.nextCursor }),
        );
        assert.ok(
          next.items.every(
            (s) => !owner.items.some((first) => first.id === s.id),
          ),
        );
      },
    );
    await t.test(
      "roster and own-attempt pages retain more than fifty withdrawal/rejoin attempts",
      async () => {
        const s = await fixture();
        const ids: string[] = [];
        for (let n = 0; n < 52; n++) {
          const attempt = (await join(athletes[0], s)).registration!;
          ids.push(attempt.id);
          await command(athletes[0], "withdraw", {
            id: s.id,
            registrationId: attempt.id,
          });
        }
        const first = parseGroupSessionResult(
          "roster",
          await command(coach, "roster", { id: s.id }),
        );
        const second = parseGroupSessionResult(
          "roster",
          await command(coach, "roster", { id: s.id, after: first.nextCursor }),
        );
        assert.equal(first.items.length, 50);
        assert.equal(second.items.length, 2);
        assert.deepEqual(
          [...first.items, ...second.items].map((r) => r.id),
          ids,
        );
        let after: GroupCursor | null = null;
        const own: string[] = [];
        do {
          const page: GroupPage<
            import("@/domain/group-sessions").GroupParticipation
          > = parseGroupSessionResult(
            "registrations",
            await command(athletes[0], "registrations", { after }),
          );
          own.push(
            ...page.items
              .filter((i) => i.session.id === s.id)
              .map((i) => i.registration.id),
          );
          after = page.nextCursor;
        } while (after);
        assert.deepEqual(own, ids.toReversed());
      },
    );
    await t.test(
      "confirmed sessions close joining at the deadline and elapsed sessions retain history",
      async () => {
        const deadline = new Date(Date.now() - 60000).toISOString();
        const upcoming = await fixture(
          { decisionDeadlineAt: deadline },
          coach,
          locationId,
          true,
        );
        assert.equal(
          (await join(athletes[1], upcoming)).outcome,
          "unavailable",
        );
        assert.equal(
          (await detail(coach, upcoming.id)).session.status,
          "confirmed",
        );
        const elapsed = await fixture(
          {
            startsAt: future(-2).toISOString(),
            endsAt: new Date(future(-2).getTime() + 3600000).toISOString(),
            decisionDeadlineAt: future(-3).toISOString(),
          },
          coach,
          locationId,
          true,
        );
        const registrationId = randomUUID();
        await db`insert into app.coach_group_registrations(id,run_id,session_id,athlete_profile_id,created_at) values(${registrationId}::uuid,${coach.runId}::uuid,${elapsed.id}::uuid,${athletes[0].profileId}::uuid,${future(-4)})`;
        const own = await detail(athletes[0], elapsed.id);
        assert.equal(own.session.displayStatus, "ended");
        assert.equal(own.registration?.canWithdraw, false);
        await assert.rejects(
          command(athletes[0], "withdraw", { id: elapsed.id, registrationId }),
        );
        assert.equal(
          (await command(coach, "cancel", { id: elapsed.id })).outcome,
          "unavailable",
        );
        assert.equal((await join(athletes[1], elapsed)).outcome, "unavailable");
      },
    );
    await t.test(
      "another dataset cannot read, join or list participant records from the public dataset",
      async () => {
        await db`insert into app.demo_runs(id,slug,name,status,catalogue_visibility,schedule_anchor_date,starts_at,ends_at) values(${privateRun}::uuid,${"group-isolation-" + suffix},'Group isolation','active','private','2030-10-13',statement_timestamp(),statement_timestamp()+interval '1 year')`;
        await db`insert into app.demo_run_participants(run_id,profile_id,role,status,joined_at) values(${privateRun}::uuid,${athletes[0].profileId}::uuid,'member','active',statement_timestamp())`;
        const foreign = { ...athletes[0], runId: privateRun };
        const s = await fixture();
        await assert.rejects(command(foreign, "detail", { id: s.id }));
        await assert.rejects(join(foreign, s));
        await assert.rejects(command(foreign, "registrations", {}));
        await assert.rejects(command(foreign, "owner-list", {}));
      },
    );
    await t.test(
      "participation never creates messages, private bookings or coach connections",
      async () => {
        const s = await fixture();
        await join(athletes[3], s);
        const [counts] = await db`select
        (select count(*) from app.message_conversations where coach_profile_id=${coach.profileId}::uuid) messages,
        (select count(*) from app.coach_private_bookings where coach_profile_id=${coach.profileId}::uuid) bookings,
        (select count(*) from app.coach_athlete_connection_pairs where coach_profile_id=${coach.profileId}::uuid) connections`;
        assert.equal(Number(counts.messages), 0);
        assert.equal(Number(counts.bookings), 0);
        assert.equal(Number(counts.connections), 0);
      },
    );
    await t.test(
      "suspension blocks new participation and confirmation while retaining owner cancellation",
      async () => {
        const s = await fixture({ minimumParticipants: 1 });
        await join(athletes[0], s);
        await db`select app.review_coach_application(${coach.profileId}::uuid,'approved','suspended','Isolated group suspension case.','database-test','movx-identity-application-v1')`;
        await assert.rejects(join(athletes[1], s));
        await assert.rejects(command(coach, "confirm", { id: s.id }));
        assert.equal(
          (await detail(athletes[0], s.id)).registration?.status,
          "active",
        );
        assert.equal(
          (await command(coach, "cancel", { id: s.id })).outcome,
          "cancelled",
        );
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
