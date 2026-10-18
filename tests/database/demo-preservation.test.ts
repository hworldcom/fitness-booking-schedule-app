import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import {
  DEMO_COACH_FIXTURES,
  demoCoachDefaultsStatements,
} from "../../scripts/lib/demo-coach-fixtures";

const url = process.env.DATABASE_TEST_URL
  ? new URL(process.env.DATABASE_TEST_URL)
  : null;
const disposable = Boolean(
  url &&
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
  url.port === "55322" &&
  /^\/dev0336_[a-z0-9_]+$/.test(url.pathname),
);
test(
  "full seed and empty defaults preserve the complete edited, unclaimed and retired foundation",
  { skip: !disposable },
  async () => {
    const db = postgres(url!.toString(), {
      max: 1,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    const rollback = new Error("Rollback synthetic preservation fixture");
    try {
      await db
        .begin(async (tx) => {
          const ids = DEMO_COACH_FIXTURES.map((coach) => coach.profileId);
          await tx`update app.coach_profiles set visibility='hidden' where profile_id=any(${ids}::uuid[])`;
          const coach = DEMO_COACH_FIXTURES[1];
          await tx`update app.coach_profiles set bio=${coach.previousBio},display_name='Retained custom coach',portrait_source=null,portrait_path=null,portrait_updated_at=null where profile_id=${coach.profileId}::uuid`;
          await tx`update app.profiles set display_name='Retained private display',bio='Retained private biography' where id=${coach.profileId}::uuid`;
          await tx`update app.gyms set name='Retained venue',public_location_label='Retained location label' where id='40000000-0000-4000-8000-000000000001'`;
          // Snapshot every application table, including website/rate/review/history,
          // without serializing any actual credentials to the test log.
          const fingerprints = async () => {
            const tables = await tx<
              { tablename: string }[]
            >`select tablename from pg_tables where schemaname='app' order by tablename`;
            const result: Record<string, string> = {};
            for (const { tablename } of tables) {
              assert.match(tablename, /^[a-z_]+$/);
              const rows = await tx.unsafe(
                `select md5(coalesce(jsonb_agg(to_jsonb(v) order by to_jsonb(v)::text)::text,'[]')) hash from app."${tablename}" v`,
              );
              result[tablename] = rows[0].hash;
            }
            return result;
          };
          const before = await fingerprints();
          await tx.unsafe(readFileSync("supabase/seed.sql", "utf8"));
          await tx.unsafe(demoCoachDefaultsStatements([], [], []));
          assert.deepEqual(await fingerprints(), before);
          await tx`update app.demo_runs set status='retired',retired_at=clock_timestamp(),schedule_anchor_date='2026-01-01' where id='20000000-0000-4000-8000-000000000001'`;
          const retired = await fingerprints();
          await tx.unsafe(readFileSync("supabase/seed.sql", "utf8"));
          assert.deepEqual(await fingerprints(), retired);
          throw rollback;
        })
        .catch((error) => {
          if (error !== rollback) throw error;
        });
    } finally {
      await db.end({ timeout: 5 });
    }
  },
);
