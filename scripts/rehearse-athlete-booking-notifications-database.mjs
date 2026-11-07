// MOV-185: exact disposable databases; retained local infrastructure is read-only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { verifiedDatabaseFingerprints } from "./lib/database-fingerprints.mjs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";
assert.equal(process.argv.length, 2);
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const temporary = mkdtempSync("/tmp/mov185-sql-");
const target = "20261107000300_athlete_booking_notifications.sql",
  created = [],
  logins = [];
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= target)
  .sort();
assert.equal(files.at(-1), target);
const docker = (args, input) =>
  execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    {
      input,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
function query(name, sql) {
  assert.ok(name === "postgres" || created.includes(name));
  return docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      name,
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    sql,
  );
}
const hashes = `select jsonb_object_agg(name,hash) from (select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',schemaname,tablename),false,false,'')))[1]::text hash from pg_tables where schemaname='app' or(schemaname='auth' and tablename='users')or(schemaname='storage' and tablename in('buckets','objects'))) hashes;`;
const snapshot = (name) =>
  JSON.parse(
    verifiedDatabaseFingerprints(
      query(name, "set transaction read only;" + hashes),
    ),
  );
const attrs = `select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'security',p.prosecdef,'volatility',p.provolatile) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app';`;
const rolesQuery =
  "select md5(jsonb_agg(to_jsonb(r) order by oid)::text) from pg_authid r;";
const retained = snapshot("postgres"),
  roles = query("postgres", rolesQuery);
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
    const name = `mov185_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", name]);
    created.push(name);
    query(name, infrastructure + "\nDROP SCHEMA app CASCADE;");
    for (const f of files.filter((f) => f < target))
      query(name, readFileSync("supabase/migrations/" + f, "utf8"));
    query(name, readFileSync("supabase/seed.sql", "utf8"));
    const url = `postgresql://supabase_admin:postgres@127.0.0.1:55322/${name}`;
    const login =
        "mov185_runtime_" + randomUUID().replaceAll("-", "").slice(0, 12),
      password = randomUUID();
    query(
      name,
      `create role "${login}" login password '${password}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_runtime;`,
    );
    logins.push(login);
    const manifest = temporary + "/" + mode + ".json";
    const env = {
      ...process.env,
      DATABASE_TEST_URL: url.replace("supabase_admin:", "postgres:"),
      BELL_RUNTIME_URL: `postgresql://${login}:${password}@127.0.0.1:55322/${name}`,
      BELL_MANIFEST: manifest,
    };
    const args = [
      "--import",
      "tsx",
      "--conditions=react-server",
      "--test",
      "--test-concurrency=1",
      "tests/database/athlete-booking-notifications.test.ts",
    ];
    if (mode === "upgrade")
      execFileSync(process.execPath, args, {
        encoding: "utf8",
        env: { ...env, BELL_PREPARE: "1" },
        maxBuffer: 16 * 1024 * 1024,
      });
    const before = snapshot(name),
      attributes = JSON.parse(query(name, attrs));
    const migration = readFileSync("supabase/migrations/" + target, "utf8");
    if (mode === "upgrade") {
      const codeQuery =
        "select md5(pg_get_functiondef('app.capture_private_booking_event()'::regprocedure)||pg_get_functiondef('app.notification_command_v2(text,jsonb)'::regprocedure));";
      const priorCode = query(name, codeQuery);
      assert.throws(
        () =>
          docker(
            [
              "psql",
              "-X",
              "-qAt",
              "-U",
              "supabase_admin",
              "-d",
              name,
              "-v",
              "ON_ERROR_STOP=1",
            ],
            migration.replace(
              "end $migration$;",
              "raise exception 'forced MOV-185 atomic rollback';\nend $migration$;",
            ),
          ),
        /forced MOV-185 atomic rollback/,
      );
      assert.equal(
        query(
          name,
          "select to_regprocedure('app.notification_command_v5(text,jsonb)') is null;",
        ).trim(),
        "t",
      );
      assert.equal(query(name, codeQuery), priorCode);
      assert.deepEqual(snapshot(name), before);
      console.log(
        "PASS CLI-autocommit failure rolls back all schema/helper/bootstrap changes",
      );
    }
    query(name, migration);
    const after = snapshot(name),
      current = JSON.parse(query(name, attrs));
    for (const [key, value] of Object.entries(before))
      assert.equal(after[key], value, "Changed legacy rows: " + key);
    for (const item of attributes)
      assert.deepEqual(
        current.find((x) => x.name === item.name),
        item,
        "Changed prior function authority: " + item.name,
      );
    const output = execFileSync(
      process.execPath,
      [...args, "tests/database/registration-profile.test.ts"],
      {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        env: { ...env, BELL_REUSE: mode === "upgrade" ? "1" : "0" },
      },
    );
    console.log(output);
    console.log(
      `PASS MOV-185 ${mode}: original rows/authority preserved and athlete booking bell regression`,
    );
  }
} catch (error) {
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  throw error;
} finally {
  rmSync(temporary, { recursive: true, force: true });
  for (const name of created.reverse()) {
    docker(["dropdb", "--if-exists", "--force", "-U", "supabase_admin", name]);
    console.log("Removed owned " + name);
  }
  for (const login of logins) query("postgres", `drop role "${login}";`);
  assert.deepEqual(
    snapshot("postgres"),
    retained,
    "Retained local rows changed",
  );
  assert.equal(
    query("postgres", rolesQuery),
    roles,
    "Retained role credentials changed",
  );
  console.log(
    "PASS retained local app/Auth/Storage rows and role credentials unchanged",
  );
}
