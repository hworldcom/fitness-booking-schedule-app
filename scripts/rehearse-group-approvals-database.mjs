import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const migration = "20261024000100_group_registration_approvals.sql";
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= migration)
  .sort();
assert.equal(files.at(-1), migration);
const created = [];
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
 schemaname,tablename),false,true,'')))[1]::text hash from pg_tables
 where (schemaname='app')
 or (schemaname='auth' and tablename='users')
 or (schemaname='storage' and tablename in ('buckets','objects'))) hashes;`;
const retainedFingerprints = fingerprints;
const retained = query(
  "postgres",
  "set transaction read only;" + retainedFingerprints,
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
    const database = `mov77_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    query(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of files.filter((f) => f < migration))
      query(database, readFileSync(`supabase/migrations/${file}`, "utf8"));
    query(database, readFileSync("supabase/seed.sql", "utf8"));
    if (mode === "upgrade") {
      const baseline = query(database, fingerprints);
      const historical = `insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,status,published_at,created_at)
      select ident.id,c.run_id,c.profile_id,'group-'||replace(ident.id::text,'-',''),'Retained event','Preserved','Boxing','All levels',l.id,
      jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),
      date_trunc('day',clock_timestamp())+interval '3 days 12 hours',date_trunc('day',clock_timestamp())+interval '3 days 13 hours',clock_timestamp()+interval '2 days',1,4,0,'open',clock_timestamp(),clock_timestamp()-interval '1 minute'
      from app.coach_profiles c join app.coach_training_locations l on l.run_id=c.run_id and l.profile_id=c.profile_id and l.status='active' cross join (select gen_random_uuid() id offset 0) ident limit 1 returning id;`;
      const ownedId = query(database, historical).trim();
      assert.match(ownedId, /^[a-f0-9-]{36}$/);
      const beforeRefusal = query(database, fingerprints);
      assert.throws(
        () =>
          query(
            database,
            readFileSync(`supabase/migrations/${migration}`, "utf8"),
          ),
        /MOV-77 requires reviewed empty published group inventory/,
      );
      assert.equal(
        query(database, fingerprints),
        beforeRefusal,
        "Refused migration changed retained history",
      );
      query(
        database,
        `delete from app.coach_group_sessions where id='${ownedId}'::uuid;`,
      );
      assert.equal(
        query(database, fingerprints),
        baseline,
        "Historical fixture cleanup changed unrelated rows",
      );
      // A retained unpublished draft is compatible and must survive the forward migration.
      query(
        database,
        historical.replace("'open',clock_timestamp(),", "'draft',null,"),
      );
    }
    const before = query(database, fingerprints);
    query(database, readFileSync(`supabase/migrations/${migration}`, "utf8"));
    assert.equal(
      query(database, fingerprints),
      before,
      "Migration changed existing rows",
    );
    process.stdout.write(
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--conditions=react-server",
          "--test",
          "--test-concurrency=1",
          "tests/database/group-sessions.test.ts",
          "tests/database/group-scheduling.test.ts",
          "tests/database/group-calendar-session-types.test.ts",
        ],
        {
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
          env: {
            ...process.env,
            DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${database}`,
          },
        },
      ),
    );
    console.log(
      `${mode}: approval migration, permissions, lifecycle and group scheduling regressions passed`,
    );
  }
} catch (error) {
  console.error(
    error.stdout?.toString().slice(-16000) ||
      error.stderr?.toString().slice(-6000) ||
      error.message,
  );
  process.exitCode = 1;
} finally {
  for (const db of created)
    docker(["dropdb", "-U", "supabase_admin", "--force", db]);
  assert.equal(
    query("postgres", "set transaction read only;" + retainedFingerprints),
    retained,
    "Retained local data changed",
  );
  console.log(
    "Owned group-approval scratch databases removed; retained app/Auth/Storage rows preserved.",
  );
}
