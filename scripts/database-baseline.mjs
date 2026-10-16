import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_SUPABASE_DATABASE_CONTAINER } from "./lib/local-supabase-project.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const archive = resolve(root, "supabase/migration-history/20261016000100");
const manifestPath = resolve(archive, "manifest.json");
const baselinePath = resolve(
  root,
  "supabase/migrations/20261016000100_baseline.sql",
);
const container =
  process.env.BASELINE_DATABASE_CONTAINER ?? LOCAL_SUPABASE_DATABASE_CONTAINER;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function verifyArchive(checkBaseline = true) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const files = readdirSync(archive)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const expected = manifest.migrations.map((entry) => entry.file);
  if (
    manifest.cutoff !== "20261016000100" ||
    expected.length !== 53 ||
    JSON.stringify(files) !== JSON.stringify(expected)
  )
    throw new Error("Completed migration archive membership/order changed.");
  for (const entry of manifest.migrations) {
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(entry.file))
      throw new Error("Invalid archived migration filename.");
    if (digest(readFileSync(resolve(archive, entry.file))) !== entry.sha256)
      throw new Error(`Archived migration changed: ${entry.file}`);
  }
  if (
    checkBaseline &&
    digest(readFileSync(baselinePath)) !== manifest.baselineSha256
  )
    throw new Error("Baseline differs from its generated manifest checksum.");
  return manifest;
}

function databaseName(value) {
  if (!/^dev0265_[a-z0-9_]+$/.test(value ?? ""))
    throw new Error("Use an explicitly named dev0265_* disposable database.");
  return value;
}

