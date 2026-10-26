import { verifiedDatabaseFingerprints } from "./lib/database-fingerprints.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const migration = "20261023000200_private_booking_notifications.sql";
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
 where (schemaname='app' and tablename not in ('booking_notification_events','booking_notification_receipts'))
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
    const database = `mov85_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    query(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of files.filter(
      (f) => f < "20261023000100_message_notifications.sql",
    ))
      query(database, readFileSync(`supabase/migrations/${file}`, "utf8"));
    query(database, readFileSync("supabase/seed.sql", "utf8"));
    query(
      database,
      readFileSync(
        "supabase/migrations/20261023000100_message_notifications.sql",
        "utf8",
      ),
    );
    if (mode === "upgrade")
      query(
        database,
        `
      select app.mail_flags(true);
      with pair as (
        select c.run_id,c.profile_id coach_id,m.profile_id athlete_id from app.coach_profiles c
        join app.demo_run_participants m on m.run_id=c.run_id and m.profile_id<>c.profile_id limit 1
      ), conversation as (
        insert into app.message_conversations(run_id,coach_profile_id,athlete_profile_id,last_seq)
        select run_id,coach_id,athlete_id,1 from pair returning id,coach_profile_id
      ) insert into app.message_entries(conversation_id,seq,sender_profile_id,kind,body,submission_id)
        select id,1,coach_profile_id,'text','MOV79 retained pre-migration message',gen_random_uuid() from conversation;
      insert into app.coach_booking_requests(run_id,slot_id,coach_profile_id,client_profile_id,status,
        scheduled_start_at,scheduled_end_at,coach_timezone,coach_training_location_id,training_location_name,
        location_kind,gym_name,public_location_label,decision_deadline_at)
      select s.run_id,s.id,s.profile_id,m.profile_id,'pending',s.starts_at,s.ends_at,s.coach_timezone,
        s.coach_training_location_id,coalesce(s.training_location_name,s.gym_name,s.public_location_label),
        s.location_kind,s.gym_name,s.public_location_label,least(statement_timestamp()+interval '12 hours',s.starts_at)
      from app.coach_availability_slots s join app.demo_run_participants m on m.run_id=s.run_id and m.profile_id<>s.profile_id
      where s.status='open' and s.starts_at>statement_timestamp()+interval '5 minutes' order by s.starts_at,m.profile_id limit 1;
      select app.mail_flags(false);

    `,
      );
    const before = verifiedDatabaseFingerprints(query(database, fingerprints));
    query(database, readFileSync(`supabase/migrations/${migration}`, "utf8"));
    assert.equal(
      verifiedDatabaseFingerprints(query(database, fingerprints)),
      before,
      "Migration changed existing rows",
    );
    assert.equal(
      query(
        database,
        "select count(*) from app.booking_notification_events; select count(*) from app.booking_notification_receipts;",
      ),
      "0\n0\n",
      "Migration backfilled history",
    );
    // Current shared worker requires the later group-aware boundary; stage migration preservation was checked above.
    for (const file of [
      "20261024000100_group_registration_approvals.sql",
      "20261024000200_group_notifications.sql",
    ])
      query(database, readFileSync(`supabase/migrations/${file}`, "utf8"));
    const login = `mov85_worker_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const password = randomUUID();
    query(
      database,
      `create role "${login}" login password '${password}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_notification_worker;`,
    );
    logins.push(login);
    const appLogin = `mov85_app_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
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
          "tests/database/booking-notifications.test.ts",
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
      `${mode}: notification migration, permissions, lifecycle and message regressions passed`,
    );
  }
} catch (error) {
  console.error(
    error.stderr?.toString().slice(-6000) ||
      error.stdout?.toString().slice(-6000) ||
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
