import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const migration = "20261025000100_coach_training_media.sql";
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= migration)
  .sort();
const created = [],
  logins = [];
function docker(args, input) {
  return execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}
function query(db, input) {
  assert.ok(db === "postgres" || created.includes(db));
  return docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    input,
  );
}
const hashes = `select jsonb_object_agg(name,hash) from (select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',schemaname,tablename),false,true,'')))[1]::text hash from pg_tables where schemaname='app' or (schemaname='auth' and tablename='users') or (schemaname='storage' and tablename in ('buckets','objects'))) hashes;`;
const retained = query("postgres", "set transaction read only;" + hashes);
const hadWorker =
  query(
    "postgres",
    "select count(*) from pg_roles where rolname='app_media_worker';",
  ) === "1\n";
try {
  const infrastructure = docker([
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "--schema-only",
  ]);
  for (const mode of ["fresh", "upgrade"]) {
    const db = `mov19_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", db]);
    created.push(db);
    query(db, infrastructure + "\nDROP SCHEMA app CASCADE;");
    for (const file of files.filter((f) => f < migration))
      query(db, readFileSync("supabase/migrations/" + file, "utf8"));
    if (mode === "upgrade")
      query(db, readFileSync("supabase/seed.sql", "utf8"));
    const before = query(db, hashes);
    query(db, readFileSync("supabase/migrations/" + migration, "utf8"));
    const after = query(
      db,
      hashes
        .replace(
          "where schemaname='app'",
          "where (schemaname='app' and tablename not in ('coach_media_sets','coach_media_assets'))",
        )
        .replace("tablename in ('buckets','objects')", "tablename='objects'"),
    );
    const b = JSON.parse(before),
      a = JSON.parse(after);
    delete b["storage.buckets"];
    assert.deepEqual(a, b, "Existing rows changed across media migration");
    assert.equal(
      query(
        db,
        "select count(*) from app.coach_media_sets;select count(*) from app.coach_media_assets;",
      ),
      "0\n0\n",
    );
    if (mode === "fresh") query(db, readFileSync("supabase/seed.sql", "utf8"));
    const urls = {};
    for (const [key, role] of [
      ["runtime", "app_runtime"],
      ["worker", "app_media_worker"],
    ]) {
      const name = `mov19_${key}_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        password = randomUUID();
      query(
        db,
        `create role "${name}" login password '${password}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role ${role};`,
      );
      logins.push(name);
      urls[key] = `postgresql://${name}:${password}@127.0.0.1:55322/${db}`;
    }
    process.stdout.write(
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "--test",
          "--test-concurrency=1",
          "tests/database/coach-media.test.ts",
        ],
        {
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
          env: {
            ...process.env,
            DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${db}`,
            COACH_MEDIA_TEST_RUNTIME_URL: urls.runtime,
            COACH_MEDIA_TEST_WORKER_URL: urls.worker,
          },
        },
      ),
    );
    console.log(`${mode}: media migration and real SQL acceptance passed`);
  }
} catch (error) {
  console.error(
    error.stdout?.toString().slice(-10000) ||
      error.stderr?.toString().slice(-10000) ||
      error.message,
  );
  process.exitCode = 1;
} finally {
  for (const db of created)
    docker(["dropdb", "-U", "supabase_admin", "--force", db]);
  for (const login of logins) query("postgres", `drop role "${login}";`);
  if (!hadWorker) query("postgres", "drop role app_media_worker;");
  assert.equal(
    query("postgres", "set transaction read only;" + hashes),
    retained,
    "Retained application/Auth/Storage rows changed",
  );
  console.log(
    "Removed owned media scratch databases/logins; retained rows preserved.",
  );
}
