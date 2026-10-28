// MOV-135: uniquely owned scratch databases; infrastructure only, no retained identities/rows.
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
const migration = "20261027000400_coach_personal_website.sql";
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= migration)
  .sort();
assert.equal(files.at(-1), migration);
const created = [];
const docker = (args, input) =>
  execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    {
      input,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
function query(db, input) {
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
    input,
  );
}
const hashes = `select jsonb_object_agg(name,hash) from (select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) hash from %I.%I x',schemaname,tablename),false,false,'')))[1]::text hash from pg_tables where schemaname='app' or (schemaname='auth' and tablename='users') or (schemaname='storage' and tablename in ('buckets','objects'))) hashes;`;
const attrs = `select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'security',p.prosecdef,'volatility',p.provolatile) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app';`;
const retained = verifiedDatabaseFingerprints(
  query("postgres", "set transaction read only;" + hashes),
);
const rolesQuery =
  "select md5(jsonb_agg(to_jsonb(r) order by oid)::text) from pg_authid r;";
const roles = query("postgres", rolesQuery);
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
    const db = `mov135_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", db]);
    created.push(db);
    query(db, infrastructure + "\nDROP SCHEMA app CASCADE;");
    for (const file of files.filter((f) => f < migration))
      query(db, readFileSync("supabase/migrations/" + file, "utf8"));
    if (mode === "upgrade") {
      query(db, readFileSync("supabase/seed.sql", "utf8"));
      query(
        db,
        `insert into app.coach_website_content(run_id,profile_id,revision,content) select run_id,profile_id,7,'{"brandLabel":"Legacy profile","introduction":"Keep existing content","approach":"","experience":"","focusLabels":[],"faqs":[],"links":[{"label":"Original social link","url":"https://instagram.com/legacy"}]}'::jsonb from app.coach_profiles order by profile_id limit 1;`,
      );
    }
    if (mode === "upgrade")
      query(
        db,
        `insert into app.coach_website_content(run_id,profile_id,revision,content) select run_id,profile_id,9,'{"brandLabel":"Existing social profile","introduction":"Keep languages and socials","approach":"","experience":"","focusLabels":[],"faqs":[],"links":[],"languages":["English","Tiếng Việt"],"socialLinks":{"instagram":"https://instagram.com/keep-existing"}}'::jsonb from app.coach_profiles order by profile_id offset 1 limit 1;`,
      );
    const before = verifiedDatabaseFingerprints(query(db, hashes));
    const authority = query(db, attrs);
    query(db, readFileSync("supabase/migrations/" + migration, "utf8"));
    assert.equal(
      verifiedDatabaseFingerprints(query(db, hashes)),
      before,
      "Migration changed existing rows/revisions",
    );
    assert.equal(query(db, attrs), authority, "Function authority changed");
    if (mode === "fresh") query(db, readFileSync("supabase/seed.sql", "utf8"));
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/coach-socials-languages.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_TEST_URL: `postgresql://supabase_admin:postgres@127.0.0.1:55322/${db}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    process.stdout.write(output);
    console.log(
      `PASS MOV-135 ${mode}: current 44 migrations, exact row/revision/function-authority preservation and real restricted-runtime checks`,
    );
  }
} catch (error) {
  console.error(error.message);
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  for (const db of created.reverse()) {
    try {
      docker(["dropdb", "-U", "supabase_admin", db]);
      console.log(`Removed owned ${db}`);
    } catch {
      console.error(`Cleanup failed: ${db}`);
      process.exitCode = 1;
    }
  }
  assert.equal(
    verifiedDatabaseFingerprints(
      query("postgres", "set transaction read only;" + hashes),
    ),
    retained,
    "Retained rows changed",
  );
  assert.equal(query("postgres", rolesQuery), roles, "Retained roles changed");
  console.log(
    "PASS retained local app/Auth/Storage rows and role credentials unchanged",
  );
}
