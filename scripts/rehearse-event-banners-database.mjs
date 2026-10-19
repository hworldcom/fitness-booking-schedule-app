import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const suffix = randomUUID().replaceAll("-", "").slice(0, 12),
  created = [];
const target = "20261018001000_group_session_banners.sql";
const migrations = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= target)
  .sort();
assert.equal(migrations.at(-1), target);
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
function psql(db, input) {
  assert.match(db, /^dev0356_[a-z0-9_]+$/);
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
const infrastructure = docker([
  "pg_dump",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "--schema-only",
]);
const fingerprint = `create temporary table preserved(name text,hash text);do $$ declare t record;v text;begin for t in select schemaname,tablename from pg_tables where (schemaname='app' and tablename<>'group_session_banners') or (schemaname='storage' and tablename='objects') order by schemaname,tablename loop execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) from %I.%I x',t.schemaname,t.tablename) into v;insert into preserved values(t.schemaname||'.'||t.tablename,v);end loop;end $$;select jsonb_agg(to_jsonb(p) order by name) from preserved p;`;
try {
  for (const mode of ["fresh", "upgrade"]) {
    const db = `dev0356_${suffix}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", db]);
    created.push(db);
    psql(db, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const f of migrations.filter((f) => f !== target))
      psql(db, readFileSync("supabase/migrations/" + f, "utf8"));
    psql(db, readFileSync("supabase/seed.sql", "utf8"));
    if (mode === "upgrade") {
      psql(
        db,
        `select app.group_session_flags(true);insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents,currency,status) select '93560000-0000-4000-8000-000000000001',c.run_id,c.profile_id,'group-93560000000040008000000000000001','Preserved legacy event','Existing draft before media migration.','Boxing','All levels',l.id,jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label,'kind',l.location_kind,'latitude',l.latitude,'longitude',l.longitude),(current_date+5)+time '10:00',(current_date+5)+time '11:00',(current_date+4)+time '10:00',2,8,0,'EUR','draft' from app.coach_profiles c join app.coach_training_locations l on l.profile_id=c.profile_id and l.run_id=c.run_id and l.is_primary where c.is_demo and c.public_slug='daniel-park' order by c.profile_id limit 1;select app.group_session_flags(false);`,
      );
    }
    const before = psql(db, fingerprint);
    psql(db, readFileSync("supabase/migrations/" + target, "utf8"));
    assert.equal(
      psql(db, fingerprint),
      before,
      "Media migration changed retained rows",
    );
    assert.equal(
      psql(db, "select count(*) from app.group_session_banners;"),
      "0\n",
    );
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "tests/database/event-banners.test.ts",
      ],
      {
        env: {
          ...process.env,
          DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${db}`,
        },
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    process.stdout.write(
      mode + " migration preserves all prior rows; " + output,
    );
  }
} finally {
  for (const db of created)
    docker(["dropdb", "-U", "supabase_admin", "--if-exists", db]);
}
