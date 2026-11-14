import assert from "node:assert/strict";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { withCalendarExportWorker } from "@/server/db/google-calendar/export-worker";

const target = process.env.DATABASE_TEST_URL;
type Actor = { subject: string; profile: string; run: string };
test(
  "Calendar export SQL: canonical capture, opt-in, recipient/worker authority, fencing and recovery",
  {
    skip:
      !target ||
      !/^\/mov226_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(target).pathname),
  },
  async (t) => {
    const url = new URL(target!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "55322");
    const db = postgres(target!, {
      max: 6,
      prepare: false,
      onnotice: () => {},
    });
    const workerRole =
      "mov226_worker_" + randomUUID().replaceAll("-", "").slice(0, 12);
    const workerPassword = randomBytes(24).toString("hex");
    let roleCreated = false;
    const hash = (s: string) => createHash("sha256").update(s).digest("hex"),
      client = hash("export-client");
    const zero = "00000000-0000-0000-0000-000000000000";
    async function as<T>(
      a: Actor,
      work: (tx: postgres.TransactionSql) => Promise<T>,
    ) {
      return db.begin(async (tx) => {
        await tx`set local role app_runtime`;
        await tx`select set_config('app.current_auth_user_id',${a.subject},true),set_config('app.current_profile_id',${a.profile},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
        return work(tx);
      });
    }
    async function fn(
      a: Actor,
      name: string,
      ...args: postgres.ParameterOrJSON<never>[]
    ) {
      return as(
        a,
        async (tx) =>
          (
            await tx.unsafe(
              "select app." +
                name +
                "(" +
                args.map((_, i) => "$" + (i + 1)).join(",") +
                ") result",
              args,
            )
          )[0].result,
      );
    }
    const json = (value: unknown) => value as postgres.ParameterOrJSON<never>;
    async function worker(
      name: string,
      ...args: postgres.ParameterOrJSON<never>[]
    ) {
      return db.begin(async (tx) => {
        await tx`set local role app_calendar_worker`;
        return (
          await tx.unsafe(
            "select app." +
              name +
              "(" +
              args.map((_, i) => "$" + (i + 1)).join(",") +
              ") result",
            args,
          )
        )[0].result;
      });
    }
    const status = (a: Actor) => fn(a, "google_calendar_export_status");
    const connection = (a: Actor) => fn(a, "google_calendar_connection_status");
    const connCommand = (
      a: Actor,
      action: string,
      gen: string,
      input: object = {},
    ) => fn(a, "google_calendar_connection_command", action, gen, json(input));
    const work = (
      claim: { id: string; leaseId: string },
      action: string,
      input: object = {},
    ) =>
      worker(
        "google_calendar_export_work",
        claim.id,
        claim.leaseId,
        action,
        json(input),
      );
    async function preference(
      a: Actor,
      action: string,
      commandId = randomUUID(),
      ack = false,
    ) {
      const s = await status(a),
        c = await connection(a);
      return fn(
        a,
        "google_calendar_export_command",
        action,
        s.version,
        c.generation,
        commandId,
        ack,
      );
    }
    async function person(name: string, coach = false): Promise<Actor> {
      const subject = randomUUID();
      await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${subject}::uuid,${"export-" + subject + "@example.test"},clock_timestamp(),false,false)`;
      const [p] =
        await db`select * from app.enroll_application_identity(${subject}::uuid,${name})`;
      const a = {
        subject,
        profile: String(p.identity_profile_id),
        run: String(p.identity_run_id),
      };
      if (coach) {
        await fn(a, "submit_owned_coach_application");
        await fn(
          a,
          "save_owned_coach_application_contact",
          0,
          json({
            phoneNumber: "+4915112345678",
            instagramUrl: null,
            facebookUrl: null,
            linkedinUrl: null,
          }),
        );
        await fn(
          a,
          "upsert_owned_coach_profile",
          name,
          "Disposable Calendar export authority fixture.",
          ["Boxing"],
          "Europe/Berlin",
          "hidden",
          "40000000-0000-4000-8000-000000000001",
          null,
          null,
          null,
          null,
          null,
        );
        await db`select app.review_coach_application(${a.profile}::uuid,'pending','approved','Owned export fixture','mov226','movx-identity-application-v1')`;
        await db`update app.coach_profiles set visibility='visible' where profile_id=${a.profile}::uuid`;
      }
      return a;
    }
    async function connect(a: Actor, sub = "google-" + a.profile) {
      const c = await connection(a),
        state = hash(randomUUID()),
        browser = hash(randomUUID()),
        sessionId = randomUUID(),
        operationId = randomUUID();
      const begin = await connCommand(a, "begin", c.generation, {
        stateHash: state,
        browserHash: browser,
        sessionId,
        verifier: "encrypted-fixture-proof",
      });
      const gen = begin.record.generation;
      await connCommand(a, "claim-callback", gen, {
        stateHash: state,
        browserHash: browser,
        sessionId,
        operationId,
      });
      await connCommand(a, "credentials", gen, {
        operationId,
        sub,
        email: "fixture@example.test",
        clientHash: client,
        credential: "encrypted-fixture-refresh",
      });
      const boot = await connCommand(a, "bootstrap", gen, { operationId });
      if (boot.mode === "create")
        await connCommand(a, "record-calendar", gen, {
          operationId,
          sub,
          clientHash: client,
          calendarId: "fixture-" + randomUUID() + "@group.calendar.google.com",
        });
      assert.equal(
        (
          await connCommand(a, "finish", gen, {
            operationId,
            state: "connected",
            verified: true,
          })
        ).kind,
        "ok",
      );
    }
    async function claim() {
      for (let i = 0; i < 12; i++) {
        const c = await worker("google_calendar_export_claim", client);
        if (c?.kind === "progress") continue;
        return c;
      }
      throw Error("Backfill did not make bounded progress");
    }
    async function settleAll() {
      for (let i = 0; i < 100; i++) {
        const c = await claim();
        if (!c) return;
        const p = await work(c, "prepare");
        if (p.kind === "stale") {
          await work(c, "finish", { result: "retained" });
          continue;
        }
        await work(c, "dispatch");
        const outcome =
          p.desired.action === "upsert"
            ? "upserted"
            : p.desired.action === "delete"
              ? "deleted"
              : "retained";
        assert.equal((await work(c, "finish", { result: outcome })).kind, "ok");
      }
      throw Error("Unexpected unbounded queue");
    }
    async function step(name: string, scenario: () => Promise<void>) {
      let passed = false;
      await t.test(name, async () => {
        await scenario();
        passed = true;
      });
      if (!passed)
        throw Error("Stopped dependent export journey after a failed check.");
    }
    try {
      const coach = await person("Calendar export coach", true),
        athlete = await person("Calendar export athlete"),
        other = await person("Calendar unrelated athlete");
      await connect(coach);
      await connect(athlete);
      await connect(other);
      await step(
        "strict opt-in and worker/runtime separation, including a real restricted worker login",
        async () => {
          assert.equal((await status(athlete)).enabled, false);
          await assert.rejects(
            as(
              athlete,
              (tx) => tx`select * from app.google_calendar_export_events`,
            ),
          );
          await assert.rejects(
            as(
              athlete,
              (tx) => tx`select app.google_calendar_export_claim(${client})`,
            ),
          );
          await assert.rejects(
            worker(
              "google_calendar_export_command",
              "enable",
              zero,
              zero,
              randomUUID(),
              false,
            ),
          );
          await assert.rejects(
            worker(
              "google_calendar_export_work",
              randomUUID(),
              null,
              "finish",
              json({ result: "deleted" }),
            ),
          );
          await assert.rejects(
            fn(
              athlete,
              "google_calendar_export_command",
              null,
              zero,
              (await connection(athlete)).generation,
              randomUUID(),
              false,
            ),
          );
          await assert.rejects(
            fn(
              { ...athlete, subject: other.subject },
              "google_calendar_export_status",
            ),
          );
          await assert.rejects(
            db.begin(async (tx) => {
              await tx`set local role app_calendar_worker`;
              await tx`select * from auth.users`;
            }),
          );
          await db.unsafe(
            "create role " +
              workerRole +
              " login nosuperuser nocreatedb nocreaterole nobypassrls password '" +
              workerPassword +
              "'",
          );
          roleCreated = true;
          await db.unsafe("grant app_calendar_worker to " + workerRole);
          const workerUrl = new URL(target!);
          workerUrl.username = workerRole;
          workerUrl.password = workerPassword;
          assert.equal(
            await withCalendarExportWorker(workerUrl.toString(), client, (r) =>
              r.claim(),
            ),
            null,
          );
          await assert.rejects(
            withCalendarExportWorker(target, client, (r) => r.claim()),
            /restricted worker/,
          );
        },
      );
      const [venue] =
        await db`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profile}::uuid and is_primary`;
      const [day] =
        await db`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text target_date`;
      await fn(
        coach,
        "save_owned_effective_coach_availability",
        json({
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 0,
          dates: [
            {
              date: day.target_date,
              mode: "custom",
              hours: ["09:00", "10:00", "11:00", "14:00", "15:00"].map(
                (localStartTime) => ({
                  localStartTime,
                  locationId: venue.id,
                  locationUpdatedAt: venue.stamp,
                }),
              ),
            },
          ],
        }),
      );
      const [type] =
        await db`select id,revision,duration_minutes from app.coach_session_types where coach_profile_id=${coach.profile}::uuid and format='private' order by duration_minutes limit 1`;
      const starts = (time: string) =>
        String(day.target_date) + "T" + time + ":00 Europe/Berlin";
      async function booking(time: string) {
        const r = await fn(
          athlete,
          "request_session_type",
          randomUUID(),
          json({
            typeId: type.id,
            typeRevision: type.revision,
            locationId: venue.id,
            startsAt: starts(time),
          }),
        );
        await fn(coach, "accept_coach_booking_request", r.requestId);
        const [b] =
          await db`select id from app.coach_private_bookings where coach_profile_id=${coach.profile}::uuid and slot_id=(select slot_id from app.coach_booking_requests where id=${r.requestId}::uuid)`;
        return String(b.id);
      }
      const firstBooking = await booking("09:00");
      await step(
        "backfill is opt-in, two-party only and exact enable retry is idempotent",
        async () => {
          const [n] =
            await db`select count(*)::int n from app.google_calendar_export_events`;
          assert.equal(n.n, 0);
          const s = await status(athlete),
            c = await connection(athlete),
            id = randomUUID();
          assert.equal(
            await fn(
              athlete,
              "google_calendar_export_command",
              "enable",
              s.version,
              c.generation,
              id,
              false,
            ),
            "ok",
          );
          assert.equal(
            await fn(
              athlete,
              "google_calendar_export_command",
              "enable",
              s.version,
              c.generation,
              id,
              false,
            ),
            "ok",
          );
          assert.equal(
            await fn(
              athlete,
              "google_calendar_export_command",
              "disable",
              s.version,
              c.generation,
              id,
              false,
            ),
            "conflict",
          );
          assert.equal(await preference(coach, "enable"), "ok");
          assert.equal(await preference(other, "enable"), "ok");
          await settleAll();
          const rows =
            await db`select profile_id,event_id,marker from app.google_calendar_export_events where source_id=${firstBooking}::uuid and active order by profile_id`;
          assert.deepEqual(
            rows.map((r) => r.profile_id).sort(),
            [coach.profile, athlete.profile].sort(),
          );
          assert.ok(rows.every((r) => /^[a-v0-9]{5,1024}$/.test(r.event_id)));
          assert.equal((await status(other)).pending, 0);
          assert.equal((await status(other)).lastSyncedAt, null);
        },
      );
      const secondBooking = await booking("14:00");
      await step(
        "new canonical confirmations enqueue; source changes fence old claims and preserve exact original booking",
        async () => {
          const c = await claim();
          assert.ok(c);
          const p = await work(c, "prepare");
          assert.equal(p.kind, "prepared");
          assert.equal(p.desired.action, "upsert");
          assert.ok(!JSON.stringify(p.desired).includes(athlete.subject));
          assert.ok(!JSON.stringify(p.desired).includes("fixture@example"));
          await fn(
            coach,
            "coach_session_booking",
            randomUUID(),
            json({
              action: "override",
              bookingId: secondBooking,
              expectedRevision: 0,
              typeId: type.id,
              typeRevision: type.revision,
              locationId: venue.id,
              startsAt: starts("15:00"),
              durationMinutes: type.duration_minutes,
            }),
          );
          assert.equal((await work(c, "checkpoint")).kind, "stale");
          assert.equal(
            (await work(c, "finish", { result: "upserted" })).kind,
            "stale",
          );
          await settleAll();
          const [maps] =
            await db`select count(*)::int n,count(distinct event_id)::int ids from app.google_calendar_export_events where source_id=${secondBooking}::uuid and active`;
          assert.equal(maps.n, 2);
          assert.equal(maps.ids, 2);
          await fn(athlete, "cancel_direct_private_booking", secondBooking);
          await settleAll();
          assert.ok(
            (
              await db`select deleted_confirmed from app.google_calendar_export_events where source_id=${secondBooking}::uuid and active`
            ).every((x) => x.deleted_confirmed),
          );
        },
      );
      await step(
        "disable fences in-flight work, retains IDs, and re-enable reconciles the same target",
        async () => {
          const before =
            await db`select id,event_id from app.google_calendar_export_events where source_id=${firstBooking}::uuid and profile_id=${athlete.profile}::uuid and active`;
          await preference(athlete, "retry");
          const c = await claim();
          assert.ok(c);
          await work(c, "prepare");
          const [owner] =
            await db`select profile_id from app.google_calendar_export_events where id=${c.id}::uuid`;
          const actor = owner.profile_id === coach.profile ? coach : athlete;
          assert.equal(await preference(actor, "disable"), "ok");
          assert.equal(
            (
              await work(c, "credential", {
                credential: "rotated-fixture-credential",
              })
            ).kind,
            "stale",
          );
          const [saved] =
            await db`select state,credential_ciphertext from app.google_calendar_connections where profile_id=${actor.profile}::uuid and run_id=${actor.run}::uuid`;
          assert.equal(saved.state, "connected");
          assert.equal(
            saved.credential_ciphertext,
            "rotated-fixture-credential",
          );
          assert.equal((await work(c, "checkpoint")).kind, "stale");
          assert.equal(
            (await work(c, "finish", { result: "upserted" })).kind,
            "stale",
          );
          assert.equal((await status(actor)).enabled, false);
          await preference(actor, "enable");
          await settleAll();
          assert.deepEqual(
            await db`select id,event_id from app.google_calendar_export_events where source_id=${firstBooking}::uuid and profile_id=${athlete.profile}::uuid and active`,
            before,
          );
        },
      );
      await step(
        "group confirmation and exact approved participation govern copies; pending and withdrawn athletes do not export",
        async () => {
          const id = randomUUID();
          await db`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,published_at)
        select ${id}::uuid,${coach.run}::uuid,${coach.profile}::uuid,${"group-" + id.replaceAll("-", "")},'Private fixture title not exported','Owned export group','Boxing','All levels',l.id,
        jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),
        date_trunc('day',clock_timestamp())+interval '5 days 12 hours',date_trunc('day',clock_timestamp())+interval '5 days 13 hours',clock_timestamp()+interval '2 days',1,4,0,'open',clock_timestamp()
        from app.coach_training_locations l where l.profile_id=${coach.profile}::uuid and l.is_primary`;
          const reg = randomUUID(),
            pending = randomUUID();
          await fn(
            athlete,
            "group_session_command",
            "join",
            json({ id, registrationId: reg }),
          );
          await fn(
            other,
            "group_session_command",
            "join",
            json({ id, registrationId: pending }),
          );
          await fn(
            coach,
            "group_session_command",
            "approve-registration",
            json({ id, registrationId: reg }),
          );
          assert.equal(
            (
              await db`select count(*)::int n from app.google_calendar_export_events where source_id=${id}::uuid`
            )[0].n,
            0,
          );
          await fn(coach, "group_session_command", "confirm", json({ id }));
          await settleAll();
          assert.deepEqual(
            (
              await db`select profile_id from app.google_calendar_export_events where source_id=${id}::uuid and active`
            )
              .map((x) => x.profile_id)
              .sort(),
            [coach.profile, athlete.profile].sort(),
          );
          const [old] =
            await db`select id,event_id from app.google_calendar_export_events where source_id=${id}::uuid and profile_id=${athlete.profile}::uuid and active`;
          await fn(
            athlete,
            "group_session_command",
            "withdraw",
            json({ id, registrationId: reg }),
          );
          await settleAll();
          const rejoin = randomUUID();
          await fn(
            athlete,
            "group_session_command",
            "join",
            json({ id, registrationId: rejoin }),
          );
          await fn(
            coach,
            "group_session_command",
            "approve-registration",
            json({ id, registrationId: rejoin }),
          );
          await settleAll();
          const [fresh] =
            await db`select id,event_id from app.google_calendar_export_events where source_id=${id}::uuid and profile_id=${athlete.profile}::uuid and active`;
          assert.notEqual(fresh.id, old.id);
          assert.notEqual(fresh.event_id, old.event_id);
          await fn(coach, "group_session_command", "cancel", json({ id }));
          await settleAll();
          assert.ok(
            (
              await db`select deleted_confirmed from app.google_calendar_export_events where source_id=${id}::uuid and active`
            ).every((x) => x.deleted_confirmed),
          );
        },
      );
      await step(
        "parallel claims, expired-lease replay, bounded retry exhaustion and acknowledged missing-copy repair preserve one current target",
        async () => {
          await settleAll();
          const canonicalSnapshot = async () =>
            (
              await db`select jsonb_object_agg(name,hash) data from (
            select tablename name,(xpath('/table/row/hash/text()',query_to_xml(format(
              'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from app.%I x',tablename),false,false,'')))[1]::text hash
            from pg_tables where schemaname='app' and tablename !~ '^google_calendar_'
          ) snapshot`
            )[0].data;
          const canonicalBefore = await canonicalSnapshot();
          const [original] =
            await db`select id,event_id from app.google_calendar_export_events where source_id=${firstBooking}::uuid and profile_id=${athlete.profile}::uuid and active`;
          async function queue(id: string) {
            await db`update app.google_calendar_export_jobs set state='pending',attempts=0,next_at=clock_timestamp(),error=null,revision=revision+1 where event_id=${id}::uuid`;
          }
          await queue(original.id);
          const parallel = await Promise.all([claim(), claim()]);
          const claimed = parallel.filter((x) => x?.kind === "claimed");
          assert.equal(
            claimed.length,
            1,
            "only one live refresh/delivery lease per connection",
          );
          const old = claimed[0];
          assert.equal(old.id, original.id);
          await work(old, "prepare");
          await work(old, "dispatch");
          await db`update app.google_calendar_export_jobs set lease_until=clock_timestamp()-interval '1 second' where event_id=${old.id}::uuid`;
          await db`update app.google_calendar_connections set expires_at=clock_timestamp()-interval '1 second' where profile_id=${athlete.profile}::uuid and run_id=${athlete.run}::uuid`;
          const renewed = await claim();
          assert.equal(renewed.id, old.id);
          assert.notEqual(renewed.leaseId, old.leaseId);
          assert.equal(
            (await work(old, "finish", { result: "upserted" })).kind,
            "stale",
          );
          await work(renewed, "prepare");
          await assert.rejects(
            work(renewed, "finish", {}),
            /Invalid export outcome/,
          );
          await assert.rejects(
            work(renewed, "finish", { result: "retained" }),
            /does not match/,
          );
          assert.equal((await work(renewed, "checkpoint")).kind, "ok");
          await work(renewed, "finish", { result: "upserted" });
          await queue(original.id);
          for (let attempt = 1; attempt <= 8; attempt++) {
            const current = await claim();
            assert.equal(current.id, original.id);
            await work(current, "prepare");
            await work(current, "finish", { result: "transient" });
            const [job] =
              await db`select state,attempts,error,next_at>clock_timestamp() deferred from app.google_calendar_export_jobs where event_id=${current.id}::uuid`;
            assert.equal(job.attempts, attempt);
            assert.equal(job.deferred, true);
            assert.equal(job.state, attempt === 8 ? "failed" : "pending");
            if (attempt < 8)
              await db`update app.google_calendar_export_jobs set next_at=clock_timestamp() where event_id=${current.id}::uuid`;
          }
          assert.ok((await status(athlete)).issues.includes("retry-exhausted"));
          assert.equal(await claim(), null);
          await preference(athlete, "retry");
          await settleAll();
          assert.equal((await status(athlete)).failed, 0);
          const [unchanged] =
            await db`select event_id from app.google_calendar_export_events where id=${original.id}::uuid`;
          assert.equal(unchanged.event_id, original.event_id);
          await queue(original.id);
          const missing = await claim();
          await work(missing, "prepare");
          await work(missing, "finish", { result: "event-missing" });
          assert.equal((await status(athlete)).missing, 1);
          await preference(athlete, "retry");
          await settleAll();
          assert.equal(
            (await status(athlete)).missing,
            1,
            "ordinary retry cannot silently recreate a missing copy",
          );
          assert.equal(await preference(athlete, "repair"), "invalid");
          const setting = await status(athlete),
            conn = await connection(athlete),
            commandId = randomUUID();
          for (let i = 0; i < 2; i++)
            assert.equal(
              await fn(
                athlete,
                "google_calendar_export_command",
                "repair",
                setting.version,
                conn.generation,
                commandId,
                true,
              ),
              "ok",
            );
          await settleAll();
          const copies =
            await db`select id,event_id,active from app.google_calendar_export_events where source_id=${firstBooking}::uuid and profile_id=${athlete.profile}::uuid order by active`;
          assert.equal(copies.length, 2);
          assert.equal(copies[0].id, original.id);
          assert.equal(copies[0].active, false);
          assert.equal(copies[1].active, true);
          assert.notEqual(copies[1].event_id, original.event_id);
          assert.equal((await status(athlete)).missing, 0);
          assert.equal(
            (await work(missing, "finish", { result: "upserted" })).kind,
            "stale",
          );
          const priorSetting = await status(athlete),
            priorConnection = await connection(athlete),
            earlierCommand = randomUUID();
          assert.equal(
            await fn(
              athlete,
              "google_calendar_export_command",
              "retry",
              priorSetting.version,
              priorConnection.generation,
              earlierCommand,
              false,
            ),
            "ok",
          );
          await preference(athlete, "retry");
          assert.equal(
            await fn(
              athlete,
              "google_calendar_export_command",
              "retry",
              priorSetting.version,
              priorConnection.generation,
              earlierCommand,
              false,
            ),
            "conflict",
            "a reordered older recovery command cannot be accepted after a newer command",
          );
          await settleAll();
          assert.deepEqual(
            await canonicalSnapshot(),
            canonicalBefore,
            "Calendar retry/repair leaves canonical scheduling and notification queues unchanged",
          );
        },
      );
      await step(
        "recipient loss suppresses delivery at the next checkpoint and cannot be restored by a stale completion",
        async () => {
          await settleAll();
          const [mapping] =
            await db`select id from app.google_calendar_export_events where source_id=${firstBooking}::uuid and profile_id=${athlete.profile}::uuid and active`;
          await db`update app.google_calendar_export_jobs set state='pending',next_at=clock_timestamp(),revision=revision+1 where event_id=${mapping.id}::uuid`;
          const current = await claim();
          assert.equal(current.id, mapping.id);
          await work(current, "prepare");
          await db`update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=${athlete.subject}::uuid`;
          assert.equal((await work(current, "checkpoint")).kind, "stale");
          assert.equal(
            (await work(current, "finish", { result: "upserted" })).kind,
            "stale",
          );
          assert.equal(await claim(), null);
          await db`update auth.users set banned_until=null where id=${athlete.subject}::uuid`;
          await preference(athlete, "retry");
          await settleAll();
        },
      );
      await step(
        "already exported completed history is retained and bounded backfill advances beyond fifty sources",
        async () => {
          await settleAll();
          const history =
            await db`select id,event_id,synced_at from app.google_calendar_export_events where source_id=${firstBooking}::uuid and active order by profile_id`;
          await db`update app.coach_private_bookings set status='completed',completed_at=clock_timestamp() where id=${firstBooking}::uuid`;
          await settleAll();
          assert.deepEqual(
            await db`select id,event_id,synced_at from app.google_calendar_export_events where source_id=${firstBooking}::uuid and active order by profile_id`,
            history,
          );
          const historyJobs =
            await db`select j.state from app.google_calendar_export_jobs j join app.google_calendar_export_events e on e.id=j.event_id where e.source_id=${firstBooking}::uuid and e.active`;
          assert.ok(historyJobs.every((j) => j.state === "retained"));
          await preference(coach, "disable");
          const ids = Array.from({ length: 51 }, () => randomUUID());
          for (let index = 0; index < ids.length; index++) {
            const id = ids[index];
            await db`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,published_at,confirmed_at,confirmed_by_profile_id)
            select ${id}::uuid,${coach.run}::uuid,${coach.profile}::uuid,${"group-" + id.replaceAll("-", "")},'Bounded backfill fixture','Disposable fixture','Boxing','All levels',l.id,
            jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),
            clock_timestamp()+make_interval(days=>10+${index}::int),clock_timestamp()+make_interval(days=>10+${index}::int,hours=>1),clock_timestamp()+interval '2 days',1,4,0,'confirmed',clock_timestamp(),clock_timestamp(),${coach.profile}::uuid
            from app.coach_training_locations l where l.profile_id=${coach.profile}::uuid and l.is_primary`;
          }
          assert.equal(
            (
              await db`select count(*)::int n from app.google_calendar_export_events where source_id=any(${ids}::uuid[])`
            )[0].n,
            0,
          );
          await preference(coach, "enable");
          let sawBoundedCursor = false;
          for (let i = 0; i < 70; i++) {
            const current = await claim();
            if (!current) break;
            const [pref] =
              await db`select backfill_kind,backfill_cursor from app.google_calendar_exports where run_id=${coach.run}::uuid and profile_id=${coach.profile}::uuid`;
            if (
              pref.backfill_kind === "group" &&
              pref.backfill_cursor !== zero
            ) {
              sawBoundedCursor = true;
              const added = (
                await db`select count(*)::int n from app.google_calendar_export_events where source_id=any(${ids}::uuid[])`
              )[0].n;
              // Discovery also reconciles a known, cancelled group copy.
              assert.ok(added > 0 && added <= 50);
            }
            const p = await work(current, "prepare");
            await work(current, "dispatch");
            await work(current, "finish", {
              result:
                p.desired.action === "upsert"
                  ? "upserted"
                  : p.desired.action === "delete"
                    ? "deleted"
                    : "retained",
            });
          }
          assert.equal(sawBoundedCursor, true);
          assert.equal(
            (
              await db`select count(*)::int n from app.google_calendar_export_events where source_id=any(${ids}::uuid[]) and active`
            )[0].n,
            51,
          );
          assert.equal((await status(coach)).backfillPending, false);
          assert.deepEqual(
            await db`select id,event_id,synced_at from app.google_calendar_export_events where source_id=${firstBooking}::uuid and active order by profile_id`,
            history,
          );
        },
      );
      await step(
        "worker read flags restore exactly, ordinary Check cannot steal a lease, and revoked grant pauses without opting in another account",
        async () => {
          await preference(athlete, "retry");
          const c = await claim();
          assert.ok(c);
          const [mapped] =
            await db`select profile_id from app.google_calendar_export_events where id=${c.id}::uuid`;
          const actor = mapped.profile_id === coach.profile ? coach : athlete;
          await db.begin(async (tx) => {
            await tx`set local role app_calendar_worker`;
            await tx`select set_config('app.coach_booking_management','original',true),set_config('app.coach_availability_management','original',true),set_config('app.group_session_management','original',true)`;
            const [p] =
              await tx`select app.google_calendar_export_work(${c.id}::uuid,${c.leaseId}::uuid,'prepare','{}') result`;
            assert.equal(p.result.kind, "prepared");
            const [flags] =
              await tx`select current_setting('app.coach_booking_management') a,current_setting('app.coach_availability_management') b,current_setting('app.group_session_management') c`;
            assert.deepEqual(flags, {
              a: "original",
              b: "original",
              c: "original",
            });
          });
          assert.equal(
            (
              await connCommand(
                actor,
                "claim-check",
                (await connection(actor)).generation,
                { operationId: randomUUID() },
              )
            ).kind,
            "conflict",
          );
          await work(c, "finish", { result: "authorization-required" });
          assert.equal((await connection(actor)).state, "reconnect-required");
          assert.equal((await status(actor)).enabled, true);
          await connect(actor);
          assert.equal((await status(actor)).enabled, true);
          await settleAll();
          await connCommand(
            actor,
            "disconnect",
            (await connection(actor)).generation,
          );
          assert.equal((await status(actor)).enabled, false);
          await connect(actor, "different-google-" + randomUUID());
          assert.equal((await status(actor)).enabled, false);
        },
      );
    } finally {
      if (roleCreated) await db.unsafe("drop role " + workerRole);
      await db.end({ timeout: 5 });
    }
  },
);
