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
const owned = "20261018000400_coach_pair_reviews.sql";
const files = readdirSync("supabase/migrations")
  .filter((x) => x.endsWith(".sql") && x <= owned)
  .sort();
assert.ok(files.includes(owned));
const migrations = new Map(
  files.map((file) => [
    file,
    readFileSync("supabase/migrations/" + file, "utf8"),
  ]),
);
const created = [];
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
function docker(args, input) {
  return execFileSync(
    "docker",
    [
      "exec",
      ...(input === undefined ? [] : ["-i"]),
      LOCAL_SUPABASE_DATABASE_CONTAINER,
      ...args,
    ],
    {
      input,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}
function psql(database, input) {
  assert.match(database, /^dev0314_[a-z0-9_]+$/);
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
// Only infrastructure/schema, never retained users, tokens, uploads or private rows.
const infrastructure = docker([
  "pg_dump",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "--schema-only",
]);
const fingerprint = `create temp table review_preserved(name text,n bigint,hash text);
do $body$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in ('app','auth','storage') and tablename not in ('coach_pair_reviews','coach_review_moderation_audit') order by schemaname,tablename loop
 execute format('insert into review_preserved select %L,count(*),md5(coalesce(string_agg(to_jsonb(t)::text,%L order by to_jsonb(t)::text),%L)) from %I.%I t',item.schemaname||'.'||item.tablename,'','',item.schemaname,item.tablename);
end loop; end $body$; select jsonb_agg(to_jsonb(t) order by name) from review_preserved t;`;
try {
  for (const mode of ["fresh", "upgrade"]) {
    const database = `dev0314_${suffix}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    psql(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of files.filter((file) => file !== owned))
      psql(database, migrations.get(file));
    if (mode === "upgrade")
      psql(
        database,
        seedBeforeFitness(readFileSync("supabase/seed.sql", "utf8")),
      );
    const before = psql(database, fingerprint);
    psql(database, migrations.get(owned));
    assert.equal(
      psql(database, fingerprint),
      before,
      "Existing app/Auth/Storage data changed during review migration.",
    );
    console.log(
      `Validated DEV0314 ${mode} migration and preserved-row fingerprints.`,
    );
    if (mode === "fresh")
      psql(
        database,
        seedBeforeFitness(readFileSync("supabase/seed.sql", "utf8")),
      );
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/coach-reviews.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${database}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 180000,
      },
    );
    process.stdout.write(output);
    assert.equal(
      readFileSync("supabase/migrations/" + owned, "utf8"),
      migrations.get(owned),
      "Review migration changed during rehearsal; rerun before recording evidence.",
    );
    console.log(
      `Passed DEV0314 ${mode} installation with unchanged original rows.`,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Review database rehearsal failed.",
  );
  if (error?.stdout) console.error(String(error.stdout));
  if (error?.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  for (const database of created.reverse())
    try {
      docker(["dropdb", "-U", "supabase_admin", database]);
      console.log(`Removed owned database ${database}.`);
    } catch {
      console.error(`Cleanup failed for owned database ${database}.`);
      process.exitCode = 1;
    }
}
