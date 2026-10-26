import { seedBeforeFitness } from "./lib/seed-compatibility.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const container = LOCAL_SUPABASE_DATABASE_CONTAINER;
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const created = [];
const target = "20261018000300_coach_starting_rates.sql";
const migrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql") && file <= target)
  .sort();
assert.equal(migrations.at(-1), target);
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
function psql(database, input) {
  assert.match(database, /^dev0313_[a-z0-9_]+$/);
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
const infrastructure = docker([
  "pg_dump",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "--schema-only",
]);
const preservation = `create temporary table rate_preserved(table_name text,hash text);
do $$ declare t record;fingerprint text; begin
 for t in select tablename from pg_tables where schemaname='app' and tablename<>'coach_starting_rates' order by tablename loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(v) order by to_jsonb(v)::text)::text,''[]'')) from app.%I v',t.tablename) into fingerprint;
  insert into rate_preserved values(t.tablename,fingerprint);
 end loop;
end $$;
select jsonb_agg(to_jsonb(t) order by table_name) from rate_preserved t;
select md5(coalesce(jsonb_agg(to_jsonb(o) order by id)::text,'[]')) from storage.objects o;
select md5(string_agg(pg_get_functiondef(p.oid),'\n' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app' and p.proname~'(book|request|message|group)';`;
function run(database, files) {
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--conditions=react-server",
      "--test",
      "--test-concurrency=1",
      ...files,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${database}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  process.stdout.write(output);
}
try {
  for (const mode of ["fresh", "upgrade"]) {
    const database = `dev0313_${suffix}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    psql(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of migrations.filter((file) => file !== target))
      psql(database, readFileSync("supabase/migrations/" + file, "utf8"));
    if (mode === "upgrade") {
      psql(
        database,
        seedBeforeFitness(readFileSync("supabase/seed.sql", "utf8")),
      );
      psql(
        database,
        `insert into app.coach_website_content(run_id,profile_id,revision,content)
        select run_id,profile_id,5,'{"brandLabel":"Retained branding","introduction":"Retained introduction","approach":"","experience":"","focusLabels":[],"faqs":[],"links":[]}'::jsonb from app.coach_profiles order by profile_id limit 1;
        update app.profiles set avatar_storage_path=id::text||'/91310000-0000-4000-8000-000000000001.webp',avatar_updated_at='2026-10-01T10:00:00Z' where id=(select id from app.profiles order by id limit 1);
        insert into storage.objects(bucket_id,name,metadata) select 'account-avatars',avatar_storage_path,'{"mimetype":"image/webp","size":100}'::jsonb from app.profiles where avatar_storage_path is not null;`,
      );
      const before = psql(database, preservation);
      psql(database, readFileSync("supabase/migrations/" + target, "utf8"));
      assert.equal(
        psql(database, preservation),
        before,
        "Pricing migration changed existing application data or booking/request/message/group functions.",
      );
      assert.equal(
        psql(database, "select count(*) from app.coach_starting_rates;"),
        "0\n",
      );
    } else {
      psql(database, readFileSync("supabase/migrations/" + target, "utf8"));
      psql(
        database,
        seedBeforeFitness(readFileSync("supabase/seed.sql", "utf8")),
      );
    }
    run(database, ["tests/database/coach-starting-rates.test.ts"]);
    console.log(
      `Passed DEV0313 ${mode} migration/privacy/revision checks through ${target}.`,
    );
    if (mode === "fresh") {
      // Preserve the pricing migration boundary above. Today's shared group
      // regressions additionally require banners/types/individual approvals.
      const peerTarget = "20261024000100_group_registration_approvals.sql";
      for (const file of readdirSync("supabase/migrations")
        .filter(
          (name) =>
            name.endsWith(".sql") &&
            name > target &&
            name <= peerTarget &&
            ![
              "20261023000100_message_notifications.sql",
              "20261023000200_private_booking_notifications.sql",
            ].includes(name),
        )
        .sort())
        psql(database, readFileSync("supabase/migrations/" + file, "utf8"));
      run(database, [
        "tests/database/coach-bookings.test.ts",
        "tests/database/private-messages.test.ts",
        "tests/database/group-sessions.test.ts",
      ]);
      console.log(
        `Passed current shared regressions with prerequisites through ${peerTarget}.`,
      );
    }
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Starting-rate database checks failed.",
  );
  if (error?.stdout) console.error(String(error.stdout));
  if (error?.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  for (const database of created.reverse()) {
    try {
      docker(["dropdb", "-U", "supabase_admin", database]);
      console.log(`Removed ${database}.`);
    } catch {
      console.error(
        `Cleanup failed for owned disposable database ${database}.`,
      );
      process.exitCode = 1;
    }
  }
}
