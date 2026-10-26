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
const target = "20261026000200_message_counterpart_profiles.sql",
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
const attributes = `select jsonb_build_object('owner',proowner,'acl',proacl,'securityDefiner',prosecdef,'config',proconfig,'volatility',provolatile) from pg_proc where oid='app.mail_conversation_projection(app.message_conversations,uuid)'::regprocedure;`;
const legacyProjection = `select app.mail_flags(true);
select coalesce(jsonb_agg(app.mail_conversation_projection(c,actor.id)-'counterpartProfileHref' order by c.id,actor.id),'[]'::jsonb)
from app.message_conversations c cross join lateral(values(c.coach_profile_id),(c.athlete_profile_id))actor(id);
select app.mail_flags(false);`;
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
      "mov115_" + randomUUID().replaceAll("-", "").slice(0, 12) + "_" + mode;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", name]);
    created.push(name);
    query(name, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const f of files.filter((f) => f !== target))
      query(name, readFileSync("supabase/migrations/" + f, "utf8"));
    if (mode === "upgrade") {
      query(name, readFileSync("supabase/seed.sql", "utf8"));
      query(
        name,
        `select app.mail_flags(true); with pair as(select c.run_id,c.profile_id coach_id,m.profile_id athlete_id from app.coach_profiles c join app.demo_run_participants m on m.run_id=c.run_id and m.profile_id<>c.profile_id limit 1), conversation as(insert into app.message_conversations(run_id,coach_profile_id,athlete_profile_id,last_seq) select run_id,coach_id,athlete_id,1 from pair returning id,coach_profile_id), context as(insert into app.message_contexts(conversation_id,kind) select id,'inquiry' from conversation returning id,conversation_id) insert into app.message_entries(conversation_id,seq,sender_profile_id,kind,body,submission_id,context_id) select c.id,1,c.coach_profile_id,'text','MOV115 retained pre-migration message',gen_random_uuid(),x.id from conversation c join context x on x.conversation_id=c.id; select app.mail_flags(false);`,
      );
    }
    const before = snapshot(name),
      meta = query(name, attributes),
      priorProjection = query(name, legacyProjection);
    query(name, readFileSync("supabase/migrations/" + target, "utf8"));
    assert.equal(snapshot(name), before, "Migration changed retained rows");
    assert.equal(query(name, attributes), meta, "Function authority changed");
    assert.equal(
      query(name, legacyProjection),
      priorProjection,
      "Migration changed an existing conversation projection field",
    );
    query(name, readFileSync("supabase/migrations/" + target, "utf8"));
    assert.equal(snapshot(name), before, "Repeat migration changed rows");
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
        "tests/database/message-profile-links.test.ts",
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
      "PASS MOV-115 " + mode + " projection/authority/data-preservation checks",
    );
  }
} finally {
  for (const name of created.reverse()) {
    assert.match(name, /^mov115_[a-z0-9_]+$/);
    docker(["dropdb", "-U", "supabase_admin", "--if-exists", name]);
  }
  assert.equal(snapshot("postgres"), retained, "Retained local data changed");
  console.log(
    "PASS retained application/Auth-user/Storage hashes unchanged; exact scratch databases removed",
  );
}
