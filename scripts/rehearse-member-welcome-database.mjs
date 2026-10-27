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
const target = "20261027000200_member_welcome.sql",
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
const attributes = `select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'securityDefiner',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app';`;
const legacyProjection = `select pg_get_functiondef('app.message_command(text,jsonb)'::regprocedure);`;
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
      "mov131_" + randomUUID().replaceAll("-", "").slice(0, 12) + "_" + mode;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", name]);
    created.push(name);
    query(name, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const f of files.filter((f) => f !== target))
      query(name, readFileSync("supabase/migrations/" + f, "utf8"));
    if (mode === "upgrade") {
      query(name, readFileSync("supabase/seed.sql", "utf8"));
      query(
        name,
        `insert into auth.users(id,is_sso_user,is_anonymous) values('ae013100-0000-4000-8000-000000000001',false,false);
        select app.enroll_application_identity('ae013100-0000-4000-8000-000000000001','Prior Member','Private Prior Name','mov131_prior');`,
      );
    }
    const before = snapshot(name),
      meta = query(name, attributes),
      priorProjection = query(name, legacyProjection);
    query(name, readFileSync("supabase/migrations/" + target, "utf8"));
    const after = JSON.parse(snapshot(name)),
      original = JSON.parse(before);
    for (const key of Object.keys(original))
      assert.equal(
        after[key],
        original[key],
        "Migration changed retained rows: " + key,
      );
    assert.equal(
      query(name, "select count(*) from app.member_welcomes;").trim(),
      "0",
      "Unexpected backfill",
    );
    const oldMeta = JSON.parse(meta),
      newMeta = JSON.parse(query(name, attributes));
    for (const f of oldMeta)
      assert.deepEqual(
        newMeta.find((x) => x.signature === f.signature),
        f,
        "Existing function authority changed",
      );
    assert.equal(
      query(name, legacyProjection),
      priorProjection,
      "Legacy Messages command changed",
    );
    if (mode === "upgrade") {
      query(
        name,
        `select app.enroll_application_identity('ae013100-0000-4000-8000-000000000001','Replacement Name','Replacement Private','mov131_another');`,
      );
      assert.equal(
        query(name, "select count(*) from app.member_welcomes").trim(),
        "0",
        "Prior account was backfilled on retry",
      );
      const repeated = JSON.parse(snapshot(name));
      for (const key of Object.keys(original))
        assert.equal(
          repeated[key],
          original[key],
          "Existing account retry changed retained data",
        );
    } else query(name, readFileSync("supabase/seed.sql", "utf8"));
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/member-welcome.test.ts",
        "tests/database/registration-profile.test.ts",
        "tests/database/private-messages.test.ts",
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
      "PASS MOV-131 " + mode + " projection/authority/data-preservation checks",
    );
  }
} finally {
  for (const name of created.reverse()) {
    assert.match(name, /^mov131_[a-z0-9_]+$/);
    docker(["dropdb", "-U", "supabase_admin", "--if-exists", name]);
  }
  assert.equal(snapshot("postgres"), retained, "Retained local data changed");
  console.log(
    "PASS retained application/Auth-user/Storage hashes unchanged; exact scratch databases removed",
  );
}
