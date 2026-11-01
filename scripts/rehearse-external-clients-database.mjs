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
const target = "20261101000200_targeted_coach_invitations.sql",
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
const hashes = `select jsonb_object_agg(name,hash) from (select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg((to_jsonb(x)-''external_client_id'') order by (to_jsonb(x)-''external_client_id'')::text)::text,''[]'')) hash from %I.%I x',schemaname,tablename),false,false,'')))[1]::text hash from pg_tables where schemaname='app' or(schemaname='auth' and tablename='users') or(schemaname='storage' and tablename in('buckets','objects'))) hashes;`;
const snapshot = (db, stripAddedColumn = false) =>
  verifiedDatabaseFingerprints(
    query(
      db,
      "set transaction read only;" +
        (stripAddedColumn
          ? hashes
          : hashes.replaceAll(
              "(to_jsonb(x)-''external_client_id'')",
              "to_jsonb(x)",
            )),
    ),
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
  for (const mode of ["fresh", "upgrade"]) {
    const name =
      "movexternal_" +
      randomUUID().replaceAll("-", "").slice(0, 12) +
      "_" +
      mode;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", name]);
    created.push(name);
    query(name, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const f of files.filter(
      (f) => f < "20261101000100_external_clients.sql",
    ))
      query(name, readFileSync("supabase/migrations/" + f, "utf8"));
    query(name, readFileSync("supabase/seed.sql", "utf8"));
    if (mode === "upgrade")
      query(
        name,
        `do $$ declare a uuid:=gen_random_uuid();p record;begin
      insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(a,'external-upgrade@example.test',now(),false,false);
      select * into p from app.enroll_application_identity(a,'Retained external-client upgrade fixture');
      insert into app.athlete_training_entries(run_id,profile_id,occurrence_key,source,title,starts_at,ends_at,timezone,attendance,notes)
       values(p.identity_run_id,p.identity_profile_id,'manual:'||gen_random_uuid(),'personal','Retained workout',now()-interval '2 hours',now()-interval '1 hour','UTC','attended','Keep my existing private text');end $$;`,
      );
    const before = JSON.parse(snapshot(name, true));
    for (const migration of files.filter(
      (f) => f >= "20261101000100_external_clients.sql",
    ))
      query(name, readFileSync("supabase/migrations/" + migration, "utf8"));
    const after = JSON.parse(snapshot(name, true));
    for (const [table, hash] of Object.entries(before))
      assert.equal(after[table], hash, "Changed old data " + table);
    process.stdout.write(
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "--test",
          "--test-concurrency=1",
          "tests/database/external-clients.test.ts",
        ],
        {
          env: {
            ...process.env,
            DATABASE_TEST_URL:
              "postgresql://postgres:postgres@127.0.0.1:55322/" + name,
          },
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    );
    const tap = query(
      name,
      readFileSync("supabase/tests/external_clients.sql", "utf8"),
    );
    assert.ok(!/not ok|Looks like you failed/.test(tap), tap);
    process.stdout.write(tap);
    const lintUrl = new URL(
      "postgresql://postgres:postgres@127.0.0.1:55322/" + name,
    );
    lintUrl.searchParams.set(
      "options",
      "-c app.current_run_id=00000000-0000-0000-0000-000000000000 -c app.current_profile_id=00000000-0000-0000-0000-000000000000 -c app.current_auth_user_id=00000000-0000-0000-0000-000000000000 -c app.current_run_role=member",
    );
    process.stdout.write(
      execFileSync(
        new URL("../node_modules/.bin/supabase", import.meta.url).pathname,
        [
          "db",
          "lint",
          "--db-url",
          lintUrl.href,
          "--schema",
          "app",
          "--level",
          "error",
          "--fail-on",
          "error",
        ],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      ),
    );
    console.log(
      "PASS external clients " +
        mode +
        " migration, authority and preservation",
    );
  }
} finally {
  for (const name of created.reverse()) {
    assert.match(name, /^movexternal_[a-z0-9_]+$/);
    docker(["dropdb", "-U", "supabase_admin", "--if-exists", name]);
  }
  assert.equal(snapshot("postgres"), retained, "Retained local data changed");
  console.log(
    "PASS exact owned scratch targets removed; retained app/Auth/Storage unchanged",
  );
}
