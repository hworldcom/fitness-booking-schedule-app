// MOV-140: uniquely owned scratch databases; infrastructure only, no retained identities/rows.
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
assert.ok(process.argv.slice(2).every((arg) => arg === "--release-base"));
const releaseBase = process.argv.includes("--release-base");
const migration = "20261030000100_coach_application_instagram_handles.sql";
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
  for (const mode of releaseBase ? ["release_upgrade"] : ["fresh", "upgrade"]) {
    const db = `mov140_${randomUUID().replaceAll("-", "").slice(0, 12)}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", db]);
    created.push(db);
    query(db, infrastructure + "\nDROP SCHEMA app CASCADE;");
    for (const file of files.filter(
      (f) =>
        f < migration && (!releaseBase || f.slice(0, 14) <= "20261027000200"),
    ))
      query(db, readFileSync("supabase/migrations/" + file, "utf8"));
    if (mode !== "fresh") {
      query(db, readFileSync("supabase/seed.sql", "utf8"));
      query(
        db,
        `do $$ declare ident uuid:=gen_random_uuid(); p record; begin
        insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(ident,'retained-'||ident::text||'@example.test',statement_timestamp(),false,false);
        select * into p from app.enroll_application_identity(ident,'Retained applicant','Retained applicant','ig_'||substr(replace(ident::text,'-',''),1,12));
        perform set_config('app.current_auth_user_id',ident::text,true);
        perform set_config('app.current_profile_id',p.identity_profile_id::text,true);
        perform set_config('app.current_run_id',p.identity_run_id::text,true);
        perform set_config('app.current_run_role','member',true);
        perform app.submit_owned_coach_application();
        perform app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":"https://www.instagram.com/existing_coach","facebookUrl":null,"linkedinUrl":null}'::jsonb);
        perform app.upsert_owned_coach_profile('Retained applicant','An existing application whose private contact and queued staff snapshot must remain untouched.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null);
      end $$;`,
      );
    }
    const before = verifiedDatabaseFingerprints(query(db, hashes));
    const authority = query(db, attrs);
    const unchangedBodies = query(
      db,
      "select jsonb_agg(jsonb_build_object('id',p.oid,'body',p.prosrc) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.oid<>'app.valid_application_social_url(text,text)'::regprocedure;",
    );
    query(db, readFileSync("supabase/migrations/" + migration, "utf8"));
    assert.equal(
      verifiedDatabaseFingerprints(query(db, hashes)),
      before,
      "Migration changed existing rows/revisions",
    );
    assert.equal(query(db, attrs), authority, "Function authority changed");
    assert.equal(
      query(
        db,
        "select jsonb_agg(jsonb_build_object('id',p.oid,'body',p.prosrc) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.oid<>'app.valid_application_social_url(text,text)'::regprocedure;",
      ),
      unchangedBodies,
      "Unrelated function body changed",
    );
    query(db, readFileSync("supabase/migrations/" + migration, "utf8"));
    assert.equal(
      verifiedDatabaseFingerprints(query(db, hashes)),
      before,
      "Repeated forward correction changed data",
    );
    if (mode === "fresh") query(db, readFileSync("supabase/seed.sql", "utf8"));
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/coach-application-instagram.test.ts",
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
      `PASS MOV-140 ${mode}: ${releaseBase ? "released 42-version base + correction" : "current 45 migrations"}, exact row/revision/function-authority preservation and real restricted-runtime checks`,
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
