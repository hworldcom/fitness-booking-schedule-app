import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const container = LOCAL_SUPABASE_DATABASE_CONTAINER;
const database = `dev0366_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
function docker(args, input) {
  return execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    {
      input,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}
function psql(input) {
  assert.match(database, /^dev0366_[a-f0-9]{12}$/);
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
  ).trim();
}
const schema = docker([
  "pg_dump",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "--schema-only",
]);
const migration = readFileSync(
  "supabase/migrations/20261019000100_private_schedule_preview.sql",
  "utf8",
);
const fingerprint = `select md5(coalesce(string_agg(fingerprint,E'\\n' order by tablename),'')) from (
  select tablename,query_to_xml(format('select * from app.%I order by to_jsonb(%I)::text',tablename,tablename),false,true,'')::text fingerprint
  from pg_tables where schemaname='app'
) rows;`;
docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
try {
  psql(
    schema +
      "\ndrop function if exists app.public_private_schedule_preview(text);\n",
  );
  psql(migration);
  assert.equal(
    psql(
      "set role app_runtime; select count(*) from app.public_private_schedule_preview('unknown-coach');",
    ),
    "0",
  );
  assert.equal(
    psql(
      "select has_function_privilege('anon','app.public_private_schedule_preview(text)','execute'),has_function_privilege('authenticated','app.public_private_schedule_preview(text)','execute'),has_function_privilege('app_runtime','app.public_private_schedule_preview(text)','execute');",
    ),
    "f|f|t",
  );
  console.log("Fresh empty-schema function and restricted grants passed.");
  psql(
    "drop function app.public_private_schedule_preview(text);\n" +
      readFileSync("supabase/seed.sql", "utf8"),
  );
  const before = psql(fingerprint);
  const authority = psql(
    "select md5(string_agg(pg_get_functiondef(p.oid),E'\\n' order by p.oid::regprocedure::text)) from pg_proc p where p.pronamespace='app'::regnamespace;",
  );
  psql(migration);
  assert.equal(psql(fingerprint), before);
  assert.equal(
    psql(
      "select md5(string_agg(pg_get_functiondef(p.oid),E'\\n' order by p.oid::regprocedure::text)) from pg_proc p where p.pronamespace='app'::regnamespace and p.proname<>'public_private_schedule_preview';",
    ),
    authority,
  );
  console.log(
    "Seeded upgrade preserved all application rows and existing authority functions.",
  );
} finally {
  docker(["dropdb", "-U", "supabase_admin", "--force", database]);
  console.log("Exact disposable database removed.");
}
