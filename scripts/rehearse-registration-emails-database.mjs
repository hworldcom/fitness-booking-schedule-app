// MOV-175: uniquely owned scratch databases; infrastructure only, no retained identities/rows.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { verifiedDatabaseFingerprints } from "./lib/database-fingerprints.mjs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
assert.equal(process.argv.length, 2);
const migration = "20261106000100_registration_staff_emails.sql";
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= migration)
  .sort();
assert.equal(files.at(-1), migration);
const created = [];
const logins = [];
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
const hashes = `select jsonb_object_agg(name,hash) from (select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',schemaname,tablename),false,false,'')))[1]::text hash from pg_tables where schemaname='app' or (schemaname='auth' and tablename='users') or (schemaname='storage' and tablename in ('buckets','objects'))) hashes;`;
const attrs = `select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'security',p.prosecdef,'volatility',p.provolatile) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app';`;
const retained = verifiedDatabaseFingerprints(
  query("postgres", "set transaction read only;" + hashes),
);
const rolesQuery =
  "select md5(jsonb_agg(to_jsonb(r) order by oid)::text) from pg_authid r;";
const roles = query("postgres", rolesQuery);
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
    const db = `mov175_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", db]);
    created.push(db);
    query(db, infrastructure + "\nDROP SCHEMA app CASCADE;");
    for (const file of files.filter((f) => f < migration))
      query(db, readFileSync("supabase/migrations/" + file, "utf8"));
    if (mode !== "fresh") {
      query(db, readFileSync("supabase/seed.sql", "utf8"));
      query(
        db,
        `insert into auth.users(id,email,created_at,is_anonymous,is_sso_user)
        values('17500000-0000-4000-8000-000000000001','retained-unverified@example.test',statement_timestamp(),false,false);
        insert into auth.users(id,email,created_at,email_confirmed_at,is_anonymous,is_sso_user)
        values('17500000-0000-4000-8000-000000000002','retained-verified@example.test',statement_timestamp(),statement_timestamp(),false,false);`,
      );
    }
    const before = verifiedDatabaseFingerprints(query(db, hashes));
    const authority = query(db, attrs);
    const oldOids = query(
      db,
      "select string_agg(p.oid::text,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app';",
    ).trim();
    const unchangedBodies = query(
      db,
      `select md5(jsonb_agg(jsonb_build_object('id',p.oid,'body',p.prosrc) order by p.oid)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.oid=any('{${oldOids}}'::oid[]);`,
    );
    query(db, readFileSync("supabase/migrations/" + migration, "utf8"));
    assert.equal(
      verifiedDatabaseFingerprints(
        query(
          db,
          hashes.replace(
            "where schemaname='app'",
            "where (schemaname='app' and tablename not in ('registration_emails'))",
          ),
        ),
      ),
      before,
      "Migration changed existing rows/revisions",
    );
    const oldFunctions = JSON.parse(authority);
    const newFunctions = JSON.parse(query(db, attrs));
    assert.deepEqual(
      newFunctions.filter((f) => oldFunctions.some((o) => o.name === f.name)),
      oldFunctions,
      "Existing function authority changed",
    );
    assert.equal(
      query(db, "select count(*) from app.registration_emails;").trim(),
      "0",
      "Historical registration backfill is forbidden",
    );
    assert.equal(
      query(
        db,
        `select md5(jsonb_agg(jsonb_build_object('id',p.oid,'body',p.prosrc) order by p.oid)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.oid=any('{${oldOids}}'::oid[]);`,
      ),
      unchangedBodies,
      "Unrelated function body changed",
    );
    if (mode === "fresh") query(db, readFileSync("supabase/seed.sql", "utf8"));
    if (mode === "upgrade") {
      query(
        db,
        "update auth.users set email_confirmed_at=statement_timestamp() where id='17500000-0000-4000-8000-000000000001';",
      );
      assert.equal(
        query(db, "select count(*) from app.registration_emails;").trim(),
        "0",
        "Later verification must not backfill a retained signup",
      );
    }
    const login = `mov175_worker_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const password = randomUUID();
    query(
      db,
      `create role "${login}" login password '${password}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_notification_worker;`,
    );
    logins.push(login);
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/registration-emails.test.ts",
        "tests/database/registration-profile.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_TEST_URL: `postgresql://supabase_admin:postgres@127.0.0.1:55322/${db}`,
          NOTIFICATION_TEST_DATABASE_URL: `postgresql://${login}:${password}@127.0.0.1:55322/${db}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    process.stdout.write(output);
    console.log(
      `PASS MOV-175 ${mode}: current migration chain, no backfill, real restricted worker and registration regression`,
    );
  }
} catch (error) {
  console.error(error.message);
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  for (const db of created.reverse()) {
    try {
      docker(["dropdb", "-U", "supabase_admin", db]);
      console.log(`Removed owned ${db}`);
    } catch {
      console.error(`Cleanup failed: ${db}`);
      process.exitCode = 1;
    }
  }
  for (const login of logins) query("postgres", `drop role "${login}";`);
  assert.equal(
    verifiedDatabaseFingerprints(
      query("postgres", "set transaction read only;" + hashes),
    ),
    retained,
    "Retained rows changed",
  );
  assert.equal(query("postgres", rolesQuery), roles, "Retained roles changed");
  console.log(
    "PASS retained local app/Auth/Storage rows and role credentials unchanged",
  );
}
