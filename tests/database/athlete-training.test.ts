import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { runNotificationWorker } from "../../src/server/notifications/worker";
const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  !/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov120_[a-z0-9_]+$/.test(
    url,
  )
)
  throw Error("Use the MOV-120 owned scratch rehearsal");
class Rollback extends Error {}
test("private athlete calendar, history, recurrence and deadline reminder authority", async (t) => {
  const db = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await db
      .begin(async (tx) => {
        const actors = [];
        for (let n = 0; n < 2; n++) {
          const authId = randomUUID();
          await tx`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${authId}::uuid,${`mov120-${n}@example.test`},now(),false,false)`;
          const [p] =
            await tx`select * from app.enroll_application_identity(${authId}::uuid,${"Training fixture " + n})`;
          actors.push({
            authId,
            id: String(p.identity_profile_id),
            run: String(p.identity_run_id),
          });
        }
        const [owner, other] = actors;
        async function asActor(a: typeof owner, action: string, args: object) {
          return tx.savepoint(async (s) => {
            await s.unsafe("set local role app_runtime");
            await s`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
            const [r] =
              await s`select app.athlete_training_command(${action},${s.json(args as postgres.JSONValue)}) value`;
            await s.unsafe("reset role");
            return r.value;
          });
        }
        const date = (d: Date) => d.toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000),
          day = date(tomorrow);
        const query = {
          from: day,
          through: date(new Date(Date.now() + 8 * 86400000)),
          timezone: "UTC",
        };
        const save = {
          commandId: randomUUID(),
          title: "Strength",
          date: day,
          time: "19:00",
          timezone: "UTC",
          weekly: true,
        };
        await t.test(
          "persisted weekly workouts default to60 minutes and exact retries do not duplicate",
          async () => {
            await asActor(owner, "save", save);
            await asActor(owner, "save", save);
            const p = await asActor(owner, "list", query);
            assert.equal(p.items.length, 2);
            assert.equal(
              Date.parse(p.items[0].endsAt) - Date.parse(p.items[0].startsAt),
              3600000,
            );
            await assert.rejects(
              asActor(owner, "save", { ...save, title: "Changed retry" }),
            );
            assert.equal((await asActor(other, "list", query)).items.length, 0);
          },
        );
        let item = (await asActor(owner, "list", query)).items[0];
        await t.test(
          "future attendance denied, exceptions preserved through series changes and revisions fenced",
          async () => {
            await assert.rejects(
              asActor(owner, "attendance", {
                commandId: randomUUID(),
                key: item.key,
                revision: 0,
                attendance: "attended",
              }),
            );
            await asActor(owner, "attendance", {
              commandId: randomUUID(),
              key: item.key,
              revision: 0,
              attendance: "skipped",
              notes: "Private note",
            });
            await assert.rejects(
              asActor(other, "attendance", {
                commandId: randomUUID(),
                key: item.key,
                revision: 0,
                attendance: "skipped",
              }),
            );
            await asActor(owner, "series", {
              ...save,
              commandId: randomUUID(),
              seriesId: item.seriesId,
              planRevision: item.planRevision,
              title: "Updated strength",
              time: "20:00",
            });
            const p = await asActor(owner, "list", query);
            assert.equal(p.items[0].notes, "Private note");
            assert.equal(p.items[0].attendance, "skipped");
            assert.equal(p.items[1].title, "Updated strength");
            assert.equal(
              p.items[1].key,
              item.key.slice(0, -10) + p.items[1].key.slice(-10),
            );
            await assert.rejects(
              asActor(owner, "attendance", {
                commandId: randomUUID(),
                key: item.key,
                revision: 0,
                attendance: "planned",
              }),
            );
          },
        );
        await t.test(
          "spontaneous completed logs drive independent counts and keep notes private",
          async () => {
            const past = new Date(Date.now() - 7200000);
            await asActor(owner, "save", {
              commandId: randomUUID(),
              title: "Walk",
              date: date(past),
              time: past.toISOString().slice(11, 16),
              timezone: "UTC",
              minutes: 30,
              completed: true,
              notes: "Only mine",
              intensity: "Easy",
            });
            const p = await asActor(owner, "list", {
              from: date(new Date(Date.now() - 86400000)),
              through: date(new Date()),
              timezone: "UTC",
            });
            assert.equal(
              p.items.filter(
                (i: { attendance: string }) => i.attendance === "attended",
              ).length,
              1,
            );
            assert.ok(p.weekCount >= 0);
            assert.ok(p.monthCount >= 0);
            assert.equal(
              JSON.stringify(
                await asActor(other, "list", {
                  from: date(past),
                  through: date(new Date()),
                  timezone: "UTC",
                }),
              ).includes("Only mine"),
              false,
            );
          },
        );
        await t.test(
          "DST gaps and repeated times fail; normal recurring wall-clock hour survives offset change",
          async () => {
            // Validate the exact shared SQL conversion used by rules without date-window assumptions.
            const [r] =
              await tx`select app.coach_local_time_is_unambiguous('2027-03-28 02:30'::timestamp,'Europe/Berlin') gap,app.coach_local_time_is_unambiguous('2027-10-31 02:30'::timestamp,'Europe/Berlin') overlap,extract(hour from(('2027-03-30 19:00'::timestamp at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')) local_hour`;
            assert.equal(r.gap, false);
            assert.equal(r.overlap, false);
            assert.equal(Number(r.local_hour), 19);
          },
        );
        await t.test(
          "range/input boundaries and raw browser/runtime/worker table permissions fail closed",
          async () => {
            await assert.rejects(
              asActor(owner, "list", { ...query, through: "2099-01-01" }),
            );
            await assert.rejects(
              asActor(owner, "save", {
                ...save,
                commandId: randomUUID(),
                notes: "x".repeat(2001),
                weekly: false,
              }),
            );
            const [p] =
              await tx`select has_table_privilege('app_runtime','app.athlete_training_entries','SELECT') runtime,has_function_privilege('authenticated','app.athlete_training_command(text,jsonb)','EXECUTE') browser,has_table_privilege('app_notification_worker','app.athlete_training_reminders','SELECT') worker`;
            assert.deepEqual(p, {
              runtime: false,
              browser: false,
              worker: false,
            });
          },
        );
        await t.test(
          "server discovers final-hour reminders without a browser; exact claims, preference and retry guards",
          async () => {
            const soon = new Date(Date.now() + 30 * 60000);
            await asActor(owner, "save", {
              commandId: randomUUID(),
              title: "Soon",
              date: date(soon),
              time: soon.toISOString().slice(11, 16),
              timezone: "UTC",
              minutes: 15,
            });
            await asActor(owner, "preference", {
              commandId: randomUUID(),
              enabled: true,
            });
            async function worker(
              query: string,
              args: postgres.ParameterOrJSON<never>[] = [],
            ) {
              return tx.savepoint(async (s) => {
                await s.unsafe("set local role app_notification_worker");
                const rows = await s.unsafe(query, args);
                await s.unsafe("reset role");
                return rows;
              });
            }
            const [a] = await worker(
              "select app.claim_training_reminders() claims",
            );
            assert.equal(a.claims.length, 1);
            const [b] = await worker(
              "select app.claim_training_reminders() claims",
            );
            assert.equal(b.claims.length, 0);
            const claim = a.claims[0];
            const [ready] = await worker(
              "select app.prepare_training_reminder($1::uuid,$2::uuid) payload",
              [claim.id, claim.leaseId],
            );
            assert.equal(ready.payload.title, "Soon");
            assert.equal(ready.payload.email, "mov120-0@example.test");
            assert.equal("notes" in ready.payload, false);
            const [done] = await worker(
              "select app.finish_training_reminder($1::uuid,$2::uuid,'accepted','fixture') saved",
              [claim.id, claim.leaseId],
            );
            assert.equal(done.saved, true);
            assert.equal(
              (
                await worker(
                  "select app.finish_training_reminder($1::uuid,$2::uuid,'accepted','fixture') saved",
                  [claim.id, claim.leaseId],
                )
              )[0].saved,
              false,
            );
            assert.equal(
              (await worker("select app.claim_training_reminders() claims"))[0]
                .claims.length,
              0,
            );
            const [e] =
              await tx`select occurrence_key from app.athlete_training_reminders where id=${claim.id}::uuid`;
            item = (
              await asActor(owner, "list", {
                from: date(soon),
                through: date(soon),
                timezone: "UTC",
              })
            ).items.find((i: { key: string }) => i.key === e.occurrence_key);
            const later = new Date(Date.now() + 45 * 60000);
            await asActor(owner, "save", {
              commandId: randomUUID(),
              key: item.key,
              revision: item.revision,
              title: "Moved soon",
              date: date(later),
              time: later.toISOString().slice(11, 16),
              timezone: "UTC",
              minutes: 15,
            });
            const [moved] = await worker(
              "select app.claim_training_reminders() claims",
            );
            assert.equal(moved.claims.length, 1);
            await asActor(owner, "preference", {
              commandId: randomUUID(),
              enabled: false,
            });
            assert.equal(
              (
                await worker(
                  "select app.prepare_training_reminder($1::uuid,$2::uuid) payload",
                  [moved.claims[0].id, moved.claims[0].leaseId],
                )
              )[0].payload,
              null,
            );
            await asActor(owner, "preference", {
              commandId: randomUUID(),
              enabled: true,
            });
            const rearmed = (
              await worker("select app.claim_training_reminders() claims")
            )[0].claims;
            assert.equal(
              rearmed.length,
              1,
              "Unsent suppressed job can re-arm after opt-in",
            );
            await worker(
              "select app.prepare_training_reminder($1::uuid,$2::uuid)",
              [rearmed[0].id, rearmed[0].leaseId],
            );
            await tx`update app.athlete_training_reminders set lease_until=statement_timestamp()-interval '1 second' where id=${rearmed[0].id}::uuid`;
            await worker("select app.claim_training_reminders()");
            const [unknown] =
              await tx`select state from app.athlete_training_reminders where id=${rearmed[0].id}::uuid`;
            assert.equal(unknown.state, "unknown");
            assert.equal(
              (await worker("select app.claim_training_reminders() claims"))[0]
                .claims.length,
              0,
              "Ambiguous handoff must not auto resend",
            );
            const expiredId = randomUUID(),
              expiredKey = "manual:" + randomUUID();
            await tx`insert into app.athlete_training_entries(run_id,profile_id,occurrence_key,source,title,starts_at,ends_at,timezone) values(${owner.run}::uuid,${owner.id}::uuid,${expiredKey},'personal','Outage expiry fixture',statement_timestamp()-interval '1 hour',statement_timestamp()-interval '30 minutes','UTC')`;
            await tx`insert into app.athlete_training_reminders(id,run_id,profile_id,occurrence_key,starts_at,due_at) values(${expiredId}::uuid,${owner.run}::uuid,${owner.id}::uuid,${expiredKey},statement_timestamp()-interval '1 hour',statement_timestamp()-interval '2 hours')`;
            await worker("select app.claim_training_reminders()");
            const [expired] =
              await tx`select state from app.athlete_training_reminders where id=${expiredId}::uuid`;
            assert.equal(
              expired.state,
              "suppressed",
              "Past-start queued reminders cannot catch up after an outage",
            );
            await asActor(owner, "preference", {
              commandId: randomUUID(),
              enabled: false,
            });
          },
        );
        await t.test(
          "complete date-range pagination and independent totals do not truncate older-created entries",
          async () => {
            await tx`insert into app.athlete_training_entries(run_id,profile_id,occurrence_key,source,title,starts_at,ends_at,timezone)
            select ${owner.run}::uuid,${owner.id}::uuid,'manual:'||gen_random_uuid(),'personal','Long calendar fixture',${day}::date::timestamp+interval '10 hours'+n*interval '1 minute',${day}::date::timestamp+interval '11 hours'+n*interval '1 minute','UTC' from generate_series(1,121)n`;
            const first = await asActor(owner, "list", query),
              second = await asActor(owner, "list", {
                ...query,
                offset: first.next,
              });
            assert.equal(first.items.length, 100);
            assert.ok(second.items.length >= 21);
            assert.equal(second.next, null);
            assert.equal(
              new Set([...first.items, ...second.items].map((i) => i.key)).size,
              first.items.length + second.items.length,
            );
            assert.equal(first.monthCount, second.monthCount);
            await assert.rejects(
              asActor({ ...owner, authId: other.authId }, "list", query),
            );
          },
        );
        await t.test(
          "mixed private/group projections retain original lifecycle and keep athlete annotations separate",
          async () => {
            async function raw(
              a: typeof owner,
              query: string,
              args: postgres.JSONValue[] = [],
            ) {
              return tx.savepoint(async (s) => {
                await s.unsafe("set local role app_runtime");
                await s`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
                const rows = await s.unsafe(query, args);
                await s.unsafe("reset role");
                return rows;
              });
            }
            await raw(other, "select app.submit_owned_coach_application()");
            await raw(
              other,
              "select app.save_owned_coach_application_contact(0,$1::jsonb)",
              [
                {
                  phoneNumber: "+4915112345678",
                  instagramUrl: null,
                  facebookUrl: null,
                  linkedinUrl: null,
                },
              ],
            );
            await raw(
              other,
              "select app.upsert_owned_coach_profile('Calendar coach','Private training with clear preparation and focused practice for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
            );
            await tx`select app.review_coach_application(${other.id}::uuid,'pending','approved','Isolated calendar fixture','mov120','movx-identity-application-v1')`;
            await tx`update app.coach_profiles set visibility='visible' where profile_id=${other.id}::uuid`;
            const [slot] = await raw(
              other,
              "select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '4 days 14 hours') at time zone 'Europe/Berlin',60) id",
            );
            const [r] = await raw(
              owner,
              "select * from app.create_coach_booking_request($1::uuid)",
              [slot.id],
            );
            const range = {
              from: date(new Date()),
              through: date(new Date(Date.now() + 7 * 86400000)),
              timezone: "UTC",
            };
            assert.equal(
              (
                await tx`select item from app.athlete_training_items(${owner.id}::uuid,${owner.run}::uuid,now(),now()+interval '8 days') where item->>'key'=${"request:" + r.request_id}`
              ).length,
              1,
            );
            const [b] = await raw(
              other,
              "select * from app.accept_coach_booking_request($1::uuid)",
              [r.request_id],
            );
            const all = [];
            for (let offset = 0; ;) {
              const p = await asActor(owner, "list", { ...range, offset });
              all.push(...p.items);
              if (p.next === null) break;
              offset = p.next;
            }
            assert.equal(
              all.filter((i) => i.key === "request:" + r.request_id).length,
              0,
            );
            const booking = all.find(
              (i) => i.key === "booking:" + b.booking_id,
            );
            assert.equal(booking.state, "confirmed");
            const [before] =
              await tx`select to_jsonb(b) value from app.coach_private_bookings b where id=${b.booking_id}::uuid`;
            await asActor(owner, "attendance", {
              commandId: randomUUID(),
              key: booking.key,
              revision: 0,
              attendance: "planned",
              notes: "Private athlete annotation",
            });
            const [after] =
              await tx`select to_jsonb(b) value from app.coach_private_bookings b where id=${b.booking_id}::uuid`;
            assert.deepEqual(after, before);
            assert.equal(
              JSON.stringify(await asActor(other, "list", range)).includes(
                "Private athlete annotation",
              ),
              false,
            );
            const groupId = randomUUID(),
              registrationId = randomUUID();
            await tx`insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,created_at,published_at,confirmed_at,confirmed_by_profile_id)
            select ${groupId}::uuid,${other.run}::uuid,${other.id}::uuid,${"group-" + groupId.replaceAll("-", "")},'Calendar group','Isolated group calendar fixture','Boxing','All levels',l.id,jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),date_trunc('day',statement_timestamp())+interval '4 days 12 hours',date_trunc('day',statement_timestamp())+interval '4 days 13 hours',clock_timestamp()+interval '1 day',1,4,0,'confirmed',clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute',clock_timestamp(),${other.id}::uuid from app.coach_training_locations l where l.profile_id=${other.id}::uuid and l.is_primary`;
            await raw(
              owner,
              "select app.group_session_command('join',$1::jsonb)",
              [{ id: groupId, registrationId }],
            );
            const from =
              await tx`select item from app.athlete_training_items(${owner.id}::uuid,${owner.run}::uuid,now(),now()+interval '8 days') where item->>'key'=${"group:" + registrationId}`;
            assert.equal(from[0].item.state, "pending");
            await raw(
              other,
              "select app.group_session_command('approve-registration',$1::jsonb)",
              [{ id: groupId, registrationId }],
            );
            const approved =
              await tx`select item from app.athlete_training_items(${owner.id}::uuid,${owner.run}::uuid,now(),now()+interval '8 days') where item->>'key'=${"group:" + registrationId}`;
            assert.equal(approved[0].item.state, "confirmed");
            assert.equal(
              approved[0].item.href,
              "/events/group-" + groupId.replaceAll("-", ""),
            );
          },
        );
        await t.test(
          "stopping a series fences edits, cancels moved future plans and preserves history and unrelated data",
          async () => {
            const series = randomUUID(),
              pastRule = randomUUID(),
              now = Date.now();
            // Two versions across timezones, plus future planned, past attended and
            // already-started exceptions. Fixtures stay inside this rollback.
            await tx`insert into app.athlete_training_rules(id,series_id,run_id,profile_id,revision,title,timezone,from_date,weekday,local_time)
            values(${series}::uuid,${series}::uuid,${owner.run}::uuid,${owner.id}::uuid,1,'Old routine','Pacific/Auckland',current_date-28,extract(dow from current_date),'23:59'),
            (${pastRule}::uuid,${series}::uuid,${owner.run}::uuid,${owner.id}::uuid,2,'Current routine','America/Los_Angeles',current_date+7,extract(dow from current_date),'23:59')`;
            for (const [n, offset, attendance] of [
              [0, -86400000, "attended"],
              [1, -60000, "planned"],
              [2, 1800000, "planned"],
            ] as const) {
              await tx`insert into app.athlete_training_entries(run_id,profile_id,occurrence_key,source,rule_id,title,starts_at,ends_at,timezone,attendance,notes,intensity,actual_minutes)
              values(${owner.run}::uuid,${owner.id}::uuid,${"p:" + series + ":" + date(new Date(now + (n + 1) * 86400000))},'personal',${series}::uuid,${"Exception " + n},${new Date(now + offset)},${new Date(now + offset + 3600000)},'UTC',${attendance},'Keep notes','Hard',35)`;
            }
            const untouched =
              await tx`select to_jsonb(e) value from app.athlete_training_entries e where profile_id=${owner.id}::uuid and (rule_id is distinct from ${series}::uuid or starts_at<=statement_timestamp()) order by id`;
            const otherRules =
              await tx`select to_jsonb(r) value from app.athlete_training_rules r where series_id<>${series}::uuid order by id`;
            const history =
              await tx`select item from app.athlete_training_items(${owner.id}::uuid,${owner.run}::uuid,now()-interval '30 days',now()) where item->>'seriesId'=${series} order by item->>'key'`;
            const stop = {
              commandId: randomUUID(),
              seriesId: series,
              planRevision: 2,
            };
            await assert.rejects(asActor(other, "stop", stop));
            await assert.rejects(
              asActor({ ...owner, run: randomUUID() }, "stop", stop),
            );
            await assert.rejects(
              asActor(owner, "stop", { ...stop, profileId: owner.id }),
            );
            await assert.rejects(
              asActor(owner, "stop", { ...stop, planRevision: 1 }),
            );
            await asActor(owner, "stop", stop);
            const afterFirst =
              await tx`select to_jsonb(r) value from app.athlete_training_rules r where series_id=${series}::uuid order by revision`;
            await asActor(owner, "stop", stop);
            assert.deepEqual(
              await tx`select to_jsonb(r) value from app.athlete_training_rules r where series_id=${series}::uuid order by revision`,
              afterFirst,
            );
            assert.equal(afterFirst.at(-1)!.value.revision, 3);
            await assert.rejects(
              asActor(owner, "stop", { ...stop, seriesId: randomUUID() }),
            );
            await assert.rejects(
              asActor(owner, "series", {
                ...save,
                commandId: randomUUID(),
                seriesId: series,
                planRevision: 2,
              }),
            );
            assert.deepEqual(
              await tx`select to_jsonb(e) value from app.athlete_training_entries e where profile_id=${owner.id}::uuid and (rule_id is distinct from ${series}::uuid or starts_at<=statement_timestamp()) order by id`,
              untouched,
            );
            assert.deepEqual(
              await tx`select to_jsonb(r) value from app.athlete_training_rules r where series_id<>${series}::uuid order by id`,
              otherRules,
            );
            const stopped =
              await tx`select item from app.athlete_training_items(${owner.id}::uuid,${owner.run}::uuid,now(),now()+interval '30 days') where item->>'seriesId'=${series} and (item->>'startsAt')::timestamptz>statement_timestamp()`;
            assert.equal(stopped.length, 1);
            assert.equal(stopped[0].item.attendance, "cancelled");
            assert.equal(stopped[0].item.notes, "Keep notes");
            assert.equal(stopped[0].item.intensity, "Hard");
            assert.equal(stopped[0].item.actualMinutes, 35);
            assert.equal(stopped[0].item.revision, 2);
            const afterHistory =
              await tx`select item from app.athlete_training_items(${owner.id}::uuid,${owner.run}::uuid,now()-interval '30 days',now()) where item->>'seriesId'=${series} order by item->>'key'`;
            assert.deepEqual(
              afterHistory.map((r) => ({ ...r.item, planRevision: null })),
              history.map((r) => ({ ...r.item, planRevision: null })),
            );
            // A claimed reminder for a moved exception must be suppressed by the
            // existing final eligibility check; no provider call is made.
            const job = randomUUID(),
              lease = randomUUID();
            await tx`insert into app.athlete_training_reminders(id,run_id,profile_id,occurrence_key,starts_at,due_at,state,attempts,lease_id,lease_until)
            values(${job}::uuid,${owner.run}::uuid,${owner.id}::uuid,${stopped[0].item.key},${stopped[0].item.startsAt}::timestamptz,now(),'claimed',1,${lease}::uuid,now()+interval '2 minutes')`;
            const [prepared] =
              await tx`select app.prepare_training_reminder(${job}::uuid,${lease}::uuid) value`;
            assert.equal(prepared.value, null);
            const [jobState] =
              await tx`select state from app.athlete_training_reminders where id=${job}::uuid`;
            assert.equal(jobState.state, "suppressed");
          },
        );
        await t.test(
          "revoked actors and wrong datasets cannot retain calendar or log access",
          async () => {
            await assert.rejects(
              asActor({ ...owner, run: randomUUID() }, "list", query),
            );
            await tx`update app.demo_run_participants set status='revoked',revoked_at=clock_timestamp() where profile_id=${owner.id}::uuid and run_id=${owner.run}::uuid`;
            await assert.rejects(asActor(owner, "list", query));
            await assert.rejects(
              asActor(owner, "preference", {
                commandId: randomUUID(),
                enabled: true,
              }),
            );
          },
        );
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
  } finally {
    await db.end();
  }
});

test("concurrent routine stop and edit serialize on the same expected revision", async () => {
  const db = postgres(url!, { max: 3, onnotice: () => {} }),
    auth = randomUUID();
  try {
    await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${auth}::uuid,${"stop-race-" + auth + "@example.test"},now(),false,false)`;
    const [p] =
      await db`select * from app.enroll_application_identity(${auth}::uuid,'Routine race fixture')`;
    const call = (action: string, args: object) =>
      db.begin(async (tx) => {
        await tx.unsafe("set local role app_runtime");
        await tx`select set_config('app.current_auth_user_id',${auth},true),set_config('app.current_profile_id',${p.identity_profile_id},true),set_config('app.current_run_id',${p.identity_run_id},true),set_config('app.current_run_role','member',true)`;
        const [r] =
          await tx`select app.athlete_training_command(${action},${tx.json(args as postgres.JSONValue)}) value`;
        return r.value;
      });
    const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      id = randomUUID();
    const terms = {
      title: "Race routine",
      date: day,
      time: "19:00",
      timezone: "UTC",
      weekly: true,
    };
    await call("save", { ...terms, commandId: id });
    const listed = await call("list", {
      from: day,
      through: day,
      timezone: "UTC",
    });
    const seriesId = listed.items[0].seriesId;
    const result = await Promise.allSettled([
      call("stop", { commandId: randomUUID(), seriesId, planRevision: 1 }),
      call("series", {
        ...terms,
        commandId: randomUUID(),
        seriesId,
        planRevision: 1,
        time: "20:00",
      }),
    ]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    const failure = result.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    assert.equal(failure.reason.code, "40001");
    if (result[1].status === "fulfilled")
      await call("stop", {
        commandId: randomUUID(),
        seriesId,
        planRevision: 2,
      });
    assert.equal(
      (await call("list", { from: day, through: day, timezone: "UTC" })).items
        .length,
      0,
    );
  } finally {
    await db.end();
  }
});

test("restricted version5 worker captures one real Mailpit reminder without holding provider transactions", async () => {
  const db = postgres(url!, { max: 1, onnotice: () => {} }),
    suffix = randomUUID().replaceAll("-", ""),
    role = "mov120_worker_" + suffix,
    password = randomUUID();
  let capture: string | undefined;
  try {
    await db.unsafe(`create role ${role} login password '${password}' inherit`);
    const admin = postgres(
      url!.replace("postgres:postgres@", "supabase_admin:postgres@"),
      { max: 1, onnotice: () => {} },
    );
    try {
      await admin.unsafe(`grant app_notification_worker to ${role}`);
    } finally {
      await admin.end();
    }
    const auth = randomUUID(),
      email = "mov120-" + suffix + "@example.test";
    await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${auth}::uuid,${email},now(),false,false)`;
    const [p] =
      await db`select * from app.enroll_application_identity(${auth}::uuid,'Mailpit training fixture')`;
    await db.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      await tx`select set_config('app.current_auth_user_id',${auth},true),set_config('app.current_profile_id',${p.identity_profile_id},true),set_config('app.current_run_id',${p.identity_run_id},true),set_config('app.current_run_role','member',true)`;
      const soon = new Date(Date.now() + 1800000);
      await tx`select app.athlete_training_command('save',${tx.json({ commandId: randomUUID(), title: "Reminder QA workout", date: soon.toISOString().slice(0, 10), time: soon.toISOString().slice(11, 16), timezone: "UTC", minutes: 15 })})`;
      await tx`select app.athlete_training_command('preference',${tx.json({ commandId: randomUUID(), enabled: true })})`;
    });
    const workerUrl = new URL(url!);
    workerUrl.username = role;
    workerUrl.password = password;
    const environment = {
      NOTIFICATION_DELIVERY_ENABLED: "true",
      NOTIFICATION_TRANSPORT: "mailpit",
      NOTIFICATION_MAILPIT_URL: "http://127.0.0.1:55324",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      NOTIFICATION_DATABASE_URL: workerUrl.href,
    };
    const concurrent = await Promise.all([
      runNotificationWorker(environment, 5),
      runNotificationWorker(environment, 5),
    ]);
    assert.equal(
      concurrent.reduce((n, result) => n + (result.training?.accepted ?? 0), 0),
      1,
    );
    const [j] =
      await db`select provider_id from app.athlete_training_reminders where profile_id=${p.identity_profile_id}::uuid`;
    capture = j.provider_id;
    const mail = await (
      await fetch("http://127.0.0.1:55324/api/v1/message/" + capture)
    ).json();
    assert.equal(mail.To[0].Address, email);
    assert.match(mail.Text, /Reminder QA workout/);
    assert.match(mail.Text, /localhost:3100\/sessions\/calendar/);
    assert.equal(
      (
        await runNotificationWorker(
          {
            NOTIFICATION_DELIVERY_ENABLED: "true",
            NOTIFICATION_TRANSPORT: "mailpit",
            NOTIFICATION_MAILPIT_URL: "http://127.0.0.1:55324",
            NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
            NOTIFICATION_DATABASE_URL: workerUrl.href,
          },
          5,
        )
      ).training?.accepted,
      0,
    );
  } finally {
    if (capture) {
      const removed = await fetch("http://127.0.0.1:55324/api/v1/messages", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ IDs: [capture] }),
      });
      assert.ok(removed.ok, "Exact owned Mailpit capture cleanup failed");
    }
    await db.unsafe(`drop role if exists ${role}`);
    await db.end();
  }
});
