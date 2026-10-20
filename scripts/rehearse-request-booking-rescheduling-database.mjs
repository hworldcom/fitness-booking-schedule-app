import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const created = [];
const target = "20261020000100_request_booking_identity_link.sql";
const work = mkdtempSync(join(tmpdir(), "dev0388-rescheduling-"));
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= target)
  .sort();
assert.equal(files.at(-1), target);
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
function psql(db, input) {
  assert.match(db, /^dev0342_[a-z0-9_]+$/);
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
const infra = docker([
  "pg_dump",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "--schema-only",
]);
const preservation = `create temporary table preserved(name text,hash text);do $$ declare t record;v text;begin for t in select schemaname,tablename from pg_tables where schemaname='app' or (schemaname='auth' and tablename='users') or (schemaname='storage' and tablename in ('buckets','objects')) order by schemaname,tablename loop execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) from %I.%I x',t.schemaname,t.tablename) into v;insert into preserved values(t.schemaname||'.'||t.tablename,v);end loop;end $$;select jsonb_agg(to_jsonb(p) order by name) from preserved p;`;
function proof(
  db,
  extra = {},
  files = ["tests/database/request-booking-rescheduling.test.ts"],
) {
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--conditions=react-server",
      "--test",
      "--test-concurrency=1",
      ...files,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${db}`,
        ...extra,
      },
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  process.stdout.write(output);
}

try {
  for (const mode of ["fresh", "upgrade"]) {
    const db = `dev0342_${suffix}_dev0388_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", db]);
    created.push(db);
    psql(db, infra + "\nDROP SCHEMA app CASCADE;\n");
    for (const f of files.filter((f) => f !== target))
      psql(db, readFileSync(`supabase/migrations/${f}`, "utf8"));
    if (mode === "upgrade") psql(db, readFileSync("supabase/seed.sql", "utf8"));
    const manifest = join(work, mode + ".json");
    if (mode === "upgrade")
      proof(db, {
        DEV0388_EXPECT_BROKEN: "1",
        DEV0388_FIXTURE_MANIFEST: manifest,
      });
    const before = psql(db, preservation);
    psql(db, readFileSync("supabase/migrations/" + target, "utf8"));
    assert.equal(
      psql(db, preservation),
      before,
      "Request-origin migration changed retained application/Auth/Storage rows",
    );
    if (mode === "fresh") psql(db, readFileSync("supabase/seed.sql", "utf8"));
    proof(
      db,
      mode === "upgrade"
        ? { DEV0388_REUSE_FIXTURE: "1", DEV0388_FIXTURE_MANIFEST: manifest }
        : {},
    );
    proof(db, {}, [
      "tests/database/session-types.test.ts",
      "tests/database/legacy-session-type-compatibility.test.ts",
      "tests/database/typed-sessions.test.ts",
      "tests/database/group-calendar-session-types.test.ts",
    ]);
    console.log(
      `${mode}: request-origin regression, retained rows and existing typed/legacy checks passed`,
    );
  }
} catch (error) {
  console.error(
    error.stderr?.toString().slice(-4000) ||
      error.stdout?.toString().slice(-4000) ||
      error.message,
  );
  process.exitCode = 1;
} finally {
  for (const db of created)
    docker(["dropdb", "-U", "supabase_admin", "--force", db]);
  rmSync(work, { recursive: true, force: true });
  console.log(
    "Exact DEV0388 scratch databases removed; retained local database was not migrated/reset.",
  );
}