function docker(args) {
  return execFileSync("docker", ["exec", container, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function query(database, sql) {
  return docker([
    "psql",
    "-X",
    "-U",
    "supabase_admin",
    "-d",
    databaseName(database),
    "-v",
    "ON_ERROR_STOP=1",
    "-qAtc",
    sql,
  ]).trim();
}

function schema(database) {
  return docker([
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    databaseName(database),
    "--schema-only",
    "--schema=app",
  ])
    .replace(/^\\(?:un)?restrict .*\n/gm, "")
    .replace(/^-- Dumped (?:from|by).*\n/gm, "");
}

const policyQuery = `select coalesce(string_agg(format(
  'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
  policyname,schemaname,tablename,permissive,cmd,
  array_to_string(array(select quote_ident(r::text) from unnest(roles) r order by r),','),
  case when qual is null then '' else ' USING ('||qual||')' end,
  case when with_check is null then '' else ' WITH CHECK ('||with_check||')' end
),'\n' order by policyname),'') from pg_policies
where schemaname='storage' and tablename='objects'
and (policyname like 'account_avatars_%' or policyname like 'coach_portraits_%')`;

const bucketQuery = `select jsonb_agg(jsonb_build_object(
  'id',id,'name',name,'public',public,'file_size_limit',file_size_limit,
  'allowed_mime_types',allowed_mime_types) order by id)::text
from storage.buckets where id in ('account-avatars','coach-portraits')`;

const roleQuery = `select jsonb_agg(jsonb_build_object('name',rolname,
  'login',rolcanlogin,'super',rolsuper,'bypass',rolbypassrls,
  'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit)
  order by rolname)::text from pg_roles where rolname in ('app_owner','app_runtime')`;

function generate(database) {
  const manifest = verifyArchive(false);
  const buckets = JSON.parse(query(database, bucketQuery));
  if (buckets?.length !== 2)
    throw new Error(
      "Reference must contain both migration-created Storage buckets.",
    );
  const foundation = readFileSync(
    resolve(archive, manifest.migrations[0].file),
    "utf8",
  ).split("create schema if not exists app authorization app_owner;")[0];
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  const bucketSql = buckets
    .map(
      (bucket) =>
        `(${literal(bucket.id)},${literal(bucket.name)},${bucket.public},${bucket.file_size_limit},array[${bucket.allowed_mime_types.map(literal).join(",")}]::text[])`,
    )
    .join(",\n");
  const sql = `-- DEV0265: equivalent fresh-database baseline through ${manifest.cutoff}.
-- Original migrations and source/checksum manifest: ../migration-history/${manifest.cutoff}/
-- Existing databases require the documented history transition; never replay over retained data.
do $$ begin
  if to_regnamespace('app') is not null then
    raise exception 'Baseline requires an empty app schema; preserve existing data and follow the migration-history transition guide';
  end if;
end $$;

${foundation}
create extension if not exists btree_gist with schema extensions;

${schema(database)}
-- External project policies and required setup rows are outside a schema-only app dump.
SET row_security = on;
${query(database, policyQuery)}

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ${bucketSql}
on conflict(id) do update set name=excluded.name,public=excluded.public,
  file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
SET check_function_bodies = true;
`;
  writeFileSync(baselinePath, sql);
  manifest.baselineSha256 = digest(sql);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `Generated baseline from ${database}; preserved 53 archived originals.`,
  );
}

function schemaObjects(dump) {
  // PostgreSQL reparses associative CHECK expressions when restoring a dump.
  // Compare those through the server parser separately, never by deleting parentheses.
  return dump
    .replace(/^\s*CONSTRAINT .+ CHECK .*\n/gm, "")
    .split(/(?=^--\n-- Name: )/m)
    .map((part) => part.trim())
    .sort();
}

const checkQuery = `begin;
create temporary table dev0265_checks(table_name text,constraint_name text,definition text,
  validated boolean,no_inherit boolean,is_deferrable boolean,initially_deferred boolean) on commit drop;
do $$ declare source record; temporary_name text; definition text; begin
  for source in select c.*,t.relname from pg_constraint c
    join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='app' and c.contype='c' order by t.relname,c.conname loop
    temporary_name := 'dev0265_check_'||source.conrelid::text;
    execute format('create temporary table if not exists %I (like app.%I) on commit drop',temporary_name,source.relname);
    execute format('alter table pg_temp.%I add constraint %I %s',temporary_name,source.conname,pg_get_constraintdef(source.oid));
    select pg_get_constraintdef(c.oid) into definition from pg_constraint c
      where c.conrelid=to_regclass('pg_temp.'||temporary_name) and c.conname=source.conname;
    insert into dev0265_checks values(source.relname,source.conname,definition,
      source.convalidated,source.connoinherit,source.condeferrable,source.condeferred);
  end loop;
end $$;
select jsonb_agg(to_jsonb(c) order by table_name,constraint_name)::text from dev0265_checks c;
rollback;`;

function compare(reference, candidate) {
  verifyArchive();
  const left = schemaObjects(schema(reference));
  const right = schemaObjects(schema(candidate));
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    const changed = left.filter((part) => !right.includes(part));
    const added = right.filter((part) => !left.includes(part));
    console.error(
      "Different schema object headers:",
      [...changed, ...added].map(
        (part) =>
          part.split("\n").find((line) => line.startsWith("-- Name:")) ??
          "dump settings",
      ),
    );
    throw new Error(
      "Baseline schema/owner/ACL/default-privilege definitions differ.",
    );
  }
  for (const [label, sql] of [
    ["parsed CHECK constraints and enforcement flags", checkQuery],
    ["Storage policies", policyQuery],
    ["Storage bucket configuration", bucketQuery],
    ["application roles", roleQuery],
    [
      "required extensions",
      `select string_agg(extname||':'||extversion,',' order by extname) from pg_extension where extname in ('pgcrypto','btree_gist')`,
    ],
  ]) {
    if (query(reference, sql) !== query(candidate, sql))
      throw new Error(`Baseline differs in ${label}.`);
  }
  console.log(
    `Equivalent ${left.length} schema definition blocks, owners/ACLs/default privileges, project Storage policies/buckets, roles and required extensions.`,
  );
}

try {
  const [command, first, second] = process.argv.slice(2);
  if (command === "verify") {
    verifyArchive();
    console.log(
      "Verified 53 original migration checksums and generated baseline checksum.",
    );
  } else if (command === "generate") generate(databaseName(first));
  else if (command === "compare")
    compare(databaseName(first), databaseName(second));
  else
    throw new Error(
      "Usage: node scripts/database-baseline.mjs verify | generate dev0265_reference | compare dev0265_reference dev0265_baseline",
    );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Baseline verification failed.",
  );
  process.exitCode = 1;
}
