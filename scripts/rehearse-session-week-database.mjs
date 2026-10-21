import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const migration = "20261021000100_prune_private_session_time_candidates.sql";
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
  where p.oid='app.public_session_type_times(text,uuid,uuid,date)'::regprocedure;`;
const oldSource = readFileSync(
  "supabase/migrations/20261018000800_typed_private_sessions.sql",
  "utf8",
);
const reference =
  oldSource
    .slice(
      oldSource.indexOf("create function app.public_session_type_times("),
      oldSource.indexOf("\n\ncreate function app.request_session_type("),
    )
    .replace("app.public_session_type_times(", "app.dev0402_reference_times(")
    .replace(
      "set search_path='' as $$",
      () => "set search_path='' set jit=off as $$",
    ) +
  "\nalter function app.dev0402_reference_times(text,uuid,uuid,date) owner to app_owner;\nrevoke all on function app.dev0402_reference_times(text,uuid,uuid,date) from public;\ngrant execute on function app.dev0402_reference_times(text,uuid,uuid,date) to app_runtime;";
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
    const database = `dev0342_${suffix}_dev0402_${mode}`;
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
          (select id from fixture),'DEV0402 upgrade preservation'
        );`,
      );
    }
    const beforeRows = query(database, fingerprints);
    const beforeMetadata = query(database, metadata);
    query(database, reference);
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
    console.log(
      `${mode}: rows and function identity/owner/ACL/configuration preserved`,
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
      error.stdout?.toString().slice(-14000) ||
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
    "Exact DEV0402 scratch databases removed; retained local database preserved.",
  );
}
