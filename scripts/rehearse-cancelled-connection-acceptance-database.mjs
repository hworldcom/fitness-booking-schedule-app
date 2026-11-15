// MOV-239: all writes belong to fresh, uniquely named scratch databases.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { verifiedDatabaseFingerprints } from "./lib/database-fingerprints.mjs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const target = "20261115000200_coach_cancelled_connection_acceptance.sql";
const migrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql") && file <= target)
  .sort();
assert.equal(migrations.at(-1), target);
const created = [];
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const docker = (args, input) =>
  execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    { input, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
  );
function query(database, input) {
  assert.ok(database === "postgres" || created.includes(database));
  if (database === "postgres")
    assert.match(input, /^set transaction read only;/);
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
function schemaLint(database) {
  assert.ok(created.includes(database));
  const result = spawnSync(
    "node_modules/.bin/supabase",
    [
      "db",
      "lint",
      "--db-url",
      `postgresql://supabase_admin:postgres@127.0.0.1:55322/${database}`,
      "--schema",
      "app",
      "--fail-on",
      "warning",
    ],
    { encoding: "utf8", timeout: 60000 },
  );
  assert.ifError(result.error);
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  const diagnostics = JSON.parse(result.stdout).results;
  assert.ok(
    Array.isArray(diagnostics),
    "Expected full schema lint diagnostics",
  );
  return diagnostics.sort((a, b) => a.function.localeCompare(b.function));
}
const fingerprints = `select jsonb_object_agg(name,hash) from (
  select schemaname||'.'||tablename name,
    (xpath('/table/row/hash/text()',query_to_xml(format(
      'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',
      schemaname,tablename),false,false,'')))[1]::text hash
  from pg_tables where schemaname='app'
    or (schemaname='auth' and tablename='users')
    or (schemaname='storage' and tablename in ('buckets','objects'))
) tables;`;
const authority = `select jsonb_agg(to_jsonb(p)-'prosrc' order by p.oid)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.proname not in ('coach_connection_acceptance_eligible','lock_coach_connection_acceptance_eligibility');`;
const roleSnapshot = query(
  "postgres",
  "set transaction read only;select md5(jsonb_build_object('roles',(select jsonb_agg(to_jsonb(r) order by oid) from pg_authid r),'memberships',(select jsonb_agg(to_jsonb(m) order by roleid,member,grantor) from pg_auth_members m))::text);",
);
const retainedBefore = verifiedDatabaseFingerprints(
  query("postgres", "set transaction read only;" + fingerprints),
);
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
    const database = `mov239_${suffix}_${mode}`;
    // createdb refuses an existing name; only a successful creation is owned.
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    console.log(`Created owned scratch database ${database}`);
    query(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of migrations.filter((file) => file !== target))
      query(database, readFileSync("supabase/migrations/" + file, "utf8"));
    if (mode === "upgrade")
      query(database, readFileSync("supabase/seed.sql", "utf8"));
    const before = verifiedDatabaseFingerprints(query(database, fingerprints));
    const security = query(database, authority);
    const lintBefore = schemaLint(database);
    if (mode === "fresh") {
      query(database, readFileSync("supabase/migrations/" + target, "utf8"));
      assert.equal(
        verifiedDatabaseFingerprints(query(database, fingerprints)),
        before,
      );
      assert.equal(query(database, authority), security);
    }
    if (mode === "fresh")
      query(database, readFileSync("supabase/seed.sql", "utf8"));
    const result = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/coach-athlete-connections.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CONNECTION_CANCELLATION_UPGRADE: mode === "upgrade" ? "1" : "0",
          DATABASE_TEST_URL: `postgresql://supabase_admin:postgres@127.0.0.1:55322/${database}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    process.stdout.write(result);
    assert.equal(query(database, authority), security);
    const afterTests = verifiedDatabaseFingerprints(
      query(database, fingerprints),
    );
    // Reapplying the reviewed definitions must not rewrite data or privileges.
    query(database, readFileSync("supabase/migrations/" + target, "utf8"));
    assert.equal(
      verifiedDatabaseFingerprints(query(database, fingerprints)),
      afterTests,
    );
    assert.equal(query(database, authority), security);
    const lintAfter = schemaLint(database);
    const changedFunctions = new Set([
      "app.coach_connection_acceptance_eligible",
      "app.lock_coach_connection_acceptance_eligibility",
      "app.connection_attempt_projection",
      "app.decide_coach_athlete_connection",
    ]);
    assert.deepEqual(
      lintAfter.filter((item) => changedFunctions.has(item.function)),
      [],
    );
    assert.deepEqual(
      lintAfter,
      lintBefore,
      "Migration introduced schema lint diagnostics",
    );
    console.log(
      `PASS ${mode}: cancelled-session coach acceptance, concurrency/authority, migration/reapply; changed functions lint clean, ${lintBefore.length} pre-existing diagnostic functions unchanged`,
    );
  }
} catch (error) {
  console.error(error.message);
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  for (const database of created.reverse()) {
    try {
      docker(["dropdb", "-U", "supabase_admin", database]);
      console.log(`Removed owned scratch database ${database}`);
    } catch (error) {
      console.error(`Cleanup failed for ${database}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  assert.equal(
    verifiedDatabaseFingerprints(
      query("postgres", "set transaction read only;" + fingerprints),
    ),
    retainedBefore,
    "Retained application/Auth/Storage data changed",
  );
  assert.equal(
    query(
      "postgres",
      "set transaction read only;select md5(jsonb_build_object('roles',(select jsonb_agg(to_jsonb(r) order by oid) from pg_authid r),'memberships',(select jsonb_agg(to_jsonb(m) order by roleid,member,grantor) from pg_auth_members m))::text);",
    ),
    roleSnapshot,
  );
  console.log(
    "Retained application/Auth/Storage rows and role credentials unchanged.",
  );
}
