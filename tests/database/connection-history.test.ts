import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { connectionPageRecord } from "@/server/db/connections/repository";
import type {
  ConnectionRole,
  ConnectionSection,
  ConnectionPageOptions,
} from "@/domain/coach-athlete-connections";
const url = process.env.DATABASE_TEST_URL;
const allowed =
  url &&
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov257_[a-f0-9]{12}_(fresh|upgrade)$/.test(
    url,
  );
test(
  "latest pair cards preserve original attempts and request dates",
  { skip: !allowed },
  async (t) => {
    const admin = postgres(url!, { max: 2, prepare: false, onnotice() {} });
    process.env.DATABASE_URL = process.env.CONNECTION_NOTICE_RUNTIME_URL;
    const file = process.env.CONNECTION_NOTICE_MANIFEST!;
    const f = JSON.parse(readFileSync(file, "utf8")) as {
      coach: AuthorizedActor;
      athlete: AuthorizedActor;
      outsider: AuthorizedActor;
      bookingId: string;
      oldRequest: string;
      latest?: string;
      active?: string;
    };
    const run = (actor: AuthorizedActor, q: ReturnType<typeof sql>) =>
      withActorDatabaseContext(actor, (tx) => tx.execute(q));
    const send = async (previous: string) => {
      const [row] = await run(
        f.coach,
        sql`select app.send_coach_athlete_connection(${f.bookingId}::uuid,${randomUUID()}::uuid,${previous}::uuid) result`,
      );
      return (row.result as { id: string }).id;
    };
    const decide = (actor: AuthorizedActor, id: string, action: string) =>
      run(
        actor,
        sql`select app.decide_coach_athlete_connection(${id}::uuid,${action})`,
      );
    const page = (
      actor: AuthorizedActor,
      role: ConnectionRole,
      section: ConnectionSection,
      options: ConnectionPageOptions = {},
    ) =>
      withActorDatabaseContext(actor, (tx) =>
        connectionPageRecord(tx, role, section, options),
      );
    try {
      if (process.env.CONNECTION_HISTORY_PREPARE === "1") {
        await decide(f.coach, f.oldRequest, "withdraw");
        const id = await send(f.oldRequest);
        await decide(f.athlete, id, "decline");
        f.latest = id;
        f.active = await send(id);
        await decide(f.athlete, f.active, "accept");
        writeFileSync(file, JSON.stringify(f), { mode: 0o600 });
        return;
      }
      let latest = f.latest!;
      await t.test(
        "repeated terminal requests collapse for both roles with original creation timestamps",
        async () => {
          for (const [actor, role] of [
            [f.coach, "coach"],
            [f.athlete, "athlete"],
          ] as const) {
            const rows = await page(actor, role, "history");
            assert.deepEqual(
              rows.items.map((x) => x.id),
              [latest],
            );
            const [r] =
              await admin`select to_jsonb(created_at)#>>'{}' stamp from app.coach_athlete_connection_attempts where id=${latest}::uuid`;
            assert.equal(
              new Date(rows.items[0].createdAt).getTime(),
              new Date(r.stamp).getTime(),
            );
          }
          const [r] =
            await admin`select count(*)::int n from app.coach_athlete_connection_attempts where pair_id=(select pair_id from app.coach_athlete_connection_attempts where id=${latest}::uuid)`;
          assert.equal(r.n, 3);
          assert.deepEqual(
            (await page(f.athlete, "athlete", "accepted")).items.map(
              (x) => x.id,
            ),
            [f.active],
          );
        },
      );
      await t.test(
        "pending and accepted reconnection preserve the latest previous request",
        async () => {
          await decide(f.coach, f.active!, "disconnect");
          latest = f.active!;
          const previousHistory = latest;
          latest = await send(latest);
          assert.deepEqual(
            (await page(f.coach, "coach", "history")).items.map((x) => x.id),
            [previousHistory],
          );
          assert.deepEqual(
            (await page(f.athlete, "athlete", "history")).items.map(
              (x) => x.id,
            ),
            [previousHistory],
          );
          assert.deepEqual(
            (await page(f.athlete, "athlete", "incoming")).items.map(
              (x) => x.id,
            ),
            [latest],
          );
          await decide(f.athlete, latest, "accept");
          for (const [actor, role] of [
            [f.coach, "coach"],
            [f.athlete, "athlete"],
          ] as const) {
            assert.deepEqual(
              (await page(actor, role, "history")).items.map((x) => x.id),
              [previousHistory],
            );
            assert.deepEqual(
              (await page(actor, role, "accepted")).items.map((x) => x.id),
              [latest],
            );
          }
          await decide(f.coach, latest, "disconnect");
          assert.deepEqual(
            (await page(f.athlete, "athlete", "history")).items.map(
              (x) => x.id,
            ),
            [latest],
          );
        },
      );
      await t.test(
        "pair grouping precedes cursor and limit, preserving page completeness",
        async () => {
          await admin.begin(async (tx) => {
            await tx`select app.connection_access_flags(true)`;
            const [p] =
              await tx`insert into app.coach_athlete_connection_pairs(run_id,coach_profile_id,athlete_profile_id)values(${f.coach.runId}::uuid,${f.coach.profileId}::uuid,${f.outsider.profileId}::uuid)returning id`;
            for (let i = 1; i <= 3; i++)
              await tx`insert into app.coach_athlete_connection_attempts(id,run_id,pair_id,attempt_number,sender_profile_id,recipient_profile_id,status,decided_by_profile_id,decided_at)values(${randomUUID()}::uuid,${f.coach.runId}::uuid,${p.id}::uuid,${i},${f.coach.profileId}::uuid,${f.outsider.profileId}::uuid,'declined',${f.outsider.profileId}::uuid,statement_timestamp())`;
          });
          const first = await page(f.coach, "coach", "history", {
            pageSize: 1,
          });
          assert.ok(first.nextCursor);
          const second = await page(f.coach, "coach", "history", {
            pageSize: 1,
            cursor: first.nextCursor,
          });
          assert.equal(second.nextCursor, null);
          assert.equal(second.items.length, 1);
          assert.notEqual(first.items[0].pairId, second.items[0].pairId);
          const all = await page(f.coach, "coach", "history");
          assert.deepEqual([...first.items, ...second.items], all.items);
          const older =
            await admin`select count(*)::int n from app.coach_athlete_connection_attempts where run_id=${f.coach.runId}::uuid and sender_profile_id=${f.coach.profileId}::uuid`;
          assert.equal(older[0].n, 7);
        },
      );
      await t.test(
        "actor, role, dataset and raw table authority remain enforced",
        async () => {
          assert.equal(
            (await page(f.athlete, "coach", "history")).items.length,
            0,
          );
          const other = await page(f.outsider, "athlete", "history");
          assert.equal(other.items.length, 1);
          assert.equal(other.items[0].athleteProfileId, f.outsider.profileId);
          await assert.rejects(
            page({ ...f.coach, runId: randomUUID() }, "coach", "history"),
          );
          await assert.rejects(
            run(
              f.athlete,
              sql`select * from app.coach_athlete_connection_attempts`,
            ),
          );
          const [r] =
            await admin`select has_function_privilege('app_runtime','app.current_coach_athlete_connections(text,text,integer,timestamptz,uuid)','execute') allowed,has_function_privilege('anon','app.current_coach_athlete_connections(text,text,integer,timestamptz,uuid)','execute') browser`;
          assert.equal(r.allowed, true);
          assert.equal(r.browser, false);
        },
      );
    } finally {
      await admin.end({ timeout: 2 });
    }
  },
);
