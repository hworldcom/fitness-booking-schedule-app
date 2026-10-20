import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const migration = "20261020000200_fast_scheduling_timezone_validation.sql";
const migrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql") && file <= migration)
  .sort();
assert.equal(migrations.at(-1), migration);
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const created = [];

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
function query(database, input) {
  assert.ok(database === "postgres" || created.includes(database));
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
const fingerprints = `
  select jsonb_object_agg(name,hash) from (
    select schemaname||'.'||tablename name,
      (xpath('/table/row/hash/text()',query_to_xml(format(
        'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',
        schemaname,tablename),false,true,'')))[1]::text hash
    from pg_tables where schemaname='app'
      or (schemaname='auth' and tablename='users')
      or (schemaname='storage' and tablename in ('buckets','objects'))
  ) tables;
`;
const metadata = `select (to_jsonb(p)-'prosrc')::text from pg_proc p
  where p.oid='app.coach_local_time_is_unambiguous(timestamp,text)'::regprocedure;`;
const matrix = `
  with cases as (
    select zone,day::timestamp+make_interval(mins=>minute) local_time
    from (values('Europe/Berlin'),('UTC')) zones(zone)
    cross join (values(date '2026-10-24'),(date '2026-10-25'),
      (date '2027-03-28'),(date '2027-03-29')) dates(day)
    cross join generate_series(0,240,15) minutes(minute)
    union all select zone,local_time::timestamp from (values
      ('America/New_York','2026-11-01 01:30'),
      ('America/New_York','2027-03-14 02:30'),
      ('America/New_York','2026-11-01 03:30'),
      ('Australia/Lord_Howe','2026-04-05 01:45'),
      ('Australia/Lord_Howe','2026-10-04 02:15'),
      ('Australia/Lord_Howe','2026-10-04 03:00'),
      ('Asia/Kathmandu','2026-10-25 02:30'),
      ('not/a-timezone','2026-10-25 02:30'),
      ('utc','2026-10-25 02:30'),('', '2026-10-25 02:30'),
      (null,'2026-10-25 02:30'),('Europe/Berlin',null),(null,null)
    ) extra(zone,local_time)
  )
  select jsonb_agg(jsonb_build_array(zone,local_time,
    app.coach_local_time_is_unambiguous(local_time,zone))
    order by zone nulls last,local_time nulls last) from cases;
`;
const tests = [
  "tests/database/coach-local-time.test.ts",
  "tests/database/coach-availability.test.ts",
  "tests/database/effective-availability.test.ts",
  "tests/database/typed-sessions.test.ts",
  "tests/database/request-booking-rescheduling.test.ts",
];

const retainedBefore = query(
  "postgres",
  "set transaction read only;" + fingerprints,
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
    const database = `dev0342_${suffix}_dev0396_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    query(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of migrations.filter((file) => file !== migration)) {
      query(database, readFileSync(`supabase/migrations/${file}`, "utf8"));
    }
    if (mode === "upgrade") {
      query(database, readFileSync("supabase/seed.sql", "utf8"));
      // Preserve a claimed identity as well as the six unclaimed seed coaches.
      // This account exists only in this newly created scratch database.
      query(
        database,
        `with fixture as (
          insert into auth.users(id,is_sso_user,is_anonymous)
          values(gen_random_uuid(),false,false) returning id
        ) select * from app.enroll_application_identity(
          (select id from fixture),'DEV0396 upgrade preservation'
        );`,
      );
    }
    const beforeRows = query(database, fingerprints);
    const beforeMetadata = query(database, metadata);
    const beforeStart = performance.now();
    const beforeMatrix = query(database, matrix);
    const beforeTime = performance.now() - beforeStart;
    query(database, readFileSync(`supabase/migrations/${migration}`, "utf8"));
    assert.equal(
      query(database, fingerprints),
      beforeRows,
      "Migration changed rows",
    );
    assert.equal(
      query(database, metadata),
      beforeMetadata,
      "Function contract changed",
    );
    const afterStart = performance.now();
    assert.equal(
      query(database, matrix),
      beforeMatrix,
      "Time validation changed",
    );
    console.log(
      `${mode}: ${JSON.parse(beforeMatrix).length} before/after results identical; matrix ${beforeTime.toFixed(1)} → ${(performance.now() - afterStart).toFixed(1)} ms; rows/function identity, owner, privileges and configuration preserved`,
    );
    if (mode === "fresh") {
      query(database, readFileSync("supabase/seed.sql", "utf8"));
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
          ...tests,
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${database}`,
          },
          maxBuffer: 8 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
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
  for (const database of created) {
    docker(["dropdb", "-U", "supabase_admin", "--force", database]);
  }
  assert.equal(
    query("postgres", "set transaction read only;" + fingerprints),
    retainedBefore,
    "Retained local app/Auth-user/Storage rows changed",
  );
  console.log(
    "Exact DEV0396 scratch databases removed; retained local database preserved.",
  );
}
