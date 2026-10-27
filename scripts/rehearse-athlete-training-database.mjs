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
const target = "20261027000100_stop_athlete_routines.sql",
  created = [];
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
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
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
const hashes = `select jsonb_object_agg(name,hash) from (select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',schemaname,tablename),false,false,'')))[1]::text hash from pg_tables where schemaname='app' or(schemaname='auth' and tablename='users') or(schemaname='storage' and tablename in('buckets','objects'))) hashes;`;
const snapshot = (db) =>
  verifiedDatabaseFingerprints(
    query(db, "set transaction read only;" + hashes),
  );
const retained = snapshot("postgres");
try {
  const infrastructure = docker([
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "--schema-only",
  ]);
  for (const mode of ["fresh", "upgrade", "routine_upgrade"]) {
    const name =
      "mov120_" + randomUUID().replaceAll("-", "").slice(0, 12) + "_" + mode;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", name]);
    created.push(name);
    query(name, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const f of files.filter((f) => f < "20261026000500"))
      query(name, readFileSync("supabase/migrations/" + f, "utf8"));
    if (mode !== "fresh")
      query(name, readFileSync("supabase/seed.sql", "utf8"));
    if (mode === "routine_upgrade") {
      for (const f of files.filter((f) => f >= "20261026000500" && f < target))
        query(name, readFileSync("supabase/migrations/" + f, "utf8"));
      query(
        name,
        `do $$ declare a uuid:=gen_random_uuid(); p record; r uuid:=gen_random_uuid(); begin
        insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(a,'routine-upgrade@example.test',now(),false,false);
        select * into p from app.enroll_application_identity(a,'Routine upgrade fixture');
        insert into app.athlete_training_rules(id,series_id,run_id,profile_id,title,timezone,from_date,weekday,local_time)
          values(r,r,p.identity_run_id,p.identity_profile_id,'Retained routine','UTC',current_date-7,extract(dow from current_date),'19:00');
        insert into app.athlete_training_entries(run_id,profile_id,occurrence_key,source,rule_id,title,starts_at,ends_at,timezone,attendance,notes)
          values(p.identity_run_id,p.identity_profile_id,'p:'||r||':'||(current_date-7),'personal',r,'Retained log',now()-interval '7 days',now()-interval '7 days'+interval '1 hour','UTC','attended','Preserve annotation');
        end $$;`,
      );
    }
    const before = JSON.parse(snapshot(name));
    for (const f of files.filter(
      (f) => f >= (mode === "routine_upgrade" ? target : "20261026000500"),
    ))
      query(name, readFileSync("supabase/migrations/" + f, "utf8"));
    // Forward replacement is repeatable and retains the command function's
    // identity and privileges in the populated training upgrade.
    const authority =
      "select jsonb_build_object('oid',oid::text,'owner',proowner::text,'acl',proacl::text,'security',prosecdef,'config',proconfig,'volatility',provolatile) from pg_proc where oid='app.athlete_training_command(text,jsonb)'::regprocedure";
    const beforeRepeat = query(name, authority);
    query(name, readFileSync("supabase/migrations/" + target, "utf8"));
    assert.equal(query(name, authority), beforeRepeat);
    const after = JSON.parse(snapshot(name));
    for (const [table, hash] of Object.entries(before))
      assert.equal(after[table], hash, "Changed old rows " + table);
    if (mode === "fresh")
      query(name, readFileSync("supabase/seed.sql", "utf8"));
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/athlete-training.test.ts",
      ],
      {
        env: {
          ...process.env,
          DATABASE_TEST_URL:
            "postgresql://postgres:postgres@127.0.0.1:55322/" + name,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    process.stdout.write(output);
    console.log(
      "PASS MOV-120 " + mode + " projection/authority/data-preservation checks",
    );
  }
} finally {
  for (const name of created.reverse()) {
    assert.match(name, /^mov120_[a-z0-9_]+$/);
    docker(["dropdb", "-U", "supabase_admin", "--if-exists", name]);
  }
  assert.equal(snapshot("postgres"), retained, "Retained local data changed");
  console.log(
    "PASS retained application/Auth-user/Storage hashes unchanged; exact scratch databases removed",
  );
}
