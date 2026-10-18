import { seedBeforeFitness } from "./lib/seed-compatibility.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const container = LOCAL_SUPABASE_DATABASE_CONTAINER;
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const created = [];
function docker(args, input) {
  return execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    {
      input,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}
function psql(database, input) {
  assert.match(database, /^dev0321_[a-z0-9_]+$/);
  return docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    input,
  );
}
const migrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql") && file <= "20261018000200_coach_banner_cleanup_serialization.sql")
  .sort();
const ownedMigrations = [
  "20261018000100_coach_website_content.sql",
  "20261018000200_coach_banner_cleanup_serialization.sql",
];
assert.equal(
  migrations.at(-1),
  ownedMigrations.at(-1),
  "Review any later migrations before changing the isolated upgrade order.",
);
const readMigration = (file) =>
  readFileSync("supabase/migrations/" + file, "utf8");
// Schema only: copy no retained identities, tokens, objects or private records.
const infrastructure = docker([
  "pg_dump",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "--schema-only",
]);
const snapshot = `select jsonb_object_agg(table_name,rows) from (
  select 'profiles' table_name,coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) rows from app.profiles t
  union all select 'coaches',coalesce(jsonb_agg(to_jsonb(t) order by profile_id),'[]'::jsonb) from app.coach_profiles t
  union all select 'locations',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from app.coach_training_locations t
  union all select 'objects',coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from storage.objects t
) preserved;`;
try {
  for (const mode of ["fresh", "upgrade"]) {
    const database = `dev0321_${suffix}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    psql(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of migrations.filter(
      (file) => !ownedMigrations.includes(file),
    ))
      psql(database, readMigration(file));
    if (mode === "upgrade") {
      psql(database, seedBeforeFitness(readFileSync("supabase/seed.sql", "utf8")));
      // Preserve an actual old avatar reference and Storage metadata row as well
      // as seeded portraits, coaches and multiple training locations.
      psql(
        database,
        `update app.profiles set avatar_storage_path=id::text||'/93210000-0000-4000-8000-000000000001.webp',avatar_updated_at='2026-10-01T10:00:00Z' where id=(select id from app.profiles order by id limit 1);
        insert into storage.objects(bucket_id,name,metadata) select 'account-avatars',avatar_storage_path,'{"mimetype":"image/webp","size":100}'::jsonb from app.profiles where avatar_storage_path is not null;`,
      );
      const before = psql(database, snapshot);
      for (const file of ownedMigrations) psql(database, readMigration(file));
      assert.equal(
        psql(database, snapshot),
        before,
        "Upgrade changed retained profile/coach/location/media data.",
      );
      assert.equal(
        psql(database, "select count(*) from app.coach_website_content;"),
        "0\n",
        "No optional content backfill is needed.",
      );
    } else {
      for (const file of ownedMigrations) psql(database, readMigration(file));
      psql(database, seedBeforeFitness(readFileSync("supabase/seed.sql", "utf8")));
    }
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/coach-website.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${database}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    process.stdout.write(output);
    console.log(
      `Passed DEV0321 ${mode} migration, restricted-runtime/RLS/revision/banner checks.`,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Website database rehearsal failed.",
  );
  if (error?.stdout) console.error(String(error.stdout));
  if (error?.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  for (const database of created.reverse()) {
    try {
      docker(["dropdb", "-U", "supabase_admin", database]);
      console.log(`Removed ${database}.`);
    } catch {
      console.error(
        `Cleanup failed for owned disposable database ${database}.`,
      );
      process.exitCode = 1;
    }
  }
}
