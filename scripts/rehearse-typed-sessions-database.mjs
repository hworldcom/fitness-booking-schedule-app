import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const created = [];
const target = "20261018000900_group_and_calendar_session_types.sql";
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
const preservation = `create temporary table preserved(name text,hash text);do $$ declare t record; v text; begin for t in select tablename from pg_tables where schemaname='app' and tablename not in ('coach_session_types','coach_session_type_commands','session_booking_commands','session_booking_changes') order by tablename loop execute format('select md5(coalesce(jsonb_agg((to_jsonb(x)-array[''session_type_id'',''session_type_snapshot'',''replacement_booking_id'',''schedule_revision'']) order by (to_jsonb(x)-array[''session_type_id'',''session_type_snapshot'',''replacement_booking_id'',''schedule_revision''])::text)::text,''[]'')) from app.%I x',t.tablename) into v;insert into preserved values(t.tablename,v);end loop;end $$;select jsonb_agg(to_jsonb(p) order by name) from preserved p;`;
try {
  for (const mode of process.env.SESSION_TYPES_UI_ONLY
    ? ["fresh"]
    : ["fresh", "upgrade"]) {
    const db = `dev0342_${suffix}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", db]);
    created.push(db);
    psql(db, infra + "\nDROP SCHEMA app CASCADE;\n");
    for (const f of files.filter((f) => f < "20261018000700"))
      psql(db, readFileSync(`supabase/migrations/${f}`, "utf8"));
    if (mode === "upgrade") psql(db, readFileSync("supabase/seed.sql", "utf8"));
    if (mode === "upgrade" && !process.env.SESSION_TYPES_UI_ONLY) {
      const proof = execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "--test",
          "tests/database/legacy-session-type-compatibility.test.ts",
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${db}`,
          },
          maxBuffer: 4 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      process.stdout.write(proof);
    }
    const before = mode === "upgrade" ? psql(db, preservation) : null;
    for (const f of files.filter((f) => f >= "20261018000700"))
      psql(db, readFileSync(`supabase/migrations/${f}`, "utf8"));
    if (mode === "upgrade") {
      assert.equal(
        psql(db, "select count(*) from app.session_booking_commands;"),
        "0\n",
      );
      assert.equal(
        psql(db, preservation),
        before,
        "Migration changed retained records",
      );
      psql(db, preservation);
    } else psql(db, readFileSync("supabase/seed.sql", "utf8"));
    if (!process.env.SESSION_TYPES_UI_ONLY) {
      const output = execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "--test",
          "--test-concurrency=1",
          "tests/database/session-types.test.ts",
          "tests/database/legacy-session-type-compatibility.test.ts",
          "tests/database/typed-sessions.test.ts",
          "tests/database/group-calendar-session-types.test.ts",
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${db}`,
          },
          maxBuffer: 8 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      process.stdout.write(output);
      console.log(`${mode}: session type checks passed`);
    } else console.log("fresh: isolated schema prepared for UI rehearsal");
    if (mode === "fresh" && process.env.SESSION_TYPES_UI_ROOT) {
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "scripts/rehearse-session-types-ui.ts",
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${db}`,
          },
          maxBuffer: 8 * 1024 * 1024,
          stdio: ["ignore", "inherit", "inherit"],
        },
      );
    }
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
}
