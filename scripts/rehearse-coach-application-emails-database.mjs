import assert from "node:assert/strict";
import { verifiedDatabaseFingerprints } from "./lib/database-fingerprints.mjs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const migration = "20261026000100_coach_application_contacts.sql";
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= migration)
  .sort();
assert.equal(files.at(-1), migration);
const created = [];
const logins = [];
function docker(args, input) {
  return execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}
function query(db, sql) {
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
    sql,
  );
}
const fingerprints = `select jsonb_object_agg(name,hash) from (
 select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format(
 'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',
 schemaname,tablename),false,false,'')))[1]::text hash from pg_tables
 where (schemaname='app' and tablename not in ('coach_application_emails','coach_application_contacts'))
 or (schemaname='auth' and tablename='users')
 or (schemaname='storage' and tablename in ('buckets','objects'))) hashes;`;
const retainedFingerprints = fingerprints.replace(
  / and tablename not in \([^)]*\)/,
  "",
);
const retained = verifiedDatabaseFingerprints(
  query("postgres", "set transaction read only;" + retainedFingerprints),
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
    const database = `mov108_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    query(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of files.filter((f) => f < migration))
      query(database, readFileSync(`supabase/migrations/${file}`, "utf8"));
    query(database, readFileSync("supabase/seed.sql", "utf8"));
    if (mode === "upgrade")
      query(
        database,
        `
      do $$ declare ident uuid:=gen_random_uuid();p record;begin
        insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(ident,'retained-'||ident::text||'@example.test',statement_timestamp(),false,false);
        select * into p from app.enroll_application_identity(ident,'Retained applicant');
        perform set_config('app.current_auth_user_id',ident::text,true);
        perform set_config('app.current_profile_id',p.identity_profile_id::text,true);
        perform set_config('app.current_run_id',p.identity_run_id::text,true);
        perform set_config('app.current_run_role','member',true);
        perform app.submit_owned_coach_application();
        perform app.upsert_owned_coach_profile('Retained applicant','Existing complete pending application must not be backfilled by the email migration.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null);
      end $$;
    `,
      );
    const before = verifiedDatabaseFingerprints(query(database, fingerprints));
    const oldJobs = query(
      database,
      "select coalesce(jsonb_agg(to_jsonb(j) order by j.id),'[]') from app.coach_application_emails j;",
    );
    query(database, readFileSync(`supabase/migrations/${migration}`, "utf8"));
    assert.equal(
      verifiedDatabaseFingerprints(query(database, fingerprints)),
      before,
      "Migration changed existing rows",
    );
    assert.equal(
      query(database, "select count(*) from app.coach_application_contacts;"),
      "0\n",
      "Migration backfilled private contacts",
    );
    assert.equal(
      query(
        database,
        "select coalesce(jsonb_agg(to_jsonb(j)-'contact_details' order by j.id),'[]') from app.coach_application_emails j;",
      ),
      oldJobs,
      "Migration changed historical email jobs",
    );
    const login = `mov108_worker_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const password = randomUUID();
    query(
      database,
      `create role "${login}" login password '${password}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_notification_worker;`,
    );
    logins.push(login);
    const appLogin = `mov108_app_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const appPassword = randomUUID();
    query(
      database,
      `create role "${appLogin}" login password '${appPassword}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_runtime;`,
    );
    logins.push(appLogin);
    process.stdout.write(
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "--test",
          "--test-concurrency=1",
          "tests/database/coach-application-emails.test.ts",
        ],
        {
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
          env: {
            ...process.env,
            DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${database}`,
            NOTIFICATION_TEST_WORKER_URL: `postgresql://${login}:${password}@127.0.0.1:55322/${database}`,
            NOTIFICATION_TEST_RUNTIME_URL: `postgresql://${appLogin}:${appPassword}@127.0.0.1:55322/${database}`,
          },
        },
      ),
    );
    console.log(
      `${mode}: application migration, atomic capture, restricted worker and local staff email passed`,
    );
  }
} catch (error) {
  console.error(
    error.stdout?.toString().slice(-14000) ||
      error.stderr?.toString().slice(-6000) ||
      error.message,
  );
  process.exitCode = 1;
} finally {
  for (const db of created)
    docker(["dropdb", "-U", "supabase_admin", "--force", db]);
  for (const login of logins) query("postgres", `drop role "${login}";`);
  assert.equal(
    verifiedDatabaseFingerprints(
      query("postgres", "set transaction read only;" + retainedFingerprints),
    ),
    retained,
    "Retained local data changed",
  );
  console.log(
    "Owned notification scratch databases removed; retained app/Auth/Storage rows preserved.",
  );
}
