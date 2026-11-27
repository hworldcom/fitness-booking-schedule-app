// MOV-292: use retained infrastructure read-only; own exact disposable DBs/logins.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { verifiedDatabaseFingerprints } from "./lib/database-fingerprints.mjs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";
const allRequests = process.argv[2] === "--all-requests";
assert.ok(
  process.argv.length === 2 || (process.argv.length === 3 && allRequests),
);
const issue = allRequests ? "mov293" : "mov292";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const target = allRequests
  ? "20261127000300_athlete_coaches_all_requests.sql"
  : "20261127000200_athlete_coach_roster.sql";
const contractTest = allRequests
  ? "tests/database/athlete-coach-requests.test.ts"
  : "tests/database/athlete-coaches.test.ts";
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= target)
  .sort();
assert.equal(files.at(-1), target);
const temporary = mkdtempSync(`/tmp/${issue}-sql-`),
  created = [],
  logins = [];
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
function query(name, text) {
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
    text,
  );
}
const hashes = `select jsonb_object_agg(name,hash) from (select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',schemaname,tablename),false,false,'')))[1]::text hash from pg_tables where schemaname='app' or(schemaname='auth' and tablename='users')or(schemaname='storage' and tablename in('buckets','objects'))) hashes;`;
const snapshot = (name) =>
  JSON.parse(
    verifiedDatabaseFingerprints(
      query(name, "set transaction read only;" + hashes),
    ),
  );
const attrs = `select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'security',p.prosecdef,'volatility',p.provolatile,'sourceHash',md5(p.prosrc)) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app';`;
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
    const name = `${issue}_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", name]);
    created.push(name);
    query(name, infrastructure + "\nDROP SCHEMA app CASCADE;");
    for (const file of files.filter((f) => f < target))
      query(name, readFileSync("supabase/migrations/" + file, "utf8"));
    query(name, readFileSync("supabase/seed.sql", "utf8"));
    const login =
        issue + "_runtime_" + randomUUID().replaceAll("-", "").slice(0, 12),
      password = randomUUID();
    query(
      name,
      `create role "${login}" login password '${password}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_runtime;`,
    );
    logins.push(login);
    const env = {
      ...process.env,
      DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${name}`,
      CONNECTION_NOTICE_RUNTIME_URL: `postgresql://${login}:${password}@127.0.0.1:55322/${name}`,
      CONNECTION_NOTICE_MANIFEST: temporary + "/" + mode + ".json",
    };
    const migration = readFileSync("supabase/migrations/" + target, "utf8");
    const prior = query(name, attrs);
    if (mode === "fresh") query(name, migration);
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "tests/database/connection-request-notifications.test.ts",
      ],
      {
        encoding: "utf8",
        env: { ...env, CONNECTION_NOTICE_PREPARE: "1" },
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "tests/database/athlete-coaches.test.ts",
      ],
      {
        encoding: "utf8",
        env: { ...env, ATHLETE_COACH_PREPARE: "1" },
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    if (allRequests)
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "--test",
          contractTest,
        ],
        {
          encoding: "utf8",
          env: { ...env, ATHLETE_COACH_REQUEST_PREPARE: "1" },
          maxBuffer: 16 * 1024 * 1024,
        },
      );
    const before = snapshot(name);
    if (mode === "upgrade") {
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
        "begin;" + migration + "rollback;",
      );
      assert.equal(query(name, attrs), prior);
      assert.deepEqual(snapshot(name), before);
      query(name, migration);
    }
    assert.deepEqual(snapshot(name), before, "Migration must not rewrite rows");
    const current = JSON.parse(query(name, attrs));
    for (const item of JSON.parse(prior)) {
      const actual = current.find((x) => x.name === item.name);
      if (allRequests && item.name.startsWith("app.current_athlete_coaches(")) {
        const { sourceHash: beforeSource, ...authority } = item;
        const { sourceHash: afterSource, ...newAuthority } = actual;
        assert.deepEqual(
          newAuthority,
          authority,
          "Roster signature/owner/ACL changed",
        );
        assert.notEqual(afterSource, beforeSource);
      } else
        assert.deepEqual(
          actual,
          item,
          "Changed existing authority: " + item.name,
        );
    }
    if (allRequests) assert.equal(current.length, JSON.parse(prior).length);
    query(name, migration);
    assert.deepEqual(snapshot(name), before, "Reapply must preserve rows");
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", "--conditions=react-server", "--test", contractTest],
      { encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024 },
    );
    console.log(output);
    console.log(
      `PASS ${issue.toUpperCase()} ${mode}: migration/reapply, original authority/data preservation and restricted roster contracts`,
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
    "Retained application/Auth/Storage rows changed",
  );
  assert.equal(query("postgres", rolesQuery), roles, "Retained roles changed");
  console.log(
    "PASS retained application/Auth/Storage rows and role credentials unchanged",
  );
}
